import { useEffect, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import Title from "../../components/ui/Title";
import Button from "../../components/ui/Button";
import { CgProfile } from "react-icons/cg";
import { FaEye } from "react-icons/fa";
import { baseURL } from "../../assets/assets";
import Loader from "../../components/ui/Loader";

const History = () => {
  const [allVisitors, setAllVisitors] = useState([]);
  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selectedVisitor, setSelectedVisitor] = useState(null);
  const [visitLogs, setVisitLogs] = useState([]);
  const [limit, setLimit] = useState(20);
  const [offset, setOffset] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // Fetch visitors from backend
  const fetchVisitors = async () => {
    setLoading(true);
    try {
      const params = { limit, offset };
      const res = await axios.get(`${baseURL}visitor/history`, { params });
      if (res.data?.success) {
        setAllVisitors(res.data.data || []);
        setVisitors(res.data.data || []);
        setTotalCount(res.data.data?.length || 0);
      } else {
        toast.error(res.data?.message || "Failed to fetch visitors");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch visitors");
    } finally {
      setLoading(false);
    }
  };

  // Apply client-side search and date filters
  const applyFilters = () => {
    let filtered = [...allVisitors];

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (v) =>
          v.visitor_name?.toLowerCase().includes(searchLower) ||
          v.company?.toLowerCase().includes(searchLower)
      );
    }

    if (from) {
      filtered = filtered.filter(
        (v) => new Date(v.check_in_time) >= new Date(from + "T00:00:00")
      );
    }
    if (to) {
      filtered = filtered.filter(
        (v) => new Date(v.check_in_time) <= new Date(to + "T23:59:59")
      );
    }

    setVisitors(filtered);
    setTotalCount(filtered.length); // update count dynamically
  };

  useEffect(() => {
    applyFilters();
  }, [search, from, to, allVisitors]);

  useEffect(() => {
    fetchVisitors();
  }, [limit, offset]);

  const openDetails = async (visitor) => {
    setSelectedVisitor(visitor);
    try {
      const res = await axios.get(`${baseURL}visitor/details/${visitor.id}`);
      if (res.data?.success) {
        setVisitLogs(res.data.visit_logs || []);
      } else {
        toast.error(res.data?.message || "Failed to fetch visitor details");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch visitor details");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 overflow-x-hidden max-w-full">
      <Title title="Visitor History" align="center" />

      {/* Filters */}
      <div className="max-w-7xl mx-auto mt-6 grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
        <input
          type="text"
          placeholder="Search by Name or Company"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="col-span-2 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400"
        />
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400"
        />
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400"
        />
        <div className="flex gap-2">
          <Button
            onClick={applyFilters}
            bgColor="bg-blue-600"
            textColor="text-white"
          >
            Apply
          </Button>
          <Button
            onClick={() => {
              setSearch("");
              setFrom("");
              setTo("");
              setOffset(0);
              fetchVisitors();
            }}
            bgColor="bg-gray-400"
            textColor="text-white"
          >
            Reset
          </Button>
        </div>
      </div>

      {/* Pagination */}
      <div className="mt-6 max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-4 rounded-lg shadow-sm">
        {/* Per page */}
        <div className="flex items-center gap-2">
          <label className="text-gray-700 font-medium">Per page:</label>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
          >
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>

        {/* Count */}
        <div className="text-gray-700 font-medium text-center">
          Count: <span className="text-blue-600 font-bold">{totalCount}</span>
        </div>

        {/* Prev/Next */}
        <div className="flex gap-2">
          <Button
            onClick={() => offset > 0 && setOffset(offset - limit)}
            bgColor={offset > 0 ? "bg-blue-600" : "bg-gray-300"}
            textColor={offset > 0 ? "text-white" : "text-black"}
            className="px-4 py-2 rounded-lg"
          >
            Prev
          </Button>
          <Button
            onClick={() =>
              offset + limit < totalCount && setOffset(offset + limit)
            }
            bgColor={
              offset + limit < totalCount ? "bg-blue-600" : "bg-gray-300"
            }
            textColor={
              offset + limit < totalCount ? "text-white" : "text-black"
            }
            className="px-4 py-2 rounded-lg"
          >
            Next
          </Button>
        </div>
      </div>

      {/* Visitors List */}
      <div className="mx-auto mt-8">
        {loading ? (
          <div className="text-center py-12">
            <Loader />
          </div>
        ) : visitors.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No visitors found.
          </div>
        ) : (
          <div
            className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 px-2"
            style={{ maxHeight: "calc(100vh - 300px)", overflowY: "auto" }}
          >
            {visitors.map((v) => (
              <div
                key={v.id}
                className="bg-white rounded-2xl shadow-lg p-6 flex flex-col items-center text-center hover:shadow-xl transition-shadow"
              >
                {v.photo_url ? (
                  <img
                    src={v.photo_url}
                    alt={v.visitor_name}
                    className="w-24 h-24 rounded-full object-cover border-2 border-gray-200"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center">
                    <CgProfile className="text-3xl text-gray-400" />
                  </div>
                )}
                <h3 className="mt-4 text-lg font-semibold">{v.visitor_name}</h3>
                <p className="text-gray-500 text-sm">{v.company || "N/A"}</p>
                <p className="text-gray-400 text-sm mt-1">
                  Last Visit:{" "}
                  {v.check_in_time?.replace("T", " ").replace("Z", "") || "N/A"}
                </p>
                <p className="text-gray-400 text-sm">
                  Visited: {v.employee_name || "N/A"} (
                  {v.department_name || "N/A"})
                </p>
                <p className="mt-2 text-blue-600 font-medium">
                  Visits: {v.total_passes ?? 0}
                </p>
                <Button
                  onClick={() => openDetails(v)}
                  bgColor="bg-blue-600"
                  textColor="text-white"
                  className="mt-4 px-4 py-2 flex items-center gap-2"
                >
                  <FaEye /> View Details
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Visitor Details Modal */}
      {selectedVisitor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full p-6 relative overflow-y-auto max-h-[90vh] border border-gray-200">
            {/* Close Button */}
            <button
              className="absolute top-5 right-5 text-gray-400 hover:text-gray-700 text-2xl font-bold"
              onClick={() => {
                setSelectedVisitor(null);
                setVisitLogs([]);
              }}
            >
              ✖
            </button>

            {/* Visitor Info */}
            <div className="flex items-center gap-6 mb-6 border-b border-gray-200 pb-4">
              {selectedVisitor.photo_url ? (
                <img
                  src={selectedVisitor.photo_url}
                  alt="photo"
                  className="w-24 h-24 rounded-full object-cover border-2 border-blue-500"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center border-2 border-blue-500">
                  <CgProfile className="text-4xl text-gray-400" />
                </div>
              )}
              <div>
                <h2 className="text-2xl font-bold text-gray-800">
                  {selectedVisitor.visitor_name}
                </h2>
                <p className="text-gray-500 mt-1 flex items-center gap-2">
                  <span className="font-medium">Contact:</span>{" "}
                  {selectedVisitor.contact_no || "N/A"}
                </p>
                <p className="text-gray-500 mt-1 flex items-center gap-2">
                  <span className="font-medium">Company:</span>{" "}
                  {selectedVisitor.company || "N/A"}
                </p>
              </div>
            </div>

            {/* Recent Visits */}
            <h3 className="text-xl font-semibold text-gray-700 mb-3">
              Recent Visits
            </h3>
            {visitLogs.length === 0 ? (
              <p className="text-gray-500 text-sm">No visit logs found.</p>
            ) : (
              <div className="space-y-4 max-h-[450px] overflow-y-auto pr-2">
                {visitLogs.map((log) => (
                  <div
                    key={log.pass_id + log.check_in_time}
                    className="bg-gray-50 rounded-xl shadow-sm p-4 border-l-4 border-blue-500 hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="space-y-1">
                        <p className="text-gray-700 font-medium text-sm">
                          Check-in:{" "}
                          {log.check_in_time
                            ?.replace("T", " ")
                            .replace("Z", "") || "N/A"}
                        </p>
                        <p className="text-gray-500 text-sm">
                          Employee: {log.employee_name || "N/A"}
                        </p>
                        <p className="text-gray-500 text-sm">
                          Token: {log.token || "N/A"}
                        </p>
                      </div>
                      <p className="text-gray-700 font-medium text-sm text-right">
                        Check-out:{" "}
                        {log.check_out_time
                          ?.replace("T", " ")
                          .replace("Z", "") || "N/A"}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-gray-500 text-sm">
                      <p>
                        <span className="font-medium">Department:</span>{" "}
                        {log.department_name || "N/A"}
                      </p>
                      <p>
                        <span className="font-medium">Purpose:</span>{" "}
                        {log.purpose_of_visit || "N/A"}
                      </p>
                    </div>
                    {log.other_notes && (
                      <p className="mt-2 text-gray-500 text-sm">
                        <span className="font-medium">Notes:</span>{" "}
                        {log.other_notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default History;
