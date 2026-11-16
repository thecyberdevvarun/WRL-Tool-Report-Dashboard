import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";
import {
  FaCalendarAlt,
  FaClock,
  FaIdBadge,
  FaStickyNote,
  FaClipboardCheck,
  FaCheckCircle,
  FaTimesCircle,
  FaExclamationTriangle,
  FaArrowLeft,
  FaEdit,
  FaCheck,
  FaBan,
  FaBarcode,
  FaUserCheck,
  FaUserShield,
  FaImage,
  FaTimes,
  FaSearchPlus,
  FaDownload,
  FaFilePdf,
  FaFileExcel,
  FaSearch,
  FaFilter,
  FaChevronDown,
  FaChevronUp,
  FaCopy,
  FaPrint,
  FaHistory,
  FaShieldAlt,
  FaLink,
  FaCheckDouble,
  FaHourglassHalf,
} from "react-icons/fa";
import { MdFormatListNumbered, MdUpdate, MdDateRange } from "react-icons/md";
import { HiClipboardDocumentCheck } from "react-icons/hi2";
import { BiSolidFactory } from "react-icons/bi";
import { useSelector } from "react-redux";
import useAuditData from "../../../hooks/useAuditData.js";
import { ROLES } from "../../../config/routes.config.js";
import toast from "react-hot-toast";
import { baseURL } from "../../../assets/assets.js";
import {
  formatDateForDisplay,
  formatDateTimeForDisplay,
  formatDuration,
} from "../../../utils/dateUtils.js";
import { generateAuditPDF } from "../../../utils/generateAuditPDF.js";
import { generateAuditExcel } from "../../../utils/generateAuditExcel.js";
import { passRateOf, passRateLevel } from "../../../utils/auditPassRate.js";
import ReferenceDocs from "../components/common/ReferenceDocs";

// ==================== CONSTANTS ====================
const STATUS_CONFIG = {
  pass: {
    label: "Pass",
    icon: FaCheckCircle,
    bg: "bg-green-50",
    text: "text-green-700",
    border: "border-green-200",
    badge: "bg-green-100 text-green-700",
    rowBg: "bg-green-50/60",
  },
  fail: {
    label: "Fail",
    icon: FaTimesCircle,
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
    badge: "bg-red-100 text-red-700",
    rowBg: "bg-red-50/60",
  },
  warning: {
    label: "Warning",
    icon: FaExclamationTriangle,
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    badge: "bg-amber-100 text-amber-700",
    rowBg: "bg-amber-50/60",
  },
  na: {
    label: "N/A",
    icon: FaBan,
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    badge: "bg-blue-100 text-blue-700",
    rowBg: "bg-blue-50/40",
  },
  pending: {
    label: "Pending",
    icon: FaClipboardCheck,
    bg: "",
    text: "text-gray-600",
    border: "border-gray-200",
    badge: "bg-gray-100 text-gray-600",
    rowBg: "",
  },
};

const AUDIT_STATUS = {
  draft: {
    label: "Draft",
    bg: "bg-gray-100",
    text: "text-gray-700",
    dot: "bg-gray-400",
  },
  submitted: {
    label: "Submitted",
    bg: "bg-blue-50",
    text: "text-blue-700",
    dot: "bg-blue-500",
  },
  approved: {
    label: "Approved",
    bg: "bg-green-50",
    text: "text-green-700",
    dot: "bg-green-500",
  },
  rejected: {
    label: "Rejected",
    bg: "bg-red-50",
    text: "text-red-700",
    dot: "bg-red-500",
  },
  rework: {
    label: "Rework",
    bg: "bg-orange-50",
    text: "text-orange-700",
    dot: "bg-orange-500",
  },
};

// ==================== HELPERS ====================
const formatFileSize = (bytes) => {
  if (!bytes) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
};

const relativeTime = (dateStr) => {
  if (!dateStr) return "";
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return formatDateForDisplay(dateStr);
  } catch {
    return "";
  }
};

// ==================== SUB-COMPONENTS ====================
const CheckpointStatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.badge}`}
    >
      <Icon size={9} /> {cfg.label}
    </span>
  );
};

const AuditStatusBadge = ({ status, large }) => {
  const cfg = AUDIT_STATUS[status] || AUDIT_STATUS.submitted;
  return (
    <span
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full font-semibold ${large ? "text-sm" : "text-xs"} ${cfg.bg} ${cfg.text}`}
    >
      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
};

const MiniProgressBar = ({ pass, fail, warning, na, total }) => {
  if (!total) return null;
  return (
    <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex">
      {pass > 0 && (
        <div
          className="bg-green-400 h-full transition-all"
          style={{ width: `${(pass / total) * 100}%` }}
        />
      )}
      {warning > 0 && (
        <div
          className="bg-amber-400 h-full transition-all"
          style={{ width: `${(warning / total) * 100}%` }}
        />
      )}
      {fail > 0 && (
        <div
          className="bg-red-400   h-full transition-all"
          style={{ width: `${(fail / total) * 100}%` }}
        />
      )}
      {na > 0 && (
        <div
          className="bg-blue-300  h-full transition-all"
          style={{ width: `${(na / total) * 100}%` }}
        />
      )}
    </div>
  );
};

const FieldIcon = ({ fieldId }) => {
  const icons = {
    modelName: <BiSolidFactory className="text-indigo-500" />,
    serialNo: <FaBarcode className="text-purple-500" />,
    serial: <FaBarcode className="text-purple-500" />,
    date: <FaCalendarAlt className="text-red-400" />,
    shift: <FaClock className="text-amber-500" />,
    eid: <FaIdBadge className="text-teal-500" />,
  };
  return icons[fieldId] || <FaClipboardCheck className="text-gray-400" />;
};

