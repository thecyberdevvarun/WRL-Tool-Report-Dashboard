import { Router } from "express";
import { authenticate } from "../middlewares/auth.js";
import {
  uploadMachineImage,
  uploadMaterialDrawing,
  handleMulterError,
} from "../middlewares/upload-middleware.js";
import {
  getMaterials,
  createMaterial,
  updateMaterial,
  deleteMaterial,
  bulkUpsertMaterials,
  uploadMaterialDrawing as uploadMaterialDrawingHandler,
  deleteMaterialDrawing,
  recalculateActualCycleTime,
} from "../controllers/iot/master-config/materials.controller.js";
import {
  getShifts,
  getShiftHistory,
  createShift,
  updateShift,
  deleteShift,
} from "../controllers/iot/master-config/shifts.controller.js";
import {
  getMachineShiftAllocations,
  getMachineShiftAllocationHistory,
  setMachineShiftAllocations,
} from "../controllers/iot/master-config/machine-shift-allocations.controller.js";
import {
  getDowntimeReasons,
  createDowntimeReason,
  updateDowntimeReason,
  deleteDowntimeReason,
} from "../controllers/iot/master-config/downtime-reasons.controller.js";
import {
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from "../controllers/iot/master-config/departments.controller.js";
import {
  getQualityDefects,
  createQualityDefect,
  updateQualityDefect,
  deleteQualityDefect,
} from "../controllers/iot/master-config/quality-defects.controller.js";
import {
  getMachines,
  createMachine,
  updateMachine,
  deleteMachine,
  uploadMachineImage as uploadMachineImageHandler,
} from "../controllers/iot/master-config/machines.controller.js";
import {
  getPlans,
  createPlan,
  updatePlan,
  deletePlan,
  bulkUpsertPlans,
} from "../controllers/iot/master-config/plans.controller.js";
import {
  getCheckpointLibrary,
  createCheckpointLibraryEntry,
  updateCheckpointLibraryEntry,
  deleteCheckpointLibraryEntry,
  incrementCheckpointUsage,
} from "../controllers/iot/master-config/checkpoint-library.controller.js";

const router = Router();

// Materials
router.get("/materials", authenticate, getMaterials);
router.post("/materials", authenticate, createMaterial);
router.post("/materials/bulk", authenticate, bulkUpsertMaterials);
router.post(
  "/materials/recalculate-actual-ct",
  authenticate,
  recalculateActualCycleTime,
);
router.put("/materials/:id", authenticate, updateMaterial);
router.delete("/materials/:id", authenticate, deleteMaterial);
router.post(
  "/materials/:id/drawing",
  authenticate,
  uploadMaterialDrawing.single("drawing"),
  handleMulterError,
  uploadMaterialDrawingHandler,
);
router.delete("/materials/:id/drawing", authenticate, deleteMaterialDrawing);

// Shifts
router.get("/shifts", authenticate, getShifts);
router.get("/shifts/history", authenticate, getShiftHistory);
router.post("/shifts", authenticate, createShift);
router.put("/shifts/:id", authenticate, updateShift);
router.delete("/shifts/:id", authenticate, deleteShift);

// Machine-Shift Allocations
router.get(
  "/machine-shift-allocations",
  authenticate,
  getMachineShiftAllocations,
);
router.get(
  "/machine-shift-allocations/history",
  authenticate,
  getMachineShiftAllocationHistory,
);
router.put(
  "/machine-shift-allocations",
  authenticate,
  setMachineShiftAllocations,
);

// Downtime Reasons
router.get("/downtime-reasons", authenticate, getDowntimeReasons);
router.post("/downtime-reasons", authenticate, createDowntimeReason);
router.put("/downtime-reasons/:id", authenticate, updateDowntimeReason);
router.delete("/downtime-reasons/:id", authenticate, deleteDowntimeReason);

// Departments
router.get("/departments", authenticate, getDepartments);
router.post("/departments", authenticate, createDepartment);
router.put("/departments/:id", authenticate, updateDepartment);
router.delete("/departments/:id", authenticate, deleteDepartment);

// Quality Defects
router.get("/quality-defects", authenticate, getQualityDefects);
router.post("/quality-defects", authenticate, createQualityDefect);
router.put("/quality-defects/:id", authenticate, updateQualityDefect);
router.delete("/quality-defects/:id", authenticate, deleteQualityDefect);

// Machines
router.get("/machines", authenticate, getMachines);
router.post("/machines", authenticate, createMachine);
router.put("/machines/:id", authenticate, updateMachine);
router.delete("/machines/:id", authenticate, deleteMachine);
router.post(
  "/machines/:id/image",
  authenticate,
  uploadMachineImage.single("image"),
  handleMulterError,
  uploadMachineImageHandler,
);

// Production Plans
router.get("/plans", authenticate, getPlans);
router.post("/plans", authenticate, createPlan);
router.post("/plans/bulk", authenticate, bulkUpsertPlans);
router.put("/plans/:id", authenticate, updatePlan);
router.delete("/plans/:id", authenticate, deletePlan);

// Checkpoint Library
router.get("/checkpoint-library", authenticate, getCheckpointLibrary);
router.post("/checkpoint-library", authenticate, createCheckpointLibraryEntry);
router.put(
  "/checkpoint-library/:id",
  authenticate,
  updateCheckpointLibraryEntry,
);
router.delete(
  "/checkpoint-library/:id",
  authenticate,
  deleteCheckpointLibraryEntry,
);
router.post(
  "/checkpoint-library/:id/increment-usage",
  authenticate,
  incrementCheckpointUsage,
);

export default router;
