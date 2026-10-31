import ExcelJS from "exceljs";
import sql from "mssql";
import { dbConfig1 } from "../../config/db.config.js";
import { tryCatch } from "../../utils/try-catch.js";
import { AppError } from "../../utils/app-error.js";
import { convertToIST } from "../../utils/convert-to-ist.js";

// ═════════════════════════════════════════════════════════════════════════════
//  DB POOL  (one shared pool for the whole process instead of one per request)
// ═════════════════════════════════════════════════════════════════════════════
let poolPromise = null;

const getPool = () => {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(dbConfig1)
      .connect()
      .then((pool) => {
        pool.on("error", (err) => {
          console.error("[mssql pool error]", err);
          poolPromise = null; // next request builds a fresh pool
        });
        return pool;
      })
      .catch((err) => {
        poolPromise = null;
        throw err;
      });
  }
  return poolPromise;
};

const withPool = async (callback) => callback(await getPool());

// ═════════════════════════════════════════════════════════════════════════════
//  SMALL HELPERS
// ═════════════════════════════════════════════════════════════════════════════
const safeInt = (val, fallback = null) => {
  if (val === undefined || val === null || val === "") return fallback;
  const n = Number(val);
  return Number.isFinite(n) ? Math.round(n) : fallback;
};

const safeBool = (val, fallback = true) => {
  if (val === undefined || val === null || val === "") return fallback;
  if (typeof val === "boolean") return val;
  return !["FALSE", "0"].includes(String(val).trim().toUpperCase());
};

const toKey = (col) => col.charAt(0).toLowerCase() + col.slice(1); // DashboardName -> dashboardName

const ok = (res, data, extra = {}, status = 200) =>
  res.status(status).json({ success: true, ...extra, data });

// ═════════════════════════════════════════════════════════════════════════════
//  CONFIG COLUMN METADATA  (single source of truth for CRUD, import and the Excel template)
// ═════════════════════════════════════════════════════════════════════════════

const GROUPS = [
  {
    label: "General",
    hex: "4F46E5",
    fields: ["DashboardName", "LineName", "LineCode", "WorkingTimeMin"],
  },
  {
    label: "Display 1",
    hex: "0284C7",
    fields: [
      "StationCode1",
      "StationName1",
      "LineTaktTime1",
      "LineMonthlyProduction1",
      "LineTarget1",
      "DailyProductionTarget1",
    ],
  },
  {
    label: "Display 2",
    hex: "D97706",
    fields: [
      "StationCode2",
      "StationName2",
      "LineTaktTime2",
      "LineMonthlyProduction2",
      "DailyProductionTarget2",
    ],
  },
  {
    label: "Quality",
    hex: "7C3AED",
    fields: ["QualityProcessCode", "QualityLineName"],
  },
  { label: "Loss", hex: "DC2626", fields: ["SectionName"] },
  {
    label: "Visibility",
    hex: "059669",
    fields: [
      "ShowDisplay1",
      "ShowDisplay2",
      "ShowHourly",
      "ShowQuality",
      "ShowLoss",
    ],
  },
];

const BOOL_FIELDS = new Set([
  "ShowDisplay1",
  "ShowDisplay2",
  "ShowHourly",
  "ShowQuality",
  "ShowLoss",
]);

const NUM_FIELDS = new Set([
  "WorkingTimeMin",
  "LineTaktTime1",
  "LineMonthlyProduction1",
  "LineTarget1",
  "DailyProductionTarget1",
  "LineTaktTime2",
  "LineMonthlyProduction2",
  "DailyProductionTarget2",
]);

// Numeric fields that fall back to a default when blank (the rest become NULL)
const NUM_DEFAULTS = {
  WorkingTimeMin: 720,
  LineTaktTime1: 40,
  LineMonthlyProduction1: 0,
  LineTarget1: 0,
  DailyProductionTarget1: 0,
  DailyProductionTarget2: 0,
};

// Text fields stored as NULL (instead of "") when blank
const NULLABLE_STR = new Set([
  "StationCode2",
  "StationName2",
  "QualityProcessCode",
  "QualityLineName",
  "SectionName",
]);

const STR_LENGTHS = {
  DashboardName: 120,
  LineName: 100,
  LineCode: 50,
  StationCode1: 50,
  StationName1: 100,
  StationCode2: 50,
  StationName2: 100,
  QualityProcessCode: 500,
  QualityLineName: 100,
  SectionName: 200,
};

const FIELD_COLS = GROUPS.flatMap((g) => g.fields); // every editable column
const ALL_COLS = ["Id", ...FIELD_COLS];

// Header text in the Excel file. Import matches on these OR on the raw column name.
const COL_LABELS = {
  Id: "ID",
  DashboardName: "Dashboard Name",
  LineName: "Line Name",
  LineCode: "Line Code",
  WorkingTimeMin: "Working Time (min)",
  StationCode1: "Station Code 1",
  StationName1: "Station Name 1",
  LineTaktTime1: "Cycle Time 1 (s)",
  LineMonthlyProduction1: "Monthly Prod 1",
  LineTarget1: "Target UPH",
  DailyProductionTarget1: "Daily Production Target 1",
  StationCode2: "Station Code 2",
  StationName2: "Station Name 2",
  LineTaktTime2: "Cycle Time 2 (s)",
  LineMonthlyProduction2: "Monthly Prod 2",
  DailyProductionTarget2: "Daily Production Target 2",
  QualityProcessCode: "Quality Process Code",
  QualityLineName: "Quality Line Name",
  SectionName: "Section Name",
  ShowDisplay1: "Show Display 1",
  ShowDisplay2: "Show Display 2",
  ShowHourly: "Show Hourly",
  ShowQuality: "Show Quality",
  ShowLoss: "Show Loss",
};

// ═════════════════════════════════════════════════════════════════════════════
//  EXCEL TEMPLATE  (workbook design used by Export; Import reads the same layout)
// ═════════════════════════════════════════════════════════════════════════════

// ═════════════════════════════════════════════════════════════════════════════
//  LAYOUT  (import finds the header row by itself, so this can change safely)
//
//    Row 1  title banner
//    Row 2  subtitle / quick hint
//    Row 3  group headers (merged)
//    Row 4  column headers          <- filter row, data starts right below
//    Row 5+ data rows, then blank rows ready for new configs
// ═════════════════════════════════════════════════════════════════════════════
const GROUP_ROW = 3;
const HEADER_ROW = 4;
const FIRST_DATA_ROW = 5;
const SPARE_ROWS = 25; // pre-formatted blank rows for adding new configs

// ── palette ──────────────────────────────────────────────────────────────────
const FONT = "Arial";
const NAVY = "0F172A";
const SLATE = "334155";
const MUTED = "64748B";
const INK = "1F2937";
const GRID = "E2E8F0";
const KEY_FILL = "F1F5F9";
const BAND = "F4F6FA";

const REQUIRED = new Set(["DashboardName", "StationCode1"]);

