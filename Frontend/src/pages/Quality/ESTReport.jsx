import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import Title from "../../components/ui/Title";
import Loader from "../../components/ui/Loader";
import SelectField from "../../components/ui/SelectField";
import DateTimePicker from "../../components/ui/DateTimePicker";
import Button from "../../components/ui/Button";
import Pagination from "../../components/ui/Pagination.jsx";
import {
  useGetEstReportQuery,
  useGetEstReportSummaryQuery,
  useGetDistinctModelsQuery,
  useGetDistinctOperatorsQuery,
  useLazyGetEstReportQuickFilterQuery,
  useLazyGetExportDataQuery,
} from "../../redux/api/estReportApi";
import {
  setFilters,
  resetFilters,
  setSelectedRecord,
  setActiveQuickFilter,
  setDateRange,
  setPage,
  setLimit,
  setPagination,
} from "../../redux/estReportSlice";
import {
  getTodayRange,
  getYesterdayRange,
  getMTDRange,
  formatDateTimeLocal,
} from "../../utils/dateUtils";
import { exportToXls } from "../../utils/exportToXls.js";
import {
  FaShieldAlt,
  FaTint,
  FaBatteryFull,
  FaCheckCircle,
  FaTimesCircle,
  FaPlug,
  FaTable,
  FaUser,
  FaCalendarAlt,
  FaBarcode,
  FaCubes,
  FaDownload,
  FaSync,
  FaRedo,
} from "react-icons/fa";
import { MdFilterAlt } from "react-icons/md";
import { HiLightningBolt, HiOutlineDocumentReport } from "react-icons/hi";
import { BiSearchAlt, BiTime } from "react-icons/bi";
import { BsLightningChargeFill } from "react-icons/bs";
import { TbReportAnalytics } from "react-icons/tb";
import { IoMdStats } from "react-icons/io";
import { GiElectric } from "react-icons/gi";
import { VscCircuitBoard } from "react-icons/vsc";

// Detail Modal Component
import ESTDetailModal from "../../components/ESTDetailModal";

