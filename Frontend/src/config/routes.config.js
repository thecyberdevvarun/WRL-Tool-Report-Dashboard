import { lazy } from "react";
import {
  FaIndustry,
  FaClipboardCheck,
  FaTruckMoving,
  FaClipboardList,
} from "react-icons/fa";
import {
  MdOutlineNotificationsActive,
  MdOutlineDisplaySettings,
  MdOutlineFactCheck,
} from "react-icons/md";
import { FaUserShield } from "react-icons/fa6";

// Lazy loaded components
const ProductionOverview = lazy(() => import("../pages/Production/Overview"));
const ComponentTraceabilityReport = lazy(
  () => import("../pages/Production/ComponentTraceabilityReport"),
);
const HourlyReport = lazy(() => import("../pages/Production/HourlyReport"));
const LineHourlyReport = lazy(
  () => import("../pages/Production/LineHourlyReport"),
);
const ConsolidatedReport = lazy(
  () => import("../pages/Production/ConsolidatedReport/ConsolidatedReport"),
);
const ModelNameUpdate = lazy(
  () => import("../pages/Production/ModelNameUpdate"),
);
const NFCReport = lazy(() => import("../pages/Production/NFCReport"));
const TotalProduction = lazy(
  () => import("../pages/Production/TotalProduction"),
);
const StopLossReport = lazy(() => import("../pages/Production/StopLossReport"));

const ReworkEntry = lazy(() => import("../pages/Quality/ReworkEntry"));
const ReworkReport = lazy(() => import("../pages/Quality/ReworkReport"));
const BrazingReport = lazy(() => import("../pages/Quality/BrazingReport"));
const GasChargingReport = lazy(
  () => import("../pages/Quality/GasChargingReport"),
);
const ESTReport = lazy(() => import("../pages/Quality/ESTReport"));
const CPTReport = lazy(() => import("../pages/Quality/CPTReport"));
const FPA = lazy(() => import("../pages/Quality/FPA"));
const FPAReports = lazy(() => import("../pages/Quality/FPAReports"));
const FPAHistory = lazy(() => import("../pages/Quality/FPAHistory"));
const FPADefectReport = lazy(() => import("../pages/Quality/FPADefectReport"));
const LPT = lazy(() => import("../pages/Quality/LPT"));
const LPTReport = lazy(() => import("../pages/Quality/LPTReport"));
const DispatchHold = lazy(() => import("../pages/Quality/DispatchHold"));
const HoldCabinateDetails = lazy(
  () => import("../pages/Quality/HoldCabinateDetails"),
);
const TagUpdate = lazy(() => import("../pages/Quality/TagUpdate"));
const LPTRecipe = lazy(() => import("../pages/Quality/LPTRecipe"));
const UploadBISReport = lazy(() => import("../pages/Quality/UploadBISReport"));
const BISReports = lazy(() => import("../pages/Quality/BISReports"));
const BISStatus = lazy(() => import("../pages/Quality/BISStatus"));
const BEECalculation = lazy(() => import("../pages/Quality/BEECalculation"));

const DispatchPerformanceReport = lazy(
  () => import("../pages/Dispatch/DispatchPerformanceReport"),
);
const DispatchReport = lazy(() => import("../pages/Dispatch/DispatchReport"));
const DispatchUnloading = lazy(
  () => import("../pages/Dispatch/DispatchUnloading"),
);
const FGCasting = lazy(() => import("../pages/Dispatch/FGCasting"));
const GateEntry = lazy(() => import("../pages/Dispatch/GateEntry"));
const ErrorLog = lazy(() => import("../pages/Dispatch/ErrorLog"));

const ProductionPlaning = lazy(
  () => import("../pages/Planing/ProductionPlaning"),
);
const DailyPlan = lazy(() => import("../pages/Planing/DailyPlan"));

const Dashboard = lazy(() => import("../pages/Visitor/Dashboard"));
const GeneratePass = lazy(() => import("../pages/Visitor/GeneratePass"));
const VisitorPassDisplay = lazy(
  () => import("../pages/Visitor/VisitorPassDisplay"),
);
const InOut = lazy(() => import("../pages/Visitor/InOut"));
const Reports = lazy(() => import("../pages/Visitor/Reports"));
const History = lazy(() => import("../pages/Visitor/History"));
const ManageEmployee = lazy(() => import("../pages/Visitor/ManageEmployee"));

