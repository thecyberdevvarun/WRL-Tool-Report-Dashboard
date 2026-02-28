import axios from "axios";
import SelectField from "../../components/ui/SelectField";
import Title from "../../components/ui/Title";
import { useState } from "react";
import InputField from "../../components/ui/InputField";
import Button from "../../components/ui/Button";
import Loader from "../../components/ui/Loader";
import toast from "react-hot-toast";
import ExcelJS from "exceljs";
import { useSelector } from "react-redux";
import { getFormattedISTDate } from "../../utils/dateUtils";
import { baseURL } from "../../assets/assets";

const DispatchHold = () => {
  const { user } = useSelector((store) => store.auth);

  const Status = [
    { label: "Hold", value: "hold" },
    { label: "Release", value: "release" },
  ];

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(Status[0]);
  const [assemblySerial, setAssemblySerial] = useState("");
  const [assemblySerialFile, setAssemblySerialFile] = useState("");
  const [modelName, setModelName] = useState("");
  const [fgData, setFgData] = useState([]);
  const [defectName, setDefectName] = useState("");
  const [actionPlan, setActionPlan] = useState("");

  const handleAddFg = async () => {
    if (!assemblySerial.trim()) {
      toast.error("Please enter FG Serial Number");
      return;
    }

    setLoading(true);

    try {
      const params = { AssemblySerial: assemblySerial };
      const res = await axios.get(`${baseURL}quality/model-name`, { params });

      const fetchedModelName = res?.data?.combinedserial || "Not Found";

      if (fetchedModelName === "Not Found") {
        toast.error("Model Name not found for this serial number");
        return;
      }

      setModelName(fetchedModelName);

      // Wait a bit before adding to table so input shows the model name
      setTimeout(() => {
        setFgData((prev) => [
          ...prev,
          {
            modelName: fetchedModelName,
            assemblySerial,
          },
        ]);

        // Clear fields after adding
        setAssemblySerial("");
      }, 500); // half-second delay to let it render
    } catch (error) {
      console.error("Failed to Add FG:", error);
      toast.error("Error while adding FG");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!assemblySerialFile) {
      toast.error("Please upload a valid Excel file.");
      return;
    }

    setLoading(true);

    try {
      const workbook = new ExcelJS.Workbook();
      const reader = new FileReader();

      reader.onload = async (e) => {
        const buffer = e.target.result;
        await workbook.xlsx.load(buffer);

        const worksheet = workbook.worksheets[0]; // Assuming data is in the first sheet

        const newFgData = [];

        worksheet.eachRow((row, _) => {
          const modelName = row.getCell(1).value?.toString().trim(); // Column A
          const assemblySerial = row.getCell(2).value?.toString().trim(); // Column B

          if (modelName && assemblySerial) {
            newFgData.push({ modelName, assemblySerial });
          }
        });

        if (newFgData.length === 0) {
          toast.error("No valid data found in the file.");
          setLoading(false);
          return;
        }

        setFgData((prev) => [...prev, ...newFgData]);
        toast.success("FG Serial Numbers uploaded successfully.");
      };

      reader.readAsArrayBuffer(assemblySerialFile);
    } catch (err) {
      console.error("Error processing Excel file:", err);
      toast.error("Failed to process the Excel file.");
    } finally {
      setLoading(false);
    }
  };

  const handleHold = async () => {
    if (!status || status.value !== "hold") {
      toast.error("Please select status as 'Hold'");
      return;
    }

    if (!defectName.trim()) {
      toast.error("Please enter Defect Name");
      return;
    }

    if (fgData.length === 0) {
      toast.error("No FG data to hold");
      return;
    }

    setLoading(true);

    try {
      const payload = fgData.map((item) => ({
        modelName: item.modelName,
        fgNo: item.assemblySerial,
        userName: user.usercode || "defaultUser",
        dispatchStatus: status.value,
        defect: defectName,
        formattedDate: getFormattedISTDate(),
      }));

      const res = await axios.post(`${baseURL}quality/hold`, payload);
      // toast.success(res?.data?.message || "Hold request successful");
      alert(res?.data?.message || "Hold request successful");

      // Reset fields
      setFgData([]);
      setDefectName("");
    } catch (err) {
      console.error("Hold API error:", err);
      toast.error("Failed to submit hold request");
    } finally {
      setLoading(false);
    }
  };

  const handleRelease = async () => {
    if (!status || status.value !== "release") {
      toast.error("Please select status as 'Release'");
      return;
    }

    if (!actionPlan.trim()) {
      toast.error("Please enter Action Plan");
      return;
    }

    if (fgData.length === 0) {
      toast.error("No FG data to release");
      return;
    }

    setLoading(true);

    try {
      const payload = fgData.map((item) => ({
        fgNo: item.assemblySerial,
        releaseUserCode: user.usercode || "defaultUser",
        dispatchStatus: status.value,
        action: actionPlan,
        formattedDate: getFormattedISTDate(),
      }));

      // Send batch release request
      const res = await axios.post(`${baseURL}quality/release`, payload);

      toast.success(res?.data?.message || "Release request successful");

      // Clear state after success
      setFgData([]);
      setActionPlan("");
    } catch (err) {
      console.error("Release API error:", err);
      toast.error("Failed to submit release request");
    } finally {
      setLoading(false);
    }
  };

  const handleClearFilters = () => {
    setAssemblySerialFile(""),
      setModelName(""),
      setFgData([]),
      setDefectName(""),
      setActionPlan("");
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 overflow-x-hidden max-w-full">
      <Title title="Dispatch Hold" align="center" />

      {/* Filters Section */}
      <div className="flex gap-2">
        <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-md">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField
              label="FG Serial No."
              type="text"
              placeholder="Enter FG Serial No."
              className="w-full"
              name="assemblySerial"
              value={assemblySerial}
              onChange={(e) => setAssemblySerial(e.target.value)}
            />
            <InputField
              label="Model Name"
              type="text"
              placeholder="Model Name"
              className="w-full"
              value={modelName}
              readOnly
            />
            <SelectField
              label="Status"
              options={Status}
              value={status?.value || ""}
              onChange={(e) => {
                const selected = Status.find(
                  (item) => item.value === e.target.value
                );
                setStatus(selected);
              }}
              className="max-w-65"
            />

            {status.value === "hold" && (
              <InputField
                label="Defect Name"
                type="text"
                placeholder="Enter Defect Name"
                className="w-full"
                value={defectName}
                onChange={(e) => setDefectName(e.target.value)}
              />
            )}
            {status.value === "release" && (
              <InputField
                label="Action Plan"
                type="text"
                placeholder="Enter Action Plan"
                className="w-full"
                value={actionPlan}
                onChange={(e) => setActionPlan(e.target.value)}
              />
            )}
            <div className="flex items-center justify-center gap-2">
              <Button
                bgColor={loading ? "bg-gray-400" : "bg-green-500"}
                textColor={loading ? "text-white" : "text-black"}
                className={`font-semibold ${
                  loading ? "cursor-not-allowed" : ""
                }`}
                onClick={handleAddFg}
                disabled={loading}
              >
                Add FG
              </Button>
              {status.value === "hold" && (
                <Button
                  bgColor={loading ? "bg-gray-400" : "bg-blue-500"}
                  textColor={loading ? "text-white" : "text-black"}
                  className={`font-semibold ${
                    loading ? "cursor-not-allowed" : ""
                  }`}
                  onClick={handleHold}
                  disabled={loading}
                >
                  Hold
                </Button>
              )}
              {status.value === "release" && (
                <Button
                  bgColor={loading ? "bg-gray-400" : "bg-blue-500"}
                  textColor={loading ? "text-white" : "text-black"}
                  className={`font-semibold ${
                    loading ? "cursor-not-allowed" : ""
                  }`}
                  onClick={handleRelease}
                  disabled={loading}
                >
                  Release
                </Button>
              )}
            </div>
          </div>
        </div>
        <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-md">
          <div className="flex flex-wrap gap-2">
            <InputField
              label="FG Serial No. File"
              type="file"
              className="w-52"
              name="assemblySerialFile"
              onChange={(e) => setAssemblySerialFile(e.target.files[0])}
            />

            <div className="flex items-center justify-center">
              <Button
                bgColor={loading ? "bg-gray-400" : "bg-green-500"}
                textColor={loading ? "text-white" : "text-black"}
                className={`font-semibold ${
                  loading ? "cursor-not-allowed" : ""
                }`}
                onClick={handleUpload}
                disabled={loading}
              >
                Upload FG
              </Button>
            </div>
          </div>
          <div className="mt-4 text-left font-bold text-lg">
            COUNT: <span className="text-blue-700">{fgData?.length || 0}</span>
          </div>
          <div>
            <Button
              bgColor="bg-white"
              textColor="text-black"
              className="border border-gray-400 hover:bg-gray-100 px-3 py-1"
              onClick={handleClearFilters}
            >
              Clear Filter
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Section */}
      <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-md">
        <div className="bg-white border border-gray-300 rounded-md p-2">
          <div className="w-full  flex flex-col gap-2 overflow-x-hidden">
            {/* Summary Table */}
            <div className="w-full max-h-[500px] overflow-x-auto">
              {loading ? (
                <Loader />
              ) : (
                <table className="min-w-2xl border bg-white text-xs text-left rounded-lg table-auto">
                  <thead className="bg-gray-200 sticky top-0 z-10 text-center">
                    <tr>
                      <th className="px-1 py-1 border min-w-[80px] md:min-w-[100px]">
                        Sr No.
                      </th>
                      <th className="px-1 py-1 border min-w-[80px] md:min-w-[100px]">
                        Model_Name
                      </th>
                      <th className="px-1 py-1 border min-w-[80px] md:min-w-[100px]">
                        FG Serial No.
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {fgData.length > 0 ? (
                      fgData.map((item, index) => (
                        <tr
                          key={index}
                          className="hover:bg-gray-100 text-center"
                        >
                          <td className="px-1 py-1 border">{index + 1}</td>
                          <td className="px-1 py-1 border">{item.modelName}</td>
                          <td className="px-1 py-1 border">
                            {item.assemblySerial}
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
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DispatchHold;