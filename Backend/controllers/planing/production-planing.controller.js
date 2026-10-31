import sql from "mssql";
import { dbConfig1 } from "../../config/db.config.js";
import { tryCatch } from "../../utils/try-catch.js";
import { AppError } from "../../utils/app-error.js";

// PlanNo = Series (IDMaster) + Year (2-digit) + SLNo (IDValue), with SLNo
// zero-padded to NoOfDigit digits, e.g. Series=2, Year=26, SLNo=552,
// NoOfDigit=5 -> PlanNo=22600552. NoOfDigit is also used to detect overflow
// and roll the Series forward once SLNo exceeds its digit width.

export const generatePlanNo = async (transaction, yearYY) => {
  const idMasterRes = await new sql.Request(transaction).query(`
    SELECT Series, NoOfDigit
    FROM IDMaster WITH (UPDLOCK, HOLDLOCK)
    WHERE IDTable = 'PlanOrderPrint'
  `);

  if (!idMasterRes.recordset.length) {
    throw new Error(
      "IDMaster configuration missing for IDTable 'PlanOrderPrint'."
    );
  }

  const { Series, NoOfDigit } = idMasterRes.recordset[0];

  const idValueRes = await new sql.Request(transaction)
    .input("year", sql.VarChar, yearYY)
    .query(`
      SELECT SLNo
      FROM IDValue WITH (UPDLOCK, HOLDLOCK)
      WHERE IDTable = 'PlanOrderPrint'
      AND Year = @year
    `);

  // Get next serial number
  const slNo = idValueRes.recordset.length
    ? idValueRes.recordset[0].SLNo
    : 1;

  // Increment SLNo only. Series will never be updated.
  if (idValueRes.recordset.length) {
    await new sql.Request(transaction)
      .input("year", sql.VarChar, yearYY)
      .input("slno", sql.Int, slNo + 1)
      .query(`
        UPDATE IDValue
        SET SLNo = @slno
        WHERE IDTable = 'PlanOrderPrint'
        AND Year = @year
      `);
  } else {
    await new sql.Request(transaction)
      .input("year", sql.VarChar, yearYY)
      .input("slno", sql.Int, slNo + 1)
      .query(`
        INSERT INTO IDValue (IDTable, Year, SLNo)
        VALUES ('PlanOrderPrint', @year, @slno)
      `);
  }

  const paddedSlNo = String(slNo).padStart(NoOfDigit, "0");

  return Number(`${Series}${yearYY}${paddedSlNo}`);
};

export const getModelName = tryCatch(async (req, res) => {
  const { plan } = req.query;

  if (!plan || !["ASSEMBLY", "FG"].includes(plan)) {
    throw new AppError("Invalid plan type.", 400);
  }

  let query;
  if (plan === "ASSEMBLY") {
    query = `
        SELECT Alias, matCode 
        FROM Material 
        WHERE type = 400 AND (Alias LIKE 'S %' OR Alias LIKE '% S')
      `;
  } else {
    query = `
        SELECT Alias, matCode 
        FROM Material 
        WHERE type = 100
      `;
  }

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool.request().query(query);

    res.status(200).json({
      success: true,
      message: "Model Name data retrieved successfully.",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(`Failed to fetch Model Name data:${error.message}`, 500);
  } finally {
    await pool.close();
  }
});

export const getPlanMonth = tryCatch(async (_, res) => {
  const query = `
    Select DISTINCT(PlanMonthYear) 
    from "PlanOrderPrint"
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool.request().query(query);

    res.status(200).json({
      success: true,
      message: "Plan month data retrieved successfully.",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(`Failed to fetch plan month data:${error.message}`, 500);
  } finally {
    await pool.close();
  }
});

export const productionPlaningData = tryCatch(async (req, res) => {
  const { planType, planMonthYear, matcode } = req.query;

  // Only planType and planMonthYear are required
  if (!planType || !planMonthYear) {
    throw new AppError(
      "Missing required query parameters: planType and planMonthYear.",
      400
    );
  }

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const request = pool.request();

    request.input("planType", sql.VarChar, planType);
    request.input("planMonthYear", sql.Int, planMonthYear);

    if (matcode && matcode != 0) {
      request.input("matcode", sql.Int, matcode);
    }

    const query = `
      SELECT
        PlanNo, PlanMonthYear, m.MatCode, m.Alias, PlanQty, InitialPlanQty, PrintLbl, PlanType, Remark,
        u.username, CreatedOn
      FROM PlanOrderPrint AS pop
      JOIN material m ON m.matcode = pop.PlanMaterial
      JOIN users u ON u.userCode = pop.CreatedBy
      WHERE planType = @planType AND PlanMonthYear = @planMonthYear
      ${matcode && matcode != 0 ? "AND pop.PlanMaterial = @matcode" : ""}
      order by PrintLbl desc
    `;

    const result = await request.query(query);

    res.status(200).json({
      success: true,
      message: "Production planing data retrieved successfully.",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Production planing data:${error.message}`,
      500
    );
  } finally {
    await pool.close();
  }
});

