import sql from "mssql";
import { dbConfig1 } from "../../../config/db.config.js";
import { tryCatch } from "../../../utils/try-catch.js";
import { AppError } from "../../../utils/app-error.js";
import { convertToIST } from "../../../utils/convert-to-ist.js";

/* ─────────────────────────────────────────────────────────────
   Shared connection pool — with robust reconnect logic
   ───────────────────────────────────────────────────────────── */
let _pool = null;

async function getPool() {
  // Re-use a healthy pool
  if (_pool && _pool.connected && !_pool.connecting) return _pool;

  // Close stale pool if it exists
  if (_pool) {
    try { await _pool.close(); } catch { /* ignore */ }
    _pool = null;
  }

  try {
    _pool = await new sql.ConnectionPool({
      ...dbConfig1,
      requestTimeout:    120_000,
      connectionTimeout:  30_000,
      pool: {
        max:              10,
        min:               2,
        idleTimeoutMillis: 30_000,
      },
    }).connect();

    _pool.on("error", (err) => {
      console.error("[DB Pool Error]", err.message);
      _pool = null; // force reconnect on next request
    });

    return _pool;
  } catch (err) {
    _pool = null;
    throw new AppError(`Database connection failed: ${err.message}`, 503);
  }
}

/* ─────────────────────────────────────────────────────────────
   Param extractor + validator
   ───────────────────────────────────────────────────────────── */
function extractParams(query) {
  const { startTime, endTime, model, compType, page = 1, limit = 100 } = query;

  if (!startTime || !endTime)
    throw new AppError("startTime and endTime are required", 400);

  const istStart = convertToIST(startTime);
  const istEnd   = convertToIST(endTime);

  if (istEnd <= istStart)
    throw new AppError("endTime must be after startTime", 400);

  const parsedPage  = Math.max(1, parseInt(page,  10) || 1);
  const parsedLimit = Math.min(500, Math.max(1, parseInt(limit, 10) || 100));

  return { istStart, istEnd, model, compType, page: parsedPage, limit: parsedLimit };
}

/* ─────────────────────────────────────────────────────────────
   Common CTE block (reused in main + summary queries)
   ───────────────────────────────────────────────────────────── */
const BASE_CTE = `
  WITH BomMaterials AS (
      SELECT psno, BOMCode, RowID, Material
      FROM   ProcessInputBOM
      UNION
      SELECT a.psno, a.BOMCode, a.RowID, b.Material
      FROM   ProcessInputBOM a
      INNER JOIN BOMInputAltMaterial b
          ON  a.RowID   = b.RowID
  ),
  FGActivity AS (
      SELECT * FROM (
          SELECT *,
                 ROW_NUMBER() OVER (PARTITION BY PSNo ORDER BY ActivityOn DESC) AS rn
          FROM   ProcessActivity
          WHERE  ActivityType = 5
            AND  StationCode IN (1220010, 1230017)
            AND  ActivityOn  >= @startTime
            AND  ActivityOn  <  @endTime
      ) x WHERE rn = 1
  ),
  FGBarcode AS (
      SELECT * FROM (
          SELECT *,
                 ROW_NUMBER() OVER (PARTITION BY DocNo ORDER BY CreatedOn DESC) AS rn
          FROM   MaterialBarcode
          WHERE  Status   <> 99
            AND  VSerial  IS NOT NULL
      ) y WHERE rn = 1
  )
`;

/* ─────────────────────────────────────────────────────────────
   SQL builder
   ───────────────────────────────────────────────────────────── */
function buildRequest(pool, { istStart, istEnd, model, compType }) {
  const request = pool.request()
    .input("startTime", sql.DateTime, istStart)
    .input("endTime",   sql.DateTime, istEnd);

  const modelFilter    = model    && String(model)    !== "0";
  const compTypeFilter = compType && String(compType) !== "0";

  if (modelFilter)    request.input("model",    sql.VarChar, String(model));
  if (compTypeFilter) request.input("compType", sql.VarChar, String(compType));

  const whereExtras = [
    modelFilter    ? "AND MATBM.MatCode       = @model"    : "",
    compTypeFilter ? "AND MatCat.CategoryCode = @compType" : "",
  ].join("\n");

  return { request, whereExtras };
}