// ── content shown in the Instructions sheet / input prompts ─────────────────
const DOCS = {
  Id: "System key. Leave blank to create a new configuration. Keep the value to update an existing one — never type a new number.",
  DashboardName: "Unique name of the dashboard. Also becomes the page URL.",
  LineName: "Production line name, e.g. FREEZER.",
  LineCode:
    "Line code used to filter ProcessActivity.Remark. Comma-separated for several lines.",
  WorkingTimeMin: "Shift working time in minutes (720 = 12 h shift).",
  StationCode1: "Station code for Production Display 1 (FG Packing).",
  StationName1: "Friendly name shown on Display 1.",
  LineTaktTime1: "Cycle time in seconds for Station 1.",
  LineMonthlyProduction1: "Monthly production plan quantity.",
  LineTarget1: "Target units per hour (UPH).",
  DailyProductionTarget1: "Daily production target for Display 1.",
  StationCode2: "Station code for Production Display 2 (FG Loading). Optional.",
  StationName2: "Friendly name shown on Display 2.",
  LineTaktTime2: "Cycle time in seconds for Station 2.",
  LineMonthlyProduction2: "Monthly production plan for Station 2.",
  DailyProductionTarget2: "Daily production target for Display 2.",
  QualityProcessCode:
    "Quality inspection process codes. Comma-separated, e.g. 12210,12206.",
  QualityLineName: "Line name used by the Quality page.",
  SectionName: "EMGMaster.Location value used by the Loss Analysis page.",
  ShowDisplay1: "TRUE = show the Production Display 1 page.",
  ShowDisplay2: "TRUE = show the Production Display 2 page.",
  ShowHourly: "TRUE = show the Hourly Production page.",
  ShowQuality: "TRUE = show the Quality page.",
  ShowLoss: "TRUE = show the Loss Analysis page.",
};

const EXAMPLES = {
  Id: "12",
  DashboardName: "FREEZER FG PACKING",
  LineName: "FREEZER",
  LineCode: "12501",
  WorkingTimeMin: "720",
  StationCode1: "1220010",
  StationName1: "FG PACKING",
  LineTaktTime1: "40",
  LineMonthlyProduction1: "27000",
  LineTarget1: "85",
  DailyProductionTarget1: "800",
  StationCode2: "1220005",
  StationName2: "FG LOADING",
  LineTaktTime2: "40",
  LineMonthlyProduction2: "27000",
  DailyProductionTarget2: "800",
  QualityProcessCode: "12210,12206",
  QualityLineName: "Freezer",
  SectionName: "FINAL ASSEMBLY",
  ShowDisplay1: "TRUE",
  ShowDisplay2: "TRUE",
  ShowHourly: "TRUE",
  ShowQuality: "TRUE",
  ShowLoss: "FALSE",
};

const COL_WIDTHS = {
  Id: 8,
  DashboardName: 32,
  LineName: 18,
  LineCode: 14,
  WorkingTimeMin: 15,
  StationCode1: 15,
  StationName1: 20,
  LineTaktTime1: 13,
  LineMonthlyProduction1: 15,
  LineTarget1: 12,
  DailyProductionTarget1: 17,
  StationCode2: 15,
  StationName2: 20,
  LineTaktTime2: 13,
  LineMonthlyProduction2: 15,
  DailyProductionTarget2: 17,
  QualityProcessCode: 26,
  QualityLineName: 20,
  SectionName: 28,
  ShowDisplay1: 13,
  ShowDisplay2: 13,
  ShowHourly: 13,
  ShowQuality: 13,
  ShowLoss: 13,
};

// ── column model ─────────────────────────────────────────────────────────────
const GROUP_OF = {};
for (const g of GROUPS) for (const f of g.fields) GROUP_OF[f] = g;

const COLS = ALL_COLS.map((key, i) => {
  const group = GROUP_OF[key];
  return {
    key,
    n: i + 1,
    hex: group ? group.hex : SLATE,
    groupStart: !group || group.fields[0] === key,
  };
});

const typeOf = (key) =>
  BOOL_FIELDS.has(key)
    ? "TRUE / FALSE"
    : NUM_FIELDS.has(key) || key === "Id"
      ? "Number"
      : "Text";

const defaultOf = (key) =>
  BOOL_FIELDS.has(key)
    ? "TRUE"
    : NUM_DEFAULTS[key] !== undefined
      ? String(NUM_DEFAULTS[key])
      : "Empty";

// ── style helpers ────────────────────────────────────────────────────────────
const argb = (hex) => `FF${hex}`;
const solid = (hex) => ({
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: argb(hex) },
});
const side = (style, hex) => ({ style, color: { argb: argb(hex) } });
const font = ({ hex = INK, ...rest } = {}) => ({
  name: FONT,
  size: 10,
  color: { argb: argb(hex) },
  ...rest,
});

