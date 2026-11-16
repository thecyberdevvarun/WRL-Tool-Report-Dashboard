import sql from "mssql";
import { dbConfig1 } from "../../config/db.config.js";
import { tryCatch } from "../../utils/try-catch.js";
import { AppError } from "../../utils/app-error.js";
import { convertToIST } from "../../utils/convert-to-ist.js";

// Table name - adjust according to your database
const TABLE_NAME = "GasChargeDtls"; // Change this to your actual table name

// Helper function to get date ranges
const getDateRanges = {
  today: () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return { start, end };
  },
  yesterday: () => {
    const start = new Date();
    start.setDate(start.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setDate(end.getDate() - 1);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  },
  mtd: () => {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return { start, end };
  },
  lastWeek: () => {
    const start = new Date();
    start.setDate(start.getDate() - 7);
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return { start, end };
  },
};

/**
 * @desc    Get Gas Charging Report data with filters and pagination
 * @route   GET /api/v1/gas-charging/report
 */
export const getGasChargingReport = tryCatch(async (req, res) => {
  const {
    startDate,
    endDate,
    model,
    performance,
    refrigerant,
    machine,
    barcode,
    faultCode,
    page = 1,
    limit = 50,
  } = req.query;

  if (!startDate || !endDate) {
    throw new AppError(
      "Missing required query parameters: startDate or endDate.",
      400,
    );
  }

  const istStart = convertToIST(startDate);
  const istEnd = convertToIST(endDate);
  const offset = (parseInt(page) - 1) * parseInt(limit);

  // Build WHERE clause
  // DATE alone (matched with BETWEEN, inclusive both ends) ignored TIME
  // entirely, so a shift-window query like "today 08:00 -> tomorrow 08:00"
  // matched whole calendar days instead of the actual shift. Combining
  // DATE + TIME into one datetime and using a half-open range (>= start,
  // < end) filters by the real moment and avoids double-counting a record
  // that lands exactly on the boundary between two adjacent ranges.
  let whereClause = `WHERE
    TRY_CONVERT(datetime, DATE + ' ' + TIME, 105) >= @startDate
    AND TRY_CONVERT(datetime, DATE + ' ' + TIME, 105) < @endDate`;

  if (model) {
    whereClause += ` AND MODEL = @model`;
  }
  if (performance) {
    whereClause += ` AND PERFORMANCE = @performance`;
  }
  if (refrigerant) {
    whereClause += ` AND UPPER(REFRIGERANT) = UPPER(@refrigerant)`;
  }
  if (machine) {
    whereClause += ` AND MACHINE = @machine`;
  }
  if (barcode) {
    whereClause += ` AND BARCODE LIKE @barcode`;
  }
  if (faultCode) {
    whereClause += ` AND FaultCode = @faultCode`;
  }

  // Main data query
  const dataQuery = `
    SELECT 
      Result_ID,
      DATE,
      TIME,
      BARCODE,
      MODEL,
      MODELNAME,
      RUNTIME_SECONDS,
      REFRIGERANT,
      SET_GAS_WEIGHT,
      ACTUAL_GAS_WEIGHT,
      LEAK_SET_VALUE,
      LEAK_TEST_VALUE,
      LEAK_TEST_TIME,
      SET_EVACUATION_VALUE,
      ACTUAL_EVACUATION_VALUE,
      ACTUAL_EVACUATION_TIME,
      PERFORMANCE,
      FaultCode,
      FaultName,
      SyncStatus,
      MACHINE
    FROM ${TABLE_NAME}
    ${whereClause}
    ORDER BY TRY_CONVERT(datetime, DATE + ' ' + TIME, 105) DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `;

  // Count query
  const countQuery = `
    SELECT COUNT(*) as total
    FROM ${TABLE_NAME}
    ${whereClause}
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    // Data request
    const dataRequest = pool
      .request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate", sql.DateTime, istEnd)
      .input("offset", sql.Int, offset)
      .input("limit", sql.Int, parseInt(limit));

    // Count request
    const countRequest = pool
      .request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate", sql.DateTime, istEnd);

    // Add optional parameters to both requests
    if (model) {
      dataRequest.input("model", sql.VarChar, model);
      countRequest.input("model", sql.VarChar, model);
    }
    if (performance) {
      dataRequest.input("performance", sql.VarChar, performance);
      countRequest.input("performance", sql.VarChar, performance);
    }
    if (refrigerant) {
      dataRequest.input("refrigerant", sql.VarChar, refrigerant);
      countRequest.input("refrigerant", sql.VarChar, refrigerant);
    }
    if (machine) {
      dataRequest.input("machine", sql.VarChar, machine);
      countRequest.input("machine", sql.VarChar, machine);
    }
    if (barcode) {
      dataRequest.input("barcode", sql.VarChar, `%${barcode}%`);
      countRequest.input("barcode", sql.VarChar, `%${barcode}%`);
    }
    if (faultCode) {
      dataRequest.input("faultCode", sql.Int, parseInt(faultCode));
      countRequest.input("faultCode", sql.Int, parseInt(faultCode));
    }

    // Execute both queries
    const [dataResult, countResult] = await Promise.all([
      dataRequest.query(dataQuery),
      countRequest.query(countQuery),
    ]);

    const totalRecords = countResult.recordset[0]?.total || 0;
    const totalPages = Math.ceil(totalRecords / parseInt(limit));

    res.status(200).json({
      success: true,
      message: "Gas Charging Report data retrieved successfully.",
      data: dataResult.recordset,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalRecords,
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Gas Charging Report data: ${error.message}`,
      500,
    );
  } finally {
    await pool.close();
  }
});