export const updateProductionPlaningData = tryCatch(async (req, res) => {
  const { planQty, userCode, remark, matcode, planMonthYear, planType } =
    req.body;

  if (
    !planQty ||
    !userCode ||
    !remark ||
    !matcode ||
    !planMonthYear ||
    !planType
  ) {
    throw new AppError(
      "Missing required query parameters: planQty, userCode, remark, matcode, planMonthYear and planType.",
      400
    );
  }

  const query = `
      UPDATE PlanOrderPrint 
      SET PlanQty = @planQty, CreatedBy=@userCode, Remark = @remark 
      WHERE PlanMaterial = @matcode AND PlanMonthYear = @planMonthYear AND PlanType = @planType;
    `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool
      .request()
      .input("planQty", sql.NVarChar, planQty)
      .input("userCode", sql.Int, userCode)
      .input("remark", sql.NVarChar, remark)
      .input("matcode", sql.NVarChar, matcode)
      .input("planMonthYear", sql.NVarChar, planMonthYear)
      .input("planType", sql.NVarChar, planType)
      .query(query);

    res.status(200).json({
      success: true,
      message: "Production Planing Data updated successfully.",
      data: result.rowsAffected,
    });
  } catch (error) {
    throw new AppError(
      `Failed to update the production planing data:${error.message}`,
      500
    );
  } finally {
    await pool.close();
  }
});

