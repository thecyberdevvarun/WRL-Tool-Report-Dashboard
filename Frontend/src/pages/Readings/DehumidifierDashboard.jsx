/**
 * UniversalMonitorDashboard.jsx
 *
 * Fully device-agnostic monitoring panel.
 * Meters, units, thresholds, gauges, chart toggles — all driven
 * dynamically from whatever the API returns per machine.
 *
 * Works for Dehumidifiers today, Chillers/AHUs/Compressors tomorrow —
 * zero code changes needed when new device types are added.
 *
 * API contract expected:
 *   GET /reading                          → [{ MachineId, MachineName, Status, LastUpdate, ...liveValues }]
 *   GET /reading/machine-summary?machineId → [{ MeterType, Unit, MaxActual, MinActual, SetValue }]
 *   GET /reading/machine-reading?machineId → [{ MeterType, ValueType, ActualValue, ReadingTime, ReadingTimeFull }]
 *   GET /reading/machine-meters?machineId  → [{ MeterType, Unit }]   ← optional fallback
 *
 * Threshold storage: { [machineId]: { [MeterType]: { min, max } } }
 * Persisted in localStorage so thresholds survive page refresh.
 */

import axios from "axios";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { baseURL } from "../../assets/assets";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";

import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, ReferenceLine,
} from "recharts";

import {
  FiX, FiClock, FiBell, FiAlertTriangle, FiCheckCircle,
  FiChevronDown, FiCalendar, FiWifiOff,
  FiFileText, FiActivity, FiDownload, FiLoader, FiSettings,
} from "react-icons/fi";

/* ═══════════════════════════════════════════════════════════
   FONTS
═══════════════════════════════════════════════════════════ */
(() => {
  const l = document.createElement("link");
  l.rel  = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap";
  document.head.appendChild(l);
})();

/* ═══════════════════════════════════════════════════════════
   METER COLOR PALETTE  (auto-assigned by index)
═══════════════════════════════════════════════════════════ */
const PALETTE = [
  { stroke:"#2563eb", fill:"#2563eb", light:"#dbeafe", badge:"#eff6ff", text:"#1d4ed8" },
  { stroke:"#f97316", fill:"#f97316", light:"#ffedd5", badge:"#fff7ed", text:"#c2410c" },
  { stroke:"#10b981", fill:"#10b981", light:"#d1fae5", badge:"#ecfdf5", text:"#047857" },
  { stroke:"#8b5cf6", fill:"#8b5cf6", light:"#ede9fe", badge:"#f5f3ff", text:"#6d28d9" },
  { stroke:"#f43f5e", fill:"#f43f5e", light:"#ffe4e6", badge:"#fff1f2", text:"#be123c" },
  { stroke:"#06b6d4", fill:"#06b6d4", light:"#cffafe", badge:"#ecfeff", text:"#0e7490" },
];
const meterColor = (idx) => PALETTE[idx % PALETTE.length];

/* ═══════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════ */
const getShiftStart = () => {
  const now = new Date();
  const t8  = new Date(); t8.setHours(8,0,0,0);
  const t20 = new Date(); t20.setHours(20,0,0,0);
  if (now >= t8 && now < t20) return t8;
  if (now < t8)               return new Date(t20 - 864e5);
  return t20;
};

const filterTrend = (trend, range) => {
  const now = new Date();
  let cutoff;
  if      (range === "shift")  cutoff = getShiftStart();
  else if (range === "today") { cutoff = new Date(); cutoff.setHours(0,0,0,0); }
  else if (range === "3days")  cutoff = new Date(now - 3 * 864e5);
  else                         cutoff = new Date(now - 7 * 864e5);
  return trend.filter(r => new Date(r.ReadingTimeFull) >= cutoff);
};

const fmt1 = v => (v != null ? Number(v).toFixed(1) : "--");

/* Fuzzy-match a MeterType name against the live object keys.
   Handles cases like MeterType="Temp" but live field="Temperature" */
const findLiveVal = (live, MeterType) => {
  const keys  = Object.keys(live);
  const mtL   = MeterType.toLowerCase();
  const match = keys.find(k => k === MeterType)
    ?? keys.find(k => k.toLowerCase() === mtL)
    ?? keys.find(k => k.toLowerCase().startsWith(mtL))
    ?? keys.find(k => mtL.startsWith(k.toLowerCase()) && k.length > 3)
    ?? keys.find(k => k.toLowerCase().includes(mtL) || mtL.includes(k.toLowerCase()));
  return match != null ? live[match] : null;
};

/*
  parseSummary — converts API array into map keyed by MeterType.
  Automatically extracts Unit if returned; falls back to empty string.
  [ { MeterType, Unit?, MaxActual, MinActual, SetValue } ]
  → { Humidity: { MaxActual, MinActual, SetValue, Unit }, Temp: {...}, ... }
*/
const parseSummary = (rows = []) => {
  const out = {};
  rows.forEach(r => {
    out[r.MeterType] = {
      MaxActual: r.MaxActual != null ? +r.MaxActual : null,
      MinActual: r.MinActual != null ? +r.MinActual : null,
      SetValue:  r.SetValue  != null ? +r.SetValue  : null,
      Unit:      r.Unit ?? "",
    };
  });
  return out;
};

/*
  groupTrend — converts raw reading rows into chart-friendly objects.
  Each object has: { time, ReadingTimeFull, [MeterType]_Actual, [MeterType]_Set, ... }
  Also extracts the meter list { MeterType, Unit } seen in the data.
*/
const groupTrend = (rows = []) => {
  const grouped = {};
  const meterSet = {}; // MeterType → Unit
  rows.forEach(r => {
    const k = r.ReadingTime;
    if (!grouped[k]) grouped[k] = { time: k, ReadingTimeFull: r.ReadingTimeFull };
    grouped[k][`${r.MeterType}_${r.ValueType}`] = +r.ActualValue;
    if (!meterSet[r.MeterType]) meterSet[r.MeterType] = r.Unit ?? "";
  });
  const meters = Object.entries(meterSet).map(([MeterType, Unit]) => ({ MeterType, Unit }));
  return { trend: Object.values(grouped), meters };
};

/* ─── Threshold localStorage persistence ─── */
const TH_KEY = "utilityMonitor_thresholds_v2";
const loadThresholds = () => {
  try { return JSON.parse(localStorage.getItem(TH_KEY)) ?? {}; } catch { return {}; }
};
const saveThresholds = (th) => {
  try { localStorage.setItem(TH_KEY, JSON.stringify(th)); } catch {}
};

/* ═══════════════════════════════════════════════════════════
   EXCEL / CSV EXPORT  (fully dynamic columns)
═══════════════════════════════════════════════════════════ */
const buildDynamicSummarySheet = (machines, summaryMap, metersMap) => {
  // Collect all unique meter types across all machines
  const allMeters = [...new Set(
    machines.flatMap(m => Object.keys(summaryMap[m.MachineId] ?? {}))
  )];

  const headers = ["Machine", "Status",
    ...allMeters.flatMap(mt => [`${mt} Min`, `${mt} Max`, `${mt} Set`]),
    "Generated At",
  ];
  const rows = machines.map(m => {
    const s = summaryMap[m.MachineId] ?? {};
    return [
      m.MachineName, m.Status ?? "",
      ...allMeters.flatMap(mt => [
        fmt1(s[mt]?.MinActual), fmt1(s[mt]?.MaxActual), fmt1(s[mt]?.SetValue),
      ]),
      new Date().toLocaleString(),
    ];
  });
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = [22, 12, ...allMeters.flatMap(() => [14,14,14]), 22].map(w => ({ wch: w }));
  return ws;
};

