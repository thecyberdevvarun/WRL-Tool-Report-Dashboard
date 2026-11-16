// Audit MIS — pure maths (no DB). Model-wise audit coverage against FG
// production, audit / checkpoint failures, audit time and trends. Used by
// GET /audit-report/mis and by the written Audit MIS report.

// ── Rules agreed with the Quality team (change here, nowhere else) ──
// Required:  1 audit per model per production day.
// Completed: the audit was submitted (submitted, approved, rejected, rework).
// Failed:    any checkpoint result other than "pass" (fail, warning, NA,
//            pending), or the audit was rejected / sent for rework.
//            Image Capture items are photos, not checks, so they are ignored.
export const AUDITS_REQUIRED_PER_MODEL_DAY = 1;
export const COMPLETED_STATUSES = ["submitted", "approved", "rejected", "rework"];
export const FAILED_AUDIT_STATUSES = ["rejected", "rework"];
export const isCheckpointPass = (status) => String(status || "").trim().toLowerCase() === "pass";

const pct = (a, b) => (b > 0 ? Math.round((a * 1000) / b) / 10 : null);
const r1 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10) / 10);
const dayKey = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));

// Shift day (08:00 → 08:00) of a DB timestamp (wall-clock stored as UTC fields).
export const shiftDay = (ts) => {
  if (!ts) return null;
  const d = new Date(ts);
  d.setUTCHours(d.getUTCHours() - 8);
  return d.toISOString().slice(0, 10);
};
// Monday of the ISO week, and YYYY-MM.
export const weekOf = (day) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};
export const monthOf = (day) => day.slice(0, 7);

/** Every checkpoint of an audit that counts for failure analysis. */
export const auditCheckpoints = (sections) => {
  const out = [];
  for (const section of Array.isArray(sections) ? sections : []) {
    if (section?.sectionType === "imageCapture") continue;
    const stages = Array.isArray(section?.stages) ? section.stages : [{ stageName: "", checkPoints: section?.checkPoints }];
    for (const stage of stages) {
      for (const cp of stage?.checkPoints || []) {
        if (!cp) continue;
        const name = String(cp.checkPoint || "").replace(/^\*/, "").replace(/\s+/g, " ").trim() || "(unnamed)";
        const sectionName = String(section.sectionName || "").trim();
        const stageName = String(stage.stageName || "").trim();
        out.push({
          key: [sectionName, stageName, name].join(" › ").toLowerCase(),
          section: sectionName, stage: stageName, checkpoint: name,
          status: String(cp.status || "pending").trim().toLowerCase(),
          pass: isCheckpointPass(cp.status),
        });
      }
    }
  }
  return out;
};

/**
 * @param raw.production [{ d, model, n }]   FG units per shift-day per model
 * @param raw.audits     [{ id, code, model, status, template, createdBy, createdAt, startedAt, submittedAt, approvedAt, sections }]
 */