export const addProductionPlaningData = tryCatch(async (req, res) => {
  const { planQty, userCode, remark, matcode, planMonthYear, planType } =
    req.body;

  if (!planQty || !userCode || !matcode || !planMonthYear || !planType) {
    throw new AppError(
      "Missing required query parameters: planQty, userCode, matcode, planMonthYear and planType.",
      400
    );
  }

  // PlanMonthYear encodes the year in its last two digits (e.g. 82026 -> "26"),
  // matching the IDValue.Year key used for SLNo generation.
  const yearYY = String(Number(planMonthYear) % 100).padStart(2, "0");
  const currentDateTime = new Date(new Date().getTime() + 330 * 60000);

  const pool = await new sql.ConnectionPool(dbConfig1).connect();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    const existingRes = await new sql.Request(transaction)
      .input("planMonthYear", sql.Int, planMonthYear)
      .input("planMaterial", sql.Int, matcode)
      .input("planType", sql.NVarChar, planType)
      .query(`
        SELECT PlanNo FROM PlanOrderPrint WITH (UPDLOCK, HOLDLOCK)
        WHERE PlanMonthYear = @planMonthYear AND PlanMaterial = @planMaterial AND PlanType = @planType
      `);

    let message;

    if (existingRes.recordset.length) {
      // Material already planned for this month -> update quantity/remark
      await new sql.Request(transaction)
        .input("planQty", sql.Int, planQty)
        .input("userCode", sql.Int, userCode)
        .input("remark", sql.NVarChar, remark || "")
        .input("planMonthYear", sql.Int, planMonthYear)
        .input("planMaterial", sql.Int, matcode)
        .input("planType", sql.NVarChar, planType)
        .query(`
          UPDATE PlanOrderPrint
          SET PlanQty = @planQty, CreatedBy = @userCode, Remark = @remark
          WHERE PlanMonthYear = @planMonthYear AND PlanMaterial = @planMaterial AND PlanType = @planType
        `);
      message = "Production Planing Data updated successfully.";
    } else {
      // New material for this month -> generate PlanNo (Series+Year+SLNo) and insert
      const planNo = await generatePlanNo(transaction, yearYY);

      await new sql.Request(transaction)
        .input("planNo", sql.Int, planNo)
        .input("planMonthYear", sql.Int, planMonthYear)
        .input("planMaterial", sql.Int, matcode)
        .input("planQty", sql.Int, planQty)
        .input("planType", sql.NVarChar, planType)
        .input("remark", sql.NVarChar, remark || "")
        .input("createdBy", sql.Int, userCode)
        .input("createdOn", sql.DateTime, currentDateTime)
        .query(`
          INSERT INTO PlanOrderPrint
            (PlanNo, PlanMonthYear, PlanMaterial, PlanQty, InitialPlanQty, PrintLbl, PlanType, Remark, CreatedBy, CreatedOn, Status)
          VALUES
            (@planNo, @planMonthYear, @planMaterial, @planQty, @planQty, 0, @planType, @remark, @createdBy, @createdOn, 0)
        `);

      message = "Production Planing Data added successfully.";
    }

    await transaction.commit();

    res.status(200).json({
      success: true,
      message,
    });
  } catch (error) {
    await transaction.rollback();
    throw new AppError(
      `Failed to add the production planing data:${error.message}`,
      500
    );
  } finally {
    await pool.close();
  }
});

