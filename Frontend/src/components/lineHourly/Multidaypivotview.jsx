import React from "react";
import { useState, useMemo, useCallback } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import {
  FiTrendingUp,
  FiActivity,
  FiAward,
  FiSearch,
  FiRefreshCw,
  FiArrowUp,
  FiArrowDown,
  FiTarget,
  FiCalendar,
  FiClock,
  FiDownload,
  FiBarChart2,
  FiStar,
  FiAlertTriangle,
  FiChevronUp,
  FiChevronDown,
  FiFilter,
  FiX,
  FiCheckCircle,
  FiInfo,
  FiChevronRight,
  FiTrendingDown,
} from "react-icons/fi";
import { HiOutlineFire, HiOutlineLightningBolt } from "react-icons/hi";
import { MdCompare, MdInsights, MdOutlineSpeed } from "react-icons/md";
import { TbRadar, TbLayoutDashboard, TbReportAnalytics } from "react-icons/tb";
import { BsGraphUp, BsTable } from "react-icons/bs";
import axios from "axios";
import { baseURL } from "../../assets/assets.js";

// ---------------------------------------------------------------------------
//  Production line → stage → station mapping
// ---------------------------------------------------------------------------
const LINE_STAGE_MAPPING = {
  "Freezer Line": {
    "FG Label": { stationCodes: [1220010], linecodes: [12501] },
    MFT: { stationCodes: [1220014], linecodes: [12501] },
    EST: { stationCodes: [1220008], linecodes: [12501] },
    "Gas Charging": { stationCodes: [1220011], linecodes: [12501] },
    "Comp Scan": { stationCodes: [1220005], linecodes: [12501] },
    "Post Foaming": {
      stationCodes: [1220003, 1220004],
      linecodes: [12301, 12302],
    },
    Foaming: { stationCodes: [1220001, 1220002], linecodes: [12301, 12302] },
  },
  "Chocolate Line": {
    "FG Label": { stationCodes: [1220010], linecodes: [12305] },
    "Comp Scan": { stationCodes: [1220005], linecodes: [12305] },
    "Post Foaming": { stationCodes: [1230007], linecodes: [12305] },
  },
  "VISI Cooler Line": {
    "FG Label": { stationCodes: [1220010], linecodes: [12605] },
    "Comp Scan": { stationCodes: [1220005], linecodes: [12605] },
    "Post Foaming": { stationCodes: [1230012], linecodes: [12605] },
  },
  "SUS Line": {
    "FG Label": { stationCodes: [1230017], linecodes: [12304] },
    "Comp Scan 1": { stationCodes: [1230013], linecodes: [12304] },
    "Post Foaming": { stationCodes: [1230012], linecodes: [12304] },
  },
};

// Production day 08:00 → next day 08:00 (shift 1: 08–20, shift 2: 20–08)
const ALL_HOURS = Array.from({ length: 24 }, (_, i) => (i + 8) % 24);

const DAY_COLORS = [
  "#4f46e5",
  "#0891b2",
  "#059669",
  "#d97706",
  "#db2777",
  "#7c3aed",
  "#0284c7",
  "#16a34a",
  "#ea580c",
  "#9333ea",
];

const VIEWS = [
  { id: "pivot", label: "Pivot Table", Icon: BsTable },
  { id: "trend", label: "Trend", Icon: FiTrendingUp },
  { id: "compare", label: "Compare", Icon: MdCompare },
  { id: "insights", label: "Insights", Icon: MdInsights },
  { id: "report", label: "Report", Icon: TbReportAnalytics },
];

const FIXED_TARGETS = {
  "Freezer Line": { "FG Label": 87 },
  "Chocolate Line": { "FG Label": 40 },
  "SUS Line": { "FG Label": 15 },
  "VISI Line": { "FG Label": 75 },
};
const LOADING_STAGE_KEYS = [
  "MFT",
  "EST",
  "Gas Charging",
  "Comp Scan",
  "Comp Scan 1",
  "Post Foaming",
  "Foaming",
];

function getFixedTarget(line, stage) {
  if (FIXED_TARGETS[line]?.[stage] !== undefined)
    return FIXED_TARGETS[line][stage];
  const base = FIXED_TARGETS[line]?.["FG Label"];
  if (base !== undefined && LOADING_STAGE_KEYS.includes(stage)) return base + 5;
  return null;
}

// ---------------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------------
const fmt = (h) => `${String(h).padStart(2, "0")}:00`;
const fmtN = (n) => (n ?? 0).toLocaleString();
const pad2 = (n) => String(n).padStart(2, "0");
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function getHeatStyle(val, max) {
  if (!val || !max) return { background: "transparent" };
  const r = clamp(val / max, 0, 1);
  const alpha = (0.08 + r * 0.62).toFixed(2);
  return {
    background: `rgba(79,70,229,${alpha})`,
    color: r > 0.55 ? "#fff" : r > 0.25 ? "#312e81" : "#64748b",
    fontWeight: r > 0.4 ? 700 : 500,
    borderRadius: 6,
  };
}

function perfBadge(score) {
  if (score >= 90)
    return {
      label: "Excellent",
      color: "#059669",
      bg: "#d1fae5",
      border: "#6ee7b7",
    };
  if (score >= 75)
    return {
      label: "Good",
      color: "#0891b2",
      bg: "#e0f2fe",
      border: "#7dd3fc",
    };
  if (score >= 50)
    return {
      label: "Fair",
      color: "#d97706",
      bg: "#fef3c7",
      border: "#fcd34d",
    };
  return { label: "Low", color: "#dc2626", bg: "#fee2e2", border: "#fca5a5" };
}

// Coefficient of variation (%) of a day's non-zero hourly values
function dayCV(vals) {
  const mean = vals.reduce((s, v) => s + v, 0) / (vals.length || 1);
  const std = Math.sqrt(
    vals.reduce((s, v) => s + (v - mean) ** 2, 0) / (vals.length || 1),
  );
  return mean ? Math.round((std / mean) * 100) : 0;
}

const S = {
  card: {
    background: "#fff",
    borderRadius: 16,
    border: "1px solid #e4e7ec",
    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
  },
};

