import sql from "mssql";
import { dbConfig1, dbConfig2 } from "../../../config/db.config.js";
import { tryCatch } from "../../../utils/try-catch.js";
import { AppError } from "../../../utils/app-error.js";

// ═══════════════════════════════════════════════════════════════════
// Unit Summary — identity strip + current status, shown above every tab.
// Status priority: DISPATCHED > HOLD > UNLOADED > REWORK > in-process stage.
//   ProcessRouting.Status: 0 = pending, 1 = in progress, 2 = completed
//   MaterialBarcode.Status: 11 = Hold
// Unloading/dispatch live in WWMS (dbConfig2); a failure there degrades to
// the production-side status instead of failing the whole strip.
// ═══════════════════════════════════════════════════════════════════
export const getUnitSummary = tryCatch(async (req, res) => {
  const { componentIdentifier } = req.query;
  if (!componentIdentifier) throw new AppError("Component Identifier is required", 400);

  const query = `
    DECLARE @id VARCHAR(100) = @componentIdentifier;
    DECLARE @DocNo BIGINT;

    SELECT TOP 1 @DocNo = PSNo FROM ProcessStageLabel WHERE BarcodeNo = @id;
    IF @DocNo IS NULL
      SELECT TOP 1 @DocNo = DocNo FROM MaterialBarcode WHERE Serial = @id OR Alias = @id;

    IF @DocNo IS NULL
    BEGIN
      SELECT CAST(1 AS BIT) AS NotFound;
      RETURN;
    END

    -- 0: identity (FG / assembly barcode row)
    SELECT TOP 1
      @DocNo      AS PSNo,
      b.Serial,
      b.Alias,
      b.VSerial   AS Asset,
      b.Serial2   AS CustomerQR,
      b.Status    AS MbStatus,
      m.Name      AS MaterialName
    FROM MaterialBarcode b
    LEFT JOIN Material m ON m.MatCode = b.Material
    WHERE b.DocNo = @DocNo AND b.Type IN (100, 400)
    ORDER BY CASE b.Type WHEN 100 THEN 0 ELSE 1 END;

    -- 1: labels (foaming F..., assembly S..., FG 4...)
    SELECT DISTINCT BarcodeNo FROM ProcessStageLabel WHERE PSNo = @DocNo;

    -- 2: unreleased dispatch hold
    SELECT TOP 1 CAST(1 AS BIT) AS OnHold
    FROM DispatchHold dh
    WHERE dh.ReleasedDateTime IS NULL
      AND dh.Serial IN (
        SELECT BarcodeNo FROM ProcessStageLabel WHERE PSNo = @DocNo
        UNION
        SELECT Serial FROM MaterialBarcode WHERE DocNo = @DocNo AND Type IN (100, 400)
      );

    -- 3: ongoing rework (same definition as the Rework Report "Ongoing")
    SELECT TOP 1 w.Name AS Station
    FROM InspectionTrans it
    INNER JOIN InspectionHeader ih ON it.InspectionLotNo = ih.InspectionLotNo
    INNER JOIN ProcessRouting  pr ON ih.DocNo = pr.PSNo AND pr.ProcessCode = ih.Process
    INNER JOIN WorkCenter      w  ON pr.StationCode = w.StationCode
    WHERE it.NextAction = 1
      AND ih.DocNo = @DocNo
      AND pr.StartedOn IS NOT NULL
      AND pr.CompletedOn IS NULL
    ORDER BY pr.StartedOn DESC;

    -- 4: current process stage — in-progress stage first, else last completed
    SELECT TOP 1 w.Name AS Station
    FROM ProcessRouting pr
    INNER JOIN WorkCenter w ON w.StationCode = pr.StationCode
    WHERE pr.PSNo = @DocNo AND pr.Status IN (1, 2)
    ORDER BY CASE WHEN pr.Status = 1 THEN 0 ELSE 1 END,
             ISNULL(pr.CompletedOn, pr.StartedOn) DESC;
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();
  let sets;
  try {
    const result = await pool.request()
      .input("componentIdentifier", sql.VarChar, componentIdentifier)
      .query(query);
    sets = result.recordsets;
  } catch (err) {
    throw new AppError(`Failed to fetch Unit Summary: ${err.message}`, 500);
  } finally {
    await pool.close();
  }

  if (!sets?.length || sets[0][0]?.NotFound) {
    return res.status(200).json({ success: true, message: "No unit found", data: null });
  }

  const identity = sets[0][0] || {};
  const labels = (sets[1] || []).map((r) => String(r.BarcodeNo || ""));
  const startsWith = (p) => labels.find((l) => l.toUpperCase().startsWith(p)) || "";

  const foamingSerial = startsWith("F");
  const assemblySerial =
    startsWith("S") ||
    (String(identity.Serial || "").toUpperCase().startsWith("S") ? identity.Serial : "");
  const fgSerial =
    startsWith("4") ||
    (identity.Serial && !/^[FS]/i.test(identity.Serial) ? identity.Serial : "");

  const onHold = identity.MbStatus === 11 || !!sets[2]?.[0]?.OnHold;
  const reworkStation = sets[3]?.[0]?.Station || null;
  const processStation = sets[4]?.[0]?.Station || null;

  let dispatched = false;
  let unloaded = false;
  if (fgSerial) {
    let pool2;
    try {
      pool2 = await new sql.ConnectionPool(dbConfig2).connect();
      const r = await pool2.request()
        .input("fg", sql.VarChar, fgSerial)
        .query(`
          SELECT
            (SELECT COUNT(*) FROM DispatchMaster dm
               INNER JOIN Tracking_Document td ON td.Document_ID = dm.Document_ID
             WHERE dm.FGSerialNo = @fg AND td.LatestStatus = 'Completed') AS Dispatched,
            (SELECT COUNT(*) FROM DispatchUnloading WHERE FGSerialNo = @fg) AS Unloaded;
        `);
      dispatched = (r.recordset[0]?.Dispatched || 0) > 0;
      unloaded = (r.recordset[0]?.Unloaded || 0) > 0;
    } catch (err) {
      console.error("[UnitSummary] WWMS lookup failed:", err.message);
    } finally {
      if (pool2) await pool2.close();
    }
  }

  let status;
  if (dispatched) status = { code: "DISPATCHED", label: "DISPATCHED", stage: null };
  else if (onHold) status = { code: "HOLD", label: "HOLD", stage: null };
  else if (unloaded) status = { code: "UNLOADED", label: "UNLOADED", stage: null };
  else if (reworkStation) status = { code: "REWORK", label: "REWORK", stage: reworkStation };
  else if (processStation)
    status = { code: "IN_PROCESS", label: processStation, stage: processStation };
  else status = { code: "NOT_STARTED", label: "NOT STARTED", stage: null };

  res.status(200).json({
    success: true,
    message: "Unit Summary retrieved",
    data: {
      psNo: identity.PSNo,
      materialName: identity.MaterialName || "",
      assemblySerial,
      foamingSerial,
      fgSerial,
      barcodeAlias: identity.Alias || "",
      asset: identity.Asset || "",
      customerQR: identity.CustomerQR || "",
      status,
    },
  });
});

// ═══════════════════════════════════════════════════════════════════
// Stage History
// ═══════════════════════════════════════════════════════════════════
export const getCurrentStageStatus = tryCatch(async (req, res) => {
  const { componentIdentifier } = req.query;
  if (!componentIdentifier) throw new AppError("Component Identifier is required", 400);

  const query = `
    DECLARE @Barcode VARCHAR(50) = @componentIdentifier;

    WITH Psno AS (
        SELECT DocNo, Material, Serial, VSerial, Serial2, Alias, Type
        FROM MaterialBarcode
        WHERE DocNo = (
            SELECT Psno 
            FROM ProcessStageLabel 
            WHERE BarcodeNo = @Barcode
        )
    )
    SELECT
        Psno.DocNo       AS PSNO,
        M.Name           AS MaterialName,
        B.StationCode,
        B.Name           AS StationName,
        B.Alias          AS StationAlias,
        A.ActivityOn,
        Psno.Serial2     AS CustomerQR,
        Psno.VSerial,
        Psno.Alias       AS BarcodeAlias,
        Psno.Serial,
        A.ActivityType,
        C.Type           AS ActivityTypeName,
        U.UserName
    FROM Psno
    INNER JOIN ProcessActivity     A ON Psno.DocNo = A.PSNO
    INNER JOIN WorkCenter         B ON A.StationCode = B.StationCode
    INNER JOIN Material           M ON Psno.Material = M.MatCode
    LEFT  JOIN ProcessActivityType C ON C.id = A.ActivityType
    INNER JOIN Users              U ON U.UserCode = A.Operator
    WHERE 
    (
        (@Barcode LIKE 'F%' AND Psno.Type = 400)
        OR
        ((@Barcode LIKE 'S%' OR @Barcode LIKE '4%') AND Psno.Type = 100)
    )
    ORDER BY A.ActivityOn ASC;
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();
  try {
    const result = await pool.request()
      .input("componentIdentifier", sql.NVarChar, componentIdentifier)
      .query(query);
    res.status(200).json({ success: true, message: "Stage History retrieved successfully", data: result });
  } catch (err) {
    throw new AppError(`Failed to fetch Stage History: ${err.message}`, 500);
  } finally {
    await pool.close();
  }
});

