import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import {
  ResponsiveContainer, ComposedChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from "recharts";
import { RefreshCw, X, Info } from "lucide-react";
import { baseURL } from "../../assets/assets";
import ExportButton from "../../components/ui/ExportButton";

// Audit MIS — model-wise audit coverage vs production, audit & checkpoint
// failures, audit time and trends. Numbers come from GET /audit-report/mis.

const TABS = ["Model Summary", "Failure Analysis", "Checkpoints", "Model × Checkpoint", "Audit Time", "Trends", "Coverage Gaps"];
const iso = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
const fmt = (v, dg = 0) => (v == null ? "—" : Number(v).toLocaleString("en-IN", { maximumFractionDigits: dg, minimumFractionDigits: dg }));
const n0 = (v) => fmt(v);
const n1 = (v) => fmt(v, 1);
const p1 = (v) => (v == null ? "—" : `${fmt(v, 1)}%`);
const mins = (v) => (v == null ? "—" : `${fmt(v, 1)} min`);
const goodTone = (v) => (v == null ? "text-gray-400" : v >= 90 ? "text-emerald-600" : v >= 60 ? "text-amber-600" : "text-red-600");
const badTone = (v) => (v == null ? "text-gray-400" : v >= 25 ? "text-red-600" : v > 0 ? "text-amber-600" : "text-emerald-600");
const heat = (v) => (v == null ? "" : v >= 50 ? "bg-red-500 text-white" : v >= 25 ? "bg-red-300" : v >= 10 ? "bg-amber-200" : v > 0 ? "bg-amber-50" : "");

const Card = ({ label, value, sub, tone = "text-gray-900", onClick }) => (
  <button type="button" onClick={onClick} disabled={!onClick}
    className="text-left bg-white rounded-xl border border-gray-200 p-3 shadow-sm enabled:hover:border-indigo-300 enabled:hover:shadow disabled:cursor-default">
    <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</div>
    <div className={`text-2xl font-bold mt-1 ${tone}`}>{value}</div>
    {sub && <div className="text-[11px] text-gray-500 mt-0.5">{sub}</div>}
  </button>
);

const Panel = ({ title, note, right, children }) => (
  <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
    <div className="flex items-center justify-between gap-2 mb-2">
      <h3 className="text-sm font-bold text-gray-800">{title}</h3>
      {right}
    </div>
    {note && <p className="text-[11px] text-gray-500 mb-3">{note}</p>}
    {children}
  </section>
);

// Sortable table. cols: [{ key, label, fmt?, tone?, render?, left? }]
const Table = ({ rows, cols, onRowClick, initialSort, max = 500 }) => {
  const [sort, setSort] = useState(initialSort || null);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    return [...rows].sort((a, b) => {
      const x = a[sort.key], y = b[sort.key];
      if (x == null) return 1;
      if (y == null) return -1;
      return (typeof x === "number" ? x - y : String(x).localeCompare(String(y))) * sort.dir;
    });
  }, [rows, sort]);
  return (
    <div className="overflow-auto max-h-[540px] border border-gray-100 rounded-lg">
      <table className="w-full text-xs">
        <thead className="bg-gray-50 sticky top-0 z-10">
          <tr>
            {cols.map((c) => (
              <th key={c.key} scope="col"
                onClick={() => setSort((s) => ({ key: c.key, dir: s?.key === c.key ? -s.dir : -1 }))}
                className={`px-2 py-2 font-semibold text-gray-600 whitespace-nowrap cursor-pointer select-none ${c.left ? "text-left" : "text-right"}`}>
                {c.label}{sort?.key === c.key ? (sort.dir > 0 ? " ▲" : " ▼") : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.slice(0, max).map((r, i) => (
            <tr key={i} onClick={onRowClick ? () => onRowClick(r) : undefined}
              className={`border-t border-gray-100 ${onRowClick ? "cursor-pointer hover:bg-indigo-50" : ""}`}>
              {cols.map((c) => (
                <td key={c.key} className={`px-2 py-1.5 whitespace-nowrap ${c.left ? "text-left" : "text-right"} ${c.tone ? c.tone(r[c.key], r) : ""}`}>
                  {c.render ? c.render(r[c.key], r) : c.fmt ? c.fmt(r[c.key]) : r[c.key] ?? "—"}
                </td>
              ))}
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={cols.length} className="px-2 py-6 text-center text-gray-400">No data for this selection</td></tr>}
        </tbody>
      </table>
      {rows.length > max && <div className="text-[11px] text-gray-500 p-2">Showing {max} of {rows.length} rows — export for all.</div>}
    </div>
  );
};

const pctCol = (key, label, tone = goodTone) => ({ key, label, fmt: p1, tone: (v) => `font-semibold ${tone(v)}` });

export default function AuditMIS() {
  const [range, setRange] = useState({ startDate: daysAgo(30), endDate: iso(new Date()) });
  const [model, setModel] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("Model Summary");
  const [onlyAudited, setOnlyAudited] = useState(false);
  const [trendBy, setTrendBy] = useState("daily");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${baseURL}audit-report/mis`, { params: { ...range, model } });
      setData(res.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load Audit MIS");
    } finally {
      setLoading(false);
    }
  }, [range, model]);
  useEffect(() => { load(); }, [load]);

  const k = data?.kpis;
  const drill = (m) => { setModel(m); setTab("Model Summary"); };
  const modelRows = useMemo(() => (data?.models || []).filter((m) => !onlyAudited || m.completed > 0 || m.inProgress > 0), [data, onlyAudited]);

  // Model × checkpoint matrix: top failing checkpoints as columns.
  const matrix = useMemo(() => {
    if (!data) return { cols: [], rows: [] };
    const cols = data.checkpoints.filter((c) => c.failures > 0).slice(0, 12);
    const byModel = new Map();
    for (const r of data.modelCheckpoints) {
      if (!byModel.has(r.model)) byModel.set(r.model, {});
      byModel.get(r.model)[`${r.section}|${r.stage}|${r.checkpoint}`] = r;
    }
    const rows = [...byModel].map(([m, cells]) => ({ model: m, cells, total: Object.values(cells).reduce((s, c) => s + c.failures, 0) }))
      .sort((a, b) => b.total - a.total);
    return { cols, rows };
  }, [data]);

  const trendRows = (data?.trends?.[trendBy] || []).map((t) => ({ ...t, label: trendBy === "monthly" ? t.period : t.period.slice(5) }));

  return (
    <div className="p-4 space-y-4 bg-gray-50 min-h-screen">
      {/* Header & filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h1 className="text-lg font-bold text-gray-900">Audit MIS</h1>
          <p className="text-xs text-gray-500">Model-wise audit coverage vs production · failures · checkpoints · audit time</p>
        </div>
        <label className="text-xs text-gray-600">From
          <input type="date" value={range.startDate} max={range.endDate}
            onChange={(e) => setRange((r) => ({ ...r, startDate: e.target.value }))}
            className="block mt-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
        </label>
        <label className="text-xs text-gray-600">To
          <input type="date" value={range.endDate} min={range.startDate}
            onChange={(e) => setRange((r) => ({ ...r, endDate: e.target.value }))}
            className="block mt-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
        </label>
        <div className="flex gap-1">
          {[[0, "Today"], [7, "7D"], [30, "30D"], [90, "90D"], [180, "180D"]].map(([d, l]) => (
            <button key={l} type="button" onClick={() => setRange({ startDate: daysAgo(d), endDate: iso(new Date()) })}
              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-gray-300 hover:bg-gray-100">{l}</button>
          ))}
        </div>
        <label className="text-xs text-gray-600">Model
          <select value={model} onChange={(e) => setModel(e.target.value)}
            className="block mt-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm max-w-[240px]">
            <option value="">All models</option>
            {(data?.modelOptions || []).map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <button type="button" onClick={load} disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {model && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-500">Showing model:</span>
          <button type="button" onClick={() => setModel("")} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-indigo-100 text-indigo-800 font-semibold">
            {model} <X size={12} />
          </button>
        </div>
      )}

      {loading && !data && <div className="p-10 text-center text-gray-500">Loading audit and production data…</div>}

      {data && (
        <>
          {!k.production && !k.completed && (
            <div className="p-4 rounded-xl bg-amber-50 text-amber-800 text-sm flex items-center gap-2">
              <Info size={16} /> No production or audits in this period. Pick another date range.
            </div>
          )}

          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
            <Card label="Production" value={n0(k.production)} sub={`${n0(k.modelsProduced)} models · ${n0(k.modelsAudited)} audited`} onClick={() => setTab("Model Summary")} />
            <Card label="Audits completed" value={n0(k.completed)} sub={`${n0(k.inProgress)} in draft · ${n0(k.awaitingApproval)} awaiting approval`} onClick={() => setTab("Trends")} />
            <Card label="Completion" value={p1(k.completionPct)} tone={goodTone(k.completionPct)} sub={`${n0(k.covered)} of ${n0(k.required)} model-days`} onClick={() => setTab("Coverage Gaps")} />
            <Card label="Pending audits" value={n0(k.pending)} tone={k.pending ? "text-red-600" : "text-emerald-600"} sub={`${n0(k.unauditedUnits)} units unaudited (${p1(k.unauditedPct)})`} onClick={() => setTab("Coverage Gaps")} />
            <Card label="Pass %" value={p1(k.passPct)} tone={goodTone(k.passPct)} sub={`${n0(k.passed)} passed`} onClick={() => setTab("Failure Analysis")} />
            <Card label="Failed audits" value={n0(k.failed)} tone={k.failed ? "text-red-600" : "text-emerald-600"} sub={`${p1(k.failurePct)} of completed`} onClick={() => setTab("Failure Analysis")} />
            <Card label="Checkpoint failures" value={n0(k.failedCheckpoints)} sub={`${p1(k.checkpointFailPct)} of ${n0(k.checkpoints)} checks`} onClick={() => setTab("Checkpoints")} />
            <Card label="Avg audit time" value={mins(k.avgMinutes)} sub={`min ${mins(k.minMinutes)} · max ${mins(k.maxMinutes)}`} onClick={() => setTab("Audit Time")} />
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap gap-1 border-b border-gray-200" role="tablist">
            {TABS.map((t) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                className={`px-3 py-2 text-sm font-semibold rounded-t-lg ${tab === t ? "bg-white border border-b-white border-gray-200 text-indigo-700 -mb-px" : "text-gray-500 hover:text-gray-800"}`}>
                {t}
              </button>
            ))}
          </div>

          {/* 1 + 8: model-wise summary */}
          {tab === "Model Summary" && (
            <Panel
              title="Model-wise audit summary"
              note={`Required = ${data.rules.required}. Completed = ${data.rules.completed}. Click a model to focus on it.`}
              right={
                <div className="flex items-center gap-3">
                  <label className="text-xs text-gray-600 flex items-center gap-1.5">
                    <input type="checkbox" checked={onlyAudited} onChange={(e) => setOnlyAudited(e.target.checked)} /> Only models with audits
                  </label>
                  <ExportButton data={modelRows} filename="AuditMIS_ModelSummary" label="Excel" />
                </div>
              }
            >
              <Table rows={modelRows} onRowClick={(r) => drill(r.model)} cols={[
                { key: "model", label: "Model", left: true },
                { key: "production", label: "Qty produced", fmt: n0 },
                { key: "productionDays", label: "Prod. days", fmt: n0 },
                { key: "required", label: "Audits required", fmt: n0 },
                { key: "completed", label: "Audits completed", fmt: n0 },
                { key: "pending", label: "Pending", fmt: n0, tone: (v) => (v > 0 ? "text-red-600 font-semibold" : "") },
                pctCol("completionPct", "Completion %"),
                { key: "passed", label: "Passed", fmt: n0 },
                { key: "failed", label: "Failed", fmt: n0, tone: (v) => (v > 0 ? "text-red-600 font-semibold" : "") },
                pctCol("passPct", "Pass %"),
                { key: "avgMinutes", label: "Avg time", fmt: mins },
                { key: "lastAudit", label: "Last audit", left: true },
              ]} />
            </Panel>
          )}

          {/* 2 + 7: failure analysis */}
          {tab === "Failure Analysis" && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <Panel title="Top failure models — need immediate attention" note={`Failed = ${data.rules.failed}. Ranked by number of failed audits.`}
                right={<ExportButton data={data.topFailureModels} filename="AuditMIS_TopFailureModels" label="Excel" />}>
                <Table rows={data.topFailureModels} onRowClick={(r) => drill(r.model)} cols={[
                  { key: "rank", label: "#", fmt: n0 },
                  { key: "model", label: "Model", left: true },
                  { key: "completed", label: "Audits", fmt: n0 },
                  { key: "failed", label: "Failed", fmt: n0, tone: () => "text-red-600 font-semibold" },
                  pctCol("failurePct", "Failure %", badTone),
                  { key: "rejected", label: "Rejected", fmt: n0 },
                  { key: "rework", label: "Rework", fmt: n0 },
                  { key: "failedCheckpoints", label: "Failed checks", fmt: n0 },
                  { key: "topFailingCheckpoint", label: "Most failed checkpoint", left: true },
                ]} />
              </Panel>
              <Panel title="Failed vs passed audits by model">
                <ResponsiveContainer width="100%" height={Math.max(220, data.topFailureModels.length * 34 + 60)}>
                  <BarChart data={data.models.filter((m) => m.completed > 0).slice(0, 20)} layout="vertical" margin={{ left: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                    <XAxis type="number" fontSize={10} allowDecimals={false} />
                    <YAxis type="category" dataKey="model" fontSize={10} width={170} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="passed" stackId="a" name="Passed" fill="#10b981" />
                    <Bar dataKey="failed" stackId="a" name="Failed" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </Panel>
              <div className="xl:col-span-2">
                <Panel title="Audit list" note="Every audit in the period with its result and failed checkpoints."
                  right={<ExportButton data={data.audits} filename="AuditMIS_Audits" label="Excel" />}>
                  <Table rows={data.audits} initialSort={{ key: "day", dir: -1 }} cols={[
                    { key: "code", label: "Audit", left: true },
                    { key: "day", label: "Day", left: true },
                    { key: "model", label: "Model", left: true },
                    { key: "status", label: "Status", left: true },
                    { key: "failed", label: "Result", left: true, render: (v, r) => (!r.completed ? <span className="text-gray-400">not submitted</span> : v ? <span className="text-red-600 font-semibold">Failed</span> : <span className="text-emerald-600 font-semibold">Passed</span>) },
                    { key: "checkpoints", label: "Checks", fmt: n0 },
                    { key: "failedCheckpoints", label: "Not pass", fmt: n0 },
                    { key: "minutes", label: "Time", fmt: mins },
                    { key: "auditor", label: "Auditor", left: true },
                    { key: "failedCheckpointNames", label: "Failed checkpoints", left: true, render: (v) => <span className="block max-w-[360px] truncate" title={v}>{v || "—"}</span> },
                  ]} />
                </Panel>
              </div>
            </div>
          )}

          {/* 3: checkpoint-wise */}
          {tab === "Checkpoints" && (
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
              <div className="xl:col-span-2">
                <Panel title="Most frequently failing checkpoints" note="Failures across all models (anything other than Pass).">
                  <ResponsiveContainer width="100%" height={380}>
                    <ComposedChart data={data.checkpoints.filter((c) => c.failures > 0).slice(0, 15)} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                      <XAxis type="number" fontSize={10} allowDecimals={false} />
                      <YAxis type="category" dataKey="checkpoint" fontSize={10} width={170} />
                      <Tooltip />
                      <Bar dataKey="failures" name="Failures" fill="#ef4444" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </Panel>
              </div>
              <div className="xl:col-span-3">
                <Panel title="Checkpoint-wise failure analysis" right={<ExportButton data={data.checkpoints} filename="AuditMIS_Checkpoints" label="Excel" />}>
                  <Table rows={data.checkpoints} cols={[
                    { key: "checkpoint", label: "Checkpoint", left: true },
                    { key: "section", label: "Section", left: true },
                    { key: "stage", label: "Stage", left: true },
                    { key: "evaluated", label: "Checked", fmt: n0 },
                    { key: "failures", label: "Failures", fmt: n0, tone: (v) => (v > 0 ? "text-red-600 font-semibold" : "") },
                    pctCol("failurePct", "Failure %", badTone),
                    { key: "shareOfFailures", label: "Share of all", fmt: p1 },
                    { key: "fail", label: "Fail", fmt: n0 },
                    { key: "warning", label: "Warning", fmt: n0 },
                    { key: "na", label: "NA", fmt: n0 },
                    { key: "pending", label: "Blank", fmt: n0 },
                    { key: "modelsAffected", label: "Models", fmt: n0 },
                  ]} />
                </Panel>
              </div>
            </div>
          )}

          {/* 4: model × checkpoint */}
          {tab === "Model × Checkpoint" && (
            <div className="space-y-4">
              <Panel title="Failure heat-map — models × most failing checkpoints" note="Cell = failure % of that checkpoint for that model (failures / times checked). Click a model to focus on it.">
                {matrix.rows.length ? (
                  <div className="overflow-auto border border-gray-100 rounded-lg">
                    <table className="text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-2 py-2 text-left font-semibold text-gray-600 sticky left-0 bg-gray-50">Model</th>
                          {matrix.cols.map((c) => (
                            <th key={`${c.section}|${c.stage}|${c.checkpoint}`} scope="col" title={`${c.section} › ${c.stage}`}
                              className="px-2 py-2 font-semibold text-gray-600 max-w-[110px] align-bottom">
                              <span className="block truncate max-w-[110px]">{c.checkpoint}</span>
                            </th>
                          ))}
                          <th scope="col" className="px-2 py-2 font-semibold text-gray-600">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {matrix.rows.map((r) => (
                          <tr key={r.model} className="border-t border-gray-100">
                            <th scope="row" onClick={() => drill(r.model)}
                              className="px-2 py-1.5 text-left font-semibold text-indigo-700 cursor-pointer whitespace-nowrap sticky left-0 bg-white">{r.model}</th>
                            {matrix.cols.map((c) => {
                              const cell = r.cells[`${c.section}|${c.stage}|${c.checkpoint}`];
                              return (
                                <td key={c.checkpoint + c.stage} className={`px-2 py-1.5 text-center ${heat(cell?.failurePct)}`}
                                  title={cell ? `${cell.failures} of ${cell.evaluated} failed` : "no failures"}>
                                  {cell ? `${cell.failures} (${fmt(cell.failurePct, 0)}%)` : ""}
                                </td>
                              );
                            })}
                            <td className="px-2 py-1.5 text-right font-bold">{r.total}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="text-xs text-gray-400">No checkpoint failures in this period.</p>}
              </Panel>
              <Panel title="Model × checkpoint failures (full list)" right={<ExportButton data={data.modelCheckpoints} filename="AuditMIS_ModelCheckpoint" label="Excel" />}>
                <Table rows={data.modelCheckpoints} onRowClick={(r) => drill(r.model)} cols={[
                  { key: "model", label: "Model", left: true },
                  { key: "checkpoint", label: "Checkpoint", left: true },
                  { key: "section", label: "Section", left: true },
                  { key: "stage", label: "Stage", left: true },
                  { key: "evaluated", label: "Checked", fmt: n0 },
                  { key: "failures", label: "Failures", fmt: n0, tone: () => "text-red-600 font-semibold" },
                  pctCol("failurePct", "Failure %", badTone),
                ]} />
              </Panel>
            </div>
          )}

          {/* 5: audit time */}
          {tab === "Audit Time" && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <Panel title="Time to complete an audit, by model" note={`${data.rules.time}. Audits without a start time, or over 24 h, are left out.`}
                right={<ExportButton data={data.models.filter((m) => m.timedAudits).map(({ model, timedAudits, avgMinutes, minMinutes, maxMinutes }) => ({ model, timedAudits, avgMinutes, minMinutes, maxMinutes }))} filename="AuditMIS_AuditTime" label="Excel" />}>
                <Table rows={data.models.filter((m) => m.timedAudits)} onRowClick={(r) => drill(r.model)} cols={[
                  { key: "model", label: "Model", left: true },
                  { key: "timedAudits", label: "Audits timed", fmt: n0 },
                  { key: "avgMinutes", label: "Average", fmt: mins },
                  { key: "minMinutes", label: "Minimum", fmt: mins },
                  { key: "maxMinutes", label: "Maximum", fmt: mins },
                ]} />
                <p className="text-[11px] text-gray-500 mt-2">Plant: average {mins(k.avgMinutes)} · min {mins(k.minMinutes)} · max {mins(k.maxMinutes)} · approval takes {k.avgApprovalHours == null ? "—" : `${n1(k.avgApprovalHours)} h`} on average after submission.</p>
              </Panel>
              <Panel title="Average / min / max audit time">
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={data.models.filter((m) => m.timedAudits)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                    <XAxis dataKey="model" fontSize={9} interval={0} angle={-25} textAnchor="end" height={70} />
                    <YAxis fontSize={10} unit=" m" />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="minMinutes" name="Min" fill="#a7f3d0" />
                    <Bar dataKey="avgMinutes" name="Average" fill="#6366f1" />
                    <Bar dataKey="maxMinutes" name="Max" fill="#fca5a5" />
                  </BarChart>
                </ResponsiveContainer>
              </Panel>
            </div>
          )}

          {/* 6: trends */}
          {tab === "Trends" && (
            <div className="space-y-4">
              <div className="flex gap-1">
                {["daily", "weekly", "monthly"].map((t) => (
                  <button key={t} type="button" onClick={() => setTrendBy(t)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border capitalize ${trendBy === t ? "bg-indigo-600 text-white border-indigo-600" : "border-gray-300 hover:bg-gray-100"}`}>{t}</button>
                ))}
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <Panel title="Audits completed vs required" note={trendBy === "weekly" ? "Weeks start on Monday." : undefined}>
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={trendRows}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                      <XAxis dataKey="label" fontSize={10} />
                      <YAxis yAxisId="n" fontSize={10} allowDecimals={false} />
                      <YAxis yAxisId="p" orientation="right" domain={[0, 100]} unit="%" fontSize={10} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar yAxisId="n" dataKey="required" name="Required (model-days)" fill="#e2e8f0" />
                      <Bar yAxisId="n" dataKey="completed" name="Completed" fill="#6366f1" />
                      <Line yAxisId="p" dataKey="completionPct" name="Completion %" stroke="#059669" strokeWidth={2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </Panel>
                <Panel title="Pass / fail trend">
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={trendRows}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                      <XAxis dataKey="label" fontSize={10} />
                      <YAxis yAxisId="n" fontSize={10} allowDecimals={false} />
                      <YAxis yAxisId="p" orientation="right" domain={[0, 100]} unit="%" fontSize={10} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar yAxisId="n" dataKey="passed" stackId="a" name="Passed" fill="#10b981" />
                      <Bar yAxisId="n" dataKey="failed" stackId="a" name="Failed" fill="#ef4444" />
                      <Line yAxisId="p" dataKey="passPct" name="Pass %" stroke="#111827" strokeWidth={2} connectNulls />
                      <ReferenceLine yAxisId="p" y={90} stroke="#d97706" strokeDasharray="4 4" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </Panel>
              </div>
              <Panel title={`${trendBy[0].toUpperCase()}${trendBy.slice(1)} audit performance`} right={<ExportButton data={data.trends[trendBy]} filename={`AuditMIS_${trendBy}`} label="Excel" />}>
                <Table rows={data.trends[trendBy]} initialSort={{ key: "period", dir: -1 }} cols={[
                  { key: "period", label: trendBy === "weekly" ? "Week of" : trendBy === "monthly" ? "Month" : "Date", left: true },
                  { key: "required", label: "Required", fmt: n0 },
                  { key: "completed", label: "Completed", fmt: n0 },
                  { key: "pending", label: "Pending", fmt: n0 },
                  pctCol("completionPct", "Completion %"),
                  { key: "passed", label: "Passed", fmt: n0 },
                  { key: "failed", label: "Failed", fmt: n0 },
                  pctCol("passPct", "Pass %"),
                  pctCol("checkpointFailPct", "Checkpoint fail %", badTone),
                  { key: "avgMinutes", label: "Avg time", fmt: mins },
                ]} />
              </Panel>
            </div>
          )}

          {/* 8: efficiency / coverage gaps */}
          {tab === "Coverage Gaps" && (
            <Panel title="Audit efficiency — production vs audits, biggest gaps first"
              note="Models with pending audits, ranked by quantity produced on days without an audit."
              right={<ExportButton data={data.coverageGaps} filename="AuditMIS_CoverageGaps" label="Excel" />}>
              <Table rows={data.coverageGaps} onRowClick={(r) => drill(r.model)} cols={[
                { key: "model", label: "Model", left: true },
                { key: "production", label: "Qty produced", fmt: n0 },
                { key: "required", label: "Required", fmt: n0 },
                { key: "completed", label: "Completed", fmt: n0 },
                { key: "pending", label: "Pending", fmt: n0, tone: () => "text-red-600 font-semibold" },
                pctCol("completionPct", "Completion %"),
                { key: "unauditedUnits", label: "Unaudited qty", fmt: n0, tone: () => "font-semibold" },
                { key: "lastAudit", label: "Last audit", left: true },
              ]} />
            </Panel>
          )}

          <p className="text-[11px] text-gray-400">Rules: {Object.values(data.rules).join(" · ")}.</p>
        </>
      )}
    </div>
  );
}
