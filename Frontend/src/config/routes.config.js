import { lazy } from "react";
import {
  Monitor,
  Wrench,
  Factory,
  ShieldCheck,
  Truck,
  CalendarRange,
  UserCheck,
  SlidersHorizontal,
  ClipboardCheck,
  Gauge,
  FileText,
  Cog,
  Settings2,
  BarChart2,
  Shield,
  Activity,
  Network,
  Users,
  Clock,
  BookOpen,
  Database,
  ScanEye,
  Droplets,
} from "lucide-react";

// Lazy loaded components
// ---------> Display Module
const Management = lazy(() => import("../pages/Display/ProductionDashboard/Management"));
const Monitoring = lazy(() => import("../pages/Display/ProductionDashboard/Monitoring"));

// ---------> Production Planning Module
const UploadPlan = lazy(() => import("../pages/ProductionPlaning/UploadPlan"));
const Status = lazy(() => import("../pages/ProductionPlaning/Status"));

// ---------> Production Module
const Overview = lazy(() => import("../pages/Production/Operations/Overview"));
const WIPCapture = lazy(
  () => import("../pages/Production/Operations/WIPCapture"),
);
const HourlyReport = lazy(
  () => import("../pages/Production/Reports/HourlyReport"),
);
const LineHourlyReport = lazy(
  () => import("../pages/Production/Reports/LineHourlyReport"),
);
const LineWiseReport = lazy(
  () => import("../pages/Production/Reports/LineWiseReport"),
);
const ConsolidatedReport = lazy(
  () =>
    import("../pages/Production/Reports/ConsolidatedReport/ConsolidatedReport"),
);
const NFCReport = lazy(() => import("../pages/Production/Reports/NFCReport"));
const TotalProduction = lazy(
  () => import("../pages/Production/Reports/TotalProduction"),
);
const StopLossReport = lazy(
  () => import("../pages/Production/Reports/StopLossReport"),
);
const ComponentTraceability = lazy(
  () => import("../pages/Production/Traceability/ComponentTraceability"),
);
const Barcodes = lazy(
  () => import("../pages/Production/Traceability/Barcodes"),
);
const ScrapDetails = lazy(
  () => import("../pages/Production/Traceability/ScrapDetails"),
);
const ModelTrend = lazy(() => import("../pages/Production/Trend/ModelTrend"));

// ---------> IOT Module
// ── Configuration ─────────────────────────────────────────────────────────────
const MailConfig = lazy(() => import("../pages/IOT/MasterConfig/MailConfig"));
const MaterialConfig = lazy(
  () => import("../pages/IOT/MasterConfig/MaterialConfig"),
);
const ShiftConfig = lazy(() => import("../pages/IOT/MasterConfig/ShiftConfig"));
const DowntimeConfig = lazy(
  () => import("../pages/IOT/MasterConfig/DowntimeConfig"),
);
const QualityConfig = lazy(
  () => import("../pages/IOT/MasterConfig/QualityConfig"),
);
const MachineConfig = lazy(
  () => import("../pages/IOT/MasterConfig/MachineConfig"),
);
const PlanningConfig = lazy(
  () => import("../pages/IOT/MasterConfig/PlanningConfig"),
);
// ── Part Process ──────────────────────────────────────────────────────────────
const PartProcessOverview = lazy(
  () => import("../pages/IOT/PartProcess/Overview"),
);
const PartProcessProductionReport = lazy(
  () => import("../pages/IOT/PartProcess/ProductionReport"),
);
const PartProcessHourlyReport = lazy(
  () => import("../pages/IOT/PartProcess/HourlyReport"),
);
const PartProcessQualityReport = lazy(
  () => import("../pages/IOT/PartProcess/QualityReport"),
);
const PartProcessDowntimeReport = lazy(
  () => import("../pages/IOT/PartProcess/DowntimeReport"),
);
const PartProcessOEEReport = lazy(
  () => import("../pages/IOT/PartProcess/OEEReport"),
);
const PartProcessEnergyEstimate = lazy(
  () => import("../pages/IOT/PartProcess/EnergyEstimate"),
);
const FactoryMonitor = lazy(
  () => import("../pages/IOT/PartProcess/FactoryMonitor"),
);
const FactoryOsSyncLog = lazy(
  () => import("../pages/IOT/PartProcess/FactoryOsSyncLog"),
);
const PartProcessDashboard = lazy(
  () => import("../pages/IOT/PartProcess/Dashboard"),
);

