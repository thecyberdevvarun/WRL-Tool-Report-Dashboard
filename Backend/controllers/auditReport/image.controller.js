import path from "path";
import fs from "fs";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";
import {
  getImageInfo,
  getImageFilePath,
} from "../../utils/storage/imageStorage.js";

/**
 * Serve image file
 * GET /audit-report/images/:filename
 */
export const serveImage = tryCatch(async (req, res) => {
  const { filename } = req.params;

  if (!filename) {
    throw new AppError("Filename is required", 400);
  }

  // Validate filename (security check)
  if (
    filename.includes("..") ||
    filename.includes("/") ||
    filename.includes("\\")
  ) {
    throw new AppError("Invalid filename", 400);
  }

  // Get image info
  const imageInfo = await getImageInfo(filename);

  if (!imageInfo) {
    throw new AppError("Image not found", 404);
  }

  const filePath = getImageFilePath(filename);

  // Determine content type based on extension
  const ext = path.extname(filename).toLowerCase();
  const contentTypeMap = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
  };

  const contentType = contentTypeMap[ext] || "application/octet-stream";

  // Set headers
  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Length", imageInfo.size);
  res.setHeader("Cache-Control", "public, max-age=31536000"); // Cache for 1 year
  res.setHeader("Content-Disposition", `inline; filename="${filename}"`);

  // Stream the file
  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);

  fileStream.on("error", (error) => {
    console.error("Error streaming image:", error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "Error serving image",
      });
    }
  });
});

/**
 * Download image file
 * GET /audit-report/images/:filename/download
 */
export const downloadImage = tryCatch(async (req, res) => {
  const { filename } = req.params;

  if (!filename) {
    throw new AppError("Filename is required", 400);
  }

  // Validate filename (security check)
  if (
    filename.includes("..") ||
    filename.includes("/") ||
    filename.includes("\\")
  ) {
    throw new AppError("Invalid filename", 400);
  }

  // Get image info
  const imageInfo = await getImageInfo(filename);

  if (!imageInfo) {
    throw new AppError("Image not found", 404);
  }

  const filePath = getImageFilePath(filename);

  // Set headers for download
  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Length", imageInfo.size);
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  // Stream the file
  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);

  fileStream.on("error", (error) => {
    console.error("Error downloading image:", error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "Error downloading image",
      });
    }
  });
});

/**
 * Get image metadata
 * GET /audit-report/images/:filename/info
 */
export const getImageMetadata = tryCatch(async (req, res) => {
  const { filename } = req.params;

  if (!filename) {
    throw new AppError("Filename is required", 400);
  }

  // Validate filename
  if (
    filename.includes("..") ||
    filename.includes("/") ||
    filename.includes("\\")
  ) {
    throw new AppError("Invalid filename", 400);
  }

  const imageInfo = await getImageInfo(filename);

  if (!imageInfo) {
    throw new AppError("Image not found", 404);
  }

  res.status(200).json({
    success: true,
    message: "Image metadata retrieved successfully",
    data: imageInfo,
  });
});
