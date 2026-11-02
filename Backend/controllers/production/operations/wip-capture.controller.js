import sql from "mssql";
import { dbConfig1 } from "../../../config/db.config.js";
import { tryCatch } from "../../../utils/try-catch.js";
import { AppError } from "../../../utils/app-error.js";

/* ════════════════════════════════════════════
   Capture WIP Entry
════════════════════════════════════════════ */
export const captureWIP = tryCatch(async (req, res) => {
  const { serialNumber, workstationName, workstationCode, department, userId } =
    req.body;

  if (!serialNumber) {
    throw new AppError("Serial Number is required", 400);
  }

  if (!workstationName || !workstationCode) {
    throw new AppError("Workstation details are required", 400);
  }

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    /* ──────────────────────────────────────────
          MUST EXIST IN PRODUCTION FIRST
    ────────────────────────────────────────── */
    const productionCheck = await pool
      .request()
      .input("serialNumber", sql.NVarChar, serialNumber).query(`
        SELECT TOP 1 BarcodeNo
        FROM ProcessStageLabel
        WHERE BarcodeNo = @serialNumber
      `);

    if (productionCheck.recordset.length === 0) {
      throw new AppError("Serial Number not found in production", 404);
    }

    /* ──────────────────────────────────────────
       Prevent Duplicate Scan In WIP Table
    ────────────────────────────────────────── */
    const existing = await pool
      .request()
      .input("serialNumber", sql.NVarChar, serialNumber).query(`
        SELECT TOP 1 *
        FROM WIPCaptures
        WHERE SerialNumber = @serialNumber
        ORDER BY CreatedAt DESC
      `);

    if (existing.recordset.length > 0) {
      throw new AppError("Serial Number already scanned", 409);
    }

    /* ──────────────────────────────────────────
       Insert Capture
    ────────────────────────────────────────── */
    const result = await pool
      .request()
      .input("serialNumber", sql.NVarChar, serialNumber)
      .input("workstationName", sql.NVarChar, workstationName)
      .input("workstationCode", sql.NVarChar, workstationCode)
      .input("department", sql.NVarChar, department || "PRODUCTION")
      .input("userId", sql.Int, userId || null).query(`
        INSERT INTO WIPCaptures
        (
          SerialNumber,
          WorkstationName,
          WorkstationCode,
          Department,
          UserId
        )
        OUTPUT INSERTED.*
        VALUES
        (
          @serialNumber,
          @workstationName,
          @workstationCode,
          @department,
          @userId
        )
      `);

    res.status(201).json({
      success: true,
      message: "WIP captured successfully",
      data: result.recordset[0],
    });
  } catch (error) {
    throw new AppError(
      error.message || "Failed to capture WIP",
      error.statusCode || 500,
    );
  } finally {
    await pool.close();
  }
});

/* ════════════════════════════════════════════
   Get Latest Captures
════════════════════════════════════════════ */
export const getLatestWIPCaptures = tryCatch(async (req, res) => {
  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool.request().query(`
      SELECT TOP 100
        Id AS _id,
        SerialNumber AS serialNumber,
        WorkstationName AS workstationName,
        WorkstationCode AS workstationCode,
        Department AS department,
        UserId AS userId,
        CreatedAt AS createdAt
      FROM WIPCaptures
      ORDER BY CreatedAt DESC
    `);

    const totalResult = await pool.request().query(`
      SELECT COUNT(*) AS totalCount
      FROM WIPCaptures
      WHERE CAST(CreatedAt AS DATE) = CAST(GETDATE() AS DATE)
    `);

    res.status(200).json({
      success: true,
      message: "Latest WIP captures fetched successfully",
      totalCount: totalResult.recordset[0].totalCount,
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(`Failed to fetch WIP captures: ${error.message}`, 500);
  } finally {
    await pool.close();
  }
});
