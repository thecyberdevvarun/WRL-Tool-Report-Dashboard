import { useState } from "react";
import Button from "../../components/ui/Button";
import ExportButton from "../../components/ui/ExportButton";
import Title from "../../components/ui/Title";
import InputField from "../../components/ui/InputField";
import DateTimePicker from "../../components/ui/DateTimePicker";
import axios from "axios";
import Loader from "../../components/ui/Loader";
import toast from "react-hot-toast";
import { baseURL } from "../../assets/assets";

const FGCasting = () => {
  const [loading, setLoading] = useState(false);
  const [serialNumber, setSerialNumber] = useState("");
  const [fetchFgCastingData, setFetchFgCastingData] = useState([]);
  const initialCastingState = {
    vehicleNo: "",
    lrNo: "",
    transporter: "",
    location: "",
    sealNo: "",
    driverPhNo: "",
    invoiceNo: "",
    date: "",
  };
  const [castingDetails, setCastingDetails] = useState(initialCastingState);

  const fetchFgCastingDataBySession = async () => {
    if (!serialNumber) {
      toast.error("Please select Serial Number.");
      return;
    }
    try {
      setLoading(true);
      const res = await axios.get(`${baseURL}dispatch/fg-casting`, {
        params: { sessionId: serialNumber },
      });
      const data = res?.data?.data;
      setFetchFgCastingData(data);
    } catch (error) {
      console.error("Failed to fetch Fg Casting data:", error);
      toast.error("Failed to fetch Fg Casting data");
    } finally {
      setLoading(false);
    }
  };

  const handleClearFilters = () => {
    setSerialNumber("");
    setFetchFgCastingData([]);
  };

  const handleQuery = () => {
    fetchFgCastingDataBySession();
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCastingDetails((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCastingData = () => {
    toast.success("Casting data logged to console");
    setCastingDetails(initialCastingState);
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen rounded-lg">
      <Title title="FG Casting" align="center" />

      {/* Filters */}
      <div className="bg-purple-100 border border-dashed border-purple-400 p-4 rounded-md flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-4">
          <InputField
            label="Serial Number"
            type="text"
            placeholder="Enter Serial Number"
            className="max-w-4xl"
            name="serialNumber"
            value={serialNumber}
            onChange={(e) => setSerialNumber(e.target.value)}
          />
          <div className="flex items-center justify-center gap-4">
            <Button
              bgColor={loading ? "bg-gray-400" : "bg-blue-500"}
              textColor={loading ? "text-white" : "text-black"}
              className={`font-semibold ${loading ? "cursor-not-allowed" : ""}`}
              onClick={() => {
                handleQuery();
                handleCastingData();
              }}
              disabled={loading}
            >
              Query
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 items-center justify-center my-4">
            <Button
              bgColor="bg-white"
              textColor="text-black"
              className="border border-gray-400 hover:bg-gray-100 px-3 py-1"
              onClick={handleClearFilters}
            >
              Clear Filter
            </Button>
            <ExportButton
              data={fetchFgCastingData.map((item) => ({
                ModelName: item.ModelName,
                FGSerialNo: item.FG_Serial,
                AssetCode: item.VSerial,
                CustomerQR: item.CustomerQR,
                NFCID: item.NFCID,
                CreatedOn: item.CreatedOn.replace("T", " ").replace("Z", ""),
              }))}
              filename="FG_Casting_Data"
            />
            <div className="mt-4 text-left font-bold text-lg">
              COUNT:{" "}
              <span className="text-blue-700">
                {fetchFgCastingData?.length || 0}
              </span>
            </div>
          </div>
        </div>

        {/* Second Row */}
        <div className="w-full">
          <fieldset className="border border-black p-4 rounded-md">
            <legend className="font-semibold text-gray-700 px-2">
              Casting Details
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {/* Column 1 */}
              <div className="flex flex-col gap-4">
                <InputField
                  label="Vehicle No."
                  type="text"
                  placeholder="Enter details"
                  className="w-full"
                  name="vehicleNo"
                  value={castingDetails.vehicleNo}
                  onChange={handleChange}
                />
                <InputField
                  label="Lr No."
                  type="text"
                  placeholder="Enter details"
                  className="w-full"
                  name="lrNo"
                  value={castingDetails.lrNo}
                  onChange={handleChange}
                />
              </div>

              {/* Column 2 */}
              <div className="flex flex-col gap-4">
                <InputField
                  label="Transporter"
                  type="text"
                  placeholder="Enter details"
                  className="w-full"
                  name="transporter"
                  value={castingDetails.transporter}
                  onChange={handleChange}
                />
                <InputField
                  label="Location"
                  type="text"
                  placeholder="Enter details"
                  className="w-full"
                  name="location"
                  value={castingDetails.location}
                  onChange={handleChange}
                />
              </div>

              {/* Column 3 */}
              <div className="flex flex-col gap-4">
                <InputField
                  label="Seal No."
                  type="text"
                  placeholder="Enter details"
                  className="w-full"
                  name="sealNo"
                  value={castingDetails.sealNo}
                  onChange={handleChange}
                />
                <InputField
                  label="Driver Ph. No."
                  type="text"
                  placeholder="Enter details"
                  className="w-full"
                  name="driverPhNo"
                  value={castingDetails.driverPhNo}
                  onChange={handleChange}
                />
              </div>

              {/* Column 4 */}
              <div className="flex flex-col gap-4">
                <InputField
                  label="Invoice No."
                  type="text"
                  placeholder="Enter details"
                  className="w-full"
                  name="invoiceNo"
                  value={castingDetails.invoiceNo}
                  onChange={handleChange}
                />
                <DateTimePicker
                  label="Date"
                  name="date"
                  value={castingDetails.date}
                  onChange={handleChange}
                />
              </div>
            </div>
          </fieldset>
        </div>
      </div>

      {/* Summary Section */}
      <div className="bg-purple-100 border border-dashed border-purple-400 p-4 mt-4 rounded-md">
        <div className="bg-white border border-gray-300 rounded-md p-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Table 1 */}
            {loading ? (
              <Loader />
            ) : (
              <div className="w-full max-h-[600px] overflow-x-auto">
                <table className=" border bg-white text-xs text-left rounded-lg table-auto">
                  <thead className="bg-gray-200 sticky top-0 z-10 text-center">
                    <tr>
                      <th className="px-1 py-1 border min-w-[120px]">Model</th>
                      <th className="px-1 py-1 border min-w-[120px]">Serial</th>
                      <th className="px-1 py-1 border min-w-[120px]">
                        Asset Code
                      </th>
                      <th className="px-1 py-1 border min-w-[120px]">
                        Customer QR
                      </th>
                      <th className="px-1 py-1 border min-w-[120px]">
                        NFC UID
                      </th>
                      <th className="px-1 py-1 border min-w-[120px]">
                        Created On
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {fetchFgCastingData.length > 0 ? (
                      fetchFgCastingData.map((item, index) => (
                        <tr
                          key={index}
                          className="hover:bg-gray-100 text-center"
                        >
                          <td className="px-1 py-1 border">{item.ModelName}</td>
                          <td className="px-1 py-1 border">{item.FG_Serial}</td>
                          <td className="px-1 py-1 border">{item.VSerial}</td>
                          <td className="px-1 py-1 border">
                            {item.CustomerQR}
                          </td>
                          <td className="px-1 py-1 border">{item.NFCID}</td>
                          <td className="px-1 py-1 border">
                            {item.CreatedOn &&
                              item.CreatedOn.replace("T", " ").replace("Z", "")}
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
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FGCasting;