/**
 * @desc    Get distinct models
 * @route   GET /api/v1/gas-charging/models
 */
export const getDistinctModels = tryCatch(async (req, res) => {
  // One row per model number, with its name. MAX() picks a single name if a model
  // number has ever been saved with more than one spelling.
  const query = `
    SELECT MODEL, MAX(MODELNAME) AS MODELNAME
    FROM ${TABLE_NAME}
    WHERE MODEL IS NOT NULL AND MODEL != ''
    GROUP BY MODEL
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool.request().query(query);
    const rows = result.recordset.map((item) => ({
      value: item.MODEL,
      name: (item.MODELNAME ?? "").toString().trim(),
    }));

    // Two model numbers can share one name → only then append the number, so the
    // options stay distinguishable. No name saved → fall back to the number.
    const nameCount = {};
    rows.forEach((r) => {
      if (r.name) {
        const k = r.name.toLowerCase();
        nameCount[k] = (nameCount[k] || 0) + 1;
      }
    });

    const options = rows
      .map((r) => ({
        ...r,
        label: !r.name
          ? r.value
          : nameCount[r.name.toLowerCase()] > 1
            ? `${r.name} (${r.value})`
            : r.name,
      }))
      // Named models first (A→Z); any model with no saved name goes to the end.
      .sort(
        (a, b) =>
          Number(!a.name) - Number(!b.name) ||
          a.label.localeCompare(b.label, undefined, {
            numeric: true,
            sensitivity: "base",
          }),
      );

    res.status(200).json({
      success: true,
      message: "Models retrieved successfully.",
      data: options.map((o) => o.value), // unchanged shape (model numbers), kept for compatibility
      models: options, // [{ value: MODEL, name: MODELNAME, label }] — used by the dropdown
    });
  } catch (error) {
    throw new AppError(`Failed to fetch models: ${error.message}`, 500);
  } finally {
    await pool.close();
  }
});

/**
 * @desc    Get distinct machines
 * @route   GET /api/v1/gas-charging/machines
 */
export const getDistinctMachines = tryCatch(async (req, res) => {
  const query = `
    SELECT DISTINCT MACHINE
    FROM ${TABLE_NAME}
    WHERE MACHINE IS NOT NULL AND MACHINE != ''
    ORDER BY MACHINE
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool.request().query(query);
    const machines = result.recordset.map((item) => item.MACHINE);

    res.status(200).json({
      success: true,
      message: "Machines retrieved successfully.",
      data: machines,
    });
  } catch (error) {
    throw new AppError(`Failed to fetch machines: ${error.message}`, 500);
  } finally {
    await pool.close();
  }
});