export const planStatusData = tryCatch(async (req, res) => {
  const { planType, planMonthYear } = req.query;

  if (!planType || !["ASSEMBLY", "FG"].includes(planType) || !planMonthYear) {
    throw new AppError(
      "Missing required query parameters: planType and planMonthYear.",
      400
    );
  }

  const materialFilter =
    planType === "ASSEMBLY"
      ? "m.Type = 400 AND (m.Alias LIKE 'S %' OR m.Alias LIKE '% S')"
      : "m.Type = 100";

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool
      .request()
      .input("planType", sql.NVarChar, planType)
      .input("planMonthYear", sql.Int, planMonthYear)
      .query(`
        SELECT
          m.MatCode,
          m.Alias,
          pop.PlanNo,
          pop.PlanQty,
          pop.InitialPlanQty,
          pop.PrintLbl,
          pop.Remark,
          pop.CreatedOn
        FROM Material m
        LEFT JOIN PlanOrderPrint pop
          ON pop.PlanMaterial = m.MatCode
          AND pop.PlanType = @planType
          AND pop.PlanMonthYear = @planMonthYear
        WHERE ${materialFilter}
        ORDER BY m.MatCode
      `);

    res.status(200).json({
      success: true,
      message: "Plan status data retrieved successfully.",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch plan status data:${error.message}`,
      500
    );
  } finally {
    await pool.close();
  }
});

export const bulkAddProductionPlaningData = tryCatch(async (req, res) => {
  const { userCode, plans } = req.body;

  if (!userCode) {
    throw new AppError("Missing required parameter: userCode.", 400);
  }

  if (!Array.isArray(plans) || plans.length === 0) {
    throw new AppError("Empty or invalid plans array.", 400);
  }

  const currentDateTime = new Date(new Date().getTime() + 330 * 60000);

  const pool = await new sql.ConnectionPool(dbConfig1).connect();
  const uploadResults = [];

  try {
    for (const row of plans) {
      const { planMonthYear, material, planQty, planType, remark } = row;

      if (!planMonthYear || !material || !planQty || !planType) {
        uploadResults.push({
          status: "failed",
          reason:
            "Missing planMonthYear, material, planQty or planType",
          row,
        });
        continue;
      }

      const normalizedPlanType = String(planType).trim().toUpperCase();
      if (!["FG", "ASSEMBLY"].includes(normalizedPlanType)) {
        uploadResults.push({
          status: "failed",
          reason: `Invalid PlanType "${planType}" (expected FG or ASSEMBLY)`,
          row,
        });
        continue;
      }

      const materialRes = await pool
        .request()
        .input("material", sql.NVarChar, material)
        .query(`SELECT MatCode FROM Material WHERE Alias = @material`);

      if (!materialRes.recordset.length) {
        uploadResults.push({
          status: "failed",
          reason: `Material "${material}" not found`,
          row,
        });
        continue;
      }

      const matcode = materialRes.recordset[0].MatCode;
      const yearYY = String(Number(planMonthYear) % 100).padStart(2, "0");

      const transaction = new sql.Transaction(pool);

      try {
        await transaction.begin();

        const existingRes = await new sql.Request(transaction)
          .input("planMonthYear", sql.Int, planMonthYear)
          .input("planMaterial", sql.Int, matcode)
          .input("planType", sql.NVarChar, normalizedPlanType)
          .query(`
            SELECT PlanNo FROM PlanOrderPrint WITH (UPDLOCK, HOLDLOCK)
            WHERE PlanMonthYear = @planMonthYear AND PlanMaterial = @planMaterial AND PlanType = @planType
          `);

        if (existingRes.recordset.length) {
          await new sql.Request(transaction)
            .input("planQty", sql.Int, planQty)
            .input("userCode", sql.Int, userCode)
            .input("remark", sql.NVarChar, remark || "")
            .input("planMonthYear", sql.Int, planMonthYear)
            .input("planMaterial", sql.Int, matcode)
            .input("planType", sql.NVarChar, normalizedPlanType)
            .query(`
              UPDATE PlanOrderPrint
              SET PlanQty = @planQty, CreatedBy = @userCode, Remark = @remark
              WHERE PlanMonthYear = @planMonthYear AND PlanMaterial = @planMaterial AND PlanType = @planType
            `);

          await transaction.commit();
          uploadResults.push({
            status: "success",
            action: "updated",
            material,
            matcode,
            planNo: existingRes.recordset[0].PlanNo,
          });
        } else {
          const planNo = await generatePlanNo(transaction, yearYY);

          await new sql.Request(transaction)
            .input("planNo", sql.Int, planNo)
            .input("planMonthYear", sql.Int, planMonthYear)
            .input("planMaterial", sql.Int, matcode)
            .input("planQty", sql.Int, planQty)
            .input("planType", sql.NVarChar, normalizedPlanType)
            .input("remark", sql.NVarChar, remark || "")
            .input("createdBy", sql.Int, userCode)
            .input("createdOn", sql.DateTime, currentDateTime)
            .query(`
              INSERT INTO PlanOrderPrint
                (PlanNo, PlanMonthYear, PlanMaterial, PlanQty, InitialPlanQty, PrintLbl, PlanType, Remark, CreatedBy, CreatedOn, Status)
              VALUES
                (@planNo, @planMonthYear, @planMaterial, @planQty, @planQty, 0, @planType, @remark, @createdBy, @createdOn, 0)
            `);

          await transaction.commit();
          uploadResults.push({
            status: "success",
            action: "inserted",
            material,
            matcode,
            planNo,
          });
        }
      } catch (rowErr) {
        await transaction.rollback();
        uploadResults.push({
          status: "failed",
          reason: rowErr.message,
          row,
        });
      }
    }

    const successfulUploads = uploadResults.filter(
      (r) => r.status === "success"
    );
    const failedUploads = uploadResults.filter((r) => r.status === "failed");

    if (successfulUploads.length === 0) {
      throw new AppError("Failed to add any plans from the uploaded file.", 400);
    }

    res.status(201).json({
      success: true,
      message: "Production plans processed successfully.",
      successCount: successfulUploads.length,
      failedCount: failedUploads.length,
      successfulUploads,
      failedUploads,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      `Failed to bulk add production planing data:${error.message}`,
      500
    );
  } finally {
    await pool.close();
  }
});
