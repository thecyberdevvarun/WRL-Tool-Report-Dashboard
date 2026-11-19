/**
 * HourlyWidget.jsx — Hourly Production Widget
 *
 * Props:
 *   title            — widget heading
 *   data             — hourly rows  { HOUR_NUMBER, TIMEHOUR, COUNT }
 *                      (or category rows { category, TotalCount } when isCategoryChart)
 *   modelData        — model-level rows for overlay panels
 *   datasets         — [{ key, label, color }]
 *   isCategoryChart  — renders CategoryWidget instead
 *   icon             — optional icon component
 *   elapsedHours     — selected duration in hours (used for Actual UPH)
 */

import { useState, useMemo } from "react";
import { Bar, Line } from "react-chartjs-2";
import {
  FiDownload,
  FiX,
  FiBarChart2,
  FiTrendingUp,
  FiSun,
  FiMoon,
  FiZap,
} from "react-icons/fi";
import {
  MdSchedule,
  MdLeaderboard,
  MdBarChart,
  MdShowChart,
  MdFunctions,
} from "react-icons/md";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
} from "chart.js";

ChartJS.register(
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
);

// ─── Constants ────────────────────────────────────────────────────────────────
const DAY_COLOR = "rgba(14,165,233,0.75)";
const NIGHT_COLOR = "rgba(139,92,246,0.65)";
const AVG_COLOR = "rgba(234,88,12,0.85)";

const MODEL_COLORS = [
  "#0ea5e9",
  "#f97316",
  "#14b8a6",
  "#8b5cf6",
  "#f59e0b",
  "#ec4899",
  "#22c55e",
  "#ef4444",
  "#6366f1",
  "#84cc16",
];

// ⚠ SUS target is a placeholder (15, taken from the FG Label SUS target). Confirm it.
const CATEGORY_TARGET_UPH = {
  Freezer: 87,
  Chocolate: 52,
  "Visi Cooler": 80,
  SUS: 16,
};

const CATEGORY_COLORS = {
  Freezer: "rgba(14,165,233,0.75)",
  Chocolate: "rgba(245,158,11,0.75)",
  "Visi Cooler": "rgba(20,184,166,0.75)",
  SUS: "rgba(100,116,139,0.70)",
};

const achievedColor = (p) =>
  p >= 100 ? "#16a34a" : p >= 80 ? "#d97706" : "#dc2626";

// Day shift: 07:00–18:59 → day; 19:00–06:59 → night
const DAY_START = 7;
const DAY_END = 19;
const isDay = (h) => h >= DAY_START && h < DAY_END;

const heatBg = (frac) => {
  if (frac >= 0.85) return "rgba(14,165,233,0.08)";
  if (frac >= 0.65) return "rgba(20,184,166,0.06)";
  if (frac >= 0.4) return "rgba(250,204,21,0.05)";
  return "";
};

const downloadCSV = (rows, filename) => {
  const csv = rows.map((r) => r.join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
};

// ─── Chart option factories ───────────────────────────────────────────────────
const makeOptions = (maxVal, showLegend, fs = 9) => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 220 },
  plugins: {
    legend: {
      display: showLegend,
      position: "top",
      labels: {
        font: { size: fs, weight: "bold", family: "inherit" },
        boxWidth: 7,
        padding: 6,
        color: "#64748b",
      },
    },
    tooltip: {
      backgroundColor: "#0f172a",
      titleColor: "#94a3b8",
      bodyColor: "#f1f5f9",
      padding: 8,
      callbacks: {
        label: (ctx) =>
          `  ${ctx.dataset.label}: ${ctx.parsed.y?.toLocaleString() ?? ""}`,
      },
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      max: maxVal + Math.max(Math.ceil(maxVal * 0.18), 5),
      border: { display: false },
      grid: { color: "rgba(0,0,0,0.04)" },
      ticks: {
        font: { size: fs, weight: "bold", family: "monospace" },
        color: "#94a3b8",
        callback: (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v),
        maxTicksLimit: 5,
      },
    },
    x: {
      border: { display: false },
      grid: { display: false },
      ticks: {
        font: { size: fs, weight: "bold" },
        color: "#94a3b8",
        maxRotation: 0,
      },
    },
  },
});

const makeStackedOptions = () => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 220 },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: "#0f172a",
      titleColor: "#94a3b8",
      bodyColor: "#f1f5f9",
      padding: 8,
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      stacked: true,
      border: { display: false },
      grid: { color: "rgba(0,0,0,0.04)" },
      ticks: {
        font: { size: 9, family: "monospace" },
        color: "#94a3b8",
        callback: (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v),
        maxTicksLimit: 4,
      },
    },
    x: {
      stacked: true,
      border: { display: false },
      grid: { display: false },
      ticks: { font: { size: 9 }, color: "#94a3b8", maxRotation: 0 },
    },
  },
});

