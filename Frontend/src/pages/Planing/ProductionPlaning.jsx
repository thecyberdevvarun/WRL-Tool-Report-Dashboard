import Button from "../../components/ui/Button";
import InputField from "../../components/ui/InputField";
import SelectField from "../../components/ui/SelectField";
import Title from "../../components/ui/Title";
import Loader from "../../components/ui/Loader";
import { useState, useEffect } from "react";
import axios from "axios";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";
import { baseURL } from "../../assets/assets";

const ProductionPlaning = () => {
  const { user } = useSelector((store) => store.auth);
  const [loading, setLoading] = useState(false);
  const [planMonthOptions, setPlanMonthOptions] = useState([]);
  const [selectedPlanMonth, setSelectedPlanMonth] = useState(null);
  const [modelNameOptions, setModelNameOptions] = useState([]);
  const [selectedModelName, setSelectedModelName] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState("assembly");
  const [productionPlaningData, setProductionPlaningData] = useState([]);
  const [planQuentity, setPlanQuentity] = useState(0);
  const [remark, setRemark] = useState("");

  const fetchModelName = async () => {
    try {
      const params = {
        plan: selectedPlan,
      };

      const res = await axios.get(`${baseURL}planing/model-name`, { params });
      const data = res.data?.data || [];

      const formatted = data.map((item) => {
        return {
          label: item?.Alias?.toString() || "N/A",
          value: item?.matCode?.toString() || "N/A",
        };
      });

      setModelNameOptions(formatted);
    } catch (error) {
      console.error("Failed to fetch model name:", error);
      toast.error("Failed to fetch model name.");
    }
  };

  const fetchPlanMonthYear = async () => {
    try {
      const res = await axios.get(`${baseURL}planing/plan-month-year`);

      const data = res.data?.data || [];

      const formatted = data.map((item) => {
        return {
          label: item.PlanMonthYear.toString(),
          value: item.PlanMonthYear.toString(),
        };
      });

      setPlanMonthOptions(formatted);
    } catch (error) {
      console.error("Failed to fetch plan month year:", error);
      toast.error("Failed to fetch plan month year.");
    }
  };

  const fetchProductionPlaningData = async () => {
    if (!selectedPlan || !selectedPlanMonth) {
      toast.error("Please select Plan Type and Plan Month Year.");
      return;
    }

    try {
      setLoading(true);

      const params = {
        planType: selectedPlan,
        planMonthYear: selectedPlanMonth.value,
      };

      // Make matcode optional
      if (selectedModelName) {
        params.matcode = selectedModelName.value;
      }

      const res = await axios.get(`${baseURL}planing/production-planing`, {
        params,
      });

      if (res?.data?.success) {
        setProductionPlaningData(res?.data?.data || []);
        toast.success("All Production Planing Data is fetched successfully.");
        setSelectedModelName(null);
        setSelectedPlanMonth(null);
      }
    } catch (error) {
      console.error("Failed to fetch Production Planing Data:", error);
      toast.error("Failed to fetch Production Planing Data.");
    } finally {
      setLoading(false);
    }
  };

  const updateProductionPlaningData = async () => {
    if (
      !selectedModelName ||
      !selectedPlanMonth ||
      !planQuentity ||
      !remark ||
      !selectedPlan
    ) {
      toast.error("Please fill all required fields.");
      return;
    }
    try {
      setLoading(true);

      const payload = {
        planQty: planQuentity,
        userCode: user?.usercode,
        remark,
        matcode: selectedModelName.value,
        planMonthYear: selectedPlanMonth.value,
        planType: selectedPlan,
      };

      const res = await axios.put(
        `${baseURL}planing/update-production-plan`,
        payload
      );

      if (res?.data?.success) {
        toast.success(res?.data?.message);
        setSelectedModelName(null);
        setSelectedPlanMonth(null);
        setPlanQuentity(0);
        setRemark("");
      }
    } catch (error) {
      console.error("Failed to update Production Planing Data:", error);
      toast.error("Failed to update Production Planing Data.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    try {
      await updateProductionPlaningData();
      await fetchProductionPlaningData();

      setSelectedModelName(null);
      setSelectedPlanMonth(null);
      setPlanQuentity(0);
      setRemark("");
    } catch (error) {
      console.error("Update or fetch failed:", error);
      toast.error("Update or fetch failed.");
    }
  };

  const handleAddPlan = async () => {
    if (
      !selectedModelName ||
      !selectedPlanMonth ||
      !planQuentity ||
      !remark ||
      !selectedPlan
    ) {
      toast.error("Please fill all required fields.");
      return;
    }
    try {
      setLoading(true);

      const payload = {
        planQty: planQuentity,
        userCode: user?.usercode,
        remark,
        matcode: selectedModelName.value,
        planMonthYear: selectedPlanMonth.value,
        planType: selectedPlan,
      };

      const res = await axios.put(
        `${baseURL}planing/add-production-plan`,
        payload
      );

      if (res?.data?.success) {
        toast.success(res?.data?.message || "Plan added successfully");

        await fetchProductionPlaningData();

        setSelectedModelName(null);
        setSelectedPlanMonth(null);
        setPlanQuentity(0);
        setRemark("");
      }
    } catch (error) {
      console.error("Failed to add plan:", error);
      toast.error(
        error.response?.data?.message || "Failed to add production plan"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlanMonthYear();
  }, []);

  useEffect(() => {
    fetchModelName();
  }, [selectedPlan]);

  return (
    <div className="p-6 bg-gray-100 min-h-screen rounded-lg">
      <Title title="Production Planing" align="center" />
      {/* Filters Section */}
      <div className="flex gap-2">
        <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-md">
          <div className="flex items-center gap-4">
            <div className="flex flex-col gap-2">
              <SelectField
                label="Model Name"
                options={modelNameOptions}
                value={selectedModelName?.value || ""}
                onChange={(e) => {
                  const selected = modelNameOptions.find(
                    (opt) => opt.value === e.target.value
                  );
                  if (selected) {
                    setSelectedModelName(selected);
                  }
                }}
                className="max-w-64"
              />
              <SelectField
                label="Plan Month Year"
                options={planMonthOptions}
                value={selectedPlanMonth?.value || ""}
                onChange={(e) => {
                  const selected = planMonthOptions.find(
                    (opt) => opt.value === e.target.value
                  );
                  if (selected) {
                    setSelectedPlanMonth(selected);
                  }
                }}
                className="max-w-64"
              />
            </div>
            <div className="flex flex-col gap-2">
              <InputField
                label="Add Quantity"
                type="number"
                placeholder="Enter Quantity"
                name="planQuentity"
                value={planQuentity}
                onChange={(e) => setPlanQuentity(e.target.value)}
                className="max-w-64"
              />
              <InputField
                label="Remark"
                type="text"
                placeholder="Enter Remark"
                name="remark"
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                className="max-w-64"
              />
            </div>
          </div>
        </div>
        <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-md">
          <div>
            <label className="block font-semibold mb-2">Select Plan</label>
            <div className="flex gap-6">
              {(user.role === "admin" || user.role === "planning team") && (
                <>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="plan"
                      value="assembly"
                      checked={selectedPlan === "assembly"}
                      onChange={() => setSelectedPlan("assembly")}
                      className="form-radio text-purple-600"
                    />
                    <span>Assembly Label</span>
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="plan"
                      value="fg"
                      checked={selectedPlan === "fg"}
                      onChange={() => setSelectedPlan("fg")}
                      className="form-radio text-purple-600"
                    />
                    <span>FG Label</span>
                  </label>
                </>
              )}
              {user.role === "production manager" && (
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="plan"
                    value="assembly"
                    checked={selectedPlan === "assembly"}
                    onChange={() => setSelectedPlan("assembly")}
                    className="form-radio text-purple-600"
                  />
                  <span>Assembly Label</span>
                </label>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 mt-4">
            <Button
              bgColor={loading ? "bg-gray-400" : "bg-green-500"}
              textColor={loading ? "text-white" : "text-black"}
              className={`font-semibold ${loading ? "cursor-not-allowed" : ""}`}
              onClick={() => fetchProductionPlaningData()}
              disabled={loading}
            >
              Search
            </Button>
            <Button
              bgColor="bg-yellow-300"
              textColor="text-black"
              className="font-semibold hover:bg-yellow-400"
              onClick={handleUpdate}
            >
              Update
            </Button>
            <Button
              bgColor={loading ? "bg-gray-400" : "bg-blue-500"}
              textColor={loading ? "text-white" : "text-black"}
              className={`font-semibold ${loading ? "cursor-not-allowed" : ""}`}
              // onClick={handleAddPlan}
              disabled={loading}
            >
              Add Plan
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Section */}
      <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-md">
        <div className="w-full bg-white border border-gray-300 rounded-md p-4">
          {/* Data Table */}
          {loading ? (
            <Loader />
          ) : (
            <div className="w-full max-h-[600px] overflow-x-auto">
              <table className="min-w-full border bg-white text-xs text-left rounded-lg table-auto">
                <thead className="bg-gray-200 sticky top-0 z-10 text-center">
                  <tr>
                    <th className="px-1 py-1 border min-w-[120px]">Plan No.</th>
                    <th className="px-1 py-1 border min-w-[120px]">
                      Plan Month Year
                    </th>
                    <th className="px-1 py-1 border min-w-[120px]">Name</th>
                    <th className="px-1 py-1 border min-w-[120px]">Plan Qty</th>
                    <th className="px-1 py-1 border min-w-[120px]">
                      Print Lbl
                    </th>
                    <th className="px-1 py-1 border min-w-[120px]">
                      Plan Type
                    </th>
                    <th className="px-1 py-1 border min-w-[120px]">Remark</th>
                    <th className="px-1 py-1 border min-w-[120px]">
                      User Name
                    </th>
                    <th className="px-1 py-1 border min-w-[120px]">
                      Created On
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {productionPlaningData && productionPlaningData.length > 0 ? (
                    productionPlaningData.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-100 text-center">
                        <td className="px-1 py-1 border">{item.PlanNo}</td>
                        <td className="px-1 py-1 border">
                          {item.PlanMonthYear}
                        </td>
                        <td className="px-1 py-1 border">{item.Alias}</td>
                        <td className="px-1 py-1 border">{item.PlanQty}</td>
                        <td className="px-1 py-1 border">{item.PrintLbl}</td>
                        <td className="px-1 py-1 border">{item.PlanType}</td>
                        <td className="px-1 py-1 border">{item.Remark}</td>
                        <td className="px-1 py-1 border">{item.username}</td>
                        <td className="px-1 py-1 border">
                          {item.CreatedOn &&
                            item.CreatedOn.replace("T", " ").replace("Z", "")}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="text-center py-4">
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
  );
};

export default ProductionPlaning;