// ---------> Quality Module
const ReworkReport = lazy(() => import("../pages/Quality/ReworkReport"));
const GasChargingReport = lazy(
  () => import("../pages/Quality/GasChargingReport"),
);
const ESTReport = lazy(() => import("../pages/Quality/ESTReport"));
const CPTReport = lazy(() => import("../pages/Quality/CPTReport"));
const VacuumReport = lazy(() => import("../pages/Quality/VacuumReport"));
const BrazingReport = lazy(() => import("../pages/Quality/BrazingReport"));
const DispatchHold = lazy(() => import("../pages/Quality/DispatchHold"));
const HoldCabinateDetails = lazy(
  () => import("../pages/Quality/HoldCabinateDetails"),
);
const TagUpdate = lazy(() => import("../pages/Quality/TagUpdate"));
const FGScrap = lazy(() => import("../pages/Quality/FGScrap"));
const ModelTransfer = lazy(() => import("../pages/Quality/ModelTransfer"));
const BarcodeReprint = lazy(() => import("../pages/Quality/BarcodeReprint"));
const LPT = lazy(() => import("../pages/Quality/LPT"));
const LPTReport = lazy(() => import("../pages/Quality/LPTReport"));
const LPTRecipe = lazy(() => import("../pages/Quality/LPTRecipe"));
const MassFlowReport = lazy(() => import("../pages/Quality/MassFlowReport"));
const FPA = lazy(() => import("../pages/Quality/FPA"));
const FPAReports = lazy(() => import("../pages/Quality/FPAReports"));
const FPAHistory = lazy(() => import("../pages/Quality/FPAHistory"));
const BISDashboard = lazy(() => import("../pages/Quality/BIS/BISDashboard"));
const BISTestLabDashboard = lazy(
  () => import("../pages/Quality/BIS/BISTestLabDashboard"),
);
const BEECalculation = lazy(() => import("../pages/Quality/BEECalculation"));

// ---------> Vision Camera Module
const VisionCameraReport = lazy(
  () => import("../pages/VisionCamera/VisionReport"),
);

const DispatchPerformanceReport = lazy(
  () => import("../pages/Logistic/Reports/DispatchPerformanceReport"),
);
const DispatchReport = lazy(
  () => import("../pages/Logistic/Reports/DispatchReport"),
);
const FGDispatchReport = lazy(
  () => import("../pages/Logistic/Reports/UnloadingStatus"),
);
const DispatchUnloading = lazy(
  () => import("../pages/Logistic/Reports/FGUnloadingReport"),
);
const RemoveDispatchSerials = lazy(
  () => import("../pages/Logistic/Scanning/RemoveDispatchSerials"),
);
const FGCasting = lazy(
  () => import("../pages/Logistic/Reports/FGCastingReport"),
);
const GateEntry = lazy(() => import("../pages/Logistic/Scanning/GateEntry"));
const ErrorLog = lazy(() => import("../pages/Logistic/Log/ErrorLog"));
const FGUnloadingScan = lazy(
  () => import("../pages/Logistic/Scanning/FGUnloadingScan"),
);
const FGDispatchScan = lazy(
  () => import("../pages/Logistic/Scanning/FGDispatchScan"),
);

