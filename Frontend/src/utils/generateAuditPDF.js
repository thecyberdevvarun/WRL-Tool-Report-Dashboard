import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getWrlLogoBase64, LOGO_ASPECT } from "./reportLogo.js";
import { imageKey, resolveCheckpointImages } from "./auditImageResolver.js";
import { formatDuration, formatDateForDisplay } from "./dateUtils.js";
import { buildAuditFilename } from "./auditFilename.js";
import { passRateOf, passRateLevel } from "./auditPassRate.js";

const imageFormat = (dataUrl) => {
  const match = /^data:image\/(\w+);base64,/.exec(dataUrl || "");
  const ext = (match?.[1] || "jpeg").toLowerCase();
  if (ext === "png") return "PNG";
  if (ext === "webp") return "WEBP";
  if (ext === "gif") return "GIF";
  return "JPEG";
};

// ── Colour palette (light theme) ──────────────────────────────────────────────
const C = {
  primary:     [63,  81,  181],   // indigo-600
  primaryDark: [40,  53,  147],   // indigo-800
  success:     [34,  197, 94],    // green-500
  warning:     [234, 179, 8],     // yellow-500
  danger:      [239, 68,  68],    // red-500
  info:        [59,  130, 246],   // blue-500
  gray:        [107, 114, 128],   // gray-500
  lightGray:   [243, 244, 246],   // gray-100
  headerBg:    [237, 239, 253],   // very light indigo tint
  white:       [255, 255, 255],
  black:       [17,  24,  39],    // gray-900
  border:      [209, 213, 219],   // gray-300
};

const fmt = (d) => {
  if (!d) return "—";
  try {
    const dt = new Date(d);
    if (isNaN(dt)) return "—";
    return `${String(dt.getDate()).padStart(2,"0")}/${String(dt.getMonth()+1).padStart(2,"0")}/${dt.getFullYear()}`;
  } catch { return "—"; }
};

const fmtTime = (d) => {
  if (!d) return "—";
  try {
    const dt = new Date(d);
    if (isNaN(dt)) return "—";
    return dt.toLocaleString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true } /* same as formatDateTimeForDisplay (screens) */);
  } catch { return "—"; }
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

// ── Main export ───────────────────────────────────────────────────────────────

