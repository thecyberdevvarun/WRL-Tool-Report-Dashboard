import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from "recharts";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import SelectField from "../../components/ui/SelectField";
import axios from "axios";
import DateTimePicker from "../../components/ui/DateTimePicker";
import Loader from "../../components/ui/Loader";
import toast from "react-hot-toast";
import { baseURL } from "../../assets/assets";
import { useGetModelVariantsQuery } from "../../redux/api/commonApi.js";
import {
  RefreshCw,
  Filter,
  Search,
  X,
  BarChart2,
  Table2,
  List,
  Target,
  AlertTriangle,
  CheckCircle,
  ChevronUp,
  ChevronDown,
  Loader2,
  PackageOpen,
  Tag,
  FileDown,
  FileText,
  FileSpreadsheet,
} from "lucide-react";

// ── Category Mappings ──────────────────────────────────────────────────────────
export const CATEGORY_MAPPINGS = {
  COOLER: "Freezer",
  "Choc Cooler": "Choc Cooler",
  "FOW MODELS": "FOW",
  "ICE LINED REFRIGERATOR": "Freezer",
  "COOLER AND FREEZER": "Freezer",
  "CHEST COOLER": "Freezer",
  MEDICAL: "Freezer",
  EUTECTIC: "Freezer",
  ILR: "Freezer",
  "VACCINE FREEZER": "Freezer",
  DUAL: "Freezer",
  "EUTECTIC FOW FREEZER": "FOW",
  FREEZER: "Freezer",
  "2 GLASS DOOR UNDERCOUNTER REFRIGERATOR": "SUS",
  "1 DOOR UNDERCOUNTER REFRIGERATOR": "SUS",
  "2 DOOR UNDERCOUNTER REFRIGERATOR": "SUS",
  "3 DOOR UNDERCOUNTER REFRIGERATOR": "SUS",
  "STORAGE WATER COOLER": "SWC",
  "VISI COOLER": "VISI COOLER",
};

const CATEGORY_OPTIONS = [...new Set(Object.values(CATEGORY_MAPPINGS))].sort();

const SORTED_MAPPING_KEYS = Object.keys(CATEGORY_MAPPINGS).sort(
  (a, b) => b.length - a.length,
);

const _categoryCache = new Map();
const getCategoryForModel = (modelName) => {
  if (!modelName) return null;
  const upper = modelName.toUpperCase().trim();
  if (_categoryCache.has(upper)) return _categoryCache.get(upper);
  let result = null;
  for (const key of SORTED_MAPPING_KEYS) {
    if (upper.includes(key.toUpperCase())) {
      result = CATEGORY_MAPPINGS[key];
      break;
    }
  }
  _categoryCache.set(upper, result);
  return result;
};

const buildCategoryLookup = (rows) => {
  const map = new Map();
  for (const row of rows) {
    const name = row.Model_Name;
    if (!name || map.has(name)) continue;
    let uiCat = null;
    if (row.Category) {
      uiCat = CATEGORY_MAPPINGS[row.Category];
      if (!uiCat) {
        const upperCat = row.Category.toUpperCase();
        const matchedKey = Object.keys(CATEGORY_MAPPINGS).find(
          (k) => k.toUpperCase() === upperCat,
        );
        if (matchedKey) uiCat = CATEGORY_MAPPINGS[matchedKey];
      }
      if (!uiCat && CATEGORY_OPTIONS.includes(row.Category)) {
        uiCat = row.Category;
      }
    }
    if (!uiCat) uiCat = getCategoryForModel(name);
    map.set(name, uiCat);
  }
  return map;
};

// ── Date helpers ───────────────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, "0");
const fmtDate = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

// ── Spinner ────────────────────────────────────────────────────────────────────
const Spinner = ({ cls = "w-4 h-4" }) => (
  <Loader2 className={`animate-spin ${cls}`} />
);

// ── Status classifier ──────────────────────────────────────────────────────────
const classifyStatus = (status) => {
  const s = (status ?? "").toLowerCase().trim();
  if (!s || s === "not logged in") return "unknown";
  if (
    s.includes("close") ||
    s.includes("done") ||
    s.includes("complet") ||
    s.includes("resolv") ||
    s.includes("finish")
  )
    return "closed";
  if (
    s.includes("open") ||
    s.includes("pending") ||
    s.includes("wait") ||
    s.includes("in progress") ||
    s.includes("wip")
  )
    return "open";
  return "unknown";
};

// ── Defect severity ────────────────────────────────────────────────────────────
const ratioLevel = (pct) => {
  if (pct == null)
    return {
      color: "text-slate-400",
      bg: "bg-slate-50",
      border: "border-slate-200",
      label: "—",
      hex: "#94a3b8",
    };
  if (pct >= 35)
    return {
      color: "text-red-600",
      bg: "bg-red-50",
      border: "border-red-200",
      label: "Critical",
      hex: "#dc2626",
    };
  if (pct >= 25)
    return {
      color: "text-amber-600",
      bg: "bg-amber-50",
      border: "border-amber-200",
      label: "High",
      hex: "#d97706",
    };
  if (pct >= 15)
    return {
      color: "text-orange-600",
      bg: "bg-orange-50",
      border: "border-orange-200",
      label: "Moderate",
      hex: "#ea580c",
    };
  return {
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    label: "Good",
    hex: "#16a34a",
  };
};

