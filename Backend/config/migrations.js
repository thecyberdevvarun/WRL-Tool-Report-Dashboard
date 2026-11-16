// All schema migrations are idempotent — safe to run on every server start.
// Add new migrations at the bottom of the runMigrations function.

export const runMigrations = async (pool3) => {
  // ── AuditTemplates: add Models column ────────────────────────────────────
  await pool3.request().query(`
    IF EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME = 'AuditTemplates'
    )
    AND NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'AuditTemplates' AND COLUMN_NAME = 'Models'
    )
    BEGIN
      ALTER TABLE AuditTemplates ADD Models NVARCHAR(MAX) NULL;
      PRINT 'Migration: Added Models column to AuditTemplates';
    END
  `);

  // ── Audits: add StartedAt column ─────────────────────────────────────────
  await pool3.request().query(`
    IF EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME = 'Audits'
    )
    AND NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'Audits' AND COLUMN_NAME = 'StartedAt'
    )
    BEGIN
      ALTER TABLE Audits ADD StartedAt DATETIME NULL;
      PRINT 'Migration: Added StartedAt column to Audits';
    END
  `);

  // ── Create AuditTemplateHistory table ────────────────────────────────────
  await pool3.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME = 'AuditTemplateHistory'
    )
    BEGIN
      CREATE TABLE AuditTemplateHistory (
        Id             INT IDENTITY(1,1) PRIMARY KEY,
        TemplateId     INT           NOT NULL,
        Action         NVARCHAR(50)  NOT NULL,
        ActionBy       NVARCHAR(100) NULL,
        ActionAt       DATETIME      NOT NULL DEFAULT GETDATE(),
        Comments       NVARCHAR(MAX) NULL,
        PreviousStatus NVARCHAR(50)  NULL,
        NewStatus      NVARCHAR(50)  NULL,
        FieldChanges   NVARCHAR(MAX) NULL
      );
      PRINT 'Migration: Created AuditTemplateHistory table';
    END
  `);

  // ── Create LeaveRequests table ───────────────────────────────────────────
  await pool3.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME = 'LeaveRequests'
    )
    BEGIN
      CREATE TABLE LeaveRequests (
        Id              INT IDENTITY(1,1) PRIMARY KEY,
        EmpCode         NVARCHAR(50)   NOT NULL,
        EmpName         NVARCHAR(200)  NULL,
        Department      NVARCHAR(200)  NULL,
        LeaveType       NVARCHAR(10)   NOT NULL,
        FromDate        DATE           NOT NULL,
        ToDate          DATE           NOT NULL,
        TotalDays       DECIMAL(5,1)   NOT NULL DEFAULT 1,
        Reason          NVARCHAR(MAX)  NULL,
        Status          NVARCHAR(20)   NOT NULL DEFAULT 'pending',
        AppliedAt       DATETIME       NOT NULL DEFAULT GETDATE(),
        ApprovedBy      NVARCHAR(200)  NULL,
        ApprovedAt      DATETIME       NULL,
        RejectionReason NVARCHAR(MAX)  NULL
      );
      PRINT 'Migration: Created LeaveRequests table';
    END
  `);

  // ── ApprenticeEmployees ───────────────────────────────────────────────────
  await pool3.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='ApprenticeEmployees')
    BEGIN
      CREATE TABLE ApprenticeEmployees (
        Id          INT IDENTITY(1,1) PRIMARY KEY,
        EmpCode     NVARCHAR(50)  NOT NULL,
        EmpName     NVARCHAR(200) NOT NULL,
        Department  NVARCHAR(200) NULL,
        Category    NVARCHAR(200) NULL,
        Designation NVARCHAR(200) NULL,
        BankAccount NVARCHAR(100) NULL,
        IFSC        NVARCHAR(50)  NULL,
        UAN         NVARCHAR(50)  NULL,
        ESIC        NVARCHAR(50)  NULL,
        IsActive    BIT           NOT NULL DEFAULT 1,
        CreatedAt   DATETIME      NOT NULL DEFAULT GETDATE(),
        UpdatedAt   DATETIME      NOT NULL DEFAULT GETDATE(),
        CONSTRAINT UQ_AppEmp_Code UNIQUE (EmpCode)
      );
    END
  `);

  // ── ApprenticeUploadLogs ──────────────────────────────────────────────────
  await pool3.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='ApprenticeUploadLogs')
    BEGIN
      CREATE TABLE ApprenticeUploadLogs (
        Id            INT IDENTITY(1,1) PRIMARY KEY,
        SalaryMonth   INT           NOT NULL,
        SalaryYear    INT           NOT NULL,
        UploadedBy    NVARCHAR(200) NULL,
        RowsTotal     INT           NOT NULL DEFAULT 0,
        RowsOk        INT           NOT NULL DEFAULT 0,
        RowsFailed    INT           NOT NULL DEFAULT 0,
        Status        NVARCHAR(20)  NOT NULL DEFAULT 'processing',
        ErrorLog      NVARCHAR(MAX) NULL,
        UploadedAt    DATETIME      NOT NULL DEFAULT GETDATE()
      );
    END
  `);

  // ── ApprenticeSalarySlips ─────────────────────────────────────────────────
  await pool3.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='ApprenticeSalarySlips')
    BEGIN
      CREATE TABLE ApprenticeSalarySlips (
        Id              INT IDENTITY(1,1) PRIMARY KEY,
        UploadBatchId   INT            NULL,
        EmpCode         NVARCHAR(50)   NOT NULL,
        LabourId        NVARCHAR(60)   NULL,
        Email           NVARCHAR(200)  NULL,
        MobileNo        NVARCHAR(20)   NULL,
        EmpName         NVARCHAR(200)  NULL,
        Category        NVARCHAR(200)  NULL,
        Department      NVARCHAR(200)  NULL,
        Location        NVARCHAR(120)  NULL,
        DateOfJoining   NVARCHAR(20)   NULL,
        SalaryMonth     INT            NOT NULL,
        SalaryYear      INT            NOT NULL,
        PresentDays     DECIMAL(5,1)   NULL DEFAULT 0,
        LOP             DECIMAL(5,1)   NULL DEFAULT 0,
        OtherAllowance  DECIMAL(12,2)  NULL DEFAULT 0,
        Arrear          DECIMAL(12,2)  NULL DEFAULT 0,
        CompanyStipend  DECIMAL(12,2)  NULL DEFAULT 0,
        GovernmentDBT   DECIMAL(12,2)  NULL DEFAULT 0,
        TotalStipend    DECIMAL(12,2)  NULL DEFAULT 0,
        Incentive       DECIMAL(12,2)  NULL DEFAULT 0,
        GrossAmount     DECIMAL(12,2)  NULL DEFAULT 0,
        Canteen         DECIMAL(12,2)  NULL DEFAULT 0,
        HostelRent      DECIMAL(12,2)  NULL DEFAULT 0,
        Electricity     DECIMAL(12,2)  NULL DEFAULT 0,
        Uniform         DECIMAL(12,2)  NULL DEFAULT 0,
        Shoes           DECIMAL(12,2)  NULL DEFAULT 0,
        OtherDed        DECIMAL(12,2)  NULL DEFAULT 0,
        NetDeduction    DECIMAL(12,2)  NULL DEFAULT 0,
        NetPayment      DECIMAL(12,2)  NULL DEFAULT 0,
        Status          NVARCHAR(20)   NOT NULL DEFAULT 'draft',
        EmailedAt       DATETIME       NULL,
        CreatedAt       DATETIME       NOT NULL DEFAULT GETDATE(),
        UpdatedAt       DATETIME       NOT NULL DEFAULT GETDATE(),
        CONSTRAINT UQ_AppSlip UNIQUE (EmpCode, SalaryMonth, SalaryYear)
      );
    END
  `);

  // ── ApprenticeSalarySlips: rename legacy columns to match current schema ─
  for (const [oldName, newName] of [
    ["GrossPay",        "GrossAmount"],
    ["Hostel",          "HostelRent"],
    ["OtherDeductions", "OtherDed"],
    ["TotalDeductions", "NetDeduction"],
    ["NetPay",          "NetPayment"],
  ]) {
    await pool3.request().query(`
      IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='ApprenticeSalarySlips' AND COLUMN_NAME='${oldName}')
      AND NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='ApprenticeSalarySlips' AND COLUMN_NAME='${newName}')
      BEGIN
        EXEC sp_rename 'ApprenticeSalarySlips.${oldName}', '${newName}', 'COLUMN';
        PRINT 'Migration: Renamed ApprenticeSalarySlips.${oldName} to ${newName}';
      END
    `);
  }

  // ── ApprenticeSalarySlips: add columns introduced by the current schema ──
  for (const col of [
    { name: "LabourId",       def: "NVARCHAR(60)  NULL" },
    { name: "Email",          def: "NVARCHAR(200) NULL" },
    { name: "MobileNo",       def: "NVARCHAR(20)  NULL" },
    { name: "Location",       def: "NVARCHAR(120) NULL" },
    { name: "DateOfJoining",  def: "NVARCHAR(20)  NULL" },
    { name: "LOP",            def: "DECIMAL(5,1)  NULL DEFAULT 0" },
    { name: "OtherAllowance", def: "DECIMAL(12,2) NULL DEFAULT 0" },
    { name: "Arrear",         def: "DECIMAL(12,2) NULL DEFAULT 0" },
    { name: "CompanyStipend", def: "DECIMAL(12,2) NULL DEFAULT 0" },
    { name: "GovernmentDBT",  def: "DECIMAL(12,2) NULL DEFAULT 0" },
    { name: "TotalStipend",   def: "DECIMAL(12,2) NULL DEFAULT 0" },
    { name: "GrossAmount",    def: "DECIMAL(12,2) NULL DEFAULT 0" },
    { name: "HostelRent",     def: "DECIMAL(12,2) NULL DEFAULT 0" },
    { name: "OtherDed",       def: "DECIMAL(12,2) NULL DEFAULT 0" },
    { name: "NetDeduction",   def: "DECIMAL(12,2) NULL DEFAULT 0" },
    { name: "NetPayment",     def: "DECIMAL(12,2) NULL DEFAULT 0" },
    { name: "EmailedAt",      def: "DATETIME      NULL" },
  ]) {
    await pool3.request().query(`
      IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ApprenticeSalarySlips')
      AND NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'ApprenticeSalarySlips' AND COLUMN_NAME = '${col.name}'
      )
      BEGIN
        ALTER TABLE ApprenticeSalarySlips ADD ${col.name} ${col.def};
        PRINT 'Migration: Added ${col.name} column to ApprenticeSalarySlips';
      END
    `);
  }

  // ── AuditTemplates: add approval-workflow columns ────────────────────────
  for (const col of [
    { name: "ApprovalStatus",  def: "NVARCHAR(50)  NULL DEFAULT 'draft'" },
    { name: "ApprovedBy",      def: "NVARCHAR(200) NULL" },
    { name: "ApprovedAt",      def: "DATETIME      NULL" },
    { name: "RejectionReason", def: "NVARCHAR(MAX) NULL" },
  ]) {
    await pool3.request().query(`
      IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'AuditTemplates')
      AND NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'AuditTemplates' AND COLUMN_NAME = '${col.name}'
      )
      BEGIN
        ALTER TABLE AuditTemplates ADD ${col.name} ${col.def};
        PRINT 'Migration: Added ${col.name} column to AuditTemplates';
      END
    `);
  }

  // ── Audits: allow 'rework' as a valid Status value ───────────────────────
  // Drop any CHECK constraint on Audits.Status so 'rework' is accepted.
  // If no constraint exists this is a no-op.
  await pool3.request().query(`
    DECLARE @cname NVARCHAR(200);
    SELECT TOP 1 @cname = cc.CONSTRAINT_NAME
    FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS cc
    JOIN INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE ccu
      ON cc.CONSTRAINT_NAME = ccu.CONSTRAINT_NAME
    WHERE ccu.TABLE_NAME = 'Audits' AND ccu.COLUMN_NAME = 'Status';
    IF @cname IS NOT NULL
      EXEC('ALTER TABLE Audits DROP CONSTRAINT [' + @cname + ']');
  `);

  // ── AuditHistory: ensure Comments column exists ───────────────────────────
  await pool3.request().query(`
    IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'AuditHistory')
    AND NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'AuditHistory' AND COLUMN_NAME = 'Comments'
    )
    BEGIN
      ALTER TABLE AuditHistory ADD Comments NVARCHAR(MAX) NULL;
      PRINT 'Migration: Added Comments column to AuditHistory';
    END
  `);

  // ── PartProcessEvents: machine event log synced from FactoryOS API ──────────
  await pool3.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'PartProcessEvents'
    )
    BEGIN
      CREATE TABLE PartProcessEvents (
        EventId        NVARCHAR(50)   NOT NULL PRIMARY KEY,
        EventDate      DATE           NOT NULL,
        ShiftName      NVARCHAR(100)  NULL,
        EventType      NVARCHAR(20)   NULL,
        Barcode        NVARCHAR(500)  NULL,
        StartTime      NVARCHAR(10)   NULL,
        EndTime        NVARCHAR(10)   NULL,
        Duration       NVARCHAR(15)   NULL,
        PartsQty       INT            NOT NULL DEFAULT 0,
        PartsQuality   NVARCHAR(20)   NULL,
        OperatorName   NVARCHAR(200)  NULL,
        DowntimeReason NVARCHAR(500)  NULL,
        DowntimeComment NVARCHAR(MAX) NULL,
        AssetName      NVARCHAR(200)  NULL,
        LineName       NVARCHAR(200)  NULL,
        Energy         FLOAT          NOT NULL DEFAULT 0,
        SyncedAt       DATETIME       NOT NULL DEFAULT GETDATE()
      );
      CREATE INDEX IX_PPE_Date      ON PartProcessEvents (EventDate);
      CREATE INDEX IX_PPE_DateShift ON PartProcessEvents (EventDate, ShiftName);
      PRINT 'Migration: Created PartProcessEvents table';
    END
  `);

  // ── PartProcessSyncLog: FactoryOS import history ─────────────────────────
  await pool3.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'PartProcessSyncLog'
    )
    BEGIN
      CREATE TABLE PartProcessSyncLog (
        Id            INT IDENTITY(1,1) PRIMARY KEY,
        SyncDate      DATE           NOT NULL,
        StartedAt     DATETIME       NOT NULL,
        CompletedAt   DATETIME       NOT NULL DEFAULT GETDATE(),
        Status        NVARCHAR(20)   NOT NULL,
        RecordsSynced INT            NULL,
        Message       NVARCHAR(MAX)  NULL
      );
      CREATE INDEX IX_PPSL_CompletedAt ON PartProcessSyncLog (CompletedAt DESC);
      PRINT 'Migration: Created PartProcessSyncLog table';
    END
  `);

  // ── MaterialConfigs: Master Config > Material Config ─────────────────────
  await pool3.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='MaterialConfigs')
    BEGIN
      CREATE TABLE MaterialConfigs (
        Id                        INT IDENTITY(1,1) PRIMARY KEY,
        SapCode                   NVARCHAR(50)   NOT NULL,
        PartName                  NVARCHAR(300)  NULL,
        Category                  NVARCHAR(100)  NULL,
        Length                    DECIMAL(12,3)  NULL,
        Width                     DECIMAL(12,3)  NULL,
        Thickness                 DECIMAL(12,3)  NULL,
        Weight                    DECIMAL(12,3)  NULL,
        ComponentWeight           DECIMAL(12,3)  NULL,
        ScrapWeight               DECIMAL(12,3)  NULL,
        NoOfSheet                 DECIMAL(12,3)  NULL,
        ActualComponentsPerSheet  DECIMAL(12,3)  NULL,
        PncLoadingUnloading       DECIMAL(12,3)  NULL,
        DefinedComponentCycleTime DECIMAL(12,3)  NULL,
        DrawingNumber             NVARCHAR(100)  NULL,
        DrawingRevision           NVARCHAR(50)   NULL,
        Status                    BIT            NOT NULL DEFAULT 1,
        CreatedAt                 DATETIME       NOT NULL DEFAULT GETDATE(),
        UpdatedAt                 DATETIME       NOT NULL DEFAULT GETDATE(),
        CONSTRAINT UQ_MaterialConfig_SapCode UNIQUE (SapCode)
      );
      PRINT 'Migration: Created MaterialConfigs table';
    END
  `);

  // ── ShiftConfigs: Master Config > Shift Config ────────────────────────────
  await pool3.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='ShiftConfigs')
    BEGIN
      CREATE TABLE ShiftConfigs (
        Id            INT IDENTITY(1,1) PRIMARY KEY,
        ShiftName     NVARCHAR(100) NOT NULL,
        ShiftCode     NVARCHAR(20)  NULL,
        StartTime     NVARCHAR(10)  NULL,
        EndTime       NVARCHAR(10)  NULL,
        BreakStart    NVARCHAR(10)  NULL,
        BreakEnd      NVARCHAR(10)  NULL,
        TeaBreaks     NVARCHAR(10)  NULL,
        Color         NVARCHAR(20)  NULL,
        OvertimeShift BIT           NOT NULL DEFAULT 0,
        WeeklyOff     NVARCHAR(200) NULL,
        Status        BIT           NOT NULL DEFAULT 1,
        CreatedAt     DATETIME      NOT NULL DEFAULT GETDATE(),
        UpdatedAt     DATETIME      NOT NULL DEFAULT GETDATE()
      );
      INSERT INTO ShiftConfigs (ShiftName, ShiftCode, StartTime, EndTime, BreakStart, BreakEnd, TeaBreaks, Color, OvertimeShift, WeeklyOff, Status) VALUES
        ('Shift 1', 'S1', '08:00', '16:00', '12:00', '12:30', '2', '#3b82f6', 0, 'Sunday', 1),
        ('Shift 2', 'S2', '16:00', '00:00', '20:00', '20:30', '2', '#8b5cf6', 0, 'Sunday', 1),
        ('Shift 3', 'S3', '00:00', '08:00', '04:00', '04:30', '1', '#f59e0b', 0, 'Sunday', 1);
      PRINT 'Migration: Created ShiftConfigs table';
    END
  `);

  // ── MasterDepartments: Master Config > Downtime Config (department list) ─
  // Named "MasterDepartments" (not "Departments") to avoid colliding with the
  // pre-existing lowercase "departments" table used by employee management.
  await pool3.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='MasterDepartments')
    BEGIN
      CREATE TABLE MasterDepartments (
        Id        INT IDENTITY(1,1) PRIMARY KEY,
        Name      NVARCHAR(200) NOT NULL,
        Status    BIT           NOT NULL DEFAULT 1,
        CreatedAt DATETIME      NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME      NOT NULL DEFAULT GETDATE(),
        CONSTRAINT UQ_MasterDepartment_Name UNIQUE (Name)
      );
      INSERT INTO MasterDepartments (Name, Status) VALUES
        ('Maintenance', 1),
        ('Production',  1),
        ('Quality',     1),
        ('Stores',      1),
        ('Electrical',  1),
        ('HR',          1);
      PRINT 'Migration: Created MasterDepartments table';
    END
  `);

  // ── DowntimeReasons: Master Config > Downtime Config ─────────────────────
  await pool3.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='DowntimeReasons')
    BEGIN
      CREATE TABLE DowntimeReasons (
        Id         INT IDENTITY(1,1) PRIMARY KEY,
        DtCode     NVARCHAR(50)  NULL,
        Reason     NVARCHAR(300) NOT NULL,
        Department NVARCHAR(200) NULL,
        Status     BIT           NOT NULL DEFAULT 1,
        CreatedAt  DATETIME      NOT NULL DEFAULT GETDATE(),
        UpdatedAt  DATETIME      NOT NULL DEFAULT GETDATE()
      );
      INSERT INTO DowntimeReasons (DtCode, Reason, Department, Status) VALUES
        ('DT001', 'Machine Breakdown',      'Maintenance', 1),
        ('DT002', 'Tool Change',            'Production',  1),
        ('DT003', 'Material Shortage',      'Stores',      1),
        ('DT004', 'No Operator',            'HR',          1),
        ('DT005', 'Quality Issue',          'Quality',     1),
        ('DT006', 'Power Failure',          'Electrical',  1),
        ('DT007', 'Preventive Maintenance', 'Maintenance', 1),
        ('DT008', 'Setup & Changeover',     'Production',  1),
        ('DT009', 'Others',                 '',            1);
      PRINT 'Migration: Created DowntimeReasons table';
    END
  `);

  // ── QualityDefects: Master Config > Quality Config ───────────────────────
  await pool3.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='QualityDefects')
    BEGIN
      CREATE TABLE QualityDefects (
        Id           INT IDENTITY(1,1) PRIMARY KEY,
        QCode        NVARCHAR(50)  NULL,
        DefectName   NVARCHAR(300) NOT NULL,
        Category     NVARCHAR(100) NULL,
        Type         NVARCHAR(50)  NULL,
        Severity     NVARCHAR(50)  NULL,
        Stage        NVARCHAR(100) NULL,
        RootCause    NVARCHAR(300) NULL,
        CapaRequired BIT           NOT NULL DEFAULT 0,
        Status       BIT           NOT NULL DEFAULT 1,
        CreatedAt    DATETIME      NOT NULL DEFAULT GETDATE(),
        UpdatedAt    DATETIME      NOT NULL DEFAULT GETDATE()
      );
      INSERT INTO QualityDefects (QCode, DefectName, Category, Type, Severity, Stage, RootCause, CapaRequired, Status) VALUES
        ('QD001', 'Dimensional Variation', 'Dimensional',    'Rework',    'Major',    'In-Process',       'Tool Wear',        1, 1),
        ('QD002', 'Surface Finish Defect', 'Surface Finish', 'Rejection', 'Major',    'Final Inspection', 'Wrong Parameters', 1, 1),
        ('QD003', 'Burr / Sharp Edge',     'Process',        'Rework',    'Minor',    'In-Process',       'Tool Condition',   0, 1),
        ('QD004', 'Crack / Fracture',      'Material',       'Rejection', 'Critical', 'Incoming',         'Material Defect',  1, 1),
        ('QD005', 'Wrong Assembly',        'Assembly',       'Rework',    'Major',    'In-Process',       'Method Issue',     1, 1),
        ('QD006', 'Porosity',              'Material',       'Rejection', 'Critical', 'Incoming',         'Casting Defect',   1, 1),
        ('QD007', 'Paint Peel-off',        'Cosmetic',       'Rework',    'Minor',    'Final Inspection', 'Surface Prep',     0, 1),
        ('QD008', 'Wrong Material',        'Material',       'Hold',      'Critical', 'Incoming',         'Supplier',         1, 1);
      PRINT 'Migration: Created QualityDefects table';
    END
  `);

  // ── Machines: Master Config > Machine Config ─────────────────────────────
  await pool3.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='Machines')
    BEGIN
      CREATE TABLE Machines (
        Id             INT IDENTITY(1,1) PRIMARY KEY,
        MachineName    NVARCHAR(200)  NOT NULL,
        MachineCode    NVARCHAR(50)   NOT NULL,
        IpAddress      NVARCHAR(50)   NULL,
        ControllerType NVARCHAR(50)   NULL,
        ApiEndpoint    NVARCHAR(300)  NULL,
        Department     NVARCHAR(200)  NULL,
        LineName       NVARCHAR(100)  NULL,
        PlantLocation  NVARCHAR(100)  NULL,
        ImagePath      NVARCHAR(300)  NULL,
        Connected      BIT            NOT NULL DEFAULT 0,
        Status         BIT            NOT NULL DEFAULT 1,
        CreatedAt      DATETIME       NOT NULL DEFAULT GETDATE(),
        UpdatedAt      DATETIME       NOT NULL DEFAULT GETDATE(),
        CONSTRAINT UQ_Machine_Code UNIQUE (MachineCode)
      );
      PRINT 'Migration: Created Machines table';
    END
  `);

  // ── ProductionPlans: Master Config > Planning Configuration ──────────────
  await pool3.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='ProductionPlans')
    BEGIN
      CREATE TABLE ProductionPlans (
        Id                 INT IDENTITY(1,1) PRIMARY KEY,
        MachineName        NVARCHAR(200)  NOT NULL,
        SapCode            NVARCHAR(50)   NOT NULL,
        PartName           NVARCHAR(300)  NULL,
        ModelCode          NVARCHAR(100)  NULL,
        TargetQty          DECIMAL(14,2)  NOT NULL DEFAULT 0,
        Shift              NVARCHAR(50)   NOT NULL DEFAULT 'All Shifts',
        PlanDate           DATE           NOT NULL,
        Priority           NVARCHAR(20)   NOT NULL DEFAULT 'Medium',
        Customer           NVARCHAR(200)  NULL,
        Status             BIT            NOT NULL DEFAULT 1,
        CreatedAt          DATETIME       NOT NULL DEFAULT GETDATE(),
        UpdatedAt          DATETIME       NOT NULL DEFAULT GETDATE(),
        CONSTRAINT UQ_ProductionPlan_Key UNIQUE (SapCode, MachineName, PlanDate, Shift)
      );
      CREATE INDEX IX_ProductionPlan_SapDate ON ProductionPlans (SapCode, PlanDate);
      PRINT 'Migration: Created ProductionPlans table';
    END
  `);

  // ── ProductionPlans: drop PlannedCycleTime — MaterialConfigs.
  //    DefinedComponentCycleTime (looked up by SapCode) is now the single
  //    source of truth for cycle time, instead of duplicating/re-entering it
  //    per plan. Every existing plan's SapCode already has a
  //    DefinedComponentCycleTime configured, so this is not a data-coverage
  //    regression.
  await pool3.request().query(`
    IF EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'ProductionPlans' AND COLUMN_NAME = 'PlannedCycleTime'
    )
    BEGIN
      ALTER TABLE ProductionPlans DROP COLUMN PlannedCycleTime;
      PRINT 'Migration: Dropped PlannedCycleTime column from ProductionPlans';
    END
  `);

  // ── AuditTemplates: add version-integrity snapshot columns ───────────────
  for (const col of [
    { name: "TemplateHash",            def: "NVARCHAR(64)  NULL" },
    { name: "TemplateSize",            def: "INT           NULL" },
    { name: "SectionCount",            def: "INT           NULL" },
    { name: "StageCount",              def: "INT           NULL" },
    { name: "CheckpointCount",         def: "INT           NULL" },
    { name: "RequiredCheckpointCount", def: "INT           NULL" },
    { name: "JsonSchemaVersion",       def: "NVARCHAR(10)  NULL DEFAULT '1'" },
  ]) {
    await pool3.request().query(`
      IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'AuditTemplates')
      AND NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'AuditTemplates' AND COLUMN_NAME = '${col.name}'
      )
      BEGIN
        ALTER TABLE AuditTemplates ADD ${col.name} ${col.def};
        PRINT 'Migration: Added ${col.name} column to AuditTemplates';
      END
    `);
  }

  // ── AuditTemplateVersions: immutable per-version file+hash ledger ────────
  await pool3.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='AuditTemplateVersions')
    BEGIN
      CREATE TABLE AuditTemplateVersions (
        Id                      INT IDENTITY(1,1) PRIMARY KEY,
        TemplateId              INT           NOT NULL,
        Version                 NVARCHAR(20)  NOT NULL,
        TemplateFileName        NVARCHAR(500) NOT NULL,
        TemplateHash            NVARCHAR(64)  NOT NULL,
        TemplateSize            INT           NOT NULL DEFAULT 0,
        SectionCount            INT           NOT NULL DEFAULT 0,
        StageCount              INT           NOT NULL DEFAULT 0,
        CheckpointCount         INT           NOT NULL DEFAULT 0,
        RequiredCheckpointCount INT           NOT NULL DEFAULT 0,
        JsonSchemaVersion       NVARCHAR(10)  NULL DEFAULT '1',
        IsLatest                BIT           NOT NULL DEFAULT 0,
        CreatedBy               NVARCHAR(200) NULL,
        CreatedAt               DATETIME      NOT NULL DEFAULT GETDATE(),
        CONSTRAINT UQ_TemplateVersion UNIQUE (TemplateId, Version)
      );
      CREATE INDEX IX_TemplateVersions_TemplateId ON AuditTemplateVersions (TemplateId);
      PRINT 'Migration: Created AuditTemplateVersions table';
    END
  `);

  // ── Audits: hardened template linkage (Phase 2) ──────────────────────────
  // Permanent snapshot of which template VERSION/FILE/HASH an audit was
  // created against, stamped server-side at creation time. Existing rows
  // have no source of truth to backfill from, so they stay NULL forever —
  // an accepted, documented gap (unlike Phase 1's hash backfill).
  for (const col of [
    { name: "TemplateVersion",  def: "NVARCHAR(20)  NULL" },
    { name: "TemplateFileName", def: "NVARCHAR(500) NULL" },
    { name: "TemplateHash",     def: "NVARCHAR(64)  NULL" },
    { name: "TemplateSize",     def: "INT           NULL" },
  ]) {
    await pool3.request().query(`
      IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Audits')
      AND NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'Audits' AND COLUMN_NAME = '${col.name}'
      )
      BEGIN
        ALTER TABLE Audits ADD ${col.name} ${col.def};
        PRINT 'Migration: Added ${col.name} column to Audits';
      END
    `);
  }

  // ── CheckpointLibrary: Master Config > Checkpoint Library (Phase 3) ──────
  // Global, admin-curated reusable checkpoints. No FK to AuditTemplates —
  // inserting a library checkpoint into a template makes a fully
  // independent local copy (fresh permanent UUID), same spirit as
  // duplicateTemplate.
  await pool3.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='CheckpointLibrary')
    BEGIN
      CREATE TABLE CheckpointLibrary (
        Id            INT IDENTITY(1,1) PRIMARY KEY,
        CheckPointText NVARCHAR(500) NOT NULL,
        Method        NVARCHAR(300) NULL,
        Specification NVARCHAR(500) NULL,
        Category      NVARCHAR(100) NULL,
        Required      BIT           NOT NULL DEFAULT 0,
        UsageCount    INT           NOT NULL DEFAULT 0,
        Status        BIT           NOT NULL DEFAULT 1,
        CreatedBy     NVARCHAR(200) NULL,
        CreatedAt     DATETIME      NOT NULL DEFAULT GETDATE(),
        UpdatedBy     NVARCHAR(200) NULL,
        UpdatedAt     DATETIME      NOT NULL DEFAULT GETDATE()
      );
      PRINT 'Migration: Created CheckpointLibrary table';
    END
  `);

  // ── AuditTemplates: pointer to the current active version's content (Phase 5) ─
  await pool3.request().query(`
    IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'AuditTemplates')
    AND NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'AuditTemplates' AND COLUMN_NAME = 'CurrentVersionContentId'
    )
    BEGIN
      ALTER TABLE AuditTemplates ADD CurrentVersionContentId INT NULL;
      PRINT 'Migration: Added CurrentVersionContentId column to AuditTemplates';
    END
  `);

  // ── AuditTemplateContent: SQL-backed, immutable per-version content (Phase 5) ─
  // Replaces JSON-file storage as the source of truth. TemplateId stays stable
  // across versions (AuditTemplates.Id never changes); each row here is one
  // immutable version's content. Only IsActiveVersion and the approval-status
  // fields on the currently-active row are ever updated after insert.
  await pool3.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='AuditTemplateContent')
    BEGIN
      CREATE TABLE AuditTemplateContent (
        Id                      INT IDENTITY(1,1) PRIMARY KEY,
        TemplateId              INT            NOT NULL,
        Version                 NVARCHAR(20)   NOT NULL,
        HeaderConfig            NVARCHAR(MAX)  NOT NULL DEFAULT '{}',
        InfoFields              NVARCHAR(MAX)  NOT NULL DEFAULT '[]',
        Columns                 NVARCHAR(MAX)  NOT NULL DEFAULT '[]',
        DefaultSections         NVARCHAR(MAX)  NOT NULL DEFAULT '[]',
        ContentHash             NVARCHAR(64)   NOT NULL,
        ContentSize             INT            NOT NULL DEFAULT 0,
        SectionCount            INT            NOT NULL DEFAULT 0,
        StageCount              INT            NOT NULL DEFAULT 0,
        CheckpointCount         INT            NOT NULL DEFAULT 0,
        RequiredCheckpointCount INT            NOT NULL DEFAULT 0,
        JsonSchemaVersion       NVARCHAR(10)   NULL DEFAULT '1',
        ApprovalStatus          NVARCHAR(50)   NOT NULL DEFAULT 'draft',
        ApprovedBy              NVARCHAR(200)  NULL,
        ApprovedAt              DATETIME       NULL,
        RejectionReason         NVARCHAR(MAX)  NULL,
        IsActiveVersion         BIT            NOT NULL DEFAULT 0,
        ChangeType              NVARCHAR(20)   NOT NULL DEFAULT 'create',
        CreatedFromVersionId    INT            NULL,
        CreatedBy               NVARCHAR(200)  NULL,
        CreatedAt               DATETIME       NOT NULL DEFAULT GETDATE(),
        CONSTRAINT UQ_TemplateContent_Version UNIQUE (TemplateId, Version)
      );
      CREATE INDEX IX_TemplateContent_TemplateId ON AuditTemplateContent (TemplateId);
      CREATE INDEX IX_TemplateContent_ActiveLookup ON AuditTemplateContent (TemplateId, IsActiveVersion) WHERE IsActiveVersion = 1;
      PRINT 'Migration: Created AuditTemplateContent table';
    END
  `);

  // ── AuditTemplateHistory: per-version audit-trail columns (Phase 5) ──────
  for (const col of [
    { name: "VersionNumber",     def: "NVARCHAR(20) NULL" },
    { name: "PreviousVersion",   def: "NVARCHAR(20) NULL" },
    { name: "CreatedFromVersion", def: "NVARCHAR(20) NULL" },
  ]) {
    await pool3.request().query(`
      IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'AuditTemplateHistory')
      AND NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'AuditTemplateHistory' AND COLUMN_NAME = '${col.name}'
      )
      BEGIN
        ALTER TABLE AuditTemplateHistory ADD ${col.name} ${col.def};
        PRINT 'Migration: Added ${col.name} column to AuditTemplateHistory';
      END
    `);
  }

  // ── DrawingPath column on MaterialConfigs ────────────────────────────────
  await pool3.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'MaterialConfigs' AND COLUMN_NAME = 'DrawingPath'
    )
    BEGIN
      ALTER TABLE MaterialConfigs ADD DrawingPath NVARCHAR(500) NULL;
      PRINT 'Migration: Added DrawingPath column to MaterialConfigs';
    END
  `);

  // ── SheetSapCode / SheetDescription columns on MaterialConfigs ───────────
  // Identify the raw sheet the component is punched from, distinct from the
  // component's own SapCode/PartName.
  await pool3.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'MaterialConfigs' AND COLUMN_NAME = 'SheetSapCode'
    )
    BEGIN
      ALTER TABLE MaterialConfigs ADD SheetSapCode NVARCHAR(50) NULL;
      PRINT 'Migration: Added SheetSapCode column to MaterialConfigs';
    END
    IF NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'MaterialConfigs' AND COLUMN_NAME = 'SheetDescription'
    )
    BEGIN
      ALTER TABLE MaterialConfigs ADD SheetDescription NVARCHAR(300) NULL;
      PRINT 'Migration: Added SheetDescription column to MaterialConfigs';
    END
  `);

  // ── LPTReport: add LPTType column ────────────────────────────────────────
  await pool3.request().query(`
    IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'LPTReport')
    AND NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'LPTReport' AND COLUMN_NAME = 'LPTType'
    )
    BEGIN
      ALTER TABLE LPTReport ADD LPTType NVARCHAR(50) NULL DEFAULT 'LPT';
      UPDATE LPTReport SET LPTType = 'LPT' WHERE LPTType IS NULL;
      PRINT 'Migration: Added LPTType column to LPTReport';
    END
  `);

  // ── LPTRecipe: add BIS column and auto-classify existing records ─────────
  await pool3.request().query(`
    IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'LPTRecipe')
    AND NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'LPTRecipe' AND COLUMN_NAME = 'BIS'
    )
    BEGIN
      ALTER TABLE LPTRecipe ADD BIS NVARCHAR(50) NULL DEFAULT 'Non BIS';
      UPDATE LPTRecipe
        SET BIS = CASE WHEN LEFT(ModelName, 1) IN ('F', 'D') THEN 'BIS' ELSE 'Non BIS' END;
      PRINT 'Migration: Added BIS column to LPTRecipe and classified existing records';
    END
  `);

  // ── AppSettings: global key-value store (e.g. menu layout) ─────────────────
  await pool3.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='AppSettings')
    BEGIN
      CREATE TABLE AppSettings (
        SettingKey  NVARCHAR(100)  NOT NULL PRIMARY KEY,
        Value       NVARCHAR(MAX)  NULL,
        UpdatedBy   NVARCHAR(100)  NULL,
        UpdatedAt   DATETIME       NOT NULL DEFAULT GETDATE()
      );
      PRINT 'Migration: Created AppSettings table';
    END
  `);

  // ── ChatSessions / ChatMessages: AI assistant conversation storage ────────
  // ── Alerts: smart-alert log (threshold breaches detected at shift-end) ────
  await pool3.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='Alerts')
    BEGIN
      CREATE TABLE Alerts (
        Id             INT IDENTITY(1,1) PRIMARY KEY,
        ShiftName      NVARCHAR(100)  NOT NULL,
        AlertDate      DATE           NOT NULL,
        AlertType      NVARCHAR(50)   NOT NULL,
        MetricValue    DECIMAL(10,2)  NULL,
        ThresholdValue DECIMAL(10,2)  NULL,
        Message        NVARCHAR(MAX)  NULL,
        SentTo         NVARCHAR(MAX)  NULL,
        CreatedAt      DATETIME       NOT NULL DEFAULT GETDATE()
      );
      CREATE INDEX IX_Alerts_ShiftDate ON Alerts(AlertDate, ShiftName);
      PRINT 'Migration: Created Alerts table';
    END
  `);

  // ── Energy Meters (PDP/Meter/LiveReading/ReadingHistory/ConsumptionSummary/
  //    RollupCheckpoint/AlertLog) live under the pre-existing EnergyMon schema,
  //    owned and populated by an external Modbus-polling service — not managed
  //    here. See Backend/controllers/reading/energyMeter*.controller.js.

  // ── PartProcessEvents: add Status column (soft-exclude flag) ────────────
  // 1 = included in reports/calculations (default), 0 = excluded — for rows
  // known to be bad (e.g. a sync-gap placeholder covering a FactoryOS outage)
  // that should stay in the raw table for audit trail but never feed OEE/
  // cycle-time/report numbers. Every read of PartProcessEvents filters on
  // this. The FactoryOS sync's MERGE (write_part_process_events.mjs,
  // sync_factoryos_part_process_events.py) deliberately never references
  // Status in its UPDATE SET clause, so once a row is set to 0 it stays
  // excluded permanently — re-syncing can't silently flip it back.
  await pool3.request().query(`
    IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'PartProcessEvents')
    AND NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'PartProcessEvents' AND COLUMN_NAME = 'Status'
    )
    BEGIN
      ALTER TABLE PartProcessEvents ADD Status BIT NOT NULL DEFAULT 1;
      PRINT 'Migration: Added Status column to PartProcessEvents';
    END
  `);

  // ── ShiftConfigHistory: effective-dated snapshots of ShiftConfigs ─────────
  // ShiftConfigs itself is a flat "current state" table with no history —
  // editing a shift's timing (Shift Master admin UI) overwrites in place, so
  // any report/dashboard rendering a HISTORICAL date was silently using
  // TODAY's shift timing instead of what was actually in effect back then.
  // This table is the fix: an append-only, never-UPDATEd log of shift
  // snapshots, each tagged with the DATETIME it started applying
  // (EffectiveFrom). Resolving "shift X as of date Y" means picking the
  // snapshot with the latest EffectiveFrom <= Y. Written to (never mutated)
  // by shifts.controller.js's createShift/updateShift.
  await pool3.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='ShiftConfigHistory')
    BEGIN
      CREATE TABLE ShiftConfigHistory (
        Id            INT IDENTITY(1,1) PRIMARY KEY,
        ShiftId       INT           NOT NULL, -- not FK-constrained: history must survive shift deletion
        ShiftName     NVARCHAR(100) NOT NULL,
        ShiftCode     NVARCHAR(20)  NULL,
        StartTime     NVARCHAR(10)  NULL,
        EndTime       NVARCHAR(10)  NULL,
        BreakStart    NVARCHAR(10)  NULL,
        BreakEnd      NVARCHAR(10)  NULL,
        TeaBreaks     NVARCHAR(10)  NULL,
        Color         NVARCHAR(20)  NULL,
        OvertimeShift BIT           NOT NULL DEFAULT 0,
        WeeklyOff     NVARCHAR(200) NULL,
        Status        BIT           NOT NULL DEFAULT 1,
        EffectiveFrom DATETIME      NOT NULL,
        CreatedAt     DATETIME      NOT NULL DEFAULT GETDATE()
      );
      CREATE INDEX IX_ShiftConfigHistory_ShiftId_EffectiveFrom ON ShiftConfigHistory (ShiftId, EffectiveFrom);

      -- Baseline: seed one snapshot per existing shift from its current
      -- values, effective since it was last saved (UpdatedAt).
      INSERT INTO ShiftConfigHistory (ShiftId, ShiftName, ShiftCode, StartTime, EndTime, BreakStart, BreakEnd, TeaBreaks, Color, OvertimeShift, WeeklyOff, Status, EffectiveFrom)
      SELECT Id, ShiftName, ShiftCode, StartTime, EndTime, BreakStart, BreakEnd, TeaBreaks, Color, OvertimeShift, WeeklyOff, Status, UpdatedAt
      FROM ShiftConfigs;

      -- One-time manual correction: Shift 1's EndTime was 20:00 before it
      -- was edited to 18:00 on 2026-07-21 (confirmed with the user; the old
      -- value isn't recoverable from ShiftConfigs itself since the UPDATE
      -- overwrote it with no record). Backdates an earlier snapshot so
      -- dates before the edit resolve correctly.
      INSERT INTO ShiftConfigHistory (ShiftId, ShiftName, ShiftCode, StartTime, EndTime, BreakStart, BreakEnd, TeaBreaks, Color, OvertimeShift, WeeklyOff, Status, EffectiveFrom)
      SELECT Id, ShiftName, ShiftCode, StartTime, '20:00', BreakStart, BreakEnd, TeaBreaks, Color, OvertimeShift, WeeklyOff, Status, CreatedAt
      FROM ShiftConfigs WHERE ShiftName = 'Shift 1';

      PRINT 'Migration: Created ShiftConfigHistory table (+ Shift 1 backdated correction)';
    END
  `);

  // ── MaterialConfigs: Actual Component Cycle Time (computed from real
  //    PartProcessEvents production data, alongside the existing manually-
  //    entered DefinedComponentCycleTime) ───────────────────────────────────
  for (const col of [
    { name: "ActualComponentCycleTime", def: "DECIMAL(12,3) NULL" },
    { name: "ActualCTUpdatedAt",        def: "DATETIME      NULL" },
    { name: "ActualCTSampleCount",      def: "INT           NULL" },
  ]) {
    await pool3.request().query(`
      IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'MaterialConfigs')
      AND NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'MaterialConfigs' AND COLUMN_NAME = '${col.name}'
      )
      BEGIN
        ALTER TABLE MaterialConfigs ADD ${col.name} ${col.def};
        PRINT 'Migration: Added ${col.name} column to MaterialConfigs';
      END
    `);
  }

  // ── MachineShiftAllocations / MachineShiftAllocationHistory ──────────────
  // Which shift(s) a machine is assigned to (some machines run a single 10h
  // shift, others run back-to-back for ~22h) — a many-to-many relationship
  // between Machines and ShiftConfigs. MachineShiftAllocations is the
  // current-state table (Status=1 = currently assigned); every change is
  // also logged to MachineShiftAllocationHistory (append-only, never
  // UPDATEd — same Action/ActionAt shape as the existing AuditTemplateHistory
  // table) so a historical date can be resolved via resolveMachineShiftsAsOf
  // (Frontend/src/utils/productionLogic.js) instead of only ever reflecting
  // today's assignment. No FK constraints on MachineId/ShiftId, same
  // reasoning as ShiftConfigHistory: history must survive the machine or
  // shift it refers to being deleted later.
  await pool3.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='MachineShiftAllocations')
    BEGIN
      CREATE TABLE MachineShiftAllocations (
        Id        INT IDENTITY(1,1) PRIMARY KEY,
        MachineId INT NOT NULL,
        ShiftId   INT NOT NULL,
        Status    BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT UQ_MachineShiftAllocations UNIQUE (MachineId, ShiftId)
      );
      PRINT 'Migration: Created MachineShiftAllocations table';
    END
  `);

  await pool3.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='MachineShiftAllocationHistory')
    BEGIN
      CREATE TABLE MachineShiftAllocationHistory (
        Id        INT IDENTITY(1,1) PRIMARY KEY,
        MachineId INT NOT NULL,
        ShiftId   INT NOT NULL,
        Action    NVARCHAR(20) NOT NULL, -- 'assigned' | 'unassigned'
        ActionAt  DATETIME NOT NULL DEFAULT GETDATE()
      );
      CREATE INDEX IX_MachineShiftAllocationHistory_MachineId_ActionAt ON MachineShiftAllocationHistory (MachineId, ActionAt);
      PRINT 'Migration: Created MachineShiftAllocationHistory table';
    END
  `);

  // ── GatePasses ────────────────────────────────────────────────────────────
  // Employee Management → Gate Pass: out-pass requests that walk through
  // Dept Head → HR → Security (out) → Security (in). Each stage's actor is
  // captured as free text (the UI takes a plain "your name" / "supervisor
  // name" input, not the logged-in user) alongside when they acted, so the
  // full chain-of-custody survives even though the current UI never
  // redisplays it.
  await pool3.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='GatePasses')
    BEGIN
      CREATE TABLE GatePasses (
        Id                 INT IDENTITY(1,1) PRIMARY KEY,
        EmpCode            NVARCHAR(50)   NOT NULL,
        EmpName            NVARCHAR(200)  NOT NULL,
        DeptName           NVARCHAR(200)  NOT NULL,
        ContactNo          NVARCHAR(50)   NULL,
        PlaceOfVisit       NVARCHAR(200)  NULL,
        Reason             NVARCHAR(MAX)  NULL,
        Type               NVARCHAR(20)   NOT NULL DEFAULT 'Official',   -- Official | Personal
        ComingBack         NVARCHAR(5)    NOT NULL DEFAULT 'Yes',        -- Yes | No
        OutDateTime        DATETIME       NOT NULL,
        ExpectedInDateTime DATETIME       NULL,
        Status             NVARCHAR(30)   NOT NULL DEFAULT 'Pending Dept Head',
        -- Pending Dept Head | Pending HR | Approved | Out | Completed | Rejected
        DeptHeadName       NVARCHAR(200)  NULL,
        DeptHeadAt         DATETIME       NULL,
        HRName             NVARCHAR(200)  NULL,
        HRAt               DATETIME       NULL,
        SecurityOutName    NVARCHAR(200)  NULL,
        GateOutAt          DATETIME       NULL,
        SecurityInName     NVARCHAR(200)  NULL,
        GateInAt           DATETIME       NULL,
        CreatedAt          DATETIME       NOT NULL DEFAULT GETDATE(),
        UpdatedAt          DATETIME       NOT NULL DEFAULT GETDATE()
      );
      CREATE INDEX IX_GatePasses_Status ON GatePasses (Status);
      PRINT 'Migration: Created GatePasses table';
    END
  `);

  // ── GatePassDeptConfig ───────────────────────────────────────────────────
  // Per-department approval contacts for Gate Pass's email-approval flow.
  // Seeded/refreshed from the external CLMS directory (BusinessUnit/Division
  // join) via the "Sync from Directory" action on the config page, but kept
  // as our own editable table (not read live from CLMS) so Location and any
  // manual corrections survive a later sync — sync only overwrites the
  // directory-sourced columns, never Location.
  await pool3.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='GatePassDeptConfig')
    BEGIN
      CREATE TABLE GatePassDeptConfig (
        Id                   INT IDENTITY(1,1) PRIMARY KEY,
        DeptCode             NVARCHAR(50)   NULL,
        DeptName             NVARCHAR(200)  NOT NULL,
        Location             NVARCHAR(200)  NULL,
        DeptHeadName         NVARCHAR(200)  NULL,
        DeptHeadEmail        NVARCHAR(200)  NULL,
        DeptHeadMobNo        NVARCHAR(50)   NULL,
        DeptManagerEmail     NVARCHAR(200)  NULL,
        DeptSubManagerEmail  NVARCHAR(200)  NULL,
        DivisionManagerEmail NVARCHAR(200)  NULL,
        DivisionOtherEmail   NVARCHAR(200)  NULL,
        IsActive             BIT            NOT NULL DEFAULT 1,
        CreatedAt            DATETIME       NOT NULL DEFAULT GETDATE(),
        UpdatedAt            DATETIME       NOT NULL DEFAULT GETDATE(),
        CONSTRAINT UQ_GatePassDeptConfig_DeptName UNIQUE (DeptName)
      );
      PRINT 'Migration: Created GatePassDeptConfig table';
    END
  `);

  // ── GatePassDeptConfig: BusinessUnitName ─────────────────────────────────
  // DeptName above is sourced from CLMS's Division.Name, but the "Department"
  // actually auto-filled onto a gate pass (and stored on GatePasses.DeptName)
  // comes from BusinessUnit.Name via the employee lookup — and those two
  // names don't always match for the same org unit (e.g. "MFG. ENGINEERING"
  // vs "MFG"), which silently broke the approval-email lookup. This column
  // lets a config row match either name.
  await pool3.request().query(`
    IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='GatePassDeptConfig')
    AND NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'GatePassDeptConfig' AND COLUMN_NAME = 'BusinessUnitName'
    )
    BEGIN
      ALTER TABLE GatePassDeptConfig ADD BusinessUnitName NVARCHAR(200) NULL;
      PRINT 'Migration: Added BusinessUnitName column to GatePassDeptConfig';
    END
  `);

  // ── GatePassHRConfig ─────────────────────────────────────────────────────
  // Single-row settings: who receives the "Pending HR" approval email. HR
  // approval isn't per-department (unlike Dept Head), so this is one global
  // contact rather than a table — same single-row pattern as BISApprovalFlow.
  await pool3.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='GatePassHRConfig')
    BEGIN
      CREATE TABLE GatePassHRConfig (
        Id        INT IDENTITY(1,1) PRIMARY KEY,
        HRName    NVARCHAR(200) NULL,
        HREmail   NVARCHAR(200) NULL,
        UpdatedBy NVARCHAR(100) NULL,
        UpdatedAt DATETIME      NOT NULL DEFAULT GETDATE()
      );
      INSERT INTO GatePassHRConfig (HRName, HREmail) VALUES (NULL, NULL);
      PRINT 'Migration: Created GatePassHRConfig table';
    END
  `);

  // ── UserSessions: one row per login (server-side session record) ──────────
  // Auth is a stateless JWT cookie; this table is what makes "who is logged
  // in", their IP/host, and admin Force Logout possible — the JWT carries the
  // SessionId (sid) and authenticate() rejects it once LogoutAt is set. All
  // time columns are SQL Server GETDATE() so "online"/"expired" math is done
  // in SQL and never depends on node-vs-DB timezone handling.
  await pool3.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='UserSessions')
    BEGIN
      CREATE TABLE UserSessions (
        Id           INT IDENTITY(1,1) PRIMARY KEY,
        SessionId    UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        UserCode     INT              NULL,
        UserID       NVARCHAR(50)     NOT NULL,
        UserName     NVARCHAR(200)    NULL,
        RoleName     NVARCHAR(100)    NULL,
        IpAddress    NVARCHAR(64)     NULL,
        HostName     NVARCHAR(255)    NULL,
        UserAgent    NVARCHAR(500)    NULL,
        LoginAt      DATETIME         NOT NULL DEFAULT GETDATE(),
        LastSeenAt   DATETIME         NOT NULL DEFAULT GETDATE(),
        ExpiresAt    DATETIME         NOT NULL,
        LogoutAt     DATETIME         NULL,
        LogoutReason NVARCHAR(30)     NULL, -- user | forced | deactivated | locked | password_reset
        RevokedBy    NVARCHAR(100)    NULL,
        CONSTRAINT UQ_UserSessions_SessionId UNIQUE (SessionId)
      );
      CREATE INDEX IX_UserSessions_User_Login ON UserSessions (UserID, LoginAt DESC);
      CREATE INDEX IX_UserSessions_Active ON UserSessions (LogoutAt, ExpiresAt);
      PRINT 'Migration: Created UserSessions table';
    END
  `);

  // ── AuthAuditLog: login attempts + admin user-access actions ──────────────
  await pool3.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='AuthAuditLog')
    BEGIN
      CREATE TABLE AuthAuditLog (
        Id          INT IDENTITY(1,1) PRIMARY KEY,
        EventType   NVARCHAR(40)  NOT NULL,
        UserID      NVARCHAR(50)  NULL,
        UserName    NVARCHAR(200) NULL,
        ActorUserID NVARCHAR(50)  NULL,
        ActorName   NVARCHAR(200) NULL,
        IpAddress   NVARCHAR(64)  NULL,
        HostName    NVARCHAR(255) NULL,
        Detail      NVARCHAR(500) NULL,
        CreatedAt   DATETIME      NOT NULL DEFAULT GETDATE()
      );
      CREATE INDEX IX_AuthAuditLog_CreatedAt ON AuthAuditLog (CreatedAt DESC);
      CREATE INDEX IX_AuthAuditLog_User ON AuthAuditLog (UserID, CreatedAt DESC);
      PRINT 'Migration: Created AuthAuditLog table';
    END
  `);

  // ── Machines: power profile for the Part Process "Energy (Estimated)" report ─
  // No energy meter is wired to these machines (PartProcessEvents.Energy is 0
  // on every row), so energy is estimated from production events: running
  // time x PowerRunKw and every recorded stop x PowerStandbyKw (the machine
  // only reports events while connected and powered on). Nullable — the report
  // falls back to the AMADA AE-2510NT figures when a machine has none.
  for (const col of [
    { name: "PowerRunKw",     def: "DECIMAL(8,2) NULL" },
    { name: "PowerStandbyKw", def: "DECIMAL(8,2) NULL" },
  ]) {
    await pool3.request().query(`
      IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Machines')
      AND NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'Machines' AND COLUMN_NAME = '${col.name}'
      )
      BEGIN
        ALTER TABLE Machines ADD ${col.name} ${col.def};
        PRINT 'Migration: Added ${col.name} column to Machines';
      END
    `);
  }

  // Seed the Amada from the manufacturer's AE-NT figures (average 4.5 kW while
  // working, below 1 kW on standby) — only where nothing has been entered yet,
  // so a later edit in Machine Config is never overwritten.
  await pool3.request().query(`
    IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Machines' AND COLUMN_NAME = 'PowerRunKw')
    BEGIN
      UPDATE Machines
      SET PowerRunKw = 4.5, PowerStandbyKw = 0.8
      WHERE MachineName LIKE '%AMADA%' AND PowerRunKw IS NULL AND PowerStandbyKw IS NULL;
    END
  `);

  // An earlier version of this report also had a "machine off after N hours"
  // cut-off. It was removed (every recorded stop is standby), so drop the
  // now-unused column — it was only ever created for this feature.
  await pool3.request().query(`
    IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Machines' AND COLUMN_NAME = 'PowerOffAfterHours')
    BEGIN
      ALTER TABLE Machines DROP COLUMN PowerOffAfterHours;
      PRINT 'Migration: Dropped unused PowerOffAfterHours column from Machines';
    END
  `);

  // ── VisitorPassCompanions: extra people accompanying the main visitor,
  //    each with their own name + photo (captured at the gate) ──────────────
  await pool3.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='VisitorPassCompanions')
    BEGIN
      CREATE TABLE VisitorPassCompanions (
        Id      INT IDENTITY(1,1) PRIMARY KEY,
        PassId  VARCHAR(50)  NOT NULL,
        Name    VARCHAR(255) NULL,
        Phone   VARCHAR(20)  NULL,
        Photo   TEXT         NULL
      );
      CREATE INDEX IX_VisitorPassCompanions_PassId ON VisitorPassCompanions(PassId);
      PRINT 'Migration: Created VisitorPassCompanions table';
    END
  `);

  // ── Backfill visitor profiles left blank by passes generated before the
  //    pass flow started syncing details onto `visitors` — fills NULLs only,
  //    from each visitor's latest pass, so it's a no-op once caught up ──────
  await pool3.request().query(`
    WITH LatestPass AS (
      SELECT *, ROW_NUMBER() OVER (PARTITION BY visitor_id ORDER BY created_at DESC) AS rn
      FROM visitor_passes
    )
    UPDATE v SET
      photo_url       = COALESCE(v.photo_url, lp.visitor_photo),
      email           = COALESCE(v.email, NULLIF(lp.visitor_email, '')),
      company         = COALESCE(v.company, LEFT(NULLIF(lp.company, ''), 100)),
      identity_type   = COALESCE(v.identity_type, NULLIF(lp.identity_type, '')),
      identity_no     = COALESCE(v.identity_no, NULLIF(lp.identity_no, '')),
      address         = COALESCE(v.address, lp.address),
      city            = COALESCE(v.city, LEFT(NULLIF(lp.city, ''), 50)),
      state           = COALESCE(v.state, LEFT(NULLIF(lp.state, ''), 50)),
      vehicle_details = COALESCE(v.vehicle_details, NULLIF(lp.vehicle_details, ''))
    FROM visitors v
    JOIN LatestPass lp ON lp.visitor_id = v.visitor_id AND lp.rn = 1
    WHERE v.photo_url IS NULL OR v.company IS NULL OR v.identity_type IS NULL
       OR v.vehicle_details IS NULL OR v.email IS NULL
  `);

  // ── Purge draft-autosave snapshots from AuditHistory. updateAudit used to log
  //    two full audit copies on every autosave (~190 MB); it now logs status
  //    changes only. Deletes 'updated' rows whose status didn't change and
  //    keeps real transitions (draft → submitted snapshots). No-op once clean.
  const purge = await pool3.request().query(`
    DELETE FROM AuditHistory
    WHERE Action = 'updated'
      AND ISJSON(PreviousData) = 1 AND ISJSON(NewData) = 1
      AND JSON_VALUE(PreviousData, '$.Status') = JSON_VALUE(NewData, '$.Status')
  `);
  if (purge.rowsAffected[0]) {
    console.log(`Migration: purged ${purge.rowsAffected[0]} draft-autosave rows from AuditHistory`);
  }

  // ── At most one ACTIVE template per name (inactive/deleted copies may share
  //    it). Backs up the app-level check in template.controller. Wrapped so a
  //    database that still holds duplicates logs a warning instead of
  //    blocking startup.
  await pool3.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_AuditTemplates_ActiveName')
    BEGIN TRY
      CREATE UNIQUE INDEX UX_AuditTemplates_ActiveName ON AuditTemplates (Name)
        WHERE IsActive = 1 AND IsDeleted = 0;
      PRINT 'Migration: Created UX_AuditTemplates_ActiveName';
    END TRY
    BEGIN CATCH
      PRINT 'Migration WARNING: UX_AuditTemplates_ActiveName not created (duplicate active template names?): ' + ERROR_MESSAGE();
    END CATCH
  `);

  // ── BOM Sheet / CRF reference files: current ones on the template, and the
  //    ones in force when each audit was started (kept so old audits still
  //    show the files they were checked against).
  for (const table of ["AuditTemplates", "Audits"]) {
    for (const col of ["BomFileName", "BomOriginalName", "CrfFileName", "CrfOriginalName"]) {
      await pool3.request().query(`
        IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = '${table}')
        AND NOT EXISTS (
          SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${table}' AND COLUMN_NAME = '${col}'
        )
        BEGIN
          ALTER TABLE ${table} ADD ${col} NVARCHAR(500) NULL;
          PRINT 'Migration: Added ${col} column to ${table}';
        END
      `);
    }
  }

  // ── Audit module lookup indexes. The live DB already has the Audits /
  //    AuditHistory ones (same names) — this only makes a fresh database match.
  for (const [table, name, cols] of [
    ["Audits", "IX_Audits_CreatedAt", "CreatedAt"],
    ["Audits", "IX_Audits_IsDeleted", "IsDeleted"],
    ["Audits", "IX_Audits_Status", "Status"],
    ["Audits", "IX_Audits_TemplateId", "TemplateId"],
    ["AuditHistory", "IX_AuditHistory_AuditId", "AuditId"],
    ["AuditTemplateHistory", "IX_AuditTemplateHistory_TemplateId", "TemplateId, ActionAt"],
  ]) {
    await pool3.request().query(`
      IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = '${table}')
      AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = '${name}' AND object_id = OBJECT_ID('${table}'))
      BEGIN
        CREATE INDEX ${name} ON ${table} (${cols});
        PRINT 'Migration: Created ${name}';
      END
    `);
  }

  console.log("Migrations completed.");
};
