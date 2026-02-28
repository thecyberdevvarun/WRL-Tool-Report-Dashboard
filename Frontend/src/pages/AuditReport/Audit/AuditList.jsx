import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaPlus,
  FaEdit,
  FaTrash,
  FaEye,
  FaSearch,
  FaFilter,
  FaFileAlt,
  FaCheckCircle,
  FaTimesCircle,
  FaClock,
  FaPaperPlane,
  FaClipboardCheck,
  FaSync,
  FaExclamationTriangle,
  FaBarcode,
  FaCalendarAlt,
} from "react-icons/fa";
import { BiSolidFactory } from "react-icons/bi";
import useAuditData from "../../../hooks/useAuditData";
import toast from "react-hot-toast";

// Format date for display (DD/MM/YYYY)
const formatDateForDisplay = (dateString) => {
  if (!dateString) return "-";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "-";
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return "-";
  }
};

const AuditList = () => {
  const navigate = useNavigate();
  const {
    audits,
    templates,
    deleteAudit,
    loadAudits,
    loadTemplates,
    loading,
    error,
  } = useAuditData();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterTemplate, setFilterTemplate] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [auditToDelete, setAuditToDelete] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load audits and templates on mount
  useEffect(() => {
    const fetchData = async () => {
      setInitialLoading(true);
      try {
        await Promise.all([loadAudits(), loadTemplates()]);
      } catch (err) {
        console.error("Failed to load data:", err);
        toast.error("Failed to load data");
      } finally {
        setInitialLoading(false);
      }
    };
    fetchData();
  }, []);

  // Refresh data
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadAudits(), loadTemplates()]);
      toast.success("Data refreshed");
    } catch (err) {
      toast.error("Failed to refresh data");
    } finally {
      setRefreshing(false);
    }
  };

  // Summary calculation
  const getSummaryFromAudit = useCallback((audit) => {
    const defaultSummary = {
      pass: 0,
      fail: 0,
      warning: 0,
      pending: 0,
      na: 0,
      total: 0,
    };

    if (!audit) return defaultSummary;

    if (audit.summary) {
      let parsedSummary = audit.summary;
      if (typeof parsedSummary === "string") {
        try {
          parsedSummary = JSON.parse(parsedSummary);
        } catch {
          parsedSummary = null;
        }
      }
      if (parsedSummary && typeof parsedSummary === "object") {
        return {
          pass: parsedSummary.pass ?? parsedSummary.Pass ?? 0,
          fail: parsedSummary.fail ?? parsedSummary.Fail ?? 0,
          warning: parsedSummary.warning ?? parsedSummary.Warning ?? 0,
          pending: parsedSummary.pending ?? parsedSummary.Pending ?? 0,
          na: parsedSummary.na ?? parsedSummary.NA ?? 0,
          total: parsedSummary.total ?? parsedSummary.Total ?? 0,
        };
      }
    }

    let pass = 0,
      fail = 0,
      warning = 0,
      pending = 0,
      na = 0;

    let sections = audit.sections;
    if (typeof sections === "string") {
      try {
        sections = JSON.parse(sections);
      } catch {
        sections = [];
      }
    }

    if (!sections || !Array.isArray(sections)) return defaultSummary;

    sections.forEach((section) => {
      if (!section) return;
      if (section.stages && Array.isArray(section.stages)) {
        section.stages.forEach((stage) => {
          stage?.checkPoints?.forEach((cp) => {
            if (!cp) return;
            const status = (cp.status || "").toLowerCase();
            if (status === "pass") pass++;
            else if (status === "fail") fail++;
            else if (status === "warning") warning++;
            else if (status === "na") na++;
            else pending++;
          });
        });
      } else if (section.checkPoints && Array.isArray(section.checkPoints)) {
        section.checkPoints.forEach((cp) => {
          if (!cp) return;
          const status = (cp.status || "").toLowerCase();
          if (status === "pass") pass++;
          else if (status === "fail") fail++;
          else if (status === "warning") warning++;
          else if (status === "na") na++;
          else pending++;
        });
      }
    });

    return {
      pass,
      fail,
      warning,
      pending,
      na,
      total: pass + fail + warning + pending + na,
    };
  }, []);

  // Get info field value
  const getInfoValue = useCallback((audit, fieldId) => {
    if (!audit) return "-";
    let infoData = audit.infoData;
    if (typeof infoData === "string") {
      try {
        infoData = JSON.parse(infoData);
      } catch {
        infoData = {};
      }
    }
    if (!infoData || typeof infoData !== "object") return "-";
    if (infoData[fieldId]) return infoData[fieldId];

    const alternates = {
      serialNo: ["serial", "serialNumber", "serialNo", "Serial", "SerialNo"],
      modelName: ["model", "modelName", "modelVariant", "Model", "ModelName"],
      date: ["auditDate", "date", "reportDate", "Date", "AuditDate"],
      shift: ["shift", "shiftName", "Shift", "ShiftName"],
    };

    if (alternates[fieldId]) {
      for (const alt of alternates[fieldId]) {
        if (infoData[alt]) return infoData[alt];
      }
    }
    return "-";
  }, []);

  // Pass rate helpers
  const getPassRate = useCallback((summary) => {
    if (!summary || !summary.total || summary.total === 0) return 0;
    return Math.round((summary.pass / summary.total) * 100);
  }, []);

  const getPassRateColor = useCallback((rate) => {
    if (rate >= 90) return "text-green-600";
    if (rate >= 70) return "text-yellow-600";
    return "text-red-600";
  }, []);

  const getPassRateBgColor = useCallback((rate) => {
    if (rate >= 90) return "bg-green-500";
    if (rate >= 70) return "bg-yellow-500";
    return "bg-red-500";
  }, []);

  // Filter audits
  const filteredAudits = useMemo(() => {
    return audits.filter((audit) => {
      const searchLower = searchTerm.toLowerCase();
      const modelName = getInfoValue(audit, "modelName");
      const serialNo = getInfoValue(audit, "serialNo");

      const matchesSearch =
        !searchTerm ||
        audit.reportName?.toLowerCase().includes(searchLower) ||
        audit.templateName?.toLowerCase().includes(searchLower) ||
        audit.auditCode?.toLowerCase().includes(searchLower) ||
        (modelName !== "-" && modelName.toLowerCase().includes(searchLower)) ||
        (serialNo !== "-" && serialNo.toLowerCase().includes(searchLower)) ||
        audit.createdBy?.toLowerCase().includes(searchLower);

      const matchesStatus = !filterStatus || audit.status === filterStatus;
      const matchesTemplate =
        !filterTemplate || String(audit.templateId) === String(filterTemplate);

      return matchesSearch && matchesStatus && matchesTemplate;
    });
  }, [audits, searchTerm, filterStatus, filterTemplate, getInfoValue]);

  // Sort audits newest first
  const sortedAudits = useMemo(() => {
    return [...filteredAudits].sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt) -
        new Date(a.updatedAt || a.createdAt),
    );
  }, [filteredAudits]);

  // Stats
  const stats = useMemo(
    () => ({
      total: audits.length,
      submitted: audits.filter((a) => a.status === "submitted").length,
      approved: audits.filter((a) => a.status === "approved").length,
      rejected: audits.filter((a) => a.status === "rejected").length,
    }),
    [audits],
  );

  // Delete handlers
  const handleDelete = async () => {
    if (auditToDelete) {
      setActionLoading(true);
      try {
        await deleteAudit(auditToDelete.id);
        toast.success("Audit deleted successfully");
        setShowDeleteModal(false);
        setAuditToDelete(null);
      } catch (err) {
        toast.error(`Failed to delete audit: ${err.message}`);
      } finally {
        setActionLoading(false);
      }
    }
  };

  const confirmDelete = (audit) => {
    if (audit.status === "approved") {
      toast.error("Cannot delete an approved audit");
      return;
    }
    setAuditToDelete(audit);
    setShowDeleteModal(true);
  };

  // Status badge
  const getStatusBadge = useCallback((status) => {
    switch (status) {
      case "submitted":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
            <FaPaperPlane size={9} /> Submitted
          </span>
        );
      case "approved":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
            <FaCheckCircle size={9} /> Approved
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
            <FaTimesCircle size={9} /> Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold">
            {status || "Unknown"}
          </span>
        );
    }
  }, []);

  // ==================== Loading state ====================
  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading audits...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-6 px-4">
      <div className="mx-auto">
        {/* ==================== Sticky Header ==================== */}
        <div className="sticky top-0 z-40 bg-gray-100/95 backdrop-blur border-b border-gray-200 shadow-sm px-4 py-3 mb-6">
          <div className="flex flex-wrap justify-between items-center gap-3">
            {/* Title */}
            <div>
              <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <FaClipboardCheck className="text-green-600" />
                Audit Records
              </h1>
              <p className="text-gray-500 text-sm mt-0.5">
                {filteredAudits.length} of {audits.length} records
                {(searchTerm || filterStatus || filterTemplate) && (
                  <span className="ml-1 text-blue-500">(filtered)</span>
                )}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-gray-50 text-gray-600 border border-gray-300 rounded-lg font-medium transition-all disabled:opacity-50 shadow-sm text-sm"
              >
                <FaSync
                  className={refreshing ? "animate-spin" : ""}
                  size={13}
                />
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>
              <button
                onClick={() => navigate("/auditreport/templates")}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all shadow-sm text-sm"
              >
                <FaPlus size={13} /> New Audit
              </button>
            </div>
          </div>
        </div>

        {/* ==================== Stats Cards ==================== */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {/* Total */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <FaClipboardCheck className="text-blue-600 text-xl" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-800">
                {stats.total}
              </div>
              <div className="text-gray-500 text-xs font-medium">
                Total Audits
              </div>
            </div>
          </div>

          {/* Submitted */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
              <FaPaperPlane className="text-blue-500 text-lg" />
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {stats.submitted}
              </div>
              <div className="text-gray-500 text-xs font-medium">Submitted</div>
            </div>
          </div>

          {/* Approved */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
              <FaCheckCircle className="text-green-500 text-lg" />
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {stats.approved}
              </div>
              <div className="text-gray-500 text-xs font-medium">Approved</div>
            </div>
          </div>

          {/* Rejected */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
              <FaTimesCircle className="text-red-500 text-lg" />
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">
                {stats.rejected}
              </div>
              <div className="text-gray-500 text-xs font-medium">Rejected</div>
            </div>
          </div>
        </div>

        {/* ==================== Search and Filter ==================== */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-wrap gap-3 items-center">
            {/* Search */}
            <div className="flex-1 min-w-[220px]">
              <div className="relative">
                <FaSearch
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  size={13}
                />
                <input
                  type="text"
                  placeholder="Search by name, code, model, serial..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <FaFilter className="text-gray-400" size={13} />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                <option value="">All Status</option>
                <option value="submitted">Submitted</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
              <select
                value={filterTemplate}
                onChange={(e) => setFilterTemplate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                <option value="">All Templates</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>

              {/* Clear Filters */}
              {(searchTerm || filterStatus || filterTemplate) && (
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setFilterStatus("");
                    setFilterTemplate("");
                  }}
                  className="px-3 py-2 text-sm text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg border border-red-200 transition-all font-medium"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ==================== Audits Table ==================== */}
        {sortedAudits.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-16 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FaFileAlt className="text-4xl text-gray-300" />
            </div>
            <h3 className="text-xl font-semibold text-gray-600 mb-2">
              No Audits Found
            </h3>
            <p className="text-gray-400 mb-6 text-sm">
              {searchTerm || filterStatus || filterTemplate
                ? "No audits match your search criteria."
                : "Get started by creating your first audit."}
            </p>
            {searchTerm || filterStatus || filterTemplate ? (
              <button
                onClick={() => {
                  setSearchTerm("");
                  setFilterStatus("");
                  setFilterTemplate("");
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-all text-sm mr-3"
              >
                Clear Filters
              </button>
            ) : null}
            <button
              onClick={() => navigate("/auditreport/templates")}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all text-sm"
            >
              <FaPlus size={12} /> Create Audit
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                {/* Table Head */}
                <thead>
                  <tr className="bg-gradient-to-r from-gray-700 to-gray-800 text-white">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                      Audit Details
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                      <div className="flex items-center gap-1.5">
                        <FaBarcode className="text-purple-300" />
                        Serial / Model
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                      <div className="flex items-center gap-1.5">
                        <FaCalendarAlt className="text-red-300" />
                        Date / Shift
                      </div>
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider">
                      Results
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider">
                      Pass Rate
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>

                {/* Table Body */}
                <tbody className="divide-y divide-gray-100">
                  {sortedAudits.map((audit, index) => {
                    const summary = getSummaryFromAudit(audit);
                    const passRate = getPassRate(summary);
                    const serialNo = getInfoValue(audit, "serialNo");
                    const modelName = getInfoValue(audit, "modelName");
                    const auditDate = getInfoValue(audit, "date");
                    const shift = getInfoValue(audit, "shift");

                    return (
                      <tr
                        key={audit.id}
                        className={`hover:bg-blue-50/40 transition-colors ${
                          index % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                        }`}
                      >
                        {/* Audit Details */}
                        <td className="px-4 py-3 max-w-[220px]">
                          <div className="font-semibold text-gray-800 text-sm truncate">
                            {audit.reportName || "Untitled Audit"}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            {audit.auditCode && (
                              <span className="inline-block bg-blue-50 text-blue-700 text-xs px-1.5 py-0.5 rounded font-medium">
                                {audit.auditCode}
                              </span>
                            )}
                            <span className="text-xs text-gray-400 truncate max-w-[120px]">
                              {audit.templateName}
                            </span>
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {audit.formatNo && `Format: ${audit.formatNo}`}
                            {audit.formatNo && audit.revNo && " | "}
                            {audit.revNo && `Rev: ${audit.revNo}`}
                          </div>
                        </td>

                        {/* Serial / Model */}
                        <td className="px-4 py-3">
                          <div className="flex items-start gap-2">
                            <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <BiSolidFactory className="text-indigo-500 text-sm" />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-800">
                                {modelName}
                              </div>
                              {serialNo !== "-" && (
                                <div className="text-xs text-purple-600 flex items-center gap-1 mt-0.5">
                                  <FaBarcode size={9} />
                                  {serialNo}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Date / Shift */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 text-sm text-gray-700">
                            <FaCalendarAlt size={11} className="text-red-400" />
                            {auditDate !== "-"
                              ? formatDateForDisplay(auditDate)
                              : formatDateForDisplay(audit.createdAt)}
                          </div>
                          {shift !== "-" && (
                            <div className="text-xs text-orange-600 flex items-center gap-1 mt-1">
                              <FaClock size={10} />
                              {shift}
                            </div>
                          )}
                        </td>

                        {/* Results */}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-3">
                            {/* Pass */}
                            <div className="text-center">
                              <div className="flex items-center gap-1 text-green-600 justify-center">
                                <FaCheckCircle size={11} />
                                <span className="font-bold text-sm">
                                  {summary.pass}
                                </span>
                              </div>
                              <span className="text-xs text-gray-400 leading-none">
                                Pass
                              </span>
                            </div>
                            {/* Divider */}
                            <div className="w-px h-8 bg-gray-200" />
                            {/* Warning */}
                            <div className="text-center">
                              <div className="flex items-center gap-1 text-yellow-600 justify-center">
                                <FaExclamationTriangle size={11} />
                                <span className="font-bold text-sm">
                                  {summary.warning}
                                </span>
                              </div>
                              <span className="text-xs text-gray-400 leading-none">
                                Warn
                              </span>
                            </div>
                            {/* Divider */}
                            <div className="w-px h-8 bg-gray-200" />
                            {/* Fail */}
                            <div className="text-center">
                              <div className="flex items-center gap-1 text-red-600 justify-center">
                                <FaTimesCircle size={11} />
                                <span className="font-bold text-sm">
                                  {summary.fail}
                                </span>
                              </div>
                              <span className="text-xs text-gray-400 leading-none">
                                Fail
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Pass Rate */}
                        <td className="px-4 py-3 text-center">
                          {summary.total > 0 ? (
                            <div className="flex flex-col items-center">
                              <span
                                className={`text-base font-bold ${getPassRateColor(passRate)}`}
                              >
                                {passRate}%
                              </span>
                              <div className="w-20 h-2 bg-gray-200 rounded-full mt-1.5 overflow-hidden">
                                <div
                                  className={`h-2 rounded-full transition-all ${getPassRateBgColor(passRate)}`}
                                  style={{
                                    width: `${Math.min(passRate, 100)}%`,
                                  }}
                                />
                              </div>
                              <span className="text-xs text-gray-400 mt-1">
                                {summary.total} checks
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-300 text-sm">—</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3 text-center">
                          {getStatusBadge(audit.status)}
                          {audit.approvedBy && (
                            <div className="text-xs text-gray-400 mt-1">
                              by {audit.approvedBy}
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* View */}
                            <button
                              onClick={() =>
                                navigate(`/auditreport/audits/${audit.id}/view`)
                              }
                              className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-all"
                              title="View Audit"
                            >
                              <FaEye size={13} />
                            </button>
                            {/* Edit */}
                            {audit.status !== "approved" && (
                              <button
                                onClick={() =>
                                  navigate(`/auditreport/audits/${audit.id}`)
                                }
                                className="p-2 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg transition-all"
                                title="Edit Audit"
                              >
                                <FaEdit size={13} />
                              </button>
                            )}
                            {/* Delete */}
                            {audit.status !== "approved" && (
                              <button
                                onClick={() => confirmDelete(audit)}
                                className="p-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition-all"
                                title="Delete Audit"
                              >
                                <FaTrash size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Table Footer */}
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
              <span className="text-sm text-gray-500">
                Showing{" "}
                <span className="font-semibold text-gray-700">
                  {sortedAudits.length}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-gray-700">
                  {audits.length}
                </span>{" "}
                audits
              </span>
              {(searchTerm || filterStatus || filterTemplate) && (
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setFilterStatus("");
                    setFilterTemplate("");
                  }}
                  className="text-xs text-red-500 hover:text-red-700 underline"
                >
                  Clear all filters
                </button>
              )}
            </div>
          </div>
        )}

        {/* ==================== Delete Confirmation Modal ==================== */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              {/* Modal Header */}
              <div className="p-5 bg-gradient-to-r from-red-500 to-red-600 text-white">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <FaTrash size={15} /> Confirm Delete
                </h3>
                <p className="text-red-100 text-sm mt-1">
                  This action cannot be undone.
                </p>
              </div>

              {/* Modal Body */}
              <div className="p-6">
                <p className="text-gray-600 text-sm mb-3">
                  You are about to delete the following audit:
                </p>
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <p className="font-semibold text-gray-800">
                    {auditToDelete?.reportName}
                  </p>
                  {auditToDelete?.auditCode && (
                    <p className="text-xs text-gray-500 mt-1">
                      Code: {auditToDelete.auditCode}
                    </p>
                  )}
                </div>
                <div className="mt-4 flex items-start gap-2 text-red-600 bg-red-50 rounded-lg p-3">
                  <FaExclamationTriangle
                    className="mt-0.5 flex-shrink-0"
                    size={13}
                  />
                  <p className="text-xs font-medium">
                    All data associated with this audit will be permanently
                    deleted.
                  </p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setAuditToDelete(null);
                  }}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-lg font-medium text-sm disabled:opacity-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium text-sm disabled:opacity-50 flex items-center gap-2 transition-all"
                >
                  {actionLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <FaTrash size={11} /> Delete Audit
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditList;
