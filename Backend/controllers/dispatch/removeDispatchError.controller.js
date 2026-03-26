import sql from "mssql";
import { dbConfig2 } from "../../config/db.config.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: fetch serials for a given sessionId from all 3 tables
// ─────────────────────────────────────────────────────────────────────────────
const resolveSerialsBySession = async (pool, sid) => {
  const [errLogResult, dmResult, tdResult] = await Promise.all([
    pool
      .request()
      .input("sessionId", sql.NVarChar, sid)
      .query(
        `SELECT DISTINCT FGSerialNo FROM DispatchErrorLog WHERE Session_ID = @sessionId`,
      ),
    pool
      .request()
      .input("sessionId", sql.NVarChar, sid)
      .query(
        `SELECT DISTINCT FGSerialNo FROM DispatchMaster WHERE Session_ID = @sessionId`,
      ),
    pool
      .request()
      .input("sessionId", sql.NVarChar, sid)
      .query(
        `SELECT DISTINCT FGSerialNo FROM tempDispatch WHERE Session_ID = @sessionId`,
      ),
  ]);

  const allSerials = [
    ...errLogResult.recordset,
    ...dmResult.recordset,
    ...tdResult.recordset,
  ]
    .map((r) => r.FGSerialNo)
    .filter(Boolean);

  return [...new Set(allSerials)];
};

