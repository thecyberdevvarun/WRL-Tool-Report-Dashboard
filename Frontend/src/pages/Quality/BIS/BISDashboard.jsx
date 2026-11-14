import { useEffect, useState, useMemo } from "react";
import { useLocation } from "react-router-dom";
import {
  RefreshCw,
  Zap,
  Settings2,
  ShieldCheck,
  AlertTriangle,
  Pencil,
  FileUp,
  CloudUpload as CloudUploadIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import axios from "axios";
import PopupModal from "../../../components/ui/PopupModal";
import { baseURL } from "../../../assets/assets";
import {
  FieldLabel,
  inputCls,
  MONTHS,
  YEARS,
  ScanningModal,
  ConfirmEnergyModal,
  SearchableSelect,
  SCAN_STEPS,
  reportTypeLabel,
} from "./shared";
import BISTestReportsTab from "./BISTestReportsTab";
import BISReportsTab from "./BISReportsTab";
import BISComplianceTab from "./BISComplianceTab";
import BISEnergyTab from "./BISEnergyTab";
import BISConfigTab from "./BISConfigTab";
import BISModelSetupModal from "./BISModelSetupModal";
import BISTestScheduleTab from "./BISTestScheduleTab";
import BISApprovalQueue from "./BISApprovalQueue";
import BISUploadTab from "./BISUploadTab";

// Each tab is also its own route (see routes.config.js) — all pointing at
// this same BISDashboard component, which derives which tab is active from
// the current URL (there's no in-page tab bar; navigation between them
// happens via the sidebar) while keeping all the fetching/state logic in
// one place.
const TABS = [
  { key: "upload", path: "/quality/bis-upload" },
  { key: "testReports", path: "/quality/bis-reports" },
  { key: "approvals", path: "/quality/bis-approvals" },
  { key: "schedule", path: "/quality/bis-test-schedule" },
  { key: "reports", path: "/quality/bis-legacy-reports" },
  { key: "compliance", path: "/quality/bis-compliance" },
  { key: "energy", path: "/quality/bis-energy" },
  { key: "config", path: "/quality/bis-config" },
];

const OVERRIDE_FIELDS = [
  "introductionFrequencyMonths",
  "introductionDurationDays",
  "soundFrequencyMonths",
  "soundDurationDays",
  "volumeFrequencyMonths",
  "volumeDurationDays",
];
const emptyOverrides = Object.fromEntries(OVERRIDE_FIELDS.map((k) => [k, ""]));

const BISDashboard = () => {
  const location = useLocation();
  const activeTab =
    TABS.find((t) => t.path === location.pathname)?.key || "testReports";
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [status, setStatus] = useState([]);
  const [loading, setLoading] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [itemToUpdate, setItemToUpdate] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateFields, setUpdateFields] = useState({
    srNo: "",
    modelName: "",
    year: "",
    month: "",
    testFrequency: "",
    description: "",
    selectedFile: null,
  });

  // ── Post-upload: scanning animation + extracted-value confirmation ────────
  const [showScanningModal, setShowScanningModal] = useState(false);
  const [scanStep, setScanStep] = useState(0);
  const [confirmData, setConfirmData] = useState(null);
  const [confirmSaving, setConfirmSaving] = useState(false);

  useEffect(() => {
    if (!showScanningModal) {
      setScanStep(0);
      return;
    }
    const timer = setInterval(
      () => setScanStep((s) => Math.min(s + 1, SCAN_STEPS.length - 1)),
      900,
    );
    return () => clearInterval(timer);
  }, [showScanningModal]);

  // ── BIS Config (BISCategory master) ────────────────────────────────────────
  const [bisCategories, setBisCategories] = useState([]);
  const [type100Materials, setType100Materials] = useState([]);
  const [categorySearch, setCategorySearch] = useState("");
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryModalMode, setCategoryModalMode] = useState("add");
  const [categoryForm, setCategoryForm] = useState({
    id: null,
    materialCode: "",
    modelName: "",
    category: "0",
    ...emptyOverrides,
  });
  const [showDeleteCategoryModal, setShowDeleteCategoryModal] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const [showOverrideSection, setShowOverrideSection] = useState(false);

  // ── BIS Approval Flow (Preparer/Reviewer/Authorizer assignment + signatures) ──
  const [approvalFlow, setApprovalFlow] = useState(null);
  const [approvalFlowLoading, setApprovalFlowLoading] = useState(false);
  const [approvalUsers, setApprovalUsers] = useState([]);

  // ── BIS Test Schedule (frequency config + computed schedule) ──────────────
  const [testConfig, setTestConfig] = useState(null);
  const [testConfigLoading, setTestConfigLoading] = useState(false);
  const [schedule, setSchedule] = useState([]);
  const [scheduleSummary, setScheduleSummary] = useState({
    overdue: 0,
    dueSoon: 0,
    scheduled: 0,
    noBaseline: 0,
  });
  const [scheduleLoading, setScheduleLoading] = useState(false);

  const stats = useMemo(
    () => ({
      totalFiles: uploadedFiles.length,
      uniqueModels: new Set(uploadedFiles.map((f) => f.modelName)).size,
      freqCounts: uploadedFiles.reduce((acc, f) => {
        acc[f.testFrequency] = (acc[f.testFrequency] || 0) + 1;
        return acc;
      }, {}),
    }),
    [uploadedFiles],
  );

  // ── API: files / status ─────────────────────────────────────────────────
  const fetchUploadedFiles = async () => {
    try {
      const res = await axios.get(`${baseURL}quality/bis-files`);
      setUploadedFiles(res?.data?.files || []);
    } catch {
      toast.error("Failed to fetch uploaded files");
    }
  };

  const fetchStatus = async () => {
    try {
      const res = await axios.get(`${baseURL}quality/bis-status`);
      setStatus(res?.data?.status || []);
    } catch {
      toast.error("Failed to fetch BIS compliance status");
    }
  };

  useEffect(() => {
    fetchUploadedFiles();
    fetchStatus();
  }, []);

  const refreshAll = () => {
    fetchUploadedFiles();
    fetchStatus();
    fetchSchedule();
  };

  // ── BIS Config API ──────────────────────────────────────────────────────
  const fetchBisCategories = async () => {
    try {
      setCategoryLoading(true);
      const res = await axios.get(`${baseURL}quality/bis-category`);
      setBisCategories(res?.data?.categories || []);
    } catch {
      toast.error("Failed to fetch BIS categories");
    } finally {
      setCategoryLoading(false);
    }
  };
  useEffect(() => {
    fetchBisCategories();
  }, []);

  // ── BIS Approval Flow API ───────────────────────────────────────────────
  const fetchApprovalFlow = async () => {
    try {
      setApprovalFlowLoading(true);
      const res = await axios.get(`${baseURL}quality/bis-approval-flow`);
      setApprovalFlow(res?.data?.flow || null);
    } catch {
      toast.error("Failed to fetch BIS approval flow");
    } finally {
      setApprovalFlowLoading(false);
    }
  };
  useEffect(() => {
    fetchApprovalFlow();
  }, []);

  const fetchApprovalUsers = async () => {
    try {
      const res = await axios.get(`${baseURL}quality/bis-approval-users`);
      setApprovalUsers(res?.data?.users || []);
    } catch {
      toast.error("Failed to fetch users");
    }
  };
  useEffect(() => {
    fetchApprovalUsers();
  }, []);

  const saveApprovalFlow = async (form) => {
    try {
      await axios.put(`${baseURL}quality/bis-approval-flow`, form);
      toast.success("Approval flow saved");
      fetchApprovalFlow();
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to save approval flow",
      );
    }
  };

  const uploadApprovalSignature = async (role, file) => {
    try {
      const formData = new FormData();
      formData.append("signature", file);
      await axios.post(
        `${baseURL}quality/bis-approval-flow/signature/${role}`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      toast.success("Signature uploaded");
      fetchApprovalFlow();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to upload signature");
    }
  };

  const fetchType100Materials = async () => {
    try {
      const res = await axios.get(`${baseURL}quality/type100-materials`);
      setType100Materials(res?.data?.materials || []);
    } catch {
      toast.error("Failed to fetch materials");
    }
  };
  useEffect(() => {
    fetchType100Materials();
  }, []);

  // ── BIS Test Schedule API ───────────────────────────────────────────────
  const fetchTestConfig = async () => {
    try {
      setTestConfigLoading(true);
      const res = await axios.get(`${baseURL}quality/bis-test-config`);
      setTestConfig(res?.data?.config || null);
    } catch {
      toast.error("Failed to fetch BIS test schedule settings");
    } finally {
      setTestConfigLoading(false);
    }
  };
  useEffect(() => {
    fetchTestConfig();
  }, []);

  const saveTestConfig = async (form) => {
    try {
      await axios.put(`${baseURL}quality/bis-test-config`, form);
      toast.success("Test schedule settings saved");
      fetchTestConfig();
      fetchSchedule();
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to save schedule settings",
      );
    }
  };

  const fetchSchedule = async () => {
    try {
      setScheduleLoading(true);
      const res = await axios.get(`${baseURL}quality/bis-test-schedule`);
      setSchedule(res?.data?.schedule || []);
      setScheduleSummary(
        res?.data?.summary || {
          overdue: 0,
          dueSoon: 0,
          scheduled: 0,
          noBaseline: 0,
        },
      );
    } catch {
      toast.error("Failed to fetch BIS test schedule");
    } finally {
      setScheduleLoading(false);
    }
  };
  useEffect(() => {
    fetchSchedule();
  }, []);

  // Sets the one-time "last test date" for one model, one or more report
  // types at once — entered inline in the Test Schedule tab's merged
  // No-Baseline row.
  const handleSaveBaseline = async (entries) => {
    try {
      const res = await axios.post(`${baseURL}quality/bis-test-baseline`, {
        entries,
      });
      toast.success(res?.data?.message || "Baseline saved");
      fetchSchedule();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save baseline");
      throw err;
    }
  };

  // Corrects an already-set baseline date (Status='Baseline' rows only —
  // dates from a submitted report are edited via the report itself).
  const handleEditBaselineDate = async (item, lastTestDate) => {
    try {
      await axios.put(
        `${baseURL}quality/bis-test-baseline/${item.sourceReportId}`,
        { lastTestDate },
      );
      toast.success("Last test date updated");
      fetchSchedule();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update date");
      throw err;
    }
  };

  // Same "9-char prefix + optional ' RT'" convention the backend derives
  // BISCategory.ModelName with.
  const deriveModelName = (name) => {
    if (!name) return "";
    const prefix = name.slice(0, 9);
    return name.slice(-1).toUpperCase() === "R" ? `${prefix} RT` : prefix;
  };

  const unclassifiedMaterials = useMemo(() => {
    const existingCodes = new Set(bisCategories.map((c) => c.materialCode));
    return type100Materials.filter((m) => !existingCodes.has(m.matCode));
  }, [type100Materials, bisCategories]);

  const handleSelectMaterial = (matCode) => {
    const material = type100Materials.find((m) => m.matCode === matCode);
    setCategoryForm((p) => ({
      ...p,
      materialCode: matCode,
      modelName: material ? deriveModelName(material.name) : "",
    }));
  };

  const openAddCategoryModal = () => {
    setCategoryModalMode("add");
    setCategoryForm({
      id: null,
      materialCode: "",
      modelName: "",
      category: "0",
      ...emptyOverrides,
    });
    setShowOverrideSection(false);
    setShowCategoryModal(true);
  };

  const openEditCategoryModal = (row) => {
    setCategoryModalMode("edit");
    const overrides = Object.fromEntries(
      OVERRIDE_FIELDS.map((k) => [k, row[k] ?? ""]),
    );
    setCategoryForm({
      id: row.id,
      materialCode: row.materialCode,
      modelName: row.modelName,
      category: String(row.category),
      ...overrides,
    });
    setShowOverrideSection(
      OVERRIDE_FIELDS.some((k) => row[k] !== null && row[k] !== undefined),
    );
    setShowCategoryModal(true);
  };

  const saveCategoryModal = async () => {
    const { id, materialCode, modelName, category, ...overrides } =
      categoryForm;
    if (!materialCode.trim()) return toast.error("Material Code is required");
    if (!modelName.trim()) return toast.error("Model Name is required");

    const payload = {
      materialCode: materialCode.trim(),
      modelName: modelName.trim(),
      category: Number(category),
      ...overrides,
    };

    try {
      setCategoryLoading(true);
      if (categoryModalMode === "add") {
        await axios.post(`${baseURL}quality/bis-category`, payload);
        toast.success("BIS category added successfully");
      } else {
        await axios.put(`${baseURL}quality/bis-category/${id}`, payload);
        toast.success("BIS category updated successfully");
      }
      setShowCategoryModal(false);
      fetchBisCategories();
      fetchSchedule();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save BIS category");
    } finally {
      setCategoryLoading(false);
    }
  };

  // Inline schedule-override save from the BIS Config model table — reuses
  // the same update-category endpoint, just without opening the full modal.
  const saveCategoryOverridesInline = async (row, overrides) => {
    try {
      await axios.put(`${baseURL}quality/bis-category/${row.id}`, {
        materialCode: row.materialCode,
        modelName: row.modelName,
        category: row.category,
        ...overrides,
      });
      toast.success("Schedule override saved");
      fetchBisCategories();
      fetchSchedule();
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to save schedule override",
      );
      throw err;
    }
  };

  const uploadCategoryPhoto = async (row, file) => {
    const formData = new FormData();
    formData.append("photo", file);
    try {
      await axios.post(
        `${baseURL}quality/bis-category/${row.id}/photo`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      toast.success("Model photo uploaded");
      fetchBisCategories();
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to upload model photo",
      );
    }
  };

  // ── BIS Test Lab setup (Photo / Specs / Test Plan) modal ──────────────────
  const [setupModalRow, setSetupModalRow] = useState(null);

  const handleDeleteCategory = (row) => {
    setCategoryToDelete(row);
    setShowDeleteCategoryModal(true);
  };

  const confirmDeleteCategory = async () => {
    try {
      setCategoryLoading(true);
      await axios.delete(
        `${baseURL}quality/bis-category/${categoryToDelete.id}`,
      );
      toast.success("BIS category deleted successfully");
      fetchBisCategories();
      setShowDeleteCategoryModal(false);
    } catch {
      toast.error("Failed to delete BIS category");
    } finally {
      setCategoryLoading(false);
    }
  };

  const handleConfirmEnergyData = async () => {
    if (!confirmData?.srNo) return;
    try {
      setConfirmSaving(true);
      await axios.put(`${baseURL}quality/bis-energy-data/${confirmData.srNo}`, {
        declaredAnnualEnergy: confirmData.declaredAnnualEnergy,
        measuredAnnualEnergy: confirmData.measuredAnnualEnergy,
        energyDeviationPercent: confirmData.energyDeviationPercent,
        testResult: confirmData.testResult,
      });
      toast.success("Energy data confirmed");
      setConfirmData(null);
      fetchUploadedFiles();
      fetchStatus();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save energy data");
    } finally {
      setConfirmSaving(false);
    }
  };

  // ── Upload ──────────────────────────────────────────────────────────────
  const handleUpload = async ({ modelName, year, month, testFrequency, description, file }) => {
    const formData = new FormData();
    formData.append("modelName", modelName);
    formData.append("year", year);
    formData.append("month", month);
    formData.append("testFrequency", testFrequency);
    formData.append("description", description);
    formData.append("file", file);

    try {
      setLoading(true);
      setShowScanningModal(true);
      const res = await axios.post(`${baseURL}quality/upload-bis-pdf`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (res?.data?.success) {
        toast.success("BIS Report uploaded successfully");
        fetchUploadedFiles();
        fetchStatus();
        const energyData = res.data.energyData || {};
        setConfirmData({
          srNo: res.data.srNo,
          declaredAnnualEnergy: energyData.declaredAnnualEnergy ?? "",
          measuredAnnualEnergy: energyData.measuredAnnualEnergy ?? "",
          energyDeviationPercent: energyData.energyDeviationPercent ?? "",
          testResult: energyData.testResult || "",
        });
        return true;
      }
      return false;
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to upload BIS Report");
      return false;
    } finally {
      setLoading(false);
      setShowScanningModal(false);
    }
  };

  const handleFetchEnergyData = async (file) => {
    try {
      setShowScanningModal(true);
      const res = await axios.post(
        `${baseURL}quality/bis-fetch-energy-data/${file.srNo}`,
      );
      if (res?.data?.success) {
        const energyData = res.data.energyData || {};
        setConfirmData({
          srNo: file.srNo,
          declaredAnnualEnergy: energyData.declaredAnnualEnergy ?? "",
          measuredAnnualEnergy: energyData.measuredAnnualEnergy ?? "",
          energyDeviationPercent: energyData.energyDeviationPercent ?? "",
          testResult: energyData.testResult || "",
        });
      }
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to fetch data from PDF",
      );
    } finally {
      setShowScanningModal(false);
    }
  };

  // ── Update / Delete / Download ─────────────────────────────────────────────
  const validatePdf = (file) => {
    if (!file) return false;
    if (file.type !== "application/pdf") {
      toast.error("Please upload only PDF files");
      return false;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10 MB");
      return false;
    }
    return true;
  };

  const handleUpdate = (item) => {
    setItemToUpdate(item);
    setUpdateFields({
      srNo: item.srNo,
      modelName: item.modelName,
      year: item.year,
      month: item.month,
      testFrequency: item.testFrequency,
      description: item.description,
      selectedFile: null,
    });
    setShowUpdateModal(true);
  };

  const confirmUpdate = async () => {
    const u = updateFields;
    if (!u.modelName?.trim()) return toast.error("Model Name is required");
    if (!u.year?.toString().trim()) return toast.error("Year is required");
    if (!u.month?.trim()) return toast.error("Month is required");
    if (!u.testFrequency?.trim())
      return toast.error("Test Frequency is required");
    if (!u.description?.trim()) return toast.error("Description is required");

    const formData = new FormData();
    ["modelName", "year", "month", "testFrequency", "description"].forEach(
      (k) => formData.append(k, u[k]?.toString().trim()),
    );
    if (u.selectedFile) formData.append("file", u.selectedFile);

    try {
      setLoading(true);
      const res = await axios.put(
        `${baseURL}quality/update-bis-file/${itemToUpdate.srNo}`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      if (res?.data?.success) {
        toast.success(res.data.message || "BIS Report updated successfully");
        fetchUploadedFiles();
        fetchStatus();
        setShowUpdateModal(false);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update BIS Report");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (file) => {
    try {
      const response = await axios({
        url: `${baseURL}quality/download-bis-file/${file.srNo}`,
        method: "GET",
        responseType: "blob",
        params: { filename: file.fileName },
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", file.fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Download started");
    } catch {
      toast.error("Failed to download file");
    }
  };

  const handleDeleteFile = (file) => {
    setItemToDelete(file);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    try {
      setLoading(true);
      const { srNo, fileName } = itemToDelete;
      const res = await axios.delete(
        `${baseURL}quality/delete-bis-file/${srNo}`,
        { params: { filename: fileName } },
      );
      if (res?.data?.success) {
        toast.success("File deleted successfully");
        fetchUploadedFiles();
        fetchStatus();
      }
      setShowDeleteModal(false);
    } catch {
      toast.error("Failed to delete file");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      {/* ── STICKY HEADER ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shadow-sm shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-tight">
            BIS Report Manager
          </h1>
          <p className="text-[11px] text-slate-400">
            Upload, manage &amp; analyse BIS test reports
          </p>
        </div>
        <div className="flex items-center gap-2">
          {stats.totalFiles > 0 && (
            <>
              <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-blue-50 border border-blue-100 min-w-[90px]">
                <span className="text-xl font-bold font-mono text-blue-700">
                  {stats.totalFiles || 0}
                </span>
                <span className="text-[10px] text-blue-500 font-medium uppercase tracking-wide">
                  Total Reports
                </span>
              </div>
              <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-violet-50 border border-violet-100 min-w-[90px]">
                <span className="text-xl font-bold font-mono text-violet-700">
                  {stats.uniqueModels || 0}
                </span>
                <span className="text-[10px] text-violet-500 font-medium uppercase tracking-wide">
                  Models
                </span>
              </div>
              <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-violet-50 border border-violet-100 min-w-[90px]">
                <span className="text-xl font-bold font-mono text-violet-700">
                  {stats.freqCounts.Monthly || 0}
                </span>
                <span className="text-[10px] text-violet-500 font-medium uppercase tracking-wide">
                  Monthly Reports
                </span>
              </div>
              <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-amber-50 border border-amber-100 min-w-[90px]">
                <span className="text-xl font-bold font-mono text-amber-700">
                  {stats.freqCounts.Quarterly || 0}
                </span>
                <span className="text-[10px] text-amber-500 font-medium uppercase tracking-wide">
                  Quarterly Reports
                </span>
              </div>
            </>
          )}
          <button
            onClick={refreshAll}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-600 transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-3">
        {/* ── STAT CARDS — legacy PDF archive stats, only relevant on that page ── */}

        {activeTab === "upload" && (
          <BISUploadTab uploading={loading} onUpload={handleUpload} />
        )}

        {activeTab === "testReports" && <BISTestReportsTab />}

        {activeTab === "approvals" && <BISApprovalQueue />}

        {activeTab === "reports" && (
          <BISReportsTab
            files={uploadedFiles}
            onEdit={handleUpdate}
            onDownload={handleDownload}
            onDelete={handleDeleteFile}
            onFetchData={handleFetchEnergyData}
          />
        )}

        {activeTab === "schedule" && (
          <BISTestScheduleTab
            schedule={schedule}
            summary={scheduleSummary}
            loading={scheduleLoading}
            onRefresh={fetchSchedule}
            onSaveBaseline={handleSaveBaseline}
            onEditBaselineDate={handleEditBaselineDate}
          />
        )}

        {activeTab === "compliance" &&
          (status.length === 0 && uploadedFiles.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
              <ShieldCheck className="w-12 h-12 opacity-20" strokeWidth={1.2} />
              <p className="text-sm text-slate-500">
                No compliance data available yet.
              </p>
            </div>
          ) : (
            <BISComplianceTab status={status} />
          ))}

        {activeTab === "energy" &&
          (uploadedFiles.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
              <Zap className="w-12 h-12 opacity-20" strokeWidth={1.2} />
              <p className="text-sm text-slate-500">
                No data available for energy analysis yet.
              </p>
              <p className="text-xs text-slate-400">
                Upload some BIS reports to see charts.
              </p>
            </div>
          ) : (
            <BISEnergyTab files={uploadedFiles} />
          ))}

        {activeTab === "config" && (
          <BISConfigTab
            categories={bisCategories}
            categorySearch={categorySearch}
            setCategorySearch={setCategorySearch}
            categoryLoading={categoryLoading}
            onRefresh={fetchBisCategories}
            onAddCategory={openAddCategoryModal}
            onEditCategory={openEditCategoryModal}
            onDeleteCategory={handleDeleteCategory}
            testConfig={testConfig}
            testConfigLoading={testConfigLoading}
            onSaveTestConfig={saveTestConfig}
            onInlineUpdateOverrides={saveCategoryOverridesInline}
            approvalFlow={approvalFlow}
            approvalFlowLoading={approvalFlowLoading}
            approvalUsers={approvalUsers}
            onSaveApprovalFlow={saveApprovalFlow}
            onUploadApprovalSignature={uploadApprovalSignature}
            onUploadCategoryPhoto={uploadCategoryPhoto}
            onOpenSetup={setSetupModalRow}
          />
        )}
      </div>

      {setupModalRow && (
        <BISModelSetupModal
          row={setupModalRow}
          onClose={() => setSetupModalRow(null)}
        />
      )}

      {/* ── UPDATE MODAL ── */}
      {showUpdateModal && (
        <PopupModal
          title="Update BIS Report"
          description=""
          confirmText={loading ? "Updating…" : "Save Changes"}
          cancelText="Cancel"
          modalId="update-modal"
          onConfirm={confirmUpdate}
          onCancel={() => setShowUpdateModal(false)}
          icon={<Pencil className="w-8 h-8 text-blue-500 mx-auto" />}
          confirmButtonColor="bg-blue-600 hover:bg-blue-700"
          modalClassName="w-[95%] max-w-3xl"
        >
          <div className="mt-4 grid md:grid-cols-2 gap-4 text-left">
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <FileUp className="w-3.5 h-3.5 text-blue-500" /> Replace PDF
                (optional)
              </p>
              <label
                htmlFor="update-file-upload"
                className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl min-h-[140px] cursor-pointer hover:border-blue-300 hover:bg-blue-50/40 transition-all"
              >
                <input
                  type="file"
                  id="update-file-upload"
                  accept=".pdf"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file && validatePdf(file))
                      setUpdateFields((p) => ({ ...p, selectedFile: file }));
                  }}
                  className="hidden"
                />
                <CloudUploadIcon className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-xs text-slate-500">
                  {updateFields.selectedFile
                    ? updateFields.selectedFile.name
                    : "Click to upload new PDF"}
                </p>
              </label>
              {!updateFields.selectedFile && itemToUpdate?.fileName && (
                <div className="mt-3 p-2 bg-emerald-50 rounded-lg text-center">
                  <p className="text-[11px] text-emerald-700">
                    Current: {itemToUpdate.fileName}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Kept if no new file selected
                  </p>
                </div>
              )}
              {updateFields.selectedFile && (
                <button
                  type="button"
                  onClick={() =>
                    setUpdateFields((p) => ({ ...p, selectedFile: null }))
                  }
                  className="mt-2 text-[11px] text-red-500 hover:underline flex items-center gap-1"
                >
                  <FileUp className="w-3 h-3" /> Remove new file
                </button>
              )}
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <FieldLabel>Model Name</FieldLabel>
                  <input
                    type="text"
                    value={updateFields.modelName}
                    onChange={(e) =>
                      setUpdateFields((p) => ({
                        ...p,
                        modelName: e.target.value,
                      }))
                    }
                    className={inputCls}
                  />
                </div>
                <div>
                  <FieldLabel>Sr No</FieldLabel>
                  <div className="h-9 px-3 flex items-center bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-500">
                    {updateFields.srNo}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    label: "Year",
                    key: "year",
                    options: ["", ...YEARS].map((y) => ({
                      value: String(y),
                      label: y || "Select",
                    })),
                  },
                  {
                    label: "Month",
                    key: "month",
                    options: ["", ...MONTHS].map((m) => ({
                      value: m,
                      label: m || "Select",
                    })),
                  },
                  {
                    label: "Frequency",
                    key: "testFrequency",
                    options: [
                      { value: "", label: "Select" },
                      ...["Monthly", "Quarterly", "Yearly"].map((v) => ({
                        value: v,
                        label: v,
                      })),
                    ],
                  },
                ].map(({ label, key, options }) => (
                  <div key={key}>
                    <FieldLabel>{label}</FieldLabel>
                    <select
                      value={updateFields[key]}
                      onChange={(e) =>
                        setUpdateFields((p) => ({
                          ...p,
                          [key]: e.target.value,
                        }))
                      }
                      className={inputCls}
                    >
                      {options.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <div>
                <FieldLabel>Description</FieldLabel>
                <textarea
                  value={updateFields.description}
                  onChange={(e) =>
                    setUpdateFields((p) => ({
                      ...p,
                      description: e.target.value,
                    }))
                  }
                  rows={4}
                  className={`${inputCls} resize-none`}
                />
              </div>
            </div>
          </div>
        </PopupModal>
      )}

      {/* ── DELETE MODAL ── */}
      {showDeleteModal && (
        <PopupModal
          title="Delete Report"
          description={`Are you sure you want to delete "${itemToDelete?.modelName} – ${itemToDelete?.month} ${itemToDelete?.year}"? This action cannot be undone.`}
          confirmText={loading ? "Deleting…" : "Yes, Delete"}
          cancelText="Cancel"
          modalId="delete-modal"
          onConfirm={confirmDelete}
          onCancel={() => setShowDeleteModal(false)}
          icon={<AlertTriangle className="w-10 h-10 text-red-500 mx-auto" />}
          confirmButtonColor="bg-red-600 hover:bg-red-700"
        />
      )}

      {/* ── BIS CATEGORY ADD/EDIT MODAL ── */}
      {showCategoryModal && (
        // Forced-light: contains the schedule-override section, only designed
        // for light mode — browsers that force-invert undeclared-scheme pages
        // otherwise wash this out under a dark OS/browser theme.
        <div style={{ colorScheme: "light" }}>
          <PopupModal
            title={
              categoryModalMode === "add"
                ? "Add BIS Category"
                : "Edit BIS Category"
            }
            description=""
            confirmText={categoryLoading ? "Saving…" : "Save"}
            cancelText="Cancel"
            modalId="category-modal"
            onConfirm={saveCategoryModal}
            onCancel={() => setShowCategoryModal(false)}
            icon={<Settings2 className="w-8 h-8 text-blue-500 mx-auto" />}
            confirmButtonColor="bg-blue-600 hover:bg-blue-700"
            modalClassName="w-[95%] max-w-lg"
          >
            <div className="mt-4 space-y-3 text-left">
              {categoryModalMode === "add" ? (
                <div>
                  <FieldLabel>Material (Material Code auto-filled)</FieldLabel>
                  <SearchableSelect
                    placeholder="Type to search material name / code…"
                    value={categoryForm.materialCode}
                    onChange={handleSelectMaterial}
                    options={unclassifiedMaterials.map((m) => ({
                      value: m.matCode,
                      label: `${m.name} (${m.matCode})`,
                    }))}
                  />
                  {categoryForm.materialCode && (
                    <p className="text-[11px] text-slate-400 mt-1">
                      Material Code:{" "}
                      <span className="font-mono">
                        {categoryForm.materialCode}
                      </span>
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <FieldLabel>Material Code</FieldLabel>
                  <input
                    type="text"
                    value={categoryForm.materialCode}
                    disabled
                    className={`${inputCls} bg-slate-100 text-slate-400`}
                  />
                </div>
              )}
              <div>
                <FieldLabel>Model Name</FieldLabel>
                <input
                  type="text"
                  value={categoryForm.modelName}
                  onChange={(e) =>
                    setCategoryForm((p) => ({
                      ...p,
                      modelName: e.target.value,
                    }))
                  }
                  className={inputCls}
                />
              </div>
              <div>
                <FieldLabel>Category</FieldLabel>
                <select
                  value={categoryForm.category}
                  onChange={(e) =>
                    setCategoryForm((p) => ({ ...p, category: e.target.value }))
                  }
                  className={inputCls}
                >
                  <option value="0">Non-BIS</option>
                  <option value="1">BIS</option>
                </select>
              </div>

              {categoryForm.category === "1" && (
                <div className="border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowOverrideSection((v) => !v)}
                    className="text-[11px] font-semibold text-blue-600 hover:underline"
                  >
                    {showOverrideSection ? "− Hide" : "+ Override"} schedule for
                    this model
                  </button>
                  {showOverrideSection && (
                    <div className="mt-3 space-y-2">
                      <p className="text-[10px] text-slate-400">
                        Leave blank to use the global default from BIS Config's
                        Test Schedule Settings.
                      </p>
                      {[
                        {
                          type: "Introduction",
                          freqKey: "introductionFrequencyMonths",
                          durKey: "introductionDurationDays",
                        },
                        {
                          type: "Sound",
                          freqKey: "soundFrequencyMonths",
                          durKey: "soundDurationDays",
                        },
                        {
                          type: "Volume",
                          freqKey: "volumeFrequencyMonths",
                          durKey: "volumeDurationDays",
                        },
                      ].map(({ type, freqKey, durKey }) => (
                        <div
                          key={type}
                          className="grid grid-cols-3 gap-2 items-end"
                        >
                          <p className="text-[11px] font-semibold text-slate-600">
                            {reportTypeLabel(type)}
                          </p>
                          <div>
                            <FieldLabel>Freq (months)</FieldLabel>
                            <input
                              type="number"
                              min={1}
                              placeholder="Default"
                              value={categoryForm[freqKey]}
                              onChange={(e) =>
                                setCategoryForm((p) => ({
                                  ...p,
                                  [freqKey]: e.target.value,
                                }))
                              }
                              className={inputCls}
                            />
                          </div>
                          <div>
                            <FieldLabel>Duration (days)</FieldLabel>
                            <input
                              type="number"
                              min={1}
                              placeholder="Default"
                              value={categoryForm[durKey]}
                              onChange={(e) =>
                                setCategoryForm((p) => ({
                                  ...p,
                                  [durKey]: e.target.value,
                                }))
                              }
                              className={inputCls}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </PopupModal>
        </div>
      )}

      {/* ── BIS CATEGORY DELETE MODAL ── */}
      {showDeleteCategoryModal && (
        <PopupModal
          title="Delete BIS Category"
          description={`Are you sure you want to delete "${categoryToDelete?.modelName}" (${categoryToDelete?.materialCode})? This action cannot be undone.`}
          confirmText={categoryLoading ? "Deleting…" : "Yes, Delete"}
          cancelText="Cancel"
          modalId="delete-category-modal"
          onConfirm={confirmDeleteCategory}
          onCancel={() => setShowDeleteCategoryModal(false)}
          icon={<AlertTriangle className="w-10 h-10 text-red-500 mx-auto" />}
          confirmButtonColor="bg-red-600 hover:bg-red-700"
        />
      )}

      {/* ── SCANNING MODAL ── */}
      {showScanningModal && <ScanningModal step={scanStep} />}

      {/* ── CONFIRM EXTRACTED ENERGY DATA ── */}
      {confirmData && (
        <ConfirmEnergyModal
          data={confirmData}
          onChange={setConfirmData}
          onConfirm={handleConfirmEnergyData}
          onCancel={() => setConfirmData(null)}
          saving={confirmSaving}
        />
      )}
    </div>
  );
};

export default BISDashboard;
