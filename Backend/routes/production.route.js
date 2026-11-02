import express from "express";
import { authenticate } from "../middlewares/auth.js";
import {
  productionReportExportData,
  fetchFGData,
  fetchQuickFiltersData,
} from "../controllers/production/operations/overview.controller.js";
import {
  captureWIP,
  getLatestWIPCaptures,
} from "../controllers/production/operations/wip-capture.controller.js";
import {
  getHourlyCategoryCount,
  getHourlyModelCount,
  getHourlySummary,
} from "../controllers/production/reports/hourly-report.controller.js";
import {
  getFinalLoadingHPFrz,
  getFinalLoadingHPChoc,
  getFinalLoadingHPSUS,
  getFinalLoadingHPCAT,
  getFinalHPCAT,
  getFinalHPChoc,
  getFinalHPFrz,
  getFinalHPSUS,
  getFoamingHpFomA,
  getFoamingHpFomB,
  getFoamingHpFomCat,
  getPostGrpAHPFrz,
  getPostGrpBHPFrz,
  getPostChocHP,
  getPostFOWHP,
  getPostHPCAT,
  getPostHPSUS,
  getFinalLoadingHPVISI,
  getFinalHPVISI,
  getPostHPVISI,
} from "../controllers/production/reports/line-hourly-report.controller.js";

import {
  getFinalLoadingModelBreakdown,
  getFinalLoadingHPFrzModelBreakdown,
  getFinalLoadingHPChocModelBreakdown,
  getFinalLoadingHPVISIModelBreakdown,
  getFinalLoadingHPSUSModelBreakdown,
  getFinalHPFrzModelBreakdown,
  getFinalHPChocModelBreakdown,
  getFinalHPVISIModelBreakdown,
  getFinalHPSUSModelBreakdown,
  getPostHPGrpAModelBreakdown,
  getPostHPGrpBModelBreakdown,
  getChocPostHPModelBreakdown,
  getFOWPostHPModelBreakdown,
  getPostHPVISIModelBreakdown,
  getPostHPSUSModelBreakdown,
  getFoamingHpFomAModelBreakdown,
  getFoamingHpFomBModelBreakdown,
} from "../controllers/production/reports/line-wise-report.controller.js";

import {
  getCurrentStageStatus,
  getHistoryCard,
  getLogisticStatus,
  getComponentDetails,
  getReprintHistory,
  getReworkReport,
  getFunctionalTest,
  getSerialNumbers,
  getHoldDetails,
  getUnitSummary,
} from "../controllers/production/reports/consolidated-report.controller.js";
import {
  nfcReportExportData,
  getNfcReoprts,
  getQuickFiltersNfcReports,
} from "../controllers/production/reports/nfc-report.controller.js";
import {
  totalProductionExportData,
  getBarcodeDetails,
  getQuickFiltersBarcodeDetails,
} from "../controllers/production/reports/total-production.controller.js";
import {
  getStopLossDetail,
  getStopLossLocations,
  getStopLossLines,
  getStopLossSummary,
  getStopLossStations,
  getStopLossToday,
  getStopLossYesterday,
  getStopLossMTD,
} from "../controllers/production/reports/stop-loss.controller.js";
import {
  componentTraceabilityExportData,
  generateReport,
} from "../controllers/production/traceability/component-traceability-report.controller.js";
import {
  getFoamingBarcodeSummary,
  FoamingBarcodeSummaryExportData,
  getFoamingBarcodeSummarySummary,
} from "../controllers/production/traceability/barcode.controller.js";
import {
  getScrapDetails,
  getScrapDetailsExportData,
  getScrapDetailsSummary,
} from "../controllers/production/traceability/scrap-details.controller.js";
import {fetchModelTrendReport} from "../controllers/production/trend/model-trend.controller.js";

const router = express.Router();

// -----------------> Production Report
router.get("/fgdata", authenticate, fetchFGData);
router.get(
  "/export-production-report",
  authenticate,
  productionReportExportData,
);
router.get("/yday-fgdata", authenticate, fetchQuickFiltersData);
router.get("/today-fgdata", authenticate, fetchQuickFiltersData);
router.get("/month-fgdata", authenticate, fetchQuickFiltersData);

// -----------------> WIP Capture
router.post("/wip-capture", authenticate, captureWIP);
router.get("/wip-latest", authenticate, getLatestWIPCaptures);

// -----------------> Hourly Report
router.get("/hourly-summary", authenticate, getHourlySummary);
router.get("/hourly-model-count", authenticate, getHourlyModelCount);
router.get("/hourly-category-count", authenticate, getHourlyCategoryCount);

// -----------------> Line Hourly Report
router.get("/final-loading-hp-frz", authenticate, getFinalLoadingHPFrz);
router.get("/final-loading-hp-choc", authenticate, getFinalLoadingHPChoc);
router.get("/final-loading-hp-sus", authenticate, getFinalLoadingHPSUS);
router.get("/final-loading-hp-cat", authenticate, getFinalLoadingHPCAT);

// -----------------> Line Wise Report
// Component Details
router.get("/component-details", authenticate, getComponentDetails);

// Final Line Routes
router.get("/final-hp-frz", authenticate, getFinalHPFrz);
router.get("/final-hp-choc", authenticate, getFinalHPChoc);
router.get("/final-hp-sus", authenticate, getFinalHPSUS);
router.get("/final-hp-cat", authenticate, getFinalHPCAT);

// Post Foaming Routes
router.get("/post-hp-GrpA", authenticate, getPostGrpAHPFrz);
router.get("/post-hp-GrpB", authenticate, getPostGrpBHPFrz);
router.get("/post-hp-Choc", authenticate, getPostChocHP);
router.get("/post-hp-FOW", authenticate, getPostFOWHP);
router.get("/post-hp-sus", authenticate, getPostHPSUS);
router.get("/post-hp-cat", authenticate, getPostHPCAT);