// ── Status Badge ───────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const type = classifyStatus(status);
  const cfg = {
    open: "bg-red-50 text-red-700 border-red-200",
    closed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    unknown: "bg-slate-100 text-slate-500 border-slate-200",
  };
  const dot = {
    open: "bg-red-400 animate-pulse",
    closed: "bg-emerald-400",
    unknown: "bg-slate-400",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[10px] font-bold rounded-full border uppercase tracking-wider font-mono ${cfg[type]}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot[type]}`} />
      {status || "—"}
    </span>
  );
};

// ── QuickBtn ───────────────────────────────────────────────────────────────────
const QuickBtn = ({
  label,
  sublabel,
  loading,
  onClick,
  colorClass,
  categoryCount,
}) => (
  <button
    disabled={loading}
    onClick={onClick}
    className={`w-full flex flex-col items-center justify-center gap-0.5 px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-150 relative ${
      loading ? "bg-slate-200 text-slate-400 cursor-not-allowed" : colorClass
    }`}
  >
    {loading ? (
      <span className="flex items-center gap-2">
        <Spinner /> Loading…
      </span>
    ) : (
      <>
        <span className="text-[15px] font-bold tracking-widest">{label}</span>
        {sublabel && (
          <span className="text-[10px] opacity-75 font-normal">{sublabel}</span>
        )}
        {categoryCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-white/30 text-[9px] font-black flex items-center justify-center">
            {categoryCount}
          </span>
        )}
      </>
    )}
  </button>
);

// ── SortIcon ───────────────────────────────────────────────────────────────────
const SortIcon = ({ active, dir }) => (
  <span className="inline-flex flex-col ml-1">
    <ChevronUp
      className={`w-2.5 h-2.5 -mb-0.5 ${active && dir === "asc" ? "text-blue-500" : "text-slate-400"}`}
    />
    <ChevronDown
      className={`w-2.5 h-2.5 ${active && dir === "desc" ? "text-blue-500" : "text-slate-400"}`}
    />
  </span>
);

// ── Category Multi-Select ──────────────────────────────────────────────────────
const CategoryMultiSelect = ({ selected, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (cat) =>
    onChange(
      selected.includes(cat)
        ? selected.filter((c) => c !== cat)
        : [...selected, cat],
    );
  const clearAll = () => onChange([]);

  return (
    <div className="relative min-w-[190px] flex-1" ref={ref}>
      <label className="block text-[11px] font-semibold text-slate-500 mb-1 uppercase tracking-wide">
        Category
      </label>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-[7px] rounded-lg border bg-white text-xs font-mono text-slate-700 hover:border-blue-300 transition-all shadow-sm ${
          selected.length > 0
            ? "border-blue-400 ring-1 ring-blue-100"
            : "border-slate-200"
        }`}
      >
        <span className="flex items-center gap-1.5 truncate">
          {selected.length > 0 && (
            <Tag className="w-3 h-3 text-blue-500 shrink-0" />
          )}
          <span className="truncate">
            {selected.length === 0
              ? "All categories"
              : selected.length === 1
                ? selected[0]
                : `${selected.length} selected`}
          </span>
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {selected.length > 0 && (
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                clearAll();
              }}
              className="w-4 h-4 rounded-full bg-slate-200 hover:bg-red-100 text-slate-500 hover:text-red-600 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-2.5 h-2.5" />
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 z-50 w-56 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Filter by category
            </span>
            {selected.length > 0 && (
              <button
                onClick={clearAll}
                className="text-[10px] text-blue-600 hover:underline font-semibold"
              >
                Clear all
              </button>
            )}
          </div>
          <div className="px-3 py-1.5 border-b border-slate-100 bg-slate-50/50">
            <button
              type="button"
              onClick={() =>
                selected.length === CATEGORY_OPTIONS.length
                  ? clearAll()
                  : onChange([...CATEGORY_OPTIONS])
              }
              className="text-[10px] font-semibold text-blue-600 hover:underline transition-colors"
            >
              {selected.length === CATEGORY_OPTIONS.length
                ? "Deselect all"
                : "Select all"}
            </button>
          </div>
          <div className="py-1 max-h-52 overflow-auto">
            {CATEGORY_OPTIONS.map((cat) => {
              const active = selected.includes(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggle(cat)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-mono text-left transition-colors ${
                    active
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                      active
                        ? "bg-blue-600 border-blue-600"
                        : "border-slate-300 bg-white"
                    }`}
                  >
                    {active && (
                      <CheckCircle
                        className="w-3 h-3 text-white"
                        strokeWidth={3}
                      />
                    )}
                  </span>
                  {cat}
                </button>
              );
            })}
          </div>
          {selected.length > 0 && (
            <div className="px-3 py-2 border-t border-slate-100 bg-slate-50">
              <div className="flex flex-wrap gap-1">
                {selected.map((c) => (
                  <span
                    key={c}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold font-mono border border-blue-200"
                  >
                    {c}
                    <button
                      onClick={() => toggle(c)}
                      className="hover:text-blue-900 transition-colors"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Defect Multi-Select ─────────────────────────────────────────────────────────
// Options are derived from whatever data is currently loaded (see
// `defectOptions` in the main component) rather than a static list, since
// defect descriptions aren't a fixed enum like Category.
const DefectMultiSelect = ({ options, selected, onChange }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef();

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (d) =>
    onChange(
      selected.includes(d) ? selected.filter((x) => x !== d) : [...selected, d],
    );
  const clearAll = () => onChange([]);

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? options.filter((o) => o.toLowerCase().includes(q)) : options;
  }, [options, search]);

  return (
    <div className="relative min-w-[190px] flex-1" ref={ref}>
      <label className="block text-[11px] font-semibold text-slate-500 mb-1 uppercase tracking-wide">
        Defect
      </label>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-[7px] rounded-lg border bg-white text-xs font-mono text-slate-700 hover:border-blue-300 transition-all shadow-sm ${
          selected.length > 0
            ? "border-blue-400 ring-1 ring-blue-100"
            : "border-slate-200"
        }`}
      >
        <span className="flex items-center gap-1.5 truncate">
          {selected.length > 0 && (
            <AlertTriangle className="w-3 h-3 text-blue-500 shrink-0" />
          )}
          <span className="truncate">
            {selected.length === 0
              ? "All defects"
              : selected.length === 1
                ? selected[0]
                : `${selected.length} selected`}
          </span>
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {selected.length > 0 && (
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                clearAll();
              }}
              className="w-4 h-4 rounded-full bg-slate-200 hover:bg-red-100 text-slate-500 hover:text-red-600 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-2.5 h-2.5" />
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 z-50 w-64 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Filter by defect
            </span>
            {selected.length > 0 && (
              <button
                onClick={clearAll}
                className="text-[10px] text-blue-600 hover:underline font-semibold"
              >
                Clear all
              </button>
            )}
          </div>
          {options.length > 0 && (
            <div className="px-3 py-2 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search defects..."
                  autoFocus
                  className="w-full pl-6 pr-6 py-1.5 border border-slate-200 rounded-md text-xs font-mono text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2"
                  >
                    <X className="w-3 h-3 text-slate-400 hover:text-slate-600" />
                  </button>
                )}
              </div>
            </div>
          )}
          {filteredOptions.length > 0 && (
            <div className="px-3 py-1.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <button
                type="button"
                onClick={() =>
                  filteredOptions.every((o) => selected.includes(o))
                    ? onChange(
                        selected.filter((s) => !filteredOptions.includes(s)),
                      )
                    : onChange([...new Set([...selected, ...filteredOptions])])
                }
                className="text-[10px] font-semibold text-blue-600 hover:underline transition-colors"
              >
                {filteredOptions.every((o) => selected.includes(o))
                  ? "Deselect all"
                  : search
                    ? "Select all matching"
                    : "Select all"}
              </button>
              <span className="text-[10px] text-slate-400 font-mono">
                {filteredOptions.length} of {options.length}
              </span>
            </div>
          )}
          <div className="py-1 max-h-52 overflow-auto">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((d) => {
                const active = selected.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggle(d)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-mono text-left transition-colors ${
                      active
                        ? "bg-blue-50 text-blue-700"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                        active
                          ? "bg-blue-600 border-blue-600"
                          : "border-slate-300 bg-white"
                      }`}
                    >
                      {active && (
                        <CheckCircle
                          className="w-3 h-3 text-white"
                          strokeWidth={3}
                        />
                      )}
                    </span>
                    <span className="truncate">{d}</span>
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-4 text-center text-[11px] text-slate-400">
                {search
                  ? "No defects match your search"
                  : "No defects available"}
              </div>
            )}
          </div>
          {selected.length > 0 && (
            <div className="px-3 py-2 border-t border-slate-100 bg-slate-50">
              <div className="flex flex-wrap gap-1">
                {selected.map((d) => (
                  <span
                    key={d}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold font-mono border border-blue-200 max-w-[140px]"
                  >
                    <span className="truncate">{d}</span>
                    <button
                      onClick={() => toggle(d)}
                      className="hover:text-blue-900 transition-colors shrink-0"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Recharts DonutChart ────────────────────────────────────────────────────────
const DonutChart = ({ open, closed }) => {
  const total = (Number(open) || 0) + (Number(closed) || 0);
  const pct = total > 0 ? Math.round((closed / total) * 100) : 0;
  const data = [
    { name: "Closed", value: Number(closed) || 0 },
    { name: "Open", value: Number(open) || 0 },
  ];
  return (
    <div className="relative w-[120px] h-[120px] shrink-0">
      <PieChart width={120} height={120}>
        <Pie
          data={data}
          cx={60}
          cy={60}
          innerRadius={35}
          outerRadius={47}
          dataKey="value"
          startAngle={90}
          endAngle={-270}
          strokeWidth={0}
        >
          <Cell fill="#22c55e" />
          <Cell fill="#ef4444" />
        </Pie>
        <Tooltip
          formatter={(value, name) => [value.toLocaleString(), name]}
          contentStyle={{
            fontSize: 11,
            fontFamily: "monospace",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
          }}
        />
      </PieChart>
      <div className="absolute inset-0 flex items-center justify-center text-sm font-black text-slate-800 font-mono pointer-events-none">
        {pct}%
      </div>
    </div>
  );
};

// ── Recharts ReworkBarChart ────────────────────────────────────────────────────
const ReworkTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + (p.value || 0), 0);
  return (
    <div className="bg-white border border-slate-200 shadow-xl rounded-lg p-3 text-xs font-mono max-w-[220px]">
      <p className="font-bold text-slate-800 mb-2 text-[11px] leading-tight">
        {label}
      </p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 mb-0.5">
          <span
            className="w-2.5 h-2.5 rounded-sm shrink-0"
            style={{ background: p.fill }}
          />
          <span className="text-slate-600">{p.name}:</span>
          <span className="font-bold" style={{ color: p.fill }}>
            {p.value}
          </span>
        </div>
      ))}
      <div className="mt-1.5 pt-1.5 border-t border-slate-100 text-slate-500">
        Total: <b className="text-blue-600">{total}</b>
      </div>
    </div>
  );
};

const ReworkBarChart = ({ data, chartRef }) => {
  const chartData = data.map((d) => ({
    name:
      d.Model_Name.length > 30 ? d.Model_Name.slice(0, 28) + "…" : d.Model_Name,
    Closed: d.closed,
    Open: d.open,
  }));
  const h = Math.max(180, chartData.length * 40 + 50);

  return (
    <div ref={chartRef} style={{ height: h }}>
      <ResponsiveContainer width="100%" height={h}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 4, right: 50, left: 8, bottom: 4 }}
          barSize={16}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            horizontal={false}
            stroke="#f1f5f9"
          />
          <XAxis
            type="number"
            tick={{ fontSize: 10, fill: "#94a3b8", fontFamily: "monospace" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={210}
            tick={{ fontSize: 10, fill: "#475569", fontFamily: "monospace" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<ReworkTooltip />} />
          <Legend
            iconType="square"
            iconSize={10}
            wrapperStyle={{
              fontSize: 11,
              fontFamily: "monospace",
              paddingTop: 8,
            }}
          />
          <Bar
            dataKey="Closed"
            stackId="a"
            fill="#22c55e"
            radius={[0, 0, 0, 0]}
          />
          <Bar
            dataKey="Open"
            stackId="a"
            fill="#ef4444"
            radius={[0, 3, 3, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// ── Recharts DefectRatioBars ───────────────────────────────────────────────────
const DefectTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value;
  const rl = ratioLevel(val);
  const prod = payload[0]?.payload?.production;
  const rework = payload[0]?.payload?.rework;
  return (
    <div className="bg-white border border-slate-200 shadow-xl rounded-lg p-3 text-xs font-mono max-w-[230px]">
      <p className="font-bold text-slate-800 mb-2 text-[11px] leading-tight">
        {label}
      </p>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-slate-500">Defect Ratio:</span>
        <span className={`font-bold ${rl.color}`}>
          {val != null ? `${val}%` : "N/A"}
        </span>
        {val != null && (
          <span
            className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${rl.bg} ${rl.color} ${rl.border}`}
          >
            {rl.label}
          </span>
        )}
      </div>
      <div className="text-slate-400 mt-1">
        <span>
          Production:{" "}
          <b className="text-blue-600">{(prod || 0).toLocaleString()}</b>
        </span>
        {" · "}
        <span>
          Rework: <b className="text-red-600">{rework}</b>
        </span>
      </div>
    </div>
  );
};

