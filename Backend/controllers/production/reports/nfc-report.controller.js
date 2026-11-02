import sql from "mssql";
import { dbConfig1 } from "../../../config/db.config.js";
import { tryCatch } from "../../../utils/try-catch.js";
import { AppError } from "../../../utils/app-error.js";
import { convertToIST } from "../../../utils/convert-to-ist.js";

export const getNfcReoprts = tryCatch(async (req, res) => {
  const { startDate, endDate, model, page = 1, limit = 1000 } = req.query;

  if (!startDate || !endDate) {
    throw new AppError(
      "Missing required query parameters: startDate and endDate",
      400,
    );
  }

  const istStart = convertToIST(startDate);
  const istEnd = convertToIST(endDate);
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const request = pool
      .request()
      .input("startTime", sql.DateTime, istStart)
      .input("endTime", sql.DateTime, istEnd)
      .input("offset", sql.Int, offset)
      .input("limit", sql.Int, parseInt(limit));

    if (model && model != 0) {
      request.input("model", sql.VarChar, model);
    }

    const query = `
 WITH Psno AS (
    SELECT DocNo, Material, Serial, VSerial, Serial2, Alias, CreatedOn
    FROM MaterialBarcode 
    WHERE PrintStatus = 1 AND Status <> 99
),
FilteredData AS (
    SELECT 
      m.Name AS Model_Name,                  -- Clean material name
      ISNULL(Psno.VSerial, '') AS Asset_tag,

      -- NEW ? NFC UID before semicolon
      CASE 
          WHEN CHARINDEX('/', Psno.Serial2) > 0 
               THEN LEFT(Psno.Serial2, CHARINDEX('/', Psno.Serial2) - 1)
          ELSE NULL
      END AS NFC_UID,

      -- Clean CustomerQR after semicolon
      CASE 
          WHEN CHARINDEX('/', Psno.Serial2) > 0 
               THEN SUBSTRING(Psno.Serial2, CHARINDEX('/', Psno.Serial2) + 1, LEN(Psno.Serial2))
          ELSE Psno.Serial2
      END AS CustomerQR,

      COALESCE(
        NULLIF(
            CASE WHEN SUBSTRING(Psno.Serial, 1, 1) IN ('S', 'F', 'L') THEN '' 
                 ELSE Psno.Serial 
            END, 
        ''),
        CASE 
            WHEN Psno.VSerial IS NULL THEN Psno.Serial 
            ELSE Psno.Alias 
        END
      ) AS FG_SR,
        Psno.CreatedOn

    FROM Psno
    JOIN ProcessActivity b ON b.PSNo = Psno.DocNo
    JOIN WorkCenter c ON b.StationCode = c.StationCode

    -- Correct Material join (ledger + type filters)
    JOIN Material m 
        ON m.MatCode = Psno.Material
       AND m.Type = 100 
       AND (m.name like '%KW%' or m.name like '%HU')

    WHERE 
        b.ActivityType = 5
        AND c.StationCode IN (1220010)
        AND b.ActivityOn BETWEEN @startTime AND @endTime
)

SELECT *
FROM FilteredData;
    `;

    const result = await request.query(query);

    res.status(200).json({
      success: true,
      message: "NFC Report data retrieved successfully",
      data: result.recordset,
      totalCount:
        result.recordset.length > 0 ? result.recordset[0].totalCount : 0,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch NFC Report data: ${error.message}`,
      500,
    );
  } finally {
    await pool.close();
  }
});

// Export Data
export const nfcReportExportData = tryCatch(async (req, res) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    throw new AppError(
      "Missing required query parameters: startDate and endDate",
      400,
    );
  }

  // Convert input dates to IST
  const istStart = convertToIST(startDate);
  const istEnd = convertToIST(endDate);

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const request = pool
      .request()
      .input("startTime", sql.DateTime, istStart)
      .input("endTime", sql.DateTime, istEnd);

    const query = `
      WITH Psno AS (
        SELECT DocNo, Material, Serial, VSerial, Serial2, Alias, CreatedOn
        FROM MaterialBarcode 
        WHERE PrintStatus = 1 AND Status <> 99
      ),
      FilteredData AS (
        SELECT 
          m.Name AS Model_Name,
                    -- FG Serial logic
          COALESCE(
            NULLIF(
              CASE 
                WHEN SUBSTRING(Psno.Serial, 1, 1) IN ('S', 'F', 'L')
                     THEN '' 
                ELSE Psno.Serial 
              END, 
            ''),
            CASE 
              WHEN Psno.VSerial IS NULL THEN Psno.Serial 
              ELSE Psno.Alias 
            END
          ) AS FG_SR,
          ISNULL(Psno.VSerial, '') AS Asset_tag,

          -- NFC UID (before semicolon)
          CASE 
            WHEN CHARINDEX('/', Psno.Serial2) > 0 
                 THEN LEFT(Psno.Serial2, CHARINDEX('/', Psno.Serial2) - 1)
            ELSE NULL
          END AS NFC_UID,

          -- Customer QR (after semicolon)
          CASE 
            WHEN CHARINDEX('/', Psno.Serial2) > 0 
                 THEN SUBSTRING(
                   Psno.Serial2,
                   CHARINDEX('/', Psno.Serial2) + 1,
                   LEN(Psno.Serial2)
                 )
            ELSE Psno.Serial2
          END AS CustomerQR,

          -- ? CreatedOn without T and Z
          FORMAT(Psno.CreatedOn, 'yyyy-MM-dd HH:mm:ss') AS CreatedOn

        FROM Psno
        JOIN ProcessActivity b ON b.PSNo = Psno.DocNo
        JOIN WorkCenter c ON b.StationCode = c.StationCode
        JOIN Material m 
          ON m.MatCode = Psno.Material
         AND m.Type = 100
         AND m.Name LIKE '%KW%'

        WHERE 
          b.ActivityType = 5
          AND c.StationCode IN (1220010)
          AND b.ActivityOn BETWEEN @startTime AND @endTime
      )
      SELECT * FROM FilteredData;
    `;

    const result = await request.query(query);

    res.status(200).json({
      success: true,
      message: "NFC Report Data Exported Successfully",
      data: result.recordset,
      totalCount: result.recordset.length,
    });
  } catch (error) {
    throw new AppError(`Failed to fetch NFC Reports: ${error.message}`, 500);
  } finally {
    await pool.close();
  }
});

// Quick Filters NFC Reports
export const getQuickFiltersNfcReports = tryCatch(async (req, res) => {
  const { startDate, endDate, model } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).send("Missing startDate or endDate.");
  }

  const istStart = convertToIST(startDate);
  const istEnd = convertToIST(endDate);

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const request = pool
      .request()
      .input("startTime", sql.DateTime, istStart)
      .input("endTime", sql.DateTime, istEnd);

    if (model && model != 0) {
      request.input("model", sql.VarChar, model);
    }

    const query = `
 WITH Psno AS (
    SELECT DocNo, Material, Serial, VSerial, Serial2, Alias, CreatedOn
    FROM MaterialBarcode 
    WHERE PrintStatus = 1 AND Status <> 99
),
FilteredData AS (
    SELECT 
      m.Name AS Model_Name,                  -- Clean material name
      ISNULL(Psno.VSerial, '') AS Asset_tag,

      -- NEW ? NFC UID before semicolon
      CASE 
          WHEN CHARINDEX('/', Psno.Serial2) > 0 
               THEN LEFT(Psno.Serial2, CHARINDEX('/', Psno.Serial2) - 1)
          ELSE NULL
      END AS NFC_UID,

      -- Clean CustomerQR after semicolon
      CASE 
          WHEN CHARINDEX('/', Psno.Serial2) > 0 
               THEN SUBSTRING(Psno.Serial2, CHARINDEX('/', Psno.Serial2) + 1, LEN(Psno.Serial2))
          ELSE Psno.Serial2
      END AS CustomerQR,

      COALESCE(
        NULLIF(
            CASE WHEN SUBSTRING(Psno.Serial, 1, 1) IN ('S', 'F', 'L') THEN '' 
                 ELSE Psno.Serial 
            END, 
        ''),
        CASE 
            WHEN Psno.VSerial IS NULL THEN Psno.Serial 
            ELSE Psno.Alias 
        END
      ) AS FG_SR,
       Psno.CreatedOn

    FROM Psno
    JOIN ProcessActivity b ON b.PSNo = Psno.DocNo
    JOIN WorkCenter c ON b.StationCode = c.StationCode

    -- Correct Material join (ledger + type filters)
    JOIN Material m 
        ON m.MatCode = Psno.Material
       AND m.Type = 100 
       AND m.Ledger = 1220018

    WHERE 
        b.ActivityType = 5
        AND c.StationCode IN (1220010)
        AND b.ActivityOn BETWEEN @startTime AND @endTime
)

SELECT *
FROM FilteredData;
    `;

    const result = await request.query(query);

    res.status(200).json({
      success: true,
      message: "Quick Filter NFC Report data retrieved successfully",
      data: result.recordset,
      totalCount: result.recordset.length ? result.recordset[0].totalCount : 0,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Quick Filter NFC Report data: ${error.message}`,
      500,
    );
  } finally {
    await pool.close();
  }
});
