import sql from "mssql";
import { dbConfig1, connectToDB } from "../../../config/db.config.js";
import { tryCatch } from "../../../utils/try-catch.js";
import { AppError } from "../../../utils/app-error.js";
import { convertToIST } from "../../../utils/convert-to-ist.js";

/* ─────────────────────────────────────────────────────────────────────────────
   NOTE: connectToDB(dbConfig1) uses a Map-based singleton — the first call
   opens the pool; every subsequent call returns the cached pool instantly.
   Do NOT call pool.close() anywhere here — that would destroy the shared pool.
───────────────────────────────────────────────────────────────────────────── */

/**
 * Parse a comma-separated integer param (stationCode or linecode).
 */
const parseIntList = (raw) =>
  String(raw)
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n));

const parseStationCodes = parseIntList;

/**
 * Bind each station code as a numbered @sc0, @sc1, … parameter.
 * Returns the IN-clause placeholder string, e.g. "@sc0, @sc1".
 */
const bindStationCodes = (request, codes) => {
  codes.forEach((code, i) => {
    request.input(`sc${i}`, sql.Int, code);
  });
  return codes.map((_, i) => `@sc${i}`).join(", ");
};

/**
 * Bind each line code as @lc0, @lc1, … (stored in pa.Remark).
 * Returns the IN-clause placeholder string, or null if no codes.
 */
const bindLineCodes = (request, codes) => {
  codes.forEach((code, i) => {
    request.input(`lc${i}`, sql.Int, code);
  });
  return codes.map((_, i) => `@lc${i}`).join(", ");
};

/** Bind the common time + model params shared by every query. */
const bindBaseParams = (request, { istStart, istEnd, model }) => {
  request
    .input("startTime", sql.DateTime, istStart)
    .input("endTime",   sql.DateTime, istEnd)
    .input("model",     sql.VarChar,  model && model !== "0" ? model : null);
  return request;
};

/**
 * Build the shared FilteredData + ModelStats CTE.
 * scPlaceholders — result of bindStationCodes(), e.g. "@sc0, @sc1"
 * lcPlaceholders — result of bindLineCodes(), or null to skip linecode filter
 */
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

