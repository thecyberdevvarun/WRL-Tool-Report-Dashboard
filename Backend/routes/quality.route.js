// ── Tag Update controller — all 4 handlers imported (getTagUpdateLogs was missing before)
import {
  getAssetTagDetails,
  newAssetTagUpdate,
  newCustomerQrUpdate,
  getTagUpdateLogs,          // ← BUG FIX: was not imported or routed
} from "../controllers/quality/tag-update.controller.js";

// … all your other imports remain unchanged …
import express from "express";
import { authenticate } from "../middlewares/auth.js";
import {
  addDefect, getAssetDetails, getDefectCategory, getFpaCount,
  getFpaDefect, getFPQIDetails,
} from "../controllers/quality/fpa/fpa.controller.js";
import {
  downloadDefectImage, getFpaDailyReport, getFpaMonthlyReport,
  getFpaReport, getFpaYearlyReport,
} from "../controllers/quality/fpa/fpa-report.controller.js";
import {
  addLptDefect, getLptAssetDetails, getLptDefectCategory,
  getLptDefectCount, getLptDefectReport,
} from "../controllers/quality/lpt/lpt.controller.js";
import { getLptReport, getLptModelSummary } from "../controllers/quality/lpt/lpt-report.controller.js";
import { getMassFlowReport } from "../controllers/quality/mass-flow-meter-report.controller.js";
import {
  deleteLptRecipe, getLptRecipe, insertLptRecipe, updateLptRecipe,
} from "../controllers/quality/lpt/lpt-recipe.controller.js";
import {
  getModlelName, holdCabinet, releaseCabinet,
} from "../controllers/quality/dispatch-hold.controller.js";
import {
  handleMulterError, uploadBISReportPDF, uploadFpaDefectImage, uploadBisSignature,
  uploadBisModelPhoto,
} from "../middlewares/upload-middleware.js";
import {
  uploadBisPdfFile, getBisPdfFiles, downloadBisPdfFile,
  deleteBisPdfFile, updateBisPdfFile, getBisReportStatus,
  updateBisEnergyData, fetchBisEnergyData,
} from "../controllers/quality/bis/upload-bis-report.controller.js";
import {
  getBisCategories, createBisCategory, updateBisCategory, deleteBisCategory,
  getType100Materials, uploadBisCategoryPhoto,
  getBisModelSpecs, saveBisModelSpecs,
} from "../controllers/quality/bis/bis-category.controller.js";
import {
  getTestStalls, getTestLabDashboard, startTestRun, endTestRun,
} from "../controllers/quality/bis/bis-test-lab.controller.js";
import {
  getBisTestFrequencyConfig, updateBisTestFrequencyConfig,
} from "../controllers/quality/bis/bis-test-config.controller.js";
import {
  getBisTestSchedule, createBisTestBaseline, updateBisTestBaseline,
} from "../controllers/quality/bis/bis-test-schedule.controller.js";
import {
  createBisTestReport, getBisTestReports, getBisTestReportById,
  updateBisTestReport, deleteBisTestReport, getBisTestReportHistory,
  submitBisTestReportForReview, reviewBisTestReport, authorizeBisTestReport, getBisApprovalQueue,
} from "../controllers/quality/bis/bis-test-report.controller.js";
import {
  getBisApprovalFlow, updateBisApprovalFlow, uploadBisApprovalSignature, getBisApprovalUsers,
} from "../controllers/quality/bis/bis-approval-flow.controller.js";
import { getDispatchHoldDetails } from "../controllers/quality/hold-cabinet-details.controller.js";
import { getCPTReport } from "../controllers/quality/cpt-report.controller.js";
import {
  getReworkReport,
  getReworkReportQuick,
  getReworkReportExport,
  getReworkSummaryExport,
  getReworkDefectExport,
  getReworkDefectOptions,
  getProductionReport,
} from "../controllers/quality/rework.controller.js";
import {
  deleteBeeModel, getBeeModels, saveBeeModels, saveBeeRating,
} from "../controllers/quality/bis/bee-calculation.controller.js";
import {
  getFpaByModel, getFpaDefectDetails, getFpaHistory,
} from "../controllers/quality/fpa/fpa-history.controller.js";
import { getBrazingReport } from "../controllers/quality/brazing-report.controller.js";
import { getVacuumReport, getVacuumTestTrend } from "../controllers/quality/vacuum-loop-report.controller.js";
import {
  getScrapCategories, getScrapUnit, scrapUnit, getScrapHistory,
} from "../controllers/quality/fg-scrap.controller.js";
import {
  getTransferOptions, checkTransfer, transferUnits, getTransferHistory,
} from "../controllers/quality/model-transfer.controller.js";
import {
  getReprintPrinters, findReprintLabel, checkReprintLabels, reprintLabel, reprintLabels, getReprintHistory,
} from "../controllers/quality/barcode-reprint.controller.js";
import { requirePageAccess } from "../middlewares/role-guard.js";

