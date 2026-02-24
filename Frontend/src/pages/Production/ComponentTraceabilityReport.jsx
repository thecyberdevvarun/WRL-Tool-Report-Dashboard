import { useState, useEffect, useRef, useCallback } from "react";
import Title from "../../components/ui/Title";
import Button from "../../components/ui/Button";
import SelectField from "../../components/ui/SelectField";
import DateTimePicker from "../../components/ui/DateTimePicker";
import axios from "axios";
import Loader from "../../components/ui/Loader";
import ExportButton from "../../components/ui/ExportButton";
import toast from "react-hot-toast";
import { baseURL } from "../../assets/assets";
import {
  useGetModelVariantsQuery,
  useGetComponentTypesQuery,
} from "../../redux/api/commonApi.js";

const ComponentTraceabilityReport = () => {
  const [loading, setLoading] = useState(false);
  const [selectedModelVariant, setSelectedModelVariant] = useState(null);
  const [selectedCompType, setSelectedCompType] = useState(null);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [traceabilityData, setTraceabilityData] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(100);
  const [hasMore, setHasMore] = useState(false);

  /* ===================== RTK QUERY ===================== */
  const {
    data: variants = [],
    isLoading: variantsLoading,
    error: variantsError,
  } = useGetModelVariantsQuery();

  const {
    data: compType = [],
    isLoading: compTypeLoading,
    error: compTypeError,
  } = useGetComponentTypesQuery();

  useEffect(() => {
    if (variantsError) toast.error("Failed to load model variants");
    if (compTypeError) toast.error("Failed to load component types");
  }, [variantsError, compTypeError]);

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
  const fetchTraceabilityData = async (pageNumber = 1) => {
    if (!startTime || !endTime) {
      toast.error("Please select Time Range.");
      return;
    }
    try {
      setLoading(true);

      const params = {
        startTime,
        endTime,
        model: selectedModelVariant
          ? parseInt(selectedModelVariant.value, 10)
          : 0,
        compType: selectedCompType ? parseInt(selectedCompType.value, 10) : 0,
        page: pageNumber,
        limit,
      };

      const res = await axios.get(`${baseURL}prod/component-traceability`, {
        params,
      });

      if (res?.data?.success) {
        setTraceabilityData((prev) => [...prev, ...res?.data?.data]);
        setHasMore(res?.data?.data.length > 0);
      }
    } catch (error) {
      console.error("Failed to fetch component traceability data:", error);
      toast.error("Failed to fetch component traceability data.");
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
        startTime,
        endTime,
        model: selectedModelVariant
          ? parseInt(selectedModelVariant.value, 10)
          : 0,
        compType: selectedCompType ? parseInt(selectedCompType.value, 10) : 0,
      };

      const res = await axios.get(
        `${baseURL}prod/export-component-traceability`,
        {
          params,
        }
      );
      if (res?.data?.success) {
        return res?.data?.data;
      }
      return [];
    } catch (error) {
      console.error(
        "Failed to fetch export component traceability data:",
        error
      );
      toast.error("Failed to fetch export component traceability data.");
      return [];
    }
  };

  /* ===================== EFFECTS ===================== */
  useEffect(() => {
    if (page > 1) fetchTraceabilityData(page);
  }, [page]);

  const handleTraceabilityData = () => {
    setTraceabilityData([]);
    setPage(1);
    fetchTraceabilityData(1);
  };

  if (variantsLoading || compTypeLoading) return <Loader />;

  return (
    <div className="p-6 bg-gray-100 min-h-screen rounded-lg">
      <Title title="Component Traceability Report" align="center" />

      {/* Filters Section */}
      <div className="flex gap-4">
        <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-xl max-w-fit items-center">
          <div className="flex flex-wrap gap-4">
            <SelectField
              label="Model Variant"
              options={variants}
              value={selectedModelVariant?.value || ""}
              onChange={(e) =>
                setSelectedModelVariant(
                  variants.find((opt) => opt.value === e.target.value) || null
                )
              }
              className="max-w-64"
            />
            <SelectField
              label="Component Type"
              options={compType}
              value={selectedCompType?.value || ""}
              onChange={(e) =>
                setSelectedCompType(
                  compType.find((opt) => opt.value === e.target.value) || null
                )
              }
              className="max-w-64"
            />
          </div>

          <div className="flex flex-wrap gap-4 mt-4">
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
                onClick={handleTraceabilityData}
                disabled={loading}
              >
                Query
              </Button>

              {traceabilityData && traceabilityData.length > 0 && (
                <ExportButton
                  fetchData={fetchExportData}
                  filename="Component_Traceability_Report"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Summary Section */}
      <div className="bg-purple-100 border border-dashed border-purple-400 p-2 mt-4 rounded-xl">
        <div className="w-full bg-white border border-gray-300 rounded-md p-2">
          <div className="w-full max-h-[600px] overflow-x-auto">
            <table className="min-w-full border bg-white text-xs rounded-lg table-auto">
              <thead className="bg-gray-200 sticky top-0 z-10 text-center">
                <tr>
                  <th className="p-2 border">Model_Name</th>
                  <th className="p-2 border">Component Serial No.</th>
                  <th className="p-2 border">Component Name</th>
                  <th className="p-2 border">Component Type</th>
                  <th className="p-2 border">Supplier_Name</th>
                  <th className="p-2 border">Comp Scanned On</th>
                  <th className="p-2 border">FG On</th>
                  <th className="p-2 border">Fg Sr. No.</th>
                  <th className="p-2 border">Asset tag</th>
                </tr>
              </thead>
              <tbody>
                {traceabilityData.map((item, index) => {
                  const isLast = index === traceabilityData.length - 1;
                  return (
                    <tr
                      key={index}
                      ref={isLast ? lastRowRef : null}
                      className="hover:bg-gray-100 text-center"
                    >
                      <td className="border">{item.Model_Name}</td>

                      <td className="border">{item.Component_Serial_Number}</td>
                      <td className="border">{item.Component_Name}</td>
                      <td className="border">{item.Component_Type}</td>
                      <td className="border">{item.Supplier_Name}</td>
                      <td className="border">
                        {item.Comp_ScanedOn &&
                          item.Comp_ScanedOn.replace("T", " ").replace("Z", "")}
                      </td>
                      <td className="border">
                        {item.FG_Date &&
                          item.FG_Date.replace("T", " ").replace("Z", "")}
                      </td>
                      <td className="border">{item.Fg_Sr_No}</td>
                      <td className="border">{item.Asset_tag}</td>
                    </tr>
                  );
                })}

                {!loading && traceabilityData.length === 0 && (
                  <tr>
                    <td colSpan={11} className="text-center py-4">
                      No data found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {loading && <Loader />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComponentTraceabilityReport;