// Foaming Routes
router.get("/Foaming-hp-fom-a", authenticate, getFoamingHpFomA);
router.get("/Foaming-hp-fom-b", authenticate, getFoamingHpFomB);
router.get("/Foaming-hp-fom-cat", authenticate, getFoamingHpFomCat);

// VISI Cooler Routes (merged into existing tabs — no new tab)
router.get("/visi-loading-hp", authenticate, getFinalLoadingHPVISI);
router.get("/visi-final-hp", authenticate, getFinalHPVISI);
router.get("/visi-post-hp", authenticate, getPostHPVISI);

// Final Loading — model breakdown
router.get("/final-loading-model", authenticate, getFinalLoadingModelBreakdown);
router.get(
  "/final-loading-hp-frz-model",
  authenticate,
  getFinalLoadingHPFrzModelBreakdown,
);
router.get(
  "/final-loading-hp-choc-model",
  authenticate,
  getFinalLoadingHPChocModelBreakdown,
);
router.get(
  "/final-loading-hp-visi-model",
  authenticate,
  getFinalLoadingHPVISIModelBreakdown,
);
router.get(
  "/final-loading-hp-sus-model",
  authenticate,
  getFinalLoadingHPSUSModelBreakdown,
);

// Final Line — model breakdown
router.get("/final-hp-frz-model", authenticate, getFinalHPFrzModelBreakdown);
router.get("/final-hp-choc-model", authenticate, getFinalHPChocModelBreakdown);
router.get("/visi-final-hp-model", authenticate, getFinalHPVISIModelBreakdown);
router.get("/final-hp-sus-model", authenticate, getFinalHPSUSModelBreakdown);

// Post Foaming — model breakdown
router.get("/post-Grp-A-model", authenticate, getPostHPGrpAModelBreakdown);
router.get("/post-Grp-B-model", authenticate, getPostHPGrpBModelBreakdown);
router.get("/post-Choc-model", authenticate, getChocPostHPModelBreakdown);
router.get("/post-FOW-model", authenticate, getFOWPostHPModelBreakdown);
router.get("/visi-post-hp-model", authenticate, getPostHPVISIModelBreakdown);
router.get("/post-hp-sus-model", authenticate, getPostHPSUSModelBreakdown);

// Foaming — model breakdown
router.get(
  "/Foaming-hp-fom-a-model",
  authenticate,
  getFoamingHpFomAModelBreakdown,
);
router.get(
  "/Foaming-hp-fom-b-model",
  authenticate,
  getFoamingHpFomBModelBreakdown,
);

// -----------------> Consolidated Report
router.get("/stage-history", authenticate, getCurrentStageStatus);
router.get("/logistic-status", authenticate, getLogisticStatus);
router.get("/history-card", authenticate, getHistoryCard);
router.get("/rework-report", authenticate, getReworkReport);
router.get("/reprint-history", authenticate, getReprintHistory);
router.get("/component-details", authenticate, getComponentDetails);
router.get("/functional-test", authenticate, getFunctionalTest);
router.get("/serial-numbers", authenticate, getSerialNumbers);
router.get("/hold-details", authenticate, getHoldDetails);
router.get("/unit-summary", authenticate, getUnitSummary);

// -----------------> NFC Report
router.get("/nfc-details", authenticate, getNfcReoprts);
router.get("/export-nfc-report", authenticate, nfcReportExportData);
router.get("/yday-nfc-report", authenticate, getQuickFiltersNfcReports);
router.get("/today-nfc-report", authenticate, getQuickFiltersNfcReports);
router.get("/month-nfc-report", authenticate, getQuickFiltersNfcReports);

// -----------------> Total Production
router.get("/barcode-details", authenticate, getBarcodeDetails);
router.get("/export-total-production", authenticate, totalProductionExportData);
router.get(
  "/yday-total-production",
  authenticate,
  getQuickFiltersBarcodeDetails,
);
router.get(
  "/today-total-production",
  authenticate,
  getQuickFiltersBarcodeDetails,
);
router.get(
  "/month-total-production",
  authenticate,
  getQuickFiltersBarcodeDetails,
);

// -----------------> Stop Loss Report
router.get("/stop-loss/summary", authenticate, getStopLossSummary);
router.get("/stop-loss/detail", authenticate, getStopLossDetail);
router.get("/stop-loss/lines", authenticate, getStopLossLines);
router.get("/stop-loss/locations", authenticate, getStopLossLocations);
router.get("/stop-loss/stations", authenticate, getStopLossStations);
router.get("/stop-loss/today", authenticate, getStopLossToday); // ← new
router.get("/stop-loss/yesterday", authenticate, getStopLossYesterday); // ← new
router.get("/stop-loss/mtd", authenticate, getStopLossMTD); // ← new

// -----------------> Component Traceability
router.get("/component-traceability", authenticate, generateReport);
router.get(
  "/export-component-traceability",
  authenticate,
  componentTraceabilityExportData,
);

// -----------------> Barcode (Foaming)
router.get("/foaming-barcode-summary", getFoamingBarcodeSummary);
router.get("/export-foaming-barcode-summary", FoamingBarcodeSummaryExportData);
router.get("/foaming-barcode-summary-summary", getFoamingBarcodeSummarySummary);

// -----------------> Scrap Details
router.get("/scrap-details", getScrapDetails);
router.get("/export-scrap-details", getScrapDetailsExportData);
router.get("/scrap-details-summary", getScrapDetailsSummary);

// -----------------> Model Trend
router.get("/model-trend", fetchModelTrendReport);

export default router;
