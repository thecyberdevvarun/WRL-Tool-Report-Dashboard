import sql from "mssql";
import { dbConfig1 } from "../../config/db.config.js";
import { tryCatch } from "../../utils/try-catch.js";
import { AppError } from "../../utils/app-error.js";
// ↑ copy these 4 import lines from production-dashboard.controller.js if the paths differ

/* Route:  GET .../brazing-performance?line=freezer|sus|visi|all
                                      &shiftDate=YYYY-MM-DD&shift=A|B   */

// Header process -> brazing station process mapping
const LINE_MAP_SQL = {
  freezer: `
    SELECT h.p, s.p
    FROM (VALUES (12206),(12401),(12402)) h(p)
    CROSS JOIN (VALUES (12204),(12205),(12302)) s(p)
  `,
  sus: `
    SELECT h.p, s.p
    FROM (VALUES (12603),(12610),(12611)) h(p)
    CROSS JOIN (VALUES (12606),(12608)) s(p)
  `,
  visi: `
    SELECT h.p, s.p
    FROM (VALUES (12612),(12613),(12617)) h(p)
    CROSS JOIN (VALUES (12614),(12615),(12616)) s(p)
  `,
};

const LINE_LABELS = {
  freezer: "Freezer Brazing",
  sus: "SUS Brazing",
  visi: "VISI Brazing",
};

const buildQuery = (mapSql) => `
  SET NOCOUNT ON;

  DROP TABLE IF EXISTS
    #Map, #Insp, #Brazing, #StationTime, #Login;

  /* Header process -> allowed brazing station */
  CREATE TABLE #Map (
    HeaderProcess INT NOT NULL,
    StationProcess INT NOT NULL,
    PRIMARY KEY (HeaderProcess, StationProcess)
  );

  INSERT INTO #Map (HeaderProcess, StationProcess)
  ${mapSql};

  /* Get inspections in selected date range */
  SELECT
    it.ID,
    it.InspectionLotNo,
    it.InspectedOn,
    ih.DocNo,
    ih.Process,
    iud.Status,
    iud.LineCode
  INTO #Insp
  FROM InspectionTrans it
  INNER JOIN InspectionHeader ih
    ON ih.InspectionLotNo = it.InspectionLotNo
  INNER JOIN InspectionUD iud
    ON iud.ID = it.ID
  WHERE it.InspectedOn >= @startDate
    AND it.InspectedOn <= @endDate
    AND ih.Process IN (
      SELECT DISTINCT HeaderProcess FROM #Map
    );

  CREATE CLUSTERED INDEX IX_Insp
    ON #Insp (DocNo, Process);

  /* Resolve joint and brazing station */
  SELECT DISTINCT
    pp.Name AS Station,
    pt.Name AS Joint_Name,
    pt.Description AS Joint_Description,
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
  INTO #Brazing
  FROM #Insp i
  INNER JOIN ProcessRouting pr
    ON pr.PSNo = i.DocNo
    AND pr.ProcessCode = i.Process
  INNER JOIN ParameterTran pt
    ON pt.ParameterCode = pr.ParameterCode
    AND pt.LineCode = i.LineCode
  INNER JOIN RouteInstruction ri
    ON ri.RouteCode = pr.RouteCode
    AND ri.Instruction = pt.Name
  INNER JOIN RoutingTrans rt
    ON rt.SeqNo = ri.SeqNo
    AND rt.RouteCode = ri.RouteCode
  INNER JOIN #Map m
    ON m.HeaderProcess = i.Process
    AND m.StationProcess = rt.ProcessCode
  INNER JOIN ProductionProcess pp
    ON pp.ProcessCode = rt.ProcessCode
  INNER JOIN WorkCenterProcesses wp
    ON wp.ProcessCode = rt.ProcessCode;

  /* Find brazer login for each station and timestamp */
  SELECT DISTINCT
    StationCode,
    InspectedOn
  INTO #StationTime
  FROM #Brazing;

  SELECT
    st.StationCode,
    st.InspectedOn,
    pl.UserCode
  INTO #Login
  FROM #StationTime st
  OUTER APPLY (
    SELECT TOP (1)
      pul.UserCode
    FROM ProcessUserLogin pul
    WHERE pul.Station = st.StationCode
      AND pul.Login <= st.InspectedOn
      AND (
        pul.Logout IS NULL
        OR pul.Logout >= st.InspectedOn
      )
    ORDER BY
      pul.Login DESC,
      pul.RowID DESC
  ) pl;

  CREATE CLUSTERED INDEX IX_Login
    ON #Login (StationCode, InspectedOn);

  /* Final report */
  ;WITH Final AS (
    SELECT
      us.UserName AS Brazer_Name,
      b.Joint_Name,
      b.Joint_Description,
      b.Station,
      CAST(b.InspectedOn AS DATE) AS InspDate,
      b.Status,
      b.DocNo
    FROM #Brazing b
    INNER JOIN #Login l
      ON l.StationCode = b.StationCode
      AND l.InspectedOn = b.InspectedOn
    LEFT JOIN Users us
      ON us.UserCode = l.UserCode
  )
  SELECT
    ISNULL(Brazer_Name, 'Not Logged In') AS Brazer_Name,
    Joint_Name,
    Joint_Description,
    Station,
    CONVERT(VARCHAR(11), InspDate, 106) AS [Date],
    DATENAME(MONTH, InspDate) AS [Month],
    SUM(
      CASE WHEN Status = 0 THEN 1 ELSE 0 END
    ) AS Leakage_Count,
    COUNT(DISTINCT DocNo) AS Total_Joint_Brazed
  FROM Final
  GROUP BY
    Brazer_Name,
    Joint_Name,
    Joint_Description,
    Station,
    InspDate
  ORDER BY
    InspDate,
    Station,
    Brazer_Name;

  DROP TABLE IF EXISTS
    #Map, #Insp, #Brazing, #StationTime, #Login;
`;

