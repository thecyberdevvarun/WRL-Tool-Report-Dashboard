import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaCheckCircle,
  FaTimesCircle,
  FaEye,
  FaSync,
  FaSearch,
  FaHourglassHalf,
  FaExclamationTriangle,
  FaClipboardList,
  FaUserCheck,
  FaClipboardCheck,
  FaTools,
} from "react-icons/fa";
import { HiClipboardDocumentCheck } from "react-icons/hi2";
import useAuditData from "../../../hooks/useAuditData";
import toast from "react-hot-toast";
import { useSelector } from "react-redux";
import { ROLES } from "../../../config/routes.config";

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtDate = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const relativeTime = (dateStr) => {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

// ── Main Component ────────────────────────────────────────────────────────────

const AuditApproval = () => {
  const navigate = useNavigate();
  const { user } = useSelector((store) => store.auth);
  const { loadAudits, approveAudit, rejectAudit } = useAuditData();

  const isAdmin = [user?.role, user?.roleName].includes(ROLES.SUPER_ADMIN);
  const isLQE = [user?.role, user?.roleName].includes(
    ROLES.LINE_QUALITY_ENGINEER,
  );
  const canAccess = isAdmin || isLQE;

  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [stats, setStats] = useState({ approved: 0, rejected: 0, draft: 0 });
  const [hiddenPending, setHiddenPending] = useState(0);

  // Reject modal
  const [rejectModal, setRejectModal] = useState({ open: false, audit: null });
  const [rejectReason, setRejectReason] = useState("");
  // Rework modal
  const [reworkModal, setReworkModal] = useState({ open: false, audit: null });
  const [reworkReason, setReworkReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // ── Load ─────────────────────────────────────────────────────────────────────

  const fetchPending = async (showRefreshToast = false) => {
    if (showRefreshToast) setRefreshing(true);
    else setLoading(true);
    try {
      const [pendingRes, approvedRes, rejectedRes, draftRes] =
        await Promise.all([
          // lite: the queue never renders sections; 500 covers any real backlog.
          loadAudits({ status: "submitted", limit: 500, lite: true }),
          loadAudits({ status: "approved", limit: 1 }),
          loadAudits({ status: "rejected", limit: 1 }),
          loadAudits({ status: "draft", limit: 1 }),
        ]);
      setAudits(pendingRes.data || []);
      setHiddenPending(Math.max(0, (pendingRes.totalCount || 0) - (pendingRes.data || []).length));
      setStats({
        approved: approvedRes.totalCount || 0,
        rejected: rejectedRes.totalCount || 0,
        draft: draftRes.totalCount || 0,
      });
      if (showRefreshToast) toast.success("Refreshed");
    } catch (err) {
      toast.error("Failed to load audits: " + err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  // ── Actions ──────────────────────────────────────────────────────────────────

  const handleQuickApprove = async (audit) => {
    setActionLoading(true);
    try {
      await approveAudit(audit.id, {
        approverName: user?.name || user?.userCode || user?.usercode || "LQE",
        comments: null,
      });
      toast.success(`Audit ${audit.auditCode} approved`);
      setAudits((prev) => prev.filter((a) => a.id !== audit.id));
    } catch (err) {
      toast.error("Approval failed: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectClick = (audit) => {
    setRejectModal({ open: true, audit });
    setRejectReason("");
  };

  const handleRejectConfirm = async () => {
    if (!rejectReason.trim()) {
      toast.error("Rejection reason is required");
      return;
    }
    setActionLoading(true);
    try {
      await rejectAudit(rejectModal.audit.id, {
        approverName: user?.name || user?.userCode || user?.usercode || "LQE",
        comments: rejectReason.trim(),
      });
      toast.success(
        `Audit ${rejectModal.audit.auditCode} rejected — audit failed`,
      );
      setAudits((prev) => prev.filter((a) => a.id !== rejectModal.audit.id));
      setRejectModal({ open: false, audit: null });
    } catch (err) {
      toast.error("Rejection failed: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReworkClick = (audit) => {
    setReworkModal({ open: true, audit });
    setReworkReason("");
  };

  const handleReworkConfirm = async () => {
    if (!reworkReason.trim()) {
      toast.error("Rework reason is required");
      return;
    }
    setActionLoading(true);
    try {
      await rejectAudit(reworkModal.audit.id, {
        approverName: user?.name || user?.userCode || user?.usercode || "LQE",
        comments: reworkReason.trim(),
        isRework: true,
      });
      toast.success(
        `Audit ${reworkModal.audit.auditCode} sent for rework — returned to quality auditor`,
      );
      setAudits((prev) => prev.filter((a) => a.id !== reworkModal.audit.id));
      setReworkModal({ open: false, audit: null });
    } catch (err) {
      toast.error("Rework failed: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // ── Filter ───────────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return audits;
    const q = searchTerm.toLowerCase();
    return audits.filter(
      (a) =>
        a.auditCode?.toLowerCase().includes(q) ||
        a.templateName?.toLowerCase().includes(q) ||
        a.reportName?.toLowerCase().includes(q) ||
        a.createdBy?.toLowerCase().includes(q) ||
        a.infoData?.serialNo?.toLowerCase().includes(q) ||
        a.infoData?.modelName?.toLowerCase().includes(q),
    );
  }, [audits, searchTerm]);

  // ── Access Guard ─────────────────────────────────────────────────────────────

  if (!canAccess) {
    return (
      <div className="h-full bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-4 px-6">
          <FaExclamationTriangle className="text-5xl text-amber-400 mx-auto" />
          <h2 className="text-xl font-bold text-gray-800">Access Denied</h2>
          <p className="text-gray-500 text-sm">
            Only Line Quality Engineers and Super Admins can access the audit
            approval queue.
          </p>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="h-full overflow-y-auto bg-gray-50 font-sans">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="w-full px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-amber-500 rounded-lg">
              <FaUserCheck className="text-white text-base" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-tight">
                Approve Audits
              </h1>
              <p className="text-[10px] text-gray-400 mt-0.5">
                Review and approve submitted audit records.
              </p>
            </div>
          </div>
          <button
            onClick={() => fetchPending(true)}
            disabled={refreshing || loading}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 hover:border-amber-300 hover:text-amber-600 text-gray-500 rounded-xl text-xs font-semibold transition disabled:opacity-40"
          >
            <FaSync
              size={11}
              className={refreshing || loading ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Stats bar ──────────────────────────────────────────────────────── */}
      <div className="w-full px-6 py-3 bg-white border-b border-gray-100">
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span className="font-black text-gray-800">{audits.length}</span>
            <span className="text-gray-500">Pending Review</span>
          </div>
          {hiddenPending > 0 && (
            <div className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
              +{hiddenPending} older pending not loaded — refresh after clearing these
            </div>
          )}
          {filtered.length !== audits.length && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              (showing {filtered.length} filtered)
            </div>
          )}
        </div>
      </div>

      <div className="w-full px-6 py-4 space-y-4">
        {/* ── Summary Stats ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              label: "Pending Review",
              value: loading ? "—" : audits.length,
              icon: FaHourglassHalf,
              bg: "bg-amber-50",
              border: "border-amber-100",
              iconCls: "text-amber-500",
              valCls: "text-amber-700",
              sub:
                audits.length > 0
                  ? `Oldest: ${relativeTime(audits[audits.length - 1]?.submittedAt || audits[audits.length - 1]?.updatedAt)}`
                  : "Queue is clear",
            },
            {
              label: "Approved",
              value: loading ? "—" : stats.approved,
              icon: FaCheckCircle,
              bg: "bg-emerald-50",
              border: "border-emerald-100",
              iconCls: "text-emerald-500",
              valCls: "text-emerald-700",
              sub: "Total approved audits",
            },
            {
              label: "Rejected",
              value: loading ? "—" : stats.rejected,
              icon: FaTimesCircle,
              bg: "bg-red-50",
              border: "border-red-100",
              iconCls: "text-red-400",
              valCls: "text-red-600",
              sub: "Returned for correction",
            },
            {
              label: "Draft",
              value: loading ? "—" : stats.draft,
              icon: FaClipboardList,
              bg: "bg-gray-50",
              border: "border-gray-200",
              iconCls: "text-gray-400",
              valCls: "text-gray-600",
              sub: "Not yet submitted",
            },
          ].map(
            ({
              label,
              value,
              icon: Icon,
              bg,
              border,
              iconCls,
              valCls,
              sub,
            }) => (
              <div
                key={label}
                className={`${bg} border ${border} rounded-2xl px-4 py-4`}
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] text-gray-500 font-semibold">
                    {label}
                  </p>
                  <Icon className={`${iconCls} text-base`} />
                </div>
                <p className={`text-3xl font-black ${valCls}`}>{value}</p>
                <p className="text-[10px] text-gray-400 mt-1">{sub}</p>
              </div>
            ),
          )}
        </div>

        {/* ── Search ─────────────────────────────────────────────────────── */}
        <div className="relative max-w-md">
          <FaSearch
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            size={12}
          />
          <input
            type="text"
            placeholder="Search by audit code, template, serial, operator…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
          />
        </div>

        {/* ── Content ────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-10 h-10 border-4 border-amber-100 border-t-amber-500 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
            <FaClipboardList className="text-4xl text-gray-200 mx-auto mb-4" />
            <h3 className="text-base font-bold text-gray-500 mb-1">
              {audits.length === 0
                ? "No pending audits"
                : "No results match your search"}
            </h3>
            <p className="text-sm text-gray-400">
              {audits.length === 0
                ? "All submitted audits have been reviewed. New ones will appear here automatically."
                : "Try a different search term."}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-amber-50 border-b border-amber-100">
                  {[
                    "#",
                    "Audit Code",
                    "Template",
                    "Serial / Model",
                    "Operator",
                    "Submitted",
                    "Actions",
                  ].map((h, i) => (
                    <th
                      key={h}
                      className={`px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 ${i === 6 ? "text-right" : "text-left"}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((audit, idx) => (
                  <tr
                    key={audit.id}
                    className={`hover:bg-amber-50/20 transition-colors ${idx % 2 === 1 ? "bg-gray-50/30" : ""}`}
                  >
                    <td className="px-4 py-3 text-[11px] text-gray-400">
                      {idx + 1}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-amber-50 rounded-lg flex-shrink-0">
                          <HiClipboardDocumentCheck className="text-amber-500 text-sm" />
                        </div>
                        <div>
                          <p className="font-black text-gray-800 text-xs">
                            {audit.auditCode || `#${audit.id}`}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            {audit.reportName || "—"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p
                        className="text-xs font-semibold text-gray-700 max-w-[160px] truncate"
                        title={audit.templateName}
                      >
                        {audit.templateName || "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-semibold text-indigo-700">
                        {audit.infoData?.serialNo ||
                          audit.infoData?.serial ||
                          "—"}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {audit.infoData?.modelName || "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {audit.submittedBy || audit.createdBy || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-gray-600">
                        {fmtDate(audit.submittedAt || audit.updatedAt)}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {relativeTime(audit.submittedAt || audit.updatedAt)}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() =>
                            navigate(`/auditreport/audits/${audit.id}`)
                          }
                          title="Review full audit"
                          className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg transition text-xs font-semibold flex items-center gap-1"
                        >
                          <FaEye size={11} /> Review
                        </button>
                        <button
                          onClick={() => handleQuickApprove(audit)}
                          disabled={actionLoading}
                          title="Approve"
                          className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition disabled:opacity-40"
                        >
                          <FaCheckCircle size={13} />
                        </button>
                        <button
                          onClick={() => handleReworkClick(audit)}
                          disabled={actionLoading}
                          title="Send for Rework"
                          className="p-2 bg-orange-50 hover:bg-orange-100 text-orange-600 rounded-lg transition disabled:opacity-40"
                        >
                          <FaTools size={13} />
                        </button>
                        <button
                          onClick={() => handleRejectClick(audit)}
                          disabled={actionLoading}
                          title="Reject"
                          className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition disabled:opacity-40"
                        >
                          <FaTimesCircle size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Reject Modal ───────────────────────────────────────────────────── */}
      {rejectModal.open && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
          onClick={() => setRejectModal({ open: false, audit: null })}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 bg-gradient-to-r from-red-600 to-red-700 text-white">
              <h3 className="text-base font-black flex items-center gap-2">
                <FaTimesCircle /> Reject Audit
              </h3>
              <p className="text-xs text-red-200 mt-1">
                Audit: <strong>{rejectModal.audit?.auditCode}</strong> — audit
                will be marked as failed.
              </p>
            </div>
            <div className="p-6">
              <label className="block text-xs font-bold text-gray-700 mb-2">
                Rejection Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Describe why this audit failed…"
                rows={4}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
              />
              <div className="flex items-center justify-end gap-3 mt-4">
                <button
                  onClick={() => setRejectModal({ open: false, audit: null })}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition disabled:opacity-50 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRejectConfirm}
                  disabled={actionLoading || !rejectReason.trim()}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {actionLoading ? "Rejecting…" : "Confirm Reject"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Rework Modal ───────────────────────────────────────────────────── */}
      {reworkModal.open && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
          onClick={() => setReworkModal({ open: false, audit: null })}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white">
              <h3 className="text-base font-black flex items-center gap-2">
                <FaTools /> Send for Rework
              </h3>
              <p className="text-xs text-orange-200 mt-1">
                Audit: <strong>{reworkModal.audit?.auditCode}</strong> — will be
                returned to quality auditor for correction.
              </p>
            </div>
            <div className="p-6">
              <label className="block text-xs font-bold text-gray-700 mb-2">
                Rework Instructions <span className="text-orange-500">*</span>
              </label>
              <textarea
                value={reworkReason}
                onChange={(e) => setReworkReason(e.target.value)}
                placeholder="Describe what checkpoints need to be rechecked…"
                rows={4}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
              />
              <div className="flex items-center justify-end gap-3 mt-4">
                <button
                  onClick={() => setReworkModal({ open: false, audit: null })}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition disabled:opacity-50 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReworkConfirm}
                  disabled={actionLoading || !reworkReason.trim()}
                  className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {actionLoading ? "Sending…" : "Send for Rework"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditApproval;
