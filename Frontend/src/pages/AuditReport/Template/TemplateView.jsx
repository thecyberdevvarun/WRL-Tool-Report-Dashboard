import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  FaArrowLeft,
  FaEdit,
  FaCopy,
  FaTrash,
  FaCheckDouble,
  FaCheckCircle,
  FaTimesCircle,
  FaLayerGroup,
  FaClipboardList,
  FaChevronDown,
  FaChevronRight,
  FaTag,
  FaInfoCircle,
  FaColumns,
  FaPlus,
  FaBan,
  FaCheck,
} from "react-icons/fa";
import { HiClipboardDocumentCheck } from "react-icons/hi2";
import { MdOutlineFactCheck } from "react-icons/md";
import useAuditData from "../../../hooks/useAuditData";
import toast from "react-hot-toast";
import { ROLES } from "../../../config/routes.config";
import ReferenceDocs from "../components/common/ReferenceDocs";

// ── Status config ─────────────────────────────────────────────────────────────
const APPROVAL_STATUS_CFG = {
  draft: {
    label: "Draft",
    cls: "bg-gray-100 text-gray-700 border-gray-300",
    dot: "bg-gray-400",
  },
  pending_approval: {
    label: "Pending Approval",
    cls: "bg-amber-100 text-amber-700 border-amber-300",
    dot: "bg-amber-400",
  },
  approved: {
    label: "Approved",
    cls: "bg-green-100 text-green-700 border-green-300",
    dot: "bg-green-500",
  },
  rejected: {
    label: "Rejected",
    cls: "bg-red-100 text-red-700 border-red-300",
    dot: "bg-red-500",
  },
};

