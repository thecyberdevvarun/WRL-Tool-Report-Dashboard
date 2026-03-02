import sql from "mssql";
import { dbConfig1 } from "../../config/db.config.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";
import { convertToIST } from "../../utils/convertToIST.js";

// Generates a report detailing the traceability of components used in finished goods within a specified timeframe.
export const generateReport = tryCatch(async (req, res) => {
  const {
    startTime,
    endTime,
    model,
    compType,
    page = 1,
    limit = 100,
  } = req.query;

  if (!startTime || !endTime) {
    throw new AppError("startTime and endTime are required", 400);
  }

  const istStart = convertToIST(startTime);
  const istEnd = convertToIST(endTime);
  const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

  const pool = await new sql.ConnectionPool({
    ...dbConfig1,
    requestTimeout: 120000,
    connectionTimeout: 30000,
  }).connect();

  try {
    const request = pool
      .request()
      .input("startTime", sql.DateTime, istStart)
      .input("endTime", sql.DateTime, istEnd)
      .input("offset", sql.Int, offset)
      .input("limit", sql.Int, parseInt(limit, 10));

    if (model && model !== "0") {
      request.input("model", sql.VarChar, model);
    }

    if (compType && compType !== "0") {
      request.input("compType", sql.VarChar, compType);
    }

    const query = `
      WITH BomMaterials AS (
          SELECT psno, BOMCode, RowID, Material
          FROM ProcessInputBOM
          UNION
          SELECT a.psno, a.BOMCode, a.RowID, b.Material
          FROM ProcessInputBOM a
          INNER JOIN BOMInputAltMaterial b
              ON a.RowID = b.RowID
            AND a.BOMCode = b.BOMCode
      ),
      FGActivity AS (
          SELECT *
          FROM (
              SELECT *,
                    ROW_NUMBER() OVER (PARTITION BY PSNo ORDER BY ActivityOn DESC) rn
              FROM ProcessActivity
              WHERE ActivityType = 5
                AND StationCode IN (1220010, 1230017)
                AND ActivityOn >= @startTime 
                AND ActivityOn <  @endTime
          ) x
          WHERE rn = 1
      ),
      FGBarcode AS (
          SELECT *
          FROM (
              SELECT *,
                    ROW_NUMBER() OVER (PARTITION BY DocNo ORDER BY CreatedOn DESC) rn
              FROM MaterialBarcode
              WHERE Status <> 99
                AND VSerial IS NOT NULL
          ) y
          WHERE rn = 1
      )

      SELECT 
          MATBM.Name                    AS Model_Name,
          b.Serial                      AS Component_Serial_Number,
          mat.Name                      AS Component_Name,
          ISNULL(mat.AltName, 'NA')     AS SAP_Code,
          MatCat.Name                   AS Component_Type,
          L.Name                        AS Supplier_Name,
          b.ScannedOn                   AS Comp_ScanedOn,
          pa.ActivityOn                 AS FG_Date,
          MATB.Serial                   AS Fg_Sr_No,
          MATB.VSerial                  AS Asset_tag
      FROM ProcessOrder a

      INNER JOIN ProcessInputBOMScan b
          ON a.PSNo = b.PSNo

      INNER JOIN BomMaterials c
          ON c.PSNo     = b.PSNo
        AND c.RowID    = b.RowID
        AND c.Material = b.Material

      INNER JOIN Material mat
          ON mat.MatCode = c.Material

      INNER JOIN MaterialCategory MatCat
          ON MatCat.CategoryCode = mat.Category

      INNER JOIN FGActivity pa
          ON pa.PSNo = a.PSNo

      INNER JOIN FGBarcode MATB
          ON MATB.DocNo = a.PSNo

      LEFT JOIN Material MATBM
          ON MATBM.MatCode = MATB.Material

      LEFT JOIN Ledger L
          ON L.LedgerCode = mat.Ledger
      WHERE 
          MATB.Status <> 99
          AND MATB.VSerial IS NOT NULL
          ${model && model !== "0" ? "AND MATBM.MatCode = @model" : ""}
          ${compType && compType !== "0" ? "AND MatCat.CategoryCode = @compType" : ""}
      ORDER BY 
          a.PSNo
      OFFSET 
          @offset ROWS FETCH NEXT @limit ROWS ONLY;
    `;

    const result = await request.query(query);

    res.status(200).json({
      success: true,
      message: "Component Traceability Report generated successfully",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to generate component traceability report: ${error.message}`,
      500,
    );
  } finally {
    await pool.close();
  }
});

// Export Data for Component Traceability Report
export const componentTraceabilityExportData = tryCatch(async (req, res) => {
  const { startTime, endTime, model, compType } = req.query;

  if (!startTime || !endTime) {
    throw new AppError("startTime and endTime are required", 400);
  }

  const istStart = convertToIST(startTime);
  const istEnd = convertToIST(endTime);

  const pool = await new sql.ConnectionPool({
    ...dbConfig1,
    requestTimeout: 120000,
    connectionTimeout: 30000,
  }).connect();

  try {
    const request = pool
      .request()
      .input("startTime", sql.DateTime, istStart)
      .input("endTime", sql.DateTime, istEnd);

    if (model && model !== "0") {
      request.input("model", sql.VarChar, model);
    }

    if (compType && compType !== "0") {
      request.input("compType", sql.VarChar, compType);
    }

    const query = `
      WITH BomMaterials AS (
          SELECT psno, BOMCode, RowID, Material
          FROM ProcessInputBOM
          UNION
          SELECT a.psno, a.BOMCode, a.RowID, b.Material
          FROM ProcessInputBOM a
          INNER JOIN BOMInputAltMaterial b
              ON a.RowID = b.RowID
            AND a.BOMCode = b.BOMCode
      ),
      FGActivity AS (
          SELECT *
          FROM (
              SELECT *,
                    ROW_NUMBER() OVER (PARTITION BY PSNo ORDER BY ActivityOn DESC) rn
              FROM ProcessActivity
              WHERE ActivityType = 5
                AND StationCode IN (1220010, 1230017)
                AND ActivityOn >= @startTime 
                AND ActivityOn <  @endTime
          ) x
          WHERE rn = 1
      ),
      FGBarcode AS (
          SELECT *
          FROM (
              SELECT *,
                    ROW_NUMBER() OVER (PARTITION BY DocNo ORDER BY CreatedOn DESC) rn
              FROM MaterialBarcode
              WHERE Status <> 99
                AND VSerial IS NOT NULL
          ) y
          WHERE rn = 1
      )

      SELECT 
          MATBM.Name                    AS Model_Name,
          b.Serial                      AS Component_Serial_Number,
          mat.Name                      AS Component_Name,
          ISNULL(mat.AltName, 'NA')     AS SAP_Code,
          MatCat.Name                   AS Component_Type,
          L.Name                        AS Supplier_Name,
          b.ScannedOn                   AS Comp_ScanedOn,
          pa.ActivityOn                 AS FG_Date,
          MATB.Serial                   AS Fg_Sr_No,
          MATB.VSerial                  AS Asset_tag
      FROM ProcessOrder a

      INNER JOIN ProcessInputBOMScan b
          ON a.PSNo = b.PSNo

      INNER JOIN BomMaterials c
          ON c.PSNo     = b.PSNo
        AND c.RowID    = b.RowID
        AND c.Material = b.Material

      INNER JOIN Material mat
          ON mat.MatCode = c.Material

      INNER JOIN MaterialCategory MatCat
          ON MatCat.CategoryCode = mat.Category

      INNER JOIN FGActivity pa
          ON pa.PSNo = a.PSNo

      INNER JOIN FGBarcode MATB
          ON MATB.DocNo = a.PSNo

      LEFT JOIN Material MATBM
          ON MATBM.MatCode = MATB.Material

      LEFT JOIN Ledger L
          ON L.LedgerCode = mat.Ledger
      WHERE 
          MATB.Status <> 99
          AND MATB.VSerial IS NOT NULL
          ${model && model !== "0" ? "AND MATBM.MatCode = @model" : ""}
          ${compType && compType !== "0" ? "AND MatCat.CategoryCode = @compType" : ""}
      ORDER BY 
          a.PSNo;
    `;

    const result = await request.query(query);

    res.status(200).json({
      success: true,
      message: "Component Traceability Report export data fetched successfully",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to export component traceability data: ${error.message}`,
      500,
    );
  } finally {
    await pool.close();
  }
});
