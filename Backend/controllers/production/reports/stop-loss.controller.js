import sql from "mssql";
import { dbConfig1 } from "../../../config/db.config.js";
import { tryCatch } from "../../../utils/try-catch.js";
import { AppError } from "../../../utils/app-error.js";
import { convertToIST } from "../../../utils/convert-to-ist.js";

// ── Singleton connection pool ──────────────────────────────────────────────────
let _pool = null;

async function getPool() {
  if (_pool && _pool.connected) return _pool;
  _pool = await new sql.ConnectionPool(dbConfig1).connect();
  _pool.on("error", () => {
    _pool = null;
  });
  return _pool;
}

// ── IST date helpers ───────────────────────────────────────────────────────────
function nowIST() {
  const now = new Date();
  return new Date(now.getTime() + (330 - now.getTimezoneOffset()) * 60_000);
}
function todayIST8AM() {
  const d = nowIST();
  d.setHours(8, 0, 0, 0);
  return d;
}
function yesterdayIST8AM() {
  const d = todayIST8AM();
  d.setDate(d.getDate() - 1);
  return d;
}
function startOfMonthIST8AM() {
  const d = nowIST();
  d.setDate(1);
  d.setHours(8, 0, 0, 0);
  return d;
}

// ── Shared CTE builder ─────────────────────────────────────────────────────────
function buildCTE(station) {
  const stationFilter = station ? "AND M.PLCLocation = @station" : "";
  return `
    ;WITH
    EMG AS (
      SELECT
        T.RefID,
        M.PLCLocation   AS StationName,
        T.EmgOn,
        T.EmgOff,
        DATEDIFF(SECOND, T.EmgOn, T.EmgOff) AS TotalSeconds
      FROM  EMGTrans  T
      INNER JOIN EMGMaster M
        ON  T.PLCCode = M.PLCCode
        AND T.MEMBit  = M.MEMBit
        AND M.Active  = 1
      WHERE T.EmgOff   IS NOT NULL
        AND T.EmgOn    >= @fromDate
        AND T.EmgOn    <  @toDate
        AND M.Location  = @location
        AND M.LineName  = @lineName
        ${stationFilter}
    ),
    BREAKS AS (
      SELECT
        SB.Name,
        CAST(DATEADD(DAY, N.number, CAST(@fromDate AS DATE)) AS DATETIME)
          + CAST(SB.StartTime AS DATETIME) AS BreakStart,
        CAST(DATEADD(DAY, N.number, CAST(@fromDate AS DATE)) AS DATETIME)
          + CAST(SB.EndTime   AS DATETIME) AS BreakEnd
      FROM ShiftBreaks SB
      CROSS JOIN (
        SELECT number FROM master..spt_values
        WHERE type = 'P' AND number BETWEEN 0 AND DATEDIFF(DAY, @fromDate, @toDate)
      ) N
    ),
    CALC AS (
      SELECT
        E.RefID, E.StationName, E.EmgOn, E.EmgOff, E.TotalSeconds,
        CASE
          WHEN E.TotalSeconds - ISNULL(SUM(
            CASE
              WHEN B.BreakStart < E.EmgOff AND B.BreakEnd > E.EmgOn
              THEN DATEDIFF(SECOND,
                CASE WHEN E.EmgOn  > B.BreakStart THEN E.EmgOn  ELSE B.BreakStart END,
                CASE WHEN E.EmgOff < B.BreakEnd   THEN E.EmgOff ELSE B.BreakEnd   END)
              ELSE 0
            END), 0) > 0
          THEN E.TotalSeconds - ISNULL(SUM(
            CASE
              WHEN B.BreakStart < E.EmgOff AND B.BreakEnd > E.EmgOn
              THEN DATEDIFF(SECOND,
                CASE WHEN E.EmgOn  > B.BreakStart THEN E.EmgOn  ELSE B.BreakStart END,
                CASE WHEN E.EmgOff < B.BreakEnd   THEN E.EmgOff ELSE B.BreakEnd   END)
              ELSE 0
            END), 0)
          ELSE 0
        END AS NetSeconds
      FROM EMG E CROSS JOIN BREAKS B
      GROUP BY E.RefID, E.StationName, E.EmgOn, E.EmgOff, E.TotalSeconds
    )
  `;
}

// ── Bind common params ─────────────────────────────────────────────────────────
function bindCommonParams(
  request,
  isFromDate,
  isToDate,
  location,
  lineName,
  station,
) {
  request
    .input("fromDate", sql.DateTime, isFromDate)
    .input("toDate", sql.DateTime, isToDate)
    .input("location", sql.NVarChar, location)
    .input("lineName", sql.NVarChar, lineName);
  if (station) request.input("station", sql.NVarChar, station);
  return request;
}

// ── Summary query string ───────────────────────────────────────────────────────
const SUMMARY_SELECT = `
  SELECT
    StationName AS [Station_Name],
    CONVERT(VARCHAR, DATEADD(SECOND, SUM(NetSeconds), 0), 108) AS [Total_Stop_Time],
    SUM(NetSeconds) AS [Total_Seconds],
    COUNT(*)        AS [Total_Stop_Count]
  FROM CALC
  WHERE NetSeconds > 0
  GROUP BY StationName
  ORDER BY SUM(NetSeconds) DESC;
`;

// ── Shared quick-filter runner ─────────────────────────────────────────────────
async function runQuickFilter(req, res, fromDate, toDate, label) {
  const { location, lineName, station } = req.query;
  if (!location) throw new AppError("Location is required", 400);
  if (!lineName) throw new AppError("Line Name is required", 400);

  const query = `${buildCTE(station)}${SUMMARY_SELECT}`;
  const pool = await getPool();
  const request = pool.request();
  bindCommonParams(request, fromDate, toDate, location, lineName, station);
  const result = await request.query(query);

  res.status(200).json({
    success: true,
    message: `${label} Stop & Loss Summary retrieved successfully`,
    data: result.recordset,
    totalCount: result.recordset.length,
  });
}

