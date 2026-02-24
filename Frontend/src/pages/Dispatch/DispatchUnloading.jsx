import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import Title from "../../components/ui/Title";
import DateTimePicker from "../../components/ui/DateTimePicker";
import Button from "../../components/ui/Button";
import Loader from "../../components/ui/Loader";
import toast from "react-hot-toast";
import ExportButton from "../../components/ui/ExportButton";
import { baseURL } from "../../assets/assets";

const DispatchUnloading = () => {
  const [loading, setLoading] = useState(false);
  const [ydayLoading, setYdayLoading] = useState(false);
  const [todayLoading, setTodayLoading] = useState(false);
  const [monthLoading, setMonthLoading] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [fgUnloadingData, setFgUnloadingData] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(1000);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedModelName, setSelectedModelName] = useState(null);

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

  const fetchFgUnloadingData = async (pageNumber = 1) => {
    if (!startTime || !endTime) {
      toast.error("Please select Time Range.");
      return;
    }

    try {
      setLoading(true);

      const res = await axios.get(`${baseURL}dispatch/fg-unloading`, {
        params: {
          startDate: startTime,
          endDate: endTime,
          page: pageNumber,
          limit,
        },
      });

      if (res?.data?.success) {
        setFgUnloadingData((prev) => [...prev, ...res?.data?.data]);
        if (pageNumber === 1) {
          setTotalCount(res?.data?.totalCount);
        }
        setHasMore(res?.data?.data.length > 0);
      }
    } catch (error) {
      console.error("Failed to fetch Fg Unloading Data:", error);
      toast.error("Failed to fetch Fg Unloading Data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const aggregateFgUnloadingData = () => {
    const aggregatedData = {};

    fgUnloadingData.forEach((item) => {
      const modelName = item.ModelName;
      const serial = item.FGSerialNo;

      if (!serial) return;

      if (!aggregatedData[modelName]) {
        aggregatedData[modelName] = {
          startSerial: serial,
          endSerial: serial,
          count: 1,
        };
      } else {
        if (serial > aggregatedData[modelName].endSerial) {
          aggregatedData[modelName].endSerial = serial;
        }

        if (serial < aggregatedData[modelName].startSerial) {
          aggregatedData[modelName].startSerial = serial;
        }

        aggregatedData[modelName].count += 1;
      }
    });

    return Object.entries(aggregatedData)
      .map(([modelName, data]) => ({
        ModelName: modelName,
        StartSerial: data.startSerial,
        EndSerial: data.endSerial,
        TotalCount: data.count,
      }))
      .sort((a, b) => a.ModelName.localeCompare(b.ModelName)); // DESC by ModelName
  };

  useEffect(() => {
    if (page === 1) return;
    fetchFgUnloadingData(page);
  }, [page]);

  // Quick Filters
  const fetchYesterdayFgUnloadingData = async () => {
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

      setFgUnloadingData([]);
      setTotalCount(0);

      const res = await axios.get(`${baseURL}dispatch/quick-fg-unloading`, {
        params: {
          startDate: formattedStart,
          endDate: formattedEnd,
        },
      });

      if (res?.data?.success) {
        setFgUnloadingData(res?.data?.data);
        setTotalCount(res?.data?.totalCount);
      }
    } catch (error) {
      console.error("Failed to fetch Yesterday Fg Unloading Data:", error);
      toast.error(
        "Failed to fetch Yesterday Fg Unloading Data. Please try again."
      );
    } finally {
      setYdayLoading(false);
    }
  };

  const fetchTodayFgUnloadingData = async () => {
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

      setFgUnloadingData([]);
      setTotalCount(0);

      const res = await axios.get(`${baseURL}dispatch/quick-fg-unloading`, {
        params: {
          startDate: formattedStart,
          endDate: formattedEnd,
        },
      });

      if (res?.data?.success) {
        setFgUnloadingData(res?.data?.data);
        setTotalCount(res?.data?.totalCount);
      }
    } catch (error) {
      console.error("Failed to fetch Today Fg Unloading Data:", error);
      toast.error("Failed to fetch Today Fg Unloading Data. Please try again.");
    } finally {
      setTodayLoading(false);
    }
  };

  const fetchMTDFgUnloadingData = async () => {
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

      setFgUnloadingData([]);
      setTotalCount(0);

      const res = await axios.get(`${baseURL}dispatch/quick-fg-unloading`, {
        params: {
          startDate: formattedStart,
          endDate: formattedEnd,
        },
      });

      if (res?.data?.success) {
        setFgUnloadingData(res?.data?.data);
        setTotalCount(res?.data?.totalCount);
      }
    } catch (error) {
      console.error("Failed to fetch this Month Fg Unloading Data:", error);
      toast.error(
        "Failed to fetch this Month Fg Unloading Data. Please try again."
      );
    } finally {
      setMonthLoading(false);
    }
  };

  const handleQuery = () => {
    fetchFgUnloadingData(1);
  };

  const handleYesterdayQuery = () => {
    fetchYesterdayFgUnloadingData();
  };

  const handleTodayQuery = () => {
    fetchTodayFgUnloadingData();
  };

  const handleMonthQuery = () => {
    fetchMTDFgUnloadingData();
  };

  const filteredFgUnloadingData = selectedModelName
    ? fgUnloadingData
        .filter((item) => item.ModelName === selectedModelName)
        .sort((a, b) => b.FGSerialNo.localeCompare(a.FGSerialNo)) // Descending for alphanumeric
    : fgUnloadingData.sort((a, b) => b.FGSerialNo.localeCompare(a.FGSerialNo));

  const handleModelRowClick = (modelName) => {
    setSelectedModelName(modelName === selectedModelName ? null : modelName);
  };

  const handleClearFilters = () => {
    setSelectedModelName(null);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <Title title="Dispatch Unloading" align="center" />

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
                {fgUnloadingData && fgUnloadingData.length > 0 && (
                  <ExportButton data={fgUnloadingData} />
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

      <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-xl">
        <div className="bg-white border border-gray-300 rounded-md p-4">
          <div className="flex flex-wrap gap-4">
            <div className="w-full md:flex-1">
              <div className="w-full max-h-[600px] overflow-x-auto">
                <table className="min-w-full border bg-white text-xs text-left rounded-lg table-auto">
                  <thead className="bg-gray-200 sticky top-0 z-10 text-center">
                    <tr>
                      <th className="px-1 py-1 border min-w-[120px]">
                        Model Name
                      </th>
                      <th className="px-1 py-1 border min-w-[120px]">
                        FG Serial No.
                      </th>
                      <th className="px-1 py-1 border min-w-[120px]">
                        Asset Code
                      </th>
                      <th className="px-1 py-1 border min-w-[120px]">
                        Batch Code
                      </th>
                      <th className="px-1 py-1 border min-w-[120px]">
                        Scanner No.
                      </th>
                      <th className="px-1 py-1 border min-w-[120px]">
                        Date Time
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFgUnloadingData.map((item, index) => {
                      const isLast =
                        index === filteredFgUnloadingData.length - 1;
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
                          <td className="px-1 py-1 border">{item.BatchCode}</td>
                          <td className="px-1 py-1 border">{item.ScannerNo}</td>
                          <td className="px-1 py-1 border">
                            {item.DateTime &&
                              item.DateTime.replace("T", " ").replace("Z", "")}
                          </td>
                        </tr>
                      );
                    })}

                    {!loading && fgUnloadingData.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-4">
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
            <div className="md:w-[30%] flex flex-col overflow-x-hidden">
              <div className="flex flex-wrap gap-2 items-center justify-center">
                {fgUnloadingData && fgUnloadingData.length > 0 && (
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
                        fetchData={aggregateFgUnloadingData}
                        filename="Dispatch_Unloading_Report"
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
                        <th className="px-1 py-1 border min-w-[80px] md:min-w-[100px]">
                          Model Name
                        </th>
                        <th className="px-1 py-1 border min-w-[80px] md:min-w-[100px]">
                          StartSerial
                        </th>
                        <th className="px-1 py-1 border min-w-[80px] md:min-w-[100px]">
                          EndSerial
                        </th>
                        <th className="px-1 py-1 border min-w-[80px] md:min-w-[100px]">
                          Count
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {fgUnloadingData.length > 0 ? (
                        aggregateFgUnloadingData().map((item, index) => (
                          <tr
                            key={index}
                            className={`hover:bg-gray-100 text-center cursor-pointer ${
                              selectedModelName === item.ModelName
                                ? "bg-blue-100"
                                : "bg-white"
                            }`}
                            onClick={() => handleModelRowClick(item.ModelName)}
                          >
                            <td className="px-1 py-1 border">
                              {item.ModelName}
                            </td>

                            <td className="px-1 py-1 border">
                              {item.StartSerial}
                            </td>

                            <td className="px-1 py-1 border">
                              {item.EndSerial}
                            </td>

                            <td className="px-1 py-1 border">
                              {item.TotalCount}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="text-center py-4">
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

export default DispatchUnloading;
