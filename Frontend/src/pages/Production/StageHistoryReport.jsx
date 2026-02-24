import Title from "../../components/ui/Title";
import InputField from "../../components/ui/InputField";
import Button from "../../components/ui/Button";
import { useState } from "react";
import axios from "axios";
import Loader from "../../components/ui/Loader";
import ExportButton from "../../components/ui/ExportButton";
import toast from "react-hot-toast";
import { baseURL } from "../../assets/assets";

function StageHistoryReport() {
  const [loading, setLoading] = useState(false);
  const [serialNumber, setSerialNumber] = useState("");
  const [stageHistoryData, setStageHistoryData] = useState([]);
  const [logisticData, setLogisticStatus] = useState([]);
  const [productName, setProductName] = useState("");

  const handleQuery = async () => {
    if (!serialNumber) {
      toast.error("Please enter Serial Number.");
      return;
    }

    setLoading(true);

    try {
      const [stageRes, logisticRes] = await Promise.all([
        axios.get(`${baseURL}prod/stage-history`, { params: { serialNumber } }),
        axios.get(`${baseURL}prod/logistic-status`, {
          params: { serialNumber },
        }),
      ]);

      // Stage history
      const stageData = stageRes.data?.data?.recordsets[0] || [];
      setStageHistoryData(stageData);

      if (stageData.length > 0 && stageData[0].MaterialName) {
        setProductName(stageData[0].MaterialName);
      } else {
        setProductName("");
      }

      // Logistic data
      const logisticData = logisticRes?.data?.data || [];
      setLogisticStatus(logisticData);
    } catch (error) {
      console.error("Query failed:", error);
      toast.error("Failed to fetch data.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen rounded-lg">
      <Title title="Stage History Report" align="center" />

      {/* Filters Section */}
      <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-xl">
        {/* First Row */}
        <div className="flex flex-wrap items-center gap-4">
          <InputField
            label="Serial Number"
            type="text"
            placeholder="Enter details"
            className="w-64"
            name="serialNumber"
            value={serialNumber}
            onChange={(e) => setSerialNumber(e.target.value)}
          />
          <div className="flex items-center justify-center gap-4">
            <Button
              bgColor={loading ? "bg-gray-400" : "bg-blue-500"}
              textColor={loading ? "text-white" : "text-black"}
              className={`font-semibold ${loading ? "cursor-not-allowed" : ""}`}
              onClick={handleQuery}
              disabled={loading}
            >
              Query
            </Button>
            {stageHistoryData && stageHistoryData.length > 0 && (
              <ExportButton
                data={stageHistoryData}
                filename="Stage_History_Report"
              />
            )}
          </div>
          {/* Product Name */}
          <div className="mt-4 text-left font-bold text-lg">
            Product Name: <span className="text-blue-700">{productName}</span>
          </div>
        </div>
      </div>

      {/* Summary Section */}
      <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-xl">
        <div className="bg-white border border-gray-300 rounded-md p-4">
          {loading ? (
            <div className="flex justify-center items-center py-10">
              <Loader />
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {/* ---------- TABLE 1 : Logistic Status (FIRST) ---------- */}
              <div className="w-full max-h-[600px] overflow-x-auto">
                <h2 className="font-bold mb-2">Logistic Status</h2>
                <table className="min-w-full border bg-white text-xs text-left rounded-lg table-auto">
                  <thead className="bg-gray-200 sticky top-0 z-10 text-center">
                    <tr>
                      <th className="px-1 py-1 border">FG Auto Scan</th>
                      <th className="px-1 py-1 border">FG Auto Scan Date</th>
                      <th className="px-1 py-1 border">FG unloading</th>
                      <th className="px-1 py-1 border">FG Unloading Date</th>
                      <th className="px-1 py-1 border">Session ID</th>
                      <th className="px-1 py-1 border">Vehicle No</th>
                      <th className="px-1 py-1 border">DockNo</th>
                      <th className="px-1 py-1 border">Vehicle Entry Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.isArray(logisticData) && logisticData.length > 0 ? (
                      logisticData.map((item, index) => (
                        <tr
                          key={index}
                          className="hover:bg-gray-100 text-center"
                        >
                          <td className="px-1 py-1 border">
                            {item?.FG_Auto_Scan ?? "FG Not Unloaded"}
                          </td>

                          <td className="px-1 py-1 border">
                            {item?.FG_Auto_Scan_Date ?? "FG Not Unloaded"}
                          </td>

                          <td className="px-1 py-1 border">
                            {item?.FG_Unloading ?? "FG not Scanned"}
                          </td>

                          <td className="px-1 py-1 border">
                            {item?.FG_Unloading_Date ?? "FG not Scanned"}
                          </td>

                          <td className="px-1 py-1 border">
                            {item?.Session_ID ?? "FG not Dispatched"}
                          </td>

                          <td className="px-1 py-1 border">
                            {item?.Vehicle_No ?? "FG not Dispatched"}
                          </td>

                          <td className="px-1 py-1 border">
                            {item?.DockNo ?? "FG not Dispatched"}
                          </td>

                          <td className="px-1 py-1 border">
                            {item?.Vehicle_Entry_Time ?? "FG not Dispatched"}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={8}
                          className="text-center py-4 text-red-600 font-semibold"
                        >
                          No logistic data found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {/* ---------- TABLE 2 : Stage History (SECOND) ---------- */}
              <div className="w-full max-h-[600px] overflow-x-auto">
                <h2 className="font-bold mb-2">Stage History</h2>
                <table className="min-w-full border bg-white text-xs text-left rounded-lg table-auto">
                  <thead className="bg-gray-200 sticky top-0 z-10 text-center">
                    <tr>
                      <th className="px-1 py-1 border">PSNO</th>
                      <th className="px-1 py-1 border">Station_Code</th>
                      <th className="px-1 py-1 border">Name</th>
                      <th className="px-1 py-1 border">Operator</th>
                      <th className="px-1 py-1 border">Activity On</th>
                      <th className="px-1 py-1 border">Alias</th>
                      <th className="px-1 py-1 border">Customer QR</th>
                      <th className="px-1 py-1 border">V Serial</th>
                      <th className="px-1 py-1 border">Serial</th>
                      <th className="px-1 py-1 border">Activity Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stageHistoryData.length > 0 ? (
                      stageHistoryData.map((item, index) => (
                        <tr
                          key={index}
                          className="hover:bg-gray-100 text-center"
                        >
                          <td className="px-1 py-1 border">{item.PSNO}</td>
                          <td className="px-1 py-1 border">
                            {item.StationCode}
                          </td>
                          <td className="px-1 py-1 border">
                            {item.StationName}
                          </td>
                          <td className="px-1 py-1 border">{item.UserName}</td>
                          <td className="px-1 py-1 border">
                            {item.ActivityOn?.replace("T", " ").replace(
                              "Z",
                              ""
                            )}
                          </td>
                          <td className="px-1 py-1 border">
                            {item.BarcodeAlias}
                          </td>
                          <td className="px-1 py-1 border">
                            {item.CustomerQR}
                          </td>
                          <td className="px-1 py-1 border">{item.VSerial}</td>
                          <td className="px-1 py-1 border">{item.Serial}</td>
                          <td className="px-1 py-1 border">
                            {item.ActivityType}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={12} className="text-center py-4">
                          No stage history found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default StageHistoryReport;
