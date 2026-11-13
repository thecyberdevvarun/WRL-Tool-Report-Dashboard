import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import SelectField from "../../../components/ui/SelectField.jsx";
import DateTimePicker from "../../../components/ui/DateTimePicker.jsx";
import ExportButton from "../../../components/ui/ExportButton.jsx";
import Loader from "../../../components/ui/Loader.jsx";
import axios from "axios";
import toast from "react-hot-toast";
import { baseURL } from "../../../assets/assets.js";
import { useGetModelVariantsQuery } from "../../../redux/api/commonApi.js";
import * as XLSX from "xlsx";
import {
  Search,
  ChevronUp,
  ChevronDown,
  Loader2,
  PackageOpen,
  X,
  Download,
  Filter,
} from "lucide-react";

// ── Spinner ────────────────────────────────────────────────────────────────────
const Spinner = ({ cls = "w-4 h-4" }) => (
  <Loader2 className={`animate-spin ${cls}`} />
);

// ── SortIcon ───────────────────────────────────────────────────────────────────
const SortIcon = ({ active, dir }) => (
  <span className="inline-flex flex-col ml-1">
    <ChevronUp
      className={`w-2.5 h-2.5 -mb-0.5 ${active && dir === "asc" ? "text-blue-500" : "text-slate-400"}`}
    />
    <ChevronDown
      className={`w-2.5 h-2.5          ${active && dir === "desc" ? "text-blue-500" : "text-slate-400"}`}
    />
  </span>
);

// ── Department options ─────────────────────────────────────────────────────────
const DEPARTMENT_OPTIONS = [
  { label: "Post Foaming", value: "post-foaming" },
  { label: "Final Loading", value: "final-loading" },
  { label: "Final", value: "final" },
];

const LIMIT = 1000;

