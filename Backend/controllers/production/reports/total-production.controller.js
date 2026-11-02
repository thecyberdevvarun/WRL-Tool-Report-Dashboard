import sql from "mssql";
import { dbConfig1 } from "../../../config/db.config.js";
import { tryCatch } from "../../../utils/try-catch.js";
import { AppError } from "../../../utils/app-error.js";
import { convertToIST } from "../../../utils/convert-to-ist.js";

/* -------------------------------------------------------------------------
   Shared helper – resolves station codes for a department string.
   Throws AppError if the department value is unrecognised.
------------------------------------------------------------------------- */
const getStationCodes = (department) => {
  const map = {
    final: ["1220010", "1230017"],
    "post-foaming": ["1230007", "1220003", "1220004", "1230012"],
    "final-loading": ["1220005", "1230013"],
  };
  if (!map[department]) {
    throw new AppError(`Invalid department value: "${department}"`, 400);
  }
  return map[department];
};

/* -------------------------------------------------------------------------
   Shared SQL fragment that selects and splits Serial2 into NFC_UID /
   CustomerQR.  Used by every endpoint so the schema is consistent.
------------------------------------------------------------------------- */
const SERIAL2_SPLIT_SQL = `
      -- NFC UID: everything before the first '/'
      CASE
          WHEN CHARINDEX('/', Psno.Serial2) > 0
               THEN LEFT(Psno.Serial2, CHARINDEX('/', Psno.Serial2) - 1)
          ELSE NULL
      END AS NFC_UID,

      -- Customer QR: everything after the first '/'  (or the whole value)
      CASE
          WHEN CHARINDEX('/', Psno.Serial2) > 0
               THEN SUBSTRING(Psno.Serial2, CHARINDEX('/', Psno.Serial2) + 1, LEN(Psno.Serial2))
          ELSE Psno.Serial2
      END AS CustomerQR,
`;

/* -------------------------------------------------------------------------
   Shared CTE body.  Caller passes the already-built stationCodeString and
   an optional model clause so we avoid repeating the big SQL block.
------------------------------------------------------------------------- */
const buildCTE = (stationCodeStr, includeModel) => `
  WITH Psno AS (
      SELECT DocNo, Material, Serial, VSerial, Serial2, Alias
      FROM   MaterialBarcode
      WHERE  PrintStatus = 1 AND Status <> 99
  ),
  FilteredData AS (
      SELECT
          ROW_NUMBER() OVER (
              ORDER BY
                  (SELECT Name FROM Material WHERE MatCode = Psno.Material),
                  COALESCE(
                      NULLIF(
                          CASE WHEN SUBSTRING(Psno.Serial, 1, 1) IN ('S','F','L') THEN '' ELSE Psno.Serial END,
                          ''
                      ),
                      CASE WHEN Psno.VSerial IS NULL THEN Psno.Serial ELSE Psno.Alias END
                  )
          ) AS RowNum,
          (SELECT Name FROM Material WHERE MatCode = Psno.Material) AS Model_Name,
          ISNULL(Psno.VSerial, '') AS Asset_tag,
          ${SERIAL2_SPLIT_SQL}
          COALESCE(
              NULLIF(
                  CASE WHEN SUBSTRING(Psno.Serial, 1, 1) IN ('S','F','L') THEN '' ELSE Psno.Serial END,
                  ''
              ),
              CASE WHEN Psno.VSerial IS NULL THEN Psno.Serial ELSE Psno.Alias END
          ) AS FG_SR,
          ISNULL(mc.Alias, 'N/A') AS category
      FROM  Psno
      JOIN  ProcessActivity  b  ON b.PSNo        = Psno.DocNo
      JOIN  WorkCenter        c  ON b.StationCode = c.StationCode
      JOIN  Material          m  ON m.MatCode     = Psno.Material
      LEFT  JOIN MaterialCategory mc ON mc.CategoryCode = m.Category
      WHERE b.ActivityType   = 5
        AND c.StationCode   IN (${stationCodeStr})
        AND b.ActivityOn BETWEEN @startTime AND @endTime
        ${includeModel ? "AND Psno.Material = @model" : ""}
  )
`;

