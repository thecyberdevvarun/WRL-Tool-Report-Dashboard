import express from "express";
import {
  getDispatchCategoryModelCount,
  getDispatchCategorySummary,
  getDispatchModelCount,
  getDispatchModelSummary,
  getDispatchVehicleSummary,
  getDispatchVehicleUPH,
} from "../controllers/dispatch/performanceReport.controller.js";
import {
  getFgDispatch,
  getFgUnloading,
  getQuickFgDispatch,
  getQuickFgUnloading,
} from "../controllers/dispatch/dispatchReport.controller.js";
import { getDispatchMasterBySession } from "../controllers/dispatch/fgCasting.controller.js";
import { sendMaterialGateEntryAlertEmail } from "../controllers/dispatch/gateEntry.controller.js";
import { getDispatchErrorLog } from "../controllers/dispatch/errorLog.controller.js";
import { fetchDispatchErrorSerials, removeDispatchErrorSerials } from "../controllers/dispatch/removeDispatchError.controller.js";

const router = express.Router();

// -----------------> Performance Report Routes
router.get("/vehicle-uph", getDispatchVehicleUPH);
router.get("/vehicle-summary", getDispatchVehicleSummary);
router.get("/model-count", getDispatchModelCount);
router.get("/model-summary", getDispatchModelSummary);
router.get("/category-model-count", getDispatchCategoryModelCount);
router.get("/category-summary", getDispatchCategorySummary);

// -----------------> Dispatch Report Routes
router.get("/fg-unloading", getFgUnloading);
router.get("/fg-dispatch", getFgDispatch);
router.get("/quick-fg-unloading", getQuickFgUnloading);
router.get("/quick-fg-dispatch", getQuickFgDispatch);

// -----------------> FG Casting Routes
router.get("/fg-casting", getDispatchMasterBySession);

// -----------------> Gate Entry Routes
router.post("/material-gate-entry", sendMaterialGateEntryAlertEmail);

// -----------------> Error Log Routes
router.get("/error-log", getDispatchErrorLog);

// -----------------> Remove Dispatch Error Serials
router.post("/fetch-error-serials", fetchDispatchErrorSerials);
router.post("/remove-error-serials", removeDispatchErrorSerials);

export default router;
