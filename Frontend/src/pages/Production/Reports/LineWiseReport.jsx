import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
} from "chart.js";
import axios from "axios";
import toast from "react-hot-toast";
import { baseURL } from "../../../assets/assets.js";
import HourlyWidget from "../../../components/lineHourly/HourlyWidget.jsx";
import {
  Factory,
  Settings,
  Search,
  Download,
  Calendar,
  History,
  Gauge,
  Loader2,
  RefreshCw,
  Zap,
  Eye,
  Layers,
  Thermometer,
} from "lucide-react";

ChartJS.register(
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
);

const normaliseDateTime = (dt) => (dt ? dt.replace("T", " ") : "");
const pad = (n) => String(n).padStart(2, "0");
const formatDate = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

const CHART = {
  sky: "rgba(14,165,233,0.72)",
  amber: "rgba(245,158,11,0.72)",
  slate: "rgba(100,116,139,0.65)",
  teal: "rgba(20,184,166,0.70)",
  violet: "rgba(139,92,246,0.70)",
};

const ROW_H = 18;
const WIDGET_CHROME = 120;
const MAX_VISIBLE_ROWS = 13;
const WIDGET_MIN_H = WIDGET_CHROME + ROW_H * MAX_VISIBLE_ROWS;

const Spinner = ({ cls = "w-4 h-4" }) => (
  <Loader2 className={`animate-spin ${cls}`} />
);

const LINE_TABS = [
  { value: "freezer", label: "Freezer", icon: Thermometer },
  { value: "choc", label: "Chocolate", icon: Layers },
  { value: "visi", label: "VISI", icon: Eye },
  { value: "sus", label: "SUS", icon: Settings },
];

const ENDPOINTS = {
  freezer: [
    "line-hourly-report/final-fg/freezer",
    "final-hp-frz-model",
    "line-hourly-report/final-loading/freezer",
    "final-loading-hp-frz-model",
    "line-hourly-report/post-foaming/group-a-freezer",
    "line-hourly-report/post-foaming/group-b-freezer",
    "line-hourly-report/post-foaming/freezer-fow",
    "post-Grp-A-model",
    "post-Grp-B-model",
    "post-FOW-model",
    "line-hourly-report/foaming/group-a-freezer",
    "line-hourly-report/foaming/group-b-freezer",
    "Foaming-hp-fom-a-model",
    "Foaming-hp-fom-b-model",
  ],
  choc: [
    "line-hourly-report/final-fg/chocolate",
    "final-hp-choc-model",
    "line-hourly-report/final-loading/chocolate",
    "final-loading-hp-choc-model",
    "line-hourly-report/post-foaming/chocolate",
    "post-Choc-model",
  ],
  visi: [
    "line-hourly-report/final-fg/visi-cooler",
    "visi-final-hp-model",
    "line-hourly-report/final-loading/visi-cooler",
    "final-loading-hp-visi-model",
    "line-hourly-report/post-foaming/visi-cooler",
    "visi-post-hp-model",
  ],
  sus: [
    "line-hourly-report/final-fg/sus",
    "final-hp-sus-model",
    "line-hourly-report/final-loading/sus",
    "final-loading-hp-sus-model",
    "line-hourly-report/post-foaming/sus",
    "post-hp-sus-model",
  ],
};

const cnt = (arr) =>
  (Array.isArray(arr) ? arr : []).reduce((s, r) => s + (r.COUNT || 0), 0);