function buildMainSelectBlock(whereExtras) {
  return `
    SELECT
        MATBM.Name                  AS Model_Name,
        b.Serial                    AS Component_Serial_Number,
        ISNULL(mat.Name, 'NA')      AS Component_Name,
        ISNULL(mat.AltName, 'NA')   AS SAP_Code,
        ISNULL(MatCat.Name, 'NA')   AS Component_Type,
        ISNULL(L.Name, 'NA')        AS Supplier_Name,
        b.ScannedOn                 AS Comp_ScanedOn,
        pa.ActivityOn               AS FG_Date,
        MATB.Serial                 AS Fg_Sr_No,
        MATB.VSerial                AS Asset_tag

    FROM       ProcessOrder              a
    INNER JOIN ProcessInputBOMScan       b    ON  b.PSNo     = a.PSNo
    INNER JOIN BomMaterials              c    ON  c.PSNo     = b.PSNo
                                             AND c.RowID    = b.RowID
                                             AND c.Material = b.Material
    -- BUG FIX: Material/MaterialCategory were INNER JOINs — a scanned
    -- component whose material has no MaterialCategory row (or an orphan
    -- MatCode) vanished from the report entirely instead of just showing a
    -- blank type, same class of bug fixed in getComponentDetails.
    LEFT  JOIN Material                  mat  ON  mat.MatCode      = c.Material
    LEFT  JOIN MaterialCategory          MatCat ON MatCat.CategoryCode = mat.Category
    INNER JOIN FGActivity                pa   ON  pa.PSNo    = a.PSNo
    INNER JOIN FGBarcode                 MATB ON  MATB.DocNo = a.PSNo
    LEFT  JOIN Material                  MATBM ON  MATBM.MatCode   = MATB.Material
    LEFT  JOIN Ledger                    L    ON  L.LedgerCode     = mat.Ledger

    WHERE MATB.Status   <> 99
      AND MATB.VSerial  IS NOT NULL
      ${whereExtras}

    ORDER BY a.PSNo
  `;
}

/* ─────────────────────────────────────────────────────────────
   GET /prod/component-traceability   (paginated table view)
   ───────────────────────────────────────────────────────────── */
export const generateReport = tryCatch(async (req, res) => {
  const params = extractParams(req.query);
  const pool   = await getPool();
  const { request, whereExtras } = buildRequest(pool, params);

  const offset = (params.page - 1) * params.limit;
  request.input("offset", sql.Int, offset);
  request.input("limit",  sql.Int, params.limit);

  const query = `
    ${BASE_CTE}
    ${buildMainSelectBlock(whereExtras)}
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
  `;

  try {
    const result = await request.query(query);
    return res.status(200).json({
      success: true,
      message: "Component Traceability Report generated successfully",
      data:    result.recordset,
      meta: {
        page:  params.page,
        limit: params.limit,
        count: result.recordset.length,
      },
    });
  } catch (err) {
    throw new AppError(`Failed to generate report: ${err.message}`, 500);
  }
});

/* ─────────────────────────────────────────────────────────────
   GET /prod/export-component-traceability   (full export)
   ───────────────────────────────────────────────────────────── */
export const componentTraceabilityExportData = tryCatch(async (req, res) => {
  const params = extractParams(req.query);
  const pool   = await getPool();
  const { request, whereExtras } = buildRequest(pool, params);

  const query = `
    ${BASE_CTE}
    ${buildMainSelectBlock(whereExtras)};
  `;

  try {
    const result = await request.query(query);
    return res.status(200).json({
      success: true,
      message: "Export data fetched successfully",
      data:    result.recordset,
      meta:    { count: result.recordset.length },
    });
  } catch (err) {
    throw new AppError(`Failed to export data: ${err.message}`, 500);
  }
});

/* ─────────────────────────────────────────────────────────────
   GET /prod/component-traceability-summary
   Lightweight aggregate — powers KPI cards without full row fetch.
   Call in parallel with the first page for fast initial load.
   ───────────────────────────────────────────────────────────── */
