import path from "path";
import fs from "fs";

/* ===================== ROOT UPLOADS DIR ===================== */

export const UPLOADS_DIR = path.resolve("uploads");

/* ===================== SUB DIRECTORIES ===================== */

export const DIRS = {
  bisReport: path.resolve(UPLOADS_DIR, "BISReport"),
  fpaDefect: path.resolve(UPLOADS_DIR, "FpaDefectImages"),
  calibration: path.resolve(UPLOADS_DIR, "Calibration"),
  auditImages: path.resolve(UPLOADS_DIR, "AuditImages"),
  auditTemplates: path.resolve(UPLOADS_DIR, "AuditTemplates"),
  templateBackups: path.resolve(UPLOADS_DIR, "AuditTemplates", "backups"),
};

/* ===================== ENSURE DIRS EXIST ===================== */

/**
 * Creates a directory (and all parents) if it doesn't exist.
 */
export const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

// Initialize all directories on import
[UPLOADS_DIR, ...Object.values(DIRS)].forEach(ensureDir);

/* ===================== BASE FILE TYPE CONFIGS ===================== */
export const FILE_TYPES = {
  excel: {
    allowedMimes: [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ],
    errorMessage: "Only Excel files are allowed (.xlsx, .xls)",
    maxSize: 10 * 1024 * 1024, // 10MB
  },
  pdf: {
    allowedMimes: ["application/pdf", "application/x-pdf"],
    errorMessage: "Only PDF files are allowed",
    maxSize: 10 * 1024 * 1024, // 10MB
  },
  image: {
    allowedMimes: ["image/jpeg", "image/jpg", "image/png"],
    errorMessage: "Only JPG, JPEG, PNG images are allowed",
    maxSize: 10 * 1024 * 1024, // 10MB
  },
};

/* ===================== UPLOAD-SPECIFIC CONFIGS ===================== */
// Extend base types with overrides where limits/messages differ

export const UPLOAD_CONFIGS = {
  bisReport: {
    ...FILE_TYPES.pdf,
    errorMessage: "Only PDF file are allowed",
    maxSize: FILE_TYPES.pdf.maxSize, // 10MB
  },

  fpaDefect: {
    ...FILE_TYPES.image,
    errorMessage: "Only JPEG, JPG or PNG images are allowed",
    maxSize: FILE_TYPES.image.maxSize, // 10MB
  },

  calibration: {
    allowedMimes: [
      ...FILE_TYPES.pdf.allowedMimes,
      ...FILE_TYPES.image.allowedMimes,
    ],
    errorMessage: "Only PDF or image files are allowed for calibration",
    maxSize: FILE_TYPES.pdf.maxSize || FILE_TYPES.image.maxSize, // 10MB
  },

  auditImage: {
    ...FILE_TYPES.image,
    errorMessage: "Only JPEG, JPG or PNG images are allowed",
    maxSize: FILE_TYPES.image.maxSize, // 10MB
  },
};

/* ===================== SHARED HELPERS ===================== */

/**
 * Returns true if the given mimetype is allowed for the given type key.
 */
export const isMimeAllowed = (typeKey, mimetype) =>
  FILE_TYPES[typeKey]?.allowedMimes.includes(mimetype) ?? false;

/**
 * Returns true if size is within the limit for the given type key.
 */
export const isSizeAllowed = (typeKey, size) =>
  size <= (FILE_TYPES[typeKey]?.maxSize ?? Infinity);