const buildDynamicTrendSheet = (machineName, trendRows, meters) => {
  const headers = ["Machine", "Time",
    ...meters.flatMap(m => [`${m.MeterType} Actual${m.Unit?` (${m.Unit})`:""}`, `${m.MeterType} Set${m.Unit?` (${m.Unit})`:""}`]),
  ];
  const rows = trendRows.map(r => [
    machineName, r.ReadingTimeFull ?? r.time,
    ...meters.flatMap(m => [r[`${m.MeterType}_Actual`]??"", r[`${m.MeterType}_Set`]??""]),
  ]);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = [22, 20, ...meters.flatMap(() => [16,16])].map(w => ({ wch: w }));
  return ws;
};

/* ═══════════════════════════════════════════════════════════
   ARC GAUGE  (generic — unit & color passed as props)
═══════════════════════════════════════════════════════════ */
const ArcGauge = ({ value, min=0, max=100, set, title, unit, color, alarm }) => {
  const safe  = v => (isNaN(v) || v == null) ? 0 : v;
  const pct   = Math.min(1, Math.max(0, (safe(value) - min) / (max - min)));
  const angle = -135 + pct * 270;
  const polar = (deg, r) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: 110 + r * Math.cos(rad), y: 110 + r * Math.sin(rad) };
  };
  const arc = (a1, a2, r) => {
    const s = polar(a1,r), e = polar(a2,r);
    return `M${s.x} ${s.y} A${r} ${r} 0 ${a2-a1>180?1:0} 1 ${e.x} ${e.y}`;
  };
  const dc = alarm ? "#ef4444" : color;
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
      <svg width="200" height="160" viewBox="0 0 220 170">
        <path d={arc(-135,135,74)} fill="none" stroke="#e5e7eb" strokeWidth="12" strokeLinecap="round"/>
        {pct > 0 && <path d={arc(-135,-135+pct*270,74)} fill="none" stroke={dc} strokeWidth="12"
          strokeLinecap="round" style={{ filter:`drop-shadow(0 2px 6px ${dc}55)` }}/>}
        {set != null && (() => {
          const sp = Math.min(1,Math.max(0,(set-min)/(max-min)));
          const sa = -135+sp*270;
          const i=polar(sa,62), o=polar(sa,88);
          return <line x1={i.x} y1={i.y} x2={o.x} y2={o.y} stroke="#f59e0b" strokeWidth="3" strokeLinecap="round"/>;
        })()}
        {(() => {
          const tip=polar(angle,58), b1=polar(angle+90,7), b2=polar(angle-90,7);
          return <polygon points={`${tip.x},${tip.y} ${b1.x},${b1.y} ${b2.x},${b2.y}`} fill={dc} opacity="0.85"/>;
        })()}
        <circle cx="110" cy="110" r="6" fill={dc}/>
        <text x="110" y="136" textAnchor="middle" fill={alarm?"#ef4444":"#111827"}
          fontSize="26" fontWeight="700" fontFamily="'Plus Jakarta Sans',sans-serif">
          {value != null ? Number(value).toFixed(1) : "--"}
        </text>
        <text x="110" y="153" textAnchor="middle" fill="#9ca3af"
          fontSize="11" fontFamily="'JetBrains Mono',monospace">{unit}</text>
      </svg>
      <p style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize:12, fontWeight:700,
        letterSpacing:"0.1em", color:alarm?"#ef4444":"#374151", marginTop:2, textTransform:"uppercase" }}>
        {title}
      </p>
      {set != null && (
        <p style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:"#d97706", marginTop:3 }}>
          SET: {Number(set).toFixed(1)} {unit}
        </p>
      )}
    </div>
  );
};

/* ─── Stat chip ─── */
const Chip = ({ label, value, unit, color }) => (
  <div style={{ background:"#f9fafb", border:"1px solid #e5e7eb", borderRadius:12,
    padding:"7px 12px", textAlign:"center", minWidth:72 }}>
    <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:8, color:"#9ca3af",
      letterSpacing:"0.15em", textTransform:"uppercase", marginBottom:3 }}>{label}</div>
    <div style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize:15, fontWeight:700, color }}>
      {value != null ? Number(value).toFixed(1) : "--"}
      <span style={{ fontSize:10, color:"#9ca3af", marginLeft:2 }}>{unit}</span>
    </div>
  </div>
);

/* ─── Status badge ─── */
const StatusBadge = ({ status }) => {
  const cfg = {
    NORMAL:  { bg:"#f0fdf4", color:"#15803d", border:"#bbf7d0", dot:"#22c55e" },
    WARNING: { bg:"#fffbeb", color:"#92400e", border:"#fde68a", dot:"#f59e0b" },
    ALARM:   { bg:"#fef2f2", color:"#991b1b", border:"#fecaca", dot:"#ef4444" },
    OFFLINE: { bg:"#f8fafc", color:"#475569", border:"#e2e8f0", dot:"#94a3b8" },
  };
  const c = cfg[status] ?? cfg.OFFLINE;
  return (
    <div style={{ display:"inline-flex", alignItems:"center", gap:5,
      background:c.bg, border:`1px solid ${c.border}`, borderRadius:20,
      padding:"3px 10px", marginTop:6 }}>
      <span style={{ width:6, height:6, borderRadius:"50%", background:c.dot, display:"inline-block" }}/>
      <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, color:c.color,
        letterSpacing:"0.15em", textTransform:"uppercase", fontWeight:600 }}>{status ?? "UNKNOWN"}</span>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   DYNAMIC THRESHOLD PANEL
   — shows one Min/Max row per meter, for the selected machine
