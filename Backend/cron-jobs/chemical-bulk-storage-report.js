/**
 * Chemical Bulk Storage report — sends the daily ISO/POLY tank reading
 * summary (ported from the standalone Python script that used to run this
 * externally) to every active recipient ticked for Chemical Bulk Storage in Mail Management, once
 * per day at 09:15 (shortly after the 9 AM reading window closes).
 */
import cron from "node-cron";
import {
  buildChemBulkStorageReport,
  buildChemBulkStorageExcel,
} from "../services/chemical-bulk-storage-report.service.js";
import { sendChemBulkStorageReportMail } from "../emailTemplates/chemical-storage-system/chemBulkStorageReport.template.js";
import { getRecipientEmails } from "../services/mail-recipients.service.js";

const sendDailyReport = async () => {
  const pool = global.pool1;
  if (!pool) return;

  try {
    const emails = await getRecipientEmails("chemical_bulk_storage");
    if (!emails.length) {
      console.log(
        "[ChemBulkStorageReport] No active recipients configured — skipping.",
      );
      return;
    }

    const report = await buildChemBulkStorageReport(pool);
    const attachment = await buildChemBulkStorageExcel(report);
    await sendChemBulkStorageReportMail({ to: emails, ...report, attachment });
    console.log(
      `[ChemBulkStorageReport] Sent to ${emails.length} recipient(s).`,
    );
  } catch (err) {
    console.error("[ChemBulkStorageReport] Failed:", err.message);
  }
};

export const startChemBulkStorageReportCron = () => {
  cron.schedule("15 9 * * *", sendDailyReport);
  console.log("[ChemBulkStorageReport] Cron started — daily at 09:15.");
};