/**
 * @desc    Get distinct refrigerants
 * @route   GET /api/v1/gas-charging/refrigerants
 */
export const getDistinctRefrigerants = tryCatch(async (req, res) => {
  const query = `
    SELECT DISTINCT REFRIGERANT
    FROM ${TABLE_NAME}
    WHERE REFRIGERANT IS NOT NULL AND REFRIGERANT != ''
    ORDER BY REFRIGERANT
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool.request().query(query);
    const refrigerants = result.recordset.map((item) => item.REFRIGERANT);

    res.status(200).json({
      success: true,
      message: "Refrigerants retrieved successfully.",
      data: refrigerants,
    });
  } catch (error) {
    throw new AppError(`Failed to fetch refrigerants: ${error.message}`, 500);
  } finally {
    await pool.close();
  }
});

/**
 * @desc    Quick filter (today, yesterday, mtd, lastWeek)
 * @route   GET /api/v1/gas-charging/quick/:filter
 */
export const getGasChargingQuickFilter = tryCatch(async (req, res) => {
  const { filter } = req.params;
  const { model, machine, performance } = req.query;

  if (!["today", "yesterday", "mtd", "lastWeek"].includes(filter)) {
    throw new AppError(
      "Invalid filter. Use 'today', 'yesterday', 'mtd', or 'lastWeek'.",
      400,
    );
  }

  const { start, end } = getDateRanges[filter]();
  const istStart = convertToIST(start);
  const istEnd = convertToIST(end);

  let whereClause = `WHERE 
    (
      TRY_CONVERT(datetime, DATE, 106) BETWEEN @startDate AND @endDate
      OR TRY_CONVERT(datetime, DATE, 105) BETWEEN @startDate AND @endDate
      OR TRY_CAST(DATE AS datetime) BETWEEN @startDate AND @endDate
    )`;

  if (model) whereClause += ` AND MODEL = @model`;
  if (machine) whereClause += ` AND MACHINE = @machine`;
  if (performance) whereClause += ` AND PERFORMANCE = @performance`;

  const query = `
    SELECT 
      Result_ID, DATE, TIME, BARCODE, MODEL, MODELNAME,
      RUNTIME_SECONDS, REFRIGERANT, SET_GAS_WEIGHT, ACTUAL_GAS_WEIGHT,
      LEAK_SET_VALUE, LEAK_TEST_VALUE, LEAK_TEST_TIME,
      SET_EVACUATION_VALUE, ACTUAL_EVACUATION_VALUE, ACTUAL_EVACUATION_TIME,
      PERFORMANCE, FaultCode, FaultName, SyncStatus, MACHINE
    FROM ${TABLE_NAME}
    ${whereClause}
    ORDER BY Result_ID DESC
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const request = pool
      .request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate", sql.DateTime, istEnd);

    if (model) request.input("model", sql.VarChar, model);
    if (machine) request.input("machine", sql.VarChar, machine);
    if (performance) request.input("performance", sql.VarChar, performance);

    const dataResult = await request.query(query);

    res.status(200).json({
      success: true,
      message: `Gas Charging data for ${filter} retrieved successfully.`,
      filter,
      dateRange: { start: start.toISOString(), end: end.toISOString() },
      count: dataResult.recordset.length,
      data: dataResult.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Gas Charging data: ${error.message}`,
      500,
    );
  } finally {
    await pool.close();
  }
});

/**
 * @desc    Get Gas Charging by Result ID
 * @route   GET /api/v1/gas-charging/detail/:id
 */
export const getGasChargingById = tryCatch(async (req, res) => {
  const { id } = req.params;

  if (!id) {
    throw new AppError("Result ID is required.", 400);
  }

  const query = `SELECT * FROM ${TABLE_NAME} WHERE Result_ID = @id`;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool
      .request()
      .input("id", sql.Int, parseInt(id))
      .query(query);

    if (result.recordset.length === 0) {
      throw new AppError(`No record found with Result_ID: ${id}`, 404);
    }

    res.status(200).json({
      success: true,
      message: "Gas Charging record retrieved successfully.",
      data: result.recordset[0],
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      `Failed to fetch Gas Charging record: ${error.message}`,
      500,
    );
  } finally {
    await pool.close();
  }
});

/**
 * @desc    Export Gas Charging Report
 * @route   GET /api/v1/gas-charging/export
 */
export const exportGasChargingReport = tryCatch(async (req, res) => {
  const { startDate, endDate, model, performance, refrigerant, machine } =
    req.query;

  if (!startDate || !endDate) {
    throw new AppError(
      "Missing required query parameters: startDate or endDate.",
      400,
    );
  }

  const istStart = convertToIST(startDate);
  const istEnd = convertToIST(endDate);

  let whereClause = `WHERE 
    (
      TRY_CONVERT(datetime, DATE, 106) BETWEEN @startDate AND @endDate
      OR TRY_CONVERT(datetime, DATE, 105) BETWEEN @startDate AND @endDate
      OR TRY_CAST(DATE AS datetime) BETWEEN @startDate AND @endDate
    )`;

  if (model) whereClause += ` AND MODEL = @model`;
  if (performance) whereClause += ` AND PERFORMANCE = @performance`;
  if (refrigerant)
    whereClause += ` AND UPPER(REFRIGERANT) = UPPER(@refrigerant)`;
  if (machine) whereClause += ` AND MACHINE = @machine`;

  const query = `
    SELECT 
      Result_ID AS 'Result ID',
      DATE AS 'Date',
      TIME AS 'Time',
      BARCODE AS 'Barcode',
      MODEL AS 'Model',
      MODELNAME AS 'Model Name',
      RUNTIME_SECONDS AS 'Runtime (s)',
      REFRIGERANT AS 'Refrigerant',
      SET_GAS_WEIGHT AS 'Set Gas Weight',
      ACTUAL_GAS_WEIGHT AS 'Actual Gas Weight',
      LEAK_SET_VALUE AS 'Leak Set Value',
      LEAK_TEST_VALUE AS 'Leak Test Value',
      LEAK_TEST_TIME AS 'Leak Test Time',
      SET_EVACUATION_VALUE AS 'Set Evacuation Value',
      ACTUAL_EVACUATION_VALUE AS 'Actual Evacuation Value',
      ACTUAL_EVACUATION_TIME AS 'Evacuation Time',
      PERFORMANCE AS 'Result',
      FaultCode AS 'Fault Code',
      FaultName AS 'Fault Name',
      MACHINE AS 'Machine',
      SyncStatus AS 'Sync Status'
    FROM ${TABLE_NAME}
    ${whereClause}
    ORDER BY Result_ID DESC
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const request = pool
      .request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate", sql.DateTime, istEnd);

    if (model) request.input("model", sql.VarChar, model);
    if (performance) request.input("performance", sql.VarChar, performance);
    if (refrigerant) request.input("refrigerant", sql.VarChar, refrigerant);
    if (machine) request.input("machine", sql.VarChar, machine);

    const dataResult = await request.query(query);

    res.status(200).json({
      success: true,
      message: "Export data retrieved successfully.",
      count: dataResult.recordset.length,
      data: dataResult.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to export Gas Charging data: ${error.message}`,
      500,
    );
  } finally {
    await pool.close();
  }
});

/**
 * @desc    Get Model-wise Statistics
 * @route   GET /api/v1/gas-charging/model-stats
 */
export const getModelWiseStats = tryCatch(async (req, res) => {
  const { startDate, endDate, machine } = req.query;

  if (!startDate || !endDate) {
    throw new AppError(
      "Missing required query parameters: startDate or endDate.",
      400,
    );
  }

  const istStart = convertToIST(startDate);
  const istEnd = convertToIST(endDate);

  let whereClause = `WHERE 
    (
      TRY_CONVERT(datetime, DATE, 106) BETWEEN @startDate AND @endDate
      OR TRY_CONVERT(datetime, DATE, 105) BETWEEN @startDate AND @endDate
      OR TRY_CAST(DATE AS datetime) BETWEEN @startDate AND @endDate
    )`;

  if (machine) {
    whereClause += ` AND MACHINE = @machine`;
  }

  const query = `
    SELECT 
      MODEL,
      MODELNAME,
      COUNT(*) as totalTests,
      SUM(CASE WHEN PERFORMANCE = 'PASS' THEN 1 ELSE 0 END) as passCount,
      SUM(CASE WHEN PERFORMANCE = 'FAIL' THEN 1 ELSE 0 END) as failCount,
      CAST(SUM(CASE WHEN PERFORMANCE = 'PASS' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) AS DECIMAL(5,2)) as passRate,
      AVG(TRY_CAST(
        REPLACE(REPLACE(REPLACE(ACTUAL_GAS_WEIGHT, ' g', ''), 'g', ''), ' ', '') 
        AS DECIMAL(10,2)
      )) as avgGasWeight
    FROM ${TABLE_NAME}
    ${whereClause}
    GROUP BY MODEL, MODELNAME
    ORDER BY totalTests DESC
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const request = pool
      .request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate", sql.DateTime, istEnd);

    if (machine) {
      request.input("machine", sql.VarChar, machine);
    }

    const result = await request.query(query);

    res.status(200).json({
      success: true,
      message: "Model-wise statistics retrieved successfully.",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch model-wise statistics: ${error.message}`,
      500,
    );
  } finally {
    await pool.close();
  }
});

/**
 * @desc    Get Machine-wise Statistics
 * @route   GET /api/v1/gas-charging/machine-stats
 */
export const getMachineWiseStats = tryCatch(async (req, res) => {
  const { startDate, endDate, model } = req.query;

  if (!startDate || !endDate) {
    throw new AppError(
      "Missing required query parameters: startDate or endDate.",
      400,
    );
  }

  const istStart = convertToIST(startDate);
  const istEnd = convertToIST(endDate);

  let whereClause = `WHERE 
    (
      TRY_CONVERT(datetime, DATE, 106) BETWEEN @startDate AND @endDate
      OR TRY_CONVERT(datetime, DATE, 105) BETWEEN @startDate AND @endDate
      OR TRY_CAST(DATE AS datetime) BETWEEN @startDate AND @endDate
    )`;

  if (model) {
    whereClause += ` AND MODEL = @model`;
  }

  const query = `
    SELECT 
      MACHINE,
      COUNT(*) as totalTests,
      SUM(CASE WHEN PERFORMANCE = 'PASS' THEN 1 ELSE 0 END) as passCount,
      SUM(CASE WHEN PERFORMANCE = 'FAIL' THEN 1 ELSE 0 END) as failCount,
      CAST(SUM(CASE WHEN PERFORMANCE = 'PASS' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) AS DECIMAL(5,2)) as passRate,
      COUNT(DISTINCT MODEL) as uniqueModels
    FROM ${TABLE_NAME}
    ${whereClause}
    GROUP BY MACHINE
    ORDER BY totalTests DESC
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const request = pool
      .request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate", sql.DateTime, istEnd);

    if (model) {
      request.input("model", sql.VarChar, model);
    }

    const result = await request.query(query);

    res.status(200).json({
      success: true,
      message: "Machine-wise statistics retrieved successfully.",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch machine-wise statistics: ${error.message}`,
      500,
    );
  } finally {
    await pool.close();
  }
});

/**
 * @desc    Get Daily Trend
 * @route   GET /api/v1/gas-charging/daily-trend
 */
export const getDailyTrend = tryCatch(async (req, res) => {
  const { startDate, endDate, model, machine } = req.query;

  if (!startDate || !endDate) {
    throw new AppError(
      "Missing required query parameters: startDate or endDate.",
      400,
    );
  }

  const istStart = convertToIST(startDate);
  const istEnd = convertToIST(endDate);

  let whereClause = `WHERE 
    (
      TRY_CONVERT(datetime, DATE, 106) BETWEEN @startDate AND @endDate
      OR TRY_CONVERT(datetime, DATE, 105) BETWEEN @startDate AND @endDate
      OR TRY_CAST(DATE AS datetime) BETWEEN @startDate AND @endDate
    )`;

  if (model) whereClause += ` AND MODEL = @model`;
  if (machine) whereClause += ` AND MACHINE = @machine`;

  const query = `
    SELECT 
      DATE as date,
      COUNT(*) as totalTests,
      SUM(CASE WHEN PERFORMANCE = 'PASS' THEN 1 ELSE 0 END) as passCount,
      SUM(CASE WHEN PERFORMANCE = 'FAIL' THEN 1 ELSE 0 END) as failCount,
      CAST(SUM(CASE WHEN PERFORMANCE = 'PASS' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) AS DECIMAL(5,2)) as passRate
    FROM ${TABLE_NAME}
    ${whereClause}
    GROUP BY DATE
    ORDER BY DATE
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const request = pool
      .request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate", sql.DateTime, istEnd);

    if (model) request.input("model", sql.VarChar, model);
    if (machine) request.input("machine", sql.VarChar, machine);

    const result = await request.query(query);

    res.status(200).json({
      success: true,
      message: "Daily trend data retrieved successfully.",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch daily trend data: ${error.message}`,
      500,
    );
  } finally {
    await pool.close();
  }
});

/**
 * @desc    Get Hourly Trend
 * @route   GET /api/v1/gas-charging/hourly-trend
 */
export const getHourlyTrend = tryCatch(async (req, res) => {
  const { startDate, endDate, model, machine } = req.query;

  if (!startDate || !endDate) {
    throw new AppError(
      "Missing required query parameters: startDate or endDate.",
      400,
    );
  }

  const istStart = convertToIST(startDate);
  const istEnd = convertToIST(endDate);

  let whereClause = `WHERE 
    (
      TRY_CONVERT(datetime, DATE, 106) BETWEEN @startDate AND @endDate
      OR TRY_CONVERT(datetime, DATE, 105) BETWEEN @startDate AND @endDate
      OR TRY_CAST(DATE AS datetime) BETWEEN @startDate AND @endDate
    )`;

  if (model) whereClause += ` AND MODEL = @model`;
  if (machine) whereClause += ` AND MACHINE = @machine`;

  const query = `
    SELECT 
      DATEPART(HOUR, TRY_CAST(TIME AS TIME)) as hour,
      COUNT(*) as totalTests,
      SUM(CASE WHEN PERFORMANCE = 'PASS' THEN 1 ELSE 0 END) as passCount,
      SUM(CASE WHEN PERFORMANCE = 'FAIL' THEN 1 ELSE 0 END) as failCount
    FROM ${TABLE_NAME}
    ${whereClause}
    GROUP BY DATEPART(HOUR, TRY_CAST(TIME AS TIME))
    ORDER BY hour
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const request = pool
      .request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate", sql.DateTime, istEnd);

    if (model) request.input("model", sql.VarChar, model);
    if (machine) request.input("machine", sql.VarChar, machine);

    const result = await request.query(query);

    res.status(200).json({
      success: true,
      message: "Hourly trend data retrieved successfully.",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch hourly trend data: ${error.message}`,
      500,
    );
  } finally {
    await pool.close();
  }
});

/**
 * @desc    Get Failed Records
 * @route   GET /api/v1/gas-charging/failures
 */
export const getFailedRecords = tryCatch(async (req, res) => {
  const {
    startDate,
    endDate,
    model,
    machine,
    faultCode,
    page = 1,
    limit = 50,
  } = req.query;

  if (!startDate || !endDate) {
    throw new AppError(
      "Missing required query parameters: startDate or endDate.",
      400,
    );
  }

  const istStart = convertToIST(startDate);
  const istEnd = convertToIST(endDate);
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let whereClause = `WHERE 
    (
      TRY_CONVERT(datetime, DATE, 106) BETWEEN @startDate AND @endDate
      OR TRY_CONVERT(datetime, DATE, 105) BETWEEN @startDate AND @endDate
      OR TRY_CAST(DATE AS datetime) BETWEEN @startDate AND @endDate
    )
    AND PERFORMANCE = 'FAIL'`;

  if (model) whereClause += ` AND MODEL = @model`;
  if (machine) whereClause += ` AND MACHINE = @machine`;
  if (faultCode) whereClause += ` AND FaultCode = @faultCode`;

  const query = `
    SELECT 
      Result_ID, DATE, TIME, BARCODE, MODEL, MODELNAME,
      REFRIGERANT, SET_GAS_WEIGHT, ACTUAL_GAS_WEIGHT,
      LEAK_SET_VALUE, LEAK_TEST_VALUE,
      SET_EVACUATION_VALUE, ACTUAL_EVACUATION_VALUE,
      PERFORMANCE, FaultCode, FaultName, MACHINE
    FROM ${TABLE_NAME}
    ${whereClause}
    ORDER BY Result_ID DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `;

  const countQuery = `
    SELECT COUNT(*) as total
    FROM ${TABLE_NAME}
    ${whereClause}
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const request = pool
      .request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate", sql.DateTime, istEnd)
      .input("offset", sql.Int, offset)
      .input("limit", sql.Int, parseInt(limit));

    const countRequest = pool
      .request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate", sql.DateTime, istEnd);

    if (model) {
      request.input("model", sql.VarChar, model);
      countRequest.input("model", sql.VarChar, model);
    }
    if (machine) {
      request.input("machine", sql.VarChar, machine);
      countRequest.input("machine", sql.VarChar, machine);
    }
    if (faultCode) {
      request.input("faultCode", sql.Int, parseInt(faultCode));
      countRequest.input("faultCode", sql.Int, parseInt(faultCode));
    }

    const [dataResult, countResult] = await Promise.all([
      request.query(query),
      countRequest.query(countQuery),
    ]);

    const totalRecords = countResult.recordset[0]?.total || 0;

    res.status(200).json({
      success: true,
      message: "Failed records retrieved successfully.",
      count: dataResult.recordset.length,
      totalRecords,
      data: dataResult.recordset,
    });
  } catch (error) {
    throw new AppError(`Failed to fetch failed records: ${error.message}`, 500);
  } finally {
    await pool.close();
  }
});

/**
 * @desc    Get Refrigerant-wise Statistics
 * @route   GET /api/v1/gas-charging/refrigerant-stats
 */
export const getRefrigerantWiseStats = tryCatch(async (req, res) => {
  const { startDate, endDate, machine } = req.query;

  if (!startDate || !endDate) {
    throw new AppError(
      "Missing required query parameters: startDate or endDate.",
      400,
    );
  }

  const istStart = convertToIST(startDate);
  const istEnd = convertToIST(endDate);

  let whereClause = `WHERE 
    (
      TRY_CONVERT(datetime, DATE, 106) BETWEEN @startDate AND @endDate
      OR TRY_CONVERT(datetime, DATE, 105) BETWEEN @startDate AND @endDate
      OR TRY_CAST(DATE AS datetime) BETWEEN @startDate AND @endDate
    )`;

  if (machine) {
    whereClause += ` AND MACHINE = @machine`;
  }

  const query = `
    SELECT 
      UPPER(REFRIGERANT) as refrigerant,
      COUNT(*) as totalTests,
      SUM(CASE WHEN PERFORMANCE = 'PASS' THEN 1 ELSE 0 END) as passCount,
      SUM(CASE WHEN PERFORMANCE = 'FAIL' THEN 1 ELSE 0 END) as failCount,
      CAST(SUM(CASE WHEN PERFORMANCE = 'PASS' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) AS DECIMAL(5,2)) as passRate,
      COUNT(DISTINCT MODEL) as uniqueModels
    FROM ${TABLE_NAME}
    ${whereClause}
    GROUP BY UPPER(REFRIGERANT)
    ORDER BY totalTests DESC
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const request = pool
      .request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate", sql.DateTime, istEnd);

    if (machine) {
      request.input("machine", sql.VarChar, machine);
    }

    const result = await request.query(query);

    res.status(200).json({
      success: true,
      message: "Refrigerant-wise statistics retrieved successfully.",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch refrigerant-wise statistics: ${error.message}`,
      500,
    );
  } finally {
    await pool.close();
  }
});

/**
 * @desc    Get Gas Weight Analysis
 * @route   GET /api/v1/gas-charging/weight-analysis
 */
export const getGasWeightAnalysis = tryCatch(async (req, res) => {
  const { startDate, endDate, model, machine } = req.query;

  if (!startDate || !endDate) {
    throw new AppError(
      "Missing required query parameters: startDate or endDate.",
      400,
    );
  }

  const istStart = convertToIST(startDate);
  const istEnd = convertToIST(endDate);

  let whereClause = `WHERE 
    (
      TRY_CONVERT(datetime, DATE, 106) BETWEEN @startDate AND @endDate
      OR TRY_CONVERT(datetime, DATE, 105) BETWEEN @startDate AND @endDate
      OR TRY_CAST(DATE AS datetime) BETWEEN @startDate AND @endDate
    )`;

  if (model) whereClause += ` AND MODEL = @model`;
  if (machine) whereClause += ` AND MACHINE = @machine`;

  const query = `
    SELECT 
      MODEL,
      AVG(TRY_CAST(
        REPLACE(REPLACE(REPLACE(SET_GAS_WEIGHT, ' g', ''), 'g', ''), ' ', '') 
        AS DECIMAL(10,2)
      )) as avgSetWeight,
      AVG(TRY_CAST(
        REPLACE(REPLACE(REPLACE(ACTUAL_GAS_WEIGHT, ' g', ''), 'g', ''), ' ', '') 
        AS DECIMAL(10,2)
      )) as avgActualWeight,
      MIN(TRY_CAST(
        REPLACE(REPLACE(REPLACE(ACTUAL_GAS_WEIGHT, ' g', ''), 'g', ''), ' ', '') 
        AS DECIMAL(10,2)
      )) as minWeight,
      MAX(TRY_CAST(
        REPLACE(REPLACE(REPLACE(ACTUAL_GAS_WEIGHT, ' g', ''), 'g', ''), ' ', '') 
        AS DECIMAL(10,2)
      )) as maxWeight,
      COUNT(*) as totalCount
    FROM ${TABLE_NAME}
    ${whereClause}
    GROUP BY MODEL
    ORDER BY totalCount DESC
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const request = pool
      .request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate", sql.DateTime, istEnd);

    if (model) request.input("model", sql.VarChar, model);
    if (machine) request.input("machine", sql.VarChar, machine);

    const result = await request.query(query);

    // Calculate deviation for each model
    const analysisData = result.recordset.map((item) => ({
      ...item,
      avgDeviation:
        item.avgSetWeight && item.avgActualWeight
          ? (item.avgActualWeight - item.avgSetWeight).toFixed(2)
          : null,
      weightRange:
        item.minWeight && item.maxWeight
          ? (item.maxWeight - item.minWeight).toFixed(2)
          : null,
    }));

    res.status(200).json({
      success: true,
      message: "Gas weight analysis retrieved successfully.",
      data: analysisData,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch gas weight analysis: ${error.message}`,
      500,
    );
  } finally {
    await pool.close();
  }
});
