import { useEffect, useMemo, useState } from "react";
import Button from "../../components/ui/Button";
import Title from "../../components/ui/Title";
import DateTimePicker from "../../components/ui/DateTimePicker";
import SelectField from "../../components/ui/SelectField";
import InputField from "../../components/ui/InputField";
import axios from "axios";
import toast from "react-hot-toast";
import ExportButton from "../../components/ui/ExportButton";
import { baseURL } from "../../assets/assets";
import Loader from "../../components/ui/Loader";
import { useGetModelVariantsQuery } from "../../redux/api/commonApi.js";

const LPTReport = () => {
  const [loading, setLoading] = useState(false);
  const [ydayLoading, setYdayLoading] = useState(false);
  const [todayLoading, setTodayLoading] = useState(false);
  const [monthLoading, setMonthLoading] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [selectedModelVariant, setSelectedModelVariant] = useState(null);
  const [reportData, setReportData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [details, setDetails] = useState("");

  const {
    data: variants = [],
    isLoading: variantsLoading,
    error: variantsError,
  } = useGetModelVariantsQuery();

  useEffect(() => {
    if (variantsError) toast.error("Failed to load model variants");
  }, [variantsError]);

  const handleQuery = async () => {
    if (!startTime || !endTime) {
      toast.error("Please select Time Range.");
      return;
    }

    try {
      setLoading(true);
      let params = {
        startDate: startTime,
        endDate: endTime,
      };

      if (selectedModelVariant && selectedModelVariant.value) {
        params = {
          ...params,
          model: selectedModelVariant.label,
        };
      }
      const res = await axios.get(`${baseURL}quality/lpt-report`, { params });
      if (res?.data?.success) {
        setReportData(res?.data?.data);
        setSelectedModelVariant(null);
      }
    } catch (error) {
      console.error("Failed to fetch LPT Report:", error);
      toast.error("Failed to fetch LPT Report.");
    } finally {
      setLoading(false);
    }
  };

  // Quick Filters
  const handleYesterdayQuery = async () => {
    const now = new Date();
    const today8AM = new Date(now);
    today8AM.setHours(8, 0, 0, 0);

    const yesterday8AM = new Date(today8AM);
    yesterday8AM.setDate(today8AM.getDate() - 1); // Go to yesterday 8 AM

    const formatDate = (date) => {
      const pad = (n) => (n < 10 ? "0" + n : n);
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
        date.getDate(),
      )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };

    const formattedStart = formatDate(yesterday8AM);
    const formattedEnd = formatDate(today8AM);

    try {
      setYdayLoading(true);

      setReportData([]);
      setSelectedModelVariant(null);

      let params = {
        startDate: formattedStart,
        endDate: formattedEnd,
      };

      if (selectedModelVariant && selectedModelVariant.value) {
        params = {
          ...params,
          model: selectedModelVariant.label,
        };
      }

      const res = await axios.get(`${baseURL}quality/lpt-report`, { params });
      if (res?.data?.success) {
        setReportData(res?.data?.data);
        setSelectedModelVariant(null);
      }
    } catch (error) {
      console.error("Failed to fetch Yesterday LPT Report:", error);
      toast.error("Failed to fetch Yesterday LPT Report.");
    } finally {
      setYdayLoading(false);
    }
  };

  const handleTodayQuery = async () => {
    const now = new Date();
    const today8AM = new Date(now);
    today8AM.setHours(8, 0, 0, 0); // Set to today 08:00 AM

    const formatDate = (date) => {
      const pad = (n) => (n < 10 ? "0" + n : n);
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
        date.getDate(),
      )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };

    const formattedStart = formatDate(today8AM);
    const formattedEnd = formatDate(now); // Now = current time

    try {
      setTodayLoading(true);

      setReportData([]);
      setSelectedModelVariant(null);

      let params = {
        startDate: formattedStart,
        endDate: formattedEnd,
      };

      if (selectedModelVariant && selectedModelVariant.value) {
        params = {
          ...params,
          model: selectedModelVariant.label,
        };
      }

      const res = await axios.get(`${baseURL}quality/lpt-report`, { params });
      if (res?.data?.success) {
        setReportData(res?.data?.data);
        setSelectedModelVariant(null);
      }
    } catch (error) {
      console.error("Failed to fetch Today LPT Report:", error);
      toast.error("Failed to fetch Today LPT Report.");
    } finally {
      setTodayLoading(false);
    }
  };

  const handleMTDQuery = async () => {
    const now = new Date();
    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
      8,
      0,
      0,
    ); // 1st day at 08:00 AM

    const formatDate = (date) => {
      const pad = (n) => (n < 10 ? "0" + n : n);
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
        date.getDate(),
      )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };

    const formattedStart = formatDate(startOfMonth);
    const formattedEnd = formatDate(now);

    try {
      setMonthLoading(true);

      setReportData([]);
      setSelectedModelVariant(null);

      let params = {
        startDate: formattedStart,
        endDate: formattedEnd,
      };

      if (selectedModelVariant && selectedModelVariant.value) {
        params = {
          ...params,
          model: selectedModelVariant.label,
        };
      }

      const res = await axios.get(`${baseURL}quality/lpt-report`, { params });
      if (res?.data?.success) {
        setReportData(res?.data?.data);
        setSelectedModelVariant(null);
      }
    } catch (error) {
      console.error("Failed to fetch Month LPT Report:", error);
      toast.error("Failed to fetch Month LPT Report.");
    } finally {
      setMonthLoading(false);
    }
  };

  const uniqueAssemblyNoCount = useMemo(() => {
    return new Set(reportData.map((item) => item.AssemblyNo)).size;
  }, [reportData]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      setDetails(searchTerm);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  if (variantsLoading) return <Loader />;

  return (
    <div className="min-h-screen bg-gray-100 p-4 overflow-x-hidden max-w-full">
      <Title title="LPT Report" align="center" />

      {/* Filters Section */}
      <div className="flex gap-2">
        <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-xl grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl items-center">
          <DateTimePicker
            label="Start Time"
            name="startTime"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
          <DateTimePicker
            label="End Time"
            name="endTime"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />

          <SelectField
            label="Model Variant"
            options={variants}
            value={selectedModelVariant?.value || ""}
            onChange={(e) =>
              setSelectedModelVariant(
                variants.find((opt) => opt.value === e.target.value) || null,
              )
            }
            className="max-w-64"
          />
          <InputField
            label="Search"
            type="text"
            placeholder="Enter details"
            className="w-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-xl">
          {/* Buttons and Checkboxes */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex flex-col items-center gap-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  bgColor={loading ? "bg-gray-400" : "bg-blue-500"}
                  textColor={loading ? "text-white" : "text-black"}
                  className={`font-semibold ${
                    loading ? "cursor-not-allowed" : ""
                  }`}
                  onClick={() => handleQuery()}
                  disabled={loading}
                >
                  Query
                </Button>
                {reportData && reportData.length > 0 && (
                  <ExportButton data={reportData} filename="LPT_Report" />
                )}
              </div>
              <div className="text-left font-bold text-lg">
                Sample Inspected:{" "}
                <span className="text-blue-700">
                  {uniqueAssemblyNoCount || "0"}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-xl max-w-fit">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 text-center">
            Quick Filters
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              bgColor={ydayLoading ? "bg-gray-400" : "bg-yellow-500"}
              textColor={ydayLoading ? "text-white" : "text-black"}
              className={`font-semibold ${
                ydayLoading ? "cursor-not-allowed" : "cursor-pointer"
              }`}
              onClick={() => handleYesterdayQuery()}
              disabled={ydayLoading}
            >
              YDAY
            </Button>
            {ydayLoading && <Loader />}
            <Button
              bgColor={todayLoading ? "bg-gray-400" : "bg-blue-500"}
              textColor={todayLoading ? "text-white" : "text-black"}
              className={`font-semibold ${
                todayLoading ? "cursor-not-allowed" : "cursor-pointer"
              }`}
              onClick={() => handleTodayQuery()}
              disabled={todayLoading}
            >
              TDAY
            </Button>
            {todayLoading && <Loader />}
            <Button
              bgColor={monthLoading ? "bg-gray-400" : "bg-green-500"}
              textColor={monthLoading ? "text-white" : "text-black"}
              className={`font-semibold ${
                monthLoading ? "cursor-not-allowed" : "cursor-pointer"
              }`}
              onClick={() => handleMTDQuery()}
              disabled={monthLoading}
            >
              MTD
            </Button>
            {monthLoading && <Loader />}
          </div>
        </div>
      </div>

      {/* Summary Section */}
      <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-md">
        <div className="bg-white border border-gray-300 rounded-md p-2">
          <div className="flex flex-col md:flex-row items-start gap-1">
            {/* Left Side */}
            <div className="w-full md:flex-1 flex flex-col gap-2">
              {/* Left Side Table */}
              <LptReportTable
                data={reportData.filter((item) =>
                  details
                    ? item.ModelName?.toLowerCase().includes(
                        details.toLowerCase(),
                      ) ||
                      item.AssemblyNo?.toLowerCase().includes(
                        details.toLocaleLowerCase(),
                      )
                    : true,
                )}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const LptReportTable = ({ data }) => {
  return (
    <div className="w-full max-h-[600px] overflow-x-auto">
      <table className="min-w-full border bg-white text-xs text-left rounded-lg table-auto">
        <thead className="bg-gray-200 text-center">
          <tr>
            <th className="px-1 py-1 border" rowSpan={2}>
              Sr.No.
            </th>
            <th className="px-1 py-1 border min-w-[120px]" rowSpan={2}>
              Date Time
            </th>
            <th className="px-1 py-1 border min-w-[120px]" rowSpan={2}>
              Shift
            </th>
            <th className="px-1 py-1 border min-w-[120px]" rowSpan={2}>
              Model
            </th>
            <th className="px-1 py-1 border min-w-[120px]" rowSpan={2}>
              Assembly No.
            </th>
            <th className="px-1 py-1 border" colSpan={3}>
              Temperature
            </th>
            <th className="px-1 py-1 border" colSpan={3}>
              Current
            </th>
            <th className="px-1 py-1 border" colSpan={3}>
              Power
            </th>
            <th className="px-1 py-1 border" rowSpan={2}>
              Performance
            </th>
          </tr>
          <tr>
            <th className="px-1 py-1 border min-w-[100px]">Min</th>
            <th className="px-1 py-1 border min-w-[100px]">Max</th>
            <th className="px-1 py-1 border min-w-[100px]">Actual</th>
            <th className="px-1 py-1 border min-w-[100px]">Min</th>
            <th className="px-1 py-1 border min-w-[100px]">Max</th>
            <th className="px-1 py-1 border min-w-[100px]">Actual</th>
            <th className="px-1 py-1 border min-w-[100px]">Min</th>
            <th className="px-1 py-1 border min-w-[100px]">Max</th>
            <th className="px-1 py-1 border min-w-[100px]">Actual</th>
          </tr>
        </thead>
        <tbody>
          {data && data.length > 0 ? (
            data.map((row, index) => (
              <tr key={index} className="hover:bg-gray-100 text-center">
                <td className="px-1 py-1 border">{row.SrNo}</td>
                <td className="px-1 py-1 border">
                  {row.DateTime &&
                    row.DateTime.replace("T", " ").replace("Z", "")}
                </td>
                <td className="px-1 py-1 border">{row.Shift}</td>
                <td className="px-1 py-1 border">{row.ModelName}</td>
                <td className="px-1 py-1 border">{row.AssemblyNo}</td>
                <td className="px-1 py-1 border">{row.minTemp}</td>
                <td className="px-1 py-1 border">{row.maxTemp}</td>
                <td className="px-1 py-1 border">{row.ActualTemp}</td>
                <td className="px-1 py-1 border">{row.minCurrent}</td>
                <td className="px-1 py-1 border">{row.maxCurrent}</td>
                <td className="px-1 py-1 border">{row.ActualCurrent}</td>
                <td className="px-1 py-1 border">{row.minPower}</td>
                <td className="px-1 py-1 border">{row.maxPower}</td>
                <td className="px-1 py-1 border">{row.ActualPower}</td>
                <td
                  className={`px-1 py-1 border border-black ${
                    row.Performance === "Pass"
                      ? "bg-green-500 text-white"
                      : "bg-red-500 text-white"
                  }`}
                >
                  {row.Performance}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={15} className="text-center py-4">
                No data found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default LPTReport;