const DefectRatioBars = ({ data, chartRef }) => {
  const withRatio = data.filter((d) => d.defectRatio != null);
  const chartData = withRatio.map((d) => ({
    name:
      d.Model_Name.length > 30 ? d.Model_Name.slice(0, 28) + "…" : d.Model_Name,
    "Defect Ratio": Number(d.defectRatio.toFixed(2)),
    production: d.production,
    rework: d.reworkTotal,
    color: ratioLevel(d.defectRatio).hex,
  }));
  const h = Math.max(180, chartData.length * 40 + 50);

  return (
    <div ref={chartRef} style={{ height: h }}>
      <ResponsiveContainer width="100%" height={h}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 4, right: 60, left: 8, bottom: 4 }}
          barSize={16}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            horizontal={false}
            stroke="#f1f5f9"
          />
          <XAxis
            type="number"
            tick={{ fontSize: 10, fill: "#94a3b8", fontFamily: "monospace" }}
            tickFormatter={(v) => `${v}%`}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={210}
            tick={{ fontSize: 10, fill: "#475569", fontFamily: "monospace" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<DefectTooltip />} />
          <Bar dataKey="Defect Ratio" radius={[0, 3, 3, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={index} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// ── DefectRatioTable ───────────────────────────────────────────────────────────
const DefectRatioTable = ({ data }) => {
  const [sortCol, setSortCol] = useState("defectRatio");
  const [sortDir, setSortDir] = useState("desc");

  const handleSort = (col) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortCol(col);
      setSortDir("desc");
    }
  };

  const sorted = useMemo(
    () =>
      [...data].sort((a, b) => {
        const av = a[sortCol],
          bv = b[sortCol];
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        return sortDir === "asc" ? av - bv : bv - av;
      }),
    [data, sortCol, sortDir],
  );

  const hasProd = data.some((r) => r.production != null && r.production > 0);
  const totProd = sorted.reduce((s, r) => s + (r.production ?? 0), 0);
  const totRW = sorted.reduce((s, r) => s + r.reworkTotal, 0);
  const totRatio = totProd > 0 ? (totRW / totProd) * 100 : null;
  const totRl = ratioLevel(totRatio);

  const SORT_COLS = ["Production", "Rework", "Defect Ratio"];
  const SORT_KEYS = ["production", "reworkTotal", "defectRatio"];

  return (
    <div className="overflow-auto">
      {!hasProd && (
        <div className="mb-3 p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-700 font-mono leading-relaxed">
            Production data unavailable. Ensure the{" "}
            <b>quality/production-report</b> endpoint is active and returning
            data from Station 1220010.
          </p>
        </div>
      )}
      <table className="min-w-full text-xs border-separate border-spacing-0">
        <thead className="sticky top-0 z-10">
          <tr className="bg-slate-100">
            {[
              "Sr. No.",
              "Model",
              "Production",
              "Rework",
              "Defect Ratio",
              "Severity",
              "Visual",
            ].map((h, i) => (
              <th
                key={h}
                onClick={() =>
                  SORT_COLS.includes(h)
                    ? handleSort(SORT_KEYS[SORT_COLS.indexOf(h)])
                    : null
                }
                className={`px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap text-center
                  ${i === 1 ? "text-left" : ""}
                  ${SORT_COLS.includes(h) ? "cursor-pointer hover:bg-slate-200" : ""}`}
              >
                <span className="flex items-center justify-center gap-1">
                  {h}
                  {SORT_COLS.includes(h) && (
                    <SortIcon
                      active={sortCol === SORT_KEYS[SORT_COLS.indexOf(h)]}
                      dir={sortDir}
                    />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => {
            const rl = ratioLevel(row.defectRatio);
            return (
              <tr
                key={i}
                className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40"
              >
                <td className="px-3 py-2 border-b border-slate-100 text-slate-400 font-mono text-center">
                  {i + 1}
                </td>
                <td className="px-3 py-2 border-b border-slate-100 font-semibold text-slate-800 font-mono max-w-[200px] truncate">
                  {row.Model_Name}
                </td>
                <td className="px-3 py-2 border-b border-slate-100 text-center font-bold font-mono text-blue-700">
                  {row.production != null ? (
                    row.production.toLocaleString()
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="px-3 py-2 border-b border-slate-100 text-center">
                  <span className="bg-red-50 text-red-700 border border-red-200 rounded-md px-2 py-0.5 font-bold font-mono">
                    {row.reworkTotal}
                  </span>
                </td>
                <td className="px-3 py-2 border-b border-slate-100 text-center">
                  {row.defectRatio != null ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${Math.min(row.defectRatio, 100)}%`,
                            backgroundColor: rl.hex,
                          }}
                        />
                      </div>
                      <span
                        className={`font-bold font-mono text-sm ${rl.color}`}
                      >
                        {row.defectRatio.toFixed(2)}%
                      </span>
                    </div>
                  ) : (
                    <span className="text-slate-300 font-mono">N/A</span>
                  )}
                </td>
                <td className="px-3 py-2 border-b border-slate-100 text-center">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border font-mono ${rl.bg} ${rl.color} ${rl.border}`}
                  >
                    {row.defectRatio != null ? rl.label : "No Data"}
                  </span>
                </td>
                <td className="px-3 py-2 border-b border-slate-100 text-center">
                  {row.defectRatio != null && (
                    <div className="flex justify-center gap-1">
                      {[2, 5, 10].map((thresh, ti) => (
                        <div
                          key={ti}
                          className="w-2.5 h-2.5 rounded-sm border transition-colors"
                          style={{
                            background:
                              row.defectRatio > thresh ? rl.hex : "#f1f5f9",
                            borderColor:
                              row.defectRatio > thresh ? rl.hex : "#e2e8f0",
                          }}
                        />
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
          {sorted.length > 0 && (
            <tr className="bg-slate-800 text-white">
              <td className="px-3 py-3" />
              <td className="px-3 py-3 font-bold font-mono text-[11px] uppercase tracking-wider">
                TOTAL
              </td>
              <td className="px-3 py-3 text-center font-bold font-mono text-blue-300">
                {totProd.toLocaleString()}
              </td>
              <td className="px-3 py-3 text-center font-bold font-mono text-red-300">
                {totRW.toLocaleString()}
              </td>
              <td className="px-3 py-3 text-center">
                {totRatio != null && (
                  <span
                    className="font-bold font-mono text-sm"
                    style={{ color: totRl.hex }}
                  >
                    {totRatio.toFixed(2)}%
                  </span>
                )}
              </td>
              <td className="px-3 py-3 text-center">
                {totRatio != null && (
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border font-mono ${totRl.bg} ${totRl.color} ${totRl.border}`}
                  >
                    {totRl.label}
                  </span>
                )}
              </td>
              <td className="px-3 py-3" />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

// ── Breakdown Table ────────────────────────────────────────────────────────────
const BreakdownTable = ({ data, selectedModel, onModelClick }) => {
  const totals = useMemo(
    () =>
      data.reduce(
        (a, r) => ({
          total: a.total + r.total,
          open: a.open + r.open,
          closed: a.closed + r.closed,
        }),
        { total: 0, open: 0, closed: 0 },
      ),
    [data],
  );
  const totRate =
    totals.total > 0 ? Math.round((totals.closed / totals.total) * 100) : 0;

  return (
    <div className="overflow-auto">
      <table className="min-w-full text-xs border-separate border-spacing-0">
        <thead className="sticky top-0 z-10">
          <tr className="bg-slate-100">
            {[
              "Sr. No.",
              "Model",
              "Total",
              "Open",
              "Closed",
              "Close Rate",
              "",
            ].map((h, i) => (
              <th
                key={h}
                className={`px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap ${
                  i <= 1 ? "text-left" : "text-center"
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => {
            const rate =
              row.total > 0 ? Math.round((row.closed / row.total) * 100) : 0;
            const isAct = selectedModel === row.Model_Name;
            const rcHex =
              rate >= 70 ? "#16a34a" : rate >= 40 ? "#d97706" : "#dc2626";
            const rc =
              rate >= 70
                ? "text-emerald-600"
                : rate >= 40
                  ? "text-amber-600"
                  : "text-red-600";
            return (
              <tr
                key={i}
                onClick={() => onModelClick(row.Model_Name)}
                className={`cursor-pointer transition-colors ${
                  isAct
                    ? "bg-blue-50 border-l-2 border-blue-500"
                    : "hover:bg-blue-50/60 even:bg-slate-50/40"
                }`}
              >
                <td className="px-3 py-2.5 border-b border-slate-100 text-slate-400 font-mono">
                  {i + 1}
                </td>
                <td
                  className={`px-3 py-2.5 border-b border-slate-100 font-semibold font-mono ${
                    isAct ? "text-blue-700" : "text-slate-800"
                  }`}
                >
                  {row.Model_Name}
                </td>
                <td className="px-3 py-2.5 border-b border-slate-100 text-center font-bold font-mono text-blue-700 text-sm">
                  {row.total}
                </td>
                <td className="px-3 py-2.5 border-b border-slate-100 text-center">
                  <span className="bg-red-50 text-red-700 border border-red-200 rounded-md px-2 py-0.5 font-bold font-mono">
                    {row.open}
                  </span>
                </td>
                <td className="px-3 py-2.5 border-b border-slate-100 text-center">
                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md px-2 py-0.5 font-bold font-mono">
                    {row.closed}
                  </span>
                </td>
                <td className="px-3 py-2.5 border-b border-slate-100">
                  <div className="flex items-center gap-2 min-w-[130px]">
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${rate}%`, backgroundColor: rcHex }}
                      />
                    </div>
                    <span
                      className={`text-[11px] font-mono font-bold min-w-[34px] ${rc}`}
                    >
                      {rate}%
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2.5 border-b border-slate-100 text-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onModelClick(row.Model_Name);
                    }}
                    className={`px-3 py-1 rounded-md border text-[10px] font-bold font-mono uppercase tracking-wider transition-all ${
                      isAct
                        ? "bg-blue-50 border-blue-300 text-blue-700"
                        : "bg-white border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600"
                    }`}
                  >
                    {isAct ? "Clear" : "Filter"}
                  </button>
                </td>
              </tr>
            );
          })}
          {data.length > 0 && (
            <tr className="bg-slate-800 text-white">
              <td className="px-3 py-3" />
              <td className="px-3 py-3 font-bold font-mono text-[11px] uppercase tracking-wider">
                TOTAL
              </td>
              <td className="px-3 py-3 text-center font-bold font-mono text-blue-300 text-sm">
                {totals.total}
              </td>
              <td className="px-3 py-3 text-center font-bold font-mono text-red-300">
                {totals.open}
              </td>
              <td className="px-3 py-3 text-center font-bold font-mono text-emerald-300">
                {totals.closed}
              </td>
              <td className="px-3 py-3">
                <div className="flex items-center gap-2 min-w-[130px]">
                  <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white/60 rounded-full"
                      style={{ width: `${totRate}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-mono font-bold text-white">
                    {totRate}%
                  </span>
                </div>
              </td>
              <td className="px-3 py-3" />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

// ── Group By options (Detail row fields available to group/breakdown by) ───────
const GROUP_OPTIONS = [
  { label: "Model", value: "Model_Name" },
  { label: "Category", value: "Category" },
  { label: "Station", value: "Station" },
  { label: "Process Code", value: "Process_Code" },
  { label: "User", value: "UserName" },
  { label: "Status", value: "Rework_Status" },
  { label: "Defect Category", value: "Defect_Category" },
  { label: "Defect", value: "Defect" },
  { label: "Root Cause", value: "Root_Cause" },
  { label: "Counter Action", value: "Counter_Action" },
];

// ── Group Summary Table (Sr.No / [field] / Count / Share) ──────────────────────
const GroupSummaryTable = ({ grouped, groupLabel, totalCount }) => {
  if (!grouped || grouped.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-400 py-12">
        <PackageOpen className="w-8 h-8 opacity-20" strokeWidth={1.2} />
        <p className="text-xs">No data to group.</p>
      </div>
    );
  }

  return (
    <div className="overflow-auto flex-1">
      <table className="min-w-full text-xs text-left border-separate border-spacing-0">
        <thead className="sticky top-0 z-10">
          <tr className="bg-slate-100">
            <th className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 text-center whitespace-nowrap w-12">
              Sr. No.
            </th>
            <th className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 text-left whitespace-nowrap">
              {groupLabel}
            </th>
            <th className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 text-center whitespace-nowrap">
              Count
            </th>
            <th className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 text-center whitespace-nowrap">
              Share
            </th>
          </tr>
        </thead>
        <tbody>
          {grouped.map((item, i) => {
            const pct = totalCount
              ? Math.round((item.count / totalCount) * 100)
              : 0;
            return (
              <tr
                key={i}
                className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40"
              >
                <td className="px-3 py-2.5 border-b border-slate-100 text-center font-bold text-blue-600">
                  {i + 1}
                </td>
                <td className="px-3 py-2.5 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden w-20 shrink-0">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          i === 0
                            ? "bg-blue-500"
                            : i === 1
                              ? "bg-violet-500"
                              : "bg-slate-400"
                        }`}
                        style={{ width: `${Math.max(pct, 4)}%` }}
                      />
                    </div>
                    <span
                      className="text-xs text-slate-700 font-medium truncate max-w-[240px]"
                      title={item.key}
                    >
                      {item.key}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2.5 border-b border-slate-100 text-center font-bold text-slate-900">
                  {item.count}
                </td>
                <td className="px-3 py-2.5 border-b border-slate-100 text-center">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                    {pct}%
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ── KPI Card ───────────────────────────────────────────────────────────────────
const KpiCard = ({
  label,
  value,
  badge,
  colorClass = "bg-blue-50 border-blue-100",
  textClass = "text-blue-700",
  subClass = "text-blue-500",
}) => (
  <div
    className={`flex flex-col items-center px-4 py-2 rounded-lg border min-w-[90px] ${colorClass}`}
  >
    <span className={`text-xl font-bold font-mono ${textClass}`}>{value}</span>
    <span
      className={`text-[10px] font-medium uppercase tracking-wide ${subClass}`}
    >
      {label}
    </span>
    {badge && (
      <span
        className={`mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border font-mono ${badge.bg} ${badge.color} ${badge.border}`}
      >
        {badge.label}
      </span>
    )}
  </div>
);

// ── Detail columns ─────────────────────────────────────────────────────────────
const DETAIL_COLUMNS = [
  "Model_Name",
  "Category",
  "Station",
  "Process_Code",
  "Assembly_Sr_No",
  "Rework_IN",
  "Rework_Out",
  "UserName",
  "Rework_Status",
  "Duration",
  "Defect_Category",
  "Defect",
  "Root_Cause",
  "Counter_Action",
  "Remark",
];

// ── Active Filter Banner ───────────────────────────────────────────────────────
const ActiveFilterBanner = ({
  categories,
  onClear,
  onRemove,
  recordCount,
  totalCount,
}) => {
  if (categories.length === 0) return null;
  return (
    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 flex-wrap">
      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-blue-600">
        <Tag className="w-3 h-3" /> Category filter active:
      </span>
      {categories.map((c) => (
        <span
          key={c}
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold font-mono border border-blue-200"
        >
          {c}
          <button
            onClick={() => onRemove(c)}
            className="hover:text-blue-900 transition-colors"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </span>
      ))}
      <button
        onClick={onClear}
        className="text-[10px] text-slate-400 hover:text-red-500 font-semibold transition-colors ml-1"
      >
        Clear all
      </button>
      {totalCount > 0 && (
        <span className="ml-auto text-[10px] font-mono text-slate-400">
          Showing{" "}
          <b className="text-blue-600">{recordCount.toLocaleString()}</b> of{" "}
          <b className="text-slate-600">{totalCount.toLocaleString()}</b>{" "}
          records
        </span>
      )}
    </div>
  );
};

// ── SVG → PNG data URL (no external lib needed) ────────────────────────────────
const svgToDataURL = (containerEl) =>
  new Promise((resolve) => {
    if (!containerEl) return resolve(null);
    const svgEl = containerEl.querySelector("svg");
    if (!svgEl) return resolve(null);

    const bbox = svgEl.getBoundingClientRect();
    const w = Math.max(bbox.width || 600, 400);
    const h = Math.max(bbox.height || 300, 150);

    const serializer = new XMLSerializer();
    let svgStr = serializer.serializeToString(svgEl);
    if (!svgStr.includes("xmlns=")) {
      svgStr = svgStr.replace(
        "<svg",
        '<svg xmlns="http://www.w3.org/2000/svg"',
      );
    }
    // Ensure white background in the captured image
    svgStr = svgStr.replace(
      "<svg",
      '<svg style="background:#ffffff;font-family:monospace,sans-serif;"',
    );

    const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = w * scale;
      canvas.height = h * scale;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve({ dataURL: canvas.toDataURL("image/png"), w, h });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });

// ── Main Component ─────────────────────────────────────────────────────────────
const ReworkReport = () => {
  const [loadingKey, setLoadingKey] = useState(null);
  const [activeTab, setActiveTab] = useState("summary");
  const [groupBy, setGroupBy] = useState(GROUP_OPTIONS[0]);
  const [exporting, setExporting] = useState(null); // 'excel' | 'pdf'
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  const [selectedModelVariant, setSelectedModelVariant] = useState(null);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [reworkData, setReworkData] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(1000);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedModel, setSelectedModel] = useState(null);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedDefects, setSelectedDefects] = useState([]);
  const [defectOptions, setDefectOptions] = useState([]);

  const [productionMap, setProductionMap] = useState({});
  const [totalProduction, setTotalProduction] = useState(0);

  // Chart refs for PDF capture
  const summaryChartRef = useRef(null);
  const defectChartRef = useRef(null);
  const exportMenuRef = useRef(null);

  const abortRef = useRef(null);
  const observerRef = useRef(null);
  const fetchParamsRef = useRef({});

  const {
    data: variants = [],
    isLoading: variantsLoading,
    error: variantsError,
  } = useGetModelVariantsQuery();

  useEffect(() => {
    if (variantsError) toast.error("Failed to load model variants");
  }, [variantsError]);

  // Close export menu on outside click
  useEffect(() => {
    const handler = (e) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Build API params ────────────────────────────────────────────────────────
  // NOTE: defects are pipe-joined (not comma) since defect descriptions can
  // contain commas — must match Backend's expandDefects().
  const buildParams = useCallback(
    (extra = {}) => ({
      model: selectedModelVariant?.value || null,
      categories:
        selectedCategories.length > 0 ? selectedCategories.join(",") : null,
      defects: selectedDefects.length > 0 ? selectedDefects.join("|") : null,
      ...extra,
    }),
    [selectedModelVariant, selectedCategories, selectedDefects],
  );

  // ── Infinite-scroll sentinel ────────────────────────────────────────────────
  const lastRowRef = useCallback(
    (node) => {
      if (loadingKey) return;
      if (observerRef.current) observerRef.current.disconnect();
      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) setPage((p) => p + 1);
      });
      if (node) observerRef.current.observe(node);
    },
    [loadingKey, hasMore],
  );

  // ── Production fetch ────────────────────────────────────────────────────────
  const fetchProductionData = useCallback(async (st, et, modelVal, cats) => {
    try {
      setLoadingKey("prod");
      const res = await axios.get(`${baseURL}quality/production-report`, {
        params: {
          startTime: st,
          endTime: et,
          model: modelVal || null,
          categories: cats.length > 0 ? cats.join(",") : null,
        },
      });
      if (res?.data?.success) {
        const map = {};
        (res.data.data || []).forEach((r) => {
          map[r.Model_Name] = Number(r.production_count) || 0;
        });
        setProductionMap(map);
        setTotalProduction(res.data.totalProduction || 0);
      }
    } catch {
      setProductionMap({});
      setTotalProduction(0);
    } finally {
      setLoadingKey((k) => (k === "prod" ? null : k));
    }
  }, []);

  // ── Defect options fetch ────────────────────────────────────────────────────
  // Full master list from DefectCodeMaster — static reference data, unrelated
  // to the current date/model/category filter, so it's fetched once on mount
  // rather than re-fetched on every query.
  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${baseURL}quality/rework-defect-options`);
        setDefectOptions(res?.data?.success ? res.data.data || [] : []);
      } catch (err) {
        console.error("Failed to fetch defect options:", err);
        setDefectOptions([]);
      }
    })();
  }, []);

  // ── Paginated rework fetch ──────────────────────────────────────────────────
  const fetchReworkPage = useCallback(
    async ({ pageNumber, st, et, modelVal, cats, defs }) => {
      try {
        setLoadingKey("query");
        const res = await axios.get(`${baseURL}quality/rework-report`, {
          params: {
            startTime: st,
            endTime: et,
            model: modelVal || null,
            categories: cats.length > 0 ? cats.join(",") : null,
            defects: defs && defs.length > 0 ? defs.join("|") : null,
            page: pageNumber,
            limit,
          },
        });
        if (res?.data?.success) {
          const nd = res.data.data || [];
          setReworkData((prev) => (pageNumber === 1 ? nd : [...prev, ...nd]));
          if (pageNumber === 1) {
            setTotalCount(res.data.totalCount || 0);
            fetchProductionData(st, et, modelVal, cats);
          }
          setHasMore(nd.length === limit);
        }
      } catch {
        toast.error("Failed to fetch rework data.");
      } finally {
        setLoadingKey((k) => (k === "query" ? null : k));
      }
    },
    [limit, fetchProductionData],
  );

  const handleQuery = useCallback(() => {
    if (!startTime || !endTime) {
      toast.error("Please select a Time Range.");
      return;
    }
    const cats = selectedCategories;
    const defs = selectedDefects;
    const modelVal = selectedModelVariant?.value || null;
    fetchParamsRef.current = {
      st: startTime,
      et: endTime,
      modelVal,
      cats,
      defs,
    };
    setPage(1);
    setReworkData([]);
    setSelectedModel(null);
    setProductionMap({});
    setTotalProduction(0);
    fetchReworkPage({
      pageNumber: 1,
      st: startTime,
      et: endTime,
      modelVal,
      cats,
      defs,
    });
  }, [
    startTime,
    endTime,
    selectedCategories,
    selectedDefects,
    selectedModelVariant,
    fetchReworkPage,
  ]);

  useEffect(() => {
    if (page > 1) {
      const { st, et, modelVal, cats, defs } = fetchParamsRef.current;
      fetchReworkPage({ pageNumber: page, st, et, modelVal, cats, defs });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // ── Quick fetch ─────────────────────────────────────────────────────────────
  const fetchQuickData = useCallback(
    async (start, end, loaderKey) => {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();

      const catsSnapshot = selectedCategories.slice();
      const defsSnapshot = selectedDefects.slice();
      const modelVal = selectedModelVariant?.value || null;

      try {
        setLoadingKey(loaderKey);
        setReworkData([]);
        setTotalCount(0);
        setSelectedModel(null);
        setProductionMap({});
        setTotalProduction(0);
        setStartTime(start);
        setEndTime(end);

        const res = await axios.get(`${baseURL}quality/rework-report-quick`, {
          params: {
            startTime: start,
            endTime: end,
            model: modelVal,
            categories: catsSnapshot.length > 0 ? catsSnapshot.join(",") : null,
            defects: defsSnapshot.length > 0 ? defsSnapshot.join("|") : null,
          },
          signal: abortRef.current.signal,
        });

        if (res?.data?.success) {
          const nd = res.data.data || [];
          setReworkData(nd);
          setTotalCount(res.data.totalCount || 0);
          setHasMore(false);
          fetchParamsRef.current = {
            st: start,
            et: end,
            modelVal,
            cats: catsSnapshot,
            defs: defsSnapshot,
          };
          fetchProductionData(start, end, modelVal, catsSnapshot);
        }
      } catch (err) {
        if (!axios.isCancel(err)) toast.error("Failed to fetch quick data.");
      } finally {
        setLoadingKey((k) => (k === loaderKey ? null : k));
      }
    },
    [
      selectedModelVariant,
      selectedCategories,
      selectedDefects,
      fetchProductionData,
    ],
  );

  const fetchYesterdayData = useCallback(() => {
    const now = new Date();
    const t8 = new Date(now);
    t8.setHours(8, 0, 0, 0);
    const y8 = new Date(t8);
    y8.setDate(t8.getDate() - 1);
    fetchQuickData(fmtDate(y8), fmtDate(t8), "yesterday");
  }, [fetchQuickData]);

  const fetchTodayData = useCallback(() => {
    const now = new Date();
    const t8 = new Date(now);
    t8.setHours(8, 0, 0, 0);
    fetchQuickData(fmtDate(t8), fmtDate(new Date()), "today");
  }, [fetchQuickData]);

  const fetchMTDData = useCallback(() => {
    const now = new Date();
    fetchQuickData(
      fmtDate(new Date(now.getFullYear(), now.getMonth(), 1, 8, 0, 0)),
      fmtDate(now),
      "mtd",
    );
  }, [fetchQuickData]);

  // Default to Today's data on first load instead of sitting empty until a
  // quick filter is clicked.
  useEffect(() => {
    fetchTodayData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Individual export helpers ───────────────────────────────────────────────
  const fetchDetailExport = async () => {
    if (!startTime || !endTime) {
      toast.error("Please select a Time Range.");
      return [];
    }
    try {
      const res = await axios.get(`${baseURL}quality/rework-report-export`, {
        params: buildParams({ startTime, endTime }),
      });
      return res?.data?.success ? res.data.data : [];
    } catch {
      toast.error("Detail export failed.");
      return [];
    }
  };

  const fetchSummaryExport = async () => {
    if (!startTime || !endTime) {
      toast.error("Please select a Time Range.");
      return [];
    }
    try {
      const res = await axios.get(`${baseURL}quality/rework-summary-export`, {
        params: buildParams({ startTime, endTime }),
      });
      return res?.data?.success ? res.data.data : [];
    } catch {
      toast.error("Summary export failed.");
      return [];
    }
  };

  const fetchDefectExport = async () => {
    if (!startTime || !endTime) {
      toast.error("Please select a Time Range.");
      return [];
    }
    try {
      const res = await axios.get(`${baseURL}quality/rework-defect-export`, {
        params: buildParams({ startTime, endTime }),
      });
      return res?.data?.success ? res.data.data : [];
    } catch {
      toast.error("Defect ratio export failed.");
      return [];
    }
  };

  // ── Derived data ────────────────────────────────────────────────────────────
  const categoryLookup = useMemo(
    () => buildCategoryLookup(reworkData),
    [reworkData],
  );

  const modelFilteredData = useMemo(
    () =>
      selectedModel
        ? reworkData.filter((x) => x.Model_Name === selectedModel)
        : reworkData,
    [reworkData, selectedModel],
  );

  const categoryFilteredData = useMemo(
    () =>
      selectedCategories.length === 0
        ? modelFilteredData
        : modelFilteredData.filter((item) => {
            const cat = categoryLookup.get(item.Model_Name);
            return cat != null && selectedCategories.includes(cat);
          }),
    [modelFilteredData, selectedCategories, categoryLookup],
  );

  // Defect filtering is now applied server-side (sent as a `defects` param,
  // same as `categories`) so the loaded data is already scoped to it — this
  // is just an alias kept so the rest of the component doesn't need touching.
  const defectFilteredData = categoryFilteredData;

  const aggregated = useMemo(() => {
    const map = {};
    defectFilteredData.forEach((item) => {
      const model = item.Model_Name?.trim() || "Not Logged In";
      if (!map[model]) map[model] = { total: 0, open: 0, closed: 0 };
      map[model].total++;
      classifyStatus(item.Rework_Status) === "closed"
        ? map[model].closed++
        : map[model].open++;
    });
    return Object.entries(map)
      .map(([k, v]) => ({ Model_Name: k, ...v, reworkTotal: v.total }))
      .sort((a, b) => b.total - a.total);
  }, [defectFilteredData]);

  // ── Group By (any detail column) breakdown ────────────────────────────────
  const groupedData = useMemo(() => {
    if (!defectFilteredData.length) return [];
    const map = defectFilteredData.reduce((acc, item) => {
      const key = item[groupBy.value]?.toString().trim() || "Unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(map)
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count);
  }, [defectFilteredData, groupBy]);

  const { totalOpen, totalClosed } = useMemo(
    () =>
      aggregated.reduce(
        (a, r) => ({
          totalOpen: a.totalOpen + r.open,
          totalClosed: a.totalClosed + r.closed,
        }),
        { totalOpen: 0, totalClosed: 0 },
      ),
    [aggregated],
  );

  const hasProd = totalProduction > 0;
  const overallRatio = hasProd
    ? (defectFilteredData.length / totalProduction) * 100
    : null;
  const overallRl = ratioLevel(overallRatio);

  const ratioData = useMemo(
    () =>
      aggregated
        .map((row) => {
          const prod = productionMap[row.Model_Name] ?? null;
          const ratio = prod ? (row.reworkTotal / prod) * 100 : null;
          return { ...row, production: prod, defectRatio: ratio };
        })
        .sort((a, b) => {
          if (a.defectRatio == null && b.defectRatio == null) return 0;
          if (a.defectRatio == null) return 1;
          if (b.defectRatio == null) return -1;
          return b.defectRatio - a.defectRatio;
        }),
    [aggregated, productionMap],
  );

  const hasData = reworkData.length > 0;
  const isLoading = loadingKey === "query";
  const isProd = loadingKey === "prod";
  // Total shown in KPIs reflects the currently-filtered view
  const filteredTotal = defectFilteredData.length;

  const handleModelClick = (model) => {
    setSelectedModel((prev) => (prev === model ? null : model));
    setActiveTab("detail");
  };

  // ── Multi-sheet Excel export ────────────────────────────────────────────────
  const exportAllExcel = async () => {
    if (!hasData) {
      toast.error("No data to export.");
      return;
    }
    setExporting("excel");
    setExportMenuOpen(false);

    try {
      const [summaryData, defectData, detailData] = await Promise.all([
        fetchSummaryExport(),
        fetchDefectExport(),
        fetchDetailExport(),
      ]);

      const wb = XLSX.utils.book_new();

      // Sheet 1 – Summary
      const summaryRows = aggregated.map((r, i) => ({
        "Sr. No.": i + 1,
        Model: r.Model_Name,
        Total: r.total,
        Open: r.open,
        Closed: r.closed,
        "Close Rate %":
          r.total > 0 ? Number(((r.closed / r.total) * 100).toFixed(2)) : 0,
      }));
      const ws1 = XLSX.utils.json_to_sheet(summaryRows);
      ws1["!cols"] = [
        { wch: 8 },
        { wch: 35 },
        { wch: 8 },
        { wch: 8 },
        { wch: 8 },
        { wch: 13 },
      ];
      XLSX.utils.book_append_sheet(wb, ws1, "Summary");

      // Sheet 2 – Defect Ratio (from API for per-model production accuracy)
      const defectRows =
        defectData.length > 0
          ? defectData
          : ratioData.map((r, i) => ({
              "Sr. No.": i + 1,
              Model: r.Model_Name,
              Production: r.production ?? 0,
              Rework_Total: r.reworkTotal,
              Open: r.open,
              Closed: r.closed,
              "Defect Ratio %":
                r.defectRatio != null ? Number(r.defectRatio.toFixed(2)) : null,
              Severity:
                r.defectRatio != null
                  ? ratioLevel(r.defectRatio).label
                  : "No Data",
            }));
      const ws2 = XLSX.utils.json_to_sheet(
        defectRows.length ? defectRows : [{ note: "No data" }],
      );
      ws2["!cols"] = [
        { wch: 8 },
        { wch: 35 },
        { wch: 12 },
        { wch: 10 },
        { wch: 8 },
        { wch: 8 },
        { wch: 14 },
        { wch: 12 },
      ];
      XLSX.utils.book_append_sheet(wb, ws2, "Defect Ratio");

      // Sheet 3 – Detail Records
      const ws3 = XLSX.utils.json_to_sheet(
        detailData.length > 0 ? detailData : [{ note: "No data" }],
      );
      XLSX.utils.book_append_sheet(wb, ws3, "Detail Records");

      const dateStr = new Date().toISOString().split("T")[0];
      XLSX.writeFile(wb, `Rework_Report_All_${dateStr}.xlsx`);
      toast.success("Excel report (3 sheets) downloaded!");
    } catch (err) {
      console.error(err);
      toast.error("Excel export failed.");
    } finally {
      setExporting(null);
    }
  };

  // ── PDF export with charts ──────────────────────────────────────────────────
  const exportAllPDF = async () => {
    if (!hasData) {
      toast.error("No data to export.");
      return;
    }
    setExporting("pdf");
    setExportMenuOpen(false);

    try {
      // Capture chart images in parallel
      const [summaryImg, defectImg] = await Promise.all([
        svgToDataURL(summaryChartRef.current),
        svgToDataURL(defectChartRef.current),
      ]);

      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });
      const PW = doc.internal.pageSize.getWidth(); // 297mm
      const PH = doc.internal.pageSize.getHeight(); // 210mm
      const margin = 12;
      const dateRange =
        startTime && endTime ? `${startTime}  →  ${endTime}` : "All Records";

      // ── Page 1: Header + KPIs + Summary Chart + Model Table ──
      doc.setFillColor(30, 64, 175);
      doc.rect(0, 0, PW, 18, "F");
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text("Rework Report — Quality Control Dashboard", margin, 12);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(`Period: ${dateRange}`, PW - margin, 8, { align: "right" });
      doc.text(
        `Exported: ${new Date().toLocaleString("en-IN")}`,
        PW - margin,
        13,
        { align: "right" },
      );

      // KPI row
      doc.setTextColor(30, 41, 59);
      let kx = margin;
      const kpiItems = [
        {
          label: "TOTAL REWORK",
          value: filteredTotal.toLocaleString(),
          bg: [239, 246, 255],
          fg: [29, 78, 216],
        },
        {
          label: "OPEN / PENDING",
          value: totalOpen.toLocaleString(),
          bg: [254, 242, 242],
          fg: [185, 28, 28],
        },
        {
          label: "CLOSED",
          value: totalClosed.toLocaleString(),
          bg: [236, 253, 245],
          fg: [5, 150, 105],
        },
        ...(overallRatio != null
          ? [
              {
                label: "DEFECT RATIO",
                value: `${overallRatio.toFixed(2)}%`,
                bg: [255, 251, 235],
                fg: [217, 119, 6],
              },
            ]
          : []),
      ];
      kpiItems.forEach((k) => {
        doc.setFillColor(...k.bg);
        doc.roundedRect(kx, 20, 52, 16, 2, 2, "F");
        doc.setFontSize(13);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...k.fg);
        doc.text(k.value, kx + 26, 30, { align: "center" });
        doc.setFontSize(6.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        doc.text(k.label, kx + 26, 34, { align: "center" });
        kx += 55;
      });

      let y = 40;

      // Summary bar chart
      if (summaryImg) {
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 41, 59);
        doc.text("Rework Volume by Model", margin, y + 5);
        y += 7;
        const chartW = PW - margin * 2;
        const chartH = Math.min(70, Math.max(40, aggregated.length * 5 + 30));
        doc.addImage(summaryImg.dataURL, "PNG", margin, y, chartW, chartH);
        y += chartH + 4;
      }

      // Summary table
      if (y > PH - 40) {
        doc.addPage();
        y = margin;
      }
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59);
      doc.text("Model Breakdown", margin, y + 5);
      y += 7;

      autoTable(doc, {
        startY: y,
        head: [["Sr.", "Model", "Total", "Open", "Closed", "Close Rate %"]],
        body: aggregated.map((r, i) => [
          i + 1,
          r.Model_Name,
          r.total,
          r.open,
          r.closed,
          r.total > 0 ? `${((r.closed / r.total) * 100).toFixed(1)}%` : "0%",
        ]),
        styles: { fontSize: 7.5, cellPadding: 1.8, font: "helvetica" },
        headStyles: {
          fillColor: [30, 64, 175],
          textColor: 255,
          fontStyle: "bold",
          halign: "center",
        },
        columnStyles: {
          0: { cellWidth: 10, halign: "center" },
          1: { cellWidth: 80 },
          2: { halign: "center", fontStyle: "bold", textColor: [29, 78, 216] },
          3: { halign: "center", fontStyle: "bold", textColor: [185, 28, 28] },
          4: { halign: "center", fontStyle: "bold", textColor: [5, 150, 105] },
          5: { halign: "center" },
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: margin, right: margin },
      });

      // ── Page 2: Defect Ratio ──
      doc.addPage();
      y = margin;

      // Page header stripe
      doc.setFillColor(180, 83, 9);
      doc.rect(0, 0, PW, 10, "F");
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text("Defect Ratio Analysis", margin, 7);
      y = 14;

      if (defectImg) {
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 41, 59);
        doc.text("Defect Ratio by Model (Rework ÷ Production)", margin, y + 5);
        y += 7;
        const chartW = PW - margin * 2;
        const chartH = Math.min(
          75,
          Math.max(
            40,
            ratioData.filter((r) => r.defectRatio != null).length * 5 + 30,
          ),
        );
        doc.addImage(defectImg.dataURL, "PNG", margin, y, chartW, chartH);
        y += chartH + 4;
      }

      if (y > PH - 40) {
        doc.addPage();
        y = margin;
      }
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59);
      doc.text("Per-Model Defect Ratio Table", margin, y + 5);
      y += 7;

      autoTable(doc, {
        startY: y,
        head: [
          [
            "Sr.",
            "Model",
            "Production",
            "Rework",
            "Open",
            "Closed",
            "Defect Ratio %",
            "Severity",
          ],
        ],
        body: ratioData.map((r, i) => [
          i + 1,
          r.Model_Name,
          r.production != null ? r.production.toLocaleString() : "—",
          r.reworkTotal,
          r.open,
          r.closed,
          r.defectRatio != null ? `${r.defectRatio.toFixed(2)}%` : "N/A",
          r.defectRatio != null ? ratioLevel(r.defectRatio).label : "No Data",
        ]),
        styles: { fontSize: 7.5, cellPadding: 1.8 },
        headStyles: {
          fillColor: [180, 83, 9],
          textColor: 255,
          fontStyle: "bold",
          halign: "center",
        },
        columnStyles: {
          0: { cellWidth: 10, halign: "center" },
          1: { cellWidth: 70 },
          2: { halign: "center", textColor: [29, 78, 216] },
          3: { halign: "center", textColor: [185, 28, 28] },
          4: { halign: "center" },
          5: { halign: "center" },
          6: { halign: "center", fontStyle: "bold" },
          7: { halign: "center", fontStyle: "bold" },
        },
        alternateRowStyles: { fillColor: [255, 251, 235] },
        margin: { left: margin, right: margin },
        didParseCell: (data) => {
          if (data.section === "body" && data.column.index === 7) {
            const sev = data.cell.text[0];
            const colors = {
              Critical: [220, 38, 38],
              High: [217, 119, 6],
              Moderate: [234, 88, 12],
              Good: [22, 163, 74],
            };
            if (colors[sev]) data.cell.styles.textColor = colors[sev];
          }
        },
      });

      // ── Page 3: Detail Records ──
      if (defectFilteredData.length > 0) {
        doc.addPage();
        doc.setFillColor(30, 41, 59);
        doc.rect(0, 0, PW, 10, "F");
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 255, 255);
        doc.text(
          `Detail Records  (${defectFilteredData.length.toLocaleString()} rows — first 500 shown in PDF)`,
          margin,
          7,
        );

        const sliceData = defectFilteredData.slice(0, 500);
        autoTable(doc, {
          startY: 14,
          head: [
            [
              "Sr.",
              "Model",
              "Category",
              "Station",
              "Process",
              "Assy Sr. No.",
              "Rework IN",
              "Rework Out",
              "User",
              "Status",
              "Duration",
            ],
          ],
          body: sliceData.map((r, i) => [
            i + 1,
            r.Model_Name,
            r.Category ?? "—",
            r.Station ?? "—",
            r.Process_Code ?? "—",
            r.Assembly_Sr_No ?? "—",
            r.Rework_IN ? String(r.Rework_IN).slice(0, 16) : "—",
            r.Rework_Out ? String(r.Rework_Out).slice(0, 16) : "—",
            r.UserName ?? "—",
            r.Rework_Status ?? "—",
            r.Duration ?? "—",
          ]),
          styles: { fontSize: 6.5, cellPadding: 1.4 },
          headStyles: {
            fillColor: [30, 41, 59],
            textColor: 255,
            fontStyle: "bold",
            halign: "center",
            fontSize: 7,
          },
          columnStyles: {
            0: { cellWidth: 8, halign: "center" },
            1: { cellWidth: 44 },
            2: { cellWidth: 22 },
            6: { cellWidth: 24 },
            7: { cellWidth: 24 },
          },
          alternateRowStyles: { fillColor: [241, 245, 249] },
          margin: { left: margin, right: margin },
        });
      }

      // Page numbers
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(148, 163, 184);
        doc.text(`Page ${i} of ${pageCount}`, PW - margin, PH - 4, {
          align: "right",
        });
        doc.text("WRL Dashboard — Rework Report", margin, PH - 4);
      }

      const dateStr = new Date().toISOString().split("T")[0];
      doc.save(`Rework_Report_${dateStr}.pdf`);
      toast.success("PDF report downloaded!");
    } catch (err) {
      console.error(err);
      toast.error("PDF export failed.");
    } finally {
      setExporting(null);
    }
  };

  const TABS = [
    { id: "summary", icon: BarChart2, label: "Summary" },
    { id: "defect", icon: Target, label: "Defect Ratio" },
    { id: "detail", icon: List, label: "Detail View" },
  ];

  if (variantsLoading) return <Loader />;

  const anyExporting = exporting !== null;

  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      {/* ── PAGE HEADER ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shadow-sm shrink-0 gap-3">
        <div className="shrink-0">
          <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-tight">
            Rework Report
          </h1>
          <p className="text-[11px] text-slate-400">
            Quality Control · Rework &amp; Defect Ratio Dashboard
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {hasData && (
            <>
              <KpiCard
                label="Total Rework"
                value={filteredTotal.toLocaleString()}
                colorClass="bg-blue-50 border-blue-100"
                textClass="text-blue-700"
                subClass="text-blue-500"
              />
              <KpiCard
                label="Open / Pending"
                value={totalOpen}
                colorClass="bg-red-50 border-red-100"
                textClass="text-red-700"
                subClass="text-red-500"
              />
              <KpiCard
                label="Closed"
                value={totalClosed}
                colorClass="bg-emerald-50 border-emerald-100"
                textClass="text-emerald-700"
                subClass="text-emerald-500"
              />
              {overallRatio != null && (
                <KpiCard
                  label="Defect Ratio"
                  value={`${overallRatio.toFixed(2)}%`}
                  colorClass={`${overallRl.bg} ${overallRl.border}`}
                  textClass={overallRl.color}
                  subClass={overallRl.color}
                  badge={overallRl}
                />
              )}

              {/* Export All dropdown */}
              <div className="relative shrink-0" ref={exportMenuRef}>
                <button
                  onClick={() => setExportMenuOpen((v) => !v)}
                  disabled={anyExporting}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold transition-all shadow-sm ${
                    anyExporting
                      ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                      : "bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:text-blue-700"
                  }`}
                >
                  {anyExporting ? (
                    <Spinner cls="w-3.5 h-3.5" />
                  ) : (
                    <FileDown className="w-3.5 h-3.5" />
                  )}
                  {anyExporting
                    ? exporting === "excel"
                      ? "Exporting Excel…"
                      : "Exporting PDF…"
                    : "Export All"}
                  <ChevronDown
                    className={`w-3 h-3 transition-transform ${exportMenuOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {exportMenuOpen && !anyExporting && (
                  <div className="absolute right-0 top-full mt-1.5 w-56 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                    <div className="px-3 py-2 border-b border-slate-100 bg-slate-50">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Export Format
                      </p>
                    </div>
                    <button
                      onClick={exportAllExcel}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors text-left"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <div className="font-semibold text-sm">
                          Excel (All Tabs)
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Summary + Defect Ratio + Detail
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={exportAllPDF}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-red-50 hover:text-red-700 transition-colors text-left border-t border-slate-100"
                    >
                      <FileText className="w-4 h-4 text-red-500 shrink-0" />
                      <div>
                        <div className="font-semibold text-sm">
                          PDF (with Charts)
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Bar charts + formatted tables
                        </div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-3">
        {/* ── FILTERS ROW ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 shrink-0">
          <div className="flex items-center gap-1.5 mb-3 flex-wrap">
            <Filter className="w-3 h-3 text-slate-400" />
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
              Filters
            </p>
            {(selectedCategories.length > 0 || selectedDefects.length > 0) && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                <Tag className="w-2.5 h-2.5" />
                {selectedCategories.length + selectedDefects.length} filter
                {selectedCategories.length + selectedDefects.length === 1
                  ? ""
                  : "s"}{" "}
                active — re-run to update
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="min-w-[190px] flex-1">
              <SelectField
                label="Model Variant"
                options={variants}
                value={selectedModelVariant?.value || ""}
                onChange={(e) =>
                  setSelectedModelVariant(
                    variants.find((v) => v.value === e.target.value) || null,
                  )
                }
              />
            </div>
            <div className="min-w-[190px] flex-1">
              <CategoryMultiSelect
                selected={selectedCategories}
                onChange={setSelectedCategories}
              />
            </div>
            <div className="min-w-[190px] flex-1">
              <DefectMultiSelect
                options={defectOptions}
                selected={selectedDefects}
                onChange={setSelectedDefects}
              />
            </div>
            <div className="min-w-[185px] flex-1">
              <DateTimePicker
                label="Start Time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="min-w-[185px] flex-1">
              <DateTimePicker
                label="End Time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>

            {/* All action buttons — Run Query, quick filters — inline */}
            <div className="flex items-center gap-2 pb-0.5 flex-wrap">
              <button
                onClick={handleQuery}
                disabled={isLoading}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  isLoading
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
                }`}
              >
                {isLoading ? <Spinner /> : <RefreshCw className="w-4 h-4" />}
                {isLoading ? "Loading…" : "Run Query"}
              </button>

              <button
                onClick={fetchYesterdayData}
                disabled={loadingKey === "yesterday"}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  loadingKey === "yesterday"
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-amber-500 hover:bg-amber-600 text-white shadow-sm"
                }`}
              >
                {loadingKey === "yesterday" && <Spinner cls="w-4 h-4" />}
                {loadingKey === "yesterday" ? "Loading…" : "Yesterday"}
              </button>

              <button
                onClick={fetchTodayData}
                disabled={loadingKey === "today"}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  loadingKey === "today"
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                }`}
              >
                {loadingKey === "today" && <Spinner cls="w-4 h-4" />}
                {loadingKey === "today" ? "Loading…" : "Today"}
              </button>

              <button
                onClick={fetchMTDData}
                disabled={loadingKey === "mtd"}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  loadingKey === "mtd"
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                }`}
              >
                {loadingKey === "mtd" && <Spinner cls="w-4 h-4" />}
                {loadingKey === "mtd" ? "Loading…" : "MTD"}
              </button>

              {selectedModel && (
                <button
                  onClick={() => setSelectedModel(null)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition-all"
                >
                  <Filter className="w-3 h-3" /> {selectedModel}{" "}
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          <ActiveFilterBanner
            categories={selectedCategories}
            onClear={() => setSelectedCategories([])}
            onRemove={(c) =>
              setSelectedCategories((prev) => prev.filter((x) => x !== c))
            }
            recordCount={defectFilteredData.length}
            totalCount={hasData ? reworkData.length : 0}
          />
        </div>

        {/* ── EMPTY / LOADING STATE ── */}
        {!hasData && !isLoading && (
          <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-3 text-slate-400 py-24">
            <PackageOpen className="w-14 h-14 opacity-20" strokeWidth={1.2} />
            <p className="text-base font-bold text-slate-500">No data loaded</p>
            <p className="text-sm text-slate-400">
              Run a query or select a quick filter to load rework records
            </p>
          </div>
        )}
        {isLoading && !hasData && (
          <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-center gap-3">
            <Spinner cls="w-6 h-6 text-blue-600" />
            <span className="text-sm text-slate-400">
              Fetching rework data…
            </span>
          </div>
        )}

        {/* ── TAB BAR + CONTENT ── */}
        {hasData && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col shrink-0">
            {/* Tab buttons */}
            <div className="flex items-center gap-1 px-2 pt-1.5 border-b border-slate-100 bg-slate-50/50">
              {TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold whitespace-nowrap rounded-t-lg transition-all cursor-pointer ${
                      isActive
                        ? "bg-white text-blue-700 border-t-2 border-x border-t-blue-500 border-x-slate-200 -mb-px shadow-sm"
                        : "text-slate-500 hover:text-slate-700 hover:bg-slate-100/70"
                    }`}
                  >
                    <Icon
                      className={`w-3.5 h-3.5 ${isActive ? "text-blue-500" : "text-slate-400"}`}
                    />
                    {tab.label}
                    {tab.id === "detail" && (
                      <span
                        className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isActive
                            ? "bg-blue-100 text-blue-700"
                            : "bg-slate-200 text-slate-500"
                        }`}
                      >
                        {defectFilteredData.length.toLocaleString()}
                      </span>
                    )}
                    {tab.id === "defect" && overallRatio != null && (
                      <span
                        className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isActive
                            ? `${overallRl.bg} ${overallRl.color}`
                            : "bg-slate-200 text-slate-500"
                        }`}
                      >
                        {overallRatio.toFixed(2)}%
                      </span>
                    )}
                  </button>
                );
              })}
              {selectedCategories.length > 0 && (
                <div className="ml-auto flex items-center gap-1.5 pr-2">
                  <Tag className="w-3 h-3 text-blue-400" />
                  <span className="text-[10px] font-mono text-blue-600 font-bold">
                    {selectedCategories.length === 1
                      ? selectedCategories[0]
                      : `${selectedCategories.length} categories`}
                  </span>
                  <button
                    onClick={() => setSelectedCategories([])}
                    className="w-4 h-4 rounded-full bg-slate-200 hover:bg-red-100 text-slate-500 hover:text-red-600 flex items-center justify-center transition-colors"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              )}
            </div>

            {/* ══════════════ SUMMARY TAB ══════════════ */}
            {activeTab === "summary" && (
              <div className="p-4 flex flex-col gap-4">
                <div className="grid grid-cols-1 xl:grid-cols-[1fr_260px] gap-4">
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <BarChart2 className="w-3.5 h-3.5 text-blue-500" />
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                        Rework Volume by Model
                      </span>
                      {selectedCategories.length > 0 && (
                        <span className="ml-auto text-[10px] font-mono text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                          {selectedCategories.join(", ")}
                        </span>
                      )}
                    </div>
                    {aggregated.length > 0 ? (
                      <ReworkBarChart
                        data={aggregated}
                        chartRef={summaryChartRef}
                      />
                    ) : (
                      <p className="text-xs text-slate-400 font-mono">
                        No model data
                      </p>
                    )}
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                        Resolution Rate
                      </span>
                    </div>
                    <div className="flex flex-col items-center gap-4">
                      <DonutChart open={totalOpen} closed={totalClosed} />
                      <div className="w-full flex flex-col gap-2">
                        {[
                          {
                            label: "Closed",
                            val: totalClosed,
                            cls: "bg-emerald-50 border-emerald-200 text-emerald-700",
                          },
                          {
                            label: "Open / Pending",
                            val: totalOpen,
                            cls: "bg-red-50 border-red-200 text-red-700",
                          },
                        ].map((s) => (
                          <div
                            key={s.label}
                            className={`flex justify-between items-center px-3 py-2 rounded-lg border ${s.cls}`}
                          >
                            <span className="text-[11px] font-mono">
                              {s.label}
                            </span>
                            <span className="text-lg font-black font-mono">
                              {s.val.toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <List className="w-3.5 h-3.5 text-blue-500" />
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                        Model Breakdown
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-slate-400">
                        {aggregated.length} model
                        {aggregated.length !== 1 ? "s" : ""} · Click row to
                        filter detail
                      </span>
                      <button
                        onClick={async () => {
                          const data = await fetchSummaryExport();
                          if (data.length) {
                            const ws = XLSX.utils.json_to_sheet(data);
                            const wb = XLSX.utils.book_new();
                            XLSX.utils.book_append_sheet(wb, ws, "Summary");
                            XLSX.writeFile(
                              wb,
                              `Rework_Summary_${new Date().toISOString().split("T")[0]}.xlsx`,
                            );
                            toast.success("Summary exported!");
                          }
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-[11px] font-semibold hover:bg-emerald-100 transition-all"
                      >
                        <FileSpreadsheet className="w-3 h-3" /> Export
                      </button>
                    </div>
                  </div>
                  <BreakdownTable
                    data={aggregated}
                    selectedModel={selectedModel}
                    onModelClick={handleModelClick}
                  />
                </div>

                {/* ── Group By (any column) ── */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
                  {/* Group Selector */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 xl:col-span-1">
                    <div className="flex items-center gap-2 mb-3">
                      <BarChart2 className="w-3.5 h-3.5 text-blue-500" />
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                        Group By
                      </span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {GROUP_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setGroupBy(opt)}
                          className={`px-4 py-2.5 rounded-xl text-xs font-semibold text-left transition-all flex items-center justify-between border ${
                            groupBy.value === opt.value
                              ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                              : "bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200"
                          }`}
                        >
                          {opt.label}
                          {groupBy.value === opt.value && (
                            <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-md">
                              {groupedData.length} groups
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                    <div className="mt-4">
                      <button
                        onClick={() => {
                          if (!groupedData.length) {
                            toast.error("No data to export.");
                            return;
                          }
                          const rows = groupedData.map((g, i) => ({
                            "Sr. No.": i + 1,
                            [groupBy.label]: g.key,
                            Count: g.count,
                            "Share %": defectFilteredData.length
                              ? Math.round(
                                  (g.count / defectFilteredData.length) * 100,
                                )
                              : 0,
                          }));
                          const ws = XLSX.utils.json_to_sheet(rows);
                          const wb = XLSX.utils.book_new();
                          XLSX.utils.book_append_sheet(wb, ws, "Group Summary");
                          XLSX.writeFile(
                            wb,
                            `Rework_Group_${groupBy.label.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.xlsx`,
                          );
                          toast.success("Group summary exported!");
                        }}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-all"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" /> Export
                      </button>
                    </div>
                  </div>

                  {/* Group Summary Table */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col xl:col-span-2 min-h-[400px]">
                    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 shrink-0">
                      <Table2 className="w-3.5 h-3.5 text-blue-500" />
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                        {groupBy.label} Breakdown
                      </span>
                      {groupedData.length > 0 && (
                        <span className="ml-auto px-2 py-0.5 bg-blue-50 text-blue-700 text-[11px] font-semibold rounded-full border border-blue-100">
                          {groupedData.length} groups
                        </span>
                      )}
                    </div>
                    <div className="p-4 flex flex-col flex-1 overflow-hidden">
                      <GroupSummaryTable
                        grouped={groupedData}
                        groupLabel={groupBy.label}
                        totalCount={defectFilteredData.length}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════ DEFECT RATIO TAB ══════════════ */}
            {activeTab === "defect" && (
              <div className="p-4 flex flex-col gap-4">
                <div className="flex items-center flex-wrap gap-4 px-4 py-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-slate-400">
                    Severity:
                  </span>
                  {[
                    { label: "Good", pct: 0.5 },
                    { label: "Moderate", pct: 20 },
                    { label: "High", pct: 30 },
                    { label: "Critical", pct: 40 },
                  ].map((t) => {
                    const rl = ratioLevel(t.pct);
                    return (
                      <div key={t.label} className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border font-mono ${rl.bg} ${rl.color} ${rl.border}`}
                        >
                          {t.label}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {t.label === "Good"
                            ? "< 15%"
                            : t.label === "Moderate"
                              ? "15–25%"
                              : t.label === "High"
                                ? "25–35%"
                                : "≥ 35%"}
                        </span>
                      </div>
                    );
                  })}
                  {isProd && (
                    <span className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono ml-auto">
                      <Spinner cls="w-3 h-3" /> Loading production…
                    </span>
                  )}
                  {!hasProd && !isProd && (
                    <span className="text-[11px] text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 font-mono ml-auto">
                      ⚠ Production data unavailable
                    </span>
                  )}
                  {hasProd && (
                    <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 font-mono ml-auto">
                      ✓ Per-model production matched
                    </span>
                  )}
                </div>

                {hasProd && (
                  <div className="bg-white rounded-xl border border-orange-200 overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-orange-100 bg-orange-50/30">
                      <BarChart2 className="w-3.5 h-3.5 text-orange-500" />
                      <span className="text-[11px] font-semibold text-orange-600 uppercase tracking-widest">
                        Defect Ratio by Model — Rework ÷ Per-Model Production
                      </span>
                      {selectedCategories.length > 0 && (
                        <span className="ml-auto text-[10px] font-mono text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                          {selectedCategories.join(", ")}
                        </span>
                      )}
                    </div>
                    <div className="p-4">
                      <DefectRatioBars
                        data={ratioData}
                        chartRef={defectChartRef}
                      />
                    </div>
                  </div>
                )}

                <div className="bg-white rounded-xl border border-orange-200 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-orange-100 bg-orange-50/30">
                    <div className="flex items-center gap-2">
                      <Target className="w-3.5 h-3.5 text-orange-500" />
                      <span className="text-[11px] font-semibold text-orange-600 uppercase tracking-widest">
                        Per-Model Defect Ratio Table
                      </span>
                    </div>
                    <button
                      onClick={async () => {
                        const data = await fetchDefectExport();
                        if (data.length) {
                          const ws = XLSX.utils.json_to_sheet(data);
                          const wb = XLSX.utils.book_new();
                          XLSX.utils.book_append_sheet(wb, ws, "Defect Ratio");
                          XLSX.writeFile(
                            wb,
                            `Rework_Defect_${new Date().toISOString().split("T")[0]}.xlsx`,
                          );
                          toast.success("Defect ratio exported!");
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-orange-200 bg-orange-50 text-orange-700 text-[11px] font-semibold hover:bg-orange-100 transition-all"
                    >
                      <FileSpreadsheet className="w-3 h-3" /> Export
                    </button>
                  </div>
                  <DefectRatioTable data={ratioData} />
                </div>
              </div>
            )}

            {/* ══════════════ DETAIL TAB ══════════════ */}
            {activeTab === "detail" && (
              <div className="flex flex-col min-h-0">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 shrink-0">
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                      {selectedModel
                        ? `Filtered: ${selectedModel}`
                        : selectedCategories.length > 0 ||
                            selectedDefects.length > 0
                          ? [
                              selectedCategories.length > 0 &&
                                `Categories: ${selectedCategories.join(", ")}`,
                              selectedDefects.length > 0 &&
                                `Defects: ${selectedDefects.join(", ")}`,
                            ]
                              .filter(Boolean)
                              .join(" · ")
                          : "All Records"}
                    </span>
                    <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono">
                      {defectFilteredData.length.toLocaleString()} rows
                    </span>
                    {selectedModel && (
                      <button
                        onClick={() => setSelectedModel(null)}
                        className="flex items-center gap-1 px-2 py-1 rounded-md border border-blue-200 bg-blue-50 text-blue-700 text-[10px] font-bold hover:bg-blue-100 transition-all"
                      >
                        Clear model <X className="w-2.5 h-2.5" />
                      </button>
                    )}
                    {selectedCategories.length > 0 && (
                      <button
                        onClick={() => setSelectedCategories([])}
                        className="flex items-center gap-1 px-2 py-1 rounded-md border border-violet-200 bg-violet-50 text-violet-700 text-[10px] font-bold hover:bg-violet-100 transition-all"
                      >
                        Clear categories <X className="w-2.5 h-2.5" />
                      </button>
                    )}
                    {selectedDefects.length > 0 && (
                      <button
                        onClick={() => setSelectedDefects([])}
                        className="flex items-center gap-1 px-2 py-1 rounded-md border border-amber-200 bg-amber-50 text-amber-700 text-[10px] font-bold hover:bg-amber-100 transition-all"
                      >
                        Clear defects <X className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {hasMore && (
                      <span className="text-[11px] text-slate-400 font-mono">
                        Scroll to load more ↓
                      </span>
                    )}
                    <button
                      onClick={async () => {
                        const data = await fetchDetailExport();
                        if (data.length) {
                          const ws = XLSX.utils.json_to_sheet(data);
                          const wb = XLSX.utils.book_new();
                          XLSX.utils.book_append_sheet(
                            wb,
                            ws,
                            "Detail Records",
                          );
                          XLSX.writeFile(
                            wb,
                            `Rework_Detail_${new Date().toISOString().split("T")[0]}.xlsx`,
                          );
                          toast.success("Detail records exported!");
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 text-[11px] font-semibold hover:border-emerald-300 hover:text-emerald-700 transition-all"
                    >
                      <FileSpreadsheet className="w-3 h-3" /> Export Detail
                    </button>
                  </div>
                </div>
                <div className="overflow-auto max-h-[520px]">
                  <table className="min-w-full text-xs text-left border-separate border-spacing-0">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-slate-100">
                        <th className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap w-10">
                          Sr.
                        </th>
                        {DETAIL_COLUMNS.map((k) => (
                          <th
                            key={k}
                            className="px-3 py-2.5 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap"
                          >
                            {k.replace(/_/g, " ")}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {defectFilteredData.map((row, i) => (
                        <tr
                          key={i}
                          ref={
                            i === defectFilteredData.length - 1
                              ? lastRowRef
                              : null
                          }
                          className="hover:bg-blue-50/60 transition-colors even:bg-slate-50/40"
                        >
                          <td className="px-3 py-2 border-b border-slate-100 text-slate-400 font-mono text-center">
                            {i + 1}
                          </td>
                          {DETAIL_COLUMNS.map((k) => (
                            <td
                              key={k}
                              className="px-3 py-2 border-b border-slate-100 whitespace-nowrap"
                            >
                              {k === "Rework_Status" ? (
                                <StatusBadge status={row[k]} />
                              ) : (
                                <span
                                  className={
                                    k === "Model_Name"
                                      ? "font-semibold text-slate-800"
                                      : "text-slate-600"
                                  }
                                >
                                  {row[k] ?? "—"}
                                </span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {isLoading && (
                    <div className="flex items-center justify-center py-4 gap-2 text-blue-600 text-xs border-t border-slate-100">
                      <Spinner /> Loading more records…
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReworkReport;
