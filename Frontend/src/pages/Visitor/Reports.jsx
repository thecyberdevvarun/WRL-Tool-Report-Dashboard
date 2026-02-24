import { useState } from "react";
import Title from "../../components/ui/Title";
import axios from "axios";
import toast from "react-hot-toast";
import Button from "../../components/ui/Button";
import DateTimePicker from "../../components/ui/DateTimePicker";
import { baseURL } from "../../assets/assets";
import Loader from "../../components/ui/Loader";

const Reports = () => {
  const [loading, setLoading] = useState(false);
  const [visitors, setVisitors] = useState([]);
  const [ydayLoading, setYdayLoading] = useState(false);
  const [todayLoading, setTodayLoading] = useState(false);
  const [monthLoading, setMonthLoading] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [searchParams, setSearchParams] = useState({ term: "", field: "all" });

  const formatDate = (date) => {
    const pad = (n) => (n < 10 ? "0" + n : n);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
      date.getDate()
    )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const fetchVisitorData = async (start, end, setLoader) => {
    try {
      setLoader(true);
      setVisitors([]);
      const res = await axios.get(`${baseURL}visitor/repot`, {
        params: { startTime: start, endTime: end },
      });
      if (res?.data?.success) setVisitors(res.data.data || []);
    } catch (error) {
      console.error("Failed to fetch visitor data:", error);
      toast.error("Failed to fetch visitor data.");
    } finally {
      setLoader(false);
    }
  };

  const fetchYdayVisitorData = () => {
    const now = new Date();
    const today8AM = new Date(now);
    today8AM.setHours(8, 0, 0, 0);
    const yesterday8AM = new Date(today8AM);
    yesterday8AM.setDate(today8AM.getDate() - 1);
    fetchVisitorData(
      formatDate(yesterday8AM),
      formatDate(today8AM),
      setYdayLoading
    );
  };

  const fetchTdayVisitorData = () => {
    const now = new Date();
    const today8AM = new Date(now);
    today8AM.setHours(8, 0, 0, 0);
    fetchVisitorData(formatDate(today8AM), formatDate(now), setTodayLoading);
  };

  const fetchMTDVisitorData = () => {
    const now = new Date();
    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
      8,
      0,
      0
    );
    fetchVisitorData(
      formatDate(startOfMonth),
      formatDate(now),
      setMonthLoading
    );
  };

  const fetchVisitors = async () => {
    if (!startTime || !endTime)
      return toast.error("Please select the Time Range.");
    await fetchVisitorData(startTime, endTime, setLoading);
  };

  const filteredReports = visitors.filter((item) => {
    const { term, field } = searchParams;
    if (!term) return true;
    const lowerTerm = term.toLowerCase();
    const safeLower = (value) => (value ? value.toLowerCase() : "");

    switch (field) {
      case "name":
        return safeLower(item.visitor_name).includes(lowerTerm);
      case "contactno":
        return safeLower(item.contact_no).includes(lowerTerm);
      case "email":
        return safeLower(item.email).includes(lowerTerm);
      case "company":
        return safeLower(item.company).includes(lowerTerm);
      default:
        return (
          safeLower(item.visitor_name).includes(lowerTerm) ||
          safeLower(item.contact_no).includes(lowerTerm) ||
          safeLower(item.email).includes(lowerTerm) ||
          safeLower(item.company).includes(lowerTerm)
        );
    }
  });

  const handleSendReport = async () => {
    if (!filteredReports.length) return toast.error("No report data to send.");
    try {
      const res = await axios.post(`${baseURL}visitor/send-report`, {
        visitors: filteredReports,
      });
      res?.data?.success
        ? toast.success("Report sent successfully!")
        : toast.error(res?.data?.message || "Failed to send report.");
    } catch (error) {
      console.error("Failed to send report:", error);
      toast.error("Failed to send report.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 overflow-x-hidden max-w-full">
      <Title title="Visitors Reports" align="center" />

      {/* Filters & Quick Actions */}
      <div className="mt-6 bg-white p-6 rounded-xl shadow-sm flex flex-col md:flex-row gap-6 justify-between items-center">
        <div className="flex flex-wrap gap-4 items-center w-full md:w-auto">
          <DateTimePicker
            label="Start Time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
          <DateTimePicker
            label="End Time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
          <Button
            onClick={fetchVisitors}
            bgColor="bg-blue-600"
            textColor="text-white"
            className="px-4 py-2"
          >
            {loading ? <Loader /> : "Query"}
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="text"
            placeholder="Search visitor..."
            className="px-3 py-2 border rounded-md"
            value={searchParams.term}
            onChange={(e) =>
              setSearchParams((prev) => ({ ...prev, term: e.target.value }))
            }
          />
          <select
            className="px-3 py-2 border rounded-md"
            value={searchParams.field}
            onChange={(e) =>
              setSearchParams((prev) => ({ ...prev, field: e.target.value }))
            }
          >
            <option value="all">All Fields</option>
            <option value="name">Name</option>
            <option value="contactno">Contact No.</option>
            <option value="email">Email</option>
            <option value="company">Company</option>
          </select>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={fetchYdayVisitorData}
            bgColor="bg-yellow-500"
            textColor="text-black"
          >
            {ydayLoading ? <Loader /> : "YDAY"}
          </Button>
          <Button
            onClick={fetchTdayVisitorData}
            bgColor="bg-blue-500"
            textColor="text-white"
          >
            {todayLoading ? <Loader /> : "TDAY"}
          </Button>
          <Button
            onClick={fetchMTDVisitorData}
            bgColor="bg-green-500"
            textColor="text-white"
          >
            {monthLoading ? <Loader /> : "MTD"}
          </Button>
        </div>
      </div>

      {/* Visitors Table */}
      <div className="mt-4 bg-white p-3 rounded-lg shadow-sm overflow-x-auto">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-md font-semibold text-gray-700">
            Visitors ({filteredReports.length})
          </h3>

          <Button
            onClick={handleSendReport}
            bgColor="bg-purple-600"
            textColor="text-white"
            className="px-3 py-1 text-sm"
          >
            Send Report
          </Button>
        </div>

        <table className="min-w-full table-auto text-xs border-collapse">
          <thead className="bg-gray-100 sticky top-0 z-10 text-xs">
            <tr>
              {[
                "Sr.No.",
                "Visitor Type",
                "Name",
                "Contact",
                "Email",
                "Company",
                "Address",
                "State",
                "City",
                "ID Type",
                "ID No",
                "Vehicle",
                "Employee To Visit",
                "Department To visit",
                "Check In",
                "Check Out",
                "Visit Duration",
                "No of Visit",
                "Purpose Of Visit",
                "Token",
              ].map((header, idx) => (
                <th
                  key={idx}
                  className="px-1 py-1 border text-center whitespace-nowrap"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {filteredReports.length ? (
              filteredReports.map((v, i) => (
                <tr key={i} className="hover:bg-gray-50 transition">
                  <td className="px-1 py-1 border text-center">{i + 1}</td>
                  <td className="px-1 py-1 border text-center whitespace-nowrap">
                    {v.visit_type}
                  </td>
                  <td className="px-1 py-1 border text-center whitespace-nowrap">
                    {v.visitor_name}
                  </td>
                  <td className="px-1 py-1 border text-center">
                    {v.contact_no}
                  </td>
                  <td className="px-1 py-1 border text-center">{v.email}</td>
                  <td className="px-1 py-1 border text-center">{v.company}</td>
                  <td className="px-1 py-1 border text-center">{v.address}</td>
                  <td className="px-1 py-1 border text-center">{v.state}</td>
                  <td className="px-1 py-1 border text-center">{v.city}</td>
                  <td className="px-1 py-1 border text-center">
                    {v.identity_type}
                  </td>
                  <td className="px-1 py-1 border text-center">
                    {v.identity_no}
                  </td>
                  <td className="px-1 py-1 border text-center">
                    {v.vehicle_details}
                  </td>
                  <td className="px-1 py-1 border text-center">
                    {v.employee_name}
                  </td>
                  <td className="px-1 py-1 border text-center">
                    {v.department_name}
                  </td>
                  <td className="px-1 py-1 border text-center">
                    {v.check_in_time?.replace("T", " ").replace("Z", "")}
                  </td>
                  <td className="px-1 py-1 border text-center">
                    {v.check_out_time ? (
                      v.check_out_time.replace("T", " ").replace("Z", "")
                    ) : (
                      <span className="text-green-600 font-bold">
                        Currently In
                      </span>
                    )}
                  </td>
                  <td className="px-1 py-1 border text-center">
                    {v.visit_duration}
                  </td>
                  <td className="px-1 py-1 border text-center">
                    {v.no_of_visit}
                  </td>
                  <td className="px-1 py-1 border text-center">
                    {v.purpose_of_visit}
                  </td>
                  <td className="px-1 py-1 border text-center">{v.token}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={16} className="text-center py-4 text-gray-500">
                  No visitors found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Reports;