const makeHorizOptions = (maxVal) => ({
  indexAxis: "y",
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 220 },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: "#0f172a",
      titleColor: "#94a3b8",
      bodyColor: "#f1f5f9",
      padding: 8,
    },
  },
  scales: {
    x: {
      beginAtZero: true,
      max: maxVal + Math.max(Math.ceil(maxVal * 0.18), 5),
      border: { display: false },
      grid: { color: "rgba(0,0,0,0.04)" },
      ticks: {
        font: { size: 9, family: "monospace" },
        color: "#94a3b8",
        maxTicksLimit: 5,
      },
    },
    y: {
      border: { display: false },
      grid: { display: false },
      ticks: { font: { size: 9 }, color: "#475569" },
    },
  },
});

// ─── Shared small styles ──────────────────────────────────────────────────────
const closeBtnStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 24,
  height: 24,
  borderRadius: 6,
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  color: "#64748b",
  cursor: "pointer",
};

const csvBtnStyle = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  padding: "3px 8px",
  border: "1px solid #e2e8f0",
  borderRadius: 6,
  background: "#f8fafc",
  color: "#475569",
  cursor: "pointer",
  fontSize: 10,
  fontWeight: 600,
};

// ─── HourlyModelPanel ─────────────────────────────────────────────────────────
const HourlyModelPanel = ({ modelData, onClose }) => {
  const flatRows = useMemo(
    () =>
      [...modelData].sort(
        (a, b) =>
          a.TIMEHOUR - b.TIMEHOUR ||
          (b.Model_Count || 0) - (a.Model_Count || 0),
      ),
    [modelData],
  );
  const grandTotal = flatRows.reduce((s, r) => s + (r.Model_Count || 0), 0);

  const topModels = useMemo(() => {
    const map = {};
    for (const item of modelData) {
      if (!map[item.MatCode])
        map[item.MatCode] = {
          MatCode: item.MatCode,
          Name: item.Name || item.MatCode,
          Total: 0,
        };
      map[item.MatCode].Total += item.Model_Count || 0;
    }
    return Object.values(map)
      .sort((a, b) => b.Total - a.Total)
      .slice(0, 10);
  }, [modelData]);

  const hours = useMemo(
    () => [...new Set(modelData.map((d) => d.TIMEHOUR))].sort((a, b) => a - b),
    [modelData],
  );

  const lookup = useMemo(() => {
    const m = {};
    for (const item of modelData) {
      if (!m[item.TIMEHOUR]) m[item.TIMEHOUR] = {};
      m[item.TIMEHOUR][item.MatCode] =
        (m[item.TIMEHOUR][item.MatCode] || 0) + (item.Model_Count || 0);
    }
    return m;
  }, [modelData]);

  const chartDatasets = topModels.map((model, i) => ({
    label: model.Name.length > 14 ? model.Name.slice(0, 12) + "…" : model.Name,
    data: hours.map((h) => lookup[h]?.[model.MatCode] || 0),
    backgroundColor: MODEL_COLORS[i % MODEL_COLORS.length],
    borderWidth: 0,
    borderRadius: 2,
    stack: "s",
  }));

  const modelColorMap = useMemo(() => {
    const map = {};
    topModels.forEach((m, i) => {
      map[m.MatCode] = MODEL_COLORS[i % MODEL_COLORS.length];
    });
    return map;
  }, [topModels]);

  const exportCSV = () =>
    downloadCSV(
      [
        ["Time", "Model Name", "Count"],
        ...flatRows.map((r) => [
          `${r.TIMEHOUR}:00`,
          r.Name || r.MatCode,
          r.Model_Count || 0,
        ]),
      ],
      `hourly_model_${Date.now()}.csv`,
    );

  const thStyle = {
    padding: "8px 16px",
    fontWeight: 700,
    color: "#64748b",
    borderBottom: "2px solid #e2e8f0",
  };

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        fontWeight: 400,
        zIndex: 10,
        background: "#fff",
        borderRadius: 12,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: 36,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 12px",
          borderBottom: "1px solid #e2e8f0",
          background: "#f8fafc",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <MdSchedule size={13} color="#0ea5e9" />
          <span style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>
            Model-wise Hourly Breakdown
          </span>
          <span style={{ fontSize: 10, color: "#94a3b8" }}>
            {flatRows.length} rows · {grandTotal.toLocaleString()} units
          </span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={exportCSV} style={csvBtnStyle}>
            <FiDownload size={11} /> CSV
          </button>
          <button onClick={onClose} style={closeBtnStyle}>
            <FiX size={13} />
          </button>
        </div>
      </div>

      <div
        style={{
          height: 100,
          flexShrink: 0,
          padding: "5px 12px 3px",
          borderBottom: "1px solid #f1f5f9",
          background: "#fafbfc",
        }}
      >
        <Bar
          data={{
            labels: hours.map((h) => `${h}:00`),
            datasets: chartDatasets,
          }}
          options={makeStackedOptions()}
        />
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <table
          style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}
        >
          <thead>
            <tr
              style={{
                position: "sticky",
                top: 0,
                zIndex: 2,
                background: "#f8fafc",
              }}
            >
              <th style={{ ...thStyle, textAlign: "left", width: 80 }}>Time</th>
              <th style={{ ...thStyle, textAlign: "left" }}>Model</th>
              <th style={{ ...thStyle, textAlign: "right", width: 80 }}>
                Count
              </th>
            </tr>
          </thead>
          <tbody>
            {flatRows.map((row, i) => {
              const color = modelColorMap[row.MatCode] || "#94a3b8";
              const isNewHour =
                i === 0 || flatRows[i - 1].TIMEHOUR !== row.TIMEHOUR;
              return (
                <tr
                  key={i}
                  style={{
                    borderBottom: "1px solid #f1f5f9",
                    borderTop:
                      isNewHour && i > 0 ? "1px solid #e2e8f0" : undefined,
                    background: isNewHour ? "rgba(14,165,233,0.03)" : "#fff",
                  }}
                >
                  <td
                    style={{
                      padding: "7px 16px",
                      fontFamily: "monospace",
                      fontWeight: 700,
                      fontSize: 11,
                      color: isDay(row.TIMEHOUR) ? "#0ea5e9" : "#8b5cf6",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {isNewHour ? `${row.TIMEHOUR}:00` : ""}
                  </td>
                  <td
                    style={{
                      padding: "7px 16px",
                      color: "#334155",
                      fontSize: 11,
                    }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: color,
                          flexShrink: 0,
                        }}
                      />
                      {row.Name || row.MatCode}
                    </div>
                  </td>
                  <td
                    style={{
                      padding: "7px 16px",
                      textAlign: "right",
                      fontFamily: "monospace",
                      fontWeight: 700,
                      color,
                    }}
                  >
                    {(row.Model_Count || 0).toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div
        style={{
          height: 32,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          borderTop: "2px solid #e2e8f0",
          background: "#f8fafc",
        }}
      >
        <span
          style={{
            fontSize: 10,
            color: "#94a3b8",
            fontWeight: 700,
            textTransform: "uppercase",
          }}
        >
          Total
        </span>
        <span
          style={{
            fontFamily: "monospace",
            fontSize: 12,
            fontWeight: 700,
            color: "#1e293b",
          }}
        >
          {grandTotal.toLocaleString()}
        </span>
      </div>
    </div>
  );
};

// ─── TotalModelPanel ──────────────────────────────────────────────────────────
const TotalModelPanel = ({ modelData, onClose }) => {
  const modelTotals = useMemo(() => {
    const map = {};
    for (const item of modelData) {
      if (!map[item.MatCode])
        map[item.MatCode] = {
          MatCode: item.MatCode,
          Name: item.Name || item.MatCode,
          Total: 0,
        };
      map[item.MatCode].Total += item.Model_Count || 0;
    }
    return Object.values(map).sort((a, b) => b.Total - a.Total);
  }, [modelData]);

  const grandTotal = modelTotals.reduce((s, m) => s + m.Total, 0);
  const maxVal = modelTotals[0]?.Total || 0;

  const exportCSV = () =>
    downloadCSV(
      [
        ["#", "MatCode", "Name", "Count", "%"],
        ...modelTotals.map((m, i) => [
          i + 1,
          m.MatCode,
          m.Name,
          m.Total,
          grandTotal > 0
            ? ((m.Total / grandTotal) * 100).toFixed(1) + "%"
            : "0%",
        ]),
      ],
      `total_model_${Date.now()}.csv`,
    );

  const chartH = Math.max(160, modelTotals.length * 24);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        fontWeight: 400,
        zIndex: 10,
        background: "#fff",
        borderRadius: 12,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: 36,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 12px",
          borderBottom: "1px solid #e2e8f0",
          background: "#f8fafc",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <MdLeaderboard size={13} color="#14b8a6" />
          <span style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>
            Total Model Summary
          </span>
          <span
            style={{
              fontSize: 10,
              background: "#f0fdfa",
              color: "#0d9488",
              border: "1px solid #99f6e4",
              borderRadius: 5,
              padding: "1px 7px",
              fontWeight: 700,
            }}
          >
            {modelTotals.length} models · {grandTotal.toLocaleString()} units
          </span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={exportCSV} style={csvBtnStyle}>
            <FiDownload size={11} /> CSV
          </button>
          <button onClick={onClose} style={closeBtnStyle}>
            <FiX size={13} />
          </button>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
        <div
          style={{
            width: "48%",
            display: "flex",
            flexDirection: "column",
            borderRight: "1px solid #f1f5f9",
            overflow: "hidden",
          }}
        >
          <div style={{ flex: 1, overflowY: "auto" }}>
            <table
              style={{
                width: "100%",
                fontSize: 11,
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr
                  style={{
                    position: "sticky",
                    top: 0,
                    background: "#f8fafc",
                    zIndex: 1,
                  }}
                >
                  {["#", "Model", "Count", "Share"].map((h, i) => (
                    <th
                      key={h}
                      style={{
                        padding: "6px 8px",
                        textAlign: i >= 2 ? "right" : "left",
                        color: "#94a3b8",
                        fontWeight: 600,
                        borderBottom: "1px solid #f1f5f9",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {modelTotals.map((model, i) => {
                  const pct =
                    grandTotal > 0
                      ? ((model.Total / grandTotal) * 100).toFixed(1)
                      : "0.0";
                  const frac = model.Total / Math.max(maxVal, 1);
                  const color = MODEL_COLORS[i % MODEL_COLORS.length];
                  return (
                    <tr
                      key={i}
                      style={{
                        borderBottom: "1px solid #f8fafc",
                        background: heatBg(frac),
                      }}
                    >
                      <td
                        style={{
                          padding: "5px 8px",
                          color: "#cbd5e1",
                          fontFamily: "monospace",
                        }}
                      >
                        {i + 1}
                      </td>
                      <td style={{ padding: "5px 8px", maxWidth: 140 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                          }}
                        >
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              flexShrink: 0,
                              background: color,
                            }}
                          />
                          <span
                            style={{
                              color: "#475569",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              fontSize: 10.5,
                            }}
                            title={model.Name}
                          >
                            {model.Name}
                          </span>
                        </div>
                      </td>
                      <td
                        style={{
                          padding: "5px 8px",
                          textAlign: "right",
                          fontFamily: "monospace",
                          fontWeight: 700,
                          color,
                        }}
                      >
                        {model.Total.toLocaleString()}
                      </td>
                      <td
                        style={{
                          padding: "5px 8px",
                          textAlign: "right",
                          fontFamily: "monospace",
                          color: "#94a3b8",
                          fontSize: 10,
                        }}
                      >
                        {pct}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div
            style={{
              height: 28,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 10px",
              borderTop: "1px solid #e2e8f0",
              background: "#f8fafc",
            }}
          >
            <span
              style={{
                fontSize: 10,
                color: "#94a3b8",
                fontWeight: 700,
                textTransform: "uppercase",
              }}
            >
              Total
            </span>
            <span
              style={{
                fontFamily: "monospace",
                fontWeight: 700,
                fontSize: 12,
                color: "#1e293b",
              }}
            >
              {grandTotal.toLocaleString()}
            </span>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            minWidth: 0,
            overflowY: "auto",
            padding: "8px 10px",
          }}
        >
          <div style={{ height: chartH, minHeight: "100%" }}>
            <Bar
              data={{
                labels: modelTotals.map((m) =>
                  m.Name.length > 18 ? m.Name.slice(0, 16) + "…" : m.Name,
                ),
                datasets: [
                  {
                    label: "Count",
                    data: modelTotals.map((m) => m.Total),
                    backgroundColor: modelTotals.map(
                      (_, i) => MODEL_COLORS[i % MODEL_COLORS.length],
                    ),
                    borderWidth: 0,
                    borderRadius: 3,
                  },
                ],
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
// Columns: Category | Units Produced | Target UPH | Actual UPH | Achieved %
//   Actual UPH = Units Produced ÷ elapsed hours
//   Achieved % = Actual UPH ÷ Target UPH × 100
const CATEGORY_HEADERS = [
  "#",
  "Category",
  "Units Produced",
  "Target UPH",
  "Actual UPH",
  "Achieved %",
];

const CategoryWidget = ({ title, data = [], icon: Icon, elapsedHours = 0 }) => {
  const hours = Number(elapsedHours) > 0 ? Number(elapsedHours) : 0;
  const total = data.reduce((s, r) => s + (Number(r.TotalCount) || 0), 0);

  const getRowMetrics = (row) => {
    const count = Number(row.TotalCount) || 0;
    const targetUPH = CATEGORY_TARGET_UPH[row.category] ?? 0;
    const rawUPH = hours > 0 ? count / hours : 0;
    return {
      count,
      targetUPH,
      actualUPH: Math.round(rawUPH),
      achieved: targetUPH > 0 ? Math.round((rawUPH / targetUPH) * 100) : 0,
    };
  };

  const exportCSV = () => {
    if (!data.length) return;
    downloadCSV(
      [
        CATEGORY_HEADERS.slice(1),
        ...data.map((r) => {
          const m = getRowMetrics(r);
          return [
            r.category,
            m.count,
            m.targetUPH,
            m.actualUPH,
            `${m.achieved}%`,
          ];
        }),
      ],
      `${title.replace(/\s+/g, "_")}_${Date.now()}.csv`,
    );
  };

  const chartOptions = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 220 },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#0f172a",
        titleColor: "#94a3b8",
        bodyColor: "#f1f5f9",
        padding: 8,
        callbacks: {
          label: (ctx) => `  ${ctx.parsed.x.toLocaleString()} units`,
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        border: { display: false },
        grid: { color: "rgba(0,0,0,0.04)" },
        ticks: {
          font: { size: 16, weight: "bold", family: "monospace" },
          color: "#94a3b8",
          maxTicksLimit: 5,
        },
      },
      y: {
        border: { display: false },
        grid: { display: false },
        ticks: { font: { size: 16, weight: "bold" }, color: "#475569" },
      },
    },
  };

  const th = {
    padding: "6px 8px",
    color: "#94a3b8",
    fontWeight: 700,
    borderBottom: "1px solid #f1f5f9",
  };
  const td = {
    padding: "6px 8px",
    textAlign: "center",
    fontFamily: "monospace",
    fontWeight: 700,
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "#fff",
        borderRadius: 12,
        border: "1px solid #e2e8f0",
        overflow: "hidden",
        fontWeight: 700,
      }}
    >
      <div
        style={{
          height: 36,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 12px",
          borderBottom: "1px solid #f1f5f9",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {Icon && <Icon size={13} color="#64748b" />}
          <span style={{ fontSize: 19, fontWeight: 700, color: "#475569" }}>
            {title}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontFamily: "monospace",
              fontSize: 20,
              fontWeight: 700,
              color: "#1e293b",
            }}
          >
            {total.toLocaleString()}
          </span>
          <button
            onClick={exportCSV}
            title="Export CSV"
            style={{
              display: "flex",
              alignItems: "center",
              padding: 4,
              borderRadius: 6,
              border: "1px solid #f1f5f9",
              background: "transparent",
              color: "#cbd5e1",
              cursor: "pointer",
            }}
          >
            <FiDownload size={13} />
          </button>
        </div>
      </div>

      {data.length > 0 ? (
        <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
          <div
            style={{
              width: "55%",
              overflowY: "auto",
              borderRight: "1px solid #f1f5f9",
            }}
          >
            <table
              style={{
                width: "100%",
                fontSize: 17,
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr
                  style={{
                    position: "sticky",
                    top: 0,
                    background: "#f8fafc",
                    zIndex: 1,
                  }}
                >
                  {CATEGORY_HEADERS.map((h, i) => (
                    <th
                      key={h}
                      style={{ ...th, textAlign: i >= 2 ? "center" : "left" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => {
                  const m = getRowMetrics(row);
                  return (
                    <tr
                      key={row.category}
                      style={{ borderBottom: "1px solid #f8fafc" }}
                    >
                      <td
                        style={{
                          padding: "6px 8px",
                          color: "#cbd5e1",
                          fontFamily: "monospace",
                        }}
                      >
                        {i + 1}
                      </td>
                      <td style={{ padding: "6px 8px", color: "#475569" }}>
                        <span
                          style={{
                            display: "inline-block",
                            width: 10,
                            height: 10,
                            borderRadius: 3,
                            marginRight: 8,
                            background: CATEGORY_COLORS[row.category],
                          }}
                        />
                        {row.category}
                      </td>
                      <td style={{ ...td, color: "#1e293b" }}>
                        {m.count.toLocaleString()}
                      </td>
                      <td style={{ ...td, color: "#64748b" }}>{m.targetUPH}</td>
                      <td style={{ ...td, color: "#0f766e" }}>{m.actualUPH}</td>
                      <td style={{ ...td, color: achievedColor(m.achieved) }}>
                        {m.achieved}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ flex: 1, padding: "10px 12px", minWidth: 0 }}>
            <Bar
              data={{
                labels: data.map((r) => r.category),
                datasets: [
                  {
                    label: "Units Produced",
                    data: data.map((r) => r.TotalCount || 0),
                    backgroundColor: data.map(
                      (r) => CATEGORY_COLORS[r.category],
                    ),
                    borderWidth: 0,
                    borderRadius: 3,
                  },
                ],
              }}
              options={chartOptions}
            />
          </div>
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            color: "#cbd5e1",
          }}
        >
          <FiBarChart2 size={26} />
          <span style={{ fontSize: 12, color: "#94a3b8" }}>
            No data — select a range and query
          </span>
        </div>
      )}
    </div>
  );
};

// ─── Main HourlyWidget ────────────────────────────────────────────────────────
const HourlyWidget = ({
  title,
  data = [],
  modelData = [],
  datasets = [],
  isCategoryChart = false,
  icon: Icon,
  elapsedHours = 0,
}) => {
  const [chartType, setChartType] = useState("bar");
  const [showCumul, setShowCumul] = useState(false);
  // null | "hourly" | "total"
  const [activePanel, setActivePanel] = useState(null);

  const hasModelData = modelData?.length > 0;

  // ── Derived production ────────────────────────────────────────────────────
  const total = useMemo(
    () =>
      datasets.reduce(
        (s, ds) => s + data.reduce((r, row) => r + (row[ds.key] || 0), 0),
        0,
      ),
    [data, datasets],
  );
  const rowTotals = useMemo(
    () =>
      data.map((row) => datasets.reduce((s, ds) => s + (row[ds.key] || 0), 0)),
    [data, datasets],
  );
  const maxRowVal = rowTotals.length > 0 ? Math.max(...rowTotals, 0) : 0;
  const peakIdx =
    rowTotals.length > 0 ? rowTotals.indexOf(Math.max(...rowTotals, 0)) : -1;
  const peakRow = peakIdx >= 0 ? data[peakIdx] : null;
  const avgPerRow = data.length > 0 ? Math.round(total / data.length) : 0;
  const cumulative = useMemo(() => {
    let c = 0;
    return rowTotals.map((v) => (c += v));
  }, [rowTotals]);
  const shiftTotals = useMemo(
    () =>
      data.reduce(
        (acc, row, i) => {
          const h = row.TIMEHOUR ?? -1;
          if (h >= DAY_START && h < DAY_END) acc.day += rowTotals[i];
          else acc.night += rowTotals[i];
          return acc;
        },
        { day: 0, night: 0 },
      ),
    [data, rowTotals],
  );
  const dayPct = total > 0 ? Math.round((shiftTotals.day / total) * 100) : 0;

  if (isCategoryChart) {
    return (
      <CategoryWidget
        title={title}
        data={data}
        icon={Icon}
        elapsedHours={elapsedHours}
      />
    );
  }

  // ── CSV export ────────────────────────────────────────────────────────────
  const exportCSV = () => {
    if (!data.length) return;
    const headers = [
      "Hr#",
      "Time",
      ...datasets.map((d) => d.label),
      ...(datasets.length > 1 ? ["Total"] : []),
      "%",
      ...(showCumul ? ["Cumulative"] : []),
    ];
    const rows = data.map((row, i) => [
      row.HOUR_NUMBER || row.HourNumber || i + 1,
      `${row.TIMEHOUR ?? ""}:00`,
      ...datasets.map((d) => row[d.key] || 0),
      ...(datasets.length > 1 ? [rowTotals[i]] : []),
      total > 0 ? ((rowTotals[i] / total) * 100).toFixed(1) + "%" : "0%",
      ...(showCumul ? [cumulative[i]] : []),
    ]);
    downloadCSV(
      [headers, ...rows],
      `${title.replace(/\s+/g, "_")}_${Date.now()}.csv`,
    );
  };

  // ── Chart data ────────────────────────────────────────────────────────────
  const labels = data.map((r) => `${r.TIMEHOUR ?? "?"}:00`);
  const allVals = datasets.flatMap((ds) => data.map((r) => r[ds.key] || 0));
  const maxVal = Math.max(...(allVals.length ? allVals : [0]), avgPerRow, 0);

  const shiftColor = (r) => (isDay(r.TIMEHOUR ?? -1) ? DAY_COLOR : NIGHT_COLOR);

  const chartDatasets = datasets.map((ds) => ({
    label: ds.label,
    data: data.map((r) => r[ds.key] || 0),
    backgroundColor: data.map(shiftColor),
    borderColor: data.map(shiftColor),
    borderWidth: chartType === "line" ? 1.5 : 0,
    borderRadius: chartType === "bar" ? 3 : 0,
    pointBackgroundColor: data.map(shiftColor),
    pointRadius: chartType === "line" ? 2.5 : 0,
    fill: false,
    tension: 0.35,
    order: 2,
  }));
  const avgDataset = {
    label: `Avg (${avgPerRow.toLocaleString()})`,
    data: data.map(() => avgPerRow),
    type: "line",
    borderColor: AVG_COLOR,
    borderWidth: 1.5,
    borderDash: [5, 3],
    pointRadius: 0,
    fill: false,
    tension: 0,
    order: 1,
  };
  const showAvgLine = avgPerRow > 0;
  const showLegend = datasets.length > 1 || showAvgLine;
  const finalDatasets = showAvgLine
    ? [...chartDatasets, avgDataset]
    : chartDatasets;

  const togglePanel = (id) => setActivePanel((p) => (p === id ? null : id));

  const thCenter = {
    padding: "5px 6px",
    color: "#94a3b8",
    fontWeight: 700,
    textAlign: "center",
    borderBottom: "1px solid #f1f5f9",
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "#fff",
        borderRadius: 12,
        border: "1px solid #e2e8f0",
        overflow: "hidden",
        position: "relative",
        fontWeight: 700,
      }}
    >
      {/* ── Overlay panels ── */}
      {activePanel === "hourly" && hasModelData && (
        <HourlyModelPanel
          modelData={modelData}
          onClose={() => setActivePanel(null)}
        />
      )}
      {activePanel === "total" && hasModelData && (
        <TotalModelPanel
          modelData={modelData}
          onClose={() => setActivePanel(null)}
        />
      )}

      {/* ── Header ── */}
      <div
        style={{
          height: 36,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 10px",
          borderBottom: "1px solid #f1f5f9",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {Icon && <Icon size={13} color="#94a3b8" />}
          <span style={{ fontSize: 19, fontWeight: 700, color: "#334155" }}>
            {title}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 1 }}>
          {/* Model overlays */}
          {hasModelData && (
            <>
              <button
                onClick={() => togglePanel("hourly")}
                title="Model Hourly"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  padding: "3px 7px",
                  borderRadius: 5,
                  border: `1px solid ${activePanel === "hourly" ? "#0ea5e9" : "#e0f2fe"}`,
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 700,
                  background: activePanel === "hourly" ? "#0ea5e9" : "#f0f9ff",
                  color: activePanel === "hourly" ? "#fff" : "#0891b2",
                }}
              >
                <MdSchedule size={11} />
                <span>Hrly</span>
              </button>
              <button
                onClick={() => togglePanel("total")}
                title="Model Total"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  padding: "3px 7px",
                  borderRadius: 5,
                  border: `1px solid ${activePanel === "total" ? "#14b8a6" : "#ccfbf1"}`,
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 700,
                  background: activePanel === "total" ? "#14b8a6" : "#f0fdfa",
                  color: activePanel === "total" ? "#fff" : "#0d9488",
                  marginLeft: 2,
                }}
              >
                <MdLeaderboard size={11} />
                <span>Total</span>
              </button>
              <div
                style={{
                  width: 1,
                  height: 14,
                  background: "#e2e8f0",
                  margin: "0 3px",
                }}
              />
            </>
          )}

          {/* Cumul + Total + CSV */}
          <button
            onClick={() => setShowCumul((p) => !p)}
            title="Running total"
            style={{
              padding: 4,
              borderRadius: 5,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: showCumul ? "#0ea5e9" : "#cbd5e1",
            }}
          >
            <MdFunctions size={13} />
          </button>
          <span
            style={{
              fontFamily: "monospace",
              fontSize: 20,
              fontWeight: 800,
              color: "#1e293b",
              marginLeft: 2,
              marginRight: 2,
            }}
          >
            {total.toLocaleString()}
          </span>
          <button
            onClick={exportCSV}
            title="Export CSV"
            style={{
              padding: 4,
              borderRadius: 5,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "#cbd5e1",
            }}
          >
            <FiDownload size={13} />
          </button>
        </div>
      </div>

      {/* ── Shift bar ── */}
      {data.length > 0 && (
        <div
          style={{
            height: 28,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            padding: "0 12px",
            gap: 8,
            borderBottom: "1px solid #f8fafc",
          }}
        >
          <FiSun size={10} color="#0ea5e9" style={{ flexShrink: 0 }} />
          <span
            style={{
              fontSize: 16,
              color: "#64748b",
              fontFamily: "monospace",
              flexShrink: 0,
            }}
          >
            {shiftTotals.day.toLocaleString()}
          </span>
          <div
            style={{
              flex: 1,
              height: 4,
              background: "#f1f5f9",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${dayPct}%`,
                background: "linear-gradient(90deg,#0ea5e9,#38bdf8)",
                borderRadius: 2,
                transition: "width 0.6s",
              }}
            />
          </div>
          <span
            style={{
              fontSize: 16,
              color: "#64748b",
              fontFamily: "monospace",
              flexShrink: 0,
            }}
          >
            {shiftTotals.night.toLocaleString()}
          </span>
          <FiMoon size={10} color="#8b5cf6" style={{ flexShrink: 0 }} />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              marginLeft: 6,
              flexShrink: 0,
            }}
          >
            {peakRow && (
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  padding: "1px 6px",
                  borderRadius: 20,
                  background: "#fef3c7",
                  border: "1px solid #fcd34d",
                  color: "#d97706",
                  fontSize: 15,
                  fontWeight: 700,
                }}
              >
                <FiZap size={8} />
                {peakRow.TIMEHOUR}:00
              </span>
            )}
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                padding: "1px 6px",
                borderRadius: 20,
                background: "#f1f5f9",
                border: "1px solid #e2e8f0",
                color: "#64748b",
                fontSize: 15,
              }}
            >
              <FiTrendingUp size={8} />
              {avgPerRow.toLocaleString()}/hr
            </span>
          </div>
        </div>
      )}

      {/* ── Body ── */}
      {data.length > 0 ? (
        <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
          {/* Table */}
          <div
            style={{
              width: "50%",
              display: "flex",
              flexDirection: "column",
              borderRight: "1px solid #f1f5f9",
              overflow: "hidden",
            }}
          >
            <div style={{ flex: 1, overflowY: "auto" }}>
              <table
                style={{
                  width: "100%",
                  fontSize: 17,
                  borderCollapse: "collapse",
                }}
              >
                <thead>
                  <tr
                    style={{
                      position: "sticky",
                      top: 0,
                      background: "#f8fafc",
                      zIndex: 1,
                    }}
                  >
                    <th style={{ ...thCenter, width: 28 }}>Hr</th>
                    <th style={{ ...thCenter, width: 38 }}>Time</th>
                    {datasets.map((ds) => (
                      <th key={ds.key} style={thCenter}>
                        {ds.label}
                      </th>
                    ))}
                    {datasets.length > 1 && <th style={thCenter}>Tot</th>}
                    {showCumul && <th style={thCenter}>Cum</th>}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, i) => {
                    const rTotal = rowTotals[i];
                    const isPeak = i === peakIdx;
                    const bg = isPeak
                      ? "rgba(245,158,11,0.08)"
                      : heatBg(maxRowVal > 0 ? rTotal / maxRowVal : 0);
                    return (
                      <tr
                        key={i}
                        style={{
                          borderBottom: "1px solid #f8fafc",
                          background: bg,
                        }}
                      >
                        <td
                          style={{
                            padding: "4px 6px",
                            textAlign: "center",
                            color: "#cbd5e1",
                            fontFamily: "monospace",
                          }}
                        >
                          {row.HOUR_NUMBER || row.HourNumber || i + 1}
                        </td>
                        <td style={{ padding: "4px 6px", textAlign: "center" }}>
                          <span
                            style={{
                              fontSize: 17,
                              fontWeight: 700,
                              color: isDay(row.TIMEHOUR ?? -1)
                                ? "#0ea5e9"
                                : "#8b5cf6",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 2,
                            }}
                          >
                            {row.TIMEHOUR ?? "?"}:00
                            {isPeak && <FiZap size={8} color="#f59e0b" />}
                          </span>
                        </td>
                        {datasets.map((ds) => (
                          <td
                            key={ds.key}
                            style={{
                              padding: "4px 6px",
                              textAlign: "center",
                              fontFamily: "monospace",
                              fontWeight: 700,
                              color: "#1e293b",
                            }}
                          >
                            {(row[ds.key] || 0).toLocaleString()}
                          </td>
                        ))}
                        {datasets.length > 1 && (
                          <td
                            style={{
                              padding: "4px 6px",
                              textAlign: "center",
                              fontFamily: "monospace",
                              color: "#475569",
                            }}
                          >
                            {rTotal.toLocaleString()}
                          </td>
                        )}
                        {showCumul && (
                          <td
                            style={{
                              padding: "4px 6px",
                              textAlign: "center",
                              fontFamily: "monospace",
                              color: "#475569",
                              fontSize: 16,
                            }}
                          >
                            {cumulative[i].toLocaleString()}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div
              style={{
                height: 28,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 10px",
                borderTop: "1px solid #e2e8f0",
                background: "#f8fafc",
              }}
            >
              <span
                style={{
                  fontSize: 16,
                  color: "#94a3b8",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Total
              </span>
              <span
                style={{
                  fontFamily: "monospace",
                  fontWeight: 700,
                  fontSize: 19,
                  color: "#1e293b",
                }}
              >
                {total.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Chart panel */}
          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              padding: "6px 10px 8px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 4,
                marginBottom: 4,
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginRight: "auto",
                  fontSize: 16,
                  color: "#94a3b8",
                }}
              >
                {[
                  [DAY_COLOR, "Day"],
                  [NIGHT_COLOR, "Night"],
                ].map(([c, l]) => (
                  <span
                    key={l}
                    style={{ display: "flex", alignItems: "center", gap: 3 }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 2,
                        background: c,
                        display: "inline-block",
                      }}
                    />
                    {l}
                  </span>
                ))}
                <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                  <span
                    style={{
                      width: 12,
                      height: 2,
                      background: AVG_COLOR,
                      display: "inline-block",
                      borderRadius: 1,
                    }}
                  />
                  Avg
                </span>
              </div>
              {[
                ["bar", MdBarChart],
                ["line", MdShowChart],
              ].map(([type, Ico]) => (
                <button
                  key={type}
                  onClick={() => setChartType(type)}
                  style={{
                    padding: 4,
                    borderRadius: 5,
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    color: chartType === type ? "#475569" : "#cbd5e1",
                  }}
                >
                  <Ico size={13} />
                </button>
              ))}
            </div>
            <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
              {chartType === "bar" ? (
                <Bar
                  data={{ labels, datasets: finalDatasets }}
                  options={makeOptions(maxVal, showLegend, 16)}
                />
              ) : (
                <Line
                  data={{ labels, datasets: finalDatasets }}
                  options={makeOptions(maxVal, showLegend, 16)}
                />
              )}
            </div>
          </div>
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            color: "#cbd5e1",
          }}
        >
          <FiBarChart2 size={26} />
          <span style={{ fontSize: 14, color: "#94a3b8" }}>
            No data — select a range and query
          </span>
        </div>
      )}
    </div>
  );
};

export default HourlyWidget;