const Dashboard = lazy(() => import("../pages/Visitor/Dashboard"));
const GeneratePass = lazy(() => import("../pages/Visitor/GeneratePass"));
const VisitorPassDisplay = lazy(
  () => import("../pages/Visitor/VisitorPassDisplay"),
);
const InOut = lazy(() => import("../pages/Visitor/InOut"));
const Reports = lazy(() => import("../pages/Visitor/Reports"));
const History = lazy(() => import("../pages/Visitor/History"));
const ManageEmployee = lazy(() => import("../pages/Visitor/ManageEmployee"));
const Gatepassrequest = lazy(
  () => import("../pages/EmployeeManagement/Gatepassrequest"),
);
const Gatepassdepthead = lazy(
  () => import("../pages/EmployeeManagement/Gatepassdepthead"),
);
const Gatepasshrapproval = lazy(
  () => import("../pages/EmployeeManagement/Gatepasshrapproval"),
);
const Gatepasssecuritygate = lazy(
  () => import("../pages/EmployeeManagement/Gatepasssecuritygate"),
);
const Gatepassreports = lazy(
  () => import("../pages/EmployeeManagement/Gatepassreports"),
);
const Gatepassconfig = lazy(
  () => import("../pages/EmployeeManagement/Gatepassconfig"),
);

const AttendanceRegister = lazy(
  () => import("../pages/Forms/AttendanceRegister"),
);
const MyAttendance = lazy(() => import("../pages/Forms/MyAttendance"));
const AttendanceDashboard = lazy(
  () => import("../pages/Forms/AttendanceDashboard"),
);
const LeaveApplication = lazy(() => import("../pages/Forms/LeaveApplication"));
const LeaveApproval = lazy(() => import("../pages/Forms/LeaveApproval"));

const Calibiration = lazy(() => import("../pages/Compliance/Calibration"));

const TemplateBuilder = lazy(
  () => import("../pages/AuditReport/Template/TemplateBuilder"),
);
const TemplateList = lazy(
  () => import("../pages/AuditReport/Template/TemplateList"),
);
const TemplateView = lazy(
  () => import("../pages/AuditReport/Template/TemplateView"),
);
const TemplateApproval = lazy(
  () => import("../pages/AuditReport/Template/TemplateApproval"),
);
const TemplateCompare = lazy(
  () => import("../pages/AuditReport/Template/TemplateCompare"),
);
const TemplateChangeLog = lazy(
  () => import("../pages/AuditReport/Template/TemplateChangeLog"),
);
const SerialScan = lazy(
  () => import("../pages/AuditReport/Template/SerialScan"),
);
const AuditList = lazy(() => import("../pages/AuditReport/Audit/AuditList"));
const AuditEntry = lazy(() => import("../pages/AuditReport/Audit/AuditEntry"));
const AuditView = lazy(() => import("../pages/AuditReport/Audit/AuditView"));
const AuditApproval = lazy(
  () => import("../pages/AuditReport/Audit/AuditApproval"),
);
const AuditDashboard = lazy(
  () => import("../pages/AuditReport/Auditdashboard"),
);

const DehumidifierDashboard = lazy(
  () => import("../pages/Readings/DehumidifierDashboard"),
);
const EnergyMeterDashboard = lazy(
  () => import("../pages/Readings/EnergyMeterDashboard"),
);

// ── Chemical ─────────────────────────────────────────────────────────────
const ChemBulkStorageReport = lazy(
  () => import("../pages/Chemical/ChemBulkStorageReport"),
);
const ChemTankData = lazy(() => import("../pages/Chemical/ChemTankData"));
const ChemBulkStorageMailConfig = lazy(
  () => import("../pages/Chemical/ChemBulkStorageMailConfig"),
);

