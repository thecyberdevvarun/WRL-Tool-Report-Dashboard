import { Router } from "express";
import authRoutes from "./auth.route.js";
import permissionRoutes from "./permission.route.js";
import commonRoutes from "./common.route.js";
import visitorRoutes from "./visitor.route.js";
import qualityRoutes from "./quality.route.js";
import estReportRoutes from "./est-report.route.js";
import gasChargingReportRoutes from "./gas-charging-report.route.js";
import productionRoutes from "./production.route.js";
import dispatchRoute from "./dispatch.route.js";
import productionPlaningRoutes from "./planing.route.js";
import complianceRoute from "./compliance.route.js";
import auditReport from "./audit-report.route.js";
import readingRoute from "./reading.route.js";
import dashboardRoute from "./display.route.js";
import factoryOsRoute from "./factory-os.route.js";
import partProcessRoute from "./part-process.route.js";
import masterConfigRoute from "./master-config.route.js";
import energyMeterRoute from "./energy-meter.route.js";
import visionReportRoute from "./vision-camera-report.route.js";
import chemicalRoute from "./chemical.route.js";
import settingsRoute from "./settings.route.js";
import gatepassRoute from "./gatepass.route.js";
import attendanceRoute from "./attendance.route.js";
import mailManagementRoute from "./mail-management.route.js";

const routers = Router();

routers.use("/auth", authRoutes);
routers.use("/shared", commonRoutes);
routers.use("/dashboard", dashboardRoute);
routers.use("/planing", productionPlaningRoutes);
routers.use("/prod", productionRoutes);
// IOT
routers.use("/master-config", masterConfigRoute);
routers.use("/factory-os", factoryOsRoute);
routers.use("/part-process", partProcessRoute);

// Quality
routers.use("/quality", qualityRoutes);
routers.use("/est-report", estReportRoutes);
routers.use("/gas-charging", gasChargingReportRoutes);

// Vision Camera
routers.use("/vision-report", visionReportRoute);

routers.use("/dispatch", dispatchRoute);
routers.use("/visitor", visitorRoutes);
routers.use("/gatepass", gatepassRoute);
routers.use("/manpower", attendanceRoute);
routers.use("/compliance", complianceRoute);
routers.use("/audit-report", auditReport);
routers.use("/chemical", chemicalRoute);

// Utility
routers.use("/reading", readingRoute);
routers.use("/energy-meters", energyMeterRoute);

// Settings
routers.use("/permission", permissionRoutes);
routers.use("/settings", settingsRoute);

// Mail Management 
routers.use("/mail-management", mailManagementRoute);

export default routers;
