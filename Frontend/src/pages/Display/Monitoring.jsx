import { useEffect, useState, useCallback, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import {
  Loader2,
  Play,
  Pause,
  X,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Package,
  Truck,
  BarChart2,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { baseURL } from "../../assets/assets";

import ProductionDisplay1 from "./Area/ProductionDisplay1";
import ProductionDisplay2 from "./Area/ProductionDisplay2";
import Hourly from "./Area/Hourly";
import Quality from "./Area/Quality";
import Loss from "./Area/Loss";

const PAGE_DURATION_MS = 30_000;

// Only the CURRENT page's API is called every 30s — not all 5
const AUTO_REFRESH_MS = 30_000;

// Shift boundary check. 15s so the switch happens within seconds of 08:00 / 20:00
const SHIFT_CHECK_MS = 15_000;

// If a background reload fails (network/server down), retry after this delay
const RETRY_MS = 15_000;

// The layout is designed for a 1920px-wide canvas.
// The whole app is scaled to fit ANY screen / Windows display-scaling / TV.
const DESIGN_W = 1920;

// Stable reference outside component
const ALL_ENDPOINTS = {
  productionDisplay1: `${baseURL}dashboard/production-display-1`,
  productionDisplay2: `${baseURL}dashboard/production-display-2`,
  hourly: `${baseURL}dashboard/hourly`,
  quality: `${baseURL}dashboard/quality`,
  loss: `${baseURL}dashboard/loss`,
};

const PAGES_META = [
  {
    key: "productionDisplay1",
    flag: "showDisplay1",
    label: "Production Display 1",
    Icon: Package,
    accentHex: "#1e40af",
  },
  {
    key: "productionDisplay2",
    flag: "showDisplay2",
    label: "Production Display 2",
    Icon: Truck,
    accentHex: "#0f766e",
  },
  {
    key: "hourly",
    flag: "showHourly",
    label: "Hourly",
    Icon: BarChart2,
    accentHex: "#7c3aed",
  },
  {
    key: "quality",
    flag: "showQuality",
    label: "Quality",
    Icon: CheckCircle,
    accentHex: "#15803d",
  },
  {
    key: "loss",
    flag: "showLoss",
    label: "Loss Analysis",
    Icon: AlertTriangle,
    accentHex: "#b45309",
  },
];

const EMPTY_DATA = {
  productionDisplay1: {},
  productionDisplay2: {},
  hourly: {},
  quality: {},
  loss: {},
};

const pad = (n) => String(n).padStart(2, "0");

const toISODate = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Auto-detects current shift from system clock
// Shift A → 08:00 – 20:00  (shiftDate = today)
// Shift B → 20:00 – 08:00  (shiftDate = the evening's date, yesterday if past midnight)
const detectCurrentShift = () => {
  const now = new Date();
  const hour = now.getHours();
  if (hour >= 8 && hour < 20) {
    return { shift: "A", shiftDate: toISODate(now) };
  }
  const d = new Date(now);
  if (hour < 8) d.setDate(d.getDate() - 1); // 00:00–07:59 → belongs to yesterday's B shift
  return { shift: "B", shiftDate: toISODate(d) };
};

const buildParams = (cfg, shiftDate, shift) => ({
  configId: cfg?.id,
  shiftDate,
  shift,
});

// Backend row (PascalCase) → config object used by the dashboard pages
const dbToForm = (row) => ({
  id: row.Id,
  dashboardName: row.DashboardName ?? "",
  lineName: row.LineName ?? "",
  lineCode: row.LineCode ?? "",
  workingTimeMin: String(row.WorkingTimeMin ?? ""),
  stationCode1: row.StationCode1 ?? "",
  stationName1: row.StationName1 ?? "",
  lineTaktTime1: String(row.LineTaktTime1 ?? ""),
  lineMonthlyProduction1: String(row.LineMonthlyProduction1 ?? ""),
  lineTarget1: String(row.LineTarget1 ?? ""),
  dailyProductionTarget1: Number(row.DailyProductionTarget1 ?? 0),
  stationCode2: row.StationCode2 ?? "",
  stationName2: row.StationName2 ?? "",
  lineTaktTime2: String(row.LineTaktTime2 ?? ""),
  lineMonthlyProduction2: String(row.LineMonthlyProduction2 ?? ""),
  dailyProductionTarget2: Number(row.DailyProductionTarget2 ?? 0),
  qualityProcessCode: row.QualityProcessCode ?? "",
  qualityLineName: row.QualityLineName ?? "",
  sectionName: row.SectionName ?? "",
  showDisplay1: row.ShowDisplay1 ?? true,
  showDisplay2: row.ShowDisplay2 ?? true,
  showHourly: row.ShowHourly ?? true,
  showQuality: row.ShowQuality ?? true,
  showLoss: row.ShowLoss ?? true,
});

const nameToSlug = (name) =>
  (name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/* ── Spinner ── */
const Spinner = ({ cls = "w-4 h-4" }) => (
  <Loader2 className={`animate-spin ${cls}`} />
);

/* ── useFitScale ──────────────────────────────────────────────────────────
   Scales the 1920px-wide design to the real window width.
   canvasH is the height (in design pixels) that fills the real window height,
   so there is never a scrollbar or empty strip.
─────────────────────────────────────────────────────────────────────────── */
const useFitScale = () => {
  const [vp, setVp] = useState({
    w: window.innerWidth,
    h: window.innerHeight,
  });

  useEffect(() => {
    const onResize = () =>
      setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const scale = vp.w / DESIGN_W;
  return { scale, canvasH: vp.h / scale };
};

/* ── NavDots ── */
const NavDots = ({ currentPage, activeMeta, onGoTo, onPrev, onNext }) => (
  <div className="shrink-0 flex items-center justify-center gap-1.5 px-4 py-2 bg-white border-t border-slate-100 relative">
    <button
      onClick={onPrev}
      className="absolute left-3 p-1 text-slate-400 hover:text-slate-600 transition-colors"
      aria-label="Previous page"
    >
      <ArrowLeft className="w-3.5 h-3.5" />
    </button>

    {activeMeta.map(({ label, Icon, accentHex }, i) => {
      const active = i === currentPage;
      return (
        <button
          key={i}
          onClick={() => onGoTo(i)}
          aria-label={`Go to ${label}`}
          className="flex flex-col items-center gap-0.5"
        >
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full border-[1.5px] transition-all ${
              active ? "border-current" : "border-transparent"
            }`}
            style={{
              background: active ? `${accentHex}15` : "transparent",
              color: active ? accentHex : "#cbd5e1",
            }}
          >
            <Icon className="w-3 h-3" />
            {active && <span className="text-[10px] font-bold">{label}</span>}
          </div>
        </button>
      );
    })}

    <button
      onClick={onNext}
      className="absolute right-3 p-1 text-slate-400 hover:text-slate-600 transition-colors"
      aria-label="Next page"
    >
      <ArrowRight className="w-3.5 h-3.5" />
    </button>
  </div>
);

/* ═════════════════════════════════════════════════════════════
   MAIN COMPONENT
═════════════════════════════════════════════════════════════ */
const Monitoring = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { slug } = useParams();

  // auto-scale to the screen (must be called before any early return)
  const { scale, canvasH } = useFitScale();

  const routerState = location.state || {};
  const isLaunched = !!routerState.autoLoad;

  // Starting shift/date: from the launch modal, otherwise detected from the clock
  const [initial] = useState(() => {
    const auto = detectCurrentShift();
    return {
      shiftDate: routerState.shiftDate || auto.shiftDate,
      shift: routerState.shift || auto.shift,
    };
  });

  const [launchedConfig, setLaunchedConfig] = useState(
    routerState.config || null,
  );
  const [configLoading, setConfigLoading] = useState(!isLaunched && !!slug);

  /* ── Slug-based config resolution (direct URL / page refresh) ── */
  useEffect(() => {
    if (isLaunched || !slug) return;
    const fetchConfigBySlug = async () => {
      setConfigLoading(true);
      try {
        const res = await axios.get(`${baseURL}dashboard/configs`);
        const raw = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
        const matched = raw
          .map(dbToForm)
          .find((c) => nameToSlug(c.dashboardName) === slug);
        if (matched) {
          setLaunchedConfig(matched);
        } else {
          toast.error("Dashboard configuration not found.");
          navigate("/display/management", { replace: true });
        }
      } catch {
        toast.error("Failed to load configuration.");
        navigate("/display/management", { replace: true });
      } finally {
        setConfigLoading(false);
      }
    };
    fetchConfigBySlug();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, isLaunched]);

  /* ── Active pages filtered by visibility flags ─────────────── */
  const activeMeta = launchedConfig
    ? PAGES_META.filter(
        (p) => launchedConfig[p.flag] !== false && launchedConfig[p.flag] !== 0,
      )
    : PAGES_META;

  /* ── Core state ────────────────────────────────────────────── */
  const [shiftDate, setShiftDate] = useState(initial.shiftDate);
  const [shift, setShift] = useState(initial.shift);
  const [allData, setAllData] = useState(EMPTY_DATA);
  const [currentPage, setCurrentPage] = useState(0);
  const [progress, setProgress] = useState(0);
  const [lastFetched, setLastFetched] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [loading, setLoading] = useState(false);

  // Boolean, so interval effects do NOT restart every time lastFetched
  // changes (it changes every 30s on each silent refresh).
  const hasData = !!lastFetched;

  /* ── Refs so intervals always read the latest values ───────── */
  const activeMetaRef = useRef(activeMeta);
  const shiftDateRef = useRef(shiftDate);
  const shiftRef = useRef(shift);
  const configRef = useRef(launchedConfig);
  const currentPageRef = useRef(currentPage);
  const retryTimerRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    activeMetaRef.current = activeMeta;
  }, [activeMeta]);

  useEffect(() => {
    shiftDateRef.current = shiftDate;
    shiftRef.current = shift;
    configRef.current = launchedConfig;
    currentPageRef.current = currentPage;
  }, [shiftDate, shift, launchedConfig, currentPage]);

  // Clear any pending retry when the component unmounts
  useEffect(() => {
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, []);

  /* ── Page-rotation timer ───────────────────────────────────── */
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!isRunning) return;
    let elapsed = 0;
    setProgress(0);
    intervalRef.current = setInterval(() => {
      elapsed += 50;
      setProgress(Math.min((elapsed / PAGE_DURATION_MS) * 100, 100));
      if (elapsed >= PAGE_DURATION_MS) {
        elapsed = 0;
        setProgress(0);
        setCurrentPage((p) => (p + 1) % activeMetaRef.current.length);
      }
    }, 50);
    return () => {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [isRunning, currentPage]);

  /* ── Full fetch — ALL active pages ─────────────────────────────
     isRefresh = false → first load: shows spinner, clears data
     isRefresh = true  → background reload (shift change): keeps the old
                         data on screen, never shows a spinner, and keeps
                         retrying every RETRY_MS if the server is down.
  ─────────────────────────────────────────────────────────────── */
  const fetchData = useCallback(
    async (dateParam, shiftParam, cfg, metaList, isRefresh = false) => {
      if (!dateParam) {
        if (!isRefresh) toast.error("Please select a shift date.");
        return;
      }
      if (!cfg?.id) {
        if (!isRefresh) toast.error("No dashboard configuration selected.");
        return;
      }

      // cancel any pending retry from an earlier attempt
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }

      if (!isRefresh) {
        setLoading(true);
        setIsRunning(false);
        setAllData(EMPTY_DATA);
      }

      const params = buildParams(cfg, dateParam, shiftParam);
      const activeKeys = new Set((metaList ?? PAGES_META).map((p) => p.key));
      const endpoints = Object.fromEntries(
        Object.entries(ALL_ENDPOINTS).filter(([key]) => activeKeys.has(key)),
      );

      const scheduleRetry = () => {
        retryTimerRef.current = setTimeout(() => {
          // use the LATEST shift/date in case it changed again meanwhile
          fetchData(
            shiftDateRef.current,
            shiftRef.current,
            configRef.current,
            activeMetaRef.current,
            true,
          );
        }, RETRY_MS);
      };

      try {
        const results = await Promise.allSettled(
          Object.entries(endpoints).map(([key, url]) =>
            axios
              .get(url, { params })
              .then((res) => ({ key, data: res.data?.data ?? res.data })),
          ),
        );
        const merged = {};
        results.forEach((r) => {
          if (r.status === "fulfilled") merged[r.value.key] = r.value.data;
        });
        const failed = results.filter((r) => r.status === "rejected").length;

        if (failed === Object.keys(endpoints).length) {
          if (isRefresh) {
            scheduleRetry(); // server/network down — keep trying silently
          } else {
            toast.error("All endpoints failed. Check server connection.");
          }
        } else {
          if (!isRefresh) {
            if (failed > 0)
              toast(`${failed} endpoint(s) had errors.`, {
                icon: <AlertTriangle className="w-4 h-4 text-amber-500" />,
              });
            else toast.success("Dashboard loaded successfully.");
          }
          setAllData((prev) => ({
            ...(isRefresh ? prev : EMPTY_DATA),
            ...merged,
          }));
          setLastFetched(new Date());
          setCurrentPage(0);
          setIsRunning(true);
        }
      } catch {
        if (isRefresh) scheduleRetry();
        else toast.error("Failed to fetch dashboard data.");
      } finally {
        if (!isRefresh) setLoading(false);
      }
    },
    [],
  );

  /* ── silentFetch — ONLY fetches the CURRENT visible page ──────── */
  const silentFetch = useCallback(async () => {
    const cfg = configRef.current;
    const date = shiftDateRef.current;
    const sh = shiftRef.current;
    const pageKey = activeMetaRef.current[currentPageRef.current]?.key;

    if (!cfg?.id || !date || !pageKey) return;

    try {
      const res = await axios.get(ALL_ENDPOINTS[pageKey], {
        params: buildParams(cfg, date, sh),
      });
      const data = res.data?.data ?? res.data;
      if (data) {
        setAllData((prev) => ({ ...prev, [pageKey]: data }));
        setLastFetched(new Date());
      }
    } catch {
      // Silent fail — no toast spam on background errors
    }
  }, []);

  /* ── Auto-refresh interval (current page only) ─────────────────
     Depends on hasData (boolean), NOT lastFetched, so the timer is
     created once and is not reset by its own updates.
  ─────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!hasData) return;
    const id = setInterval(silentFetch, AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [hasData, silentFetch]);

  /* ── Shift auto-switch ─────────────────────────────────────────
     Checks the clock every SHIFT_CHECK_MS. When the shift changes
     (08:00 → Shift A, 20:00 → Shift B) it reloads all data by itself.
  ─────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!hasData) return;
    const id = setInterval(() => {
      const { shift: newShift, shiftDate: newDate } = detectCurrentShift();

      if (newShift !== shiftRef.current || newDate !== shiftDateRef.current) {
        // update refs immediately so this can't trigger twice
        shiftRef.current = newShift;
        shiftDateRef.current = newDate;

        toast(`Shift changed to Shift ${newShift} — reloading data.`, {
          icon: <RefreshCw className="w-4 h-4 text-blue-500" />,
          duration: 4000,
        });
        setShift(newShift);
        setShiftDate(newDate);
        fetchData(
          newDate,
          newShift,
          configRef.current,
          activeMetaRef.current,
          true, // background reload — keep old data, retry on failure
        );
      }
    }, SHIFT_CHECK_MS);
    return () => clearInterval(id);
  }, [hasData, fetchData]);

  /* ── One-shot auto-load once the config is available ───────── */
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    if (!launchedConfig || hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    fetchData(initial.shiftDate, initial.shift, launchedConfig, activeMeta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [launchedConfig]);

  /* ── Navigation helpers ────────────────────────────────────── */
  const goTo = useCallback((i) => {
    setCurrentPage(i);
    setProgress(0);
  }, []);

  const goPrev = useCallback(() => {
    const len = activeMetaRef.current.length;
    setCurrentPage((p) => (p - 1 + len) % len);
    setProgress(0);
  }, []);

  const goNext = useCallback(() => {
    setCurrentPage((p) => (p + 1) % activeMetaRef.current.length);
    setProgress(0);
  }, []);

  /* ── Guards ────────────────────────────────────────────────── */
  if (configLoading) {
    return (
      <div className="fixed inset-0 z-9999 flex flex-col items-center justify-center bg-white gap-3.5">
        <Spinner cls="w-8 h-8 text-indigo-500" />
        <p className="text-sm text-slate-400">
          Loading dashboard configuration…
        </p>
      </div>
    );
  }
  if (!launchedConfig) return null;

  /* ── Page map ──────────────────────────────────────────────── */
  const commonProps = { progress, shift, shiftDate, config: launchedConfig };

  const PAGE_ELEMENTS = {
    productionDisplay1: (
      <ProductionDisplay1
        key="pd1"
        {...commonProps}
        apiData={allData.productionDisplay1}
      />
    ),
    productionDisplay2: (
      <ProductionDisplay2
        key="pd2"
        {...commonProps}
        apiData={allData.productionDisplay2}
      />
    ),
    hourly: <Hourly key="hourly" {...commonProps} apiData={allData.hourly} />,
    quality: (
      <Quality key="quality" {...commonProps} apiData={allData.quality} />
    ),
    loss: <Loss key="loss" {...commonProps} apiData={allData.loss} />,
  };

  const pages = activeMeta.map((meta) => PAGE_ELEMENTS[meta.key]);

  /* ── Render ────────────────────────────────────────────────── */
  return (
    // Outer wrapper = real screen. Inner canvas = 1920px design scaled to fit.
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
          {/* Dashboard name */}
          <span className="font-extrabold text-[13px] text-slate-900 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            {launchedConfig.dashboardName}
          </span>

          <div className="w-px h-5 bg-slate-100" />

          {/* LIVE badge */}
          {lastFetched && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              LIVE · every {AUTO_REFRESH_MS / 1000}s
            </span>
          )}

          <div className="w-px h-5 bg-slate-100" />

          {/* Shift badges — read-only, show current auto-detected shift */}
          {["A", "B"].map((s) => (
            <span
              key={s}
              className={`px-3 py-1 rounded-lg text-xs font-bold border-[1.5px] transition-all ${
                shift === s
                  ? s === "A"
                    ? "bg-blue-50 text-blue-700 border-blue-300"
                    : "bg-amber-50 text-amber-700 border-amber-300"
                  : "bg-slate-50 text-slate-300 border-slate-100"
              }`}
            >
              Shift {s}
            </span>
          ))}

          {/* Date — read only */}
          <span className="flex items-center gap-1.5 px-2.5 py-1 border-[1.5px] border-slate-100 rounded-lg text-xs text-slate-600 bg-slate-50 font-mono">
            <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
            {shiftDate}
          </span>

          <div className="ml-auto flex gap-2 items-center">
            {lastFetched && (
              <span className="text-[11px] text-slate-400">
                Updated {lastFetched.toLocaleTimeString()}
              </span>
            )}

            {/* Pause / Resume page rotation */}
            {isRunning ? (
              <button
                onClick={() => setIsRunning(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 border-[1.5px] border-amber-300 transition-all hover:bg-amber-100"
              >
                <Pause className="w-3 h-3" /> Pause
              </button>
            ) : (
              lastFetched && (
                <button
                  onClick={() => setIsRunning(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border-[1.5px] border-emerald-300 transition-all hover:bg-emerald-100"
                >
                  <Play className="w-3 h-3" /> Resume
                </button>
              )
            )}

            {/* Exit */}
            <button
              onClick={() => navigate("/display/management")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-50 text-red-500 border-[1.5px] border-red-300 transition-all hover:bg-red-100"
            >
              <X className="w-3 h-3" /> Exit
            </button>
          </div>
        </div>

        {/* ── Loading overlay ── */}
        {loading && (
          <div className="flex-1 flex flex-col items-center justify-center bg-white gap-3.5">
            <Spinner cls="w-8 h-8 text-indigo-500" />
            <p className="text-sm text-slate-400">Fetching shift data...</p>
          </div>
        )}

        {/* ── Dashboard pages ── */}
        {!loading && lastFetched && (
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0 overflow-hidden">
              {pages.map((page, i) => (
                <div
                  key={i}
                  className="h-full"
                  style={{
                    display: i === currentPage ? "flex" : "none",
                    flexDirection: "column",
                  }}
                >
                  {page}
                </div>
              ))}
            </div>
            <NavDots
              currentPage={currentPage}
              activeMeta={activeMeta}
              onGoTo={goTo}
              onPrev={goPrev}
              onNext={goNext}
            />
          </div>
        )}

        {/* ── Waiting for first fetch ── */}
        {!loading && !lastFetched && (
          <div className="flex-1 flex flex-col items-center justify-center bg-white gap-3.5">
            <Spinner cls="w-8 h-8 text-indigo-500" />
            <p className="text-sm text-slate-400">Initializing dashboard…</p>
          </div>
        )}
      </div>
    </div>
  );
};

export { Spinner };
export default Monitoring;
