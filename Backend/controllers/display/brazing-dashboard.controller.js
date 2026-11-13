import sql from "mssql";
import { dbConfig1 } from "../../config/db.config.js";
import { tryCatch } from "../../utils/try-catch.js";
import { AppError } from "../../utils/app-error.js";

/* Route:  GET /dashboard/brazing-performance?line=freezer|sus|visi&shiftDate=YYYY-MM-DD&shift=A|B

   Response: { success, data: { machines: [{
       MachineName, CameraUrl, OperatorName, OperatorCode, OperatorPhoto,
       TotalJoints, TotalOk, TotalNotOk, Efficiency }] } }
   One entry per brazing station of the line (stations with no output show 0). */

// ═════════════════════════════════════════════════════════════════════════════
//  SETTINGS
// ═════════════════════════════════════════════════════════════════════════════

// Header process -> brazing station process, per line
const LINES = {
  freezer: { headers: [12206, 12401, 12402], stations: [12204, 12205, 12302] },
  sus: { headers: [12603, 12610, 12611], stations: [12606, 12608] },
  visi: { headers: [12612, 12613, 12617], stations: [12614, 12615, 12616] },
};

// OPTIONAL — fill these in when you know where the camera / photo come from.
// While they return null the dashboard shows "Camera not available" and initials.
const CAMERA_URLS = {
  // "FZ BRAZING - I": "http://<camera-ip>/snapshot.jpg",
};
const operatorPhotoUrl = (/* userCode */) => null;
// e.g. (userCode) => `http://10.100.95.160/Garuda_Arch/Photos/${userCode}.jpg`

// The dashboard refreshes every 15s on every TV; identical requests inside this window share one query
const CACHE_MS = 10_000;

// ═════════════════════════════════════════════════════════════════════════════
//  SHARED DB POOL  (the old code opened and closed a new pool on every request)
// ═════════════════════════════════════════════════════════════════════════════
let poolPromise = null;

const getPool = () => {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(dbConfig1)
      .connect()
      .then((pool) => {
        pool.on("error", (err) => {
          console.error("[brazing pool error]", err);
          poolPromise = null;
        });
        return pool;
      })
      .catch((err) => {
        poolPromise = null;
        throw err;
      });
  }
  return poolPromise;
};

// ═════════════════════════════════════════════════════════════════════════════
//  SQL  — READ ONLY
//  One SELECT built from CTEs. It creates, changes and drops nothing in the database
//  (no temp tables, no INSERT / UPDATE / DELETE / DROP). The matching logic
//  (inspection -> joint -> station -> brazer login) is the same as before.
//  Recordset 1 = output per station / brazer / joint.
//  Recordset 2 = every station of the line, so idle machines still show up with 0.
// ═════════════════════════════════════════════════════════════════════════════
const values = (codes) => codes.map((c) => `(${Number(c)})`).join(",");

