import path from "path";
import fs from "fs";
import { promisify } from "util";
import crypto from "crypto";
import { DIRS, UPLOAD_CONFIGS } from "./config.js";

const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);
const readdirAsync = promisify(fs.readdir);
const statAsync = promisify(fs.stat);

const IMAGE_DIR = DIRS.auditImages;
const { allowedMimes, maxSize } = UPLOAD_CONFIGS.auditImage;
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png"];

/* ===================== HELPERS ===================== */

/**
 * Generates a unique filename: <auditCode>_<timestamp>_<random><ext>
 */
export const generateImageFileName = (originalName, auditCode = "") => {
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString("hex");
  const ext = path.extname(originalName).toLowerCase();
  const sanitized = auditCode.replace(/[^a-zA-Z0-9_-]/g, "").substring(0, 20);

  return sanitized
    ? `${sanitized}_${timestamp}_${random}${ext}`
    : `IMG_${timestamp}_${random}${ext}`;
};

export const getImageFilePath = (fileName) => path.join(IMAGE_DIR, fileName);

const validateImage = (mimetype, size) => {
  if (!allowedMimes.includes(mimetype)) {
    throw new Error(`Invalid image type: ${mimetype}. Allowed: JPG, JPEG, PNG`);
  }
  if (size > maxSize) {
    throw new Error(
      `Image size exceeds ${maxSize / 1024 / 1024}MB limit. Size: ${(size / 1024 / 1024).toFixed(2)}MB`,
    );
  }
};

/* ===================== SAVE ===================== */

/**
 * Saves an image from a base64 data string.
 */
export const saveImageFromBase64 = async ({
  base64Data,
  fileName,
  auditCode = "",
}) => {
  if (!base64Data || !fileName)
    throw new Error("base64Data and fileName are required");

  let mimeType = "image/jpeg";
  let base64Clean = base64Data;

  if (base64Data.includes("data:")) {
    const match = base64Data.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    if (match) {
      [, mimeType, base64Clean] = match;
    } else {
      base64Clean = base64Data.split(",")[1] ?? base64Data;
    }
  }

  const buffer = Buffer.from(base64Clean, "base64");
  validateImage(mimeType, buffer.length);

  const uniqueName = generateImageFileName(fileName, auditCode);
  const filePath = getImageFilePath(uniqueName);

  await writeFileAsync(filePath, buffer);
  console.log(
    `Image saved: ${uniqueName} (${(buffer.length / 1024).toFixed(2)}KB)`,
  );

  return {
    success: true,
    fileName: uniqueName,
    filePath,
    size: buffer.length,
    mimeType,
    savedAt: new Date().toISOString(),
  };
};

/**
 * Saves an uploaded image (from multer memoryStorage buffer).
 */
export const saveUploadedImage = async (file, auditCode = "") => {
  if (!file) throw new Error("No file provided");
  validateImage(file.mimetype, file.size);

  const uniqueName = generateImageFileName(file.originalname, auditCode);
  const filePath = getImageFilePath(uniqueName);

  await writeFileAsync(filePath, file.buffer);
  console.log(
    `Image uploaded: ${uniqueName} (${(file.size / 1024).toFixed(2)}KB)`,
  );

  return {
    success: true,
    fileName: uniqueName,
    filePath,
    size: file.size,
    mimeType: file.mimetype,
    originalName: file.originalname,
    savedAt: new Date().toISOString(),
  };
};

/* ===================== DELETE ===================== */

/**
 * Deletes a single image by filename. Returns false if not found.
 */
export const deleteImage = async (fileName) => {
  if (!fileName) return false;
  const filePath = getImageFilePath(fileName);
  if (!fs.existsSync(filePath)) return false;
  await unlinkAsync(filePath);
  console.log(`Image deleted: ${fileName}`);
  return true;
};

/**
 * Deletes multiple images. Returns a summary with any per-file errors.
 */
export const deleteMultipleImages = async (fileNames) => {
  if (!Array.isArray(fileNames) || fileNames.length === 0) {
    return { success: true, deletedCount: 0, totalCount: 0, errors: null };
  }

  let deletedCount = 0;
  const errors = [];

  for (const fileName of fileNames) {
    try {
      if (await deleteImage(fileName)) deletedCount++;
    } catch (err) {
      errors.push({ fileName, error: err.message });
    }
  }

  return {
    success: true,
    deletedCount,
    totalCount: fileNames.length,
    errors: errors.length ? errors : null,
  };
};

/* ===================== QUERY ===================== */

export const imageExists = (fileName) =>
  !!fileName && fs.existsSync(getImageFilePath(fileName));

export const getImageInfo = async (fileName) => {
  if (!fileName) return null;
  const filePath = getImageFilePath(fileName);
  if (!fs.existsSync(filePath)) return null;
  const stats = await statAsync(filePath);
  return {
    fileName,
    filePath,
    size: stats.size,
    createdAt: stats.birthtime,
    modifiedAt: stats.mtime,
  };
};

export const listImages = async () => {
  try {
    const files = await readdirAsync(IMAGE_DIR);
    const imageFiles = files.filter((f) =>
      IMAGE_EXTENSIONS.includes(path.extname(f).toLowerCase()),
    );
    const infos = await Promise.all(imageFiles.map(getImageInfo));
    return infos.filter(Boolean);
  } catch {
    return [];
  }
};

export const getTotalImageSize = async () => {
  const images = await listImages();
  return images.reduce((sum, img) => sum + (img.size ?? 0), 0);
};

/**
 * Deletes images not referenced in the provided list.
 */
export const cleanupOrphanedImages = async (referencedFileNames = []) => {
  const all = await listImages();
  const orphans = all.filter(
    (img) => !referencedFileNames.includes(img.fileName),
  );
  if (!orphans.length)
    return { success: true, deletedCount: 0, orphanedCount: 0 };

  const result = await deleteMultipleImages(orphans.map((img) => img.fileName));
  return {
    success: true,
    deletedCount: result.deletedCount,
    orphanedCount: orphans.length,
  };
};