// ── Summary Report ─────────────────────────────────────────────────────────────
export const getStopLossSummary = tryCatch(async (req, res) => {
  const { fromDate, toDate, location, lineName, station } = req.query;
  if (!fromDate || !toDate)
    throw new AppError("From Date and To Date are required", 400);
  if (!location) throw new AppError("Location is required", 400);
  if (!lineName) throw new AppError("Line Name is required", 400);

  const isFromDate = convertToIST(fromDate);
  const isToDate = convertToIST(toDate);
  const query = `${buildCTE(station)}${SUMMARY_SELECT}`;
  const pool = await getPool();
  const request = pool.request();
  bindCommonParams(request, isFromDate, isToDate, location, lineName, station);
  const result = await request.query(query);

  res
    .status(200)
    .json({
      success: true,
      message: "Stop & Loss Summary retrieved successfully",
      data: result.recordset,
    });
});

// ── Detail Report ──────────────────────────────────────────────────────────────
export const getStopLossDetail = tryCatch(async (req, res) => {
  const { fromDate, toDate, location, lineName, station } = req.query;
  if (!fromDate || !toDate)
    throw new AppError("From Date and To Date are required", 400);
  if (!location) throw new AppError("Location is required", 400);
  if (!lineName) throw new AppError("Line Name is required", 400);

  const isFromDate = convertToIST(fromDate);
  const isToDate = convertToIST(toDate);

  const query = `
    ${buildCTE(station)}
    SELECT
      ROW_NUMBER() OVER (PARTITION BY StationName ORDER BY EmgOn) AS [Sr_No],
      StationName                                                   AS [Station_Name],
      CONVERT(DATE,        EmgOn)                                   AS [Date],
      CONVERT(VARCHAR(8),  EmgOn,  108)                             AS [Stop_Time],
      CONVERT(VARCHAR(8),  EmgOff, 108)                             AS [Start_Time],
      NetSeconds                                                    AS [Duration_Seconds],
      CONVERT(VARCHAR, DATEADD(SECOND, NetSeconds, 0), 108)         AS [Duration]
    FROM CALC
    WHERE NetSeconds > 0
    ORDER BY StationName, EmgOn;
  `;

  const pool = await getPool();
  const request = pool.request();
  bindCommonParams(request, isFromDate, isToDate, location, lineName, station);
  const result = await request.query(query);

  res
    .status(200)
    .json({
      success: true,
      message: "Stop & Loss Detail retrieved successfully",
      data: result.recordset,
    });
});

// ── Lines ──────────────────────────────────────────────────────────────────────
export const getStopLossLines = tryCatch(async (req, res) => {
  const { location } = req.query;
  const pool = await getPool();
  const request = pool.request();
  let query = `SELECT DISTINCT LineName FROM EMGMaster WHERE Active = 1 AND LineName IS NOT NULL AND LineName <> ''`;
  if (location) {
    query += ` AND Location = @location`;
    request.input("location", sql.NVarChar, location);
  }
  query += ` ORDER BY LineName;`;
  const result = await request.query(query);
  res
    .status(200)
    .json({
      success: true,
      message: "Lines retrieved successfully",
      data: result.recordset,
    });
});

// ── Locations ──────────────────────────────────────────────────────────────────
export const getStopLossLocations = tryCatch(async (req, res) => {
  const { lineName } = req.query;
  const pool = await getPool();
  const request = pool.request();
  let query = `SELECT DISTINCT Location FROM EMGMaster WHERE Active = 1 AND Location IS NOT NULL AND Location <> ''`;
  if (lineName) {
    query += ` AND LineName = @lineName`;
    request.input("lineName", sql.NVarChar, lineName);
  }
  query += ` ORDER BY Location;`;
  const result = await request.query(query);
  res
    .status(200)
    .json({
      success: true,
      message: "Locations retrieved successfully",
      data: result.recordset,
    });
});

// ── Stations ───────────────────────────────────────────────────────────────────
export const getStopLossStations = tryCatch(async (req, res) => {
  const { location, lineName } = req.query;
  if (!location) throw new AppError("Location is required", 400);
  if (!lineName) throw new AppError("Line Name is required", 400);

  const pool = await getPool();
  const result = await pool
    .request()
    .input("location", sql.NVarChar, location)
    .input("lineName", sql.NVarChar, lineName).query(`
      SELECT DISTINCT PLCLocation AS StationName FROM EMGMaster
      WHERE Active = 1 AND Location = @location AND LineName = @lineName
        AND PLCLocation IS NOT NULL AND PLCLocation <> ''
      ORDER BY PLCLocation;
    `);
  res
    .status(200)
    .json({
      success: true,
      message: "Stations retrieved successfully",
      data: result.recordset,
    });
});

// ── Today / Yesterday / MTD ────────────────────────────────────────────────────
export const getStopLossToday = tryCatch(async (req, res) => {
  await runQuickFilter(req, res, todayIST8AM(), nowIST(), "Today");
});
export const getStopLossYesterday = tryCatch(async (req, res) => {
  await runQuickFilter(req, res, yesterdayIST8AM(), todayIST8AM(), "Yesterday");
});
export const getStopLossMTD = tryCatch(async (req, res) => {
  await runQuickFilter(req, res, startOfMonthIST8AM(), nowIST(), "MTD");
});
