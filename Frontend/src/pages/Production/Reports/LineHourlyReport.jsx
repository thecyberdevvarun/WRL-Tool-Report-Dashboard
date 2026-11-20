import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { baseURL } from "../../../assets/assets.js";
import HourlyWidget from "../../../components/lineHourly/HourlyWidget.jsx";
import MultiDayPivotView from "../../../components/lineHourly/Multidaypivotview.jsx";
import {
  Factory,
  Truck,
  Settings,
  Search,
  Download,
  Calendar,
  History,
  Moon,
  Sun,
  Gauge,
  Loader2,
  RefreshCw,
  Zap,
  Wind,
  CalendarRange,
} from "lucide-react";

// -- Utilities ------------------------------------------------------------------
const normaliseDateTime = (dt) => (dt ? dt.replace("T", " ") : "");
const pad = (n) => String(n).padStart(2, "0");
const formatDate = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

// Exact selected duration in hours, including partial hours.
const getElapsedHours = (startTime, endTime) => {
  if (!startTime || !endTime) return 0;
  const start = new Date(String(startTime).replace(" ", "T")).getTime();
  const end = new Date(String(endTime).replace(" ", "T")).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
    return 0;
  return (end - start) / (1000 * 60 * 60);
};

const CATEGORY_TITLE = "Line Performance vs Target";

const mapCategory = (data = []) => {
  const categories = ["Freezer", "Chocolate", "Visi Cooler", "SUS"];

  return categories.map((category) => {
    const matchedItems = data.filter(
      (item) =>
        String(item.LineName ?? item.category ?? "")
          .trim()
          .toLowerCase() === category.toLowerCase(),
    );

    const TotalCount = matchedItems.reduce(
      (total, item) => total + Number(item.TotalCount || 0),
      0,
    );

    return {
      category,
      TotalCount,
    };
  });
};

// -- Constants ------------------------------------------------------------------
const LINE_TABS = [
  { value: "final_line", label: "Final", icon: Factory },
  { value: "final_loading", label: "Loading", icon: Truck },
  { value: "post_Foaming", label: "Post Foaming", icon: Wind },
  { value: "Foaming", label: "Foaming", icon: Settings },
  { value: "multi_day", label: "Multi-Day", icon: CalendarRange },
];

const EMPTY = {
  // Final Loading
  finalFreezerLoading: [],
  finalChocLoading: [],
  finalSUSLoading: [],
  finalCategoryLoading: [],
  visiLoading: [],
  finalFreezerLoadingModel: [],
  finalChocLoadingModel: [],
  finalSUSLoadingModel: [],
  visiLoadingModel: [],

  // Final Line
  finalFreezer: [],
  finalChoc: [],
  finalSUS: [],
  finalCategory: [],
  visiFinal: [],
  finalFreezerModel: [],
  finalChocModel: [],
  finalSUSModel: [],
  visiFinalModel: [],

  // Post Foaming — one key per endpoint (all return COUNT)
  postGrpA: [],
  postGrpB: [],
  postChoc: [],
  postFOW: [],
  postSUS: [],
  postCategory: [],
  visiPost: [],
  postGrpAModel: [],
  postGrpBModel: [],
  postChocModel: [],
  postFOWModel: [],
  postSUSModel: [],
  visiPostModel: [],

  // Foaming
  foamA: [],
  foamB: [],
  foamCategory: [],
  foamAModel: [],
  foamBModel: [],
};

const CHART = {
  sky: "rgba(14,165,233,0.72)",
  amber: "rgba(245,158,11,0.72)",
  slate: "rgba(100,116,139,0.65)",
  teal: "rgba(20,184,166,0.70)",
};

// -- Widget sizing --------------------------------------------------------------
const ROW_H = 34;
const WIDGET_CHROME = 120;
const MAX_VISIBLE_ROWS = 6;
const WIDGET_MIN_H = WIDGET_CHROME + ROW_H * MAX_VISIBLE_ROWS;

// -- Spinner --------------------------------------------------------------------
const Spinner = ({ cls = "w-4 h-4" }) => (
  <Loader2 className={`animate-spin ${cls}`} />
);

const sumCount = (arr) => arr.reduce((s, r) => s + (r.COUNT || 0), 0);

