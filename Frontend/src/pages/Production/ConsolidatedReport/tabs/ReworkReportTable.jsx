import EmptyState from "../../../../components/ui/EmptyState";
import {
  FiTool,
  FiCheckCircle,
  FiClock,
  FiAlertTriangle,
  FiXCircle,
} from "react-icons/fi";
import { BsBoxSeam } from "react-icons/bs";
import { MdOutlineCategory } from "react-icons/md";

// ─── Info Card ──────────────────────────────────────────────────
function InfoCard({ icon: Icon, label, value, color = "indigo" }) {
  if (!value) return null;
  const colors = {
    indigo: {
      bg: "bg-indigo-50",
      icon: "text-indigo-600",
      text: "text-indigo-700",
    },
    purple: {
      bg: "bg-purple-50",
      icon: "text-purple-600",
      text: "text-purple-700",
    },
    blue: {
      bg: "bg-blue-50",
      icon: "text-blue-600",
      text: "text-blue-700",
    },
  };
  const c = colors[color] || colors.indigo;

  return (
    <div
      className="flex items-center gap-3 rounded-xl bg-white border border-gray-200
                  px-4 py-2.5 shadow-sm hover:shadow-md transition-shadow duration-200"
    >
      <div
        className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center flex-shrink-0`}
      >
        <Icon size={15} className={c.icon} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest leading-none">
          {label}
        </p>
        <p
          className={`text-sm font-bold ${c.text} mt-0.5 truncate`}
          title={value}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

// ─── Status Badge ───────────────────────────────────────────────
function StatusBadge({ status }) {
  const config = {
    Completed: {
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      border: "border-emerald-200",
      icon: <FiCheckCircle size={11} />,
    },
    "In Progress": {
      bg: "bg-blue-50",
      text: "text-blue-600",
      border: "border-blue-200",
      icon: <FiClock size={11} />,
    },
    Pending: {
      bg: "bg-amber-50",
      text: "text-amber-700",
      border: "border-amber-200",
      icon: <FiClock size={11} />,
    },
    Rejected: {
      bg: "bg-red-50",
      text: "text-red-700",
      border: "border-red-200",
      icon: <FiXCircle size={11} />,
    },
  };

  const style = config[status] || {
    bg: "bg-gray-50",
    text: "text-gray-600",
    border: "border-gray-200",
    icon: <FiTool size={11} />,
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold rounded-full border
                  ${style.bg} ${style.text} ${style.border}`}
    >
      {style.icon}
      {status}
    </span>
  );
}

// ─── Duration Badge ─────────────────────────────────────────────
function DurationBadge({ duration }) {
  if (!duration) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-full bg-blue-50 text-blue-600 border border-blue-200">
        <FiClock size={10} />
        In Progress
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-full bg-orange-50 text-orange-700 border border-orange-200">
      <FiClock size={11} />
      {duration}
    </span>
  );
}

// ─── Format DateTime ────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return null;
  return dateStr.replace("T", " ").replace("Z", "").substring(0, 19);
}

