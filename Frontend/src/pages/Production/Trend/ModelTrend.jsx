import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SelectField from "../../../components/ui/SelectField.jsx";
import axios from "axios";
import DateTimePicker from "../../../components/ui/DateTimePicker.jsx";
import Loader from "../../../components/ui/Loader.jsx";
import ExportButton from "../../../components/ui/ExportButton.jsx";
import toast from "react-hot-toast";
import { baseURL } from "../../../assets/assets.js";
import {
  useGetModelVariantsQuery,
  useGetStagesQuery,
} from "../../../redux/api/commonApi.js";
import { Search, X, Loader2, PackageOpen } from "lucide-react";

/* ─── Keep in sync with DAY_START_HOUR in the backend controller ───────────
   0 = production date is the calendar date of "Created On" (as in the sheet).
   Set to 8 if your production day runs 08:00 → 08:00.                       */
const DAY_START_HOUR = 0;

// ─── Line → Stage → codes mapping (unchanged) ────────────────────────────────
const LINE_STAGE_MAPPING = {
  "Freezer Line": {
    "FG Label": { linecodes: [12501], stationCodes: [1220010] },
    MFT: { linecodes: [12501], stationCodes: [1220014] },
    EST: { linecodes: [12501], stationCodes: [1220008] },
    "Gas Charging": { linecodes: [12501], stationCodes: [1220011] },
    "Comp Scan": { linecodes: [12501], stationCodes: [1220005] },
    "Post Foaming": {
      linecodes: [12301, 12302],
      stationCodes: [1220003, 1220004],
    },
    Foaming: { linecodes: [12301, 12302], stationCodes: [1220001, 1220002] },
  },
  "Chocolate Line": {
    "FG Label": { linecodes: [12305], stationCodes: [1220010] },
    MFT: { linecodes: [12305], stationCodes: [1220014] },
    EST: { linecodes: [12305], stationCodes: [1220008] },
    "Gas Charging": { linecodes: [12305], stationCodes: [1220011] },
    "Comp Scan": { linecodes: [12305], stationCodes: [1220005] },
    "Post Foaming": { linecodes: [12305], stationCodes: [1230007] },
  },
  "VISI Cooler Line": {
    "FG Label": { linecodes: [12605], stationCodes: [1220010] },
    MFT: { linecodes: [12605], stationCodes: [1220014] },
    EST: { linecodes: [12605], stationCodes: [1220008] },
    "Gas Charging": { linecodes: [12605], stationCodes: [1220011] },
    "Comp Scan": { linecodes: [12605], stationCodes: [1220005] },
    "Post Comp Scan": { linecodes: [12605], stationCodes: [1240003] },
    "Post Foaming": { linecodes: [12605], stationCodes: [1230012] },
  },
  "SUS Line": {
    "FG Label": { linecodes: [12304], stationCodes: [1230017] },
    MFT: { linecodes: [12304], stationCodes: [1230028] },
    EST: { linecodes: [12304], stationCodes: [1230015] },
    "Gas Charging": { linecodes: [12304], stationCodes: [1260010] },
    "Comp Scan 1": { linecodes: [12304], stationCodes: [1230013] },
    "Comp Scan 2": { linecodes: [12304], stationCodes: [1230014] },
    "Post Foaming": { linecodes: [12304], stationCodes: [1230012] },
  },
};

const SIMPLE_LINE_OPTIONS = Object.keys(LINE_STAGE_MAPPING).map((l) => ({
  value: l,
  label: l,
}));

const EMPTY_REPORT = {
  overview: [],
  modelReport: [],
  summary: { TotalQty: 0, ModelsProduced: 0, StationsUsed: 0, RecordCount: 0 },
};

/* ── Helpers ── */
const Spinner = ({ cls = "w-4 h-4" }) => (
  <Loader2 className={`animate-spin ${cls}`} />
);

