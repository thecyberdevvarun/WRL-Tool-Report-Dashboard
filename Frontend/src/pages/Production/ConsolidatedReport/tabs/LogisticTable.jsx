import { BsExclamationCircle } from "react-icons/bs";
import EmptyState from "../../../../components/ui/EmptyState";

function LogisticTable({ data }) {
  const headers = [
    "FG Auto Scan",
    "FG Auto Scan Date",
    "FG Unloading",
    "FG Unloading Date",
    "Session ID",
    "Vehicle No",
    "Dock No",
    "Vehicle Entry Time",
  ];

  const fallback = {
    FG_Auto_Scan: "FG Not Unloaded",
    FG_Auto_Scan_Date: "FG Not Unloaded",
    FG_Unloading: "FG Not Scanned",
    FG_Unloading_Date: "FG Not Scanned",
    Session_ID: "FG Not Dispatched",
    Vehicle_No: "FG Not Dispatched",
    DockNo: "FG Not Dispatched",
    Vehicle_Entry_Time: "FG Not Dispatched",
  };

  const fields = Object.keys(fallback);

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
            data.map((item, index) => {
              return (
                <tr
                  key={index}
                  className={`text-center transition-colors duration-150 ${
                    index % 2 === 0 ? "bg-white" : "bg-gray-50/80"
                  } hover:bg-indigo-50/70`}
                >
                  {fields.map((field) => {
                    const value = item?.[field];
                    const isFallback = value == null;

                    return (
                      <td key={field} className="px-4 py-2.5 whitespace-nowrap">
                        {isFallback ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-semibold rounded-full bg-amber-50 text-amber-600 border border-amber-200">
                            <BsExclamationCircle size={11} />
                            {fallback[field]}
                          </span>
                        ) : (
                          <span
                            className={`${
                              field === "Session_ID"
                                ? "font-mono font-semibold tracking-wide text-indigo-700"
                                : "text-gray-700"
                            }`}
                          >
                            {value}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={8}>
                <EmptyState message="Logistic data will be available only after the FG number is generated. Please enter a valid FG number to continue." />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default LogisticTable;