/* -------------------------------------------------------------------------
   1.  GET /prod/barcode-details   (paginated – used by main table)
   BUG FIX: was missing the NFC_UID / CustomerQR split; now uses shared CTE.
------------------------------------------------------------------------- */
export const getBarcodeDetails = tryCatch(async (req, res) => {
  const {
    startDate,
    endDate,
    model,
    department,
    page = 1,
    limit = 1000,
  } = req.query;

  if (!startDate || !endDate) {
    throw new AppError(
      "Missing required query parameters: startDate and endDate.",
      400,
    );
  }

  const istStart = convertToIST(startDate);
  const istEnd = convertToIST(endDate);
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const stationCodes = getStationCodes(department);
  const stationCodeStr = stationCodes.join(", ");
  const includeModel = model && model != 0;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();
  try {
    const request = pool
      .request()
      .input("startTime", sql.DateTime, istStart)
      .input("endTime", sql.DateTime, istEnd)
      .input("offset", sql.Int, offset)
      .input("limit", sql.Int, parseInt(limit));

    if (includeModel) request.input("model", sql.VarChar, model);

    const query = `
  WITH Psno AS (
    SELECT DocNo, Material, Serial, VSerial, Serial2, Alias 
    FROM MaterialBarcode 
    WHERE PrintStatus = 1 AND Status <> 99
  ),
  FilteredData AS (
    SELECT 
      ROW_NUMBER() OVER (
        ORDER BY 
          (SELECT Name FROM Material WHERE MatCode = Psno.Material), 
          COALESCE(NULLIF(CASE WHEN SUBSTRING(Psno.Serial, 1, 1) IN ('S', 'F', 'L') THEN '' ELSE Psno.Serial END, ''),
                   CASE 
                     WHEN Psno.VSerial IS NULL THEN Psno.Serial 
                     ELSE Psno.Alias 
                   END)
      ) AS RowNum,
      (SELECT Name FROM Material WHERE MatCode = Psno.Material) AS Model_Name,
      ISNULL(Psno.VSerial, '') AS Asset_tag,
      ISNULL(Psno.Serial2, '') AS CustomerQR,
      COALESCE(NULLIF(CASE WHEN SUBSTRING(Psno.Serial, 1, 1) IN ('S', 'F', 'L') THEN '' ELSE Psno.Serial END, ''),
               CASE 
                 WHEN Psno.VSerial IS NULL THEN Psno.Serial 
                 ELSE Psno.Alias 
               END
      ) AS FG_SR,
      ISNULL(mc.Alias, 'N/A') AS category
    FROM Psno
    JOIN ProcessActivity b ON b.PSNo = Psno.DocNo
    JOIN WorkCenter c ON b.StationCode = c.StationCode
    JOIN Material m ON m.MatCode = Psno.Material
    LEFT JOIN MaterialCategory mc ON mc.CategoryCode = m.Category
    WHERE b.ActivityType = 5
      AND c.StationCode IN (${stationCodeStr})          
      AND b.ActivityOn BETWEEN @startTime AND @endTime
      ${model && model != 0 ? "AND Psno.Material = @model" : ""}
  )
  SELECT 
    (SELECT COUNT(*) FROM FilteredData) AS totalCount,
    * 
  FROM FilteredData
  WHERE RowNum > @offset AND RowNum <= (@offset + @limit);
    `;

    const result = await request.query(query);

    res.status(200).json({
      success: true,
      message: "Barcode Details data retrieved successfully",
      data: result.recordset,
      totalCount:
        result.recordset.length > 0 ? result.recordset[0].totalCount : 0,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Barcode Details data: ${error.message}`,
      500,
    );
  } finally {
    await pool.close();
  }
});

/* -------------------------------------------------------------------------
   2.  GET /prod/export-total-production   (full dataset – used for export)
   BUG FIX: was missing the NFC_UID / CustomerQR split; now uses shared CTE.
------------------------------------------------------------------------- */
export const totalProductionExportData = tryCatch(async (req, res) => {
  const { startDate, endDate, model, department } = req.query;

  if (!startDate || !endDate) {
    throw new AppError(
      "Missing required query parameters: startDate and endDate.",
      400,
    );
  }

  const istStart = convertToIST(startDate);
  const istEnd = convertToIST(endDate);
  const stationCodes = getStationCodes(department);
  const stationCodeStr = stationCodes.join(", ");
  const includeModel = model && model != 0;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();
  try {
    const request = pool
      .request()
      .input("startTime", sql.DateTime, istStart)
      .input("endTime", sql.DateTime, istEnd);

    if (includeModel) request.input("model", sql.VarChar, model);

    const query = `
      ${buildCTE(stationCodeStr, includeModel)}
      SELECT
          (SELECT COUNT(*) FROM FilteredData) AS totalCount,
          *
      FROM FilteredData;
    `;

    const result = await request.query(query);

    res.status(200).json({
      success: true,
      message: "Total Production Export data retrieved successfully",
      data: result.recordset,
      totalCount:
        result.recordset.length > 0 ? result.recordset[0].totalCount : 0,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Total Production Export data: ${error.message}`,
      500,
    );
  } finally {
    await pool.close();
  }
});

/* -------------------------------------------------------------------------
   3.  GET /prod/yday-total-production
       GET /prod/today-total-production
       GET /prod/month-total-production
   (Quick-filter routes share the same handler – already had NFC_UID split)
------------------------------------------------------------------------- */
export const getQuickFiltersBarcodeDetails = tryCatch(async (req, res) => {
  const { startDate, endDate, model, department } = req.query;

  if (!startDate || !endDate) {
    throw new AppError(
      "Missing required query parameters: startDate and endDate.",
      400,
    );
  }

  const istStart = convertToIST(startDate);
  const istEnd = convertToIST(endDate);
  const stationCodes = getStationCodes(department);
  const stationCodeStr = stationCodes.join(", ");
  const includeModel = model && model != 0;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();
  try {
    const request = pool
      .request()
      .input("startTime", sql.DateTime, istStart)
      .input("endTime", sql.DateTime, istEnd);

    if (includeModel) request.input("model", sql.VarChar, model);

    const query = `
      ${buildCTE(stationCodeStr, includeModel)}
      SELECT
          (SELECT COUNT(*) FROM FilteredData) AS totalCount,
          *
      FROM FilteredData;
    `;

    const result = await request.query(query);

    res.status(200).json({
      success: true,
      message: "Quick Filters Barcode Details data retrieved successfully",
      data: result.recordset,
      totalCount: result.recordset.length,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Quick Filters Barcode Details data: ${error.message}`,
      500,
    );
  } finally {
    await pool.close();
  }
});
