import fs from "fs";
import { DIRS } from "./storage/config.js";
import {
  saveImageFromBase64,
  deleteMultipleImages,
  SAVED_IMAGE_NAME,
} from "./storage/image-storage.js";

/* ===================== HELPERS ===================== */

/**
 * Returns true if a value looks like a base64 image object { data, name? }.
 */
const isImageObject = (value) =>
  value !== null && typeof value === "object" && typeof value.data === "string";

/**
 * Returns true if a string is an image filename this server saved — not just
 * any text ending in ".png" (e.g. a remark like "see drawing rev2.png").
 */
const isImageFilename = (value) =>
  typeof value === "string" && SAVED_IMAGE_NAME.test(value);

/**
 * Processes a single checkpoint object:
 * - Finds fields that hold base64 image objects
 * - Saves them to disk, replaces the field value with the saved filename
 * - Collects metadata for each saved image into savedImages[]
 */
const processCheckpoint = async (checkpoint, auditCode, savedImages, failedImages) => {
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
      failedImages.push({
        checkpointId: checkpoint.id,
        checkPoint: checkpoint.checkPoint,
        field: key,
        error: error.message,
      });
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
 * @returns {{ sections: Array, savedImages: Array, failedImages: Array }}
 */
export const processAuditImages = async (sections, auditCode) => {
  if (!Array.isArray(sections)) return { sections: [], savedImages: [], failedImages: [] };

  const savedImages = [];
  const failedImages = [];

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
                  processCheckpoint(cp, auditCode, savedImages, failedImages),
                ),
              ),
            };
          }),
        );
      } else if (Array.isArray(section.checkPoints)) {
        // Old (flat) structure: section → checkPoints[]
        processed.checkPoints = await Promise.all(
          section.checkPoints.map((cp) =>
            processCheckpoint(cp, auditCode, savedImages, failedImages),
          ),
        );
      }

      return processed;
    }),
  );

  return { sections: processedSections, savedImages, failedImages };
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

// Same sanitising generateImageFileName applies to the audit code prefix.
const imagePrefixFor = (auditCode) =>
  `${String(auditCode || "").replace(/[^a-zA-Z0-9_-]/g, "").substring(0, 20)}_`;

/**
 * Deletes this audit's photo files that its final sections no longer use.
 *
 * Run only when the audit is submitted — never on draft autosaves. Autosaves
 * overlap while photos are being taken; deleting on each save removed files
 * that the entry screen (or a later save) still referenced, leaving submitted
 * audits pointing at missing photos. Until submit, unused files just wait.
 * Only files named "<auditCode>_…" are touched, so a filename planted from
 * another audit can never get that audit's evidence deleted.
 */
export const cleanupUnreferencedAuditImages = async (sections, auditCode) => {
  const prefix = imagePrefixFor(auditCode);
  if (prefix === "_") return { success: true, deletedCount: 0 };
  const referenced = new Set(extractImageFilenames(sections));
  let files = [];
  try {
    files = await fs.promises.readdir(DIRS.auditImages);
  } catch {
    return { success: true, deletedCount: 0 };
  }
  const unused = files.filter(
    (f) => f.startsWith(prefix) && SAVED_IMAGE_NAME.test(f) && !referenced.has(f),
  );
  if (!unused.length) return { success: true, deletedCount: 0 };
  console.log(`Cleaning up ${unused.length} unused image(s) for ${auditCode}`);
  return deleteMultipleImages(unused);
};
