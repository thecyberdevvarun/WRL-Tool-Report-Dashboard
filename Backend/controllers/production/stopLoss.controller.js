import sql from "mssql";
import { dbConfig1 } from "../../config/db.config.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";
import { convertToIST } from "../../utils/convertToIST.js";

// --- Get Summary Report -----------------------------------------
export const getStopLossSummary = tryCatch(async (req, res) => {
  const { fromDate, toDate, location } = req.query;

  if (!fromDate || !toDate) {
    throw new AppError("From Date and To Date are required", 400);
  }

  if (!location) {
    throw new AppError("Location is required", 400);
  }

  const isFromDate = convertToIST(fromDate);
  const isToDate = convertToIST(toDate);

  const query = `
    ;WITH EMG AS
    (
      SELECT 
        T.RefID,
        M.PLCLocation AS StationName,
        M.Location,
        T.EmgOn,
        T.EmgOff,
        DATEDIFF(SECOND, T.EmgOn, T.EmgOff) AS TotalSeconds
      FROM EMGTrans T
      INNER JOIN EMGMaster M
        ON T.PLCCode = M.PLCCode
        AND T.MEMBit = M.MEMBit
        AND M.Active = 1
      WHERE T.EmgOff IS NOT NULL
        AND T.EmgOn >= @fromDate
        AND T.EmgOn < @toDate
        AND M.Location = @location
    ),

    BREAKS AS
    (
      SELECT 
        Name,
        CAST(CAST(@fromDate AS DATE) AS DATETIME) + CAST(StartTime AS DATETIME) AS BreakStart,
        CAST(CAST(@fromDate AS DATE) AS DATETIME) + CAST(EndTime AS DATETIME) AS BreakEnd
      FROM ShiftBreaks
    ),

    CALC AS
    (
      SELECT 
        E.RefID,
        E.StationName,
        E.TotalSeconds,
        ISNULL(SUM(
          CASE 
            WHEN B.BreakStart < E.EmgOff AND B.BreakEnd > E.EmgOn
            THEN DATEDIFF(SECOND,
              CASE WHEN E.EmgOn > B.BreakStart THEN E.EmgOn ELSE B.BreakStart END,
              CASE WHEN E.EmgOff < B.BreakEnd THEN E.EmgOff ELSE B.BreakEnd END
            )
            ELSE 0
          END
        ), 0) AS BreakSeconds
      FROM EMG E
      CROSS JOIN BREAKS B
      GROUP BY E.RefID, E.StationName, E.TotalSeconds
    ),

    FINAL AS
    (
      SELECT
        StationName,
        (TotalSeconds - BreakSeconds) AS NetSeconds
      FROM CALC
    )

    SELECT
      StationName       AS [Station_Name],
      CONVERT(VARCHAR, DATEADD(SECOND, SUM(NetSeconds), 0), 108) AS [Total_Stop_Time],
      SUM(NetSeconds)   AS [Total_Seconds],
      COUNT(*)          AS [Total_Stop_Count]
    FROM FINAL
    WHERE NetSeconds > 0
    GROUP BY StationName
    ORDER BY SUM(NetSeconds) DESC;
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const request = pool
      .request()
      .input("fromDate", sql.DateTime, isFromDate)
      .input("toDate", sql.DateTime, isToDate)
      .input("location", sql.NVarChar, location);

    const result = await request.query(query);

    res.status(200).json({
      success: true,
      message: "Stop & Loss Summary retrieved successfully",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Stop & Loss Summary: ${error.message}`,
      500,
    );
  } finally {
    await pool.close();
  }
});

// --- Get Detail Report ------------------------------------------
export const getStopLossDetail = tryCatch(async (req, res) => {
  const { fromDate, toDate, location } = req.query;

  if (!fromDate || !toDate) {
    throw new AppError("From Date and To Date are required", 400);
  }

  if (!location) {
    throw new AppError("Location is required", 400);
  }
  const isFromDate = convertToIST(fromDate);
  const isToDate = convertToIST(toDate);

  const query = `
;WITH EMG AS
(
  SELECT 
    T.RefID,
    M.PLCLocation AS StationName,
    M.Location,
    T.EmgOn,
    T.EmgOff,
    DATEDIFF(SECOND, T.EmgOn, T.EmgOff) AS TotalSeconds
  FROM EMGTrans T
  INNER JOIN EMGMaster M
    ON T.PLCCode = M.PLCCode
    AND T.MEMBit = M.MEMBit
    AND M.Active = 1
  WHERE T.EmgOff IS NOT NULL
    AND T.EmgOn >= @FromDate
    AND T.EmgOn < @ToDate
    AND M.Location = @Location
),

BREAKS AS
(
  SELECT 
    Name,
    CAST(CAST(@FromDate AS DATE) AS DATETIME) + CAST(StartTime AS DATETIME) AS BreakStart,
    CAST(CAST(@FromDate AS DATE) AS DATETIME) + CAST(EndTime AS DATETIME) AS BreakEnd
  FROM ShiftBreaks
),

CALC AS
(
  SELECT 
    E.RefID,
    E.StationName,
    E.EmgOn,
    E.EmgOff,
    E.TotalSeconds,
    ISNULL(SUM(
      CASE 
        WHEN B.BreakStart < E.EmgOff AND B.BreakEnd > E.EmgOn
        THEN DATEDIFF(SECOND,
          CASE WHEN E.EmgOn > B.BreakStart THEN E.EmgOn ELSE B.BreakStart END,
          CASE WHEN E.EmgOff < B.BreakEnd THEN E.EmgOff ELSE B.BreakEnd END
        )
        ELSE 0
      END
    ), 0) AS BreakSeconds
  FROM EMG E
  CROSS JOIN BREAKS B
  GROUP BY E.RefID, E.StationName, E.EmgOn, E.EmgOff, E.TotalSeconds
)

SELECT
  ROW_NUMBER() OVER (PARTITION BY StationName ORDER BY EmgOn) AS [Sr_No],
  StationName AS [Station_Name],
  CONVERT(DATE, EmgOn) AS [Date],
  CONVERT(VARCHAR(8), EmgOn, 108) AS [Stop_Time],
  CONVERT(VARCHAR(8), EmgOff, 108) AS [Start_Time],
  (TotalSeconds - BreakSeconds) AS [Duration_Seconds],
  CONVERT(VARCHAR,
    DATEADD(SECOND, (TotalSeconds - BreakSeconds), 0), 108) AS [Duration]
FROM CALC
WHERE (TotalSeconds - BreakSeconds) > 0
ORDER BY StationName, EmgOn;
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const request = pool
      .request()
      .input("fromDate", sql.DateTime, isFromDate)
      .input("toDate", sql.DateTime, isToDate)
      .input("location", sql.NVarChar, location);

    const result = await request.query(query);

    res.status(200).json({
      success: true,
      message: "Stop & Loss Detail retrieved successfully",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Stop & Loss Detail: ${error.message}`,
      500,
    );
  } finally {
    await pool.close();
  }
});

// --- Get Locations (for dropdown) -------------------------------
export const getStopLossLocations = tryCatch(async (req, res) => {
  const query = `
    SELECT DISTINCT Location 
    FROM EMGMaster 
    WHERE Active = 1 
    ORDER BY Location;
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool.request().query(query);

    res.status(200).json({
      success: true,
      message: "Locations retrieved successfully",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(`Failed to fetch locations: ${error.message}`, 500);
  } finally {
    await pool.close();
  }
});
