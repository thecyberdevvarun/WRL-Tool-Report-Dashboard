import { useEffect, useMemo, useRef, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  Tooltip,
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { Chart } from "react-chartjs-2";
import { TimerBar } from "../../../components/display-module/TimerBar";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  ChartDataLabels,
  Tooltip,
);

/* ─────────────────────────────────────────────────────────────────────────
   RESPONSIVE SIZING
   HTML sizes are written as s(<px at 1920×1080>) and scale with this page's
   own container, so the layout looks the same on a 55" TV or a laptop.

   Chart.js draws on a canvas and can't use CSS units, so useScale() measures
   the same container and returns k (1 = 1920×1080). Chart fonts, line widths
   and offsets are multiplied by k.

   To make anything bigger or smaller, just change its number.
───────────────────────────────────────────────────────────────────────── */
const s = (px) => `calc(var(--u) * ${(px / 19.2).toFixed(4)})`;

const useScale = (ref) => {
  const [k, setK] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0 && h > 0) {
        setK(Math.round(Math.min(w / 1920, h / 1080) * 100) / 100);
      }
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, [ref]);
  return k;
};

const ACCENT = "#7c3aed";

const pad = (n) => String(n).padStart(2, "0");

const num = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const fmt = (v, digits = 0) => {
  const n = num(v);
  return n === null
    ? "—"
    : n.toLocaleString(undefined, { maximumFractionDigits: digits });
};

/* ── Live clock (header) ── */
const Clock = () => {
  const [t, setT] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span
      className="font-black font-mono tabular-nums leading-none"
      style={{ fontSize: s(52) }}
    >
      {pad(t.getHours())}:{pad(t.getMinutes())}:{pad(t.getSeconds())}
    </span>
  );
};

/* ── Stat tile ── */
const Tile = ({ label, value, sub, color }) => (
  <div
    className="min-w-0 bg-white border border-slate-200 shadow-sm flex flex-col justify-between"
    style={{
      borderLeft: `${s(12)} solid ${color}`,
      borderRadius: s(20),
      padding: `${s(16)} ${s(26)}`,
      gap: s(6),
    }}
  >
    <p
      className="font-bold text-slate-500 leading-tight whitespace-nowrap"
      style={{ fontSize: s(32) }}
    >
      {label}
    </p>
    <p
      className="font-black tabular-nums leading-none whitespace-nowrap"
      style={{ color, fontSize: s(100) }}
    >
      {value}
    </p>
    {sub !== undefined && (
      <p
        className="font-semibold text-slate-400 leading-tight whitespace-nowrap"
        style={{ fontSize: s(26) }}
      >
        {sub}
      </p>
    )}
  </div>
);

/* ═════════════════════════════════════════════════════════════════════════ */

