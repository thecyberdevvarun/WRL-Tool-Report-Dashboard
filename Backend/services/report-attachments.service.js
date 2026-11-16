/**
 * Builds nodemailer-ready Excel (.xlsx) attachments for the Mail Config
 * "Report Matrix" report types, for one shift occurrence. Used by the
 * shift-end cron and the "Send Test Mail" action so subscribers get the
 * exact same workbook each report page's own "Export Excel" button produces:
 * Production Report uses its bespoke two-tier-header layout, Downtime Report
 * shares the single-sheet "sections" layout its page uses.
 */
import { buildShiftReport } from "./shift-report.service.js";
import { buildSectionsExcel } from "./report-excel.service.js";
import { buildProductionReportExcel } from "./production-excel.service.js";
import { fetchShiftRawData, buildDowntimeReportBlocks } from "./report-data.service.js";

const BLOCK_BUILDERS = {
  "Downtime Report": async (_pool, _shift, _dateStr, raw) => buildDowntimeReportBlocks(raw),
};

/**
 * @returns { [reportName]: { filename, content } } — only entries for report
 * names that actually had data are included.
 */
export const buildReportAttachments = async (pool, shift, dateStr, reportNames) => {
  const attachments = {};
  const title = (name) => `${shift.shiftName} — ${name}`;
  const subtitle = `${dateStr}  |  Generated ${new Date().toLocaleString()}`;
  const attach = (name, ext, content) => {
    attachments[name] = {
      filename: `${name.replace(/\s+/g, "_")}_${dateStr}.${ext}`,
      content,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  };

  if (reportNames.includes("Production Report")) {
    try {
      const shiftReport = await buildShiftReport(pool, shift, dateStr);
      if (shiftReport?.rows?.length) {
        const content = await buildProductionReportExcel({
          title: title("Production Report"), subtitle, rows: shiftReport.rows,
        });
        attach("Production Report", "xlsx", content);
      }
    } catch (err) {
      console.error(`[ReportAttachments] Failed building "Production Report" Excel:`, err.message);
    }
  }

  const otherNames = reportNames.filter((n) => n !== "Production Report" && BLOCK_BUILDERS[n]);
  if (otherNames.length) {
    const raw = await fetchShiftRawData(pool, shift, dateStr);
    for (const name of otherNames) {
      try {
        const blocks = await BLOCK_BUILDERS[name](pool, shift, dateStr, raw);
        if (!blocks || !blocks.length) continue;
        const content = await buildSectionsExcel({ title: title(name), subtitle, blocks });
        attach(name, "xlsx", content);
      } catch (err) {
        console.error(`[ReportAttachments] Failed building "${name}" Excel:`, err.message);
      }
    }
  }

  return attachments;
};
