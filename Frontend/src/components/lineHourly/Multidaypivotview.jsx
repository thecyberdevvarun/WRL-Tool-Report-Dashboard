/**
 * Multi-Day Production View
 *
 * Purpose: compare hourly production of ONE line + stage across several days.
 *   1. Pick line, stage and date range → Query
 *   2. See totals, average UPH and % of target at a glance
 *   3. Read the day × hour table (heat-coloured) and the daily UPH chart
 */

import { useState, useMemo, useCallback } from "react";
import axios from "axios";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import {
  FiSearch,
  FiDownload,
  FiRefreshCw,
  FiAlertTriangle,
} from "react-icons/fi";
import { baseURL } from "../../assets/assets.js";

// ---------------------------------------------------------------------------
//  Line → stage → station mapping
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

// Fixed UPH targets. Loading stages = FG Label target + 5.
const FIXED_TARGETS = {
  "Freezer Line": { "FG Label": 87 },
  "Chocolate Line": { "FG Label": 40 },
  "SUS Line": { "FG Label": 15 },
  "VISI Line": { "FG Label": 75 },
};
const LOADING_STAGES = [
  "MFT",
  "EST",
  "Gas Charging",
  "Comp Scan",
  "Comp Scan 1",
  "Post Foaming",
  "Foaming",
];

const getFixedTarget = (line, stage) => {
  const own = FIXED_TARGETS[line]?.[stage];
  if (own !== undefined) return own;
  const base = FIXED_TARGETS[line]?.["FG Label"];
  return base !== undefined && LOADING_STAGES.includes(stage) ? base + 5 : null;
};

// Production day runs 08:00 → next day 08:00
const ALL_HOURS = Array.from({ length: 24 }, (_, i) => (i + 8) % 24);
const MAX_DAYS = 31;

// ---------------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------------
const pad2 = (n) => String(n).padStart(2, "0");
const toISO = (d) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const fmtHour = (h) => `${pad2(h)}:00`;
const fmtN = (n) => (n ?? 0).toLocaleString();
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

const statusColor = (p) =>
  p >= 100 ? "text-emerald-600" : p >= 80 ? "text-amber-600" : "text-red-600";

// Light-to-dark indigo heat colour for a table cell
const heatStyle = (val, max) => {
  if (!val || !max) return {};
  const r = Math.min(val / max, 1);
  return {
    background: `rgba(79,70,229,${(0.06 + r * 0.55).toFixed(2)})`,
    color: r > 0.6 ? "#fff" : "#312e81",
  };
};

// ---------------------------------------------------------------------------
//  Small UI pieces
// ---------------------------------------------------------------------------
const Field = ({ label, children }) => (
  <div className="flex flex-col gap-1">
    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
      {label}
    </label>
    {children}
  </div>
);

const inputCls =
  "border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300";