const mix = (hex, target, ratio) =>
  [0, 2, 4]
    .map((i) =>
      Math.round(
        parseInt(hex.slice(i, i + 2), 16) * (1 - ratio) + target * ratio,
      )
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")
    .toUpperCase();
const tint = (hex, ratio) => mix(hex, 255, ratio); // towards white
const shade = (hex, ratio) => mix(hex, 0, ratio); // towards black

const dxfFill = (hex) => ({
  type: "pattern",
  pattern: "solid",
  bgColor: { argb: argb(hex) },
});

// ═════════════════════════════════════════════════════════════════════════════
//  SHEET 1 — DashboardConfigs
// ═════════════════════════════════════════════════════════════════════════════
const validationFor = (key) => {
  const label = COL_LABELS[key];
  const base = {
    allowBlank: true,
    showInputMessage: true,
    showErrorMessage: true,
    errorStyle: "stop",
    promptTitle: label.slice(0, 32),
    prompt: `${REQUIRED.has(key) ? "Required. " : ""}${DOCS[key]}`.slice(
      0,
      255,
    ),
  };

  if (key === "Id")
    return {
      ...base,
      type: "whole",
      operator: "greaterThanOrEqual",
      formulae: [1],
      errorTitle: "Invalid ID",
      error:
        "ID must be a whole number. Leave it blank to create a new configuration.",
    };
  if (BOOL_FIELDS.has(key))
    return {
      ...base,
      type: "list",
      formulae: ['"TRUE,FALSE"'],
      errorTitle: "TRUE or FALSE",
      error: "Please choose TRUE or FALSE from the list.",
    };
  if (key === "WorkingTimeMin")
    return {
      ...base,
      type: "whole",
      operator: "between",
      formulae: [1, 1440],
      errorTitle: "Invalid number",
      error: "Enter whole minutes between 1 and 1440.",
    };
  if (NUM_FIELDS.has(key))
    return {
      ...base,
      type: "whole",
      operator: "greaterThanOrEqual",
      formulae: [0],
      errorTitle: "Invalid number",
      error: "Enter a whole number (0 or more) — no units or text.",
    };
  return {
    ...base,
    type: "textLength",
    operator: "lessThanOrEqual",
    formulae: [STR_LENGTHS[key]],
    errorTitle: "Text too long",
    error: `Maximum ${STR_LENGTHS[key]} characters.`,
  };
};

const styleDataCell = (cell, col) => {
  const isId = col.key === "Id";
  const isBool = BOOL_FIELDS.has(col.key);
  const isNum = NUM_FIELDS.has(col.key);

  cell.font = isId ? font({ hex: MUTED, bold: true }) : font({ bold: isBool });
  cell.alignment = {
    vertical: "middle",
    horizontal: isId || isBool ? "center" : isNum ? "right" : "left",
    indent: isId || isBool ? 0 : 1, // also pads right-aligned numbers
  };
  cell.border = {
    top: side("thin", GRID),
    bottom: side("thin", GRID),
    right: side("thin", GRID),
    left:
      col.groupStart && !isId
        ? side("medium", tint(col.hex, 0.45))
        : side("thin", GRID),
  };
  if (isId) cell.fill = solid(KEY_FILL);
  if (isNum) cell.numFmt = "#,##0";
  if (isId) cell.numFmt = "0";
};

const buildConfigSheet = (wb, rows, exportedAt) => {
  const N = COLS.length;
  const lastDataRow = FIRST_DATA_ROW + rows.length - 1;
  const lastRow = FIRST_DATA_ROW + rows.length + SPARE_ROWS - 1;

  const ws = wb.addWorksheet("DashboardConfigs", {
    properties: { tabColor: { argb: argb(NAVY) } },
    views: [
      { state: "frozen", xSplit: 2, ySplit: HEADER_ROW, showGridLines: false },
    ],
  });
  const L = (n) => ws.getColumn(n).letter;

  COLS.forEach(
    (col) => (ws.getColumn(col.n).width = COL_WIDTHS[col.key] ?? 14),
  );

  // Row 1 — title banner
  ws.getRow(1).height = 38;
  for (let n = 1; n <= N; n++) ws.getCell(1, n).fill = solid(NAVY);
  const title = ws.getCell(1, 1);
  title.value = "DASHBOARD CONFIGURATION";
  title.font = font({ hex: "FFFFFF", bold: true, size: 15 });
  title.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

  // Row 2 — subtitle
  ws.getRow(2).height = 22;
  for (let n = 1; n <= N; n++) {
    const c = ws.getCell(2, n);
    c.fill = solid(KEY_FILL);
    c.border = { bottom: side("thin", "CBD5E1") };
  }
  const subtitle = ws.getCell(2, 1);
  const dateText = exportedAt.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  subtitle.value =
    `Exported ${dateText}  ·  ${rows.length} active configuration${rows.length === 1 ? "" : "s"}` +
    `  ·  Keep the ID to update a row, leave it blank to add a new one  ·  * = required  ·  See the "Instructions" sheet`;
  subtitle.font = font({ hex: MUTED, size: 9 });
  subtitle.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

  // Row 3 — group headers
  ws.getRow(GROUP_ROW).height = 24;
  const idGroup = ws.getCell(GROUP_ROW, 1);
  idGroup.fill = solid(SLATE);
  idGroup.border = { right: side("thin", "FFFFFF") };
  for (const g of GROUPS) {
    const from = COLS.find((c) => c.key === g.fields[0]).n;
    const to = from + g.fields.length - 1;
    if (to > from) ws.mergeCells(GROUP_ROW, from, GROUP_ROW, to);
    for (let n = from; n <= to; n++) {
      const c = ws.getCell(GROUP_ROW, n);
      c.fill = solid(g.hex);
      c.border = {
        left: side("thin", "FFFFFF"),
        right: side("thin", "FFFFFF"),
      };
    }
    const cell = ws.getCell(GROUP_ROW, from);
    cell.value = g.label.toUpperCase();
    cell.font = font({ hex: "FFFFFF", bold: true, size: 10 });
    cell.alignment = { horizontal: "center", vertical: "middle" };
  }

  // Row 4 — column headers
  ws.getRow(HEADER_ROW).height = 36;
  COLS.forEach((col) => {
    const c = ws.getCell(HEADER_ROW, col.n);
    c.value = COL_LABELS[col.key] + (REQUIRED.has(col.key) ? " *" : "");
    c.font = font({ hex: shade(col.hex, 0.35), bold: true, size: 9 });
    c.fill = solid(tint(col.hex, 0.88));
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border = {
      top: side("thin", tint(col.hex, 0.6)),
      bottom: side("medium", col.hex),
      left: col.groupStart
        ? side("medium", tint(col.hex, 0.45))
        : side("thin", tint(col.hex, 0.6)),
      right: side("thin", tint(col.hex, 0.6)),
    };
  });

  // Data rows + blank rows for new configs
  for (let r = FIRST_DATA_ROW; r <= lastRow; r++) {
    ws.getRow(r).height = 20;
    const row = rows[r - FIRST_DATA_ROW];
    for (const col of COLS) {
      const cell = ws.getCell(r, col.n);
      if (row) {
        cell.value = BOOL_FIELDS.has(col.key)
          ? row[col.key]
            ? "TRUE"
            : "FALSE"
          : (row[col.key] ?? null);
      } else if (BOOL_FIELDS.has(col.key)) {
        cell.value = "TRUE"; // blank rows start with every page shown (import ignores rows without a name + station)
      }
      styleDataCell(cell, col);
      cell.dataValidation = validationFor(col.key);
    }
  }

  // Conditional formatting: TRUE/FALSE pills + zebra stripes (keeps working on rows the user adds)
  const bools = COLS.filter((c) => BOOL_FIELDS.has(c.key));
  const bFirst = bools[0].n;
  const bTopLeft = `${L(bFirst)}${FIRST_DATA_ROW}`;
  ws.addConditionalFormatting({
    ref: `${bTopLeft}:${L(bools[bools.length - 1].n)}${lastRow}`,
    rules: [
      {
        type: "expression",
        priority: 1,
        formulae: [`OR(${bTopLeft}=TRUE,${bTopLeft}="TRUE")`], // text from the dropdown or a real boolean
        style: {
          font: { bold: true, color: { argb: argb("047857") } },
          fill: dxfFill("D1FAE5"),
        },
      },
      {
        type: "expression",
        priority: 2,
        formulae: [
          `AND(NOT(ISBLANK(${bTopLeft})),OR(${bTopLeft}=FALSE,${bTopLeft}="FALSE"))`,
        ],
        style: {
          font: { bold: true, color: { argb: argb("64748B") } },
          fill: dxfFill("E2E8F0"),
        },
      },
    ],
  });
  ws.addConditionalFormatting({
    ref: `B${FIRST_DATA_ROW}:${L(N)}${lastRow}`,
    rules: [
      {
        type: "expression",
        priority: 3,
        formulae: ["MOD(ROW(),2)=0"],
        style: { fill: dxfFill(BAND) },
      },
    ],
  });

  ws.autoFilter = `A${HEADER_ROW}:${L(N)}${lastRow}`;

  // Print setup
  ws.pageSetup = {
    paperSize: 8, // A3
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
    printTitlesRow: `${GROUP_ROW}:${HEADER_ROW}`,
    printArea: `A1:${L(N)}${Math.max(lastDataRow, HEADER_ROW + 1)}`,
    margins: {
      left: 0.4,
      right: 0.4,
      top: 0.6,
      bottom: 0.6,
      header: 0.3,
      footer: 0.3,
    },
  };
  ws.headerFooter.oddFooter =
    "&L&8Dashboard Configuration&C&8Page &P of &N&R&8&D";

  return ws;
};

// ═════════════════════════════════════════════════════════════════════════════
//  SHEET 2 — Instructions
// ═════════════════════════════════════════════════════════════════════════════
const buildInstructionsSheet = (wb) => {
  const ins = wb.addWorksheet("Instructions", {
    properties: { tabColor: { argb: argb(GROUPS[0].hex) } },
    views: [{ showGridLines: false }],
  });
  [2, 18, 30, 11, 14, 11, 24, 74].forEach(
    (w, i) => (ins.getColumn(i + 1).width = w),
  );
  const FIRST = 2; // column B
  const LAST = 8; // column H

  const paint = (r, from, to, fill, border) => {
    for (let n = from; n <= to; n++) {
      const c = ins.getCell(r, n);
      if (fill) c.fill = solid(fill);
      c.border = border ?? { bottom: side("thin", GRID) };
    }
  };

  let r = 1;
  ins.getRow(r++).height = 10;

  // Title
  ins.getRow(r).height = 36;
  ins.mergeCells(r, FIRST, r, LAST);
  paint(r, FIRST, LAST, NAVY, {});
  let c = ins.getCell(r, FIRST);
  c.value = "DASHBOARD CONFIGURATION — IMPORT TEMPLATE";
  c.font = font({ hex: "FFFFFF", bold: true, size: 15 });
  c.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  r++;

  ins.getRow(r).height = 24;
  ins.mergeCells(r, FIRST, r, LAST);
  paint(r, FIRST, LAST, KEY_FILL, {});
  c = ins.getCell(r, FIRST);
  c.value =
    "Edit the DashboardConfigs sheet, save it as .xlsx and upload it from Display Manager → Upload Excel.";
  c.font = font({ hex: MUTED, size: 10 });
  c.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  r++;
  ins.getRow(r++).height = 10;

  const section = (text, hex = SLATE) => {
    ins.getRow(r).height = 24;
    ins.mergeCells(r, FIRST, r, LAST);
    paint(r, FIRST, LAST, hex, {});
    const cell = ins.getCell(r, FIRST);
    cell.value = text;
    cell.font = font({ hex: "FFFFFF", bold: true, size: 11 });
    cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    r++;
  };

  // badge row: coloured chip in B, text across C:H
  const note = (
    badge,
    text,
    badgeFill,
    badgeFont,
    bg = "FFFFFF",
    height = 24,
  ) => {
    ins.getRow(r).height = height;
    ins.mergeCells(r, 3, r, LAST);
    paint(r, FIRST, LAST, bg);
    const b = ins.getCell(r, FIRST);
    b.value = badge;
    b.fill = solid(badgeFill);
    b.font = font({ hex: badgeFont, bold: true, size: 10 });
    b.alignment = { horizontal: "center", vertical: "middle" };
    const t = ins.getCell(r, 3);
    t.value = text;
    t.font = font({ size: 10 });
    t.alignment = {
      vertical: "middle",
      horizontal: "left",
      wrapText: true,
      indent: 1,
    };
    r++;
  };

  // Quick start
  section("QUICK START");
  [
    "Click Download Excel in Display Manager — this file always contains your current configurations.",
    "To change a configuration, edit its row. Keep the ID exactly as it is.",
    "To add a configuration, fill one of the blank rows at the bottom and leave the ID empty.",
    "Save the file as .xlsx and click Upload Excel. A summary shows how many rows were created, updated or skipped.",
  ].forEach((text, i) => note(String(i + 1), text, GROUPS[0].hex, "FFFFFF"));
  ins.getRow(r++).height = 10;

  // Rules
  section("IMPORTANT RULES", "B45309");
  [
    "Do not rename or delete the DashboardConfigs sheet, and do not remove the header rows (rows 1–4).",
    "Dashboard Name and Station Code 1 are required — rows missing either one are skipped.",
    "Visibility columns accept TRUE or FALSE only (use the dropdown).",
    "Number columns accept whole numbers only — no units, no text.",
    "Line Code and Quality Process Code accept several values separated by commas, e.g. 12210,12206.",
    "A row whose ID does not exist is skipped. A blank number cell falls back to its default (see the table below).",
  ].forEach((text) => note("!", text, "D97706", "FFFFFF", "FFFBEB"));
  ins.getRow(r++).height = 10;

  // Colour guide
  section("COLOUR GUIDE");
  const legend = (swatchText, fill, fontHex, text) => {
    ins.getRow(r).height = 24;
    ins.mergeCells(r, 3, r, LAST);
    paint(r, FIRST, LAST, "FFFFFF");
    const s = ins.getCell(r, FIRST);
    s.value = swatchText;
    s.fill = solid(fill);
    s.font = font({ hex: fontHex, bold: true });
    s.alignment = { horizontal: "center", vertical: "middle" };
    const t = ins.getCell(r, 3);
    t.value = text;
    t.font = font();
    t.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    r++;
  };
  legend(
    "TRUE",
    "D1FAE5",
    "047857",
    "The page is shown when the dashboard is launched.",
  );
  legend("FALSE", "E2E8F0", "64748B", "The page is hidden.");
  legend(
    "12",
    KEY_FILL,
    MUTED,
    "ID column — system key. Blank = new configuration. Never change an existing ID.",
  );
  legend("*", "FEE2E2", "B91C1C", "Marks a required column header.");
  ins.getRow(r++).height = 10;

  // Field reference (starts on a fresh printed page)
  ins.getRow(r - 1).addPageBreak();
  section("FIELD REFERENCE");
  ins.getRow(r).height = 22;
  [
    "Group",
    "Column",
    "Required",
    "Type",
    "Default",
    "Example",
    "Description",
  ].forEach((h, i) => {
    const cell = ins.getCell(r, FIRST + i);
    cell.value = h;
    cell.fill = solid("475569");
    cell.font = font({ hex: "FFFFFF", bold: true, size: 9 });
    cell.alignment = {
      horizontal: i >= 6 ? "left" : "center",
      vertical: "middle",
      indent: i >= 6 ? 1 : 0,
    };
    cell.border = { bottom: side("thin", "475569") };
  });
  r++;

  const refGroups = [
    { label: "System", hex: SLATE, fields: ["Id"] },
    ...GROUPS,
  ];
  let stripe = 0;
  for (const g of refGroups) {
    const start = r;
    for (const key of g.fields) {
      const fill = stripe++ % 2 === 0 ? "FFFFFF" : "F8FAFC";
      ins.getRow(r).height = DOCS[key].length > 80 ? 32 : 22;
      paint(r, FIRST, LAST, fill);
      const cells = [
        [3, COL_LABELS[key], font({ bold: true }), "left"],
        [
          4,
          REQUIRED.has(key) ? "Yes" : "—",
          font({
            hex: REQUIRED.has(key) ? "B91C1C" : MUTED,
            bold: REQUIRED.has(key),
          }),
          "center",
        ],
        [5, typeOf(key), font({ hex: MUTED }), "center"],
        [
          6,
          key === "Id" ? "—" : defaultOf(key),
          font({ hex: MUTED }),
          "center",
        ],
        [7, EXAMPLES[key], font({ name: "Courier New", size: 9 }), "left"],
        [8, DOCS[key], font(), "left"],
      ];
      for (const [n, value, f, h] of cells) {
        const cell = ins.getCell(r, n);
        cell.value = value;
        cell.font = f;
        cell.alignment = {
          vertical: "middle",
          horizontal: h,
          wrapText: n === 8,
          indent: h === "left" ? 1 : 0,
        };
      }
      r++;
    }
    // coloured group chip, merged down the group's rows
    if (r - 1 > start) ins.mergeCells(start, FIRST, r - 1, FIRST);
    for (let rr = start; rr < r; rr++) {
      const cell = ins.getCell(rr, FIRST);
      cell.fill = solid(g.hex);
      cell.border = {
        bottom: side("thin", "FFFFFF"),
        top: side("thin", "FFFFFF"),
      };
    }
    const chip = ins.getCell(start, FIRST);
    chip.value = g.label;
    chip.font = font({ hex: "FFFFFF", bold: true, size: 10 });
    chip.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };
  }

  ins.getRow(r).height = 22;
  ins.mergeCells(r, FIRST, r, LAST);
  const foot = ins.getCell(r, FIRST);
  foot.value =
    "Example values are for guidance only — they are not part of the data and are never imported.";
  foot.font = font({ hex: MUTED, size: 9, italic: true });
  foot.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

  ins.pageSetup = {
    paperSize: 9,
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
  };
};