// ── Main Component ─────────────────────────────────────────────────────────────
const TotalProduction = () => {
  /* ── loading ────────────────────────────────────────────── */
  const [loading, setLoading] = useState(false);
  const [ydayLoading, setYdayLoading] = useState(false);
  const [todayLoading, setTodayLoading] = useState(false);
  const [monthLoading, setMonthLoading] = useState(false);

  /* ── filters ────────────────────────────────────────────── */
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [selectedModelVariant, setSelectedModelVariant] = useState(null);
  const [selectedDep, setSelectedDep] = useState(DEPARTMENT_OPTIONS[0]);

  /* ── data ───────────────────────────────────────────────── */
  const [totalProductionData, setTotalProductionData] = useState([]);
  const [summaryData, setSummaryData] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedModelName, setSelectedModelName] = useState(null);

  /* ── pagination / sort ──────────────────────────────────── */
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  /* ── RTK Query ──────────────────────────────────────────── */
  const {
    data: variants = [],
    isLoading: variantsLoading,
    error: variantsError,
  } = useGetModelVariantsQuery();
  useEffect(() => {
    if (variantsError) toast.error("Failed to load model variants");
  }, [variantsError]);

  /* ── reset on filter change ─────────────────────────────── */
  useEffect(() => {
    setTotalProductionData([]);
    setSummaryData([]);
    setTotalCount(0);
    setPage(1);
    setHasMore(false);
    setSelectedModelName(null);
  }, [selectedDep, selectedModelVariant]);

  /* ── infinite scroll ────────────────────────────────────── */
  const observer = useRef();
  const lastRowRef = useCallback(
    (node) => {
      if (loading || selectedModelName) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) setPage((p) => p + 1);
      });
      if (node) observer.current.observe(node);
    },
    [loading, hasMore, selectedModelName],
  );

  /* ── date helper ────────────────────────────────────────── */
  const fmt = (date) => {
    const p = (n) => (n < 10 ? "0" + n : n);
    return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())} ${p(date.getHours())}:${p(date.getMinutes())}`;
  };

  /* ── paginated fetch ────────────────────────────────────── */
  const fetchTotalProductionData = async (pageNumber = 1) => {
    if (!startTime || !endTime) {
      toast.error("Please select a Time Range.");
      return;
    }
    try {
      setLoading(true);
      const params = {
        startDate: startTime,
        endDate: endTime,
        page: pageNumber,
        limit: LIMIT,
        department: selectedDep.value,
        model: selectedModelVariant
          ? parseInt(selectedModelVariant.value, 10)
          : 0,
      };
      const res = await axios.get(`${baseURL}prod/barcode-details`, { params });
      if (res?.data?.success) {
        const incoming = res.data.data ?? [];
        setTotalProductionData((prev) => {
          const existing = new Set(prev.map((d) => d.FG_SR));
          const unique = incoming.filter((item) => !existing.has(item.FG_SR));
          return pageNumber === 1 ? incoming : [...prev, ...unique];
        });
        if (pageNumber === 1) setTotalCount(res.data.totalCount ?? 0);
        setHasMore(incoming.length >= LIMIT);
      }
    } catch {
      toast.error("Failed to fetch production data.");
    } finally {
      setLoading(false);
    }
  };

  /* ── export fetch ───────────────────────────────────────── */
  const fetchExportData = useCallback(async () => {
    if (!startTime || !endTime) {
      toast.error("Please select a Time Range.");
      return [];
    }
    try {
      const params = {
        startDate: startTime,
        endDate: endTime,
        department: selectedDep.value,
        model: selectedModelVariant
          ? parseInt(selectedModelVariant.value, 10)
          : 0,
      };
      const res = await axios.get(`${baseURL}prod/export-total-production`, {
        params,
      });
      return res?.data?.success ? res.data.data : [];
    } catch {
      toast.error("Failed to fetch export data.");
      return [];
    }
  }, [startTime, endTime, selectedDep, selectedModelVariant]);

  /* ── pagination trigger ─────────────────────────────────── */
  useEffect(() => {
    if (page === 1) return;
    fetchTotalProductionData(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  /* ── quick filter ───────────────────────────────────────── */
  const applyQuickFilter = async (
    endpoint,
    startDate,
    endDate,
    setLoadingFn,
  ) => {
    try {
      setLoadingFn(true);
      setTotalProductionData([]);
      setSummaryData([]);
      setTotalCount(0);
      setSelectedModelName(null);
      const params = {
        startDate,
        endDate,
        department: selectedDep.value,
        model: selectedModelVariant
          ? parseInt(selectedModelVariant.value, 10)
          : 0,
      };
      const res = await axios.get(`${baseURL}prod/${endpoint}`, { params });
      if (res?.data?.success) {
        setTotalProductionData(res.data.data);
        setSummaryData(res.data.data);
        setTotalCount(res.data.totalCount ?? res.data.data.length);
      }
    } catch {
      toast.error("Failed to fetch data.");
    } finally {
      setLoadingFn(false);
    }
  };

  const fetchYesterday = () => {
    const now = new Date(),
      today8 = new Date(now);
    today8.setHours(8, 0, 0, 0);
    const yday8 = new Date(today8);
    yday8.setDate(today8.getDate() - 1);
    applyQuickFilter(
      "yday-total-production",
      fmt(yday8),
      fmt(today8),
      setYdayLoading,
    );
  };
  const fetchToday = () => {
    const now = new Date(),
      today8 = new Date(now);
    today8.setHours(8, 0, 0, 0);
    applyQuickFilter(
      "today-total-production",
      fmt(today8),
      fmt(now),
      setTodayLoading,
    );
  };
  const fetchMTD = () => {
    const now = new Date(),
      startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 8, 0, 0);
    applyQuickFilter(
      "month-total-production",
      fmt(startOfMonth),
      fmt(now),
      setMonthLoading,
    );
  };

  // Default to Today's data on first load instead of sitting empty until a
  // quick filter is clicked.
  useEffect(() => {
    fetchToday();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── query button ───────────────────────────────────────── */
  const handleQuery = async () => {
    setPage(1);
    setTotalProductionData([]);
    setSummaryData([]);
    setHasMore(false);
    setSelectedModelName(null);
    fetchTotalProductionData(1);
    const fullData = await fetchExportData();
    setSummaryData(fullData);
  };

  /* ── summary helpers ────────────────────────────────────── */
  const getCategoryCounts = (data) => {
    const counts = {};
    data.forEach((item) => {
      const k = item.category || "Unknown";
      counts[k] = (counts[k] || 0) + 1;
    });
    return counts;
  };
  const getModelNameCount = (data) => {
    const counts = {};
    data.forEach((item) => {
      const k = item.Model_Name || "Unknown";
      counts[k] = (counts[k] || 0) + 1;
    });
    return counts;
  };

  /* ── export helpers ─────────────────────────────────────── */
  const exportToExcel = (rows, sheetName, fileName) => {
    if (!rows?.length) {
      toast.error("No data to export.");
      return;
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  };
  const handleExportModelSummary = () =>
    exportToExcel(
      Object.entries(getModelNameCount(summaryData)).map(
        ([Model_Name, Count]) => ({ Model_Name, Count }),
      ),
      "Model Summary",
      "Model_Summary_Report",
    );
  const handleExportCategorySummary = () =>
    exportToExcel(
      Object.entries(getCategoryCounts(summaryData)).map(
        ([Category, Count]) => ({ Category, Count }),
      ),
      "Category Summary",
      "Category_Summary_Report",
    );

  /* ── filter / sort ──────────────────────────────────────── */
  const filteredData = selectedModelName
    ? summaryData.filter((item) => item.Model_Name === selectedModelName)
    : totalProductionData;

  const sortedData = useMemo(() => {
    if (!sortConfig.key) return [...filteredData];
    return [...filteredData].sort((a, b) => {
      const av = a[sortConfig.key] ?? "",
        bv = b[sortConfig.key] ?? "";
      if (av < bv) return sortConfig.direction === "asc" ? -1 : 1;
      if (av > bv) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortConfig]);

  const requestSort = (key) =>
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));

  const productionExportData = useMemo(() => {
    const source = selectedModelName
      ? summaryData.filter((item) => item.Model_Name === selectedModelName)
      : summaryData;
    return source.map((item) => ({
      "Model Name": item.Model_Name,
      "FG Serial No.": item.FG_SR,
      "Asset Tag": item.Asset_tag || "",
      "Customer QR": item.CustomerQR || "",
      "NFC UID": item.NFC_UID || "",
    }));
  }, [summaryData, selectedModelName]);

  const modelNameCount = useMemo(
    () => getModelNameCount(summaryData),
    [summaryData],
  );
  const categoryCounts = useMemo(
    () => getCategoryCounts(summaryData),
    [summaryData],
  );
  const anyLoading = ydayLoading || todayLoading || monthLoading;

  const COLUMNS = [
    { label: "Model Name", key: "Model_Name" },
    { label: "FG Serial No.", key: "FG_SR" },
    { label: "Asset Tag", key: "Asset_tag" },
    { label: "Customer QR", key: "CustomerQR" },
    { label: "NFC UID", key: "NFC_UID" },
  ];

  if (variantsLoading) return <Loader />;

  /* ══════════════════════════════════════════════════════════
     RENDER — lives inside Layout <Outlet />, use h-full
  ══════════════════════════════════════════════════════════ */
  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      {/* ── PAGE HEADER — sticky ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shadow-sm shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-tight">
            Total Production
          </h1>
          <p className="text-[11px] text-slate-400">
            View production details by area across all plant lines
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-blue-50 border border-blue-100 min-w-22.5">
            <span className="text-xl font-bold font-mono text-blue-700">
              {totalCount.toLocaleString()}
            </span>
            <span className="text-[10px] text-blue-500 font-medium uppercase tracking-wide">
              Total Records
            </span>
          </div>
          {summaryData.length > 0 && (
            <>
              <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100 min-w-22.5">
                <span className="text-xl font-bold font-mono text-emerald-700">
                  {Object.keys(modelNameCount).length}
                </span>
                <span className="text-[10px] text-emerald-500 font-medium uppercase tracking-wide">
                  Model Types
                </span>
              </div>
              <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-violet-50 border border-violet-100 min-w-22.5">
                <span className="text-xl font-bold font-mono text-violet-700">
                  {Object.keys(categoryCounts).length}
                </span>
                <span className="text-[10px] text-violet-500 font-medium uppercase tracking-wide">
                  Categories
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="flex-1 overflow-hidden flex flex-col p-4 gap-3">
        {/* ── FILTERS (single card, everything inline) ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 shrink-0">
          <div className="flex items-center gap-1.5 mb-3">
            <Filter className="w-3 h-3 text-slate-400" />
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
              Filters
            </p>
          </div>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="min-w-42.5 flex-1">
              <SelectField
                label="Model Variant"
                options={variants}
                value={selectedModelVariant?.value || ""}
                onChange={(e) =>
                  setSelectedModelVariant(
                    variants.find((o) => o.value === e.target.value) || null,
                  )
                }
              />
            </div>
            <div className="min-w-42.5 flex-1">
              <SelectField
                label="Department"
                options={DEPARTMENT_OPTIONS}
                value={selectedDep?.value || ""}
                onChange={(e) =>
                  setSelectedDep(
                    DEPARTMENT_OPTIONS.find(
                      (o) => o.value === e.target.value,
                    ) || null,
                  )
                }
              />
            </div>
            <div className="min-w-46.25 flex-1">
              <DateTimePicker
                label="Start Time"
                name="startTime"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="min-w-46.25 flex-1">
              <DateTimePicker
                label="End Time"
                name="endTime"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2 pb-0.5 flex-wrap">
              <button
                onClick={handleQuery}
                disabled={loading}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  loading
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
                }`}
              >
                {loading ? <Spinner /> : <Search className="w-4 h-4" />}
                {loading ? "Fetching…" : "Query"}
              </button>

              <button
                onClick={fetchYesterday}
                disabled={ydayLoading}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  ydayLoading
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-amber-500 hover:bg-amber-600 text-white shadow-sm"
                }`}
              >
                {ydayLoading && <Spinner cls="w-4 h-4" />}
                {ydayLoading ? "Loading…" : "Yesterday"}
              </button>

              <button
                onClick={fetchToday}
                disabled={todayLoading}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  todayLoading
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                }`}
              >
                {todayLoading && <Spinner cls="w-4 h-4" />}
                {todayLoading ? "Loading…" : "Today"}
              </button>

              <button
                onClick={fetchMTD}
                disabled={monthLoading}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  monthLoading
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                }`}
              >
                {monthLoading && <Spinner cls="w-4 h-4" />}
                {monthLoading ? "Loading…" : "MTD"}
              </button>
            </div>
          </div>
        </div>

        {/* ── MAIN PANEL ── */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-0">
          {/* Three-panel body */}
          <div className="flex-1 flex min-h-0 overflow-hidden">
            {/* ── Summary / Main Table ── */}
            <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b bg-slate-100 border-slate-200 shrink-0">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Summary
                </span>
                {productionExportData.length > 0 && (
                  <button
                    onClick={() =>
                      exportToExcel(
                        productionExportData,
                        "Production",
                        "Total_Production",
                      )
                    }
                    className="flex items-center gap-1 text-[10px] text-emerald-700 hover:text-emerald-900 font-semibold border border-emerald-200 rounded-md px-1.5 py-0.5 hover:bg-emerald-50 transition cursor-pointer"
                  >
                    <Download className="w-2.5 h-2.5" /> Export
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-auto min-w-0">
                {anyLoading && totalProductionData.length === 0 ? (
                  <div className="flex items-center justify-center h-full gap-2 text-blue-600">
                    <Spinner cls="w-5 h-5" />{" "}
                    <span className="text-sm">Loading…</span>
                  </div>
                ) : (
                  <table className="min-w-175 w-full text-xs text-left border-separate border-spacing-0">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-slate-100">
                        {COLUMNS.map((col) => (
                          <th
                            key={col.key}
                            onClick={() => requestSort(col.key)}
                            className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap cursor-pointer hover:bg-slate-200 transition-colors"
                          >
                            <span className="flex items-center">
                              {col.label}
                              <SortIcon
                                active={sortConfig.key === col.key}
                                dir={sortConfig.direction}
                              />
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedData.length > 0 ? (
                        sortedData.map((item, idx) => {
                          const isLast = idx === sortedData.length - 1;
                          return (
                            <tr
                              key={idx}
                              ref={
                                isLast && !selectedModelName ? lastRowRef : null
                              }
                              className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40"
                            >
                              <td className="px-3 py-2 border-b border-slate-100 font-medium text-slate-800 whitespace-nowrap">
                                {item.Model_Name}
                              </td>
                              <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-700 whitespace-nowrap">
                                {item.FG_SR}
                              </td>
                              <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-600 whitespace-nowrap">
                                {item.Asset_tag || ""}
                              </td>
                              <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-600 whitespace-nowrap break-all">
                                {item.CustomerQR || ""}
                              </td>
                              <td className="px-3 py-2 border-b border-slate-100 font-mono text-blue-600 whitespace-nowrap">
                                {item.NFC_UID || ""}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={6} className="py-16 text-center">
                            <div className="flex flex-col items-center gap-3 text-slate-400">
                              <PackageOpen
                                className="w-12 h-12 opacity-20"
                                strokeWidth={1.2}
                              />
                              <p className="text-sm">
                                No records found. Apply filters and click Query.
                              </p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
                {loading && totalProductionData.length > 0 && (
                  <div className="flex items-center justify-center py-4 gap-2 text-blue-600 text-xs border-t border-slate-100">
                    <Spinner /> Loading more records…
                  </div>
                )}
              </div>
            </div>

            {/* ── By Model panel ── */}
            <div className="w-56 shrink-0 border-l border-slate-200 flex flex-col bg-slate-50/50">
              <div className="flex items-center justify-between px-3 py-2.5 border-b bg-slate-100 border-slate-200 shrink-0">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  By Model
                </span>
                {summaryData.length > 0 && (
                  <button
                    onClick={handleExportModelSummary}
                    className="flex items-center gap-1 text-[10px] text-emerald-700 hover:text-emerald-900 font-semibold border border-emerald-200 rounded-md px-1.5 py-0.5 hover:bg-emerald-50 transition cursor-pointer"
                  >
                    <Download className="w-2.5 h-2.5" /> Export
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-auto">
                {Object.keys(modelNameCount).length === 0 ? (
                  <p className="text-center text-slate-400 text-xs py-10">
                    No summary yet.
                  </p>
                ) : (
                  <table className="w-full text-xs border-separate border-spacing-0">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-slate-100">
                        <th className="px-3 py-2.5 font-semibold text-slate-500 border-b border-slate-200 text-left">
                          Model
                        </th>
                        <th className="px-3 py-2.5 font-semibold text-slate-500 border-b border-slate-200 text-right">
                          Qty
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(modelNameCount).map(
                        ([modelName, count]) => (
                          <tr
                            key={modelName}
                            onClick={() =>
                              setSelectedModelName((p) =>
                                p === modelName ? null : modelName,
                              )
                            }
                            className={`cursor-pointer transition-colors ${
                              selectedModelName === modelName
                                ? "bg-blue-100"
                                : "hover:bg-white even:bg-white/60"
                            }`}
                          >
                            <td
                              className="px-3 py-2 border-b border-slate-100 font-medium text-slate-700 break-all"
                              title={modelName}
                            >
                              {modelName}
                            </td>
                            <td className="px-3 py-2 border-b border-slate-100 text-right">
                              <span
                                className={`inline-block font-bold px-2 py-0.5 rounded-md text-[11px] ${
                                  selectedModelName === modelName
                                    ? "bg-blue-200 text-blue-800"
                                    : "bg-slate-200 text-slate-700"
                                }`}
                              >
                                {count}
                              </span>
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                )}
              </div>
              {Object.keys(modelNameCount).length > 0 && (
                <p className="text-[10px] text-slate-400 text-center px-3 py-2 border-t border-slate-200">
                  Tap a row to filter · tap again to clear
                </p>
              )}
            </div>

            {/* ── By Category panel ── */}
            <div className="w-52 shrink-0 border-l border-slate-200 flex flex-col bg-slate-50/50">
              <div className="flex items-center justify-between px-3 py-2.5 border-b bg-slate-100 border-slate-200 shrink-0">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  By Category
                </span>
                {summaryData.length > 0 && (
                  <button
                    onClick={handleExportCategorySummary}
                    className="flex items-center gap-1 text-[10px] text-emerald-700 hover:text-emerald-900 font-semibold border border-emerald-200 rounded-md px-1.5 py-0.5 hover:bg-emerald-50 transition cursor-pointer"
                  >
                    <Download className="w-2.5 h-2.5" /> Export
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-auto">
                {Object.keys(categoryCounts).length === 0 ? (
                  <p className="text-center text-slate-400 text-xs py-10">
                    No summary yet.
                  </p>
                ) : (
                  <table className="w-full text-xs border-separate border-spacing-0">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-slate-100">
                        <th className="px-3 py-2.5 font-semibold text-slate-500 border-b border-slate-200 text-left">
                          Category
                        </th>
                        <th className="px-3 py-2.5 font-semibold text-slate-500 border-b border-slate-200 text-right">
                          Qty
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(categoryCounts).map(
                        ([category, count]) => (
                          <tr
                            key={category}
                            className="hover:bg-white transition-colors even:bg-white/60"
                          >
                            <td
                              className="px-3 py-2 border-b border-slate-100 font-medium text-slate-700 break-all"
                              title={category}
                            >
                              {category}
                            </td>
                            <td className="px-3 py-2 border-b border-slate-100 text-right">
                              <span className="inline-block font-bold px-2 py-0.5 rounded-md text-[11px] bg-slate-200 text-slate-700">
                                {count}
                              </span>
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TotalProduction;
