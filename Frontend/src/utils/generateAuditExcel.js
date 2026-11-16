import ExcelJS from "exceljs";
import { getWrlLogoBase64, LOGO_ASPECT } from "./reportLogo.js";
import { imageKey, resolveCheckpointImages } from "./auditImageResolver.js";
import { formatDuration, formatDateForDisplay } from "./dateUtils.js";
import { buildAuditFilename } from "./auditFilename.js";
import { passRateOf, passRateLevel } from "./auditPassRate.js";

// Mirrors generateAuditPDF.js's content/layout (same header band, meta
// fields, checkpoint sections with photos, summary, signatures) but as one
// formatted .xlsx sheet via ExcelJS — SheetJS (`xlsx`) can't embed images,
// which is why the old export split everything across four bare sheets
// with no images and no styling.

const C = {
  primary:     "FF3F51B5",
  primaryDark: "FF283593",
  success:     "FF22C55E",
  warning:     "FFEAB308",
  danger:      "FFEF4444",
  info:        "FF3B82F6",
  gray:        "FF6B7280",
  lightGray:   "FFF3F4F6",
  headerBg:    "FFEDEFFD",
  tableHeadBg: "FFE8EAFC",
  altRow:      "FFF9FAFB",
  rejectBg:    "FFFEE2E2",
  white:       "FFFFFFFF",
  black:       "FF111827",
  border:      "FFD1D5DB",
};