// -- Main Component -------------------------------------------------------------
const LineHourlyReport = () => {
  const [loading, setLoading] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lineType, setLineType] = useState("final_line");
  const [apiData, setApiData] = useState(EMPTY);
  const [lastFetched, setLastFetched] = useState(null);
  const [countdown, setCountdown] = useState(300);
  // Params of the last query that was actually run (state, so UI updates correctly)
  const [appliedParams, setAppliedParams] = useState({
    StartTime: "",
    EndTime: "",
  });

  const refreshRef = useRef(null);
  const cdRef = useRef(null);
  const paramsRef = useRef({ StartTime: "", EndTime: "" });
  const lineTypeRef = useRef(lineType);
  useEffect(() => {
    lineTypeRef.current = lineType;
  }, [lineType]);

  const API = `${baseURL}prod`;
  const isMultiDay = lineType === "multi_day";
  const elapsedHours = getElapsedHours(
    appliedParams.StartTime,
    appliedParams.EndTime,
  );

  // -- Fetch ------------------------------------------------------------------
  const fetchForType = useCallback(
    async (lt, params) => {
      const get = (path) => axios.get(`${API}/${path}`, { params });
      const safe = (r) =>
        r.status === "fulfilled" && r.value?.data?.success
          ? r.value.data.data || []
          : [];

      // -- Final Loading -----------------------------------------------------
      if (lt === "final_loading") {
        const [r1, r2, r3, r4, r5, m1, m2, m3, m4] = await Promise.allSettled([
          get("final-loading-hp-frz"),
          get("final-loading-hp-choc"),
          get("final-loading-hp-sus"),
          get("final-loading-hp-cat"),
          get("visi-loading-hp"),
          get("final-loading-hp-frz-model"),
          get("final-loading-hp-choc-model"),
          get("final-loading-hp-sus-model"),
          get("final-loading-hp-visi-model"),
        ]);
        return {
          finalFreezerLoading: safe(r1),
          finalChocLoading: safe(r2),
          finalSUSLoading: safe(r3),
          finalCategoryLoading: mapCategory(safe(r4)),
          visiLoading: safe(r5),
          finalFreezerLoadingModel: safe(m1),
          finalChocLoadingModel: safe(m2),
          finalSUSLoadingModel: safe(m3),
          visiLoadingModel: safe(m4),
        };
      }

      // -- Final Line --------------------------------------------------------
      if (lt === "final_line") {
        const [r1, r2, r3, r4, r5, m1, m2, m3, m4] = await Promise.allSettled([
          get("final-hp-frz"),
          get("final-hp-choc"),
          get("final-hp-sus"),
          get("final-hp-cat"),
          get("visi-final-hp"),
          get("final-hp-frz-model"),
          get("final-hp-choc-model"),
          get("final-hp-sus-model"),
          get("visi-final-hp-model"),
        ]);
        return {
          finalFreezer: safe(r1),
          finalChoc: safe(r2),
          finalSUS: safe(r3),
          finalCategory: mapCategory(safe(r4)),
          visiFinal: safe(r5),
          finalFreezerModel: safe(m1),
          finalChocModel: safe(m2),
          finalSUSModel: safe(m3),
          visiFinalModel: safe(m4),
        };
      }

      // -- Post Foaming ------------------------------------------------------
      if (lt === "post_Foaming") {
        const [r1, r2, r3, r4, r5, r6, r7, m1, m2, m3, m4, m5, m6] =
          await Promise.allSettled([
            get("post-hp-GrpA"),
            get("post-hp-GrpB"),
            get("post-hp-Choc"),
            get("post-hp-FOW"),
            get("post-hp-sus"),
            get("post-hp-cat"),
            get("visi-post-hp"),
            get("post-Grp-A-model"),
            get("post-Grp-B-model"),
            get("post-Choc-model"),
            get("post-FOW-model"),
            get("post-hp-sus-model"),
            get("visi-post-hp-model"),
          ]);
        return {
          postGrpA: safe(r1),
          postGrpB: safe(r2),
          postChoc: safe(r3),
          postFOW: safe(r4),
          postSUS: safe(r5),
          postCategory: mapCategory(safe(r6)),
          visiPost: safe(r7),
          postGrpAModel: safe(m1),
          postGrpBModel: safe(m2),
          postChocModel: safe(m3),
          postFOWModel: safe(m4),
          postSUSModel: safe(m5),
          visiPostModel: safe(m6),
        };
      }

      // -- Foaming -----------------------------------------------------------
      if (lt === "Foaming") {
        const [r1, r2, r3, m1, m2] = await Promise.allSettled([
          get("Foaming-hp-fom-a"),
          get("Foaming-hp-fom-b"),
          get("Foaming-hp-fom-cat"),
          get("Foaming-hp-fom-a-model"),
          get("Foaming-hp-fom-b-model"),
        ]);
        return {
          foamA: safe(r1),
          foamB: safe(r2),
          foamCategory: mapCategory(safe(r3)),
          foamAModel: safe(m1),
          foamBModel: safe(m2),
        };
      }

      return {};
    },
    [API],
  );

  const runFetch = useCallback(
    async (params, lt) => {
      setLoading(true);
      setApiData(EMPTY);
      setAppliedParams(params);
      try {
        const updates = await fetchForType(lt, params);
        setApiData((prev) => ({ ...prev, ...updates }));
        setLastFetched(new Date());
      } catch (err) {
        console.error(err);
        toast.error("Failed to fetch data.");
      } finally {
        setLoading(false);
      }
    },
    [fetchForType],
  );

  // -- Handlers ---------------------------------------------------------------
  const handleQuery = () => {
    if (!startTime || !endTime) {
      toast.error("Select a time range first.");
      return;
    }
    const p = {
      StartTime: normaliseDateTime(startTime),
      EndTime: normaliseDateTime(endTime),
    };
    paramsRef.current = p;
    runFetch(p, lineType);
  };

  const handleToday = () => {
    const now = new Date();
    const s = new Date(now);
    s.setHours(8, 0, 0, 0);
    const p = { StartTime: formatDate(s), EndTime: formatDate(now) };
    paramsRef.current = p;
    runFetch(p, lineType);
  };

  const handleYesterday = () => {
    const e = new Date();
    e.setHours(8, 0, 0, 0);
    const s = new Date(e);
    s.setDate(s.getDate() - 1);
    const p = { StartTime: formatDate(s), EndTime: formatDate(e) };
    paramsRef.current = p;
    runFetch(p, lineType);
  };

  // Re-fetch when switching tabs, if a range has already been queried
  const handleTabChange = (value) => {
    setLineType(value);
    if (value === "multi_day") return;
    const p = paramsRef.current;
    if (p.StartTime && p.EndTime) runFetch(p, value);
    else setApiData(EMPTY);
  };

  // -- Auto-refresh -----------------------------------------------------------
  useEffect(() => {
    clearInterval(refreshRef.current);
    clearInterval(cdRef.current);
    if (!autoRefresh) return;
    setCountdown(300);
    cdRef.current = setInterval(
      () => setCountdown((c) => (c <= 1 ? 300 : c - 1)),
      1000,
    );
    refreshRef.current = setInterval(() => {
      const p = paramsRef.current;
      if (p.StartTime && p.EndTime && lineTypeRef.current !== "multi_day") {
        runFetch(p, lineTypeRef.current);
        setCountdown(300);
      }
    }, 300_000);
    return () => {
      clearInterval(refreshRef.current);
      clearInterval(cdRef.current);
    };
  }, [autoRefresh, runFetch]);

  // -- Stat cards + grand total -----------------------------------------------
  const { summaryCards, grandTotal } = useMemo(() => {
    const d = apiData;
    let cards = [];

    if (lineType === "final_line") {
      const frz = sumCount(d.finalFreezer);
      const choc = sumCount(d.finalChoc);
      const sus = sumCount(d.finalSUS);
      const visi = sumCount(d.visiFinal);
      cards = [
        { label: "Freezer", value: frz, color: "blue" },
        { label: "Choc", value: choc, color: "amber" },
        { label: "SUS", value: sus, color: "violet" },
        { label: "VISI", value: visi, color: "emerald" },
        {
          label: "Grand Total",
          value: frz + choc + sus + visi,
          highlight: true,
        },
      ];
    } else if (lineType === "final_loading") {
      const frz = sumCount(d.finalFreezerLoading);
      const choc = sumCount(d.finalChocLoading);
      const sus = sumCount(d.finalSUSLoading);
      const visi = sumCount(d.visiLoading);
      cards = [
        { label: "Frz Load", value: frz, color: "blue" },
        { label: "Choc Load", value: choc, color: "amber" },
        { label: "SUS Load", value: sus, color: "violet" },
        { label: "VISI Load", value: visi, color: "emerald" },
        {
          label: "Grand Total",
          value: frz + choc + sus + visi,
          highlight: true,
        },
      ];
    } else if (lineType === "post_Foaming") {
      const grpA = sumCount(d.postGrpA);
      const grpB = sumCount(d.postGrpB);
      const choc = sumCount(d.postChoc);
      const fow = sumCount(d.postFOW);
      const sus = sumCount(d.postSUS);
      const visi = sumCount(d.visiPost);
      cards = [
        { label: "Frz. Post Foaming Group A", value: grpA, color: "blue" },
        { label: "Frz. Post Foaming Group B", value: grpB, color: "violet" },
        { label: "CHOC Post Foaming", value: choc, color: "amber" },
        { label: "FOW Post Foaming", value: fow, color: "emerald" },
        { label: "SUS Post Foaming", value: sus, color: "blue" },
        { label: "VISI Cooler Post Foaming", value: visi, color: "violet" },
        {
          label: "Grand Total",
          value: grpA + grpB + choc + fow + sus + visi,
          highlight: true,
        },
      ];
    } else if (lineType === "Foaming") {
      const a = sumCount(d.foamA);
      const b = sumCount(d.foamB);
      cards = [
        { label: "Station A", value: a, color: "blue" },
        { label: "Station B", value: b, color: "amber" },
        { label: "Grand Total", value: a + b, highlight: true },
      ];
    }

    return {
      summaryCards: cards,
      grandTotal: cards.find((c) => c.highlight)?.value || 0,
    };
  }, [apiData, lineType]);

  // -- Insights ---------------------------------------------------------------
  const insights = useMemo(() => {
    if (!grandTotal) return null;
    const d = apiData;
    const hourMap = {};
    const addRows = (arr) => {
      for (const r of arr) {
        const h = r.TIMEHOUR ?? -1;
        if (h < 0) continue;
        hourMap[h] = (hourMap[h] || 0) + (r.COUNT || 0);
      }
    };

    if (lineType === "final_line") {
      [d.finalFreezer, d.finalChoc, d.finalSUS, d.visiFinal].forEach(addRows);
    }
    if (lineType === "final_loading") {
      [
        d.finalFreezerLoading,
        d.finalChocLoading,
        d.finalSUSLoading,
        d.visiLoading,
      ].forEach(addRows);
    }
    if (lineType === "post_Foaming") {
      [
        d.postGrpA,
        d.postGrpB,
        d.postChoc,
        d.postFOW,
        d.postSUS,
        d.visiPost,
      ].forEach(addRows);
    }
    if (lineType === "Foaming") {
      [d.foamA, d.foamB].forEach(addRows);
    }

    const hours = Object.entries(hourMap);
    if (!hours.length) return null;
    const avg = Math.round(grandTotal / hours.length);
    const peakEntry = hours.reduce((m, e) => (e[1] > m[1] ? e : m), hours[0]);
    let day = 0;
    for (const [h, v] of hours) {
      const n = Number(h);
      if (n >= 8 && n < 20) day += v;
    }
    const dayPct = grandTotal > 0 ? Math.round((day / grandTotal) * 100) : 0;
    return { avg, peakHour: peakEntry[0], peakCount: peakEntry[1], dayPct };
  }, [apiData, lineType, grandTotal]);

  // -- Export -----------------------------------------------------------------
  const exportAll = () => {
    const d = apiData;
    let rows = [];
    const hr = (arr, label) =>
      arr.map((r) => [
        label,
        r.HOUR_NUMBER || r.HourNumber || "—",
        `${r.TIMEHOUR ?? ""}:00`,
        r.COUNT || 0,
      ]);
    const cat = (arr, label) =>
      arr.map((r) => [label, "—", r.category, r.TotalCount || 0]);

    if (lineType === "final_line") {
      rows = [
        ...hr(d.finalFreezer, "Freezer"),
        ...hr(d.finalChoc, "Choc"),
        ...hr(d.finalSUS, "SUS"),
        ...hr(d.visiFinal, "VISI"),
        ...cat(d.finalCategory, "Category"),
      ];
    }
    if (lineType === "final_loading") {
      rows = [
        ...hr(d.finalFreezerLoading, "Frz Load"),
        ...hr(d.finalChocLoading, "Choc Load"),
        ...hr(d.finalSUSLoading, "SUS Load"),
        ...hr(d.visiLoading, "VISI Load"),
        ...cat(d.finalCategoryLoading, "Category"),
      ];
    }
    if (lineType === "post_Foaming") {
      rows = [
        ...hr(d.postGrpA, "Group A"),
        ...hr(d.postGrpB, "Group B"),
        ...hr(d.postChoc, "CHOC"),
        ...hr(d.postFOW, "FOW"),
        ...hr(d.postSUS, "Post SUS"),
        ...hr(d.visiPost, "VISI"),
        ...cat(d.postCategory, "Category"),
      ];
    }
    if (lineType === "Foaming") {
      rows = [
        ...hr(d.foamA, "Foam A"),
        ...hr(d.foamB, "Foam B"),
        ...cat(d.foamCategory, "Category"),
      ];
    }

    if (!rows.length) {
      toast.error("No data to export.");
      return;
    }
    const csv = [["Section", "Hour#", "Time/Category", "Count"], ...rows]
      .map((r) => r.join(","))
      .join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `LineHourly_${lineType}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // -- Widget configs ---------------------------------------------------------
  const widgetConfig = useMemo(() => {
    const d = apiData;
    const { sky, amber, slate, teal } = CHART;
    const categoryDataset = [{ key: "TotalCount", label: "Count", color: sky }];

    const configs = {
      final_line: [
        {
          title: "Freezer",
          data: d.finalFreezer,
          modelData: d.finalFreezerModel,
          datasets: [{ key: "COUNT", label: "Count", color: sky }],
        },
        {
          title: "Chocolate",
          data: d.finalChoc,
          modelData: d.finalChocModel,
          datasets: [{ key: "COUNT", label: "Count", color: amber }],
        },
        {
          title: "Visi Cooler",
          data: d.visiFinal,
          modelData: d.visiFinalModel,
          datasets: [{ key: "COUNT", label: "Count", color: teal }],
        },
        {
          title: "SUS",
          data: d.finalSUS,
          modelData: d.finalSUSModel,
          datasets: [{ key: "COUNT", label: "Count", color: slate }],
        },
        {
          title: CATEGORY_TITLE,
          data: d.finalCategory,
          modelData: [],
          datasets: categoryDataset,
          isCategoryChart: true,
        },
      ],

      final_loading: [
        {
          title: "Freezer",
          data: d.finalFreezerLoading,
          modelData: d.finalFreezerLoadingModel,
          datasets: [{ key: "COUNT", label: "Count", color: sky }],
        },
        {
          title: "Chocolate",
          data: d.finalChocLoading,
          modelData: d.finalChocLoadingModel,
          datasets: [{ key: "COUNT", label: "Count", color: amber }],
        },
        {
          title: "Visi Cooler",
          data: d.visiLoading,
          modelData: d.visiLoadingModel,
          datasets: [{ key: "COUNT", label: "Count", color: teal }],
        },
        {
          title: "SUS",
          data: d.finalSUSLoading,
          modelData: d.finalSUSLoadingModel,
          datasets: [{ key: "COUNT", label: "Count", color: slate }],
        },
        {
          title: CATEGORY_TITLE,
          data: d.finalCategoryLoading,
          modelData: [],
          datasets: categoryDataset,
          isCategoryChart: true,
        },
      ],

      post_Foaming: [
        {
          title: "Frz. Post Foaming Group A",
          data: d.postGrpA,
          modelData: d.postGrpAModel,
          datasets: [
            { key: "COUNT", label: "Frz. Post Foaming Group A", color: sky },
          ],
        },
        {
          title: "Frz. Post Foaming Group B",
          data: d.postGrpB,
          modelData: d.postGrpBModel,
          datasets: [
            { key: "COUNT", label: "Frz. Post Foaming Group B", color: slate },
          ],
        },
        {
          title: "FOW Post Foaming",
          data: d.postFOW,
          modelData: d.postFOWModel,
          datasets: [{ key: "COUNT", label: "FOW Post Foaming", color: teal }],
        },
        {
          title: "Chocolate Post Foaming",
          data: d.postChoc,
          modelData: d.postChocModel,
          datasets: [
            { key: "COUNT", label: "CHOC Post Foaming", color: amber },
          ],
        },
        {
          title: "Visi Cooler Post Foaming",
          data: d.visiPost,
          modelData: d.visiPostModel,
          datasets: [{ key: "COUNT", label: "Count", color: teal }],
        },
        {
          title: "SUS Post Foaming",
          data: d.postSUS,
          modelData: d.postSUSModel,
          datasets: [{ key: "COUNT", label: "Count", color: slate }],
        },
        {
          title: CATEGORY_TITLE,
          data: d.postCategory,
          modelData: [],
          datasets: categoryDataset,
          isCategoryChart: true,
        },
      ],

      Foaming: [
        {
          title: "Freezer Station A",
          data: d.foamA,
          modelData: d.foamAModel,
          datasets: [{ key: "COUNT", label: "Count", color: sky }],
        },
        {
          title: "Freezer Station B",
          data: d.foamB,
          modelData: d.foamBModel,
          datasets: [{ key: "COUNT", label: "Count", color: amber }],
        },
        {
          title: CATEGORY_TITLE,
          data: d.foamCategory,
          modelData: [],
          datasets: categoryDataset,
          isCategoryChart: true,
        },
      ],
    };

    return configs[lineType] || [];
  }, [apiData, lineType]);

  // -- Grid layout helpers ----------------------------------------------------
  const is5 = widgetConfig.length === 5; // final_line / final_loading
  const is7 = widgetConfig.length === 7; // post_Foaming

  const gridTemplateRows = is7
    ? `repeat(3, minmax(${WIDGET_MIN_H}px, auto))`
    : is5
      ? `repeat(2, minmax(${WIDGET_MIN_H}px, auto))`
      : `minmax(${WIDGET_MIN_H}px, auto)`;

  /**
   * is5 (3×2):             is7 (3×3):                       default (3×1):
   *  [0][1][2]              [0][1][2]                        [0][1][2]
   *  [3][4------]           [3][4][5]
   *                         [6----------------------]  Category
   */
  const getGridColumn = (i) => {
    if (is5 && i === 3) return "1";
    if (is5 && i === 4) return "2 / span 2";
    if (is7 && i === 6) return "1 / -1";
    return undefined;
  };

  const skeletonCount = is7 ? 7 : is5 ? 5 : 3;

  const cardColorMap = {
    blue: "bg-blue-50 border-blue-100 text-blue-700",
    amber: "bg-amber-50 border-amber-100 text-amber-700",
    violet: "bg-violet-50 border-violet-100 text-violet-700",
    emerald: "bg-emerald-50 border-emerald-100 text-emerald-700",
  };

  /* ----------------------------------------------------------
     RENDER
  ---------------------------------------------------------- */
  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      {/* -- PAGE HEADER — pinned at top -- */}
      <div className="shrink-0 z-20 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-tight">
            Line Hourly Report
          </h1>
          <p className="text-[11px] text-slate-400">
            Hourly production breakdown by line
          </p>
        </div>
        <div className="flex items-center gap-2">
          {insights && !isMultiDay && (
            <>
              <span className="flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full font-medium">
                <Zap className="w-3 h-3" /> Peak {insights.peakHour}:00 ·{" "}
                {insights.peakCount.toLocaleString()}
              </span>
              <span className="flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full font-medium">
                <Gauge className="w-3 h-3" /> {insights.avg.toLocaleString()}/hr
                avg
              </span>
              <span className="flex items-center gap-1 text-[11px] text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full font-medium">
                <Sun className="w-3 h-3 text-yellow-500" /> {insights.dayPct}%
                <Moon className="w-3 h-3 text-violet-500 ml-1" />{" "}
                {100 - insights.dayPct}%
              </span>
            </>
          )}
          {autoRefresh && !isMultiDay && (
            <span className="flex items-center gap-1 text-[11px] text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-full font-medium animate-pulse">
              <RefreshCw className="w-3 h-3" /> {countdown}s
            </span>
          )}
          {!isMultiDay && (
            <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-blue-50 border border-blue-100 min-w-22.5">
              <span className="text-xl font-bold font-mono text-blue-700">
                {grandTotal.toLocaleString()}
              </span>
              <span className="text-[10px] text-blue-500 font-medium uppercase tracking-wide">
                Grand Total
              </span>
            </div>
          )}
          {lastFetched && !isMultiDay && (
            <div className="flex flex-col items-center px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 min-w-20">
              <span className="text-[11px] font-mono text-slate-600 font-semibold">
                {lastFetched.toLocaleTimeString()}
              </span>
              <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">
                Last Fetch
              </span>
            </div>
          )}
        </div>
      </div>

      {/* -- SCROLLABLE BODY -- */}
      <div className="flex-1 overflow-y-auto flex flex-col p-4 gap-3">
        {/* -- TOOLBAR CARD -- */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 shrink-0">
          <div className="flex flex-wrap items-end gap-3">
            {!isMultiDay && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                    Start Time
                  </label>
                  <input
                    type="datetime-local"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-300 w-44"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                    End Time
                  </label>
                  <input
                    type="datetime-local"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-300 w-44"
                  />
                </div>
                <div className="flex items-center gap-2 pb-0.5">
                  <button
                    onClick={handleYesterday}
                    disabled={loading}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${loading ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-amber-500 hover:bg-amber-600 text-white shadow-sm"}`}
                  >
                    {loading ? (
                      <Spinner cls="w-4 h-4" />
                    ) : (
                      <History className="w-4 h-4" />
                    )}{" "}
                    Yesterday
                  </button>
                  <button
                    onClick={handleToday}
                    disabled={loading}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${loading ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"}`}
                  >
                    {loading ? (
                      <Spinner cls="w-4 h-4" />
                    ) : (
                      <Calendar className="w-4 h-4" />
                    )}{" "}
                    Today
                  </button>
                  <button
                    onClick={handleQuery}
                    disabled={loading}
                    className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${loading ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"}`}
                  >
                    {loading ? (
                      <Spinner cls="w-4 h-4" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                    {loading ? "Loading…" : "Query"}
                  </button>
                  <button
                    onClick={exportAll}
                    disabled={loading || !grandTotal}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all border ${loading || !grandTotal ? "bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed" : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600 cursor-pointer"}`}
                  >
                    <Download className="w-4 h-4" /> Export
                  </button>
                </div>
                <div className="w-px h-8 bg-slate-200 shrink-0" />
              </>
            )}

            {/* Line tabs */}
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
              {LINE_TABS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => handleTabChange(value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    lineType === value
                      ? value === "multi_day"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "bg-blue-600 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-700 hover:bg-white/70"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
            </div>

            {/* Auto-refresh toggle */}
            {!isMultiDay && (
              <div className="flex items-center gap-2 ml-auto shrink-0">
                <span className="text-[11px] font-semibold text-slate-500">
                  Auto refresh (5 min)
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={autoRefresh}
                  onClick={() => setAutoRefresh((v) => !v)}
                  className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${
                    autoRefresh ? "bg-blue-600" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      autoRefresh ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* -- MULTI-DAY PIVOT VIEW -- */}
        {isMultiDay && <MultiDayPivotView />}

        {/* -- NORMAL HOURLY VIEWS -- */}
        {!isMultiDay && (
          <>
            {/* Widget grid */}
            <div className="shrink-0">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gridTemplateRows,
                  gap: 10,
                }}
              >
                {loading
                  ? Array.from({ length: skeletonCount }).map((_, i) => (
                      <div
                        key={i}
                        className="bg-white rounded-xl border border-slate-200 animate-pulse overflow-hidden"
                        style={{
                          gridColumn: getGridColumn(i),
                          minHeight: WIDGET_MIN_H,
                        }}
                      >
                        <div className="h-9 bg-slate-50 border-b border-slate-100" />
                        <div className="p-3 space-y-2">
                          {[70, 85, 60, 75].map((w, j) => (
                            <div
                              key={j}
                              className="h-3 bg-slate-100 rounded"
                              style={{ width: `${w}%` }}
                            />
                          ))}
                        </div>
                      </div>
                    ))
                  : widgetConfig.map((wc, i) => (
                      <div
                        key={`${lineType}-${i}`}
                        style={{
                          gridColumn: getGridColumn(i),
                          minHeight: WIDGET_MIN_H,
                        }}
                      >
                        <HourlyWidget
                          title={wc.title}
                          data={wc.data}
                          modelData={wc.modelData}
                          datasets={wc.datasets}
                          isCategoryChart={!!wc.isCategoryChart}
                          icon={wc.icon}
                          elapsedHours={elapsedHours}
                        />
                      </div>
                    ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default LineHourlyReport;
