import { FiDownload, FiBarChart2 } from "react-icons/fi";
import { downloadCSV } from "./widgetUtils";

// ─── Constants ────────────────────────────────────────────────────────────────

const LINE_TARGET_UPH = {
  Freezer: 95,
  Chocolate: 60,
  "Visi Cooler": 85,
  SUS: 14,
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

  const th = {
    padding: "10px 12px",
    color: "#94a3b8",
    fontWeight: 700,
    borderBottom: "1px solid #f1f5f9",
  };

  const td = {
    padding: "10px 12px",
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {Icon && <Icon size={13} color="#64748b" />}

          <span
            style={{
              fontSize: 19,
              fontWeight: 700,
              color: "#475569",
            }}
          >
            {title}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
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

      {/* Main Section - Full Width Table */}
      {data.length > 0 ? (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            width: "100%",
            overflowY: "auto",
            overflowX: "auto",
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
                    style={{
                      ...th,
                      textAlign: i >= 2 ? "center" : "left",
                    }}
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
                    style={{
                      borderBottom: "1px solid #f8fafc",
                    }}
                  >
                    <td
                      style={{
                        padding: "10px 12px",
                        color: "#475569",
                      }}
                    >
                      {row.category}
                    </td>

                    <td style={{ ...td, color: "#1e293b" }}>
                      {m.count.toLocaleString()}
                    </td>

                    <td style={{ ...td, color: "#64748b" }}>{m.targetUPH}</td>

                    <td style={{ ...td, color: "#0f766e" }}>{m.actualUPH}</td>

                    <td
                      style={{
                        ...td,
                        color: achievedColor(m.achieved),
                      }}
                    >
                      {m.achieved}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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

          <span
            style={{
              fontSize: 12,
              color: "#94a3b8",
            }}
          >
            No data — select a range and query
          </span>
        </div>
      )}
    </div>
  );
};

export default LinePerformanceWidget;
