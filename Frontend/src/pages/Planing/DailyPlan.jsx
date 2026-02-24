import axios from "axios";
import Title from "../../components/ui/Title";
import { useState, useEffect } from "react";
import InputField from "../../components/ui/InputField";
import Button from "../../components/ui/Button";
import Loader from "../../components/ui/Loader";
import toast from "react-hot-toast";
import ExcelJS from "exceljs";
import { baseURL } from "../../assets/assets";

const DailyPlan = () => {
  const [loading, setLoading] = useState(false);
  const [dailyPlanFile, setDailyPlanFile] = useState("");
  const [dailyPlanData, setDailyPlan] = useState([]);
  const [existingPlans, setExistingPlans] = useState([]);

  useEffect(() => {
    fetchDailyPlans();
  }, []);

  const handleUpload = async () => {
    if (!dailyPlanFile) {
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

        const worksheet = workbook.worksheets[0];

        const planData = [];

        worksheet.eachRow((row, rowNumber) => {
          // Skip header row
          if (rowNumber === 1) return;

          const srNo = row.getCell(1).value?.toString().trim();
          const shiftName = row.getCell(2).value?.toString().trim();
          const planQty = row.getCell(3).value?.toString().trim();
          const departmentName = row.getCell(4).value?.toString().trim();
          const workCenterAlias = row.getCell(5).value?.toString().trim();

          if (
            srNo &&
            shiftName &&
            planQty &&
            departmentName &&
            workCenterAlias
          ) {
            planData.push({
              srNo,
              shiftName,
              planQty: parseInt(planQty),
              departmentName,
              workCenterAlias,
            });
          }
        });

        if (planData.length === 0) {
          toast.error("No valid data found in the file.");
          setLoading(false);
          return;
        }

        setDailyPlan(planData);
        toast.success("Daily plan file uploaded successfully.");
      };

      reader.readAsArrayBuffer(dailyPlanFile);
    } catch (err) {
      console.error("Error while processing Excel file:", err);
      toast.error("Failed to process the Excel file.");
    } finally {
      setLoading(false);
    }
  };

  const fetchDailyPlans = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${baseURL}planing/daily-plans`);
      if (res?.data?.success) {
        setExistingPlans(res?.data?.data || []);
      }
    } catch (error) {
      console.error("Error fetching daily plans:", error);
      toast.error("Failed to fetch daily plans");
    } finally {
      setLoading(false);
    }
  };

  const handleAddPlan = async () => {
    if (dailyPlanData.length === 0) {
      toast.error("No daily plan data to upload.");
      return;
    }

    setLoading(true);

    try {
      const payload = dailyPlanData.map((plan) => ({
        shift: plan.shiftName,
        planQty: plan.planQty,
        department: plan.departmentName,
        station: plan.workCenterAlias,
      }));

      const res = await axios.post(
        `${baseURL}planing/upload-daily-plan`,
        payload
      );

      if (res?.data?.success) {
        toast.success("Plan Uploaded Successfully.");
        await fetchDailyPlans();
        fetchDailyPlans();

        setDailyPlan([]);
        setDailyPlanFile("");
      }
    } catch (error) {
      console.error("Error uploading daily plans:", error);
      toast.error("Failed to upload daily plans");
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-100 p-4 overflow-x-hidden max-w-full">
      <Title title="Daily Plan" align="center" />

      {/* Filters Section */}
      <div className="flex gap-2">
        <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-md">
          <div className="flex flex-wrap gap-2">
            <InputField
              label="Daily Plan File"
              type="file"
              className="w-52"
              name="dailyPlanFile"
              onChange={(e) => setDailyPlanFile(e.target.files[0])}
              accept=".xlsx, .xls"
            />

            {dailyPlanFile && (
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
                  Upload File
                </Button>
              </div>
            )}
            {dailyPlanData.length > 0 && (
              <div className="flex items-center justify-center">
                <Button
                  bgColor={loading ? "bg-gray-400" : "bg-blue-500"}
                  textColor={loading ? "text-white" : "text-black"}
                  className={`font-semibold ${
                    loading ? "cursor-not-allowed" : ""
                  }`}
                  onClick={handleAddPlan}
                  disabled={loading}
                >
                  Upload Plan
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Summary Section */}
      <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-md">
        <div className="bg-white border border-gray-300 rounded-md p-2">
          <div className="flex gap-4 overflow-x-hidden">
            {/* Left Table - Uploaded Plan Data */}
            <div className="w-1/2 max-h-[500px] overflow-x-auto">
              <h3 className="text-center font-semibold mb-2">
                Uploaded Plan Data
              </h3>
              {loading ? (
                <Loader />
              ) : (
                <table className="w-full border bg-white text-xs text-left rounded-lg table-fixed">
                  <thead className="bg-gray-200 sticky top-0 z-10">
                    <tr>
                      {[
                        "Sr No.",
                        "Shift Name",
                        "Plan Qty",
                        "Department Name",
                        "Work Center Alias",
                      ].map((header) => (
                        <th
                          key={header}
                          className="px-2 py-1 border text-center w-1/5"
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dailyPlanData.length > 0 ? (
                      dailyPlanData.map((item, index) => (
                        <tr key={index} className="hover:bg-gray-100">
                          <td className="px-2 py-1 border text-center">
                            {item.srNo}
                          </td>
                          <td className="px-2 py-1 border text-center">
                            {item.shiftName}
                          </td>
                          <td className="px-2 py-1 border text-center">
                            {item.planQty}
                          </td>
                          <td className="px-2 py-1 border text-center">
                            {item.departmentName}
                          </td>
                          <td className="px-2 py-1 border text-center">
                            {item.workCenterAlias}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="text-center py-4">
                          No data found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {/* Right Table - Existing Plans */}
            <div className="w-1/2 max-h-[500px] overflow-x-auto">
              <h3 className="text-center font-semibold mb-2">
                Existing Daily Plans
              </h3>
              {loading ? (
                <Loader />
              ) : (
                <table className="w-full border bg-white text-xs text-left rounded-lg table-fixed">
                  <thead className="bg-gray-200 sticky top-0 z-10">
                    <tr>
                      {[
                        "Sr No.",
                        "Ref No.",
                        "Ref Date",
                        "Plan Date",
                        "Shift",
                        "Plan Qty",
                        "Department",
                        "Alias",
                      ].map((header) => (
                        <th
                          key={header}
                          className="px-2 py-1 border text-center w-1/8"
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {existingPlans.length > 0 ? (
                      existingPlans.map((item, index) => (
                        <tr key={index} className="hover:bg-gray-100">
                          <td className="px-2 py-1 border text-center">
                            {index + 1}
                          </td>
                          <td className="px-2 py-1 border text-center">
                            {item.RefNo}
                          </td>
                          <td className="px-2 py-1 border text-center">
                            {item.RefDate.replace("T", " ").replace("Z", "")}
                          </td>
                          <td className="px-2 py-1 border text-center">
                            {item.PlanDate.split("T")[0]}
                          </td>
                          <td className="px-2 py-1 border text-center">
                            {item.Shift}
                          </td>
                          <td className="px-2 py-1 border text-center">
                            {item.PlanQty}
                          </td>
                          <td className="px-2 py-1 border text-center">
                            {item.Department}
                          </td>
                          <td className="px-2 py-1 border text-center">
                            {item.Alias}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="text-center py-4">
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

export default DailyPlan;