export const buildAuditMis = (raw, { startDate, endDate, model: onlyModel = "" } = {}) => {
  const keep = (m) => !onlyModel || m === onlyModel;
  const production = raw.production.filter((r) => keep(r.model)).map((r) => ({ ...r, d: dayKey(r.d) }));

  // ── audits: classify once ──
  const audits = raw.audits
    .map((a) => {
      const cps = auditCheckpoints(a.sections);
      const failedCps = cps.filter((c) => !c.pass);
      const completed = COMPLETED_STATUSES.includes(a.status);
      const minutes = a.startedAt && a.submittedAt ? (new Date(a.submittedAt) - new Date(a.startedAt)) / 60000 : null;
      return {
        id: a.id, code: a.code, model: a.model || "(no model)", status: a.status, template: a.template,
        auditor: a.createdBy,
        day: shiftDay(a.submittedAt || a.createdAt),
        completed,
        failed: completed && (failedCps.length > 0 || FAILED_AUDIT_STATUSES.includes(a.status)),
        checkpoints: cps.length,
        failedCheckpoints: failedCps.length,
        failedNames: failedCps.map((c) => c.checkpoint),
        cps,
        // negative or > 24 h = clock / reopened-draft artefact, not audit effort
        minutes: minutes != null && minutes >= 0 && minutes <= 24 * 60 ? minutes : null,
        approvalHours: a.submittedAt && a.approvedAt && ["approved", "rejected", "rework"].includes(a.status)
          ? (new Date(a.approvedAt) - new Date(a.submittedAt)) / 36e5 : null,
        startedAt: a.startedAt, submittedAt: a.submittedAt, approvedAt: a.approvedAt, createdAt: a.createdAt,
      };
    })
    .filter((a) => keep(a.model));
  const done = audits.filter((a) => a.completed);

  // ── model-day grid: required vs completed ──
  const grid = new Map();
  const cell = (d, m) => {
    const k = `${d}|${m}`;
    if (!grid.has(k)) grid.set(k, { d, model: m, units: 0, completed: 0, failed: 0 });
    return grid.get(k);
  };
  for (const p of production) cell(p.d, p.model).units += p.n;
  for (const a of done) {
    const c = cell(a.day, a.model);
    c.completed += 1;
    if (a.failed) c.failed += 1;
  }
  const cells = [...grid.values()].map((c) => {
    const required = c.units > 0 ? AUDITS_REQUIRED_PER_MODEL_DAY : 0;
    const covered = Math.min(c.completed, required);
    return { ...c, required, covered, pending: required - covered, unauditedUnits: required && !covered ? c.units : 0 };
  });

  const timeStats = (list) => {
    const m = list.map((a) => a.minutes).filter((v) => v != null);
    return m.length
      ? { timedAudits: m.length, avgMinutes: r1(m.reduce((s, v) => s + v, 0) / m.length), minMinutes: r1(Math.min(...m)), maxMinutes: r1(Math.max(...m)) }
      : { timedAudits: 0, avgMinutes: null, minMinutes: null, maxMinutes: null };
  };

  // ── 1, 2, 5, 7, 8: model-wise ──
  const models = new Map();
  const mrow = (m) => {
    if (!models.has(m)) models.set(m, { model: m, cells: [], audits: [] });
    return models.get(m);
  };
  for (const c of cells) mrow(c.model).cells.push(c);
  for (const a of audits) mrow(a.model).audits.push(a);
  const modelRows = [...models.values()].map(({ model, cells: cs, audits: as }) => {
    const completed = as.filter((a) => a.completed);
    const failed = completed.filter((a) => a.failed);
    const units = cs.reduce((s, c) => s + c.units, 0);
    const required = cs.reduce((s, c) => s + c.required, 0);
    const covered = cs.reduce((s, c) => s + c.covered, 0);
    const checkpoints = completed.reduce((s, a) => s + a.checkpoints, 0);
    const failedCheckpoints = completed.reduce((s, a) => s + a.failedCheckpoints, 0);
    const cpCount = {};
    for (const a of completed) for (const n of a.failedNames) cpCount[n] = (cpCount[n] || 0) + 1;
    const top = Object.entries(cpCount).sort((x, y) => y[1] - x[1])[0];
    return {
      model,
      production: units,
      productionDays: cs.filter((c) => c.units > 0).length,
      required,
      completed: completed.length,
      covered,
      pending: required - covered,
      completionPct: pct(covered, required),
      unauditedUnits: cs.reduce((s, c) => s + c.unauditedUnits, 0),
      inProgress: as.filter((a) => a.status === "draft").length,
      passed: completed.length - failed.length,
      failed: failed.length,
      failurePct: pct(failed.length, completed.length),
      passPct: pct(completed.length - failed.length, completed.length),
      rejected: completed.filter((a) => a.status === "rejected").length,
      rework: completed.filter((a) => a.status === "rework").length,
      checkpoints,
      failedCheckpoints,
      checkpointFailPct: pct(failedCheckpoints, checkpoints),
      topFailingCheckpoint: top ? `${top[0]} (${top[1]})` : null,
      lastAudit: completed.map((a) => a.day).sort().pop() || null,
      ...timeStats(completed),
    };
  });
  modelRows.sort((a, b) => b.production - a.production || b.completed - a.completed);

  // ── 3: checkpoint-wise (across all completed audits) ──
  const cpMap = new Map();
  const mcMap = new Map();
  for (const a of done) {
    for (const c of a.cps) {
      const row = cpMap.get(c.key) || { section: c.section, stage: c.stage, checkpoint: c.checkpoint, evaluated: 0, failures: 0, fail: 0, warning: 0, na: 0, pending: 0, other: 0, models: new Set(), audits: new Set() };
      row.evaluated += 1;
      if (!c.pass) {
        row.failures += 1;
        row[["fail", "warning", "na", "pending"].includes(c.status) ? c.status : "other"] += 1;
        row.models.add(a.model);
        row.audits.add(a.id);
      }
      cpMap.set(c.key, row);
      // ── 4: model × checkpoint ──
      const mk = `${a.model}|${c.key}`;
      const mc = mcMap.get(mk) || { model: a.model, section: c.section, stage: c.stage, checkpoint: c.checkpoint, evaluated: 0, failures: 0 };
      mc.evaluated += 1;
      if (!c.pass) mc.failures += 1;
      mcMap.set(mk, mc);
    }
  }
  const totalCpFailures = [...cpMap.values()].reduce((s, r) => s + r.failures, 0);
  let cum = 0;
  const checkpoints = [...cpMap.values()]
    .map(({ models: ms, audits: as, ...r }) => ({ ...r, failurePct: pct(r.failures, r.evaluated), modelsAffected: ms.size, auditsAffected: as.size }))
    .sort((a, b) => b.failures - a.failures || b.failurePct - a.failurePct)
    .map((r) => {
      cum += r.failures;
      return { ...r, shareOfFailures: pct(r.failures, totalCpFailures), cumulativeShare: pct(cum, totalCpFailures) };
    });
  const modelCheckpoints = [...mcMap.values()]
    .filter((r) => r.failures > 0)
    .map((r) => ({ ...r, failurePct: pct(r.failures, r.evaluated) }))
    .sort((a, b) => b.failures - a.failures || b.failurePct - a.failurePct);

  // ── 6: trends ──
  const trend = (keyFn) => {
    const m = new Map();
    const row = (k) => {
      if (!m.has(k)) m.set(k, { period: k, required: 0, covered: 0, completed: 0, failed: 0, passed: 0, checkpoints: 0, failedCheckpoints: 0, minutes: [] });
      return m.get(k);
    };
    for (const c of cells) {
      const r = row(keyFn(c.d));
      r.required += c.required;
      r.covered += c.covered;
    }
    for (const a of done) {
      const r = row(keyFn(a.day));
      r.completed += 1;
      if (a.failed) r.failed += 1; else r.passed += 1;
      r.checkpoints += a.checkpoints;
      r.failedCheckpoints += a.failedCheckpoints;
      if (a.minutes != null) r.minutes.push(a.minutes);
    }
    return [...m.values()]
      .map(({ minutes, ...r }) => ({
        ...r,
        pending: r.required - r.covered,
        completionPct: pct(r.covered, r.required),
        passPct: pct(r.passed, r.completed),
        failurePct: pct(r.failed, r.completed),
        checkpointFailPct: pct(r.failedCheckpoints, r.checkpoints),
        avgMinutes: minutes.length ? r1(minutes.reduce((s, v) => s + v, 0) / minutes.length) : null,
      }))
      .sort((a, b) => a.period.localeCompare(b.period));
  };

  // ── KPIs ──
  const failed = done.filter((a) => a.failed);
  const required = cells.reduce((s, c) => s + c.required, 0);
  const covered = cells.reduce((s, c) => s + c.covered, 0);
  const totalUnits = cells.reduce((s, c) => s + c.units, 0);
  const unauditedUnits = cells.reduce((s, c) => s + c.unauditedUnits, 0);
  const cpTotal = done.reduce((s, a) => s + a.checkpoints, 0);
  const approvals = done.map((a) => a.approvalHours).filter((h) => h != null && h >= 0);
  const kpis = {
    production: totalUnits,
    modelsProduced: modelRows.filter((m) => m.production > 0).length,
    modelsAudited: modelRows.filter((m) => m.completed > 0).length,
    required,
    completed: done.length,
    covered,
    pending: required - covered,
    completionPct: pct(covered, required),
    unauditedUnits,
    unauditedPct: pct(unauditedUnits, totalUnits),
    inProgress: audits.filter((a) => a.status === "draft").length,
    awaitingApproval: audits.filter((a) => a.status === "submitted").length,
    passed: done.length - failed.length,
    failed: failed.length,
    passPct: pct(done.length - failed.length, done.length),
    failurePct: pct(failed.length, done.length),
    checkpoints: cpTotal,
    failedCheckpoints: totalCpFailures,
    checkpointFailPct: pct(totalCpFailures, cpTotal),
    avgApprovalHours: approvals.length ? r1(approvals.reduce((s, h) => s + h, 0) / approvals.length) : null,
    ...timeStats(done),
  };

  return {
    period: { startDate, endDate },
    model: onlyModel,
    rules: {
      required: `${AUDITS_REQUIRED_PER_MODEL_DAY} audit per model per production day (day = 08:00 to 08:00)`,
      completed: "Submitted, approved, rejected or sent for rework",
      failed: "Any checkpoint other than Pass (Fail, Warning, NA, pending), or rejected / sent for rework; photo items excluded",
      time: "Audit time = opened (StartedAt) to submitted",
    },
    kpis,
    models: modelRows,
    topFailureModels: modelRows
      .filter((m) => m.failed > 0)
      .sort((a, b) => b.failed - a.failed || b.failurePct - a.failurePct || b.failedCheckpoints - a.failedCheckpoints)
      .map((m, i) => ({ rank: i + 1, ...m })),
    checkpoints,
    modelCheckpoints,
    trends: { daily: trend((d) => d), weekly: trend(weekOf), monthly: trend(monthOf) },
    coverageGaps: modelRows
      .filter((m) => m.pending > 0)
      .sort((a, b) => b.unauditedUnits - a.unauditedUnits),
    audits: audits.map(({ cps, failedNames, ...a }) => ({ ...a, minutes: r1(a.minutes), approvalHours: r1(a.approvalHours), failedCheckpointNames: failedNames.slice(0, 10).join("; ") })),
    modelOptions: [...new Set(raw.production.map((r) => r.model).concat(raw.audits.map((a) => a.model || "(no model)")))].sort(),
  };
};