const runLine = async (pool, line, start, end) => {
  const result = await pool
    .request()
    .input("startDate", sql.DateTime, start)
    .input("endDate", sql.DateTime, end)
    .query(buildQuery(LINE_MAP_SQL[line]));

  return result.recordset.map((row) => ({
    ...row,
    Line: LINE_LABELS[line],
  }));
};

/* ─────────────────────────── shift window ─────────────────────────── */

// Shift A = 08:00 → 20:00 on shiftDate
// Shift B = 20:00 on shiftDate → 08:00 next day
const SHIFT_HOURS = { A: { from: 8, to: 20 }, B: { from: 20, to: 32 } };

const NOT_LOGGED_IN = "Not Logged In";

/* Shift window as "wall-clock" dates.
   mssql (useUTC = true, the default) sends the UTC parts of a JS Date, so
   building the Date with "Z" makes SQL Server receive exactly 08:00 / 20:00.
   If your dbConfig1 sets options.useUTC = false, build local Dates instead. */
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

/* ─────────────────────────── aggregation ─────────────────────────── */

const bump = (map, key, seed, joints, leakage) => {
  const cur = map.get(key) ?? { ...seed, joints: 0, leakage: 0 };
  cur.joints += joints;
  cur.leakage += leakage;
  map.set(key, cur);
};

const withRate = (m) => ({
  ...m,
  leakagePct:
    m.joints > 0 ? Number(((m.leakage / m.joints) * 100).toFixed(1)) : 0,
});

const aggregateBrazing = (rows) => {
  const brazers = new Map();
  const stations = new Map();
  const joints = new Map();
  let totalJoints = 0;
  let totalLeakage = 0;

  for (const r of rows) {
    const j = Number(r.Total_Joint_Brazed) || 0;
    const l = Number(r.Leakage_Count) || 0;
    totalJoints += j;
    totalLeakage += l;

    bump(brazers, r.Brazer_Name, { name: r.Brazer_Name }, j, l);
    bump(
      stations,
      `${r.Line}|${r.Station}`,
      { name: r.Station, line: r.Line },
      j,
      l,
    );
    bump(
      joints,
      `${r.Line}|${r.Joint_Name}`,
      { name: r.Joint_Name, description: r.Joint_Description, line: r.Line },
      j,
      l,
    );
  }

  const list = (map) => [...map.values()].map(withRate);

  return {
    summary: {
      totalJoints,
      leakage: totalLeakage,
      leakagePct:
        totalJoints > 0
          ? Number(((totalLeakage / totalJoints) * 100).toFixed(1))
          : 0,
      brazerCount: [...brazers.keys()].filter((n) => n !== NOT_LOGGED_IN)
        .length,
      stationCount: stations.size,
    },
    // most joints first
    brazers: list(brazers).sort((a, b) => b.joints - a.joints),
    stations: list(stations).sort((a, b) => b.joints - a.joints),
    // worst first — only joints that actually leaked
    joints: list(joints)
      .filter((x) => x.leakage > 0)
      .sort((a, b) => b.leakage - a.leakage || b.leakagePct - a.leakagePct),
  };
};

/* ─────────────────────────── handler ─────────────────────────── */

export const getBrazingDashboard = tryCatch(async (req, res) => {
  const { line = "all", shiftDate, shift } = req.query;

  if (
    line !== "all" &&
    !Object.prototype.hasOwnProperty.call(LINE_MAP_SQL, line)
  ) {
    throw new AppError(
      `Invalid line. Expected one of: all, ${Object.keys(LINE_MAP_SQL).join(", ")}.`,
      400,
    );
  }

  const win = buildShiftWindow(shiftDate, shift);
  if (!win) {
    throw new AppError("Invalid shiftDate (YYYY-MM-DD) or shift (A | B).", 400);
  }

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const lines = line === "all" ? Object.keys(LINE_MAP_SQL) : [line];
    const results = await Promise.all(
      lines.map((l) => runLine(pool, l, win.start, win.end)),
    );

    res.status(200).json({
      success: true,
      message: "Brazing dashboard data retrieved successfully.",
      line,
      shiftDate,
      shift,
      data: aggregateBrazing(results.flat()),
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Brazing dashboard: ${error.message}`,
      500,
    );
  } finally {
    await pool.close();
  }
});