const fmt = (d) => {
  if (!d) return "-";
  try {
    const dt = new Date(d);
    if (isNaN(dt)) return "-";
    return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear()}`;
  } catch { return "-"; }
};

const fmtTime = (d) => {
  if (!d) return "-";
  try {
    const dt = new Date(d);
    if (isNaN(dt)) return "-";
    return dt.toLocaleString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true } /* same as formatDateTimeForDisplay (screens) */);
  } catch { return "-"; }
};

const statusColor = (s) => {
  if (s === "approved")  return C.success;
  if (s === "rejected")  return C.danger;
  if (s === "rework")    return C.warning;
  if (s === "submitted") return C.info;
  return C.gray;
};

const cpStatusColor = (s) => {
  if (s === "pass")    return C.success;
  if (s === "fail")    return C.danger;
  if (s === "warning") return C.warning;
  if (s === "na")      return C.info;
  return C.gray;
};

// ExcelJS only accepts these image extensions — normalizeImageOrientation()
// always re-encodes to image/jpeg, but fall back safely if it ever returns
// something else untouched (e.g. a canvas failure).
const excelImageExtension = (dataUrl) => {
  const match = /^data:image\/(\w+);base64,/.exec(dataUrl || "");
  const ext = (match?.[1] || "").toLowerCase();
  if (ext === "jpeg" || ext === "jpg") return "jpeg";
  if (ext === "png") return "png";
  if (ext === "gif") return "gif";
  return null;
};

const thin = { style: "thin", color: { argb: C.border } };
const borderAll = { top: thin, left: thin, bottom: thin, right: thin };

export const generateAuditExcel = async (audit) => {
  const logoBase64 = await getWrlLogoBase64();
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Audit Report");

  // "section" is its own group-header band, not a table column — "stage"
  // stays, matching the on-screen AuditEntry table and the PDF export.
  const columns = (audit.columns || []).filter((c) => c.visible && c.id !== "section");
  const maxCols = Math.max(8, columns.length);

  columns.forEach((c, i) => {
    const width =
      c.type === "image" ? 14 :
      c.id === "checkPoint" ? 32 :
      ["specification", "observation", "remark", "method"].includes(c.id) ? 26 :
      c.type === "status" ? 12 : 16;
    sheet.getColumn(i + 1).width = width;
  });
  for (let i = columns.length + 1; i <= maxCols; i++) sheet.getColumn(i).width = 16;

  let row = 1;

  // ── 1. HEADER BAND — logo, title, status badge, audit code ───────────────
  if (logoBase64) {
    const imgId = workbook.addImage({ base64: logoBase64, extension: "png" });
    sheet.addImage(imgId, { tl: { col: 0, row: 0 }, ext: { width: 80, height: 80 / LOGO_ASPECT } });
    row = 4;
  }

  sheet.mergeCells(row, 1, row, maxCols);
  const titleCell = sheet.getCell(row, 1);
  titleCell.value = "QUALITY AUDIT REPORT";
  titleCell.font = { bold: true, size: 16, color: { argb: C.primaryDark } };
  titleCell.alignment = { horizontal: "center" };
  row++;

  sheet.mergeCells(row, 1, row, maxCols);
  const subCell = sheet.getCell(row, 1);
  subCell.value = "Western Refrigeration Ltd — Product Quality Report";
  subCell.font = { italic: true, size: 10, color: { argb: C.gray } };
  subCell.alignment = { horizontal: "center" };
  row++;

  const half = Math.ceil(maxCols / 2);
  sheet.mergeCells(row, 1, row, half);
  const codeCell = sheet.getCell(row, 1);
  codeCell.value = `Audit Code: ${audit.auditCode || "-"}`;
  codeCell.font = { bold: true, color: { argb: C.primaryDark } };
  codeCell.alignment = { horizontal: "center" };

  sheet.mergeCells(row, half + 1, row, maxCols);
  const statusCell = sheet.getCell(row, half + 1);
  statusCell.value = (audit.status || "unknown").toUpperCase();
  statusCell.font = { bold: true, color: { argb: C.white } };
  statusCell.alignment = { horizontal: "center" };
  statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: statusColor(audit.status) } };
  row += 2;

  // ── Helper: a bold section heading band ───────────────────────────────────
  const sectionHeading = (label, fill = C.headerBg, color = C.primaryDark) => {
    sheet.mergeCells(row, 1, row, maxCols);
    const cell = sheet.getCell(row, 1);
    cell.value = label.toUpperCase();
    cell.font = { bold: true, size: 11, color: { argb: color } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
    cell.alignment = { horizontal: "left", indent: 1 };
    row++;
  };

  // Helper: a bordered label:value row, value merged across the rest of the row
  const labelValueRow = (label, value) => {
    const labelCell = sheet.getCell(row, 1);
    labelCell.value = label;
    labelCell.font = { bold: true, color: { argb: C.gray }, size: 9 };
    labelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.lightGray } };
    labelCell.border = borderAll;
    sheet.mergeCells(row, 2, row, maxCols);
    const valueCell = sheet.getCell(row, 2);
    valueCell.value = value ?? "-";
    valueCell.font = { color: { argb: C.black } };
    valueCell.border = borderAll;
    row++;
  };

  // ── 2. AUDIT DETAILS ───────────────────────────────────────────────────────
  sectionHeading("Audit Details");
  labelValueRow("Report Name", audit.reportName || "-");
  labelValueRow("Template", audit.templateName || "-");
  labelValueRow("Format No", audit.formatNo || "-");
  labelValueRow("Rev. No", audit.revNo || "-");
  labelValueRow("Rev. Date", fmt(audit.revDate));
  labelValueRow("Audit Date", fmt(audit.createdAt));
  labelValueRow("Created By", audit.createdBy || "-");
  labelValueRow("Approved By", audit.approvedBy || "-");
  labelValueRow("Start Time", fmtTime(audit.startedAt));
  labelValueRow("Completed Time", fmtTime(audit.submittedAt));
  labelValueRow("Total Time", formatDuration(audit.startedAt, audit.submittedAt));
  row++;

  // ── 3. AUDIT INFORMATION (serialNo, modelName, shift, date, etc.) ─────────
  const infoData = audit.infoData || {};
  const infoFields = (audit.infoFields || []).filter((f) => f.visible);
  if (infoFields.length > 0) {
    sectionHeading("Audit Information");
    infoFields.forEach((f) => {
      const value = infoData[f.id] ?? infoData[f.name] ?? "-";
      // Same date format as the screens (stored as YYYY-MM-DD)
      labelValueRow(f.name, f.id === "date" ? formatDateForDisplay(value) : String(value));
    });
    row++;
  }

  // ── 4. CHECKPOINT SECTIONS (with embedded, EXIF-corrected photos) ─────────
  const sections = audit.sections || [];
  const imageColIds = new Set(columns.filter((c) => c.type === "image").map((c) => c.id));
  const imageCache = await resolveCheckpointImages(sections, imageColIds);
  const IMAGE_ROW_HEIGHT = 78; // points — tall enough to show an embedded photo
  const IMAGE_PX = 90;

  sections.forEach((section) => {
    if (!section) return;
    // Older audits keep checkpoints directly on the section (no stages).
    const stages = section.stages || (section.checkPoints ? [{ stageName: "", checkPoints: section.checkPoints }] : []);
    const allCPs = stages.flatMap((st) => (st.checkPoints || []).map((cp) => ({ ...cp, stageName: st.stageName })));
    if (allCPs.length === 0) return;

    sectionHeading(section.sectionName || "Section", C.headerBg, C.primaryDark);

    const headerRow = sheet.getRow(row);
    columns.forEach((col, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = col.name.toUpperCase();
      cell.font = { bold: true, size: 9, color: { argb: C.primaryDark } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.tableHeadBg } };
      cell.alignment = { horizontal: ["status", "image"].includes(col.type) ? "center" : "left", vertical: "middle" };
      cell.border = borderAll;
    });
    row++;

    let prevStage = null;
    allCPs.forEach((cp, idx) => {
      const dataRow = sheet.getRow(row);
      let hasImageInRow = false;

      columns.forEach((col, i) => {
        const cell = dataRow.getCell(i + 1);
        cell.border = borderAll;
        cell.alignment = { vertical: "middle", wrapText: true, horizontal: col.type === "status" ? "center" : "left" };
        if (idx % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.altRow } };

        if (col.id === "stage") {
          cell.value = cp.stageName !== prevStage ? cp.stageName || "-" : "";
          cell.font = { bold: true, color: { argb: C.gray } };
          return;
        }
        if (col.id === "status") {
          const s = cp.status || "pending";
          cell.value = s.toUpperCase();
          cell.font = { bold: true, color: { argb: cpStatusColor(cp.status) } };
          return;
        }
        if (col.type === "image") {
          const key = imageKey(cp[col.id]);
          const b64 = key ? imageCache.get(key) : null;
          const ext = excelImageExtension(b64);
          if (b64 && ext) {
            const imgId = workbook.addImage({ base64: b64, extension: ext });
            sheet.addImage(imgId, {
              tl: { col: i + 0.05, row: row - 1 + 0.05 },
              ext: { width: IMAGE_PX, height: IMAGE_PX },
            });
            hasImageInRow = true;
          } else {
            cell.value = key ? "Unavailable" : "-";
            cell.font = { italic: true, size: 8, color: { argb: C.gray } };
            cell.alignment = { ...cell.alignment, horizontal: "center" };
          }
          return;
        }
        const val = cp[col.id];
        cell.value = val === undefined || val === null || val === "" ? "-" : String(val);
      });

      if (hasImageInRow) dataRow.height = IMAGE_ROW_HEIGHT;
      prevStage = cp.stageName;
      row++;
    });
    row++;
  });

  // ── 5. AUDIT SUMMARY ────────────────────────────────────────────────────
  sectionHeading("Audit Summary");
  const sum = audit.summary || {};
  const total = sum.total || 0;
  const passRate = passRateOf(sum);

  const summaryItems = [
    { label: "Total Checkpoints", value: total,            color: C.black },
    { label: "Passed",            value: sum.pass || 0,    color: C.success },
    { label: "Failed",            value: sum.fail || 0,    color: C.danger },
    { label: "Warning",           value: sum.warning || 0, color: C.warning },
    { label: "N/A",               value: sum.na || 0,      color: C.info },
    { label: "Pending",           value: sum.pending || 0, color: C.gray },
    { label: "Pass Rate",         value: `${passRate}%`,   color: { good: C.success, fair: C.warning, poor: C.danger }[passRateLevel(passRate)] },
  ];
  const labelRow = sheet.getRow(row);
  const valueRow = sheet.getRow(row + 1);
  summaryItems.forEach((item, i) => {
    const lc = labelRow.getCell(i + 1);
    lc.value = item.label.toUpperCase();
    lc.font = { bold: true, size: 8, color: { argb: C.gray } };
    lc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.lightGray } };
    lc.alignment = { horizontal: "center" };
    lc.border = borderAll;

    const vc = valueRow.getCell(i + 1);
    vc.value = item.value;
    vc.font = { bold: true, size: 13, color: { argb: item.color } };
    vc.alignment = { horizontal: "center" };
    vc.border = borderAll;
  });
  row += 3;

  // ── 6. REJECTION / REWORK REMARKS (if any) ─────────────────────────────
  if (audit.approvalComments) {
    sectionHeading("Rejection / Rework Remarks", C.rejectBg, C.danger);
    sheet.mergeCells(row, 1, row, maxCols);
    const cell = sheet.getCell(row, 1);
    cell.value = audit.approvalComments;
    cell.font = { color: { argb: C.black } };
    cell.alignment = { wrapText: true, vertical: "top" };
    sheet.getRow(row).height = 40;
    row += 2;
  }

  // ── 7. SIGNATURES ────────────────────────────────────────────────────────
  sectionHeading("Signatures");
  const sigs = audit.signatures || {};
  [[sigs.auditor, "Auditor / Quality Operator", audit.createdBy, audit.createdAt],
   [sigs.approver, "Approved By / Line Quality Engineer", audit.approvedBy, audit.approvedAt]]
    .forEach(([sig, label, fallbackName, fallbackDate], i) => {
      const startCol = i === 0 ? 1 : half + 1;
      const endCol = i === 0 ? half : maxCols;

      sheet.mergeCells(row, startCol, row, endCol);
      const labelCell = sheet.getCell(row, startCol);
      labelCell.value = label;
      labelCell.font = { bold: true, size: 9, color: { argb: C.primary } };
      labelCell.alignment = { horizontal: "center" };
      labelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.lightGray } };
      labelCell.border = borderAll;

      sheet.mergeCells(row + 1, startCol, row + 1, endCol);
      const nameCell = sheet.getCell(row + 1, startCol);
      const name = sig?.name || fallbackName;
      nameCell.value = name || "Not yet signed";
      nameCell.font = name ? { bold: true, size: 11, color: { argb: C.black } } : { italic: true, color: { argb: C.gray } };
      nameCell.alignment = { horizontal: "center" };
      nameCell.border = borderAll;

      sheet.mergeCells(row + 2, startCol, row + 2, endCol);
      const dateCell = sheet.getCell(row + 2, startCol);
      dateCell.value = name ? `Date: ${fmt(sig?.date || fallbackDate)}` : "";
      dateCell.font = { size: 9, color: { argb: C.gray } };
      dateCell.alignment = { horizontal: "center" };
      dateCell.border = borderAll;
    });
  row += 4;

  // ── Footer ──────────────────────────────────────────────────────────────
  sheet.mergeCells(row, 1, row, maxCols);
  const footerCell = sheet.getCell(row, 1);
  footerCell.value = `Generated: ${new Date().toLocaleString("en-IN")}  |  Confidential – Internal Use Only`;
  footerCell.font = { size: 8, italic: true, color: { argb: C.gray } };
  footerCell.alignment = { horizontal: "center" };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = buildAuditFilename(audit, "xlsx");
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