const Hourly = ({ apiData = {}, progress, shift, shiftDate }) => {
  // API: hours = [{ HourNo, Actual }],  summary = { ShiftPlan, TotalAchieved, Remaining, ConsumedTimePct }
  const { hours = [], summary = {} } = apiData;

  const rootRef = useRef(null);
  const k = useScale(rootRef);

  const chartData = useMemo(
    () => ({
      labels: hours.map((h) => `H${h.HourNo}`),
      datasets: [
        {
          type: "bar",
          label: "Actual",
          data: hours.map((h) => Number(h.Actual) || 0),
          backgroundColor: "rgba(245,158,11,0.85)",
          borderColor: "#d97706",
          borderWidth: Math.max(1, Math.round(2 * k)),
          borderRadius: Math.round(12 * k),
          barPercentage: 0.7,
          categoryPercentage: 0.85,
        },
      ],
    }),
    [hours, k],
  );

  const chartOptions = useMemo(() => {
    const f = (px) => Math.max(10, Math.round(px * k));

    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      layout: {
        padding: {
          top: Math.round(70 * k),
          right: Math.round(16 * k),
          bottom: Math.round(20 * k),
          left: Math.round(6 * k),
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#1e293b",
          titleColor: "#f8fafc",
          bodyColor: "#e2e8f0",
          padding: Math.round(14 * k),
          cornerRadius: 10,
          titleFont: { size: f(22), weight: "bold" },
          bodyFont: { size: f(20) },
          boxPadding: 6,
          callbacks: {
            title: (items) => `Hour ${items[0].label}`,
          },
        },
        datalabels: {
          display: (ctx) => {
            const v = ctx.dataset.data[ctx.dataIndex];
            return v != null && v !== 0;
          },
          anchor: "end",
          align: "top",
          offset: Math.round(26 * k),
          color: "#92400e",
          backgroundColor: "rgba(255,255,255,0.95)",
          borderColor: "#fde68a",
          borderWidth: Math.max(1, Math.round(2 * k)),
          borderRadius: Math.round(10 * k),
          padding: {
            top: Math.round(5 * k),
            bottom: Math.round(5 * k),
            left: Math.round(10 * k),
            right: Math.round(10 * k),
          },
          font: { size: f(50), weight: 800 },
          formatter: (value) => (value != null && value !== 0 ? value : ""),
          clip: false,
          clamp: true,
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { color: "#e2e8f0" },
          ticks: {
            color: "#475569",
            font: { size: f(30), weight: "bold" },
            maxRotation: 0,
            padding: Math.round(8 * k),
          },
        },
        y: {
          position: "left",
          beginAtZero: true,
          border: { display: false },
          ticks: {
            color: "#64748b",
            font: { size: f(24), weight: 600 },
            padding: Math.round(10 * k),
          },
          grid: { color: "#f1f5f9", lineWidth: 1 },
          grace: "25%",
          title: {
            display: true,
            text: "Units Produced",
            color: "#64748b",
            font: { size: f(24), weight: "bold" },
          },
        },
      },
    };
  }, [k]);

  return (
    <div
      ref={rootRef}
      className="w-full h-full flex-1 min-h-0 flex flex-col bg-slate-100 overflow-hidden font-sans"
      style={{ containerType: "size", "--u": "min(1cqw, 1.7778cqh)" }}
    >
      {/* ── Header ── */}
      <header
        className="shrink-0 flex items-center justify-between text-white"
        style={{ background: ACCENT, padding: `${s(14)} ${s(36)}` }}
      >
        <h1
          className="font-black uppercase tracking-wide leading-none truncate min-w-0"
          style={{ fontSize: s(48) }}
        >
          Hourly Production Performance
        </h1>
        <div className="flex items-center shrink-0" style={{ gap: s(30) }}>
          <span
            className="bg-white font-black leading-none"
            style={{
              color: ACCENT,
              fontSize: s(42),
              padding: `${s(10)} ${s(28)}`,
              borderRadius: s(16),
            }}
          >
            Shift {shift}
          </span>
          <div className="flex flex-col items-end" style={{ gap: s(6) }}>
            <span
              className="font-semibold font-mono text-white/80 leading-none"
              style={{ fontSize: s(28) }}
            >
              {shiftDate}
            </span>
            <Clock />
          </div>
        </div>
      </header>
      <TimerBar progress={progress} accentHex={ACCENT} />

      {/* ── Body ── */}
      <div
        className="flex-1 min-h-0 flex flex-col"
        style={{ padding: `${s(18)} ${s(24)}`, gap: s(16) }}
      >
        {/* KPI row */}
        <div className="shrink-0 grid grid-cols-4" style={{ gap: s(16) }}>
          <Tile
            label="Shift Plan"
            value={fmt(summary.ShiftPlan)}
            color="#7c3aed"
          />
          <Tile
            label="Total Achieved"
            value={fmt(summary.TotalAchieved)}
            color="#15803d"
          />
          <Tile
            label="Remaining"
            value={fmt(summary.Remaining)}
            color="#ef4444"
          />
          <Tile
            label="Time Consumed"
            value={
              summary.ConsumedTimePct != null
                ? `${Number(summary.ConsumedTimePct).toFixed(0)}%`
                : "—"
            }
            sub="of shift elapsed"
            color="#f59e0b"
          />
        </div>

        {/* Chart card */}
        <section
          className="flex-1 min-h-0 min-w-0 bg-white border border-slate-200 shadow-sm flex flex-col"
          style={{
            borderRadius: s(24),
            padding: `${s(16)} ${s(28)} ${s(12)}`,
          }}
        >
          <div className="flex-1 relative min-h-0">
            <Chart
              key={`hrly-${hours.length}`}
              type="bar"
              data={chartData}
              options={chartOptions}
            />
          </div>
        </section>
      </div>
    </div>
  );
};

export default Hourly;