const buildQuery = ({ headers, stations }) => `
  SET NOCOUNT ON;

  WITH LineMap AS (
    SELECT h.p AS HeaderProcess, s.p AS StationProcess
    FROM (VALUES ${values(headers)}) h(p)
    CROSS JOIN (VALUES ${values(stations)}) s(p)
  ),
  Insp AS (
    SELECT
      it.ID, it.InspectionLotNo, it.InspectedOn,
      ih.DocNo, ih.Process,
      iud.Status, iud.LineCode
    FROM InspectionTrans it
    INNER JOIN InspectionHeader ih  ON ih.InspectionLotNo = it.InspectionLotNo
    INNER JOIN InspectionUD     iud ON iud.ID             = it.ID
    WHERE it.InspectedOn >= @startDate
      AND it.InspectedOn <= @endDate
      AND ih.Process IN (SELECT HeaderProcess FROM LineMap)
  ),
  Brazing AS (
    SELECT DISTINCT
      pp.Name AS Station,
      pt.Name AS Joint_Name,
      ri.SeqNo,
      i.DocNo,
      pt.LineCode,
      pr.RouteCode,
      i.Status,
      pr.ProcessCode,
      rt.ProcessCode AS StationProcessCode,
      wp.StationCode,
      i.InspectionLotNo,
      i.ID,
      i.InspectedOn
    FROM Insp i
    INNER JOIN ProcessRouting pr
      ON pr.PSNo = i.DocNo AND pr.ProcessCode = i.Process
    INNER JOIN ParameterTran pt
      ON pt.ParameterCode = pr.ParameterCode AND pt.LineCode = i.LineCode
    INNER JOIN RouteInstruction ri
      ON ri.RouteCode = pr.RouteCode AND ri.Instruction = pt.Name
    INNER JOIN RoutingTrans rt
      ON rt.SeqNo = ri.SeqNo AND rt.RouteCode = ri.RouteCode
    INNER JOIN LineMap m
      ON m.HeaderProcess = i.Process AND m.StationProcess = rt.ProcessCode
    INNER JOIN ProductionProcess pp
      ON pp.ProcessCode = rt.ProcessCode
    INNER JOIN WorkCenterProcesses wp
      ON wp.ProcessCode = rt.ProcessCode
  ),
  Logins AS (
    SELECT st.StationCode, st.InspectedOn, pl.UserCode
    FROM (SELECT DISTINCT StationCode, InspectedOn FROM Brazing) st
    OUTER APPLY (
      SELECT TOP (1) pul.UserCode
      FROM ProcessUserLogin pul
      WHERE pul.Station = st.StationCode
        AND pul.Login  <= st.InspectedOn
        AND (pul.Logout IS NULL OR pul.Logout >= st.InspectedOn)
      ORDER BY pul.Login DESC, pul.RowID DESC
    ) pl
  ),
  Final AS (
    SELECT l.UserCode, us.UserName AS Brazer_Name,
           b.Station, b.Joint_Name, b.Status, b.DocNo
    FROM Brazing b
    INNER JOIN Logins l
      ON l.StationCode = b.StationCode AND l.InspectedOn = b.InspectedOn
    LEFT JOIN Users us ON us.UserCode = l.UserCode
  )
  SELECT
    UserCode, Brazer_Name, Station, Joint_Name,
    SUM(CASE WHEN Status = 0 THEN 1 ELSE 0 END) AS Leakage_Count,
    COUNT(DISTINCT DocNo)                       AS Total_Joint_Brazed
  FROM Final
  GROUP BY UserCode, Brazer_Name, Station, Joint_Name;

  SELECT DISTINCT pp.Name AS Station
  FROM ProductionProcess pp
  WHERE pp.ProcessCode IN (${stations.map(Number).join(",")});
`;

// ═════════════════════════════════════════════════════════════════════════════
//  SHIFT WINDOW
//  Shift A = 08:00 -> 20:00 on shiftDate · Shift B = 20:00 on shiftDate -> 08:00 next day.
//  mssql (useUTC = true, the default) sends the UTC parts of a JS Date, so a "Z"
//  date reaches SQL Server as exactly 08:00 / 20:00. If dbConfig1 sets
//  options.useUTC = false, build local Dates here instead.
// ═════════════════════════════════════════════════════════════════════════════
const SHIFT_HOURS = { A: { from: 8, to: 20 }, B: { from: 20, to: 32 } };

const buildShiftWindow = (shiftDate, shift) => {
  const hours = SHIFT_HOURS[shift];
  if (!hours || !/^\d{4}-\d{2}-\d{2}$/.test(shiftDate ?? "")) return null;
  const base = Date.parse(`${shiftDate}T00:00:00Z`);
  if (Number.isNaN(base)) return null;
  return {
    start: new Date(base + hours.from * 3_600_000),
    end: new Date(base + hours.to * 3_600_000 - 1000), // 19:59:59 / 07:59:59
  };
};