const labelStyle = {
  fontSize: 10,
  fontWeight: 700,
  color: "#94a3b8",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

const cardTitle = { fontSize: 12, fontWeight: 700, color: "#334155" };

// ---------------------------------------------------------------------------
//  Tooltip
// ---------------------------------------------------------------------------
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "#1e2530",
        borderRadius: 10,
        padding: "10px 14px",
        fontSize: 12,
        boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
      }}
    >
      <div style={{ fontWeight: 700, color: "#f8fafc", marginBottom: 6 }}>
        {label}
      </div>
      {payload.map((p, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            color: "#94a3b8",
            marginBottom: 2,
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: 2,
              background: p.color,
            }}
          />
          <span style={{ fontSize: 11 }}>{p.name}:</span>
          <span style={{ fontWeight: 700, color: "#f8fafc" }}>
            {fmtN(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------------
//  KPI Card
// ---------------------------------------------------------------------------
const KPICard = ({
  icon: Icon,
  label,
  value,
  sub,
  color = "#4f46e5",
  trend,
}) => (
  <div
    style={{
      ...S.card,
      padding: "14px 18px",
      flex: 1,
      minWidth: 110,
      position: "relative",
      overflow: "hidden",
    }}
  >
    <div
      style={{
        position: "absolute",
        top: -10,
        right: -10,
        width: 60,
        height: 60,
        borderRadius: "50%",
        background: color,
        opacity: 0.06,
      }}
    />
    <div
      style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          background: `${color}15`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={13} color={color} />
      </div>
      <span style={labelStyle}>{label}</span>
    </div>
    <div
      style={{
        fontSize: 22,
        fontWeight: 800,
        color: "#0f172a",
        fontVariantNumeric: "tabular-nums",
        lineHeight: 1,
      }}
    >
      {value}
    </div>
    {sub && (
      <div
        style={{
          fontSize: 10,
          color: "#94a3b8",
          marginTop: 4,
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        {trend === "up" && <FiArrowUp size={9} color="#059669" />}
        {trend === "down" && <FiArrowDown size={9} color="#dc2626" />}
        {sub}
      </div>
    )}
  </div>
);

// ---------------------------------------------------------------------------
//  MiniHourChart
// ---------------------------------------------------------------------------
const MiniHourChart = ({ hours, data, target, showTarget, maxVal, color }) => {
  const chartData = hours.map((h) => ({
    hour: fmt(h),
    val: data[h] || 0,
    target,
  }));
  return (
    <div
      style={{
        padding: "10px 0 4px",
        background: "#fafbff",
        borderTop: "1px dashed #e0e7ff",
      }}
    >
      <ResponsiveContainer width="100%" height={90}>
        <BarChart
          data={chartData}
          margin={{ top: 6, right: 16, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="2 3"
            stroke="#f0f0ff"
            vertical={false}
          />
          <XAxis
            dataKey="hour"
            tick={{ fontSize: 9, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 9, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
            domain={[0, maxVal]}
            width={28}
          />
          {showTarget && (
            <ReferenceLine y={target} stroke="#f59e0b" strokeDasharray="3 3" />
          )}
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="val" name="Units" radius={[3, 3, 0, 0]}>
            {chartData.map((d, i) => (
              <Cell
                key={i}
                fill={
                  showTarget && d.val > 0 && d.val < target ? "#fca5a5" : color
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// ---------------------------------------------------------------------------
//  HourDrillPanel
// ---------------------------------------------------------------------------
const HourDrillPanel = ({ hour, dates, data, maxColVal, onClose }) => {
  const items = dates
    .map((d) => ({ date: d, val: data[d]?.[hour] || 0 }))
    .sort((a, b) => b.val - a.val);
  return (
    <div
      style={{
        ...S.card,
        padding: 16,
        marginBottom: 10,
        border: "2px solid #e0e7ff",
        animation: "fadeIn 0.2s ease",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "#eef2ff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <FiClock size={14} color="#4f46e5" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
              Hour {fmt(hour)} — Day Breakdown
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>
              Output ranked by day
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            border: "none",
            background: "#f1f5f9",
            borderRadius: 8,
            padding: "5px 8px",
            cursor: "pointer",
            color: "#64748b",
          }}
        >
          <FiX size={13} />
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {items.map((it, i) => {
          const w = Math.round((it.val / (maxColVal || 1)) * 100);
          return (
            <div
              key={it.date}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "6px 8px",
                borderRadius: 8,
                background: i === 0 ? "#eef2ff" : "#f8fafc",
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: i === 0 ? "#4f46e5" : "#cbd5e1",
                  minWidth: 18,
                  textAlign: "center",
                }}
              >
                #{i + 1}
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#334155",
                  minWidth: 90,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {it.date}
              </span>
              <div
                style={{
                  flex: 1,
                  height: 7,
                  background: "#f1f5f9",
                  borderRadius: 4,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${w}%`,
                    height: "100%",
                    background: i === 0 ? "#4f46e5" : "#a5b4fc",
                    borderRadius: 4,
                    transition: "width 0.5s",
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: "#312e81",
                  minWidth: 48,
                  textAlign: "right",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {it.val > 0 ? (
                  fmtN(it.val)
                ) : (
                  <span style={{ color: "#cbd5e1", fontSize: 10 }}>—</span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ===========================================================================
//  Main Component
// ===========================================================================
export default function MultiDayPivotView() {
  // -- Production state -------------------------------------------------------
  const [line, setLine] = useState("Freezer Line");
  const [stage, setStage] = useState("FG Label");
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  });
  const [to, setTo] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  });
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({});
  const [error, setError] = useState(null);

  // -- UI state ---------------------------------------------------------------
  const [view, setView] = useState("pivot");
  const [hlCol, setHlCol] = useState(null);
  const [target, setTarget] = useState(50);
  const [showTgt, setShowTgt] = useState(false);
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedDay, setExpandedDay] = useState(null);
  const [expandedHour, setExpandedHour] = useState(null);
  const [filterOpen, setFilterOpen] = useState(true);
  const [highlightBest, setHighlightBest] = useState(true);
  const [showAvgRow, setShowAvgRow] = useState(true);
  const [groupByWeek, setGroupByWeek] = useState(false);

  const stageOpts = useMemo(
    () =>
      LINE_STAGE_MAPPING[line] ? Object.keys(LINE_STAGE_MAPPING[line]) : [],
    [line],
  );
  const fixedTarget = useMemo(() => getFixedTarget(line, stage), [line, stage]);
  const effectiveTarget = fixedTarget ?? target;

  // ===========================================================================
  //  Production derived
  // ===========================================================================
  const sortedDates = useMemo(
    () => [...Object.keys(data)].sort((a, b) => a.localeCompare(b)),
    [data],
  );
  const dates = useMemo(
    () => (sortAsc ? [...sortedDates] : [...sortedDates].reverse()),
    [sortedDates, sortAsc],
  );

  const activeHours = useMemo(() => {
    const s = new Set();
    Object.values(data).forEach((d) =>
      Object.keys(d).forEach((h) => s.add(Number(h))),
    );
    return ALL_HOURS.filter((h) => s.has(h));
  }, [data]);

  const rowTotals = useMemo(() => {
    const t = {};
    dates.forEach((d) => {
      t[d] = activeHours.reduce((s, h) => s + (data[d]?.[h] || 0), 0);
    });
    return t;
  }, [data, dates, activeHours]);

  const colTotals = useMemo(() => {
    const t = {};
    activeHours.forEach((h) => {
      t[h] = dates.reduce((s, d) => s + (data[d]?.[h] || 0), 0);
    });
    return t;
  }, [data, dates, activeHours]);

  const colAvgs = useMemo(() => {
    const a = {};
    activeHours.forEach((h) => {
      const n = dates.filter((d) => (data[d]?.[h] || 0) > 0).length || 1;
      a[h] = Math.round((colTotals[h] || 0) / n);
    });
    return a;
  }, [colTotals, activeHours, dates, data]);

  const grandTotal = useMemo(
    () => Object.values(rowTotals).reduce((s, v) => s + v, 0),
    [rowTotals],
  );

  const avgUPH = useMemo(() => {
    const a = {};
    dates.forEach((d) => {
      const n = activeHours.filter((h) => (data[d]?.[h] || 0) > 0).length || 1;
      a[d] = Math.round(rowTotals[d] / n);
    });
    return a;
  }, [data, dates, activeHours, rowTotals]);

  const overallAvg = useMemo(() => {
    const v = Object.values(avgUPH);
    return Math.round(v.reduce((s, x) => s + x, 0) / (v.length || 1));
  }, [avgUPH]);

  const maxVal = useMemo(() => {
    let m = 0;
    dates.forEach((d) =>
      activeHours.forEach((h) => {
        if ((data[d]?.[h] || 0) > m) m = data[d][h];
      }),
    );
    return m || 1;
  }, [data, dates, activeHours]);

  const bestDay = useMemo(
    () =>
      dates.reduce(
        (b, d) => (rowTotals[d] > (rowTotals[b] || 0) ? d : b),
        dates[0],
      ),
    [dates, rowTotals],
  );
  const worstDay = useMemo(
    () =>
      dates.reduce(
        (b, d) => (rowTotals[d] < (rowTotals[b] ?? Infinity) ? d : b),
        dates[0],
      ),
    [dates, rowTotals],
  );
  const bestHour = useMemo(
    () =>
      activeHours.reduce(
        (b, h) => (colTotals[h] > (colTotals[b] || 0) ? h : b),
        activeHours[0],
      ),
    [activeHours, colTotals],
  );
  const topDays = useMemo(
    () => [...dates].sort((a, b) => rowTotals[b] - rowTotals[a]).slice(0, 3),
    [dates, rowTotals],
  );

  const slotTotals = useMemo(() => {
    const s = { morning: 0, midday: 0, afternoon: 0 };
    dates.forEach((d) =>
      activeHours.forEach((h) => {
        const v = data[d]?.[h] || 0;
        if (h <= 11) s.morning += v;
        else if (h <= 14) s.midday += v;
        else s.afternoon += v;
      }),
    );
    return s;
  }, [data, dates, activeHours]);

  const trend = useMemo(() => {
    if (sortedDates.length < 2) return null;
    const mid = Math.floor(sortedDates.length / 2);
    const a = sortedDates.slice(0, mid).reduce((s, d) => s + rowTotals[d], 0);
    const b = sortedDates.slice(mid).reduce((s, d) => s + rowTotals[d], 0);
    if (!a) return null;
    return { pct: Math.round(((b - a) / a) * 100), up: b >= a };
  }, [sortedDates, rowTotals]);

  const belowTarget = useMemo(() => {
    const res = [];
    dates.forEach((d) =>
      activeHours.forEach((h) => {
        const v = data[d]?.[h] || 0;
        if (v > 0 && v < effectiveTarget)
          res.push({ date: d, hour: h, val: v });
      }),
    );
    return res;
  }, [data, dates, activeHours, effectiveTarget]);

  const perfScore = useCallback(
    (d) => {
      const u = avgUPH[d] || 0;
      const vs_target = clamp(pct(u, effectiveTarget), 0, 120);
      const vs_avg = clamp(pct(u, overallAvg || 1), 0, 120);
      return Math.round(vs_target * 0.6 + vs_avg * 0.4);
    },
    [avgUPH, effectiveTarget, overallAvg],
  );

  // Dates are keyed as DD-MM-YYYY
  const getWeekKey = useCallback((dateStr) => {
    const [d, m, y] = dateStr.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    const jan1 = new Date(y, 0, 1);
    const weekNum = Math.ceil(((dt - jan1) / 86400000 + jan1.getDay() + 1) / 7);
    return `Week ${weekNum}, ${y}`;
  }, []);

  // ===========================================================================
  //  Chart payloads
  // ===========================================================================
  const dailyCD = useMemo(
    () =>
      sortedDates.map((d) => ({
        date: d.slice(0, 5),
        total: rowTotals[d],
        avg: avgUPH[d],
        target: effectiveTarget,
      })),
    [sortedDates, rowTotals, avgUPH, effectiveTarget],
  );

  const hourlyCD = useMemo(
    () =>
      activeHours.map((h) => {
        const r = { hour: fmt(h) };
        sortedDates.forEach((d) => {
          r[d.slice(0, 5)] = data[d]?.[h] || 0;
        });
        return r;
      }),
    [activeHours, sortedDates, data],
  );

  const colCD = useMemo(
    () =>
      activeHours.map((h) => ({
        hour: fmt(h),
        total: colTotals[h] || 0,
        avg: colAvgs[h] || 0,
      })),
    [activeHours, colTotals, colAvgs],
  );

  const radarD = useMemo(
    () =>
      sortedDates
        .slice(0, 8)
        .map((d) => ({ date: d.slice(0, 5), value: rowTotals[d] || 0 })),
    [sortedDates, rowTotals],
  );

  // ===========================================================================
  //  Fetch
  // ===========================================================================
  const handleQuery = useCallback(async () => {
    const mapping = LINE_STAGE_MAPPING[line]?.[stage];
    if (!mapping || !from || !to) return;

    setLoading(true);
    setError(null);
    setData({});
    setExpandedDay(null);
    setExpandedHour(null);

    try {
      const start = new Date(from);
      const end = new Date(to);
      const list = [];

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        list.push(
          `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
        );
      }

      const nextDayStr = (ds) => {
        const nd = new Date(ds);
        nd.setDate(nd.getDate() + 1);
        return `${nd.getFullYear()}-${pad2(nd.getMonth() + 1)}-${pad2(nd.getDate())}`;
      };

      const prodResults = await Promise.allSettled(
        list.map(async (ds) => {
          const ns = nextDayStr(ds);

          const res = await axios.get(`${baseURL}prod/hourly-summary`, {
            params: {
              startDate: `${ds} 08:00`,
              endDate: `${ns} 08:00`,
              stationCode: mapping.stationCodes.join(","),
              linecode: mapping.linecodes.join(","),
            },
          });

          const pivot = {};
          (res.data?.data || []).forEach((row) => {
            const h = row.TIMEHOUR ?? row.timehour ?? row.hour;
            const c = row.COUNT ?? row.count ?? row.Loading_Count ?? 0;
            if (h != null) {
              pivot[Number(h)] = (pivot[Number(h)] || 0) + c;
            }
          });

          return { ds, pivot };
        }),
      );

      const merged = {};
      prodResults.forEach((r) => {
        if (r.status === "fulfilled") {
          const { ds, pivot } = r.value;
          const [y, m, d] = ds.split("-");
          const key = `${d}-${m}-${y}`;
          if (Object.keys(pivot).length > 0) {
            merged[key] = pivot;
          }
        }
      });

      setData(merged);
    } catch (e) {
      console.error("Production fetch error:", e);
      setError("Failed to fetch data. Please check your API connection.");
    } finally {
      setLoading(false);
    }
  }, [line, stage, from, to]);

  // ---------------------------------------------------------------------------
  //  Export CSV
  // ---------------------------------------------------------------------------
  const exportCSV = useCallback(() => {
    if (!dates.length) return;

    const rows = [
      [
        "Date",
        "Week",
        ...activeHours.map(fmt),
        "Total",
        "Avg UPH",
        "Perf Score",
        "vs Target%",
      ],
    ];

    sortedDates.forEach((d) => {
      rows.push([
        d,
        getWeekKey(d),
        ...activeHours.map((h) => data[d]?.[h] || 0),
        rowTotals[d],
        avgUPH[d],
        perfScore(d),
        pct(avgUPH[d], effectiveTarget),
      ]);
    });

    const csv = rows.map((r) => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `Production_${line}_${stage}_${from}_to_${to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [
    dates,
    sortedDates,
    activeHours,
    data,
    rowTotals,
    avgUPH,
    line,
    stage,
    from,
    to,
    getWeekKey,
    perfScore,
    effectiveTarget,
  ]);

  const isEmpty = dates.length === 0 && !loading;

  const groupedDates = useMemo(() => {
    if (!groupByWeek) return [{ week: null, dates }];
    const map = {};
    dates.forEach((d) => {
      const wk = getWeekKey(d);
      if (!map[wk]) map[wk] = [];
      map[wk].push(d);
    });
    return Object.entries(map).map(([week, ds]) => ({ week, dates: ds }));
  }, [dates, groupByWeek, getWeekKey]);

  const tgtColor = (p) =>
    p >= 100 ? "#059669" : p >= 80 ? "#d97706" : "#dc2626";

  // ===========================================================================
  //  RENDER
  // ===========================================================================
  return (
    <div
      style={{
        fontFamily: "'DM Sans',system-ui,sans-serif",
        padding: 0,
        background: "transparent",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');
        @keyframes spin   { to { transform:rotate(360deg) } }
        @keyframes fadeIn { from { opacity:0;transform:translateY(6px) } to { opacity:1;transform:translateY(0) } }
        .prow { transition:background 0.12s; }
        .prow:hover > td { background:rgba(79,70,229,0.035) !important; }
        .prow.expanded > td { background:#eef2ff !important; }
        .hcol-hdr:hover { background:#f0f0ff !important; cursor:pointer; }
        .tgt-btn { transition:all 0.15s; }
        .tgt-btn:hover { transform:translateY(-1px); }
        .view-tab { transition:all 0.15s; }
        .view-tab:hover { background:rgba(79,70,229,0.07) !important; }
        select:focus,input:focus { border-color:#4f46e5 !important; box-shadow:0 0 0 3px rgba(79,70,229,0.12); outline:none; }
        .mono { font-family:'JetBrains Mono',monospace; }
        .heat-cell { transition:background 0.1s,color 0.1s; }
        ::-webkit-scrollbar { height:5px; width:5px; }
        ::-webkit-scrollbar-track { background:#f1f5f9; border-radius:4px; }
        ::-webkit-scrollbar-thumb { background:#c7d2fe; border-radius:4px; }
      `}</style>

      {/* ── PAGE HEADER ─────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: "linear-gradient(135deg,#4f46e5,#7c3aed)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(79,70,229,0.35)",
            }}
          >
            <TbLayoutDashboard size={18} color="#fff" />
          </div>
          <div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 800,
                color: "#0f172a",
                lineHeight: 1,
              }}
            >
              Production Analytics
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
              {line} › {stage}
              {dates.length > 0 &&
                ` · ${dates.length} days · ${fmtN(grandTotal)} units`}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={() => setFilterOpen((v) => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "7px 12px",
              borderRadius: 9,
              border: "1px solid #e4e7ec",
              background: "#fff",
              color: "#475569",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <FiFilter size={12} /> {filterOpen ? "Hide" : "Filters"}
          </button>

          {dates.length > 0 && (
            <button
              onClick={exportCSV}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "7px 12px",
                borderRadius: 9,
                border: "1px solid #e4e7ec",
                background: "#fff",
                color: "#475569",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <FiDownload size={12} /> Export CSV
            </button>
          )}
        </div>
      </div>

      {/* ── FILTER BAR ──────────────────────────────────────────────────────── */}
      {filterOpen && (
        <div
          style={{
            ...S.card,
            marginBottom: 12,
            padding: "16px 20px",
            animation: "fadeIn 0.18s ease",
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              alignItems: "flex-end",
            }}
          >
            {[
              {
                lbl: "Production Line",
                val: line,
                opts: Object.keys(LINE_STAGE_MAPPING),
                onChange: (e) => {
                  setLine(e.target.value);
                  setStage(Object.keys(LINE_STAGE_MAPPING[e.target.value])[0]);
                },
              },
              {
                lbl: "Stage / Station",
                val: stage,
                opts: stageOpts,
                onChange: (e) => setStage(e.target.value),
              },
            ].map((f) => (
              <div
                key={f.lbl}
                style={{ display: "flex", flexDirection: "column", gap: 5 }}
              >
                <label style={labelStyle}>{f.lbl}</label>
                <select
                  value={f.val}
                  onChange={f.onChange}
                  style={{
                    fontSize: 12,
                    padding: "8px 12px",
                    border: "1px solid #e4e7ec",
                    borderRadius: 9,
                    background: "#f8fafc",
                    color: "#0f172a",
                    minWidth: 150,
                    cursor: "pointer",
                    fontWeight: 500,
                    fontFamily: "inherit",
                  }}
                >
                  {f.opts.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </div>
            ))}

            {[
              { lbl: "Start Date", val: from, set: setFrom },
              { lbl: "End Date", val: to, set: setTo },
            ].map((f) => (
              <div
                key={f.lbl}
                style={{ display: "flex", flexDirection: "column", gap: 5 }}
              >
                <label style={labelStyle}>{f.lbl}</label>
                <input
                  type="date"
                  value={f.val}
                  onChange={(e) => f.set(e.target.value)}
                  style={{
                    fontSize: 12,
                    padding: "8px 12px",
                    border: "1px solid #e4e7ec",
                    borderRadius: 9,
                    background: "#f8fafc",
                    color: "#0f172a",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                />
              </div>
            ))}

            {/* Target UPH */}
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={labelStyle}>Target UPH</label>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {fixedTarget != null ? (
                  <span
                    style={{
                      fontSize: 12,
                      padding: "8px 10px",
                      border: "1px solid #c7d2fe",
                      borderRadius: 9,
                      background: "#eef2ff",
                      color: "#4f46e5",
                      fontFamily: "'JetBrains Mono',monospace",
                      fontWeight: 800,
                      minWidth: 72,
                      textAlign: "center",
                    }}
                  >
                    {fixedTarget}{" "}
                    <span style={{ fontSize: 9, color: "#818cf8" }}>fixed</span>
                  </span>
                ) : (
                  <input
                    type="number"
                    value={target}
                    onChange={(e) => setTarget(Number(e.target.value))}
                    min={1}
                    max={999}
                    style={{
                      fontSize: 12,
                      padding: "8px 10px",
                      border: "1px solid #e4e7ec",
                      borderRadius: 9,
                      background: "#f8fafc",
                      color: "#0f172a",
                      width: 72,
                      fontFamily: "'JetBrains Mono',monospace",
                    }}
                  />
                )}
                <button
                  onClick={() => setShowTgt((v) => !v)}
                  className="tgt-btn"
                  style={{
                    fontSize: 11,
                    padding: "7px 11px",
                    border: `1px solid ${showTgt ? "#4f46e5" : "#e4e7ec"}`,
                    borderRadius: 9,
                    background: showTgt ? "#eef2ff" : "#f8fafc",
                    color: showTgt ? "#4f46e5" : "#64748b",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  {showTgt ? "ON" : "OFF"}
                </button>
              </div>
            </div>

            {/* Options */}
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={labelStyle}>Options</label>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => setSortAsc((v) => !v)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "7px 10px",
                    borderRadius: 9,
                    background: "#f8fafc",
                    color: "#64748b",
                    border: "1px solid #e4e7ec",
                    cursor: "pointer",
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  {sortAsc ? (
                    <FiChevronUp size={12} />
                  ) : (
                    <FiChevronDown size={12} />
                  )}{" "}
                  Date
                </button>
                <button
                  onClick={() => setGroupByWeek((v) => !v)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "7px 10px",
                    borderRadius: 9,
                    background: groupByWeek ? "#eef2ff" : "#f8fafc",
                    color: groupByWeek ? "#4f46e5" : "#64748b",
                    border: `1px solid ${groupByWeek ? "#c7d2fe" : "#e4e7ec"}`,
                    cursor: "pointer",
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  <FiCalendar size={12} /> Week
                </button>
                <button
                  onClick={() => setHighlightBest((v) => !v)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "7px 10px",
                    borderRadius: 9,
                    background: highlightBest ? "#fef3c7" : "#f8fafc",
                    color: highlightBest ? "#d97706" : "#64748b",
                    border: `1px solid ${highlightBest ? "#fcd34d" : "#e4e7ec"}`,
                    cursor: "pointer",
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  <FiStar size={12} /> Best
                </button>
              </div>
            </div>

            {/* Query Button */}
            <div style={{ marginLeft: "auto" }}>
              <button
                onClick={handleQuery}
                disabled={loading}
                className="tgt-btn"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "10px 24px",
                  borderRadius: 10,
                  background: loading
                    ? "#94a3b8"
                    : "linear-gradient(135deg,#4f46e5,#7c3aed)",
                  color: "#fff",
                  border: "none",
                  cursor: loading ? "not-allowed" : "pointer",
                  fontSize: 13,
                  fontWeight: 700,
                  boxShadow: loading
                    ? "none"
                    : "0 4px 14px rgba(79,70,229,0.4)",
                }}
              >
                {loading ? (
                  <FiRefreshCw
                    size={14}
                    style={{ animation: "spin 1s linear infinite" }}
                  />
                ) : (
                  <FiSearch size={14} />
                )}
                {loading ? "Loading…" : "Query Data"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── KPI STRIP ───────────────────────────────────────────────────────── */}
      {dates.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: 12,
          }}
        >
          <KPICard
            icon={FiTarget}
            label="Grand Total"
            value={fmtN(grandTotal)}
            sub={`across ${dates.length} days`}
            color="#4f46e5"
          />
          <KPICard
            icon={MdOutlineSpeed}
            label="Overall Avg"
            value={overallAvg || "—"}
            sub={`target: ${effectiveTarget} UPH`}
            color="#059669"
            trend={overallAvg >= effectiveTarget ? "up" : "down"}
          />
          <KPICard
            icon={HiOutlineFire}
            label="Best Day"
            value={bestDay?.slice(0, 5) || "—"}
            sub={bestDay ? `${fmtN(rowTotals[bestDay])} units` : ""}
            color="#d97706"
          />
          <KPICard
            icon={FiClock}
            label="Peak Hour"
            value={bestHour != null ? fmt(bestHour) : "—"}
            sub={bestHour != null ? `${fmtN(colTotals[bestHour])} total` : ""}
            color="#7c3aed"
          />
          <KPICard
            icon={FiAlertTriangle}
            label="Below Target"
            value={belowTarget.length}
            sub={`slots < ${effectiveTarget} UPH`}
            color={belowTarget.length > 0 ? "#dc2626" : "#059669"}
          />
          {trend && (
            <KPICard
              icon={trend.up ? FiTrendingUp : FiTrendingDown}
              label="Period Trend"
              value={`${trend.up ? "+" : ""}${trend.pct}%`}
              sub="2nd half vs 1st"
              color={trend.up ? "#059669" : "#dc2626"}
              trend={trend.up ? "up" : "down"}
            />
          )}
        </div>
      )}

      {/* ── ERROR / EMPTY ───────────────────────────────────────────────────── */}
      {error && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 12,
            padding: "12px 18px",
            marginBottom: 12,
            color: "#dc2626",
            fontSize: 13,
          }}
        >
          <FiAlertTriangle size={15} /> {error}
        </div>
      )}
      {isEmpty && !error && (
        <div style={{ ...S.card, padding: "60px 20px", textAlign: "center" }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "#f1f5f9",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <BsGraphUp size={28} color="#c7d2fe" />
          </div>
          <div style={{ fontWeight: 800, fontSize: 16, color: "#334155" }}>
            Ready to analyze
          </div>
          <div
            style={{
              fontSize: 12,
              color: "#94a3b8",
              marginTop: 6,
              maxWidth: 300,
              margin: "8px auto 0",
            }}
          >
            Select a production line, stage &amp; date range, then click{" "}
            <strong>Query Data</strong>.
          </div>
        </div>
      )}

      {/* ── VIEW TABS ───────────────────────────────────────────────────────── */}
      {dates.length > 0 && (
        <div
          style={{
            display: "flex",
            background: "#f1f5f9",
            borderRadius: 12,
            padding: 3,
            border: "1px solid #e4e7ec",
            marginBottom: 12,
            width: "fit-content",
            flexWrap: "wrap",
            gap: 2,
          }}
        >
          {VIEWS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className="view-tab"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 15px",
                borderRadius: 9,
                border: "none",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
                background: view === id ? "#fff" : "transparent",
                color: view === id ? "#4f46e5" : "#64748b",
                boxShadow: view === id ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s",
              }}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
      )}

      {/* =======================================================================
           PIVOT TABLE VIEW
         ======================================================================= */}
      {view === "pivot" && dates.length > 0 && (
        <div style={{ animation: "fadeIn 0.2s ease" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <BsTable size={13} color="#4f46e5" />
              <span style={cardTitle}>Hourly Pivot Table</span>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>
                · {dates.length} days × {activeHours.length} hours
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button
                onClick={() => setShowAvgRow((v) => !v)}
                style={{
                  fontSize: 11,
                  padding: "4px 9px",
                  border: `1px solid ${showAvgRow ? "#c7d2fe" : "#e4e7ec"}`,
                  borderRadius: 6,
                  background: showAvgRow ? "#eef2ff" : "#f8fafc",
                  color: showAvgRow ? "#4f46e5" : "#64748b",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                {showAvgRow ? "Hide Avg Row" : "Show Avg Row"}
              </button>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 10,
                  color: "#94a3b8",
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 8,
                    background: "linear-gradient(to right,#e0e7ff,#312e81)",
                    borderRadius: 3,
                  }}
                />
                Low → High
              </div>
            </div>
          </div>

          {expandedHour != null && (
            <HourDrillPanel
              hour={expandedHour}
              dates={dates}
              data={data}
              maxColVal={Math.max(
                ...dates.map((d) => data[d]?.[expandedHour] || 0),
                1,
              )}
              onClose={() => setExpandedHour(null)}
            />
          )}

          <div style={{ ...S.card, overflow: "hidden", marginBottom: 10 }}>
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "separate",
                  borderSpacing: 0,
                  fontSize: 12,
                }}
              >
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    <th
                      style={{
                        padding: "11px 18px",
                        textAlign: "left",
                        fontWeight: 700,
                        color: "#475569",
                        borderBottom: "2px solid #e4e7ec",
                        position: "sticky",
                        left: 0,
                        background: "#f8fafc",
                        zIndex: 3,
                        minWidth: 130,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        <FiCalendar size={11} color="#94a3b8" /> Date
                      </div>
                    </th>
                    {activeHours.map((h) => (
                      <th
                        key={h}
                        className="hcol-hdr"
                        onClick={() =>
                          setExpandedHour(expandedHour === h ? null : h)
                        }
                        onMouseEnter={() => setHlCol(h)}
                        onMouseLeave={() => setHlCol(null)}
                        style={{
                          padding: "8px 4px",
                          textAlign: "center",
                          fontWeight: 700,
                          color:
                            h === bestHour && highlightBest
                              ? "#4f46e5"
                              : "#475569",
                          borderBottom: "2px solid #e4e7ec",
                          minWidth: 54,
                          background:
                            h === hlCol || h === expandedHour
                              ? "#f0f0ff"
                              : "#f8fafc",
                          transition: "background 0.1s",
                          userSelect: "none",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 10,
                            fontFamily: "'JetBrains Mono',monospace",
                          }}
                        >
                          {fmt(h)}
                        </div>
                        {h === bestHour && highlightBest && (
                          <div
                            style={{
                              width: 4,
                              height: 4,
                              borderRadius: "50%",
                              background: "#4f46e5",
                              margin: "3px auto 0",
                            }}
                          />
                        )}
                        {h === expandedHour && (
                          <FiChevronDown
                            size={9}
                            color="#4f46e5"
                            style={{ display: "block", margin: "2px auto 0" }}
                          />
                        )}
                      </th>
                    ))}
                    <th
                      style={{
                        padding: "11px 14px",
                        textAlign: "center",
                        fontWeight: 800,
                        color: "#312e81",
                        borderBottom: "2px solid #e4e7ec",
                        background: "#eef2ff",
                        minWidth: 80,
                      }}
                    >
                      Total
                    </th>
                    <th
                      style={{
                        padding: "11px 12px",
                        textAlign: "center",
                        fontWeight: 800,
                        color: "#0f172a",
                        borderBottom: "2px solid #e4e7ec",
                        background: "#f0fdf4",
                        minWidth: 72,
                      }}
                    >
                      Avg UPH
                    </th>
                    <th
                      style={{
                        padding: "11px 12px",
                        textAlign: "center",
                        fontWeight: 800,
                        color: "#0f172a",
                        borderBottom: "2px solid #e4e7ec",
                        background: "#fffbeb",
                        minWidth: 70,
                      }}
                    >
                      vs Tgt
                    </th>
                    <th
                      style={{
                        padding: "11px 12px",
                        textAlign: "center",
                        fontWeight: 800,
                        color: "#0f172a",
                        borderBottom: "2px solid #e4e7ec",
                        background: "#f5f3ff",
                        minWidth: 90,
                      }}
                    >
                      Performance
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {groupedDates.map(({ week, dates: grpDates }) => (
                    <React.Fragment key={week || grpDates[0]}>
                      {week && (
                        <tr>
                          <td
                            colSpan={activeHours.length + 5}
                            style={{
                              padding: "7px 18px",
                              background:
                                "linear-gradient(90deg,#f0f0ff,transparent)",
                              fontSize: 10,
                              fontWeight: 800,
                              color: "#6366f1",
                              letterSpacing: "0.1em",
                              textTransform: "uppercase",
                              borderTop: "1px solid #e0e7ff",
                            }}
                          >
                            📅 {week}
                          </td>
                        </tr>
                      )}

                      {grpDates.map((date, di) => {
                        const dd = data[date] || {};
                        const tot = rowTotals[date];
                        const uph = avgUPH[date];
                        const isBest = date === bestDay && highlightBest;
                        const isWorst = date === worstDay && dates.length > 1;
                        const isTop3 = topDays.includes(date);
                        const isExp = expandedDay === date;
                        const tgtPct = pct(uph, effectiveTarget);
                        const score = perfScore(date);
                        const badge = perfBadge(score);

                        return (
                          <React.Fragment key={date}>
                            <tr
                              className={`prow${isExp ? " expanded" : ""}`}
                              onClick={() =>
                                setExpandedDay(isExp ? null : date)
                              }
                              style={{
                                background: di % 2 === 0 ? "#fff" : "#fafcff",
                                cursor: "pointer",
                              }}
                            >
                              <td
                                style={{
                                  padding: "9px 18px",
                                  borderBottom: "1px solid #f1f5f9",
                                  position: "sticky",
                                  left: 0,
                                  background: isExp
                                    ? "#eef2ff"
                                    : di % 2 === 0
                                      ? "#fff"
                                      : "#fafcff",
                                  zIndex: 1,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                  }}
                                >
                                  <FiChevronRight
                                    size={10}
                                    color="#94a3b8"
                                    style={{
                                      transform: isExp
                                        ? "rotate(90deg)"
                                        : "none",
                                      transition: "transform 0.2s",
                                    }}
                                  />
                                  {isBest && (
                                    <span
                                      style={{
                                        fontSize: 9,
                                        background: "#eef2ff",
                                        color: "#4338ca",
                                        borderRadius: 4,
                                        padding: "1px 6px",
                                        fontWeight: 800,
                                        border: "1px solid #c7d2fe",
                                      }}
                                    >
                                      BEST
                                    </span>
                                  )}
                                  {isWorst && (
                                    <span
                                      style={{
                                        fontSize: 9,
                                        background: "#fef2f2",
                                        color: "#dc2626",
                                        borderRadius: 4,
                                        padding: "1px 6px",
                                        fontWeight: 700,
                                        border: "1px solid #fecaca",
                                      }}
                                    >
                                      LOW
                                    </span>
                                  )}
                                  {!isBest &&
                                    !isWorst &&
                                    isTop3 &&
                                    highlightBest && (
                                      <span
                                        style={{
                                          fontSize: 9,
                                          background: "#fef3c7",
                                          color: "#92400e",
                                          borderRadius: 4,
                                          padding: "1px 6px",
                                          fontWeight: 700,
                                          border: "1px solid #fcd34d",
                                        }}
                                      >
                                        TOP3
                                      </span>
                                    )}
                                  <span
                                    className="mono"
                                    style={{
                                      fontWeight: isBest ? 800 : 600,
                                      color: isBest ? "#312e81" : "#334155",
                                      fontSize: 12,
                                    }}
                                  >
                                    {date}
                                  </span>
                                </div>
                              </td>

                              {activeHours.map((h) => {
                                const v = dd[h] || 0;
                                const hs = getHeatStyle(v, maxVal);
                                const belowTgt =
                                  showTgt && v > 0 && v < effectiveTarget;
                                return (
                                  <td
                                    key={h}
                                    className="heat-cell"
                                    style={{
                                      padding: "6px 4px",
                                      textAlign: "center",
                                      borderBottom: "1px solid #f1f5f9",
                                      background:
                                        h === hlCol || h === expandedHour
                                          ? "rgba(99,102,241,0.05)"
                                          : "",
                                      ...(!belowTgt ? hs : {}),
                                    }}
                                  >
                                    {v > 0 ? (
                                      <span
                                        className="mono"
                                        style={{
                                          fontSize: 11,
                                          ...(belowTgt
                                            ? {
                                                color: "#dc2626",
                                                fontWeight: 700,
                                              }
                                            : {}),
                                        }}
                                      >
                                        {v}
                                      </span>
                                    ) : (
                                      <span
                                        style={{
                                          color: "#e2e8f0",
                                          fontSize: 10,
                                        }}
                                      >
                                        ·
                                      </span>
                                    )}
                                  </td>
                                );
                              })}

                              <td
                                style={{
                                  padding: "8px 14px",
                                  textAlign: "center",
                                  borderBottom: "1px solid #f1f5f9",
                                  fontWeight: 800,
                                  background: "#eef2ff",
                                }}
                              >
                                <span
                                  className="mono"
                                  style={{ color: "#312e81", fontSize: 12 }}
                                >
                                  {fmtN(tot)}
                                </span>
                              </td>

                              <td
                                style={{
                                  padding: "8px 12px",
                                  textAlign: "center",
                                  borderBottom: "1px solid #f1f5f9",
                                  background: "#f0fdf4",
                                }}
                              >
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 3,
                                    fontWeight: 700,
                                    color:
                                      uph >= overallAvg ? "#15803d" : "#dc2626",
                                    fontSize: 12,
                                  }}
                                >
                                  {uph >= overallAvg ? (
                                    <FiArrowUp size={9} />
                                  ) : (
                                    <FiArrowDown size={9} />
                                  )}
                                  <span className="mono">{uph}</span>
                                </span>
                              </td>

                              <td
                                style={{
                                  padding: "8px 12px",
                                  textAlign: "center",
                                  borderBottom: "1px solid #f1f5f9",
                                  background: "#fffbeb",
                                }}
                              >
                                <span
                                  className="mono"
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color: tgtColor(tgtPct),
                                  }}
                                >
                                  {tgtPct}%
                                </span>
                              </td>

                              <td
                                style={{
                                  padding: "8px 12px",
                                  textAlign: "center",
                                  borderBottom: "1px solid #f1f5f9",
                                  background: "#f5f3ff",
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    background: badge.bg,
                                    color: badge.color,
                                    borderRadius: 5,
                                    padding: "2px 8px",
                                    border: `1px solid ${badge.border}`,
                                  }}
                                >
                                  {badge.label}
                                </span>
                              </td>
                            </tr>

                            {isExp && (
                              <tr>
                                <td
                                  colSpan={activeHours.length + 5}
                                  style={{
                                    padding: 0,
                                    borderBottom: "2px solid #c7d2fe",
                                  }}
                                >
                                  <div
                                    style={{
                                      padding: "0 18px 10px",
                                      background: "#fafbff",
                                    }}
                                  >
                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        padding: "8px 0 4px",
                                      }}
                                    >
                                      <FiBarChart2 size={12} color="#4f46e5" />
                                      <span
                                        style={{
                                          fontSize: 11,
                                          fontWeight: 700,
                                          color: "#4f46e5",
                                        }}
                                      >
                                        Hourly breakdown — {date}
                                      </span>
                                      <div
                                        style={{
                                          marginLeft: "auto",
                                          display: "flex",
                                          gap: 12,
                                          fontSize: 10,
                                          color: "#94a3b8",
                                        }}
                                      >
                                        <span>
                                          Total:{" "}
                                          <strong style={{ color: "#312e81" }}>
                                            {fmtN(tot)}
                                          </strong>
                                        </span>
                                        <span>
                                          Avg:{" "}
                                          <strong style={{ color: "#059669" }}>
                                            {uph}/hr
                                          </strong>
                                        </span>
                                        <span>
                                          Score:{" "}
                                          <strong
                                            style={{ color: badge.color }}
                                          >
                                            {score}
                                          </strong>
                                        </span>
                                      </div>
                                    </div>
                                    <MiniHourChart
                                      hours={activeHours}
                                      data={dd}
                                      target={effectiveTarget}
                                      showTarget={showTgt}
                                      maxVal={maxVal}
                                      color="#4f46e5"
                                    />
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </tbody>

                <tfoot>
                  <tr style={{ background: "#eef2ff" }}>
                    <td
                      style={{
                        padding: "10px 18px",
                        fontWeight: 800,
                        color: "#312e81",
                        position: "sticky",
                        left: 0,
                        background: "#eef2ff",
                        zIndex: 1,
                        borderTop: "2px solid #c7d2fe",
                        fontSize: 12,
                      }}
                    >
                      Grand Total
                    </td>
                    {activeHours.map((h) => (
                      <td
                        key={h}
                        style={{
                          padding: "10px 4px",
                          textAlign: "center",
                          borderTop: "2px solid #c7d2fe",
                        }}
                      >
                        <span
                          className="mono"
                          style={{
                            fontWeight: 800,
                            color: "#312e81",
                            fontSize: 11,
                          }}
                        >
                          {fmtN(colTotals[h] || 0)}
                        </span>
                      </td>
                    ))}
                    <td
                      style={{
                        padding: "10px 14px",
                        textAlign: "center",
                        fontWeight: 900,
                        color: "#312e81",
                        borderTop: "2px solid #c7d2fe",
                        background: "#c7d2fe",
                      }}
                    >
                      <span className="mono" style={{ fontSize: 13 }}>
                        {fmtN(grandTotal)}
                      </span>
                    </td>
                    <td
                      colSpan={3}
                      style={{
                        borderTop: "2px solid #c7d2fe",
                        padding: "10px 12px",
                        textAlign: "center",
                        fontSize: 11,
                        color: "#64748b",
                      }}
                    >
                      Overall Avg:{" "}
                      <strong style={{ color: "#059669" }}>
                        {overallAvg}/hr
                      </strong>{" "}
                      · Target: <strong>{effectiveTarget}/hr</strong>
                    </td>
                  </tr>
                  {showAvgRow && (
                    <tr style={{ background: "#f8fafc" }}>
                      <td
                        style={{
                          padding: "8px 18px",
                          fontWeight: 700,
                          color: "#64748b",
                          fontSize: 10,
                          position: "sticky",
                          left: 0,
                          background: "#f8fafc",
                          zIndex: 1,
                          borderTop: "1px solid #e4e7ec",
                        }}
                      >
                        Hour Avg
                      </td>
                      {activeHours.map((h) => (
                        <td
                          key={h}
                          style={{
                            padding: "8px 4px",
                            textAlign: "center",
                            borderTop: "1px solid #e4e7ec",
                          }}
                        >
                          <span
                            className="mono"
                            style={{
                              fontSize: 10,
                              fontWeight: 600,
                              color:
                                colAvgs[h] >= effectiveTarget
                                  ? "#059669"
                                  : colAvgs[h] >= effectiveTarget * 0.8
                                    ? "#d97706"
                                    : "#dc2626",
                            }}
                          >
                            {colAvgs[h] || 0}
                          </span>
                        </td>
                      ))}
                      <td
                        colSpan={4}
                        style={{ borderTop: "1px solid #e4e7ec" }}
                      />
                    </tr>
                  )}
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
           TREND VIEW
         ======================================================================= */}
      {view === "trend" && dates.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            animation: "fadeIn 0.2s ease",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.6fr 1fr",
              gap: 12,
            }}
          >
            <div style={{ ...S.card, padding: 18 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 14,
                }}
              >
                <FiBarChart2 size={13} color="#4f46e5" />
                <span style={cardTitle}>Daily Production Volume</span>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart
                  data={dailyCD}
                  margin={{ top: 8, right: 10, left: -10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#f1f5f9"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  {showTgt && (
                    <ReferenceLine
                      y={effectiveTarget}
                      stroke="#f59e0b"
                      strokeDasharray="4 3"
                      label={{
                        value: `Tgt ${effectiveTarget}`,
                        position: "right",
                        fontSize: 9,
                        fill: "#d97706",
                      }}
                    />
                  )}
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="total"
                    name="Total Units"
                    stroke="#4f46e5"
                    strokeWidth={2.5}
                    fill="url(#gTotal)"
                    dot={{
                      fill: "#4f46e5",
                      r: 3,
                      strokeWidth: 2,
                      stroke: "#fff",
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div style={{ ...S.card, padding: 18 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 14,
                }}
              >
                <FiAward size={13} color="#d97706" />
                <span style={cardTitle}>Day Rankings</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {[...sortedDates]
                  .sort((a, b) => rowTotals[b] - rowTotals[a])
                  .map((d, i) => {
                    const w = Math.round(
                      (rowTotals[d] / (rowTotals[bestDay] || 1)) * 100,
                    );
                    const badge = perfBadge(perfScore(d));
                    return (
                      <div
                        key={d}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "6px 8px",
                          borderRadius: 8,
                          background: i === 0 ? "#eef2ff" : "#f8fafc",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            color:
                              ["#f59e0b", "#94a3b8", "#cd7c4b"][i] || "#cbd5e1",
                            minWidth: 20,
                            textAlign: "center",
                          }}
                        >
                          #{i + 1}
                        </span>
                        <span
                          className="mono"
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: "#334155",
                            minWidth: 74,
                          }}
                        >
                          {d.slice(0, 5)}
                        </span>
                        <div
                          style={{
                            flex: 1,
                            height: 5,
                            background: "#f1f5f9",
                            borderRadius: 3,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${w}%`,
                              height: "100%",
                              background: i === 0 ? "#4f46e5" : "#a5b4fc",
                              borderRadius: 3,
                            }}
                          />
                        </div>
                        <span
                          className="mono"
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: "#312e81",
                            minWidth: 44,
                            textAlign: "right",
                          }}
                        >
                          {fmtN(rowTotals[d])}
                        </span>
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            background: badge.bg,
                            color: badge.color,
                            borderRadius: 4,
                            padding: "1px 5px",
                          }}
                        >
                          {badge.label}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <div style={{ ...S.card, padding: 18 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 14,
                }}
              >
                <FiTrendingUp size={13} color="#059669" />
                <span style={cardTitle}>Average UPH per Day</span>
              </div>
              <ResponsiveContainer width="100%" height={175}>
                <LineChart
                  data={dailyCD}
                  margin={{ top: 8, right: 10, left: -10, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#f1f5f9"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <ReferenceLine
                    y={overallAvg}
                    stroke="#94a3b8"
                    strokeDasharray="4 4"
                    label={{
                      value: `Avg ${overallAvg}`,
                      position: "right",
                      fontSize: 9,
                      fill: "#94a3b8",
                    }}
                  />
                  {showTgt && (
                    <ReferenceLine
                      y={effectiveTarget}
                      stroke="#f59e0b"
                      strokeDasharray="4 3"
                      label={{
                        value: `Tgt ${effectiveTarget}`,
                        position: "right",
                        fontSize: 9,
                        fill: "#d97706",
                      }}
                    />
                  )}
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="avg"
                    name="Avg UPH"
                    stroke="#059669"
                    strokeWidth={2.5}
                    dot={{
                      fill: "#059669",
                      r: 4,
                      strokeWidth: 2,
                      stroke: "#fff",
                    }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div style={{ ...S.card, padding: 18 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 14,
                }}
              >
                <FiClock size={13} color="#7c3aed" />
                <span style={cardTitle}>Hourly Volume (all days)</span>
              </div>
              <ResponsiveContainer width="100%" height={175}>
                <BarChart
                  data={colCD}
                  margin={{ top: 8, right: 10, left: -10, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#f1f5f9"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="hour"
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="total" name="Total" radius={[5, 5, 0, 0]}>
                    {colCD.map((_, i) => (
                      <Cell
                        key={i}
                        fill={
                          activeHours[i] === bestHour ? "#4f46e5" : "#a5b4fc"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
           COMPARE VIEW
         ======================================================================= */}
      {view === "compare" && dates.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            animation: "fadeIn 0.2s ease",
          }}
        >
          <div style={{ ...S.card, padding: 18 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 14,
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <MdCompare size={14} color="#4f46e5" />
                <span style={cardTitle}>Day-by-Day Hourly Comparison</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {sortedDates.map((d, i) => (
                  <span
                    key={d}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      fontSize: 11,
                      color: "#475569",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        width: 16,
                        height: 3,
                        background: DAY_COLORS[i % DAY_COLORS.length],
                        borderRadius: 2,
                      }}
                    />
                    {d.slice(0, 5)}
                  </span>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart
                data={hourlyCD}
                margin={{ top: 8, right: 24, left: -10, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#f1f5f9"
                  vertical={false}
                />
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                />
                {showTgt && (
                  <ReferenceLine
                    y={effectiveTarget}
                    stroke="#f59e0b"
                    strokeDasharray="4 3"
                    label={{
                      value: "Target",
                      position: "right",
                      fontSize: 9,
                      fill: "#d97706",
                    }}
                  />
                )}
                <Tooltip content={<CustomTooltip />} />
                {sortedDates.map((d, i) => (
                  <Line
                    key={d}
                    type="monotone"
                    dataKey={d.slice(0, 5)}
                    stroke={DAY_COLORS[i % DAY_COLORS.length]}
                    strokeWidth={d === bestDay ? 3 : 1.5}
                    dot={false}
                    activeDot={{ r: 5 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))",
              gap: 10,
            }}
          >
            {[...sortedDates]
              .sort((a, b) => rowTotals[b] - rowTotals[a])
              .map((d, i) => {
                const score = perfScore(d);
                const badge = perfBadge(score);
                const tgtPct = pct(avgUPH[d], effectiveTarget);
                const vals = activeHours
                  .map((h) => data[d]?.[h] || 0)
                  .filter((v) => v > 0);
                const cv = dayCV(vals);
                return (
                  <div
                    key={d}
                    style={{
                      ...S.card,
                      padding: 14,
                      border: `1px solid ${i === 0 ? "#c7d2fe" : "#e4e7ec"}`,
                      background: i === 0 ? "#fafbff" : "#fff",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 10,
                      }}
                    >
                      <span
                        className="mono"
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#334155",
                        }}
                      >
                        {d.slice(0, 5)}
                      </span>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          background: badge.bg,
                          color: badge.color,
                          borderRadius: 5,
                          padding: "2px 7px",
                        }}
                      >
                        {badge.label}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 20,
                        fontWeight: 800,
                        color: "#312e81",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {fmtN(rowTotals[d])}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "#94a3b8",
                        marginBottom: 8,
                      }}
                    >
                      total units
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 6,
                        fontSize: 10,
                      }}
                    >
                      <div
                        style={{
                          background: "#f0fdf4",
                          borderRadius: 6,
                          padding: "5px 8px",
                        }}
                      >
                        <div style={{ color: "#94a3b8" }}>Avg UPH</div>
                        <div style={{ fontWeight: 800, color: "#059669" }}>
                          {avgUPH[d]}
                        </div>
                      </div>
                      <div
                        style={{
                          background: "#fffbeb",
                          borderRadius: 6,
                          padding: "5px 8px",
                        }}
                      >
                        <div style={{ color: "#94a3b8" }}>vs Target</div>
                        <div
                          style={{ fontWeight: 800, color: tgtColor(tgtPct) }}
                        >
                          {tgtPct}%
                        </div>
                      </div>
                      <div
                        style={{
                          background: "#f8fafc",
                          borderRadius: 6,
                          padding: "5px 8px",
                        }}
                      >
                        <div style={{ color: "#94a3b8" }}>CV %</div>
                        <div
                          style={{
                            fontWeight: 800,
                            color: cv < 30 ? "#059669" : "#d97706",
                          }}
                        >
                          {cv}%
                        </div>
                      </div>
                      <div
                        style={{
                          background: "#f5f3ff",
                          borderRadius: 6,
                          padding: "5px 8px",
                        }}
                      >
                        <div style={{ color: "#94a3b8" }}>Rank</div>
                        <div style={{ fontWeight: 800, color: "#7c3aed" }}>
                          #{i + 1}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* =======================================================================
           INSIGHTS VIEW
         ======================================================================= */}
      {view === "insights" && dates.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            animation: "fadeIn 0.2s ease",
          }}
        >
          <div style={{ ...S.card, padding: 18 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 14,
              }}
            >
              <MdInsights size={14} color="#4f46e5" />
              <span style={cardTitle}>Period Summary</span>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              {[
                {
                  label: "Total Units",
                  value: fmtN(grandTotal),
                  color: "#4f46e5",
                },
                { label: "Active Days", value: dates.length, color: "#059669" },
                {
                  label: "Overall Avg",
                  value: `${overallAvg}/hr`,
                  color: "#7c3aed",
                },
                { label: "Peak Hour", value: fmt(bestHour), color: "#d97706" },
                {
                  label: "Best Day",
                  value: fmtN(rowTotals[bestDay] || 0),
                  color: "#059669",
                },
                {
                  label: "Worst Day",
                  value: fmtN(rowTotals[worstDay] || 0),
                  color: "#dc2626",
                },
                {
                  label: "Target %",
                  value: `${pct(overallAvg, effectiveTarget)}%`,
                  color:
                    pct(overallAvg, effectiveTarget) >= 100
                      ? "#059669"
                      : "#dc2626",
                },
                {
                  label: "Morning Share",
                  value: `${pct(slotTotals.morning, grandTotal)}%`,
                  color: "#f59e0b",
                },
                {
                  label: "Below Target",
                  value: `${belowTarget.length} slots`,
                  color: belowTarget.length > 0 ? "#dc2626" : "#059669",
                },
                {
                  label: "Active Hours",
                  value: activeHours.length,
                  color: "#0891b2",
                },
              ].map((s) => (
                <div
                  key={s.label}
                  style={{
                    background: "#f8fafc",
                    borderRadius: 10,
                    padding: "10px 12px",
                    border: "1px solid #f1f5f9",
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: "#94a3b8",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      marginBottom: 4,
                    }}
                  >
                    {s.label}
                  </div>
                  <div
                    className="mono"
                    style={{ fontSize: 17, fontWeight: 800, color: s.color }}
                  >
                    {s.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ ...S.card, padding: 18 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 14,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <FiAlertTriangle size={13} color="#dc2626" />
                <span style={cardTitle}>Below-Target Slots</span>
              </div>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>
                target: {effectiveTarget} UPH
              </span>
            </div>
            {belowTarget.length === 0 ? (
              <div style={{ textAlign: "center", padding: "28px 0" }}>
                <FiCheckCircle
                  size={28}
                  color="#34d399"
                  style={{ display: "block", margin: "0 auto 10px" }}
                />
                <div
                  style={{ fontSize: 13, fontWeight: 700, color: "#059669" }}
                >
                  All slots meet target!
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 5,
                  maxHeight: 280,
                  overflowY: "auto",
                }}
              >
                {belowTarget.map((a, i) => {
                  const gap = effectiveTarget - a.val;
                  return (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "7px 10px",
                        borderRadius: 8,
                        background: "#fef2f2",
                        border: "1px solid #fecaca",
                      }}
                    >
                      <FiAlertTriangle size={11} color="#dc2626" />
                      <span
                        className="mono"
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#334155",
                          flex: 1,
                        }}
                      >
                        {a.date} · {fmt(a.hour)}
                      </span>
                      <span
                        className="mono"
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                          color: "#dc2626",
                        }}
                      >
                        {a.val}
                      </span>
                      <span style={{ fontSize: 10, color: "#ef4444" }}>
                        -{gap}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: "#dc2626",
                        }}
                      >
                        {pct(a.val, effectiveTarget)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ ...S.card, padding: 18 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 14,
              }}
            >
              <FiActivity size={13} color="#059669" />
              <span style={cardTitle}>Day Consistency (CV %)</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[...dates]
                .sort((a, b) => rowTotals[b] - rowTotals[a])
                .map((d) => {
                  const vals = activeHours
                    .map((h) => data[d]?.[h] || 0)
                    .filter((v) => v > 0);
                  const cv = dayCV(vals);
                  const ok = cv < 30;
                  return (
                    <div
                      key={d}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "7px 10px",
                        borderRadius: 8,
                        background: "#f8fafc",
                      }}
                    >
                      <span
                        className="mono"
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#334155",
                          minWidth: 86,
                        }}
                      >
                        {d}
                      </span>
                      <div
                        style={{
                          flex: 1,
                          height: 7,
                          background: "#f1f5f9",
                          borderRadius: 4,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.min(cv * 2, 100)}%`,
                            height: "100%",
                            background: ok ? "#10b981" : "#f59e0b",
                            borderRadius: 4,
                          }}
                        />
                      </div>
                      <span
                        className="mono"
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: ok ? "#059669" : "#d97706",
                          minWidth: 50,
                          textAlign: "right",
                        }}
                      >
                        CV {cv}%
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          color: ok ? "#059669" : "#d97706",
                          minWidth: 52,
                        }}
                      >
                        {ok ? "✓ Steady" : "⚠ Variable"}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>

          <div style={{ ...S.card, padding: 18 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 14,
              }}
            >
              <TbRadar size={13} color="#7c3aed" />
              <span style={cardTitle}>Daily Output Radar</span>
            </div>
            <ResponsiveContainer width="100%" height={230}>
              <RadarChart
                data={radarD}
                margin={{ top: 10, right: 30, bottom: 10, left: 30 }}
              >
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "#64748b" }}
                />
                <PolarRadiusAxis
                  tick={{ fontSize: 8, fill: "#94a3b8" }}
                  angle={30}
                />
                <Radar
                  name="Output"
                  dataKey="value"
                  stroke="#4f46e5"
                  fill="#4f46e5"
                  fillOpacity={0.2}
                />
                <Tooltip content={<CustomTooltip />} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* =======================================================================
           REPORT VIEW
         ======================================================================= */}
      {view === "report" && dates.length > 0 && (
        <div style={{ animation: "fadeIn 0.2s ease" }}>
          <div
            style={{
              ...S.card,
              padding: 22,
              marginBottom: 12,
              background: "linear-gradient(135deg,#1e2530,#312e81)",
              color: "#fff",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 11,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "#818cf8",
                    marginBottom: 6,
                    fontWeight: 700,
                  }}
                >
                  Production Analytics Report
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>
                  {line} — {stage}
                </div>
                <div style={{ fontSize: 12, color: "#a5b4fc" }}>
                  Period: {from} → {to} · {dates.length} working days · Target:{" "}
                  {effectiveTarget} UPH
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 900,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {fmtN(grandTotal)}
                </div>
                <div style={{ fontSize: 11, color: "#a5b4fc" }}>
                  Total Units
                </div>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 16,
                marginTop: 16,
                paddingTop: 16,
                borderTop: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              {[
                {
                  label: "Avg UPH",
                  value: `${overallAvg}`,
                  sub: `target ${effectiveTarget}`,
                },
                {
                  label: "Target %",
                  value: `${pct(overallAvg, effectiveTarget)}%`,
                  sub: "overall",
                },
                {
                  label: "Best Day",
                  value: bestDay?.slice(0, 5) || "—",
                  sub: `${fmtN(rowTotals[bestDay] || 0)} units`,
                },
                {
                  label: "Peak Hour",
                  value: fmt(bestHour),
                  sub: `${fmtN(colTotals[bestHour] || 0)} total`,
                },
                {
                  label: "Below Tgt",
                  value: `${belowTarget.length}`,
                  sub: "hour slots",
                },
                {
                  label: "Trend",
                  value: trend ? `${trend.up ? "+" : ""}${trend.pct}%` : "N/A",
                  sub: "2nd vs 1st half",
                },
              ].map((s) => (
                <div key={s.label}>
                  <div
                    style={{
                      fontSize: 10,
                      color: "#818cf8",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.07em",
                    }}
                  >
                    {s.label}
                  </div>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 800,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {s.value}
                  </div>
                  <div style={{ fontSize: 10, color: "#a5b4fc" }}>{s.sub}</div>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginBottom: 12,
            }}
          >
            <div style={{ ...S.card, padding: 18 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 14,
                }}
              >
                <FiBarChart2 size={13} color="#4f46e5" />
                <span style={cardTitle}>Daily Production</span>
              </div>
              <ResponsiveContainer width="100%" height={165}>
                <AreaChart
                  data={dailyCD}
                  margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="rGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="#4f46e5"
                        stopOpacity={0.28}
                      />
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#f1f5f9"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 9, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 9, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="#4f46e5"
                    strokeWidth={2}
                    fill="url(#rGrad)"
                    dot={{
                      r: 3,
                      fill: "#4f46e5",
                      stroke: "#fff",
                      strokeWidth: 2,
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div style={{ ...S.card, padding: 18 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 14,
                }}
              >
                <FiClock size={13} color="#7c3aed" />
                <span style={cardTitle}>Hourly Distribution</span>
              </div>
              <ResponsiveContainer width="100%" height={165}>
                <BarChart
                  data={colCD}
                  margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#f1f5f9"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="hour"
                    tick={{ fontSize: 9, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 9, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="total" name="Total" radius={[4, 4, 0, 0]}>
                    {colCD.map((_, i) => (
                      <Cell
                        key={i}
                        fill={
                          activeHours[i] === bestHour ? "#4f46e5" : "#a5b4fc"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Summary table */}
          <div style={{ ...S.card, overflow: "hidden", marginBottom: 12 }}>
            <div
              style={{
                padding: "12px 20px 10px",
                borderBottom: "1px solid #f1f5f9",
                background: "#fafafa",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <BsTable size={13} color="#4f46e5" />
                <span style={cardTitle}>Day-wise Summary</span>
              </div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 12,
                }}
              >
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {[
                      "#",
                      "Date",
                      "Week",
                      "Total",
                      "Avg UPH",
                      "vs Target",
                      "Score",
                      "Badge",
                      "Consistency",
                    ].map((h, i) => (
                      <th
                        key={h}
                        style={{
                          padding: "9px 14px",
                          textAlign: i === 0 ? "center" : "left",
                          fontWeight: 700,
                          color: "#475569",
                          borderBottom: "2px solid #e4e7ec",
                          whiteSpace: "nowrap",
                          fontSize: 11,
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...sortedDates]
                    .sort((a, b) => rowTotals[b] - rowTotals[a])
                    .map((d, i) => {
                      const score = perfScore(d);
                      const badge = perfBadge(score);
                      const tgtPct = pct(avgUPH[d], effectiveTarget);
                      const vals = activeHours
                        .map((h) => data[d]?.[h] || 0)
                        .filter((v) => v > 0);
                      const cv = dayCV(vals);
                      return (
                        <tr
                          key={d}
                          style={{
                            background: i % 2 === 0 ? "#fff" : "#fafcff",
                            borderBottom: "1px solid #f1f5f9",
                          }}
                        >
                          <td
                            style={{
                              padding: "9px 14px",
                              textAlign: "center",
                              color: "#94a3b8",
                            }}
                          >
                            {i + 1}
                          </td>
                          <td style={{ padding: "9px 14px" }}>
                            <span
                              className="mono"
                              style={{ fontWeight: 700, color: "#334155" }}
                            >
                              {d.slice(0, 5)}
                            </span>
                          </td>
                          <td
                            style={{
                              padding: "9px 14px",
                              fontSize: 11,
                              color: "#94a3b8",
                            }}
                          >
                            {getWeekKey(d)}
                          </td>
                          <td style={{ padding: "9px 14px" }}>
                            <span
                              className="mono"
                              style={{ fontWeight: 800, color: "#312e81" }}
                            >
                              {fmtN(rowTotals[d])}
                            </span>
                          </td>
                          <td style={{ padding: "9px 14px" }}>
                            <span
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 3,
                                fontWeight: 700,
                                color:
                                  avgUPH[d] >= overallAvg
                                    ? "#059669"
                                    : "#dc2626",
                              }}
                            >
                              {avgUPH[d] >= overallAvg ? (
                                <FiArrowUp size={10} />
                              ) : (
                                <FiArrowDown size={10} />
                              )}
                              <span className="mono">{avgUPH[d]}</span>
                            </span>
                          </td>
                          <td style={{ padding: "9px 14px" }}>
                            <span
                              className="mono"
                              style={{
                                fontWeight: 700,
                                color: tgtColor(tgtPct),
                              }}
                            >
                              {tgtPct}%
                            </span>
                          </td>
                          <td style={{ padding: "9px 14px" }}>
                            <span
                              className="mono"
                              style={{ fontWeight: 700, color: badge.color }}
                            >
                              {score}
                            </span>
                          </td>
                          <td style={{ padding: "9px 14px" }}>
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                background: badge.bg,
                                color: badge.color,
                                borderRadius: 5,
                                padding: "2px 8px",
                                border: `1px solid ${badge.border}`,
                              }}
                            >
                              {badge.label}
                            </span>
                          </td>
                          <td style={{ padding: "9px 14px" }}>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: cv < 30 ? "#059669" : "#d97706",
                              }}
                            >
                              CV {cv}% {cv < 30 ? "✓" : "⚠"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
                <tfoot>
                  <tr
                    style={{
                      background: "#eef2ff",
                      borderTop: "2px solid #c7d2fe",
                    }}
                  >
                    <td />
                    <td
                      colSpan={2}
                      style={{
                        padding: "10px 14px",
                        fontWeight: 800,
                        color: "#312e81",
                      }}
                    >
                      Grand Total / Avg
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span
                        className="mono"
                        style={{ fontWeight: 900, color: "#312e81" }}
                      >
                        {fmtN(grandTotal)}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span
                        className="mono"
                        style={{ fontWeight: 800, color: "#059669" }}
                      >
                        {overallAvg}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span
                        className="mono"
                        style={{
                          fontWeight: 800,
                          color:
                            pct(overallAvg, effectiveTarget) >= 100
                              ? "#059669"
                              : "#dc2626",
                        }}
                      >
                        {pct(overallAvg, effectiveTarget)}%
                      </span>
                    </td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Recommendations */}
          <div style={{ ...S.card, padding: 18 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 14,
              }}
            >
              <HiOutlineLightningBolt size={14} color="#d97706" />
              <span style={cardTitle}>Auto Recommendations</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                belowTarget.length >
                  dates.length * activeHours.length * 0.3 && {
                  icon: FiAlertTriangle,
                  color: "#d97706",
                  bg: "#fffbeb",
                  border: "#fcd34d",
                  text: `${Math.round(pct(belowTarget.length, dates.length * activeHours.length))}% of active hour slots are below the ${effectiveTarget} UPH target. Review staffing or machine efficiency during those hours.`,
                },
                trend &&
                  !trend.up && {
                    icon: FiTrendingDown,
                    color: "#dc2626",
                    bg: "#fef2f2",
                    border: "#fecaca",
                    text: `Production is trending down ${Math.abs(trend.pct)}% in the second half of the period. Investigate if linked to specific days or shift patterns.`,
                  },
                slotTotals.morning < slotTotals.afternoon && {
                  icon: FiInfo,
                  color: "#0891b2",
                  bg: "#e0f2fe",
                  border: "#7dd3fc",
                  text: `Morning output (08–11) is lower than afternoon. Consider front-loading production or reviewing morning shift efficiency.`,
                },
                pct(overallAvg, effectiveTarget) >= 100 && {
                  icon: FiStar,
                  color: "#059669",
                  bg: "#d1fae5",
                  border: "#6ee7b7",
                  text: `Overall average UPH (${overallAvg}) meets or exceeds the target of ${effectiveTarget}. Consider raising the target for the next period.`,
                },
              ]
                .filter(Boolean)
                .map((rec, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      padding: "10px 14px",
                      borderRadius: 10,
                      background: rec.bg,
                      border: `1px solid ${rec.border}`,
                    }}
                  >
                    <rec.icon
                      size={14}
                      color={rec.color}
                      style={{ flexShrink: 0, marginTop: 1 }}
                    />
                    <span
                      style={{
                        fontSize: 12,
                        color: "#334155",
                        lineHeight: 1.55,
                      }}
                    >
                      {rec.text}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