// ═══════════════════════════════════════════════════════════════════
// Logistic Status
// ═══════════════════════════════════════════════════════════════════
export const getLogisticStatus = tryCatch(async (req, res) => {
  const { componentIdentifier } = req.query;
  if (!componentIdentifier) throw new AppError("Component Identifier is required", 400);

  const query = `
    IF OBJECT_ID('tempdb..#Dispatch')       IS NOT NULL DROP TABLE #Dispatch;
    IF OBJECT_ID('tempdb..#DispatchMaster') IS NOT NULL DROP TABLE #DispatchMaster;

    CREATE TABLE #Dispatch (FgserialNo NVARCHAR(100), UnloadingDate DATETIME);
    CREATE TABLE #DispatchMaster (
      Session_ID NVARCHAR(50), Vehicle_No NVARCHAR(50),
      DockNo INT, AddedOn DATETIME, FGSerialNo NVARCHAR(100)
    );

    DECLARE @sql NVARCHAR(MAX);

    SET @sql = N'
    INSERT INTO #Dispatch (FgserialNo, UnloadingDate)
    SELECT FgserialNo, DateTime
    FROM OPENQUERY([10.100.95.134],
      ''SELECT FgserialNo, DateTime FROM WWMS.dbo.DispatchUnloading
        WHERE FgserialNo = ''''' + REPLACE(@componentIdentifier, '''', '''''') + '''''''
    )';
    EXEC(@sql);

    SET @sql = N'
    INSERT INTO #DispatchMaster (Session_ID, Vehicle_No, DockNo, AddedOn, FGSerialNo)
    SELECT Session_ID, Vehicle_No, DockNo, AddedOn, FGSerialNo
    FROM OPENQUERY([10.100.95.134],
      ''SELECT dm.Session_ID, td.Vehicle_No, td.DockNo, dm.AddedOn, dm.FGSerialNo
        FROM WWMS.dbo.DispatchMaster dm
        INNER JOIN WWMS.dbo.Tracking_Document td ON td.Document_ID = dm.Document_ID
        WHERE dm.FGSerialNo = ''''' + REPLACE(@componentIdentifier, '''', '''''') + '''''''
    )';
    EXEC(@sql);

    ;WITH MB AS (
      SELECT b.DocNo, b.Serial, c.Name
      FROM MaterialBarcode b INNER JOIN material c ON c.matcode = b.material
      WHERE b.Type NOT IN (200, 0) AND b.Serial = @componentIdentifier
    )
    SELECT
      CASE WHEN EXISTS (SELECT 1 FROM ProcessRouting p WHERE p.PSNo = mb.DocNo AND p.Status = 2 AND p.StationCode IN (1220010,1230017))
           THEN 'SCANNED' ELSE 'NOT SCANNED' END AS [FG_LabelPrinting],
      (SELECT MAX(p.CompletedOn) FROM ProcessRouting p WHERE p.PSNo = mb.DocNo AND p.Status = 2 AND p.StationCode IN (1220010,1230017)) AS [FG_LabelPrinting_Date],

      CASE WHEN EXISTS (SELECT 1 FROM ProcessRouting p WHERE p.PSNo = mb.DocNo AND p.Status = 2 AND p.StationCode IN (1220009,1230018))
           THEN 'SCANNED' ELSE 'NOT SCANNED' END AS [FG_Auto_Scan],
      (SELECT MAX(p.CompletedOn) FROM ProcessRouting p WHERE p.PSNo = mb.DocNo AND p.Status = 2 AND p.StationCode IN (1220009,1230018)) AS [FG_Auto_Scan_Date],

      CASE WHEN EXISTS (SELECT 1 FROM #Dispatch d WHERE d.FgserialNo = mb.Serial)
           THEN 'SCANNED' ELSE 'NOT SCANNED' END AS [FG_Unloading],
      (SELECT MAX(d.UnloadingDate) FROM #Dispatch d WHERE d.FgserialNo = mb.Serial) AS [FG_Unloading_Date],

      dm.Session_ID, dm.Vehicle_No, dm.DockNo, dm.AddedOn AS [Vehicle_Entry_Time]
    FROM MB mb
    LEFT JOIN #DispatchMaster dm ON dm.FGSerialNo = mb.Serial;
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();
  try {
    const result = await pool.request()
      .input("componentIdentifier", sql.NVarChar, componentIdentifier)
      .query(query);
    res.status(200).json({ success: true, message: "Logistic Status retrieved", data: result.recordset });
  } catch (err) {
    throw new AppError(`Failed to fetch Logistic Status: ${err.message}`, 500);
  } finally {
    await pool.close();
  }
});

// ═══════════════════════════════════════════════════════════════════
// Component Details
// BUG FIX: returns 200 + empty array instead of 404 (friendlier for frontend EmptyState)
// BUG FIX: first branch now reads Material directly off ProcessInputBOMScan
//   (a.Material) instead of re-deriving it via a ProcessInputBOM join keyed
//   on PSNo+RowID. That join required the scanned component to also be a
//   registered BOM line (or alt-material) for this exact PSNo/RowID — a
//   real, physically-scanned substitution that was never registered in the
//   BOM master silently vanished from the results entirely (same class of
//   bug fixed in componentTraceabilityReport.controller.js's BomMaterials
//   CTE). All supporting lookups (Material/MaterialCategory/Ledger) are now
//   LEFT JOINs with an ISNULL('NA') fallback too, so a component missing a
//   category/ledger master entry still shows up instead of being dropped.
// ═══════════════════════════════════════════════════════════════════
export const getComponentDetails = tryCatch(async (req, res) => {
  const { componentIdentifier } = req.query;
  if (!componentIdentifier) {
    return res.status(400).json({ success: false, message: "componentIdentifier is required", data: [] });
  }

  const query = `
    DECLARE @SRNO VARCHAR(50) = @componentIdentifier;
    DECLARE @DocNo INT;

    SELECT @DocNo = DocNo FROM MaterialBarcode WHERE Serial = @SRNO;
    IF @DocNo IS NULL SELECT @DocNo = DocNo FROM MaterialBarcode WHERE Alias = @SRNO;
    IF @DocNo IS NULL SELECT @DocNo = PSNo FROM ProcessStageLabel WHERE BarcodeNo = @SRNO;

    IF @DocNo IS NULL
    BEGIN
      SELECT NULL AS name, NULL AS sapCode, NULL AS serial, NULL AS type,
             NULL AS supplierName, NULL AS scannedOn WHERE 1 = 0;
      RETURN;
    END

    -- Components scanned through ProcessInputBOMScan
    SELECT
      ISNULL(c.Name, 'NA')    AS name,
      ISNULL(c.AltName, 'NA') AS sapCode,
      a.Serial                AS serial,
      ISNULL(mc.Name, 'NA')   AS type,
      ISNULL(l.Name, 'NA')    AS supplierName,
      a.ScannedOn             AS scannedOn
    FROM ProcessInputBOMScan a
    LEFT JOIN Material c          ON a.Material = c.MatCode
    LEFT JOIN MaterialCategory mc ON mc.CategoryCode = c.Category
    LEFT JOIN Ledger l            ON l.LedgerCode = c.Ledger
    WHERE a.PSNo = @DocNo

    UNION ALL

    -- Components available through MaterialBarcode
    SELECT
      ISNULL(b.Name, 'NA')    AS name,
      ISNULL(b.AltName, 'NA') AS sapCode,
      a.Serial                AS serial,
      ISNULL(mc.Name, 'NA')   AS type,
      ISNULL(l.Name, 'NA')    AS supplierName,
      a.CreatedOn             AS scannedOn
    FROM MaterialBarcode a
    LEFT JOIN Material b          ON a.Material = b.MatCode
    LEFT JOIN MaterialCategory mc ON mc.CategoryCode = b.Category
    LEFT JOIN Ledger l            ON l.LedgerCode = b.Ledger
    WHERE a.DocNo = @DocNo AND a.VSerial IS NOT NULL

    ORDER BY scannedOn;
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();
  try {
    const result = await pool.request()
      .input("componentIdentifier", sql.VarChar, componentIdentifier)
      .query(query);
    // BUG FIX: 200 with empty array — let frontend handle EmptyState
    res.status(200).json({
      success: true,
      message: result.recordset.length ? "Component details retrieved" : "No components found",
      data: result.recordset,
    });
  } catch (err) {
    throw new AppError(`Failed to fetch Component Details: ${err.message}`, 500);
  } finally {
    await pool.close();
  }
});

