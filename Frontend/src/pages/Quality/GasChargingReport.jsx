import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import SelectField from "../../components/ui/SelectField";
import DateTimePicker from "../../components/ui/DateTimePicker";
import Pagination from "../../components/ui/Pagination";
import GasChargingDetailModal from "../../components/GasChargingDetailModal";
import {
  useGetGasChargingReportQuery,
  useGetGasChargingModelsQuery,
  useGetGasChargingMachinesQuery,
  useGetGasChargingRefrigerantsQuery,
  useLazyGetGasChargingExportQuery,
} from "../../redux/api/gasChargingApi";
import {
  setGasChargingFilters,
  resetGasChargingFilters,
  setGasChargingSelectedRecord,
  setGasChargingQuickFilter,
  setGasChargingDateRange,
  setGasChargingPage,
  setGasChargingLimit,
  setGasChargingPagination,
} from "../../redux/slices/gasChargingSlice.js";
import {
  getTodayRange,
  getYesterdayRange,
  getMTDRange,
  formatDateTimeLocal,
} from "../../utils/dateUtils";
import { exportToXls } from "../../utils/exportToXls";
import {
  Search,
  Download,
  RotateCcw,
  Filter,
  CheckCircle,
  XCircle,
  Calendar,
  Barcode,
  Layers,
  Thermometer,
  Weight,
  Droplets,
  Wind,
  Factory,
  Loader2,
  PackageOpen,
} from "lucide-react";

// ── Spinner ────────────────────────────────────────────────────────────────────
const Spinner = ({ cls = "w-4 h-4" }) => (
  <Loader2 className={`animate-spin ${cls}`} />
);