function buildLineData(line, raw) {
  const { sky, amber, slate, teal, violet } = CHART;

  if (line === "freezer") {
    const [
      frz,
      frzM,
      frzL,
      frzLM,
      grpA,
      grpB,
      fow,
      grpAM,
      grpBM,
      fowM,
      fomA,
      fomB,
      fomAM,
      fomBM,
    ] = raw;
    const widgets = [
      {
        title: "Freezer Final",
        data: frz,
        modelData: frzM,
        datasets: [{ key: "COUNT", label: "Count", color: sky }],
      },
      {
        title: "Freezer Loading",
        data: frzL,
        modelData: frzLM,
        datasets: [{ key: "COUNT", label: "Count", color: sky }],
      },
      {
        title: "Post Foaming Group A",
        data: grpA,
        modelData: grpAM,
        datasets: [{ key: "COUNT", label: "Count", color: sky }],
      },
      {
        title: "Post Foaming Group B",
        data: grpB,
        modelData: grpBM,
        datasets: [{ key: "COUNT", label: "Count", color: slate }],
      },
      {
        title: "Foaming Station A",
        data: fomA,
        modelData: fomAM,
        datasets: [{ key: "COUNT", label: "Count", color: sky }],
      },
      {
        title: "Foaming Station B",
        data: fomB,
        modelData: fomBM,
        datasets: [{ key: "COUNT", label: "Count", color: amber }],
      },
      {
        title: "FOW Post Foaming",
        data: fow,
        modelData: fowM,
        datasets: [{ key: "COUNT", label: "Count", color: teal }],
      },
    ];

    const final = cnt(frz),
      loading = cnt(frzL);
    const postFoam = cnt(grpA) + cnt(grpB) + cnt(fow);
    const foaming = cnt(fomA) + cnt(fomB);
    const grand = final + loading + postFoam + foaming;
    const summaryCards = [
      { label: "Final", value: final, color: "blue" },
      { label: "Loading", value: loading, color: "blue" },
      { label: "Post Foaming", value: postFoam, color: "violet" },
      { label: "Foaming", value: foaming, color: "amber" },
      { label: "Grand Total", value: grand, highlight: true },
    ];
    return { widgets, summaryCards, grandTotal: grand };
  }

  if (line === "choc") {
    const [fin, finM, load, loadM, post, postM] = raw;
    const widgets = [
      {
        title: "Chocolate Final",
        data: fin,
        modelData: finM,
        datasets: [{ key: "COUNT", label: "Count", color: amber }],
      },
      {
        title: "Chocolate Loading",
        data: load,
        modelData: loadM,
        datasets: [{ key: "COUNT", label: "Count", color: amber }],
      },
      {
        title: "Chocolate Post Foaming",
        data: post,
        modelData: postM,
        datasets: [{ key: "COUNT", label: "Count", color: amber }],
      },
    ];
    const final = cnt(fin),
      loading = cnt(load),
      postFoam = cnt(post);
    const grand = final + loading + postFoam;
    const summaryCards = [
      { label: "Final", value: final, color: "amber" },
      { label: "Loading", value: loading, color: "amber" },
      { label: "Post Foaming", value: postFoam, color: "amber" },
      { label: "Grand Total", value: grand, highlight: true },
    ];
    return { widgets, summaryCards, grandTotal: grand };
  }

  if (line === "sus") {
    const [fin, finM, load, loadM, post, postM] = raw;
    const widgets = [
      {
        title: "SUS Final",
        data: fin,
        modelData: finM,
        datasets: [{ key: "COUNT", label: "Count", color: violet }],
      },
      {
        title: "SUS Loading",
        data: load,
        modelData: loadM,
        datasets: [{ key: "COUNT", label: "Count", color: violet }],
      },
      {
        title: "SUS Post Foaming",
        data: post,
        modelData: postM,
        datasets: [{ key: "COUNT", label: "Count", color: violet }],
      },
    ];
    const final = cnt(fin),
      loading = cnt(load),
      postFoam = cnt(post);
    const grand = final + loading + postFoam;
    const summaryCards = [
      { label: "Final", value: final, color: "violet" },
      { label: "Loading", value: loading, color: "violet" },
      { label: "Post Foaming", value: postFoam, color: "violet" },
      { label: "Grand Total", value: grand, highlight: true },
    ];
    return { widgets, summaryCards, grandTotal: grand };
  }

  if (line === "visi") {
    const [fin, finM, load, loadM, post, postM] = raw;
    const widgets = [
      {
        title: "Visi Final",
        data: fin,
        modelData: finM,
        datasets: [{ key: "COUNT", label: "Count", color: teal }],
      },
      {
        title: "Visi Loading",
        data: load,
        modelData: loadM,
        datasets: [{ key: "COUNT", label: "Count", color: teal }],
      },
      {
        title: "Visi Post Foaming",
        data: post,
        modelData: postM,
        datasets: [{ key: "COUNT", label: "Count", color: teal }],
      },
    ];
    const final = cnt(fin),
      loading = cnt(load),
      postFoam = cnt(post);
    const grand = final + loading + postFoam;
    const summaryCards = [
      { label: "Final", value: final, color: "emerald" },
      { label: "Loading", value: loading, color: "emerald" },
      { label: "Post Foaming", value: postFoam, color: "emerald" },
      { label: "Grand Total", value: grand, highlight: true },
    ];
    return { widgets, summaryCards, grandTotal: grand };
  }

  return { widgets: [], summaryCards: [], grandTotal: 0 };
}

