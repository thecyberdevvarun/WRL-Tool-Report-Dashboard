import { useEffect, useState } from "react";
import { Flame } from "lucide-react";
import { TimerBar } from "../../../components/display-module/TimerBar";

/* ─────────────────────────────────────────────────────────────────────────
   RESPONSIVE SIZING (same system as the other display pages)
   s(<px at 1920×1080>) → unit relative to this page's own container.
───────────────────────────────────────────────────────────────────────── */
const s = (px) => `calc(var(--u) * ${(px / 19.2).toFixed(4)})`;

const ACCENT = "#ea580c";
const GREEN = "#16a34a";
const AMBER = "#f59e0b";
const RED = "#dc2626";

/* Leakage-rate colours: up to LEAK_WARN_PCT = green, up to LEAK_HIGH_PCT = amber, above = red */
const LEAK_WARN_PCT = 1;
const LEAK_HIGH_PCT = 3;

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

const leakColor = (pct) =>
  pct > LEAK_HIGH_PCT ? RED : pct > LEAK_WARN_PCT ? AMBER : GREEN;

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
const Tile = ({ label, value, unit, color }) => (
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
      {unit && (
        <span
          className="font-bold text-slate-400"
          style={{ fontSize: "0.42em", marginLeft: "0.15em" }}
        >
          {unit}
        </span>
      )}
    </p>
  </div>
);

/* ── Ranked list card (brazers / stations / leaking joints) ──
   rows: [{ name, sub?, joints, leakage, leakagePct }] */