const nf = new Intl.NumberFormat("en-IN");
const num = (v) => nf.format(Number(v) || 0);

const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
const fmt = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** "2026-10-23" → "23 Oct 2026"  |  "2026-10" → "2026-10" */
const fmtDay = (p) => {
  const [y, m, d] = String(p).split("-").map(Number);
  if (!y || !m || !d) return p;
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

/** "2026-10" → "October" */
const monthName = (p) => {
  const [y, m] = String(p).split("-").map(Number);
  if (!y || !m) return "";
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "long" });
};

const KPI_STYLES = {
  blue: {
    box: "bg-blue-50 border-blue-100",
    value: "text-blue-700",
    label: "text-blue-500",
  },
  emerald: {
    box: "bg-emerald-50 border-emerald-100",
    value: "text-emerald-700",
    label: "text-emerald-500",
  },
  indigo: {
    box: "bg-indigo-50 border-indigo-100",
    value: "text-indigo-700",
    label: "text-indigo-500",
  },
  slate: {
    box: "bg-slate-50 border-slate-200",
    value: "text-slate-700",
    label: "text-slate-500",
  },
};

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "models", label: "Model Report" },
  { id: "detail", label: "FG Data" },
];

/* ════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════ */
const ModelTrend = () => {
  /* ── Loading ── */
  const [loading, setLoading] = useState(false); // FG Data (paginated)
  const [reportLoading, setReportLoading] = useState(false); // overview + model report
  const [quickLoading, setQuickLoading] = useState(""); // "yday" | "today" | "mtd" | ""

  /* ── Filters (unchanged) ── */
  const [simpleLine, setSimpleLine] = useState("");
  const [simpleStage, setSimpleStage] = useState("");
  const [selectedModelVariant, setSelectedModelVariant] = useState(null);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [reportType, setReportType] = useState("daywise");
  const [selectedShift, setSelectedShift] = useState("both");

  /* ── Report data (Daily/Monthly Overview + Model Report) ── */
  const [report, setReport] = useState(EMPTY_REPORT);
  const [resultType, setResultType] = useState("daywise"); // type the shown result was run with
  const [hasQueried, setHasQueried] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [modelSearch, setModelSearch] = useState("");

  /* ── FG Data (paginated detail) ── */
  const [productionData, setProductionData] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(1000);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const lastRange = useRef({ startTime: "", endTime: "" });

  /* ── RTK Query ── */
  const {
    data: variants = [],
    isLoading: variantsLoading,
    error: variantsError,
  } = useGetModelVariantsQuery();
  const {
    data: stages = [],
    isLoading: stagesLoading,
    error: stagesError,
  } = useGetStagesQuery();

  useEffect(() => {
    if (variantsError) toast.error("Failed to load model variants");
    if (stagesError) toast.error("Failed to load stages");
  }, [variantsError, stagesError]);

  /* ── Stage options from selected line ── */
  const simpleStageOptions = useMemo(() => {
    if (!simpleLine || !LINE_STAGE_MAPPING[simpleLine]) return [];
    return Object.keys(LINE_STAGE_MAPPING[simpleLine]).map((s) => ({
      value: s,
      label: s,
    }));
  }, [simpleLine]);

  useEffect(() => {
    setSimpleStage("");
  }, [simpleLine]);

  const resolveParams = () => {
    const mapping = LINE_STAGE_MAPPING[simpleLine]?.[simpleStage];
    if (!mapping || !mapping.stationCodes.length) return null;
    return {
      stationCode: mapping.stationCodes.join(","),
      linecode: mapping.linecodes.join(","),
    };
  };

  const baseParams = (resolved, range) => ({
    shift: selectedShift,
    startTime: range.startTime,
    endTime: range.endTime,
    stationCode: resolved.stationCode,
    ...(resolved.linecode ? { linecode: resolved.linecode } : {}),
    model: selectedModelVariant ? Number(selectedModelVariant.value) : 0,
  });

  /* ── Infinite scroll (FG Data tab only) ── */
  const observer = useRef();
  const lastRowRef = useCallback(
    (node) => {
      if (loading) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) setPage((p) => p + 1);
      });
      if (node) observer.current.observe(node);
    },
    [loading, hasMore],
  );

  /* ── Fetch: overview + model report (aggregated on the server) ── */
  const fetchReport = async (resolved, range) => {
    setReportLoading(true);
    try {
      const res = await axios.get(`${baseURL}prod/model-trend`, {
        params: { ...baseParams(resolved, range), reportType },
      });
      if (res?.data?.success) {
        setReport({ ...EMPTY_REPORT, ...res.data.data });
        setResultType(reportType);
      }
    } catch {
      toast.error("Failed to fetch model trend report.");
    } finally {
      setReportLoading(false);
    }
  };

  /* ── Fetch: FG Data (paginated) ── */
  const fetchProductionData = async (pageNum = 1, resolvedArg) => {
    const resolved = resolvedArg || resolveParams();
    if (!resolved) return;
    try {
      setLoading(true);
      const res = await axios.get(`${baseURL}prod/fgdata`, {
        params: {
          ...baseParams(resolved, lastRange.current),
          page: pageNum,
          limit,
        },
      });
      if (res?.data?.success) {
        setProductionData((prev) =>
          pageNum === 1 ? res.data.data : [...prev, ...res.data.data],
        );
        if (pageNum === 1) setTotalCount(res.data.totalCount);
        setHasMore(res.data.data.length >= limit);
      }
    } catch {
      toast.error("Failed to fetch production data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (page > 1) fetchProductionData(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  /* ── Run everything for a given range ── */
  const runQuery = async (start, end) => {
    const resolved = resolveParams();
    if (!start || !end || !resolved) {
      toast.error("Please select a Line, Stage, and Time Range.");
      return false;
    }
    lastRange.current = { startTime: start, endTime: end };
    setHasQueried(true);
    setSelectedPeriod(null);
    setModelSearch("");
    setProductionData([]);
    setTotalCount(0);
    setHasMore(false);
    setPage(1);
    await Promise.all([
      fetchReport(resolved, lastRange.current),
      fetchProductionData(1, resolved),
    ]);
    return true;
  };

  const handleQuery = () => runQuery(startTime, endTime);

  /* ── Quick filters: set the pickers, then run ── */
  const runQuick = async (key, start, end) => {
    setQuickLoading(key);
    setStartTime(fmt(start));
    setEndTime(fmt(end));
    await runQuery(fmt(start), fmt(end));
    setQuickLoading("");
  };

  const dayStart = (d) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate(), DAY_START_HOUR, 0, 0);

  const handleYesterday = () => {
    const today = dayStart(new Date());
    const yest = new Date(today);
    yest.setDate(today.getDate() - 1);
    runQuick("yday", yest, today);
  };
  const handleToday = () => {
    const now = new Date();
    runQuick("today", dayStart(now), now);
  };
  const handleMTD = () => {
    const now = new Date();
    runQuick(
      "mtd",
      new Date(now.getFullYear(), now.getMonth(), 1, DAY_START_HOUR, 0, 0),
      now,
    );
  };

  /* ── Derived view data ── */
  const isMonthly = resultType === "monthwise";
  const { overview, modelReport, summary } = report;
  const maxOverviewQty = Math.max(
    1,
    ...overview.map((r) => Number(r.TotalQty)),
  );

  const visibleModelRows = useMemo(() => {
    const q = modelSearch.trim().toLowerCase();
    return modelReport.filter(
      (r) =>
        (!selectedPeriod || r.Period === selectedPeriod) &&
        (!q ||
          String(r.Model_Name).toLowerCase().includes(q) ||
          String(r.ModelNo).includes(q)),
    );
  }, [modelReport, selectedPeriod, modelSearch]);

  const visibleQty = visibleModelRows.reduce((s, r) => s + Number(r.FGQty), 0);
  const visibleRecords = visibleModelRows.reduce(
    (s, r) => s + Number(r.RecordCount),
    0,
  );
  const maxModelQty = Math.max(
    1,
    ...visibleModelRows.map((r) => Number(r.FGQty)),
  );

  const openPeriod = (period) => {
    setSelectedPeriod(period);
    setActiveTab("models");
  };

  /* ── Export fetchers (headers match the sheet) ── */
  const periodHeader = isMonthly ? "Production Month" : "Production Date";

  const exportOverview = () =>
    overview.map((r) => ({
      [periodHeader]: r.Period,
      ...(isMonthly ? { Month: monthName(r.Period) } : {}),
      "Total FG Qty": r.TotalQty,
      "Models Produced": r.ModelsProduced,
      "Stations Used": r.StationsUsed,
      "Record Count": r.RecordCount,
    }));

  const exportModelReport = () =>
    visibleModelRows.map((r) => ({
      [periodHeader]: r.Period,
      "Model Name": r.Model_Name,
      "Model No.": r.ModelNo,
      Station: r.StationCode,
      "FG Qty": r.FGQty,
      "Record Count": r.RecordCount,
    }));

  const fetchExportData = async () => {
    const resolved = resolveParams();
    const range = lastRange.current;
    if (!range.startTime || !range.endTime || !resolved) {
      toast.error("Please select Line, Stage, and Time Range.");
      return [];
    }
    try {
      const res = await axios.get(`${baseURL}prod/export-production-report`, {
        params: baseParams(resolved, range),
      });
      return res?.data?.success ? res.data.data : [];
    } catch {
      toast.error("Failed to fetch export data.");
      return [];
    }
  };

  if (variantsLoading || stagesLoading) return <Loader />;

  const busy = reportLoading || !!quickLoading;

  const btnBase =
    "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer";
  const btnDisabled = "bg-slate-200 text-slate-400 cursor-not-allowed";

  const th =
    "px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap";
  const td = "px-3 py-2 border-b border-slate-100 whitespace-nowrap";

  const EmptyState = ({ text }) => (
    <div className="flex flex-col items-center gap-3 text-slate-400 py-16">
      <PackageOpen className="w-12 h-12 opacity-20" strokeWidth={1.2} />
      <p className="text-sm">{text}</p>
    </div>
  );

  const emptyText = hasQueried
    ? "No records found for the selected filters."
    : "No data yet. Apply filters and click Query.";

  /* ════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════ */
  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      {/* ── Sub-header with KPIs ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shadow-sm shrink-0 gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-tight">
            Model Trend
          </h1>
          <p className="text-[11px] text-slate-400">
            Daily and monthly finished-goods production by model, across all
            lines and stages
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {[
            ["Total FG Qty", summary.TotalQty, KPI_STYLES.blue],
            ["Models", summary.ModelsProduced, KPI_STYLES.emerald],
            ["Stations", summary.StationsUsed, KPI_STYLES.indigo],
            ["Records", summary.RecordCount, KPI_STYLES.slate],
          ].map(([label, value, st]) => (
            <div
              key={label}
              className={`flex flex-col items-center px-4 py-1.5 rounded-lg border min-w-24 ${st.box}`}
            >
              <span className={`text-xl font-bold font-mono ${st.value}`}>
                {num(value)}
              </span>
              <span
                className={`text-[10px] font-medium uppercase tracking-wide ${st.label}`}
              >
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-hidden flex flex-col p-4 gap-3">
        {/* ── Filters (unchanged fields) ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 shrink-0">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-3">
            Filters
          </p>

          <div className="flex flex-wrap gap-3 items-end">
            <div className="min-w-47.5 flex-1">
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
                label="Report Type"
                value={reportType}
                options={[
                  { value: "daywise", label: "Day Wise" },
                  { value: "monthwise", label: "Month Wise" },
                ]}
                onChange={(e) => setReportType(e.target.value)}
              />
            </div>
            <div className="min-w-42.5 flex-1">
              <SelectField
                label="Shift"
                value={selectedShift}
                options={[
                  { value: "shift1", label: "Shift 1" },
                  { value: "shift2", label: "Shift 2" },
                  { value: "both", label: "Both Shifts" },
                ]}
                onChange={(e) => setSelectedShift(e.target.value)}
              />
            </div>
            <div className="min-w-42.5 flex-1">
              <SelectField
                label="Line"
                value={simpleLine}
                options={[
                  { value: "", label: "Select Line" },
                  ...SIMPLE_LINE_OPTIONS,
                ]}
                onChange={(e) => setSimpleLine(e.target.value)}
              />
            </div>
            <div className="min-w-42.5 flex-1">
              <SelectField
                label="Stage"
                value={simpleStage}
                options={[
                  {
                    value: "",
                    label: simpleLine ? "Select Stage" : "Select a line first",
                  },
                  ...simpleStageOptions,
                ]}
                onChange={(e) => setSimpleStage(e.target.value)}
                disabled={!simpleLine}
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

            {/* Actions */}
            <div className="flex items-center gap-2 pb-0.5 flex-wrap">
              <button
                onClick={handleQuery}
                disabled={busy || loading}
                className={`${btnBase} px-5 ${
                  busy || loading
                    ? btnDisabled
                    : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
                }`}
              >
                {reportLoading && !quickLoading ? (
                  <Spinner />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                {reportLoading && !quickLoading ? "Fetching…" : "Query"}
              </button>

              {[
                [
                  "yday",
                  "Yesterday",
                  handleYesterday,
                  "bg-amber-500 hover:bg-amber-600",
                ],
                [
                  "today",
                  "Today",
                  handleToday,
                  "bg-emerald-600 hover:bg-emerald-700",
                ],
                ["mtd", "MTD", handleMTD, "bg-indigo-600 hover:bg-indigo-700"],
              ].map(([key, label, onClick, color]) => (
                <button
                  key={key}
                  onClick={onClick}
                  disabled={busy}
                  className={`${btnBase} ${
                    busy ? btnDisabled : `${color} text-white shadow-sm`
                  }`}
                >
                  {quickLoading === key && <Spinner />}
                  {quickLoading === key ? "Loading…" : label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Results ── */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-0">
          {/* Tabs + context chips + export */}
          <div className="flex items-center justify-between px-4 border-b border-slate-100 shrink-0 gap-3 flex-wrap">
            <div className="flex items-center gap-1">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`px-3 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors cursor-pointer ${
                    activeTab === t.id
                      ? "border-blue-600 text-blue-700"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {t.id === "overview"
                    ? isMonthly
                      ? "Monthly Overview"
                      : "Daily Overview"
                    : t.id === "models"
                      ? isMonthly
                        ? "Monthly Model Report"
                        : "Daily Model Report"
                      : t.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 py-2">
              {selectedPeriod && (
                <span className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-medium">
                  {isMonthly ? selectedPeriod : fmtDay(selectedPeriod)}
                  <button
                    onClick={() => setSelectedPeriod(null)}
                    className="ml-1 hover:text-red-500 transition-colors"
                    aria-label="Clear period filter"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              )}
              {activeTab === "overview" && overview.length > 0 && (
                <ExportButton
                  fetchData={exportOverview}
                  filename={isMonthly ? "Monthly_Overview" : "Daily_Overview"}
                />
              )}
              {activeTab === "models" && visibleModelRows.length > 0 && (
                <ExportButton
                  fetchData={exportModelReport}
                  filename={
                    isMonthly ? "Monthly_Model_Report" : "Daily_Model_Report"
                  }
                />
              )}
              {activeTab === "detail" && productionData.length > 0 && (
                <ExportButton fetchData={fetchExportData} filename="FG_Data" />
              )}
            </div>
          </div>

          {/* ── Tab: Overview ── */}
          {activeTab === "overview" && (
            <div className="flex-1 overflow-auto min-h-0">
              {reportLoading ? (
                <div className="flex items-center justify-center h-full gap-2 text-blue-600">
                  <Spinner cls="w-5 h-5" />
                  <span className="text-sm">Loading…</span>
                </div>
              ) : overview.length === 0 ? (
                <EmptyState text={emptyText} />
              ) : (
                <table className="w-full text-xs text-left border-separate border-spacing-0">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-100">
                      <th className={th}>{periodHeader}</th>
                      {isMonthly && <th className={th}>Month</th>}
                      <th className={`${th} text-right`}>Total FG Qty</th>
                      <th className={`${th} w-1/4`}>Share of peak</th>
                      <th className={`${th} text-right`}>Models Produced</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.map((r) => (
                      <tr
                        key={r.Period}
                        onClick={() => openPeriod(r.Period)}
                        className="cursor-pointer hover:bg-blue-50/60 transition-colors even:bg-slate-50/40"
                        title="Click to see the model report for this period"
                      >
                        <td className={`${td} font-medium text-slate-800`}>
                          {isMonthly ? r.Period : fmtDay(r.Period)}
                        </td>
                        {isMonthly && (
                          <td className={`${td} text-slate-600`}>
                            {monthName(r.Period)}
                          </td>
                        )}
                        <td
                          className={`${td} text-right font-mono font-bold text-slate-800`}
                        >
                          {num(r.TotalQty)}
                        </td>
                        <td className={td}>
                          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-blue-500"
                              style={{
                                width: `${(Number(r.TotalQty) / maxOverviewQty) * 100}%`,
                              }}
                            />
                          </div>
                        </td>
                        <td
                          className={`${td} text-right font-mono text-slate-600`}
                        >
                          {num(r.ModelsProduced)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="sticky bottom-0">
                    <tr className="bg-slate-100 font-semibold text-slate-700">
                      <td className="px-3 py-2.5" colSpan={isMonthly ? 2 : 1}>
                        Overall (unique)
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono">
                        {num(summary.TotalQty)}
                      </td>
                      <td />
                      <td className="px-3 py-2.5 text-right font-mono">
                        {num(summary.ModelsProduced)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          )}

          {/* ── Tab: Model Report ── */}
          {activeTab === "models" && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between gap-3 shrink-0 flex-wrap">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    value={modelSearch}
                    onChange={(e) => setModelSearch(e.target.value)}
                    placeholder="Search model name or number"
                    className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <span className="text-[11px] text-slate-400">
                  {visibleModelRows.length} rows · {num(visibleQty)} FG Qty
                </span>
              </div>

              <div className="flex-1 overflow-auto min-h-0">
                {reportLoading ? (
                  <div className="flex items-center justify-center h-full gap-2 text-blue-600">
                    <Spinner cls="w-5 h-5" />
                    <span className="text-sm">Loading…</span>
                  </div>
                ) : visibleModelRows.length === 0 ? (
                  <EmptyState
                    text={
                      modelReport.length > 0
                        ? "No models match the current search or period."
                        : emptyText
                    }
                  />
                ) : (
                  <table className="w-full text-xs text-left border-separate border-spacing-0">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-slate-100">
                        <th className={th}>{periodHeader}</th>
                        <th className={th}>Model Name</th>
                        <th className={`${th} text-right`}>FG Qty</th>
                        <th className={`${th} w-1/5`}>Share of peak</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleModelRows.map((r, i) => (
                        <tr
                          key={`${r.Period}-${r.ModelNo}-${r.StationCode}-${i}`}
                          className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40"
                        >
                          <td className={`${td} text-slate-600`}>
                            {isMonthly ? r.Period : fmtDay(r.Period)}
                          </td>
                          <td className={`${td} font-medium text-slate-800`}>
                            {r.Model_Name}
                          </td>
                          <td
                            className={`${td} text-right font-mono font-bold text-slate-800`}
                          >
                            {num(r.FGQty)}
                          </td>
                          <td className={td}>
                            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-emerald-500"
                                style={{
                                  width: `${(Number(r.FGQty) / maxModelQty) * 100}%`,
                                }}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="sticky bottom-0">
                      <tr className="bg-slate-100 font-semibold text-slate-700">
                        <td className="px-3 py-2.5" colSpan={2}>
                          Total of rows shown
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono">
                          {num(visibleQty)}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>

              <p className="text-[10px] text-slate-400 px-4 py-2 border-t border-slate-100 shrink-0">
                FG Qty counts unique FG serials where available; Record Count is
                the number of source records. If one serial appears in several
                groups, row totals can exceed the overall unique total.
              </p>
            </div>
          )}

          {/* ── Tab: FG Data ── */}
          {activeTab === "detail" && (
            <div className="flex-1 overflow-auto min-h-0">
              {loading && productionData.length === 0 ? (
                <div className="flex items-center justify-center h-full gap-2 text-blue-600">
                  <Spinner cls="w-5 h-5" />
                  <span className="text-sm">Loading…</span>
                </div>
              ) : (
                <table className="w-full table-auto text-xs text-left border-separate border-spacing-0">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-100">
                      {[
                        "Sr. No.",
                        "Model Name",
                        "FG Serial",
                        "Assembly Sr.",
                        "Asset Tag",
                        "Customer QR",
                        "User",
                        "Created On",
                        "Production Date",
                        "Production Month",
                        "Line",
                      ].map((h) => (
                        <th key={h} className={th}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {productionData.length > 0 ? (
                      productionData.map((item, idx) => {
                        const created = String(item.CreatedOn || "")
                          .replace("T", " ")
                          .replace("Z", "");
                        const isLast = idx === productionData.length - 1;
                        return (
                          <tr
                            key={idx}
                            ref={isLast ? lastRowRef : null}
                            className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40"
                          >
                            <td className={`${td} font-mono text-slate-400`}>
                              {item.SrNo || idx + 1}
                            </td>
                            <td className={`${td} font-medium text-slate-800`}>
                              {item.Model_Name}
                            </td>
                            <td className={`${td} font-mono text-slate-700`}>
                              {item.FG_SR}
                            </td>
                            <td className={`${td} font-mono text-slate-700`}>
                              {item.Assembly_Sr_No}
                            </td>
                            <td className={`${td} text-slate-600`}>
                              {item.Asset_tag}
                            </td>
                            <td className={`${td} text-slate-600`}>
                              {item.Customer_QR}
                            </td>
                            <td className={`${td} text-slate-600`}>
                              {item.UserName}
                            </td>
                            <td
                              className={`${td} text-slate-500 font-mono text-[10px]`}
                            >
                              {created}
                            </td>
                            <td className={`${td} text-slate-600`}>
                              {created.slice(0, 10)}
                            </td>
                            <td className={`${td} text-slate-600`}>
                              {created.slice(0, 7)}
                            </td>
                            <td className={`${td} text-slate-600`}>
                              {item.Station_Name || item.Name || "—"}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={11}>
                          <EmptyState text={emptyText} />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
              {loading && productionData.length > 0 && (
                <div className="flex items-center justify-center py-4 gap-2 text-blue-600 text-xs border-t border-slate-100">
                  <Spinner /> Loading more records…
                </div>
              )}
              {productionData.length > 0 && (
                <p className="text-[10px] text-slate-400 px-4 py-2">
                  Showing {num(productionData.length)} of {num(totalCount)}{" "}
                  records
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModelTrend;