const router = express.Router();

// ──────────────────────────────────────────────────────────────────────────────
// CPT
router.get("/cpt-report", authenticate, getCPTReport);

// Brazing
router.get("/brazing-report", authenticate, getBrazingReport);

// Vacuum (Pirani gauge leak test)
router.get("/vacuum-report", authenticate, getVacuumReport);
router.get("/vacuum-report/:testId/trend", authenticate, getVacuumTestTrend);

// FPA
router.get("/fpa-count", authenticate, getFpaCount);
router.get("/asset-details", authenticate, getAssetDetails);
router.get("/fpqi-details", authenticate, getFPQIDetails);
router.get("/fpa-defect", authenticate, getFpaDefect);
router.get("/fpa-defect-category", authenticate, getDefectCategory);
router.post("/add-fpa-defect", authenticate, uploadFpaDefectImage.single("image"), handleMulterError, addDefect);
router.get("/download-fpa-defect-image/:fgSrNo", authenticate, downloadDefectImage);
router.get("/history", authenticate, getFpaHistory);
router.get("/model/:model", authenticate, getFpaByModel);
router.get("/defects/:fgsrNo", authenticate, getFpaDefectDetails);

// Rework
router.get("/rework-report", authenticate, getReworkReport);
router.get("/rework-report-quick", authenticate, getReworkReportQuick);
router.get("/rework-report-export", authenticate, getReworkReportExport);
router.get("/rework-summary-export", authenticate, getReworkSummaryExport);
router.get("/rework-defect-export", authenticate, getReworkDefectExport);
router.get("/rework-defect-options", authenticate, getReworkDefectOptions);
router.get("/production-report", authenticate, getProductionReport);

// FPA Reports
router.get("/fpa-report", authenticate, getFpaReport);
router.get("/fpa-daily-report", authenticate, getFpaDailyReport);
router.get("/fpa-monthly-report", authenticate, getFpaMonthlyReport);
router.get("/fpa-yearly-report", authenticate, getFpaYearlyReport);

// LPT
router.get("/lpt-asset-details", authenticate, getLptAssetDetails);
router.get("/lpt-defect-category", authenticate, getLptDefectCategory);
router.post("/add-lpt-defect", authenticate, addLptDefect);
router.get("/lpt-defect-report", authenticate, getLptDefectReport);
router.get("/lpt-defect-count", authenticate, getLptDefectCount);
router.get("/lpt-report", authenticate, getLptReport);
router.get("/lpt-model-summary", authenticate, getLptModelSummary);

// Mass Flow
router.get("/mass-flow-report", authenticate, getMassFlowReport);

// LPT Recipe
router.get("/lpt-recipe", authenticate, getLptRecipe);
router.delete("/lpt-recipe/:modelName", authenticate, deleteLptRecipe);
router.post("/lpt-recipe", authenticate, insertLptRecipe);
router.put("/lpt-recipe/:modelName", authenticate, updateLptRecipe);

// Dispatch Hold
router.get("/model-name", authenticate, getModlelName);
router.post("/hold", authenticate, holdCabinet);
router.post("/release", authenticate, releaseCabinet);

// ──────────────────────────────────────────────────────────────────────────────
// Tag Update  ← all 4 routes now registered
router.get("/asset-tag-details", authenticate, getAssetTagDetails);
router.put("/new-asset-tag", authenticate, newAssetTagUpdate);
router.put("/new-customer-qr", authenticate, newCustomerQrUpdate);
router.get("/tag-update-logs", authenticate, getTagUpdateLogs);   // ← BUG FIX: route was missing entirely

// BIS
router.post("/upload-bis-pdf", authenticate, uploadBISReportPDF.single("file"), handleMulterError, uploadBisPdfFile);
router.get("/bis-files", authenticate, getBisPdfFiles);
router.get("/download-bis-file/:srNo", authenticate, downloadBisPdfFile);
router.delete("/delete-bis-file/:srNo", authenticate, deleteBisPdfFile);
router.put("/update-bis-file/:srNo", authenticate, uploadBISReportPDF.single("file"), handleMulterError, updateBisPdfFile);
router.get("/bis-status", authenticate, getBisReportStatus);
router.put("/bis-energy-data/:srNo", authenticate, updateBisEnergyData);
router.post("/bis-fetch-energy-data/:srNo", authenticate, fetchBisEnergyData);

// BIS Config (BISCategory master — manually managed BIS/Non-BIS classification)
router.get("/bis-category", authenticate, getBisCategories);
router.post("/bis-category", authenticate, createBisCategory);
router.put("/bis-category/:id", authenticate, updateBisCategory);
router.delete("/bis-category/:id", authenticate, deleteBisCategory);
router.get("/type100-materials", authenticate, getType100Materials);
router.post("/bis-category/:id/photo", authenticate, uploadBisModelPhoto.single("photo"), handleMulterError, uploadBisCategoryPhoto);

