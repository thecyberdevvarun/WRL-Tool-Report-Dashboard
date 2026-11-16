import express from "express";
import {
  getAllTemplates,
  getTemplateById,
  createTemplate,
  createTemplateVersion,
  updateTemplate,
  deleteTemplate,
  duplicateTemplate,
  checkTemplateName,
  getTemplateHistory,
  getTemplateVersions,
  getTemplateVersionFile,
  compareTemplateVersions,
  requireTemplateAuthor,
  uploadTemplateDocument,
  removeTemplateDocument,
  serveTemplateDocument,
} from "../controllers/audit-report/template.controller.js";
import { uploadAuditTemplateDoc, handleMulterError } from "../middlewares/upload-middleware.js";
import {
  getAllAudits,
  getAuditById,
  createAudit,
  updateAudit,
  deleteAudit,
  approveAudit,
  rejectAudit,
  getAuditHistory,
  getAuditStats,
  getAuditModelSummary,
} from "../controllers/audit-report/audit.controller.js";
import {
  downloadImage,
  getImageMetadata,
  serveImage,
} from "../controllers/audit-report/image.controller.js";
import { getAuditMis } from "../controllers/audit-report/audit-mis.controller.js";
import { authenticate } from "../middlewares/auth.js";

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// Every :id is an integer key — reject anything else with a 400 up front
// instead of letting the SQL driver fail it as a 500.
router.param("id", (req, res, next, id) => {
  if (!/^\d{1,10}$/.test(id) || Number(id) > 2147483647) {
    return res.status(400).json({ success: false, message: "Invalid id" });
  }
  next();
});

// ==================== Image Routes ====================
router.get("/images/:filename/download", downloadImage);
router.get("/images/:filename/info", getImageMetadata);
router.get("/images/:filename", serveImage);

// ==================== Template Routes ====================
// check-name must be registered before the /:id routes — otherwise Express
// would match "check-name" as an :id param.
router.get("/templates/check-name", checkTemplateName);
router.get("/templates", getAllTemplates);
router.get("/templates/:id", getTemplateById);
router.post("/templates", createTemplate);
router.post("/templates/:id/version", createTemplateVersion);
router.put("/templates/:id", updateTemplate);
router.delete("/templates/:id", deleteTemplate);
router.post("/templates/:id/duplicate", duplicateTemplate);
router.get("/templates/:id/history", getTemplateHistory);
router.get("/templates/:id/versions", getTemplateVersions);
router.get("/templates/:id/compare", compareTemplateVersions);
router.get("/templates/:id/versions/:version", getTemplateVersionFile);

// ==================== BOM Sheet / CRF documents ====================
router.post(
  "/templates/:id/documents/:kind",
  requireTemplateAuthor,
  uploadAuditTemplateDoc.single("file"),
  handleMulterError,
  uploadTemplateDocument,
);
router.delete("/templates/:id/documents/:kind", removeTemplateDocument);
router.get("/documents/:filename", serveTemplateDocument);

// ==================== Audit MIS ====================
router.get("/mis", getAuditMis);

// ==================== Audit Routes ====================
router.get("/audits/stats", getAuditStats);
router.get("/audits/model-summary", getAuditModelSummary);
router.get("/audits", getAllAudits);
router.get("/audits/:id/history", getAuditHistory);
router.get("/audits/:id", getAuditById);
router.post("/audits", createAudit);
router.put("/audits/:id", updateAudit);
router.delete("/audits/:id", deleteAudit);
router.post("/audits/:id/approve", approveAudit);
router.post("/audits/:id/reject", rejectAudit);

export default router;
