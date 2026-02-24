import multer from "multer";
import path from "path";
import { UPLOADS_DIR, UPLOAD_CONFIGS } from "../utils/storage/config.js";

/* ===================== STORAGE FACTORY ===================== */

/**
 * Creates a multer DiskStorage for the given subfolder under uploads/.
 * @param {string} folder - Subfolder name (e.g. "BISReport")
 */
const createStorage = (folder) =>
  multer.diskStorage({
    destination: (_req, _file, cb) =>
      cb(null, path.resolve(UPLOADS_DIR, folder)),

    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const base = path
        .basename(file.originalname, ext)
        .replace(/\s+/g, "_")
        .replace(/[^a-zA-Z0-9_-]/g, "");

      if (folder === "FpaDefectImages") {
        const { FGSerialNumber } = req.body;
        if (!FGSerialNumber) {
          return cb(new Error("FGSerialNumber is required for defect images"));
        }
        return cb(null, `${FGSerialNumber}-${Date.now()}${ext}`);
      }

      const uid = Math.floor(100000 + Math.random() * 900000);
      cb(null, `${base}-${uid}${ext}`);
    },
  });

/* ===================== FILE FILTER FACTORY ===================== */

/**
 * Creates a multer fileFilter using an UPLOAD_CONFIGS key.
 * @param {string} uploadKey - Key in UPLOAD_CONFIGS (e.g. "bisReport", "fpaDefect")
 */
const createFileFilter = (uploadKey) => (_req, file, cb) => {
  const config = UPLOAD_CONFIGS[uploadKey];
  if (config.allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(config.errorMessage), false);
  }
};

/* ===================== UPLOAD MIDDLEWARES ===================== */

export const uploadBISReportPDF = multer({
  storage: createStorage("BISReport"),
  fileFilter: createFileFilter("bisReport"),
  limits: { fileSize: UPLOAD_CONFIGS.bisReport.maxSize },
});

export const uploadFpaDefectImage = multer({
  storage: createStorage("FpaDefectImages"),
  fileFilter: createFileFilter("fpaDefect"),
  limits: { fileSize: UPLOAD_CONFIGS.fpaDefect.maxSize },
});

export const uploadCalibrationFile = multer({
  storage: createStorage("Calibration"),
  fileFilter: createFileFilter("calibration"),
  limits: { fileSize: UPLOAD_CONFIGS.calibration.maxSize },
});

/* ===================== ERROR HANDLER ===================== */

export const handleMulterError = (err, _req, res, next) => {
  if (err instanceof multer.MulterError || err) {
    return res
      .status(400)
      .json({ success: false, message: err.message || "File upload error" });
  }
  next();
};
