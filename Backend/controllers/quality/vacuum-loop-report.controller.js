/** Pirani vacuum-gauge leak test report (pool1 / GARUDA — pirani_test_header, pirani_test_log). */
import sql from "mssql";
import { dbConfig1 } from "../../config/db.config.js";
import { tryCatch } from "../../utils/try-catch.js";
import { AppError } from "../../utils/app-error.js";
import { convertToIST } from "../../utils/convert-to-ist.js";

export const getVacuumReport = tryCatch(async (req, res) => {
  const { startDate, endDate, lineName, result } = req.query;

  if (!startDate || !endDate) {
    throw new AppError(
      "Missing required query parameters: startDate or endDate.",
      400,
    );
  }

  const istStart = convertToIST(startDate);
  const istEnd = convertToIST(endDate);

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const req2 = pool
      .request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate", sql.DateTime, istEnd);

    let query = `
      SELECT
          h.test_id       AS TestId,
          h.serial_no     AS SerialNo,
          h.model_code    AS ModelCode,
          h.model_name    AS ModelName,
          h.line_name     AS LineName,
          h.gauge_id      AS GaugeId,
          h.start_time    AS StartTime,
          h.end_time      AS EndTime,
          DATEDIFF(SECOND, h.start_time, h.end_time) / 60.0 AS DurationMinutes,
          h.final_result  AS FinalResult,
          h.upper_limit   AS UpperLimit
      FROM pirani_test_header h
      WHERE h.start_time BETWEEN @startDate AND @endDate
    `;

    if (lineName) {
      req2.input("lineName", sql.VarChar(100), lineName);
      query += " AND h.line_name = @lineName";
    }
    if (result && result !== "All") {
      req2.input("result", sql.VarChar(20), result);
      query += " AND h.final_result = @result";
    }

    query += " ORDER BY h.start_time DESC";

    const data = await req2.query(query);

    res.status(200).json({
      success: true,
      message: "Vacuum Report data retrieved successfully.",
      data: data.recordset,
    });
  } catch (error) {
    throw new AppError(`Failed to fetch Vacuum Report: ${error.message}`, 500);
  } finally {
    await pool.close();
  }
});

// Distinct line names present in the vacuum test data — feeds the Line filter dropdown.
// These are exactly the values getVacuumReport compares against (h.line_name = @lineName).
export const getVacuumLines = tryCatch(async (req, res) => {
  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool.request().query(`
      SELECT DISTINCT line_name AS LineName
      FROM pirani_test_header
      WHERE line_name IS NOT NULL AND LTRIM(RTRIM(line_name)) <> ''
    `);

    // "Line 2" before "Line 10"
    const lines = result.recordset
      .map((r) => r.LineName)
      .sort((a, b) =>
        String(a).localeCompare(String(b), undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      );

    res.status(200).json({
      success: true,
      message: "Vacuum lines retrieved successfully.",
      data: lines,
    });
  } catch (error) {
    throw new AppError(`Failed to fetch vacuum lines: ${error.message}`, 500);
  } finally {
    await pool.close();
  }
});

// Per-test vacuum trend — same query shape as the original Pirani service's
// /api/report/<test_id>/trend endpoint, ported onto this app's MSSQL pool.
export const getVacuumTestTrend = tryCatch(async (req, res) => {
  const { testId } = req.params;

  if (!testId) {
    throw new AppError("Missing required parameter: testId.", 400);
  }

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool
      .request()
      .input("testId", sql.UniqueIdentifier, testId).query(`
        SELECT log_time AS LogTime, vacuum AS Vacuum, result AS Result
        FROM pirani_test_log
        WHERE test_id = @testId
        ORDER BY log_time
      `);

    res.status(200).json({
      success: true,
      message: "Vacuum test trend retrieved successfully.",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch vacuum test trend: ${error.message}`,
      500,
    );
  } finally {
    await pool.close();
  }
});
