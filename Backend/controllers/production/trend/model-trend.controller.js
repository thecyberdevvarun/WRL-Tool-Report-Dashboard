import sql from "mssql";
import { dbConfig1, connectToDB } from "../../../config/db.config.js";
import { tryCatch } from "../../../utils/try-catch.js";
import { AppError } from "../../../utils/app-error.js";
import { convertToIST } from "../../../utils/convert-to-ist.js";

/* ─────────────────────────────────────────────────────────────────────────────
   Model Trend controller — Daily / Monthly overview + model report
   (same numbers as the "FG_Daily_Monthly_Reports.xlsx" sheet)

   NOTE: connectToDB(dbConfig1) returns the shared cached pool.
   Do NOT call pool.close() here.
───────────────────────────────────────────────────────────────────────────── */

/* ── Config — change these if your plant rules differ ───────────────────────
   DAY_START_HOUR : 0  → production date = calendar date of Created On (as in the sheet)
                    8  → production day runs 08:00 → 08:00 next day
   SHIFT_1_START / SHIFT_2_START : shift 1 = [SHIFT_1_START, SHIFT_2_START),
                                   shift 2 = everything else.
   (Keep DAY_START_HOUR in sync with DAY_START_HOUR in ModelTrend.jsx)       */
const DAY_START_HOUR = 0;
const SHIFT_1_START = 8;
const SHIFT_2_START = 20;

/* ── Helpers (copied from the FG controller so this file is standalone) ── */

/** Parse a comma-separated integer param (stationCode or linecode). */
const parseIntList = (raw) =>
  String(raw)
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n));

const parseStationCodes = parseIntList;

/** Bind station codes as @sc0, @sc1, … → returns "@sc0, @sc1" */
const bindStationCodes = (request, codes) => {
  codes.forEach((code, i) => {
    request.input(`sc${i}`, sql.Int, code);
  });
  return codes.map((_, i) => `@sc${i}`).join(", ");
};

/** Bind line codes (pa.Remark) as @lc0, @lc1, … → returns "@lc0, @lc1" */
const bindLineCodes = (request, codes) => {
  codes.forEach((code, i) => {
    request.input(`lc${i}`, sql.Int, code);
  });
  return codes.map((_, i) => `@lc${i}`).join(", ");
};

/** Bind the common time + model params. */
const bindBaseParams = (request, { istStart, istEnd, model }) => {
  request
    .input("startTime", sql.DateTime, istStart)
    .input("endTime", sql.DateTime, istEnd)
    .input("model", sql.VarChar, model && model !== "0" ? model : null);
  return request;
};

/** Shared FilteredData + ModelStats CTE (same as the FG controller). */
const buildFilteredDataCTE = (scPlaceholders, lcPlaceholders = null) => `
  FilteredData AS (
      SELECT
          mb.Material,
          CASE WHEN mb.VSerial IS NULL THEN mb.Serial ELSE mb.Alias END AS Assembly_Sr_No,
          pa.ActivityOn,
          pa.StationCode,
          pa.Operator,
          pa.Remark,
          pl.Name,
          mb.Serial,
          mb.VSerial,
          mb.Serial2
      FROM MaterialBarcode mb
      JOIN ProcessActivity pa ON pa.PSNo = mb.DocNo
      LEFT JOIN ProductionLine pl ON CAST(pl.LineCode AS NVARCHAR(50)) = pa.Remark
      WHERE mb.PrintStatus  = 1
        AND mb.Status       <> 99
        AND pa.ActivityType  = 5
        AND pa.StationCode  IN (${scPlaceholders})
        AND pa.ActivityOn  BETWEEN @startTime AND @endTime
        ${lcPlaceholders ? `AND pa.Remark IN (${lcPlaceholders})` : ""}
  ),
  ModelStats AS (
      SELECT
          Material,
          MIN(Serial) AS StartSerial,
          MAX(Serial) AS EndSerial,
          COUNT(*)    AS TotalCount
      FROM FilteredData
      GROUP BY Material
  )
`;

const buildShiftClause = (shift) => {
  if (shift === "shift1") {
    return `AND DATEPART(HOUR, fd.ActivityOn) >= ${SHIFT_1_START}
            AND DATEPART(HOUR, fd.ActivityOn) <  ${SHIFT_2_START}`;
  }
  if (shift === "shift2") {
    return `AND (DATEPART(HOUR, fd.ActivityOn) >= ${SHIFT_2_START}
             OR  DATEPART(HOUR, fd.ActivityOn) <  ${SHIFT_1_START})`;
  }
  return ""; // "both"
};

