import { useEffect, useState } from "react";
import { TimerBar } from "../../../components/display-module/TimerBar";

/* ─────────────────────────────────────────────────────────────────────────
   RESPONSIVE SIZING
   Every size on this page is written as s(<px at 1920×1080>) and converted to
   a unit relative to THIS page's own container (CSS container query units):

     1 unit = min(1% of page width, 1.78% of page height)

   So the page keeps the same proportions on a 55" TV, a laptop, or any
   window size. To make something bigger or smaller, just change the number.
───────────────────────────────────────────────────────────────────────── */
const s = (px) => `calc(var(--u) * ${(px / 19.2).toFixed(4)})`;

const ACCENT = "#0f766e";
const GREEN = "#16a34a";
const AMBER = "#d97706";
const RED = "#dc2626";
const SLATE = "#64748b";

/* Gauge scale (same as your original maxValue) */
const GAUGE_MAX = 1000;

/* ── helpers ── */
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

const pad = (n) => String(n).padStart(2, "0");

/* Performance colour */
const perfColor = (pct) =>
  pct === null ? SLATE : pct >= 90 ? GREEN : pct >= 70 ? AMBER : RED;

/* Gauge status — same rules as the original gauge (80% / 50% of max) */
const gaugeStatus = (pct) =>
  pct >= 80
    ? { color: GREEN, text: "ON TRACK" }
    : pct >= 50
      ? { color: AMBER, text: "WARNING" }
      : { color: RED, text: "CRITICAL" };

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

/* ── Stat tile (top row and monthly row) ── */
const Tile = ({ label, value, unit, sub, color, big = true }) => (
  <div
    className="min-w-0 bg-white border border-slate-200 shadow-sm flex flex-col justify-between"
    style={{
      borderLeft: `${s(12)} solid ${color}`,
      borderRadius: s(20),
      padding: `${s(16)} ${s(22)}`,
      gap: s(6),
    }}
  >
    <p
      className="font-bold text-slate-500 leading-tight whitespace-nowrap"
      style={{ fontSize: s(big ? 30 : 27) }}
    >
      {label}
    </p>
    <p
      className="font-black tabular-nums leading-none whitespace-nowrap"
      style={{ color, fontSize: s(big ? 92 : 76) }}
    >
      {value}
      {unit && (
        <span
          className="font-bold text-slate-400"
          style={{ fontSize: "0.42em", marginLeft: "0.15em" }}
        >
          {unit}
        </span>
      )}
    </p>
    {sub !== undefined && (
      <p
        className="font-semibold text-slate-400 leading-tight whitespace-nowrap"
        style={{ fontSize: s(24) }}
      >
        {sub}
      </p>
    )}
  </div>
);

/* ── Semicircle gauge (pure SVG — scales to any size) ── */
const ARC = "M 20 210 A 180 180 0 0 1 380 210";

const Gauge = ({ value, max, color }) => {
  const v = num(value) ?? 0;
  const pct = max > 0 ? Math.min(Math.max(v / max, 0), 1) : 0;

  return (
    <svg
      viewBox="0 0 400 250"
      className="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <path
        d={ARC}
        fill="none"
        stroke="#e2e8f0"
        strokeWidth="46"
        pathLength="100"
      />
      <path
        d={ARC}
        fill="none"
        stroke={color}
        strokeWidth="46"
        pathLength="100"
        strokeDasharray={`${pct * 100} 100`}
        style={{ transition: "stroke-dasharray 1.2s ease" }}
      />
      <text
        x="200"
        y="205"
        textAnchor="middle"
        fontSize="104"
        fontWeight="900"
        fill={color}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {fmt(value)}
      </text>
      <text
        x="20"
        y="242"
        textAnchor="middle"
        fontSize="22"
        fontWeight="600"
        fill="#94a3b8"
      >
        0
      </text>
      <text
        x="380"
        y="242"
        textAnchor="middle"
        fontSize="22"
        fontWeight="600"
        fill="#94a3b8"
      >
        {fmt(max)}
      </text>
    </svg>
  );
};

/* ═════════════════════════════════════════════════════════════════════════ */