// ═════════════════════════════════════════════════════════════════════════════
//  PUBLIC
// ═════════════════════════════════════════════════════════════════════════════
/** Build the export / import workbook. Pass rows = [] for a blank template. */
const buildConfigWorkbook = (rows = [], exportedAt = new Date()) => {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Dashboard Manager";
  wb.lastModifiedBy = "Dashboard Manager";
  wb.created = exportedAt;
  wb.modified = exportedAt;
  wb.title = "Dashboard Configuration";
  wb.subject = "Dashboard configuration export / import template";

  buildConfigSheet(wb, rows, exportedAt);
  buildInstructionsSheet(wb);
  return wb;
};

// ═════════════════════════════════════════════════════════════════════════════
//  CONFIG HELPERS
// ═════════════════════════════════════════════════════════════════════════════

// Only the columns the frontend uses (no IsActive / CreatedAt / UpdatedAt ...)
const SELECT_CONFIG = `SELECT ${ALL_COLS.join(", ")} FROM dbo.DashboardConfig`;

const sqlTypeOf = (col) =>
  BOOL_FIELDS.has(col)
    ? sql.Bit
    : NUM_FIELDS.has(col)
      ? sql.Int
      : sql.NVarChar(STR_LENGTHS[col]);

/** Normalise any camelCase source (request body / Excel row) into { DbColumn: value } */
const parseConfig = (src = {}) => {
  const out = {};
  for (const col of FIELD_COLS) {
    const raw = src[toKey(col)];
    if (BOOL_FIELDS.has(col)) {
      out[col] = safeBool(raw);
    } else if (NUM_FIELDS.has(col)) {
      out[col] = safeInt(raw, NUM_DEFAULTS[col] ?? null);
    } else {
      const text = String(raw ?? "").trim();
      out[col] = text || (NULLABLE_STR.has(col) ? null : "");
    }
  }
  return out;
};