const Stat = ({ label, value, sub, valueCls = "text-slate-800" }) => (
  <div className="flex-1 min-w-36 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
      {label}
    </div>
    <div className={`text-2xl font-bold font-mono mt-1 ${valueCls}`}>
      {value}
    </div>
    {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
  </div>
);

// ===========================================================================
//  Main component
// ===========================================================================
export default function MultiDayPivotView() {
  const [line, setLine] = useState("Freezer Line");
  const [stage, setStage] = useState("FG Label");
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return toISO(d);
  });
  const [to, setTo] = useState(() => toISO(new Date()));
  // Target UPH is editable. It is pre-filled with the standard target for the
  // selected line + stage, and the user can overwrite it at any time.
  const [targetInput, setTargetInput] = useState(() =>
    String(getFixedTarget("Freezer Line", "FG Label") ?? 50),
  );

  const [data, setData] = useState({}); // { "DD-MM-YYYY": { hour: count } }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [queried, setQueried] = useState(false);

  const stageOptions = Object.keys(LINE_STAGE_MAPPING[line] || {});
  const defaultTarget = getFixedTarget(line, stage) ?? 50;
  // Falls back to the standard target while the box is empty or invalid
  const target = Number(targetInput) > 0 ? Number(targetInput) : defaultTarget;
  const isCustomTarget = String(target) !== String(defaultTarget);

  // -- Fetch ------------------------------------------------------------------
  const handleQuery = useCallback(async () => {
    const mapping = LINE_STAGE_MAPPING[line]?.[stage];
    if (!mapping) return;
    if (!from || !to)
      return setError("Please select both start and end dates.");

    const start = new Date(from);
    const end = new Date(to);
    if (start > end) return setError("Start date must be before end date.");

    const days = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      days.push(toISO(d));
    }
    if (days.length > MAX_DAYS)
      return setError(`Please select a range of ${MAX_DAYS} days or fewer.`);

    setLoading(true);
    setError(null);
    setData({});

    try {
      const results = await Promise.allSettled(
        days.map(async (ds) => {
          const next = new Date(ds);
          next.setDate(next.getDate() + 1);
          const res = await axios.get(`${baseURL}prod/hourly-summary`, {
            params: {
              startDate: `${ds} 08:00`,
              endDate: `${toISO(next)} 08:00`,
              stationCode: mapping.stationCodes.join(","),
              linecode: mapping.linecodes.join(","),
            },
          });

          const hours = {};
          (res.data?.data || []).forEach((row) => {
            const h = row.TIMEHOUR ?? row.timehour ?? row.hour;
            const c = row.COUNT ?? row.count ?? row.Loading_Count ?? 0;
            if (h != null) hours[Number(h)] = (hours[Number(h)] || 0) + c;
          });
          return { ds, hours };
        }),
      );

      const merged = {};
      let failed = 0;
      results.forEach((r) => {
        if (r.status !== "fulfilled") {
          failed += 1;
          return;
        }
        const { ds, hours } = r.value;
        if (Object.keys(hours).length > 0) {
          const [y, m, d] = ds.split("-");
          merged[`${d}-${m}-${y}`] = hours;
        }
      });

      setData(merged);
      setQueried(true);
      if (failed > 0)
        setError(`${failed} day(s) could not be loaded. Showing the rest.`);
    } catch (e) {
      console.error(e);
      setError("Failed to fetch data. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }, [line, stage, from, to]);

  // -- Derived numbers ---------------------------------------------------------
  const stats = useMemo(() => {
    // oldest → newest (keys are DD-MM-YYYY)
    const dates = Object.keys(data).sort((a, b) => {
      const [da, ma, ya] = a.split("-");
      const [db, mb, yb] = b.split("-");
      return `${ya}${ma}${da}`.localeCompare(`${yb}${mb}${db}`);
    });
    if (!dates.length) return null;

    const used = new Set();
    dates.forEach((d) =>
      Object.keys(data[d]).forEach((h) => used.add(Number(h))),
    );
    const hours = ALL_HOURS.filter((h) => used.has(h));

    const rowTotal = {};
    const dayAvg = {}; // average units per hour that actually produced
    dates.forEach((d) => {
      const vals = hours.map((h) => data[d][h] || 0);
      rowTotal[d] = vals.reduce((s, v) => s + v, 0);
      dayAvg[d] = Math.round(
        rowTotal[d] / (vals.filter((v) => v > 0).length || 1),
      );
    });

    const colTotal = {};
    const colAvg = {};
    hours.forEach((h) => {
      colTotal[h] = dates.reduce((s, d) => s + (data[d][h] || 0), 0);
      const n = dates.filter((d) => (data[d][h] || 0) > 0).length || 1;
      colAvg[h] = Math.round(colTotal[h] / n);
    });

    const grandTotal = dates.reduce((s, d) => s + rowTotal[d], 0);
    const overallAvg = Math.round(
      dates.reduce((s, d) => s + dayAvg[d], 0) / dates.length,
    );
    const maxCell = Math.max(
      ...dates.flatMap((d) => hours.map((h) => data[d][h] || 0)),
      1,
    );
    const bestDay = dates.reduce(
      (b, d) => (rowTotal[d] > rowTotal[b] ? d : b),
      dates[0],
    );
    const peakHour = hours.reduce(
      (b, h) => (colTotal[h] > colTotal[b] ? h : b),
      hours[0],
    );

    return {
      dates,
      hours,
      rowTotal,
      dayAvg,
      colTotal,
      colAvg,
      grandTotal,
      overallAvg,
      maxCell,
      bestDay,
      peakHour,
    };
  }, [data]);

  // -- Export -------------------------------------------------------------------
  const exportCSV = () => {
    if (!stats) return;
    const { dates, hours, rowTotal, dayAvg } = stats;
    const rows = [
      [
        "Date",
        ...hours.map(fmtHour),
        "Total",
        "Avg UPH",
        "Target UPH",
        "% of Target",
      ],
      ...dates.map((d) => [
        d,
        ...hours.map((h) => data[d][h] || 0),
        rowTotal[d],
        dayAvg[d],
        target,
        `${pct(dayAvg[d], target)}%`,
      ]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `MultiDay_${line}_${stage}_${from}_to_${to}.csv`.replace(
      /\s+/g,
      "_",
    );
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const chartData = stats
    ? stats.dates.map((d) => ({ date: d.slice(0, 5), uph: stats.dayAvg[d] }))
    : [];

  // ===========================================================================
  //  Render
  // ===========================================================================
  return (
    <div className="flex flex-col gap-3">
      {/* ── Filters ───────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Production Line">
            <select
              value={line}
              onChange={(e) => {
                const l = e.target.value;
                const firstStage = Object.keys(LINE_STAGE_MAPPING[l])[0];
                setLine(l);
                setStage(firstStage);
                setTargetInput(String(getFixedTarget(l, firstStage) ?? 50));
              }}
              className={`${inputCls} w-44 cursor-pointer`}
            >
              {Object.keys(LINE_STAGE_MAPPING).map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </Field>

          <Field label="Stage">
            <select
              value={stage}
              onChange={(e) => {
                setStage(e.target.value);
                setTargetInput(
                  String(getFixedTarget(line, e.target.value) ?? 50),
                );
              }}
              className={`${inputCls} w-40 cursor-pointer`}
            >
              {stageOptions.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>

          <Field label="From">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className={inputCls}
            />
          </Field>

          <Field label="To">
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className={inputCls}
            />
          </Field>

          <Field label="Target UPH">
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={targetInput}
                onChange={(e) => setTargetInput(e.target.value)}
                title="Type your own target UPH"
                className={`${inputCls} w-24 font-mono font-bold ${
                  isCustomTarget
                    ? "border-indigo-400 bg-indigo-50 text-indigo-700"
                    : ""
                }`}
              />
              {isCustomTarget && (
                <button
                  type="button"
                  onClick={() => setTargetInput(String(defaultTarget))}
                  className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer whitespace-nowrap"
                >
                  Reset to {defaultTarget}
                </button>
              )}
            </div>
          </Field>

          <div className="flex items-center gap-2 ml-auto">
            {stats && (
              <button
                onClick={exportCSV}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-600 transition-all cursor-pointer"
              >
                <FiDownload className="w-4 h-4" /> Export
              </button>
            )}
            <button
              onClick={handleQuery}
              disabled={loading}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                loading
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                  : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm cursor-pointer"
              }`}
            >
              {loading ? (
                <FiRefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <FiSearch className="w-4 h-4" />
              )}
              {loading ? "Loading…" : "Query"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Messages ──────────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          <FiAlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {!stats && !loading && !error && (
        <div className="bg-white rounded-xl border border-slate-200 py-16 text-center">
          <div className="text-base font-bold text-slate-700">
            {queried ? "No production found" : "Ready to analyse"}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {queried
              ? "There is no output for this line, stage and date range."
              : "Choose a line, stage and date range, then click Query."}
          </div>
        </div>
      )}

      {/* ── Results ───────────────────────────────────────────────────────── */}
      {stats && (
        <>
          {/* Summary cards */}
          <div className="flex flex-wrap gap-3">
            <Stat
              label="Total Units"
              value={fmtN(stats.grandTotal)}
              sub={`${stats.dates.length} days · ${line} › ${stage}`}
            />
            <Stat
              label="Average UPH"
              value={stats.overallAvg}
              sub={`Target ${target} UPH`}
            />
            <Stat
              label="Target Achieved"
              value={`${pct(stats.overallAvg, target)}%`}
              valueCls={statusColor(pct(stats.overallAvg, target))}
              sub="Average UPH ÷ Target"
            />
            <Stat
              label="Best Day"
              value={stats.bestDay.slice(0, 5)}
              sub={`${fmtN(stats.rowTotal[stats.bestDay])} units`}
            />
            <Stat
              label="Peak Hour"
              value={fmtHour(stats.peakHour)}
              sub={`${fmtN(stats.colTotal[stats.peakHour])} units in total`}
            />
          </div>

          {/* Day × hour table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-slate-700">
                  Hourly Production by Day
                </div>
                <div className="text-[11px] text-slate-400">
                  Units produced in each hour · red = below {target} UPH
                </div>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                <span>Low</span>
                <div
                  className="w-14 h-2 rounded"
                  style={{
                    background: "linear-gradient(to right,#e0e7ff,#4338ca)",
                  }}
                />
                <span>High</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs border-separate border-spacing-0">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="sticky left-0 z-10 bg-slate-50 text-left px-4 py-2.5 font-semibold text-slate-500 border-b border-slate-200 min-w-28">
                      Date
                    </th>
                    {stats.hours.map((h) => (
                      <th
                        key={h}
                        className="px-2 py-2.5 text-center font-mono font-semibold text-slate-500 border-b border-slate-200 min-w-14"
                      >
                        {fmtHour(h)}
                      </th>
                    ))}
                    <th className="px-3 py-2.5 text-center font-semibold text-indigo-700 bg-indigo-50 border-b border-slate-200">
                      Total
                    </th>
                    <th className="px-3 py-2.5 text-center font-semibold text-slate-600 bg-slate-100 border-b border-slate-200">
                      Avg UPH
                    </th>
                    <th className="px-3 py-2.5 text-center font-semibold text-slate-600 bg-slate-100 border-b border-slate-200">
                      % of Target
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {stats.dates.map((d) => {
                    const p = pct(stats.dayAvg[d], target);
                    return (
                      <tr key={d} className="hover:bg-slate-50/70">
                        <td className="sticky left-0 z-10 bg-white px-4 py-2 font-mono font-semibold text-slate-700 border-b border-slate-100">
                          {d}
                        </td>
                        {stats.hours.map((h) => {
                          const v = data[d][h] || 0;
                          const below = v > 0 && v < target;
                          return (
                            <td
                              key={h}
                              className="px-1 py-1 text-center border-b border-slate-100"
                            >
                              {v > 0 ? (
                                <div
                                  className={`rounded-md py-1 font-mono font-semibold ${
                                    below ? "text-red-600 bg-red-50" : ""
                                  }`}
                                  style={
                                    below
                                      ? undefined
                                      : heatStyle(v, stats.maxCell)
                                  }
                                >
                                  {v}
                                </div>
                              ) : (
                                <span className="text-slate-300">–</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-3 py-2 text-center font-mono font-bold text-indigo-700 bg-indigo-50/60 border-b border-slate-100">
                          {fmtN(stats.rowTotal[d])}
                        </td>
                        <td className="px-3 py-2 text-center font-mono font-semibold text-slate-700 border-b border-slate-100">
                          {stats.dayAvg[d]}
                        </td>
                        <td
                          className={`px-3 py-2 text-center font-mono font-bold border-b border-slate-100 ${statusColor(p)}`}
                        >
                          {p}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                <tfoot>
                  <tr className="bg-indigo-50">
                    <td className="sticky left-0 z-10 bg-indigo-50 px-4 py-2.5 font-bold text-indigo-800 border-t-2 border-indigo-200">
                      Total
                    </td>
                    {stats.hours.map((h) => (
                      <td
                        key={h}
                        className="px-1 py-2.5 text-center font-mono font-bold text-indigo-800 border-t-2 border-indigo-200"
                      >
                        {fmtN(stats.colTotal[h])}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-center font-mono font-bold text-indigo-900 bg-indigo-100 border-t-2 border-indigo-200">
                      {fmtN(stats.grandTotal)}
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono font-bold text-indigo-900 border-t-2 border-indigo-200">
                      {stats.overallAvg}
                    </td>
                    <td
                      className={`px-3 py-2.5 text-center font-mono font-bold border-t-2 border-indigo-200 ${statusColor(pct(stats.overallAvg, target))}`}
                    >
                      {pct(stats.overallAvg, target)}%
                    </td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="sticky left-0 z-10 bg-slate-50 px-4 py-2 font-semibold text-slate-500 text-[11px]">
                      Average
                    </td>
                    {stats.hours.map((h) => (
                      <td
                        key={h}
                        className={`px-1 py-2 text-center font-mono font-semibold text-[11px] ${statusColor(pct(stats.colAvg[h], target))}`}
                      >
                        {stats.colAvg[h]}
                      </td>
                    ))}
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Daily UPH chart */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className="text-sm font-bold text-slate-700">
              Average UPH per Day
            </div>
            <div className="text-[11px] text-slate-400 mb-3">
              Green = target met · Red = below target · Dashed line = {target}{" "}
              UPH
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={chartData}
                margin={{ top: 8, right: 16, left: -10, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#f1f5f9"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "rgba(148,163,184,0.12)" }}
                  formatter={(v) => [v, "Avg UPH"]}
                />
                <ReferenceLine
                  y={target}
                  stroke="#f59e0b"
                  strokeDasharray="5 4"
                  label={{
                    value: `Target ${target}`,
                    position: "insideTopRight",
                    fontSize: 11,
                    fill: "#d97706",
                  }}
                />
                <Bar dataKey="uph" radius={[4, 4, 0, 0]} maxBarSize={48}>
                  {chartData.map((d, i) => (
                    <Cell
                      key={i}
                      fill={d.uph >= target ? "#10b981" : "#f87171"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
