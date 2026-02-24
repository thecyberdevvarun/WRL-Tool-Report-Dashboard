import sql from "mssql";
import { dbConfig1 } from "../../config/db.config.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";
import { convertToIST } from "../../utils/convertToIST.js";

// Fetch All FPA History (Dashboard)
export const getFpaHistory = tryCatch(async (req, res) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    throw new AppError(
      "Missing required query parameters: startDate or endDate.",
      400,
    );
  }

  const istStart = convertToIST(startDate);
  const istEnd = convertToIST(endDate);

  const query = `
    WITH DUMDATA AS (
        SELECT 
            a.PSNo, 
            c.Name, 
            b.Material, 
            a.StationCode, 
            a.ProcessCode, 
            a.ActivityOn, 
            DATEPART(HOUR, ActivityOn) AS TIMEHOUR, 
            DATEPART(DAY, ActivityOn) AS TIMEDAY, 
            ActivityType, 
            b.Type
        FROM ProcessActivity a
        INNER JOIN MaterialBarcode b ON a.PSNo = b.DocNo
        INNER JOIN Material c ON b.Material = c.MatCode
        WHERE
            a.StationCode IN (1220010, 1230017)
            AND a.ActivityType = 5
            AND a.ActivityOn BETWEEN @startDate AND @endDate
            AND b.Type NOT IN (0, 200)
    ),

    FPA_DATA AS (
        SELECT 
            dd.Name AS [ModelName],  
            COUNT(dd.Name) AS ModelCount,
            CASE 
                WHEN COUNT(dd.Name) < 10 THEN 0
                ELSE ((COUNT(dd.Name) - 1) / 100) + 1
            END AS FPA
        FROM DUMDATA dd
        GROUP BY dd.Name
    ),

    INSPECTED_DATA AS (
        SELECT 
            Model,
            COUNT(DISTINCT FGSRNo) AS SampleInspected
        FROM FPAReport
        WHERE Date BETWEEN @startDate AND @endDate
        GROUP BY Model
    ),

    DEFECT_SUMMARY AS (
        SELECT 
            Model,
            SUM(CASE WHEN Category='critical' THEN 1 ELSE 0 END) AS Critical,
            SUM(CASE WHEN Category='major' THEN 1 ELSE 0 END) AS Major,
            SUM(CASE WHEN Category='minor' THEN 1 ELSE 0 END) AS Minor,
            COUNT(DISTINCT FGSRNo) AS InspectedFG
        FROM FPAReport
        WHERE Date BETWEEN @startDate AND @endDate
        GROUP BY Model
    )

    SELECT 
        f.ModelName,
        f.ModelCount,
        f.FPA,
        ISNULL(i.SampleInspected,0) AS SampleInspected,
        ISNULL(d.Critical,0) AS Critical,
        ISNULL(d.Major,0) AS Major,
        ISNULL(d.Minor,0) AS Minor,
        CAST(
            (
                (ISNULL(d.Critical,0)*9.0) +
                (ISNULL(d.Major,0)*6.0) +
                (ISNULL(d.Minor,0)*1.0)
            ) / NULLIF(ISNULL(d.InspectedFG,0),0)
        AS DECIMAL(10,3)) AS FPQI
    FROM FPA_DATA f
    LEFT JOIN INSPECTED_DATA i ON f.ModelName=i.Model
    LEFT JOIN DEFECT_SUMMARY d ON f.ModelName=d.Model
    WHERE f.FPA>0
    ORDER BY f.ModelCount;
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool
      .request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate", sql.DateTime, istEnd)
      .query(query);

    res.status(200).json({
      success: true,
      message: "FPA History retrieved successfully.",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(`Failed to fetch FPA History: ${error.message}`, 500);
  } finally {
    await pool.close();
  }
});

// Show Specific Model Details
export const getFpaByModel = tryCatch(async (req, res) => {
  const { model } = req.params;
  const { startDate, endDate } = req.query;

  if (!model) {
    throw new AppError("Missing required parameter: model.", 400);
  }

  if (!startDate || !endDate) {
    throw new AppError(
      "Missing required query parameters: startDate or endDate.",
      400,
    );
  }

  const istStart = convertToIST(startDate);
  const istEnd = convertToIST(endDate);

  const query = `
    ;WITH DefectCount AS
    (
        SELECT
            FGSRNo,
            CAST(MIN(Date) AS DATE) AS Date,
            MIN(Model) AS Model,
            MIN(Shift) AS Shift,
            MIN(Country) AS Country,

            SUM(CASE WHEN Category = 'critical' THEN 1 ELSE 0 END) AS NoOfCritical,
            SUM(CASE WHEN Category = 'major' THEN 1 ELSE 0 END) AS NoOfMajor,
            SUM(CASE WHEN Category = 'minor' THEN 1 ELSE 0 END) AS NoOfMinor,

            COUNT(*) AS TotalDefects
        FROM FPAReport
        WHERE Model = @model
          AND Date BETWEEN @startDate AND @endDate
        GROUP BY FGSRNo
    )
    SELECT
        ROW_NUMBER() OVER(ORDER BY Date, FGSRNo) AS SRNO,
        Date,
        Model,
        Shift,
        FGSRNo,
        Country,

        NoOfCritical AS Critical,
        NoOfMajor AS Major,
        NoOfMinor AS Minor,

        CAST(
            (
                (NoOfCritical * 9.0) +
                (NoOfMajor * 6.0) +
                (NoOfMinor * 1.0)
            ) / NULLIF(1,0)
        AS DECIMAL(10,3)) AS FPQI
    FROM DefectCount
    ORDER BY Date, FGSRNo;
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool
      .request()
      .input("model", sql.VarChar, model)
      .input("startDate", sql.DateTime, istStart)
      .input("endDate", sql.DateTime, istEnd)
      .query(query);

    res.status(200).json({
      success: true,
      message:
        result.recordset.length > 0
          ? "Model wise FPA data retrieved successfully."
          : "No inspection data found for this model.",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Model wise FPA data: ${error.message}`,
      500,
    );
  } finally {
    await pool.close();
  }
});

// Show Detail of Particular FGSRNo
export const getFpaDefectDetails = tryCatch(async (req, res) => {
  const { fgsrNo } = req.params;

  if (!fgsrNo) {
    throw new AppError("Missing required parameter: fgsrNo.", 400);
  }

  const query = `
    SELECT
        Category,
        AddDefect,
        Remark,
        DefectImage
    FROM FPAReport
    WHERE FGSRNo = @fgsrNo
    ORDER BY Date;
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool
      .request()
      .input("fgsrNo", sql.VarChar, fgsrNo)
      .query(query);

    if (result.recordset.length === 0) {
      throw new AppError(`No defect details found for FGSRNo: ${fgsrNo}`, 404);
    }

    res.status(200).json({
      success: true,
      message: "Defect details retrieved successfully.",
      data: result.recordset,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to fetch defect details: ${error.message}`, 500);
  } finally {
    await pool.close();
  }
});
