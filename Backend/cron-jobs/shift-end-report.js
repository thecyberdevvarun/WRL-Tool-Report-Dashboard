/**
 * Shift-End Report — sends the per-model production/OEE breakdown for a
 * shift to every active Mail Config subscriber, the moment that shift's
 * configured end time (ShiftConfigs.EndTime) is reached. The email body
 * always shows the live Production Report numbers; subscribers additionally
 * get an Excel attachment for each of the Report Matrix reports they picked
 * (Production/Quality/Downtime/Hourly), built from the same data the report
 * pages export.
 *
 * Runs every minute and compares the current clock time against each active
 * shift's end time, so it stays correct if shift times are edited later —
 * no separate scheduling needed per shift.
 */
import cron from "node-cron";
import { buildShiftReport } from "../services/shift-report.service.js";
import { sendShiftEndReportMail } from "../emailTemplates/iot-system/shiftEndReport.template.js";
import { buildReportAttachments } from "../services/report-attachments.service.js";
import { getRecipientsByTasks } from "../services/mail-recipients.service.js";
import { evaluateShiftAlerts } from "../services/alert-detection.service.js";
import { sendShiftAlerts } from "../services/alert-notification.service.js";

// task key → the report name buildReportAttachments understands
const SHIFT_REPORT_TASKS = {
  shift_production_report: "Production Report",
  shift_downtime_report: "Downtime Report",
};

// Dedup guard so a shift's report is sent at most once per occurrence
// (the minute-resolution match window could otherwise double-fire).
// Reset whenever the local calendar date rolls over.
const sentKeys = new Set();
let lastDateKey = null;

const p2 = (n) => String(n).padStart(2, "0");
const dateKeyOf = (d) =>
  `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const offsetDateKey = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return dateKeyOf(d);
};
const toMins = (hhmm) => {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

const checkShiftEnds = async () => {
  const pool = global.pool3;
  if (!pool) return;

  const now = new Date();
  const curMins = now.getHours() * 60 + now.getMinutes();
  const todayKey = dateKeyOf(now);

  if (lastDateKey !== todayKey) {
    sentKeys.clear();
    lastDateKey = todayKey;
  }

  try {
    const shiftsRes = await pool
      .request()
      .query(
        `SELECT Id, ShiftName, StartTime, EndTime FROM ShiftConfigs WHERE Status = 1`,
      );

    for (const shift of shiftsRes.recordset) {
      const endMins = toMins(shift.EndTime);
      if (endMins === null || endMins !== curMins) continue;

      const startMins = toMins(shift.StartTime);
      const isOvernight = startMins !== null && endMins <= startMins;
      // PartProcessEvents.EventDate is the PRODUCTION DAY the shift started on.
      // An overnight shift (e.g. 20:00 D → 08:00 D+1) ends after the calendar
      // date has already rolled over, so its data is filed under yesterday.
      const dateStr = isOvernight ? offsetDateKey(-1) : todayKey;

      const dedupKey = `${dateStr}_${shift.Id}`;
      if (sentKeys.has(dedupKey)) continue;
      sentKeys.add(dedupKey);

      try {
        const report = await buildShiftReport(
          pool,
          { id: shift.Id, shiftName: shift.ShiftName },
          dateStr,
        );
        if (!report) {
          console.log(
            `[ShiftReport] No production data for ${shift.ShiftName} on ${dateStr} — skipping.`,
          );
          continue;
        }

        // Smart alerts — never let a failure here block the existing report email.
        try {
          const breaches = await evaluateShiftAlerts(pool, report);
          if (breaches.length) {
            const result = await sendShiftAlerts(
              pool,
              { shiftName: shift.ShiftName },
              dateStr,
              breaches,
            );
            console.log(
              `[SmartAlert] ${shift.ShiftName} (${dateStr}): ${breaches.length} breach(es), sent=${result.sent}, reason=${result.reason || "n/a"}`,
            );
          }
        } catch (err) {
          console.error(
            `[SmartAlert] Failed for ${shift.ShiftName} (${dateStr}):`,
            err.message,
          );
        }
        const recipients = await getRecipientsByTasks(Object.keys(SHIFT_REPORT_TASKS), pool);
        const subscribers = recipients.map((r) => ({
          email: r.email,
          reports: r.tasks.map((t) => SHIFT_REPORT_TASKS[t]),
        }));

        if (!subscribers.length) {
          console.log(
            `[ShiftReport] No subscribers for ${shift.ShiftName} (${dateStr}) — report not sent.`,
          );
          continue;
        }

        // Build each subscribed report's Excel workbook once (shared across subscribers),
        // then attach only what each individual subscriber asked for.
        const unionReports = [
          ...new Set(subscribers.flatMap((s) => s.reports)),
        ];
        const attachmentsByReport = await buildReportAttachments(
          pool,
          { id: shift.Id, shiftName: shift.ShiftName },
          dateStr,
          unionReports,
        );

        let sentCount = 0;
        for (const sub of subscribers) {
          const attachments = sub.reports
            .map((r) => attachmentsByReport[r])
            .filter(Boolean);
          await sendShiftEndReportMail({
            to: sub.email,
            ...report,
            attachments,
            attachedReportNames: sub.reports,
          });
          sentCount++;
        }
        console.log(
          `[ShiftReport] Sent ${shift.ShiftName} (${dateStr}) report to ${sentCount} recipient(s).`,
        );
      } catch (err) {
        console.error(
          `[ShiftReport] Failed for ${shift.ShiftName} (${dateStr}):`,
          err.message,
        );
      }
    }
  } catch (err) {
    console.error("[ShiftReport] checkShiftEnds error:", err.message);
  }
};

export const startShiftEndReportCron = () => {
  cron.schedule("* * * * *", checkShiftEnds);
  console.log(
    "[ShiftReport] Shift-end report cron started — checking every minute.",
  );
};
