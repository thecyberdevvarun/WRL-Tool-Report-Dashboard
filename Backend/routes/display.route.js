import express from "express";
import { authenticate } from "../middlewares/auth.js";
import {
  getAllDashboardConfigs,
  createDashboardConfig,
  updateDashboardConfig,
  deleteDashboardConfig,
  getFGPackingData,
  getHourlyProductionData,
  getQualityData,
  getLossData,
  exportDashboardConfigs,
  importDashboardConfigs,
} from "../controllers/display/production-dashboard.controller.js";

import multer from "multer";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5_000_000 },
});

const router = express.Router();

router.get("/configs/export", authenticate, exportDashboardConfigs);
router.post(
  "/configs/import",
  authenticate,
  upload.single("file"),
  importDashboardConfigs,
);

// ── Config CRUD ──
// GET /configs stays public (no `authenticate`) — the public shop-floor TV
// page (/display/:slug, rendered outside ProtectedRoute) resolves its slug to
// a config through this same endpoint before it has any session. Everything
// else here is admin-only (Management.jsx) and is protected.
router.get("/configs", getAllDashboardConfigs);
router.post("/configs", authenticate, createDashboardConfig);
router.put("/configs/:id", authenticate, updateDashboardConfig);
router.delete("/configs/:id", authenticate, deleteDashboardConfig);

// ── Dashboard data ──
// Public by design — these feed the shop-floor TV display (/display/:slug),
// which has no login session. Do not add `authenticate` here.
router.get("/current-stage-production-performance", getFGPackingData);
router.get("/hourly-production-performance", getHourlyProductionData);
router.get("/quality-performance", getQualityData);
router.get("/loss-performance", getLossData);

export default router;
