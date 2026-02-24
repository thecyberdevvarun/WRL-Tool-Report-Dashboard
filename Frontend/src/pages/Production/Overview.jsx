import { useCallback, useEffect, useRef, useState } from "react";
import Title from "../../components/ui/Title";
import Button from "../../components/ui/Button";
import SelectField from "../../components/ui/SelectField";
import axios from "axios";
import DateTimePicker from "../../components/ui/DateTimePicker";
import Loader from "../../components/ui/Loader";
import ExportButton from "../../components/ui/ExportButton";
import toast from "react-hot-toast";
import { baseURL } from "../../assets/assets";
import {
  useGetModelVariantsQuery,
  useGetStagesQuery,
} from "../../redux/api/commonApi.js";

const Overview = () => {
  const [loading, setLoading] = useState(false);
  const [ydayLoading, setYdayLoading] = useState(false);
  const [todayLoading, setTodayLoading] = useState(false);
  const [monthLoading, setMonthLoading] = useState(false);

  const [selectedModelVariant, setSelectedModelVariant] = useState(null);
  const [selectedStage, setSelectedStage] = useState(null);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const [productionData, setProductionData] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(1000);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedModelName, setSelectedModelName] = useState(null);

  /* ===================== RTK QUERY ===================== */
  const {
    data: variants = [],
    isLoading: variantsLoading,
    error: variantsError,
  } = useGetModelVariantsQuery();

  const {
    data: stages = [],
    isLoading: stagesLoading,
    error: stagesError,
  } = useGetStagesQuery();

  useEffect(() => {
    if (variantsError) toast.error("Failed to load model variants");
    if (stagesError) toast.error("Failed to load stages");
  }, [variantsError, stagesError]);

  /* ===================== INFINITE SCROLL ===================== */
  const observer = useRef();

  const lastRowRef = useCallback(
    (node) => {
      if (loading) return;
      if (observer.current) observer.current.disconnect();

      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          setPage((prev) => prev + 1);
        }
      });

      if (node) observer.current.observe(node);
    },
    [loading, hasMore]
  );

  /* ===================== API CALLS ===================== */
  const fetchProductionData = async (pageNumber = 1) => {
    if (!startTime || !endTime || (!selectedModelVariant && !selectedStage)) {
      toast.error("Please select Stage and Time Range.");
      return;
    }

    try {
      setLoading(true);

      const params = {
        startTime,
        endTime,
        page: pageNumber,
        limit,
        stationCode: selectedStage?.value || null,
        model: selectedModelVariant ? Number(selectedModelVariant.value) : 0,
      };

      const res = await axios.get(`${baseURL}prod/fgdata`, { params });

      if (res?.data?.success) {
        setProductionData((prev) =>
          pageNumber === 1 ? res.data.data : [...prev, ...res.data.data]
        );
        if (pageNumber === 1) setTotalCount(res.data.totalCount);
        setHasMore(res.data.data.length > 0);
      }
    } catch (error) {
      toast.error("Failed to fetch production data.");
    } finally {
      setLoading(false);
    }
  };

  /* ===================== QUICK FILTERS ===================== */
  const getFormattedDate = (date) => {
    const pad = (n) => (n < 10 ? `0${n}` : n);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
      date.getDate()
    )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const fetchQuickData = async (url, start, end, setLoader) => {
    try {
      setLoader(true);
      setProductionData([]);
      setTotalCount(0);

      const params = {
        startTime: start,
        endTime: end,
        stationCode: selectedStage?.value || null,
        model: selectedModelVariant ? Number(selectedModelVariant.value) : 0,
      };

      const res = await axios.get(`${baseURL}${url}`, { params });

      if (res?.data?.success) {
        setProductionData(res.data.data);
        setTotalCount(res.data.totalCount);
      }
    } catch {
      toast.error("Failed to fetch data");
    } finally {
      setLoader(false);
    }
  };

  const fetchYesterdayProductionData = () => {
    const now = new Date();
    const today8AM = new Date(now.setHours(8, 0, 0, 0));
    const yesterday8AM = new Date(today8AM);
    yesterday8AM.setDate(today8AM.getDate() - 1);

    fetchQuickData(
      "prod/yday-fgdata",
      getFormattedDate(yesterday8AM),
      getFormattedDate(today8AM),
      setYdayLoading
    );
  };

  const fetchTodayProductionData = () => {
    const now = new Date();
    const today8AM = new Date(now.setHours(8, 0, 0, 0));

    fetchQuickData(
      "prod/today-fgdata",
      getFormattedDate(today8AM),
      getFormattedDate(new Date()),
      setTodayLoading
    );
  };

  const fetchMTDProductionData = () => {
    const now = new Date();
    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
      8,
      0,
      0
    );

    fetchQuickData(
      "prod/month-fgdata",
      getFormattedDate(startOfMonth),
      getFormattedDate(now),
      setMonthLoading
    );
  };

  /* ===================== AGGREGATION ===================== */
  const aggregateProductionData = () => {
    const map = {};

    productionData.forEach((item) => {
      const model = item.Model_Name;
      const serial = item.FG_SR || item.Assembly_Sr_No;
      if (!serial) return;

      if (!map[model]) {
        map[model] = { start: serial, end: serial, count: 1 };
      } else {
        map[model].count += 1;
        map[model].start = Math.min(map[model].start, serial);
        map[model].end = Math.max(map[model].end, serial);
      }
    });

    return Object.entries(map).map(([k, v]) => ({
      Model_Name: k,
      StartSerial: v.start,
      EndSerial: v.end,
      TotalCount: v.count,
    }));
  };

  /* ===================== EFFECTS ===================== */
  useEffect(() => {
    if (page > 1) fetchProductionData(page);
  }, [page]);

  const fetchExportData = async () => {
    if (startTime && endTime && (selectedModelVariant || selectedStage)) {
      try {
        const params = {
          startTime,
          endTime,
          stationCode: selectedStage?.value || null,
          model: selectedModelVariant
            ? parseInt(selectedModelVariant.value, 10)
            : 0,
        };

        const res = await axios.get(`${baseURL}prod/export-production-report`, {
          params,
        });

        if (res?.data?.success) {
          return res?.data?.data;
        }
        return [];
      } catch (error) {
        console.error("Failed to fetch export production data:", error);
        toast.error("Failed to fetch export production data.");
        return [];
      }
    } else {
      toast.error("Please select Stage and Time Range.");
    }
  };

  const handleFgData = () => {
    setProductionData([]);
    setPage(1);
    fetchProductionData(1);
    setSelectedModelName(null);
  };

  const handleClearFilters = () => {
    setSelectedModelName(null);
  };

  const filteredProductionData = selectedModelName
    ? productionData.filter((item) => item.Model_Name === selectedModelName)
    : productionData;

  const handleModelRowClick = (modelName) => {
    setSelectedModelName(modelName === selectedModelName ? null : modelName);
  };

  if (variantsLoading || stagesLoading) return <Loader />;

  return (
    <div className="min-h-screen bg-gray-100 p-4 overflow-x-hidden max-w-full">
      <Title title="Production Overview" align="center" />

      {/* Filters Section */}
      <div className="flex gap-4">
        <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-xl max-w-fit items-center">
          <div className="flex flex-wrap gap-2">
            <SelectField
              label="Model Variant"
              options={variants}
              value={selectedModelVariant?.value || ""}
              onChange={(e) =>
                setSelectedModelVariant(
                  variants.find((opt) => opt.value === e.target.value) || 0
                )
              }
              className="max-w-64"
            />

            <SelectField
              label="Stage Name"
              options={stages}
              value={selectedStage?.value || ""}
              onChange={(e) =>
                setSelectedStage(
                  stages.find((opt) => opt.value === e.target.value) || 0
                )
              }
              className="max-w-64"
            />
          </div>

          <div className="flex flex-wrap gap-2">
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
        </div>
        <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-xl max-w-fit items-center">
          <div className="flex flex-col items-center gap-2">
            <div className="flex flex-wrap gap-2 mt-4">
              <Button
                bgColor={loading ? "bg-gray-400" : "bg-blue-500"}
                textColor={loading ? "text-white" : "text-black"}
                className={`font-semibold ${
                  loading ? "cursor-not-allowed" : ""
                }`}
                onClick={() => handleFgData()}
                disabled={loading}
              >
                Query
              </Button>
              {productionData && productionData.length > 0 && (
                <ExportButton
                  fetchData={fetchExportData}
                  filename="Production_Report"
                />
              )}
            </div>

            <div className="mt-4 text-left font-bold text-lg">
              COUNT: <span className="text-blue-700">{totalCount || 0}</span>
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
              onClick={() => fetchYesterdayProductionData()}
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
              onClick={() => fetchTodayProductionData()}
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
              onClick={() => fetchMTDProductionData()}
              disabled={monthLoading}
            >
              MTD
            </Button>
            {monthLoading && <Loader />}
          </div>
        </div>
      </div>

      {/* Summary Section */}
      <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-xl">
        <div className="flex flex-col items-center mb-4">
          <span className="text-xl font-semibold">Summary</span>
        </div>

        <div className="bg-white border border-gray-300 rounded-md p-2">
          <div className="flex flex-wrap gap-1">
            {/* Right Side - Detailed Table */}
            <div className="w-full md:flex-1">
              <div className="w-full max-h-[600px] overflow-x-auto">
                <table className="min-w-full border bg-white text-xs text-left rounded-lg table-auto">
                  <thead className="bg-gray-200 sticky top-0 z-10 text-center">
                    <tr>
                      <th className="px-1 py-1 border max-w-[100px]">Sr.No.</th>
                      <th className="px-1 py-1 border min-w-[100px]">
                        Model_Name
                      </th>
                      <th className="px-1 py-1 border min-w-[100px]">
                        Model_No.
                      </th>
                      <th className="px-1 py-1 border min-w-[100px]">
                        Station_Code
                      </th>
                      <th className="px-1 py-1 border min-w-[100px]">
                        Assembly Sr.No
                      </th>
                      <th className="px-1 py-1 border min-w-[100px]">
                        Asset tag
                      </th>
                      <th className="px-1 py-1 border max-w-[100px]">
                        Customer_QR
                      </th>
                      <th className="px-1 py-1 border min-w-[100px]">
                        UserName
                      </th>
                      <th className="px-1 py-1 border min-w-[100px]">
                        FG Serial_No.
                      </th>
                      <th className="px-1 py-1 border min-w-[100px]">
                        CreatedOn
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProductionData.map((item, index) => {
                      const isLast =
                        index === filteredProductionData.length - 1;
                      return (
                        <tr
                          key={index}
                          ref={isLast ? lastRowRef : null}
                          className="hover:bg-gray-100 text-center"
                        >
                          <td className="px-1 py-1 border">
                            {item.SrNo || index + 1}
                          </td>
                          <td className="px-1 py-1 border">
                            {item.Model_Name}
                          </td>
                          <td className="px-1 py-1 border">{item.ModelName}</td>
                          <td className="px-1 py-1 border">
                            {item.StationCode}
                          </td>
                          <td className="px-1 py-1 border">
                            {item.Assembly_Sr_No}
                          </td>
                          <td className="px-1 py-1 border">{item.Asset_tag}</td>
                          <td className="px-1 py-1 border">
                            {item.Customer_QR}
                          </td>
                          <td className="px-1 py-1 border">{item.UserName}</td>
                          <td className="px-1 py-1 border">{item.FG_SR}</td>
                          <td className="px-1 py-1 border">
                            {item.CreatedOn?.replace("T", " ").replace("Z", "")}
                          </td>
                        </tr>
                      );
                    })}
                    {!loading && productionData.length === 0 && (
                      <tr>
                        <td colSpan={10} className="text-center py-4">
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
            <div className="w-full md:w-[30%] flex flex-col overflow-x-hidden">
              <div className="flex flex-wrap gap-2 items-center justify-center">
                {productionData && productionData.length > 0 && (
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
                        fetchData={aggregateProductionData}
                        filename="Production_Report"
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
                          Model_Name
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
                      {productionData.length > 0 ? (
                        aggregateProductionData().map((item, index) => (
                          <tr
                            key={index}
                            className={`hover:bg-gray-100 text-center cursor-pointer ${
                              selectedModelName === item.Model_Name
                                ? "bg-blue-100"
                                : "bg-white"
                            }`}
                            onClick={() => handleModelRowClick(item.Model_Name)}
                          >
                            <td className="px-1 py-1 border">
                              {item.Model_Name}
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

export default Overview;