const LogisticsDisplay = lazy(
  () => import("../pages/PerformanceDisplays/LogisticsDisplay"),
);

const Calibiration = lazy(() => import("../pages/Compliance/Calibration"));

const ManageTasks = lazy(() => import("../pages/TaskReminders/ManageTasks"));
const TaskOverview = lazy(() => import("../pages/TaskReminders/TaskOverview"));

const TemplateBuilder = lazy(
  () => import("../pages/AuditReport/TemplateBuilder"),
);
const TemplateList = lazy(() => import("../pages/AuditReport/TemplateList"));
const AuditList = lazy(() => import("../pages/AuditReport/AuditList"));
const AuditEntry = lazy(() => import("../pages/AuditReport/AuditEntry"));
const AuditView = lazy(() => import("../pages/AuditReport/AuditView"));

const DehumidifierDashboard = lazy(
  () => import("../pages/Readings/DehumidifierDashboard"),
);

// Role constants for consistency
export const ROLES = {
  ADMIN: "admin",
  LOGISTIC: "logistic",
  QUALITY_MANAGER: "quality manager",
  LINE_QUALITY_ENGINEER: "line quality engineer",
  BIS_ENGINEER: "bis engineer",
  FPA: "fpa",
  LPT: "lpt",
  GATE_ENTRY_USER: "gate entry user",
  PRODUCTION_MANAGER: "production manager",
  PLANNING_TEAM: "planning team",
  SECURITY: "security",
  HR: "hr",
};