// ═══════════════════════════════════════════════════════════════════
// Rework Report
// BUG FIX: SQL aliases changed to camelCase to match frontend field access:
//   m.Alias → modelName, mc.Name → category, it.Serial → assembly
//   pr.CompletedOn → reworkOut, pr.StartedOn → reworkIN
// ═══════════════════════════════════════════════════════════════════
export const getReworkReport = tryCatch(async (req, res) => {
  const { componentIdentifier } = req.query;
  if (!componentIdentifier) throw new AppError("Component Identifier is required", 400);

  const query = `
    SELECT
      ROW_NUMBER() OVER (ORDER BY pr.StartedOn) AS RowNo,
      m.Alias        AS modelName,       -- BUG FIX: was Model_Name
      mc.Name        AS category,        -- BUG FIX: was Category
      w.Name         AS station,
      pr.ProcessCode AS processCode,
      it.Serial      AS assembly,        -- BUG FIX: was Assembly_SrNo
      pr.StartedOn   AS reworkIN,
      pr.CompletedOn AS reworkOut,       -- BUG FIX: was Rework_Out
      us.UserName    AS userName,
      s.Status       AS reworkStatus,
      CASE
        WHEN pr.CompletedOn IS NULL THEN NULL
        ELSE CONCAT(
          DATEDIFF(DAY, pr.StartedOn, pr.CompletedOn), ':',
          FORMAT((DATEDIFF(MINUTE, pr.StartedOn, pr.CompletedOn) / 60) % 24, 'D2'), ':',
          FORMAT(DATEDIFF(MINUTE, pr.StartedOn, pr.CompletedOn) % 60, 'D2')
        )
      END AS duration,
      dct.Type     AS defectCategory,
      dc.Name      AS defect,
      rc.Type      AS rootCause,
      rr.Type      AS counterAction,
      it.ApproverRemark AS remark
    FROM InspectionTrans it
    INNER JOIN InspectionHeader ih  ON it.InspectionLotNo = ih.InspectionLotNo
    INNER JOIN Material m           ON ih.Material = m.MatCode
    LEFT  JOIN MaterialCategory mc  ON m.Category = mc.CategoryCode
    INNER JOIN ProcessRouting pr    ON ih.DocNo = pr.PSNo AND pr.ProcessCode = ih.Process
    INNER JOIN WorkCenter w         ON pr.StationCode = w.StationCode
    LEFT  JOIN Status s             ON ih.Status = s.ID
    LEFT  JOIN InspectionDefect idf ON it.ID = idf.ID
    LEFT  JOIN DefectCodeMaster dc  ON idf.Defect = dc.Code
    LEFT  JOIN DefectCategoryType dct ON dc.DefectCategory = dct.ID
    LEFT  JOIN RootCause rc         ON it.RootCause = rc.ID
    LEFT  JOIN ReworkResolution rr  ON it.ReworkResolution = rr.ID
    LEFT  JOIN Users us             ON it.ApprovedBy = us.UserCode
    WHERE it.NextAction = 1
      AND ih.DocNo = (SELECT PSNo FROM ProcessStageLabel WHERE BarcodeNo = @componentIdentifier);
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();
  try {
    const result = await pool.request()
      .input("componentIdentifier", sql.NVarChar, componentIdentifier)
      .query(query);
    res.status(200).json({ success: true, message: "Rework Report retrieved", data: result.recordset });
  } catch (err) {
    throw new AppError(`Failed to fetch Rework Report: ${err.message}`, 500);
  } finally {
    await pool.close();
  }
});

// ═══════════════════════════════════════════════════════════════════
// Reprint History
// BUG FIX: broadened BarcodeNo lookup — also tries the identifier directly
// ═══════════════════════════════════════════════════════════════════
export const getReprintHistory = tryCatch(async (req, res) => {
  const { componentIdentifier } = req.query;
  if (!componentIdentifier) throw new AppError("Component Identifier is required", 400);

  const query = `
    DECLARE @BarcodeNo NVARCHAR(100);

    -- Try Serial / Alias first
    SELECT TOP 1 @BarcodeNo = BarcodeNo
    FROM MaterialBarcode
    WHERE Serial = @componentIdentifier OR Alias = @componentIdentifier;

    -- Fallback: the identifier itself might be the BarcodeNo
    IF @BarcodeNo IS NULL SET @BarcodeNo = @componentIdentifier;

    SELECT
      ROW_NUMBER() OVER (ORDER BY bp.PrintedOn ASC) AS [Sr_No],
      bp.Remark,
      bp.PrintedOn AS [Printed_On],
      u.UserName   AS [Printed_By]
    FROM BarcodePrintTrail bp
    INNER JOIN Users u ON u.UserCode = bp.PrintedBy
    WHERE bp.BarcodeNo = @BarcodeNo
    ORDER BY bp.PrintedOn ASC;
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();
  try {
    const result = await pool.request()
      .input("componentIdentifier", sql.NVarChar, componentIdentifier)
      .query(query);
    res.status(200).json({ success: true, message: "Reprint History retrieved", data: result.recordset });
  } catch (err) {
    throw new AppError(`Failed to fetch Reprint History: ${err.message}`, 500);
  } finally {
    await pool.close();
  }
});