// ─────────────────────────────────────────────────────────────────────────────
// CONTROLLER 1: FETCH ONLY (preview before delete)
// GET /api/dispatch/fetch-error-serials
// Body: { sessionId } OR { serialNumbers: [] }
// ─────────────────────────────────────────────────────────────────────────────
export const fetchDispatchErrorSerials = tryCatch(async (req, res) => {
  const { sessionId, serialNumbers } = req.body;

  if (
    !sessionId &&
    (!serialNumbers ||
      !Array.isArray(serialNumbers) ||
      serialNumbers.length === 0)
  ) {
    throw new AppError("Provide either 'sessionId' or 'serialNumbers'.", 400);
  }

  const pool = await new sql.ConnectionPool(dbConfig2).connect();

  try {
    let serials = [];

    if (sessionId) {
      serials = await resolveSerialsBySession(pool, sessionId.trim());

      if (serials.length === 0) {
        return res.status(404).json({
          success: false,
          message: `No serial numbers found for Session ID: ${sessionId}`,
        });
      }
    } else {
      serials = serialNumbers.map((s) => s.trim()).filter(Boolean);
    }

    // For each serial, check which tables it currently exists in
    const preview = [];

    for (const serial of serials) {
      const entry = { serial, foundIn: [] };

      for (const table of ["DispatchMaster", "tempDispatch"]) {
        const checkResult = await pool
          .request()
          .input("serial", sql.NVarChar, serial)
          .query(
            `SELECT COUNT(*) AS cnt FROM ${table} WHERE FGSerialNo = @serial`,
          );

        if (checkResult.recordset[0].cnt > 0) {
          entry.foundIn.push(table);
        }
      }

      preview.push(entry);
    }

    return res.status(200).json({
      success: true,
      message: `Found ${serials.length} serial(s).`,
      total: serials.length,
      preview,
    });
  } catch (error) {
    throw new AppError(`Failed to fetch serials: ${error.message}`, 500);
  } finally {
    await pool.close();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CONTROLLER 2: DELETE (called after user confirms)
// POST /api/dispatch/remove-error-serials
// Body: { deletedBy, sessionId } OR { deletedBy, serialNumbers: [] }
// ─────────────────────────────────────────────────────────────────────────────
export const removeDispatchErrorSerials = tryCatch(async (req, res) => {
  const { deletedBy, sessionId, serialNumbers } = req.body;

  if (!deletedBy || !deletedBy.trim()) {
    throw new AppError("'deletedBy' is required.", 400);
  }

  if (
    !sessionId &&
    (!serialNumbers ||
      !Array.isArray(serialNumbers) ||
      serialNumbers.length === 0)
  ) {
    throw new AppError("Provide either 'sessionId' or 'serialNumbers'.", 400);
  }

  const inputType = sessionId ? "SESSION_ID" : "SERIAL_LIST";
  const pool = await new sql.ConnectionPool(dbConfig2).connect();

  try {
    let serialsToDelete = [];

    // STEP 1: RESOLVE SERIALS
    if (sessionId) {
      serialsToDelete = await resolveSerialsBySession(pool, sessionId.trim());

      if (serialsToDelete.length === 0) {
        return res.status(404).json({
          success: false,
          message: `No serial numbers found for Session ID: ${sessionId}`,
        });
      }
    } else {
      serialsToDelete = serialNumbers.map((s) => s.trim()).filter(Boolean);
    }

    // STEP 2: DELETE + TRACK
    const results = [];
    const deletedAt = new Date();

    for (const serial of serialsToDelete) {
      const entry = { serial, deletedFrom: [], notFoundIn: [], errors: [] };

      for (const table of ["DispatchMaster", "tempDispatch"]) {
        try {
          const checkResult = await pool
            .request()
            .input("serial", sql.NVarChar, serial)
            .query(
              `SELECT COUNT(*) AS cnt FROM ${table} WHERE FGSerialNo = @serial`,
            );

          const exists = checkResult.recordset[0].cnt > 0;

          if (exists) {
            await pool
              .request()
              .input("serial", sql.NVarChar, serial)
              .query(`DELETE FROM ${table} WHERE FGSerialNo = @serial`);

            entry.deletedFrom.push(table);
          } else {
            entry.notFoundIn.push(table);
          }
        } catch (err) {
          entry.errors.push({ table, error: err.message });
        }
      }

      results.push(entry);

      // STEP 3: AUDIT LOG
      try {
        const deletedFromStr =
          entry.deletedFrom.length > 0 ? entry.deletedFrom.join(", ") : null;
        const notFoundInStr =
          entry.notFoundIn.length > 0 ? entry.notFoundIn.join(", ") : null;
        const hasError = entry.errors.length > 0 ? 1 : 0;
        const errorDetail = hasError
          ? entry.errors.map((e) => `${e.table}: ${e.error}`).join(" | ")
          : null;

        await pool
          .request()
          .input("deletedBy", sql.NVarChar, deletedBy.trim())
          .input("deletedAt", sql.DateTime, deletedAt)
          .input("inputType", sql.NVarChar, inputType)
          .input("sessionId", sql.NVarChar, sessionId?.trim() ?? null)
          .input("fgSerialNo", sql.NVarChar, serial)
          .input("deletedFrom", sql.NVarChar, deletedFromStr)
          .input("notFoundIn", sql.NVarChar, notFoundInStr)
          .input("hasError", sql.Bit, hasError)
          .input("errorDetail", sql.NVarChar, errorDetail).query(`
            INSERT INTO DispatchDeleteLog 
              (DeletedBy, DeletedAt, InputType, SessionID, FGSerialNo, DeletedFrom, NotFoundIn, HasError, ErrorDetail)
            VALUES 
              (@deletedBy, @deletedAt, @inputType, @sessionId, @fgSerialNo, @deletedFrom, @notFoundIn, @hasError, @errorDetail)
          `);
      } catch (logErr) {
        entry.logError = `Audit log failed: ${logErr.message}`;
      }
    }

    // STEP 4: RESPONSE
    const deleted = results.filter((r) => r.deletedFrom.length > 0);
    const notFound = results.filter(
      (r) => r.deletedFrom.length === 0 && r.errors.length === 0,
    );
    const withErrors = results.filter((r) => r.errors.length > 0);

    return res.status(200).json({
      success: true,
      message: `Processed ${serialsToDelete.length} serial(s).`,
      summary: {
        total: serialsToDelete.length,
        deleted: deleted.length,
        notFound: notFound.length,
        withErrors: withErrors.length,
      },
      details: results,
    });
  } catch (error) {
    throw new AppError(
      `Failed to remove dispatch error serials: ${error.message}`,
      500,
    );
  } finally {
    await pool.close();
  }
});