const ESTReport = () => {
  const dispatch = useDispatch();

  // Redux state - ADD pagination HERE
  const {
    filters,
    selectedRecord,
    isDetailModalOpen,
    activeQuickFilter,
    pagination,
  } = useSelector((state) => state.estReport);

  // Local state for date inputs
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  // RTK Query hooks - ADD pagination params
  const {
    data: reportData,
    isLoading: reportLoading,
    isFetching: reportFetching,
    refetch: refetchReport,
  } = useGetEstReportQuery(
    {
      startDate: filters.startDate,
      endDate: filters.endDate,
      model: filters.model,
      operator: filters.operator,
      result: filters.result,
      testType: filters.testType,
      page: pagination.page,
      limit: pagination.limit,
    },
    { skip: !filters.startDate || !filters.endDate },
  );

  const { data: summaryData, isLoading: summaryLoading } =
    useGetEstReportSummaryQuery(
      {
        startDate: filters.startDate,
        endDate: filters.endDate,
        model: filters.model,
      },
      { skip: !filters.startDate || !filters.endDate },
    );

  const { data: modelsData } = useGetDistinctModelsQuery();
  const { data: operatorsData } = useGetDistinctOperatorsQuery();

  // Lazy queries for quick filters
  const [triggerQuickFilter, { isLoading: quickFilterLoading }] =
    useLazyGetEstReportQuickFilterQuery();

  const [triggerExport, { isLoading: exportLoading }] =
    useLazyGetExportDataQuery();

  // UPDATE PAGINATION WHEN API RESPONSE CHANGES - ADD THIS useEffect
  useEffect(() => {
    if (reportData?.pagination) {
      dispatch(
        setPagination({
          totalPages: reportData.pagination.totalPages || 1,
          totalRecords: reportData.pagination.totalRecords || 0,
        }),
      );
    }
  }, [reportData, dispatch]);

  // Test type options
  const testTypeOptions = [
    { label: "All Tests", value: "all" },
    { label: "ECT Test", value: "ect" },
    { label: "HV Test", value: "hv" },
    { label: "IR Test", value: "ir" },
    { label: "LCT Test", value: "lct" },
  ];

  // Result options
  const resultOptions = [
    { label: "All Results", value: "" },
    { label: "Pass", value: "Pass" },
    { label: "Fail", value: "Fail" },
  ];

  // Models options from API
  const modelOptions = [
    { label: "All Models", value: "" },
    ...(modelsData?.data || []),
  ];

  // Operators options from API
  const operatorOptions = [
    { label: "All Operators", value: "" },
    ...(operatorsData?.data || []),
  ];

  // Handle Query button click
  const handleQuery = () => {
    if (!startTime || !endTime) {
      alert("Please select both start and end date/time");
      return;
    }
    dispatch(
      setDateRange({
        startDate: new Date(startTime).toISOString(),
        endDate: new Date(endTime).toISOString(),
      }),
    );
    dispatch(setActiveQuickFilter(null));
  };

  // Handle Quick Filter clicks
  const handleQuickFilter = async (filterType) => {
    let dateRange;
    switch (filterType) {
      case "today":
        dateRange = getTodayRange();
        break;
      case "yesterday":
        dateRange = getYesterdayRange();
        break;
      case "mtd":
        dateRange = getMTDRange();
        break;
      default:
        return;
    }

    dispatch(setDateRange(dateRange));
    dispatch(setActiveQuickFilter(filterType));

    // Update local date inputs
    setStartTime(formatDateTimeLocal(dateRange.startDate));
    setEndTime(formatDateTimeLocal(dateRange.endDate));
  };

  // Handle Export
  const handleExport = async () => {
    try {
      const result = await triggerExport({
        startDate: filters.startDate,
        endDate: filters.endDate,
        model: filters.model,
        operator: filters.operator,
        result: filters.result,
      }).unwrap();

      if (result?.data) {
        exportToXls(result.data, "EST_Report.xlsx");
      }
    } catch (error) {
      console.error("Export failed:", error);
      alert("Failed to export data");
    }
  };

  // Handle row click
  const handleRowClick = (record) => {
    dispatch(setSelectedRecord(record));
  };

  // Handle page change - ADD THIS FUNCTION
  const handlePageChange = (newPage) => {
    dispatch(setPage(newPage));
  };

  // Handle limit change - ADD THIS FUNCTION
  const handleLimitChange = (newLimit) => {
    dispatch(setLimit(newLimit));
  };

  // Handle Reset Filters - ADD THIS FUNCTION
  const handleResetFilters = () => {
    dispatch(resetFilters());
    setStartTime("");
    setEndTime("");
  };

  // Status Badge Component
  const StatusBadge = ({ status, size = "md" }) => {
    const isPass = status === "Pass" || status === 1;
    const sizeClasses =
      size === "lg" ? "px-4 py-2 text-lg gap-2" : "px-2 py-1 text-xs gap-1";
    const iconSize = size === "lg" ? 20 : 12;

    return (
      <span
        className={`${sizeClasses} rounded-full font-bold flex items-center ${
          isPass
            ? "bg-green-100 text-green-700 border border-green-400"
            : "bg-red-100 text-red-700 border border-red-400"
        }`}
      >
        {isPass ? (
          <FaCheckCircle size={iconSize} />
        ) : (
          <FaTimesCircle size={iconSize} />
        )}
        {isPass ? "PASS" : "FAIL"}
      </span>
    );
  };

  const estData = reportData?.data || [];
  // USE pagination.totalRecords instead of estData.length for total count
  const totalCount = pagination.totalRecords;

  const isLoading = reportLoading || reportFetching;

  return (
    <div className="p-6 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-center gap-3 mb-6">
        <GiElectric className="text-4xl text-purple-600" />
        <Title title="EST Report Dashboard" align="center" />
      </div>

      {/* Filters Section */}
      <div className="flex flex-wrap gap-4 items-start mb-6">
        {/* Box 1: Main Filters */}
        <div className="bg-white border border-purple-200 p-6 rounded-xl shadow-md flex-1 min-w-[400px]">
          <h2 className="text-lg font-semibold text-purple-700 mb-4 flex items-center gap-2">
            <BiSearchAlt className="text-xl" />
            Search Filters
          </h2>
          <div className="flex flex-wrap gap-4">
            {/* Test Type */}
            <div className="flex items-center gap-2">
              <MdFilterAlt className="text-purple-500" />
              <SelectField
                label="Test Type"
                options={testTypeOptions}
                value={filters.testType}
                onChange={(e) =>
                  dispatch(setFilters({ testType: e.target.value }))
                }
                className="w-40"
              />
            </div>

            {/* Model */}
            <SelectField
              label="Model"
              options={modelOptions}
              value={filters.model}
              onChange={(e) => dispatch(setFilters({ model: e.target.value }))}
              className="w-48"
            />

            {/* Operator */}
            <SelectField
              label="Operator"
              options={operatorOptions}
              value={filters.operator}
              onChange={(e) =>
                dispatch(setFilters({ operator: e.target.value }))
              }
              className="w-40"
            />

            {/* Result */}
            <SelectField
              label="Result"
              options={resultOptions}
              value={filters.result}
              onChange={(e) => dispatch(setFilters({ result: e.target.value }))}
              className="w-32"
            />
          </div>

          {/* Date Pickers */}
          <div className="flex flex-wrap gap-4 mt-4">
            <div className="flex items-center gap-2">
              <FaCalendarAlt className="text-purple-500" />
              <DateTimePicker
                label="Start Time"
                name="startTime"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-52"
              />
            </div>
            <div className="flex items-center gap-2">
              <FaCalendarAlt className="text-purple-500" />
              <DateTimePicker
                label="End Time"
                name="endTime"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-52"
              />
            </div>
          </div>
        </div>

        {/* Box 2: Actions - UPDATED WITH RESET BUTTON */}
        <div className="bg-white border border-purple-200 p-4 rounded-xl shadow-md">
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                onClick={handleQuery}
                bgColor={
                  isLoading
                    ? "bg-gray-400"
                    : "bg-gradient-to-r from-blue-500 to-purple-500"
                }
                textColor="text-white"
                className="font-semibold px-6 flex items-center gap-2"
                disabled={isLoading}
              >
                <BiSearchAlt />
                {isLoading ? "Loading..." : "Query"}
              </Button>

              <Button
                onClick={() => refetchReport()}
                bgColor="bg-gray-200"
                textColor="text-gray-700"
                className="p-2"
                disabled={isLoading}
                title="Refresh"
              >
                <FaSync className={isLoading ? "animate-spin" : ""} />
              </Button>

              {/* Reset Button - NEW */}
              <Button
                onClick={handleResetFilters}
                bgColor="bg-orange-100"
                textColor="text-orange-700"
                className="p-2"
                title="Reset Filters"
              >
                <FaRedo />
              </Button>

              {estData.length > 0 && (
                <Button
                  onClick={handleExport}
                  bgColor="bg-green-500"
                  textColor="text-white"
                  className="font-semibold flex items-center gap-2"
                  disabled={exportLoading}
                >
                  <FaDownload />
                  {exportLoading ? "Exporting..." : "Export All"}
                </Button>
              )}
            </div>

            <div className="bg-purple-100 px-4 py-2 rounded-lg flex items-center gap-2">
              <IoMdStats className="text-purple-600" />
              <span className="font-bold text-purple-800">
                Total: <span className="text-2xl">{totalCount}</span> records
              </span>
            </div>
          </div>
        </div>

        {/* Box 3: Quick Filters */}
        <div className="bg-white border border-purple-200 p-4 rounded-xl shadow-md">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 text-center flex items-center justify-center gap-2">
            <BsLightningChargeFill className="text-yellow-500" />
            Quick Filters
          </h2>
          <div className="flex gap-2">
            <Button
              onClick={() => handleQuickFilter("yesterday")}
              bgColor={
                activeQuickFilter === "yesterday"
                  ? "bg-yellow-600"
                  : "bg-yellow-400 hover:bg-yellow-500"
              }
              textColor="text-gray-800"
              className="font-semibold text-sm flex items-center gap-1"
              disabled={quickFilterLoading || isLoading}
            >
              <BiTime />
              YDAY
            </Button>
            <Button
              onClick={() => handleQuickFilter("today")}
              bgColor={
                activeQuickFilter === "today"
                  ? "bg-blue-600"
                  : "bg-blue-400 hover:bg-blue-500"
              }
              textColor="text-white"
              className="font-semibold text-sm flex items-center gap-1"
              disabled={quickFilterLoading || isLoading}
            >
              <FaCalendarAlt />
              TODAY
            </Button>
            <Button
              onClick={() => handleQuickFilter("mtd")}
              bgColor={
                activeQuickFilter === "mtd"
                  ? "bg-green-600"
                  : "bg-green-400 hover:bg-green-500"
              }
              textColor="text-white"
              className="font-semibold text-sm flex items-center gap-1"
              disabled={quickFilterLoading || isLoading}
            >
              <TbReportAnalytics />
              MTD
            </Button>
          </div>
        </div>
      </div>

      {isLoading && <Loader />}

      {!isLoading && estData.length > 0 && (
        <>
          {/* Data Table*/}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            {/* Table Header */}
            <div className="p-5 border-b flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <FaTable className="text-purple-500" />
                Test Records
              </h2>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>
                  Page{" "}
                  <span className="font-bold text-purple-600">
                    {pagination.page}
                  </span>{" "}
                  of{" "}
                  <span className="font-bold text-purple-600">
                    {pagination.totalPages}
                  </span>
                </span>
                <span className="text-gray-300">|</span>
                <span>
                  Showing{" "}
                  <span className="font-bold text-purple-600">
                    {estData.length}
                  </span>{" "}
                  of{" "}
                  <span className="font-bold text-purple-600">
                    {pagination.totalRecords}
                  </span>{" "}
                  records
                </span>
              </div>
            </div>

            {/* PAGINATION COMPONENT - ADD THIS */}
            {pagination.totalRecords > 0 && (
              <div className="px-5 py-3 bg-gray-50 border-b">
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  totalRecords={pagination.totalRecords}
                  limit={pagination.limit}
                  onPageChange={handlePageChange}
                  onLimitChange={handleLimitChange}
                  isLoading={isLoading}
                />
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">
                      <div className="flex items-center gap-1">
                        <HiOutlineDocumentReport />
                        Ref No
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left font-semibold">
                      <div className="flex items-center gap-1">
                        <FaCubes />
                        Model
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left font-semibold">
                      <div className="flex items-center gap-1">
                        <FaBarcode />
                        Serial
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left font-semibold">
                      <div className="flex items-center gap-1">
                        <FaCalendarAlt />
                        Date/Time
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left font-semibold">
                      <div className="flex items-center gap-1">
                        <FaUser />
                        Operator
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left font-semibold">
                      <div className="flex items-center gap-1">
                        <FaPlug />
                        ECT
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left font-semibold">
                      <div className="flex items-center gap-1">
                        <HiLightningBolt />
                        HV
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left font-semibold">
                      <div className="flex items-center gap-1">
                        <FaShieldAlt />
                        IR
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left font-semibold">
                      <div className="flex items-center gap-1">
                        <FaTint />
                        LCT
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left font-semibold">
                      <div className="flex items-center gap-1">
                        <FaBatteryFull />
                        Wattage
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left font-semibold">
                      <div className="flex items-center gap-1">
                        <VscCircuitBoard />
                        Result
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {estData.map((item, index) => (
                    <tr
                      key={item.RefNo || index}
                      className="hover:bg-purple-50 border-b border-gray-100 cursor-pointer transition-colors"
                      onClick={() => handleRowClick(item)}
                    >
                      <td className="px-3 py-3 font-mono font-semibold">
                        {item.RefNo}
                      </td>
                      <td className="px-3 py-3 font-semibold text-blue-600">
                        {item.model_no}
                      </td>
                      <td className="px-3 py-3 font-mono text-gray-600">
                        {item.serial_no}
                      </td>
                      <td className="px-3 py-3">
                        {item.date_time &&
                          item.date_time.replace("T", " ").replace("Z", "")}
                      </td>
                      <td className="px-3 py-3">
                        <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-full text-xs font-semibold">
                          {item.operator}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={item.ect_result} />
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={item.hv_result} />
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={item.ir_result} />
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={item.lct_ln_result} />
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {item.set_wattage_lower} - {item.set_wattage_upper}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={item.result} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {estData.length === 0 && !isLoading && (
                <div className="text-center py-8 text-gray-500">
                  No data found. Please adjust your filters and try again.
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {!isLoading && estData.length === 0 && filters.startDate && (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <GiElectric className="text-6xl text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-600 mb-2">
            No Records Found
          </h3>
          <p className="text-gray-500">
            No EST records found for the selected date range and filters.
          </p>
        </div>
      )}

      {!filters.startDate && !filters.endDate && (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <BiSearchAlt className="text-6xl text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-600 mb-2">
            Select Date Range
          </h3>
          <p className="text-gray-500">
            Please select a date range or use quick filters to view EST report
            data.
          </p>
        </div>
      )}

      {/* Detail Modal */}
      {isDetailModalOpen && selectedRecord && <ESTDetailModal />}
    </div>
  );
};

export default ESTReport;
