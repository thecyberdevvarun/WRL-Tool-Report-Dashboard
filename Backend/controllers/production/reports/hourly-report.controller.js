import sql from "mssql";
import { dbConfig1 } from "../../../config/db.config.js";
import { tryCatch } from "../../../utils/try-catch.js";
import { AppError } from "../../../utils/app-error.js";
import { convertToIST } from "../../../utils/convert-to-ist.js";

// ─── Shared DB Helper ─────────────────────────────────────────────────────────

/**
 * Opens a pooled connection, runs queryFn, closes the pool, returns the recordset.
 */
const runQuery = async (queryFn) => {
  const pool = await new sql.ConnectionPool(dbConfig1).connect();
  try {
    return await queryFn(pool);
  } catch (err) {
    throw new AppError(`Database error: ${err.message}`, 500);
  } finally {
    await pool.close();
  }
};

// ─── Param Helpers ────────────────────────────────────────────────────────────

/**
 * Parses a comma-separated string of integers into an array of numbers.
 * e.g. "12301,12302" → [12301, 12302]
 */
const parseIntList = (str) =>
  String(str)
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n));

/**
 * Validates that all required query params are present and non-empty.
 * Throws AppError (400) on failure.
 */
const validateParams = (stationCode, startDate, endDate, linecode) => {
  if (!stationCode || !startDate || !endDate || !linecode) {
    throw new AppError(
      "Missing required parameters: stationCode, startDate, endDate, linecode.",
      400
    );
  }
};

/**
 * Binds multiple integer values to a request as @param0, @param1, … and
 * returns an IN-clause fragment: "IN (@param0, @param1, …)".
 *
 * @param {sql.Request} req   - mssql Request object (mutated in place)
 * @param {string}      name  - Logical name (used as prefix for SQL params)
 * @param {number[]}    values
 * @returns {string} SQL IN clause, e.g. "IN (@stationCode0, @stationCode1)"
 */
const bindIntList = (req, name, values) => {
  const placeholders = values.map((val, i) => {
    req.input(`${name}${i}`, sql.Int, val);
    return `@${name}${i}`;
  });
  return `IN (${placeholders.join(", ")})`;
};

// ─── Shared Query Builder ─────────────────────────────────────────────────────

/**
 * Builds the common CTE + WHERE clause used by all three endpoints.
 * The SELECT projection differs per endpoint, so it is passed in as `selectClause`.
 *
 * @param {object} opts
 * @param {string}   opts.selectClause   - The SELECT … FROM … JOIN … part after the CTE
 * @param {string}   opts.groupByClause  - GROUP BY columns
 * @param {string}   opts.orderByClause  - ORDER BY columns
 * @param {string}   opts.stationInClause - SQL IN fragment for stationCode
 * @param {string}   opts.linecodeInClause - SQL IN fragment for linecode
 * @param {boolean}  opts.hasModel
 */
const buildCoreQuery = ({
  selectClause,
  groupByClause,
  orderByClause,
  stationInClause,
  linecodeInClause,
  hasModel,
}) => `
  WITH Psno AS (
    SELECT DocNo, Material, Serial, VSerial, Alias, Type
    FROM   MaterialBarcode
    WHERE  PrintStatus = 1
      AND  Status <> 99
      AND  Type NOT IN (200)
  )
  ${selectClause}
  WHERE  c.StationCode ${stationInClause}
    AND  b.ActivityType = 5
    AND  b.ActivityOn BETWEEN @startDate AND @endDate
    ${hasModel ? "AND Psno.Material = @model" : ""}
    AND  b.remark ${linecodeInClause}
  GROUP BY ${groupByClause}
  ORDER BY ${orderByClause}
`;

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /prod/hourly-summary
 * Returns total production count grouped by hour.
 *
 * Supports comma-separated stationCode and linecode values
 * (e.g. stationCode=1220003,1220004&linecode=12301,12302).
 */
