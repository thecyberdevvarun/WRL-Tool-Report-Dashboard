import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import SelectField from "../../../components/ui/SelectField.jsx";
import axios from "axios";
import DateTimePicker from "../../../components/ui/DateTimePicker.jsx";
import Loader from "../../../components/ui/Loader.jsx";
import toast from "react-hot-toast";
import { baseURL } from "../../../assets/assets.js";

import {
  useGetModelVariantsQuery,
  useGetStagesQuery,
} from "../../../redux/api/commonApi.js";

import {
  Search,
  Loader2,
  PackageOpen,
  Zap,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";

import ExportButton from "../../../components/ui/ExportButton.jsx";

// ─── Line → Stage → codes mapping ────────────────────────────────────────────
// linecodes maps to pa.Remark in ProcessActivity

const LINE_STAGE_MAPPING = {
  "Freezer Line": {
    "FG Label": {
      linecodes: [12501],
      stationCodes: [1220010],
    },
    MFT: {
      linecodes: [12501],
      stationCodes: [1220014],
    },
    EST: {
      linecodes: [12501],
      stationCodes: [1220008],
    },
    "Gas Charging": {
      linecodes: [12501],
      stationCodes: [1220011],
    },
    "Comp Scan": {
      linecodes: [12501],
      stationCodes: [1220005],
    },
    "Post Foaming": {
      linecodes: [12301, 12302],
      stationCodes: [1220003, 1220004],
    },
    Foaming: {
      linecodes: [12301, 12302],
      stationCodes: [1220001, 1220002],
    },
  },

  "Chocolate Line": {
    "FG Label": {
      linecodes: [12305],
      stationCodes: [1220010],
    },
    MFT: {
      linecodes: [12305],
      stationCodes: [1220014],
    },
    EST: {
      linecodes: [12305],
      stationCodes: [1220008],
    },
    "Gas Charging": {
      linecodes: [12305],
      stationCodes: [1220011],
    },
    "Comp Scan": {
      linecodes: [12305],
      stationCodes: [1220005],
    },
    "Post Foaming": {
      linecodes: [12305],
      stationCodes: [1230007],
    },
  },

  "VISI Cooler Line": {
    "FG Label": {
      linecodes: [12605],
      stationCodes: [1220010],
    },
    MFT: {
      linecodes: [12605],
      stationCodes: [1220014],
    },
    EST: {
      linecodes: [12605],
      stationCodes: [1220008],
    },
    "Gas Charging": {
      linecodes: [12605],
      stationCodes: [1220011],
    },
    "Comp Scan": {
      linecodes: [12605],
      stationCodes: [1220005],
    },
    "Post Comp Scan": {
      linecodes: [12605],
      stationCodes: [1240003],
    },
    "Post Foaming": {
      linecodes: [12605],
      stationCodes: [1230012],
    },
  },

  "SUS Line": {
    "FG Label": {
      linecodes: [12304],
      stationCodes: [1230017],
    },
    MFT: {
      linecodes: [12304],
      stationCodes: [1230028],
    },
    EST: {
      linecodes: [12304],
      stationCodes: [1230015],
    },
    "Gas Charging": {
      linecodes: [12304],
      stationCodes: [1260010],
    },
    "Comp Scan 1": {
      linecodes: [12304],
      stationCodes: [1230013],
    },
    "Comp Scan 2": {
      linecodes: [12304],
      stationCodes: [1230014],
    },
    "Post Foaming": {
      linecodes: [12304],
      stationCodes: [1230012],
    },
  },
};

const SIMPLE_LINE_OPTIONS = Object.keys(LINE_STAGE_MAPPING).map((line) => ({
  value: line,
  label: line,
}));

/* ── Spinner ── */

const Spinner = ({ cls = "w-4 h-4" }) => (
  <Loader2 className={`animate-spin ${cls}`} />
);

/* ════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════ */

const Overview = () => {
  /* ── Loading states ── */

  const [loading, setLoading] = useState(false);
  const [ydayLoading, setYdayLoading] = useState(false);
  const [todayLoading, setTodayLoading] = useState(false);
  const [monthLoading, setMonthLoading] = useState(false);

  /* ── Mode toggle ── */
  const [isDetailReport, setIsDetailReport] = useState(false);

  /* ── Simple-mode state ── */
  const [simpleLine, setSimpleLine] = useState("");
  const [simpleStage, setSimpleStage] = useState("");

  /* ── Filter state ── */
  const [selectedModelVariant, setSelectedModelVariant] = useState(null);
  const [selectedStage, setSelectedStage] = useState(null);

  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  /* ── Production data state ── */
  const [productionData, setProductionData] = useState([]);

  const [page, setPage] = useState(1);
  const [limit] = useState(1000);

  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const [selectedModelName, setSelectedModelName] = useState(null);
  const [isQuickMode, setIsQuickMode] = useState(false);

  const [activeStartTime, setActiveStartTime] = useState("");
  const [activeEndTime, setActiveEndTime] = useState("");

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
    if (variantsError) {
      toast.error("Failed to load model variants");
    }

    if (stagesError) {
      toast.error("Failed to load stages");
    }
  }, [variantsError, stagesError]);

  /* ── Simple mode: derive stage options ── */

  const simpleStageOptions = useMemo(() => {
    if (!simpleLine || !LINE_STAGE_MAPPING[simpleLine]) {
      return [];
    }

    return Object.keys(LINE_STAGE_MAPPING[simpleLine]).map((stage) => ({
      value: stage,
      label: stage,
    }));
  }, [simpleLine]);

  useEffect(() => {
    setSimpleStage("");
  }, [simpleLine]);

  /* ── Resolve stationCode + linecode ── */

  const resolveParams = () => {
    if (!isDetailReport) {
      const mapping = LINE_STAGE_MAPPING[simpleLine]?.[simpleStage];

      if (!mapping || !mapping.stationCodes.length) {
        return null;
      }

      return {
        stationCode: mapping.stationCodes.join(","),
        linecode: mapping.linecodes.join(","),
      };
    }

    const stationCode = selectedStage?.value || null;

    if (!stationCode) {
      return null;
    }

    return {
      stationCode,
      linecode: null,
    };
  };

  /* ── Infinite scroll observer ── */

  const observer = useRef();

  const lastRowRef = useCallback(
    (node) => {
      if (loading || isQuickMode) return;

      if (observer.current) {
        observer.current.disconnect();
      }

      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          setPage((previousPage) => previousPage + 1);
        }
      });

      if (node) {
        observer.current.observe(node);
      }
    },
    [loading, hasMore, isQuickMode],
  );

  /* ── Date helpers ── */

  const pad = (number) => (number < 10 ? `0${number}` : `${number}`);

  const fmt = (date) =>
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
      date.getDate(),
    )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;

  /* ── Paginated production fetch ── */

  const fetchProductionData = async (pageNum = 1) => {
    const resolved = resolveParams();

    if (!startTime || !endTime || !resolved) {
      toast.error(
        isDetailReport
          ? "Please select a Stage and a Time Range."
          : "Please select a Line, Stage, and Time Range.",
      );

      return;
    }

    try {
      setLoading(true);

      const params = {
        startTime,
        endTime,
        page: pageNum,
        limit,
        stationCode: resolved.stationCode,

        ...(resolved.linecode ? { linecode: resolved.linecode } : {}),

        model: selectedModelVariant ? Number(selectedModelVariant.value) : 0,
      };

      const res = await axios.get(`${baseURL}prod/fgdata`, {
        params,
      });

      if (res?.data?.success) {
        const records = Array.isArray(res.data.data) ? res.data.data : [];

        setProductionData((previousData) =>
          pageNum === 1 ? records : [...previousData, ...records],
        );

        if (pageNum === 1) {
          setTotalCount(res.data.totalCount || 0);
        }

        setHasMore(records.length >= limit);
      }
    } catch (error) {
      console.error("Production fetch error:", error);
      toast.error("Failed to fetch production data.");
    } finally {
      setLoading(false);
    }
  };

  /* ── Quick filter fetch ── */
  const fetchQuickData = async (url, start, end, setLoader) => {
    const resolved = resolveParams();

    if (!resolved) {
      toast.error(
        isDetailReport
          ? "Please select a Stage before using quick filters."
          : "Please select a Line and Stage before using quick filters.",
      );
      return;
    }

    try {
      setLoader(true);

      // Save the active range for both exports
      setActiveStartTime(start);
      setActiveEndTime(end);

      setProductionData([]);
      setTotalCount(0);
      setSelectedModelName(null);
      setIsQuickMode(true);

      const params = {
        startTime: start,
        endTime: end,
        stationCode: resolved.stationCode,
        ...(resolved.linecode ? { linecode: resolved.linecode } : {}),
        model: selectedModelVariant ? Number(selectedModelVariant.value) : 0,
      };

      const res = await axios.get(`${baseURL}${url}`, { params });

      if (res?.data?.success) {
        const records = Array.isArray(res.data.data) ? res.data.data : [];

        setProductionData(records);
        setTotalCount(res.data.totalCount || records.length);
      }
    } catch (error) {
      console.error("Quick filter error:", error);
      toast.error("Failed to fetch data");
    } finally {
      setLoader(false);
    }
  };

  /* ── Yesterday filter ── */

  const fetchYesterdayProductionData = () => {
    const now = new Date();

    const today8AM = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      8,
      0,
      0,
    );

    const yesterday8AM = new Date(today8AM);

    yesterday8AM.setDate(today8AM.getDate() - 1);

    fetchQuickData(
      "prod/yday-fgdata",
      fmt(yesterday8AM),
      fmt(today8AM),
      setYdayLoading,
    );
  };

  /* ── Today filter ── */

  const fetchTodayProductionData = () => {
    const now = new Date();

    const today8AM = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      8,
      0,
      0,
    );

    fetchQuickData(
      "prod/today-fgdata",
      fmt(today8AM),
      fmt(now),
      setTodayLoading,
    );
  };

  /* ── Month-to-date filter ── */

  const fetchMTDProductionData = () => {
    const now = new Date();

    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
      8,
      0,
      0,
    );

    fetchQuickData(
      "prod/month-fgdata",
      fmt(startOfMonth),
      fmt(now),
      setMonthLoading,
    );
  };

  /* ════════════════════════════════════════════
     EXPORT DATA
  ════════════════════════════════════════════ */

  /* ── Fetch complete production export data ── */
  const fetchExportData = async () => {
    const resolved = resolveParams();

    // Use the active date range, whether manual or quick filter
    const exportStartTime = activeStartTime || startTime;
    const exportEndTime = activeEndTime || endTime;

    if (!exportStartTime || !exportEndTime || !resolved) {
      toast.error("Please select Stage and Time Range.");
      return [];
    }

    try {
      const res = await axios.get(`${baseURL}prod/export-production-report`, {
        params: {
          startTime: exportStartTime,
          endTime: exportEndTime,
          stationCode: resolved.stationCode,
          ...(resolved.linecode ? { linecode: resolved.linecode } : {}),
          model: selectedModelVariant
            ? parseInt(selectedModelVariant.value, 10)
            : 0,
        },
      });

      return res?.data?.success && Array.isArray(res.data.data)
        ? res.data.data
        : [];
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to fetch export data.");
      return [];
    }
  };

  /* ── Model-wise summary for the UI ──
     The paginated API already provides:
     StartSerial, EndSerial and TotalCount.
  */

  const aggregated = useMemo(() => {
    if (!Array.isArray(productionData)) {
      return [];
    }

    const modelMap = new Map();

    productionData.forEach((item) => {
      const model = item.Model_Name;

      if (!model) return;

      // One summary row per model.
      // The backend's ModelStats CTE already calculates
      // these values across the complete filtered dataset.

      if (!modelMap.has(model)) {
        modelMap.set(model, {
          Model_Name: model,
          StartSerial: item.StartSerial || "",
          EndSerial: item.EndSerial || "",
          TotalCount: Number(item.TotalCount) || 0,
        });
      }
    });

    return Array.from(modelMap.values());
  }, [productionData]);

  /* ── Model-wise summary for Excel export ──
     The export API returns all matching production rows.
     It does not return TotalCount per row, so count records
     and use the backend-provided StartSerial/EndSerial.
  */

  const fetchAggregatedExportData = async () => {
    const data = await fetchExportData();

    if (!Array.isArray(data) || data.length === 0) {
      return [];
    }

    const modelMap = new Map();

    data.forEach((item) => {
      const model = item.Model_Name;

      if (!model) return;

      if (!modelMap.has(model)) {
        modelMap.set(model, {
          Model_Name: model,
          StartSerial: item.StartSerial || "",
          EndSerial: item.EndSerial || "",
          TotalCount: 0,
        });
      }

      const current = modelMap.get(model);

      current.TotalCount += 1;
    });

    return Array.from(modelMap.values());
  };

  /* ── Pagination side-effect ── */

  useEffect(() => {
    if (page > 1) {
      fetchProductionData(page);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  /* ── Handlers ── */
  const handleFgData = () => {
    setProductionData([]);
    setPage(1);
    setHasMore(false);
    setTotalCount(0);
    setSelectedModelName(null);
    setIsQuickMode(false);

    setActiveStartTime(startTime);
    setActiveEndTime(endTime);

    fetchProductionData(1);
  };

  const handleModelRowClick = (modelName) => {
    setSelectedModelName((previousName) =>
      previousName === modelName ? null : modelName,
    );

    setIsQuickMode(true);
  };

  /* ── Filter production data ── */

  const filteredProductionData = useMemo(() => {
    if (!selectedModelName) {
      return productionData;
    }

    return productionData.filter(
      (item) => item.Model_Name === selectedModelName,
    );
  }, [productionData, selectedModelName]);

  const anyLoading = ydayLoading || todayLoading || monthLoading;

  if (variantsLoading || stagesLoading) {
    return <Loader />;
  }

  /* ════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════ */

  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      {/* ── Page Header ── */}

      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shadow-sm shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-tight">
            Overview
          </h1>

          <p className="text-[11px] text-slate-400">
            View production data across all lines and stages throughout the
            plant
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-blue-50 border border-blue-100 min-w-22.5">
            <span className="text-xl font-bold font-mono text-blue-700">
              {totalCount ?? 0}
            </span>

            <span className="text-[10px] text-blue-500 font-medium uppercase tracking-wide">
              Total Records
            </span>
          </div>

          {aggregated.length > 0 && (
            <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100 min-w-22.5">
              <span className="text-xl font-bold font-mono text-emerald-700">
                {aggregated.length}
              </span>

              <span className="text-[10px] text-emerald-500 font-medium uppercase tracking-wide">
                Model Types
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Body ── */}

      <div className="flex-1 overflow-hidden flex flex-col p-4 gap-3">
        {/* ── Filters ── */}

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 shrink-0">
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
              Filters
            </p>

            <button
              onClick={() => setIsDetailReport((value) => !value)}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                isDetailReport
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600"
              }`}
            >
              {isDetailReport ? (
                <ToggleRight className="w-3.5 h-3.5" />
              ) : (
                <ToggleLeft className="w-3.5 h-3.5" />
              )}

              {isDetailReport ? "Detail Mode" : "Simple Mode"}
            </button>

            <span className="text-[11px] text-slate-400">
              {isDetailReport
                ? "Manually select stage code"
                : "Pick a line and stage — codes resolved automatically"}
            </span>
          </div>

          <div className="flex flex-wrap gap-3 items-end">
            {/* Model Variant */}

            <div className="min-w-47.5 flex-1">
              <SelectField
                label="Model Variant"
                options={variants}
                value={selectedModelVariant?.value || ""}
                onChange={(e) =>
                  setSelectedModelVariant(
                    variants.find(
                      (option) => option.value === e.target.value,
                    ) || null,
                  )
                }
              />
            </div>

            {/* Stage selection */}

            {isDetailReport ? (
              <div className="min-w-47.5 flex-1">
                <SelectField
                  label="Stage Name"
                  options={stages}
                  value={selectedStage?.value || ""}
                  onChange={(e) =>
                    setSelectedStage(
                      stages.find(
                        (option) => option.value === e.target.value,
                      ) || null,
                    )
                  }
                />
              </div>
            ) : (
              <>
                <div className="min-w-42.5 flex-1">
                  <SelectField
                    label="Line"
                    value={simpleLine}
                    options={[
                      {
                        value: "",
                        label: "Select Line",
                      },
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
                        label: simpleLine
                          ? "Select Stage"
                          : "Select a line first",
                      },
                      ...simpleStageOptions,
                    ]}
                    onChange={(e) => setSimpleStage(e.target.value)}
                    disabled={!simpleLine}
                  />
                </div>
              </>
            )}

            {/* Start Time */}

            <div className="min-w-46.25 flex-1">
              <DateTimePicker
                label="Start Time"
                name="startTime"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>

            {/* End Time */}

            <div className="min-w-46.25 flex-1">
              <DateTimePicker
                label="End Time"
                name="endTime"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>

            {/* Action Buttons */}

            <div className="flex items-center gap-2 pb-0.5 flex-wrap">
              <button
                onClick={handleFgData}
                disabled={loading}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  loading
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
                }`}
              >
                {loading ? (
                  <Spinner cls="w-4 h-4" />
                ) : (
                  <Search className="w-4 h-4" />
                )}

                {loading ? "Fetching…" : "Query"}
              </button>

              <button
                onClick={fetchYesterdayProductionData}
                disabled={ydayLoading}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  ydayLoading
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-amber-500 hover:bg-amber-600 text-white shadow-sm"
                }`}
              >
                {ydayLoading ? <Spinner cls="w-4 h-4" /> : null}
                {ydayLoading ? "Loading…" : "Yesterday"}
              </button>

              <button
                onClick={fetchTodayProductionData}
                disabled={todayLoading}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  todayLoading
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                }`}
              >
                {todayLoading ? <Spinner cls="w-4 h-4" /> : null}
                {todayLoading ? "Loading…" : "Today"}
              </button>

              <button
                onClick={fetchMTDProductionData}
                disabled={monthLoading}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  monthLoading
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                }`}
              >
                {monthLoading ? <Spinner cls="w-4 h-4" /> : null}
                {monthLoading ? "Loading…" : "MTD"}
              </button>
            </div>
          </div>
        </div>

        {/* ── Summary Container ── */}

        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-0">
          {/* Overall Summary Header */}

          <div className="flex items-center justify-between px-4 py-2.5 border-b bg-slate-100 border-slate-200 shrink-0">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Production Overview
            </span>

            <div className="flex items-center gap-3">
              {isQuickMode && (
                <span className="text-[11px] bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full">
                  <Zap className="w-3 h-3 inline mr-1" />
                  Quick filter mode
                </span>
              )}

              <span className="text-[11px] text-slate-400">
                {selectedModelName
                  ? `${filteredProductionData.length} of ${productionData.length} records`
                  : `${productionData.length} records`}
              </span>
            </div>
          </div>

          {/* ── Two Panel Body ── */}

          <div className="flex-1 flex min-h-0 overflow-hidden">
            {/* ═══════════════════════════════════
                LEFT PANEL — PRODUCTION DETAILS
            ═══════════════════════════════════ */}

            <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
              {/* Production Details Header */}

              <div className="flex items-center justify-between px-4 py-2.5 border-b bg-slate-100 border-slate-200 shrink-0">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Production Details
                </span>

                {productionData.length > 0 && (
                  <ExportButton
                    fetchData={fetchExportData}
                    filename="Production_Report"
                  />
                )}
              </div>

              {/* Detail Table */}

              <div className="flex-1 min-h-0 min-w-0 overflow-auto">
                {anyLoading && productionData.length === 0 ? (
                  <div className="flex items-center justify-center h-full gap-2 text-blue-600">
                    <Spinner cls="w-5 h-5" />
                    <span className="text-sm">Loading…</span>
                  </div>
                ) : (
                  <table className="min-w-300 w-full text-xs text-left border-separate border-spacing-0">
                    <thead>
                      <tr className="bg-slate-100">
                        {[
                          "Sr. No.",
                          "Model Name",
                          "Station",
                          "Assembly Sr.",
                          "Asset Tag",
                          "Customer QR",
                          "User",
                          "FG Serial",
                          "Created On",
                          "Remark",
                        ].map((heading) => (
                          <th
                            key={heading}
                            className="sticky top-0 z-20 bg-slate-100 px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap"
                          >
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {filteredProductionData.length > 0 ? (
                        filteredProductionData.map((item, idx) => {
                          const isLast =
                            !isQuickMode &&
                            idx === filteredProductionData.length - 1;

                          return (
                            <tr
                              key={`${item.SrNo || idx}-${item.Assembly_Sr_No || ""}`}
                              ref={isLast ? lastRowRef : null}
                              className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40"
                            >
                              <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-400 whitespace-nowrap">
                                {item.SrNo || idx + 1}
                              </td>

                              <td className="px-3 py-2 border-b border-slate-100 font-medium text-slate-800 whitespace-nowrap">
                                {item.Model_Name}
                              </td>

                              <td className="px-3 py-2 border-b border-slate-100 text-slate-600 whitespace-nowrap">
                                {item.StationCode}
                              </td>

                              <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-700 whitespace-nowrap">
                                {item.Assembly_Sr_No}
                              </td>

                              <td className="px-3 py-2 border-b border-slate-100 text-slate-600 whitespace-nowrap">
                                {item.Asset_tag}
                              </td>

                              <td className="px-3 py-2 border-b border-slate-100 text-slate-600 whitespace-nowrap">
                                {item.Customer_QR}
                              </td>

                              <td className="px-3 py-2 border-b border-slate-100 text-slate-600 whitespace-nowrap">
                                {item.UserName}
                              </td>

                              <td className="px-3 py-2 border-b border-slate-100 font-mono text-slate-700 whitespace-nowrap">
                                {item.FG_SR}
                              </td>

                              <td className="px-3 py-2 border-b border-slate-100 text-slate-500 whitespace-nowrap font-mono text-[10px]">
                                {item.CreatedOn?.replace("T", " ").replace(
                                  "Z",
                                  "",
                                )}
                              </td>

                              <td className="px-3 py-2 border-b border-slate-100 text-slate-600 whitespace-nowrap">
                                {item.Name || "—"}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={10} className="py-16 text-center">
                            <div className="flex flex-col items-center gap-3 text-slate-400">
                              <PackageOpen
                                className="w-12 h-12 opacity-20"
                                strokeWidth={1.2}
                              />

                              <p className="text-sm">
                                {productionData.length > 0 && selectedModelName
                                  ? `No records match model "${selectedModelName}"`
                                  : "No data found. Apply filters and click Query."}
                              </p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}

                {loading && productionData.length > 0 && (
                  <div className="flex items-center justify-center py-4 gap-2 text-blue-600 text-xs border-t border-slate-100">
                    <Spinner cls="w-4 h-4" />
                    Loading more records…
                  </div>
                )}
              </div>
            </div>

            {/* ═══════════════════════════════════
                RIGHT PANEL — MODEL-WISE SUMMARY
            ═══════════════════════════════════ */}

            <div className="w-105 shrink-0 border-l border-slate-200 flex flex-col min-h-0 bg-slate-50/50">
              {/* Model-wise Summary Header */}

              <div className="flex items-center justify-between px-3 py-2.5 border-b bg-slate-100 border-slate-200 shrink-0">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Model-wise Summary
                </span>

                {aggregated.length > 0 && (
                  <ExportButton
                    fetchData={fetchAggregatedExportData}
                    filename="Production_Summary"
                  />
                )}
              </div>

              {/* Model Table Scroll Container */}

              <div className="flex-1 min-h-0 overflow-auto">
                {anyLoading && productionData.length === 0 ? (
                  <div className="flex items-center justify-center h-20 gap-2 text-slate-400 text-xs">
                    <Spinner cls="w-4 h-4" />
                    Loading…
                  </div>
                ) : aggregated.length === 0 ? (
                  <p className="text-center text-slate-400 text-xs py-10">
                    No summary yet.
                  </p>
                ) : (
                  <table className="w-full text-xs text-left border-separate border-spacing-0">
                    <thead>
                      <tr>
                        <th className="sticky top-0 z-20 bg-slate-100 px-3 py-2.5 font-semibold text-slate-500 border-b border-slate-200 text-left">
                          Model
                        </th>

                        <th className="sticky top-0 z-20 bg-slate-100 px-2 py-2.5 font-semibold text-slate-500 border-b border-slate-200 text-right">
                          Start
                        </th>

                        <th className="sticky top-0 z-20 bg-slate-100 px-2 py-2.5 font-semibold text-slate-500 border-b border-slate-200 text-right">
                          End
                        </th>

                        <th className="sticky top-0 z-20 bg-slate-100 px-3 py-2.5 font-semibold text-slate-500 border-b border-slate-200 text-right">
                          Qty
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {aggregated.map((item, idx) => (
                        <tr
                          key={item.Model_Name || idx}
                          onClick={() => handleModelRowClick(item.Model_Name)}
                          className={`cursor-pointer transition-colors ${
                            selectedModelName === item.Model_Name
                              ? "bg-blue-100"
                              : "hover:bg-white even:bg-white/60"
                          }`}
                        >
                          <td
                            className="px-3 py-2 border-b border-slate-100 font-medium text-slate-700 break-all"
                            title={item.Model_Name}
                          >
                            {item.Model_Name}
                          </td>

                          <td className="px-2 py-2 border-b border-slate-100 font-mono text-slate-500 text-right break-all">
                            {item.StartSerial}
                          </td>

                          <td className="px-2 py-2 border-b border-slate-100 font-mono text-slate-500 text-right break-all">
                            {item.EndSerial}
                          </td>

                          <td className="px-3 py-2 border-b border-slate-100 text-right">
                            <span
                              className={`inline-block font-bold px-2 py-0.5 rounded-md text-[11px] ${
                                selectedModelName === item.Model_Name
                                  ? "bg-blue-200 text-blue-800"
                                  : "bg-slate-200 text-slate-700"
                              }`}
                            >
                              {item.TotalCount}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Bottom Note */}

              {aggregated.length > 0 && (
                <p className="text-[10px] text-slate-400 text-center px-3 py-2 border-t border-slate-200 shrink-0">
                  Tap a row to filter · tap again to clear
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Overview;