/* ═══════════════════════════════════════════════════════════════════════════
   1. fetchFGData — paginated query
═══════════════════════════════════════════════════════════════════════════ */
export const fetchFGData = tryCatch(async (req, res) => {
  const {
    startTime,
    endTime,
    model,
    stationCode,
    linecode,
    page  = 1,
    limit = 1000,
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
  const istStart  = convertToIST(startTime);
  const istEnd    = convertToIST(endTime);
  const pageNum   = parseInt(page,  10);
  const limitNum  = parseInt(limit, 10);
  const offset    = (pageNum - 1) * limitNum;

  const pool = await connectToDB(dbConfig1);

  try {
    /* ── Step 1: cheap COUNT ── */
    const countReq = pool.request();
    bindBaseParams(countReq, { istStart, istEnd, model });
    const scPlaceholders  = bindStationCodes(countReq, stationCodes);
    const lcPlaceholders  = lineCodes.length ? bindLineCodes(countReq, lineCodes) : null;
    const countCTE = buildFilteredDataCTE(scPlaceholders, lcPlaceholders);

    const countResult = await countReq.query(`
      WITH ${countCTE}
      SELECT COUNT(*) AS totalCount
      FROM   FilteredData
      WHERE  (@model IS NULL OR Material = @model)
      OPTION (RECOMPILE);
    `);
    const totalCount = countResult.recordset[0]?.totalCount ?? 0;

    /* ── Step 2: paginated data ── */
    const dataReq = pool.request();
    bindBaseParams(dataReq, { istStart, istEnd, model });
    const scPlaceholders2 = bindStationCodes(dataReq, stationCodes);
    const lcPlaceholders2 = lineCodes.length ? bindLineCodes(dataReq, lineCodes) : null;
    const dataCTE = buildFilteredDataCTE(scPlaceholders2, lcPlaceholders2);
    dataReq
      .input("offset", sql.Int, offset)
      .input("limit",  sql.Int, limitNum);

    const dataResult = await dataReq.query(`
      WITH ${dataCTE}
      SELECT
          ROW_NUMBER() OVER (ORDER BY fd.ActivityOn ASC) AS SrNo,
          m.Name        AS Model_Name,
          fd.Material   AS ModelName,
          fd.StationCode,
          wc.Name       AS Station_Name,
          fd.Assembly_Sr_No,
          ISNULL(fd.VSerial, '')  AS Asset_tag,
          ISNULL(fd.Serial2, '')  AS [Customer_QR],
          CASE WHEN SUBSTRING(fd.Serial, 1, 1) IN ('S','F','L') THEN '' ELSE fd.Serial END AS FG_SR,
          fd.ActivityOn           AS CreatedOn,
          u.UserName,
          ISNULL(fd.Name, '')     AS Name,
          ms.StartSerial,
          ms.EndSerial,
          ms.TotalCount
      FROM FilteredData fd
      JOIN Users      u  ON u.UserCode     = fd.Operator
      JOIN WorkCenter wc ON wc.StationCode = fd.StationCode
      JOIN ModelStats ms ON ms.Material    = fd.Material
      JOIN Material   m  ON m.MatCode      = fd.Material
      WHERE (@model IS NULL OR fd.Material = @model)
      ORDER BY fd.ActivityOn ASC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
      OPTION (RECOMPILE);
    `);

    res.status(200).json({
      success:    true,
      message:    "FG Data retrieved successfully",
      data:       dataResult.recordset,
      totalCount,
    });
  } catch (error) {
    throw new AppError(`Failed to fetch FG data: ${error.message}`, 500);
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   2. productionReportExportData — full export (no pagination)
═══════════════════════════════════════════════════════════════════════════ */
export const productionReportExportData = tryCatch(async (req, res) => {
  const { startTime, endTime, model, stationCode, linecode } = req.query;

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
  const istStart  = convertToIST(startTime);
  const istEnd    = convertToIST(endTime);

  const pool = await connectToDB(dbConfig1);

  try {
    const request = pool.request();
    bindBaseParams(request, { istStart, istEnd, model });
    const scPlaceholders = bindStationCodes(request, stationCodes);
    const lcPlaceholders = lineCodes.length ? bindLineCodes(request, lineCodes) : null;
    const cte = buildFilteredDataCTE(scPlaceholders, lcPlaceholders);

    const result = await request.query(`
      WITH ${cte}
      SELECT
          ROW_NUMBER() OVER (ORDER BY fd.ActivityOn ASC) AS SrNo,
          m.Name        AS Model_Name,
          fd.Material   AS ModelName,
          fd.StationCode,
          wc.Name       AS Station_Name,
          fd.Assembly_Sr_No,
          ISNULL(fd.VSerial, '')  AS Asset_tag,
          ISNULL(fd.Serial2, '')  AS [Customer_QR],
          CASE WHEN SUBSTRING(fd.Serial, 1, 1) IN ('S','F','L') THEN '' ELSE fd.Serial END AS FG_SR,
          fd.ActivityOn           AS CreatedOn,
          u.UserName,
          ISNULL(fd.Name, '')     AS Name,
          ms.StartSerial,
          ms.EndSerial
      FROM FilteredData fd
      JOIN Users      u  ON u.UserCode     = fd.Operator
      JOIN WorkCenter wc ON wc.StationCode = fd.StationCode
      JOIN ModelStats ms ON ms.Material    = fd.Material
      JOIN Material   m  ON m.MatCode      = fd.Material
      WHERE (@model IS NULL OR fd.Material = @model)
      ORDER BY SrNo
      OPTION (RECOMPILE);
    `);

    res.status(200).json({
      success: true,
      message: "Production Report data exported successfully",
      data:    result.recordset,
    });
  } catch (error) {
    throw new AppError(`Failed to fetch export data: ${error.message}`, 500);
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   3. fetchQuickFiltersData — YDAY / TODAY / MTD shortcuts
═══════════════════════════════════════════════════════════════════════════ */
export const fetchQuickFiltersData = tryCatch(async (req, res) => {
  const { startTime, endTime, model, stationCode, linecode } = req.query;

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
  const istStart  = convertToIST(startTime);
  const istEnd    = convertToIST(endTime);

  const pool = await connectToDB(dbConfig1);

  try {
    const request = pool.request();
    bindBaseParams(request, { istStart, istEnd, model });
    const scPlaceholders = bindStationCodes(request, stationCodes);
    const lcPlaceholders = lineCodes.length ? bindLineCodes(request, lineCodes) : null;
    const cte = buildFilteredDataCTE(scPlaceholders, lcPlaceholders);

    const result = await request.query(`
      WITH ${cte}
      SELECT
          m.Name        AS Model_Name,
          fd.Material   AS ModelName,
          fd.StationCode,
          wc.Name       AS Station_Name,
          fd.Assembly_Sr_No,
          ISNULL(fd.VSerial, '')  AS Asset_tag,
          ISNULL(fd.Serial2, '')  AS [Customer_QR],
          CASE WHEN SUBSTRING(fd.Serial, 1, 1) IN ('S','F','L') THEN '' ELSE fd.Serial END AS FG_SR,
          fd.ActivityOn           AS CreatedOn,
          u.UserName,
          ISNULL(fd.Name, '')     AS Name,
          ms.StartSerial,
          ms.EndSerial,
          ms.TotalCount
      FROM FilteredData fd
      JOIN Users      u  ON u.UserCode     = fd.Operator
      JOIN WorkCenter wc ON wc.StationCode = fd.StationCode
      JOIN ModelStats ms ON ms.Material    = fd.Material
      JOIN Material   m  ON m.MatCode      = fd.Material
      WHERE (@model IS NULL OR fd.Material = @model)
      ORDER BY fd.ActivityOn ASC
      OPTION (RECOMPILE);
    `);

    res.status(200).json({
      success:    true,
      message:    "Quick filter data retrieved successfully",
      data:       result.recordset,
      totalCount: result.recordset.length,
    });
  } catch (error) {
    throw new AppError(`Failed to fetch quick filter data: ${error.message}`, 500);
  }
});