const CATEGORY_CFG = {
  quality: "bg-blue-100 text-blue-700 border-blue-200",
  safety: "bg-red-100 text-red-700 border-red-200",
  process: "bg-green-100 text-green-700 border-green-200",
  compliance: "bg-purple-100 text-purple-700 border-purple-200",
  other: "bg-gray-100 text-gray-700 border-gray-200",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const countCheckpoints = (sections = []) =>
  sections.reduce((t, s) => {
    if (s.stages)
      return (
        t + s.stages.reduce((st, stg) => st + (stg.checkPoints?.length || 0), 0)
      );
    return t + (s.checkPoints?.length || 0);
  }, 0);

const relTime = (d) => {
  if (!d) return "—";
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

// ── Single unified template table ─────────────────────────────────────────────
// One <table> for the entire template.
// Section headers   → <tr> spanning all cols  (bg-slate-700, never collapses)
// Stage toggle rows → <tr> spanning all cols  (bg-indigo-50,  click to collapse)
// Checkpoint rows   → normal <tr> with per-col <td>
const TemplateTable = ({ sections = [], visibleCols }) => {
  const [collapsedStages, setCollapsedStages] = useState({});
  const toggle = (key) => setCollapsedStages((p) => ({ ...p, [key]: !p[key] }));
  const colCount = visibleCols.length;

  if (!sections.length)
    return (
      <div className="py-14 text-center text-gray-300">
        <FaClipboardList className="text-4xl mx-auto mb-2" />
        <p className="text-sm text-gray-400">
          No sections defined in this template
        </p>
      </div>
    );

  const renderCell = (col, cp) => {
    if (col.id === "status")
      return (
        <td
          key={col.id}
          className="px-3 py-2 border-r border-gray-100 last:border-r-0"
        >
          <span className="inline-block w-14 h-5 rounded bg-gray-100 border border-dashed border-gray-300" />
        </td>
      );
    if (col.type === "image")
      return (
        <td
          key={col.id}
          className="px-3 py-2 border-r border-gray-100 last:border-r-0 text-center"
        >
          <span className="text-[10px] text-pink-400 font-semibold bg-pink-50 px-1.5 py-0.5 rounded border border-pink-100">
            IMG
          </span>
        </td>
      );
    return (
      <td
        key={col.id}
        className="px-3 py-2 border-r border-gray-100 last:border-r-0"
      >
        <span className="text-gray-700 text-xs leading-relaxed">
          {cp[col.id] || ""}
        </span>
      </td>
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        {/* Single thead — no more per-section repetition */}
        <thead>
          <tr className="bg-gray-50 border-b-2 border-gray-200">
            {visibleCols
              .filter((col) => col.id !== "section") /* by id — a renamed column must still be dropped */
              .map((col) => (
                <th
                  key={col.id}
                  className={`px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-gray-500 border-r border-gray-200 last:border-r-0 whitespace-nowrap bg-gray-50 ${col.width || ""}`}
                >
                  {col.name}
                </th>
              ))}
          </tr>
        </thead>

        <tbody>
          {sections.map((section, si) => {
            const hasStages =
              Array.isArray(section.stages) && section.stages.length > 0;
            const totalCPs = hasStages
              ? section.stages.reduce(
                  (t, st) => t + (st.checkPoints?.length || 0),
                  0,
                )
              : section.checkPoints?.length || 0;

            return [
              /* ── Section header row ── */
              <tr key={`sec-${section.id || si}`}>
                <td
                  colSpan={colCount}
                  className="px-4 py-2.5 bg-slate-700 border-b border-slate-600"
                >
                  <div className="flex items-center gap-2">
                    <FaLayerGroup
                      size={11}
                      className="text-slate-300 flex-shrink-0"
                    />
                    <span className="font-bold text-sm text-white">
                      {section.sectionName || `Section ${si + 1}`}
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      {hasStages ? `${section.stages.length} stages · ` : ""}
                      {totalCPs} checkpoints
                    </span>
                  </div>
                </td>
              </tr>,

              /* ── Staged checkpoints ── */
              ...(hasStages
                ? section.stages.flatMap((stage, sti) => {
                    const stageKey = `${si}-${stage.id || sti}`;
                    const cps = stage.checkPoints || [];
                    if (!cps.length) return [];
                    const isCollapsed = collapsedStages[stageKey];

                    return [
                      /* Stage toggle row */
                      <tr
                        key={`stg-hdr-${stageKey}`}
                        onClick={() => toggle(stageKey)}
                        className="cursor-pointer select-none bg-indigo-50 hover:bg-indigo-100 border-b border-indigo-100 transition-colors"
                      >
                        <td colSpan={colCount} className="px-5 py-1.5">
                          <div className="flex items-center gap-2">
                            {isCollapsed ? (
                              <FaChevronRight
                                size={9}
                                className="text-indigo-400 flex-shrink-0"
                              />
                            ) : (
                              <FaChevronDown
                                size={9}
                                className="text-indigo-400 flex-shrink-0"
                              />
                            )}
                            <span className="text-xs font-bold text-indigo-700">
                              {stage.stageName || `Stage ${sti + 1}`}
                            </span>
                            <span className="text-[10px] text-indigo-400 ml-auto">
                              {cps.length} checkpoints
                            </span>
                          </div>
                        </td>
                      </tr>,

                      /* Checkpoint rows — skipped when stage collapsed */
                      ...(isCollapsed
                        ? []
                        : cps.map((cp, ci) => (
                            <tr
                              key={`cp-${stageKey}-${cp.id || ci}`}
                              className="border-b border-gray-100 hover:bg-slate-50/60 transition-colors"
                            >
                              {visibleCols.map((col) => {
                                if (col.id === "section") return null;
                                if (col.id === "stage") {
                                  if (ci !== 0) return null;
                                  return (
                                    <td
                                      key={col.id}
                                      rowSpan={cps.length}
                                      className="px-3 py-2 text-xs font-semibold text-indigo-800 bg-indigo-50/60 border-r border-gray-200 text-center align-middle"
                                    >
                                      {stage.stageName || "—"}
                                    </td>
                                  );
                                }
                                return renderCell(col, cp);
                              })}
                            </tr>
                          ))),
                    ];
                  })
                : /* ── Flat checkpoints (no stages) ── */
                  (section.checkPoints || []).map((cp, ci) => (
                    <tr
                      key={`cp-flat-${si}-${cp.id || ci}`}
                      className="border-b border-gray-100 hover:bg-slate-50/60 transition-colors"
                    >
                      {visibleCols.map((col) => {
                        if (col.id === "section") {
                          if (ci !== 0) return null;
                          return (
                            <td
                              key={col.id}
                              rowSpan={(section.checkPoints || []).length}
                              className="px-3 py-2 text-xs font-semibold text-gray-700 bg-gray-50 border-r border-gray-200 text-center align-middle"
                            >
                              {section.sectionName || "—"}
                            </td>
                          );
                        }
                        if (col.id === "stage") return null;
                        return renderCell(col, cp);
                      })}
                    </tr>
                  ))),
            ];
          })}
        </tbody>
      </table>
    </div>
  );
};

const InfoRow = ({ label, value, mono }) => (
  <div className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
    <span className="text-xs text-gray-400 font-semibold w-32 flex-shrink-0 pt-0.5">
      {label}
    </span>
    <span
      className={`text-xs text-gray-700 font-medium ${mono ? "font-mono" : ""}`}
    >
      {value || <span className="text-gray-300">—</span>}
    </span>
  </div>
);

// ── Main Component ────────────────────────────────────────────────────────────
const TemplateView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useSelector((store) => store.auth);

  const { getTemplateById, updateTemplate, deleteTemplate, duplicateTemplate, uploadTemplateDocument, removeTemplateDocument } =
    useAuditData();

  const [template, setTemplate] = useState(null);
  const [docBusy, setDocBusy] = useState(null); // "bom" | "crf" while saving
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const canCreateEdit = [
    ROLES.SUPER_ADMIN,
    ROLES.QUALITY_MANAGER,
    ROLES.LINE_QUALITY_ENGINEER,
  ].includes(user?.roleName);
  const canApprove = [ROLES.SUPER_ADMIN, ROLES.QUALITY_MANAGER].includes(
    user?.roleName,
  );
  const isAdmin = user?.roleName === ROLES.SUPER_ADMIN;

  const createdByUser = () =>
    user?.name || String(user?.userCode ?? user?.usercode ?? "SYSTEM");

  const isOwner = () => {
    if (!template) return false;
    const cb = String(template.createdBy ?? "");
    return (
      cb === (user?.name || "") ||
      cb === String(user?.userCode ?? user?.usercode ?? "")
    );
  };

  const canEdit = canCreateEdit && template?.approvalStatus !== "approved";
  const canDelete =
    canCreateEdit &&
    template?.approvalStatus !== "approved" &&
    (isAdmin || isOwner());

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const t = await getTemplateById(id);
      setTemplate(t);
    } catch (err) {
      toast.error("Failed to load template: " + err.message);
      navigate("/auditreport/templates");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleSubmitForApproval = async () => {
    setActing("submit");
    try {
      await updateTemplate(id, {
        approvalStatus: "pending_approval",
        createdByUser: createdByUser(),
      });
      toast.success("Template submitted for approval");
      load();
    } catch (err) {
      toast.error("Submit failed: " + err.message);
    } finally {
      setActing(null);
    }
  };

  const handleDocUpload = async (kind, file) => {
    if (file.size > 20 * 1024 * 1024) {
      toast.error("File is larger than 20 MB");
      return;
    }
    setDocBusy(kind);
    try {
      const docs = await uploadTemplateDocument(id, kind, file);
      setTemplate((t) => ({ ...t, ...docs }));
      toast.success(`${kind === "bom" ? "BOM Sheet" : "CRF"} uploaded`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDocBusy(null);
    }
  };

  const handleDocRemove = async (kind) => {
    const label = kind === "bom" ? "BOM Sheet" : "CRF";
    if (!window.confirm(`Remove the ${label} from this template? Audits already started keep their copy.`)) return;
    setDocBusy(kind);
    try {
      const docs = await removeTemplateDocument(id, kind);
      setTemplate((t) => ({ ...t, ...docs }));
      toast.success(`${label} removed`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDocBusy(null);
    }
  };

  const handleApprove = async () => {
    setActing("approve");
    try {
      await updateTemplate(id, {
        approvalStatus: "approved",
        version: template.version,
        approvedBy: user?.name || createdByUser(),
        approvedAt: new Date().toISOString(),
        createdByUser: createdByUser(),
      });
      toast.success("Template approved");
      load();
    } catch (err) {
      toast.error("Approval failed: " + err.message);
    } finally {
      setActing(null);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }
    setActing("reject");
    try {
      await updateTemplate(id, {
        approvalStatus: "rejected",
        version: template.version,
        rejectionReason: rejectionReason.trim(),
        approvedBy: user?.name || createdByUser(),
        approvedAt: new Date().toISOString(),
        createdByUser: createdByUser(),
      });
      toast.success("Template rejected");
      setShowRejectModal(false);
      setRejectionReason("");
      load();
    } catch (err) {
      toast.error("Rejection failed: " + err.message);
    } finally {
      setActing(null);
    }
  };

  const handleDuplicate = async () => {
    const newName = window.prompt("Enter a name for the duplicated template:", `${template?.name || ""} (Copy)`);
    if (!newName || !newName.trim()) return;

    setActing("duplicate");
    try {
      const result = await duplicateTemplate(id, { newName: newName.trim(), createdBy: createdByUser() });
      if (result.exists) {
        const createVersion = window.confirm(
          `A template named "${newName.trim()}" already exists. Create a new version of it instead?`,
        );
        if (createVersion) {
          navigate(`/auditreport/templates/${result.existingTemplateId}`);
        }
        return;
      }
      toast.success("Template duplicated");
      navigate(`/auditreport/templates/${result.data.id}/view`);
    } catch (err) {
      toast.error("Duplicate failed: " + err.message);
    } finally {
      setActing(null);
    }
  };

  const handleDelete = async () => {
    setActing("delete");
    try {
      await deleteTemplate(id);
      toast.success("Template deleted");
      navigate("/auditreport/templates");
    } catch (err) {
      toast.error("Delete failed: " + err.message);
    } finally {
      setActing(null);
      setShowDeleteModal(false);
    }
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="h-full bg-slate-100 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-500 font-medium">Loading template…</p>
        </div>
      </div>
    );
  }

  if (!template) return null;

  const statusCfg =
    APPROVAL_STATUS_CFG[template.approvalStatus] || APPROVAL_STATUS_CFG.draft;
  const categoryCls = CATEGORY_CFG[template.category] || CATEGORY_CFG.other;
  const totalCPs = countCheckpoints(template.defaultSections);
  const totalStages = (template.defaultSections || []).reduce(
    (t, s) => t + (s.stages?.length || 0),
    0,
  );

  return (
    <div className="h-full overflow-y-auto bg-slate-100 font-sans">
      {/* ── Reject Modal ─────────────────────────────────────────────────── */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-r from-red-600 to-red-700 text-white">
              <h3 className="text-sm font-black flex items-center gap-2">
                <FaBan size={13} /> Reject Template
              </h3>
              <p className="text-red-200 text-xs mt-1">
                Provide a reason so the creator can address the issues.
              </p>
            </div>
            <div className="p-5">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Rejection Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={4}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Describe what needs to be corrected…"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:border-red-400 focus:ring-2 focus:ring-red-100 outline-none"
              />
            </div>
            <div className="px-5 py-4 bg-gray-50 border-t flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason("");
                }}
                className="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={acting === "reject"}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center gap-2 transition-all"
              >
                {acting === "reject" ? (
                  <>
                    <Spinner /> Rejecting…
                  </>
                ) : (
                  <>
                    <FaBan size={11} /> Reject
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Modal ─────────────────────────────────────────────────── */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-r from-red-600 to-red-700 text-white">
              <h3 className="text-sm font-black flex items-center gap-2">
                <FaTrash size={11} /> Delete Template
              </h3>
              <p className="text-red-200 text-xs mt-1">
                This action cannot be undone.
              </p>
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-600 mb-3">
                You are about to permanently delete:
              </p>
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                <p className="font-bold text-gray-800">{template.name}</p>
                {template.category && (
                  <p className="text-xs text-gray-400 mt-1 capitalize">
                    {template.category} audit
                  </p>
                )}
              </div>
            </div>
            <div className="px-5 py-4 bg-gray-50 border-t flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={acting === "delete"}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center gap-2 transition-all"
              >
                {acting === "delete" ? (
                  <>
                    <Spinner /> Deleting…
                  </>
                ) : (
                  <>
                    <FaTrash size={11} /> Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sticky Header ────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          {/* Left: back + title */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate("/auditreport/templates")}
              className="p-2 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all flex-shrink-0"
              title="Back to Templates"
            >
              <FaArrowLeft size={13} className="text-gray-600" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <HiClipboardDocumentCheck
                  className="text-indigo-500 flex-shrink-0"
                  size={16}
                />
                <h1 className="text-base font-black text-gray-800 truncate">
                  {template.name}
                </h1>
                <span
                  className={`flex-shrink-0 inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusCfg.cls}`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`}
                  />
                  {statusCfg.label}
                </span>
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {template.templateCode} · v{template.version || "1.0"} ·
                Read-only view
              </p>
            </div>
          </div>

          {/* Right: action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Use Template — always visible (approved only for non-admin) */}
            {(template.approvalStatus === "approved" || isAdmin) && (
              <button
                onClick={() =>
                  navigate(`/auditreport/audits/new?template=${template.id}`)
                }
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-indigo-200"
              >
                <FaPlus size={11} /> Use Template
              </button>
            )}

            {/* Submit for Approval — draft only, owner or admin */}
            {template.approvalStatus === "draft" &&
              canCreateEdit &&
              (isAdmin || isOwner()) && (
                <button
                  onClick={handleSubmitForApproval}
                  disabled={!!acting}
                  className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-all"
                >
                  {acting === "submit" ? (
                    <>
                      <Spinner /> Submitting…
                    </>
                  ) : (
                    <>
                      <FaCheckDouble size={11} /> Submit for Approval
                    </>
                  )}
                </button>
              )}

            {/* Approve — pending only, approvers */}
            {template.approvalStatus === "pending_approval" && canApprove && (
              <button
                onClick={handleApprove}
                disabled={!!acting}
                className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-all"
              >
                {acting === "approve" ? (
                  <>
                    <Spinner /> Approving…
                  </>
                ) : (
                  <>
                    <FaCheck size={11} /> Approve
                  </>
                )}
              </button>
            )}

            {/* Reject — pending only, approvers */}
            {template.approvalStatus === "pending_approval" && canApprove && (
              <button
                onClick={() => setShowRejectModal(true)}
                disabled={!!acting}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-all"
              >
                <FaBan size={11} /> Reject
              </button>
            )}

            {/* Resubmit — rejected, owner or admin */}
            {template.approvalStatus === "rejected" &&
              canCreateEdit &&
              (isAdmin || isOwner()) && (
                <button
                  onClick={handleSubmitForApproval}
                  disabled={!!acting}
                  className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-all"
                >
                  {acting === "submit" ? (
                    <>
                      <Spinner /> Resubmitting…
                    </>
                  ) : (
                    <>
                      <FaCheckDouble size={11} /> Resubmit
                    </>
                  )}
                </button>
              )}

            {/* Edit */}
            {canEdit && (
              <button
                onClick={() =>
                  navigate(`/auditreport/templates/${template.id}`)
                }
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-sm font-semibold transition-all"
              >
                <FaEdit size={11} /> Edit
              </button>
            )}

            {/* Duplicate */}
            {canCreateEdit && (
              <button
                onClick={handleDuplicate}
                disabled={!!acting}
                className="flex items-center gap-1.5 px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all"
              >
                {acting === "duplicate" ? (
                  <>
                    <Spinner color="purple" /> Duplicating…
                  </>
                ) : (
                  <>
                    <FaCopy size={11} /> Duplicate
                  </>
                )}
              </button>
            )}

            {/* Delete */}
            {canDelete && (
              <button
                onClick={() => setShowDeleteModal(true)}
                disabled={!!acting}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all"
              >
                <FaTrash size={11} /> Delete
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="px-6 py-5 space-y-5 max-w-7xl min-w-full">
        {/* ── Status banner ──────────────────────────────────────────────── */}
        {template.approvalStatus === "rejected" && template.rejectionReason && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 flex items-start gap-3">
            <FaTimesCircle
              className="text-red-500 mt-0.5 flex-shrink-0"
              size={14}
            />
            <div>
              <p className="text-sm font-bold text-red-700">
                Template Rejected
              </p>
              <p className="text-xs text-red-600 mt-1">
                {template.rejectionReason}
              </p>
              {template.approvedBy && (
                <p className="text-[10px] text-red-400 mt-1">
                  By {template.approvedBy} · {relTime(template.approvedAt)}
                </p>
              )}
            </div>
          </div>
        )}

        {template.approvalStatus === "approved" && (
          <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-4 flex items-start gap-3">
            <FaCheckCircle
              className="text-green-500 mt-0.5 flex-shrink-0"
              size={14}
            />
            <div>
              <p className="text-sm font-bold text-green-700">
                Template Approved
              </p>
              {template.approvedBy && (
                <p className="text-xs text-green-600 mt-1">
                  Approved by <strong>{template.approvedBy}</strong> ·{" "}
                  {relTime(template.approvedAt)}
                </p>
              )}
            </div>
          </div>
        )}

        {template.approvalStatus === "pending_approval" && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 flex items-start gap-3">
            <FaInfoCircle
              className="text-amber-500 mt-0.5 flex-shrink-0"
              size={14}
            />
            <div>
              <p className="text-sm font-bold text-amber-700">
                Pending Approval
              </p>
              <p className="text-xs text-amber-600 mt-1">
                This template is awaiting review by a Quality Manager.
              </p>
            </div>
          </div>
        )}

        {/* ── Top info grid ──────────────────────────────────────────────── */}
        <div className=" grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Metadata card */}
          <div className="md:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <FaInfoCircle size={11} /> Template Details
            </h2>
            <InfoRow label="Template Code" value={template.templateCode} mono />
            <InfoRow label="Name" value={template.name} />
            <InfoRow label="Description" value={template.description} />
            <InfoRow
              label="Category"
              value={
                template.category ? (
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${categoryCls} capitalize`}
                  >
                    {template.category}
                  </span>
                ) : null
              }
            />
            <InfoRow label="Version" value={`v${template.version || "1.0"}`} />
            <InfoRow
              label="Status"
              value={
                <span
                  className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusCfg.cls}`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`}
                  />
                  {statusCfg.label}
                </span>
              }
            />
            <InfoRow
              label="Active"
              value={
                template.isActive !== false ? (
                  <span className="text-green-600 font-semibold flex items-center gap-1">
                    <FaCheckCircle size={10} /> Active
                  </span>
                ) : (
                  <span className="text-gray-400 font-semibold flex items-center gap-1">
                    <FaTimesCircle size={10} /> Inactive
                  </span>
                )
              }
            />
            <InfoRow label="Created By" value={template.createdBy} />
            <InfoRow label="Created" value={fmtDate(template.createdAt)} />
            <InfoRow
              label="Last Updated"
              value={relTime(template.updatedAt || template.createdAt)}
            />
          </div>

          {/* Stats card */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col gap-4">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <FaClipboardList size={11} /> Structure
            </h2>
            <div className="flex-1 space-y-4">
              <StatBox
                icon={FaLayerGroup}
                label="Sections"
                value={template.defaultSections?.length || 0}
                color="text-slate-600"
                bg="bg-slate-50"
              />
              <StatBox
                icon={MdOutlineFactCheck}
                label="Stages"
                value={totalStages}
                color="text-indigo-600"
                bg="bg-indigo-50"
              />
              <StatBox
                icon={FaClipboardList}
                label="Checkpoints"
                value={totalCPs}
                color="text-green-600"
                bg="bg-green-50"
              />
              <StatBox
                icon={FaColumns}
                label="Columns"
                value={template.columns?.length || 0}
                color="text-blue-600"
                bg="bg-blue-50"
              />
              <StatBox
                icon={FaTag}
                label="Info Fields"
                value={template.infoFields?.length || 0}
                color="text-purple-600"
                bg="bg-purple-50"
              />
            </div>
          </div>
        </div>

        {/* ── BOM Sheet / CRF ───────────────────────────────────────────── */}
        <ReferenceDocs
          docs={template}
          busyKind={docBusy}
          onUpload={canCreateEdit ? handleDocUpload : undefined}
          onRemove={canCreateEdit ? handleDocRemove : undefined}
        />

        {/* ── Audit-format template table ─────────────────────────────────── */}
        {(() => {
          const visibleCols = (template.columns || []).filter(
            (c) => c.visible !== false,
          );
          return (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Sticky card header */}
              <div className="px-5 py-3 bg-white border-b border-gray-200 flex items-center gap-2 sticky top-1 z-20">
                <FaLayerGroup size={12} className="text-slate-600" />
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Template Structure
                </h2>
                <span className="ml-auto text-[10px] text-gray-400">
                  {template.defaultSections?.length || 0} sections ·{" "}
                  {totalStages} stages · {totalCPs} checkpoints
                </span>
              </div>

              {/* Single unified table — no repeated headers, no overlap */}
              <TemplateTable
                sections={template.defaultSections || []}
                visibleCols={visibleCols}
              />
            </div>
          );
        })()}
      </div>
    </div>
  );
};

// ── Small helpers ─────────────────────────────────────────────────────────────
const StatBox = ({ icon: Icon, label, value, color, bg }) => (
  <div className={`flex items-center gap-3 p-3 rounded-xl ${bg}`}>
    <div className={`p-2 bg-white rounded-lg shadow-sm flex-shrink-0`}>
      <Icon size={13} className={color} />
    </div>
    <div>
      <div className={`text-xl font-black ${color} leading-none`}>{value}</div>
      <div className="text-[10px] text-gray-400 font-medium mt-0.5">
        {label}
      </div>
    </div>
  </div>
);

const Spinner = ({ color = "white" }) => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 12 12"
    style={{
      animation: "spin 0.7s linear infinite",
      display: "inline-block",
      flexShrink: 0,
    }}
  >
    <circle
      cx="6"
      cy="6"
      r="4"
      fill="none"
      stroke={
        color === "white" ? "rgba(255,255,255,0.3)" : "rgba(109,40,217,0.2)"
      }
      strokeWidth="2"
    />
    <path
      d="M 6 2 A 4 4 0 0 1 10 6"
      fill="none"
      stroke={color === "white" ? "white" : "#7c3aed"}
      strokeWidth="2"
      strokeLinecap="round"
    />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </svg>
);

export default TemplateView;