═══════════════════════════════════════════════════════════ */
const ThresholdPanel = ({ meters, thresholds, onChange }) => {
  const [open, setOpen] = useState(false);
  // meters: [{ MeterType, Unit }]
  return (
    <div style={{ position:"relative" }}>
      <button onClick={() => setOpen(p => !p)} style={{
        display:"flex", alignItems:"center", gap:6,
        fontFamily:"'JetBrains Mono',monospace", fontSize:11, letterSpacing:"0.12em",
        textTransform:"uppercase", padding:"8px 16px", borderRadius:20,
        border:"1.5px solid #d97706", color:"#d97706", background:"#fffbeb", cursor:"pointer",
      }}>
        <FiBell/> Thresholds
        <FiChevronDown style={{ transition:".2s", transform:open?"rotate(180deg)":"none" }}/>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-8 }}
            style={{ position:"absolute", right:0, top:"calc(100% + 8px)", zIndex:300,
              background:"white", border:"1px solid #e5e7eb", borderRadius:16, padding:20,
              boxShadow:"0 12px 40px rgba(0,0,0,0.12)", minWidth:300 }}>

            {meters.length === 0 && (
              <p style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:"#94a3b8",
                textAlign:"center", letterSpacing:"0.1em" }}>
                SELECT A MACHINE FIRST
              </p>
            )}

            {meters.map(({ MeterType, Unit }, idx) => {
              const c = meterColor(idx);
              const th = thresholds[MeterType] ?? { min:"", max:"" };
              return (
                <div key={MeterType} style={{ marginBottom:14 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
                    <span style={{ width:8, height:8, borderRadius:"50%",
                      background:c.stroke, display:"inline-block" }}/>
                    <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10,
                      color:"#374151", letterSpacing:"0.12em", textTransform:"uppercase", fontWeight:600 }}>
                      {MeterType} {Unit ? `(${Unit})` : ""}
                    </span>
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                    {["min","max"].map(bound => (
                      <div key={bound}>
                        <label style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:8,
                          color:"#9ca3af", letterSpacing:"0.15em", textTransform:"uppercase",
                          display:"block", marginBottom:3 }}>{bound}</label>
                        <input type="number" value={th[bound] ?? ""}
                          placeholder={bound === "min" ? "e.g. 20" : "e.g. 80"}
                          onChange={e => onChange(MeterType, bound, e.target.value === "" ? "" : +e.target.value)}
                          style={{ width:"100%", padding:"5px 8px", borderRadius:8,
                            border:`1px solid ${c.stroke}44`,
                            fontFamily:"'JetBrains Mono',monospace", fontSize:13, outline:"none",
                            boxSizing:"border-box" }}/>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {meters.length > 0 && (
              <p style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, color:"#94a3b8",
                letterSpacing:"0.1em", marginTop:8, borderTop:"1px solid #f1f5f9", paddingTop:8 }}>
                THRESHOLDS SAVED AUTOMATICALLY PER MACHINE
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ─── Date range filter ─── */
const DateFilter = ({ value, onChange }) => (
  <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
    <FiCalendar style={{ color:"#6b7280", flexShrink:0 }}/>
    {[{k:"shift",l:"Shift"},{k:"today",l:"Today"},{k:"3days",l:"3 Days"},{k:"week",l:"Week"}].map(({k,l}) => (
      <button key={k} onClick={() => onChange(k)} style={{
        fontFamily:"'JetBrains Mono',monospace", fontSize:10, letterSpacing:"0.15em",
        textTransform:"uppercase", padding:"5px 14px", borderRadius:20, cursor:"pointer", transition:"all .2s",
        background: value===k?"#2563eb":"transparent",
        color:      value===k?"white":"#6b7280",
        border:     value===k?"1.5px solid #2563eb":"1.5px solid #d1d5db",
        fontWeight: value===k?700:400,
      }}>{l}</button>
    ))}
  </div>
);

/* ─── Custom chart tooltip ─── */
const ChartTooltip = ({ active, payload, label, meters }) => {
  if (!active || !payload?.length) return null;
  const visible = payload.filter(p => p.value != null);
  if (!visible.length) return null;
  return (
    <div style={{ background:"white", border:"1px solid #e5e7eb", borderRadius:14,
      padding:"12px 16px", boxShadow:"0 8px 32px rgba(0,0,0,0.12)",
      fontFamily:"'JetBrains Mono',monospace", fontSize:11, minWidth:180 }}>
      <p style={{ color:"#94a3b8", marginBottom:8, fontSize:10 }}>{label}</p>
      {visible.map(p => {
        const meterType = p.dataKey.replace("_Actual","").replace("_Set","");
        const m = meters.find(x => x.MeterType === meterType);
        return (
          <div key={p.dataKey} style={{ display:"flex", alignItems:"center",
            justifyContent:"space-between", gap:16, marginBottom:5 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ width:8, height:8, borderRadius:"50%",
                background:p.color, display:"inline-block", flexShrink:0 }}/>
              <span style={{ color:"#64748b" }}>{p.name}</span>
            </div>
            <span style={{ fontWeight:700, color:p.color }}>
              {Number(p.value).toFixed(1)}
              <span style={{ color:"#94a3b8", fontWeight:400 }}> {m?.Unit ?? ""}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   TREND CHART  — fully dynamic meter lines + toggles
═══════════════════════════════════════════════════════════ */
const TrendChart = ({ data, meters, summary, dateRange, onDateRangeChange, loading }) => {
  // Default: all Actual lines ON, all Set lines OFF
  const [visible, setVisible] = useState({});

  // Sync visible state when meters change (new machine selected)
  useEffect(() => {
    if (!meters.length) return;
    setVisible(prev => {
      const next = {};
      meters.forEach(m => {
        next[`${m.MeterType}_Actual`] = prev[`${m.MeterType}_Actual`] ?? true;
        next[`${m.MeterType}_Set`]    = prev[`${m.MeterType}_Set`]    ?? false;
      });
      return next;
    });
  }, [meters.map(m=>m.MeterType).join(",")]);

  const toggle = key => setVisible(p => ({ ...p, [key]: !p[key] }));
  const filtered = filterTrend(data, dateRange);
  const tickInterval = Math.max(1, Math.floor((filtered.length || 1) / 10));

  // Build gradient IDs per meter
  const gradients = meters.map((m, idx) => {
    const c = meterColor(idx);
    return { id:`grad_${m.MeterType}`, color:c.stroke };
  });

  return (
    <div style={{ background:"#f8fafc", border:"1.5px solid #e2e8f0", borderRadius:20, padding:"24px 20px" }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
        marginBottom:18, flexWrap:"wrap", gap:12 }}>
        <h3 style={{ fontWeight:700, fontSize:15, letterSpacing:"0.1em",
          color:"#0f172a", textTransform:"uppercase", margin:0 }}>
          Trend Analysis
        </h3>
        <DateFilter value={dateRange} onChange={onDateRangeChange}/>
      </div>

      {/* Toggle pills — one per Actual + Set per meter */}
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:18 }}>
        {meters.map((m, idx) => {
          const c = meterColor(idx);
          return (
            <div key={m.MeterType} style={{ display:"flex", gap:6 }}>
              {/* Actual toggle */}
              <button onClick={() => toggle(`${m.MeterType}_Actual`)} style={{
                display:"flex", alignItems:"center", gap:6,
                fontFamily:"'JetBrains Mono',monospace", fontSize:10,
                letterSpacing:"0.1em", textTransform:"uppercase",
                padding:"5px 12px", borderRadius:20, cursor:"pointer", transition:"all .2s",
                background:  visible[`${m.MeterType}_Actual`] ? c.stroke+"18" : "transparent",
                color:       visible[`${m.MeterType}_Actual`] ? c.stroke       : "#9ca3af",
                border:      `1.5px solid ${visible[`${m.MeterType}_Actual`] ? c.stroke : "#e2e8f0"}`,
                fontWeight:  visible[`${m.MeterType}_Actual`] ? 700 : 400,
              }}>
                <span style={{ width:7, height:7, borderRadius:"50%",
                  background: visible[`${m.MeterType}_Actual`] ? c.stroke : "#d1d5db",
                  display:"inline-block" }}/>
                {m.MeterType} {m.Unit ? `(${m.Unit})` : ""}
              </button>
              {/* Set toggle — smaller/muted */}
              <button onClick={() => toggle(`${m.MeterType}_Set`)} style={{
                display:"flex", alignItems:"center", gap:5,
                fontFamily:"'JetBrains Mono',monospace", fontSize:9,
                letterSpacing:"0.1em", textTransform:"uppercase",
                padding:"4px 10px", borderRadius:20, cursor:"pointer", transition:"all .2s",
                background:  visible[`${m.MeterType}_Set`] ? c.stroke+"10" : "transparent",
                color:       visible[`${m.MeterType}_Set`] ? c.stroke       : "#cbd5e1",
                border:      `1px dashed ${visible[`${m.MeterType}_Set`] ? c.stroke+"88" : "#e2e8f0"}`,
              }}>
                {m.MeterType} Set
              </button>
            </div>
          );
        })}
      </div>

      {/* Chart */}
      {loading ? (
        <div style={{ height:300, display:"flex", alignItems:"center", justifyContent:"center",
          fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:"#94a3b8", letterSpacing:"0.12em",
          flexDirection:"column", gap:10 }}>
          <FiLoader style={{ fontSize:22, animation:"spin 1s linear infinite" }}/>
          LOADING DATA…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ height:300, display:"flex", alignItems:"center", justifyContent:"center",
          fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:"#94a3b8", letterSpacing:"0.12em" }}>
          NO DATA FOR SELECTED RANGE
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={filtered} margin={{ top:8, right:16, left:0, bottom:4 }}>
            <defs>
              {gradients.map(g => (
                <linearGradient key={g.id} id={g.id} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={g.color} stopOpacity={0.16}/>
                  <stop offset="95%" stopColor={g.color} stopOpacity={0}/>
                </linearGradient>
              ))}
            </defs>

            <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" vertical={false}/>
            <XAxis dataKey="time" interval={tickInterval}
              tick={{ fill:"#94a3b8", fontFamily:"'JetBrains Mono',monospace", fontSize:10 }}
              axisLine={{ stroke:"#e2e8f0" }} tickLine={false}/>
            <YAxis tick={{ fill:"#94a3b8", fontFamily:"'JetBrains Mono',monospace", fontSize:10 }}
              axisLine={false} tickLine={false} width={36}/>
            <Tooltip content={<ChartTooltip meters={meters}/>}
              cursor={{ stroke:"#e2e8f0", strokeWidth:1.5 }}/>

            {/* Set-point reference lines — only when actual is visible */}
            {meters.map((m, idx) => {
              const c = meterColor(idx);
              const sv = summary[m.MeterType]?.SetValue;
              return visible[`${m.MeterType}_Actual`] && sv != null ? (
                <ReferenceLine key={`ref_${m.MeterType}`} y={sv}
                  stroke={c.stroke} strokeOpacity={0.35} strokeDasharray="6 4"
                  label={{ value:`${m.MeterType} SET ${fmt1(sv)}${m.Unit?"  "+m.Unit:""}`,
                    fill:c.stroke, fontSize:9,
                    fontFamily:"'JetBrains Mono',monospace", position:"insideTopRight" }}/>
              ) : null;
            })}

            {/* Areas — one Actual + one Set per meter, rendered only when toggled */}
            {meters.flatMap((m, idx) => {
              const c = meterColor(idx);
              const areas = [];
              if (visible[`${m.MeterType}_Actual`]) {
                areas.push(
                  <Area key={`${m.MeterType}_Actual`}
                    type="monotoneX" dataKey={`${m.MeterType}_Actual`}
                    name={`${m.MeterType}`}
                    stroke={c.stroke} strokeWidth={2.5}
                    fill={`url(#grad_${m.MeterType})`}
                    dot={false} activeDot={{ r:5, fill:c.stroke, strokeWidth:0 }}/>
                );
              }
              if (visible[`${m.MeterType}_Set`]) {
                areas.push(
                  <Area key={`${m.MeterType}_Set`}
                    type="monotoneX" dataKey={`${m.MeterType}_Set`}
                    name={`${m.MeterType} Set`}
                    stroke={c.stroke} strokeWidth={1.5} strokeDasharray="5 4"
                    fill="none" strokeOpacity={0.5}
                    dot={false} activeDot={{ r:4, fill:c.stroke, strokeWidth:0 }}/>
                );
              }
              return areas;
            })}
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   REPORT TAB  — fully dynamic columns
═══════════════════════════════════════════════════════════ */
const ReportTab = ({ machines }) => {
  const [reportMachineId, setReportMachineId] = useState("all");
  const [reportRange,     setReportRange]     = useState("shift");
  const [reportType,      setReportType]      = useState("summary");
  const [summaryMap,      setSummaryMap]      = useState({});
  const [rawMap,          setRawMap]          = useState({});
  const [metersMap,       setMetersMap]       = useState({});
  const [loadingIds,      setLoadingIds]      = useState(new Set());

  const fetchSummary = useCallback(async (machineId) => {
    if (summaryMap[machineId]) return;
    setLoadingIds(p => new Set([...p, machineId]));
    try {
      const res = await axios.get(`${baseURL}reading/machine-summary`, { params:{ machineId } });
      const parsed = parseSummary(res.data.data ?? []);
      setSummaryMap(p => ({ ...p, [machineId]: parsed }));
      // Extract meters from summary rows
      const meters = (res.data.data ?? []).map(r => ({ MeterType:r.MeterType, Unit:r.Unit??""  }));
      if (meters.length) setMetersMap(p => ({ ...p, [machineId]: meters }));
    } catch(e) {}
    finally { setLoadingIds(p => { const n=new Set(p); n.delete(machineId); return n; }); }
  }, [summaryMap]);

  const fetchRaw = useCallback(async (machineId) => {
    if (rawMap[machineId]) return;
    setLoadingIds(p => new Set([...p, machineId]));
    try {
      const res = await axios.get(`${baseURL}reading/machine-reading`, { params:{ machineId } });
      const { trend, meters } = groupTrend(res.data.data ?? []);
      setRawMap(p => ({ ...p, [machineId]: trend }));
      if (meters.length) setMetersMap(p => ({ ...p, [machineId]: meters }));
    } catch(e) {}
    finally { setLoadingIds(p => { const n=new Set(p); n.delete(machineId); return n; }); }
  }, [rawMap]);

  useEffect(() => {
    const ids = reportMachineId === "all" ? machines.map(m => m.MachineId) : [+reportMachineId];
    ids.forEach(id => {
      if (reportType === "summary") fetchSummary(id);
      else                          fetchRaw(id);
    });
  }, [reportMachineId, reportType, machines.length]);

  const targetMachines = reportMachineId === "all"
    ? machines
    : machines.filter(m => m.MachineId == reportMachineId);

  const isLoading = targetMachines.some(m => loadingIds.has(m.MachineId));

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    if (reportType === "summary") {
      const ws = buildDynamicSummarySheet(targetMachines, summaryMap, metersMap);
      XLSX.utils.book_append_sheet(wb, ws, "Shift Summary");
    } else {
      targetMachines.forEach(m => {
        const raw    = rawMap[m.MachineId] ?? [];
        const meters = metersMap[m.MachineId] ?? [];
        const ws     = buildDynamicTrendSheet(m.MachineName, filterTrend(raw, reportRange), meters);
        XLSX.utils.book_append_sheet(wb, ws, m.MachineName.slice(0,31));
      });
    }
    const label = reportMachineId==="all" ? "All" : targetMachines[0]?.MachineName ?? "Machine";
    const type  = reportType==="summary" ? "Summary" : "Raw";
    XLSX.writeFile(wb, `Monitor_${type}_${label}_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const exportCSV = () => {
    let ws;
    if (reportType === "summary") {
      ws = buildDynamicSummarySheet(targetMachines, summaryMap, metersMap);
    } else {
      const allMeters = [...new Set(targetMachines.flatMap(m => (metersMap[m.MachineId]??[]).map(x=>x.MeterType)))]
        .map(mt => ({ MeterType:mt, Unit: metersMap[targetMachines[0]?.MachineId]?.find(x=>x.MeterType===mt)?.Unit??"" }));
      const allRows = targetMachines.flatMap(m =>
        filterTrend(rawMap[m.MachineId]??[], reportRange).map(r => [
          m.MachineName, r.ReadingTimeFull??r.time,
          ...allMeters.flatMap(mt => [r[`${mt.MeterType}_Actual`]??"", r[`${mt.MeterType}_Set`]??""]),
        ])
      );
      ws = XLSX.utils.aoa_to_sheet([
        ["Machine","Time",...allMeters.flatMap(m=>[`${m.MeterType} Actual`,`${m.MeterType} Set`])],
        ...allRows,
      ]);
    }
    const csv  = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type:"text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a"); a.href=url;
    a.download = `Monitor_${reportType}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  // Preview rows
  const summaryPreviewRows = targetMachines.map(m => ({
    name: m.MachineName, status: m.Status,
    summary: summaryMap[m.MachineId] ?? {},
    meters:  metersMap[m.MachineId]  ?? [],
  }));

  const allPreviewMeters = useMemo(() => {
    const seen = {};
    targetMachines.forEach(m => (metersMap[m.MachineId]??[]).forEach(mt => { seen[mt.MeterType]=mt; }));
    return Object.values(seen);
  }, [targetMachines, metersMap]);

  const rawPreviewRows = reportMachineId !== "all"
    ? filterTrend(rawMap[reportMachineId]??[], reportRange).slice(-50)
    : [];
  const rawPreviewMeters = metersMap[reportMachineId] ?? [];

  const labelStyle = { fontFamily:"'JetBrains Mono',monospace", fontSize:9, color:"#9ca3af", letterSpacing:"0.15em", textTransform:"uppercase" };
  const tdStyle    = { padding:"10px 14px", fontSize:13, color:"#374151", verticalAlign:"middle", textAlign:"center" };

  return (
    <div>
      {/* Controls */}
      <div style={{ display:"flex", flexWrap:"wrap", gap:14, alignItems:"flex-end", marginBottom:22,
        background:"white", border:"1.5px solid #e2e8f0", borderRadius:16, padding:"16px 20px" }}>

        <div>
          <label style={labelStyle}>Report Type</label>
          <div style={{ display:"flex", gap:8, marginTop:6 }}>
            {[{k:"summary",l:"Shift Summary"},{k:"raw",l:"Raw Readings"}].map(({k,l})=>(
              <button key={k} onClick={()=>setReportType(k)} style={{
                fontFamily:"'JetBrains Mono',monospace", fontSize:10, letterSpacing:"0.12em",
                textTransform:"uppercase", padding:"6px 14px", borderRadius:20, cursor:"pointer",
                background:reportType===k?"#0f172a":"transparent",
                color:reportType===k?"white":"#6b7280",
                border:reportType===k?"1.5px solid #0f172a":"1.5px solid #d1d5db",
                fontWeight:reportType===k?700:400,
              }}>{l}</button>
            ))}
          </div>
        </div>

        <div>
          <label style={labelStyle}>Machine</label>
          <select value={reportMachineId} onChange={e=>setReportMachineId(e.target.value)}
            style={{ display:"block", marginTop:6, padding:"7px 12px", borderRadius:10,
              border:"1.5px solid #d1d5db", fontFamily:"'JetBrains Mono',monospace",
              fontSize:11, color:"#374151", outline:"none", background:"white", cursor:"pointer" }}>
            <option value="all">All Machines</option>
            {machines.map(m => <option key={m.MachineId} value={m.MachineId}>{m.MachineName}</option>)}
          </select>
        </div>

        {reportType === "raw" && (
          <div>
            <label style={labelStyle}>Date Range</label>
            <div style={{ display:"flex", gap:8, marginTop:6 }}>
              {[{k:"shift",l:"Shift"},{k:"today",l:"Today"},{k:"3days",l:"3 Days"},{k:"week",l:"Week"}].map(({k,l})=>(
                <button key={k} onClick={()=>setReportRange(k)} style={{
                  fontFamily:"'JetBrains Mono',monospace", fontSize:10, letterSpacing:"0.12em",
                  textTransform:"uppercase", padding:"6px 14px", borderRadius:20, cursor:"pointer",
                  background:reportRange===k?"#2563eb":"transparent",
                  color:reportRange===k?"white":"#6b7280",
                  border:reportRange===k?"1.5px solid #2563eb":"1.5px solid #d1d5db",
                  fontWeight:reportRange===k?700:400,
                }}>{l}</button>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginLeft:"auto", display:"flex", gap:10 }}>
          {[{label:"Excel",icon:"xlsx",fn:exportExcel},{label:"CSV",icon:"csv",fn:exportCSV}].map(({label,icon,fn})=>(
            <button key={icon} onClick={fn} disabled={isLoading} style={{
              display:"flex", alignItems:"center", gap:7,
              fontFamily:"'JetBrains Mono',monospace", fontSize:11, letterSpacing:"0.12em",
              textTransform:"uppercase", padding:"9px 18px", borderRadius:20,
              border: icon==="xlsx"?"1.5px solid #16a34a":"1.5px solid #2563eb",
              color:  icon==="xlsx"?"#16a34a":"#2563eb",
              background: icon==="xlsx"?"#f0fdf4":"#eff6ff",
              cursor:isLoading?"not-allowed":"pointer", opacity:isLoading?0.5:1,
            }}>
              <FiDownload/> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Preview */}
      {isLoading ? (
        <div style={{ background:"#f8fafc", border:"1.5px solid #e2e8f0", borderRadius:16,
          height:180, display:"flex", alignItems:"center", justifyContent:"center",
          fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:"#94a3b8",
          letterSpacing:"0.12em", flexDirection:"column", gap:10 }}>
          <FiLoader style={{ fontSize:22, animation:"spin 1s linear infinite" }}/>
          FETCHING REPORT DATA…
        </div>
      ) : reportType === "summary" ? (
        /* Dynamic summary table */
        <div style={{ background:"white", border:"1.5px solid #e2e8f0", borderRadius:16, overflow:"hidden" }}>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
              <thead>
                <tr style={{ background:"#f8fafc", borderBottom:"2px solid #e2e8f0" }}>
                  <th style={{ ...tdStyle, fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:"#6b7280", letterSpacing:"0.15em", textTransform:"uppercase", textAlign:"center" }}>Machine</th>
                  <th style={{ ...tdStyle, fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:"#6b7280", letterSpacing:"0.15em", textTransform:"uppercase", textAlign:"center" }}>Status</th>
                  {allPreviewMeters.flatMap((m, idx) => {
                    const c = meterColor(idx);
                    return [
                      <th key={`${m.MeterType}_min`} style={{ ...tdStyle, fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:c.text, letterSpacing:"0.12em", textTransform:"uppercase" }}>
                        {m.MeterType} Min {m.Unit?`(${m.Unit})`:""}
                      </th>,
                      <th key={`${m.MeterType}_max`} style={{ ...tdStyle, fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:c.text, letterSpacing:"0.12em", textTransform:"uppercase" }}>
                        {m.MeterType} Max {m.Unit?`(${m.Unit})`:""}
                      </th>,
                      <th key={`${m.MeterType}_set`} style={{ ...tdStyle, fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:"#d97706", letterSpacing:"0.12em", textTransform:"uppercase" }}>
                        {m.MeterType} Set
                      </th>,
                    ];
                  })}
                </tr>
              </thead>
              <tbody>
                {summaryPreviewRows.map((r, i) => (
                  <tr key={r.name} style={{ borderBottom:"1px solid #f1f5f9", background:i%2===0?"white":"#fafafa" }}>
                    <td style={{ ...tdStyle, fontWeight:700, color:"#0f172a", textAlign:"left" }}>{r.name}</td>
                    <td style={tdStyle}><StatusBadge status={r.status}/></td>
                    {allPreviewMeters.flatMap((m, idx) => {
                      const c = meterColor(idx);
                      const s = r.summary[m.MeterType] ?? {};
                      return [
                        <td key={`${m.MeterType}_min`} style={{ ...tdStyle, fontFamily:"'JetBrains Mono',monospace", color:c.text }}>{fmt1(s.MinActual)}</td>,
                        <td key={`${m.MeterType}_max`} style={{ ...tdStyle, fontFamily:"'JetBrains Mono',monospace", color:c.text }}>{fmt1(s.MaxActual)}</td>,
                        <td key={`${m.MeterType}_set`} style={{ ...tdStyle, fontFamily:"'JetBrains Mono',monospace", color:"#d97706" }}>{fmt1(s.SetValue)}</td>,
                      ];
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding:"10px 16px", borderTop:"1px solid #f1f5f9",
            fontFamily:"'JetBrains Mono',monospace", fontSize:9, color:"#94a3b8", letterSpacing:"0.12em" }}>
            SHIFT SUMMARY · {summaryPreviewRows.length} MACHINE{summaryPreviewRows.length!==1?"S":""} · {new Date().toLocaleString()}
          </div>
        </div>
      ) : reportMachineId === "all" ? (
        <div style={{ background:"#f8fafc", border:"1.5px solid #e2e8f0", borderRadius:16,
          padding:24, textAlign:"center", fontFamily:"'JetBrains Mono',monospace",
          fontSize:12, color:"#94a3b8", letterSpacing:"0.12em" }}>
          SELECT A SPECIFIC MACHINE TO PREVIEW RAW READINGS
          <p style={{ marginTop:6, fontSize:10 }}>All machines will be included in the export.</p>
        </div>
      ) : rawPreviewRows.length === 0 ? (
        <div style={{ background:"#f8fafc", border:"1.5px solid #e2e8f0", borderRadius:16,
          padding:40, textAlign:"center", fontFamily:"'JetBrains Mono',monospace",
          fontSize:12, color:"#94a3b8", letterSpacing:"0.12em" }}>
          NO DATA FOR SELECTED RANGE
        </div>
      ) : (
        /* Dynamic raw readings table */
        <div style={{ background:"white", border:"1.5px solid #e2e8f0", borderRadius:16, overflow:"hidden" }}>
          <div style={{ padding:"14px 18px", borderBottom:"1px solid #f1f5f9",
            display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11,
              color:"#374151", letterSpacing:"0.1em", fontWeight:600 }}>
              {targetMachines[0]?.MachineName} — RAW READINGS
            </span>
            <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, color:"#94a3b8" }}>
              PREVIEW: LAST {rawPreviewRows.length} ROWS
            </span>
          </div>
          <div style={{ overflowX:"auto", maxHeight:400, overflowY:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse",
              fontFamily:"'JetBrains Mono',monospace", fontSize:12 }}>
              <thead style={{ position:"sticky", top:0 }}>
                <tr style={{ background:"#f8fafc", borderBottom:"2px solid #e2e8f0" }}>
                  <th style={{ ...tdStyle, fontSize:10, color:"#6b7280", letterSpacing:"0.15em", textTransform:"uppercase" }}>Time</th>
                  {rawPreviewMeters.flatMap((m, idx) => {
                    const c = meterColor(idx);
                    return [
                      <th key={`${m.MeterType}_a`} style={{ ...tdStyle, fontSize:10, color:c.text, letterSpacing:"0.12em", textTransform:"uppercase" }}>
                        {m.MeterType} {m.Unit?`(${m.Unit})`:""}
                      </th>,
                      <th key={`${m.MeterType}_s`} style={{ ...tdStyle, fontSize:10, color:"#94a3b8", letterSpacing:"0.12em", textTransform:"uppercase" }}>
                        {m.MeterType} Set
                      </th>,
                    ];
                  })}
                </tr>
              </thead>
              <tbody>
                {rawPreviewRows.map((r, i) => (
                  <tr key={i} style={{ borderBottom:"1px solid #f1f5f9", background:i%2===0?"white":"#fafafa" }}>
                    <td style={tdStyle}>{r.ReadingTimeFull ?? r.time}</td>
                    {rawPreviewMeters.flatMap((m, idx) => {
                      const c = meterColor(idx);
                      return [
                        <td key={`${m.MeterType}_a`} style={{ ...tdStyle, color:c.text }}>
                          {r[`${m.MeterType}_Actual`] != null ? Number(r[`${m.MeterType}_Actual`]).toFixed(2) : "--"}
                        </td>,
                        <td key={`${m.MeterType}_s`} style={{ ...tdStyle, color:"#94a3b8" }}>
                          {r[`${m.MeterType}_Set`] != null ? Number(r[`${m.MeterType}_Set`]).toFixed(2) : "--"}
                        </td>,
                      ];
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   MAIN DASHBOARD
═══════════════════════════════════════════════════════════ */
export default function UniversalMonitorDashboard() {
  const [activeTab,  setActiveTab]  = useState("monitor");
  const [machines,   setMachines]   = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [trend,      setTrend]      = useState([]);
  const [meters,     setMeters]     = useState([]); // [{ MeterType, Unit }]
  const [summary,    setSummary]    = useState({});  // { [MeterType]: { Min/Max/Set/Unit } }
  const [live,       setLive]       = useState({});
  const [thresholds, setThresholds] = useState(loadThresholds()); // { [machineId]: { [MeterType]: { min, max } } }
  const [alarms,     setAlarms]     = useState([]);
  const [dismissed,  setDismissed]  = useState(false);
  const [dateRange,  setDateRange]  = useState("shift");
  const [loading,    setLoading]    = useState(false);
  const prevAlarmKey = useRef("");

  /* ── Threshold helpers ── */
  const getMachineTH   = useCallback((machineId) => thresholds[machineId] ?? {}, [thresholds]);
  const getMeterTH     = useCallback((machineId, meterType) => getMachineTH(machineId)[meterType] ?? {}, [getMachineTH]);
  const setMeterTH     = useCallback((machineId, meterType, bound, value) => {
    setThresholds(prev => {
      const next = {
        ...prev,
        [machineId]: {
          ...(prev[machineId] ?? {}),
          [meterType]: {
            ...(prev[machineId]?.[meterType] ?? {}),
            [bound]: value,
          },
        },
      };
      saveThresholds(next);
      return next;
    });
  }, []);

  /* ── 1. Poll machine list ── */
  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get(`${baseURL}reading`);
        if (res.data.success) setMachines(res.data.data);
      } catch(e) {}
    };
    load();
    const iv = setInterval(load, 5000);
    return () => clearInterval(iv);
  }, []);

  /* ── 2. Load selected machine data ── */
  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    setSummary({}); setTrend([]); setMeters([]);

    const loadLive = async () => {
      try {
        const res = await axios.get(`${baseURL}reading`);
        const m = res.data.data?.find(x => x.MachineId == selectedId);
        if (m) setLive(m);
      } catch(e) {}
    };

    const loadTrend = async () => {
      try {
        const res = await axios.get(`${baseURL}reading/machine-reading`, { params:{ machineId:selectedId } });
        const { trend: t, meters: m } = groupTrend(res.data.data ?? []);
        setTrend(t);
        if (m.length) setMeters(m);
      } catch(e) {}
    };

    const loadSummary = async () => {
      try {
        const res = await axios.get(`${baseURL}reading/machine-summary`, { params:{ machineId:selectedId } });
        const parsed = parseSummary(res.data.data ?? []);
        setSummary(parsed);
        // Extract meters from summary if not yet populated from trend
        const m = (res.data.data ?? []).map(r => ({ MeterType:r.MeterType, Unit:r.Unit??"" }));
        setMeters(prev => prev.length ? prev : m);
      } catch(e) {}
      finally { setLoading(false); }
    };


    loadLive(); loadTrend(); loadSummary();
    const iv = setInterval(() => { loadLive(); loadTrend(); loadSummary(); }, 10000);
    return () => clearInterval(iv);
  }, [selectedId]);

  /* ── 3. Dynamic alarm detection ── */
  useEffect(() => {
    if (!selectedId || !meters.length) return;
    const machineTH = getMachineTH(selectedId);
    const active = [];
    meters.forEach(({ MeterType, Unit }) => {
      const th  = machineTH[MeterType] ?? {};
      const val = findLiveVal(live, MeterType);
      if (val == null) return;
      if (th.min !== "" && th.min != null && +val < +th.min)
        active.push({ id:`${MeterType}_low`,  msg:`${MeterType} LOW (${fmt1(val)}${Unit})` });
      if (th.max !== "" && th.max != null && +val > +th.max)
        active.push({ id:`${MeterType}_high`, msg:`${MeterType} HIGH (${fmt1(val)}${Unit})` });
    });
    const key = active.map(a=>a.id).join(",");
    if (key !== prevAlarmKey.current) { setDismissed(false); prevAlarmKey.current = key; }
    setAlarms(active);
  }, [live, thresholds, meters, selectedId]);

  /* ── Derived ── */
  const visibleAlarms   = dismissed ? [] : alarms;
  const machineTH       = selectedId ? getMachineTH(selectedId) : {};
  const currentMeters   = meters; // what's loaded for selected machine

  /* Card-level alarm: check each machine's live values against its own thresholds */
  const cardAlarm = (m) => {
    if (m.Status === "ALARM" || m.Status === "WARNING") return true;
    // Check any known meter key in the live object
    return false; // extended check done per-meter once meters are fetched
  };

  /* Gauge scale helper */
  const gaugeRange = (meterType) => {
    const s = summary[meterType];
    const gMin = s?.MinActual != null ? s.MinActual * 0.85 : 0;
    const gMax = s?.MaxActual != null ? s.MaxActual * 1.15 : 100;
    return { gMin, gMax };
  };

  /* Is a specific meter in alarm? */
  const meterInAlarm = (meterType) =>
    alarms.some(a => a.id.startsWith(meterType));

  /* ══ RENDER ══ */
  return (
    <div style={{
      fontFamily:"'Plus Jakarta Sans',sans-serif", minHeight:"100vh",
      background:"linear-gradient(135deg,#f0f4ff 0%,#f8fafc 60%,#f0f9ff 100%)",
      padding:"28px 28px 60px",
    }}>
      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>

      {/* ── Alarm banner ── */}
      <AnimatePresence>
        {visibleAlarms.length > 0 && (
          <motion.div initial={{ y:-60, opacity:0 }} animate={{ y:0, opacity:1 }} exit={{ y:-60, opacity:0 }}
            style={{ position:"fixed", top:0, left:0, right:0, zIndex:999,
              background:"linear-gradient(90deg,#dc2626,#ea580c,#dc2626)",
              color:"white", padding:"12px 24px",
              display:"flex", alignItems:"center", justifyContent:"space-between",
              fontFamily:"'JetBrains Mono',monospace", fontSize:12, letterSpacing:"0.12em",
              boxShadow:"0 4px 20px rgba(220,38,38,0.35)" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <FiAlertTriangle style={{ fontSize:18 }}/>
              <span>{visibleAlarms.length} ALARM{visibleAlarms.length>1?"S":""} — {visibleAlarms.map(a=>a.msg).join(" · ")}</span>
            </div>
            <button onClick={() => setDismissed(true)}
              style={{ background:"none", border:"none", color:"white", cursor:"pointer", fontSize:20 }}>
              <FiX/>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ paddingTop:(visibleAlarms.length>0&&!dismissed)?52:0, transition:"padding .3s" }}>

        {/* ── Header ── */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
          marginBottom:28, flexWrap:"wrap", gap:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:5, height:44, borderRadius:3,
              background:"linear-gradient(180deg,#2563eb,#7c3aed)" }}/>
            <div>
              <h1 style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:800, fontSize:26,
                letterSpacing:"0.08em", color:"#0f172a", margin:0, textTransform:"uppercase" }}>
                Utility Monitoring Panel
              </h1>
              <p style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:"#94a3b8",
                letterSpacing:"0.18em", marginTop:3, textTransform:"uppercase" }}>
                Universal Device Monitor · Live
              </p>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:12, position:"relative", zIndex:100 }}>
            <div style={{ display:"flex", alignItems:"center", gap:7, padding:"7px 16px",
              background:"white", border:"1px solid #e2e8f0", borderRadius:20,
              fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:"#64748b" }}>
              <span style={{ width:8, height:8, borderRadius:"50%", background:"#22c55e",
                boxShadow:"0 0 0 3px rgba(34,197,94,.2)", display:"inline-block" }}/>
              LIVE
            </div>
            {/* Threshold panel — scoped to selected machine's actual meters */}
            <ThresholdPanel
              meters={currentMeters}
              thresholds={machineTH}
              onChange={(meterType, bound, value) => setMeterTH(selectedId ?? "__global", meterType, bound, value)}
            />
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display:"flex", gap:4, marginBottom:24,
          background:"white", border:"1.5px solid #e2e8f0", borderRadius:16,
          padding:6, width:"fit-content" }}>
          {[
            { key:"monitor", label:"Monitor", icon:<FiActivity style={{ fontSize:14 }}/> },
            { key:"reports", label:"Reports", icon:<FiFileText style={{ fontSize:14 }}/> },
          ].map(({ key, label, icon }) => (
            <button key={key} onClick={() => setActiveTab(key)} style={{
              display:"flex", alignItems:"center", gap:7,
              fontFamily:"'JetBrains Mono',monospace", fontSize:11, letterSpacing:"0.12em",
              textTransform:"uppercase", padding:"9px 20px", borderRadius:12,
              border:"none", cursor:"pointer", transition:"all .2s",
              background: activeTab===key?"#0f172a":"transparent",
              color:       activeTab===key?"white":"#6b7280",
              fontWeight:  activeTab===key?700:400,
            }}>
              {icon} {label}
            </button>
          ))}
        </div>

        {/* ══ TAB: MONITOR ══ */}
        {activeTab === "monitor" && (
          <>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(210px, 1fr))", gap:18 }}>
              {machines.map((m, i) => {
                const hasAlarm  = cardAlarm(m);
                const isOffline = m.Status === "OFFLINE";
                return (
                  <motion.div key={m.MachineId}
                    initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:i*0.06 }}
                    onClick={() => !isOffline && setSelectedId(m.MachineId)}
                    whileHover={!isOffline ? { y:-3, boxShadow: hasAlarm
                      ?"0 12px 32px rgba(220,38,38,.18)":"0 12px 32px rgba(37,99,235,.14)" } : {}}
                    style={{ background:"white",
                      border:hasAlarm?"1.5px solid #fca5a5":"1.5px solid #e2e8f0",
                      borderRadius:20, padding:"20px 18px",
                      cursor:isOffline?"not-allowed":"pointer",
                      position:"relative", overflow:"hidden", opacity:isOffline?0.6:1,
                      boxShadow:hasAlarm?"0 4px 14px rgba(220,38,38,.10)":"0 2px 8px rgba(0,0,0,.05)",
                      transition:"box-shadow .2s" }}>

                    <div style={{ position:"absolute", top:0, left:0, right:0, height:4,
                      borderRadius:"20px 20px 0 0",
                      background:isOffline?"#e2e8f0":hasAlarm
                        ?"linear-gradient(90deg,#ef4444,#f97316)"
                        :"linear-gradient(90deg,#2563eb,#7c3aed)" }}/>

                    {hasAlarm&&!isOffline&&<span style={{ position:"absolute", top:12, right:12, color:"#ef4444" }}><FiAlertTriangle style={{ fontSize:16 }}/></span>}
                    {isOffline&&<span style={{ position:"absolute", top:12, right:12, color:"#94a3b8" }}><FiWifiOff style={{ fontSize:16 }}/></span>}

                    <h2 style={{ fontWeight:700, fontSize:13, letterSpacing:"0.06em",
                      color:"#1e293b", textAlign:"center", margin:"10px 0 4px", textTransform:"uppercase" }}>
                      {m.MachineName}
                    </h2>
                    <div style={{ display:"flex", justifyContent:"center", marginBottom:14 }}>
                      <StatusBadge status={m.Status}/>
                    </div>

                    {/* Live values — dynamic: show any numeric field that isn't an ID/name/status/time */}
                    {Object.entries(m)
                      .filter(([k]) => !["MachineId","MachineName","Status","LastUpdate"].includes(k))
                      .filter(([, v]) => v != null && !isNaN(+v))
                      .map(([key, val], idx) => {
                        const c = meterColor(idx);
                        return (
                          <div key={key} style={{ marginBottom:9 }}>
                            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10,
                                color:c.stroke, letterSpacing:"0.12em", textTransform:"uppercase" }}>
                                {key}
                              </span>
                              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontWeight:600, fontSize:13, color:"#0f172a" }}>
                                {Number(val).toFixed(1)}
                              </span>
                            </div>
                            <div style={{ height:4, background:"#f1f5f9", borderRadius:2, overflow:"hidden" }}>
                              <motion.div initial={{ width:0 }}
                                animate={{ width:`${Math.min(100, Math.abs(+val))}%` }}
                                transition={{ duration:1, ease:"easeOut" }}
                                style={{ height:"100%", borderRadius:2, background:c.stroke }}/>
                            </div>
                          </div>
                        );
                      })}

                    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:4,
                      fontFamily:"'JetBrains Mono',monospace", fontSize:9, color:"#94a3b8",
                      letterSpacing:"0.12em", marginTop:10 }}>
                      <FiClock/> {m.LastUpdate}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* ── Modal ── */}
            <AnimatePresence>
              {selectedId && (
                <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                  style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.5)",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    zIndex:50, backdropFilter:"blur(6px)" }}>
                  <motion.div initial={{ scale:.95, y:24 }} animate={{ scale:1, y:0 }}
                    exit={{ scale:.95, y:24 }} transition={{ type:"spring", stiffness:280, damping:24 }}
                    style={{ background:"white", borderRadius:28, width:"95%", maxWidth:1200,
                      maxHeight:"93vh", overflowY:"auto", padding:"36px 32px",
                      position:"relative", boxShadow:"0 32px 100px rgba(0,0,0,0.20)" }}>

                    {/* Close */}
                    <button onClick={()=>{ setSelectedId(null); setLive({}); setSummary({}); setTrend([]); setMeters([]); }}
                      style={{ position:"absolute", top:22, right:22, width:36, height:36,
                        borderRadius:"50%", border:"1.5px solid #fecaca", background:"#fff5f5",
                        display:"flex", alignItems:"center", justifyContent:"center",
                        color:"#ef4444", cursor:"pointer", fontSize:18 }}>
                      <FiX/>
                    </button>

                    {/* Title */}
                    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20 }}>
                      <div style={{ width:4, height:28, borderRadius:2,
                        background:"linear-gradient(180deg,#2563eb,#7c3aed)" }}/>
                      <div>
                        <h2 style={{ fontWeight:800, fontSize:20, letterSpacing:"0.1em",
                          color:"#0f172a", textTransform:"uppercase", margin:0 }}>
                          Control Panel
                        </h2>
                        <p style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11,
                          color:"#2563eb", letterSpacing:"0.18em", marginTop:2 }}>
                          {live.MachineName ?? "Loading…"}
                          {meters.length > 0 && (
                            <span style={{ color:"#94a3b8", marginLeft:8 }}>
                              · {meters.map(m=>m.MeterType).join(" · ")}
                            </span>
                          )}
                        </p>
                      </div>
                      {live.Status && <div style={{ marginLeft:8 }}><StatusBadge status={live.Status}/></div>}
                    </div>

                    {/* Alarm / nominal bar */}
                    {alarms.length > 0 ? (
                      <div style={{ background:"#fef2f2", border:"1px solid #fecaca",
                        borderRadius:12, padding:"10px 18px", marginBottom:22,
                        display:"flex", alignItems:"center", gap:8 }}>
                        <FiAlertTriangle style={{ color:"#ef4444", flexShrink:0 }}/>
                        <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11,
                          color:"#dc2626", letterSpacing:"0.08em" }}>
                          {alarms.map(a=>a.msg).join(" · ")}
                        </span>
                      </div>
                    ) : (
                      <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0",
                        borderRadius:12, padding:"10px 18px", marginBottom:22,
                        display:"flex", alignItems:"center", gap:8 }}>
                        <FiCheckCircle style={{ color:"#22c55e", flexShrink:0 }}/>
                        <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11,
                          color:"#15803d", letterSpacing:"0.08em" }}>
                          ALL VALUES NOMINAL
                        </span>
                      </div>
                    )}

                    {/* ── Dynamic gauges ── */}
                    {loading ? (
                      <div style={{ height:200, display:"flex", alignItems:"center", justifyContent:"center",
                        fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:"#94a3b8",
                        letterSpacing:"0.12em", flexDirection:"column", gap:10 }}>
                        <FiLoader style={{ fontSize:22, animation:"spin 1s linear infinite" }}/>
                        LOADING…
                      </div>
                    ) : (
                      <div style={{
                        display:"grid",
                        gridTemplateColumns:`repeat(auto-fill, minmax(240px, 1fr))`,
                        gap:18, marginBottom:24,
                      }}>
                        {meters.map(({ MeterType, Unit }, idx) => {
                          const c      = meterColor(idx);
                          const s      = summary[MeterType] ?? {};
                          const { gMin, gMax } = gaugeRange(MeterType);
                          const inAlarm = meterInAlarm(MeterType);
                          const liveVal = findLiveVal(live, MeterType);
                          return (
                            <div key={MeterType} style={{
                              background: inAlarm?"#fff5f5":"#f8fafc",
                              border: inAlarm?"1.5px solid #fecaca":"1.5px solid #e2e8f0",
                              borderRadius:20, padding:"24px 16px",
                              display:"flex", flexDirection:"column", alignItems:"center",
                              boxShadow: inAlarm
                                ?"0 4px 20px rgba(239,68,68,.10)"
                                :"0 2px 8px rgba(0,0,0,.04)",
                            }}>
                              <ArcGauge
                                title={MeterType} unit={Unit} value={liveVal}
                                set={s.SetValue} min={gMin} max={gMax}
                                color={c.stroke} alarm={inAlarm}
                              />
                              <div style={{ display:"flex", gap:8, marginTop:14,
                                justifyContent:"center", flexWrap:"wrap" }}>
                                <Chip label="Shift Min" value={s.MinActual} unit={Unit} color={c.stroke}/>
                                <Chip label="Shift Max" value={s.MaxActual} unit={Unit} color={c.stroke}/>
                                {s.SetValue != null && <Chip label="Set Point" value={s.SetValue} unit={Unit} color="#d97706"/>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* ── Chart ── */}
                    <TrendChart
                      data={trend}
                      meters={meters}
                      summary={summary}
                      dateRange={dateRange}
                      onDateRangeChange={setDateRange}
                      loading={loading}
                    />

                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {/* ══ TAB: REPORTS ══ */}
        {activeTab === "reports" && (
          <ReportTab machines={machines}/>
        )}

      </div>
    </div>
  );
}