export const generateAuditPDF = async (audit) => {
  // Load WRL logo
  const logoBase64 = await getWrlLogoBase64();
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();   // 297
  const H = doc.internal.pageSize.getHeight();  // 210
  const margin = 12;
  let y = margin;

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const addPage = () => {
    doc.addPage();
    y = margin;
    drawPageFooter();
  };

  const checkY = (needed = 10) => {
    if (y + needed > H - 20) addPage();
  };

  const setFont = (size, style = "normal", color = C.black) => {
    doc.setFontSize(size);
    doc.setFont("helvetica", style);
    doc.setTextColor(...color);
  };

  const fillRect = (x, ry, w, h, color) => {
    doc.setFillColor(...color);
    doc.rect(x, ry, w, h, "F");
  };

  const drawLine = (x1, y1, x2, y2, color = C.border, lw = 0.3) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(lw);
    doc.line(x1, y1, x2, y2);
  };

  const text = (str, x, ty, opts = {}) => {
    doc.text(String(str ?? ""), x, ty, opts);
  };

  // ── Page footer (runs on every page) ────────────────────────────────────────

  const drawPageFooter = () => {
    const pg    = doc.internal.getCurrentPageInfo().pageNumber;
    const total = doc.internal.getNumberOfPages();

    fillRect(0, H - 14, W, 14, C.lightGray);
    drawLine(0, H - 14, W, H - 14, C.border, 0.3);

    // Left column — report name + audit code
    setFont(7, "bold", C.primaryDark);
    text(audit.reportName || "Audit Report", margin, H - 9);
    setFont(6.5, "normal", C.gray);
    text(audit.auditCode || "", margin, H - 4);

    // Centre — Format No  |  Rev. No  |  Rev. Date
    const centre = W / 2;
    const revParts = [
      audit.formatNo ? `Format No: ${audit.formatNo}` : null,
      audit.revNo    ? `Rev. No: ${audit.revNo}`       : null,
      audit.revDate  ? `Rev. Date: ${fmt(audit.revDate)}` : null,
    ].filter(Boolean).join("   |   ");

    setFont(6.5, "bold", C.primaryDark);
    text(revParts, centre, H - 9, { align: "center" });
    setFont(6, "normal", C.gray);
    text("Western Refrigeration Ltd — Product Quality Report", centre, H - 4, { align: "center" });

    // Right — page number + generated timestamp
    setFont(6.5, "normal", C.primaryDark);
    text(`Page ${pg} / ${total}`, W - margin, H - 9, { align: "right" });
    setFont(6, "normal", C.gray);
    text(`Generated: ${new Date().toLocaleString("en-IN")}`, W - margin, H - 4, { align: "right" });
  };

  // ── 1. HEADER BAND ──────────────────────────────────────────────────────────

  fillRect(0, 0, W, 30, C.headerBg);
  drawLine(0, 30, W, 30, C.primary, 0.6);

  // Left: WRL logo (native 512x256 asset — keep true 2:1 aspect ratio) + title
  const logoW = 22;
  const logoH = logoW / LOGO_ASPECT;
  const logoY = (30 - logoH) / 2;
  if (logoBase64) {
    doc.addImage(logoBase64, "PNG", margin, logoY, logoW, logoH);
  }
  const titleX = logoBase64 ? margin + logoW + 4 : margin;
  setFont(15, "bold", C.primaryDark);
  text("QUALITY AUDIT REPORT", titleX, 13);
  setFont(8, "normal", C.gray);
  text("Western Refrigeration Ltd — Product Quality Report", titleX, 21);

  // Right: audit code + status badge
  const statusLabel = (audit.status || "unknown").toUpperCase();
  const sc = statusColor(audit.status);
  doc.setFillColor(...sc);
  doc.roundedRect(W - margin - 38, 4, 38, 10, 2, 2, "F");
  setFont(7, "bold", C.white);
  text(statusLabel, W - margin - 19, 10.5, { align: "center" });

  setFont(9, "bold", C.primaryDark);
  text(audit.auditCode || "", W - margin, 22, { align: "right" });

  y = 35;

  // ── 2. META INFO ROW ────────────────────────────────────────────────────────

  fillRect(0, y, W, 20, C.lightGray);
  drawLine(0, y, W, y, C.border);
  drawLine(0, y + 20, W, y + 20, C.border);

  const metaFields = [
    { label: "Report Name",   value: audit.reportName   || "—" },
    { label: "Template",      value: audit.templateName || "—" },
    { label: "Format No",     value: audit.formatNo     || "—" },
    { label: "Rev. No",       value: audit.revNo        || "—" },
    { label: "Rev. Date",     value: fmt(audit.revDate) },
    { label: "Audit Date",    value: fmt(audit.createdAt) },
    { label: "Created By",    value: audit.createdBy    || "—" },
    { label: "Approved By",   value: audit.approvedBy   || "—" },
  ];

  const colW = (W - margin * 2) / metaFields.length;
  metaFields.forEach((f, i) => {
    const mx = margin + i * colW;
    if (i > 0) drawLine(mx, y + 1, mx, y + 19, C.border, 0.2);
    setFont(6.5, "bold", C.gray);
    text(f.label.toUpperCase(), mx + 2, y + 6);
    setFont(7.5, "bold", C.black);
    // wrap long values
    const lines = doc.splitTextToSize(f.value, colW - 4);
    text(lines[0], mx + 2, y + 13);
  });

  y += 24;

  // ── 2b. TIME TRACKING ROW — start / completion / total test duration ──────

  fillRect(0, y, W, 14, C.headerBg);
  drawLine(0, y, W, y, C.border, 0.3);
  drawLine(0, y + 14, W, y + 14, C.border, 0.3);

  const timeFields = [
    { label: "Start Time",     value: fmtTime(audit.startedAt) },
    { label: "Completed Time", value: fmtTime(audit.submittedAt) },
    { label: "Total Time",     value: formatDuration(audit.startedAt, audit.submittedAt) },
  ];
  const timeColW = (W - margin * 2) / timeFields.length;
  timeFields.forEach((f, i) => {
    const mx = margin + i * timeColW;
    if (i > 0) drawLine(mx, y + 1, mx, y + 13, C.border, 0.2);
    setFont(6.5, "bold", C.primaryDark);
    text(f.label.toUpperCase(), mx + 2, y + 5.5);
    setFont(8.5, "bold", C.black);
    text(f.value, mx + 2, y + 11.5);
  });

  y += 18;

  // ── 3. INFO FIELDS TABLE (serialNo, modelName, shift, date, etc.) ──────────

  const infoData = audit.infoData || {};
  const infoFields = (audit.infoFields || []).filter((f) => f.visible);

  if (infoFields.length > 0) {
    checkY(20);
    setFont(8, "bold", C.primaryDark);
    text("AUDIT INFORMATION", margin, y);
    drawLine(margin, y + 1.5, margin + 60, y + 1.5, C.primary, 0.6);
    y += 6;

    const infoRows = infoFields.map((f) => {
      const value = infoData[f.id] ?? infoData[f.name] ?? "—";
      // Same date format as the screens (stored as YYYY-MM-DD)
      return [f.name, f.id === "date" ? formatDateForDisplay(value) : String(value)];
    });

    // Arrange in 2 columns side by side
    const half = Math.ceil(infoRows.length / 2);
    const leftRows  = infoRows.slice(0, half);
    const rightRows = infoRows.slice(half);
    const halfW = (W - margin * 2 - 8) / 2;

    const drawInfoTable = (rows, startX) => {
      autoTable(doc, {
        startY: y,
        startX,
        tableWidth: halfW,
        head: [],
        body: rows,
        styles: { fontSize: 7.5, cellPadding: 2.5 },
        columnStyles: {
          0: { fontStyle: "bold", textColor: C.gray,  cellWidth: halfW * 0.38, fillColor: C.lightGray },
          1: { fontStyle: "bold", textColor: C.black, cellWidth: halfW * 0.62 },
        },
        theme: "plain",
        tableLineColor: C.border,
        tableLineWidth: 0.2,
        margin: { left: startX },
      });
    };

    drawInfoTable(leftRows,  margin);
    drawInfoTable(rightRows, margin + halfW + 8);
    y = (doc.lastAutoTable?.finalY || y) + 8;
  }

  // ── 4. CHECKPOINT SECTIONS ──────────────────────────────────────────────────

  const sections = audit.sections || [];
  // "section" is shown as its own group-header band below, not a table
  // column — but "stage" stays (see the col.id === "stage" merge logic
  // further down), matching the on-screen AuditEntry table.
  const columns  = (audit.columns || []).filter(
    (c) => c.visible && c.id !== "section",
  );

  const colHeaders = columns.map((c) => ({
    content: c.name.toUpperCase(),
    styles: {
      halign: ["status", "image"].includes(c.type) ? "center" : "left",
      cellWidth: c.type === "status" ? 18 : c.type === "image" ? 22 : c.id === "checkPoint" ? 38 : "auto",
    },
  }));

  // Pre-resolve every checkpoint image (filename → EXIF-corrected base64) so
  // it can be drawn synchronously inside autoTable's didDrawCell hook below.
  const imageColIds = new Set(columns.filter((c) => c.type === "image").map((c) => c.id));
  const imageCache = await resolveCheckpointImages(sections, imageColIds);

  sections.forEach((section) => {
    if (!section) return;
    // Older audits keep checkpoints directly on the section (no stages).
    const stages = section.stages || (section.checkPoints ? [{ stageName: "", checkPoints: section.checkPoints }] : []);
    const allCPs = stages.flatMap((st) => (st.checkPoints || []).map((cp) => ({ ...cp, stageName: st.stageName })));
    if (allCPs.length === 0) return;

    checkY(18);

    // Section header
    fillRect(margin, y, W - margin * 2, 7, C.headerBg);
    fillRect(margin, y, 2, 7, C.primary);
    setFont(8.5, "bold", C.primaryDark);
    text((section.sectionName || "Section").toUpperCase(), margin + 5, y + 5);
    y += 9;

    // Build rows for this section
    const bodyRows = [];
    let prevStage = null;

    allCPs.forEach((cp) => {
      const row = columns.map((col) => {
        if (col.id === "stage") return cp.stageName !== prevStage ? cp.stageName : "";
        const val = cp[col.id] ?? "—";
        if (col.id === "status") return { content: (String(val)).toUpperCase(), styles: { halign: "center", textColor: cpStatusColor(cp.status), fontStyle: "bold" } };
        if (col.type === "image") {
          const key = imageKey(cp[col.id]);
          const hasImage = key && imageCache.get(key);
          return { content: hasImage ? "" : key ? "Unavailable" : "—", styles: { halign: "center", fontSize: 6, textColor: C.gray } };
        }
        return String(val === undefined || val === null || val === "" ? "—" : val);
      });
      prevStage = cp.stageName;
      bodyRows.push(row);
    });

    checkY(12);

    autoTable(doc, {
      startY: y,
      head: [colHeaders],
      body: bodyRows,
      styles: {
        fontSize: 7,
        fontStyle: "bold",
        cellPadding: { top: 2.5, right: 3, bottom: 2.5, left: 3 },
        overflow: "linebreak",
        lineColor: C.border,
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [232, 234, 252],
        textColor: C.black,
        fontStyle: "bold",
        fontSize: 6.5,
        lineWidth: 0.2,
        lineColor: C.border,
      },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: columns.reduce((acc, col, idx) => {
        if (idx === 0 && col.id === "stage") acc[0] = { cellWidth: 22, fontStyle: "bold", textColor: C.black };
        if (col.type === "image") acc[idx] = { ...(acc[idx] || {}), cellWidth: 22, minCellHeight: 20 };
        return acc;
      }, {}),
      tableLineColor: C.border,
      tableLineWidth: 0.2,
      margin: { left: margin, right: margin },
      didParseCell: (data) => {
        if (data.section === "body") {
          const colDef = columns[data.column.index];
          if (colDef?.id === "status") {
            const status = allCPs[data.row.index]?.status;
            data.cell.styles.textColor = cpStatusColor(status);
            data.cell.styles.fontStyle = "bold";
          }
        }
      },
      didDrawCell: (data) => {
        if (data.section !== "body") return;
        const colDef = columns[data.column.index];
        if (colDef?.type !== "image") return;
        const key = imageKey(allCPs[data.row.index]?.[colDef.id]);
        const b64 = key ? imageCache.get(key) : null;
        if (!b64) return;
        const pad = 1.5;
        const size = Math.min(data.cell.width - pad * 2, data.cell.height - pad * 2);
        const ix = data.cell.x + (data.cell.width - size) / 2;
        const iy = data.cell.y + (data.cell.height - size) / 2;
        try {
          doc.addImage(b64, imageFormat(b64), ix, iy, size, size);
        } catch {
          // malformed image data — leave cell blank
        }
      },
    });

    y = (doc.lastAutoTable?.finalY || y) + 6;
  });

  // ── 5. SUMMARY ──────────────────────────────────────────────────────────────

  checkY(32);

  const sum = audit.summary || {};
  const total = sum.total || 0;
  const passRate = passRateOf(sum);

  fillRect(margin, y, W - margin * 2, 6, C.headerBg);
  fillRect(margin, y, 2, 6, C.primary);
  setFont(8, "bold", C.primaryDark);
  text("AUDIT SUMMARY", margin + 5, y + 4.5);
  y += 8;

  const summaryItems = [
    { label: "Total Checkpoints", value: total,           color: C.black   },
    { label: "Passed",            value: sum.pass || 0,   color: C.success },
    { label: "Failed",            value: sum.fail || 0,   color: C.danger  },
    { label: "Warning",           value: sum.warning || 0,color: C.warning },
    { label: "N/A",               value: sum.na || 0,     color: C.info    },
    { label: "Pending",           value: sum.pending || 0,color: C.gray    },
    { label: "Pass Rate",         value: `${passRate}%`,  color: { good: C.success, fair: C.warning, poor: C.danger }[passRateLevel(passRate)] },
  ];

  const boxW = (W - margin * 2) / summaryItems.length;

  summaryItems.forEach((item, i) => {
    const bx = margin + i * boxW;
    fillRect(bx, y, boxW, 18, i % 2 === 0 ? C.white : C.lightGray);
    drawLine(bx, y, bx, y + 18, C.border, 0.2);

    setFont(6.5, "bold", C.gray);
    text(item.label.toUpperCase(), bx + boxW / 2, y + 6, { align: "center" });
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...item.color);
    text(String(item.value), bx + boxW / 2, y + 15, { align: "center" });
  });
  drawLine(margin, y + 18, W - margin, y + 18, C.border);
  y += 22;

  // ── Stacked pass rate bar ─────────────────────────────────────────────────
  if (total > 0) {
    checkY(10);
    const barW = W - margin * 2;
    const barH = 5;
    const segments = [
      { val: sum.pass,    color: C.success },
      { val: sum.warning, color: C.warning },
      { val: sum.fail,    color: C.danger  },
      { val: sum.na,      color: C.info    },
    ];
    let bx = margin;
    fillRect(margin, y, barW, barH, C.lightGray);
    segments.forEach(({ val, color }) => {
      if (!val) return;
      const segW = (val / total) * barW;
      fillRect(bx, y, segW, barH, color);
      bx += segW;
    });
    drawLine(margin, y, W - margin, y, C.border, 0.2);
    drawLine(margin, y + barH, W - margin, y + barH, C.border, 0.2);
    y += barH + 6;
  }

  // ── 6. REJECTION REMARKS (if any) ─────────────────────────────────────────

  if (audit.approvalComments) {
    checkY(16);
    fillRect(margin, y, W - margin * 2, 6, [254, 226, 226]);
    setFont(8, "bold", C.danger);
    text("REJECTION REMARKS", margin + 3, y + 4.5);
    y += 8;
    setFont(7.5, "bold", C.black);
    const lines = doc.splitTextToSize(audit.approvalComments, W - margin * 2 - 6);
    lines.forEach((line) => {
      checkY(6);
      text(line, margin + 3, y);
      y += 5;
    });
    y += 4;
  }

  // ── 7. SIGNATURES ────────────────────────────────────────────────────────────

  checkY(28);

  const sigs = audit.signatures || {};
  const halfS = (W - margin * 2 - 8) / 2;

  [[sigs.auditor, "AUDITOR / QUALITY OPERATOR"], [sigs.approver, "APPROVED BY / LINE QUALITY ENGINEER"]].forEach(([sig, label], i) => {
    const sx = margin + i * (halfS + 8);
    fillRect(sx, y, halfS, 22, C.lightGray);
    drawLine(sx, y, sx + halfS, y, C.border, 0.3);
    drawLine(sx, y + 22, sx + halfS, y + 22, C.border, 0.3);
    drawLine(sx, y, sx, y + 22, C.border, 0.3);
    drawLine(sx + halfS, y, sx + halfS, y + 22, C.border, 0.3);

    setFont(6.5, "bold", C.primary);
    text(label, sx + halfS / 2, y + 5, { align: "center" });

    if (sig?.name) {
      setFont(9, "bold", C.black);
      text(sig.name, sx + halfS / 2, y + 14, { align: "center" });
      setFont(7, "normal", C.gray);
      text(fmt(sig.date), sx + halfS / 2, y + 20, { align: "center" });
    } else {
      setFont(7.5, "normal", [180, 180, 180]);
      text("Not yet signed", sx + halfS / 2, y + 14, { align: "center" });
    }
  });

  y += 26;

  // ── Add footer to all pages ─────────────────────────────────────────────────

  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawPageFooter();
  }

  // ── Save ────────────────────────────────────────────────────────────────────

  doc.save(buildAuditFilename(audit, "pdf"));
};
