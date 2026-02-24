import { useEffect, useState } from "react";
import Title from "../../components/ui/Title";
import DateTimePicker from "../../components/ui/DateTimePicker";
import InputField from "../../components/ui/InputField";
import ExportButton from "../../components/ui/ExportButton";
import Button from "../../components/ui/Button";
import SelectField from "../../components/ui/SelectField";
import Loader from "../../components/ui/Loader";
import axios from "axios";
import toast from "react-hot-toast";
import { baseURL } from "../../assets/assets";

const HoldCabinateDetails = () => {
  const groupingOptions = [
    { label: "ModelNo", value: "modelno" },
    { label: "FGSerialNo", value: "fgserialno" },
    { label: "HoldReason", value: "holdreason" },
    { label: "CorrectiveAction", value: "correctiveaction" },
    { label: "HoldBy", value: "holdby" },
    { label: "Status", value: "status" },
  ];
  const State = [
    { label: "Hold", value: "hold" },
    { label: "Release", value: "release" },
    { label: "All", value: "all" },
  ];

  const [loading, setLoading] = useState(false);
  const [ydayLoading, setYdayLoading] = useState(false);
  const [todayLoading, setTodayLoading] = useState(false);
  const [monthLoading, setMonthLoading] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [state, setState] = useState(State[0]);
  const [holdCabinetDetails, setHoldCabinetDetails] = useState([]);
  const [groupingCondition, setGroupingCondition] = useState(
    groupingOptions[0]
  );
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [details, setDetails] = useState("");

  const fetchHoldCabietDetails = async () => {
    if (!startTime || !endTime || !state) {
      toast.error("Please select State and Time Range.");
      return;
    }

    try {
      setLoading(true);
      const params = {
        status: state.value,
        startDate: startTime,
        endDate: endTime,
      };
      const res = await axios.get(`${baseURL}quality/hold-cabinet-details`, {
        params,
      });

      if (res?.data?.success) {
        setHoldCabinetDetails(res?.data?.data);
        setTotalCount(res?.data?.totalCount);
      }
    } catch (error) {
      console.error("Failed to fetch Hold Cabiet Details data:", error);
      toast.error("Failed to fetch Hold Cabiet Details data.");
    } finally {
      setLoading(false);
    }
  };

  const fetchYesterdayHoldCabietDetails = async () => {
    if (!state) {
      toast.error("Please select a state.");
      return;
    }

    const now = new Date();
    const today8AM = new Date(now);
    today8AM.setHours(8, 0, 0, 0);

    const yesterday8AM = new Date(today8AM);
    yesterday8AM.setDate(today8AM.getDate() - 1); // Go to yesterday 8 AM

    const formatDate = (date) => {
      const pad = (n) => (n < 10 ? "0" + n : n);
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
        date.getDate()
      )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };

    const formattedStart = formatDate(yesterday8AM);
    const formattedEnd = formatDate(today8AM);

    try {
      setYdayLoading(true);

      setHoldCabinetDetails([]);
      setTotalCount(0);

      const params = {
        status: state.value,
        startDate: formattedStart,
        endDate: formattedEnd,
      };
      const res = await axios.get(`${baseURL}quality/hold-cabinet-details`, {
        params,
      });

      if (res?.data?.success) {
        setHoldCabinetDetails(res?.data?.data);
        setTotalCount(res?.data?.totalCount);
      }
    } catch (error) {
      console.error(
        "Failed to fetch Yesterday Hold Cabinet Details data:",
        error
      );
      toast.error("Failed to fetch Yesterday Hold Cabinet Details data.");
    } finally {
      setYdayLoading(false);
    }
  };

  const fetchTodayHoldCabietDetails = async () => {
    if (!state) {
      toast.error("Please select a state.");
      return;
    }

    const now = new Date();
    const today8AM = new Date(now);
    today8AM.setHours(8, 0, 0, 0); // Set to today 08:00 AM

    const formatDate = (date) => {
      const pad = (n) => (n < 10 ? "0" + n : n);
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
        date.getDate()
      )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };

    const formattedStart = formatDate(today8AM);
    const formattedEnd = formatDate(now); // Now = current time

    try {
      setTodayLoading(true);

      setHoldCabinetDetails([]);
      setTotalCount(0);

      const params = {
        status: state.value,
        startDate: formattedStart,
        endDate: formattedEnd,
      };
      const res = await axios.get(`${baseURL}quality/hold-cabinet-details`, {
        params,
      });

      if (res?.data?.success) {
        setHoldCabinetDetails(res?.data?.data);
        setTotalCount(res?.data?.totalCount);
      }
    } catch (error) {
      console.error("Failed to fetch Today Hold Cabinet Details data:", error);
      toast.error("Failed to fetch Today Hold Cabinet Details data.");
    } finally {
      setTodayLoading(false);
    }
  };

  const fetchMTDHoldCabinetDetails = async () => {
    if (!state) {
      toast.error("Please select a state.");
      return;
    }

    const now = new Date();
    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
      8,
      0,
      0
    ); // 1st day at 08:00 AM

    const formatDate = (date) => {
      const pad = (n) => (n < 10 ? "0" + n : n);
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
        date.getDate()
      )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };

    const formattedStart = formatDate(startOfMonth);
    const formattedEnd = formatDate(now);

    try {
      setMonthLoading(true);

      setHoldCabinetDetails([]);
      setTotalCount(0);

      const params = {
        status: state.value,
        startDate: formattedStart,
        endDate: formattedEnd,
      };

      const res = await axios.get(`${baseURL}quality/hold-cabinet-details`, {
        params,
      });

      if (res?.data?.success) {
        setHoldCabinetDetails(res?.data?.data);
        setTotalCount(res?.data?.totalCount);
      }
    } catch (error) {
      console.error("Failed to fetch MTD data:", error);
      toast.error("Failed to fetch MTD Hold Cabinet Details.");
    } finally {
      setMonthLoading(false);
    }
  };

  const getGroupedData = () => {
    if (!holdCabinetDetails.length || !groupingCondition) {
      return [];
    }

    const grouped = holdCabinetDetails.reduce((acc, item) => {
      const key = item[groupingCondition.label] || "Unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(grouped).map(([key, count]) => ({
      key,
      count,
    }));
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      setDetails(searchTerm);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const handleClearFilters = () => {
    setStartTime("");
    setEndTime("");
    setState(State[0]);
    setHoldCabinetDetails([]);
    setGroupingCondition(groupingOptions[0]);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 overflow-x-hidden max-w-full">
      <Title title="Hold Cabinate Details" align="center" />

      {/* Filters Section */}
      <div className="flex gap-4">
        <div className="bg-purple-100 border border-dashed border-purple-400 p-4 rounded-md max-w-4xl items-center">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 items-center justify-center gap-2">
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
              label="state"
              options={State}
              value={state.value}
              onChange={(e) => {
                const selected = State.find(
                  (item) => item.value === e.target.value
                );
                setState(selected);
              }}
              className="max-w-65"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 items-center justify-center gap-2">
            <InputField
              label="Search"
              type="text"
              placeholder="Enter details"
              className="w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="flex items-center justify-center">
              <div className="text-left font-bold text-lg">
                COUNT: <span className="text-blue-700">{totalCount || 0}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                bgColor={loading ? "bg-gray-400" : "bg-blue-500"}
                textColor={loading ? "text-white" : "text-black"}
                className={`font-semibold ${
                  loading ? "cursor-not-allowed" : ""
                }`}
                onClick={() => fetchHoldCabietDetails()}
                disabled={loading}
              >
                Query
              </Button>
              <ExportButton
                data={holdCabinetDetails}
                filename="hold_cabinet_details"
              />
            </div>
          </div>
        </div>
        <div className="bg-purple-100 border border-dashed border-purple-400 p-6 rounded-xl w-full max-w-xs">
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
              onClick={() => fetchYesterdayHoldCabietDetails()}
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
              onClick={() => fetchTodayHoldCabietDetails()}
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
              onClick={() => fetchMTDHoldCabinetDetails()}
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
                          ModelNo
                        </th>
                        <th className="px-1 py-1 border min-w-[120px]">
                          FGSerialNo
                        </th>
                        <th className="px-1 py-1 border min-w-[120px]">
                          HoldReason
                        </th>
                        <th className="px-1 py-1 border min-w-[120px]">
                          Hold Date
                        </th>
                        <th className="px-1 py-1 border min-w-[120px]">
                          HoldBy
                        </th>
                        <th className="px-1 py-1 border max-w-[120px]">
                          DaysOnHold
                        </th>
                        <th className="px-1 py-1 border min-w-[120px]">
                          CorrectiveAction
                        </th>
                        <th className="px-1 py-1 border min-w-[120px]">
                          ReleasedOn
                        </th>
                        <th className="px-1 py-1 border min-w-[120px]">
                          ReleasedBy
                        </th>
                        <th className="px-1 py-1 border min-w-[120px]">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {holdCabinetDetails &&
                        holdCabinetDetails
                          .filter((item) =>
                            details
                              ? item.ModelNo?.toLowerCase().includes(
                                  details.toLowerCase()
                                ) ||
                                item.FGSerialNo?.toLowerCase().includes(
                                  details.toLocaleLowerCase()
                                ) ||
                                item.HoldReason?.toLowerCase().includes(
                                  details.toLowerCase()
                                ) ||
                                item.HoldBy?.toLowerCase().includes(
                                  details.toLowerCase()
                                )
                              : true
                          )
                          .map((item, index) => (
                            <tr
                              key={index}
                              className="hover:bg-gray-100 text-center"
                            >
                              <td className="px-1 py-1 border">
                                {item.ModelNo}
                              </td>
                              <td className="px-1 py-1 border">
                                {item.FGSerialNo}
                              </td>
                              <td className="px-1 py-1 border">
                                {item.HoldReason}
                              </td>
                              <td className="px-1 py-1 border">
                                {item.HoldDate &&
                                  item.HoldDate.replace("T", " ").replace(
                                    "Z",
                                    ""
                                  )}
                              </td>
                              <td className="px-1 py-1 border">
                                {item.HoldBy}
                              </td>
                              <td className="px-1 py-1 border">
                                {item.DaysOnHold}
                              </td>
                              <td className="px-1 py-1 border">
                                {item.CorrectiveAction}
                              </td>
                              <td className="px-1 py-1 border">
                                {item.ReleasedOn &&
                                  item.ReleasedOn.replace("T", " ").replace(
                                    "Z",
                                    ""
                                  )}
                              </td>
                              <td className="px-1 py-1 border">
                                {item.ReleasedBy}
                              </td>
                              <td className="px-1 py-1 border">
                                {item.Status}
                              </td>
                            </tr>
                          ))}
                      {holdCabinetDetails.length === 0 && (
                        <tr>
                          <td colSpan={12} className="text-center py-4">
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
            <div className="w-full max-h-[500px] maxh md:w-[30%] flex flex-col gap-2 overflow-x-hidden">
              {/* Filter + Export Buttons */}
              <div className="flex flex-wrap gap-2 items-center justify-center my-4">
                <Button
                  bgColor="bg-white"
                  textColor="text-black"
                  className="border border-gray-400 hover:bg-gray-100 px-3 py-1"
                  onClick={handleClearFilters}
                >
                  Clear Filter
                </Button>
                <ExportButton
                  data={getGroupedData}
                  filename="hold_cabinet_details_summary"
                />
              </div>
              <div className="bg-white border border-gray-300 rounded-md p-4">
                <h4 className="font-semibold mb-3">Grouping Condition</h4>
                <div className="flex flex-wrap items-center gap-4">
                  <SelectField
                    label="Group"
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
              <div className="w-full overflow-x-auto">
                {loading ? (
                  <Loader />
                ) : (
                  <table className="min-w-full border bg-white text-xs text-left rounded-lg table-auto">
                    <thead className="bg-gray-200 sticky top-0 text-center">
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

export default HoldCabinateDetails;
