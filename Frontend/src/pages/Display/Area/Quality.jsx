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

const ACCENT = "#15803d";
const RED = "#dc2626";
const AMBER = "#f59e0b";

/* How many defect rows fit on screen (the rest are summarised as "+N more") */
const MAX_DEFECT_ROWS = 8;

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

/* ── Stat tile (7 across) ── */
const Tile = ({ label, value, sub, color }) => (
  <div
    className="min-w-0 bg-white border border-slate-200 shadow-sm flex flex-col justify-between"
    style={{
      borderLeft: `${s(10)} solid ${color}`,
      borderRadius: s(18),
      padding: `${s(14)} ${s(16)}`,
      gap: s(4),
    }}
  >
    <p
      className="font-bold text-slate-500 leading-tight whitespace-nowrap"
      style={{ fontSize: s(26) }}
    >
      {label}
    </p>
    <p
      className="font-black tabular-nums leading-none whitespace-nowrap"
      style={{ color, fontSize: s(66) }}
    >
      {value}
    </p>
    {sub !== undefined && (
      <p
        className="font-semibold text-slate-400 leading-tight whitespace-nowrap"
        style={{ fontSize: s(22) }}
      >
        {sub}
      </p>
    )}
  </div>
);

/* ════════════════════════════════════════════════════════════
   Pure SVG Doughnut — 3 segments: OK / Defect / Rework
   (everything is drawn in a 260×260 box and scales to fit)
═══════════════════════════════════════════════════════════ */
const SvgDoughnut = ({ ok = 0, defect = 0, rework = 0, total = 0 }) => {
  const size = 260;
  const cx = size / 2;
  const cy = size / 2;
  const r = 95;
  const strokeW = 46;
  const circumference = 2 * Math.PI * r;
  const sum = ok + defect + rework;

  const segments = [
    { key: "ok", value: ok, color: "#15803d" },
    { key: "defect", value: defect, color: "#dc2626" },
    { key: "rework", value: rework, color: "#f59e0b" },
  ].filter((seg) => seg.value > 0);

  const gap = segments.length > 1 ? 4 : 0;

  const polarToXY = (angleDeg, radius) => {
    const rad = (angleDeg - 90) * (Math.PI / 180);
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  };

  let cumulativeAngle = 0;
  const segmentData = segments.map((seg) => {
    const frac = seg.value / sum;
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
      pct: ((seg.value / sum) * 100).toFixed(1),
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

      {sum > 0 &&
        segmentData.map((seg) => (
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

      {/* Segment labels — only if segment >= 10% */}
      {segmentData
        .filter((seg) => seg.frac >= 0.1)
        .map((seg) => (
          <g key={`lbl-${seg.key}`} pointerEvents="none">
            <text
              x={seg.labelPos.x}
              y={seg.labelPos.y - 6}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#ffffff"
              fontSize="21"
              fontWeight="900"
              style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.45))" }}
            >
              {seg.value.toLocaleString()}
            </text>
            <text
              x={seg.labelPos.x}
              y={seg.labelPos.y + 15}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#ffffff"
              fontSize="15"
              fontWeight="800"
              style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.45))" }}
            >
              {seg.pct}%
            </text>
          </g>
        ))}

      {/* Center */}
      <text
        x={cx}
        y={cy + 4}
        textAnchor="middle"
        fontSize="34"
        fontWeight="900"
        fill={sum > 0 ? "#0f172a" : "#cbd5e1"}
      >
        {sum > 0 ? Number(total).toLocaleString() : "0"}
      </text>
      <text
        x={cx}
        y={cy + 26}
        textAnchor="middle"
        fontSize="12"
        fontWeight="800"
        fill="#64748b"
        letterSpacing="1.5"
      >
        {sum > 0 ? "TOTAL UNITS" : "NO DATA"}
      </text>
    </svg>
  );
};

