/**
 * HourlyWidget.jsx — Hourly Production + Manpower Intelligence Panel
 *
 * Props:
 *   title            — widget heading
 *   data             — hourly rows  { HOUR_NUMBER, TIMEHOUR, COUNT }
 *   modelData        — model-level rows for overlay panels
 *   datasets         — [{ key, label, color }]
 *   isCategoryChart  — renders CategoryWidget instead
 *   icon             — optional icon component
 *   manpowerWorkers  — filtered worker rows for this station
 *   manpowerLoading  — true while manpower is fetching
 */

import { useState, useMemo } from "react";
import { Bar, Line } from "react-chartjs-2";
import {
  FiDownload, FiX, FiSearch, FiUsers, FiBarChart2, FiTrendingUp,
  FiArrowUp, FiArrowDown, FiSun, FiMoon, FiZap, FiActivity,
  FiClock, FiAlertTriangle, FiCheckCircle, FiLogOut,
} from "react-icons/fi";
import {
  MdSchedule, MdLeaderboard, MdPeople, MdBusiness,
  MdAccessTime, MdCheckCircle, MdExitToApp, MdClose,
  MdBarChart, MdShowChart, MdFunctions, MdDownload,
  MdBolt, MdWbSunny, MdNightlight, MdTrendingUp,
} from "react-icons/md";
import { HiOutlineLightningBolt } from "react-icons/hi";
import {
  Chart as ChartJS, BarElement, CategoryScale, LinearScale,
  Tooltip, Legend, LineElement, PointElement,
} from "chart.js";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend, LineElement, PointElement);

// ─── Constants ────────────────────────────────────────────────────────────────
const DAY_COLOR   = "rgba(14,165,233,0.75)";
const NIGHT_COLOR = "rgba(139,92,246,0.65)";
const AVG_COLOR   = "rgba(234,88,12,0.85)";
const UPW_COLOR   = "rgba(16,185,129,0.75)";

const MODEL_COLORS = [
  "#0ea5e9","#f97316","#14b8a6","#8b5cf6",
  "#f59e0b","#ec4899","#22c55e","#ef4444",
  "#6366f1","#84cc16",
];

// Day shift: check-in 07:00–18:59 → day; Night shift: 19:00–06:59 → night
const DAY_START  = 7;
const DAY_END    = 19;
const isDay = (h) => h >= DAY_START && h < DAY_END;
const classifyWorkerShift = (checkIn) => {
  if (!checkIn) return "unknown";
  const hr = new Date(checkIn).getHours();
  return hr >= DAY_START && hr < DAY_END ? "day" : "night";
};

const fmtDisplay = (v) => (v ? String(v).replace("T", " ").replace("Z", "").slice(0, 16) : "—");
const fmtN = (n) => (n ?? 0).toLocaleString();
const heatBg = (frac) => {
  if (frac >= 0.85) return "rgba(14,165,233,0.08)";
  if (frac >= 0.65) return "rgba(20,184,166,0.06)";
  if (frac >= 0.4)  return "rgba(250,204,21,0.05)";
  return "";
};