const ACCENT_ACTIVE = {
  freezer: "bg-blue-600 text-white shadow-sm",
  choc: "bg-amber-500 text-white shadow-sm",
  sus: "bg-violet-600 text-white shadow-sm",
  visi: "bg-emerald-600 text-white shadow-sm",
};

// ─── Main ──────────────────────────────────────────────────────────────────────
const LineWiseReport = () => {
  const [loading, setLoading] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [line, setLine] = useState("freezer");
  const [rawData, setRawData] = useState([]);
  const [lastFetched, setLastFetched] = useState(null);
  const [countdown, setCountdown] = useState(300);

  const refreshRef = useRef(null);
  const cdRef = useRef(null);
  const paramsRef = useRef({ StartTime: "", EndTime: "" });
  const lineRef = useRef(line);
  useEffect(() => {
    lineRef.current = line;
  }, [line]);

  const API = `${baseURL}prod`;

  const fetchLine = useCallback(
    async (params, ln) => {
      const endpoints = ENDPOINTS[ln] || [];
      const settled = await Promise.allSettled(
        endpoints.map((path) => axios.get(`${API}/${path}`, { params })),
      );
      return settled.map((r) =>
        r.status === "fulfilled" && r.value?.data?.success
          ? r.value.data.data || []
          : [],
      );
    },
    [API],
  );

  const runFetch = useCallback(
    async (params, ln) => {
      setLoading(true);
      setRawData([]);
      try {
        const data = await fetchLine(params, ln);
        setRawData(data);
        setLastFetched(new Date());
      } catch (err) {
        console.error(err);
        toast.error("Failed to fetch data.");
      } finally {
        setLoading(false);
      }
    },
    [fetchLine],
  );

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
    runFetch(p, line);
  };

  const handleToday = () => {
    const now = new Date(),
      s = new Date(now);
    s.setHours(8, 0, 0, 0);
    const p = { StartTime: formatDate(s), EndTime: formatDate(now) };
    paramsRef.current = p;
    runFetch(p, line);
  };

  const handleYesterday = () => {
    const e = new Date();
    e.setHours(8, 0, 0, 0);
    const s = new Date(e);
    s.setDate(s.getDate() - 1);
    const p = { StartTime: formatDate(s), EndTime: formatDate(e) };
    paramsRef.current = p;
    runFetch(p, line);
  };

  const handleLineChange = (newLine) => {
    setLine(newLine);
    setRawData([]);
    const p = paramsRef.current;
    if (p.StartTime && p.EndTime) runFetch(p, newLine);
  };

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
      if (p.StartTime && p.EndTime) {
        runFetch(p, lineRef.current);
        setCountdown(300);
      }
    }, 300_000);
    return () => {
      clearInterval(refreshRef.current);
      clearInterval(cdRef.current);
    };
  }, [autoRefresh, runFetch]);

  const {
    widgets: widgetConfig,
    summaryCards,
    grandTotal,
  } = useMemo(() => buildLineData(line, rawData), [line, rawData]);

  const insights = useMemo(() => {
    if (!grandTotal) return null;
    const hourMap = {};
    widgetConfig;
    widgetConfig.forEach((w) => {
      w.data.forEach((r) => {
        const h = r.TIMEHOUR ?? -1;
        if (h >= 0) hourMap[h] = (hourMap[h] || 0) + (r.COUNT || 0);
      });
    });
    const hours = Object.entries(hourMap);
    if (!hours.length) return null;
    const avg = Math.round(grandTotal / hours.length);
    const peak = hours.reduce((m, e) => (e[1] > m[1] ? e : m), hours[0]);
    return { avg, peakHour: peak[0], peakCount: peak[1] };
  }, [widgetConfig, grandTotal]);

  const exportAll = () => {
    if (!grandTotal) {
      toast.error("No data to export.");
      return;
    }

    const rows = widgetConfig.flatMap((wc) =>
      wc.data.map((r) => [
        wc.title,
        r.HOUR_NUMBER || "—",
        `${r.TIMEHOUR ?? ""}:00`,
        r.COUNT || 0,
      ]),
    );

    const csv = [["Widget", "Hour#", "Time", "Count"], ...rows]
      .map((r) => r.join(","))
      .join("\n");

    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `LineWise_${line}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const n = widgetConfig.length;
  const nSkeleton = n === 7 ? 7 : n === 3 ? 3 : 3;

  const getGridCol = () => undefined;

  const gridRows = `repeat(${Math.ceil(n / 3)}, minmax(${WIDGET_MIN_H}px, auto))`;

  /* ── RENDER ── */
  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      {/* ── PAGE HEADER ── */}
      <div className="shrink-0 z-20 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-tight">
            Line Wise Report
          </h1>
          <p className="text-[11px] text-slate-400">
            Production output and performance breakdown for each line
          </p>
        </div>
        <div className="flex items-center gap-2">
          {insights && (
            <>
              <span className="flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full font-medium">
                <Zap className="w-3 h-3" /> Peak {insights.peakHour}:00 ·{" "}
                {insights.peakCount.toLocaleString()}
              </span>
              <span className="flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full font-medium">
                <Gauge className="w-3 h-3" /> {insights.avg.toLocaleString()}/hr
                avg
              </span>
            </>
          )}
          {autoRefresh && (
            <span className="flex items-center gap-1 text-[11px] text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-full font-medium animate-pulse">
              <RefreshCw className="w-3 h-3" /> {countdown}s
            </span>
          )}
          <div className="flex flex-col items-center px-4 py-1.5 rounded-lg bg-blue-50 border border-blue-100 min-w-22.5">
            <span className="text-xl font-bold font-mono text-blue-700">
              {grandTotal.toLocaleString()}
            </span>
            <span className="text-[10px] text-blue-500 font-medium uppercase tracking-wide">
              Grand Total
            </span>
          </div>
          {lastFetched && (
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

      {/* ── SCROLLABLE BODY ── */}
      <div className="flex-1 overflow-y-auto flex flex-col p-4 gap-3">
        {/* Toolbar card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 shrink-0">
          <div className="flex flex-wrap items-end gap-3">
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
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all border ${loading || !grandTotal ? "bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed" : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600"}`}
              >
                <Download className="w-4 h-4" /> Export
              </button>
            </div>
            <div className="w-px h-8 bg-slate-200 shrink-0" />

            {/* Line tabs */}
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
              {LINE_TABS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => handleLineChange(value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    line === value
                      ? ACCENT_ACTIVE[value]
                      : "text-slate-500 hover:text-slate-700 hover:bg-white/70"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
            </div>

            {/* Auto-refresh toggle */}
            <div className="flex items-center gap-2 ml-auto shrink-0">
              <span className="text-xs text-slate-500">Auto</span>
              <button
                onClick={() => setAutoRefresh((v) => !v)}
                className={`relative w-9 h-5 rounded-full transition-colors ${autoRefresh ? "bg-blue-500" : "bg-slate-200"}`}
              >
                <div
                  className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${autoRefresh ? "translate-x-4" : "translate-x-0"}`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Widget grid */}
        <div className="shrink-0">
          {loading ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gridTemplateRows: gridRows,
                gap: 10,
              }}
            >
              {Array.from({ length: nSkeleton }).map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl border border-slate-200 animate-pulse overflow-hidden"
                  style={{ minHeight: WIDGET_MIN_H }}
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
              ))}
            </div>
          ) : widgetConfig.length > 0 ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gridTemplateRows: gridRows,
                gap: 10,
              }}
            >
              {widgetConfig.map((wc, i) => (
                <div
                  key={i}
                  style={{ gridColumn: getGridCol(i), minHeight: WIDGET_MIN_H }}
                >
                  <HourlyWidget
                    title={wc.title}
                    data={wc.data}
                    modelData={wc.modelData}
                    datasets={wc.datasets}
                    isCategoryChart={!!wc.isCategoryChart}
                    maxVisibleRows={MAX_VISIBLE_ROWS}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 py-20 bg-white rounded-xl border border-dashed border-slate-300">
              <Factory className="w-10 h-10 text-slate-200" />
              <p className="text-sm font-semibold text-slate-400">
                Select a line and query to view data
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LineWiseReport;