// ─── Main Component ─────────────────────────────────────────────
function ReworkReportTable({ data }) {
  // ─── Extract common info from first row ─────────────────────
  const summary = data.length > 0 ? data[0] : {};
  const modelName = summary.Model_Name || "";
  const category = summary.Category || "";
  const assemblySrNo = summary.Assembly_SrNo || "";

  const headers = [
    "Station",
    "Process Code",
    "Rework IN",
    "Rework Out",
    "Duration (DD:HH:MM)",
    "Operator",
    "Status",
    "Defect Category",
    "Defect",
    "Root Cause",
    "Counter Action",
    "Remark",
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* ─── Product Info Cards ─────────────────────────────── */}
      {data.length > 0 && (
        <div className="flex flex-wrap gap-3 p-4 bg-gray-50/80 rounded-xl border border-gray-100">
          <InfoCard
            icon={BsBoxSeam}
            label="Model"
            value={modelName}
            color="indigo"
          />
          <InfoCard
            icon={MdOutlineCategory}
            label="Category"
            value={category}
            color="purple"
          />
          <InfoCard
            icon={FiTool}
            label="Assembly Sr. No"
            value={assemblySrNo}
            color="blue"
          />
        </div>
      )}

      {/* ─── Table ─────────────────────────────────────────── */}
      <div className="w-full overflow-x-auto overflow-y-auto max-h-[550px] rounded-xl border border-gray-200 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
              {headers.map((h, i) => (
                <th
                  key={i}
                  className="px-4 py-3.5 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap text-center"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {Array.isArray(data) && data.length > 0 ? (
              data.map((item, index) => {
                const isInProgress = !item.Rework_Out;

                const rowBg = isInProgress
                  ? "bg-amber-50/40"
                  : index % 2 === 0
                    ? "bg-white"
                    : "bg-gray-50/80";

                return (
                  <tr
                    key={index}
                    className={`text-center transition-colors duration-150 ${rowBg} hover:bg-indigo-50/70`}
                  >
                    {/* Station */}
                    <td className="px-4 py-2.5 whitespace-nowrap font-semibold text-gray-800">
                      {item.station}
                    </td>

                    {/* Process Code */}
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span className="bg-gray-100 px-2 py-0.5 rounded text-xs font-mono text-gray-600">
                        {item.processCode}
                      </span>
                    </td>

                    {/* Rework IN */}
                    <td className="px-4 py-2.5 whitespace-nowrap text-xs">
                      {formatDate(item.reworkIN) ? (
                        <span className="text-gray-600">
                          {formatDate(item.reworkIN)}
                        </span>
                      ) : (
                        <span className="text-gray-300 italic">—</span>
                      )}
                    </td>

                    {/* Rework Out */}
                    <td className="px-4 py-2.5 whitespace-nowrap text-xs">
                      {formatDate(item.reworkOut) ? (
                        <span className="text-gray-600">
                          {formatDate(item.reworkOut)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-full bg-amber-50 text-amber-600 border border-amber-200">
                          <FiClock size={10} />
                          Ongoing
                        </span>
                      )}
                    </td>

                    {/* Duration */}
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <DurationBadge duration={item.duration} />
                    </td>

                    {/* Operator */}
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {item.userName ? (
                        <span className="text-gray-700 text-xs font-medium">
                          {item.userName}
                        </span>
                      ) : (
                        <span className="text-gray-300 italic text-xs">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <StatusBadge status={item.reworkStatus} />
                    </td>

                    {/* Defect Category */}
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {item.defectCategory ? (
                        <span className="inline-block px-2.5 py-0.5 text-xs font-semibold rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                          {item.defectCategory}
                        </span>
                      ) : (
                        <span className="text-gray-300 italic text-xs">—</span>
                      )}
                    </td>

                    {/* Defect */}
                    <td className="px-4 py-2.5 whitespace-nowrap max-w-[180px]">
                      {item.defect ? (
                        <span
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-semibold
                                     rounded-full bg-red-50 text-red-600 border border-red-200"
                          title={item.defect}
                        >
                          <FiAlertTriangle size={10} />
                          {item.defect}
                        </span>
                      ) : (
                        <span className="text-gray-300 italic text-xs">—</span>
                      )}
                    </td>

                    {/* Root Cause */}
                    <td className="px-4 py-2.5 whitespace-nowrap max-w-[180px]">
                      {item.rootCause ? (
                        <span
                          className="bg-orange-50 text-orange-700 px-2 py-0.5 rounded text-xs font-semibold border border-orange-200"
                          title={item.rootCause}
                        >
                          {item.rootCause}
                        </span>
                      ) : (
                        <span className="text-gray-300 italic text-xs">—</span>
                      )}
                    </td>

                    {/* Counter Action */}
                    <td className="px-4 py-2.5 whitespace-nowrap max-w-[180px]">
                      {item.counterAction ? (
                        <span
                          className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-semibold border border-blue-200"
                          title={item.counterAction}
                        >
                          {item.counterAction}
                        </span>
                      ) : (
                        <span className="text-gray-300 italic text-xs">—</span>
                      )}
                    </td>

                    {/* Remark */}
                    <td className="px-4 py-2.5 whitespace-nowrap max-w-[200px]">
                      {item.remark ? (
                        <span
                          className="text-gray-600 text-xs block truncate"
                          title={item.remark}
                        >
                          {item.remark}
                        </span>
                      ) : (
                        <span className="text-gray-300 italic text-xs">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={headers.length}>
                  <EmptyState message="No rework data found for this serial number." />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ─── Legend ──────────────────────────────────────────── */}
      {data.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 px-2 py-2">
          <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">
            Legend:
          </p>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-white border border-gray-200" />
            <span className="text-xs text-gray-500">Completed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-amber-50 border border-amber-200" />
            <span className="text-xs text-gray-500">In Progress</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default ReworkReportTable;
