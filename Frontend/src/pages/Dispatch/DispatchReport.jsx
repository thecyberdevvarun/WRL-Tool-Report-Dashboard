import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import Title from "../../components/ui/Title";
import SelectField from "../../components/ui/SelectField";
import DateTimePicker from "../../components/ui/DateTimePicker";
import Button from "../../components/ui/Button";
import Loader from "../../components/ui/Loader";
import toast from "react-hot-toast";
import ExportButton from "../../components/ui/ExportButton";
import { baseURL } from "../../assets/assets";

const DispatchReport = () => {
  const Status = [
    { label: "Completed", value: "completed" },
    { label: "Open", value: "open" },
  ];

  const [loading, setLoading] = useState(false);
  const [ydayLoading, setYdayLoading] = useState(false);
  const [todayLoading, setTodayLoading] = useState(false);
  const [monthLoading, setMonthLoading] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [status, setStatus] = useState(Status[0]);
  const [page, setPage] = useState(1);
  const [limit] = useState(1000);
  const [hasMore, setHasMore] = useState(false);
  const [fgDispatchData, setFgDispatchData] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedSessionID, setSelectedSessionID] = useState(null);

  const observer = useRef();
  const lastRowRef = useCallback(
    (node) => {
      if (loading) return;
      if (observer.current) observer.current.disconnect();

      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          setPage((prevPage) => prevPage + 1);
        }
      });
      if (node) observer.current.observe(node);
    },
    [loading, hasMore]
  );

  const fetchFgDispatchData = async (pageNumber = 1) => {
    if (!startTime || !endTime || !status) {
      toast.error("Please select Time Range and Status.");
      return;
    }
    try {
      setLoading(true);
      const res = await axios.get(`${baseURL}dispatch/fg-dispatch`, {
        params: {
          startDate: startTime,
          endDate: endTime,
          status: status.value,
          page: pageNumber,
          limit,
        },
      });

      if (res?.data?.success) {
        setFgDispatchData((prev) => [...prev, ...res?.data?.data]);
        if (pageNumber === 1) {
          setTotalCount(res?.data?.totalCount);
        }
        setHasMore(res?.data?.data.length > 0);
      }
    } catch (error) {
      console.error("Failed to fetch Fg Dispatch Data:", error);
      toast.error("Failed to fetch Fg Dispatch Data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const aggregateFgDispatchData = () => {
    const aggregatedData = {};

    fgDispatchData.forEach((item) => {
      const sessionID = item.Session_ID;

      if (!sessionID) return;

      if (!aggregatedData[sessionID]) {
        aggregatedData[sessionID] = {
          count: 1,
        };
      } else {
        // Increment count
        aggregatedData[sessionID].count += 1;
      }
    });

    // Convert aggregated data to array
    return Object.entries(aggregatedData).map(([sessionID, data]) => ({
      Session_ID: sessionID,
      TotalCount: data.count,
    }));
  };

  useEffect(() => {
    if (page === 1) return;
    fetchFgDispatchData(page);
  }, [page]);

  // Quick Filters
  const fetchYesterdayFgDispatchData = async () => {
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

      setFgDispatchData([]);
      setTotalCount(0);

      const res = await axios.get(`${baseURL}dispatch/quick-fg-dispatch`, {
        params: {
          startDate: formattedStart,
          endDate: formattedEnd,
          status: status.value,
        },
      });

      if (res?.data?.success) {
        setFgDispatchData(res?.data?.data);
        setTotalCount(res?.data?.totalCount);
      }
    } catch (error) {
      console.error("Failed to fetch Yesterday Fg Dispatch Data:", error);
      toast.error(
        "Failed to fetch Yesterday Fg Dispatch Data. Please try again."
      );
    } finally {
      setYdayLoading(false);
    }
  };

  const fetchTodayFgDispatchData = async () => {
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

      setFgDispatchData([]);
      setTotalCount(0);

      const res = await axios.get(`${baseURL}dispatch/quick-fg-dispatch`, {
        params: {
          startDate: formattedStart,
          endDate: formattedEnd,
          status: status.value,
        },
      });

      if (res?.data?.success) {
        setFgDispatchData(res?.data?.data);
        setTotalCount(res?.data?.totalCount);
      }
    } catch (error) {
      console.error("Failed to fetch Today Fg Dispatch Data:", error);
      toast.error("Failed to fetch Today Fg Dispatch Data. Please try again.");
    } finally {
      setTodayLoading(false);
    }
  };

  const fetchMTDFgDispatchData = async () => {
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

      setFgDispatchData([]);
      setTotalCount(0);

      const res = await axios.get(`${baseURL}dispatch/quick-fg-dispatch`, {
        params: {
          startDate: formattedStart,
          endDate: formattedEnd,
          status: status.value,
        },
      });

      if (res?.data?.success) {
        setFgDispatchData(res?.data?.data);
        setTotalCount(res?.data?.totalCount);
      }
    } catch (error) {
      console.error("Failed to fetch this Month Fg Dispatch Data:", error);
      toast.error(
        "Failed to fetch this Month Fg Dispatch Data. Please try again."
      );
    } finally {
      setMonthLoading(false);
    }
  };

  const handleQuery = () => {
    fetchFgDispatchData(1);
  };

  const handleYesterdayQuery = () => {
    fetchYesterdayFgDispatchData();
  };

  const handleTodayQuery = () => {
    fetchTodayFgDispatchData();
  };

  const handleMonthQuery = () => {
    fetchMTDFgDispatchData();
  };

  const filteredFgDispatchData = selectedSessionID
    ? fgDispatchData.filter((item) => item.Session_ID === selectedSessionID)
    : fgDispatchData;

  const handleModelRowClick = (sessionID) => {
    setSelectedSessionID(sessionID === selectedSessionID ? null : sessionID);
  };

  const handleClearFilters = () => {
    setSelectedSessionID(null);
  };
  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <Title title="Dispatch Report" align="center" />

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
            label="Status"
            options={Status}
            value={status.value}
            onChange={(e) => {
              const selected = Status.find(
                (item) => item.value === e.target.value
              );
              setStatus(selected);
            }}
            className="max-w-32"
          />
        </div>
        <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-xl">
          {/* Buttons and Checkboxes */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex flex-col items-center gap-4">
              <div className="flex gap-2">
                <Button
                  bgColor={loading ? "bg-gray-400" : "bg-blue-500"}
                  textColor={loading ? "text-white" : "text-black"}
                  className={`font-semibold ${
                    loading ? "cursor-not-allowed" : ""
                  }`}
                  onClick={handleQuery}
                  disabled={loading}
                >
                  Query
                </Button>
                {fgDispatchData && fgDispatchData.length > 0 && (
                  <ExportButton data={fgDispatchData} />
                )}
              </div>
              <div className="text-left font-bold text-lg">
                COUNT: <span className="text-blue-700">{totalCount}</span>
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
              onClick={() => handleMonthQuery()}
              disabled={monthLoading}
            >
              MTD
            </Button>
            {monthLoading && <Loader />}
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-xl">
        <div className="bg-white border border-gray-300 rounded-md p-4">
          <div className="flex flex-col md:flex-row md:flex-nowrap gap-4">
            <div className="w-full md:flex-1 md:min-w-0">
              <div className="w-full max-h-[600px] overflow-x-auto">
                <table className="min-w-full border bg-white text-xs text-left rounded-lg table-auto">
                  <thead className="bg-gray-200 sticky top-0 z-10 text-center">
                    <tr>
                      <th className="px-1 py-1 border min-w-[100px]">
                        Model Name
                      </th>
                      <th className="px-1 py-1 border min-w-[100px]">
                        FG Serial No.
                      </th>
                      <th className="px-1 py-1 border min-w-[100px]">
                        Asset Code
                      </th>
                      <th className="px-1 py-1 border min-w-[100px]">
                        Session ID
                      </th>
                      <th className="px-1 py-1 border min-w-[100px]">
                        Added On
                      </th>
                      <th className="px-1 py-1 border min-w-[100px]">
                        Added By
                      </th>
                      <th className="px-1 py-1 border min-w-[100px]">
                        Document ID
                      </th>
                      <th className="px-1 py-1 border min-w-[100px]">
                        Model Code
                      </th>
                      <th className="px-1 py-1 border min-w-[100px]">
                        Dock No
                      </th>
                      <th className="px-1 py-1 border min-w-[100px]">
                        Vehicle No
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFgDispatchData.map((item, index) => {
                      const isLast =
                        index === filteredFgDispatchData.length - 1;

                      return (
                        <tr
                          key={index}
                          ref={isLast ? lastRowRef : null}
                          className="hover:bg-gray-100 text-center"
                        >
                          <td className="px-1 py-1 border">{item.ModelName}</td>

                          <td className="px-1 py-1 border">
                            {item.FGSerialNo}
                          </td>

                          <td className="px-1 py-1 border">{item.AssetCode}</td>

                          <td className="px-1 py-1 border">
                            {item.Session_ID}
                          </td>

                          <td className="px-1 py-1 border">
                            {item.AddedOn &&
                              item.AddedOn.replace("T", " ").replace("Z", "")}
                          </td>

                          <td className="px-1 py-1 border">{item.AddedBy}</td>

                          <td className="px-1 py-1 border">
                            {item.Document_ID}
                          </td>

                          <td className="px-1 py-1 border">{item.ModelCode}</td>

                          <td className="px-1 py-1 border">{item.DockNo}</td>

                          <td className="px-1 py-1 border">
                            {item.Vehicle_No}
                          </td>
                        </tr>
                      );
                    })}
                    {!loading && fgDispatchData.length === 0 && (
                      <tr>
                        <td colSpan={12} className="text-center py-4">
                          No data found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {loading && <Loader />}
              </div>
            </div>

            {/* Left Side - Controls and Summary */}
            <div className="w-full max-w-[20%] flex flex-col overflow-x-hidden">
              <div className="flex flex-wrap gap-2 items-center justify-center">
                {fgDispatchData && fgDispatchData.length > 0 && (
                  <>
                    <div className="flex my-4 gap-2">
                      <Button
                        bgColor="bg-white"
                        textColor="text-black"
                        className="border border-gray-400 hover:bg-gray-100 px-3 py-1"
                        onClick={handleClearFilters}
                      >
                        Clear Filter
                      </Button>
                      <ExportButton
                        fetchData={aggregateFgDispatchData}
                        filename="Dispatch_Report"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="w-full max-h-[500px] overflow-x-auto">
                {loading ? (
                  <Loader />
                ) : (
                  <table className="min-w-full border bg-white text-xs text-left rounded-lg table-auto">
                    <thead className="bg-gray-200 sticky top-0 z-10 text-center">
                      <tr>
                        <th className="px-1 py-1 border min-w-[100px]">
                          Session ID
                        </th>
                        <th className="px-1 py-1 border min-w-[100px]">
                          Count
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {fgDispatchData.length > 0 ? (
                        aggregateFgDispatchData().map((item, index) => (
                          <tr
                            key={index}
                            className={`hover:bg-gray-100 text-center cursor-pointer ${
                              selectedSessionID === item.Session_ID
                                ? "bg-blue-100"
                                : "bg-white"
                            }`}
                            onClick={() => handleModelRowClick(item.Session_ID)}
                          >
                            <td className="px-1 py-1 border">
                              {item.Session_ID}
                            </td>
                            <td className="px-1 py-1 border">
                              {item.TotalCount}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={2} className="text-center py-4">
                            No data found.
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

export default DispatchReport;
