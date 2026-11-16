import sql from "mssql";
import { tryCatch } from "../../utils/try-catch.js";
import { AppError } from "../../utils/app-error.js";
import { buildAuditMis } from "../../utils/audit-mis.js";

// GET /audit-report/mis?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD[&model=...]
// Model-wise audit MIS: FG production (denominator) vs audits completed,
// audit / checkpoint failures, audit time and trends. A day runs 08:00→08:00.

const MAX_DAYS = 400;

const parseRange = (q) => {
  const ok = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || "")) && !Number.isNaN(new Date(s).getTime());
  if (!ok(q.startDate) || !ok(q.endDate)) throw new AppError("startDate and endDate are required (YYYY-MM-DD)", 400);
  const days = (new Date(q.endDate) - new Date(q.startDate)) / 864e5;
  if (days < 0) throw new AppError("endDate must be on or after startDate", 400);
  if (days > MAX_DAYS) throw new AppError(`Please choose at most ${MAX_DAYS} days`, 400);
  return { startDate: q.startDate, endDate: q.endDate };
};

const BOUNDS = `
  DECLARE @from datetime = DATEADD(HOUR, 8,  CAST(@startDate AS datetime));
  DECLARE @to   datetime = DATEADD(HOUR, 32, CAST(@endDate   AS datetime));`;

const safeJson = (s, d) => {
  try { return s ? JSON.parse(s) : d; } catch { return d; }
};

export const getAuditMis = tryCatch(async (req, res) => {
  const range = parseRange(req.query);
  const model = String(req.query.model || "").slice(0, 200);
  if (!global.pool1 || !global.pool3) throw new AppError("Database not connected", 503);

  const bind = (pool) => pool.request()
    .input("startDate", sql.VarChar(10), range.startDate)
    .input("endDate", sql.VarChar(10), range.endDate);

  const [production, audits] = await Promise.all([
    // FG output per shift-day per model (same filter as the Audit / FPA model summaries)
    bind(global.pool1).query(`${BOUNDS}
      SELECT CAST(DATEADD(HOUR, -8, a.ActivityOn) AS date) AS d, c.Name AS model, COUNT(*) AS n
      FROM ProcessActivity a
      JOIN MaterialBarcode b ON a.PSNo = b.DocNo
      JOIN Material c ON b.Material = c.MatCode
      WHERE a.StationCode IN (1220010, 1230017) AND a.ActivityType = 5
        AND b.Type NOT IN (0, 200) AND a.ActivityOn >= @from AND a.ActivityOn < @to
      GROUP BY CAST(DATEADD(HOUR, -8, a.ActivityOn) AS date), c.Name`),
    // Audits submitted in the period (or still open, if opened in it)
    bind(global.pool3).query(`${BOUNDS}
      SELECT Id AS id, AuditCode AS code, Status AS status, TemplateName AS template,
             COALESCE(NULLIF(LTRIM(RTRIM(JSON_VALUE(InfoData, '$.modelName'))), ''), NULLIF(LTRIM(RTRIM(TemplateName)), '')) AS model,
             Sections AS sections, CreatedBy AS createdBy, CreatedAt AS createdAt,
             StartedAt AS startedAt, SubmittedAt AS submittedAt, ApprovedAt AS approvedAt
      FROM Audits
      WHERE IsDeleted = 0
        AND COALESCE(SubmittedAt, CreatedAt) >= @from AND COALESCE(SubmittedAt, CreatedAt) < @to`),
  ]);

  const data = buildAuditMis(
    {
      production: production.recordset,
      audits: audits.recordset.map((a) => ({ ...a, sections: safeJson(a.sections, []) })),
    },
    { ...range, model },
  );
  res.status(200).json({ success: true, data });
});