export const getTraceabilitySummary = tryCatch(async (req, res) => {
  const params = extractParams(req.query);
  const pool   = await getPool();
  const { request, whereExtras } = buildRequest(pool, params);

  const query = `
    ${BASE_CTE},
    Base AS (
        SELECT
            MATBM.Name                              AS Model_Name,
            b.Serial                                AS Component_Serial_Number,
            ISNULL(MatCat.Name, 'NA')               AS Component_Type,
            ISNULL(L.Name, 'NA')                    AS Supplier_Name,
            CAST(pa.ActivityOn AS DATE)             AS FG_Date,
            DATEPART(HOUR, b.ScannedOn)             AS Scan_Hour
        FROM       ProcessOrder              a
        INNER JOIN ProcessInputBOMScan       b    ON b.PSNo = a.PSNo
        INNER JOIN BomMaterials              c    ON c.PSNo = b.PSNo AND c.RowID = b.RowID AND c.Material = b.Material
        LEFT  JOIN Material                  mat  ON mat.MatCode = c.Material
        LEFT  JOIN MaterialCategory          MatCat ON MatCat.CategoryCode = mat.Category
        INNER JOIN FGActivity                pa   ON pa.PSNo = a.PSNo
        INNER JOIN FGBarcode                 MATB ON MATB.DocNo = a.PSNo
        LEFT  JOIN Material                  MATBM ON MATBM.MatCode = MATB.Material
        LEFT  JOIN Ledger                    L    ON L.LedgerCode = mat.Ledger
        WHERE MATB.Status <> 99 AND MATB.VSerial IS NOT NULL
        ${whereExtras}
    )
    SELECT
        COUNT(*)                                AS Total_Records,
        COUNT(DISTINCT Component_Serial_Number) AS Unique_Components,
        COUNT(DISTINCT Model_Name)              AS Unique_Models,
        COUNT(DISTINCT Supplier_Name)           AS Unique_Suppliers,
        COUNT(DISTINCT Component_Type)          AS Unique_Comp_Types,
        MIN(FG_Date)                            AS Earliest_FG_Date,
        MAX(FG_Date)                            AS Latest_FG_Date,
        DATEDIFF(DAY, MIN(FG_Date), MAX(FG_Date)) + 1 AS Day_Span
    FROM Base;
  `;

  try {
    const result = await request.query(query);
    const row = result.recordset[0] ?? {};
    return res.status(200).json({
      success: true,
      data: {
        totalRecords:    row.Total_Records       ?? 0,
        uniqueComponents:row.Unique_Components   ?? 0,
        uniqueModels:    row.Unique_Models        ?? 0,
        uniqueSuppliers: row.Unique_Suppliers     ?? 0,
        uniqueCompTypes: row.Unique_Comp_Types    ?? 0,
        daySpan:         row.Day_Span             ?? 1,
        dateRange: {
          from: row.Earliest_FG_Date,
          to:   row.Latest_FG_Date,
        },
      },
    });
  } catch (err) {
    throw new AppError(`Failed to fetch summary: ${err.message}`, 500);
  }
});

/* ─────────────────────────────────────────────────────────────
   GET /prod/component-traceability-grouped
   Returns pre-aggregated group data for the Groups tab.
   Avoids transferring all rows just to group on the client.
   ───────────────────────────────────────────────────────────── */
