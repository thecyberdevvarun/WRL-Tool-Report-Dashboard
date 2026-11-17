import sql from "mssql";
import { dbConfig1 } from "../../config/db.config.js";
import { tryCatch } from "../../utils/try-catch.js";
import { AppError } from "../../utils/app-error.js";
import { convertToIST } from "../../utils/convert-to-ist.js";

const CPT_AREA_IDS = [5, 6, 8, 9];

export const getCPTReport = tryCatch(async (req, res) => {
  const {
    startDate,
    endDate,
    page = 1,
    limit = 50,
    area,
    resultType = "all",
  } = req.query;

  if (!startDate || !endDate) {
    throw new AppError(
      "Missing required query parameters: startDate and endDate.",
      400,
    );
  }

  // Validate area
  let areaId = null;

  if (
    area !== undefined &&
    area !== "" &&
    String(area).toLowerCase() !== "all"
  ) {
    areaId = Number(area);

    if (!CPT_AREA_IDS.includes(areaId)) {
      throw new AppError(
        `Invalid area. Allowed values: ${CPT_AREA_IDS.join(", ")}.`,
        400,
      );
    }
  }

  // Validate resultType
  const normalizedResultType = String(resultType).toLowerCase();

  if (!["all", "pass", "fail"].includes(normalizedResultType)) {
    throw new AppError(
      "Invalid resultType. Allowed values: all, pass, fail.",
      400,
    );
  }

  // Build fixed SQL condition based on validated resultType
  const resultCondition =
    normalizedResultType === "pass"
      ? "AND MAIN.STATUS = 1"
      : normalizedResultType === "fail"
        ? "AND (MAIN.STATUS <> 1 OR MAIN.STATUS IS NULL)"
        : "";

  const istStart = convertToIST(startDate);
  const istEnd = convertToIST(endDate);

  const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100000);

  const offset = (pageNumber - 1) * pageSize;

  const query = `
    SET NOCOUNT ON;

    DECLARE @RETURN_TBL TABLE (
      [Result_ID]        [bigint]       NULL,
      [DATE]             [nvarchar](50) NULL,
      [TIME]             [nvarchar](50) NULL,
      [BARCODE]          [nvarchar](50) NULL,
      [MODEL]            [nvarchar](50) NULL,
      [MODELNAME]        [nvarchar](50) NULL,
      [RUNTIME_MINUTES]  [nvarchar](50) NULL,
      [MAX_TEMPERATURE]  [nvarchar](50) NULL,
      [MIN_TEMPERATURE]  [nvarchar](50) NULL,
      [MAX_CURRENT]      [nvarchar](50) NULL,
      [MIN_CURRENT]      [nvarchar](50) NULL,
      [MAX_VOLTAGE]      [nvarchar](50) NULL,
      [MIN_VOLTAGE]      [nvarchar](50) NULL,
      [MAX_POWER]        [nvarchar](50) NULL,
      [MIN_POWER]        [nvarchar](50) NULL,
      [PERFORMANCE]      [nvarchar](50) NULL,
      [FaultCode]        [nvarchar](50) NULL,
      [FaultName]        [nvarchar](50) NULL,
      [AREA_ID]          [nvarchar](2)  NULL
    );

    IF OBJECT_ID(N'tempdb..#RESULT_SET') IS NOT NULL
      DROP TABLE #RESULT_SET;

    SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;

    ;WITH SAMPLE_DATA AS (
      SELECT
        RSS.RESULT_ID,
        RSS.PROFILE_DEVICE_NO,
        MAX(RSS.SAMPLE_VALUE) AS [Max],
        MIN(RSS.SAMPLE_VALUE) AS [Min]
      FROM PLIS.dbo.RESULTS_SEQS_SAMPLES RSS
      INNER JOIN PLIS.dbo.RESULTS R
        ON R.RESULT_ID = RSS.RESULT_ID
       AND R.SERVER_ID = 0
      WHERE RSS.SERVER_ID = 0
        AND R.START_DATE BETWEEN @startDate AND @endDate
      GROUP BY RSS.RESULT_ID, RSS.PROFILE_DEVICE_NO
    ),
    SAMPLE_DATA_PROFILE_DEVICE AS (
      SELECT
        SD.RESULT_ID,
        SD.[Max],
        SD.[Min],
        PD.DEVICE_TYPE_ID
      FROM PLIS.dbo.RESULTS R
      INNER JOIN SAMPLE_DATA SD
        ON R.RESULT_ID = SD.RESULT_ID
      INNER JOIN PLIS.dbo.PROFILES_DEVICES PD
        ON SD.PROFILE_DEVICE_NO = PD.DEVICE_NO
       AND R.PROFILE_ID = PD.PROFILE_ID
       AND R.PROFILE_HISTORY_ID = PD.HISTORY_ID
       AND PD.SERVER_ID = 0
      WHERE PD.DEVICE_TYPE_ID IN (1, 2, 3, 7)
        AND R.SERVER_ID = 0
    )
    SELECT *
    INTO #RESULT_SET
    FROM SAMPLE_DATA_PROFILE_DEVICE;

    CREATE INDEX IX_RESULT_SET_DEVICE_TYPE_ID
      ON #RESULT_SET (DEVICE_TYPE_ID, RESULT_ID);

    INSERT INTO @RETURN_TBL (
      [Result_ID], [DATE], [TIME], [BARCODE], [MODEL], [MODELNAME],
      [RUNTIME_MINUTES],
      [MAX_TEMPERATURE], [MIN_TEMPERATURE],
      [MAX_CURRENT], [MIN_CURRENT],
      [MAX_VOLTAGE], [MIN_VOLTAGE],
      [MAX_POWER], [MIN_POWER],
      [PERFORMANCE], [FaultCode], [FaultName], [AREA_ID]
    )
    SELECT
      MAIN.RESULT_ID,
      CONVERT(VARCHAR(10), MAIN.START_DATE, 105) AS [DATE],
      CONVERT(VARCHAR(8), MAIN.START_DATE, 108) AS [TIME],
      MAIN.BARCODE,
      MAIN.MODEL_ID AS MODEL,
      MDL.NAME AS MODELNAME,
      DATEDIFF(MI, MAIN.START_DATE, MAIN.END_DATE) AS RUNTIME_MINUTES,
      TEMP.[Max] AS MAX_TEMPERATURE,
      TEMP.[Min] AS MIN_TEMPERATURE,
      CUR.[Max] AS MAX_CURRENT,
      CUR.[Min] AS MIN_CURRENT,
      VOL.[Max] AS MAX_VOLTAGE,
      VOL.[Min] AS MIN_VOLTAGE,
      POW.[Max] AS MAX_POWER,
      POW.[Min] AS MIN_POWER,
      CASE
        WHEN MAIN.STATUS = 1 THEN 'PASS'
        ELSE 'FAIL'
      END AS PERFORMANCE,
      ISNULL(SS.DEVICE_STATUS_CODE, 0) AS FaultCode,
      CASE
        WHEN SS.DEVICE_STATUS_CODE = 26 THEN 'System Already Charged'
        WHEN CN.NAME IS NULL AND MAIN.STATUS = 0 THEN 'Station Fault Stop'
        WHEN CN.NAME IS NULL THEN 'Charging Pass'
        ELSE CN.NAME
      END AS FaultName,
      MAIN.AREA_ID
    FROM PLIS.dbo.RESULTS MAIN
    INNER JOIN #RESULT_SET TEMP
      ON MAIN.RESULT_ID = TEMP.RESULT_ID
     AND TEMP.DEVICE_TYPE_ID = 7
    INNER JOIN #RESULT_SET CUR
      ON TEMP.RESULT_ID = CUR.RESULT_ID
     AND CUR.DEVICE_TYPE_ID = 2
    INNER JOIN #RESULT_SET VOL
      ON CUR.RESULT_ID = VOL.RESULT_ID
     AND VOL.DEVICE_TYPE_ID = 3
    INNER JOIN #RESULT_SET POW
      ON VOL.RESULT_ID = POW.RESULT_ID
     AND POW.DEVICE_TYPE_ID = 1
    LEFT JOIN PLIS.dbo.MODELS MDL
      ON MDL.MODEL_ID = MAIN.MODEL_ID
    LEFT JOIN PLIS.dbo.RESULTS_STEPS_STATUS SS
      ON MAIN.RESULT_ID = SS.RESULT_ID
    LEFT JOIN (
      SELECT DISTINCT STATUS_CODE_ID, NAME, STATUS_CODE_TYPE
      FROM PLIS.dbo.DEVICES_STATUS_CODES
      WHERE LANGUAGE_ID = 0
    ) CN
      ON CN.STATUS_CODE_ID = SS.DEVICE_STATUS_CODE
     AND CN.STATUS_CODE_TYPE = SS.Status_Type_ID
    WHERE MAIN.AREA_ID IN (5, 6, 8, 9)
      ${areaId !== null ? "AND MAIN.AREA_ID = @area" : ""}
      ${resultCondition}
      AND MAIN.START_DATE BETWEEN @startDate AND @endDate;

    -- Calculate count using the same filtered records
    DECLARE @TotalCount INT;

    SELECT @TotalCount = COUNT(*)
    FROM @RETURN_TBL
    WHERE Result_ID NOT IN (
      SELECT Result_ID FROM GasChargeSUSDtls
    );

    -- Return paginated records
    SELECT *
    FROM @RETURN_TBL
    WHERE Result_ID NOT IN (
      SELECT Result_ID FROM GasChargeSUSDtls
    )
    ORDER BY Result_ID DESC
    OFFSET @offset ROWS
    FETCH NEXT @pageSize ROWS ONLY;

    -- Return total count
    SELECT @TotalCount AS TotalCount;
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const request = pool
      .request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate", sql.DateTime, istEnd)
      .input("offset", sql.Int, offset)
      .input("pageSize", sql.Int, pageSize);

    if (areaId !== null) {
      request.input("area", sql.Int, areaId);
    }

    const result = await request.query(query);

    const data = result.recordsets?.[0] ?? [];
    const totalCount = result.recordsets?.[1]?.[0]?.TotalCount ?? 0;
    const totalPages = Math.ceil(totalCount / pageSize);

    return res.status(200).json({
      success: true,
      message: "CPT Report data retrieved successfully.",
      data,
      pagination: {
        currentPage: pageNumber,
        totalPages,
        totalRecords: totalCount,
        limit: pageSize,
        hasNextPage: pageNumber < totalPages,
        hasPrevPage: pageNumber > 1,
      },
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch the CPT Report data: ${error.message}`,
      500,
    );
  } finally {
    await pool.close();
  }
});