// ═══════════════════════════════════════════════════════════════════
// History Card
// ═══════════════════════════════════════════════════════════════════
export const getHistoryCard = tryCatch(async (req, res) => {
  const { componentIdentifier } = req.query;
  if (!componentIdentifier) throw new AppError("Component Identifier is required", 400);

  const query = `
    DECLARE @PSNo BIGINT;
    SELECT TOP 1 @PSNo = DocNo FROM MaterialBarcode
    WHERE DocNo = (SELECT Psno FROM ProcessStageLabel WHERE BarcodeNo = @componentIdentifier)
      AND type = 100;

    IF @PSNo IS NULL
    BEGIN
      SELECT NULL AS [Sr No], NULL AS [Date & Time], NULL AS [Activity],
             NULL AS [ProcessStatus], NULL AS [Important check point],
             NULL AS [Method of checking], NULL AS [Name of Operator],
             NULL AS [Issue], NULL AS [Action Date & Time], NULL AS [Action], NULL AS [Result]
      WHERE 1 = 0;
      RETURN;
    END

    ;WITH ProductionData AS (
      SELECT A.ActivityOn AS [DateTime], B.Name AS [Activity], C.Type AS [ProcessStatus],
             pb.CheckPoints AS [ImportantCheckPoint], pb.CheckingMethod AS [MethodOfChecking],
             U.UserName AS [OperatorName], NULL AS [Issue], NULL AS [ActionDateTime],
             NULL AS [Action], 'OK' AS [Result]
      FROM ProcessActivity A
      INNER JOIN WorkCenter B         ON A.StationCode = B.StationCode
      INNER JOIN ProductionProcess pb ON pb.ProcessCode = A.ProcessCode
      LEFT  JOIN ProcessActivityType C ON C.id = A.ActivityType
      INNER JOIN Users U              ON U.UserCode = A.Operator
      WHERE A.PSNo = @PSNo
    ),
    ReworkData AS (
      SELECT pr.StartedOn AS [DateTime], w.Name AS [Activity], 'REWORK' AS [ProcessStatus],
             dc.Name AS [ImportantCheckPoint], pb.CheckingMethod AS [MethodOfChecking],
             us.UserName AS [OperatorName], dc.Name AS [Issue], it.InspectedOn AS [ActionDateTime],
             rr.Type AS [Action], 'REWORKED' AS [Result], pr.SeqNo
      FROM InspectionHeader ih
      INNER JOIN InspectionTrans it  ON it.InspectionLotNo = ih.InspectionLotNo
      INNER JOIN ProcessRouting pr   ON pr.PSNo = ih.DocNo AND pr.ProcessCode = ih.Process
      INNER JOIN WorkCenter w        ON w.StationCode = pr.StationCode
      LEFT  JOIN ProductionProcess pb ON pb.ProcessCode = pr.ProcessCode
      LEFT  JOIN InspectionDefect idf ON it.ID = idf.ID
      LEFT  JOIN DefectCodeMaster dc  ON idf.Defect = dc.Code
      LEFT  JOIN ReworkResolution rr  ON it.ReworkResolution = rr.ID
      LEFT  JOIN Users us            ON it.ApprovedBy = us.UserCode
      WHERE it.NextAction = 1 AND ih.DocNo = @PSNo
    ),
    PendingStages AS (
      SELECT NULL AS [DateTime], w.Name AS [Activity], 'PENDING' AS [ProcessStatus],
             pb.CheckPoints AS [ImportantCheckPoint], pb.CheckingMethod AS [MethodOfChecking],
             NULL AS [OperatorName], NULL AS [Issue], NULL AS [ActionDateTime],
             NULL AS [Action], 'WAITING' AS [Result]
      FROM ProcessRouting pr
      INNER JOIN WorkCenter w        ON w.StationCode = pr.StationCode
      LEFT  JOIN ProductionProcess pb ON pb.ProcessCode = pr.ProcessCode
      CROSS JOIN ReworkData r
      WHERE pr.PSNo = @PSNo AND pr.SeqNo > r.SeqNo AND pr.StartedOn IS NULL
    )
    SELECT
      ROW_NUMBER() OVER (ORDER BY CASE WHEN DateTime IS NULL THEN 1 ELSE 0 END, DateTime) AS [Sr No],
      FORMAT(DateTime, 'dd-MMM-yyyy HH:mm:ss') AS [Date & Time],
      Activity, ProcessStatus,
      ImportantCheckPoint AS [Important check point],
      MethodOfChecking    AS [Method of checking],
      OperatorName        AS [Name of Operator],
      Issue,
      FORMAT(ActionDateTime, 'dd-MMM-yyyy HH:mm:ss') AS [Action Date & Time],
      Action, Result
    FROM (
      SELECT DateTime, Activity, ProcessStatus, ImportantCheckPoint, MethodOfChecking,
             OperatorName, Issue, ActionDateTime, Action, Result FROM ProductionData
      UNION ALL
      SELECT DateTime, Activity, ProcessStatus, ImportantCheckPoint, MethodOfChecking,
             OperatorName, Issue, ActionDateTime, Action, Result FROM ReworkData
      UNION ALL
      SELECT DateTime, Activity, ProcessStatus, ImportantCheckPoint, MethodOfChecking,
             OperatorName, Issue, ActionDateTime, Action, Result FROM PendingStages
    ) X;
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();
  try {
    const result = await pool.request()
      .input("componentIdentifier", sql.NVarChar, componentIdentifier)
      .query(query);
    res.status(200).json({ success: true, message: "History Card retrieved", data: result.recordset });
  } catch (err) {
    throw new AppError(`Failed to fetch History Card: ${err.message}`, 500);
  } finally {
    await pool.close();
  }
});

// ═══════════════════════════════════════════════════════════════════
// Functional Test
// BUG FIX: cpt (recordsets[3]) was already being assigned correctly in
//   the original backend — the bug was ONLY on the frontend parseResponse
//   which ignored the cpt key. The backend is correct as-is.
//   Keeping here for completeness / clean version.
// ═══════════════════════════════════════════════════════════════════
export const getFunctionalTest = tryCatch(async (req, res) => {
  const { componentIdentifier } = req.query;
  if (!componentIdentifier) throw new AppError("Component Identifier is required", 400);

  const query = `
    DECLARE @ScanBarcode VARCHAR(50) = @componentIdentifier;
    DECLARE @PSNo BIGINT;
    SELECT TOP 1 @PSNo = PSNo FROM ProcessStageLabel WHERE BarcodeNo = @ScanBarcode;

    DECLARE @Barcodes TABLE (BarcodeNo VARCHAR(50) COLLATE DATABASE_DEFAULT);
    INSERT INTO @Barcodes(BarcodeNo) SELECT BarcodeNo FROM ProcessStageLabel WHERE PSNo = @PSNo;

    -- RESULT 1: Gas Charging
    SELECT 'GAS_CHARGING' AS TestType, GC.*
    FROM GasChargeDtls GC WHERE GC.BARCODE IN (SELECT BarcodeNo FROM @Barcodes);

    -- RESULT 2: EST
    SELECT 'EST' AS TestType, EST.*
    FROM ESTStaging EST WHERE EST.serial_no IN (SELECT BarcodeNo FROM @Barcodes);

    -- RESULT 3: MFT
    SELECT 'MFT' AS TestType, MFT.*
    FROM MFTStaging MFT WHERE MFT.EQUIPMENT_NO IN (SELECT BarcodeNo FROM @Barcodes);

    -- RESULT 4: CPT
    IF OBJECT_ID(N'tempdb..#CPT_RESULT_SET') IS NOT NULL DROP TABLE #CPT_RESULT_SET;
    BEGIN
      SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
      ;WITH CPT_SAMPLE_DATA AS (
        SELECT RSS.RESULT_ID, RSS.PROFILE_DEVICE_NO,
               MAX(RSS.SAMPLE_VALUE) AS [Max], MIN(RSS.SAMPLE_VALUE) AS [Min]
        FROM PLIS.dbo.RESULTS_SEQS_SAMPLES RSS
        INNER JOIN PLIS.dbo.RESULTS R ON R.RESULT_ID = RSS.RESULT_ID AND R.SERVER_ID = 0
        WHERE RSS.SERVER_ID = 0
          AND R.BARCODE COLLATE DATABASE_DEFAULT IN (SELECT BarcodeNo FROM @Barcodes)
        GROUP BY RSS.RESULT_ID, RSS.PROFILE_DEVICE_NO
      ),
      CPT_SAMPLE_DEVICE AS (
        SELECT SD.RESULT_ID, SD.[Max], SD.[Min], PD.DEVICE_TYPE_ID
        FROM PLIS.dbo.RESULTS R2
        INNER JOIN CPT_SAMPLE_DATA SD ON R2.RESULT_ID = SD.RESULT_ID
        INNER JOIN PLIS.dbo.PROFILES_DEVICES PD
          ON SD.PROFILE_DEVICE_NO = PD.DEVICE_NO
          AND R2.PROFILE_ID = PD.PROFILE_ID
          AND R2.PROFILE_HISTORY_ID = PD.HISTORY_ID
          AND PD.SERVER_ID = 0
        WHERE PD.DEVICE_TYPE_ID IN (1, 2, 3, 7) AND R2.SERVER_ID = 0
      )
      SELECT * INTO #CPT_RESULT_SET FROM CPT_SAMPLE_DEVICE;
      CREATE INDEX #IX_CPT_DEVICE ON #CPT_RESULT_SET(DEVICE_TYPE_ID);

      SELECT 'CPT' AS TestType,
        MAIN.Result_ID,
        CONVERT(VARCHAR(10), MAIN.START_DATE, 105) AS DATE,
        CONVERT(VARCHAR(8),  MAIN.START_DATE, 108) AS TIME,
        MAIN.BARCODE, MAIN.MODEL_ID AS MODEL, MODEL.NAME AS MODELNAME,
        DATEDIFF(MI, MAIN.START_DATE, MAIN.END_DATE) AS RUNTIME_MINUTES,
        TEMP.[Max] AS MAX_TEMPERATURE, TEMP.[Min] AS MIN_TEMPERATURE,
        CUR.[Max]  AS MAX_CURRENT,    CUR.[Min]  AS MIN_CURRENT,
        VOL.[Max]  AS MAX_VOLTAGE,    VOL.[Min]  AS MIN_VOLTAGE,
        POW.[Max]  AS MAX_POWER,      POW.[Min]  AS MIN_POWER,
        CASE WHEN MAIN.STATUS = 1 THEN 'PASS' ELSE 'FAIL' END AS PERFORMANCE,
        ISNULL(Step_Status.DEVICE_STATUS_CODE, 0) AS FaultCode,
        CASE
          WHEN Step_Status.DEVICE_STATUS_CODE = 26 THEN 'System Already Charged'
          WHEN Code_Name.NAME IS NULL AND MAIN.STATUS = 0 THEN 'Station Fault Stop'
          WHEN Code_Name.NAME IS NULL THEN 'Charging Pass'
          ELSE Code_Name.NAME
        END AS FaultName,
        MAIN.AREA_ID
      FROM PLIS.dbo.RESULTS MAIN
      INNER JOIN #CPT_RESULT_SET TEMP ON MAIN.RESULT_ID = TEMP.RESULT_ID AND TEMP.DEVICE_TYPE_ID = 7
      INNER JOIN #CPT_RESULT_SET CUR  ON TEMP.RESULT_ID = CUR.RESULT_ID  AND CUR.DEVICE_TYPE_ID = 2
      INNER JOIN #CPT_RESULT_SET VOL  ON VOL.RESULT_ID  = CUR.RESULT_ID  AND VOL.DEVICE_TYPE_ID = 3
      INNER JOIN #CPT_RESULT_SET POW  ON POW.RESULT_ID  = VOL.RESULT_ID  AND POW.DEVICE_TYPE_ID = 1
      LEFT  JOIN PLIS.dbo.MODELS MODEL ON MODEL.MODEL_ID = MAIN.MODEL_ID
      LEFT  JOIN PLIS.dbo.RESULTS_STEPS_STATUS Step_Status ON MAIN.RESULT_ID = Step_Status.RESULT_ID
      LEFT  JOIN (
        SELECT DISTINCT STATUS_CODE_ID, NAME, STATUS_CODE_TYPE
        FROM PLIS.dbo.DEVICES_STATUS_CODES WHERE LANGUAGE_ID = 0
      ) Code_Name ON Code_Name.STATUS_CODE_ID = Step_Status.DEVICE_STATUS_CODE
                 AND Code_Name.STATUS_CODE_TYPE = Step_Status.Status_Type_ID
      WHERE MAIN.AREA_ID IN (5, 6, 8, 9)
        AND MAIN.BARCODE COLLATE DATABASE_DEFAULT IN (SELECT BarcodeNo FROM @Barcodes)
        AND MAIN.Result_ID NOT IN (SELECT Result_ID FROM GasChargeSUSDtls)
      ORDER BY MAIN.Result_ID DESC;

      IF OBJECT_ID(N'tempdb..#CPT_RESULT_SET') IS NOT NULL DROP TABLE #CPT_RESULT_SET;
    END
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();
  try {
    const result = await pool.request()
      .input("componentIdentifier", sql.NVarChar, componentIdentifier)
      .query(query);

    const gasChargingData = result.recordsets[0] || [];
    const estData         = result.recordsets[1] || [];
    const mftData         = result.recordsets[2] || [];
    const cptData         = result.recordsets[3] || [];

    res.status(200).json({
      success: true,
      message: "Functional Test data retrieved",
      data: {
        gasCharging: gasChargingData,
        est:         estData,
        mft:         mftData,
        cpt:         cptData,  // ← always present
      },
      summary: {
        gasCharging: gasChargingData.length,
        est:         estData.length,
        mft:         mftData.length,
        cpt:         cptData.length,
        total:       gasChargingData.length + estData.length + mftData.length + cptData.length,
      },
    });
  } catch (err) {
    throw new AppError(`Failed to fetch Functional Test: ${err.message}`, 500);
  } finally {
    await pool.close();
  }
});