// ─── Role Constants ───────────────────────────────────────────────────────────
export const ROLES = {
  SUPER_ADMIN: "super admin", // 226005 — full access incl. in-progress modules
  ADMIN: "admin", // 222003/223002 — all live modules only
  LOGISTIC: "logistic",
  QUALITY_MANAGER: "quality manager", // 223005
  LINE_QUALITY_ENGINEER: "line quality engineer", // 224002
  BIS_ENGINEER: "bis engineer", // 225004
  FPA: "fpa", // 225003
  LPT: "lpt", // 225006
  GATE_ENTRY_USER: "gate entry user", // 226001
  PRODUCTION_MANAGER: "production manager", // 223006
  PLANNING_TEAM: "planning team", // 222002 / 223004
  SECURITY: "security", // 224004
  HR: "hr", // 224005
  SUS_LINE_USER: "sus line user", // 226004

  // ── Previously missing roles (now added) ──────────────────────────────────
  PRODUCTION_OPERATOR: "production operator", // 222001 — floor production staff
  ROLE_USER: "roleuser", // 222004
  QUALITY_OPERATOR: "quality operator", // 223001 — floor quality staff
  QUALITY_ENGINEER: "quality engineer", // 223003
  BRAZING_OPERATOR: "brazing operator", // 223007
  QUALITY_AUDITOR: "quality auditor", // 223008
  REPORT_USERS: "report users", // 223009 — view-only report access
  REPORT_USERS_ADMIN: "report users admin", // 223010 — report access with admin view
  REWORK_OPERATOR: "rework operator", // 224001
  ID_MAKER: "id maker", // 224003
  FREEZER_LABEL_ROLE: "freezer label role", // 224006
  CHOC_LABEL_ROLE: "choc label role", // 224007
  OPERATIONS: "operations", // 224008 — operations/floor management
  CHOC_COMP_SCANNING: "choc comp scanning", // 225001
  FREEZER_COMP_SCANNING: "freezer comp scanning", // 225002
  SUS_FG_LABEL: "sus fg label", // 225005
  CHEM_DATA_USER: "chem data user", // 225007
  VISI2_POST_QA: "visi-2 post qa", // 226002
  VISI_COMP_SCAN: "visi comp scan", // 226003
  PART_PROCESS_PLANING: "part process planing",
};