// BIS Model Specs — config-time spec sheet shown on the Test Lab Dashboard
router.get("/bis-model-specs/:materialCode", authenticate, getBisModelSpecs);
router.put("/bis-model-specs/:materialCode", authenticate, saveBisModelSpecs);

// BIS Test Lab Dashboard — Start/End is the operator physically putting a
// unit on a stall, independent of the test report (written up only after
// the test is already finished)
router.get("/bis-test-stalls", authenticate, getTestStalls);
router.get("/bis-test-lab-dashboard", authenticate, getTestLabDashboard);
router.post("/bis-test-run", authenticate, startTestRun);
router.post("/bis-test-run/:runId/end", authenticate, endTestRun);

// BIS Test Schedule — frequency/duration config + computed schedule + one-time baseline setup
router.get("/bis-test-config", authenticate, getBisTestFrequencyConfig);
router.put("/bis-test-config", authenticate, updateBisTestFrequencyConfig);
router.get("/bis-test-schedule", authenticate, getBisTestSchedule);
router.post("/bis-test-baseline", authenticate, createBisTestBaseline);
router.put("/bis-test-baseline/:id", authenticate, updateBisTestBaseline);

// BIS Test Reports — in-app report creation replacing PDF upload
router.get("/bis-test-reports", authenticate, getBisTestReports);
router.post("/bis-test-reports", authenticate, createBisTestReport);
router.get("/bis-test-reports/:id", authenticate, getBisTestReportById);
router.put("/bis-test-reports/:id", authenticate, updateBisTestReport);
router.delete("/bis-test-reports/:id", authenticate, deleteBisTestReport);
router.get("/bis-test-reports/:id/history", authenticate, getBisTestReportHistory);

// BIS Approval Workflow — Draft → PendingReview → PendingApproval → Final
router.post("/bis-test-reports/:id/submit-for-review", authenticate, submitBisTestReportForReview);
router.post("/bis-test-reports/:id/review", authenticate, reviewBisTestReport);
router.post("/bis-test-reports/:id/authorize", authenticate, authorizeBisTestReport);
router.get("/bis-approval-queue", authenticate, getBisApprovalQueue);

// BIS Approval Flow config — who holds each role + their signature image
router.get("/bis-approval-flow", authenticate, getBisApprovalFlow);
router.put("/bis-approval-flow", authenticate, updateBisApprovalFlow);
router.post("/bis-approval-flow/signature/:role", authenticate, uploadBisSignature.single("signature"), handleMulterError, uploadBisApprovalSignature);
router.get("/bis-approval-users", authenticate, getBisApprovalUsers);

// BEE Calculation
router.get("/bee/models", authenticate, getBeeModels);
router.post("/bee/models", authenticate, saveBeeModels);
router.delete("/bee/models/:model", authenticate, deleteBeeModel);
router.post("/bee/save-rating", authenticate, saveBeeRating);

// Hold Cabinet Details
router.get("/hold-cabinet-details", authenticate, getDispatchHoldDetails);

// FG Scrap, Model To Model Transfer, Material Barcode reprint (copied from Garuda; they write to the Garuda database,
// so each checks the page's permission on the server too)
const fgScrapPage = [authenticate, requirePageAccess("quality", "/quality/fg-scrap")];
router.get("/fg-scrap/categories", ...fgScrapPage, getScrapCategories);
router.get("/fg-scrap/history", ...fgScrapPage, getScrapHistory);
router.get("/fg-scrap/units/:serial", ...fgScrapPage, getScrapUnit);
router.post("/fg-scrap", ...fgScrapPage, scrapUnit);

const modelTransferPage = [authenticate, requirePageAccess("quality", "/quality/model-transfer")];
router.get("/model-transfer/options", ...modelTransferPage, getTransferOptions);
router.get("/model-transfer/history", ...modelTransferPage, getTransferHistory);
router.post("/model-transfer/check", ...modelTransferPage, checkTransfer);
router.post("/model-transfer", ...modelTransferPage, transferUnits);

const reprintPage = [authenticate, requirePageAccess("quality", "/quality/barcode-reprint")];
router.get("/barcode-reprint/printers", ...reprintPage, getReprintPrinters);
router.get("/barcode-reprint/history", ...reprintPage, getReprintHistory);
router.post("/barcode-reprint/check", ...reprintPage, checkReprintLabels);
router.post("/barcode-reprint/many", ...reprintPage, reprintLabels);
router.get("/barcode-reprint/:serial", ...reprintPage, findReprintLabel);
router.post("/barcode-reprint", ...reprintPage, reprintLabel);

export default router;
