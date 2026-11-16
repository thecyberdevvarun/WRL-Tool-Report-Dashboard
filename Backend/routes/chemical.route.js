import { Router } from "express";
import { authenticate } from "../middlewares/auth.js";
import {
  getCurrentLevels,
  getDailyReport,
  getReadings,
} from "../controllers/chemical-storage/reports.controller.js";

const router = Router();

// Reports & data
router.get("/tanks/current", authenticate, getCurrentLevels);
router.get("/reports/daily", authenticate, getDailyReport);
router.get("/readings", authenticate, getReadings);

export default router;
