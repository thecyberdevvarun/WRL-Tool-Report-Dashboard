// Self-check for the Audit MIS maths. Run: node scripts/check-audit-mis.js  (no DB)
import assert from "node:assert/strict";
import { buildAuditMis, auditCheckpoints, shiftDay, weekOf } from "../utils/audit-mis.js";

const sec = (statuses, extra = {}) => [{
  sectionName: "Final", ...extra,
  stages: [{ stageName: "Loading", checkPoints: statuses.map((s, i) => ({ checkPoint: `CP${i + 1}`, status: s })) }],
}];
const photos = [{ sectionName: "Image Capture", sectionType: "imageCapture", stages: [{ checkPoints: [{ checkPoint: "Front", status: "pending" }] }] }];

// Photo items never count; "*" prefix and spacing are normalised.
assert.equal(auditCheckpoints([...sec(["pass"]), ...photos]).length, 1);
assert.equal(auditCheckpoints([{ sectionName: "S", checkPoints: [{ checkPoint: "*Gap  check", status: "fail" }] }])[0].checkpoint, "Gap check");

// Shift day: before 08:00 belongs to the previous day; weeks start Monday.
assert.equal(shiftDay("2026-06-02T07:59:00Z"), "2026-06-01");
assert.equal(shiftDay("2026-06-02T08:00:00Z"), "2026-06-02");
assert.equal(weekOf("2026-06-07"), "2026-06-01"); // Sunday → Monday

const at = (h) => `2026-06-01T${String(h).padStart(2, "0")}:00:00Z`;
const out = buildAuditMis({
  production: [
    { d: "2026-06-01", model: "A", n: 500 },
    { d: "2026-06-02", model: "A", n: 300 },
    { d: "2026-06-01", model: "B", n: 200 },
  ],
  audits: [
    // A day 1: two audits — one all pass (10 min), one with an NA (failed, 30 min)
    { id: 1, model: "A", status: "approved", startedAt: at(9), submittedAt: "2026-06-01T09:10:00Z", sections: sec(["pass", "pass"]) },
    { id: 2, model: "A", status: "submitted", startedAt: at(10), submittedAt: "2026-06-01T10:30:00Z", sections: sec(["pass", "na"]) },
    // B: all checkpoints pass but sent for rework → failed
    { id: 3, model: "B", status: "rework", startedAt: at(11), submittedAt: "2026-06-01T11:20:00Z", sections: sec(["pass", "pass"]) },
    // draft: not completed
    { id: 4, model: "A", status: "draft", createdAt: at(12), sections: sec(["fail"]) },
  ],
}, { startDate: "2026-06-01", endDate: "2026-06-02" });

const A = out.models.find((m) => m.model === "A");
assert.equal(A.production, 800);
assert.equal(A.required, 2);          // 2 production days
assert.equal(A.completed, 2);
assert.equal(A.covered, 1);           // both audits on day 1
assert.equal(A.pending, 1);
assert.equal(A.completionPct, 50);
assert.equal(A.unauditedUnits, 300);  // day 2 had no audit
assert.equal(A.failed, 1);            // NA counts as not-pass
assert.equal(A.failurePct, 50);
assert.equal(A.inProgress, 1);
assert.equal(A.avgMinutes, 20);
assert.equal(A.minMinutes, 10);
assert.equal(A.maxMinutes, 30);

const B = out.models.find((m) => m.model === "B");
assert.equal(B.failed, 1);            // rework = failed even with all passes

assert.equal(out.kpis.required, 3);
assert.equal(out.kpis.covered, 2);
assert.equal(out.kpis.completed, 3);
assert.equal(out.kpis.failed, 2);
assert.equal(out.kpis.checkpointFailPct, Math.round((1 * 1000) / 6) / 10); // 1 not-pass of 6

// Checkpoint and model × checkpoint analysis
assert.equal(out.checkpoints[0].checkpoint, "CP2");
assert.equal(out.checkpoints[0].failures, 1);
assert.equal(out.checkpoints[0].na, 1);
assert.deepEqual(out.modelCheckpoints.map((r) => [r.model, r.checkpoint, r.failures]), [["A", "CP2", 1]]);

// Top failure models: ranked by failed audits
assert.deepEqual(out.topFailureModels.map((m) => m.model).sort(), ["A", "B"]);

// Trends
assert.equal(out.trends.daily.find((t) => t.period === "2026-06-01").completed, 3);
assert.equal(out.trends.monthly[0].completionPct, Math.round((2 * 1000) / 3) / 10);

// Model filter
const onlyB = buildAuditMis({ production: [{ d: "2026-06-01", model: "A", n: 5 }, { d: "2026-06-01", model: "B", n: 5 }], audits: [] },
  { startDate: "2026-06-01", endDate: "2026-06-01", model: "B" });
assert.equal(onlyB.kpis.production, 5);
assert.deepEqual(onlyB.modelOptions, ["A", "B"]);

console.log("audit MIS checks passed");
