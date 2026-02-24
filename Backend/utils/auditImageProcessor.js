import {
  saveImageFromBase64,
  deleteMultipleImages,
} from "./storage/imageStorage.js";

/* ===================== HELPERS ===================== */

/**
 * Returns true if a value looks like a base64 image object { data, name? }.
 */
const isImageObject = (value) =>
  value !== null && typeof value === "object" && typeof value.data === "string";

/**
 * Returns true if a string looks like an image filename.
 */
const isImageFilename = (value) =>
  typeof value === "string" && /\.(jpg|jpeg|png)$/i.test(value);

/**
 * Processes a single checkpoint object:
 * - Finds fields that hold base64 image objects
 * - Saves them to disk, replaces the field value with the saved filename
 * - Collects metadata for each saved image into savedImages[]
 */
const processCheckpoint = async (checkpoint, auditCode, savedImages) => {
  const processed = { ...checkpoint };

  for (const [key, value] of Object.entries(checkpoint)) {
    if (!isImageObject(value)) continue;

    try {
      const result = await saveImageFromBase64({
        base64Data: value.data,
        fileName: value.name ?? `checkpoint_${key}.jpg`,
        auditCode,
      });

      processed[key] = result.fileName;
      savedImages.push({
        field: key,
        fileName: result.fileName,
        originalName: value.name,
        size: result.size,
      });
    } catch (error) {
      console.error(`Error saving image for field "${key}":`, error);
      processed[key] = null;
    }
  }

  return processed;
};

/**
 * Collects image filenames from a single checkpoint.
 */
const extractFromCheckpoint = (checkpoint, out) => {
  for (const value of Object.values(checkpoint)) {
    if (isImageFilename(value)) out.push(value);
  }
};

/* ===================== PUBLIC API ===================== */

/**
 * Walks all checkpoints in every section (supports both old flat structure
 * and new stages structure), saves any embedded base64 images to disk,
 * and replaces the image object with the saved filename.
 *
 * @param {Array}  sections  - Audit sections array
 * @param {string} auditCode - Used as filename prefix
 * @returns {{ sections: Array, savedImages: Array }}
 */
export const processAuditImages = async (sections, auditCode) => {
  if (!Array.isArray(sections)) return { sections: [], savedImages: [] };

  const savedImages = [];

  const processedSections = await Promise.all(
    sections.map(async (section) => {
      const processed = { ...section };

      if (Array.isArray(section.stages)) {
        // New structure: section → stages[] → checkPoints[]
        processed.stages = await Promise.all(
          section.stages.map(async (stage) => {
            if (!Array.isArray(stage.checkPoints)) return stage;
            return {
              ...stage,
              checkPoints: await Promise.all(
                stage.checkPoints.map((cp) =>
                  processCheckpoint(cp, auditCode, savedImages),
                ),
              ),
            };
          }),
        );
      } else if (Array.isArray(section.checkPoints)) {
        // Old (flat) structure: section → checkPoints[]
        processed.checkPoints = await Promise.all(
          section.checkPoints.map((cp) =>
            processCheckpoint(cp, auditCode, savedImages),
          ),
        );
      }

      return processed;
    }),
  );

  return { sections: processedSections, savedImages };
};

/**
 * Extracts all image filenames stored in audit sections.
 * @param {Array} sections
 * @returns {string[]}
 */
export const extractImageFilenames = (sections) => {
  if (!Array.isArray(sections)) return [];

  const filenames = [];

  for (const section of sections) {
    if (Array.isArray(section.stages)) {
      for (const stage of section.stages) {
        if (Array.isArray(stage.checkPoints)) {
          stage.checkPoints.forEach((cp) =>
            extractFromCheckpoint(cp, filenames),
          );
        }
      }
    } else if (Array.isArray(section.checkPoints)) {
      section.checkPoints.forEach((cp) => extractFromCheckpoint(cp, filenames));
    }
  }

  return filenames;
};

/**
 * Deletes all images associated with an audit.
 */
export const deleteAuditImages = async (sections) => {
  const filenames = extractImageFilenames(sections);
  if (!filenames.length) return { success: true, deletedCount: 0 };
  console.log(`Deleting ${filenames.length} images from audit`);
  return deleteMultipleImages(filenames);
};

/**
 * Compares old and new sections; deletes any images that were removed.
 */
export const cleanupRemovedImages = async (oldSections, newSections) => {
  const oldImages = new Set(extractImageFilenames(oldSections));
  const newImages = new Set(extractImageFilenames(newSections));
  const removed = [...oldImages].filter((img) => !newImages.has(img));

  if (!removed.length) return { success: true, deletedCount: 0 };
  console.log(`Cleaning up ${removed.length} removed images`);
  return deleteMultipleImages(removed);
};
