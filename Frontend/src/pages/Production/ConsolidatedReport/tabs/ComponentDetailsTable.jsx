import EmptyState from "../../../../components/ui/EmptyState";

function ComponentDetailsTable({ data }) {
  const headers = [
    "Name",
    "Serial Number",
    "Type",
    "Supplier Name",
    "SAP Code",
    "Scanned On",
  ];

  return (
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
            data.map((item, index) => (
              <tr
                key={index}
                className={`text-center transition-colors duration-150 ${
                  index % 2 === 0 ? "bg-white" : "bg-gray-50/80"
                } hover:bg-indigo-50/70`}
              >
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <span className="bg-gray-100 px-2 py-0.5 rounded text-xs font-mono text-gray-600">
                    {item.name}
                  </span>
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <span className="font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded text-xs">
                    {item.serial}
                  </span>
                </td>

                <td className="px-4 py-2.5 whitespace-nowrap">
                  <span className="inline-block px-2.5 py-0.5 text-xs font-semibold rounded-full border bg-blue-50 text-blue-600 border-blue-200">
                    {item.type}
                  </span>
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap text-gray-600">
                  {item.supplierName}
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap text-gray-600">
                  {item.sapCode}
                </td>

                <td className="px-4 py-2.5 whitespace-nowrap text-gray-500 text-xs">
                  {item.scannedOn?.replace("T", " ").replace("Z", "")}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={10}>
                <EmptyState message="No component details found for this serial number." />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default ComponentDetailsTable;
