import { useEffect, useState } from "react";
import Button from "../../components/ui/Button";
import InputField from "../../components/ui/InputField";
import Title from "../../components/ui/Title";
import Loader from "../../components/ui/Loader";
import SelectField from "../../components/ui/SelectField";
import { WiThermometer } from "react-icons/wi";
import { FaBolt } from "react-icons/fa";
import { MdPowerSettingsNew } from "react-icons/md";
import toast from "react-hot-toast";
import axios from "axios";
import { getFormattedISTDate } from "../../utils/dateUtils.js";
import { baseURL } from "../../assets/assets.js";
import { getCurrentShift } from "../../utils/shiftUtils.js";

const LPT = () => {
  const [loading, setLoading] = useState(false);
  const [barcodeNumber, setBarcodeNumber] = useState("");
  const [assetDetails, setAssetDetails] = useState([]);
  const [actualTemp, setActualTemp] = useState("");
  const [actualCurrent, setActualCurrent] = useState("");
  const [actualPower, setActualPower] = useState("");
  const [addManually, setAddManually] = useState(false);
  const [manualCategory, setManualCategory] = useState("");
  const [lptDefectCategory, setLptDefectCategory] = useState([]);
  const [selectedLptDefectCategory, setSelectedLptDefectCategory] =
    useState(null);
  const [remark, setRemark] = useState("");
  const [lptDefectReport, setLptDefectReport] = useState([]);
  const [lptDefectCount, setLptDefectCount] = useState([]);
  const [performanceRes, setPerformanceRes] = useState("");

  const getLptDefectReport = async () => {
    try {
      setLoading(true);

      const res = await axios.get(`${baseURL}quality/lpt-defect-report`);
      if (res?.data?.success) {
        setLptDefectReport(res?.data?.data);
      }
    } catch (error) {
      console.error("Failed to fetch Lpt Defect data:", error);
      toast.error("Failed to fetch Lpt Defect data.");
    } finally {
      setLoading(false);
    }
  };

  const getLptDefectCount = async () => {
    try {
      setLoading(true);

      const res = await axios.get(`${baseURL}quality/lpt-defect-count`);
      if (res?.data?.success) {
        setLptDefectCount(res?.data?.data);
      }
    } catch (error) {
      console.error("Failed to fetch Lpt Defect data:", error);
      toast.error("Failed to fetch Lpt Defect data.");
    } finally {
      setLoading(false);
    }
  };

  const getAssetDetails = async () => {
    if (!barcodeNumber) {
      toast.error("Please select Barcode Number");
      return;
    }

    try {
      setLoading(true);

      const params = {
        AssemblySerial: barcodeNumber,
      };

      const res = await axios.get(`${baseURL}quality/lpt-asset-details`, {
        params,
      });

      if (res?.data?.success) {
        const assetData = res?.data?.data;

        if (!assetData) {
          toast.error(
            "No Mode Name found for this Serial Number. Please add Recipe for this Model.",
          );
          setAssetDetails(null);
          return;
        }
        setAssetDetails(assetData);
      }
    } catch (error) {
      console.error("Failed to fetch Asset Details data:", error);
      toast.error("Failed to fetch Asset Details data.");
    } finally {
      setLoading(false);
    }
  };

  const getLptDefectCategory = async () => {
    try {
      const res = await axios.get(`${baseURL}quality/lpt-defect-category`);
      if (res?.data?.success) {
        const formatted = res?.data?.data.map((item) => ({
          label: item.Name,
          value: item.Code.toString(),
        }));
        setLptDefectCategory(formatted);
      }
    } catch (error) {
      console.error("Failed to fetch Lpt Defect Category data:", error);
      toast.error("Failed to fetch Lpt Defect Category data.");
    }
  };

  const calculatePerformance = (
    assetDetails,
    actualTemp,
    actualCurrent,
    actualPower,
  ) => {
    const minTemp = Number(assetDetails?.MinTemp);
    const maxTemp = Number(assetDetails?.MaxTemp);
    const actTemp = Number(actualTemp);

    const minCurrent = Number(assetDetails?.MinCurrent);
    const maxCurrent = Number(assetDetails?.MaxCurrent);
    const actCurrent = Number(actualCurrent);

    const minPower = Number(assetDetails?.MinPower);
    const maxPower = Number(assetDetails?.MaxPower);
    const actPower = Number(actualPower);

    const tempCheck = actTemp >= minTemp && actTemp <= maxTemp;
    const currentCheck = actCurrent >= minCurrent && actCurrent <= maxCurrent;
    const powerCheck = actPower >= minPower && actPower <= maxPower;

    const overallPerformance =
      tempCheck && currentCheck && powerCheck ? "Pass" : "Fail";

    return overallPerformance;
  };

  const handleAddDefect = async () => {
    if (!assetDetails.ModelName) {
      toast.error("Asset details not available. Please scan a barcode.");
      return;
    }

    const performanceStatus = calculatePerformance(
      assetDetails,
      actualTemp,
      actualCurrent,
      actualPower,
    );

    let defectToAdd = "";

    if (performanceStatus === "Pass") {
      defectToAdd = "N/A";
    } else {
      defectToAdd = addManually
        ? manualCategory?.trim()
        : selectedLptDefectCategory?.label;
    }

    if (!defectToAdd || defectToAdd.length === 0) {
      toast.error("Please select or enter a defect.");
      return;
    }

    try {
      setLoading(true);

      const dynamicShift = getCurrentShift();

      const payload = {
        AssemblyNo: barcodeNumber,
        ModelName: assetDetails.ModelName,
        MinTemp: assetDetails.MinTemp,
        MaxTemp: assetDetails.MaxTemp,
        ActualTemp: actualTemp,
        MinCurrent: assetDetails.MinCurrent,
        MaxCurrent: assetDetails.MaxCurrent,
        ActualCurrent: actualCurrent,
        MinPower: assetDetails.MinPower,
        MaxPower: assetDetails.MaxPower,
        ActualPower: actualPower,
        shift: dynamicShift.value,
        AddDefect: defectToAdd,
        Remark: remark,
        Performance: performanceStatus,
        currentDateTime: getFormattedISTDate(),
      };

      const res = await axios.post(`${baseURL}quality/add-lpt-defect`, payload);

      if (res?.data?.success) {
        toast.success(res?.data?.message || "Defect added successfully!");
        setBarcodeNumber("");
        setAssetDetails([]);
        setActualTemp("");
        setActualCurrent("");
        setActualPower("");
        setAddManually(false);
        setManualCategory("");
        setLptDefectCategory([]);
        setSelectedLptDefectCategory(null);
        setRemark("");
        setLptDefectReport([]);
        setLptDefectCount([]);
        setPerformanceRes("");
        getLptDefectReport();
      }
    } catch (error) {
      console.error("Add Defect Error:", error.response?.data || error.message);
      toast.error("An error occurred while adding the defect.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getLptDefectCount();
    getLptDefectReport();
    getLptDefectCategory();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-4 overflow-x-hidden max-w-full">
      <Title title="LPT" align="center" />

      {/* Filters Section */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Left Card */}
        <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-md">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Barcode & Search */}
            <div className="flex flex-col gap-4 items-start">
              <InputField
                label="Scan Barcode"
                type="text"
                placeholder="Enter Barcode Number"
                className="w-56"
                name="barcodeNumber"
                value={barcodeNumber}
                onChange={(e) => setBarcodeNumber(e.target.value)}
              />
              <Button
                bgColor={loading ? "bg-gray-400" : "bg-blue-500"}
                textColor={loading ? "text-white" : "text-black"}
                className={`font-semibold ${
                  loading ? "cursor-not-allowed" : ""
                }`}
                onClick={() => getAssetDetails()}
                disabled={loading}
              >
                Search
              </Button>
            </div>

            {/* Info Section */}
            <div className="flex flex-col gap-3">
              <h1 className="font-semibold text-md">
                Model Name:{" "}
                <span className="text-blue-700 text-sm">
                  {assetDetails?.ModelName || "N/A"}
                </span>
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Section */}
      <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-md">
        <div className="bg-white border border-gray-300 rounded-md p-2">
          {/* Control Section */}
          <div className="flex flex-wrap gap-4 items-start justify-start bg-gradient-to-r from-purple-100 via-white to-purple-100 p-4 rounded-xl shadow-md mb-4">
            {/* Temperature Block */}
            <div className="flex flex-col gap-4 p-5 bg-red-50 shadow-md border border-red-200 rounded-xl min-w-[220px]">
              <h1 className="text-lg font-bold text-center text-red-700 flex items-center justify-center gap-2">
                <WiThermometer className="text-2xl" />
                Temperature
              </h1>

              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between px-4">
                  <div className="flex flex-col items-center">
                    <span className="text-sm font-medium text-gray-600">
                      Min
                    </span>
                    <span className="text-base font-semibold text-blue-600">
                      {assetDetails?.MinTemp || "0"} °C
                    </span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-sm font-medium text-gray-600">
                      Max
                    </span>
                    <span className="text-base font-semibold text-red-600">
                      {assetDetails?.MaxTemp || "0"} °C
                    </span>
                  </div>
                </div>

                <InputField
                  label="Actual Temp"
                  type="text"
                  value={actualTemp}
                  onChange={(e) => setActualTemp(e.target.value)}
                  className="w-32 mx-auto"
                />
              </div>
            </div>

            {/* Current Block */}
            <div className="flex flex-col gap-4 p-5 bg-blue-50 shadow-md border border-blue-200 rounded-xl min-w-[220px]">
              <h1 className="text-lg font-bold text-center text-blue-700 flex items-center justify-center gap-2">
                <FaBolt className="text-xl" />
                Current
              </h1>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between px-4">
                  <div className="flex flex-col items-center">
                    <span className="text-sm font-medium text-gray-600">
                      Min
                    </span>
                    <span className="text-base font-semibold text-blue-600">
                      {assetDetails?.MinCurrent || "0"} A
                    </span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-sm font-medium text-gray-600">
                      Max
                    </span>
                    <span className="text-base font-semibold text-red-600">
                      {assetDetails?.MaxCurrent || "0"} A
                    </span>
                  </div>
                </div>

                <InputField
                  label="Actual Current"
                  type="text"
                  value={actualCurrent}
                  onChange={(e) => setActualCurrent(e.target.value)}
                  className="w-32 mx-auto"
                />
              </div>
            </div>

            {/* Power Block */}
            <div className="flex flex-col gap-4 p-5 bg-yellow-50 shadow-md border border-yellow-200 rounded-xl min-w-[220px]">
              <h1 className="text-lg font-bold text-center text-yellow-700 flex items-center justify-center gap-2">
                <MdPowerSettingsNew className="text-xl" />
                Power
              </h1>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between px-4">
                  <div className="flex flex-col items-center">
                    <span className="text-sm font-medium text-gray-600">
                      Min
                    </span>
                    <span className="text-base font-semibold text-blue-600">
                      {assetDetails?.MinPower || "0"} V
                    </span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-sm font-medium text-gray-600">
                      Max
                    </span>
                    <span className="text-base font-semibold text-red-600">
                      {assetDetails?.MaxPower || "0"} V
                    </span>
                  </div>
                </div>
                <InputField
                  label="Actual Power"
                  type="text"
                  value={actualPower}
                  onChange={(e) => setActualPower(e.target.value)}
                  className="w-32 mx-auto"
                />
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <Button
                onClick={() => {
                  if (
                    !actualTemp ||
                    !actualCurrent ||
                    !actualPower ||
                    !assetDetails
                  ) {
                    toast.error(
                      "Please enter all actual values and fetch asset details.",
                    );
                    return;
                  }

                  const res = calculatePerformance(
                    assetDetails,
                    actualTemp,
                    actualCurrent,
                    actualPower,
                  );
                  setPerformanceRes(res);
                }}
              >
                Check
              </Button>
              <h1 className="font-semibold text-md">
                Result:{" "}
                <span
                  className={`${
                    performanceRes === "Pass"
                      ? "text-green-500"
                      : "text-red-500"
                  } text-sm`}
                >
                  {performanceRes || "N/A"}
                </span>
              </h1>
            </div>

            <div className="flex flex-col gap-2 items-center justify-center">
              <InputField
                label="Remark"
                type="text"
                placeholder="Enter Remark"
                className="w-64"
                name="remark"
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
              />
              {performanceRes === "Fail" && (
                <div className="flex flex-col gap-2 w-72">
                  {/* Radio Button Toggle */}
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="addManually"
                      checked={addManually}
                      onChange={() => setAddManually(!addManually)}
                      className="cursor-pointer"
                    />
                    <label
                      htmlFor="addManually"
                      className="cursor-pointer font-medium"
                    >
                      Add Defect Manually
                    </label>
                  </div>

                  {/* Conditional Rendering */}
                  {addManually ? (
                    <InputField
                      label="Manual Defect Category"
                      type="text"
                      placeholder="Enter defect category"
                      value={manualCategory}
                      onChange={(e) => setManualCategory(e.target.value)}
                      className="w-64"
                    />
                  ) : (
                    <SelectField
                      label="Select Defect Category"
                      options={lptDefectCategory}
                      value={selectedLptDefectCategory?.value || ""}
                      onChange={(e) => {
                        const selected = lptDefectCategory.find(
                          (option) => option.value === e.target.value,
                        );
                        setSelectedLptDefectCategory(selected);
                      }}
                      className="w-64"
                    />
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 items-center justify-center">
              <InputField
                label="Current Shift"
                type="text"
                value={getCurrentShift().label}
                readOnly
                className="w-32"
              />
              <div>
                <Button
                  bgColor={loading ? "bg-gray-400" : "bg-indigo-600"}
                  textColor="text-white"
                  className={`font-semibold px-6 py-3 rounded-lg shadow-md mt-6 transition duration-300 hover:bg-indigo-700 ${
                    loading ? "cursor-not-allowed opacity-60" : ""
                  }`}
                  onClick={() => handleAddDefect()}
                  disabled={loading}
                >
                  Add Defect
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-start gap-1">
            {/* Left Side */}
            <div className="w-full md:flex-1 flex flex-col gap-2">
              {/* Left Side Table */}
              {loading ? (
                <Loader />
              ) : (
                <div className="w-full max-h-[600px] overflow-x-auto">
                  <table className="min-w-full border border-black bg-white text-xs text-left rounded-lg table-auto">
                    <thead className="bg-gray-200 text-center">
                      <tr>
                        <th className="px-1 py-1 border" rowSpan={2}>
                          Sr. No.
                        </th>
                        <th className="px-1 py-1 border" rowSpan={2}>
                          Date
                        </th>
                        <th className="px-1 py-1 border" rowSpan={2}>
                          Model
                        </th>
                        <th className="px-1 py-1 border" rowSpan={2}>
                          Shift
                        </th>
                        <th className="px-1 py-1 border" rowSpan={2}>
                          Assembly No.
                        </th>
                        <th className="px-1 py-1 border" colSpan={2}>
                          Temperature
                        </th>
                        <th className="px-1 py-1 border" colSpan={2}>
                          Current
                        </th>
                        <th className="px-1 py-1 border" colSpan={2}>
                          Power
                        </th>
                        <th className="px-1 py-1 border" rowSpan={2}>
                          Add Defect
                        </th>
                        <th className="px-1 py-1 border" rowSpan={2}>
                          Remark
                        </th>
                        <th className="px-1 py-1 border" rowSpan={2}>
                          Performance
                        </th>
                      </tr>
                      <tr>
                        <th className="px-1 py-1 border">Min Temp</th>
                        <th className="px-1 py-1 border">Max Temp</th>
                        <th className="px-1 py-1 border">Min Current</th>
                        <th className="px-1 py-1 border">Max Current</th>
                        <th className="px-1 py-1 border">Min Power</th>
                        <th className="px-1 py-1 border">Max Power</th>
                      </tr>
                    </thead>
                    <tbody className="text-center">
                      {lptDefectReport && lptDefectReport.length > 0 ? (
                        lptDefectReport.map((item, index) => (
                          <tr key={index} className="hover:bg-gray-100">
                            <td className="px-1 py-1 border">{index + 1}</td>
                            <td className="px-1 py-1 border">
                              {item.DateTime &&
                                item.DateTime.replace("T", " ").replace(
                                  "Z",
                                  "",
                                )}
                            </td>
                            <td className="px-1 py-1 border">
                              {item.ModelName}
                            </td>
                            <td className="px-1 py-1 border">{item.Shift}</td>
                            <td className="px-1 py-1 border">
                              {item.AssemblyNo}
                            </td>

                            {/* Temperature */}
                            <td className="px-1 py-1 border">{item.minTemp}</td>
                            <td className="px-1 py-1 border">{item.maxTemp}</td>

                            {/* Current */}
                            <td className="px-1 py-1 border">
                              {item.minCurrent}
                            </td>
                            <td className="px-1 py-1 border">
                              {item.maxCurrent}
                            </td>

                            {/* Power */}
                            <td className="px-1 py-1 border">
                              {item.minPower}
                            </td>
                            <td className="px-1 py-1 border">
                              {item.maxPower}
                            </td>

                            <td className="px-1 py-1 border">{item.Defect}</td>
                            <td className="px-1 py-1 border">{item.Remark}</td>
                            <td
                              className={`px-1 py-1 border border-black ${
                                item.Performance === "Pass"
                                  ? "bg-green-500 text-white"
                                  : "bg-red-500 text-white"
                              }`}
                            >
                              {item.Performance}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={17} className="text-center py-4">
                            No LPT defect data found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Right Side */}
            <div className="w-full md:w-[30%] flex flex-col gap-2 overflow-x-hidden">
              {/* Right Side Table */}
              {loading ? (
                <Loader />
              ) : (
                <div className="w-full max-h-[500px] overflow-x-auto">
                  <table className="min-w-full border bg-white text-xs text-left rounded-lg table-auto">
                    <thead className="bg-gray-200 text-center">
                      <tr>
                        <th className="px-1 py-1 border">Model Name</th>
                        <th className="px-1 py-1 border">Production Count</th>
                        <th className="px-1 py-1 border">LPT</th>
                        <th className="px-1 py-1 border">Sample Tested</th>
                        <th className="px-1 py-1 border">Test Pending</th>
                        <th className="px-1 py-1 border">LPT %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lptDefectCount && lptDefectCount.length > 0 ? (
                        lptDefectCount.map((item, index) => (
                          <tr
                            key={index}
                            className="hover:bg-gray-100 text-center"
                          >
                            <td className="px-1 py-1 border">
                              {item.ModelName}
                            </td>
                            <td className="px-1 py-1 border">
                              {item.ModelCount}
                            </td>
                            <td className="px-1 py-1 border">{item.LPT}</td>
                            <td className="px-1 py-1 border">
                              {item.SampleInspected}
                            </td>
                            <td className="px-1 py-1 border">
                              {item.PendingSample < 0
                                ? `( ${Math.abs(item.PendingSample)} )`
                                : item.PendingSample}
                            </td>
                            <td className="px-1 py-1 border">
                              {item.LPT_Percentage} %
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="text-center py-4">
                            No data found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LPT;
