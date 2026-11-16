import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaCheckCircle,
  FaTimesCircle,
  FaEye,
  FaEdit,
  FaSync,
  FaSearch,
  FaFilter,
  FaClipboardList,
  FaClock,
  FaUserCheck,
  FaExclamationTriangle,
  FaFileAlt,
  FaLayerGroup,
  FaThLarge,
  FaList,
  FaHistory,
  FaTimes,
  FaCheckDouble,
  FaChevronRight,
  FaTag,
  FaColumns,
} from "react-icons/fa";
import { HiClipboardDocumentCheck } from "react-icons/hi2";
import { MdOutlineFactCheck } from "react-icons/md";
import useAuditData from "../../../hooks/useAuditData";
import toast from "react-hot-toast";
import { useSelector } from "react-redux";
import { ROLES } from "../../../config/routes.config";
import TemplateHistoryPanel from "./components/TemplateHistoryPanel";
import { useTemplateSearch } from "../../../hooks/useTemplateSearch";
import {
  ConfirmModal,
  StatusBadge as SharedStatusBadge,
  TD,
} from "../_shared.jsx";

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_LABELS = {
  draft: { label: "Draft", cls: "bg-gray-100 text-gray-700 border-gray-300" },
  pending_approval: {
    label: "Pending Approval",
    cls: "bg-amber-100 text-amber-700 border-amber-300",
  },
  approved: {
    label: "Approved",
    cls: "bg-green-100 text-green-700 border-green-300",
  },
  rejected: {
    label: "Rejected",
    cls: "bg-red-100 text-red-700 border-red-300",
  },
};

