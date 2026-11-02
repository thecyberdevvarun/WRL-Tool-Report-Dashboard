import sql from "mssql";
import { dbConfig1 } from "../../../config/db.config.js";
import { tryCatch } from "../../../utils/try-catch.js";
import { AppError } from "../../../utils/app-error.js";

// -- Shared connection pool (created once, reused per process) -----------------
let _pool = null;

const getPool = async () => {
  if (_pool) return _pool;
  _pool = await new sql.ConnectionPool(dbConfig1).connect();
  _pool.on("error", () => {
    _pool = null; // force re-connect on next request
  });
  return _pool;
};

/**
 * Run any SQL that has @StartTime and @EndTime parameters.
 */
const runTimeQuery = async (query, StartTime, EndTime) => {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("StartTime", sql.VarChar, StartTime)
    .input("EndTime", sql.VarChar, EndTime)
    .query(query);
  return result.recordset;
};

// -----------------------------------------------------------------------------
//  FINAL LOADING
// -----------------------------------------------------------------------------

export const getFinalLoadingHPFrz = tryCatch(async (req, res) => {
  const { StartTime, EndTime } = req.query;

  const query = `
WITH Psno AS (
  SELECT DocNo, Material, Serial, VSerial, Alias, Type
  FROM MaterialBarcode
  WHERE PrintStatus = 1 AND Status <> 99 AND Type NOT IN (200)
),
HourlySummary AS (
  SELECT
    DATEPART(DAY,  b.ActivityOn) AS TIMEDAY,
    DATEPART(HOUR, b.ActivityOn) AS TIMEHOUR,
    CAST(
      CAST(CAST(b.ActivityOn AS DATE) AS VARCHAR) + ' ' +
      CAST(DATEPART(HOUR, b.ActivityOn) AS VARCHAR) + ':00:00'
    AS DATETIME) AS HourTime,
    COUNT(*) AS Loading_Count
  FROM Psno
  JOIN ProcessActivity b ON b.PSNo        = Psno.DocNo
  JOIN WorkCenter c      ON b.StationCode = c.StationCode
  JOIN Material m        ON Psno.Material = m.MatCode
  JOIN Users u           ON b.Operator    = u.UserCode
  WHERE
    c.StationCode = 1220005
    AND b.ActivityType = 5
    AND b.ActivityOn BETWEEN @StartTime AND @EndTime
    AND b.Remark = 12501
  GROUP BY
    DATEPART(DAY,  b.ActivityOn),
    DATEPART(HOUR, b.ActivityOn),
    CAST(
      CAST(CAST(b.ActivityOn AS DATE) AS VARCHAR) + ' ' +
      CAST(DATEPART(HOUR, b.ActivityOn) AS VARCHAR) + ':00:00'
    AS DATETIME)
)
SELECT
  CONCAT('H', ROW_NUMBER() OVER (ORDER BY HourTime)) AS HOUR_NUMBER,
  TIMEHOUR,
  Loading_Count AS COUNT
FROM HourlySummary
ORDER BY HourTime;`;

  try {
    const data = await runTimeQuery(query, StartTime, EndTime);
    res.status(200).json({
      success: true,
      message: "Final HP Frz hourly loading data fetched successfully",
      data,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Final HP Frz hourly loading data: ${error.message}`,
      500,
    );
  }
});

export const getFinalLoadingHPChoc = tryCatch(async (req, res) => {
  const { StartTime, EndTime } = req.query;

  const query = `
WITH Psno AS (
  SELECT DocNo, Material, Serial, VSerial, Alias, Type
  FROM MaterialBarcode
  WHERE PrintStatus = 1 AND Status <> 99 AND Type NOT IN (200)
),
HourlySummary AS (
  SELECT
    DATEPART(DAY,  b.ActivityOn) AS TIMEDAY,
    DATEPART(HOUR, b.ActivityOn) AS TIMEHOUR,
    CAST(
      CAST(CAST(b.ActivityOn AS DATE) AS VARCHAR) + ' ' +
      CAST(DATEPART(HOUR, b.ActivityOn) AS VARCHAR) + ':00:00'
    AS DATETIME) AS HourTime,
    COUNT(*) AS Loading_Count
  FROM Psno
  JOIN ProcessActivity b ON b.PSNo        = Psno.DocNo
  JOIN WorkCenter c      ON b.StationCode = c.StationCode
  JOIN Material m        ON Psno.Material = m.MatCode
  JOIN Users u           ON b.Operator    = u.UserCode
  WHERE
    c.StationCode = 1220005
    AND b.ActivityType = 5
    AND b.ActivityOn BETWEEN @StartTime AND @EndTime
    AND b.Remark = 12305
  GROUP BY
    DATEPART(DAY,  b.ActivityOn),
    DATEPART(HOUR, b.ActivityOn),
    CAST(
      CAST(CAST(b.ActivityOn AS DATE) AS VARCHAR) + ' ' +
      CAST(DATEPART(HOUR, b.ActivityOn) AS VARCHAR) + ':00:00'
    AS DATETIME)
)
SELECT
  CONCAT('H', ROW_NUMBER() OVER (ORDER BY HourTime)) AS HOUR_NUMBER,
  TIMEHOUR,
  Loading_Count AS COUNT
FROM HourlySummary
ORDER BY HourTime;`;

  try {
    const data = await runTimeQuery(query, StartTime, EndTime);
    res.status(200).json({
      success: true,
      message: "Final HP Choc hourly loading data fetched successfully",
      data,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Final HP Choc hourly loading data: ${error.message}`,
      500,
    );
  }
});

export const getFinalLoadingHPVISI = tryCatch(async (req, res) => {
  const { StartTime, EndTime } = req.query;

  const query = `
WITH Psno AS (
  SELECT DocNo, Material, Serial, VSerial, Alias, Type
  FROM MaterialBarcode
  WHERE PrintStatus = 1 AND Status <> 99 AND Type NOT IN (200)
),
HourlySummary AS (
  SELECT
    DATEPART(DAY,  b.ActivityOn) AS TIMEDAY,
    DATEPART(HOUR, b.ActivityOn) AS TIMEHOUR,
    CAST(
      CAST(CAST(b.ActivityOn AS DATE) AS VARCHAR) + ' ' +
      CAST(DATEPART(HOUR, b.ActivityOn) AS VARCHAR) + ':00:00'
    AS DATETIME) AS HourTime,
    COUNT(*) AS Loading_Count
  FROM Psno
  JOIN ProcessActivity b ON b.PSNo        = Psno.DocNo
  JOIN WorkCenter c      ON b.StationCode = c.StationCode
  JOIN Material m        ON Psno.Material = m.MatCode
  JOIN Users u           ON b.Operator    = u.UserCode
  WHERE
    c.StationCode = 1220005
    AND b.ActivityType = 5
    AND b.ActivityOn BETWEEN @StartTime AND @EndTime
    AND b.Remark = 12605
  GROUP BY
    DATEPART(DAY,  b.ActivityOn),
    DATEPART(HOUR, b.ActivityOn),
    CAST(
      CAST(CAST(b.ActivityOn AS DATE) AS VARCHAR) + ' ' +
      CAST(DATEPART(HOUR, b.ActivityOn) AS VARCHAR) + ':00:00'
    AS DATETIME)
)
SELECT
  CONCAT('H', ROW_NUMBER() OVER (ORDER BY HourTime)) AS HOUR_NUMBER,
  TIMEHOUR,
  Loading_Count AS COUNT
FROM HourlySummary
ORDER BY HourTime;`;

  try {
    const data = await runTimeQuery(query, StartTime, EndTime);
    res.status(200).json({
      success: true,
      message: "Final HP Choc hourly loading data fetched successfully",
      data,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Final HP Choc hourly loading data: ${error.message}`,
      500,
    );
  }
});

export const getFinalLoadingHPSUS = tryCatch(async (req, res) => {
  const { StartTime, EndTime } = req.query;

  // TODO: add m.Category / u.UserRole filters if needed (missing in original)
  const query = `
WITH Psno AS (
  SELECT DocNo, Material, Serial, VSerial, Alias, Type
  FROM MaterialBarcode
  WHERE PrintStatus = 1 AND Status <> 99 AND Type NOT IN (200)
),
HourlySummary AS (
  SELECT
    DATEPART(DAY,  b.ActivityOn) AS TIMEDAY,
    DATEPART(HOUR, b.ActivityOn) AS TIMEHOUR,
    CAST(
      CAST(CAST(b.ActivityOn AS DATE) AS VARCHAR) + ' ' +
      CAST(DATEPART(HOUR, b.ActivityOn) AS VARCHAR) + ':00:00'
    AS DATETIME) AS HourTime,
    COUNT(*) AS Loading_Count
  FROM Psno
  JOIN ProcessActivity b ON b.PSNo        = Psno.DocNo
  JOIN WorkCenter c      ON b.StationCode = c.StationCode
  JOIN Material m        ON Psno.Material = m.MatCode
  JOIN Users u           ON b.Operator    = u.UserCode
  WHERE
    c.StationCode = 1230013
    AND b.ActivityType = 5
    AND b.ActivityOn BETWEEN @StartTime AND @EndTime
    AND b.Remark = 12304
  GROUP BY
    DATEPART(DAY,  b.ActivityOn),
    DATEPART(HOUR, b.ActivityOn),
    CAST(
      CAST(CAST(b.ActivityOn AS DATE) AS VARCHAR) + ' ' +
      CAST(DATEPART(HOUR, b.ActivityOn) AS VARCHAR) + ':00:00'
    AS DATETIME)
)
SELECT
  CONCAT('H', ROW_NUMBER() OVER (ORDER BY HourTime)) AS HOUR_NUMBER,
  TIMEHOUR,
  Loading_Count AS COUNT
FROM HourlySummary
ORDER BY HourTime;`;

  try {
    const data = await runTimeQuery(query, StartTime, EndTime);
    res.status(200).json({
      success: true,
      message: "Final HP SUS hourly loading data fetched successfully",
      data,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Final HP SUS hourly loading data: ${error.message}`,
      500,
    );
  }
});

export const getFinalLoadingHPCAT = tryCatch(async (req, res) => {
  const { StartTime, EndTime } = req.query;

  const query = `
WITH Psno AS (
  SELECT DocNo, Material, Serial, VSerial, Alias
  FROM MaterialBarcode
  WHERE PrintStatus = 1 AND Status <> 99 AND Type NOT IN (200)
)
SELECT
  ISNULL(mc.Alias, 'N/A') AS category,
  COUNT(*) AS TotalCount
FROM Psno
JOIN ProcessActivity b   ON b.PSNo         = Psno.DocNo
JOIN WorkCenter c        ON b.StationCode  = c.StationCode
JOIN Users us            ON us.UserCode    = b.Operator
JOIN Material m          ON m.MatCode      = Psno.Material
LEFT JOIN MaterialCategory mc ON mc.CategoryCode = m.Category
WHERE
  b.ActivityType = 5
  AND c.StationCode IN (1230013, 1220005)
  AND b.ActivityOn BETWEEN @StartTime AND @EndTime
GROUP BY ISNULL(mc.Alias, 'N/A')
ORDER BY TotalCount DESC;`;

  try {
    const data = await runTimeQuery(query, StartTime, EndTime);
    res.status(200).json({
      success: true,
      message: "Final HP CAT loading data fetched successfully",
      data,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Final HP CAT loading data: ${error.message}`,
      500,
    );
  }
});

// -----------------------------------------------------------------------------
//  FINAL LINE
// -----------------------------------------------------------------------------

export const getFinalHPFrz = tryCatch(async (req, res) => {
  const { StartTime, EndTime } = req.query;

  const query = `
WITH Psno AS (
  SELECT DocNo, Material, Serial, VSerial, Alias, Type
  FROM MaterialBarcode
  WHERE PrintStatus = 1 AND Status <> 99 AND Type NOT IN (200)
),
HourlySummary AS (
  SELECT
    DATEPART(DAY,  b.ActivityOn) AS TIMEDAY,
    DATEPART(HOUR, b.ActivityOn) AS TIMEHOUR,
    CAST(
      CAST(CAST(b.ActivityOn AS DATE) AS VARCHAR) + ' ' +
      CAST(DATEPART(HOUR, b.ActivityOn) AS VARCHAR) + ':00:00'
    AS DATETIME) AS HourTime,
    COUNT(*) AS Loading_Count
  FROM Psno
  JOIN ProcessActivity b   ON b.PSNo         = Psno.DocNo
  JOIN WorkCenter c        ON b.StationCode  = c.StationCode
  JOIN Material m          ON Psno.Material  = m.MatCode
  JOIN MaterialCategory mc ON mc.CategoryCode= m.Category
  JOIN Users u             ON u.UserCode     = b.Operator
  WHERE
    c.StationCode = 1220010
    AND b.Remark = 12501
    AND b.ActivityType = 5
    AND b.ActivityOn BETWEEN @StartTime AND @EndTime
  GROUP BY
    DATEPART(DAY,  b.ActivityOn),
    DATEPART(HOUR, b.ActivityOn),
    CAST(
      CAST(CAST(b.ActivityOn AS DATE) AS VARCHAR) + ' ' +
      CAST(DATEPART(HOUR, b.ActivityOn) AS VARCHAR) + ':00:00'
    AS DATETIME)
)
SELECT
  CONCAT('H', ROW_NUMBER() OVER (ORDER BY HourTime)) AS HOUR_NUMBER,
  TIMEHOUR,
  Loading_Count AS COUNT
FROM HourlySummary
ORDER BY HourTime;`;

  try {
    const data = await runTimeQuery(query, StartTime, EndTime);
    res.status(200).json({
      success: true,
      message: "Final HP Frz hourly loading data fetched successfully",
      data,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Final HP Frz hourly loading data: ${error.message}`,
      500,
    );
  }
});

export const getFinalHPChoc = tryCatch(async (req, res) => {
  const { StartTime, EndTime } = req.query;

  const query = `
WITH Psno AS (
  SELECT DocNo, Material, Serial, VSerial, Alias, Type
  FROM MaterialBarcode
  WHERE PrintStatus = 1 AND Status <> 99 AND Type NOT IN (200)
),
HourlySummary AS (
  SELECT
    DATEPART(DAY,  b.ActivityOn) AS TIMEDAY,
    DATEPART(HOUR, b.ActivityOn) AS TIMEHOUR,
    CAST(
      CAST(CAST(b.ActivityOn AS DATE) AS VARCHAR) + ' ' +
      CAST(DATEPART(HOUR, b.ActivityOn) AS VARCHAR) + ':00:00'
    AS DATETIME) AS HourTime,
    COUNT(*) AS Loading_Count
  FROM Psno
  JOIN ProcessActivity b   ON b.PSNo         = Psno.DocNo
  JOIN WorkCenter c        ON b.StationCode  = c.StationCode
  JOIN Material m          ON Psno.Material  = m.MatCode
  JOIN MaterialCategory mc ON mc.CategoryCode= m.Category
  JOIN Users u             ON u.UserCode     = b.Operator
  WHERE
    c.StationCode = 1220010
    AND b.Remark = 12305
    AND b.ActivityType = 5
    AND b.ActivityOn BETWEEN @StartTime AND @EndTime
  GROUP BY
    DATEPART(DAY,  b.ActivityOn),
    DATEPART(HOUR, b.ActivityOn),
    CAST(
      CAST(CAST(b.ActivityOn AS DATE) AS VARCHAR) + ' ' +
      CAST(DATEPART(HOUR, b.ActivityOn) AS VARCHAR) + ':00:00'
    AS DATETIME)
)
SELECT
  CONCAT('H', ROW_NUMBER() OVER (ORDER BY HourTime)) AS HOUR_NUMBER,
  TIMEHOUR,
  Loading_Count AS COUNT
FROM HourlySummary
ORDER BY HourTime;`;

  try {
    const data = await runTimeQuery(query, StartTime, EndTime);
    res.status(200).json({
      success: true,
      message: "Final HP Choc hourly loading data fetched successfully",
      data,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Final HP Choc hourly loading data: ${error.message}`,
      500,
    );
  }
});

export const getFinalHPVISI = tryCatch(async (req, res) => {
  const { StartTime, EndTime } = req.query;

  const query = `
WITH Psno AS (
  SELECT DocNo, Material, Serial, VSerial, Alias, Type
  FROM MaterialBarcode
  WHERE PrintStatus = 1 AND Status <> 99 AND Type NOT IN (200)
),
HourlySummary AS (
  SELECT
    DATEPART(DAY,  b.ActivityOn) AS TIMEDAY,
    DATEPART(HOUR, b.ActivityOn) AS TIMEHOUR,
    CAST(
      CAST(CAST(b.ActivityOn AS DATE) AS VARCHAR) + ' ' +
      CAST(DATEPART(HOUR, b.ActivityOn) AS VARCHAR) + ':00:00'
    AS DATETIME) AS HourTime,
    COUNT(*) AS Loading_Count
  FROM Psno
  JOIN ProcessActivity b ON b.PSNo        = Psno.DocNo
  JOIN WorkCenter c      ON b.StationCode = c.StationCode
  JOIN Material m        ON Psno.Material = m.MatCode
  JOIN Users u           ON b.Operator    = u.UserCode
  WHERE
    c.StationCode = 1220010
    AND b.ActivityType = 5
    AND b.ActivityOn BETWEEN @StartTime AND @EndTime
    AND b.Remark = 12605
  GROUP BY
    DATEPART(DAY,  b.ActivityOn),
    DATEPART(HOUR, b.ActivityOn),
    CAST(
      CAST(CAST(b.ActivityOn AS DATE) AS VARCHAR) + ' ' +
      CAST(DATEPART(HOUR, b.ActivityOn) AS VARCHAR) + ':00:00'
    AS DATETIME)
)
SELECT
  CONCAT('H', ROW_NUMBER() OVER (ORDER BY HourTime)) AS HOUR_NUMBER,
  TIMEHOUR,
  Loading_Count AS COUNT
FROM HourlySummary
ORDER BY HourTime;`;

  try {
    const data = await runTimeQuery(query, StartTime, EndTime);
    res.status(200).json({
      success: true,
      message: "Final HP Choc hourly loading data fetched successfully",
      data,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Final HP Choc hourly loading data: ${error.message}`,
      500,
    );
  }
});

export const getFinalHPSUS = tryCatch(async (req, res) => {
  const { StartTime, EndTime } = req.query;

  const query = `
WITH Psno AS (
  SELECT DocNo, Material, Serial, VSerial, Alias, Type
  FROM MaterialBarcode
  WHERE PrintStatus = 1 AND Status <> 99 AND Type NOT IN (200)
),
HourlySummary AS (
  SELECT
    DATEPART(DAY,  b.ActivityOn) AS TIMEDAY,
    DATEPART(HOUR, b.ActivityOn) AS TIMEHOUR,
    CAST(
      CAST(CAST(b.ActivityOn AS DATE) AS VARCHAR) + ' ' +
      CAST(DATEPART(HOUR, b.ActivityOn) AS VARCHAR) + ':00:00'
    AS DATETIME) AS HourTime,
    COUNT(*) AS Loading_Count
  FROM Psno
  JOIN ProcessActivity b   ON b.PSNo         = Psno.DocNo
  JOIN WorkCenter c        ON b.StationCode  = c.StationCode
  JOIN Material m          ON Psno.Material  = m.MatCode
  JOIN MaterialCategory mc ON mc.CategoryCode= m.Category
  WHERE
    c.StationCode = 1230017
    AND b.Remark = 12304
    AND b.ActivityType = 5
    AND b.ActivityOn BETWEEN @StartTime AND @EndTime
  GROUP BY
    DATEPART(DAY,  b.ActivityOn),
    DATEPART(HOUR, b.ActivityOn),
    CAST(
      CAST(CAST(b.ActivityOn AS DATE) AS VARCHAR) + ' ' +
      CAST(DATEPART(HOUR, b.ActivityOn) AS VARCHAR) + ':00:00'
    AS DATETIME)
)
SELECT
  CONCAT('H', ROW_NUMBER() OVER (ORDER BY HourTime)) AS HOUR_NUMBER,
  TIMEHOUR,
  Loading_Count AS COUNT
FROM HourlySummary
ORDER BY HourTime;`;

  try {
    const data = await runTimeQuery(query, StartTime, EndTime);
    res.status(200).json({
      success: true,
      message: "Final HP SUS hourly loading data fetched successfully",
      data,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Final HP SUS hourly loading data: ${error.message}`,
      500,
    );
  }
});

export const getFinalHPCAT = tryCatch(async (req, res) => {
  const { StartTime, EndTime } = req.query;

  const query = `
WITH Psno AS (
  SELECT DocNo, Material, Serial, VSerial, Alias
  FROM MaterialBarcode
  WHERE PrintStatus = 1 AND Status <> 99 AND Type NOT IN (200)
)
SELECT
  ISNULL(mc.Alias, 'N/A') AS category,
  COUNT(*) AS TotalCount
FROM Psno
JOIN ProcessActivity b   ON b.PSNo         = Psno.DocNo
JOIN WorkCenter c        ON b.StationCode  = c.StationCode
JOIN Users us            ON us.UserCode    = b.Operator
JOIN Material m          ON m.MatCode      = Psno.Material
LEFT JOIN MaterialCategory mc ON mc.CategoryCode = m.Category
WHERE
  b.ActivityType = 5
  AND c.StationCode IN (1220010, 1230017)
  AND b.ActivityOn BETWEEN @StartTime AND @EndTime
GROUP BY ISNULL(mc.Alias, 'N/A')
ORDER BY TotalCount DESC;`;

  try {
    const data = await runTimeQuery(query, StartTime, EndTime);
    res.status(200).json({
      success: true,
      message: "Final HP CAT loading data fetched successfully",
      data,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Final HP CAT loading data: ${error.message}`,
      500,
    );
  }
});

// -----------------------------------------------------------------------------
//  POST FOAMING
// -----------------------------------------------------------------------------

export const getPostGrpAHPFrz = tryCatch(async (req, res) => {
  const { StartTime, EndTime } = req.query;

  const query = `
    WITH Psno AS (
      SELECT DocNo, Material, Serial, VSerial, Alias, Type
      FROM MaterialBarcode
      WHERE PrintStatus = 1 AND Status <> 99 AND Type NOT IN (200)
    ),
    HourlySummary AS (
      SELECT
        DATEPART(DAY,  b.ActivityOn) AS TIMEDAY,
        DATEPART(HOUR, b.ActivityOn) AS TIMEHOUR,
        CAST(
          CAST(CAST(b.ActivityOn AS DATE) AS VARCHAR) + ' ' +
          CAST(DATEPART(HOUR, b.ActivityOn) AS VARCHAR) + ':00:00'
        AS DATETIME) AS HourTime,
        COUNT(*) AS Loading_Count
      FROM Psno
      JOIN ProcessActivity b ON b.PSNo        = Psno.DocNo
      JOIN WorkCenter c      ON b.StationCode = c.StationCode
      JOIN Material m        ON Psno.Material = m.MatCode
      JOIN Users u           ON b.Operator    = u.UserCode
      WHERE
        c.StationCode = 1220003
        AND b.ActivityType = 5
        AND b.ActivityOn BETWEEN @StartTime AND @EndTime
      GROUP BY
        DATEPART(DAY,  b.ActivityOn),
        DATEPART(HOUR, b.ActivityOn),
        CAST(
          CAST(CAST(b.ActivityOn AS DATE) AS VARCHAR) + ' ' +
          CAST(DATEPART(HOUR, b.ActivityOn) AS VARCHAR) + ':00:00'
        AS DATETIME)
    )
    SELECT
      CONCAT('H', ROW_NUMBER() OVER (ORDER BY HourTime)) AS HOUR_NUMBER,
      TIMEHOUR,
      Loading_Count AS COUNT
    FROM HourlySummary
    ORDER BY HourTime;`;

  try {
    const data = await runTimeQuery(query, StartTime, EndTime);
    res.status(200).json({
      success: true,
      message: "Post Foaming HP Frz hourly loading data fetched successfully",
      data,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Post Foaming HP Frz hourly loading data: ${error.message}`,
      500,
    );
  }
});

export const getPostGrpBHPFrz = tryCatch(async (req, res) => {
  const { StartTime, EndTime } = req.query;

  const query = `
    WITH Psno AS (
      SELECT DocNo, Material, Serial, VSerial, Alias, Type
      FROM MaterialBarcode
      WHERE PrintStatus = 1 AND Status <> 99 AND Type NOT IN (200)
    ),
    HourlySummary AS (
      SELECT
        DATEPART(DAY,  b.ActivityOn) AS TIMEDAY,
        DATEPART(HOUR, b.ActivityOn) AS TIMEHOUR,
        CAST(
          CAST(CAST(b.ActivityOn AS DATE) AS VARCHAR) + ' ' +
          CAST(DATEPART(HOUR, b.ActivityOn) AS VARCHAR) + ':00:00'
        AS DATETIME) AS HourTime,
        COUNT(*) AS Loading_Count
      FROM Psno
      JOIN ProcessActivity b ON b.PSNo        = Psno.DocNo
      JOIN WorkCenter c      ON b.StationCode = c.StationCode
      JOIN Material m        ON Psno.Material = m.MatCode
      JOIN Users u           ON b.Operator    = u.UserCode
      WHERE
        c.StationCode = 1220004
        AND b.ActivityType = 5
        AND b.ActivityOn BETWEEN @StartTime AND @EndTime
      GROUP BY
        DATEPART(DAY,  b.ActivityOn),
        DATEPART(HOUR, b.ActivityOn),
        CAST(
          CAST(CAST(b.ActivityOn AS DATE) AS VARCHAR) + ' ' +
          CAST(DATEPART(HOUR, b.ActivityOn) AS VARCHAR) + ':00:00'
        AS DATETIME)
    )
    SELECT
      CONCAT('H', ROW_NUMBER() OVER (ORDER BY HourTime)) AS HOUR_NUMBER,
      TIMEHOUR,
      Loading_Count AS COUNT
    FROM HourlySummary
    ORDER BY HourTime;`;

  try {
    const data = await runTimeQuery(query, StartTime, EndTime);
    res.status(200).json({
      success: true,
      message: "Post Foaming HP Frz hourly loading data fetched successfully",
      data,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Post Foaming HP Frz hourly loading data: ${error.message}`,
      500,
    );
  }
});

export const getPostChocHP = tryCatch(async (req, res) => {
  const { StartTime, EndTime } = req.query;

  const query = `
    WITH Psno AS (
      SELECT DocNo, Material, Serial, VSerial, Alias, Type
      FROM MaterialBarcode
      WHERE PrintStatus = 1 AND Status <> 99 AND Type NOT IN (200)
    ),
    HourlySummary AS (
      SELECT
        DATEPART(DAY,  b.ActivityOn) AS TIMEDAY,
        DATEPART(HOUR, b.ActivityOn) AS TIMEHOUR,
        CAST(
          CAST(CAST(b.ActivityOn AS DATE) AS VARCHAR) + ' ' +
          CAST(DATEPART(HOUR, b.ActivityOn) AS VARCHAR) + ':00:00'
        AS DATETIME) AS HourTime,
        COUNT(*) AS Loading_Count
      FROM Psno
      JOIN ProcessActivity b ON b.PSNo        = Psno.DocNo
      JOIN WorkCenter c      ON b.StationCode = c.StationCode
      JOIN Material m        ON Psno.Material = m.MatCode
      JOIN Users u           ON b.Operator    = u.UserCode
      WHERE
        c.StationCode in (1230007,1230012)
        AND Remark = 12305
        AND b.ActivityOn BETWEEN @StartTime AND @EndTime
      GROUP BY
        DATEPART(DAY,  b.ActivityOn),
        DATEPART(HOUR, b.ActivityOn),
        CAST(
          CAST(CAST(b.ActivityOn AS DATE) AS VARCHAR) + ' ' +
          CAST(DATEPART(HOUR, b.ActivityOn) AS VARCHAR) + ':00:00'
        AS DATETIME)
    )
    SELECT
      CONCAT('H', ROW_NUMBER() OVER (ORDER BY HourTime)) AS HOUR_NUMBER,
      TIMEHOUR,
      Loading_Count AS COUNT
    FROM HourlySummary
    ORDER BY HourTime;`;

  try {
    const data = await runTimeQuery(query, StartTime, EndTime);
    res.status(200).json({
      success: true,
      message: "Post Foaming HP Frz hourly loading data fetched successfully",
      data,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Post Foaming HP Frz hourly loading data: ${error.message}`,
      500,
    );
  }
});

export const getPostFOWHP = tryCatch(async (req, res) => {
  const { StartTime, EndTime } = req.query;

  const query = `
    WITH Psno AS (
      SELECT DocNo, Material, Serial, VSerial, Alias, Type
      FROM MaterialBarcode
      WHERE PrintStatus = 1 AND Status <> 99 AND Type NOT IN (200)
    ),
    HourlySummary AS (
      SELECT
        DATEPART(DAY,  b.ActivityOn) AS TIMEDAY,
        DATEPART(HOUR, b.ActivityOn) AS TIMEHOUR,
        CAST(
          CAST(CAST(b.ActivityOn AS DATE) AS VARCHAR) + ' ' +
          CAST(DATEPART(HOUR, b.ActivityOn) AS VARCHAR) + ':00:00'
        AS DATETIME) AS HourTime,
        COUNT(*) AS Loading_Count
      FROM Psno
      JOIN ProcessActivity b ON b.PSNo        = Psno.DocNo
      JOIN WorkCenter c      ON b.StationCode = c.StationCode
      JOIN Material m        ON Psno.Material = m.MatCode
      JOIN Users u           ON b.Operator    = u.UserCode
      WHERE
        c.StationCode in (1230007)
        AND Remark = 12201
        AND b.ActivityOn BETWEEN @StartTime AND @EndTime
      GROUP BY
        DATEPART(DAY,  b.ActivityOn),
        DATEPART(HOUR, b.ActivityOn),
        CAST(
          CAST(CAST(b.ActivityOn AS DATE) AS VARCHAR) + ' ' +
          CAST(DATEPART(HOUR, b.ActivityOn) AS VARCHAR) + ':00:00'
        AS DATETIME)
    )
    SELECT
      CONCAT('H', ROW_NUMBER() OVER (ORDER BY HourTime)) AS HOUR_NUMBER,
      TIMEHOUR,
      Loading_Count AS COUNT
    FROM HourlySummary
    ORDER BY HourTime;`;

  try {
    const data = await runTimeQuery(query, StartTime, EndTime);
    res.status(200).json({
      success: true,
      message:
        "Manual Post Foaming HP hourly loading data fetched successfully",
      data,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Manual Post Foaming HP hourly loading data: ${error.message}`,
      500,
    );
  }
});

export const getPostHPVISI = tryCatch(async (req, res) => {
  const { StartTime, EndTime } = req.query;

  const query = `
WITH Psno AS (
  SELECT DocNo, Material, Serial, VSerial, Alias, Type
  FROM MaterialBarcode
  WHERE PrintStatus = 1 AND Status <> 99 AND Type NOT IN (200)
),
HourlySummary AS (
  SELECT
    DATEPART(DAY,  b.ActivityOn) AS TIMEDAY,
    DATEPART(HOUR, b.ActivityOn) AS TIMEHOUR,
    CAST(
      CAST(CAST(b.ActivityOn AS DATE) AS VARCHAR) + ' ' +
      CAST(DATEPART(HOUR, b.ActivityOn) AS VARCHAR) + ':00:00'
    AS DATETIME) AS HourTime,
    COUNT(*) AS Loading_Count
  FROM Psno
  JOIN ProcessActivity b ON b.PSNo        = Psno.DocNo
  JOIN WorkCenter c      ON b.StationCode = c.StationCode
  JOIN Material m        ON Psno.Material = m.MatCode
  JOIN Users u           ON b.Operator    = u.UserCode
  WHERE
    c.StationCode = 1230012
    AND b.ActivityType = 5
    AND b.ActivityOn BETWEEN @StartTime AND @EndTime
    AND b.Remark = 12605
  GROUP BY
    DATEPART(DAY,  b.ActivityOn),
    DATEPART(HOUR, b.ActivityOn),
    CAST(
      CAST(CAST(b.ActivityOn AS DATE) AS VARCHAR) + ' ' +
      CAST(DATEPART(HOUR, b.ActivityOn) AS VARCHAR) + ':00:00'
    AS DATETIME)
)
SELECT
  CONCAT('H', ROW_NUMBER() OVER (ORDER BY HourTime)) AS HOUR_NUMBER,
  TIMEHOUR,
  Loading_Count AS COUNT
FROM HourlySummary
ORDER BY HourTime;`;

  try {
    const data = await runTimeQuery(query, StartTime, EndTime);
    res.status(200).json({
      success: true,
      message: "Final HP Choc hourly loading data fetched successfully",
      data,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Final HP Choc hourly loading data: ${error.message}`,
      500,
    );
  }
});

export const getPostHPSUS = tryCatch(async (req, res) => {
  const { StartTime, EndTime } = req.query;

  const query = `
WITH Psno AS (
  SELECT DocNo, Material, Serial, VSerial, Alias, Type
  FROM MaterialBarcode
  WHERE PrintStatus = 1 AND Status <> 99 AND Type NOT IN (200)
),
HourlySummary AS (
  SELECT
    DATEPART(DAY,  b.ActivityOn) AS TIMEDAY,
    DATEPART(HOUR, b.ActivityOn) AS TIMEHOUR,
    CAST(
      CAST(CAST(b.ActivityOn AS DATE) AS VARCHAR) + ' ' +
      CAST(DATEPART(HOUR, b.ActivityOn) AS VARCHAR) + ':00:00'
    AS DATETIME) AS HourTime,
    COUNT(*) AS Loading_Count
  FROM Psno
  JOIN ProcessActivity b ON b.PSNo        = Psno.DocNo
  JOIN WorkCenter c      ON b.StationCode = c.StationCode
  JOIN Material m        ON Psno.Material = m.MatCode
  JOIN Users u           ON b.Operator    = u.UserCode
  WHERE
    c.StationCode = 1230012
    AND b.ActivityType = 5
    AND b.Remark = 12304
    AND b.ActivityOn BETWEEN @StartTime AND @EndTime
  GROUP BY
    DATEPART(DAY,  b.ActivityOn),
    DATEPART(HOUR, b.ActivityOn),
    CAST(
      CAST(CAST(b.ActivityOn AS DATE) AS VARCHAR) + ' ' +
      CAST(DATEPART(HOUR, b.ActivityOn) AS VARCHAR) + ':00:00'
    AS DATETIME)
)
SELECT
  CONCAT('H', ROW_NUMBER() OVER (ORDER BY HourTime)) AS HOUR_NUMBER,
  TIMEHOUR,
  Loading_Count AS COUNT
FROM HourlySummary
ORDER BY HourTime;`;

  try {
    const data = await runTimeQuery(query, StartTime, EndTime);
    res.status(200).json({
      success: true,
      message: "Post Foaming HP SUS hourly loading data fetched successfully",
      data,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Post Foaming HP SUS hourly loading data: ${error.message}`,
      500,
    );
  }
});

export const getPostHPCAT = tryCatch(async (req, res) => {
  const { StartTime, EndTime } = req.query;

  const query = `
WITH Psno AS (
  SELECT DocNo, Material, Serial, VSerial, Alias
  FROM MaterialBarcode
  WHERE PrintStatus = 1 AND Status <> 99 AND Type NOT IN (200)
)
SELECT
  ISNULL(mc.Alias, 'N/A') AS category,
  COUNT(*) AS TotalCount
FROM Psno
JOIN ProcessActivity b   ON b.PSNo         = Psno.DocNo
JOIN WorkCenter c        ON b.StationCode  = c.StationCode
JOIN Users us            ON us.UserCode    = b.Operator
JOIN Material m          ON m.MatCode      = Psno.Material
LEFT JOIN MaterialCategory mc ON mc.CategoryCode = m.Category
WHERE
  b.ActivityType = 5
  AND c.StationCode IN (1220003, 1220004, 1230012, 1230007)
  AND b.ActivityOn BETWEEN @StartTime AND @EndTime
GROUP BY ISNULL(mc.Alias, 'N/A')
ORDER BY TotalCount DESC;`;

  try {
    const data = await runTimeQuery(query, StartTime, EndTime);
    res.status(200).json({
      success: true,
      message: "Post Foaming HP CAT loading data fetched successfully",
      data,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Post Foaming HP CAT loading data: ${error.message}`,
      500,
    );
  }
});

// -----------------------------------------------------------------------------
//  FOAMING
// -----------------------------------------------------------------------------

export const getFoamingHpFomA = tryCatch(async (req, res) => {
  const { StartTime, EndTime } = req.query;

  const query = `
WITH Psno AS (
  SELECT DocNo, Material, Serial, VSerial, Alias, Type
  FROM MaterialBarcode
  WHERE PrintStatus = 1 AND Status <> 99 AND Type NOT IN (200)
),
HourlySummary AS (
  SELECT
    DATEPART(DAY,  b.ActivityOn) AS TIMEDAY,
    DATEPART(HOUR, b.ActivityOn) AS TIMEHOUR,
    CAST(
      CAST(CAST(b.ActivityOn AS DATE) AS VARCHAR) + ' ' +
      CAST(DATEPART(HOUR, b.ActivityOn) AS VARCHAR) + ':00:00'
    AS DATETIME) AS HourTime,
    COUNT(*) AS Loading_Count
  FROM Psno
  JOIN ProcessActivity b ON b.PSNo        = Psno.DocNo
  JOIN WorkCenter c      ON b.StationCode = c.StationCode
  JOIN Material m        ON Psno.Material = m.MatCode
  JOIN Users u           ON b.Operator    = u.UserCode
  WHERE
    c.StationCode = 1220001
    AND b.ActivityType = 5
    AND b.ActivityOn BETWEEN @StartTime AND @EndTime
  GROUP BY
    DATEPART(DAY,  b.ActivityOn),
    DATEPART(HOUR, b.ActivityOn),
    CAST(
      CAST(CAST(b.ActivityOn AS DATE) AS VARCHAR) + ' ' +
      CAST(DATEPART(HOUR, b.ActivityOn) AS VARCHAR) + ':00:00'
    AS DATETIME)
)
SELECT
  CONCAT('H', ROW_NUMBER() OVER (ORDER BY HourTime)) AS HOUR_NUMBER,
  TIMEHOUR,
  Loading_Count AS COUNT
FROM HourlySummary
ORDER BY HourTime;`;

  try {
    const data = await runTimeQuery(query, StartTime, EndTime);
    res.status(200).json({
      success: true,
      message: "Foaming HP FOM A hourly loading data fetched successfully",
      data,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Foaming HP FOM A hourly loading data: ${error.message}`,
      500,
    );
  }
});

export const getFoamingHpFomB = tryCatch(async (req, res) => {
  const { StartTime, EndTime } = req.query;

  const query = `
WITH Psno AS (
  SELECT DocNo, Material, Serial, VSerial, Alias, Type
  FROM MaterialBarcode
  WHERE PrintStatus = 1 AND Status <> 99 AND Type NOT IN (200)
),
HourlySummary AS (
  SELECT
    DATEPART(DAY,  b.ActivityOn) AS TIMEDAY,
    DATEPART(HOUR, b.ActivityOn) AS TIMEHOUR,
    CAST(
      CAST(CAST(b.ActivityOn AS DATE) AS VARCHAR) + ' ' +
      CAST(DATEPART(HOUR, b.ActivityOn) AS VARCHAR) + ':00:00'
    AS DATETIME) AS HourTime,
    COUNT(*) AS Loading_Count
  FROM Psno
  JOIN ProcessActivity b ON b.PSNo        = Psno.DocNo
  JOIN WorkCenter c      ON b.StationCode = c.StationCode
  JOIN Material m        ON Psno.Material = m.MatCode
  JOIN Users u           ON b.Operator    = u.UserCode
  WHERE
    c.StationCode = 1220002
    AND b.ActivityType = 5
    AND b.ActivityOn BETWEEN @StartTime AND @EndTime
  GROUP BY
    DATEPART(DAY,  b.ActivityOn),
    DATEPART(HOUR, b.ActivityOn),
    CAST(
      CAST(CAST(b.ActivityOn AS DATE) AS VARCHAR) + ' ' +
      CAST(DATEPART(HOUR, b.ActivityOn) AS VARCHAR) + ':00:00'
    AS DATETIME)
)
SELECT
  CONCAT('H', ROW_NUMBER() OVER (ORDER BY HourTime)) AS HOUR_NUMBER,
  TIMEHOUR,
  Loading_Count AS COUNT
FROM HourlySummary
ORDER BY HourTime;`;

  try {
    const data = await runTimeQuery(query, StartTime, EndTime);
    res.status(200).json({
      success: true,
      message: "Foaming HP FOM B hourly loading data fetched successfully",
      data,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Foaming HP FOM B hourly loading data: ${error.message}`,
      500,
    );
  }
});

export const getFoamingHpFomCat = tryCatch(async (req, res) => {
  const { StartTime, EndTime } = req.query;

  const query = `
WITH Psno AS (
  SELECT DocNo, Material, Serial, VSerial, Alias
  FROM MaterialBarcode
  WHERE PrintStatus = 1 AND Status <> 99 AND Type NOT IN (200)
)
SELECT
  ISNULL(mc.Alias, 'N/A') AS category,
  COUNT(*) AS TotalCount
FROM Psno
JOIN ProcessActivity b   ON b.PSNo         = Psno.DocNo
JOIN WorkCenter c        ON b.StationCode  = c.StationCode
JOIN Users us            ON us.UserCode    = b.Operator
JOIN Material m          ON m.MatCode      = Psno.Material
LEFT JOIN MaterialCategory mc ON mc.CategoryCode = m.Category
WHERE
  b.ActivityType = 5
  AND c.StationCode IN (1220001, 1220002)
  AND b.ActivityOn BETWEEN @StartTime AND @EndTime
GROUP BY ISNULL(mc.Alias, 'N/A')
ORDER BY TotalCount DESC;`;

  try {
    const data = await runTimeQuery(query, StartTime, EndTime);
    res.status(200).json({
      success: true,
      message: "Foaming HP FOM CAT loading data fetched successfully",
      data,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Foaming HP FOM CAT loading data: ${error.message}`,
      500,
    );
  }
});
