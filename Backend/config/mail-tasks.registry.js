// Every automatic email sent to a LIST of people. Synced into MailTasks at server start.
// To add a new mail in future: add ONE entry here, then call getRecipientEmails("<key>")
// in the new cron/service.
export const MAIL_TASKS = [
  {
    key: "shift_production_report",
    name: "Shift Report – Production",
    description:
      "Mail sent at the end of every shift, with the Production Report Excel attached.",
  },
  {
    key: "shift_downtime_report",
    name: "Shift Report – Downtime",
    description:
      "Mail sent at the end of every shift, with the Downtime Report Excel attached.",
  },
  {
    key: "smart_alerts",
    name: "Smart Alerts (KPI breach)",
    description:
      "Alert mail when a shift breaches an OEE / downtime / reject-rate threshold.",
  },
  {
    key: "chemical_bulk_storage",
    name: "Chemical Bulk Storage Daily Report",
    description: "Daily ISO/POLY tank consumption report, sent at 09:15.",
  },
];
