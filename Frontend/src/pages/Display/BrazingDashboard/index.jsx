import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Calendar,
  Flame,
  Loader2,
  PackageOpen,
  Video,
  WifiOff,
  X,
} from "lucide-react";
import {
  BRAZING_LINES,
  REFRESH_MS,
  SHIFT_HOURS,
  detectCurrentShift,
  effPct,
  effTone,
  fetchBrazing,
  fmt,
  num,
} from "./brazing.config";

/* ─────────────────────────────────────────────────────────────────────────
   SIZING — same system as the Production dashboard.
   Write sizes as s(<px at 1920×1080>); they scale with the page container.
───────────────────────────────────────────────────────────────────────── */
const s = (px) => `calc(var(--u) * ${(px / 19.2).toFixed(4)})`;

const DESIGN_W = 1920;
const EMBER = "#c2410c";
const OK_GREEN = "#15803d";
const NOT_OK_RED = "#dc2626";

const pad = (n) => String(n).padStart(2, "0");

/* Scales the 1920px design to the real window (TV, laptop, any display scaling) */
const useFitScale = () => {
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const onResize = () =>
      setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const scale = vp.w / DESIGN_W;
  return { scale, canvasH: vp.h / scale };
};

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

/* ── KPI tile (shift totals) ── */
const Tile = ({ label, value, color }) => (
  <div
    className="min-w-0 bg-white border border-slate-200 shadow-sm flex flex-col justify-between"
    style={{
      borderLeft: `${s(12)} solid ${color}`,
      borderRadius: s(20),
      padding: `${s(14)} ${s(26)}`,
      gap: s(4),
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
      style={{ color, fontSize: s(84) }}
    >
      {value}
    </p>
  </div>
);

/* ── Camera feed with a clear fallback when the image can't load ── */
const Camera = ({ src, name }) => {
  const [bad, setBad] = useState(false);
  return (
    <div
      className="relative w-full h-full overflow-hidden bg-slate-900 flex items-center justify-center"
      style={{ borderRadius: s(16) }}
    >
      {src && !bad ? (
        <img
          src={src}
          alt={`${name} camera`}
          onError={() => setBad(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <div
          className="flex flex-col items-center text-slate-500"
          style={{ gap: s(10) }}
        >
          <Video style={{ width: s(72), height: s(72) }} strokeWidth={1.4} />
          <p className="font-semibold" style={{ fontSize: s(26) }}>
            Camera not available
          </p>
        </div>
      )}
    </div>
  );
};

/* ── Operator photo with initials fallback ── */
const Avatar = ({ src, name }) => {
  const [bad, setBad] = useState(false);
  const initials = (name || "?")
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div
      className="shrink-0 overflow-hidden bg-slate-100 flex items-center justify-center"
      style={{ width: s(140), height: s(160), borderRadius: s(18) }}
    >
      {src && !bad ? (
        <img
          src={src}
          alt={name}
          onError={() => setBad(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <span className="font-black text-slate-400" style={{ fontSize: s(52) }}>
          {initials}
        </span>
      )}
    </div>
  );
};

/* ── Efficiency ring ── */
const Ring = ({ pct, color }) => (
  <div className="relative shrink-0" style={{ width: s(160), height: s(160) }}>
    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
      <circle
        cx="50"
        cy="50"
        r="42"
        fill="none"
        stroke="#e2e8f0"
        strokeWidth="11"
      />
      {pct !== null && pct > 0 && (
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke={color}
          strokeWidth="11"
          strokeLinecap="round"
          pathLength="100"
          strokeDasharray={`${Math.min(pct, 100)} 100`}
          style={{ transition: "stroke-dasharray 1s ease" }}
        />
      )}
    </svg>
    <div className="absolute inset-0 flex flex-col items-center justify-center">
      <span
        className="font-black tabular-nums leading-none"
        style={{ color, fontSize: s(40) }}
      >
        {pct === null ? "—" : `${pct >= 99.95 ? 100 : pct.toFixed(1)}%`}
      </span>
      <span
        className="font-semibold text-slate-400 leading-none"
        style={{ fontSize: s(20), marginTop: s(6) }}
      >
        Efficiency
      </span>
    </div>
  </div>
);

const Stat = ({ label, value, color }) => (
  <div
    className="min-w-0 flex flex-col"
    style={{
      background: `${color}10`,
      borderRadius: s(16),
      padding: `${s(12)} ${s(18)}`,
      gap: s(6),
    }}
  >
    <span
      className="font-semibold text-slate-500 leading-none whitespace-nowrap"
      style={{ fontSize: s(24) }}
    >
      {label}
    </span>
    <span
      className="font-black tabular-nums leading-none"
      style={{ color, fontSize: s(64) }}
    >
      {fmt(value)}
    </span>
  </div>
);

/* ── One brazing machine ── */
const MachineCard = ({ m }) => {
  const pct = effPct(m);
  const tone = effTone(pct);
  return (
    <article
      className="min-w-0 min-h-0 bg-white flex flex-col border border-slate-200 shadow-sm overflow-hidden"
      style={{ borderRadius: s(24) }}
    >
      <div
        className="shrink-0 flex items-center justify-between border-b border-slate-100"
        style={{ padding: `${s(14)} ${s(24)}`, gap: s(16) }}
      >
        <h2
          className="font-black text-slate-900 leading-none truncate min-w-0"
          style={{ fontSize: s(40) }}
        >
          {m.MachineName}
        </h2>
        <span
          className="shrink-0 inline-flex items-center text-white font-bold leading-none"
          style={{
            background: tone.color,
            fontSize: s(24),
            padding: `${s(9)} ${s(20)}`,
            borderRadius: s(999),
            gap: s(10),
          }}
        >
          <span
            className="inline-block rounded-full bg-white"
            style={{ width: s(12), height: s(12) }}
          />
          {tone.text}
        </span>
      </div>

      <div
        className="flex-1 min-h-0"
        style={{ padding: `${s(16)} ${s(24)} 0` }}
      >
        <Camera
          key={m.CameraUrl ?? "none"}
          src={m.CameraUrl}
          name={m.MachineName}
        />
      </div>

      <div
        className="shrink-0 flex items-center"
        style={{ padding: `${s(16)} ${s(24)}`, gap: s(22) }}
      >
        <Avatar
          key={m.OperatorPhoto ?? "none"}
          src={m.OperatorPhoto}
          name={m.OperatorName}
        />
        <div className="flex-1 min-w-0">
          <p
            className="font-semibold text-slate-400 leading-none"
            style={{ fontSize: s(24) }}
          >
            Operator
          </p>
          <p
            className="font-black text-slate-900 leading-tight truncate"
            style={{ fontSize: s(40), marginTop: s(8) }}
          >
            {m.OperatorName || "Not assigned"}
          </p>
          <p
            className="font-bold font-mono text-slate-500 leading-none"
            style={{ fontSize: s(28), marginTop: s(8) }}
          >
            {m.OperatorCode || "—"}
          </p>
        </div>
        <Ring pct={pct} color={tone.color} />
      </div>

      <div
        className="shrink-0 grid grid-cols-3"
        style={{ padding: `0 ${s(24)} ${s(24)}`, gap: s(14) }}
      >
        <Stat label="Total joints" value={m.TotalJoints} color="#334155" />
        <Stat label="OK" value={m.TotalOk} color={OK_GREEN} />
        <Stat label="Not OK" value={m.TotalNotOk} color={NOT_OK_RED} />
      </div>
    </article>
  );
};

/* ═════════════════════════════════════════════════════════════════════════ */

const BrazingDashboard = ({ lineKey: propKey }) => {
  const { lineKey: paramKey } = useParams();
  const lineKey = propKey ?? paramKey;
  const navigate = useNavigate();
  const line = BRAZING_LINES.find((l) => l.key === lineKey);
  const { scale, canvasH } = useFitScale();

  const [machines, setMachines] = useState(null); // null = first load not done
  const [shiftInfo, setShiftInfo] = useState(detectCurrentShift);
  const [lastFetched, setLastFetched] = useState(null);
  const [offline, setOffline] = useState(false);

  const exit = useCallback(
    () => navigate("/display/management?type=brazing"),
    [navigate],
  );

  // Unknown line in the URL → back to Management
  useEffect(() => {
    if (!line) {
      toast.error("Brazing line not found.");
      navigate("/display/management?type=brazing", { replace: true });
    }
  }, [line, navigate]);

  // Shift is re-detected from the clock on every refresh, so it switches by itself at 08:00 / 20:00
  const load = useCallback(
    async (isFirst = false) => {
      if (!line) return;
      const info = detectCurrentShift();
      setShiftInfo((prev) =>
        prev.shift === info.shift && prev.shiftDate === info.shiftDate
          ? prev
          : info,
      );
      try {
        const list = await fetchBrazing(line.key, info);
        setMachines(list);
        setLastFetched(new Date());
        setOffline(false);
      } catch {
        setOffline(true);
        if (isFirst) {
          toast.error("Failed to load brazing data. Retrying automatically.");
          setMachines((prev) => prev ?? []);
        }
      }
    },
    [line],
  );

  useEffect(() => {
    load(true);
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  const totals = useMemo(() => {
    const list = machines ?? [];
    const joints = list.reduce((a, m) => a + (num(m.TotalJoints) ?? 0), 0);
    const ok = list.reduce((a, m) => a + (num(m.TotalOk) ?? 0), 0);
    const notOk = list.reduce((a, m) => a + (num(m.TotalNotOk) ?? 0), 0);
    return { joints, ok, notOk, pct: joints > 0 ? (ok / joints) * 100 : null };
  }, [machines]);

  if (!line) return null;

  const overall = effTone(totals.pct);
  const cols = Math.min(Math.max(machines?.length ?? 1, 1), 3);

  return (
    <div className="fixed inset-0 z-9999 bg-slate-50 overflow-hidden">
      <div
        className="flex flex-col bg-slate-50 overflow-hidden font-sans"
        style={{
          width: DESIGN_W,
          height: canvasH,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {/* ── Top bar ── */}
        <div className="flex items-center gap-2.5 px-4 py-1.5 bg-white border-b border-slate-100 shrink-0 shadow-sm">
          <span className="font-extrabold text-[13px] text-slate-900 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            {line.label} brazing
          </span>
          <div className="w-px h-5 bg-slate-100" />
          {lastFetched && !offline && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live, refreshes every {REFRESH_MS / 1000}s
            </span>
          )}
          {offline && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-300 text-amber-700 text-[11px] font-bold">
              <WifiOff className="w-3 h-3" />
              Connection lost. Showing the last data.
            </span>
          )}
          <span className="flex items-center gap-1.5 px-2.5 py-1 border-[1.5px] border-slate-100 rounded-lg text-xs text-slate-600 bg-slate-50 font-mono">
            <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
            {shiftInfo.shiftDate}
          </span>
          <div className="ml-auto flex gap-2 items-center">
            {lastFetched && (
              <span className="text-[11px] text-slate-400">
                Updated {lastFetched.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={exit}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-50 text-red-500 border-[1.5px] border-red-300 transition-all hover:bg-red-100"
            >
              <X className="w-3 h-3" /> Exit
            </button>
          </div>
        </div>

        {/* ── Loading ── */}
        {machines === null && (
          <div className="flex-1 flex flex-col items-center justify-center bg-white gap-3.5">
            <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
            <p className="text-sm text-slate-400">Loading brazing data…</p>
          </div>
        )}

        {/* ── Page ── */}
        {machines !== null && (
          <div
            className="w-full h-full flex-1 min-h-0 flex flex-col bg-slate-100 overflow-hidden"
            style={{ containerType: "size", "--u": "min(1cqw, 1.7778cqh)" }}
          >
            <header
              className="shrink-0 flex items-center justify-between text-white"
              style={{ background: EMBER, padding: `${s(14)} ${s(36)}` }}
            >
              <div className="flex items-center min-w-0" style={{ gap: s(22) }}>
                <Flame
                  className="shrink-0"
                  style={{ width: s(60), height: s(60) }}
                  strokeWidth={2.2}
                />
                <h1
                  className="font-black tracking-wide leading-none truncate"
                  style={{ fontSize: s(48) }}
                >
                  Brazing performance
                </h1>
                <span
                  className="shrink-0 font-black leading-none"
                  style={{
                    background: "rgba(255,255,255,0.18)",
                    fontSize: s(38),
                    padding: `${s(10)} ${s(26)}`,
                    borderRadius: s(16),
                  }}
                >
                  {line.label}
                </span>
              </div>
              <div
                className="flex items-center shrink-0"
                style={{ gap: s(30) }}
              >
                <div className="flex flex-col items-end" style={{ gap: s(8) }}>
                  <span
                    className="bg-white font-black leading-none"
                    style={{
                      color: EMBER,
                      fontSize: s(40),
                      padding: `${s(10)} ${s(28)}`,
                      borderRadius: s(16),
                    }}
                  >
                    Shift {shiftInfo.shift}
                  </span>
                  <span
                    className="font-semibold text-white/80 leading-none"
                    style={{ fontSize: s(24) }}
                  >
                    {SHIFT_HOURS[shiftInfo.shift]}
                  </span>
                </div>
                <div className="flex flex-col items-end" style={{ gap: s(6) }}>
                  <span
                    className="font-semibold font-mono text-white/80 leading-none"
                    style={{ fontSize: s(28) }}
                  >
                    {shiftInfo.shiftDate}
                  </span>
                  <Clock />
                </div>
              </div>
            </header>

            <div
              className="flex-1 min-h-0 flex flex-col"
              style={{ padding: `${s(18)} ${s(24)}`, gap: s(16) }}
            >
              {/* Shift totals */}
              <div className="shrink-0 grid grid-cols-4" style={{ gap: s(16) }}>
                <Tile
                  label="Total joints"
                  value={fmt(totals.joints)}
                  color="#334155"
                />
                <Tile
                  label="Total OK"
                  value={fmt(totals.ok)}
                  color={OK_GREEN}
                />
                <Tile
                  label="Total not OK"
                  value={fmt(totals.notOk)}
                  color={NOT_OK_RED}
                />
                <Tile
                  label="Line efficiency"
                  value={
                    totals.pct === null
                      ? "—"
                      : `${totals.pct >= 99.95 ? 100 : totals.pct.toFixed(1)}%`
                  }
                  color={overall.color}
                />
              </div>

              {/* Machines */}
              {machines.length > 0 ? (
                <div
                  className="flex-1 min-h-0 grid"
                  style={{
                    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                    gridAutoRows: "minmax(0, 1fr)",
                    gap: s(16),
                  }}
                >
                  {machines.map((m, i) => (
                    <MachineCard key={m.MachineName ?? i} m={m} />
                  ))}
                </div>
              ) : (
                <div
                  className="flex-1 min-h-0 bg-white border border-slate-200 flex flex-col items-center justify-center text-slate-400"
                  style={{ borderRadius: s(24), gap: s(16) }}
                >
                  <PackageOpen
                    className="opacity-25"
                    style={{ width: s(140), height: s(140) }}
                    strokeWidth={1.2}
                  />
                  <p className="font-bold" style={{ fontSize: s(40) }}>
                    {offline
                      ? "Could not load brazing data. Retrying automatically."
                      : "No brazing machines reported for this shift"}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BrazingDashboard;
