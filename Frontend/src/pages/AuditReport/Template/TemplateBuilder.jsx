import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  FaFileAlt,
  FaPlus,
  FaTrash,
  FaSave,
  FaArrowUp,
  FaArrowDown,
  FaEye,
  FaEyeSlash,
  FaColumns,
  FaTimes,
  FaCopy,
  FaGripVertical,
  FaInfoCircle,
  FaImage,
  FaChevronDown,
  FaChevronUp,
  FaArrowLeft,
  FaLayerGroup,
  FaClipboardList,
  FaCheckDouble,
  FaKeyboard,
  FaCloudUploadAlt,
  FaTags,
  FaSearch,
  FaToggleOn,
  FaToggleOff,
  FaDownload,
  FaUpload,
  FaTable,
  FaHistory,
  FaLock,
  FaBook,
} from "react-icons/fa";
import { MdAddCircle, MdOutlineFactCheck, MdDragIndicator } from "react-icons/md";
import { HiClipboardDocumentCheck } from "react-icons/hi2";
import { BiSolidFactory } from "react-icons/bi";
import useAuditData from "../../../hooks/useAuditData";
import toast from "react-hot-toast";
import { ROLES } from "../../../config/routes.config";
import TemplateHistoryPanel from "./components/TemplateHistoryPanel";
import { selectCheckpointLibrary } from "../../../redux/slices/masterConfigSlice";
import { useAddCheckpointLibraryEntryMutation, useIncrementCheckpointUsageMutation } from "../../../redux/api/masterConfigApi";
import { DEFAULT_IMAGE_CAPTURE_ITEMS } from "../constants/imageCapture.js";
import ReferenceDocs from "../components/common/ReferenceDocs";

// ── Highlight matching text in search results ─────────────────────────────────
const Highlight = ({ text = "", query = "" }) => {
  if (!query || !text) return <span>{text}</span>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <span>{text}</span>;
  return (
    <span>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 text-yellow-900 rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </span>
  );
};

// ==================== STABLE ID GENERATOR ====================
// UUIDs are permanent across edits/versions — never regenerated for existing
// sections/stages/checkpoints, only assigned to brand-new ones.
// crypto.randomUUID() only exists in secure contexts (HTTPS/localhost); this
// dashboard is often accessed over plain HTTP on a LAN IP, so fall back to
// crypto.getRandomValues (unrestricted) and finally Math.random.
const genId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0"));
    return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
};

// ==================== DEFAULT STATE FACTORIES ====================
const makeCheckpoint = () => ({
  id: genId(), checkPoint: "", method: "", specification: "", required: false,
});
const makeStage = () => ({
  id: genId(), stageName: "",
  checkPoints: [makeCheckpoint()],
});
const makeSection = () => ({
  id: genId(), sectionName: "", sectionType: "checklist",
  stages: [makeStage()],
});

// Image Capture is not one of many interchangeable sections — it's a single
// fixed area pinned to the end of the template, under its own "Image
// Capture" header. Every template gets exactly one (ensureImageCaptureSection
// below guarantees that), independent of how many checklist sections exist.
const makeImageCaptureSection = () => ({
  id: genId(), sectionName: "Image Capture", sectionType: "imageCapture",
  stages: [{
    id: genId(), stageName: "Photos",
    checkPoints: DEFAULT_IMAGE_CAPTURE_ITEMS.map((name) => ({
      id: genId(), checkPoint: name, method: "", specification: "", required: true,
    })),
  }],
});

const ensureImageCaptureSection = (sections) =>
  sections.some((s) => s.sectionType === "imageCapture")
    ? sections
    : [...sections, makeImageCaptureSection()];

// ==================== CONSTANTS ====================
const DEFAULT_COLUMNS = [
  { id: "section",       name: "Section",              visible: true, required: true,  width: "w-32", type: "text",   isGroupColumn: true  },
  { id: "stage",         name: "Stage",                visible: true, required: true,  width: "w-32", type: "text",   isGroupColumn: true  },
  { id: "checkPoint",    name: "Check Points",         visible: true, required: false, width: "w-40", type: "text"   },
  { id: "method",        name: "Method of Inspection", visible: true, required: false, width: "w-40", type: "text"   },
  { id: "specification", name: "Specifications",       visible: true, required: false, width: "w-48", type: "text"   },
  { id: "observation",   name: "Observations",         visible: true, required: false, width: "w-40", type: "text",   entryField: true },
  { id: "image",         name: "Image",                visible: true, required: false, width: "w-36", type: "image",  entryField: true },
  { id: "remark",        name: "Remark",               visible: true, required: false, width: "w-40", type: "text",   entryField: true },
  { id: "status",        name: "Status",               visible: true, required: false, width: "w-28", type: "status", entryField: true },
];

const DEFAULT_INFO_FIELDS = [
  { id: "modelName", name: "Model Name", type: "text",   required: true,  visible: true },
  { id: "date",      name: "Date",       type: "date",   required: true,  visible: true },
  { id: "shift",     name: "Shift",      type: "select", required: true,  visible: true, options: ["Day Shift", "Night Shift"] },
  { id: "serial",    name: "Serial No.", type: "text",   required: true,  visible: true },
];

const COLUMN_WIDTHS = ["w-20","w-24","w-28","w-32","w-36","w-40","w-48","w-56","w-64","w-80"];

const FIELD_TYPES = ["text","date","select","number","time"];
const COLUMN_TYPES = ["text","number","status","date","image"];
const CATEGORIES = [
  { value: "",         label: "Select Category"  },
  { value: "process",  label: "Process Audit"    },
  { value: "quality",  label: "Quality Audit"    },
  { value: "safety",   label: "Safety Audit"     },
  { value: "other",    label: "Other"            },
];

const APPROVAL_STATUS = {
  DRAFT: "draft",
  PENDING_APPROVAL: "pending_approval",
  APPROVED: "approved",
  REJECTED: "rejected",
};

const APPROVAL_STATUS_LABELS = {
  draft: "Draft",
  pending_approval: "Pending Approval",
  approved: "Approved",
  rejected: "Rejected",
};

const APPROVAL_STATUS_COLORS = {
  draft: "bg-gray-100 text-gray-700 border-gray-300",
  pending_approval: "bg-amber-100 text-amber-700 border-amber-300",
  approved: "bg-green-100 text-green-700 border-green-300",
  rejected: "bg-red-100 text-red-700 border-red-300",
};

