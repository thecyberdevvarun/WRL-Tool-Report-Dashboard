import { Router } from "express";
import { authenticate } from "../middlewares/auth.js";
import { requirePageAccess } from "../middlewares/role-guard.js";
import {
  getMailTasks,
  getMailRecipients,
  createMailRecipient,
  updateMailRecipient,
  deleteMailRecipient,
  testMailRecipient,
} from "../controllers/mail-management/mail-management.controller.js";

const router = Router();

// Same rule as the menu: Super Admin always (unless hidden); any other role only if
// Settings › Permission Manager grants it the "Recipients & Tasks" page.
const guard = requirePageAccess(
  "mailManagement",
  "/mail-management/recipients",
);

router.get("/tasks", authenticate, guard, getMailTasks);
router.get("/recipients", authenticate, guard, getMailRecipients);
router.post("/recipients", authenticate, guard, createMailRecipient);
router.put("/recipients/:id", authenticate, guard, updateMailRecipient);
router.delete("/recipients/:id", authenticate, guard, deleteMailRecipient);
router.post("/recipients/:id/test", authenticate, guard, testMailRecipient);

export default router;