/* ════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════ */
const Quality = ({ apiData = {}, progress, shift, shiftDate }) => {
  // API: summary = { Plan, TotalAchieved, OkUnit, DefectUnit, ReworkDone, OkPct, DefectPct }
  //      defects = [{ DefectName, DefectCount }]
  const { summary: qs = {}, defects = [] } = apiData;

  const ok = Number(qs.OkUnit) || 0;
  const defect = Number(qs.DefectUnit) || 0;
  const rework = Number(qs.ReworkDone) || 0;
  const total = Number(qs.TotalAchieved) || ok + defect + rework;

  // Percentages — denominator = TotalAchieved (matches the cards)
  const okPct = Number(
    qs.OkPct ?? (total > 0 ? ((ok / total) * 100).toFixed(1) : 0),
  );
  const reworkPct = total > 0 ? ((rework / total) * 100).toFixed(1) : "0.0";
  const defPct = Number(
    qs.DefectPct ?? (total > 0 ? ((defect / total) * 100).toFixed(1) : 0),
  );

  const statusColor = okPct >= 90 ? "#16a34a" : okPct >= 70 ? AMBER : RED;
  const statusLabel =
    okPct >= 90 ? "ON TRACK" : okPct >= 70 ? "WARNING" : "CRITICAL";

  const shownDefects = defects.slice(0, MAX_DEFECT_ROWS);
  const hiddenCount = Math.max(defects.length - shownDefects.length, 0);

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
          Quality Performance
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
        <div className="shrink-0 grid grid-cols-7" style={{ gap: s(14) }}>
          <Tile label="Plan" value={fmt(qs.Plan)} color="#7c3aed" />
          <Tile
            label="Achieved"
            value={fmt(qs.TotalAchieved)}
            color="#15803d"
          />
          <Tile label="OK Units" value={fmt(qs.OkUnit)} color="#059669" />
          <Tile label="Defects" value={fmt(qs.DefectUnit)} color="#ef4444" />
          <Tile
            label="Rework Done"
            value={fmt(qs.ReworkDone)}
            color="#f59e0b"
          />
          <Tile
            label="OK %"
            value={qs.OkPct != null ? `${qs.OkPct}%` : "—"}
            sub="First pass yield"
            color="#0f766e"
          />
          <Tile
            label="Defect %"
            value={qs.DefectPct != null ? `${qs.DefectPct}%` : "—"}
            color="#dc2626"
          />
        </div>

        {/* Middle */}
        <div className="flex-1 min-h-0 flex" style={{ gap: s(16) }}>
          {/* LEFT — Doughnut */}
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
                Quality Overview
              </p>
              <p
                className="font-semibold text-slate-400 leading-none"
                style={{ fontSize: s(26), marginTop: s(8) }}
              >
                OK · Defect · Rework Distribution
              </p>
            </div>

            <div className="flex-1 min-h-0" style={{ margin: `${s(6)} 0` }}>
              <SvgDoughnut
                ok={ok}
                defect={defect}
                rework={rework}
                total={total}
              />
            </div>

            {/* Legend */}
            <div
              className="shrink-0 flex items-center justify-center font-bold text-slate-700"
              style={{ fontSize: s(28), gap: s(40) }}
            >
              {[
                { c: "#15803d", l: "OK", p: okPct.toFixed(1) },
                { c: "#dc2626", l: "Defect", p: defPct.toFixed(1) },
                { c: "#f59e0b", l: "Rework", p: reworkPct },
              ].map((it) => (
                <span
                  key={it.l}
                  className="flex items-center"
                  style={{ gap: s(12) }}
                >
                  <span
                    className="rounded-full"
                    style={{
                      width: s(26),
                      height: s(26),
                      background: it.c,
                    }}
                  />
                  {it.l}
                  <span className="font-mono text-slate-400">{it.p}%</span>
                </span>
              ))}
            </div>

            {/* OK badge + status */}
            <div
              className="shrink-0 flex items-center justify-center"
              style={{ gap: s(28), marginTop: s(12) }}
            >
              <div
                className="text-white font-black font-mono tracking-[0.12em] leading-none"
                style={{
                  background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT}dd)`,
                  boxShadow: `0 8px 30px ${ACCENT}40`,
                  fontSize: s(72),
                  padding: `${s(12)} ${s(40)}`,
                  borderRadius: s(24),
                }}
              >
                {String(ok).padStart(3, "0")}
                <span
                  className="text-white/60"
                  style={{ fontSize: s(34), marginLeft: s(10) }}
                >
                  OK
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
                  {okPct.toFixed(1)}%
                </span>
              </span>
            </div>
          </section>

          {/* RIGHT — Top defects */}
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
              Top Defects Today
            </div>

            {shownDefects.length > 0 ? (
              <div className="flex-1 min-h-0 flex flex-col">
                {shownDefects.map((df, i) => {
                  const isTop = i < 3;
                  return (
                    <div
                      key={i}
                      className={`flex items-center border-b border-slate-100 ${
                        i % 2 === 0 ? "bg-white" : "bg-slate-50"
                      }`}
                      style={{
                        flex: "1 1 0%",
                        maxHeight: s(110),
                        minHeight: 0,
                        padding: `0 ${s(24)}`,
                        gap: s(20),
                      }}
                    >
                      <span
                        className={`shrink-0 inline-flex items-center justify-center rounded-full font-black font-mono border ${
                          isTop
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
                        {isTop && (
                          <span
                            className="shrink-0 rounded-full bg-red-500 animate-pulse"
                            style={{ width: s(14), height: s(14) }}
                          />
                        )}
                        <span className="truncate">{df.DefectName}</span>
                      </span>
                      <span
                        className={`shrink-0 font-black font-mono tabular-nums leading-none border ${
                          isTop
                            ? "bg-red-50 text-red-600 border-red-200"
                            : "bg-amber-50 text-amber-600 border-amber-200"
                        }`}
                        style={{
                          fontSize: s(44),
                          padding: `${s(6)} ${s(20)}`,
                          borderRadius: s(14),
                        }}
                      >
                        {df.DefectCount}
                      </span>
                    </div>
                  );
                })}
                {hiddenCount > 0 && (
                  <p
                    className="shrink-0 text-center font-semibold text-slate-400"
                    style={{ fontSize: s(26), padding: `${s(8)} 0` }}
                  >
                    +{hiddenCount} more defect type
                    {hiddenCount > 1 ? "s" : ""}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                <span style={{ fontSize: s(110) }}>✓</span>
                <p className="font-bold" style={{ fontSize: s(38) }}>
                  No defects recorded this shift
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default Quality;
