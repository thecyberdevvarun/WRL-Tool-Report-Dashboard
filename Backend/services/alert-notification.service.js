import sql from "mssql";
import { sendSmartAlertMail } from "../emailTemplates/alert-system/smartAlert.template.js";
import { getRecipientEmails } from "./mail-recipients.service.js";

const ALERT_SUBSCRIPTION_TOKEN = "Smart Alerts";

// Explicit, human-readable per-breach lines with units spelled out — passing
// raw JSON numbers to the model let it misread minutes as a percentage
// (e.g. reporting "95%" downtime when the real value was 95 minutes),
// since OEE/reject-rate breaches in the same list really are percentages.
const BREACH_DESCRIPTIONS = {
  LowOEE: (b) =>
    `Low OEE: ${b.metricValue}% (target: at least ${b.thresholdValue}%)`,
  HighDowntime: (b) =>
    `High downtime: ${b.metricValue} minutes (limit: at most ${b.thresholdValue} minutes)`,
  HighRejectRate: (b) =>
    `High reject rate: ${b.metricValue}% (limit: at most ${b.thresholdValue}%)`,
};

const describeBreach = (b) =>
  (
    BREACH_DESCRIPTIONS[b.type] ||
    ((x) => `${x.type}: ${x.metricValue} (threshold ${x.thresholdValue})`)
  )(b);

// Durable (DB-backed) dedup — filters out any breach type already logged for
// this exact shift/date, so a server restart or a re-evaluated tick never
// double-sends (unlike the shift-report cron's own in-memory Set, which
// resets on restart).
const filterUnsentBreaches = async (pool3, shiftName, dateStr, breaches) => {
  const result = await pool3
    .request()
    .input("shiftName", shiftName)
    .input("alertDate", dateStr)
    .query(
      `SELECT AlertType FROM Alerts WHERE ShiftName = @shiftName AND AlertDate = @alertDate`,
    );

  const alreadySent = new Set(result.recordset.map((r) => r.AlertType));
  return breaches.filter((b) => !alreadySent.has(b.type));
};

const getSubscriberEmails = (pool3) =>
  getRecipientEmails("smart_alerts", pool3);

const buildNarrative = (shiftName, dateStr, breaches) =>
  `${shiftName} on ${dateStr} breached ${breaches.length} KPI threshold${breaches.length > 1 ? "s" : ""}: ` +
  `${breaches.map((b) => describeBreach(b)).join("; ")}.`;

/**
 * @param pool3    mssql pool (global.pool3)
 * @param shift    { shiftName }
 * @param dateStr  "YYYY-MM-DD" production date the shift belongs to
 * @param breaches Array<{ type, metricValue, thresholdValue }> from evaluateShiftAlerts
 */
export const sendShiftAlerts = async (pool3, shift, dateStr, breaches) => {
  const unsent = await filterUnsentBreaches(
    pool3,
    shift.shiftName,
    dateStr,
    breaches,
  );
  if (!unsent.length) return { sent: false, reason: "already-sent" };

  const recipients = await getSubscriberEmails(pool3);
  const narrative = buildNarrative(shift.shiftName, dateStr, unsent);

  let emailSent = false;
  if (recipients.length) {
    emailSent = await sendSmartAlertMail({
      to: recipients,
      shiftName: shift.shiftName,
      dateStr,
      breaches: unsent,
      narrative,
    });
  } else {
    console.warn(
      `No "${ALERT_SUBSCRIPTION_TOKEN}" subscribers — logging alert without sending email.`,
    );
  }

  for (const breach of unsent) {
    await pool3
      .request()
      .input("shiftName", shift.shiftName)
      .input("alertDate", dateStr)
      .input("alertType", breach.type)
      .input("metricValue", sql.Decimal(10, 2), breach.metricValue)
      .input("thresholdValue", sql.Decimal(10, 2), breach.thresholdValue)
      .input("message", narrative)
      .input("sentTo", recipients.join(", ")).query(`
        INSERT INTO Alerts (ShiftName, AlertDate, AlertType, MetricValue, ThresholdValue, Message, SentTo)
        VALUES (@shiftName, @alertDate, @alertType, @metricValue, @thresholdValue, @message, @sentTo)
      `);
  }

  return { sent: emailSent, breaches: unsent, recipients };
};