const ProductionDisplay2 = ({
  apiData = {},
  progress,
  shift,
  shiftDate,
  config,
}) => {
  const d = apiData;
  const label = config?.stationName2 || "FG LOADING";


const dailyTarget = Number(
  config?.dailyProductionTarget2 ??
  config?.DailyProductionTarget2 ??
  d.dailyProductionTarget2 ??
  d.DailyProductionTarget2 ??
  0
);

const actualQty = Number(d.ActualQty ?? 0);

const balance = dailyTarget - actualQty;

  const perf = num(d.PerformancePct);

  /* Gauge */
  const gaugeValue = Math.min(Math.max(num(d.GaugeValue) ?? 0, 0), GAUGE_MAX);
  const gaugePct = (gaugeValue / GAUGE_MAX) * 100;
  const status = gaugeStatus(gaugePct);

  return (
    <div
      className="w-full h-full flex-1 min-h-0 flex flex-col bg-slate-100 overflow-hidden font-sans"
      style={{ containerType: "size", "--u": "min(1cqw, 1.7778cqh)" }}
    >
      {/* ── Header ── */}
      <header
        className="shrink-0 flex items-center justify-between text-white"
        style={{ background: ACCENT, padding: `${s(14)} ${s(36)}` }}
      >
        <div className="min-w-0">
          <h1
            className="font-black uppercase tracking-wide leading-none truncate"
            style={{ fontSize: s(48) }}
          >
            Final Area FG Loading Production Performance
          </h1>
        </div>
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
        {/* Top KPI row */}
        <div className="shrink-0 grid grid-cols-5" style={{ gap: s(16) }}>
          <Tile label="Daily Target" value={fmt(config?.dailyProductionTarget2 ?? config?.DailyProductionTarget2)} color="#7c3aed" />
          <Tile label="Shift Output" value={fmt(d.ActualQty)} color={ACCENT} />
          <Tile
            label="Performance"
            value={fmt(perf, 1)}
            unit="%"
            color={perfColor(perf)}
          />
          <Tile label="Loss Units" value={fmt(d.LossUnits)} color={RED} />
          <Tile label="Balance Qty" value={fmt(balance)} color="#b45309" />
        </div>

        {/* Gauge */}
        <section
          className="flex-1 min-h-0 min-w-0 bg-white flex flex-col shadow-md"
          style={{
            borderRadius: s(24),
            border: `${s(4)} solid ${ACCENT}22`,
            padding: `${s(16)} ${s(28)}`,
            background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
          }}
        >
          <div className="shrink-0 text-center">
            <p
              className="font-black uppercase tracking-[0.2em] font-mono leading-none"
              style={{ color: ACCENT, fontSize: s(44) }}
            >
              {label}
            </p>
            <p
              className="font-semibold text-slate-400 leading-none"
              style={{ fontSize: s(28), marginTop: s(8) }}
            >
              Units / Shift
            </p>
          </div>

          <div className="flex-1 min-h-0">
            <Gauge value={gaugeValue} max={GAUGE_MAX} color={status.color} />
          </div>

          <div
            className="shrink-0 flex items-center justify-center"
            style={{ gap: s(18) }}
          >
            <span
              className="inline-flex items-center text-white font-black tracking-wider leading-none"
              style={{
                background: status.color,
                fontSize: s(40),
                padding: `${s(10)} ${s(32)}`,
                borderRadius: s(999),
                gap: s(14),
              }}
            >
              <span
                className="inline-block rounded-full bg-white animate-pulse"
                style={{ width: s(18), height: s(18) }}
              />
              {status.text}
            </span>
            <span
              className="font-black font-mono text-slate-500 leading-none"
              style={{ fontSize: s(40) }}
            >
              {gaugePct.toFixed(1)}%
            </span>
          </div>
        </section>

        {/* Monthly row */}
        <div className="shrink-0 grid grid-cols-5" style={{ gap: s(16) }}>
          <Tile
            big={false}
            label="Monthly Plan"
            value={fmt(d.MonthlyPlanQty)}
            color={ACCENT}
          />
          <Tile
            big={false}
            label="Monthly Achievement"
            value={fmt(d.MonthlyAchieved)}
            color="#15803d"
          />
          <Tile
            big={false}
            label="Remaining Qty"
            value={fmt(d.MonthlyRemaining)}
            color="#b45309"
          />
          <Tile
            big={false}
            label="Asking Rate"
            value={fmt(d.AskingRate)}
            sub="Units / Day"
            color="#0f766e"
          />
          <Tile
            big={false}
            label="Remaining Days"
            value={fmt(d.RemainingDays)}
            color="#64748b"
          />
        </div>
      </div>
    </div>
  );
};

export default ProductionDisplay2;