const relativeTime = (d) => {
  if (!d) return "—";
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getTotalCheckpoints = (template) => {
  if (template?.checkpointCount != null) return template.checkpointCount;
  if (!template?.defaultSections) return 0;
  let n = 0;
  template.defaultSections.forEach((s) => {
    if (s.stages)
      s.stages.forEach((st) => {
        n += st.checkPoints?.length || 0;
      });
    else n += s.checkPoints?.length || 0;
  });
  return n;
};

const getTotalSections = (template) => {
  if (template?.sectionCount != null) return template.sectionCount;
  return template?.defaultSections?.length || 0;
};

const StatusBadge = ({ status }) => {
  const cfg = STATUS_LABELS[status] || {
    label: "Not Set",
    cls: "bg-slate-100 text-slate-600 border-slate-200",
  };
  return (
    <SharedStatusBadge
      config={{
        ...cfg,
        cls: `inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.cls}`,
      }}
    />
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

const TemplateApproval = () => {
  const navigate = useNavigate();
  const { user } = useSelector((store) => store.auth);
  const { templates, loadTemplates, updateTemplate } = useAuditData();

  const canApprove = [ROLES.SUPER_ADMIN, ROLES.QUALITY_MANAGER].includes(
    user?.roleName,
  );
  const isAdmin = user?.roleName === ROLES.SUPER_ADMIN;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [viewMode, setViewMode] = useState("list");

  // Reject modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);

  // History — inline row expansion. Fetching/caching now lives in
  // TemplateHistoryPanel; historyRefreshKey forces a refetch for a specific
  // template after an approve/reject action changes its history server-side.
  const [expandedHistoryId, setExpandedHistoryId] = useState(null); // which template row is open
  const [historyRefreshKey, setHistoryRefreshKey] = useState({}); // id -> counter

  // ── Visibility ───────────────────────────────────────────────────────────

  const visibleTemplates = useMemo(() => {
    const myId = user?.name || user?.usercode;
    return templates.filter((t) => {
      if (t.approvalStatus === "draft")
        return isAdmin || (myId && t.createdBy === myId);
      return true;
    });
  }, [templates, isAdmin, user]);

  // ── Load ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await loadTemplates();
      } catch (err) {
        toast.error("Failed to load templates: " + err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadTemplates();
      toast.success("Refreshed");
    } catch {
      toast.error("Refresh failed");
    } finally {
      setRefreshing(false);
    }
  };

  // ── History panel ────────────────────────────────────────────────────────

  const openHistory = (template) =>
    setExpandedHistoryId((prev) => (prev === template.id ? null : template.id));

  const bumpHistoryRefresh = (templateId) =>
    setHistoryRefreshKey((prev) => ({
      ...prev,
      [templateId]: (prev[templateId] || 0) + 1,
    }));

  // ── Approve / Reject ─────────────────────────────────────────────────────

  const handleApprove = async (template) => {
    try {
      await updateTemplate(template.id, {
        approvalStatus: "approved",
        version: template.version,
        approvedBy: user?.name || user?.usercode || user?.roleName,
        approvedAt: new Date().toISOString(),
      });
      toast.success(`"${template.name}" approved`);
      await loadTemplates();
      bumpHistoryRefresh(template.id);
    } catch (err) {
      toast.error("Approval failed: " + err.message);
    }
  };

  const handleRejectClick = (template) => {
    setSelectedTemplate(template);
    setRejectReason("");
    setShowRejectModal(true);
  };

  const handleReject = async () => {
    if (!selectedTemplate || !rejectReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }
    setRejecting(true);
    try {
      await updateTemplate(selectedTemplate.id, {
        approvalStatus: "rejected",
        version: selectedTemplate.version,
        rejectionReason: rejectReason.trim(),
      });
      toast.success(`"${selectedTemplate.name}" rejected`);
      setShowRejectModal(false);
      setSelectedTemplate(null);
      await loadTemplates();
      bumpHistoryRefresh(selectedTemplate.id);
    } catch (err) {
      toast.error("Rejection failed: " + err.message);
    } finally {
      setRejecting(false);
    }
  };

  // ── Filter ───────────────────────────────────────────────────────────────

  const statusFiltered = useMemo(() => {
    let list = visibleTemplates;
    if (filterStatus === "pending")
      list = list.filter(
        (t) => t.approvalStatus === "pending_approval" || !t.approvalStatus,
      );
    else if (filterStatus !== "all")
      list = list.filter((t) => t.approvalStatus === filterStatus);
    return list;
  }, [visibleTemplates, filterStatus]);

  const filtered = useTemplateSearch(statusFiltered, searchTerm);

  // ── Stats ─────────────────────────────────────────────────────────────────

  const counts = useMemo(
    () => ({
      all: visibleTemplates.length,
      pending: visibleTemplates.filter(
        (t) => t.approvalStatus === "pending_approval" || !t.approvalStatus,
      ).length,
      approved: visibleTemplates.filter((t) => t.approvalStatus === "approved")
        .length,
      rejected: visibleTemplates.filter((t) => t.approvalStatus === "rejected")
        .length,
      draft: visibleTemplates.filter((t) => t.approvalStatus === "draft")
        .length,
    }),
    [visibleTemplates],
  );

  if (!canApprove) {
    return (
      <div className="h-full bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <FaExclamationTriangle className="text-5xl text-amber-400 mx-auto" />
          <h2 className="text-xl font-bold text-gray-800">Access Denied</h2>
          <p className="text-gray-500 text-sm">
            Only Quality Managers and Super Admins can access this page.
          </p>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="h-full bg-gray-50 font-sans flex flex-col">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-20 shadow-sm">
        <div className="w-full px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-indigo-600 rounded-lg">
              <HiClipboardDocumentCheck className="text-white text-base" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-tight">
                Approve Templates
              </h1>
              <p className="text-[10px] text-gray-400 mt-0.5">
                Review, Approve and Track the template changes.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-gray-100 rounded-xl p-1">
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded-lg transition-all text-xs ${viewMode === "list" ? "bg-white shadow text-indigo-600" : "text-gray-400"}`}
              >
                <FaList size={12} />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-lg transition-all text-xs ${viewMode === "grid" ? "bg-white shadow text-indigo-600" : "text-gray-400"}`}
              >
                <FaThLarge size={12} />
              </button>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing || loading}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 hover:border-indigo-300 hover:text-indigo-600 text-gray-500 rounded-xl text-xs font-semibold transition disabled:opacity-40"
            >
              <FaSync
                size={11}
                className={refreshing || loading ? "animate-spin" : ""}
              />{" "}
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ── Stats bar ──────────────────────────────────────────────────── */}
      <div className="w-full px-6 py-3 bg-white border-b border-gray-100">
        <div className="flex items-center gap-3 flex-wrap">
          {[
            {
              key: "all",
              label: "All",
              cls: "bg-gray-50 text-gray-700 border-gray-200 hover:border-gray-400",
            },
            {
              key: "pending",
              label: "Pending",
              cls: "bg-amber-50 text-amber-700 border-amber-200 hover:border-amber-400",
            },
            {
              key: "approved",
              label: "Approved",
              cls: "bg-green-50 text-green-700 border-green-200 hover:border-green-400",
            },
            {
              key: "rejected",
              label: "Rejected",
              cls: "bg-red-50 text-red-600 border-red-200 hover:border-red-400",
            },
            {
              key: "draft",
              label: "Drafts",
              cls: "bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-400",
            },
          ].map(({ key, label, cls }) => (
            <button
              key={key}
              onClick={() => setFilterStatus(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-semibold transition-all ${cls} ${filterStatus === key ? "ring-2 ring-offset-1 ring-indigo-400 shadow-sm" : ""}`}
            >
              {label}
              <span className="font-black">{counts[key]}</span>
            </button>
          ))}

          {/* Search */}
          <div className="relative ml-auto min-w-[220px]">
            <FaSearch
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={11}
            />
            <input
              type="text"
              placeholder="Search templates…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-8 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <FaTimes size={10} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <div className="px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center shadow-sm">
              <MdOutlineFactCheck className="text-5xl text-gray-200 mx-auto mb-4" />
              <h3 className="text-base font-bold text-gray-500 mb-1">
                No templates found
              </h3>
              <p className="text-sm text-gray-400">
                {filterStatus === "pending"
                  ? "No pending templates."
                  : "Try adjusting your filters."}
              </p>
            </div>
          ) : viewMode === "list" ? (
            /* ── List view ── */
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-indigo-50 border-b border-indigo-100">
                    {[
                      "Template",
                      "Category",
                      "Checkpoints",
                      "Status",
                      "Created By",
                      "Submitted By",
                      "Updated",
                      "Actions",
                    ].map((h, i) => (
                      <th
                        key={h}
                        className={`px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-indigo-500 ${i > 1 ? "text-center" : "text-left"}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((t, idx) => {
                    const cps = getTotalCheckpoints(t);
                    const isOpen = expandedHistoryId === t.id;

                    return (
                      <React.Fragment key={t.id}>
                        {/* ── Main row ── */}
                        <tr
                          className={`hover:bg-indigo-50/20 transition-colors ${idx % 2 === 1 ? "bg-gray-50/30" : ""} ${isOpen ? "bg-indigo-50/30" : ""}`}
                        >
                          <TD cls="max-w-[200px]">
                            <p
                              className="font-black text-gray-800 text-xs truncate"
                              title={t.name}
                            >
                              {t.name}
                            </p>
                            {t.description && (
                              <p className="text-[10px] text-gray-400 truncate mt-0.5">
                                {t.description}
                              </p>
                            )}
                            <p className="text-[10px] text-indigo-500 font-mono mt-0.5">
                              {t.templateCode}
                            </p>
                            {t.rejectionReason && (
                              <div className="mt-1 px-2 py-1 bg-red-50 border border-red-100 rounded-lg">
                                <p className="text-[9px] font-bold text-red-500 uppercase tracking-wider">
                                  Rejection Reason
                                </p>
                                <p className="text-[10px] text-red-600 leading-tight">
                                  {t.rejectionReason}
                                </p>
                              </div>
                            )}
                          </TD>
                          <TD center>
                            <span className="text-xs text-gray-600 capitalize">
                              {t.category || "—"}
                            </span>
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              v{t.version || "01"}
                            </p>
                          </TD>
                          <TD center>
                            <span className="text-sm font-black text-indigo-600">
                              {cps}
                            </span>
                            <p className="text-[10px] text-gray-400">
                              {getTotalSections(t)} sections
                            </p>
                          </TD>
                          <TD center>
                            <StatusBadge status={t.approvalStatus} />
                          </TD>
                          <TD center cls="text-xs text-gray-600">
                            {t.createdBy || "—"}
                          </TD>
                          <TD center cls="text-xs text-gray-600">
                            {t.approvedBy || "—"}
                          </TD>
                          <TD center>
                            <p className="text-xs text-gray-600">
                              {relativeTime(t.updatedAt)}
                            </p>
                            <p className="text-[10px] text-gray-400">
                              {new Date(t.updatedAt).toLocaleDateString(
                                "en-IN",
                              )}
                            </p>
                          </TD>
                          <TD>
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() =>
                                  navigate(`/auditreport/templates/${t.id}`)
                                }
                                className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition"
                                title="View/Edit"
                              >
                                <FaEye size={11} />
                              </button>
                              <button
                                onClick={() => openHistory(t)}
                                className={`p-1.5 rounded-lg transition flex items-center gap-1 ${isOpen ? "bg-indigo-200 text-indigo-700" : "bg-indigo-50 hover:bg-indigo-100 text-indigo-600"}`}
                                title="Toggle Change Log"
                              >
                                <FaHistory size={11} />
                                <FaChevronRight
                                  size={8}
                                  className={`transition-transform ${isOpen ? "rotate-90" : ""}`}
                                />
                              </button>
                              {(t.approvalStatus === "pending_approval" ||
                                !t.approvalStatus) && (
                                <>
                                  <button
                                    onClick={() => handleApprove(t)}
                                    className="p-1.5 bg-green-100 hover:bg-green-200 text-green-600 rounded-lg transition"
                                    title="Approve"
                                  >
                                    <FaCheckCircle size={11} />
                                  </button>
                                  <button
                                    onClick={() => handleRejectClick(t)}
                                    className="p-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition"
                                    title="Reject"
                                  >
                                    <FaTimesCircle size={11} />
                                  </button>
                                </>
                              )}
                            </div>
                          </TD>
                        </tr>

                        {/* ── Inline history row ── */}
                        {isOpen && (
                          <tr>
                            <td
                              colSpan={8}
                              className="px-6 py-4 bg-indigo-50/20 border-t border-indigo-100"
                            >
                              <TemplateHistoryPanel
                                templateId={t.id}
                                isOpen={isOpen}
                                variant="inline-list"
                                title={`Change Log — ${t.name}`}
                                refreshKey={historyRefreshKey[t.id] || 0}
                              />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* ── Grid view ── */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((t) => {
                const cps = getTotalCheckpoints(t);
                const isActive = expandedHistoryId === t.id;
                return (
                  <div
                    key={t.id}
                    className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all overflow-hidden ${isActive ? "border-indigo-300 ring-2 ring-indigo-100" : "border-gray-100"}`}
                  >
                    <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="p-2 bg-white/10 rounded-lg flex-shrink-0">
                          <HiClipboardDocumentCheck className="text-lg text-white" />
                        </div>
                        <StatusBadge status={t.approvalStatus} />
                      </div>
                      <h3 className="font-black text-white text-sm leading-tight line-clamp-2">
                        {t.name}
                      </h3>
                      <p className="text-indigo-200 text-[10px] mt-1 font-mono">
                        {t.templateCode}
                      </p>
                    </div>
                    <div className="p-4 space-y-2 text-xs">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-indigo-50 rounded-lg px-2 py-1.5 text-center">
                          <p className="text-[9px] text-indigo-400 font-bold uppercase">
                            Checkpoints
                          </p>
                          <p className="text-base font-black text-indigo-700">
                            {cps}
                          </p>
                        </div>
                        <div className="bg-gray-50 rounded-lg px-2 py-1.5 text-center">
                          <p className="text-[9px] text-gray-400 font-bold uppercase">
                            Sections
                          </p>
                          <p className="text-base font-black text-gray-700">
                            {getTotalSections(t)}
                          </p>
                        </div>
                      </div>
                      {[
                        ["Category", t.category || "—"],
                        ["Version", `v${t.version || "01"}`],
                        ["Created By", t.createdBy || "—"],
                        ["Approved By", t.approvedBy || "—"],
                        ["Updated", relativeTime(t.updatedAt)],
                      ].map(([k, v]) => (
                        <div
                          key={k}
                          className="flex justify-between border-b border-gray-50 pb-1.5"
                        >
                          <span className="text-gray-400 font-medium">{k}</span>
                          <span className="text-gray-700 font-semibold truncate max-w-[100px]">
                            {v}
                          </span>
                        </div>
                      ))}
                      {t.rejectionReason && (
                        <div className="bg-red-50 border border-red-100 rounded-lg p-2">
                          <p className="text-[9px] font-bold text-red-500 uppercase tracking-wider">
                            Rejection Reason
                          </p>
                          <p className="text-[10px] text-red-600 leading-tight mt-0.5">
                            {t.rejectionReason}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="border-t border-gray-100 px-4 py-2.5 flex items-center justify-between">
                      <button
                        onClick={() =>
                          navigate(`/auditreport/templates/${t.id}`)
                        }
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-indigo-600 font-semibold transition"
                      >
                        <FaEye size={10} /> View
                      </button>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openHistory(t)}
                          className={`p-1.5 rounded-lg transition ${isActive ? "bg-indigo-200 text-indigo-700" : "bg-indigo-50 hover:bg-indigo-100 text-indigo-600"}`}
                          title="History"
                        >
                          <FaHistory size={10} />
                        </button>
                        {(t.approvalStatus === "pending_approval" ||
                          !t.approvalStatus) && (
                          <>
                            <button
                              onClick={() => handleApprove(t)}
                              className="p-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition"
                            >
                              <FaCheckCircle size={10} />
                            </button>
                            <button
                              onClick={() => handleRejectClick(t)}
                              className="p-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition"
                            >
                              <FaTimesCircle size={10} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    {isActive && (
                      <div className="border-t border-indigo-100 px-4 py-3">
                        <TemplateHistoryPanel
                          templateId={t.id}
                          isOpen={isActive}
                          variant="inline-grid"
                          refreshKey={historyRefreshKey[t.id] || 0}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Reject Modal ───────────────────────────────────────────────── */}
      {showRejectModal && (
        <ConfirmModal
          onClose={() => setShowRejectModal(false)}
          onConfirm={handleReject}
          confirming={rejecting}
          confirmDisabled={!rejectReason.trim()}
          icon={FaTimesCircle}
          title="Reject Template"
          subtitle={
            <>
              Template: <strong>{selectedTemplate?.name}</strong>
            </>
          }
          confirmLabel="Confirm Reject"
          confirmingLabel="Rejecting…"
        >
          <label className="block text-xs font-bold text-gray-700 mb-2">
            Rejection Reason <span className="text-red-500">*</span>
          </label>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Describe what needs to be corrected…"
            rows={4}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
          />
        </ConfirmModal>
      )}
    </div>
  );
};

export default TemplateApproval;
