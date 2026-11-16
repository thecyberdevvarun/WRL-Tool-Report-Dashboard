import { AppError } from "../utils/app-error.js";
import { buildShiftReport } from "./shift-report.service.js";
import { buildReportAttachments } from "./report-attachments.service.js";
import { sendShiftEndReportMail } from "../emailTemplates/iot-system/shiftEndReport.template.js";
import { sendSmartAlertMail } from "../emailTemplates/alert-system/smartAlert.template.js";
import {
  buildChemBulkStorageReport,
  buildChemBulkStorageExcel,
} from "./chemical-bulk-storage-report.service.js";
import { sendChemBulkStorageReportMail } from "../emailTemplates/chemical-storage-system/chemBulkStorageReport.template.js";

// "Send test" support for Mail Management. Each handler sends the REAL mail
// (same builders/templates the cron uses) to ONE address.
//
// Adding a new mail task? Add one entry to TEST_HANDLERS at the bottom. A task with
// no handler still works; its Send Test just reports "No test is available yet".

// ── Shift report ─────────────────────────────────────────────────────────────
const SHIFT_TASK_REPORTS = {
  shift_production_report: "Production Report",
  shift_downtime_report: "Downtime Report",
};

const toMinsOfDay = (hhmm) => {
  if (!hhmm) return null;
  const [h, m] = String(hhmm).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
const dateOnly = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Which configured shift contains this time, and which production day it belongs to
// (same overnight-shift rule the cron uses: EventDate = the day the shift STARTED).
const resolveTestShift = async (pool, startDate) => {
  const start = new Date(String(startDate).replace(" ", "T"));
  if (Number.isNaN(start.getTime()))
    throw new AppError("Invalid date/time", 400);

  const shifts = await pool
    .request()
    .query(
      `SELECT ShiftName, StartTime, EndTime FROM ShiftConfigs WHERE Status = 1`,
    );
  const curMins = start.getHours() * 60 + start.getMinutes();
  const matched = shifts.recordset.find((s) => {
    const s0 = toMinsOfDay(s.StartTime);
    let e0 = toMinsOfDay(s.EndTime);
    if (s0 === null || e0 === null) return false;
    if (e0 <= s0) e0 += 1440; // overnight shift
    const tc = curMins < s0 ? curMins + 1440 : curMins;
    return tc >= s0 && tc < e0;
  });
  if (!matched)
    throw new AppError("No configured shift covers that time.", 400);

  const s0 = toMinsOfDay(matched.StartTime);
  const e0 = toMinsOfDay(matched.EndTime);
  let dateStr = dateOnly(start);
  if (e0 <= s0 && curMins < s0) {
    const prev = new Date(start);
    prev.setDate(prev.getDate() - 1);
    dateStr = dateOnly(prev);
  }
  return { shiftName: matched.ShiftName, dateStr };
};

const testShiftReport = async (to, taskKeys, { startDate } = {}) => {
  const pool = global.pool3;
  const reportNames = taskKeys
    .map((k) => SHIFT_TASK_REPORTS[k])
    .filter(Boolean);

  let shiftName, dateStr;
  if (startDate) {
    ({ shiftName, dateStr } = await resolveTestShift(pool, startDate));
  } else {
    const latest = await pool.request().query(`
      SELECT TOP 1 EventDate, ShiftName
      FROM PartProcessEvents
      WHERE ShiftName IS NOT NULL AND Status = 1
      ORDER BY EventDate DESC, StartTime DESC
    `);
    if (!latest.recordset.length) {
      throw new AppError(
        "No production data found yet, so there is no shift report to send.",
        400,
      );
    }
    shiftName = latest.recordset[0].ShiftName;
    dateStr = new Date(latest.recordset[0].EventDate)
      .toISOString()
      .slice(0, 10);
  }

  const report = await buildShiftReport(pool, { shiftName }, dateStr);
  if (!report)
    throw new AppError(
      `No production data for ${shiftName} on ${dateStr}.`,
      400,
    );

  const byReport = reportNames.length
    ? await buildReportAttachments(pool, { shiftName }, dateStr, reportNames)
    : {};
  const attachments = reportNames.map((r) => byReport[r]).filter(Boolean);
  await sendShiftEndReportMail({
    to,
    ...report,
    attachments,
    attachedReportNames: reportNames,
  });

  const built = reportNames.filter((r) => byReport[r]);
  const note = built.length
    ? ` with Excel attached: ${built.join(", ")}`
    : " (no Excel attached — no data for the ticked report(s))";
  return `Sent ${shiftName} (${dateStr}) report${note}`;
};

// ── Smart alert ──────────────────────────────────────────────────────────────
const testSmartAlert = async (to) => {
  const ok = await sendSmartAlertMail({
    to,
    shiftName: "Shift 1 (TEST)",
    dateStr: new Date().toISOString().slice(0, 10),
    breaches: [{ type: "LowOEE", metricValue: 55, thresholdValue: 70 }],
    narrative:
      "This is a TEST alert sent from Mail Management. No real threshold was breached.",
  });
  if (!ok)
    throw new AppError(
      "The mail could not be sent — check the Mail Server settings.",
      502,
    );
  return "Sent a sample smart alert";
};

// ── Chemical bulk storage daily report ───────────────────────────────────────
const testChemicalReport = async (to) => {
  const report = await buildChemBulkStorageReport(global.pool1);
  const attachment = await buildChemBulkStorageExcel(report);
  await sendChemBulkStorageReportMail({ to, ...report, attachment });
  return "Sent today's chemical report";
};

// keys = tasks the handler covers; run(to, selectedKeys, options) returns a message or throws.
const TEST_HANDLERS = [
  {
    keys: Object.keys(SHIFT_TASK_REPORTS),
    label: "Shift Report",
    run: testShiftReport,
  },
  { keys: ["smart_alerts"], label: "Smart Alerts", run: testSmartAlert },
  {
    keys: ["chemical_bulk_storage"],
    label: "Chemical Report",
    run: testChemicalReport,
  },
];

/** Sends a test of each selected task to ONE address → [{ label, ok, message }] */
export const sendTestMails = async (to, taskKeys, options = {}) => {
  const results = [];
  const remaining = new Set(taskKeys);

  for (const h of TEST_HANDLERS) {
    const selected = h.keys.filter((k) => remaining.has(k));
    if (!selected.length) continue;
    selected.forEach((k) => remaining.delete(k));
    try {
      results.push({
        label: h.label,
        ok: true,
        message: await h.run(to, selected, options),
      });
    } catch (err) {
      results.push({
        label: h.label,
        ok: false,
        message: err.message || "Failed to send",
      });
    }
  }
  for (const k of remaining) {
    results.push({
      label: k,
      ok: false,
      message: "No test is available for this mail yet.",
    });
  }
  return results;
};