/** Validate a request body and return the normalised config */
const parseAndValidateConfig = (body = {}) => {
  for (const col of NUM_FIELDS) {
    const v = body[toKey(col)];
    if (
      v !== undefined &&
      v !== null &&
      v !== "" &&
      !Number.isFinite(Number(v))
    ) {
      throw new AppError(
        `${toKey(col)} must be a valid number, received: "${v}".`,
        400,
      );
    }
  }
  const cfg = parseConfig(body);
  if (!cfg.DashboardName)
    throw new AppError("Dashboard name is required.", 400);
  if (!cfg.StationCode1) throw new AppError("Station Code 1 is required.", 400);
  return cfg;
};

const bindConfigInputs = (request, cfg) => {
  for (const col of FIELD_COLS) request.input(col, sqlTypeOf(col), cfg[col]);
  return request;
};

const INSERT_SQL = `
  SET NOCOUNT ON;
  INSERT INTO dbo.DashboardConfig (${FIELD_COLS.join(", ")}, IsActive, CreatedAt, UpdatedAt)
  VALUES (${FIELD_COLS.map((c) => `@${c}`).join(", ")}, 1, GETDATE(), GETDATE());
  ${SELECT_CONFIG} WHERE Id = SCOPE_IDENTITY();
`;

const UPDATE_SET = `${FIELD_COLS.map((c) => `${c} = @${c}`).join(", ")}, UpdatedAt = GETDATE()`;

const UPDATE_SQL = `
  SET NOCOUNT ON;
  UPDATE dbo.DashboardConfig SET ${UPDATE_SET} WHERE Id = @Id AND IsActive = 1;
  ${SELECT_CONFIG} WHERE Id = @Id AND IsActive = 1;
`;

const parseId = (value) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0)
    throw new AppError("Invalid config id.", 400);
  return id;
};

// ═════════════════════════════════════════════════════════════════════════════
//  EXPORT
// ═════════════════════════════════════════════════════════════════════════════
export const exportDashboardConfigs = tryCatch(async (req, res) => {
  const rows = await withPool(async (pool) => {
    const result = await pool
      .request()
      .query(`${SELECT_CONFIG} WHERE IsActive = 1 ORDER BY CreatedAt DESC`);
    return result.recordset;
  });

  const wb = buildConfigWorkbook(rows);

  const filename = `dashboard_configs_${new Date().toISOString().slice(0, 10)}.xlsx`;
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  await wb.xlsx.write(res);
  res.end();
});

