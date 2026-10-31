import { useEffect, useMemo, useState } from "react";
import { PackageOpen } from "lucide-react";
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

const ACCENT = "#b45309";

/* How many station rows fit on screen (the rest are summarised as "+N more") */
const MAX_STATION_ROWS = 8;

/* A station with MORE stops than this is highlighted in red */
const HIGH_STOP_COUNT = 10;

/* ── helpers ── */
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

/* ── Stat tile (5 across) ── */
const Tile = ({ label, value, color }) => (
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
      style={{ fontSize: s(30) }}
    >
      {label}
    </p>
    <p
      className="font-black tabular-nums leading-none whitespace-nowrap"
      style={{ color, fontSize: s(88) }}
    >
      {value}
    </p>
  </div>
);

/* ════════════════════════════════════════════════════════════
   Pure SVG Doughnut — Consumed vs Remaining time
   (drawn in a 260×260 box and scales to fit)
═══════════════════════════════════════════════════════════ */
const SvgTimeDoughnut = ({ consumedPct = 0 }) => {
  const size = 260;
  const cx = size / 2;
  const cy = size / 2;
  const r = 95;
  const strokeW = 46;
  const circumference = 2 * Math.PI * r;

  const consumed = Math.min(Math.max(consumedPct, 0), 100);
  const remaining = Number((100 - consumed).toFixed(1));

  const segments = [
    { key: "consumed", value: consumed, color: "#f59e0b", label: "Consumed" },
    {
      key: "remaining",
      value: remaining,
      color: "#e2e8f0",
      label: "Remaining",
    },
  ].filter((seg) => seg.value > 0);

  const gap = segments.length > 1 ? 4 : 0;

  const polarToXY = (angleDeg, radius) => {
    const rad = (angleDeg - 90) * (Math.PI / 180);
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  };

  let cumulativeAngle = 0;
  const segmentData = segments.map((seg) => {
    const frac = seg.value / 100;
    const arcLen = frac * circumference;
    const startAngle = cumulativeAngle;
    const endAngle = cumulativeAngle + frac * 360;
    const midAngle = (startAngle + endAngle) / 2;
    cumulativeAngle = endAngle;
    return {
      ...seg,
      frac,
      arcLen,
      startOffset: -((startAngle / 360) * circumference),
      labelPos: polarToXY(midAngle, r),
      pct: seg.value.toFixed(1),
    };
  });

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="w-full h-full font-mono"
      preserveAspectRatio="xMidYMid meet"
    >
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="#f1f5f9"
        strokeWidth={strokeW}
      />

      {segmentData.map((seg) => (
        <circle
          key={seg.key}
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={seg.color}
          strokeWidth={strokeW}
          strokeDasharray={`${Math.max(seg.arcLen - gap, 0)} ${circumference}`}
          strokeDashoffset={seg.startOffset}
          strokeLinecap="butt"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: "stroke-dasharray 1s ease" }}
        />
      ))}

      {/* Segment labels — only if segment >= 12% */}
      {segmentData
        .filter((seg) => seg.frac >= 0.12)
        .map((seg) => {
          const isLight = seg.key === "remaining";
          const textColor = isLight ? "#475569" : "#ffffff";
          const shadow = isLight
            ? "drop-shadow(0 1px 2px rgba(255,255,255,0.8))"
            : "drop-shadow(0 1px 2px rgba(0,0,0,0.45))";
          return (
            <g key={`lbl-${seg.key}`} pointerEvents="none">
              <text
                x={seg.labelPos.x}
                y={seg.labelPos.y - 4}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={textColor}
                fontSize="20"
                fontWeight="900"
                style={{ filter: shadow }}
              >
                {seg.pct}%
              </text>
              <text
                x={seg.labelPos.x}
                y={seg.labelPos.y + 14}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={textColor}
                fontSize="11"
                fontWeight="800"
                letterSpacing="1"
                style={{ filter: shadow }}
              >
                {seg.label.toUpperCase()}
              </text>
            </g>
          );
        })}

      {/* Center */}
      <text
        x={cx}
        y={cy + 6}
        textAnchor="middle"
        fontSize="40"
        fontWeight="900"
        fill="#0f172a"
      >
        {consumed.toFixed(0)}%
      </text>
      <text
        x={cx}
        y={cy + 28}
        textAnchor="middle"
        fontSize="12"
        fontWeight="800"
        fill="#64748b"
        letterSpacing="1.5"
      >
        ELAPSED
      </text>
    </svg>
  );
};

