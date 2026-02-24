import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Title from "../../components/ui/Title";
import Button from "../../components/ui/Button";
import DateTimePicker from "../../components/ui/DateTimePicker";
import ExportButton from "../../components/ui/ExportButton";
import axios from "axios";
import toast from "react-hot-toast";
import Loader from "../../components/ui/Loader";
import { FaCaretUp, FaCaretDown } from "react-icons/fa";
import { baseURL } from "../../assets/assets";

const NFCReport = () => {
  const [loading, setLoading] = useState(false);
  const [ydayLoading, setYdayLoading] = useState(false);
  const [todayLoading, setTodayLoading] = useState(false);
  const [monthLoading, setMonthLoading] = useState(false);

  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [nfcReportData, setNfcReportData] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(1000);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedModelName, setSelectedModelName] = useState(null);

  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

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
    [loading, hasMore],
  );

  const fetchNFCReportData = async (pageNumber = 1) => {
    if (!startTime || !endTime) {
      toast.error("Please select Time Range.");
      return;
    }

    try {
      setLoading(true);
      const params = {
        startDate: startTime,
        endDate: endTime,
        page: pageNumber,
        limit,
      };

      const res = await axios.get(`${baseURL}prod/nfc-details`, { params });

      if (res?.data?.success) {
        setNfcReportData((prev) => {
          const existing = new Set(prev.map((d) => d.FG_SR));
          const uniqueNew = res.data.data.filter(
            (item) => !existing.has(item.FG_SR),
          );
          return [...prev, ...uniqueNew];
        });

        if (pageNumber === 1) {
          setTotalCount(res?.data?.totalCount);
        }

        setHasMore(res?.data?.data.length > 0);
      }
    } catch (error) {
      console.error("Failed to fetch NFC Report data:", error);
      toast.error("Failed to fetch NFC Report data.");
    } finally {
      setLoading(false);
    }
  };

  const fetchExportData = async () => {
    if (!startTime || !endTime) {
      toast.error("Please select Time Range.");
      return;
    }
    try {
      const params = {
        startDate: startTime,
        endDate: endTime,
      };
      const res = await axios.get(`${baseURL}prod/export-nfc-report`, {
        params,
      });
      return res?.data?.success ? res?.data?.data : [];
    } catch (error) {
      console.error("Failed to fetch export NFC Report data:", error);
      toast.error("Failed to fetch export NFC Report data.");
      return [];
    }
  };

  // Quick Filters
  const fetchYesterdaynfcReportData = async () => {
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

      setNfcReportData([]);
      setTotalCount(0);

      const params = {
        startDate: formattedStart,
        endDate: formattedEnd,
      };

      const res = await axios.get(`${baseURL}prod/yday-nfc-report`, {
        params,
      });

      if (res?.data?.success) {
        setNfcReportData(res?.data?.data);
        setTotalCount(res?.data?.totalCount);
      }
    } catch (error) {
      console.error("Failed to fetch Yesterday NFC Report data:", error);
      toast.error("Failed to fetch Yesterday NFC Report data.");
    } finally {
      setYdayLoading(false);
    }
  };

  const fetchTodaynfcReportData = async () => {
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

      setNfcReportData([]);
      setTotalCount(0);

      const params = {
        startDate: formattedStart,
        endDate: formattedEnd,
      };

      const res = await axios.get(`${baseURL}prod/today-nfc-report`, {
        params,
      });
      if (res?.data?.success) {
        setNfcReportData(res?.data?.data);
        setTotalCount(res?.data?.totalCount);
      }
    } catch (error) {
      console.error("Failed to fetch Today NFC Report data:", error);
      toast.error("Failed to fetch Today NFC Report data.");
    } finally {
      setTodayLoading(false);
    }
  };

  const fetchMTDnfcReportData = async () => {
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

      setNfcReportData([]);
      setTotalCount(0);

      const params = {
        startDate: formattedStart,
        endDate: formattedEnd,
      };

      const res = await axios.get(`${baseURL}prod/month-nfc-report`, {
        params,
      });

      if (res?.data?.success) {
        setNfcReportData(res?.data?.data);
        setTotalCount(res?.data?.totalCount);
      }
    } catch (error) {
      console.error("Failed to fetch this Month NFC Report data:", error);
      toast.error("Failed to fetch this Month NFC Report data.");
    } finally {
      setMonthLoading(false);
    }
  };

  useEffect(() => {
    if (page === 1) return;
    page;
  }, [page]);

  const handleQuery = () => {
    setPage(1);
    setNfcReportData([]);
    setHasMore(false);
    fetchNFCReportData(1);
  };

  const getModelNameCount = (data) => {
    const counts = {};
    data.forEach((item) => {
      const modelName = item.Model_Name || "Unknown";
      counts[modelName] = (counts[modelName] || 0) + 1;
    });
    return counts;
  };

  const filterednfcReportData = selectedModelName
    ? nfcReportData.filter((item) => item.Model_Name === selectedModelName)
    : nfcReportData;

  const handleModelRowClick = (modelName) => {
    setSelectedModelName((prevSelectedModel) =>
      prevSelectedModel === modelName ? null : modelName,
    );
  };

  const sortedData = useMemo(() => {
    let sortableItems = [...filterednfcReportData];
    if (sortConfig.key !== null) {
      sortableItems.sort((a, b) => {
        const aVal = a[sortConfig.key] || "";
        const bVal = b[sortConfig.key] || "";
        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [filterednfcReportData, sortConfig]);

  const requestSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  return (
    <div className="p-4 md:p-6 bg-gray-100 min-h-screen rounded-lg">
      <Title title="NFC Report" align="center" />

      {/* ================= FILTERS SECTION ================= */}
      <div className="flex flex-col lg:flex-row gap-4 mt-4">
        {/* Date Filters */}
        <div className="bg-purple-100 border border-dashed border-purple-400 p-4 rounded-xl w-full lg:w-auto">
          <div className="flex flex-col sm:flex-row gap-4">
            <DateTimePicker
              label="Start Time"
              name="startTime"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full sm:max-w-64"
            />
            <DateTimePicker
              label="End Time"
              name="endTime"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full sm:max-w-64"
            />
          </div>
        </div>

        {/* Query + Export */}
        <div className="bg-purple-100 border border-dashed border-purple-400 p-4 rounded-xl w-full lg:w-auto">
          <div className="flex flex-col items-center gap-3">
            <div className="flex gap-2 flex-wrap justify-center">
              <Button
                onClick={handleQuery}
                bgColor={loading ? "bg-gray-400" : "bg-blue-500"}
                textColor="text-black"
                className={`font-semibold ${loading ? "cursor-not-allowed" : ""}`}
                disabled={loading}
              >
                Query
              </Button>

              {nfcReportData.length > 0 && (
                <ExportButton
                  fetchData={fetchExportData}
                  filename="Total_Production_Report"
                />
              )}
            </div>

            <div className="font-bold text-lg">
              COUNT: <span className="text-blue-700">{sortedData.length}</span>
            </div>
          </div>
        </div>

        {/* Quick Filters */}
        <div className="bg-purple-100 border border-dashed border-purple-400 p-4 rounded-xl w-full lg:w-auto">
          <h2 className="text-lg font-semibold text-center mb-3">
            Quick Filters
          </h2>

          <div className="flex flex-wrap gap-3 justify-center">
            <Button
              bgColor={ydayLoading ? "bg-gray-400" : "bg-yellow-500"}
              textColor={ydayLoading ? "text-white" : "text-black"}
              className={`font-semibold ${
                ydayLoading ? "cursor-not-allowed" : "cursor-pointer"
              }`}
              onClick={fetchYesterdaynfcReportData}
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
              onClick={fetchTodaynfcReportData}
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
              onClick={fetchMTDnfcReportData}
              disabled={monthLoading}
            >
              MTD
            </Button>
            {monthLoading && <Loader />}
          </div>
        </div>
      </div>

      {/* ================= NFC REPORT SUMMARY ================= */}
      <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-6 rounded-xl">
        <div className="bg-white border border-gray-300 rounded-md p-4">
          {/* Responsive Tables Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* MAIN NFC TABLE */}
            <div className="lg:col-span-2 overflow-x-auto max-h-[600px]">
              <table className="min-w-[900px] w-full border bg-white text-xs rounded-lg">
                <thead className="bg-gray-200 sticky top-0 z-10">
                  <tr className="text-center">
                    {[
                      { label: "Model Name", key: "Model_Name" },
                      { label: "FG Serial No.", key: "FG_SR" },
                      { label: "Asset Tag", key: "Asset_tag" },
                      { label: "Customer QR", key: "CustomerQR" },
                      { label: "NFC UID", key: "NFC_UID" },
                      { label: "Created On", key: "CreatedOn" },
                    ].map((col) => (
                      <th
                        key={col.key}
                        onClick={() => requestSort(col.key)}
                        className="px-2 py-2 border cursor-pointer whitespace-nowrap"
                      >
                        <div className="flex items-center justify-between gap-1">
                          {col.label}
                          {sortConfig.key === col.key ? (
                            sortConfig.direction === "asc" ? (
                              <FaCaretUp />
                            ) : (
                              <FaCaretDown />
                            )
                          ) : (
                            <FaCaretUp className="opacity-30" />
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {sortedData.map((item, index) => {
                    const isLast = index === sortedData.length - 1;
                    return (
                      <tr
                        key={index}
                        ref={isLast ? lastRowRef : null}
                        className="hover:bg-gray-100 text-center"
                      >
                        <td className="px-2 py-1 border">{item.Model_Name}</td>
                        <td className="px-2 py-1 border">{item.FG_SR}</td>
                        <td className="px-2 py-1 border">{item.Asset_tag}</td>
                        <td className="px-2 py-1 border">{item.CustomerQR}</td>
                        <td className="px-2 py-1 border">{item.NFC_UID}</td>
                        <td className="px-2 py-1 border whitespace-nowrap">
                          {item.CreatedOn?.replace("T", " ").replace("Z", "")}
                        </td>
                      </tr>
                    );
                  })}

                  {!loading && sortedData.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-4 text-center">
                        No data found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {loading && (
                <div className="py-4 flex justify-center">
                  <Loader />
                </div>
              )}
            </div>

            {/* MODEL COUNT TABLE */}
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full border bg-white text-xs rounded-lg">
                <thead className="sticky top-0 bg-gray-100">
                  <tr className="text-center">
                    <th className="px-3 py-2 border">Model Name</th>
                    <th className="px-3 py-2 border">Count</th>
                  </tr>
                </thead>

                <tbody>
                  {Object.entries(getModelNameCount(nfcReportData)).map(
                    ([modelName, count]) => (
                      <tr
                        key={modelName}
                        onClick={() => handleModelRowClick(modelName)}
                        className={`cursor-pointer text-center transition ${
                          selectedModelName === modelName
                            ? "bg-blue-100 font-semibold"
                            : "hover:bg-gray-100"
                        }`}
                      >
                        <td className="px-2 py-1 border">{modelName}</td>
                        <td className="px-2 py-1 border">{count}</td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NFCReport;