// ═════════════════════════════════════════════════════════════════════════════
//  IMPORT
// ═════════════════════════════════════════════════════════════════════════════
export const importDashboardConfigs = tryCatch(async (req, res) => {
  if (!req.file)
    throw new AppError("No file uploaded. Send a .xlsx file as 'file'.", 400);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(req.file.buffer);

  const ws = wb.getWorksheet("DashboardConfigs");
  if (!ws)
    throw new AppError(
      "Worksheet 'DashboardConfigs' not found in the uploaded file.",
      400,
    );

  // Locate the header row (rows 1-5), matching by label OR raw field name
  let headerRowNum = null;
  let colMap = {}; // DbColumn -> 1-based column index

  for (let r = 1; r <= 5; r++) {
    const found = {};
    ws.getRow(r).eachCell({ includeEmpty: false }, (cell, colNum) => {
      const v = String(cell.value ?? "")
        .replace(/\s*\*$/, "")
        .trim()
        .toLowerCase(); // "Dashboard Name *" -> "dashboard name"
      for (const col of ALL_COLS) {
        if (v === COL_LABELS[col].toLowerCase() || v === col.toLowerCase()) {
          found[col] = colNum;
        }
      }
    });
    if (found.DashboardName) {
      headerRowNum = r;
      colMap = found;
      break;
    }
  }

  if (!headerRowNum) {
    throw new AppError(
      "Could not locate the column header row. Ensure you are using the exported template and that row 3 contains column headers.",
      400,
    );
  }

  // Parse data rows
  const records = [];
  const errors = [];

  ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
    if (rowNum <= headerRowNum) return;

    const cellValue = (col) => {
      const ci = colMap[col];
      if (!ci) return undefined;
      const v = row.getCell(ci).value;
      // rich-text / formula / hyperlink cells come back as objects
      if (v && typeof v === "object" && "result" in v) return v.result;
      if (v && typeof v === "object" && "text" in v) return v.text;
      return v;
    };

    // The hint row ("Leave blank to create new") is not data
    if (rowNum === headerRowNum + 1) {
      const idVal = row.getCell(colMap.Id ?? 1).value;
      if (typeof idVal === "string" && isNaN(Number(idVal))) return;
    }

    const src = {};
    for (const col of ALL_COLS) src[toKey(col)] = cellValue(col);
    const cfg = parseConfig(src);

    if (!cfg.DashboardName && !cfg.StationCode1) return; // empty row
    if (!cfg.DashboardName) {
      errors.push({ row: rowNum, issue: "DashboardName is required." });
      return;
    }
    if (!cfg.StationCode1) {
      errors.push({ row: rowNum, issue: "StationCode1 is required." });
      return;
    }

    const id = Number(src.id);
    records.push({
      rowNum,
      id: Number.isInteger(id) && id > 0 ? id : null,
      cfg,
    });
  });

  if (records.length === 0) {
    throw new AppError(
      `No valid data rows found. ${
        errors.length
          ? `Row errors: ${errors.map((e) => `row ${e.row}: ${e.issue}`).join("; ")}.`
          : "The sheet appears to be empty."
      }`,
      400,
    );
  }

  // Upsert inside one transaction: a DB error rolls the whole import back
  const results = {
    created: 0,
    updated: 0,
    skipped: errors.length,
    rowErrors: errors,
  };

  await withPool(async (pool) => {
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      for (const { rowNum, id, cfg } of records) {
        const request = bindConfigInputs(new sql.Request(tx), cfg);

        if (id) {
          const r = await request.input("Id", sql.Int, id).query(UPDATE_SQL);
          if (r.recordset.length === 0) {
            results.rowErrors.push({
              row: rowNum,
              id,
              issue: `Id ${id} not found — skipped.`,
            });
            results.skipped++;
          } else {
            results.updated++;
          }
        } else {
          await request.query(INSERT_SQL);
          results.created++;
        }
      }
      await tx.commit();
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  });

  res.status(200).json({
    success: true,
    message: `Import complete. ${results.created} created, ${results.updated} updated, ${results.skipped} skipped.`,
    results,
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  DASHBOARD CONFIG CRUD
// ═════════════════════════════════════════════════════════════════════════════

// GET /dashboard/configs
export const getAllDashboardConfigs = tryCatch(async (req, res) => {
  const data = await withPool(async (pool) => {
    const result = await pool
      .request()
      .query(`${SELECT_CONFIG} WHERE IsActive = 1 ORDER BY CreatedAt DESC`);
    return result.recordset;
  });
  ok(res, data);
});

// GET /dashboard/configs/:id
export const getDashboardConfigById = tryCatch(async (req, res) => {
  const id = parseId(req.params.id);
  const data = await withPool(async (pool) => {
    const result = await pool
      .request()
      .input("Id", sql.Int, id)
      .query(`${SELECT_CONFIG} WHERE Id = @Id AND IsActive = 1`);
    return result.recordset[0] || null;
  });
  if (!data) throw new AppError("Dashboard config not found.", 404);
  ok(res, data);
});

// POST /dashboard/configs
export const createDashboardConfig = tryCatch(async (req, res) => {
  const cfg = parseAndValidateConfig(req.body);

  const data = await withPool(async (pool) => {
    const result = await bindConfigInputs(pool.request(), cfg).query(
      INSERT_SQL,
    );
    return result.recordset[0];
  });

  ok(res, data, { message: "Dashboard config created." }, 201);
});

// PUT /dashboard/configs/:id
export const updateDashboardConfig = tryCatch(async (req, res) => {
  const id = parseId(req.params.id);
  const cfg = parseAndValidateConfig(req.body);

  const data = await withPool(async (pool) => {
    const result = await bindConfigInputs(pool.request(), cfg)
      .input("Id", sql.Int, id)
      .query(UPDATE_SQL);
    return result.recordset[0] || null;
  });

  if (!data) throw new AppError("Dashboard config not found.", 404);
  ok(res, data, { message: "Dashboard config updated successfully." });
});

// DELETE /dashboard/configs/:id  (soft delete)
export const deleteDashboardConfig = tryCatch(async (req, res) => {
  const id = parseId(req.params.id);

  await withPool(async (pool) => {
    const result = await pool
      .request()
      .input("Id", sql.Int, id)
      .query(
        "UPDATE dbo.DashboardConfig SET IsActive = 0, UpdatedAt = GETDATE() WHERE Id = @Id AND IsActive = 1",
      );
    if (!result.rowsAffected[0])
      throw new AppError("Dashboard config not found.", 404);
  });

  res.status(200).json({ success: true, message: "Dashboard config deleted." });
});

// ═════════════════════════════════════════════════════════════════════════════
//  SHIFT / REQUEST HELPERS
// ═════════════════════════════════════════════════════════════════════════════
const resolveShiftBounds = (shiftDate, shift) => {
  const base = new Date(shiftDate);
  const start = new Date(base);
  const end = new Date(base);
  if (shift === "A") {
    // 08:00 -> 20:00 same day
    start.setHours(8, 0, 0, 0);
    end.setHours(20, 0, 0, 0);
  } else {
    // Shift B: 20:00 on shiftDate -> 08:00 next day
    start.setHours(20, 0, 0, 0);
    end.setDate(base.getDate() + 1);
    end.setHours(8, 0, 0, 0);
  }
  return { shiftStart: start, shiftEnd: end };
};

const resolveMonthBounds = (shiftStart) => ({
  monthStart: new Date(
    shiftStart.getFullYear(),
    shiftStart.getMonth(),
    1,
    8,
    0,
    0,
  ),
  monthEnd: new Date(
    shiftStart.getFullYear(),
    shiftStart.getMonth() + 1,
    1,
    8,
    0,
    0,
  ),
});

/** Validates ?configId, ?shiftDate, ?shift and returns everything every endpoint needs */
const getShiftContext = (req) => {
  const { shiftDate, shift = "A" } = req.query;
  if (!shiftDate)
    throw new AppError("Missing required query parameter: shiftDate.", 400);
  if (!["A", "B"].includes(shift))
    throw new AppError("Invalid shift. Must be A or B.", 400);

  const rawId = req.query.configId || req.params.id;
  if (!rawId) throw new AppError("Missing configId.", 400);
  const configId = parseId(rawId);

  const { shiftStart, shiftEnd } = resolveShiftBounds(shiftDate, shift);
  return {
    configId,
    shiftStart,
    istStart: convertToIST(shiftStart),
    istEnd: convertToIST(shiftEnd),
  };
};

const requireConfig = async (pool, configId) => {
  const result = await pool
    .request()
    .input("Id", sql.Int, configId)
    .query(`${SELECT_CONFIG} WHERE Id = @Id AND IsActive = 1`);
  const config = result.recordset[0];
  if (!config) throw new AppError("Dashboard config not found.", 404);
  return config;
};

const bindShift = (request, { configId, istStart, istEnd }) =>
  request
    .input("configId", sql.Int, configId)
    .input("shiftStart", sql.DateTime, istStart)
    .input("shiftEnd", sql.DateTime, istEnd);

// ═════════════════════════════════════════════════════════════════════════════
//  SHARED SQL FRAGMENTS
// ═════════════════════════════════════════════════════════════════════════════
const PRODUCTIVE_FACTOR = 0.92; // share of elapsed shift time that is productive
const PLAN_FACTOR = 0.85; // share of theoretical output used as the shift plan

// "Now", clamped into the shift so past/future shifts don't produce odd numbers
const SQL_NOW_CAPPED = `CASE
    WHEN GETDATE() > @shiftEnd   THEN @shiftEnd
    WHEN GETDATE() < @shiftStart THEN @shiftStart
    ELSE GETDATE()
  END`;

// Needs a CTE/alias named `cfg` exposing LineTaktTime1 and WorkingTimeMin
const SQL_SHIFT_PLAN = `CAST(((60.0 / NULLIF(cfg.LineTaktTime1, 0)) * cfg.WorkingTimeMin) * ${PLAN_FACTOR} AS INT)`;

const SQL_CONSUMED_PCT = `CAST(ROUND(
    DATEDIFF(MINUTE, @shiftStart, ${SQL_NOW_CAPPED}) * 100.0
    / NULLIF(DATEDIFF(MINUTE, @shiftStart, @shiftEnd), 0), 2) AS DECIMAL(5,2))`;

// CTE: count of finished units at a station inside [from, to)
const activityCount = (name, from, to) => `${name} AS (
    SELECT COUNT(PSNo) AS Qty
    FROM ProcessActivity
    WHERE StationCode  = @stationCode
      AND ActivityType = 5
      AND Remark IN (SELECT value FROM STRING_SPLIT(@lineCode, ','))
      AND ActivityOn  >= ${from}
      AND ActivityOn  <  ${to}
  )`;

const SQL_CFG_CTE = `cfg AS (
    SELECT LineTaktTime1, WorkingTimeMin, LineMonthlyProduction1
    FROM dbo.DashboardConfig
    WHERE Id = @configId AND IsActive = 1
  )`;

// ═════════════════════════════════════════════════════════════════════════════
//  PRODUCTION DISPLAY 1 / 2   (FG Packing / FG Loading)
//  Returns ONLY the fields the two Production Display pages read.
//  Daily target + balance are handled in the frontend from the config.
// ═════════════════════════════════════════════════════════════════════════════
const buildProductionQuery = ({ dailyTargetCol, monthlyPlanCol }) => `
  WITH ${activityCount("ShiftActual", "@shiftStart", "@shiftEnd")},
  ${activityCount("MonthlyActual", "@monthStart", "@monthEnd")}
  SELECT
    dc.${monthlyPlanCol}                      AS MonthlyPlanQty,
    sa.Qty                                    AS ActualQty,
    sa.Qty                                    AS GaugeValue,

    -- Loss units: target UPH x productive hours so far, minus actual (never negative)
    CAST(CASE WHEN x.TargetToDate > sa.Qty THEN x.TargetToDate - sa.Qty ELSE 0 END AS INT) AS LossUnits,

    -- Performance vs daily target, prorated to elapsed productive time
    CAST(sa.Qty * 100.0 / NULLIF(
      dc.${dailyTargetCol} * (t.ProdMin / NULLIF(CAST(dc.WorkingTimeMin AS FLOAT), 0)), 0)
    AS DECIMAL(6,2))                          AS PerformancePct,

    ma.Qty                                    AS MonthlyAchieved,
    dc.${monthlyPlanCol} - ma.Qty             AS MonthlyRemaining,
    CAST((dc.${monthlyPlanCol} - ma.Qty) * 1.0 / NULLIF(d.RemainingDays, 0) AS INT) AS AskingRate,
    d.RemainingDays                           AS RemainingDays
  FROM dbo.DashboardConfig dc
  CROSS JOIN ShiftActual   sa
  CROSS JOIN MonthlyActual ma
  CROSS APPLY (SELECT DATEDIFF(MINUTE, @shiftStart, ${SQL_NOW_CAPPED}) * ${PRODUCTIVE_FACTOR} AS ProdMin) t
  CROSS APPLY (SELECT dc.LineTarget1 * t.ProdMin / 60.0 AS TargetToDate) x
  CROSS APPLY (SELECT DAY(EOMONTH(GETDATE())) - DAY(GETDATE()) + 1 AS RemainingDays) d
  WHERE dc.Id = @configId;
`;

const makeProductionHandler = ({
  stationCol,
  dailyTargetCol,
  monthlyPlanCol,
}) => {
  const query = buildProductionQuery({ dailyTargetCol, monthlyPlanCol });

  return tryCatch(async (req, res) => {
    const ctx = getShiftContext(req);
    const { monthStart, monthEnd } = resolveMonthBounds(ctx.shiftStart);

    const data = await withPool(async (pool) => {
      const config = await requireConfig(pool, ctx.configId);
      const stationCode = config[stationCol];
      if (!stationCode)
        throw new AppError(
          `${stationCol} is not configured for this dashboard.`,
          400,
        );

      const result = await bindShift(pool.request(), ctx)
        .input("lineCode", sql.NVarChar(50), String(config.LineCode ?? ""))
        .input("stationCode", sql.NVarChar(50), String(stationCode))
        .input("monthStart", sql.DateTime, convertToIST(monthStart))
        .input("monthEnd", sql.DateTime, convertToIST(monthEnd))
        .query(query);

      return result.recordset[0] || null;
    });

    if (!data)
      throw new AppError("No data found for the given shift and date.", 404);
    ok(res, data);
  });
};

// GET /dashboard/production-display-1
export const getFGPackingData = makeProductionHandler({
  stationCol: "StationCode1",
  dailyTargetCol: "DailyProductionTarget1",
  monthlyPlanCol: "LineMonthlyProduction1",
});

// GET /dashboard/production-display-2
// NOTE: Display 2 reuses Display 1's monthly plan, exactly as before.
// If Display 2 should use its own plan, change monthlyPlanCol to "LineMonthlyProduction2".
export const getFGLoadingData = makeProductionHandler({
  stationCol: "StationCode2",
  dailyTargetCol: "DailyProductionTarget2",
  monthlyPlanCol: "LineMonthlyProduction1",
});

// ═════════════════════════════════════════════════════════════════════════════
//  HOURLY      -> hours[{ HourNo, Actual }]  +  summary{ ShiftPlan, TotalAchieved, Remaining, ConsumedTimePct }
// ═════════════════════════════════════════════════════════════════════════════
const HOURLY_FROM = `
  FROM MaterialBarcode mb
  JOIN ProcessActivity b ON b.PSNo        = mb.DocNo
  JOIN WorkCenter      c ON b.StationCode = c.StationCode
  WHERE mb.PrintStatus = 1
    AND mb.Status     <> 99
    AND mb.Type       <> 200
    AND c.StationCode  = @stationCode
    AND Remark IN (SELECT value FROM STRING_SPLIT(@lineCode, ','))
    AND b.ActivityType = 5
    AND b.ActivityOn  >= @shiftStart
    AND b.ActivityOn  <  @shiftEnd`;

const HOURLY_HOURS_QUERY = `
  SELECT
    DATEADD(HOUR, DATEDIFF(HOUR, 0, b.ActivityOn), 0) AS HourTime,
    COUNT(*)                                          AS Actual
  ${HOURLY_FROM}
  GROUP BY DATEADD(HOUR, DATEDIFF(HOUR, 0, b.ActivityOn), 0)
  ORDER BY HourTime;
`;

const HOURLY_SUMMARY_QUERY = `
  WITH ${SQL_CFG_CTE},
  ShiftActual AS (
    SELECT COUNT(*) AS Achieved
    ${HOURLY_FROM}
  )
  SELECT
    ${SQL_SHIFT_PLAN}                   AS ShiftPlan,
    sa.Achieved                         AS TotalAchieved,
    ${SQL_SHIFT_PLAN} - sa.Achieved     AS Remaining,
    ${SQL_CONSUMED_PCT}                 AS ConsumedTimePct
  FROM cfg CROSS JOIN ShiftActual sa;
`;

// GET /dashboard/hourly
export const getHourlyProductionData = tryCatch(async (req, res) => {
  const ctx = getShiftContext(req);

  const data = await withPool(async (pool) => {
    const config = await requireConfig(pool, ctx.configId);
    const bindAll = () =>
      bindShift(pool.request(), ctx)
        .input("stationCode", sql.NVarChar(50), String(config.StationCode1))
        .input("lineCode", sql.NVarChar(50), String(config.LineCode ?? ""));

    const [hoursResult, summaryResult] = await Promise.all([
      bindAll().query(HOURLY_HOURS_QUERY),
      bindAll().query(HOURLY_SUMMARY_QUERY),
    ]);

    return {
      hours: hoursResult.recordset.map((row, i) => ({
        HourNo: i + 1,
        Actual: row.Actual,
      })),
      summary: summaryResult.recordset[0] || {},
    };
  });

  ok(res, data);
});

// ═════════════════════════════════════════════════════════════════════════════
//  QUALITY     -> summary{ Plan, TotalAchieved, OkUnit, DefectUnit, ReworkDone, OkPct, DefectPct }
//                 defects[{ DefectName, DefectCount }]
// ═════════════════════════════════════════════════════════════════════════════
const QUALITY_SUMMARY_QUERY = `
  WITH ${SQL_CFG_CTE},
  ${activityCount("ShiftActual", "@shiftStart", "@shiftEnd")},
  Rework AS (
    SELECT
      COUNT(*) AS Total,
      ISNULL(SUM(CASE WHEN s.Status = 'Active' THEN 1 ELSE 0 END), 0) AS Active,
      ISNULL(SUM(CASE WHEN s.Status = 'Closed' THEN 1 ELSE 0 END), 0) AS Closed
    FROM InspectionTrans it
    INNER JOIN InspectionHeader ih ON it.InspectionLotNo = ih.InspectionLotNo
    LEFT  JOIN Status           s  ON ih.Status          = s.ID
    WHERE it.NextAction = 1
      AND it.InspectedOn >= @shiftStart
      AND it.InspectedOn <  @shiftEnd
  )
  SELECT
    ${SQL_SHIFT_PLAN}                                                   AS [Plan],
    sa.Qty                                                              AS TotalAchieved,
    sa.Qty - r.Total                                                    AS OkUnit,
    r.Active                                                            AS DefectUnit,
    r.Closed                                                            AS ReworkDone,
    CAST((sa.Qty - r.Total) * 100.0 / NULLIF(sa.Qty, 0) AS DECIMAL(5,1)) AS OkPct,
    CAST(r.Active           * 100.0 / NULLIF(sa.Qty, 0) AS DECIMAL(5,1)) AS DefectPct
  FROM cfg
  CROSS JOIN ShiftActual sa
  CROSS JOIN Rework r;
`;

const QUALITY_DEFECTS_QUERY = `
  SELECT dc.Name AS DefectName, COUNT(*) AS DefectCount
  FROM InspectionTrans it
  INNER JOIN InspectionHeader  ih  ON it.InspectionLotNo = ih.InspectionLotNo
  INNER JOIN InspectionDefect  idf ON it.ID              = idf.ID
  INNER JOIN DefectCodeMaster  dc  ON idf.Defect         = dc.Code
  WHERE it.NextAction = 1
    AND ih.Process IN (SELECT value FROM STRING_SPLIT(@qualityProcessCode, ','))
    AND it.InspectedOn >= @shiftStart
    AND it.InspectedOn <  @shiftEnd
    AND dc.Name IS NOT NULL
  GROUP BY dc.Name
  ORDER BY DefectCount DESC;
`;

// GET /dashboard/quality
export const getQualityData = tryCatch(async (req, res) => {
  const ctx = getShiftContext(req);

  const data = await withPool(async (pool) => {
    const config = await requireConfig(pool, ctx.configId);

    const [summary, defects] = await Promise.all([
      bindShift(pool.request(), ctx)
        .input("stationCode", sql.NVarChar(50), String(config.StationCode1))
        .input("lineCode", sql.NVarChar(50), String(config.LineCode ?? ""))
        .query(QUALITY_SUMMARY_QUERY),
      bindShift(pool.request(), ctx)
        .input(
          "qualityProcessCode",
          sql.NVarChar(500),
          config.QualityProcessCode,
        )
        .query(QUALITY_DEFECTS_QUERY),
    ]);

    return { summary: summary.recordset[0] || {}, defects: defects.recordset };
  });

  ok(res, data);
});

// ═════════════════════════════════════════════════════════════════════════════
//  LOSS        -> stations[{ StationName, TotalStopCount }]
//                 summary{ Plan, Achieved, Remaining, ConsumedTimePct }
// ═════════════════════════════════════════════════════════════════════════════
const LOSS_STATIONS_QUERY = `
  WITH EMG AS (
    SELECT
      T.RefID,
      M.PLCLocation                        AS StationName,
      T.EmgOn,
      T.EmgOff,
      DATEDIFF(SECOND, T.EmgOn, T.EmgOff)  AS TotalSeconds
    FROM EMGTrans T
    INNER JOIN EMGMaster M
      ON T.PLCCode = M.PLCCode AND T.MEMBit = M.MEMBit AND M.Active = 1
    WHERE T.EmgOff IS NOT NULL
      AND T.EmgOn >= @shiftStart AND T.EmgOn < @shiftEnd
      AND M.LineName = @lineName
      AND M.Location = @sectionName
  ),
  BREAKS AS (
    SELECT
      CAST(CAST(@shiftStart AS DATE) AS DATETIME) + CAST(StartTime AS DATETIME) AS BreakStart,
      CAST(CAST(@shiftStart AS DATE) AS DATETIME) + CAST(EndTime   AS DATETIME) AS BreakEnd
    FROM ShiftBreaks
  ),
  NET AS (
    -- stop length minus any overlap with scheduled breaks
    SELECT
      E.StationName,
      E.TotalSeconds - ISNULL(SUM(
        DATEDIFF(SECOND,
          CASE WHEN E.EmgOn  > B.BreakStart THEN E.EmgOn  ELSE B.BreakStart END,
          CASE WHEN E.EmgOff < B.BreakEnd   THEN E.EmgOff ELSE B.BreakEnd   END)
      ), 0) AS NetSeconds
    FROM EMG E
    LEFT JOIN BREAKS B ON B.BreakStart < E.EmgOff AND B.BreakEnd > E.EmgOn
    GROUP BY E.RefID, E.StationName, E.TotalSeconds
  )
  SELECT StationName, COUNT(*) AS TotalStopCount
  FROM NET
  WHERE NetSeconds > 0
  GROUP BY StationName
  ORDER BY COUNT(*) DESC;
`;

const LOSS_SUMMARY_QUERY = `
  WITH ${SQL_CFG_CTE},
  ${activityCount("ShiftActual", "@shiftStart", "@shiftEnd")}
  SELECT
    ${SQL_SHIFT_PLAN} AS [Plan],
    sa.Qty            AS Achieved,
    CAST(cfg.LineMonthlyProduction1 * 1.0 / NULLIF(DAY(EOMONTH(@shiftStart)), 0) AS INT) - sa.Qty AS Remaining,
    ${SQL_CONSUMED_PCT} AS ConsumedTimePct
  FROM cfg CROSS JOIN ShiftActual sa;
`;

// GET /dashboard/loss
export const getLossData = tryCatch(async (req, res) => {
  const ctx = getShiftContext(req);

  const data = await withPool(async (pool) => {
    const config = await requireConfig(pool, ctx.configId);
    if (!config.SectionName)
      throw new AppError(
        "SectionName is not configured for this dashboard. Please update the configuration.",
        400,
      );

    const [stations, summary] = await Promise.all([
      bindShift(pool.request(), ctx)
        .input("lineName", sql.NVarChar(100), config.LineName)
        .input("sectionName", sql.NVarChar(200), config.SectionName)
        .query(LOSS_STATIONS_QUERY),
      bindShift(pool.request(), ctx)
        .input("stationCode", sql.NVarChar(50), String(config.StationCode1))
        .input("lineCode", sql.NVarChar(50), String(config.LineCode ?? ""))
        .query(LOSS_SUMMARY_QUERY),
    ]);

    return {
      stations: stations.recordset,
      summary: summary.recordset[0] || {},
    };
  });

  ok(res, data);
});
