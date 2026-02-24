import EmptyState from "../../../../components/ui/EmptyState";

// ─── Activity Badge ─────────────────────────────────────────────
function ActivityBadge({ type }) {
  const styles = {
    IN: "bg-emerald-100 text-emerald-700 border-emerald-200",
    OUT: "bg-red-100 text-red-700 border-red-200",
  };
  return (
    <span
      className={`inline-block px-3 py-0.5 text-xs font-bold rounded-full border ${
        styles[type] || "bg-gray-100 text-gray-600 border-gray-200"
      }`}
    >
      {type}
    </span>
  );
}

// ─── Main Table ─────────────────────────────────────────────────
function StageHistoryTable({ data }) {
  const headers = [
    "Station Code",
    "Station Name",
    "Operator",
    "Activity On",
    "Activity Type",
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* ─── Table ───────────────────────────────────────────── */}
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
            {data.length > 0 ? (
              data.map((item, index) => (
                <tr
                  key={index}
                  className={`text-center transition-colors duration-150 ${
                    index % 2 === 0 ? "bg-white" : "bg-gray-50/80"
                  } hover:bg-indigo-50/70`}
                >
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span className="bg-gray-100 px-2 py-0.5 rounded text-xs font-mono text-gray-600">
                      {item.StationCode}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-gray-600">
                    {item.StationName}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-gray-600">
                    {item.UserName}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-gray-500 text-xs">
                    {item.ActivityOn?.replace("T", " ").replace("Z", "")}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <ActivityBadge type={item.ActivityTypeName} />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6}>
                  <EmptyState message="No stage history found for this serial number." />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default StageHistoryTable;
