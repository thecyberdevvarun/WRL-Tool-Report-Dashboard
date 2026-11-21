import express from "express";
import {
  login,
  logout,
  changePassword,
  getMyPhoto,
  sessionPing,
} from "../controllers/auth.controller.js";
import { authenticate } from "../middlewares/auth.js";

const router = express.Router();

// router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", logout);
router.post("/change-password", authenticate, changePassword);
router.get("/my-photo", authenticate, getMyPhoto);
router.get("/session", authenticate, sessionPing);

export default router;
