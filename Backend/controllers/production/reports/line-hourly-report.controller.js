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
//  FINAL FG STAGE
// -----------------------------------------------------------------------------
export const getFinalFGFreezerHourlyReport = tryCatch(async (req, res) => {
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

export const getFinalFGChocolateHourlyReport = tryCatch(async (req, res) => {
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

export const getFinalFGVisiCoolerHourlyReport = tryCatch(async (req, res) => {
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

export const getFinalFGSUSHourlyReport = tryCatch(async (req, res) => {
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

export const getFinalFGLinePerformanceHourlyReport = tryCatch(
  async (req, res) => {
    const { StartTime, EndTime } = req.query;

    const query = `
    WITH Psno AS (
      SELECT
        DocNo,
        Material,
        Serial,
        VSerial,
        Alias
      FROM MaterialBarcode
      WHERE
        PrintStatus = 1
        AND Status <> 99
        AND Type NOT IN (200)
    ),
    ProductionData AS (
      SELECT
        CASE
          WHEN b.Remark = 12501 THEN 'Freezer'
          WHEN b.Remark = 12305 THEN 'Chocolate'
          WHEN b.Remark = 12605 THEN 'Visi Cooler'
          WHEN b.Remark = 12304 THEN 'SUS'
        END AS LineName
      FROM Psno
      INNER JOIN ProcessActivity b
        ON b.PSNo = Psno.DocNo
      INNER JOIN WorkCenter c
        ON b.StationCode = c.StationCode
      INNER JOIN Users us
        ON us.UserCode = b.Operator
      INNER JOIN Material m
        ON m.MatCode = Psno.Material
      WHERE
        b.ActivityType = 5
        AND b.Remark IN (12501, 12305, 12605, 12304)
        AND c.StationCode IN (1220010, 1230017)
        AND b.ActivityOn BETWEEN @StartTime AND @EndTime
    )
    SELECT
      LineName,
      COUNT(*) AS TotalCount
    FROM ProductionData
    WHERE LineName IS NOT NULL
    GROUP BY LineName
    ORDER BY
      CASE LineName
        WHEN 'Freezer' THEN 1
        WHEN 'Chocolate' THEN 2
        WHEN 'Visi Cooler' THEN 3
        WHEN 'SUS' THEN 4
        ELSE 5
      END;
  `;

    const result = await runTimeQuery(query, StartTime, EndTime);

    res.status(200).json({
      success: true,
      message: "Final HP Line Performance fetched successfully",
      data: result,
    });
  },
);

// -----------------------------------------------------------------------------
//  FINAL LOADING STAGE
// -----------------------------------------------------------------------------
export const getFinalLoadingFreezerHourlyReport = tryCatch(async (req, res) => {
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

export const getFinalLoadingChocolateHourlyReport = tryCatch(
  async (req, res) => {
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
  },
);

export const getFinalLoadingVisiCoolerHourlyReport = tryCatch(
  async (req, res) => {
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
  },
);

export const getFinalLoadingSUSHourlyReport = tryCatch(async (req, res) => {
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

export const getFinalLoadingLinePerformanceHourlyReport = tryCatch(
  async (req, res) => {
    const { StartTime, EndTime } = req.query;

    const query = `
    WITH Psno AS (
      SELECT
        DocNo,
        Material,
        Serial,
        VSerial,
        Alias
      FROM MaterialBarcode
      WHERE
        PrintStatus = 1
        AND Status <> 99
        AND Type NOT IN (200)
    ),
    ProductionData AS (
      SELECT
        CASE
          WHEN b.Remark = 12501 THEN 'Freezer'
          WHEN b.Remark = 12305 THEN 'Chocolate'
          WHEN b.Remark = 12605 THEN 'Visi Cooler'
          WHEN b.Remark = 12304 THEN 'SUS'
        END AS LineName
      FROM Psno
      INNER JOIN ProcessActivity b
        ON b.PSNo = Psno.DocNo
      INNER JOIN WorkCenter c
        ON b.StationCode = c.StationCode
      INNER JOIN Users us
        ON us.UserCode = b.Operator
      INNER JOIN Material m
        ON m.MatCode = Psno.Material
      WHERE
        b.ActivityType = 5
        AND b.Remark IN (12501, 12305, 12605, 12304)
        AND c.StationCode IN (1230013, 1220005)
        AND b.ActivityOn BETWEEN @StartTime AND @EndTime
    )
    SELECT
      LineName,
      COUNT(*) AS TotalCount
    FROM ProductionData
    WHERE LineName IS NOT NULL
    GROUP BY LineName
    ORDER BY
      CASE LineName
        WHEN 'Freezer' THEN 1
        WHEN 'Chocolate' THEN 2
        WHEN 'Visi Cooler' THEN 3
        WHEN 'SUS' THEN 4
        ELSE 5
      END;
  `;

    const result = await runTimeQuery(query, StartTime, EndTime);

    res.status(200).json({
      success: true,
      message: "Final Loading HP Line Performance fetched successfully",
      data: result,
    });
  },
);

// -----------------------------------------------------------------------------
//  POST FOAMING STAGE
// -----------------------------------------------------------------------------
export const getPostFoamingGroupAFreezerHourlyReport = tryCatch(
  async (req, res) => {
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
  },
);

export const getPostFoamingGroupBFreezerHourlyReport = tryCatch(
  async (req, res) => {
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
  },
);

export const getPostFoamingFreezerFOWHourlyReport = tryCatch(
  async (req, res) => {
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
  },
);

export const getPostFoamingChocolateHourlyReport = tryCatch(
  async (req, res) => {
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
  },
);

export const getPostFoamingVisiCoolerHourlyReport = tryCatch(
  async (req, res) => {
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
  },
);

export const getPostFoamingSUSHourlyReport = tryCatch(async (req, res) => {
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

export const getPostFoamingLinePerformanceHourlyReport = tryCatch(
  async (req, res) => {
    const { StartTime, EndTime } = req.query;

    const query = `
    WITH Psno AS (
      SELECT
        DocNo,
        Material,
        Serial,
        VSerial,
        Alias,
        Type
      FROM MaterialBarcode
      WHERE
        PrintStatus = 1
        AND Status <> 99
        AND Type NOT IN (200)
    ),
    ProductionData AS (
      SELECT
        CASE
          -- Freezer: Post Foaming Group A and Group B
          WHEN b.StationCode IN (1220003, 1220004)
            THEN 'Freezer'

          -- Freezer: FOW Post Foaming
          WHEN b.StationCode = 1230007
            AND b.Remark = 12201
            THEN 'Freezer'

          -- Other Post Foaming categories
          WHEN b.Remark = 12305 THEN 'Chocolate'
          WHEN b.Remark = 12605 THEN 'Visi Cooler'
          WHEN b.Remark = 12304 THEN 'SUS'
        END AS LineName

      FROM Psno
      INNER JOIN ProcessActivity b
        ON b.PSNo = Psno.DocNo
      INNER JOIN WorkCenter c
        ON b.StationCode = c.StationCode
      INNER JOIN Users us
        ON us.UserCode = b.Operator
      INNER JOIN Material m
        ON m.MatCode = Psno.Material

      WHERE
        b.ActivityOn BETWEEN @StartTime AND @EndTime
        AND (
          -- Freezer Group A + Group B
          (
            b.StationCode IN (1220003, 1220004)
            AND b.ActivityType = 5
          )

          OR

          -- FOW Post Foaming
          (
            b.StationCode = 1230007
            AND b.Remark = 12201
          )

          OR

          -- Chocolate, Visi Cooler and SUS
          (
            b.ActivityType = 5
            AND b.StationCode IN (1230007, 1230012)
            AND b.Remark IN (12305, 12605, 12304)
          )
        )
    )

    SELECT
      LineName,
      COUNT(*) AS TotalCount
    FROM ProductionData
    WHERE LineName IS NOT NULL
    GROUP BY LineName
    ORDER BY
      CASE LineName
        WHEN 'Freezer' THEN 1
        WHEN 'Chocolate' THEN 2
        WHEN 'Visi Cooler' THEN 3
        WHEN 'SUS' THEN 4
        ELSE 5
      END;
  `;

    const result = await runTimeQuery(query, StartTime, EndTime);

    res.status(200).json({
      success: true,
      message: "Post Foaming HP Line Performance fetched successfully",
      data: result,
    });
  },
);

// -----------------------------------------------------------------------------
//  FOAMING STAGE
// -----------------------------------------------------------------------------
export const getFoamingGroupAFreezerHourlyReport = tryCatch(
  async (req, res) => {
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
  },
);

export const getFoamingGroupBFreezerHourlyReport = tryCatch(
  async (req, res) => {
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
  },
);

export const getFoamingLinePerformanceHourlyReport = tryCatch(
  async (req, res) => {
    const { StartTime, EndTime } = req.query;

    const query = `
    WITH Psno AS (
      SELECT
        DocNo,
        Material,
        Serial,
        VSerial,
        Alias
      FROM MaterialBarcode
      WHERE
        PrintStatus = 1
        AND Status <> 99
        AND Type NOT IN (200)
    ),
    ProductionData AS (
      SELECT
        'Freezer' AS LineName
      FROM Psno
      INNER JOIN ProcessActivity b
        ON b.PSNo = Psno.DocNo
      INNER JOIN WorkCenter c
        ON b.StationCode = c.StationCode
      INNER JOIN Users us
        ON us.UserCode = b.Operator
      INNER JOIN Material m
        ON m.MatCode = Psno.Material
      WHERE
        b.ActivityType = 5
        AND b.StationCode IN (1220001, 1220002)
        AND b.ActivityOn BETWEEN @StartTime AND @EndTime
    )
    SELECT
      LineName,
      COUNT(*) AS TotalCount
    FROM ProductionData
    GROUP BY LineName;
  `;

    const result = await runTimeQuery(query, StartTime, EndTime);

    res.status(200).json({
      success: true,
      message: "Foaming HP Line Performance fetched successfully",
      data: result,
    });
  },
);