// ═════════════════════════════════════════════════════════════════════════════
//  SHAPE THE DATA FOR THE FRONTEND
//  Machine totals = every brazer who worked the station this shift.
//  The operator shown on the card = the logged-in brazer with the most joints.
// ═════════════════════════════════════════════════════════════════════════════
const buildMachines = ([rows, stationRows]) => {
  const machines = new Map();
  const ensure = (name) => {
    if (!machines.has(name))
      machines.set(name, { name, joints: 0, leakage: 0, operators: new Map() });
    return machines.get(name);
  };

  stationRows.forEach((r) => ensure(r.Station));

  rows.forEach((r) => {
    const m = ensure(r.Station);
    const joints = Number(r.Total_Joint_Brazed) || 0;
    m.joints += joints;
    m.leakage += Number(r.Leakage_Count) || 0;

    if (r.UserCode != null) {
      const code = String(r.UserCode).trim();
      const op = m.operators.get(code) ?? {
        code,
        name: r.Brazer_Name || code,
        joints: 0,
      };
      op.joints += joints;
      m.operators.set(code, op);
    }
  });

  return [...machines.values()]
    .map((m) => {
      const top = [...m.operators.values()].sort(
        (a, b) => b.joints - a.joints,
      )[0];
      const notOk = Math.min(m.leakage, m.joints);
      const ok = m.joints - notOk;
      return {
        MachineName: m.name,
        CameraUrl: CAMERA_URLS[m.name] ?? null,
        OperatorName: top?.name ?? null,
        OperatorCode: top?.code ?? null,
        OperatorPhoto: top ? operatorPhotoUrl(top.code) : null,
        TotalJoints: m.joints,
        TotalOk: ok,
        TotalNotOk: notOk,
        Efficiency:
          m.joints > 0 ? Number(((ok / m.joints) * 100).toFixed(1)) : null,
      };
    })
    .sort((a, b) =>
      a.MachineName.localeCompare(b.MachineName, undefined, { numeric: true }),
    );
};

// ═════════════════════════════════════════════════════════════════════════════
//  SHORT CACHE (one query per line + shift per CACHE_MS, shared by all TVs)
// ═════════════════════════════════════════════════════════════════════════════
const cache = new Map(); // key -> { at, promise }

const cached = (key, load) => {
  const now = Date.now();
  for (const [k, v] of cache) if (now - v.at > 60_000) cache.delete(k); // prune

  const hit = cache.get(key);
  if (hit && now - hit.at < CACHE_MS) return hit.promise;

  const promise = load().catch((err) => {
    cache.delete(key); // never cache a failure
    throw err;
  });
  cache.set(key, { at: now, promise });
  return promise;
};

// ═════════════════════════════════════════════════════════════════════════════
//  HANDLER
// ═════════════════════════════════════════════════════════════════════════════
export const getBrazingDashboard = tryCatch(async (req, res) => {
  const { line, shiftDate, shift } = req.query;

  if (!line || !Object.prototype.hasOwnProperty.call(LINES, line)) {
    throw new AppError(
      `Invalid line. Expected one of: ${Object.keys(LINES).join(", ")}.`,
      400,
    );
  }

  const win = buildShiftWindow(shiftDate, shift);
  if (!win) {
    throw new AppError("Invalid shiftDate (YYYY-MM-DD) or shift (A | B).", 400);
  }

  const machines = await cached(`${line}|${shiftDate}|${shift}`, async () => {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("startDate", sql.DateTime, win.start)
      .input("endDate", sql.DateTime, win.end)
      .query(buildQuery(LINES[line]));
    return buildMachines(result.recordsets);
  }).catch((error) => {
    throw new AppError(
      `Failed to fetch brazing dashboard: ${error.message}`,
      500,
    );
  });

  res.status(200).json({
    success: true,
    message: "Brazing dashboard data retrieved successfully.",
    data: { machines },
  });
});