export const getTraceabilityGrouped = tryCatch(async (req, res) => {
  const { groupBy = "Component_Type" } = req.query;

  // Whitelist allowed group-by columns to prevent SQL injection
  const ALLOWED_GROUP_KEYS = {
    Component_Type: "MatCat.Name",
    Supplier_Name:  "L.Name",
    Model_Name:     "MATBM.Name",
    SAP_Code:       "ISNULL(mat.AltName,'NA')",
  };

  if (!ALLOWED_GROUP_KEYS[groupBy])
    throw new AppError(`Invalid groupBy value: ${groupBy}`, 400);

  const params = extractParams(req.query);
  const pool   = await getPool();
  const { request, whereExtras } = buildRequest(pool, params);

  const groupCol = ALLOWED_GROUP_KEYS[groupBy];

  const query = `
    ${BASE_CTE}
    SELECT
        ISNULL(${groupCol}, 'Unknown')  AS Group_Name,
        COUNT(*)                        AS Record_Count,
        COUNT(DISTINCT b.Serial)        AS Unique_Components,
        COUNT(DISTINCT MATBM.Name)      AS Unique_Models,
        COUNT(DISTINCT L.Name)          AS Unique_Suppliers,
        MIN(CAST(pa.ActivityOn AS DATE)) AS Earliest_Date,
        MAX(CAST(pa.ActivityOn AS DATE)) AS Latest_Date

    FROM       ProcessOrder              a
    INNER JOIN ProcessInputBOMScan       b    ON  b.PSNo     = a.PSNo
    INNER JOIN BomMaterials              c    ON  c.PSNo     = b.PSNo AND c.RowID = b.RowID AND c.Material = b.Material
    LEFT  JOIN Material                  mat  ON  mat.MatCode = c.Material
    LEFT  JOIN MaterialCategory          MatCat ON MatCat.CategoryCode = mat.Category
    INNER JOIN FGActivity                pa   ON  pa.PSNo    = a.PSNo
    INNER JOIN FGBarcode                 MATB ON  MATB.DocNo = a.PSNo
    LEFT  JOIN Material                  MATBM ON  MATBM.MatCode = MATB.Material
    LEFT  JOIN Ledger                    L    ON  L.LedgerCode  = mat.Ledger

    WHERE MATB.Status <> 99 AND MATB.VSerial IS NOT NULL
    ${whereExtras}

    GROUP BY ISNULL(${groupCol}, 'Unknown')
    ORDER BY Record_Count DESC;
  `;

  try {
    const result = await request.query(query);
    return res.status(200).json({
      success: true,
      groupBy,
      data: result.recordset,
      meta: { count: result.recordset.length },
    });
  } catch (err) {
    throw new AppError(`Failed to fetch grouped data: ${err.message}`, 500);
  }
});

/* ─────────────────────────────────────────────────────────────
   GET /prod/component-traceability-timeline
   Returns daily aggregated FG counts (for timeline chart).
   Lightweight — no row-level data transferred.
   ───────────────────────────────────────────────────────────── */
export const getTraceabilityTimeline = tryCatch(async (req, res) => {
  const params = extractParams(req.query);
  const pool   = await getPool();
  const { request, whereExtras } = buildRequest(pool, params);

  const query = `
    ${BASE_CTE}
    SELECT
        CAST(pa.ActivityOn AS DATE) AS FG_Date,
        COUNT(*)                    AS Record_Count,
        COUNT(DISTINCT MATBM.Name)  AS Model_Count,
        COUNT(DISTINCT L.Name)      AS Supplier_Count

    FROM       ProcessOrder              a
    INNER JOIN ProcessInputBOMScan       b    ON b.PSNo = a.PSNo
    INNER JOIN BomMaterials              c    ON c.PSNo = b.PSNo AND c.RowID = b.RowID AND c.Material = b.Material
    LEFT  JOIN Material                  mat  ON mat.MatCode = c.Material
    LEFT  JOIN MaterialCategory          MatCat ON MatCat.CategoryCode = mat.Category
    INNER JOIN FGActivity                pa   ON pa.PSNo = a.PSNo
    INNER JOIN FGBarcode                 MATB ON MATB.DocNo = a.PSNo
    LEFT  JOIN Material                  MATBM ON MATBM.MatCode = MATB.Material
    LEFT  JOIN Ledger                    L    ON L.LedgerCode = mat.Ledger

    WHERE MATB.Status <> 99 AND MATB.VSerial IS NOT NULL
    ${whereExtras}

    GROUP BY CAST(pa.ActivityOn AS DATE)
    ORDER BY FG_Date ASC;
  `;

  try {
    const result = await request.query(query);
    return res.status(200).json({
      success: true,
      data: result.recordset,
      meta: { count: result.recordset.length },
    });
  } catch (err) {
    throw new AppError(`Failed to fetch timeline data: ${err.message}`, 500);
  }
});