// ─── Route Configuration ──────────────────────────────────────────────────────
export const ROUTE_CONFIG = [
  // ── Display Module ──────────────────────────────────────────────────────────────
  {
    key: "display",
    icon: Monitor,
    label: "Display",
    basePath: "/display",
    items: [
      {
        path: "/display/management",
        label: "Management",
        icon: Wrench,
        component: Management,
      },
    ],
    hiddenItems: [
      {
        path: "/display/:slug",
        component: Monitoring,
      },
    ],
  },

  // ── Production Planning Module ─────────────────────────────────────────────────────────────
  {
    key: "planing",
    icon: CalendarRange,
    label: "Production Planning",
    basePath: "/production-planing",
    items: [
      {
        path: "/production-planing/upload-plan",
        label: "Upload Plan",
        component: UploadPlan,
      },
      {
        path: "/production-planing/status",
        label: "Status",
        component: Status,
      },
    ],
  },

  // ── Production Module ───────────────────────────────────────────────────────────
  {
    key: "production",
    icon: Factory,
    label: "Production",
    basePath: "/production",
    subgroupConfig: [
      { key: "operations", label: "Operations" },
      { key: "reports", label: "Reports" },
      { key: "traceability", label: "Traceability" },
      { key: "trend", label: "Trend" },
    ],
    items: [
      {
        path: "/production/overview",
        label: "Overview",
        component: Overview,
        group: "operations",
      },
      {
        path: "/production/wip-capture",
        label: "WIP Capture",
        component: WIPCapture,
        group: "operations",
      },
      {
        path: "/production/hourly-report",
        label: "Hourly Report",
        component: HourlyReport,
        group: "reports",
      },
      {
        path: "/production/line-hourly-report",
        label: "Line Hourly Report",
        component: LineHourlyReport,
        group: "reports",
      },
      {
        path: "/production/line-wise-report",
        label: "Line Wise Report",
        component: LineWiseReport,
        group: "reports",
      },
      {
        path: "/production/consolidated-report",
        label: "Consolidated Report",
        component: ConsolidatedReport,
        group: "reports",
      },
      {
        path: "/production/nfc-report",
        label: "NFC Report",
        component: NFCReport,
        group: "reports",
      },
      {
        path: "/production/total-production",
        label: "Total Production",
        component: TotalProduction,
        group: "reports",
      },
      {
        path: "/production/stop-loss-report",
        label: "Stop Loss Report",
        component: StopLossReport,
        group: "reports",
      },
      {
        path: "/production/component-traceability-report",
        label: "Component Traceability",
        component: ComponentTraceability,
        group: "traceability",
      },
      {
        path: "/production/barcode-report",
        label: "Barcodes",
        component: Barcodes,
        group: "traceability",
      },
      {
        path: "/production/scrap-details",
        label: "Scrap Details",
        component: ScrapDetails,
        group: "traceability",
      },
      {
        path: "/production/model-trend",
        label: "Model Trend",
        component: ModelTrend,
        group: "trend",
      },
    ],
  },

  // ── IOT Module Configuration ────────────────────────────────────────────────────────
  {
    key: "masterConfig",
    icon: Settings2,
    label: "IOT Config",
    basePath: "/master-config",
    subgroupConfig: [
      { key: "config", label: "Configuration" },
      { key: "admin", label: "Admin" },
    ],
    items: [
      {
        path: "/master-config/mail",
        label: "Mail & Notifications",
        component: MailConfig,
        group: "admin",
      },
      {
        path: "/master-config/material",
        label: "Material",
        component: MaterialConfig,
        group: "config",
      },
      {
        path: "/master-config/shift",
        label: "Shift",
        component: ShiftConfig,
        group: "config",
      },
      {
        path: "/master-config/downtime",
        label: "Downtime Reasons",
        component: DowntimeConfig,
        group: "config",
      },
      {
        path: "/master-config/quality",
        label: "Quality Rejection Reasons",
        component: QualityConfig,
        group: "config",
      },
      {
        path: "/master-config/machine",
        label: "Machines",
        component: MachineConfig,
        group: "config",
      },
      {
        path: "/master-config/planning",
        label: "Production Planning",
        component: PlanningConfig,
        group: "config",
      },
    ],
  },

  // ── Part Process ─────────────────────────────────────────────────────────
  {
    key: "partProcess",
    icon: Cog,
    label: "IOT",
    basePath: "/part-process",
    items: [
      {
        path: "/part-process/overview",
        label: "Overview",
        component: PartProcessOverview,
      },
      {
        path: "/part-process/production-report",
        label: "Production Report",
        component: PartProcessProductionReport,
      },
      {
        path: "/part-process/hourly-report",
        label: "Hourly Report",
        component: PartProcessHourlyReport,
      },
      {
        path: "/part-process/quality-report",
        label: "Quality Report",
        component: PartProcessQualityReport,
      },
      {
        path: "/part-process/downtime-report",
        label: "Downtime Report",
        component: PartProcessDowntimeReport,
      },
      {
        path: "/part-process/oee-report",
        label: "OEE Report",
        component: PartProcessOEEReport,
      },
      {
        path: "/part-process/energy-estimate",
        label: "Energy",
        component: PartProcessEnergyEstimate,
      },
      {
        path: "/part-process/factory-monitor",
        label: "Factory Monitor",
        component: FactoryMonitor,
      },
      {
        path: "/part-process/factoryos-sync-log",
        label: "FactoryOS Sync Log",
        component: FactoryOsSyncLog,
      },
    ],
    hiddenItems: [
      {
        path: "/part-process/dashboard",
        component: PartProcessDashboard,
      },
    ],
  },

  // ── Quality Module ──────────────────────────────────────────────────────────────
  {
    key: "quality",
    icon: ShieldCheck,
    label: "Quality",
    basePath: "/quality",
    subgroupConfig: [
      { key: "general", label: "General" },
      { key: "lpt", label: "LPT" },
      { key: "fpa", label: "FPA" },
      { key: "bis", label: "BIS" },
    ],
    items: [
      {
        path: "/quality/rework-report",
        label: "Rework Report",
        component: ReworkReport,
        group: "general",
      },
      {
        path: "/quality/gas-charging-report",
        label: "Gas Charging Report",
        component: GasChargingReport,
        group: "general",
      },
      {
        path: "/quality/est-report",
        label: "EST Report",
        component: ESTReport,
        group: "general",
      },
      {
        path: "/quality/cpt-report",
        label: "CPT Report",
        component: CPTReport,
        group: "general",
      },
      {
        path: "/quality/vacuum-report",
        label: "Vacuum Report",
        component: VacuumReport,
        group: "general",
      },
      {
        path: "/quality/brazing-report",
        label: "Brazing Report",
        component: BrazingReport,
        group: "general",
      },
      {
        path: "/quality/dispatch-hold",
        label: "Dispatch Hold",
        component: DispatchHold,
        group: "general",
      },
      {
        path: "/quality/hold-cabinate-details",
        label: "Hold Cabinet Details",
        component: HoldCabinateDetails,
        group: "general",
      },
      {
        path: "/quality/tag-update",
        label: "Tag Update",
        component: TagUpdate,
        group: "general",
      },
      {
        path: "/quality/fg-scrap",
        label: "FG Scrap",
        component: FGScrap,
        group: "general",
      },
      {
        path: "/quality/model-transfer",
        label: "Model To Model Transfer",
        component: ModelTransfer,
        group: "general",
      },
      {
        path: "/quality/barcode-reprint",
        label: "Material Barcode Reprint",
        component: BarcodeReprint,
        group: "general",
      },
      { path: "/quality/lpt", label: "LPT", component: LPT, group: "lpt" },
      {
        path: "/quality/lpt-report",
        label: "LPT Report",
        component: LPTReport,
        group: "lpt",
      },
      {
        path: "/quality/lpt-recipe",
        label: "LPT Recipe",
        component: LPTRecipe,
        group: "lpt",
      },
      {
        path: "/quality/mass-flow-report",
        label: "Mass Flow Report",
        component: MassFlowReport,
        group: "lpt",
      },
      { path: "/quality/fpa", label: "FPA", component: FPA, group: "fpa" },
      {
        path: "/quality/fpa-report",
        label: "FPA Report",
        component: FPAReports,
        group: "fpa",
      },
      {
        path: "/quality/fpa-history",
        label: "FPA History",
        component: FPAHistory,
        group: "fpa",
      },
      {
        path: "/quality/bis-reports",
        label: "BIS Test Reports",
        component: BISDashboard,
        group: "bis",
      },
      {
        path: "/quality/bis-approvals",
        label: "BIS Approvals",
        component: BISDashboard,
        group: "bis",
      },
      {
        path: "/quality/bis-test-schedule",
        label: "BIS Test Schedule",
        component: BISDashboard,
        group: "bis",
      },
      {
        path: "/quality/bis-legacy-reports",
        label: "BIS Legacy PDF Reports",
        component: BISDashboard,
        group: "bis",
      },
      {
        path: "/quality/bis-compliance",
        label: "BIS Compliance Status",
        component: BISDashboard,
        group: "bis",
      },
      {
        path: "/quality/bis-energy",
        label: "BIS Energy Analysis",
        component: BISDashboard,
        group: "bis",
      },
      {
        path: "/quality/bis-config",
        label: "BIS Config",
        component: BISDashboard,
        group: "bis",
      },
      {
        path: "/quality/bis-test-lab",
        label: "Test Lab Dashboard",
        component: BISTestLabDashboard,
        group: "bis",
      },
      {
        path: "/quality/bee-calculation",
        label: "BEE Calculation",
        component: BEECalculation,
        group: "bis",
      },
    ],
  },

  // ── Vision Camera Module ────────────────────────────────────────────────────────
  {
    key: "visionReport",
    icon: ScanEye,
    label: "Vision Camera",
    basePath: "/vision-report",
    items: [
      {
        path: "/vision-report",
        label: "Inspection Report",
        component: VisionCameraReport,
      },
    ],
  },

  // ── Dispatch ─────────────────────────────────────────────────────────────
  {
    key: "dispatch",
    icon: Truck,
    label: "Logistic",
    basePath: "/dispatch",
    subgroupConfig: [
      { key: "general", label: "General" },
      { key: "report", label: "Report" },
      { key: "scan", label: "Scanning" },
      { key: "log", label: "Logs" },
    ],
    items: [
      {
        path: "/dispatch/fg-unloading-scan",
        label: "FG Unloading (Scan)",
        component: FGUnloadingScan,
        group: "scan",
      },
      {
        path: "/dispatch/fg-dispatch-scan",
        label: "FG Dispatch (Scan)",
        component: FGDispatchScan,
        group: "scan",
      },
      {
        path: "/dispatch/dispatch-performance-report",
        label: "Dispatch Performance Report",
        component: DispatchPerformanceReport,
        group: "report",
      },
      {
        path: "/dispatch/dispatch-report",
        label: "Dispatch Report",
        component: DispatchReport,
        group: "report",
      },
      {
        path: "/dispatch/dispatch-unloading",
        label: "FG Unloading",
        component: DispatchUnloading,
        group: "report",
      },
      {
        path: "/dispatch/fg-casting",
        label: "FG Casting",
        component: FGCasting,
        group: "report",
      },
      {
        path: "/dispatch/fg-dispatchReport",
        label: "Unloading Status",
        component: FGDispatchReport,
        group: "report",
      },
      {
        path: "/dispatch/gate-entry",
        label: "Gate Entry",
        component: GateEntry,
        group: "scan",
      },
      {
        path: "/dispatch/error-log",
        label: "Error Log",
        component: ErrorLog,
        group: "log",
      },
      {
        path: "/dispatch/remove-error-serials",
        label: "Remove Error Serials",
        component: RemoveDispatchSerials,
        group: "scan",
      },
    ],
  },

  // ── Visitor Management ──────────────────────────────────────────────────────────────
  {
    key: "visitor",
    icon: UserCheck,
    label: "Visitor Management",
    basePath: "/visitor",
    items: [
      {
        path: "/visitor/dashboard",
        label: "Dashboard",
        component: Dashboard,
      },
      {
        path: "/visitor/generate-pass",
        label: "Generate Pass",
        component: GeneratePass,
      },
      {
        path: "/visitor/in-out",
        label: "In / Out",
        component: InOut,
      },
      {
        path: "/visitor/reports",
        label: "Reports",
        component: Reports,
      },
      {
        path: "/visitor/history",
        label: "History",
        component: History,
      },
      {
        path: "/visitor/manage-employee",
        label: "Manage Employee",
        component: ManageEmployee,
      },
    ],
    hiddenItems: [
      {
        path: "/visitor-pass-display/:passId",
        component: VisitorPassDisplay,
      },
    ],
  },

  // ── Employee Management ──────────────────────────────────────────────────────────────
  {
    key: "employee",
    icon: UserCheck,
    label: "Employee Management",
    basePath: "/employee",
    subgroupConfig: [
      { key: "gatepass", label: "Gatepass" },
      { key: "attendance", label: "Attendance" },
      { key: "gatepassConfig", label: "Gatepass Config" },
    ],
    items: [
      {
        path: "/employee/gatepass/request",
        label: "GatePassRequest ",
        component: Gatepassrequest,
        group: "gatepass",
      },
      {
        path: "/employee/gatepass/depthead",
        label: "GatePassDeptHead",
        component: Gatepassdepthead,
        group: "gatepass",
      },
      {
        path: "/employee/gatepass/hr-approval",
        label: "GatePassHRApproval",
        component: Gatepasshrapproval,
        group: "gatepass",
      },
      {
        path: "/employee/gatepass/security",
        label: "GatePassSecurityGate",
        component: Gatepasssecuritygate,
        group: "gatepass",
      },
      {
        path: "/employee/gatepass/reports",
        label: "GatePassReports",
        component: Gatepassreports,
        group: "gatepass",
      },
      {
        path: "/employee/gatepass/config",
        label: "GatePassConfig",
        component: Gatepassconfig,
        group: "gatepassConfig",
      },
      {
        path: "/employee/attendance/register",
        label: "Attendance Register",
        component: AttendanceRegister,
        group: "attendance",
      },
      {
        path: "/employee/attendance/my",
        label: "My Attendance",
        component: MyAttendance,
        group: "attendance",
      },
      {
        path: "/employee/attendance/dashboard",
        label: "Attendance Dashboard",
        component: AttendanceDashboard,
        group: "attendance",
      },
      {
        path: "/employee/attendance/leave-application",
        label: "Leave Application",
        component: LeaveApplication,
        group: "attendance",
      },
      {
        path: "/employee/attendance/leave-approval",
        label: "Leave Approval",
        component: LeaveApproval,
        group: "attendance",
      },
    ],
  },

  // ── Calibration Management (route key/base path stay "compliance") ────────
  {
    key: "compliance",
    icon: SlidersHorizontal,
    label: "Calibration Management",
    basePath: "/compliance",
    items: [
      {
        path: "/compliance/calibiration",
        label: "Calibration",
        component: Calibiration,
      },
    ],
  },

  // ── Audit Report ─────────────────────────────────────────────────────────
  {
    key: "auditReport",
    icon: ClipboardCheck,
    label: "Audit Report",
    basePath: "/auditreport",
    subgroupConfig: [
      { key: "templates", label: "Templates" },
      { key: "audits", label: "Audits" },
    ],
    items: [
      {
        path: "/auditreport/templates",
        label: "Templates",
        component: TemplateList,
        group: "templates",
      },
      {
        path: "/auditreport/approval",
        label: "Approve Templates",
        component: TemplateApproval,
        group: "templates",
      },
      {
        path: "/auditreport/dashboard",
        label: "Dashboard",
        component: AuditDashboard,
        group: "audits",
      },
      {
        path: "/auditreport/serial-scan",
        label: "Serial Scan",
        component: SerialScan,
        group: "audits",
      },
      {
        path: "/auditreport/audits",
        label: "Audits",
        component: AuditList,
        group: "audits",
      },
      {
        path: "/auditreport/audit-approval",
        label: "Approve Audits",
        component: AuditApproval,
        group: "audits",
      },
    ],
    hiddenItems: [
      {
        path: "/auditreport/templates/new",
        component: TemplateBuilder,
      },
      {
        path: "/auditreport/templates/:id/view",
        component: TemplateView,
      },
      {
        path: "/auditreport/templates/:id/compare",
        component: TemplateCompare,
      },
      {
        path: "/auditreport/templates/:id/history",
        component: TemplateChangeLog,
      },
      {
        path: "/auditreport/templates/:id",
        component: TemplateBuilder,
      },
      {
        path: "/auditreport/audits/new",
        component: AuditEntry,
      },
      {
        path: "/auditreport/audits/:id",
        component: AuditEntry,
      },
      {
        path: "/auditreport/audits/:id/view",
        component: AuditView,
      },
    ],
  },

  // ── Chemical ─────────────────────────────────────────────────────────────
  {
    key: "chemical",
    icon: Droplets,
    label: "Chemical",
    basePath: "/chemical",
    items: [
      {
        path: "/chemical/bulk-storage-report",
        label: "Bulk Storage Report",
        component: ChemBulkStorageReport,
      },
      {
        path: "/chemical/tank-data",
        label: "Tank Data",
        component: ChemTankData,
      },
      {
        path: "/chemical/bulk-storage-mail-config",
        label: "Bulk Storage Mail Config",
        component: ChemBulkStorageMailConfig,
      },
    ],
  },

  // ── Utility / Readings ───────────────────────────────────────────────────
  {
    key: "reading",
    icon: Gauge,
    label: "Utility",
    basePath: "/reading",
    items: [
      {
        path: "/reading/dehumidifier",
        label: "Utility Reading",
        component: DehumidifierDashboard,
      },
      {
        path: "/reading/energy-meters",
        label: "Energy Meters",
        component: EnergyMeterDashboard,
      },
    ],
  },
];