// ─── Chart option factories ───────────────────────────────────────────────────
const makeOptions = (maxVal, showLegend, fs = 9) => ({
  responsive: true, maintainAspectRatio: false, animation: { duration: 220 },
  plugins: {
    legend: { display: showLegend, position: "top", labels: { font: { size: fs, weight: "bold", family: "inherit" }, boxWidth: 7, padding: 6, color: "#64748b" } },
    tooltip: { backgroundColor: "#0f172a", titleColor: "#94a3b8", bodyColor: "#f1f5f9", padding: 8,
      callbacks: { label: (ctx) => `  ${ctx.dataset.label}: ${ctx.parsed.y?.toLocaleString() ?? ""}` } },
  },
  scales: {
    y: { beginAtZero: true, max: maxVal + Math.max(Math.ceil(maxVal * 0.18), 5), border: { display: false },
      grid: { color: "rgba(0,0,0,0.04)" },
      ticks: { font: { size: fs, weight: "bold", family: "monospace" }, color: "#94a3b8", callback: (v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v, maxTicksLimit: 5 } },
    x: { border: { display: false }, grid: { display: false }, ticks: { font: { size: fs, weight: "bold" }, color: "#94a3b8", maxRotation: 0 } },
  },
});

const makeStackedOptions = (maxVal) => ({
  responsive: true, maintainAspectRatio: false, animation: { duration: 220 },
  plugins: { legend: { display: false }, tooltip: { backgroundColor: "#0f172a", titleColor: "#94a3b8", bodyColor: "#f1f5f9", padding: 8 } },
  scales: {
    y: { beginAtZero: true, stacked: true, border: { display: false }, grid: { color: "rgba(0,0,0,0.04)" },
      ticks: { font: { size: 9, family: "monospace" }, color: "#94a3b8", callback: (v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v, maxTicksLimit: 4 } },
    x: { stacked: true, border: { display: false }, grid: { display: false }, ticks: { font: { size: 9 }, color: "#94a3b8", maxRotation: 0 } },
  },
});

const makeHorizOptions = (maxVal) => ({
  indexAxis: "y", responsive: true, maintainAspectRatio: false, animation: { duration: 220 },
  plugins: { legend: { display: false }, tooltip: { backgroundColor: "#0f172a", titleColor: "#94a3b8", bodyColor: "#f1f5f9", padding: 8 } },
  scales: {
    x: { beginAtZero: true, max: maxVal + Math.max(Math.ceil(maxVal * 0.18), 5), border: { display: false },
      grid: { color: "rgba(0,0,0,0.04)" }, ticks: { font: { size: 9, family: "monospace" }, color: "#94a3b8", maxTicksLimit: 5 } },
    y: { border: { display: false }, grid: { display: false }, ticks: { font: { size: 9 }, color: "#475569" } },
  },
});

// ─── Combined Report Panel ────────────────────────────────────────────────────
const CombinedReportPanel = ({ title, data, datasets, manpowerWorkers, onClose }) => {
  const total = datasets.reduce((s, ds) => s + data.reduce((r, row) => r + (row[ds.key] || 0), 0), 0);

  const { dayWorkers, nightWorkers } = useMemo(() => {
    const day   = manpowerWorkers.filter(w => classifyWorkerShift(w.CheckIn) === "day");
    const night = manpowerWorkers.filter(w => classifyWorkerShift(w.CheckIn) === "night");
    return { dayWorkers: day.length, nightWorkers: night.length };
  }, [manpowerWorkers]);

  const totalWorkers = manpowerWorkers.length;
  const upw = dayWorkers > 0 ? Math.round(total / dayWorkers) : null;

  // Hourly UPW: production per hour / day workers
  const hourlyUPW = useMemo(() => {
    if (dayWorkers === 0) return [];
    return data.map(row => {
      const prod = datasets.reduce((s, ds) => s + (row[ds.key] || 0), 0);
      return { hour: `${row.TIMEHOUR}:00`, prod, upw: Math.round(prod / dayWorkers) };
    });
  }, [data, datasets, dayWorkers]);

  const maxProd = Math.max(...hourlyUPW.map(r => r.prod), 1);

  const exportCSV = () => {
    const rows = [
      ["=== PRODUCTION SUMMARY ==="],
      ["Metric", "Value"],
      ["Total Units", total],
      ["Day Workers", dayWorkers],
      ["Night Workers", nightWorkers],
      ["UPW (Units/Day Worker)", upw ?? "N/A"],
      [],
      ["=== HOURLY BREAKDOWN ==="],
      ["Hour", "Production", "UPW"],
      ...hourlyUPW.map(r => [r.hour, r.prod, r.upw]),
      [],
      ["=== MANPOWER ROSTER ==="],
      ["Name", "Contractor", "Department", "Shift", "Check-in", "Status"],
      ...manpowerWorkers.map(w => {
        const shift = classifyWorkerShift(w.CheckIn);
        const isInside = !w.CheckOut;
        return [
          w.WorkmenName || w["Workmen Name"] || "—",
          w.Contractor || "—",
          w.Department || "—",
          shift,
          fmtDisplay(w.CheckIn),
          isInside ? "Inside" : "Checked Out",
        ];
      }),
    ];
    const csv = rows.map(r => Array.isArray(r) ? r.join(",") : r).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `${title.replace(/\s+/g, "_")}_combined_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const kpis = [
    { label: "Total Units",   value: fmtN(total),      icon: FiBarChart2,  color: "#4f46e5", bg: "#eef2ff", border: "#c7d2fe" },
    { label: "Day Workers",   value: dayWorkers || "—", icon: FiSun,        color: "#0891b2", bg: "#e0f2fe", border: "#bae6fd" },
    { label: "Night Workers", value: nightWorkers || "—", icon: FiMoon,     color: "#7c3aed", bg: "#f5f3ff", border: "#e0e7ff" },
    { label: "UPW",           value: upw ? `${upw}` : "—", icon: FiActivity, color: "#059669", bg: "#d1fae5", border: "#6ee7b7" },
  ];

  return (
    <div style={{ position:"absolute", inset:0,fontWeight:400, zIndex:20, background:"#fff", borderRadius:12,
      display:"flex", flexDirection:"column", overflow:"hidden", border:"2px solid #c7d2fe" }}>

      {/* Header */}
      <div style={{ flexShrink:0, height:40, display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"0 12px", borderBottom:"1px solid #e0e7ff",
        background:"linear-gradient(90deg,#eef2ff,#fff)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:7 }}>
          <FiActivity size={13} color="#4f46e5" />
          <span style={{ fontSize:12, fontWeight:700, color:"#312e81" }}>Production × Manpower Report</span>
          <span style={{ fontSize:10, background:"#eef2ff", color:"#4338ca", border:"1px solid #c7d2fe",
            borderRadius:20, padding:"1px 8px", fontWeight:700 }}>{title}</span>
        </div>
        <div style={{ display:"flex", gap:6 }}>
          <button onClick={exportCSV} style={{ display:"flex", alignItems:"center", gap:4, padding:"3px 8px",
            border:"1px solid #c7d2fe", borderRadius:6, background:"#f8fafc", color:"#4f46e5",
            cursor:"pointer", fontSize:10, fontWeight:700 }}>
            <FiDownload size={11} /> Export
          </button>
          <button onClick={onClose} style={{ display:"flex", alignItems:"center", justifyContent:"center",
            width:24, height:24, borderRadius:6, border:"1px solid #e2e8f0", background:"#f8fafc",
            color:"#64748b", cursor:"pointer" }}>
            <FiX size={13} />
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div style={{ flexShrink:0, display:"flex", gap:8, padding:"10px 12px 0",
        borderBottom:"1px solid #f1f5f9", paddingBottom:10 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ flex:1, padding:"8px 10px", borderRadius:10,
            background:k.bg, border:`1px solid ${k.border}`, minWidth:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:3 }}>
              <k.icon size={11} color={k.color} />
              <span style={{ fontSize:9, fontWeight:700, color:k.color, textTransform:"uppercase",
                letterSpacing:"0.06em" }}>{k.label}</span>
            </div>
            <div style={{ fontSize:18, fontWeight:800, color:k.color, fontVariantNumeric:"tabular-nums" }}>
              {k.value}
            </div>
          </div>
        ))}
      </div>

      {/* Body */}
      <div style={{ flex:1, minHeight:0, display:"flex", overflow:"hidden" }}>

        {/* Left: Hourly table */}
        <div style={{ width:"42%", display:"flex", flexDirection:"column", borderRight:"1px solid #f1f5f9", overflow:"hidden" }}>
          <div style={{ padding:"7px 12px 5px", background:"#f8fafc", borderBottom:"1px solid #f1f5f9",
            display:"flex", alignItems:"center", gap:5 }}>
            <FiClock size={10} color="#4f46e5" />
            <span style={{ fontSize:10, fontWeight:700, color:"#475569" }}>Hourly Production vs UPW</span>
          </div>
          <div style={{ flex:1, overflowY:"auto" }}>
            <table style={{ width:"100%", fontSize:11, borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ position:"sticky", top:0, background:"#f8fafc", zIndex:1 }}>
                  {["Hour","Production","UPW","Efficiency"].map((h,i) => (
                    <th key={i} style={{ padding:"5px 8px", textAlign:i===0?"left":"right",
                      color:"#94a3b8", fontWeight:700, borderBottom:"1px solid #f1f5f9",
                      fontSize:10, whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hourlyUPW.map((row, i) => {
                  const prodFrac = maxProd > 0 ? row.prod / maxProd : 0;
                  const avgUPW   = dayWorkers > 0 ? Math.round(total / data.length / dayWorkers) : 0;
                  const effPct   = avgUPW > 0 ? Math.round((row.upw / avgUPW) * 100) : 0;
                  return (
                    <tr key={i} style={{ borderBottom:"1px solid #f8fafc", background: heatBg(prodFrac) }}>
                      <td style={{ padding:"5px 8px", fontFamily:"monospace", fontWeight:700,
                        color: isDay(parseInt(row.hour)) ? "#0891b2" : "#7c3aed", fontSize:11 }}>
                        {row.hour}
                      </td>
                      <td style={{ padding:"5px 8px", textAlign:"right", fontFamily:"monospace",
                        fontWeight:700, color:"#312e81" }}>{fmtN(row.prod)}</td>
                      <td style={{ padding:"5px 8px", textAlign:"right", fontFamily:"monospace",
                        fontWeight:700, color: row.upw >= (upw||0) ? "#059669" : "#dc2626" }}>
                        {row.upw > 0 ? row.upw : "—"}
                      </td>
                      <td style={{ padding:"5px 8px", textAlign:"right" }}>
                        {effPct > 0 ? (
                          <span style={{ display:"inline-flex", alignItems:"center", gap:3, fontSize:10,
                            fontWeight:700, color: effPct >= 100 ? "#059669" : effPct >= 75 ? "#d97706" : "#dc2626" }}>
                            {effPct >= 100 ? <FiArrowUp size={9}/> : <FiArrowDown size={9}/>}
                            {effPct}%
                          </span>
                        ) : <span style={{ color:"#e2e8f0", fontSize:10 }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ height:28, flexShrink:0, display:"flex", alignItems:"center",
            justifyContent:"space-between", padding:"0 10px", borderTop:"2px solid #e0e7ff", background:"#eef2ff" }}>
            <span style={{ fontSize:10, color:"#4338ca", fontWeight:700 }}>UPW Avg</span>
            <span style={{ fontFamily:"monospace", fontWeight:800, fontSize:12, color:"#312e81" }}>
              {upw ?? "—"} u/w
            </span>
          </div>
        </div>

        {/* Right: Chart + worker breakdown */}
        <div style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", overflow:"hidden" }}>

          {/* Mini bar chart */}
          {hourlyUPW.length > 0 && (
            <div style={{ height:100, flexShrink:0, padding:"8px 12px 4px", borderBottom:"1px solid #f1f5f9" }}>
              <Bar
                data={{
                  labels: hourlyUPW.map(r => r.hour),
                  datasets: [
                    { label:"Production", data: hourlyUPW.map(r => r.prod),
                      backgroundColor: hourlyUPW.map(r => isDay(parseInt(r.hour)) ? DAY_COLOR : NIGHT_COLOR),
                      borderRadius:2, borderWidth:0, order:2 },
                    ...(dayWorkers > 0 ? [{
                      label:`UPW (×${dayWorkers} workers)`, data: hourlyUPW.map(r => r.upw),
                      type:"line", borderColor: UPW_COLOR, borderWidth:2,
                      pointRadius:2.5, pointBackgroundColor: UPW_COLOR, fill:false, tension:0.3, order:1,
                    }] : []),
                  ],
                }}
                options={makeOptions(maxProd, true)}
              />
            </div>
          )}

          {/* Worker roster split by shift */}
          <div style={{ flex:1, overflowY:"auto" }}>
            <div style={{ padding:"7px 12px 4px", background:"#f8fafc", borderBottom:"1px solid #f1f5f9",
              display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                <FiUsers size={10} color="#ea580c" />
                <span style={{ fontSize:10, fontWeight:700, color:"#475569" }}>Worker Roster</span>
              </div>
              <div style={{ display:"flex", gap:10, fontSize:9, fontWeight:700 }}>
                <span style={{ color:"#0891b2" }}>☀ {dayWorkers} day</span>
                <span style={{ color:"#7c3aed" }}>☾ {nightWorkers} night</span>
              </div>
            </div>
            {manpowerWorkers.length === 0 ? (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
                height:100, gap:6, color:"#cbd5e1" }}>
                <FiUsers size={22} />
                <span style={{ fontSize:11, color:"#94a3b8" }}>No workers on this line</span>
              </div>
            ) : (
              <table style={{ width:"100%", fontSize:10.5, borderCollapse:"collapse" }}>
                <thead>
                  <tr style={{ position:"sticky", top:0, background:"#f8fafc", zIndex:1 }}>
                    {["Name","Shift","In","Status"].map((h,i) => (
                      <th key={i} style={{ padding:"5px 8px", textAlign:"left", color:"#94a3b8",
                        fontWeight:700, borderBottom:"1px solid #f1f5f9", fontSize:9,
                        textTransform:"uppercase", letterSpacing:"0.05em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {manpowerWorkers.map((w, i) => {
                    const name    = w.WorkmenName || w["Workmen Name"] || w.Name || "—";
                    const shift   = classifyWorkerShift(w.CheckIn);
                    const inTime  = fmtDisplay(w.CheckIn);
                    const isInside = !w.CheckOut;
                    return (
                      <tr key={i} style={{ borderBottom:"1px solid #f8fafc",
                        background: i%2===0 ? "#fff" : "#fafcff" }}>
                        <td style={{ padding:"4px 8px" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                            <span style={{ width:5, height:5, borderRadius:"50%", flexShrink:0,
                              background: isInside ? "#22c55e" : "#94a3b8" }} />
                            <span style={{ color:"#1e293b", fontWeight:600,
                              maxWidth:100, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                              {name}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding:"4px 8px" }}>
                          <span style={{ fontSize:9, fontWeight:700, borderRadius:4, padding:"1px 6px",
                            background: shift==="day" ? "#e0f2fe" : "#f5f3ff",
                            color: shift==="day" ? "#0369a1" : "#6d28d9",
                            border: `1px solid ${shift==="day" ? "#bae6fd" : "#e0e7ff"}` }}>
                            {shift==="day" ? "☀ Day" : "☾ Night"}
                          </span>
                        </td>
                        <td style={{ padding:"4px 8px", fontFamily:"monospace", fontSize:9.5, color:"#64748b" }}>
                          {inTime.slice(11)}
                        </td>
                        <td style={{ padding:"4px 8px", textAlign:"center" }}>
                          {isInside
                            ? <span style={{ fontSize:9, fontWeight:700, background:"#ecfdf5", color:"#15803d",
                                border:"1px solid #bbf7d0", borderRadius:20, padding:"1px 7px" }}>In</span>
                            : <span style={{ fontSize:9, color:"#94a3b8", border:"1px solid #e2e8f0",
                                borderRadius:20, padding:"1px 7px" }}>Out</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Manpower Panel ───────────────────────────────────────────────────────────
const ManpowerPanel = ({ workers, onClose }) => {
  const [search, setSearch] = useState("");

  const { dayWorkers, nightWorkers, inside } = useMemo(() => {
    const day   = workers.filter(w => classifyWorkerShift(w.CheckIn) === "day");
    const night = workers.filter(w => classifyWorkerShift(w.CheckIn) === "night");
    const ins   = workers.filter(w => !w.CheckOut);
    return { dayWorkers: day.length, nightWorkers: night.length, inside: ins.length };
  }, [workers]);

  const filtered = useMemo(() => {
    if (!search.trim()) return workers;
    const s = search.toLowerCase();
    return workers.filter(w =>
      [w.WorkmenName || w["Workmen Name"] || w.Name || "", w.Contractor || "", w.Department || ""]
        .some(v => v.toLowerCase().includes(s))
    );
  }, [workers, search]);

  const exportCSV = () => {
    const csv = [
      ["#","Name","Contractor","Department","Shift","Check-In","Status"],
      ...filtered.map((w, i) => [
        i+1,
        w.WorkmenName || w["Workmen Name"] || "—",
        w.Contractor || "—",
        w.Department || "—",
        classifyWorkerShift(w.CheckIn),
        fmtDisplay(w.CheckIn),
        w.CheckOut ? "Checked Out" : "Inside",
      ]),
    ].map(r => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `manpower_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div style={{ position:"absolute", inset:0,fontWeight:400, zIndex:20, background:"#fff", borderRadius:12,
      display:"flex", flexDirection:"column", overflow:"hidden", border:"2px solid #fed7aa" }}>

      {/* Header */}
      <div style={{ flexShrink:0, height:40, display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"0 12px", borderBottom:"1px solid #fed7aa",
        background:"linear-gradient(90deg,#fff7ed,#fff)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:7 }}>
          <MdPeople size={14} color="#ea580c" />
          <span style={{ fontSize:12, fontWeight:700, color:"#7c2d12" }}>Manpower on Line</span>
          <span style={{ fontSize:9, fontWeight:700, background:"#e0f2fe", color:"#0369a1",
            border:"1px solid #bae6fd", borderRadius:20, padding:"2px 7px",
            display:"flex", alignItems:"center", gap:3 }}>
            <FiSun size={8}/> {dayWorkers} day
          </span>
          <span style={{ fontSize:9, fontWeight:700, background:"#f5f3ff", color:"#6d28d9",
            border:"1px solid #e0e7ff", borderRadius:20, padding:"2px 7px",
            display:"flex", alignItems:"center", gap:3 }}>
            <FiMoon size={8}/> {nightWorkers} night
          </span>
          <span style={{ fontSize:9, fontWeight:700, background:"#ecfdf5", color:"#15803d",
            border:"1px solid #bbf7d0", borderRadius:20, padding:"2px 7px" }}>
            ● {inside} inside
          </span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <button onClick={exportCSV} style={{ display:"flex", alignItems:"center", gap:4, padding:"3px 8px",
            border:"1px solid #e2e8f0", borderRadius:6, background:"#f8fafc", color:"#475569",
            cursor:"pointer", fontSize:10, fontWeight:600 }}>
            <FiDownload size={11} /> CSV
          </button>
          <button onClick={onClose} style={{ display:"flex", alignItems:"center", justifyContent:"center",
            width:24, height:24, borderRadius:6, border:"1px solid #e2e8f0", background:"#f8fafc",
            color:"#64748b", cursor:"pointer" }}>
            <FiX size={13} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={{ flexShrink:0, padding:"7px 12px", borderBottom:"1px solid #f1f5f9", background:"#fffbf7" }}>
        <div style={{ position:"relative" }}>
          <FiSearch size={12} style={{ position:"absolute", left:8, top:"50%", transform:"translateY(-50%)",
            color:"#94a3b8", pointerEvents:"none" }} />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name, contractor, department…"
            style={{ width:"100%", boxSizing:"border-box", paddingLeft:28, paddingRight:8,
              padding:"5px 8px 5px 28px", border:"1px solid #e2e8f0", borderRadius:7,
              fontSize:11, color:"#334155", background:"#fff", outline:"none" }} />
          {search && (
            <button onClick={() => setSearch("")} style={{ position:"absolute", right:6, top:"50%",
              transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:"#94a3b8" }}>
              <FiX  />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div style={{ flex:1, minHeight:0, overflowY:"auto" }}>
        {filtered.length === 0 ? (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center",
            justifyContent:"center", height:"100%", gap:6, color:"#cbd5e1" }}>
            <FiUsers size={28} />
            <span style={{ fontSize:12, color:"#94a3b8" }}>
              {search ? "No workers match your search" : "No manpower data"}
            </span>
          </div>
        ) : (
          <table style={{ width:"100%", fontSize:11, borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ position:"sticky", top:0, zIndex:2, background:"#fafafa" }}>
                {[{l:"#",w:28},{l:"Name"},{l:"Contractor"},{l:"Shift",w:80},{l:"Check-In",w:112},{l:"Status",w:88}].map(h => (
                  <th key={h.l} style={{ padding:"6px 8px", textAlign:"left", color:"#94a3b8", fontWeight:700,
                    borderBottom:"1px solid #f1f5f9", width:h.w, fontSize:10, textTransform:"uppercase",
                    letterSpacing:"0.05em" }}>{h.l}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => {
                const name     = row.WorkmenName || row["Workmen Name"] || row.Name || "—";
                const shift    = classifyWorkerShift(row.CheckIn);
                const inTime   = fmtDisplay(row.CheckIn);
                const isInside = !row.CheckOut;
                return (
                  <tr key={i} style={{ borderBottom:"1px solid #f8fafc",
                    background: i%2===0 ? "#fff" : "#fafcff" }}>
                    <td style={{ padding:"5px 8px", textAlign:"center", color:"#cbd5e1",
                      fontFamily:"monospace", fontSize:10 }}>{i+1}</td>
                    <td style={{ padding:"5px 8px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                        <span style={{ width:6, height:6, borderRadius:"50%", flexShrink:0,
                          background: isInside ? "#22c55e" : "#94a3b8" }} />
                        <span style={{ fontSize:11, fontWeight:600, color:"#1e293b" }}>{name}</span>
                      </div>
                    </td>
                    <td style={{ padding:"5px 8px", color:"#475569", fontSize:10, maxWidth:130,
                      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={row.Contractor || "—"}>
                      <span style={{ display:"inline-flex", alignItems:"center", gap:4 }}>
                        <MdBusiness size={9} color="#94a3b8" />
                        {row.Contractor || "—"}
                      </span>
                    </td>
                    <td style={{ padding:"5px 8px" }}>
                      <span style={{ fontSize:9, fontWeight:700, borderRadius:4, padding:"1px 6px",
                        background: shift==="day" ? "#e0f2fe" : "#f5f3ff",
                        color: shift==="day" ? "#0369a1" : "#6d28d9",
                        border: `1px solid ${shift==="day" ? "#bae6fd" : "#e0e7ff"}` }}>
                        {shift==="day" ? "☀ Day" : "☾ Night"}
                      </span>
                    </td>
                    <td style={{ padding:"5px 8px", color:"#64748b", fontFamily:"monospace",
                      fontSize:10, whiteSpace:"nowrap" }}>
                      <span style={{ display:"inline-flex", alignItems:"center", gap:4 }}>
                        <MdAccessTime size={9} color="#94a3b8" />
                        {inTime}
                      </span>
                    </td>
                    <td style={{ padding:"5px 8px", textAlign:"center" }}>
                      {isInside
                        ? <span style={{ display:"inline-flex", alignItems:"center", gap:3, fontSize:10,
                            fontWeight:700, background:"#ecfdf5", color:"#15803d",
                            border:"1px solid #bbf7d0", borderRadius:20, padding:"2px 7px" }}>
                            <FiCheckCircle size={9}/> Inside
                          </span>
                        : <span style={{ display:"inline-flex", alignItems:"center", gap:3, fontSize:10,
                            background:"#f8fafc", color:"#64748b", border:"1px solid #e2e8f0",
                            borderRadius:20, padding:"2px 7px" }}>
                            <FiLogOut size={9}/> Out
                          </span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer */}
      <div style={{ flexShrink:0, height:30, display:"flex", alignItems:"center",
        justifyContent:"space-between", padding:"0 12px", borderTop:"1px solid #fed7aa", background:"#fff7ed" }}>
        <span style={{ fontSize:10, color:"#9a3412", fontWeight:700 }}>
          {filtered.length} of {workers.length} workers{search ? " (filtered)" : ""}
        </span>
        <span style={{ fontSize:10, color:"#64748b" }}>
          {inside} inside · {workers.length - inside} out
        </span>
      </div>
    </div>
  );
};

// ─── HourlyModelPanel ─────────────────────────────────────────────────────────
const HourlyModelPanel = ({ modelData, onClose }) => {
  const flatRows = useMemo(
    () => [...modelData].sort((a,b) => a.TIMEHOUR - b.TIMEHOUR || (b.Model_Count||0) - (a.Model_Count||0)),
    [modelData],
  );
  const grandTotal = flatRows.reduce((s,r) => s + (r.Model_Count||0), 0);
  const topModels = useMemo(() => {
    const map = {};
    for (const item of modelData) {
      if (!map[item.MatCode]) map[item.MatCode] = { MatCode:item.MatCode, Name:item.Name||item.MatCode, Total:0 };
      map[item.MatCode].Total += item.Model_Count||0;
    }
    return Object.values(map).sort((a,b)=>b.Total-a.Total).slice(0,10);
  }, [modelData]);
  const hours = useMemo(() => [...new Set(modelData.map(d=>d.TIMEHOUR))].sort((a,b)=>a-b), [modelData]);
  const lookup = useMemo(() => {
    const m = {};
    for (const item of modelData) {
      if (!m[item.TIMEHOUR]) m[item.TIMEHOUR]={};
      m[item.TIMEHOUR][item.MatCode] = (m[item.TIMEHOUR][item.MatCode]||0) + (item.Model_Count||0);
    }
    return m;
  }, [modelData]);
  const hourTotals = hours.map(h => topModels.reduce((s,m)=>s+(lookup[h]?.[m.MatCode]||0),0));
  const maxHourTotal = hourTotals.length>0 ? Math.max(...hourTotals,0) : 0;
  const chartDatasets = topModels.map((model,i) => ({
    label: model.Name.length>14 ? model.Name.slice(0,12)+"…" : model.Name,
    data: hours.map(h=>lookup[h]?.[model.MatCode]||0),
    backgroundColor: MODEL_COLORS[i%MODEL_COLORS.length],
    borderWidth:0, borderRadius:2, stack:"s",
  }));
  const modelColorMap = useMemo(() => {
    const map={};
    topModels.forEach((m,i)=>{map[m.MatCode]=MODEL_COLORS[i%MODEL_COLORS.length];});
    return map;
  }, [topModels]);

  const exportCSV = () => {
    const csv = [["Time","Model Name","Count"],
      ...flatRows.map(r=>[`${r.TIMEHOUR}:00`, r.Name||r.MatCode, r.Model_Count||0])]
      .map(r=>r.join(",")).join("\n");
    const a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
    a.download=`hourly_model_${Date.now()}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
  };

  return (
    <div style={{ position:"absolute",inset:0,fontWeight:400,zIndex:10,background:"#fff",borderRadius:12,
      display:"flex",flexDirection:"column",overflow:"hidden" }}>
      <div style={{ height:36,flexShrink:0,display:"flex",alignItems:"center",
        justifyContent:"space-between",padding:"0 12px",borderBottom:"1px solid #e2e8f0",background:"#f8fafc" }}>
        <div style={{ display:"flex",alignItems:"center",gap:7 }}>
          <MdSchedule size={13} color="#0ea5e9" />
          <span style={{ fontSize:12,fontWeight:700,color:"#334155" }}>Model-wise Hourly Breakdown</span>
          <span style={{ fontSize:10,color:"#94a3b8" }}>{flatRows.length} rows · {grandTotal.toLocaleString()} units</span>
        </div>
        <div style={{ display:"flex",gap:4 }}>
          <button onClick={exportCSV} style={{ display:"flex",alignItems:"center",gap:4,padding:"3px 8px",
            border:"1px solid #e2e8f0",borderRadius:6,background:"#f8fafc",color:"#475569",
            cursor:"pointer",fontSize:10,fontWeight:600 }}><FiDownload size={11}/> CSV</button>
          <button onClick={onClose} style={{ display:"flex",alignItems:"center",justifyContent:"center",
            width:24,height:24,borderRadius:6,border:"1px solid #e2e8f0",background:"#f8fafc",
            color:"#64748b",cursor:"pointer" }}><FiX size={13}/></button>
        </div>
      </div>
      <div style={{ height:100,flexShrink:0,padding:"5px 12px 3px",borderBottom:"1px solid #f1f5f9",background:"#fafbfc" }}>
        <Bar data={{ labels:hours.map(h=>`${h}:00`), datasets:chartDatasets }} options={makeStackedOptions(maxHourTotal)} />
      </div>
      <div style={{ flex:1,minHeight:0,overflowY:"auto" }}>
        <table style={{ width:"100%",fontSize:11,borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ position:"sticky",top:0,zIndex:2,background:"#f8fafc" }}>
              <th style={{ padding:"8px 16px",textAlign:"left",fontWeight:700,color:"#64748b",borderBottom:"2px solid #e2e8f0",width:80 }}>Time</th>
              <th style={{ padding:"8px 16px",textAlign:"left",fontWeight:700,color:"#64748b",borderBottom:"2px solid #e2e8f0" }}>Model</th>
              <th style={{ padding:"8px 16px",textAlign:"right",fontWeight:700,color:"#64748b",borderBottom:"2px solid #e2e8f0",width:80 }}>Count</th>
            </tr>
          </thead>
          <tbody>
            {flatRows.map((row,i) => {
              const color = modelColorMap[row.MatCode]||"#94a3b8";
              const isNewHour = i===0 || flatRows[i-1].TIMEHOUR !== row.TIMEHOUR;
              return (
                <tr key={i} style={{ borderBottom:"1px solid #f1f5f9",
                  borderTop: isNewHour&&i>0?"1px solid #e2e8f0":undefined,
                  background: isNewHour?"rgba(14,165,233,0.03)":"#fff" }}>
                  <td style={{ padding:"7px 16px",fontFamily:"monospace",fontWeight:700,fontSize:11,
                    color: isDay(row.TIMEHOUR)?"#0ea5e9":"#8b5cf6",whiteSpace:"nowrap" }}>
                    {isNewHour ? `${row.TIMEHOUR}:00` : ""}
                  </td>
                  <td style={{ padding:"7px 16px",color:"#334155",fontSize:11 }}>
                    <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                      <span style={{ width:8,height:8,borderRadius:"50%",background:color,flexShrink:0 }}/>
                      {row.Name||row.MatCode}
                    </div>
                  </td>
                  <td style={{ padding:"7px 16px",textAlign:"right",fontFamily:"monospace",fontWeight:700,color }}>
                    {(row.Model_Count||0).toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ height:32,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"space-between",
        padding:"0 16px",borderTop:"2px solid #e2e8f0",background:"#f8fafc" }}>
        <span style={{ fontSize:10,color:"#94a3b8",fontWeight:700,textTransform:"uppercase" }}>Total</span>
        <span style={{ fontFamily:"monospace",fontSize:12,fontWeight:700,color:"#1e293b" }}>{grandTotal.toLocaleString()}</span>
      </div>
    </div>
  );
};

// ─── TotalModelPanel ──────────────────────────────────────────────────────────
const TotalModelPanel = ({ modelData, onClose }) => {
  const modelTotals = useMemo(() => {
    const map={};
    for (const item of modelData) {
      if (!map[item.MatCode]) map[item.MatCode]={ MatCode:item.MatCode,Name:item.Name||item.MatCode,Total:0 };
      map[item.MatCode].Total += item.Model_Count||0;
    }
    return Object.values(map).sort((a,b)=>b.Total-a.Total);
  }, [modelData]);
  const grandTotal = modelTotals.reduce((s,m)=>s+m.Total,0);
  const maxVal = modelTotals[0]?.Total||0;

  const exportCSV = () => {
    const csv = [["#","MatCode","Name","Count","%"],
      ...modelTotals.map((m,i)=>[i+1,m.MatCode,m.Name,m.Total,
        grandTotal>0?((m.Total/grandTotal)*100).toFixed(1)+"%":"0%"])]
      .map(r=>r.join(",")).join("\n");
    const a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
    a.download=`total_model_${Date.now()}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
  };

  const chartH = Math.max(160, modelTotals.length*24);

  return (
    <div style={{ position:"absolute",inset:0,fontWeight:400,zIndex:10,background:"#fff",borderRadius:12,
      display:"flex",flexDirection:"column",overflow:"hidden" }}>
      <div style={{ height:36,flexShrink:0,display:"flex",alignItems:"center",
        justifyContent:"space-between",padding:"0 12px",borderBottom:"1px solid #e2e8f0",background:"#f8fafc" }}>
        <div style={{ display:"flex",alignItems:"center",gap:7 }}>
          <MdLeaderboard size={13} color="#14b8a6" />
          <span style={{ fontSize:12,fontWeight:700,color:"#334155" }}>Total Model Summary</span>
          <span style={{ fontSize:10,background:"#f0fdfa",color:"#0d9488",border:"1px solid #99f6e4",
            borderRadius:5,padding:"1px 7px",fontWeight:700 }}>{modelTotals.length} models · {grandTotal.toLocaleString()} units</span>
        </div>
        <div style={{ display:"flex",gap:4 }}>
          <button onClick={exportCSV} style={{ display:"flex",alignItems:"center",gap:4,padding:"3px 8px",
            border:"1px solid #e2e8f0",borderRadius:6,background:"#f8fafc",color:"#475569",
            cursor:"pointer",fontSize:10,fontWeight:600 }}><FiDownload size={11}/> CSV</button>
          <button onClick={onClose} style={{ display:"flex",alignItems:"center",justifyContent:"center",
            width:24,height:24,borderRadius:6,border:"1px solid #e2e8f0",background:"#f8fafc",
            color:"#64748b",cursor:"pointer" }}><FiX size={13}/></button>
        </div>
      </div>
      <div style={{ flex:1,minHeight:0,display:"flex" }}>
        <div style={{ width:"48%",display:"flex",flexDirection:"column",borderRight:"1px solid #f1f5f9",overflow:"hidden" }}>
          <div style={{ flex:1,overflowY:"auto" }}>
            <table style={{ width:"100%",fontSize:11,borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ position:"sticky",top:0,background:"#f8fafc",zIndex:1 }}>
                  {["#","Model","Count","Share"].map((h,i)=>(
                    <th key={i} style={{ padding:"6px 8px",textAlign:i>=2?"right":"left",
                      color:"#94a3b8",fontWeight:600,borderBottom:"1px solid #f1f5f9" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {modelTotals.map((model,i) => {
                  const pct = grandTotal>0?((model.Total/grandTotal)*100).toFixed(1):"0.0";
                  const frac = model.Total/Math.max(maxVal,1);
                  return (
                    <tr key={i} style={{ borderBottom:"1px solid #f8fafc",background:heatBg(frac) }}>
                      <td style={{ padding:"5px 8px",color:"#cbd5e1",fontFamily:"monospace" }}>{i+1}</td>
                      <td style={{ padding:"5px 8px",maxWidth:140 }}>
                        <div style={{ display:"flex",alignItems:"center",gap:5 }}>
                          <span style={{ width:8,height:8,borderRadius:"50%",flexShrink:0,
                            background:MODEL_COLORS[i%MODEL_COLORS.length] }}/>
                          <span style={{ color:"#475569",overflow:"hidden",textOverflow:"ellipsis",
                            whiteSpace:"nowrap",fontSize:10.5 }} title={model.Name}>{model.Name}</span>
                        </div>
                      </td>
                      <td style={{ padding:"5px 8px",textAlign:"right",fontFamily:"monospace",
                        fontWeight:700,color:MODEL_COLORS[i%MODEL_COLORS.length] }}>
                        {model.Total.toLocaleString()}
                      </td>
                      <td style={{ padding:"5px 8px",textAlign:"right",fontFamily:"monospace",
                        color:"#94a3b8",fontSize:10 }}>{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ height:28,flexShrink:0,display:"flex",alignItems:"center",
            justifyContent:"space-between",padding:"0 10px",borderTop:"1px solid #e2e8f0",background:"#f8fafc" }}>
            <span style={{ fontSize:10,color:"#94a3b8",fontWeight:700,textTransform:"uppercase" }}>Total</span>
            <span style={{ fontFamily:"monospace",fontWeight:700,fontSize:12,color:"#1e293b" }}>{grandTotal.toLocaleString()}</span>
          </div>
        </div>
        <div style={{ flex:1,minWidth:0,overflowY:"auto",padding:"8px 10px" }}>
          <div style={{ height:chartH,minHeight:"100%" }}>
            <Bar
              data={{
                labels: modelTotals.map(m=>m.Name.length>18?m.Name.slice(0,16)+"…":m.Name),
                datasets:[{ label:"Count",data:modelTotals.map(m=>m.Total),
                  backgroundColor:modelTotals.map((_,i)=>MODEL_COLORS[i%MODEL_COLORS.length]),
                  borderWidth:0,borderRadius:3 }],
              }}
              options={makeHorizOptions(maxVal)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── CategoryWidget ───────────────────────────────────────────────────────────
const CategoryWidget = ({ title, data=[], icon: Icon }) => {
  const total = data.reduce((s,r)=>s+(r.TotalCount||0),0);
  const maxCount = Math.max(data.reduce((m,r)=>Math.max(m,r.TotalCount||0),0),1);

  const exportCSV = () => {
    if (!data.length) return;
    const csv=[["#","Category","Count","%"],
      ...data.map((r,i)=>[i+1,r.category,r.TotalCount,
        total>0?((r.TotalCount/total)*100).toFixed(1)+"%":"0%"])]
      .map(r=>r.join(",")).join("\n");
    const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
    a.download=`${title.replace(/\s+/g,"_")}_${Date.now()}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };

  const catChartOptions = {
    indexAxis:"y",responsive:true,maintainAspectRatio:false,animation:{duration:220},
    plugins:{ legend:{display:false},tooltip:{ backgroundColor:"#0f172a",titleColor:"#94a3b8",
      bodyColor:"#f1f5f9",padding:8,callbacks:{label:(ctx)=>`  ${ctx.parsed.x.toLocaleString()} units`} } },
    scales:{ x:{ beginAtZero:true,border:{display:false},grid:{color:"rgba(0,0,0,0.04)"},
        ticks:{font:{size:16,weight:"bold",family:"monospace"},color:"#94a3b8",maxTicksLimit:5} },
      y:{ border:{display:false},grid:{display:false},ticks:{font:{size:16,weight:"bold"},color:"#475569"} } },
  };

  return (
    <div style={{ display:"flex",flexDirection:"column",height:"100%",background:"#fff",borderRadius:12,
      border:"1px solid #e2e8f0",overflow:"hidden",fontWeight:700 }}>
      <div style={{ height:36,flexShrink:0,display:"flex",alignItems:"center",
        justifyContent:"space-between",padding:"0 12px",borderBottom:"1px solid #f1f5f9" }}>
        <div style={{ display:"flex",alignItems:"center",gap:6 }}>
          {Icon && <Icon size={13} color="#64748b" />}
          <span style={{ fontSize:19,fontWeight:700,color:"#475569" }}>{title}</span>
        </div>
        <div style={{ display:"flex",alignItems:"center",gap:8 }}>
          <span style={{ fontFamily:"monospace",fontSize:20,fontWeight:700,color:"#1e293b" }}>{total.toLocaleString()}</span>
          <button onClick={exportCSV} title="Export CSV" style={{ display:"flex",alignItems:"center",
            padding:4,borderRadius:6,border:"1px solid #f1f5f9",background:"transparent",
            color:"#cbd5e1",cursor:"pointer" }}><FiDownload size={13}/></button>
        </div>
      </div>
      {data.length>0 ? (
        <div style={{ flex:1,minHeight:0,display:"flex" }}>
          <div style={{ width:"50%",overflowY:"auto",borderRight:"1px solid #f1f5f9" }}>
            <table style={{ width:"100%",fontSize:17,borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ position:"sticky",top:0,background:"#f8fafc",zIndex:1 }}>
                  {["#","Category","Count","Share"].map((h,i)=>(
                    <th key={i} style={{ padding:"6px 8px",textAlign:i>=2?"center":"left",
                      color:"#94a3b8",fontWeight:700,borderBottom:"1px solid #f1f5f9" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row,i)=>{
                  const pct=total>0?((row.TotalCount/total)*100).toFixed(1):"0.0";
                  const frac=(row.TotalCount||0)/maxCount;
                  return (
                    <tr key={i} style={{ borderBottom:"1px solid #f8fafc",background:heatBg(frac) }}>
                      <td style={{ padding:"5px 8px",color:"#cbd5e1",fontFamily:"monospace" }}>{i+1}</td>
                      <td style={{ padding:"5px 8px",color:"#475569",maxWidth:220,overflow:"hidden",
                        textOverflow:"ellipsis",whiteSpace:"nowrap" }} title={row.category}>{row.category}</td>
                      <td style={{ padding:"5px 8px",textAlign:"center",fontFamily:"monospace",fontWeight:700,color:"#1e293b" }}>
                        {(row.TotalCount||0).toLocaleString()}</td>
                      <td style={{ padding:"5px 8px 5px 4px" }}>
                        <div style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:6 }}>
                          <div style={{ width:40,height:4,background:"#f1f5f9",borderRadius:2,overflow:"hidden" }}>
                            <div style={{ height:"100%",width:`${Math.round(frac*100)}%`,
                              background:`hsla(${200-i*8},70%,${55-i*1.2}%,0.85)`,borderRadius:2 }}/>
                          </div>
                          <span style={{ fontFamily:"monospace",color:"#94a3b8",width:62,textAlign:"right" }}>{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ flex:1,padding:"10px 12px",minWidth:0 }}>
            <Bar data={{ labels:data.map(r=>r.category),
              datasets:[{ label:"Count",data:data.map(r=>r.TotalCount||0),
                backgroundColor:data.map((_,i)=>`hsla(${200-i*8},70%,${55-i*1.2}%,0.72)`),
                borderWidth:0,borderRadius:3 }] }}
              options={catChartOptions}/>
          </div>
        </div>
      ) : (
        <div style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",
          justifyContent:"center",gap:6,color:"#cbd5e1" }}>
          <FiBarChart2 size={26}/>
          <span style={{ fontSize:12,color:"#94a3b8" }}>No data — select a range and query</span>
        </div>
      )}
    </div>
  );
};

// ─── Main HourlyWidget ────────────────────────────────────────────────────────
const HourlyWidget = ({
  title, data=[], modelData=[], datasets=[],
  isCategoryChart=false, icon: Icon,
  manpowerWorkers=[], manpowerLoading=false,
}) => {
  const [chartType, setChartType]   = useState("bar");
  const [showCumul, setShowCumul]   = useState(false);
  // null | "hourly" | "total" | "manpower" | "combined"
  const [activePanel, setActivePanel] = useState(null);

  const hasModelData = modelData?.length > 0;
  const hasManpower  = manpowerWorkers?.length > 0;

  // ── Derived production ────────────────────────────────────────────────────
  const total = useMemo(
    () => datasets.reduce((s,ds) => s + data.reduce((r,row) => r + (row[ds.key]||0), 0), 0),
    [data, datasets],
  );
  const rowTotals = useMemo(
    () => data.map(row => datasets.reduce((s,ds) => s + (row[ds.key]||0), 0)),
    [data, datasets],
  );
  const maxRowVal    = rowTotals.length>0 ? Math.max(...rowTotals, 0) : 0;
  const peakIdx      = rowTotals.length>0 ? rowTotals.indexOf(Math.max(...rowTotals,0)) : -1;
  const peakRow      = peakIdx>=0 ? data[peakIdx] : null;
  const avgPerRow    = data.length>0 ? Math.round(total/data.length) : 0;
  const cumulative   = useMemo(() => { let c=0; return rowTotals.map(v=>(c+=v)); }, [rowTotals]);
  const shiftTotals  = useMemo(() =>
    data.reduce((acc,row,i) => {
      const h = row.TIMEHOUR??-1;
      if (h>=DAY_START && h<DAY_END) acc.day+=rowTotals[i];
      else acc.night+=rowTotals[i];
      return acc;
    }, {day:0,night:0}),
    [data, rowTotals],
  );
  const dayPct = total>0 ? Math.round((shiftTotals.day/total)*100) : 0;

  // ── Derived manpower ──────────────────────────────────────────────────────
  const { mpDay, mpNight, mpInside } = useMemo(() => {
    const day   = manpowerWorkers.filter(w => classifyWorkerShift(w.CheckIn)==="day").length;
    const night = manpowerWorkers.filter(w => classifyWorkerShift(w.CheckIn)==="night").length;
    const ins   = manpowerWorkers.filter(w => !w.CheckOut).length;
    return { mpDay: day, mpNight: night, mpInside: ins };
  }, [manpowerWorkers]);

  const upw = mpDay > 0 ? Math.round(total / mpDay) : null;

  if (isCategoryChart) return <CategoryWidget title={title} data={data} icon={Icon} />;

  // ── CSV export ────────────────────────────────────────────────────────────
  const exportCSV = () => {
    if (!data.length) return;
    const headers = ["Hr#","Time",...datasets.map(d=>d.label),
      ...(datasets.length>1?["Total"]:[]),"%",...(showCumul?["Cumulative"]:[])];
    const rows = data.map((row,i)=>[row.HOUR_NUMBER||row.HourNumber||i+1,
      `${row.TIMEHOUR??""}:00`,...datasets.map(d=>row[d.key]||0),
      ...(datasets.length>1?[rowTotals[i]]:[]),
      total>0?((rowTotals[i]/total)*100).toFixed(1)+"%":"0%",
      ...(showCumul?[cumulative[i]]:[])] );
    const csv=[headers,...rows].map(r=>r.join(",")).join("\n");
    const a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
    a.download=`${title.replace(/\s+/g,"_")}_${Date.now()}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
  };

  // ── Chart data ────────────────────────────────────────────────────────────
  const labels   = data.map(r=>`${r.TIMEHOUR??'?'}:00`);
  const allVals  = datasets.flatMap(ds=>data.map(r=>r[ds.key]||0));
  const maxVal   = Math.max(...(allVals.length?allVals:[0]), avgPerRow, 0);

  const chartDatasets = datasets.map(ds=>({
    label: ds.label,
    data: data.map(r=>r[ds.key]||0),
    backgroundColor: data.map(r=>isDay(r.TIMEHOUR??-1)?DAY_COLOR:NIGHT_COLOR),
    borderColor:     data.map(r=>isDay(r.TIMEHOUR??-1)?DAY_COLOR:NIGHT_COLOR),
    borderWidth: chartType==="line"?1.5:0,
    borderRadius: chartType==="bar"?3:0,
    pointBackgroundColor: data.map(r=>isDay(r.TIMEHOUR??-1)?DAY_COLOR:NIGHT_COLOR),
    pointRadius: chartType==="line"?2.5:0,
    fill:false, tension:0.35, order:2,
  }));
  const avgDataset = {
    label:`Avg (${avgPerRow.toLocaleString()})`,
    data: data.map(()=>avgPerRow),
    type:"line", borderColor:AVG_COLOR, borderWidth:1.5,
    borderDash:[5,3], pointRadius:0, fill:false, tension:0, order:1,
  };
  const showAvgLine = avgPerRow>0;
  const showLegend  = datasets.length>1 || showAvgLine;
  const finalDatasets = showAvgLine?[...chartDatasets,avgDataset]:chartDatasets;

  const togglePanel = (id) => setActivePanel(p => p===id ? null : id);

  return (
    <div style={{ display:"flex",flexDirection:"column",height:"100%",background:"#fff",borderRadius:12,
      border:"1px solid #e2e8f0",overflow:"hidden",position:"relative",fontWeight:700 }}>

      {/* ── Overlay panels ── */}
      {activePanel==="hourly"   && hasModelData && <HourlyModelPanel modelData={modelData} onClose={()=>setActivePanel(null)}/>}
      {activePanel==="total"    && hasModelData && <TotalModelPanel modelData={modelData}  onClose={()=>setActivePanel(null)}/>}
      {activePanel==="manpower" && <ManpowerPanel workers={manpowerWorkers} onClose={()=>setActivePanel(null)}/>}
      {activePanel==="combined" && (
        <CombinedReportPanel title={title} data={data} datasets={datasets}
          manpowerWorkers={manpowerWorkers} onClose={()=>setActivePanel(null)}/>
      )}

      {/* ── Header ── */}
      <div style={{ height:36,flexShrink:0,display:"flex",alignItems:"center",
        justifyContent:"space-between",padding:"0 10px",borderBottom:"1px solid #f1f5f9" }}>
        <div style={{ display:"flex",alignItems:"center",gap:6 }}>
          {Icon && <Icon size={13} color="#94a3b8"/>}
          <span style={{ fontSize:19,fontWeight:700,color:"#334155" }}>{title}</span>
        </div>
        <div style={{ display:"flex",alignItems:"center",gap:1 }}>

          {/* Model overlays */}
          {hasModelData && (<>
            <button onClick={()=>togglePanel("hourly")} title="Model Hourly"
              style={{ display:"flex",alignItems:"center",gap:2,padding:"3px 7px",borderRadius:5,
                border:`1px solid ${activePanel==="hourly"?"#0ea5e9":"#e0f2fe"}`,cursor:"pointer",fontSize:12,fontWeight:700,
                background:activePanel==="hourly"?"#0ea5e9":"#f0f9ff",
                color:activePanel==="hourly"?"#fff":"#0891b2" }}>
              <MdSchedule size={11}/><span>Hrly</span>
            </button>
            <button onClick={()=>togglePanel("total")} title="Model Total"
              style={{ display:"flex",alignItems:"center",gap:2,padding:"3px 7px",borderRadius:5,
                border:`1px solid ${activePanel==="total"?"#14b8a6":"#ccfbf1"}`,cursor:"pointer",fontSize:12,fontWeight:700,
                background:activePanel==="total"?"#14b8a6":"#f0fdfa",
                color:activePanel==="total"?"#fff":"#0d9488",marginLeft:2 }}>
              <MdLeaderboard size={11}/><span>Total</span>
            </button>
            <div style={{ width:1,height:14,background:"#e2e8f0",margin:"0 3px" }}/>
          </>)}

          {/* Manpower badge */}
          {(hasManpower||manpowerLoading) && (<>
            <button onClick={()=>hasManpower?togglePanel("manpower"):undefined}
              disabled={manpowerLoading}
              title={manpowerLoading?"Loading…":`${manpowerWorkers.length} workers · click to view`}
              style={{ display:"flex",alignItems:"center",gap:3,padding:"3px 7px",borderRadius:5,fontSize:12,fontWeight:700,
                border:`1px solid ${activePanel==="manpower"?"#ea580c":"#fed7aa"}`,cursor:manpowerLoading?"wait":"pointer",
                background:activePanel==="manpower"?"#ea580c":manpowerLoading?"#fff7ed":"#fff7ed",
                color:activePanel==="manpower"?"#fff":manpowerLoading?"#fdba74":"#ea580c",marginLeft:0 }}>
              <MdPeople size={11}/>
              {manpowerLoading ? "…" : `${mpDay}D ${mpNight}N`}
            </button>

            {/* UPW badge */}
            {upw!==null && !manpowerLoading && (
              <button onClick={()=>togglePanel("combined")} title="Combined P×MP Report"
                style={{ display:"flex",alignItems:"center",gap:2,padding:"3px 7px",borderRadius:5,fontSize:12,fontWeight:700,
                  border:`1px solid ${activePanel==="combined"?"#059669":"#bbf7d0"}`,cursor:"pointer",
                  background:activePanel==="combined"?"#059669":"#f0fdf4",
                  color:activePanel==="combined"?"#fff":"#059669",marginLeft:2 }}>
                <FiActivity size={10}/>{upw}u/w
              </button>
            )}
            <div style={{ width:1,height:14,background:"#e2e8f0",margin:"0 3px" }}/>
          </>)}

          {/* Cumul + Total + CSV */}
          <button onClick={()=>setShowCumul(p=>!p)} title="Running total"
            style={{ padding:4,borderRadius:5,border:"none",background:"transparent",cursor:"pointer",
              color:showCumul?"#0ea5e9":"#cbd5e1" }}>
            <MdFunctions size={13}/>
          </button>
          <span style={{ fontFamily:"monospace",fontSize:20,fontWeight:800,color:"#1e293b",marginLeft:2,marginRight:2 }}>
            {total.toLocaleString()}
          </span>
          <button onClick={exportCSV} title="Export CSV"
            style={{ padding:4,borderRadius:5,border:"none",background:"transparent",cursor:"pointer",color:"#cbd5e1" }}>
            <FiDownload size={13}/>
          </button>
        </div>
      </div>

      {/* ── Shift bar ── */}
      {data.length>0 && (
        <div style={{ height:28,flexShrink:0,display:"flex",alignItems:"center",padding:"0 12px",gap:8,
          borderBottom:"1px solid #f8fafc" }}>
          <FiSun size={10} color="#0ea5e9" style={{ flexShrink:0 }}/>
          <span style={{ fontSize:16,color:"#64748b",fontFamily:"monospace",flexShrink:0 }}>
            {shiftTotals.day.toLocaleString()}
          </span>
          <div style={{ flex:1,height:4,background:"#f1f5f9",borderRadius:2,overflow:"hidden" }}>
            <div style={{ height:"100%",width:`${dayPct}%`,
              background:"linear-gradient(90deg,#0ea5e9,#38bdf8)",borderRadius:2,transition:"width 0.6s" }}/>
          </div>
          <span style={{ fontSize:16,color:"#64748b",fontFamily:"monospace",flexShrink:0 }}>
            {shiftTotals.night.toLocaleString()}
          </span>
          <FiMoon size={10} color="#8b5cf6" style={{ flexShrink:0 }}/>
          <div style={{ display:"flex",alignItems:"center",gap:5,marginLeft:6,flexShrink:0 }}>
            {peakRow && (
              <span style={{ display:"flex",alignItems:"center",gap:2,padding:"1px 6px",
                borderRadius:20,background:"#fef3c7",border:"1px solid #fcd34d",
                color:"#d97706",fontSize:15,fontWeight:700 }}>
                <FiZap size={8}/>{peakRow.TIMEHOUR}:00
              </span>
            )}
            <span style={{ display:"flex",alignItems:"center",gap:2,padding:"1px 6px",
              borderRadius:20,background:"#f1f5f9",border:"1px solid #e2e8f0",
              color:"#64748b",fontSize:15 }}>
              <FiTrendingUp size={8}/>{avgPerRow.toLocaleString()}/hr
            </span>
            {upw!==null && (
              <span style={{ display:"flex",alignItems:"center",gap:2,padding:"1px 6px",
                borderRadius:20,background:"#d1fae5",border:"1px solid #6ee7b7",
                color:"#059669",fontSize:15,fontWeight:700 }}>
                <FiUsers size={8}/>{upw}u/w
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Body ── */}
      {data.length>0 ? (
        <div style={{ flex:1,minHeight:0,display:"flex" }}>
          {/* Table */}
          <div style={{ width:"50%",display:"flex",flexDirection:"column",borderRight:"1px solid #f1f5f9",overflow:"hidden" }}>
            <div style={{ flex:1,overflowY:"auto" }}>
              <table style={{ width:"100%",fontSize:17,borderCollapse:"collapse" }}>
                <thead>
                  <tr style={{ position:"sticky",top:0,background:"#f8fafc",zIndex:1 }}>
                    <th style={{ padding:"5px 6px",color:"#94a3b8",fontWeight:700,textAlign:"center",
                      borderBottom:"1px solid #f1f5f9",width:28 }}>Hr</th>
                    <th style={{ padding:"5px 6px",color:"#94a3b8",fontWeight:700,textAlign:"center",
                      borderBottom:"1px solid #f1f5f9",width:38 }}>Time</th>
                    {datasets.map(ds=>(
                      <th key={ds.key} style={{ padding:"5px 6px",color:"#94a3b8",fontWeight:700,
                        textAlign:"center",borderBottom:"1px solid #f1f5f9" }}>{ds.label}</th>
                    ))}
                    {datasets.length>1&&<th style={{ padding:"5px 6px",color:"#94a3b8",fontWeight:700,
                      textAlign:"center",borderBottom:"1px solid #f1f5f9" }}>Tot</th>}
                    {showCumul&&<th style={{ padding:"5px 6px",color:"#94a3b8",fontWeight:700,textAlign:"center",
                      borderBottom:"1px solid #f1f5f9" }}>Cum</th>}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row,i)=>{
                    const rTotal=rowTotals[i];
                    const isPeak=i===peakIdx;
                    const bg=isPeak?"rgba(245,158,11,0.08)":heatBg(maxRowVal>0?rTotal/maxRowVal:0);
                    return (
                      <tr key={i} style={{ borderBottom:"1px solid #f8fafc",background:bg }}>
                        <td style={{ padding:"4px 6px",textAlign:"center",color:"#cbd5e1",fontFamily:"monospace" }}>
                          {row.HOUR_NUMBER||row.HourNumber||i+1}
                        </td>
                        <td style={{ padding:"4px 6px",textAlign:"center" }}>
                          <span style={{ fontSize:17,fontWeight:700,
                            color:isDay(row.TIMEHOUR??-1)?"#0ea5e9":"#8b5cf6",
                            display:"inline-flex",alignItems:"center",gap:2 }}>
                            {row.TIMEHOUR??'?'}:00
                            {isPeak&&<FiZap size={8} color="#f59e0b"/>}
                          </span>
                        </td>
                        {datasets.map(ds=>(
                          <td key={ds.key} style={{ padding:"4px 6px",textAlign:"center",fontFamily:"monospace",
                            fontWeight:700,color:"#1e293b" }}>
                            {(row[ds.key]||0).toLocaleString()}
                          </td>
                        ))}
                        {datasets.length>1&&<td style={{ padding:"4px 6px",textAlign:"center",fontFamily:"monospace",color:"#475569" }}>{rTotal.toLocaleString()}</td>}
                        {showCumul&&<td style={{ padding:"4px 6px",textAlign:"center",fontFamily:"monospace",color:"#475569",fontSize:16 }}>{cumulative[i].toLocaleString()}</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ height:28,flexShrink:0,display:"flex",alignItems:"center",
              justifyContent:"space-between",padding:"0 10px",borderTop:"1px solid #e2e8f0",background:"#f8fafc" }}>
              <span style={{ fontSize:16,color:"#94a3b8",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em" }}>Total</span>
              <span style={{ fontFamily:"monospace",fontWeight:700,fontSize:19,color:"#1e293b" }}>{total.toLocaleString()}</span>
            </div>
          </div>

          {/* Chart panel */}
          <div style={{ flex:1,minWidth:0,display:"flex",flexDirection:"column",padding:"6px 10px 8px" }}>
            <div style={{ display:"flex",justifyContent:"flex-end",gap:4,marginBottom:4,flexShrink:0 }}>
              <div style={{ display:"flex",alignItems:"center",gap:8,marginRight:"auto",fontSize:16,color:"#94a3b8" }}>
                {[[DAY_COLOR,"Day"],[NIGHT_COLOR,"Night"]].map(([c,l])=>(
                  <span key={l} style={{ display:"flex",alignItems:"center",gap:3 }}>
                    <span style={{ width:8,height:8,borderRadius:2,background:c,display:"inline-block" }}/>
                    {l}
                  </span>
                ))}
                <span style={{ display:"flex",alignItems:"center",gap:3 }}>
                  <span style={{ width:12,height:2,background:AVG_COLOR,display:"inline-block",borderRadius:1 }}/>Avg
                </span>
              </div>
              {[["bar",MdBarChart],["line",MdShowChart]].map(([type,Ico])=>(
                <button key={type} onClick={()=>setChartType(type)}
                  style={{ padding:4,borderRadius:5,border:"none",background:"transparent",cursor:"pointer",
                    color:chartType===type?"#475569":"#cbd5e1" }}>
                  <Ico size={13}/>
                </button>
              ))}
            </div>
            <div style={{ flex:1,minHeight:0,position:"relative" }}>
              {chartType==="bar"
                ? <Bar  data={{labels,datasets:finalDatasets}} options={makeOptions(maxVal,showLegend,16)}/>
                : <Line data={{labels,datasets:finalDatasets}} options={makeOptions(maxVal,showLegend,16)}/>}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",
          justifyContent:"center",gap:6,color:"#cbd5e1" }}>
          <FiBarChart2 size={26}/>
          <span style={{ fontSize:14,color:"#94a3b8" }}>No data — select a range and query</span>
        </div>
      )}
    </div>
  );
};

export default HourlyWidget;