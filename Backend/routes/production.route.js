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
  // Final FG
  getFinalFGFreezerHourlyReport,
  getFinalFGChocolateHourlyReport,
  getFinalFGVisiCoolerHourlyReport,
  getFinalFGSUSHourlyReport,
  getFinalFGLinePerformanceHourlyReport,

  // Final Loading
  getFinalLoadingFreezerHourlyReport,
  getFinalLoadingChocolateHourlyReport,
  getFinalLoadingVisiCoolerHourlyReport,
  getFinalLoadingSUSHourlyReport,
  getFinalLoadingLinePerformanceHourlyReport,

  // Post Foaming
  getPostFoamingGroupAFreezerHourlyReport,
  getPostFoamingGroupBFreezerHourlyReport,
  getPostFoamingFreezerFOWHourlyReport,
  getPostFoamingChocolateHourlyReport,
  getPostFoamingVisiCoolerHourlyReport,
  getPostFoamingSUSHourlyReport,
  getPostFoamingLinePerformanceHourlyReport,

  // Foaming
  getFoamingGroupAFreezerHourlyReport,
  getFoamingGroupBFreezerHourlyReport,
  getFoamingLinePerformanceHourlyReport,
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
import { fetchModelTrendReport } from "../controllers/production/trend/model-trend.controller.js";

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
// Final FG Stage
router.get(
  "/line-hourly-report/final-fg/freezer",
  authenticate,
  getFinalFGFreezerHourlyReport,
);
router.get(
  "/line-hourly-report/final-fg/chocolate",
  authenticate,
  getFinalFGChocolateHourlyReport,
);
router.get(
  "/line-hourly-report/final-fg/visi-cooler",
  authenticate,
  getFinalFGVisiCoolerHourlyReport,
);
router.get(
  "/line-hourly-report/final-fg/sus",
  authenticate,
  getFinalFGSUSHourlyReport,
);
router.get(
  "/line-hourly-report/final-fg/line-performance",
  authenticate,
  getFinalFGLinePerformanceHourlyReport,
);

// Final Loading Stage
router.get(
  "/line-hourly-report/final-loading/freezer",
  authenticate,
  getFinalLoadingFreezerHourlyReport,
);
router.get(
  "/line-hourly-report/final-loading/chocolate",
  authenticate,
  getFinalLoadingChocolateHourlyReport,
);
router.get(
  "/line-hourly-report/final-loading/visi-cooler",
  authenticate,
  getFinalLoadingVisiCoolerHourlyReport,
);
router.get(
  "/line-hourly-report/final-loading/sus",
  authenticate,
  getFinalLoadingSUSHourlyReport,
);
router.get(
  "/line-hourly-report/final-loading/line-performance",
  authenticate,
  getFinalLoadingLinePerformanceHourlyReport,
);

// Post Foaming Stage
router.get(
  "/line-hourly-report/post-foaming/group-a-freezer",
  authenticate,
  getPostFoamingGroupAFreezerHourlyReport,
);
router.get(
  "/line-hourly-report/post-foaming/group-b-freezer",
  authenticate,
  getPostFoamingGroupBFreezerHourlyReport,
);
router.get(
  "/line-hourly-report/post-foaming/freezer-fow",
  authenticate,
  getPostFoamingFreezerFOWHourlyReport,
);
router.get(
  "/line-hourly-report/post-foaming/chocolate",
  authenticate,
  getPostFoamingChocolateHourlyReport,
);
router.get(
  "/line-hourly-report/post-foaming/visi-cooler",
  authenticate,
  getPostFoamingVisiCoolerHourlyReport,
);
router.get(
  "/line-hourly-report/post-foaming/sus",
  authenticate,
  getPostFoamingSUSHourlyReport,
);
router.get(
  "/line-hourly-report/post-foaming/line-performance",
  authenticate,
  getPostFoamingLinePerformanceHourlyReport,
);

// Foaming Stage
router.get(
  "/line-hourly-report/foaming/group-a-freezer",
  authenticate,
  getFoamingGroupAFreezerHourlyReport,
);
router.get(
  "/line-hourly-report/foaming/group-b-freezer",
  authenticate,
  getFoamingGroupBFreezerHourlyReport,
);
router.get(
  "/line-hourly-report/foaming/line-performance",
  authenticate,
  getFoamingLinePerformanceHourlyReport,
);

// -----------------> Line Wise Report
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

// Component Details
router.get("/component-details", authenticate, getComponentDetails);

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
