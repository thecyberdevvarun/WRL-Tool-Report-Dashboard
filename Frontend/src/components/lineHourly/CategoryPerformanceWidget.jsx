import { FiDownload, FiBarChart2 } from "react-icons/fi";
import { downloadCSV } from "./widgetUtils";

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_HEADERS = ["Category", "Count"];

// ─── Component ────────────────────────────────────────────────────────────────

const CategoryPerformanceWidget = ({ title, data = [], icon: Icon }) => {
  const total = data.reduce((s, r) => s + (Number(r.TotalCount) || 0), 0);

  const getRowMetrics = (row) => ({
    count: Number(row.TotalCount) || 0,
  });

  const exportCSV = () => {
    if (!data.length) return;

    downloadCSV(
      [
        CATEGORY_HEADERS,
        ...data.map((r) => {
          const m = getRowMetrics(r);

          return [r.category, m.count];
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
                {CATEGORY_HEADERS.map((h, i) => (
                  <th
                    key={h}
                    style={{
                      ...th,
                      textAlign: i === 0 ? "left" : "center",
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

export default CategoryPerformanceWidget;
