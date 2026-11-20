/**
 * LinePerformanceWidget.jsx — Line Performance widget
 *
 * Props:
 *   title         — widget heading
 *   data          — category rows { category, TotalCount }
 *   icon          — optional icon component
 *   elapsedHours  — selected duration in hours (used for Actual UPH)
 *
 * Columns: Line | Count | Target UPH | Actual UPH | Achieved %
 *   Actual UPH = Count ÷ elapsed hours
 *   Achieved % = Actual UPH ÷ Target UPH × 100
 */

import { Bar } from "react-chartjs-2";
import { FiDownload, FiBarChart2 } from "react-icons/fi";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";
import { downloadCSV } from "./widgetUtils";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

// ─── Constants ────────────────────────────────────────────────────────────────
// ⚠ SUS target is a placeholder (taken from the FG Label SUS target). Confirm it.
const LINE_TARGET_UPH = {
  Freezer: 95,
  Chocolate: 60,
  "Visi Cooler": 85,
  SUS: 14,
};

const LINE_COLORS = {
  Freezer: "rgba(14,165,233,0.75)",
  Chocolate: "rgba(245,158,11,0.75)",
  "Visi Cooler": "rgba(20,184,166,0.75)",
  SUS: "rgba(100,116,139,0.70)",
};

const LINE_HEADERS = [
  "Line",
  "Count",
  "Target UPH",
  "Actual UPH",
  "Achieved %",
];

const achievedColor = (p) =>
  p >= 100 ? "#16a34a" : p >= 80 ? "#d97706" : "#dc2626";

// ─── Component ────────────────────────────────────────────────────────────────
const LinePerformanceWidget = ({
  title,
  data = [],
  icon: Icon,
  elapsedHours = 0,
}) => {
  const hours = Number(elapsedHours) > 0 ? Number(elapsedHours) : 0;
  const total = data.reduce((s, r) => s + (Number(r.TotalCount) || 0), 0);

  const getRowMetrics = (row) => {
    const count = Number(row.TotalCount) || 0;
    const targetUPH = LINE_TARGET_UPH[row.category] ?? 0;
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
        LINE_HEADERS,
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
      {/* Header */}
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

      {/* Main Section */}
      {data.length > 0 ? (
        <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
          {/* Line Performance Table */}
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
                  {LINE_HEADERS.map((h, i) => (
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
                {data.map((row) => {
                  const m = getRowMetrics(row);
                  return (
                    <tr
                      key={row.category}
                      style={{ borderBottom: "1px solid #f8fafc" }}
                    >
                      <td style={{ padding: "6px 8px", color: "#475569" }}>
                        <span
                          style={{
                            display: "inline-block",
                            width: 10,
                            height: 10,
                            borderRadius: 3,
                            marginRight: 8,
                            background: LINE_COLORS[row.category],
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

          {/* Line Performance Graph */}
          <div style={{ flex: 1, padding: "10px 12px", minWidth: 0 }}>
            <Bar
              data={{
                labels: data.map((r) => r.category),
                datasets: [
                  {
                    label: "Units Produced",
                    data: data.map((r) => r.TotalCount || 0),
                    backgroundColor: data.map((r) => LINE_COLORS[r.category]),
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

export default LinePerformanceWidget;