// ── Status Badge ───────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const isPass =
    String(status).toUpperCase() === "PASS" || status === 1 || status === "1";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-bold rounded-full border ${
        isPass
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : "bg-red-50 text-red-700 border-red-200"
      }`}
    >
      {isPass ? (
        <CheckCircle className="w-2.5 h-2.5" />
      ) : (
        <XCircle className="w-2.5 h-2.5" />
      )}
      {isPass ? "PASS" : "FAIL"}
    </span>
  );
};

// ── Default state ──────────────────────────────────────────────────────────────
const defaultFilters = {
  startDate: "",
  endDate: "",
  model: "",
  performance: "",
  refrigerant: "",
  machine: "",
};
const defaultPagination = {
  page: 1,
  limit: 50,
  totalPages: 1,
  totalRecords: 0,
};

// ── Main Component ─────────────────────────────────────────────────────────────
const GasChargingReport = () => {
  const dispatch = useDispatch();

  const gasChargingState = useSelector((state) => state.gasCharging);
  const filters = gasChargingState?.filters || defaultFilters;
  const pagination = gasChargingState?.pagination || defaultPagination;
  const selectedRecord = gasChargingState?.selectedRecord || null;
  const isDetailModalOpen = gasChargingState?.isDetailModalOpen || false;
  const activeQuickFilter = gasChargingState?.activeQuickFilter || null;

  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const {
    data: reportData,
    isLoading: reportLoading,
    isFetching: reportFetching,
  } = useGetGasChargingReportQuery(
    {
      startDate: filters.startDate,
      endDate: filters.endDate,
      model: filters.model,
      performance: filters.performance,
      refrigerant: filters.refrigerant,
      machine: filters.machine,
      page: pagination.page,
      limit: pagination.limit,
    },
    { skip: !filters.startDate || !filters.endDate },
  );

  const { data: modelsData } = useGetGasChargingModelsQuery();
  const { data: machinesData } = useGetGasChargingMachinesQuery();
  const { data: refrigerantsData } = useGetGasChargingRefrigerantsQuery();
  const [triggerExport, { isLoading: exportLoading }] =
    useLazyGetGasChargingExportQuery();

  // Keep Redux pagination totals in sync with the server response
  useEffect(() => {
    if (reportData?.pagination) {
      dispatch(
        setGasChargingPagination({
          totalPages: reportData.pagination.totalPages || 1,
          totalRecords: reportData.pagination.totalRecords || 0,
        }),
      );
    }
  }, [reportData, dispatch]);

  const performanceOptions = [
    { label: "All Results", value: "" },
    { label: "Pass", value: "PASS" },
    { label: "Fail", value: "FAIL" },
  ];
  const modelOptions = [
    { label: "All Models", value: "" },
    // Show the model NAME; the value stays the model number, which is what the
    // backend filters on. Falls back to the old shape if the API hasn't updated yet.
    ...(modelsData?.models?.map((m) => ({ label: m.label, value: m.value })) ||
      modelsData?.data?.map((m) => ({ label: m, value: m })) ||
      []),
  ];
  const machineOptions = [
    { label: "All Machines", value: "" },
    ...(machinesData?.data?.map((m) => ({ label: m, value: m })) || []),
  ];
  const refrigerantOptions = [
    { label: "All Refrigerants", value: "" },
    ...(refrigerantsData?.data?.map((r) => ({
      label: r.toUpperCase(),
      value: r,
    })) || []),
  ];

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleQuery = () => {
    if (!startTime || !endTime) {
      alert("Please select both start and end date/time");
      return;
    }
    dispatch(
      setGasChargingDateRange({
        startDate: new Date(startTime).toISOString(),
        endDate: new Date(endTime).toISOString(),
      }),
    );
    dispatch(setGasChargingQuickFilter(null));
    dispatch(setGasChargingPage(1));
  };

  const handleQuickFilter = (filterType) => {
    const rangeMap = {
      today: getTodayRange(),
      yesterday: getYesterdayRange(),
      mtd: getMTDRange(),
    };
    const dateRange = rangeMap[filterType];
    if (!dateRange) return;
    dispatch(setGasChargingDateRange(dateRange));
    dispatch(setGasChargingQuickFilter(filterType));
    dispatch(setGasChargingPage(1));
    setStartTime(formatDateTimeLocal(dateRange.startDate));
    setEndTime(formatDateTimeLocal(dateRange.endDate));
  };

  // Exports ALL records matching the current filters (no page/limit sent),
  // not just the rows visible on screen.
  const handleExport = async () => {
    try {
      const result = await triggerExport({
        startDate: filters.startDate,
        endDate: filters.endDate,
        model: filters.model,
        performance: filters.performance,
        refrigerant: filters.refrigerant,
        machine: filters.machine,
      }).unwrap();

      const rows = result?.data ?? [];
      if (!rows.length) {
        alert("No data to export for the selected filters");
        return;
      }
      exportToXls(rows, "Gas_Charging_Report.xlsx");
    } catch (err) {
      console.error("Export failed:", err);
      alert(err?.data?.message || "Failed to export data");
    }
  };

  const handleResetFilters = () => {
    dispatch(resetGasChargingFilters());
    dispatch(setGasChargingPage(1));
    setStartTime("");
    setEndTime("");
  };

  // Pagination
  const handlePageChange = (page) => dispatch(setGasChargingPage(page));

  const handleLimitChange = (limit) => {
    dispatch(setGasChargingLimit(limit));
    dispatch(setGasChargingPage(1));
  };

  // Every filter dropdown goes through this so the page resets to 1
  const updateFilter = (patch) => {
    dispatch(setGasChargingFilters(patch));
    dispatch(setGasChargingPage(1));
  };

  // Default to Today's data on first load — filters live in Redux so they
  // survive navigating away and back; this only fires when nothing has been
  // chosen yet, never overriding a range the user already picked.
  useEffect(() => {
    if (!filters.startDate || !filters.endDate) handleQuickFilter("today");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const gasChargingData = reportData?.data || [];
  const totalCount = pagination.totalRecords;
  const isLoading = reportLoading || reportFetching;

  const COLUMNS = [
    { label: "Date/Time", icon: <Calendar className="w-3 h-3" /> },
    { label: "Barcode", icon: <Barcode className="w-3 h-3" /> },
    { label: "Model", icon: <Layers className="w-3 h-3" /> },
    { label: "Refrigerant", icon: <Thermometer className="w-3 h-3" /> },
    { label: "Set Weight", icon: <Weight className="w-3 h-3" /> },
    { label: "Actual Weight", icon: <Weight className="w-3 h-3" /> },
    { label: "Leak Test", icon: <Droplets className="w-3 h-3" /> },
    { label: "Evacuation", icon: <Wind className="w-3 h-3" /> },
    { label: "Machine", icon: <Factory className="w-3 h-3" /> },
    { label: "Result", icon: <CheckCircle className="w-3 h-3" /> },
  ];

  /* ══════════════════════════════════════════════════════════
     RENDER — lives inside Layout <Outlet />, use h-full
  ══════════════════════════════════════════════════════════ */
  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      {/* ── PAGE HEADER — sticky ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shadow-sm shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-tight">
            Gas Charging Report
          </h1>
          <p className="text-[11px] text-slate-400">
            Gas charging monitoring · Quality & performance records
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
          {gasChargingData.length > 0 && (
            <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100 min-w-22.5">
              <span className="text-xl font-bold font-mono text-emerald-700">
                {gasChargingData.length}
              </span>
              <span className="text-[10px] text-emerald-500 font-medium uppercase tracking-wide">
                Showing
              </span>
            </div>
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
            <div className="min-w-37.5 flex-1">
              <SelectField
                label="Model"
                options={modelOptions}
                value={filters.model}
                onChange={(e) => updateFilter({ model: e.target.value })}
              />
            </div>
            <div className="min-w-37.5 flex-1">
              <SelectField
                label="Machine"
                options={machineOptions}
                value={filters.machine}
                onChange={(e) => updateFilter({ machine: e.target.value })}
              />
            </div>
            <div className="min-w-37.5 flex-1">
              <SelectField
                label="Result"
                options={performanceOptions}
                value={filters.performance}
                onChange={(e) => updateFilter({ performance: e.target.value })}
              />
            </div>
            <div className="min-w-37.5 flex-1">
              <SelectField
                label="Refrigerant"
                options={refrigerantOptions}
                value={filters.refrigerant}
                onChange={(e) => updateFilter({ refrigerant: e.target.value })}
              />
            </div>
            <div className="min-w-43.75 flex-1">
              <DateTimePicker
                label="Start Date/Time"
                name="startTime"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="min-w-43.75 flex-1">
              <DateTimePicker
                label="End Date/Time"
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
                {isLoading ? <Spinner /> : <Search className="w-4 h-4" />}
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

              {gasChargingData.length > 0 && (
                <button
                  onClick={handleExport}
                  disabled={exportLoading}
                  title="Export all records for the selected filters"
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                    exportLoading
                      ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                  }`}
                >
                  {exportLoading ? (
                    <Spinner />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  {exportLoading ? "Exporting…" : "Export"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── MAIN DATA PANEL ── */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-0">
          {/* Loading (only when there is nothing to show yet) */}
          {isLoading && gasChargingData.length === 0 && (
            <div className="flex items-center justify-center flex-1 gap-3">
              <Spinner cls="w-6 h-6 text-blue-600" />
              <span className="text-sm text-slate-400">
                Loading gas charging records…
              </span>
            </div>
          )}

          {/* Empty — no filters applied */}
          {!isLoading && !filters.startDate && !filters.endDate && (
            <div className="flex flex-col items-center justify-center flex-1 gap-3 text-slate-400">
              <Search className="w-12 h-12 opacity-20" strokeWidth={1.2} />
              <p className="text-base font-bold text-slate-500">
                Select a Date Range
              </p>
              <p className="text-sm text-slate-400 text-center max-w-xs">
                Choose a date range or use a quick filter to load gas charging
                records.
              </p>
              <button
                onClick={() => handleQuickFilter("today")}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-all mt-1"
              >
                <Calendar className="w-4 h-4" /> View Today's Data
              </button>
            </div>
          )}

          {/* Empty — filters applied, no results */}
          {!isLoading && gasChargingData.length === 0 && filters.startDate && (
            <div className="flex flex-col items-center justify-center flex-1 gap-3 text-slate-400">
              <PackageOpen className="w-12 h-12 opacity-20" strokeWidth={1.2} />
              <p className="text-sm">
                No records found for the selected filters.
              </p>
              <button
                onClick={handleResetFilters}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset Filters
              </button>
            </div>
          )}

          {/* Table — stays visible while the next page loads */}
          {gasChargingData.length > 0 && (
            <>
              {/* Table toolbar */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 shrink-0">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  Charging Records
                  {reportFetching && <Spinner cls="w-3 h-3 text-blue-600" />}
                </span>
                <span className="text-[11px] text-slate-400">
                  Page{" "}
                  <span className="font-bold text-blue-600">
                    {pagination.page}
                  </span>{" "}
                  of{" "}
                  <span className="font-bold text-blue-600">
                    {pagination.totalPages}
                  </span>{" "}
                  · Showing{" "}
                  <span className="font-bold text-blue-600">
                    {gasChargingData.length}
                  </span>{" "}
                  of{" "}
                  <span className="font-bold text-blue-600">
                    {pagination.totalRecords.toLocaleString()}
                  </span>
                </span>
              </div>

              {/* Scrollable table */}
              <div
                className={`flex-1 overflow-auto transition-opacity ${
                  reportFetching ? "opacity-50 pointer-events-none" : ""
                }`}
              >
                <table className="min-w-full text-xs text-left border-separate border-spacing-0">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-100">
                      {COLUMNS.map((col) => (
                        <th
                          key={col.label}
                          className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap"
                        >
                          <span className="flex items-center gap-1">
                            {col.icon}
                            {col.label}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {gasChargingData.map((item, index) => (
                      <tr
                        key={item.Result_ID || index}
                        onClick={() =>
                          dispatch(setGasChargingSelectedRecord(item))
                        }
                        className="cursor-pointer hover:bg-blue-50/60 transition-colors even:bg-slate-50/40"
                      >
                        <td className="px-3 py-2 border-b border-slate-100 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-800">
                              {item.DATE}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {item.TIME}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2 border-b border-slate-100 font-mono text-blue-600 font-semibold whitespace-nowrap">
                          {item.BARCODE}
                        </td>
                        <td className="px-3 py-2 border-b border-slate-100 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-800">
                              {item.MODELNAME}
                            </span>
                            <span className="text-[10px] text-slate-400 truncate max-w-37.5">
                              Model Code - {item.MODEL}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2 border-b border-slate-100 whitespace-nowrap">
                          <span className="bg-cyan-50 text-cyan-700 border border-cyan-200 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase">
                            {item.REFRIGERANT}
                          </span>
                        </td>
                        <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-600 whitespace-nowrap">
                          {item.SET_GAS_WEIGHT}
                        </td>
                        <td className="px-3 py-2 border-b border-slate-100 font-mono font-semibold text-emerald-600 whitespace-nowrap">
                          {item.ACTUAL_GAS_WEIGHT}
                        </td>
                        <td className="px-3 py-2 border-b border-slate-100 whitespace-nowrap">
                          <div className="flex flex-col text-[11px]">
                            <span>
                              <span className="text-slate-400">Set:</span>{" "}
                              <span className="text-slate-600">
                                {item.LEAK_SET_VALUE}
                              </span>
                            </span>
                            <span>
                              <span className="text-slate-400">Act:</span>{" "}
                              <span className="text-emerald-600 font-semibold">
                                {item.LEAK_TEST_VALUE}
                              </span>
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2 border-b border-slate-100 whitespace-nowrap">
                          <div className="flex flex-col text-[11px]">
                            <span>
                              <span className="text-slate-400">Set:</span>{" "}
                              <span className="text-slate-600">
                                {item.SET_EVACUATION_VALUE}
                              </span>
                            </span>
                            <span>
                              <span className="text-slate-400">Act:</span>{" "}
                              <span className="text-violet-600 font-semibold">
                                {item.ACTUAL_EVACUATION_VALUE}
                              </span>
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2 border-b border-slate-100 whitespace-nowrap">
                          <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-semibold">
                            {item.MACHINE}
                          </span>
                        </td>
                        <td className="px-3 py-2 border-b border-slate-100 whitespace-nowrap">
                          <StatusBadge status={item.PERFORMANCE} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="shrink-0 border-t border-slate-100 p-2">
                <Pagination
                  compact
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  totalRecords={pagination.totalRecords}
                  limit={pagination.limit}
                  onPageChange={handlePageChange}
                  onLimitChange={handleLimitChange}
                  isLoading={reportFetching}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {isDetailModalOpen && selectedRecord && <GasChargingDetailModal />}
    </div>
  );
};

export default GasChargingReport;