const RankCard = ({ title, rows, max, emptyText, compact = false, flex }) => {
  const shown = rows.slice(0, max);
  const hidden = Math.max(rows.length - shown.length, 0);
  const z = compact
    ? { rank: 44, rankFont: 24, name: 30, sub: 20, chip: 34, padY: 2 }
    : { rank: 54, rankFont: 28, name: 34, sub: 22, chip: 44, padY: 6 };

  return (
    <section
      className="min-w-0 min-h-0 flex flex-col bg-white border border-slate-200 shadow-sm overflow-hidden"
      style={{ flex, borderRadius: s(24) }}
    >
      <div
        className="shrink-0 text-white font-black uppercase tracking-wider text-center leading-none"
        style={{
          background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT}cc)`,
          fontSize: s(compact ? 30 : 36),
          padding: `${s(compact ? 14 : 18)} ${s(20)}`,
        }}
      >
        {title}
      </div>

      {shown.length > 0 ? (
        <div className="flex-1 min-h-0 flex flex-col">
          {shown.map((r, i) => {
            const high = r.leakagePct > LEAK_HIGH_PCT;
            const leaked = r.leakage > 0;
            return (
              <div
                key={`${r.name}-${i}`}
                className="flex items-center border-b border-slate-100"
                style={{
                  background: high
                    ? "#fef3c7"
                    : i % 2 === 0
                      ? "#fff"
                      : "#f8fafc",
                  flex: "1 1 0%",
                  maxHeight: s(110),
                  minHeight: 0,
                  padding: `0 ${s(24)}`,
                  gap: s(18),
                }}
              >
                <span
                  className={`shrink-0 inline-flex items-center justify-center rounded-full font-black font-mono border ${
                    i === 0
                      ? "bg-orange-100 text-orange-700 border-orange-200"
                      : "bg-slate-100 text-slate-600 border-slate-200"
                  }`}
                  style={{
                    width: s(z.rank),
                    height: s(z.rank),
                    fontSize: s(z.rankFont),
                  }}
                >
                  {i + 1}
                </span>

                <span className="flex-1 min-w-0 flex flex-col justify-center">
                  <span
                    className="truncate font-bold text-slate-700 leading-tight"
                    style={{ fontSize: s(z.name) }}
                  >
                    {r.name}
                  </span>
                  {r.sub && (
                    <span
                      className="truncate font-semibold text-slate-400 leading-tight"
                      style={{ fontSize: s(z.sub) }}
                    >
                      {r.sub}
                    </span>
                  )}
                </span>

                <span
                  className="shrink-0 font-black font-mono tabular-nums leading-none border bg-orange-50 text-orange-600 border-orange-200"
                  style={{
                    fontSize: s(z.chip),
                    padding: `${s(z.padY)} ${s(16)}`,
                    borderRadius: s(14),
                  }}
                >
                  {fmt(r.joints)}
                  <span
                    className="text-orange-400 font-bold"
                    style={{ fontSize: "0.5em", marginLeft: "0.3em" }}
                  >
                    brazed
                  </span>
                </span>

                <span
                  className={`shrink-0 font-black font-mono tabular-nums leading-none border ${
                    leaked
                      ? "bg-red-50 text-red-600 border-red-200"
                      : "bg-green-50 text-green-600 border-green-200"
                  }`}
                  style={{
                    fontSize: s(z.chip),
                    padding: `${s(z.padY)} ${s(16)}`,
                    borderRadius: s(14),
                  }}
                >
                  {fmt(r.leakage)}
                  <span
                    className="font-bold opacity-70"
                    style={{ fontSize: "0.5em", marginLeft: "0.3em" }}
                  >
                    {leaked ? `leaks · ${r.leakagePct}%` : "leaks"}
                  </span>
                </span>
              </div>
            );
          })}
          {hidden > 0 && (
            <p
              className="shrink-0 text-center font-semibold text-slate-400"
              style={{ fontSize: s(24), padding: `${s(6)} 0` }}
            >
              +{hidden} more
            </p>
          )}
        </div>
      ) : (
        <div
          className="flex-1 flex flex-col items-center justify-center text-slate-400"
          style={{ gap: s(10) }}
        >
          <Flame
            className="opacity-20"
            style={{
              width: s(compact ? 70 : 110),
              height: s(compact ? 70 : 110),
            }}
            strokeWidth={1.2}
          />
          <p className="font-bold" style={{ fontSize: s(compact ? 28 : 36) }}>
            {emptyText}
          </p>
        </div>
      )}
    </section>
  );
};

/* ═════════════════════════════════════════════════════════════════════════ */

const BrazingDashboard = ({
  apiData = {},
  progress,
  shift,
  shiftDate,
  config,
}) => {
  // API: summary = { totalJoints, leakage, leakagePct, brazerCount, stationCount }
  //      brazers / stations / joints = [{ name, joints, leakage, leakagePct, ... }]
  const { summary = {}, brazers = [], stations = [], joints = [] } = apiData;
  const isAll = config?.key === "all";
  const rate = num(summary.leakagePct) ?? 0;

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
          {config?.name} Performance
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
          <Tile
            label="Joints Brazed"
            value={fmt(summary.totalJoints)}
            color={ACCENT}
          />
          <Tile label="Leakage" value={fmt(summary.leakage)} color={RED} />
          <Tile
            label="Leakage Rate"
            value={fmt(rate, 1)}
            unit="%"
            color={leakColor(rate)}
          />
          <Tile
            label="Brazers"
            value={fmt(summary.brazerCount)}
            color="#2563eb"
          />
          <Tile
            label="Stations"
            value={fmt(summary.stationCount)}
            color="#64748b"
          />
        </div>

        {/* Lists */}
        <div className="flex-1 min-h-0 flex" style={{ gap: s(16) }}>
          <RankCard
            flex="50 1 0%"
            title="Brazer-wise Output"
            rows={brazers}
            max={8}
            emptyText="No joints brazed this shift"
          />

          <div
            className="min-w-0 min-h-0 flex flex-col"
            style={{ flex: "50 1 0%", gap: s(16) }}
          >
            <RankCard
              compact
              flex="1 1 0%"
              title="Station-wise Output"
              rows={stations.map((st) => ({
                ...st,
                sub: isAll ? st.line : undefined,
              }))}
              max={4}
              emptyText="No station data"
            />
            <RankCard
              compact
              flex="1 1 0%"
              title="Top Leaking Joints"
              rows={joints.map((j) => ({
                ...j,
                sub: [j.description, isAll ? j.line : null]
                  .filter(Boolean)
                  .join(" · "),
              }))}
              max={4}
              emptyText="No leakage recorded"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrazingDashboard;