/* ═══════════════════════════════════════════════════════════════════════════
   fetchModelTrendReport
   GET /prod/model-trend
   query: startTime, endTime, stationCode, linecode?, model?, shift?, reportType?
═══════════════════════════════════════════════════════════════════════════ */
export const fetchModelTrendReport = tryCatch(async (req, res) => {
  const {
    startTime,
    endTime,
    model,
    stationCode,
    linecode,
    shift = "both",
    reportType = "daywise",
  } = req.query;

  if (!startTime || !endTime || !stationCode) {
    throw new AppError(
      "Missing required query parameters: startTime, endTime, stationCode",
      400,
    );
  }

  const stationCodes = parseStationCodes(stationCode);
  if (!stationCodes.length) {
    throw new AppError("Invalid stationCode value.", 400);
  }

  const lineCodes = linecode ? parseIntList(linecode) : [];
  const istStart = convertToIST(startTime);
  const istEnd = convertToIST(endTime);

  // CONVERT(..., 23) = yyyy-mm-dd → CHAR(10) = day, CHAR(7) = yyyy-mm (month)
  const periodLen = reportType === "monthwise" ? 7 : 10;
  const shiftClause = buildShiftClause(shift);

  const pool = await connectToDB(dbConfig1);

  try {
    const request = pool.request();
    bindBaseParams(request, { istStart, istEnd, model });
    const scPlaceholders = bindStationCodes(request, stationCodes);
    const lcPlaceholders = lineCodes.length
      ? bindLineCodes(request, lineCodes)
      : null;
    const cte = buildFilteredDataCTE(scPlaceholders, lcPlaceholders);

    /* FG Qty = unique FG serials where available + records that have no FG serial
       (same rule as the sheet). Users / WorkCenter joins mirror the FG Data
       detail query so the totals match the FG Data tab. */
    const result = await request.query(`
      WITH ${cte},
      Prepared AS (
        SELECT
            fd.Material,
            m.Name       AS Model_Name,
            fd.StationCode,
            CONVERT(CHAR(${periodLen}),
                    DATEADD(HOUR, -${DAY_START_HOUR}, fd.ActivityOn), 23) AS Period,
            CASE WHEN SUBSTRING(fd.Serial, 1, 1) IN ('S','F','L')
                 THEN NULL ELSE NULLIF(fd.Serial, '') END               AS FG_SR
        FROM FilteredData fd
        JOIN Users      u  ON u.UserCode     = fd.Operator
        JOIN WorkCenter wc ON wc.StationCode = fd.StationCode
        JOIN Material   m  ON m.MatCode      = fd.Material
        WHERE (@model IS NULL OR fd.Material = @model)
          ${shiftClause}
      )
      SELECT * INTO #Prepared FROM Prepared;

      -- 0) Overview: one row per period
      SELECT
          Period,
          COUNT(DISTINCT FG_SR) + SUM(CASE WHEN FG_SR IS NULL THEN 1 ELSE 0 END) AS TotalQty,
          COUNT(DISTINCT Material)    AS ModelsProduced,
          COUNT(DISTINCT StationCode) AS StationsUsed,
          COUNT(*)                    AS RecordCount
      FROM #Prepared
      GROUP BY Period
      ORDER BY Period;

      -- 1) Model report: period × model × model no. × station
      SELECT
          Period,
          Model_Name,
          Material    AS ModelNo,
          StationCode,
          COUNT(DISTINCT FG_SR) + SUM(CASE WHEN FG_SR IS NULL THEN 1 ELSE 0 END) AS FGQty,
          COUNT(*)    AS RecordCount
      FROM #Prepared
      GROUP BY Period, Model_Name, Material, StationCode
      ORDER BY Period, Model_Name;

      -- 2) Overall unique totals (can be lower than the sum of group rows)
      SELECT
          COUNT(DISTINCT FG_SR) + SUM(CASE WHEN FG_SR IS NULL THEN 1 ELSE 0 END) AS TotalQty,
          COUNT(DISTINCT Material)    AS ModelsProduced,
          COUNT(DISTINCT StationCode) AS StationsUsed,
          COUNT(*)                    AS RecordCount
      FROM #Prepared;

      DROP TABLE #Prepared;
    `);

    const [overview = [], modelReport = [], summaryRows = []] =
      result.recordsets;

    res.status(200).json({
      success: true,
      message: "Model trend report retrieved successfully",
      reportType: reportType === "monthwise" ? "monthwise" : "daywise",
      data: {
        overview,
        modelReport,
        summary: summaryRows[0] || {
          TotalQty: 0,
          ModelsProduced: 0,
          StationsUsed: 0,
          RecordCount: 0,
        },
      },
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch model trend report: ${error.message}`,
      500,
    );
  }
});
