// Self-check for the audit module's security rules. Run: node scripts/check-audit-security.js
// No DB needed — every rule checked here rejects the request before any query.
import assert from "node:assert/strict";
import { saveImageFromBase64, deleteImage, imageExists } from "../utils/storage/image-storage.js";
import { extractImageFilenames, processAuditImages, cleanupUnreferencedAuditImages } from "../utils/audit-image-processor.js";
import { actorOf } from "../utils/request-actor.js";
import {
  createAudit, updateAudit, approveAudit, rejectAudit,
  assertCompleteForSubmit, assertCanEditAudit, assertCanDeleteAudit, assertTemplateCheckpointsPresent,
} from "../controllers/audit-report/audit.controller.js";
import {
  createTemplate, createTemplateVersion, updateTemplate, deleteTemplate, duplicateTemplate,
} from "../controllers/audit-report/template.controller.js";

const PNG_1PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

// Runs a tryCatch-wrapped handler and resolves with the error it passed to next().
const errorOf = (handler, req) =>
  new Promise((resolve) => {
    const res = { status: () => res, json: () => resolve(null) };
    handler({ params: {}, query: {}, body: {}, ...req }, res, resolve);
  });

const user = (roleName) => ({ name: "Tester", usercode: "1", roleName });

// ── Images: extension comes from the real type, content must match it ──
const saved = await saveImageFromBase64({ base64Data: PNG_1PX, fileName: "evil.html", auditCode: "CHK" });
assert.match(saved.fileName, /\.png$/, "client file name must not set the extension");
assert.equal(await deleteImage(saved.fileName), true);
assert.equal(imageExists(saved.fileName), false);

await assert.rejects(
  saveImageFromBase64({ base64Data: "data:image/png;base64," + Buffer.from("<html>").toString("base64"), fileName: "x.png" }),
  /not a valid image\/png/,
);

// ── Deletes never leave the audit image folder, and remarks aren't files ──
assert.equal(await deleteImage("../BISSignatures/a.png"), false);
assert.equal(await deleteImage("..\\..\\server.png"), false);
assert.deepEqual(extractImageFilenames([{ checkPoints: [{ remarks: "see drawing rev2.png" }] }]), []);

// ── A photo that fails to save is reported, not silently dropped ──
const bad = await processAuditImages(
  [{ stages: [{ checkPoints: [{ id: "c1", checkPoint: "Door gap", photo: { data: "data:image/png;base64,AAAA", name: "p.png" } }] }] }],
  "CHK",
);
assert.equal(bad.sections[0].stages[0].checkPoints[0].photo, null);
assert.equal(bad.failedImages.length, 1);
assert.equal(bad.failedImages[0].checkPoint, "Door gap");

// ── Submit requires every checkpoint answered and required info filled ──
const done = [{ stages: [{ checkPoints: [{ checkPoint: "A", status: "pass" }, { checkPoint: "B", status: "NA" }] }] }];
const fields = [{ id: "serialNo", name: "Serial No", required: true }, { id: "notes", name: "Notes" }];
assert.doesNotThrow(() => assertCompleteForSubmit(done, fields, { serialNo: "S123" }));
assert.throws(
  () => assertCompleteForSubmit([{ stages: [{ checkPoints: [{ checkPoint: "Door gap" }] }] }], fields, { serialNo: "S1" }),
  /1 checkpoint\(s\) still pending: "Door gap"/,
);
assert.throws(() => assertCompleteForSubmit(done, fields, { serialNo: "  " }), /required field\(s\) empty: Serial No/);
assert.throws(() => assertCompleteForSubmit([{ checkPoints: [{ checkPoint: "Old flat", status: "pending" }] }], [], {}), /Old flat/);

// ── "Who did it" is the session user's name, never a body-supplied one ──
assert.equal(actorOf({ user: { name: " Bhadresh ", usercode: 124031 }, body: { createdByUser: "Spoof" } }), "Bhadresh");
assert.equal(actorOf({ user: { usercode: 124031 } }), "124031");
assert.equal(actorOf({ body: { createdByUser: "Spoof" } }), "SYSTEM");

