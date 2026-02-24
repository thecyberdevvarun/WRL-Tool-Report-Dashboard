import path from "path";
import fs from "fs";
import { promisify } from "util";
import { DIRS } from "./config.js";

const writeFileAsync = promisify(fs.writeFile);
const readFileAsync = promisify(fs.readFile);
const unlinkAsync = promisify(fs.unlink);
const readdirAsync = promisify(fs.readdir);

const TEMPLATES_DIR = DIRS.auditTemplates;
const BACKUPS_DIR = DIRS.templateBackups;

/* ===================== HELPERS ===================== */

const sanitizeForFilename = (str) =>
  (str ?? "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .replace(/_+/g, "_")
    .substring(0, 100);

const generateTemplateFileName = (templateName, version = "01") => {
  const name = sanitizeForFilename(templateName);
  if (!name)
    throw new Error("Template name is required for filename generation");
  return `${name}_${sanitizeForFilename(version)}.json`;
};

const getTemplateFilePath = (fileName) => path.join(TEMPLATES_DIR, fileName);

/**
 * Returns a filename that doesn't already exist on disk, appending _1, _2… if needed.
 * Pass excludeFileName to ignore the file being replaced (update scenario).
 */
const getUniqueFileName = async (
  templateName,
  version,
  excludeFileName = null,
) => {
  const base = generateTemplateFileName(templateName, version);
  let candidate = base;
  let counter = 1;

  while (
    fs.existsSync(getTemplateFilePath(candidate)) &&
    candidate !== excludeFileName
  ) {
    if (counter > 100) throw new Error("Too many duplicate template names");
    candidate = `${base.replace(".json", "")}_${counter++}.json`;
  }

  return candidate;
};

/* ===================== SAVE ===================== */

/**
 * Saves (or overwrites) a template JSON file.
 * Pass existingFileName to reuse the same filename on update.
 */
export const saveTemplateFile = async ({
  templateName,
  version = "01",
  templateCode,
  headerConfig,
  infoFields,
  columns,
  defaultSections,
  existingFileName = null,
}) => {
  const fileName =
    existingFileName && fs.existsSync(getTemplateFilePath(existingFileName))
      ? existingFileName
      : await getUniqueFileName(templateName, version);

  const filePath = getTemplateFilePath(fileName);
  const now = new Date().toISOString();

  await writeFileAsync(
    filePath,
    JSON.stringify(
      {
        templateCode: templateCode ?? null,
        templateName,
        version,
        headerConfig: headerConfig ?? {},
        infoFields: infoFields ?? [],
        columns: columns ?? [],
        defaultSections: defaultSections ?? [],
        savedAt: now,
        updatedAt: now,
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log(`Template file saved: ${fileName}`);
  return { success: true, fileName, filePath };
};

/* ===================== READ ===================== */

export const readTemplateFile = async (fileName) => {
  if (!fileName) {
    console.warn("readTemplateFile: no filename");
    return null;
  }

  const filePath = getTemplateFilePath(fileName);
  if (!fs.existsSync(filePath)) {
    console.warn(`Template not found: ${fileName}`);
    return null;
  }

  const content = await readFileAsync(filePath, "utf8");
  return JSON.parse(content);
};

/* ===================== DELETE ===================== */

export const deleteTemplateFile = async (fileName) => {
  if (!fileName) {
    console.warn("deleteTemplateFile: no filename");
    return false;
  }

  const filePath = getTemplateFilePath(fileName);
  if (!fs.existsSync(filePath)) {
    console.warn(`Template not found: ${fileName}`);
    return false;
  }

  await unlinkAsync(filePath);
  console.log(`Template file deleted: ${fileName}`);
  return true;
};

/* ===================== UPDATE (with rename support) ===================== */

export const updateTemplateFile = async ({
  oldFileName,
  templateName,
  version,
  ...rest
}) => {
  const newFileName = generateTemplateFileName(templateName, version);
  const nameChanged = oldFileName && oldFileName !== newFileName;

  let targetFileName;

  if (nameChanged) {
    // Resolve any clash with an existing file that isn't the one we're replacing
    targetFileName = fs.existsSync(getTemplateFilePath(newFileName))
      ? await getUniqueFileName(templateName, version, oldFileName)
      : newFileName;

    await deleteTemplateFile(oldFileName);
  } else {
    targetFileName = oldFileName ?? null;
  }

  return saveTemplateFile({
    templateName,
    version,
    ...rest,
    existingFileName: targetFileName,
  });
};

/* ===================== BACKUP & RENAME ===================== */

export const backupTemplateFile = async (fileName) => {
  if (!fileName) throw new Error("Filename is required for backup");
  const filePath = getTemplateFilePath(fileName);
  if (!fs.existsSync(filePath))
    throw new Error(`Template not found: ${fileName}`);

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupName = `${fileName.replace(".json", "")}_backup_${timestamp}.json`;
  const backupPath = path.join(BACKUPS_DIR, backupName);

  await writeFileAsync(
    backupPath,
    await readFileAsync(filePath, "utf8"),
    "utf8",
  );
  console.log(`Template backup created: ${backupName}`);
  return backupName;
};

export const renameTemplateFile = async (
  oldFileName,
  newTemplateName,
  newVersion,
) => {
  const oldPath = getTemplateFilePath(oldFileName);
  if (!fs.existsSync(oldPath))
    throw new Error(`Template not found: ${oldFileName}`);

  const content = await readFileAsync(oldPath, "utf8");
  const config = JSON.parse(content);
  const newFileName = await getUniqueFileName(
    newTemplateName,
    newVersion,
    oldFileName,
  );

  config.templateName = newTemplateName;
  config.version = newVersion;
  config.updatedAt = new Date().toISOString();

  await writeFileAsync(
    getTemplateFilePath(newFileName),
    JSON.stringify(config, null, 2),
    "utf8",
  );
  await unlinkAsync(oldPath);

  console.log(`Template renamed: ${oldFileName} → ${newFileName}`);
  return { success: true, oldFileName, newFileName };
};

/* ===================== LIST ===================== */

export const templateFileExists = (fileName) =>
  !!fileName && fs.existsSync(getTemplateFilePath(fileName));

export const listTemplateFiles = async () => {
  try {
    const files = await readdirAsync(TEMPLATES_DIR);
    const jsonFiles = files.filter(
      (f) => f.endsWith(".json") && !f.includes("backup"),
    );

    return Promise.all(
      jsonFiles.map(async (fileName) => {
        const config = await readTemplateFile(fileName).catch(() => null);
        return {
          fileName,
          templateName: config?.templateName ?? fileName.replace(".json", ""),
          version: config?.version ?? "1.0",
          savedAt: config?.savedAt,
        };
      }),
    );
  } catch {
    return [];
  }
};

export default {
  saveTemplateFile,
  readTemplateFile,
  deleteTemplateFile,
  updateTemplateFile,
  backupTemplateFile,
  renameTemplateFile,
  templateFileExists,
  listTemplateFiles,
};
