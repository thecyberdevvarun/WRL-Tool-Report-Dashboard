import Title from "../../components/ui/Title";
import SelectField from "../../components/ui/SelectField";
import InputField from "../../components/ui/InputField";
import Button from "../../components/ui/Button";
import Loader from "../../components/ui/Loader";
import { useState } from "react";
import DateTimePicker from "../../components/ui/DateTimePicker";
import axios from "axios";
import toast from "react-hot-toast";
import { baseURL } from "../../assets/assets";

const ErrorLog = () => {
  const groupingOptions = [
    { label: "Session_ID", value: "sessionid" },
    { label: "FGSerialNo", value: "fgserialno" },
    { label: "AssetNo", value: "assetno" },
    { label: "ModelName", value: "modelname" },
    { label: "ModelCode", value: "modelcode" },
    { label: "ErrorMessage", value: "errormessage" },
    { label: "ErrorName", value: "errorname" },
  ];

  const [loading, setLoading] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [errorLogData, setErrorLogData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [groupingCondition, setGroupingCondition] = useState(
    groupingOptions[0]
  );
  const [totalCount, setTotalCount] = useState(0);

  const fetchErrorLogData = async () => {
    if (!startTime || !endTime) {
      toast.error("Please select Time Range.");
      return;
    }
    try {
      setLoading(true);
      const res = await axios.get(`${baseURL}dispatch/error-log`, {
        params: {
          startDate: startTime,
          endDate: endTime,
        },
      });

      if (res?.data?.success) {
        setErrorLogData(res?.data?.data);
        setTotalCount(res?.data?.totalCount);
      }
    } catch (error) {
      console.error("Failed to fetch Error Log data:", error);
      toast.error("Failed to fetch Error Log data.");
    } finally {
      setLoading(false);
    }
  };

  const getGroupedData = () => {
    if (!errorLogData.length || !groupingCondition) {
      return [];
    }

    const grouped = errorLogData.reduce((acc, item) => {
      const key = item[groupingCondition.label] || "Unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(grouped).map(([key, count]) => ({
      key,
      count,
    }));
  };

  const handleQuery = () => {
    fetchErrorLogData(1);
  };

  const handleClearFilters = () => {
    setStartTime("");
    setEndTime("");
    setErrorLogData([]);
    setSearchTerm("");
    setGroupingCondition(groupingOptions[0]);
    setTotalCount(0);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <Title title="Dispatch Error Log" align="center" />

      {/* Filters Section */}
      <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 max-w-fit rounded-md">
        <div className="flex flex-wrap gap-4">
          <DateTimePicker
            label="Start Time"
            name="startTime"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="max-w-64"
          />
          <DateTimePicker
            label="End Time"
            name="endTime"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="max-w-64"
          />
        </div>

        <div className="flex flex-wrap gap-4">
          <InputField
            label="Search"
            type="text"
            placeholder="Enter details"
            className="max-w-64"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div className="flex flex-wrap items-end gap-2 mt-1">
            <Button
              bgColor={loading ? "bg-gray-400" : "bg-blue-500"}
              textColor={loading ? "text-white" : "text-black"}
              className={`font-semibold ${loading ? "cursor-not-allowed" : ""}`}
              onClick={handleQuery}
              disabled={loading}
            >
              Query
            </Button>
            <div className="flex items-center gap-4 mt-4">
              <Button
                bgColor="bg-white"
                textColor="text-black"
                className="border border-gray-400 hover:bg-gray-100"
                onClick={handleClearFilters}
              >
                Clear Filter
              </Button>
            </div>
          </div>
        </div>
        <div className="mt-4 text-left font-bold text-lg">
          COUNT: <span className="text-blue-700">{totalCount || 0}</span>
        </div>
      </div>

      {/* Summary Section */}
      <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-md">
        <div className="flex flex-col items-center mb-4">
          <span className="text-xl font-semibold">Summary</span>
        </div>

        <div className="bg-white border border-gray-300 rounded-md p-2">
          <div className="flex flex-col md:flex-row items-start gap-4">
            {/* Left Side - Detailed Table */}
            <div className="w-full md:flex-1">
              {loading ? (
                <Loader />
              ) : (
                <div className="w-full max-h-[600px] overflow-x-auto">
                  <table className="min-w-full border bg-white text-xs text-left rounded-lg table-auto">
                    <thead className="bg-gray-200 sticky top-0 z-10 text-center">
                      <tr>
                        <th className="px-1 py-1 border min-w-[120px]">
                          Session ID
                        </th>
                        <th className="px-1 py-1 border min-w-[120px]">
                          FG Serial No
                        </th>
                        <th className="px-1 py-1 border min-w-[120px]">
                          Asset No
                        </th>
                        <th className="px-1 py-1 border min-w-[120px]">
                          Model Name
                        </th>
                        <th className="px-1 py-1 border min-w-[120px]">
                          Model Code
                        </th>
                        <th className="px-1 py-1 border min-w-[120px]">
                          Error Message
                        </th>
                        <th className="px-1 py-1 border min-w-[120px]">
                          Error Name
                        </th>
                        <th className="px-1 py-1 border min-w-[120px]">
                          Error On.
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {errorLogData && errorLogData.length > 0 ? (
                        errorLogData.map((item, index) => (
                          <tr
                            key={index}
                            className="hover:bg-gray-100 text-center"
                          >
                            <td className="px-1 py-1 border">
                              {item.Session_ID}
                            </td>
                            <td className="px-1 py-1 border">
                              {item.FGSerialNo}
                            </td>
                            <td className="px-1 py-1 border">{item.AssetNo}</td>
                            <td className="px-1 py-1 border">
                              {item.ModelName}
                            </td>
                            <td className="px-1 py-1 border">
                              {item.ModelCode}
                            </td>
                            <td className="px-1 py-1 border">
                              {item.ErrorMessage}
                            </td>
                            <td className="px-1 py-1 border">
                              {item.ErrorName}
                            </td>
                            <td className="px-1 py-1 border">
                              {item.ErrorOn &&
                                item.ErrorOn.replace("T", " ").replace("Z", "")}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} className="text-center py-4">
                            No data found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Right Side - Controls and Summary */}
            <div className="w-full md:w-[30%] flex flex-col gap-2 overflow-x-hidden">
              <div className="bg-white border border-gray-300 rounded-md p-4">
                <h4 className="flex items-center justify-center font-semibold mb-3">
                  Grouping Condition
                </h4>
                <div className="flex flex-wrap items-center gap-4">
                  <SelectField
                    label="Group By"
                    options={groupingOptions}
                    value={groupingCondition.value}
                    onChange={(e) => {
                      const selected = groupingOptions.find(
                        (item) => item.value === e.target.value
                      );
                      setGroupingCondition(selected);
                    }}
                  />
                </div>
              </div>

              {/* Summary Table */}
              <div className="w-full max-h-[500px] overflow-x-auto">
                {loading ? (
                  <Loader />
                ) : (
                  <table className="min-w-full border bg-white text-xs text-left rounded-lg table-auto">
                    <thead className="bg-gray-200 sticky top-0 z-10 text-center">
                      <tr>
                        <th className="px-1 py-1 border min-w-[120px]">
                          {groupingCondition.label}
                        </th>
                        <th className="px-1 py-1 border min-w-[120px]">
                          Count
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {getGroupedData().length > 0 ? (
                        getGroupedData().map((item, index) => (
                          <tr
                            key={index}
                            className="hover:bg-gray-100 text-center"
                          >
                            <td className="px-1 py-1 border">{item.key}</td>
                            <td className="px-1 py-1 border">{item.count}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={2} className="text-center py-4">
                            No data.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ErrorLog;