// ═══════════════════════════════════════════════════════════════════
// Hold Unit Details — same DispatchHold data as Quality's Hold Cabinet
// Details report, scoped to a single FG Serial instead of a date range.
// ═══════════════════════════════════════════════════════════════════
export const getHoldDetails = tryCatch(async (req, res) => {
  const { componentIdentifier } = req.query;
  if (!componentIdentifier) throw new AppError("Component Identifier is required", 400);

  const query = `
    SELECT
      m.Name                                              AS ModelNo,
      dh.Serial                                           AS FGSerialNo,
      dh.DefectCode                                       AS HoldReason,
      dh.ResponsibleDepartment                            AS ResponsibleDepartment,
      dh.ResponsibleHOD                                   AS ResponsibleHOD,
      dh.TargetDateOfReworkCompletion                     AS TargetDateOfReworkCompletion,
      dh.HoldDatetime                                     AS HoldDate,
      u.UserName                                          AS HoldBy,
      DATEDIFF(
        DAY,
        dh.HoldDateTime,
        ISNULL(dh.ReleasedDateTime, GETDATE())
      )                                                   AS DaysOnHold,
      ISNULL(dh.Action, 'Not Released')                  AS CorrectiveAction,
      dh.ReleasedDateTime                                 AS ReleasedOn,
      us.UserName                                         AS ReleasedBy,
      CASE
        WHEN dh.ReleasedDateTime IS NULL THEN 'Hold'
        ELSE 'Release'
      END                                                 AS Status
    FROM DispatchHold AS dh
    INNER JOIN MaterialBarcode mb ON mb.Serial  = dh.Serial
    INNER JOIN Material        m  ON m.MatCode  = dh.Material
    LEFT  JOIN Users           u  ON u.UserCode = dh.HoldUserCode
    LEFT  JOIN Users           us ON us.UserCode = dh.ReleasedUserCode
    WHERE dh.Serial = @componentIdentifier
    ORDER BY dh.HoldDatetime DESC;
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();
  try {
    const result = await pool.request()
      .input("componentIdentifier", sql.NVarChar, componentIdentifier)
      .query(query);
    res.status(200).json({ success: true, message: "Hold Details retrieved", data: result.recordset });
  } catch (err) {
    throw new AppError(`Failed to fetch Hold Details: ${err.message}`, 500);
  } finally {
    await pool.close();
  }
});

export const getSerialNumbers = tryCatch(async (req, res) => {
  const { componentIdentifier } = req.query;
  if (!componentIdentifier) throw new AppError("Component Identifier is required", 400);
 
  const query = `
    DECLARE @PSNo BIGINT;
    SELECT TOP 1 @PSNo = PSNo
    FROM ProcessStageLabel
    WHERE BarcodeNo = @componentIdentifier;
 
    IF @PSNo IS NULL
    BEGIN
      SELECT NULL AS BarcodeNo, NULL AS PSNo, NULL AS Type, NULL AS CreatedOn WHERE 1 = 0;
      RETURN;
    END
 
    -- Return all barcodes linked to the same production order
    SELECT
      psl.*,
      mb.Type         AS BarcodeType,
      mb.Material,
      m.Name          AS MaterialName,
      m.Alias         AS SAPCode
    FROM ProcessStageLabel psl
    LEFT JOIN MaterialBarcode mb ON mb.Serial = psl.BarcodeNo OR mb.Alias = psl.BarcodeNo
    LEFT JOIN Material m         ON m.MatCode = mb.Material
    WHERE psl.PSNo = @PSNo
    ORDER BY psl.BarcodeNo ASC;
  `;
 
  const pool = await new sql.ConnectionPool(dbConfig1).connect();
  try {
    const result = await pool.request()
      .input("componentIdentifier", sql.NVarChar, componentIdentifier)
      .query(query);
    res.status(200).json({
      success: true,
      message: result.recordset.length
        ? "Serial Numbers retrieved"
        : "No serial numbers found for this identifier",
      data: result.recordset,
    });
  } catch (err) {
    throw new AppError(`Failed to fetch Serial Numbers: ${err.message}`, 500);
  } finally {
    await pool.close();
  }
});