/* ════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════ */
const Loss = ({ apiData = {}, progress, shift, shiftDate }) => {
  // API: stations = [{ StationName, TotalStopCount }]  (already sorted by stops, highest first)
  //      summary  = { Plan, Achieved, Remaining, ConsumedTimePct }
  const { stations = [], summary: ls = {} } = apiData;

  const consumedPct = Number(ls.ConsumedTimePct || 0);
  const consumedClamped = Math.min(Math.max(consumedPct, 0), 100);

  const totalStopCount = useMemo(
    () => stations.reduce((sum, st) => sum + (st.TotalStopCount ?? 0), 0),
    [stations],
  );

  const statusColor =
    consumedPct >= 90 ? "#dc2626" : consumedPct >= 70 ? "#f59e0b" : "#16a34a";
  const statusLabel =
    consumedPct >= 90 ? "CRITICAL" : consumedPct >= 70 ? "WARNING" : "ON TRACK";

  const shownStations = stations.slice(0, MAX_STATION_ROWS);
  const hiddenCount = Math.max(stations.length - shownStations.length, 0);

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
        <h1
          className="font-black uppercase tracking-wide leading-none truncate min-w-0"
          style={{ fontSize: s(48) }}
        >
          Loss Performance
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
        <div className="shrink-0 grid grid-cols-5" style={{ gap: s(16) }}>
          <Tile label="Plan" value={fmt(ls.Plan)} color="#7c3aed" />
          <Tile label="Achieved" value={fmt(ls.Achieved)} color="#15803d" />
          <Tile label="Balance" value={fmt(ls.Remaining)} color="#ef4444" />
          <Tile
            label="Total Stops"
            value={totalStopCount.toLocaleString()}
            color="#b45309"
          />
          <Tile label="Stations" value={fmt(stations.length)} color="#2563eb" />
        </div>

        {/* Middle */}
        <div className="flex-1 min-h-0 flex" style={{ gap: s(16) }}>
          {/* LEFT — Time doughnut */}
          <section
            className="min-w-0 min-h-0 flex flex-col shadow-md"
            style={{
              flex: "55 1 0%",
              borderRadius: s(24),
              border: `${s(4)} solid ${ACCENT}22`,
              padding: `${s(16)} ${s(28)}`,
              background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
            }}
          >
            <div className="shrink-0 text-center">
              <p
                className="font-black uppercase tracking-[0.2em] font-mono leading-none"
                style={{ color: ACCENT, fontSize: s(42) }}
              >
                Consumed Time
              </p>
              <p
                className="font-semibold text-slate-400 leading-none"
                style={{ fontSize: s(26), marginTop: s(8) }}
              >
                Shift Time Utilization
              </p>
            </div>

            <div className="flex-1 min-h-0" style={{ margin: `${s(6)} 0` }}>
              <SvgTimeDoughnut consumedPct={consumedPct} />
            </div>

            {/* Legend */}
            <div
              className="shrink-0 flex items-center justify-center font-bold text-slate-700"
              style={{ fontSize: s(28), gap: s(40) }}
            >
              {[
                {
                  c: "#f59e0b",
                  l: "Consumed",
                  p: consumedClamped.toFixed(1),
                },
                {
                  c: "#cbd5e1",
                  l: "Remaining",
                  p: (100 - consumedClamped).toFixed(1),
                },
              ].map((it) => (
                <span
                  key={it.l}
                  className="flex items-center"
                  style={{ gap: s(12) }}
                >
                  <span
                    className="rounded-full"
                    style={{ width: s(26), height: s(26), background: it.c }}
                  />
                  {it.l}
                  <span className="font-mono text-slate-400">{it.p}%</span>
                </span>
              ))}
            </div>

            {/* Stops badge + status */}
            <div
              className="shrink-0 flex items-center justify-center"
              style={{ gap: s(28), marginTop: s(12) }}
            >
              <div
                className="text-white font-black font-mono tracking-[0.1em] leading-none"
                style={{
                  background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT}dd)`,
                  boxShadow: `0 8px 30px ${ACCENT}40`,
                  fontSize: s(72),
                  padding: `${s(12)} ${s(40)}`,
                  borderRadius: s(24),
                }}
              >
                {totalStopCount.toLocaleString()}
                <span
                  className="text-white/60"
                  style={{ fontSize: s(34), marginLeft: s(10) }}
                >
                  stops
                </span>
              </div>

              <span
                className="inline-flex items-center text-white font-black tracking-wider leading-none"
                style={{
                  background: statusColor,
                  fontSize: s(36),
                  padding: `${s(12)} ${s(30)}`,
                  borderRadius: s(999),
                  gap: s(14),
                }}
              >
                <span
                  className="inline-block rounded-full bg-white animate-pulse"
                  style={{ width: s(18), height: s(18) }}
                />
                {statusLabel}
                <span className="font-mono text-white/80">
                  {consumedPct.toFixed(1)}%
                </span>
              </span>
            </div>
          </section>

          {/* RIGHT — Station-wise loss */}
          <section
            className="min-w-0 min-h-0 flex flex-col bg-white border border-slate-200 shadow-sm overflow-hidden"
            style={{ flex: "45 1 0%", borderRadius: s(24) }}
          >
            <div
              className="shrink-0 text-white font-black uppercase tracking-wider text-center leading-none"
              style={{
                background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT}cc)`,
                fontSize: s(36),
                padding: `${s(18)} ${s(20)}`,
              }}
            >
              Station-wise Loss Breakdown
            </div>

            {shownStations.length > 0 ? (
              <div className="flex-1 min-h-0 flex flex-col">
                {shownStations.map((st, i) => {
                  const isHigh = (st.TotalStopCount ?? 0) > HIGH_STOP_COUNT;
                  const rowBg = isHigh
                    ? "#fef3c7"
                    : i % 2 === 0
                      ? "#ffffff"
                      : "#f8fafc";
                  return (
                    <div
                      key={i}
                      className="flex items-center border-b border-slate-100"
                      style={{
                        background: rowBg,
                        flex: "1 1 0%",
                        maxHeight: s(110),
                        minHeight: 0,
                        padding: `0 ${s(24)}`,
                        gap: s(20),
                      }}
                    >
                      <span
                        className={`shrink-0 inline-flex items-center justify-center rounded-full font-black font-mono border ${
                          isHigh
                            ? "bg-red-100 text-red-700 border-red-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                        style={{
                          width: s(54),
                          height: s(54),
                          fontSize: s(28),
                        }}
                      >
                        {i + 1}
                      </span>
                      <span
                        className="flex-1 min-w-0 flex items-center font-bold text-slate-700"
                        style={{ fontSize: s(34), gap: s(12) }}
                      >
                        {isHigh && (
                          <span
                            className="shrink-0 rounded-full bg-red-500 animate-pulse"
                            style={{ width: s(16), height: s(16) }}
                          />
                        )}
                        <span className="truncate">{st.StationName}</span>
                      </span>
                      <span
                        className={`shrink-0 font-black font-mono tabular-nums leading-none border ${
                          isHigh
                            ? "bg-red-50 text-red-600 border-red-200"
                            : "bg-amber-50 text-amber-600 border-amber-200"
                        }`}
                        style={{
                          fontSize: s(44),
                          padding: `${s(6)} ${s(20)}`,
                          borderRadius: s(14),
                        }}
                      >
                        {st.TotalStopCount}
                      </span>
                    </div>
                  );
                })}
                {hiddenCount > 0 && (
                  <p
                    className="shrink-0 text-center font-semibold text-slate-400"
                    style={{ fontSize: s(26), padding: `${s(8)} 0` }}
                  >
                    +{hiddenCount} more station{hiddenCount > 1 ? "s" : ""}
                  </p>
                )}
              </div>
            ) : (
              <div
                className="flex-1 flex flex-col items-center justify-center text-slate-400"
                style={{ gap: s(16) }}
              >
                <PackageOpen
                  className="opacity-20"
                  style={{ width: s(130), height: s(130) }}
                  strokeWidth={1.2}
                />
                <p className="font-bold" style={{ fontSize: s(38) }}>
                  No loss data recorded this shift
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default Loss;