// ── Only the creator / Quality Auditor / Super Admin edit; delete is tighter ──
const asUser = (roleName, extra = {}) => ({ user: { name: "Bhadresh", usercode: "124031", id: "WRLZ0042", roleName, ...extra } });
const draft = (createdBy) => ({ CreatedBy: createdBy, Status: "draft" });
assert.doesNotThrow(() => assertCanEditAudit(asUser("line quality engineer"), draft("bhadresh ")));   // name, any case/space
assert.doesNotThrow(() => assertCanEditAudit(asUser("line quality engineer"), draft("124031")));      // legacy usercode
assert.doesNotThrow(() => assertCanEditAudit(asUser("quality auditor"), draft("someone else")));
assert.doesNotThrow(() => assertCanEditAudit(asUser("super admin"), draft("SYSTEM")));
assert.throws(() => assertCanEditAudit(asUser("line quality engineer"), draft("someone else")), /only edit audits you created/);
assert.throws(() => assertCanEditAudit(asUser("line quality engineer"), draft("SYSTEM")), /only edit/);
assert.doesNotThrow(() => assertCanDeleteAudit(asUser("line quality engineer"), draft("Bhadresh")));
assert.throws(() => assertCanDeleteAudit(asUser("line quality engineer"), { CreatedBy: "Bhadresh", Status: "submitted" }), /creator/);
assert.throws(() => assertCanDeleteAudit(asUser("quality auditor"), draft("someone else")), /creator/);
assert.doesNotThrow(() => assertCanDeleteAudit(asUser("super admin"), { CreatedBy: "x", Status: "submitted" }));

// ── Audit status can't be set to approved by create/update ──
assert.equal((await errorOf(createAudit, { user: user("quality auditor"), body: { templateId: 1, reportName: "r", status: "approved" } }))?.statusCode, 400);
assert.equal((await errorOf(updateAudit, { user: user("quality auditor"), params: { id: "1" }, body: { status: "approved" } }))?.statusCode, 400);

// ── Only approver roles can approve/reject audits ──
assert.equal((await errorOf(approveAudit, { user: user("quality auditor"), params: { id: "1" } }))?.statusCode, 403);
assert.equal((await errorOf(rejectAudit, { user: user("quality auditor"), params: { id: "1" }, body: { comments: "x" } }))?.statusCode, 403);

// ── Templates can't be created/versioned as approved, nor set to unknown statuses ──
assert.equal((await errorOf(createTemplate, { user: user("quality manager"), body: { name: "t", approvalStatus: "approved" } }))?.statusCode, 400);
assert.equal((await errorOf(createTemplateVersion, { user: user("quality manager"), params: { id: "1" }, body: { approvalStatus: "approved" } }))?.statusCode, 400);
assert.equal((await errorOf(updateTemplate, { user: user("quality manager"), params: { id: "1" }, body: { approvalStatus: "whatever" } }))?.statusCode, 400);

// ── Only template authors (SA / QM / LQE) may change templates at all ──
for (const [h, req] of [
  [createTemplate, { body: { name: "t" } }],
  [createTemplateVersion, { params: { id: "1" }, body: {} }],
  [updateTemplate, { params: { id: "1" }, body: { isActive: false } }],
  [deleteTemplate, { params: { id: "1" } }],
  [duplicateTemplate, { params: { id: "1" }, body: { newName: "x" } }],
]) {
  assert.equal((await errorOf(h, { user: user("quality operator"), ...req }))?.statusCode, 403, h.name);
}

// ── Submitted audits must still hold every template checkpoint ──
const tplSections = [{ stages: [{ checkPoints: [{ id: "t1", checkPoint: "Door gap" }, { id: "t2", checkPoint: "Label" }] }] }];
assert.doesNotThrow(() => assertTemplateCheckpointsPresent(
  [{ stages: [{ checkPoints: [{ id: "t1" }, { id: "t2" }, { id: "c9", custom: true }] }] }], tplSections));
assert.throws(() => assertTemplateCheckpointsPresent([{ stages: [{ checkPoints: [{ id: "t1" }] }] }], tplSections),
  /missing 1 checkpoint\(s\) from the template: "Label"/);
assert.doesNotThrow(() => assertTemplateCheckpointsPresent([], null)); // no template content → no check

// ── Submit-time cleanup: drops only this audit's unused photos ──
const other = await saveImageFromBase64({ base64Data: PNG_1PX, fileName: "p.png", auditCode: "OTHERCHK" });
const kept = await saveImageFromBase64({ base64Data: PNG_1PX, fileName: "p.png", auditCode: "SELFCHK" });
const dupe = await saveImageFromBase64({ base64Data: PNG_1PX, fileName: "p.png", auditCode: "SELFCHK" });
await cleanupUnreferencedAuditImages([{ stages: [{ checkPoints: [{ photo: kept.fileName, x: other.fileName }] }] }], "SELFCHK");
assert.equal(imageExists(kept.fileName), true, "photo the audit uses stays");
assert.equal(imageExists(dupe.fileName), false, "re-uploaded duplicate the audit no longer uses is removed");
assert.equal(imageExists(other.fileName), true, "another audit's photo is never touched");
await deleteImage(kept.fileName);
await deleteImage(other.fileName);

console.log("audit security checks passed");