// ==================== SUB-COMPONENTS ====================
const Badge = ({ children, color = "gray" }) => {
  const colors = {
    blue:   "bg-blue-100 text-blue-700 border-blue-200",
    green:  "bg-green-100 text-green-700 border-green-200",
    orange: "bg-orange-100 text-orange-700 border-orange-200",
    pink:   "bg-pink-100 text-pink-700 border-pink-200",
    purple: "bg-purple-100 text-purple-700 border-purple-200",
    gray:   "bg-gray-100 text-gray-600 border-gray-200",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${colors[color]}`}>
      {children}
    </span>
  );
};

const StatCard = ({ icon: Icon, label, value, color }) => (
  <div className={`flex items-center gap-3 bg-white rounded-xl border px-4 py-3 shadow-sm ${color}`}>
    <Icon className="text-lg flex-shrink-0" />
    <div>
      <div className="text-xl font-black text-gray-800 leading-none">{value}</div>
      <div className="text-xs text-gray-400 mt-0.5">{label}</div>
    </div>
  </div>
);

const IconBtn = ({ icon: Icon, onClick, title, disabled, color = "gray", size = 11 }) => {
  const colors = {
    gray:   "bg-gray-100 hover:bg-gray-200 text-gray-500",
    blue:   "bg-blue-100 hover:bg-blue-200 text-blue-600",
    green:  "bg-green-100 hover:bg-green-200 text-green-600",
    red:    "bg-red-100 hover:bg-red-200 text-red-600",
    purple: "bg-purple-100 hover:bg-purple-200 text-purple-600",
    indigo: "bg-indigo-100 hover:bg-indigo-200 text-indigo-600",
    amber:  "bg-amber-100 hover:bg-amber-200 text-amber-600",
  };
  return (
    <button onClick={onClick} title={title} disabled={disabled}
      className={`p-1.5 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0 ${colors[color]}`}>
      <Icon size={size} />
    </button>
  );
};

// ==================== MAIN COMPONENT ====================
const TemplateBuilder = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const { user } = useSelector((store) => store.auth);
  const checkpointLibrary = useSelector(selectCheckpointLibrary);
  const [addCheckpointLibraryEntry] = useAddCheckpointLibraryEntryMutation();
  const [incrementCheckpointUsage] = useIncrementCheckpointUsageMutation();
  const { createTemplate, createTemplateVersion, updateTemplate, getTemplateById, uploadTemplateDocument, removeTemplateDocument } = useAuditData();
  // BOM Sheet / CRF of a saved template (uploaded independently of versions).
  const [refDocs, setRefDocs] = useState(null);
  const [docBusy, setDocBusy] = useState(null);
  const docLabel = (kind) => (kind === "bom" ? "BOM Sheet" : "CRF");
  const handleDocUpload = async (kind, file) => {
    if (file.size > 20 * 1024 * 1024) { toast.error("File is larger than 20 MB"); return; }
    setDocBusy(kind);
    try {
      setRefDocs(await uploadTemplateDocument(id, kind, file));
      toast.success(`${docLabel(kind)} uploaded`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDocBusy(null);
    }
  };
  const handleDocRemove = async (kind) => {
    if (!window.confirm(`Remove the ${docLabel(kind)} from this template? Audits already started keep their copy.`)) return;
    setDocBusy(kind);
    try {
      setRefDocs(await removeTemplateDocument(id, kind));
      toast.success(`${docLabel(kind)} removed`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDocBusy(null);
    }
  };

  const [showColumnManager, setShowColumnManager] = useState(false);
  const [showInfoFieldManager, setShowInfoFieldManager] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [newColumn, setNewColumn] = useState({ name: "", type: "text" });
  const [sectionSearch, setSectionSearch] = useState("");
  const [collapsedSections, setCollapsedSections] = useState({});
  const [collapsedStages, setCollapsedStages] = useState({});
  const [hasDraft, setHasDraft] = useState(false);
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [excelPreview, setExcelPreview]     = useState(null); // { sections, totalCPs }
  const [showReviewHistory, setShowReviewHistory] = useState(false);
  const [unlockedForEdit, setUnlockedForEdit] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [libraryPicker, setLibraryPicker] = useState(null); // { sectionId, stageId } | null
  const [librarySearch, setLibrarySearch] = useState("");
  const newColInputRef  = useRef(null);
  const excelInputRef   = useRef(null);

  const [templateMeta, setTemplateMeta] = useState({
    name: "", description: "", category: "", version: "1.0", isActive: true, models: [],
    approvalStatus: "draft", // draft | pending_approval | approved | rejected
    rejectionReason: "",
    approvedBy: "",
    approvedAt: "",
  });
  const [rejectionReasonInput, setRejectionReasonInput] = useState("");

  const canCreateEdit = [
    ROLES.SUPER_ADMIN,
    ROLES.QUALITY_MANAGER,
    ROLES.LINE_QUALITY_ENGINEER,
  ].includes(user?.roleName);

  const canApprove = [
    ROLES.SUPER_ADMIN,
    ROLES.QUALITY_MANAGER,
  ].includes(user?.roleName);

  const [headerConfig, setHeaderConfig] = useState({
    showFormatNo: true, showRevNo: true, showRevDate: true,
    defaultFormatNo: "", defaultRevNo: "", defaultRevDate: "",
  });
  const [infoFields, setInfoFields] = useState(DEFAULT_INFO_FIELDS);
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
  const [defaultSections, setDefaultSections] = useState(() => ensureImageCaptureSection([makeSection()]));
  // Draft text for the "add image capture item" input, keyed by section id —
  // kept outside defaultSections since it's transient UI state, not template data.
  const [newImageItemDrafts, setNewImageItemDrafts] = useState({});
  const isApprovalReview = Boolean(id && templateMeta.approvalStatus === APPROVAL_STATUS.PENDING_APPROVAL);
  const isApprovedLocked = Boolean(id && templateMeta.approvalStatus === APPROVAL_STATUS.APPROVED && !unlockedForEdit);
  const isReadOnly = isApprovalReview || isApprovedLocked;

  // ==================== Keyboard shortcuts ====================
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (!isReadOnly) handleSaveAsDraft();
      }
      if (e.key === "Escape") {
        setShowColumnManager(false);
        setShowInfoFieldManager(false);
        setShowShortcuts(false);
        setShowRejectionModal(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // handleSaveAsDraft is declared later in this component (temporal-dead-zone hazard
    // if added here); the effect already re-binds on every relevant state change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateMeta, headerConfig, infoFields, columns, defaultSections, isReadOnly]);

  // ==================== Auto-draft to localStorage ====================
  useEffect(() => {
    if (templateMeta.name && !initialLoading && !isReadOnly) {
      const draft = { templateMeta, headerConfig, infoFields, columns, defaultSections, savedAt: Date.now() };
      localStorage.setItem(`template_draft_${id || "new"}`, JSON.stringify(draft));
      setHasDraft(true);
    }
  }, [templateMeta, headerConfig, infoFields, columns, defaultSections, isReadOnly, id, initialLoading]);

  const clearDraft = () => {
    localStorage.removeItem(`template_draft_${id || "new"}`);
    setHasDraft(false);
    toast.success("Draft cleared");
  };

  // ==================== Load template ====================
  useEffect(() => {
    const loadTemplate = async () => {
      if (!id) {
        // Name was already checked for uniqueness by the Template List's
        // name-prompt before navigating here — prefill it so the user
        // doesn't have to retype it.
        const presetName = location.state?.presetName;
        if (presetName) {
          setTemplateMeta((prev) => (prev.name ? prev : { ...prev, name: presetName }));
        }
        const draft = localStorage.getItem("template_draft_new");
        if (draft) {
          try {
            const parsed = JSON.parse(draft);
            const age = Date.now() - parsed.savedAt;
            if (age < 24 * 60 * 60 * 1000) {
              setHasDraft(true);
            }
          } catch {
            // ignore corrupt/stale draft JSON
          }
        }
        return;
      }
      setInitialLoading(true);
      setUnlockedForEdit(false);
      try {
        const tmpl = await getTemplateById(id);
        if (tmpl) {
          setRefDocs(tmpl);
          setTemplateMeta({
            name: tmpl.name || "",
            description: tmpl.description || "",
            category: tmpl.category || "",
            version: tmpl.version || "1.0",
            isActive: tmpl.isActive !== false,
            models: tmpl.models || [],
            approvalStatus: tmpl.approvalStatus || "draft",
            rejectionReason: tmpl.rejectionReason || "",
            approvedBy: tmpl.approvedBy || "",
            approvedAt: tmpl.approvedAt || "",
          });
          if (tmpl.headerConfig) setHeaderConfig(tmpl.headerConfig);
          if (tmpl.infoFields) setInfoFields(tmpl.infoFields);
          if (tmpl.columns) setColumns(tmpl.columns);
          if (tmpl.defaultSections) {
            setDefaultSections(ensureImageCaptureSection(tmpl.defaultSections.map((section) => {
              if (section.stages) return { sectionType: "checklist", ...section };
              return { id: section.id || genId(), sectionName: section.sectionName, sectionType: "checklist", stages: [{ id: genId(), stageName: section.stageName || "", checkPoints: section.checkPoints || [] }] };
            })));
          }
        }
      } catch (err) {
        toast.error("Failed to load template: " + err.message);
        navigate("/auditreport/templates");
      } finally {
        setInitialLoading(false);
      }
    };
    loadTemplate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ==================== Stats ====================
  const stats = useMemo(() => {
    let stages = 0, checkpoints = 0;
    defaultSections.forEach((s) => {
      stages += s.stages?.length || 0;
      s.stages?.forEach((st) => { checkpoints += st.checkPoints?.length || 0; });
    });
    return {
      sections: defaultSections.length,
      stages,
      checkpoints,
      visibleCols: columns.filter((c) => c.visible).length,
    };
  }, [defaultSections, columns]);

  // ==================== Section CRUD ====================
  const addSection = () => {
    const s = makeSection();
    setDefaultSections((prev) => [...prev, s]);
    setTimeout(() => document.getElementById(`sec-input-${s.id}`)?.focus(), 50);
  };

  const deleteSection = (sectionId) => {
    // Image Capture is a fixed area, not counted toward "at least one
    // section" — this guard only ever applies to checklist sections.
    const checklistCount = defaultSections.filter((s) => s.sectionType !== "imageCapture").length;
    if (checklistCount <= 1) { toast.error("At least one section required"); return; }
    setDefaultSections((prev) => prev.filter((s) => s.id !== sectionId));
  };

  const duplicateSection = (sectionId) => {
    const src = defaultSections.find((s) => s.id === sectionId);
    if (!src) return;
    const dup = {
      ...src, id: genId(),
      sectionName: `${src.sectionName} (Copy)`,
      stages: src.stages.map((st) => ({ ...st, id: genId(), checkPoints: st.checkPoints.map((cp) => ({ ...cp, id: genId() })) })),
    };
    setDefaultSections((prev) => [...prev, dup]);
    toast.success("Section duplicated");
  };

  const moveSection = (index, dir) => {
    setDefaultSections((prev) => {
      const arr = [...prev];
      const ni = dir === "up" ? index - 1 : index + 1;
      if (ni < 0 || ni >= arr.length) return arr;
      [arr[index], arr[ni]] = [arr[ni], arr[index]];
      return arr;
    });
  };

  const updateSectionName = (sectionId, value) => {
    setDefaultSections((prev) => prev.map((s) => s.id === sectionId ? { ...s, sectionName: value } : s));
  };

  const addImageCaptureItem = (sectionId) => {
    const name = (newImageItemDrafts[sectionId] || "").trim();
    if (!name) return;
    setDefaultSections((prev) => prev.map((s) => {
      if (s.id !== sectionId) return s;
      const stage = s.stages[0] || makeStage();
      const cp = { id: genId(), checkPoint: name, method: "", specification: "", required: true };
      return { ...s, stages: [{ ...stage, checkPoints: [...stage.checkPoints, cp] }] };
    }));
    setNewImageItemDrafts((prev) => ({ ...prev, [sectionId]: "" }));
  };

  // ==================== Stage CRUD ====================
  const addStage = (sectionId) => {
    const st = makeStage();
    setDefaultSections((prev) => prev.map((s) => s.id === sectionId ? { ...s, stages: [...s.stages, st] } : s));
    setTimeout(() => document.getElementById(`stage-input-${st.id}`)?.focus(), 50);
  };

  const deleteStage = (sectionId, stageId) => {
    setDefaultSections((prev) => prev.map((s) => {
      if (s.id !== sectionId) return s;
      if (s.stages.length <= 1) { toast.error("At least one stage required"); return s; }
      return { ...s, stages: s.stages.filter((st) => st.id !== stageId) };
    }));
  };

  const duplicateStage = (sectionId, stageId) => {
    setDefaultSections((prev) => prev.map((s) => {
      if (s.id !== sectionId) return s;
      const src = s.stages.find((st) => st.id === stageId);
      if (!src) return s;
      const dup = { ...src, id: genId(), stageName: `${src.stageName} (Copy)`, checkPoints: src.checkPoints.map((cp) => ({ ...cp, id: genId() })) };
      return { ...s, stages: [...s.stages, dup] };
    }));
  };

  const moveStage = (sectionId, stageIndex, dir) => {
    setDefaultSections((prev) => prev.map((s) => {
      if (s.id !== sectionId) return s;
      const arr = [...s.stages];
      const ni = dir === "up" ? stageIndex - 1 : stageIndex + 1;
      if (ni < 0 || ni >= arr.length) return s;
      [arr[stageIndex], arr[ni]] = [arr[ni], arr[stageIndex]];
      return { ...s, stages: arr };
    }));
  };

  const updateStageName = (sectionId, stageId, value) => {
    setDefaultSections((prev) => prev.map((s) => s.id !== sectionId ? s : {
      ...s, stages: s.stages.map((st) => st.id === stageId ? { ...st, stageName: value } : st),
    }));
  };

  // ==================== Checkpoint CRUD ====================
  const addCheckpoint = (sectionId, stageId) => {
    const cp = makeCheckpoint();
    setDefaultSections((prev) => prev.map((s) => s.id !== sectionId ? s : {
      ...s, stages: s.stages.map((st) => st.id !== stageId ? st : { ...st, checkPoints: [...st.checkPoints, cp] }),
    }));
  };

  const deleteCheckpoint = (sectionId, stageId, cpId) => {
    setDefaultSections((prev) => prev.map((s) => {
      if (s.id !== sectionId) return s;
      return {
        ...s,
        stages: s.stages.map((st) => {
          if (st.id !== stageId) return st;
          // Image Capture items are an open-ended list — unlike checklist
          // stages, it's fine to remove the last one and leave it empty.
          if (s.sectionType !== "imageCapture" && st.checkPoints.length <= 1) {
            toast.error("At least one checkpoint required");
            return st;
          }
          return { ...st, checkPoints: st.checkPoints.filter((cp) => cp.id !== cpId) };
        }),
      };
    }));
  };

  const moveCheckpoint = (sectionId, stageId, index, dir) => {
    setDefaultSections((prev) => prev.map((s) => s.id !== sectionId ? s : {
      ...s, stages: s.stages.map((st) => {
        if (st.id !== stageId) return st;
        const arr = [...st.checkPoints];
        const ni = dir === "up" ? index - 1 : index + 1;
        if (ni < 0 || ni >= arr.length) return st;
        [arr[index], arr[ni]] = [arr[ni], arr[index]];
        return { ...st, checkPoints: arr };
      }),
    }));
  };

  // ==================== Checkpoint Library ====================
  const openLibraryPicker = (sectionId, stageId) => {
    setLibrarySearch("");
    setLibraryPicker({ sectionId, stageId });
  };

  const insertFromLibrary = (libEntry) => {
    if (!libraryPicker) return;
    const { sectionId, stageId } = libraryPicker;
    const cp = {
      id: genId(),
      checkPoint: libEntry.checkPoint,
      method: libEntry.method || "",
      specification: libEntry.specification || "",
      required: !!libEntry.required,
    };
    setDefaultSections((prev) => prev.map((s) => s.id !== sectionId ? s : {
      ...s, stages: s.stages.map((st) => st.id !== stageId ? st : { ...st, checkPoints: [...st.checkPoints, cp] }),
    }));
    incrementCheckpointUsage(libEntry.id).catch(() => {});
    toast.success(`"${libEntry.checkPoint}" inserted`);
  };

  const saveCheckpointToLibrary = async (cp) => {
    if (!cp.checkPoint?.trim()) { toast.error("Checkpoint text is empty — nothing to save"); return; }
    try {
      await addCheckpointLibraryEntry({
        checkPoint: cp.checkPoint,
        method: cp.method,
        specification: cp.specification,
        required: cp.required,
        category: templateMeta.category,
        createdBy: user?.name || String(user?.userCode ?? user?.usercode ?? "SYSTEM"),
      }).unwrap();
      toast.success("Saved to Checkpoint Library");
    } catch (err) {
      toast.error("Failed to save to library: " + (err?.data?.message || err.message));
    }
  };

  const updateCheckpoint = (sectionId, stageId, cpId, field, value) => {
    setDefaultSections((prev) => prev.map((s) => s.id !== sectionId ? s : {
      ...s, stages: s.stages.map((st) => st.id !== stageId ? st : {
        ...st, checkPoints: st.checkPoints.map((cp) => cp.id !== cpId ? cp : { ...cp, [field]: value }),
      }),
    }));
  };

  // ==================== Excel Download Template ====================
  const handleDownloadExcelTemplate = async () => {
    const XLSX = await import("xlsx");
    const headers = ["Section Name", "Stage Name", "Check Point", "Method of Inspection", "Specification"];
    const samples = [
      ["Surface Quality", "Visual Inspection", "Check paint finish",         "Visual",             "No scratches, dents or blemishes"],
      ["Surface Quality", "Visual Inspection", "Check surface alignment",    "Visual + Gauge",     "±0.5mm tolerance"],
      ["Surface Quality", "Dimensional",       "Measure overall height",     "Vernier Caliper",    "850 ± 2mm"],
      ["Functional Test", "Electrical",        "Verify input voltage",       "Multimeter",         "220–240V AC ±5%"],
      ["Functional Test", "Electrical",        "Check thermostat operation", "Thermometer",        "Cuts off at 4°C ±1°C"],
      ["Functional Test", "Mechanical",        "Door seal integrity",        "Visual + Pressure",  "No air leakage"],
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, ...samples]);
    ws["!cols"] = [{ wch: 22 }, { wch: 22 }, { wch: 38 }, { wch: 26 }, { wch: 38 }];

    const instr = XLSX.utils.aoa_to_sheet([
      ["INSTRUCTIONS — DO NOT DELETE THIS SHEET"],
      [""],
      ["1. Fill in the 'Audit Sections' sheet with your audit data."],
      ["2. Section Name   — Groups related checkpoints (e.g. 'Surface Quality')."],
      ["3. Stage Name     — Sub-group within a section (e.g. 'Visual Inspection')."],
      ["4. Check Point    — The specific item to inspect."],
      ["5. Method         — How to inspect it (Visual, Measurement, etc.)."],
      ["6. Specification  — Acceptance criteria or standard value."],
      [""],
      ["NOTES:"],
      ["• Blank rows are ignored during upload."],
      ["• Multiple rows can share the same Section Name and Stage Name."],
      ["• Do NOT modify the header row in 'Audit Sections'."],
    ]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws,    "Audit Sections");
    XLSX.utils.book_append_sheet(wb, instr, "Instructions");
    XLSX.writeFile(wb, "audit_sections_template.xlsx");
    toast.success("Template downloaded");
  };

  // ==================== Excel Parse Uploaded File ====================
  const parseExcelToSections = (rows) => {
    const secMap = new Map();
    rows.forEach((row) => {
      const sec   = String(row["Section Name"]          || "").trim();
      const stage = String(row["Stage Name"]             || "").trim();
      const cp    = String(row["Check Point"]            || "").trim();
      const meth  = String(row["Method of Inspection"]   || "").trim();
      const spec  = String(row["Specification"]          || "").trim();
      if (!cp && !meth && !spec) return;  // skip structurally empty rows

      const secKey = sec || "(Unnamed Section)";
      if (!secMap.has(secKey)) secMap.set(secKey, new Map());
      const stageMap = secMap.get(secKey);

      const stageKey = stage || "(Unnamed Stage)";
      if (!stageMap.has(stageKey)) stageMap.set(stageKey, []);
      stageMap.get(stageKey).push({ id: genId(), checkPoint: cp, method: meth, specification: spec, required: false });
    });

    return Array.from(secMap.entries()).map(([secName, stageMap]) => ({
      id: genId(),
      sectionName: secName,
      stages: Array.from(stageMap.entries()).map(([stageName, cps]) => ({
        id: genId(),
        stageName,
        checkPoints: cps,
      })),
    }));
  };

  const handleExcelUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const XLSX = await import("xlsx");
        // readAsArrayBuffer + { type: "array" } — not readAsBinaryString +
        // { type: "binary" }. The binary-string path reads the file through
        // an intermediate lossy single-byte string, which mangles any
        // non-ASCII character in the sheet (e.g. µ/μ turning into а Cyrillic
        // "ц") before XLSX's UTF-8-aware XML parser ever sees it.
        const wb   = XLSX.read(evt.target.result, { type: "array" });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
        if (!rows.length) { toast.error("The Excel file is empty."); return; }

        const sections = parseExcelToSections(rows);
        if (!sections.length) { toast.error("No valid checkpoint data found."); return; }

        const totalCPs = sections.reduce((s, sec) =>
          s + sec.stages.reduce((ss, st) => ss + st.checkPoints.length, 0), 0);

        setExcelPreview({ sections, totalCPs });
        setShowExcelModal(true);
      } catch (err) {
        toast.error("Failed to read Excel file: " + err.message);
      } finally {
        e.target.value = "";
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const applyExcelImport = (mode) => {
    if (!excelPreview) return;
    if (mode === "replace") {
      setDefaultSections(excelPreview.sections);
      toast.success(`Replaced with ${excelPreview.sections.length} sections · ${excelPreview.totalCPs} checkpoints`);
    } else {
      setDefaultSections((prev) => [...prev, ...excelPreview.sections]);
      toast.success(`Appended ${excelPreview.sections.length} sections · ${excelPreview.totalCPs} checkpoints`);
    }
    setShowExcelModal(false);
    setExcelPreview(null);
  };

  const handleBulkPaste = (sectionId, stageId, text) => {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) return;
    const newCPs = lines.map((line) => ({ ...makeCheckpoint(), checkPoint: line }));
    setDefaultSections((prev) => prev.map((s) => s.id !== sectionId ? s : {
      ...s, stages: s.stages.map((st) => st.id !== stageId ? st : {
        ...st, checkPoints: [...st.checkPoints.filter((cp) => cp.checkPoint), ...newCPs],
      }),
    }));
    toast.success(`Added ${lines.length} checkpoints from paste`);
  };

  // ==================== Column management ====================
  const addColumn = () => {
    if (!newColumn.name.trim()) { toast.error("Enter a column name"); return; }
    const colId = newColumn.name.toLowerCase().replace(/\s+/g, "_") + "_" + genId();
    setColumns((prev) => [...prev, { id: colId, name: newColumn.name, visible: true, required: false, width: "w-40", type: newColumn.type, entryField: false }]);
    setNewColumn({ name: "", type: "text" });
    newColInputRef.current?.focus();
    toast.success(`Column "${newColumn.name}" added`);
  };

  const toggleColumnVisibility = (id) => setColumns((prev) => prev.map((c) => c.id === id && !c.required ? { ...c, visible: !c.visible } : c));
  const toggleColumnEntryField = (id) => setColumns((prev) => prev.map((c) => c.id === id ? { ...c, entryField: !c.entryField } : c));
  const deleteColumn = (id) => {
    const col = columns.find((c) => c.id === id);
    if (!col || col.required) return;
    setColumns((prev) => prev.filter((c) => c.id !== id));
  };
  const moveColumn = (index, dir) => {
    setColumns((prev) => {
      const arr = [...prev];
      const ni = dir === "up" ? index - 1 : index + 1;
      if (ni < 0 || ni >= arr.length) return arr;
      [arr[index], arr[ni]] = [arr[ni], arr[index]];
      return arr;
    });
  };
  // ==================== Info field management ====================
  const addInfoField = () => setInfoFields((prev) => [...prev, { id: `field_${genId()}`, name: "New Field", type: "text", required: false, visible: true }]);
  const updateInfoField = (id, updates) => setInfoFields((prev) => prev.map((f) => f.id === id ? { ...f, ...updates } : f));
  const deleteInfoField = (id) => setInfoFields((prev) => prev.filter((f) => f.id !== id));
  const moveInfoField = (index, dir) => {
    setInfoFields((prev) => {
      const arr = [...prev];
      const ni = dir === "up" ? index - 1 : index + 1;
      if (ni < 0 || ni >= arr.length) return arr;
      [arr[index], arr[ni]] = [arr[ni], arr[index]];
      return arr;
    });
  };

  const visibleColumns = columns.filter((c) => c.visible);

  // ==================== Search / Filter ====================
  const searchQ = sectionSearch.trim().toLowerCase();

  const cpMatches = useCallback((cp) =>
    searchQ &&
    (cp.checkPoint?.toLowerCase().includes(searchQ) ||
     cp.method?.toLowerCase().includes(searchQ) ||
     cp.specification?.toLowerCase().includes(searchQ)), [searchQ]);

  // Checklist sections only — Image Capture is a fixed area rendered
  // separately below, not part of the searchable/reorderable section list.
  const checklistSections = useMemo(
    () => defaultSections.filter((s) => s.sectionType !== "imageCapture"),
    [defaultSections],
  );
  const imageCaptureSection = useMemo(
    () => defaultSections.find((s) => s.sectionType === "imageCapture"),
    [defaultSections],
  );

  // Only filter at section level — all stages/checkpoints stay visible within a matched section
  const filteredSections = useMemo(() => {
    if (!searchQ) return checklistSections;
    return checklistSections.filter((s) =>
      s.sectionName.toLowerCase().includes(searchQ) ||
      s.stages.some((st) =>
        st.stageName.toLowerCase().includes(searchQ) ||
        st.checkPoints.some((cp) => JSON.stringify(cp).toLowerCase().includes(searchQ))
      )
    );
  }, [checklistSections, searchQ]);

  // Total match count for the badge
  const searchMatchCount = useMemo(() => {
    if (!searchQ) return 0;
    let n = 0;
    filteredSections.forEach((s) => {
      if (s.sectionName.toLowerCase().includes(searchQ)) n++;
      s.stages.forEach((st) => {
        if (st.stageName.toLowerCase().includes(searchQ)) n++;
        st.checkPoints.forEach((cp) => { if (cpMatches(cp)) n++; });
      });
    });
    return n;
  }, [filteredSections, searchQ, cpMatches]);

  // ==================== Save as Draft ====================
  // New template (no id): createTemplate. Name was already uniqueness-checked
  // by the Template List's name-prompt before this page opened, so `exists`
  // here should only happen on a race (someone else took the name in the
  // meantime) — surfaced as an error, never silently treated as success.
  // Existing template (id present): createTemplateVersion — never mutates the
  // version being edited, always creates a new one and deactivates the old.
  const handleSaveAsDraft = async () => {
    if (!templateMeta.name.trim()) { toast.error("Template name is required"); return; }
    if (!templateMeta.models || templateMeta.models.length === 0) { toast.error("At least one applicable model is required"); return; }
    setSaving(true);
    try {
      const payload = {
        name: templateMeta.name,
        description: templateMeta.description,
        category: templateMeta.category,
        isActive: templateMeta.isActive,
        models: templateMeta.models,
        approvalStatus: "draft",
        // Pass user identity so backend can store correct CreatedBy when auth is disabled.
        // String() coercion prevents "Invalid string" if userCode is stored as a number.
        createdByUser: user?.name || String(user?.userCode ?? user?.usercode ?? "SYSTEM"),
        headerConfig,
        infoFields,
        columns,
        defaultSections,
      };
      if (id) {
        await createTemplateVersion(id, { ...payload, basedOnVersion: templateMeta.version });
        toast.success("Draft saved as a new version");
      } else {
        const result = await createTemplate(payload);
        if (result.exists) {
          toast.error(`A template named "${templateMeta.name}" was just created by someone else. Please reload and try again.`);
          return;
        }
        toast.success("Draft saved");
        localStorage.removeItem("template_draft_new");
      }
      navigate("/auditreport/templates");
    } catch (err) {
      if (err.errors?.length) {
        toast.error(`Validation failed: ${err.errors[0].message}${err.errors.length > 1 ? ` (+${err.errors.length - 1} more)` : ""}`);
      } else {
        toast.error("Save failed: " + err.message);
      }
    } finally {
      setSaving(false);
    }
  };

  // ==================== Approval Handlers ====================
  const handleSubmitForApproval = async () => {
    if (!templateMeta.name.trim()) { toast.error("Template name is required"); return; }
    if (!templateMeta.models || templateMeta.models.length === 0) { toast.error("At least one applicable model is required"); return; }
    setSaving(true);
    try {
      const payload = {
        name: templateMeta.name,
        description: templateMeta.description,
        category: templateMeta.category,
        isActive: templateMeta.isActive,
        models: templateMeta.models,
        approvalStatus: APPROVAL_STATUS.PENDING_APPROVAL,
        createdByUser: user?.name || String(user?.userCode ?? user?.usercode ?? "SYSTEM"),
        headerConfig,
        infoFields,
        columns,
        defaultSections,
      };
      if (id) {
        await createTemplateVersion(id, { ...payload, basedOnVersion: templateMeta.version });
      } else {
        const result = await createTemplate(payload);
        if (result.exists) {
          toast.error(`A template named "${templateMeta.name}" was just created by someone else. Please reload and try again.`);
          return;
        }
        localStorage.removeItem("template_draft_new");
      }
      toast.success("Template submitted for approval");
      navigate("/auditreport/templates");
    } catch (err) {
      if (err.errors?.length) {
        toast.error(`Validation failed: ${err.errors[0].message}${err.errors.length > 1 ? ` (+${err.errors.length - 1} more)` : ""}`);
      } else {
        toast.error("Submission failed: " + err.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    setSaving(true);
    try {
      const payload = {
        ...templateMeta,
        approvalStatus: APPROVAL_STATUS.APPROVED,
        rejectionReason: "",
        approvedBy: user?.name || user?.usercode || "System",
        approvedAt: new Date().toISOString(),
      };
      await updateTemplate(id, payload);
      toast.success("Template approved");
      navigate("/auditreport/templates");
    } catch (err) {
      toast.error("Approval failed: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReasonInput.trim()) { toast.error("Please provide a rejection reason"); return; }
    setSaving(true);
    try {
      const payload = {
        ...templateMeta,
        approvalStatus: APPROVAL_STATUS.REJECTED,
        rejectionReason: rejectionReasonInput.trim(),
        approvedBy: user?.name || user?.usercode || "System",
        approvedAt: new Date().toISOString(),
      };
      await updateTemplate(id, payload);
      toast.success("Template rejected");
      navigate("/auditreport/templates");
    } catch (err) {
      toast.error("Rejection failed: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ==================== Loading ====================
  if (initialLoading) {
    return (
      <div className="h-full bg-slate-100 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto" />
          <p className="font-semibold text-gray-700">Loading template...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-100 font-sans">
      {/* Keyboard shortcuts modal */}
      {showShortcuts && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm" onClick={() => setShowShortcuts(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-xs w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 flex items-center gap-2"><FaKeyboard className="text-indigo-500" /> Keyboard Shortcuts</h3>
              <button onClick={() => setShowShortcuts(false)}><FaTimes className="text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              {[
                ["Ctrl + S", "Save Template"],
                ["Esc", "Close Modals"],
              ].map(([k, d]) => (
                <div key={k} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{d}</span>
                  <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-mono">{k}</kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Info field manager modal */}
      {showInfoFieldManager && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-purple-600 to-purple-700 text-white flex-shrink-0">
              <h3 className="text-base font-black flex items-center gap-2"><FaInfoCircle /> Manage Info Fields</h3>
              <button onClick={() => setShowInfoFieldManager(false)} className="p-1.5 hover:bg-purple-800 rounded-lg transition"><FaTimes /></button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto">
              <p className="text-xs text-gray-500 bg-purple-50 border border-purple-100 rounded-xl px-3 py-2 mb-4">
                These fields appear in the audit header (Model Name, Date, Shift, etc.). Drag to reorder.
              </p>
              <div className="space-y-2">
                {infoFields.map((field, index) => (
                  <div key={field.id} className={`rounded-xl border p-3 transition-all ${field.visible ? "bg-white border-gray-200" : "bg-gray-50 border-gray-100 opacity-60"}`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <MdDragIndicator className="text-gray-300 flex-shrink-0" />
                      <div className="flex gap-1 flex-col flex-shrink-0">
                        <button onClick={() => moveInfoField(index, "up")} disabled={index === 0} className="text-gray-300 hover:text-gray-600 disabled:opacity-20"><FaArrowUp size={9} /></button>
                        <button onClick={() => moveInfoField(index, "down")} disabled={index === infoFields.length - 1} className="text-gray-300 hover:text-gray-600 disabled:opacity-20"><FaArrowDown size={9} /></button>
                      </div>
                      <input type="text" value={field.name} onChange={(e) => updateInfoField(field.id, { name: e.target.value })}
                        className="flex-1 min-w-[100px] px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:border-purple-400 outline-none" placeholder="Field Name" />
                      <select value={field.type} onChange={(e) => updateInfoField(field.id, { type: e.target.value })}
                        className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:border-purple-400 outline-none">
                        {FIELD_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                      </select>
                      <label className="flex items-center gap-1 text-xs text-gray-500">
                        <input type="checkbox" checked={field.required} onChange={(e) => updateInfoField(field.id, { required: e.target.checked })} className="rounded" /> Required
                      </label>
                      <label className="flex items-center gap-1 text-xs text-gray-500">
                        <input type="checkbox" checked={field.visible} onChange={(e) => updateInfoField(field.id, { visible: e.target.checked })} className="rounded" /> Visible
                      </label>
                      <button onClick={() => deleteInfoField(field.id)} className="text-red-400 hover:text-red-600 ml-auto"><FaTrash size={10} /></button>
                    </div>
                  </div>
                ))}
                <button onClick={addInfoField} className="w-full py-2 border-2 border-dashed border-purple-300 rounded-xl text-purple-600 text-sm font-semibold hover:bg-purple-50 transition flex items-center justify-center gap-2">
                  <MdAddCircle /> Add Info Field
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Column manager modal */}
      {showColumnManager && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white flex-shrink-0">
              <h3 className="text-base font-black flex items-center gap-2"><FaColumns /> Manage Columns</h3>
              <button onClick={() => setShowColumnManager(false)} className="p-1.5 hover:bg-indigo-800 rounded-lg transition"><FaTimes /></button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto">
              <div className="flex items-center gap-2 mb-4 p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                <input type="text" placeholder="New column name..." value={newColumn.name} onChange={(e) => setNewColumn({ ...newColumn, name: e.target.value })}
                  className="flex-1 px-3 py-1.5 border border-indigo-200 rounded-lg text-sm focus:border-indigo-400 outline-none" ref={newColInputRef} />
                <select value={newColumn.type} onChange={(e) => setNewColumn({ ...newColumn, type: e.target.value })}
                  className="px-2 py-1.5 border border-indigo-200 rounded-lg text-xs focus:border-indigo-400 outline-none">
                  {COLUMN_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
                <button onClick={addColumn} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition">Add</button>
              </div>
              <div className="space-y-2">
                {columns.map((col, index) => (
                  <div key={col.id} className={`rounded-xl border p-3 transition-all ${col.visible ? "bg-white border-gray-200" : "bg-gray-50 border-gray-100 opacity-60"}`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <MdDragIndicator className="text-gray-300 flex-shrink-0" />
                      <div className="flex gap-1 flex-col flex-shrink-0">
                        <button onClick={() => moveColumn(index, "up")} disabled={index === 0} className="text-gray-300 hover:text-gray-600 disabled:opacity-20"><FaArrowUp size={9} /></button>
                        <button onClick={() => moveColumn(index, "down")} disabled={index === columns.length - 1} className="text-gray-300 hover:text-gray-600 disabled:opacity-20"><FaArrowDown size={9} /></button>
                      </div>
                      <span className="flex-1 text-sm font-medium text-gray-700">{col.name}</span>
                      <Badge color={col.required ? "blue" : "gray"}>{col.type}</Badge>
                      {col.entryField && <Badge color="green">Entry</Badge>}
                      <label className="flex items-center gap-1 text-xs text-gray-500">
                        <input type="checkbox" checked={col.visible} onChange={() => toggleColumnVisibility(col.id)} disabled={col.required} className="rounded" /> Visible
                      </label>
                      {col.id !== "section" && col.id !== "stage" && (
                        <label className="flex items-center gap-1 text-xs text-gray-500">
                          <input type="checkbox" checked={col.entryField} onChange={() => toggleColumnEntryField(col.id)} className="rounded" /> Entry
                        </label>
                      )}
                      <button onClick={() => deleteColumn(col.id)} disabled={col.required} className="text-red-400 hover:text-red-600 ml-auto disabled:opacity-30"><FaTrash size={10} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/auditreport/templates")} className="p-2 hover:bg-gray-100 rounded-lg transition text-gray-600"><FaArrowLeft /></button>
          <div className="flex items-center gap-2">
            <BiSolidFactory className="text-indigo-600 text-xl" />
            <h1 className="text-lg font-bold text-gray-800">{isReadOnly ? "Template Review" : "Template Builder"}</h1>
          </div>
          {hasDraft && !isReadOnly && (
            <button onClick={clearDraft} className="text-xs text-amber-600 hover:text-amber-700 underline">Clear draft</button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isReadOnly && (
            <button onClick={() => setShowShortcuts(true)} className="p-2 hover:bg-gray-100 rounded-lg transition text-gray-600" title="Keyboard shortcuts"><FaKeyboard /></button>
          )}

          {/* Excel download template */}
          {!isReadOnly && (
            <button
              onClick={handleDownloadExcelTemplate}
              className="flex items-center gap-2 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-sm font-semibold transition"
              title="Download Excel template to fill in sections & checkpoints"
            >
              <FaDownload size={12} /> Excel Template
            </button>
          )}

          {/* Excel upload */}
          {!isReadOnly && (
            <button
              onClick={() => excelInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-sm font-semibold transition"
              title="Upload filled Excel file to bulk-import sections & checkpoints"
            >
              <FaUpload size={12} /> Import Excel
            </button>
          )}
          <input
            ref={excelInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleExcelUpload}
          />
          
          {/* Approval buttons */}
          {!isReadOnly && (templateMeta.approvalStatus === APPROVAL_STATUS.DRAFT || unlockedForEdit) && canCreateEdit && (
            <button onClick={handleSubmitForApproval} disabled={saving} className="px-4 py-2 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <FaCheckDouble />}
              {saving ? "Submitting..." : "Submit for Approval"}
            </button>
          )}
          
          {id && templateMeta.approvalStatus === APPROVAL_STATUS.PENDING_APPROVAL && canApprove && (
            <>
              <button onClick={handleApprove} disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <FaCheckDouble />}
                {saving ? "Approving..." : "Approve"}
              </button>
              <button onClick={() => setShowRejectionModal(true)} disabled={saving} className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <FaTimes />}
                {saving ? "Rejecting..." : "Reject"}
              </button>
            </>
          )}

          {/* Approved templates are locked — must be explicitly unlocked to edit */}
          {id && templateMeta.approvalStatus === APPROVAL_STATUS.APPROVED && !unlockedForEdit && canCreateEdit && (
            <button onClick={() => setShowUnlockModal(true)} className="px-4 py-2 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition flex items-center gap-2">
              <FaLock size={12} /> Edit (requires re-approval)
            </button>
          )}

          {/* Admin can resubmit rejected templates */}
          {!isReadOnly && id && templateMeta.approvalStatus === APPROVAL_STATUS.REJECTED && canCreateEdit && (
            <button onClick={handleSubmitForApproval} disabled={saving} className="px-4 py-2 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <FaCheckDouble />}
              {saving ? "Resubmitting..." : "Resubmit for Approval"}
            </button>
          )}
          
          {!isReadOnly && (
            <button onClick={handleSaveAsDraft} disabled={saving} className="px-4 py-2 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
              {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <FaSave />}
              {saving ? "Saving..." : "Save Draft"}
            </button>
          )}
        </div>
      </header>

      {/* Stats bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 overflow-x-auto">
        <StatCard icon={FaLayerGroup} label="Sections" value={stats.sections} color="text-blue-600 border-blue-200" />
        <StatCard icon={HiClipboardDocumentCheck} label="Stages" value={stats.stages} color="text-purple-600 border-purple-200" />
        <StatCard icon={MdOutlineFactCheck} label="Checkpoints" value={stats.checkpoints} color="text-green-600 border-green-200" />
        <StatCard icon={FaColumns} label="Columns" value={stats.visibleCols} color="text-indigo-600 border-indigo-200" />
      </div>

      {/* Template meta */}
      <div className="bg-white mx-6 mt-4 rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><FaFileAlt /> Template Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Template Name *</label>
            <input type="text" value={templateMeta.name} onChange={(e) => setTemplateMeta({ ...templateMeta, name: e.target.value })}
              disabled={isReadOnly}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-indigo-400 outline-none disabled:bg-gray-50 disabled:text-gray-600" placeholder="Enter template name" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Category</label>
            <select value={templateMeta.category} onChange={(e) => setTemplateMeta({ ...templateMeta, category: e.target.value })}
              disabled={isReadOnly}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-indigo-400 outline-none disabled:bg-gray-50 disabled:text-gray-600">
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Version</label>
            <input
              type="text"
              value={id ? templateMeta.version : "01 (on save)"}
              readOnly
              title="Version numbers are assigned automatically — editing creates a new version on Save, it never overwrites this one."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-600 outline-none cursor-not-allowed"
            />
          </div>
          <div className="flex items-center gap-2 pt-5">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={templateMeta.isActive} onChange={(e) => setTemplateMeta({ ...templateMeta, isActive: e.target.checked })} disabled={isReadOnly} className="rounded disabled:opacity-60" />
              Active
            </label>
          </div>
          <div className="md:col-span-2 lg:col-span-4">
            <label className="text-xs text-gray-500 mb-1 block">Description</label>
            <textarea value={templateMeta.description} onChange={(e) => setTemplateMeta({ ...templateMeta, description: e.target.value })}
              disabled={isReadOnly}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-indigo-400 outline-none resize-none disabled:bg-gray-50 disabled:text-gray-600" rows="2" placeholder="Brief description..." />
          </div>
          <div className="md:col-span-2 lg:col-span-4">
            <label className="text-xs text-gray-500 mb-1 block">
              Applicable Models <span className="text-red-500">*</span>
            </label>
            {!isReadOnly && <div className="flex gap-2 mb-2">
              <input type="text" id="modelInput" placeholder="Add model (e.g., D525H223)"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-indigo-400 outline-none" />
              <button onClick={() => {
                const input = document.getElementById("modelInput");
                const value = input.value.trim().toUpperCase();
                if (value && !templateMeta.models.includes(value)) {
                  setTemplateMeta({ ...templateMeta, models: [...templateMeta.models, value] });
                }
                input.value = "";
              }} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition">Add</button>
            </div>}
            <div className={`flex flex-wrap gap-2 min-h-[2rem] px-2 py-1.5 rounded-lg border ${templateMeta.models.length === 0 ? "border-red-200 bg-red-50/40" : "border-transparent"}`}>
              {templateMeta.models.map((model, idx) => (
                <span key={idx} className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium border border-indigo-200">
                  {model}
                  {!isReadOnly && <button onClick={() => setTemplateMeta({ ...templateMeta, models: templateMeta.models.filter((_, i) => i !== idx) })}
                    className="text-indigo-400 hover:text-indigo-600 ml-1"><FaTimes size={10} /></button>
                  }
                </span>
              ))}
              {templateMeta.models.length === 0 && <span className="text-xs text-red-400 italic">At least one model is required</span>}
            </div>
          </div>
          {id && (
            <div className="md:col-span-2 lg:col-span-4">
              <label className="text-xs text-gray-500 mb-1 block">Approval Status</label>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border ${APPROVAL_STATUS_COLORS[templateMeta.approvalStatus] || APPROVAL_STATUS_COLORS.draft}`}>
                {APPROVAL_STATUS_LABELS[templateMeta.approvalStatus] || "Draft"}
              </span>
              {templateMeta.approvalStatus === APPROVAL_STATUS.PENDING_APPROVAL && (
                <p className="text-xs text-amber-600 mt-1">Template is pending quality manager approval</p>
              )}
              {templateMeta.approvalStatus === APPROVAL_STATUS.REJECTED && templateMeta.rejectionReason && (
                <p className="text-xs text-red-600 mt-1">Rejection reason: {templateMeta.rejectionReason}</p>
              )}
              {templateMeta.approvalStatus === APPROVAL_STATUS.APPROVED && (
                <p className="text-xs text-green-600 mt-1">Approved by {templateMeta.approvedBy}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* BOM Sheet / CRF reference files — not part of the versioned content,
          so they can be added or replaced even on an approved template. */}
      <div className="mx-6 mt-4">
        {id ? (
          <ReferenceDocs
            docs={refDocs}
            busyKind={docBusy}
            onUpload={canCreateEdit ? handleDocUpload : undefined}
            onRemove={canCreateEdit ? handleDocRemove : undefined}
          />
        ) : (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-4 text-xs text-gray-500">
            <b className="text-gray-700">BOM Sheet &amp; CRF:</b> save the template once, then upload them here (PDF or Excel).
          </div>
        )}
      </div>

      {/* Header config */}
      <div className="bg-white mx-6 mt-4 rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><FaInfoCircle /> Header Configuration</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={headerConfig.showFormatNo} onChange={(e) => setHeaderConfig({ ...headerConfig, showFormatNo: e.target.checked })} disabled={isReadOnly} className="rounded disabled:opacity-60" />
            Show Format No.
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={headerConfig.showRevNo} onChange={(e) => setHeaderConfig({ ...headerConfig, showRevNo: e.target.checked })} disabled={isReadOnly} className="rounded disabled:opacity-60" />
            Show Rev. No.
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={headerConfig.showRevDate} onChange={(e) => setHeaderConfig({ ...headerConfig, showRevDate: e.target.checked })} disabled={isReadOnly} className="rounded disabled:opacity-60" />
            Show Rev. Date
          </label>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Default Format No.</label>
            <input type="text" value={headerConfig.defaultFormatNo} onChange={(e) => setHeaderConfig({ ...headerConfig, defaultFormatNo: e.target.value })}
              disabled={isReadOnly}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-indigo-400 outline-none disabled:bg-gray-50 disabled:text-gray-600" placeholder="FMT-001" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Default Rev. No.</label>
            <input type="text" value={headerConfig.defaultRevNo} onChange={(e) => setHeaderConfig({ ...headerConfig, defaultRevNo: e.target.value })}
              disabled={isReadOnly}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-indigo-400 outline-none disabled:bg-gray-50 disabled:text-gray-600" placeholder="A" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Default Rev. Date</label>
            <input type="date" value={headerConfig.defaultRevDate || ""} onChange={(e) => setHeaderConfig({ ...headerConfig, defaultRevDate: e.target.value })}
              disabled={isReadOnly}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-indigo-400 outline-none disabled:bg-gray-50 disabled:text-gray-600" />
          </div>
        </div>
      </div>

      {/* Info fields and columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mx-6 mt-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2"><FaTags /> Info Fields</h2>
            {!isReadOnly && <button onClick={() => setShowInfoFieldManager(true)} className="text-xs text-purple-600 hover:text-purple-700 font-semibold">Manage</button>}
          </div>
          <div className="flex flex-wrap gap-2">
            {infoFields.filter(f => f.visible).map((f) => <Badge key={f.id} color={f.required ? "blue" : "gray"}>{f.name}{f.required && "*"}</Badge>)}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2"><FaColumns /> Table Columns</h2>
            {!isReadOnly && <button onClick={() => setShowColumnManager(true)} className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold">Manage</button>}
          </div>
          <div className="flex flex-wrap gap-2">
            {visibleColumns.map((c) => <Badge key={c.id} color={c.required ? "blue" : c.entryField ? "green" : "gray"}>{c.name}</Badge>)}
          </div>
        </div>
      </div>

      {isReadOnly && (
        <div className="bg-white mx-6 mt-4 rounded-xl border border-gray-200 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowReviewHistory((prev) => !prev)}
            className="w-full px-5 py-3 bg-indigo-50 hover:bg-indigo-100 border-b border-indigo-100 flex items-center justify-between gap-3 transition-colors"
          >
            <h2 className="text-sm font-bold text-indigo-700 flex items-center gap-2">
              <FaHistory /> Change Log
            </h2>
            <span className="flex items-center gap-2 text-[10px] text-indigo-400 font-semibold">
              {showReviewHistory ? <FaChevronUp size={10} /> : <FaChevronDown size={10} />}
            </span>
          </button>

          <TemplateHistoryPanel templateId={id} isOpen={showReviewHistory} variant="panel" />
        </div>
      )}

      {/* Section builder */}
      <div className="mx-6 mt-4 pb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2"><FaLayerGroup /> Sections & Checkpoints</h2>
          <div className="flex items-center gap-2">
            {/* Search input */}
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={11} />
              <input
                type="text"
                placeholder="Search sections, stages, checkpoints…"
                value={sectionSearch}
                onChange={(e) => setSectionSearch(e.target.value)}
                className="pl-8 pr-8 py-2 border border-gray-200 rounded-xl text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none w-72 transition-all"
              />
              {sectionSearch && (
                <button
                  onClick={() => setSectionSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                >
                  <FaTimes size={10} />
                </button>
              )}
              {/* Match count badge */}
              {searchQ && (
                <span className={`absolute -top-2 -right-2 text-[9px] font-black px-1.5 py-0.5 rounded-full border ${searchMatchCount > 0 ? "bg-indigo-600 text-white border-indigo-600" : "bg-red-100 text-red-600 border-red-200"}`}>
                  {searchMatchCount > 0 ? `${searchMatchCount}` : "0"}
                </span>
              )}
            </div>
            {!isReadOnly && <button onClick={addSection} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition flex items-center gap-1"><MdAddCircle /> Add Section</button>}
          </div>
        </div>

        {searchQ && filteredSections.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-xl border border-gray-200">
            <FaSearch className="text-4xl text-gray-200 mb-3" />
            <p className="text-sm font-semibold text-gray-500">No matches for "<span className="text-indigo-600">{sectionSearch}</span>"</p>
            <p className="text-xs text-gray-400 mt-1">Try different keywords — search covers section names, stage names, checkpoints, methods and specifications.</p>
            <button onClick={() => setSectionSearch("")} className="mt-3 text-xs text-indigo-600 hover:text-indigo-800 font-semibold underline transition">Clear search</button>
          </div>
        )}

        {filteredSections.map((section, sIdx) => {
          const sectionKey = section.id || `section-${sIdx}`;
          const sectionCollapsed = isReadOnly ? collapsedSections[sectionKey] === true : false;

          return (
          <div key={sectionKey} className="bg-white rounded-xl border border-gray-200 mb-3 overflow-hidden">
            {/* Section header */}
            <div className={`flex items-center gap-2 px-4 py-3 border-b border-gray-200 ${searchQ && section.sectionName.toLowerCase().includes(searchQ) ? "bg-yellow-50 border-yellow-100" : "bg-gray-50"}`}>
              {isReadOnly ? (
                <button
                  type="button"
                  onClick={() => setCollapsedSections((prev) => ({ ...prev, [sectionKey]: !sectionCollapsed }))}
                  className="p-1 text-gray-400 hover:text-indigo-600 transition"
                  title={sectionCollapsed ? "Expand section" : "Collapse section"}
                >
                  {sectionCollapsed ? <FaChevronDown size={11} /> : <FaChevronUp size={11} />}
                </button>
              ) : (
                <MdDragIndicator className="text-gray-300" />
              )}
              <input type="text" value={section.sectionName} onChange={(e) => updateSectionName(section.id, e.target.value)}
                id={`sec-input-${section.id}`}
                disabled={isReadOnly}
                className={`flex-1 px-3 py-1.5 border rounded-lg text-sm font-medium focus:border-indigo-400 outline-none disabled:bg-transparent disabled:border-transparent disabled:text-gray-700 ${searchQ && section.sectionName.toLowerCase().includes(searchQ) ? "border-yellow-300 bg-yellow-50" : "border-gray-200"}`}
                placeholder="Section name" />
              {isReadOnly && (
                <span className="text-[10px] text-gray-400 font-semibold">
                  {section.stages?.length || 0} stages
                </span>
              )}
              {!isReadOnly && <div className="flex items-center gap-1">
                <IconBtn icon={FaCopy} onClick={() => duplicateSection(section.id)} title="Duplicate" color="blue" />
                <IconBtn icon={FaArrowUp} onClick={() => moveSection(sIdx, "up")} disabled={sIdx === 0} title="Move up" />
                <IconBtn icon={FaArrowDown} onClick={() => moveSection(sIdx, "down")} disabled={sIdx === filteredSections.length - 1} title="Move down" />
                <IconBtn icon={FaTrash} onClick={() => deleteSection(section.id)} title="Delete" color="red" />
              </div>}
            </div>

            {/* Stages */}
            {!sectionCollapsed && <div className="p-4 space-y-3">
              {section.stages.map((stage, stIdx) => {
                const stageKey = `${sectionKey}-${stage.id || `stage-${stIdx}`}`;
                const stageCollapsed = isReadOnly ? collapsedStages[stageKey] === true : false;

                return (
                <div key={stageKey} className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* Stage header */}
                  <div className={`flex items-center gap-2 px-3 py-2 border-b border-gray-200 ${searchQ && stage.stageName.toLowerCase().includes(searchQ) ? "bg-yellow-50 border-yellow-100" : "bg-slate-50"}`}>
                    {isReadOnly ? (
                      <button
                        type="button"
                        onClick={() => setCollapsedStages((prev) => ({ ...prev, [stageKey]: !stageCollapsed }))}
                        className="p-1 text-gray-400 hover:text-indigo-600 transition"
                        title={stageCollapsed ? "Expand stage" : "Collapse stage"}
                      >
                        {stageCollapsed ? <FaChevronDown size={10} /> : <FaChevronUp size={10} />}
                      </button>
                    ) : (
                      <MdDragIndicator className="text-gray-300 text-sm" />
                    )}
                    <input type="text" value={stage.stageName} onChange={(e) => updateStageName(section.id, stage.id, e.target.value)}
                      id={`stage-input-${stage.id}`}
                      disabled={isReadOnly}
                      className={`flex-1 px-2 py-1 border rounded text-sm focus:border-indigo-400 outline-none disabled:bg-transparent disabled:border-transparent disabled:text-gray-700 ${searchQ && stage.stageName.toLowerCase().includes(searchQ) ? "border-yellow-300 bg-yellow-50" : "border-gray-200"}`}
                      placeholder="Stage name" />
                    {isReadOnly && (
                      <span className="text-[10px] text-gray-400 font-semibold">
                        {stage.checkPoints?.length || 0} checkpoints
                      </span>
                    )}
                    {!isReadOnly && <div className="flex items-center gap-1">
                      <IconBtn icon={FaCopy} onClick={() => duplicateStage(section.id, stage.id)} title="Duplicate" color="blue" size={10} />
                      <IconBtn icon={FaArrowUp} onClick={() => moveStage(section.id, stIdx, "up")} disabled={stIdx === 0} title="Move up" size={10} />
                      <IconBtn icon={FaArrowDown} onClick={() => moveStage(section.id, stIdx, "down")} disabled={stIdx === section.stages.length - 1} title="Move down" size={10} />
                      <IconBtn icon={FaTrash} onClick={() => deleteStage(section.id, stage.id)} title="Delete" color="red" size={10} />
                    </div>}
                  </div>

                  {/* Checkpoints table */}
                  {!stageCollapsed && <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          {visibleColumns.map((col) => (
                            <th key={col.id} className={`px-3 py-2 text-left text-xs font-semibold text-gray-600 ${col.width}`}>{col.name}</th>
                          ))}
                          <th className="px-3 py-2 w-20 text-center text-xs font-semibold text-gray-600">Required</th>
                          {!isReadOnly && <th className="px-3 py-2 w-32 text-right">Actions</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {stage.checkPoints.map((cp, cpIdx) => (
                          <tr key={cp.id} className={`border-b border-gray-100 hover:bg-indigo-50/30 transition-colors ${searchQ && cpMatches(cp) ? "bg-yellow-50 ring-1 ring-inset ring-yellow-300" : ""}`}>
                            {visibleColumns.map((col) => (
                              <td key={col.id} className={`px-3 py-2 ${col.width}`}>
                                {col.id === "section" && <span className="block text-gray-600 whitespace-normal break-words">{section.sectionName || "-"}</span>}
                                {col.id === "stage" && <span className="block text-gray-600 whitespace-normal break-words">{stage.stageName || "-"}</span>}
                                {col.id === "checkPoint" && (
                                  isReadOnly ? (
                                    <span className="block text-xs leading-relaxed text-gray-700 whitespace-normal break-words">{cp.checkPoint || "-"}</span>
                                  ) : (
                                    <input type="text" value={cp.checkPoint} onChange={(e) => updateCheckpoint(section.id, stage.id, cp.id, "checkPoint", e.target.value)}
                                      className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:border-indigo-400 outline-none" placeholder="Checkpoint" />
                                  )
                                )}
                                {col.id === "method" && (
                                  isReadOnly ? (
                                    <span className="block text-xs leading-relaxed text-gray-700 whitespace-normal break-words">{cp.method || "-"}</span>
                                  ) : (
                                    <input type="text" value={cp.method} onChange={(e) => updateCheckpoint(section.id, stage.id, cp.id, "method", e.target.value)}
                                      className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:border-indigo-400 outline-none" placeholder="Method" />
                                  )
                                )}
                                {col.id === "specification" && (
                                  isReadOnly ? (
                                    <span className="block text-xs leading-relaxed text-gray-700 whitespace-normal break-words">{cp.specification || "-"}</span>
                                  ) : (
                                    <input type="text" value={cp.specification} onChange={(e) => updateCheckpoint(section.id, stage.id, cp.id, "specification", e.target.value)}
                                      className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:border-indigo-400 outline-none" placeholder="Spec" />
                                  )
                                )}
                              </td>
                            ))}
                            <td className="px-3 py-2 w-20 text-center">
                              <button
                                type="button"
                                onClick={() => updateCheckpoint(section.id, stage.id, cp.id, "required", !cp.required)}
                                disabled={isReadOnly}
                                title={cp.required ? "Mark as optional" : "Mark as required"}
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold border transition-all ${
                                  cp.required
                                    ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
                                    : "bg-gray-100 text-gray-400 border-gray-200 hover:bg-gray-200"
                                }`}
                              >
                                {cp.required ? "Yes" : "No"}
                              </button>
                            </td>
                            {!isReadOnly && <td className="px-3 py-2 w-32 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <IconBtn icon={FaBook} onClick={() => saveCheckpointToLibrary(cp)} title="Save to Library" color="purple" size={9} />
                                <IconBtn icon={FaArrowUp} onClick={() => moveCheckpoint(section.id, stage.id, cpIdx, "up")} disabled={cpIdx === 0} size={9} />
                                <IconBtn icon={FaArrowDown} onClick={() => moveCheckpoint(section.id, stage.id, cpIdx, "down")} disabled={cpIdx === stage.checkPoints.length - 1} size={9} />
                                <IconBtn icon={FaTrash} onClick={() => deleteCheckpoint(section.id, stage.id, cp.id)} color="red" size={9} />
                              </div>
                            </td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>}

                  {/* Add checkpoint / bulk paste */}
                  {!isReadOnly && <div className="px-3 py-2 flex items-center gap-2 bg-gray-50 border-t border-gray-200">
                    <button onClick={() => addCheckpoint(section.id, stage.id)} className="px-3 py-1.5 bg-indigo-600 text-white rounded text-xs font-semibold hover:bg-indigo-700 transition flex items-center gap-1"><FaPlus size={10} /> Add Row</button>
                    <button onClick={() => {
                      const text = prompt("Paste multiple checkpoints (one per line):");
                      if (text) handleBulkPaste(section.id, stage.id, text);
                    }} className="px-3 py-1.5 bg-gray-600 text-white rounded text-xs font-semibold hover:bg-gray-700 transition flex items-center gap-1"><FaClipboardList size={10} /> Bulk Paste</button>
                    <button onClick={() => openLibraryPicker(section.id, stage.id)} className="px-3 py-1.5 bg-purple-600 text-white rounded text-xs font-semibold hover:bg-purple-700 transition flex items-center gap-1"><FaBook size={10} /> Insert from Library</button>
                  </div>}
                </div>
              );
              })}

              {/* Add stage */}
              {!isReadOnly && <button onClick={() => addStage(section.id)} className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 text-sm font-semibold hover:bg-gray-50 transition flex items-center justify-center gap-2">
                <MdAddCircle /> Add Stage
              </button>}
            </div>}
          </div>
          );
        })}

        {/* ==================== IMAGE CAPTURE ====================
            A fixed area pinned to the end of every template — not one of
            the reorderable/searchable sections above, and not something you
            toggle a section into. Auditors capture one photo per item here,
            no pass/fail. */}
        {imageCaptureSection && (
          <div className="bg-white rounded-xl border-2 border-pink-200 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-pink-100 bg-pink-50">
              <FaImage className="text-pink-500 flex-shrink-0" />
              <span className="font-black text-sm text-pink-800">Image Capture</span>
              <span className="text-[10px] text-pink-400 font-semibold ml-1">
                {imageCaptureSection.stages?.[0]?.checkPoints?.length || 0} items
              </span>
            </div>
            <div className="p-4">
              <p className="text-xs text-gray-500 mb-3">
                Fixed at the end of every audit — auditors capture one photo per item below, no pass/fail, just evidence.
              </p>
              <div className="flex flex-wrap gap-2 mb-3">
                {(imageCaptureSection.stages[0]?.checkPoints || []).map((cp) => (
                  <div key={cp.id} className="flex items-center gap-1.5 bg-pink-50 border border-pink-200 rounded-full pl-3 pr-1.5 py-1">
                    {isReadOnly ? (
                      <span className="text-xs font-medium text-pink-700">{cp.checkPoint || "Untitled"}</span>
                    ) : (
                      <input type="text" value={cp.checkPoint}
                        onChange={(e) => updateCheckpoint(imageCaptureSection.id, imageCaptureSection.stages[0].id, cp.id, "checkPoint", e.target.value)}
                        placeholder="Item name"
                        className="text-xs font-medium text-pink-700 bg-transparent outline-none w-28" />
                    )}
                    {!isReadOnly && (
                      <button type="button" onClick={() => deleteCheckpoint(imageCaptureSection.id, imageCaptureSection.stages[0].id, cp.id)}
                        className="p-1 text-pink-400 hover:text-red-600 rounded-full hover:bg-white transition" title="Remove item">
                        <FaTimes size={9} />
                      </button>
                    )}
                  </div>
                ))}
                {(imageCaptureSection.stages[0]?.checkPoints || []).length === 0 && (
                  <span className="text-xs text-gray-400 italic">No items yet — add one below.</span>
                )}
              </div>
              {!isReadOnly && (
                <div className="flex items-center gap-2">
                  <input type="text"
                    value={newImageItemDrafts[imageCaptureSection.id] || ""}
                    onChange={(e) => setNewImageItemDrafts((prev) => ({ ...prev, [imageCaptureSection.id]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addImageCaptureItem(imageCaptureSection.id); } }}
                    placeholder="e.g. FG Sticker, Machine Grill…"
                    className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:border-indigo-400 outline-none" />
                  <button type="button" onClick={() => addImageCaptureItem(imageCaptureSection.id)}
                    className="px-3 py-1.5 bg-pink-600 text-white rounded text-xs font-semibold hover:bg-pink-700 transition flex items-center gap-1">
                    <FaPlus size={10} /> Add Item
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Rejection Modal */}
      {showRejectionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-800">Reject Template</h3>
              <button onClick={() => setShowRejectionModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition text-gray-600">
                <FaTimes />
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-600 mb-4">Please provide a reason for rejecting this template:</p>
              <textarea
                value={rejectionReasonInput}
                onChange={(e) => setRejectionReasonInput(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-red-400 outline-none resize-none"
                rows="4"
                placeholder="Enter rejection reason..."
              />
            </div>
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-200">
              <button
                onClick={() => setShowRejectionModal(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleReject();
                }}
                disabled={saving || !rejectionReasonInput.trim()}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Rejecting..." : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Unlock Approved Template Modal ─────────────────────────────────── */}
      {showUnlockModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setShowUnlockModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 bg-gradient-to-r from-orange-600 to-orange-700 text-white">
              <h3 className="text-base font-black flex items-center gap-2"><FaLock size={13} /> Unlock for Editing</h3>
            </div>
            <div className="p-6 space-y-3">
              <p className="text-sm text-gray-600">
                This template is <strong>approved</strong> and currently in use. Editing it will move it back to{" "}
                <strong>Draft</strong> status — it must be re-submitted and re-approved before any new audit can use the updated version.
              </p>
              <p className="text-xs text-gray-400">Audits already created against the current approved version are not affected.</p>
            </div>
            <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
              <button onClick={() => setShowUnlockModal(false)} className="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-semibold transition-all">
                Cancel
              </button>
              <button
                onClick={() => {
                  setUnlockedForEdit(true);
                  setShowUnlockModal(false);
                  toast.success("Unlocked — remember to save to apply changes");
                }}
                className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-sm font-bold transition-all"
              >
                Unlock & Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Checkpoint Library Picker Modal ─────────────────────────────────── */}
      {libraryPicker && (() => {
        const q = librarySearch.trim().toLowerCase();
        const activeEntries = checkpointLibrary.filter((c) => c.status !== false);
        const matches = !q
          ? activeEntries
          : activeEntries.filter((c) =>
              [c.checkPoint, c.method, c.specification, c.category].some((f) => f?.toLowerCase().includes(q)),
            );
        return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setLibraryPicker(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="px-5 py-4 bg-gradient-to-r from-purple-600 to-purple-700 text-white flex items-center justify-between gap-3 flex-shrink-0">
                <h3 className="text-base font-black flex items-center gap-2"><FaBook size={13} /> Insert Checkpoint from Library</h3>
                <button onClick={() => setLibraryPicker(null)} className="p-1.5 hover:bg-white/10 rounded-lg transition"><FaTimes size={14} /></button>
              </div>
              <div className="p-4 border-b border-gray-100 flex-shrink-0">
                <input
                  autoFocus
                  type="text"
                  value={librarySearch}
                  onChange={(e) => setLibrarySearch(e.target.value)}
                  placeholder="Search checkpoints…"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-purple-400 outline-none"
                />
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {activeEntries.length === 0 ? (
                  <div className="text-center py-10 text-sm text-gray-400">
                    No checkpoints in the library yet — go to{" "}
                    <a href="/master-config/checkpoint-library" target="_blank" rel="noreferrer" className="text-purple-600 underline">Master Config &gt; Checkpoint Library</a>{" "}
                    to add some.
                  </div>
                ) : matches.length === 0 ? (
                  <div className="text-center py-10 text-sm text-gray-400">No matches for "{librarySearch}"</div>
                ) : (
                  matches.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => insertFromLibrary(c)}
                      className="w-full text-left p-3 border border-gray-200 rounded-xl hover:border-purple-300 hover:bg-purple-50/50 transition-all"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm text-gray-800">{c.checkPoint}</span>
                        {c.required && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 flex-shrink-0">Required</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-400">
                        {c.method && <span>{c.method}</span>}
                        {c.specification && <span>· {c.specification}</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        {c.category && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 capitalize">{c.category}</span>}
                        <span className="text-[9px] text-gray-400">Used {c.usageCount || 0}x</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
              <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex justify-end flex-shrink-0">
                <button onClick={() => setLibraryPicker(null)} className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-bold transition-all">
                  Done
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Excel Import Preview Modal ─────────────────────────────────────── */}
      {showExcelModal && excelPreview && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">

            {/* Header */}
            <div className="px-6 py-4 bg-blue-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FaTable size={16} />
                <h3 className="text-base font-black">Excel Import Preview</h3>
              </div>
              <button onClick={() => { setShowExcelModal(false); setExcelPreview(null); }} className="p-1.5 hover:bg-white/20 rounded-lg transition">
                <FaTimes />
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100 bg-blue-50">
              <div className="px-6 py-4 text-center">
                <p className="text-2xl font-black text-blue-700">{excelPreview.sections.length}</p>
                <p className="text-xs text-gray-500 font-semibold mt-0.5">Sections</p>
              </div>
              <div className="px-6 py-4 text-center">
                <p className="text-2xl font-black text-blue-700">
                  {excelPreview.sections.reduce((s, sec) => s + sec.stages.length, 0)}
                </p>
                <p className="text-xs text-gray-500 font-semibold mt-0.5">Stages</p>
              </div>
              <div className="px-6 py-4 text-center">
                <p className="text-2xl font-black text-blue-700">{excelPreview.totalCPs}</p>
                <p className="text-xs text-gray-500 font-semibold mt-0.5">Checkpoints</p>
              </div>
            </div>

            {/* Preview table */}
            <div className="px-6 py-4 max-h-64 overflow-y-auto">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Preview (first 10 checkpoints)</p>
              <table className="w-full text-xs border border-gray-100 rounded-xl overflow-hidden">
                <thead>
                  <tr className="bg-gray-50">
                    {["Section", "Stage", "Check Point", "Method", "Specification"].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500 border-b border-gray-100">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {excelPreview.sections.flatMap((sec) =>
                    sec.stages.flatMap((st) =>
                      st.checkPoints.map((cp) => ({ sec: sec.sectionName, stage: st.stageName, ...cp }))
                    )
                  ).slice(0, 10).map((row, i) => (
                    <tr key={i} className={i % 2 === 1 ? "bg-gray-50/50" : ""}>
                      <td className="px-3 py-1.5 font-semibold text-indigo-700 max-w-[100px] truncate">{row.sec}</td>
                      <td className="px-3 py-1.5 text-gray-600 max-w-[100px] truncate">{row.stage}</td>
                      <td className="px-3 py-1.5 text-gray-800 max-w-[140px] truncate">{row.checkPoint}</td>
                      <td className="px-3 py-1.5 text-gray-600 max-w-[100px] truncate">{row.method}</td>
                      <td className="px-3 py-1.5 text-gray-600 max-w-[140px] truncate">{row.specification}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {excelPreview.totalCPs > 10 && (
                <p className="text-[10px] text-gray-400 mt-2 text-center">… and {excelPreview.totalCPs - 10} more checkpoints</p>
              )}
            </div>

            {/* Actions */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-3 font-medium">How would you like to import these sections?</p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setShowExcelModal(false); setExcelPreview(null); }}
                  className="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-100 text-gray-600 rounded-xl text-sm font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => applyExcelImport("append")}
                  className="flex-1 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-sm font-bold transition"
                >
                  + Append to existing sections
                </button>
                <button
                  onClick={() => applyExcelImport("replace")}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition shadow-sm shadow-blue-200"
                >
                  Replace all sections
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateBuilder;