// Centralized route configuration
export const ROUTE_CONFIG = [
  {
    key: "production",
    icon: FaIndustry,
    label: "Production",
    basePath: "/production",
    items: [
      {
        path: "/production/overview",
        label: "Production Report",
        component: ProductionOverview,
      },
      {
        path: "/production/component-traceability-report",
        label: "Component Traceability Report",
        component: ComponentTraceabilityReport,
      },
      {
        path: "/production/hourly-report",
        label: "Hourly Report",
        component: HourlyReport,
      },
      {
        path: "/production/line-hourly-report",
        label: "Line Hourly Report",
        component: LineHourlyReport,
      },
      {
        path: "/production/consolidated-report",
        label: "Consolidated Report",
        component: ConsolidatedReport,
      },
      {
        path: "/production/model-name-update",
        label: "Model Name Update",
        component: ModelNameUpdate,
        roles: [ROLES.ADMIN, ROLES.LOGISTIC],
      },
      {
        path: "/production/nfc-report",
        label: "NFC Report",
        component: NFCReport,
      },
      {
        path: "/production/total-production",
        label: "Total Production",
        component: TotalProduction,
      },
      {
        path: "/production//stop-loss-report",
        label: "Stop Loss Report",
        component: StopLossReport,
      },
    ],
  },
  {
    key: "quality",
    icon: FaClipboardCheck,
    label: "Quality",
    basePath: "/quality",
    items: [
      {
        path: "/quality/rework-entry",
        label: "Rework Entry",
        component: ReworkEntry,
        roles: [ROLES.ADMIN],
      },
      {
        path: "/quality/rework-report",
        label: "Rework Report",
        component: ReworkReport,
        roles: [ROLES.ADMIN],
      },
      {
        path: "/quality/brazing-report",
        label: "Brazing Report",
        component: BrazingReport,
        roles: [ROLES.ADMIN],
      },
      {
        path: "/quality/gas-charging-report",
        label: "Gas Charging Report",
        component: GasChargingReport,
        roles: [ROLES.ADMIN],
      },
      {
        path: "/quality/est-report",
        label: "EST Report",
        component: ESTReport,
        roles: [ROLES.ADMIN],
      },
      {
        path: "/quality/cpt-report",
        label: "CPT Report",
        component: CPTReport,
        roles: [
          ROLES.ADMIN,
          ROLES.LINE_QUALITY_ENGINEER,
          ROLES.FPA,
          ROLES.QUALITY_MANAGER,
        ],
      },
      {
        path: "/quality/fpa",
        label: "FPA",
        component: FPA,
        roles: [ROLES.ADMIN, ROLES.FPA, ROLES.QUALITY_MANAGER],
      },
      {
        path: "/quality/fpa-report",
        label: "FPA Report",
        component: FPAReports,
      },
      {
        path: "/quality/fpa-history",
        label: "FPA History",
        component: FPAHistory,
      },
      {
        path: "/quality/fpa-defect-report",
        label: "FPA Defect Report",
        component: FPADefectReport,
      },
      {
        path: "/quality/lpt",
        label: "LPT",
        component: LPT,
        roles: [
          ROLES.ADMIN,
          ROLES.LINE_QUALITY_ENGINEER,
          ROLES.QUALITY_MANAGER,
          ROLES.LPT,
        ],
      },
      {
        path: "/quality/lpt-report",
        label: "LPT Report",
        component: LPTReport,
        roles: [
          ROLES.ADMIN,
          ROLES.LINE_QUALITY_ENGINEER,
          ROLES.QUALITY_MANAGER,
          ROLES.LPT,
        ],
      },
      {
        path: "/quality/lpt-recipe",
        label: "LPT Recipe",
        component: LPTRecipe,
        roles: [
          ROLES.ADMIN,
          ROLES.LINE_QUALITY_ENGINEER,
          ROLES.QUALITY_MANAGER,
          ROLES.LPT,
        ],
      },
      {
        path: "/quality/dispatch-hold",
        label: "Dispatch Hold",
        component: DispatchHold,
        roles: [
          ROLES.ADMIN,
          ROLES.LINE_QUALITY_ENGINEER,
          ROLES.FPA,
          ROLES.QUALITY_MANAGER,
        ],
      },
      {
        path: "/quality/hold-cabinate-details",
        label: "Hold Cabinet Details",
        component: HoldCabinateDetails,
      },
      {
        path: "/quality/tag-update",
        label: "Tag Update",
        component: TagUpdate,
        roles: [ROLES.ADMIN, ROLES.QUALITY_MANAGER],
      },
      {
        path: "/quality/upload-bis-report",
        label: "Upload BIS Report",
        component: UploadBISReport,
        roles: [ROLES.ADMIN, ROLES.BIS_ENGINEER, ROLES.QUALITY_MANAGER],
      },
      {
        path: "/quality/bis-reports",
        label: "BIS Reports",
        component: BISReports,
        roles: [
          ROLES.ADMIN,
          ROLES.LINE_QUALITY_ENGINEER,
          ROLES.BIS_ENGINEER,
          ROLES.FPA,
          ROLES.QUALITY_MANAGER,
        ],
      },
      {
        path: "/quality/bis-status",
        label: "BIS Status",
        component: BISStatus,
        roles: [
          ROLES.ADMIN,
          ROLES.LINE_QUALITY_ENGINEER,
          ROLES.BIS_ENGINEER,
          ROLES.FPA,
          ROLES.QUALITY_MANAGER,
        ],
      },
      {
        path: "/quality/bee-calculation",
        label: "BEE Calculation",
        component: BEECalculation,
        roles: [
          ROLES.ADMIN,
          ROLES.LINE_QUALITY_ENGINEER,
          ROLES.BIS_ENGINEER,
          ROLES.FPA,
          ROLES.QUALITY_MANAGER,
        ],
      },
    ],
  },
  {
    key: "dispatch",
    icon: FaTruckMoving,
    label: "Dispatch",
    basePath: "/dispatch",
    items: [
      {
        path: "/dispatch/dispatch-performance-report",
        label: "Dispatch Performance Report",
        component: DispatchPerformanceReport,
      },
      {
        path: "/dispatch/dispatch-report",
        label: "Dispatch Report",
        component: DispatchReport,
      },
      {
        path: "/dispatch/dispatch-unloading",
        label: "Dispatch Unloading",
        component: DispatchUnloading,
      },
      {
        path: "/dispatch/fg-casting",
        label: "FG Casting",
        component: FGCasting,
      },
      {
        path: "/dispatch/gate-entry",
        label: "Gate Entry",
        component: GateEntry,
        roles: [ROLES.ADMIN, ROLES.GATE_ENTRY_USER],
      },
      {
        path: "/dispatch/error-log",
        label: "Error Log",
        component: ErrorLog,
      },
    ],
  },
  {
    key: "planing",
    icon: FaClipboardList,
    label: "Planning",
    basePath: "/planing",
    items: [
      {
        path: "/planing/production-planing",
        label: "Production Planning",
        component: ProductionPlaning,
        roles: [ROLES.ADMIN, ROLES.PRODUCTION_MANAGER, ROLES.PLANNING_TEAM],
      },
      {
        path: "/planing/daily-planing",
        label: "Daily Plan",
        component: DailyPlan,
      },
    ],
  },
  {
    key: "visitor",
    icon: FaUserShield,
    label: "Visitor",
    basePath: "/visitor",
    roles: [ROLES.ADMIN, ROLES.SECURITY, ROLES.HR], // Section-level roles
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
        roles: [ROLES.ADMIN, ROLES.HR],
      },
    ],
    // Hidden routes (not shown in sidebar but accessible)
    hiddenItems: [
      {
        path: "/visitor-pass-display/:passId",
        component: VisitorPassDisplay,
      },
    ],
  },
  {
    key: "displays",
    icon: MdOutlineDisplaySettings,
    label: "Displays",
    basePath: "/displays",
    roles: [ROLES.ADMIN],
    items: [
      {
        path: "/displays/logistics",
        label: "Logistics",
        component: LogisticsDisplay,
      },
    ],
  },
  {
    key: "compliance",
    icon: MdOutlineDisplaySettings,
    label: "Compliance",
    basePath: "/compliance",
    roles: [ROLES.ADMIN],
    items: [
      {
        path: "/compliance/calibiration",
        label: "Calibration",
        component: Calibiration,
      },
    ],
  },
  {
    key: "taskReminders",
    icon: MdOutlineNotificationsActive,
    label: "Task Reminders",
    basePath: "/reminder",
    roles: [ROLES.ADMIN],
    items: [
      {
        path: "/reminder/tasks",
        label: "Manage Tasks",
        component: ManageTasks,
      },
      {
        path: "/reminder/overview",
        label: "Task Overview",
        component: TaskOverview,
      },
    ],
  },
  {
    key: "auditReport",
    icon: MdOutlineFactCheck,
    label: "Audit Report",
    basePath: "/auditreport",
    roles: [ROLES.ADMIN, ROLES.QUALITY_MANAGER],

    // Sidebar items (VISIBLE)
    items: [
      {
        path: "/auditreport/build-templates",
        label: "Build Templates",
        component: TemplateBuilder,
      },
      {
        path: "/auditreport/templates",
        label: "All Templates",
        component: TemplateList,
      },
      {
        path: "/auditreport/audits",
        label: "Audits",
        component: AuditList,
      },
    ],

    // Hidden routes (NOT in sidebar)
    hiddenItems: [
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
  {
    key: "reading",
    icon: FaClipboardList,
    label: "Utility",
    basePath: "/reading",
    items: [
      {
        path: "/reading/dehumidifier",
        label: "Utility Reading",
        component: DehumidifierDashboard,
        roles: [ROLES.ADMIN],
      },
    ],
  },
];

// Utility function to check access
export const canAccess = (userRole, allowedRoles) => {
  if (!allowedRoles || allowedRoles.length === 0) return true;
  return allowedRoles.includes(userRole);
};

// Get filtered routes for a user
export const getAccessibleRoutes = (userRole) => {
  const routes = [];

  ROUTE_CONFIG.forEach((section) => {
    // Check section-level access
    if (section.roles && !canAccess(userRole, section.roles)) {
      return;
    }

    // Filter items
    const accessibleItems = section.items.filter((item) => {
      if (item.roles) return canAccess(userRole, item.roles);
      if (section.roles) return canAccess(userRole, section.roles);
      return true;
    });

    accessibleItems.forEach((item) => {
      routes.push({
        path: item.path,
        component: item.component,
      });
    });

    // Add hidden items if user has section access
    if (section.hiddenItems) {
      section.hiddenItems.forEach((item) => {
        routes.push({
          path: item.path,
          component: item.component,
        });
      });
    }
  });

  return routes;
};

// Get filtered menu for sidebar
export const getAccessibleMenu = (userRole) => {
  return ROUTE_CONFIG.map((section) => {
    // Check section-level access
    if (section.roles && !canAccess(userRole, section.roles)) {
      return null;
    }

    // Filter items (exclude hidden items from menu)
    const accessibleItems = section.items.filter((item) => {
      if (item.roles) return canAccess(userRole, item.roles);
      if (section.roles) return canAccess(userRole, section.roles);
      return true;
    });

    if (accessibleItems.length === 0) return null;

    return {
      ...section,
      items: accessibleItems,
    };
  }).filter(Boolean);
};