export const getHourlySummary = tryCatch(async (req, res) => {
  const { stationCode, startDate, endDate, model, linecode } = req.query;
  validateParams(stationCode, startDate, endDate, linecode);

  const stationCodes = parseIntList(stationCode);
  const linecodes    = parseIntList(linecode);
  const istStart     = convertToIST(startDate);
  const istEnd       = convertToIST(endDate);
  const hasModel     = Boolean(model && model !== "0");

  const data = await runQuery(async (pool) => {
    const dbReq = pool.request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate",   sql.DateTime, istEnd);

    if (hasModel) dbReq.input("model", sql.VarChar, model);

    const stationInClause  = bindIntList(dbReq, "stationCode", stationCodes);
    const linecodeInClause = bindIntList(dbReq, "linecode",    linecodes);

    const query = `
      WITH Psno AS (
        SELECT DocNo, Material, Serial, VSerial, Alias, Type
        FROM   MaterialBarcode
        WHERE  PrintStatus = 1
          AND  Status <> 99
          AND  Type NOT IN (200)
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
        FROM   Psno
          JOIN ProcessActivity b  ON b.PSNo        = Psno.DocNo
          JOIN WorkCenter      c  ON b.StationCode = c.StationCode
          JOIN Material        m  ON Psno.Material = m.MatCode
          JOIN Users           u  ON b.Operator    = u.UserCode
        WHERE  c.StationCode ${stationInClause}
          AND  b.ActivityType = 5
          AND  b.ActivityOn BETWEEN @startDate AND @endDate
          ${hasModel ? "AND Psno.Material = @model" : ""}
          AND  b.remark ${linecodeInClause}
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
      FROM  HourlySummary
      ORDER BY HourTime;
    `;

    const result = await dbReq.query(query);
    return result.recordset;
  });

  res.status(200).json({
    success: true,
    message: "Hourly summary fetched successfully",
    data,
  });
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /prod/hourly-model-count
 * Returns production count grouped by hour + model variant.
 */
export const getHourlyModelCount = tryCatch(async (req, res) => {
  const { stationCode, startDate, endDate, model, linecode } = req.query;
  validateParams(stationCode, startDate, endDate, linecode);

  const stationCodes = parseIntList(stationCode);
  const linecodes    = parseIntList(linecode);
  const istStart     = convertToIST(startDate);
  const istEnd       = convertToIST(endDate);
  const hasModel     = Boolean(model && model !== "0");

  const data = await runQuery(async (pool) => {
    const dbReq = pool.request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate",   sql.DateTime, istEnd);

    if (hasModel) dbReq.input("model", sql.VarChar, model);

    const stationInClause  = bindIntList(dbReq, "stationCode", stationCodes);
    const linecodeInClause = bindIntList(dbReq, "linecode",    linecodes);

    const query = `
      WITH Psno AS (
        SELECT DocNo, Material, Serial, VSerial, Alias, Type
        FROM   MaterialBarcode
        WHERE  PrintStatus = 1
          AND  Status <> 99
          AND  Type NOT IN (200)
      ),
      HourlySummary AS (
        SELECT
          DATEPART(HOUR, b.ActivityOn) AS TIMEHOUR,
          m.Name                        AS Material_Name,
          COUNT(*)                      AS Loading_Count
        FROM   Psno
          JOIN ProcessActivity b  ON b.PSNo        = Psno.DocNo
          JOIN WorkCenter      c  ON b.StationCode = c.StationCode
          JOIN Material        m  ON Psno.Material = m.MatCode
          JOIN Users           u  ON b.Operator    = u.UserCode
        WHERE  c.StationCode ${stationInClause}
          AND  b.ActivityType = 5
          AND  b.ActivityOn BETWEEN @startDate AND @endDate
          ${hasModel ? "AND Psno.Material = @model" : ""}
          AND  b.remark ${linecodeInClause}
        GROUP BY
          DATEPART(HOUR, b.ActivityOn),
          m.Name
      )
      SELECT TIMEHOUR, Material_Name, Loading_Count AS COUNT
      FROM   HourlySummary
      ORDER  BY TIMEHOUR, Material_Name;
    `;

    const result = await dbReq.query(query);
    return result.recordset;
  });

  res.status(200).json({
    success: true,
    message: "Hourly model count fetched successfully",
    data,
  });
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /prod/hourly-category-count
 * Returns production count grouped by hour + product category.
 */
export const getHourlyCategoryCount = tryCatch(async (req, res) => {
  const { stationCode, startDate, endDate, model, linecode } = req.query;
  validateParams(stationCode, startDate, endDate, linecode);

  const stationCodes = parseIntList(stationCode);
  const linecodes    = parseIntList(linecode);
  const istStart     = convertToIST(startDate);
  const istEnd       = convertToIST(endDate);
  const hasModel     = Boolean(model && model !== "0");

  const data = await runQuery(async (pool) => {
    const dbReq = pool.request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate",   sql.DateTime, istEnd);

    if (hasModel) dbReq.input("model", sql.VarChar, model);

    const stationInClause  = bindIntList(dbReq, "stationCode", stationCodes);
    const linecodeInClause = bindIntList(dbReq, "linecode",    linecodes);

    const query = `
      WITH Psno AS (
        SELECT DocNo, Material, Serial, VSerial, Alias, Type
        FROM   MaterialBarcode
        WHERE  PrintStatus = 1
          AND  Status <> 99
          AND  Type NOT IN (200)
      ),
      HourlySummary AS (
        SELECT
          DATEPART(HOUR, b.ActivityOn)  AS TIMEHOUR,
          mc.Alias                       AS category,
          COUNT(*)                       AS Loading_Count
        FROM   Psno
          JOIN ProcessActivity  b   ON b.PSNo          = Psno.DocNo
          JOIN WorkCenter        c   ON b.StationCode   = c.StationCode
          JOIN Material          m   ON Psno.Material   = m.MatCode
          JOIN Users             u   ON b.Operator      = u.UserCode
          JOIN MaterialCategory  mc  ON mc.CategoryCode = m.Category
        WHERE  c.StationCode ${stationInClause}
          AND  b.ActivityType = 5
          AND  b.ActivityOn BETWEEN @startDate AND @endDate
          ${hasModel ? "AND Psno.Material = @model" : ""}
          AND  b.remark ${linecodeInClause}
        GROUP BY
          DATEPART(HOUR, b.ActivityOn),
          mc.Alias
      )
      SELECT TIMEHOUR, category, Loading_Count AS COUNT
      FROM   HourlySummary
      ORDER  BY TIMEHOUR, category;
    `;

    const result = await dbReq.query(query);
    return result.recordset;
  });

  res.status(200).json({
    success: true,
    message: "Hourly category count fetched successfully",
    data,
  });
});