// ==================== MAIN COMPONENT ====================
const AuditView = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { getAuditById, approveAudit, rejectAudit } = useAuditData();

  const { user } = useSelector((store) => store.auth);
  // Approve/Reject mirror the server rule: Line Quality Engineer or Super Admin.
  const isApprover = [ROLES.LINE_QUALITY_ENGINEER, ROLES.SUPER_ADMIN].includes(user?.roleName);

  const exportBtnRef = useRef(null);

  // Core state
  const [audit, setAudit] = useState(null);
  const [template, setTemplate] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Approval modal
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalAction, setApprovalAction] = useState("approve");
  const [approverName, setApproverName] = useState("");
  const [approvalComments, setApprovalComments] = useState("");

  // Image
  const [imagePreview, setImagePreview] = useState(null);

  // Export menu
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Section collapse
  const [collapsedSections, setCollapsedSections] = useState({});

  // Checkpoint filter
  const [cpFilter, setCpFilter] = useState("all");
  const [cpSearch, setCpSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Timeline panel
  const [showTimeline, setShowTimeline] = useState(false);

  // ==================== Keyboard shortcuts ====================
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") {
        setImagePreview(null);
        setShowApprovalModal(false);
        setShowExportMenu(false);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "p") {
        e.preventDefault();
        window.print();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Close export menu on outside click
  useEffect(() => {
    if (!showExportMenu) return;
    const handler = (e) => {
      if (exportBtnRef.current && !exportBtnRef.current.contains(e.target)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showExportMenu]);

  // ==================== Load audit ====================
  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setInitialLoading(true);
      try {
        const data = await getAuditById(id);
        if (data) {
          setAudit(data);
          setTemplate({
            columns: data.columns || [],
            infoFields: data.infoFields || [],
            headerConfig: data.headerConfig || {},
          });
        }
      } catch (err) {
        toast.error(`Failed to load audit: ${err.message}`);
        navigate("/auditreport/audits");
      } finally {
        setInitialLoading(false);
      }
    };
    load();
  }, [id, getAuditById, navigate]);

  // ==================== Approval ====================
  const openApprovalModal = (action) => {
    setApprovalAction(action);
    // Server records the logged-in user as approver; shown here for clarity.
    setApproverName(user?.name || user?.usercode || "");
    setApprovalComments("");
    setShowApprovalModal(true);
  };

  const handleApproval = async () => {
    if (!approverName.trim()) {
      toast.error("Approver name is required");
      return;
    }
    if (approvalAction === "reject" && !approvalComments.trim()) {
      toast.error("Rejection reason is required");
      return;
    }
    setActionLoading(true);
    try {
      const payload = { approverName, comments: approvalComments };
      const updated =
        approvalAction === "approve"
          ? await approveAudit(id, payload)
          : await rejectAudit(id, payload);
      setAudit(updated);
      setShowApprovalModal(false);
      toast.success(
        `Audit ${approvalAction === "approve" ? "approved ?" : "rejected"} successfully!`,
      );
    } catch (err) {
      toast.error(`Failed to ${approvalAction}: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // ==================== Summary ====================
  const getSummary = useCallback(() => {
    if (!audit)
      return { pass: 0, fail: 0, warning: 0, pending: 0, na: 0, total: 0 };

    if (audit.summary) {
      let s = audit.summary;
      if (typeof s === "string") {
        try {
          s = JSON.parse(s);
        } catch {
          s = null;
        }
      }
      if (s && typeof s === "object") {
        const p = Number(s.pass ?? s.Pass ?? 0);
        const f = Number(s.fail ?? s.Fail ?? 0);
        const w = Number(s.warning ?? s.Warning ?? 0);
        const n = Number(s.na ?? s.Na ?? s.NA ?? 0);
        const d = Number(s.pending ?? s.Pending ?? 0);
        return {
          pass: p,
          fail: f,
          warning: w,
          na: n,
          pending: d,
          total: Number(s.total ?? s.Total ?? p + f + w + n + d),
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
    if (!Array.isArray(sections))
      return { pass, fail, warning, pending, na, total: 0 };

    sections.forEach((section) => {
      if (!section) return;
      const cps = section.stages
        ? section.stages.flatMap((st) => st?.checkPoints || [])
        : section.checkPoints || [];
      cps.forEach((cp) => {
        if (!cp) return;
        const s = (cp.status || "pending").toLowerCase();
        if (s === "pass") pass++;
        else if (s === "fail") fail++;
        else if (s === "warning") warning++;
        else if (s === "na") na++;
        else pending++;
      });
    });
    return {
      pass,
      fail,
      warning,
      pending,
      na,
      total: pass + fail + warning + pending + na,
    };
  }, [audit]);

  const summary = useMemo(() => getSummary(), [getSummary]);
  const passRate = passRateOf(summary);

  // ==================== Info field value ====================
  const getInfoFieldValue = useCallback(
    (fieldId) => {
      if (!audit?.infoData) return "-";
      const alts = {
        serialNo: ["serialNo", "serial", "serialNumber"],
        modelName: ["modelName", "model", "modelVariant"],
        date: ["date", "auditDate", "reportDate"],
        shift: ["shift", "shiftName"],
        eid: ["eid", "employeeId", "auditorId"],
      };
      const keys = alts[fieldId] || [fieldId];
      for (const k of keys) {
        if (audit.infoData[k]) return audit.infoData[k];
      }
      return "-";
    },
    [audit],
  );

  // ==================== Section helpers ====================
  const getSectionStats = (section) => {
    let pass = 0,
      fail = 0,
      warning = 0,
      pending = 0,
      na = 0;
    const cps = section.stages
      ? section.stages.flatMap((st) => st?.checkPoints || [])
      : section.checkPoints || [];
    cps.forEach((cp) => {
      const s = (cp?.status || "pending").toLowerCase();
      if (s === "pass") pass++;
      else if (s === "fail") fail++;
      else if (s === "warning") warning++;
      else if (s === "na") na++;
      else pending++;
    });
    return {
      pass,
      fail,
      warning,
      pending,
      na,
      total: pass + fail + warning + pending + na,
    };
  };

  // ==================== Checkpoint filter ====================
  const matchesFilter = (cp) => {
    if (cpFilter !== "all" && (cp.status || "pending") !== cpFilter)
      return false;
    if (cpSearch) {
      const q = cpSearch.toLowerCase();
      return JSON.stringify(cp).toLowerCase().includes(q);
    }
    return true;
  };

  // ==================== Copy helpers ====================
  const copyToClipboard = (text, label) => {
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success(`${label} copied!`));
  };

  // ==================== Image cell ====================
  const renderImageViewCell = useCallback((column, checkpoint) => {
    const imageData = checkpoint[column.id];
    const isFilename = typeof imageData === "string" && imageData.length > 0;
    const isOldFormat =
      imageData && typeof imageData === "object" && imageData.data;

    if (isFilename || isOldFormat) {
      const imgSrc = isFilename
        ? `${baseURL}audit-report/images/${imageData}`
        : imageData.data;

      const preview = isFilename
        ? {
            name: imageData,
            fileName: imageData,
            data: null,
            size: null,
            uploadedAt: null,
          }
        : {
            name: imageData.name,
            fileName: imageData.name,
            data: imageData.data,
            size: imageData.size,
            uploadedAt: imageData.uploadedAt,
          };

      return (
        <td key={column.id} className="px-3 py-2 border-r border-gray-100">
          <div className="flex justify-center">
            <div
              className="relative group cursor-pointer"
              onClick={() => setImagePreview(preview)}
            >
              <img
                src={imgSrc}
                alt={preview.name || "img"}
                className="w-16 h-16 object-cover rounded-xl border-2 border-gray-200 group-hover:border-indigo-400 transition-all group-hover:shadow-lg"
                onError={(e) => {
                  e.target.src =
                    "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMiIgZmlsbD0iIzljYTNhZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkVycm9yPC90ZXh0Pjwvc3ZnPg==";
                }}
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 rounded-xl transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                <FaSearchPlus className="text-white" size={14} />
              </div>
            </div>
          </div>
        </td>
      );
    }

    return (
      <td key={column.id} className="px-3 py-2 border-r border-gray-100">
        <div className="flex justify-center">
          <span className="text-xs text-gray-300 italic flex items-center gap-1">
            <FaImage size={10} /> —
          </span>
        </div>
      </td>
    );
  }, []);

  // ==================== Export PDF ====================
  // Delegates to the same generateAuditPDF used by the Audit List's download
  // button — this page used to build its own plain, image-less PDF inline,
  // so the same audit produced a visibly different report depending on
  // where you exported it from.
  const handleExportPDF = useCallback(async () => {
    try {
      await generateAuditPDF(audit);
      toast.success("PDF exported!");
    } catch (err) {
      console.error(err);
      toast.error("PDF export failed.");
    }
  }, [audit]);

  // ==================== Export Excel ====================
  // One formatted sheet (logo, colored headers, checkpoint photos) via the
  // shared generateAuditExcel — replaces the old export, which used SheetJS
  // (`xlsx`) and therefore could not embed images at all, and split
  // everything across four bare, unstyled sheets.
  const handleExportExcel = useCallback(async () => {
    try {
      await generateAuditExcel(audit);
      toast.success("Excel exported!");
    } catch (err) {
      console.error(err);
      toast.error("Excel export failed.");
    }
  }, [audit]);

  // ==================== Timeline events ====================
  const timelineEvents = useMemo(() => {
    if (!audit) return [];
    const evs = [];
    if (audit.createdAt)
      evs.push({
        label: "Created",
        time: audit.createdAt,
        icon: FaClipboardCheck,
        color: "text-gray-500",
        bg: "bg-gray-100",
        by: audit.createdBy,
      });
    if (audit.submittedAt)
      evs.push({
        label: "Submitted",
        time: audit.submittedAt,
        icon: FaCheckDouble,
        color: "text-blue-600",
        bg: "bg-blue-100",
        by: audit.submittedBy,
      });
    if (audit.approvedAt && audit.status === "approved")
      evs.push({
        label: "Approved",
        time: audit.approvedAt,
        icon: FaCheckCircle,
        color: "text-green-600",
        bg: "bg-green-100",
        by: audit.approvedBy,
      });
    if (audit.approvedAt && audit.status === "rejected")
      evs.push({
        label: "Rejected",
        time: audit.approvedAt,
        icon: FaTimesCircle,
        color: "text-red-600",
        bg: "bg-red-100",
        by: audit.approvedBy,
      });
    if (
      audit.updatedAt &&
      audit.updatedAt !== audit.createdAt &&
      audit.updatedAt !== audit.submittedAt &&
      audit.updatedAt !== audit.approvedAt
    ) {
      evs.push({
        label: "Last Updated",
        time: audit.updatedAt,
        icon: FaHistory,
        color: "text-gray-400",
        bg: "bg-gray-50",
        by: null,
      });
    }
    return evs.sort((a, b) => new Date(a.time) - new Date(b.time));
  }, [audit]);

  // ==================== Loading / not found ====================
  if (initialLoading) {
    return (
      <div className="h-full bg-slate-100 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto" />
          <div>
            <p className="font-semibold text-gray-700">Loading Audit</p>
            <p className="text-sm text-gray-400 mt-1">Fetching report data…</p>
          </div>
        </div>
      </div>
    );
  }

  if (!audit) {
    return (
      <div className="h-full bg-slate-100 flex items-center justify-center">
        <div className="text-center bg-white rounded-2xl shadow-lg p-10 max-w-sm mx-4">
          <HiClipboardDocumentCheck className="text-5xl text-gray-200 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-700 mb-2">
            Audit Not Found
          </h2>
          <p className="text-sm text-gray-400 mb-6">
            The audit you're looking for doesn't exist or was deleted.
          </p>
          <button
            onClick={() => navigate("/auditreport/audits")}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md shadow-indigo-200 transition-all"
          >
            Back to Audits
          </button>
        </div>
      </div>
    );
  }

  const visibleColumns = (template?.columns || []).filter((c) => c.visible);
  const signatures = audit.signatures || {};
  const knownIds = new Set((template?.infoFields || []).map((f) => f.id));
  const aliasSet = new Set([
    "serial",
    "serialNo",
    "serialNumber",
    "model",
    "modelName",
    "modelCode",
    "modelVariant",
    "auditDate",
    "reportDate",
    "shiftName",
    "employeeId",
    "auditorId",
  ]);

  return (
    <div className="h-full overflow-y-auto bg-slate-100 font-sans">
      {/* ==================== IMAGE PREVIEW PORTAL ==================== */}
      {imagePreview &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 backdrop-blur-sm"
            style={{ zIndex: 99999 }}
            onClick={() => setImagePreview(null)}
          >
            <div
              className="relative bg-white rounded-2xl shadow-2xl overflow-hidden max-w-4xl w-full max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 bg-gray-900 text-white">
                <div className="flex items-center gap-2">
                  <FaImage className="text-indigo-400" />
                  <span className="font-semibold text-sm">
                    {imagePreview.name || imagePreview.fileName || "Image"}
                  </span>
                  {imagePreview.size && (
                    <span className="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded-full">
                      {formatFileSize(imagePreview.size)}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setImagePreview(null)}
                  className="p-1.5 hover:bg-gray-700 rounded-lg transition"
                >
                  <FaTimes size={14} />
                </button>
              </div>
              <div className="p-6 flex items-center justify-center bg-gray-50 min-h-[300px]">
                <img
                  src={
                    imagePreview.data
                      ? imagePreview.data
                      : `${baseURL}audit-report/images/${imagePreview.fileName}`
                  }
                  alt={imagePreview.name || "Preview"}
                  className="max-w-full max-h-[65vh] object-contain rounded-xl shadow-md"
                  onError={(e) => {
                    e.target.src =
                      "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iI2YxZjVmOSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNiIgZmlsbD0iI2NiZDVlMSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIG5vdCBmb3VuZDwvdGV4dD48L3N2Zz4=";
                  }}
                />
              </div>
              <div className="px-4 py-3 bg-white border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  {imagePreview.uploadedAt
                    ? `Uploaded: ${new Date(imagePreview.uploadedAt).toLocaleString()}`
                    : "Checkpoint image"}
                </span>
                <a
                  href={
                    imagePreview.data
                      ? imagePreview.data
                      : `${baseURL}audit-report/images/${imagePreview.fileName}/download`
                  }
                  download={
                    imagePreview.name || imagePreview.fileName || "image"
                  }
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition"
                >
                  <FaDownload size={11} /> Download
                </a>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* ==================== APPROVAL MODAL ==================== */}
      {showApprovalModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div
              className={`px-5 py-4 text-white ${approvalAction === "approve" ? "bg-gradient-to-r from-green-600 to-green-700" : "bg-gradient-to-r from-red-600 to-red-700"}`}
            >
              <h3 className="text-lg font-black flex items-center gap-2">
                {approvalAction === "approve" ? <FaCheck /> : <FaBan />}
                {approvalAction === "approve"
                  ? "Approve Audit"
                  : "Reject Audit"}
              </h3>
              <p className="text-sm opacity-80 mt-1">{audit.reportName}</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                  Approver
                </label>
                <input
                  type="text"
                  value={approverName}
                  readOnly
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-gray-600 outline-none text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                  {approvalAction === "reject" ? (
                    <>
                      Rejection Reason <span className="text-red-500">*</span>
                    </>
                  ) : (
                    "Comments (optional)"
                  )}
                </label>
                <textarea
                  value={approvalComments}
                  onChange={(e) => setApprovalComments(e.target.value)}
                  placeholder={
                    approvalAction === "reject"
                      ? "Describe why this audit is being rejected…"
                      : "Add any approval notes…"
                  }
                  rows={3}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none text-sm resize-none transition-all"
                />
              </div>
            </div>
            <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowApprovalModal(false)}
                disabled={actionLoading}
                className="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl font-semibold text-sm disabled:opacity-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleApproval}
                disabled={actionLoading}
                className={`px-5 py-2 text-white rounded-xl font-bold text-sm disabled:opacity-50 flex items-center gap-2 transition-all ${
                  approvalAction === "approve"
                    ? "bg-green-600 hover:bg-green-700 shadow-md shadow-green-200"
                    : "bg-red-600 hover:bg-red-700 shadow-md shadow-red-200"
                }`}
              >
                {actionLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{" "}
                    Processing…
                  </>
                ) : approvalAction === "approve" ? (
                  <>
                    <FaCheck size={12} /> Approve
                  </>
                ) : (
                  <>
                    <FaBan size={12} /> Reject
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== STICKY HEADER ==================== */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="px-4 py-3 w-full flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/auditreport/audits")}
              className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold transition-all"
            >
              <FaArrowLeft size={11} /> Back
            </button>
            <div className="flex items-center gap-2">
              <HiClipboardDocumentCheck className="text-xl text-indigo-600" />
              <div>
                <h1 className="text-sm font-black text-gray-800 leading-none">
                  View Audit
                </h1>
                <p className="text-xs text-gray-400 mt-0.5 leading-none truncate max-w-[200px]">
                  {audit.reportName}
                </p>
              </div>
            </div>
            <AuditStatusBadge status={audit.status} />

            {/* Sticky mini summary */}
            <div className="hidden lg:flex items-center gap-3 pl-3 border-l border-gray-200">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                <span className="font-bold text-green-700">{summary.pass}</span>
                <span className="text-gray-400">pass</span>
              </div>
              {summary.fail > 0 && (
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="w-2 h-2 rounded-full bg-red-400" />
                  <span className="font-bold text-red-600">{summary.fail}</span>
                  <span className="text-gray-400">fail</span>
                </div>
              )}
              <div
                className={`text-xs font-bold ${passRateLevel(passRate) === "good" ? "text-green-600" : passRateLevel(passRate) !== "poor" ? "text-amber-600" : "text-red-600"}`}
              >
                {passRate}% pass rate
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Timeline toggle */}
            <button
              onClick={() => setShowTimeline((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border transition-all ${
                showTimeline
                  ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                  : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
              }`}
              title="Activity Timeline"
            >
              <FaHistory size={12} />
              <span className="hidden sm:inline">Timeline</span>
            </button>

            {/* Copy link */}
            <button
              onClick={() => copyToClipboard(window.location.href, "Link")}
              className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl border border-gray-200 transition-all"
              title="Copy link"
            >
              <FaLink size={12} />
            </button>

            {/* Print */}
            <button
              onClick={() => window.print()}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl border border-gray-200 transition-all"
              title="Print (Ctrl+P)"
            >
              <FaPrint size={12} />
            </button>

            {/* Export and Edit for everyone; Approve/Reject for approvers only */}
            {(
              <>
                {/* Export dropdown */}
                <div className="relative" ref={exportBtnRef}>
                  <button
                    onClick={() => setShowExportMenu((v) => !v)}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold transition-all"
                  >
                    <FaDownload size={11} /> Export
                    <FaChevronDown
                      size={10}
                      className={`transition-transform ${showExportMenu ? "rotate-180" : ""}`}
                    />
                  </button>
                  {showExportMenu && (
                    <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-gray-200 z-30 overflow-hidden">
                      <button
                        onClick={() => { handleExportPDF(); setShowExportMenu(false); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-red-50 hover:text-red-700 transition-colors font-medium"
                      >
                        <FaFilePdf className="text-red-500 flex-shrink-0" /> Export as PDF
                      </button>
                      <div className="h-px bg-gray-100" />
                      <button
                        onClick={() => { handleExportExcel(); setShowExportMenu(false); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-green-50 hover:text-green-700 transition-colors font-medium"
                      >
                        <FaFileExcel className="text-green-500 flex-shrink-0" /> Export as Excel
                      </button>
                    </div>
                  )}
                </div>

                {audit.status !== "approved" && (
                  <button
                    onClick={() => navigate(`/auditreport/audits/${id}`)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-indigo-200"
                  >
                    <FaEdit size={11} /> Edit
                  </button>
                )}

                {audit.status === "submitted" && isApprover && (
                  <>
                    <button
                      onClick={() => openApprovalModal("approve")}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-green-200"
                    >
                      <FaCheck size={11} /> Approve
                    </button>
                    <button
                      onClick={() => openApprovalModal("reject")}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-red-200"
                    >
                      <FaBan size={11} /> Reject
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="w-full px-4 py-5 flex gap-4">
        {/* ==================== TIMELINE SIDEBAR ==================== */}
        {showTimeline && (
          <aside className="w-64 flex-shrink-0">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sticky top-[65px]">
              <h3 className="font-bold text-gray-800 text-sm mb-4 flex items-center gap-2">
                <FaHistory className="text-indigo-500" /> Activity Timeline
              </h3>
              <div className="relative">
                <div className="absolute left-3.5 top-0 bottom-0 w-0.5 bg-gray-100" />
                <div className="space-y-4">
                  {timelineEvents.map((ev, i) => {
                    const Icon = ev.icon;
                    return (
                      <div key={i} className="relative pl-9">
                        <div
                          className={`absolute left-0 w-7 h-7 rounded-full ${ev.bg} flex items-center justify-center flex-shrink-0`}
                        >
                          <Icon size={12} className={ev.color} />
                        </div>
                        <div>
                          <p className={`text-xs font-bold ${ev.color}`}>
                            {ev.label}
                          </p>
                          {ev.by && (
                            <p className="text-xs text-gray-500">{ev.by}</p>
                          )}
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {formatDateTimeForDisplay(ev.time)}
                          </p>
                          <p className="text-[10px] text-gray-300">
                            {relativeTime(ev.time)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  {timelineEvents.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-4">
                      No activity recorded
                    </p>
                  )}
                </div>
              </div>
            </div>
          </aside>
        )}

        {/* ==================== MAIN CONTENT ==================== */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* ==================== APPROVAL BANNER ==================== */}
          {(audit.status === "approved" || audit.status === "rejected") && (
            <div
              className={`rounded-2xl border px-5 py-4 flex items-start gap-4 ${
                audit.status === "approved"
                  ? "bg-green-50 border-green-200"
                  : "bg-red-50 border-red-200"
              }`}
            >
              <div
                className={`p-2 rounded-xl flex-shrink-0 ${audit.status === "approved" ? "bg-green-100" : "bg-red-100"}`}
              >
                {audit.status === "approved" ? (
                  <FaCheckCircle className="text-green-600 text-xl" />
                ) : (
                  <FaTimesCircle className="text-red-600 text-xl" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={`font-bold text-sm ${audit.status === "approved" ? "text-green-800" : "text-red-800"}`}
                >
                  {audit.status === "approved"
                    ? "Audit Approved"
                    : "Audit Rejected"}
                  {audit.approvedBy && (
                    <span className="font-normal"> by {audit.approvedBy}</span>
                  )}
                </p>
                {audit.approvedAt && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formatDateTimeForDisplay(audit.approvedAt)}
                  </p>
                )}
                {audit.approvalComments && (
                  <p className="text-sm text-gray-600 mt-2 bg-white rounded-lg px-3 py-2 border border-gray-200">
                    <span className="font-semibold">Comments:</span>{" "}
                    {audit.approvalComments}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ==================== REPORT CARD ==================== */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Header banner */}
            <div className="grid grid-cols-1 md:grid-cols-3 border-b border-gray-100">
              <div className="md:col-span-2 bg-gradient-to-br from-slate-800 to-indigo-900 p-7">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-white/10 rounded-xl flex-shrink-0">
                    <HiClipboardDocumentCheck className="text-3xl text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h1 className="text-2xl font-black text-white leading-tight truncate">
                      {audit.reportName || "Audit Report"}
                    </h1>
                    <p className="text-indigo-300 text-sm mt-1 flex items-center gap-2">
                      Template: {audit.templateName}
                      {audit.templateVersion && (
                        <span className="text-[10px] bg-white/10 text-indigo-200 px-2 py-0.5 rounded-full font-semibold">
                          v{audit.templateVersion}
                        </span>
                      )}
                    </p>
                    {audit.auditCode && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs bg-white/10 text-indigo-200 px-2.5 py-1 rounded-full font-mono">
                          {audit.auditCode}
                        </span>
                        <button
                          onClick={() =>
                            copyToClipboard(audit.auditCode, "Audit code")
                          }
                          className="text-indigo-400 hover:text-white transition"
                          title="Copy code"
                        >
                          <FaCopy size={11} />
                        </button>
                      </div>
                    )}
                    {/* BOM Sheet / CRF this audit was carried out against */}
                    {(audit.bomFileName || audit.crfFileName) && (
                      <div className="mt-2 [&_span]:text-indigo-200">
                        <ReferenceDocs docs={audit} compact />
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-3">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          passRateLevel(passRate) === "good"
                            ? "bg-green-500/20 text-green-300"
                            : passRateLevel(passRate) !== "poor"
                              ? "bg-amber-500/20 text-amber-300"
                              : "bg-red-500/20 text-red-300"
                        }`}
                      >
                        {passRate}% Pass Rate
                      </span>
                      <span className="text-xs text-white/50">
                        {summary.total} checkpoints
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Two columns from lg up so the details don't stretch the
                  title panel into a tall empty block. */}
              <div className="bg-gray-50 grid grid-cols-1 lg:grid-cols-2 content-start">
                {template?.headerConfig?.showFormatNo !== false && (
                  <div className="p-3.5 flex items-center gap-3 border-b border-gray-100 lg:odd:border-r">
                    <MdFormatListNumbered className="text-xl text-indigo-500 flex-shrink-0" />
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase tracking-widest block">
                        Format No
                      </span>
                      <span className="font-bold text-gray-700 text-sm">
                        {audit.formatNo || "—"}
                      </span>
                    </div>
                  </div>
                )}
                {template?.headerConfig?.showRevNo !== false && (
                  <div className="p-3.5 flex items-center gap-3 border-b border-gray-100 lg:odd:border-r">
                    <MdUpdate className="text-xl text-green-500 flex-shrink-0" />
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase tracking-widest block">
                        Rev. No
                      </span>
                      <span className="font-bold text-gray-700 text-sm">
                        {audit.revNo || "—"}
                      </span>
                    </div>
                  </div>
                )}
                {template?.headerConfig?.showRevDate !== false && (
                  <div className="p-3.5 flex items-center gap-3 border-b border-gray-100 lg:odd:border-r">
                    <MdDateRange className="text-xl text-purple-500 flex-shrink-0" />
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase tracking-widest block">
                        Rev. Date
                      </span>
                      <span className="font-bold text-gray-700 text-sm">
                        {formatDateForDisplay(audit.revDate) || "—"}
                      </span>
                    </div>
                  </div>
                )}
                {audit.startedAt && (
                  <div className="p-3.5 flex items-center gap-3 border-b border-gray-100 lg:odd:border-r">
                    <FaClock className="text-xl text-indigo-500 flex-shrink-0" />
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase tracking-widest block">
                        Start Time
                      </span>
                      <span className="font-bold text-gray-700 text-sm">
                        {formatDateTimeForDisplay(audit.startedAt)}
                      </span>
                    </div>
                  </div>
                )}
                {audit.submittedAt && (
                  <div className="p-3.5 flex items-center gap-3 border-b border-gray-100 lg:odd:border-r">
                    <FaCheckCircle className="text-xl text-emerald-500 flex-shrink-0" />
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase tracking-widest block">
                        Completed Time
                      </span>
                      <span className="font-bold text-gray-700 text-sm">
                        {formatDateTimeForDisplay(audit.submittedAt)}
                      </span>
                    </div>
                  </div>
                )}
                {audit.startedAt && audit.submittedAt && (
                  <div className="p-3.5 flex items-center gap-3 border-b border-gray-100 lg:odd:border-r">
                    <FaHourglassHalf className="text-xl text-purple-500 flex-shrink-0" />
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase tracking-widest block">
                        Total Time
                      </span>
                      <span className="font-bold text-gray-700 text-sm">
                        {formatDuration(audit.startedAt, audit.submittedAt)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Info fields */}
            <div className="grid grid-cols-2 md:grid-cols-4 border-b border-gray-100 bg-white">
              {template?.infoFields
                ?.filter((f) => f.visible)
                .map((field, i, arr) => (
                  <div
                    key={field.id}
                    className={`p-4 ${i < arr.length - 1 ? "border-r" : ""} border-gray-100`}
                  >
                    <div className="flex items-center gap-1.5 mb-2">
                      <FieldIcon fieldId={field.id} />
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        {field.name}
                      </span>
                    </div>
                    <span className="font-bold text-gray-800 text-sm block">
                      {field.id === "date"
                        ? formatDateForDisplay(getInfoFieldValue(field.id))
                        : getInfoFieldValue(field.id)}
                    </span>
                    {field.id === "modelName" && audit.infoData?.modelCode && (
                      <span className="text-xs text-indigo-500 mt-1 block">
                        Code: {audit.infoData.modelCode}
                      </span>
                    )}
                  </div>
                ))}
            </div>

            {/* Extra info data */}
            {audit.infoData &&
              (() => {
                const extras = Object.entries(audit.infoData).filter(
                  ([k, v]) => v && !knownIds.has(k) && !aliasSet.has(k),
                );
                if (!extras.length) return null;
                return (
                  <div className="p-4 border-b border-gray-100 bg-indigo-50/30">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                      Additional Information
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {extras.map(([k, v]) => (
                        <div
                          key={k}
                          className="bg-white rounded-xl border border-gray-100 p-3"
                        >
                          <span className="text-[10px] text-gray-400 uppercase tracking-wide block">
                            {k.replace(/([A-Z])/g, " $1").trim()}
                          </span>
                          <span className="font-semibold text-gray-800 text-sm">
                            {v}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

            {/* Notes */}
            <div className="p-4 border-b border-gray-100 bg-amber-50/50">
              <div className="flex items-center gap-2 mb-2">
                <FaStickyNote className="text-amber-500" />
                <span className="font-semibold text-gray-700 text-sm">
                  Notes
                </span>
              </div>
              <p className="text-gray-600 text-sm pl-5 leading-relaxed">
                {audit.notes || (
                  <span className="text-gray-300 italic">No notes added.</span>
                )}
              </p>
            </div>

            {/* ==================== CHECKPOINT FILTER BAR ==================== */}
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowFilters((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  showFilters || cpFilter !== "all" || cpSearch
                    ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                    : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                }`}
              >
                <FaFilter size={10} /> Filters
                {(cpFilter !== "all" || cpSearch) && (
                  <span className="w-2 h-2 rounded-full bg-indigo-500" />
                )}
              </button>

              {showFilters && (
                <>
                  <div className="relative">
                    <FaSearch
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300"
                      size={10}
                    />
                    <input
                      type="text"
                      placeholder="Search checkpoints…"
                      value={cpSearch}
                      onChange={(e) => setCpSearch(e.target.value)}
                      className="pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-xl focus:border-indigo-400 outline-none w-48"
                    />
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    {["all", "pass", "fail", "warning", "na", "pending"].map(
                      (f) => (
                        <button
                          key={f}
                          onClick={() => setCpFilter(f)}
                          className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                            cpFilter === f
                              ? f === "all"
                                ? "bg-slate-800 text-white"
                                : `${STATUS_CONFIG[f]?.badge}`
                              : "bg-white text-gray-500 border border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          {f === "all" ? "All" : STATUS_CONFIG[f]?.label}
                        </button>
                      ),
                    )}
                    {(cpFilter !== "all" || cpSearch) && (
                      <button
                        onClick={() => {
                          setCpFilter("all");
                          setCpSearch("");
                        }}
                        className="px-2 py-1 text-xs text-red-500 hover:text-red-700 rounded-lg transition"
                      >
                        <FaTimes size={10} />
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* ==================== SECTIONS + TABLE ==================== */}
            {audit.sections?.map((section) => {
              const hasStages = section.stages && Array.isArray(section.stages);
              const isCollapsed = collapsedSections[section.id];
              // Stage-based sections show the section as the bar above the table and
              // draw no Section cell, so the header must skip that column too —
              // otherwise every value sits one column to the right of its heading.
              // Old flat sections still draw a (row-spanning) Section cell.
              const sectionColumns = section.stages
                ? visibleColumns.filter((c) => c.id !== "section")
                : visibleColumns;
              const stats = getSectionStats(section);
              const sPct =
                stats.total > 0
                  ? Math.round(
                      ((stats.pass + stats.fail + stats.warning + stats.na) /
                        stats.total) *
                        100,
                    )
                  : 0;

              return (
                <div
                  key={section.id}
                  className="border-b border-gray-100 last:border-b-0"
                >
                  {/* Section header */}
                  <div className="flex items-center justify-between px-4 py-2.5 bg-slate-700 text-white sticky top-[57px] z-20">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <button
                        onClick={() =>
                          setCollapsedSections((prev) => ({
                            ...prev,
                            [section.id]: !prev[section.id],
                          }))
                        }
                        className="p-1 hover:bg-white/10 rounded transition flex-shrink-0"
                      >
                        {isCollapsed ? (
                          <FaChevronDown size={11} />
                        ) : (
                          <FaChevronUp size={11} />
                        )}
                      </button>
                      <span className="font-bold text-sm truncate">
                        {section.sectionName || "Unnamed Section"}
                      </span>
                      <div className="hidden sm:flex items-center gap-1.5 text-xs flex-shrink-0">
                        {stats.pass > 0 && (
                          <span className="bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full">
                            {stats.pass}?
                          </span>
                        )}
                        {stats.fail > 0 && (
                          <span className="bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full">
                            {stats.fail}?
                          </span>
                        )}
                        {stats.warning > 0 && (
                          <span className="bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full">
                            {stats.warning}!
                          </span>
                        )}
                        {stats.pending > 0 && (
                          <span className="bg-white/10 text-slate-300 px-2 py-0.5 rounded-full">
                            {stats.pending} pending
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-slate-400 flex-shrink-0">
                      {sPct}%
                    </span>
                  </div>

                  {isCollapsed && (
                    <div className="px-4 py-2 bg-slate-50 text-xs text-gray-400 flex items-center justify-between">
                      <span>{stats.total} checkpoints hidden</span>
                      <span>{sPct}% complete</span>
                    </div>
                  )}

                  {!isCollapsed && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            {sectionColumns.map((col) => (
                              <th
                                key={col.id}
                                className={`px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide border-r border-gray-200 last:border-r-0 whitespace-nowrap ${col.width || ""} ${
                                  col.type === "image"
                                    ? "text-pink-600 bg-pink-50"
                                    : "text-gray-500"
                                }`}
                              >
                                <div className="flex items-center gap-1">
                                  {col.type === "image" && (
                                    <FaImage
                                      size={10}
                                      className="text-pink-400"
                                    />
                                  )}
                                  {col.name}
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {hasStages
                            ? section.stages.map((stage) => {
                                const filteredCPs = (
                                  stage.checkPoints || []
                                ).filter(matchesFilter);
                                if (!filteredCPs.length) return null;
                                let stageRendered = false;

                                return filteredCPs.map((checkpoint, cpIdx) => {
                                  const showStage =
                                    !stageRendered && cpIdx === 0;
                                  if (showStage) stageRendered = true;
                                  const statusCfg =
                                    STATUS_CONFIG[checkpoint.status] ||
                                    STATUS_CONFIG.pending;

                                  return (
                                    <tr
                                      key={`${stage.id || "s"}-${checkpoint.id || cpIdx}`}
                                      className={`border-b border-gray-100 last:border-b-0 hover:bg-slate-50/80 transition-colors ${statusCfg.rowBg}`}
                                    >
                                      {sectionColumns.map((col) => {
                                        if (col.id === "section") return null;

                                        if (col.id === "stage") {
                                          if (showStage) {
                                            return (
                                              <td
                                                key={col.id}
                                                rowSpan={filteredCPs.length}
                                                className="px-3 py-2 font-semibold text-indigo-800 bg-indigo-50/60 border-r border-gray-200 text-center align-middle"
                                              >
                                                <span className="text-xs">
                                                  {stage.stageName || "—"}
                                                </span>
                                              </td>
                                            );
                                          }
                                          return null;
                                        }

                                        if (col.type === "image")
                                          return renderImageViewCell(
                                            col,
                                            checkpoint,
                                          );

                                        if (col.id === "status") {
                                          return (
                                            <td
                                              key={col.id}
                                              className="px-3 py-2 border-r border-gray-100"
                                            >
                                              <CheckpointStatusBadge
                                                status={checkpoint.status}
                                              />
                                            </td>
                                          );
                                        }

                                        return (
                                          <td
                                            key={col.id}
                                            className="px-3 py-2 border-r border-gray-100 last:border-r-0"
                                          >
                                            <span className="text-gray-700 text-xs">
                                              {checkpoint[col.id] || "—"}
                                            </span>
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  );
                                });
                              })
                            : (section.checkPoints || [])
                                .filter(matchesFilter)
                                .map((checkpoint, cpIdx) => {
                                  const statusCfg =
                                    STATUS_CONFIG[checkpoint.status] ||
                                    STATUS_CONFIG.pending;
                                  return (
                                    <tr
                                      key={`${checkpoint.id || cpIdx}`}
                                      className={`border-b border-gray-100 last:border-b-0 hover:bg-slate-50/80 transition-colors ${statusCfg.rowBg}`}
                                    >
                                      {sectionColumns.map((col) => {
                                        if (col.id === "section") {
                                          if (cpIdx === 0) {
                                            return (
                                              <td
                                                key={col.id}
                                                rowSpan={
                                                  (
                                                    section.checkPoints || []
                                                  ).filter(matchesFilter).length
                                                }
                                                className="px-3 py-2 font-semibold text-gray-700 bg-gray-50 border-r border-gray-200 text-center align-middle"
                                              >
                                                <span className="text-xs">
                                                  {section.sectionName || "—"}
                                                </span>
                                              </td>
                                            );
                                          }
                                          return null;
                                        }
                                        if (col.type === "image")
                                          return renderImageViewCell(
                                            col,
                                            checkpoint,
                                          );
                                        if (col.id === "status") {
                                          return (
                                            <td
                                              key={col.id}
                                              className="px-3 py-2 border-r border-gray-100"
                                            >
                                              <CheckpointStatusBadge
                                                status={checkpoint.status}
                                              />
                                            </td>
                                          );
                                        }
                                        return (
                                          <td
                                            key={col.id}
                                            className="px-3 py-2 border-r border-gray-100 last:border-r-0"
                                          >
                                            <span className="text-gray-700 text-xs">
                                              {checkpoint[col.id] || "—"}
                                            </span>
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  );
                                })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}

            {(!audit.sections || audit.sections.length === 0) && (
              <div className="p-12 text-center">
                <FaClipboardCheck className="text-4xl text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">
                  No checkpoint data available
                </p>
              </div>
            )}

            {/* ==================== SUMMARY ==================== */}
            <div className="p-5 bg-gray-50 border-t border-gray-200">
              <h3 className="font-bold text-gray-700 mb-4 text-sm flex items-center gap-2">
                <FaClipboardCheck className="text-indigo-500" /> Audit Summary
              </h3>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                {[
                  {
                    key: "total",
                    label: "Total",
                    bg: "bg-white",
                    border: "border-gray-200",
                    color: "text-gray-800",
                    icon: null,
                  },
                  {
                    key: "pass",
                    label: "Passed",
                    bg: "bg-green-50",
                    border: "border-green-200",
                    color: "text-green-700",
                    icon: FaCheckCircle,
                  },
                  {
                    key: "warning",
                    label: "Warnings",
                    bg: "bg-amber-50",
                    border: "border-amber-200",
                    color: "text-amber-700",
                    icon: FaExclamationTriangle,
                  },
                  {
                    key: "fail",
                    label: "Failed",
                    bg: "bg-red-50",
                    border: "border-red-200",
                    color: "text-red-700",
                    icon: FaTimesCircle,
                  },
                  {
                    key: "na",
                    label: "N/A",
                    bg: "bg-blue-50",
                    border: "border-blue-200",
                    color: "text-blue-700",
                    icon: FaBan,
                  },
                  {
                    key: "pending",
                    label: "Pending",
                    bg: "bg-gray-50",
                    border: "border-gray-200",
                    color: "text-gray-500",
                    icon: null,
                  },
                ].map(({ key, label, bg, border, color, icon: Icon }) => (
                  <div
                    key={key}
                    className={`${bg} rounded-xl p-3.5 text-center border ${border} shadow-sm`}
                  >
                    <div
                      className={`text-2xl font-black ${color} flex items-center justify-center gap-1`}
                    >
                      {Icon && <Icon size={14} />} {summary[key]}
                    </div>
                    <span className="text-xs text-gray-400 mt-1 block">
                      {label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Stacked bar */}
              {summary.total > 0 && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-gray-500">
                      Overall Progress
                    </span>
                    <span
                      className={`text-sm font-black ${passRateLevel(passRate) === "good" ? "text-green-600" : passRateLevel(passRate) !== "poor" ? "text-amber-600" : "text-red-600"}`}
                    >
                      {passRate}% pass rate
                    </span>
                  </div>
                  <MiniProgressBar {...summary} />
                  <div className="flex items-center gap-4 mt-2">
                    {[
                      ["bg-green-400", "Pass"],
                      ["bg-amber-400", "Warning"],
                      ["bg-red-400", "Fail"],
                      ["bg-blue-300", "N/A"],
                      ["bg-gray-200", "Pending"],
                    ].map(([c, l]) => (
                      <span
                        key={l}
                        className="flex items-center gap-1 text-[10px] text-gray-400"
                      >
                        <span className={`w-2 h-2 rounded-full ${c}`} />
                        {l}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ==================== SIGNATURES ==================== */}
            <div className="grid grid-cols-1 md:grid-cols-2 border-t border-gray-100">
              {[
                {
                  role: "auditor",
                  label: "Auditor Signature",
                  icon: FaUserCheck,
                  color: "text-indigo-600",
                  name: signatures.auditor?.name || audit.createdBy,
                  date: signatures.auditor?.date || audit.createdAt,
                },
                {
                  role: "approver",
                  label: "Approved By",
                  icon: FaUserShield,
                  color: "text-purple-600",
                  name: audit.approvedBy || signatures.approver?.name,
                  date: audit.approvedAt || signatures.approver?.date,
                },
              ].map(({ role, label, icon: Icon, color, name, date }, i) => (
                <div
                  key={role}
                  className={`p-6 ${i === 0 ? "border-r border-gray-100" : ""}`}
                >
                  <div className="flex items-center gap-2 mb-5 justify-center">
                    <Icon className={`text-lg ${color}`} />
                    <span className="text-sm font-bold text-gray-700">
                      {label}
                    </span>
                  </div>
                  <div className="text-center">
                    <div className="border-b-2 border-gray-300 w-3/4 mx-auto pb-6 mb-3 min-h-[50px] flex items-end justify-center">
                      <span className="text-gray-800 font-semibold text-lg">
                        {name || ""}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400">
                      {date ? formatDateForDisplay(date) : "Not signed"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ==================== METADATA FOOTER ==================== */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-5">
              <FaShieldAlt className="text-slate-400" />
              <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
                Audit Metadata
              </h4>
              <div className="h-px flex-1 bg-gray-100" />
              <button
                onClick={() => copyToClipboard(String(audit.id), "Audit ID")}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-indigo-600 transition"
              >
                <FaCopy size={10} /> Copy ID
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-5">
              {[
                { label: "Audit ID", value: audit.id, mono: true },
                { label: "Audit Code", value: audit.auditCode },
                { label: "Template ID", value: audit.templateId, mono: true },
                { label: "Created By", value: audit.createdBy },
                {
                  label: "Created At",
                  value: formatDateTimeForDisplay(audit.createdAt),
                },
                {
                  label: "Last Updated",
                  value: formatDateTimeForDisplay(audit.updatedAt),
                },
                audit.submittedBy && {
                  label: "Submitted By",
                  value: audit.submittedBy,
                },
                audit.startedAt && {
                  label: "Start Time",
                  value: formatDateTimeForDisplay(audit.startedAt),
                },
                audit.submittedAt && {
                  label: "Completed Time",
                  value: formatDateTimeForDisplay(audit.submittedAt),
                },
                audit.startedAt && audit.submittedAt && {
                  label: "Total Time",
                  value: formatDuration(audit.startedAt, audit.submittedAt),
                },
              ]
                .filter(Boolean)
                .map(({ label, value, mono }) => (
                  <div key={label} className="space-y-1">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                      {label}
                    </p>
                    <p
                      className={`text-gray-800 ${mono ? "font-mono text-xs break-all text-gray-500" : "font-semibold text-sm"}`}
                    >
                      {value || "—"}
                    </p>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuditView;
