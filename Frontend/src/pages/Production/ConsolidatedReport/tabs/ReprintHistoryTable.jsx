import EmptyState from "../../../../components/ui/EmptyState";
import { FiPrinter, FiMessageSquare, FiAlertTriangle } from "react-icons/fi";

function formatDate(dateStr) {
  if (!dateStr) return null;
  return dateStr.replace("T", " ").replace("Z", "").substring(0, 19);
}

function ReprintHistoryTable({ data }) {
  const totalPrints = data.length;
  const reprintCount = totalPrints > 1 ? totalPrints : 0;

  const headers = [
    "Sr No",
    "Print #",
    "Printed By",
    "Printed On",
    "Remark",
    "Type",
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* ─── Reprint Alert Banner ──────────────────────────── */}
      {reprintCount > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
          <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
            <FiAlertTriangle size={16} className="text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-800">
              This barcode has been reprinted{" "}
              <span className="text-amber-900 font-bold">{reprintCount}</span>{" "}
              time{reprintCount > 1 && "s"}
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              First printed by{" "}
              <span className="font-semibold">{data[0]?.Printed_By}</span> on{" "}
              <span className="font-semibold">
                {formatDate(data[0]?.Printed_On)}
              </span>
            </p>
          </div>
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
                const isReprint = index > 0;

                const rowBg = isReprint
                  ? "bg-amber-50/40"
                  : index % 2 === 0
                    ? "bg-white"
                    : "bg-gray-50/80";

                return (
                  <tr
                    key={index}
                    className={`text-center transition-colors duration-150 ${rowBg} hover:bg-indigo-50/70`}
                  >
                    {/* Sr No */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 text-xs font-bold text-gray-700">
                        {item.Sr_No || index + 1}
                      </span>
                    </td>

                    {/* Print # */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold rounded-full border bg-amber-50 text-amber-700 border-amber-200">
                        {<FiPrinter size={10} />}
                        {index + 1} of {totalPrints}
                      </span>
                    </td>

                    {/* Printed By */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-[10px] font-bold text-indigo-700 uppercase">
                            {item.Printed_By?.charAt(0) || "?"}
                          </span>
                        </div>
                        <span className="text-xs font-medium text-gray-700">
                          {item.Printed_By}
                        </span>
                      </div>
                    </td>

                    {/* Printed On */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatDate(item.Printed_On) ? (
                        <div className="flex flex-col items-center">
                          <span className="text-xs text-gray-700 font-medium">
                            {formatDate(item.Printed_On)?.split(" ")[0]}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {formatDate(item.Printed_On)?.split(" ")[1]}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-300 italic text-xs">—</span>
                      )}
                    </td>

                    {/* Remark */}
                    <td className="px-4 py-3 whitespace-nowrap max-w-[300px]">
                      {item.Remark ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <FiMessageSquare
                            size={12}
                            className="text-gray-400 flex-shrink-0"
                          />
                          <span
                            className="text-xs text-gray-600 truncate"
                            title={item.Remark}
                          >
                            {item.Remark}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-300 italic text-xs">
                          No remark
                        </span>
                      )}
                    </td>

                    {/* Type */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold rounded-full border bg-amber-50 text-amber-700 border-amber-200">
                        <FiAlertTriangle size={10} />
                        Reprint
                      </span>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={headers.length}>
                  <EmptyState message="No reprint history found for this serial number." />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ReprintHistoryTable;
