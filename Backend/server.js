import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import cookieParser from "cookie-parser";
import routes from "./routes/index.js";
import {
  connectToDB,
  dbConfig1,
  dbConfig2,
  dbConfig3,
  dbConfig4,
} from "./config/db.config.js";
import { startCalibrationCron } from "./cron-jobs/calibration-escalation.js";
import { startShiftEndReportCron } from "./cron-jobs/shift-end-report.js";
import { startFactoryOsSyncCron } from "./cron-jobs/factory-os-sync.js";
import { startAutoAddNotPlannedFgCron } from "./cron-jobs/autoadd-not-planned-fg.js";
import { startChemBulkStorageReportCron } from "./cron-jobs/chemical-bulk-storage-report.js";
import { globalErrorHandler } from "./middlewares/error-handler.js";
import { runMigrations } from "./config/migrations.js";
import { runGarudaMigrations } from "./config/garuda-migrations.js";
import { rebuildSmtpTransporter } from "./config/email.config.js";
import { runMailManagementMigration } from "./config/mail-management-migration.js";
// const _dirname = path.resolve();

const app = express();

// <------------------------------------------------------------- Middlewares ------------------------------------------------------------->
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  }),
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cookieParser());
// Audit photos, template files and BOM/CRF documents are only served through the logged-in
// /api/v1/audit-report routes — never from the public static folder.
// Checked on the decoded, normalised path so "%49", "//" or "\" can't slip by.
const PRIVATE_UPLOADS = /^\/(auditimages|audittemplates|audittemplatedocs)(\/|$)/i;
app.use(
  "/uploads",
  (req, res, next) => {
    let p;
    try {
      p = path.posix.normalize(decodeURIComponent(req.path).replace(/\\/g, "/"));
    } catch {
      return res.sendStatus(400);
    }
    if (PRIVATE_UPLOADS.test(p)) return res.sendStatus(404);
    next();
  },
  express.static(path.resolve("uploads")),
); // Static files

// <------------------------------------------------------------- Connect to DB Servers ------------------------------------------------------------->
(async () => {
  try {
    global.pool1 = await connectToDB(dbConfig1);
    global.pool3 = await connectToDB(dbConfig3);
    console.log("Successfully connected to Server 1 and Server 3.");

    await runGarudaMigrations(global.pool1);
    await runMigrations(global.pool3);
    await runMailManagementMigration(global.pool3);

    // Pick up any previously-saved Settings > Mail Server override now that
    // pool3 is up — the transporter built at module-load time (email.config.js)
    // only had .env to go on, since it runs before this IIFE.
    rebuildSmtpTransporter(global.pool3).catch((err) =>
      console.error(
        "[Mail] Failed to load DB-saved SMTP override at startup:",
        err.message,
      ),
    );

    // Server 2 (WWMS) and Server 4 (CLMS/attendance) both have local backups
    // now, but are still optional here — skip gracefully instead of crashing
    // the whole app if either happens to be unreachable.
    try {
      global.pool2 = await connectToDB(dbConfig2);
      console.log("Successfully connected to Server 2.");
    } catch (error) {
      console.warn("Server 2 (WWMS) unreachable, skipping:", error.message);
    }

    try {
      global.pool4 = await connectToDB(dbConfig4);
      console.log("Successfully connected to Server 4.");
    } catch (error) {
      console.warn("Server 4 (CLMS) unreachable, skipping:", error.message);
    }
  } catch (error) {
    console.error("Database connection failed:", error);
    process.exit(1);
  }
})();

// <------------------------------------------------------------- APIs ------------------------------------------------------------->
app.use("/api/v1/", routes);

// <------------------------------------------------------------- Global Error Handler ------------------------------------------------------------->
app.use(globalErrorHandler);

// <------------------------------------------------------------- Serve Frontend from Backend ------------------------------------------------------------->
// app.use(express.static(path.join(_dirname, "Frontend", "dist")));
// Wildcard route to serve index.html ONLY if path does not start with /api
// app.get(/^\/(?!api\/).*/, (_, res) => {
//   res.sendFile(path.join(_dirname, "Frontend", "dist", "index.html"));
// });

// <------------------------------------------------------------- Start server ------------------------------------------------------------->
const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Server running on port:${PORT}`);
});

// START CRON AFTER SERVER START
// Cron jobs poll FactoryOS and email real subscribers — they must only run
// on the one deployed instance, never from a local dev/test copy pointed at
// the same live DB. Running them from two processes at once double-writes
// the sync log and, worse, double-sends shift-end report emails to every
// subscriber (each process's dedup guard is in-memory, so it can't see the
// other process's send). Gate behind an explicit opt-in so a fresh checkout
// — e.g. `npm run dev` on a laptop — defaults to OFF; only the deployed
// server's .env should set ENABLE_CRON=true.
if (process.env.ENABLE_CRON === "true") {
  startCalibrationCron();
  startShiftEndReportCron();
  startFactoryOsSyncCron();
  startAutoAddNotPlannedFgCron();
  startChemBulkStorageReportCron();
  console.log("[Cron] Enabled (ENABLE_CRON=true).");
} else {
  console.log(
    "[Cron] Disabled — set ENABLE_CRON=true in .env to enable (production server only).",
  );
}
