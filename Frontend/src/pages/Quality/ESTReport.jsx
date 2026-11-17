import { useState, useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import Loader from "../../components/ui/Loader";
import SelectField from "../../components/ui/SelectField";
import DateTimePicker from "../../components/ui/DateTimePicker";
import {
  useGetEstReportQuery,
  useGetEstReportSummaryQuery,
  useGetDistinctModelsQuery,
  useGetDistinctOperatorsQuery,
  useLazyGetExportDataQuery,
} from "../../redux/api/estReportApi";
import {
  setFilters,
  resetFilters,
  setSelectedRecord,
  setActiveQuickFilter,
  setDateRange,
  setPage,
  setLimit,
  setPagination,
} from "../../redux/slices/estReportSlice.js";
import {
  getTodayRange,
  getYesterdayRange,
  getMTDRange,
  formatDateTimeLocal,
} from "../../utils/dateUtils";
import { exportToXls } from "../../utils/exportToXls.js";
import {
  Search,
  RefreshCw,
  Clock,
  Calendar,
  Filter,
  ChevronRight,
  Download,
  RotateCcw,
  Zap,
  ShieldCheck,
  Droplets,
  BatteryFull,
  CheckCircle2,
  XCircle,
  Plug,
  Table2,
  User,
  Barcode,
  Boxes,
  FileText,
  CircuitBoard,
  LayoutDashboard,
  AlertCircle,
  PackageOpen,
  Loader2,
  CalendarRange,
  Activity,
} from "lucide-react";
import toast from "react-hot-toast";
import ESTDetailModal from "../../components/ESTDetailModal";

// ─── Spinner ───────────────────────────────────────────────────────────────────
const Spinner = ({ cls = "w-4 h-4" }) => (
  <Loader2 className={`animate-spin ${cls}`} />
);

// ─── Status Badge ──────────────────────────────────────────────────────────────
const StatusBadge = ({ status, size = "md" }) => {
  const isPass = status === "Pass" || status === 1;
  const base = "inline-flex items-center gap-1 rounded font-semibold";
  const sizes = {
    sm: "px-2 py-0.5 text-[11px]",
    md: "px-2.5 py-1 text-xs",
    lg: "px-4 py-1.5 text-sm",
  };
  const iconCls = size === "lg" ? "w-3.5 h-3.5" : "w-2.5 h-2.5";
  return (
    <span
      className={`${base} ${sizes[size]} ${
        isPass
          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
          : "bg-rose-50 text-rose-700 border border-rose-200"
      }`}
    >
      {isPass ? (
        <CheckCircle2 className={iconCls} />
      ) : (
        <XCircle className={iconCls} />
      )}
      {isPass ? "PASS" : "FAIL"}
    </span>
  );
};

// ─── Empty State ───────────────────────────────────────────────────────────────
const EmptyState = ({ colSpan }) => (
  <tr>
    <td colSpan={colSpan} className="py-10 text-center">
      <div className="flex flex-col items-center gap-2 text-slate-400">
        <PackageOpen className="w-8 h-8 opacity-20" strokeWidth={1.2} />
        <p className="text-xs">
          No data available. Run a query to see results.
        </p>
      </div>
    </td>
  </tr>
);

// ─── Table Column Config ───────────────────────────────────────────────────────
const TABLE_COLUMNS = [
  { icon: Boxes, label: "Model" },
  { icon: Barcode, label: "Serial" },
  { icon: Calendar, label: "Date / Time" },
  { icon: User, label: "Operator" },
  { icon: Plug, label: "ECT" },
  { icon: Zap, label: "HV" },
  { icon: ShieldCheck, label: "IR" },
  { icon: Droplets, label: "LCT" },
  { icon: BatteryFull, label: "Wattage" },
  { icon: CircuitBoard, label: "Result" },
];

// ─── Main Component ────────────────────────────────────────────────────────────
const ESTReport = () => {
  const dispatch = useDispatch();
  const {
    filters,
    selectedRecord,
    isDetailModalOpen,
    activeQuickFilter,
    pagination,
  } = useSelector((state) => state.estReport);

  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  // ── API Hooks ──────────────────────────────────────────────────────────────
  const {
    data: reportData,
    isLoading: reportLoading,
    isFetching: reportFetching,
    refetch: refetchReport,
  } = useGetEstReportQuery(
    {
      startDate: filters.startDate,
      endDate: filters.endDate,
      model: filters.model,
      operator: filters.operator,
      result: filters.result,
      testType: filters.testType,
      page: pagination.page,
      limit: pagination.limit,
    },
    { skip: !filters.startDate || !filters.endDate },
  );

  const { data: summaryData } = useGetEstReportSummaryQuery(
    {
      startDate: filters.startDate,
      endDate: filters.endDate,
      model: filters.model,
    },
    { skip: !filters.startDate || !filters.endDate },
  );

  const { data: modelsData } = useGetDistinctModelsQuery();
  const { data: operatorsData } = useGetDistinctOperatorsQuery();
  const [triggerExport, { isLoading: exportLoading }] =
    useLazyGetExportDataQuery();

  // ── Sync Pagination ────────────────────────────────────────────────────────
  useEffect(() => {
    if (reportData?.pagination) {
      dispatch(
        setPagination({
          totalPages: reportData.pagination.totalPages || 1,
          totalRecords: reportData.pagination.totalRecords || 0,
        }),
      );
    }
  }, [reportData, dispatch]);

  // ── Options ────────────────────────────────────────────────────────────────
  const testTypeOptions = [
    { label: "All Tests", value: "all" },
    { label: "ECT", value: "ect" },
    { label: "HV", value: "hv" },
    { label: "IR", value: "ir" },
    { label: "LCT", value: "lct" },
  ];

  const resultOptions = [
    { label: "All Results", value: "" },
    { label: "Pass", value: "Pass" },
    { label: "Fail", value: "Fail" },
  ];

  const modelOptions = [
    { label: "All Models", value: "" },
    ...(modelsData?.data || []),
  ];

  const operatorOptions = [
    { label: "All Operators", value: "" },
    ...(operatorsData?.data || []),
  ];

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleQuery = () => {
    if (!startTime || !endTime) {
      toast.error("Please select both start and end date/time.");
      return;
    }
    dispatch(setPage(1));
    dispatch(
      setDateRange({
        startDate: new Date(startTime).toISOString(),
        endDate: new Date(endTime).toISOString(),
      }),
    );
    dispatch(setActiveQuickFilter(null));
  };

  const handleQuickFilter = (filterType) => {
    const rangeMap = {
      today: getTodayRange,
      yesterday: getYesterdayRange,
      mtd: getMTDRange,
    };
    const dateRange = rangeMap[filterType]?.();
    if (!dateRange) return;

    dispatch(setPage(1));
    dispatch(setDateRange(dateRange));
    dispatch(setActiveQuickFilter(filterType));
    setStartTime(formatDateTimeLocal(dateRange.startDate));
    setEndTime(formatDateTimeLocal(dateRange.endDate));
  };

  const handleExport = async () => {
    try {
      const result = await triggerExport({
        startDate: filters.startDate,
        endDate: filters.endDate,
        model: filters.model,
        operator: filters.operator,
        result: filters.result,
      }).unwrap();
      if (result?.data) exportToXls(result.data, "EST_Report.xlsx");
    } catch {
      toast.error("Export failed. Please try again.");
    }
  };

  const handleResetFilters = () => {
    dispatch(resetFilters());
    setStartTime("");
    setEndTime("");
  };

  // Default to Today's data on first load — filters live in Redux so they
  // survive navigating away and back; this only fires when nothing has been
  // chosen yet, never overriding a range the user already picked.
  useEffect(() => {
    if (!filters.startDate || !filters.endDate) handleQuickFilter("today");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePageChange = (p) => dispatch(setPage(p));
  const handleLimitChange = (l) => dispatch(setLimit(l));

  // ── Derived State ──────────────────────────────────────────────────────────
  const estData = reportData?.data || [];
  const summary = summaryData?.data;
  const isLoading = reportLoading || reportFetching;
  const hasData = estData.length > 0;
  const hasFilters = filters.startDate && filters.endDate;

  const passRate = summary ? parseFloat(summary.total.passRate) : null;
  const totalRecords = useMemo(
    () => pagination.totalRecords || 0,
    [pagination.totalRecords],
  );

  /* ══════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════ */
  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      {/* ── PAGE HEADER — sticky ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shadow-sm shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-tight">
            EST Report Dashboard
          </h1>
          <p className="text-[11px] text-slate-400">
            Electrical Safety Testing — Quality Analytics
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Live indicator */}
          <span className="flex items-center gap-1.5 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
            Live Data
          </span>

          {/* Total Records badge */}
          <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-blue-50 border border-blue-100 min-w-[90px]">
            <span className="text-xl font-bold font-mono text-blue-700">
              {totalRecords.toLocaleString()}
            </span>
            <span className="text-[10px] text-blue-500 font-medium uppercase tracking-wide">
              Total Records
            </span>
          </div>

          {/* Pass Rate badge */}
          {passRate !== null && (
            <div
              className={`flex flex-col items-center px-4 py-1.5 rounded-lg border min-w-[90px] ${
                passRate >= 95
                  ? "bg-emerald-50 border-emerald-100"
                  : passRate >= 80
                    ? "bg-amber-50 border-amber-100"
                    : "bg-rose-50 border-rose-100"
              }`}
            >
              <span
                className={`text-xl font-bold font-mono ${
                  passRate >= 95
                    ? "text-emerald-700"
                    : passRate >= 80
                      ? "text-amber-700"
                      : "text-rose-700"
                }`}
              >
                {passRate.toFixed(1)}%
              </span>
              <span
                className={`text-[10px] font-medium uppercase tracking-wide ${
                  passRate >= 95
                    ? "text-emerald-500"
                    : passRate >= 80
                      ? "text-amber-500"
                      : "text-rose-500"
                }`}
              >
                Pass Rate
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-3">
        {/* ── FILTERS CARD (single card, everything inline) ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 shrink-0">
          <div className="flex items-center gap-1.5 mb-3">
            <Filter className="w-3 h-3 text-slate-400" />
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
              Filters
            </p>
          </div>

          <div className="flex flex-wrap gap-3 items-end">
            <div className="min-w-[140px] flex-1">
              <SelectField
                label="Test Type"
                options={testTypeOptions}
                value={filters.testType}
                onChange={(e) =>
                  dispatch(setFilters({ testType: e.target.value }))
                }
              />
            </div>
            <div className="min-w-[170px] flex-1">
              <SelectField
                label="Model"
                options={modelOptions}
                value={filters.model}
                onChange={(e) =>
                  dispatch(setFilters({ model: e.target.value }))
                }
              />
            </div>
            <div className="min-w-[140px] flex-1">
              <SelectField
                label="Operator"
                options={operatorOptions}
                value={filters.operator}
                onChange={(e) =>
                  dispatch(setFilters({ operator: e.target.value }))
                }
              />
            </div>
            <div className="min-w-[120px] flex-1">
              <SelectField
                label="Result"
                options={resultOptions}
                value={filters.result}
                onChange={(e) =>
                  dispatch(setFilters({ result: e.target.value }))
                }
              />
            </div>
            <div className="min-w-[170px] flex-1">
              <DateTimePicker
                label="Start Time"
                name="startTime"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="min-w-[170px] flex-1">
              <DateTimePicker
                label="End Time"
                name="endTime"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>

            {/* All action buttons — Query, quick filters, Refresh, Reset, Export — inline */}
            <div className="flex items-center gap-2 pb-0.5 flex-wrap">
              <button
                onClick={handleQuery}
                disabled={isLoading}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  isLoading
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
                }`}
              >
                {isLoading ? (
                  <Spinner cls="w-4 h-4" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                {isLoading ? "Loading…" : "Query"}
              </button>

              <button
                onClick={() => handleQuickFilter("yesterday")}
                disabled={isLoading}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  isLoading
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : activeQuickFilter === "yesterday"
                      ? "bg-amber-500 text-white shadow-sm ring-2 ring-offset-1 ring-amber-300"
                      : "bg-amber-500 hover:bg-amber-600 text-white shadow-sm"
                }`}
              >
                Yesterday
              </button>

              <button
                onClick={() => handleQuickFilter("today")}
                disabled={isLoading}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  isLoading
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : activeQuickFilter === "today"
                      ? "bg-emerald-600 text-white shadow-sm ring-2 ring-offset-1 ring-emerald-300"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                }`}
              >
                Today
              </button>

              <button
                onClick={() => handleQuickFilter("mtd")}
                disabled={isLoading}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  isLoading
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : activeQuickFilter === "mtd"
                      ? "bg-indigo-600 text-white shadow-sm ring-2 ring-offset-1 ring-indigo-300"
                      : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                }`}
              >
                MTD
              </button>

              <button
                onClick={() => refetchReport()}
                disabled={isLoading}
                title="Refresh"
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all border ${
                  isLoading
                    ? "bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed"
                    : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600"
                }`}
              >
                <RefreshCw
                  className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
                />
              </button>

              <button
                onClick={handleResetFilters}
                title="Reset Filters"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border bg-white text-slate-600 border-slate-200 hover:border-amber-300 hover:text-amber-600 transition-all"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              {hasData && (
                <button
                  onClick={handleExport}
                  disabled={exportLoading}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                    exportLoading
                      ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                  }`}
                >
                  {exportLoading ? (
                    <Spinner cls="w-4 h-4" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  {exportLoading ? "Exporting…" : "Export"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── LOADING STATE ── */}
        {isLoading && (
          <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-center gap-3">
            <Spinner cls="w-5 h-5 text-blue-600" />
            <p className="text-sm text-slate-400">Fetching EST records…</p>
          </div>
        )}

        {/* ── DATA TABLE ── */}
        {!isLoading && hasData && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            {/* Table header bar */}
            <div className="border-b border-slate-100 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <Table2 className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                  Test Records
                </span>
                <span className="ml-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-[11px] font-semibold rounded-full border border-blue-100">
                  {pagination.totalRecords.toLocaleString()} total
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                Page{" "}
                <span className="font-semibold text-slate-600">
                  {pagination.page}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-slate-600">
                  {pagination.totalPages}
                </span>
                {" · "}Showing{" "}
                <span className="font-semibold text-slate-600">
                  {estData.length}
                </span>{" "}
                records
              </div>
            </div>



            {/* Table */}
            <div className="overflow-auto">
              <table className="min-w-full text-xs text-left border-separate border-spacing-0">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-100">
                    {TABLE_COLUMNS.map(({ icon: Icon, label }) => (
                      <th
                        key={label}
                        className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap"
                      >
                        <span className="flex items-center gap-1.5">
                          <Icon className="w-3 h-3 opacity-50" />
                          {label}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {estData.length > 0 ? (
                    estData.map((item, index) => (
                      <tr
                        key={item.RefNo || index}
                        onClick={() => dispatch(setSelectedRecord(item))}
                        className="hover:bg-blue-50/60 cursor-pointer transition-colors even:bg-slate-50/40 group"
                      >
                        <td className="px-3 py-2 border-b border-slate-100 font-semibold text-blue-600">
                          {item.model_no}
                        </td>
                        <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-500">
                          {item.serial_no}
                        </td>
                        <td className="px-3 py-2 border-b border-slate-100 text-slate-600 whitespace-nowrap">
                          {item.date_time?.replace("T", " ").slice(0, 19)}
                        </td>
                        <td className="px-3 py-2 border-b border-slate-100">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-50 text-violet-700 border border-violet-100 rounded text-[11px] font-medium">
                            <User className="w-2.5 h-2.5" />
                            {item.operator}
                          </span>
                        </td>
                        <td className="px-3 py-2 border-b border-slate-100">
                          <StatusBadge status={item.ect_result} size="sm" />
                        </td>
                        <td className="px-3 py-2 border-b border-slate-100">
                          <StatusBadge status={item.hv_result} size="sm" />
                        </td>
                        <td className="px-3 py-2 border-b border-slate-100">
                          <StatusBadge status={item.ir_result} size="sm" />
                        </td>
                        <td className="px-3 py-2 border-b border-slate-100">
                          <StatusBadge status={item.lct_ln_result} size="sm" />
                        </td>
                        <td className="px-3 py-2 border-b border-slate-100">
                          <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                            {item.set_wattage_lower}–{item.set_wattage_upper}
                          </span>
                        </td>
                        <td className="px-3 py-2 border-b border-slate-100">
                          <StatusBadge status={item.result} size="sm" />
                        </td>
                      </tr>
                    ))
                  ) : (
                    <EmptyState colSpan={11} />
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Empty: filters applied but no data ── */}
        {!isLoading && hasFilters && !hasData && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center py-16 gap-3">
            <AlertCircle
              className="w-10 h-10 text-slate-300"
              strokeWidth={1.2}
            />
            <h3 className="text-sm font-semibold text-slate-600">
              No Records Found
            </h3>
            <p className="text-xs text-slate-400 max-w-sm text-center">
              No EST records matched the selected filters. Try adjusting the
              date range or filters.
            </p>
          </div>
        )}

        {/* ── Empty: no filters set ── */}
        {!hasFilters && !isLoading && (
          <div className="bg-white rounded-xl border border-dashed border-slate-300 shadow-sm flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center">
              <Search className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-sm font-semibold text-slate-600">
              Select a Date Range
            </h3>
            <p className="text-xs text-slate-400 max-w-sm text-center">
              Use the filters above or click a Quick Select option to load EST
              report data.
            </p>
            <div className="flex items-center gap-2 mt-1">
              {[
                { key: "yesterday", label: "Yesterday" },
                { key: "today", label: "Today" },
                { key: "mtd", label: "MTD" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => handleQuickFilter(key)}
                  className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-sm shadow-blue-200"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Detail Modal ── */}
      {isDetailModalOpen && selectedRecord && <ESTDetailModal />}
    </div>
  );
};

export default ESTReport;
