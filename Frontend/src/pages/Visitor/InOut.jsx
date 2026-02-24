import { useEffect, useState, useRef } from "react";
import Title from "../../components/ui/Title";
import Button from "../../components/ui/Button";
import {
  FaSignInAlt,
  FaSignOutAlt,
  FaUser,
  FaTimes,
  FaUsers,
} from "react-icons/fa";
import {
  MdPhone,
  MdEmail,
  MdBusiness,
  MdLocationOn,
  MdAccessTime,
} from "react-icons/md";
import { CgProfile } from "react-icons/cg";
import axios from "axios";
import toast from "react-hot-toast";
import { baseURL } from "../../assets/assets";
import { useNavigate } from "react-router-dom";

const InOut = () => {
  const [loading, setLoading] = useState(false);
  const [visitorLogs, setVisitorLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const navigate = useNavigate();

  // Refs for Scan Inputs
  const scanInRef = useRef(null);
  const scanOutRef = useRef(null);

  // Ask notification permission
  useEffect(() => {
    if ("Notification" in window && Notification.permission !== "granted") {
      Notification.requestPermission();
    }
  }, []);

  // Success Sound
  const playSuccessSound = () => {
    const audio = new Audio("/sounds/success.mp3");
    audio.play().catch(() => {});
  };

  // Show browser notification
  const showNotification = (title, message) => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, {
        body: message,
        icon: "/logo192.png",
      });
    }
  };

  // Fetch visitor logs
  const fetchVisitorLogs = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${baseURL}visitor/logs`);
      if (res?.data?.success) {
        setVisitorLogs(res.data.data);
      } else {
        toast.error(res?.data?.message || "Failed to fetch visitor logs");
      }
    } catch (error) {
      toast.error("Failed to fetch visitor logs");
    } finally {
      setLoading(false);
    }
  };

  // Periodic check for inside visitors
  useEffect(() => {
    const checkVisitorsInside = async () => {
      try {
        const res = await axios.get(`${baseURL}visitor/logs`);
        if (res?.data?.success) {
          const inside = res.data.data.filter(
            (v) => v.check_in_time && !v.check_out_time
          );
          if (inside.length > 0) {
            const message = inside
              .map((v) => `${v.visitor_name} (${v.pass_id})`)
              .join(", ");

            showNotification(
              "Visitors still inside",
              `The following visitors have not checked out: ${message}`
            );

            await axios.post(`${baseURL}visitor/notify-inside-visitors`);
          }
        }
      } catch {}
    };

    const interval = setInterval(checkVisitorsInside, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Handle IN/OUT event
  const handleVisitorActionForCard = async (type, passId) => {
    if (!passId.trim()) {
      toast.error("Pass ID is missing.");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${baseURL}visitor/${type}`, { passId });

      if (res?.data?.success) {
        playSuccessSound();

        toast.success(
          `Visitor ${
            type === "in" ? "checked in" : "checked out"
          } successfully!`
        );

        // Highlight popup effect
        showNotification(
          type === "in" ? "Visitor Checked In" : "Visitor Checked Out",
          `Pass ID: ${passId}`
        );

        await fetchVisitorLogs();
      } else {
        toast.error(res?.data?.message || "Failed to update visitor status.");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVisitorLogs();
    setTimeout(() => scanInRef.current?.focus(), 500);
  }, []);

  // Search filter
  const filteredVisitors = visitorLogs.filter((visitor) => {
    const query = searchTerm.toLowerCase();
    return (
      visitor.visitor_name?.toLowerCase().includes(query) ||
      visitor.pass_id?.toLowerCase().includes(query) ||
      visitor.department_name?.toLowerCase().includes(query) ||
      visitor.department_to_visit?.toLowerCase().includes(query)
    );
  });

  // Visitor counts
  const totalVisitors = filteredVisitors.length;
  const currentlyIn = filteredVisitors.filter(
    (v) => v.check_in_time && !v.check_out_time
  ).length;
  const currentlyOut = filteredVisitors.filter((v) => v.check_out_time).length;

  return (
    <div className="min-h-screen bg-gray-100 p-4 overflow-x-hidden max-w-full relative">
      <Title title="Manage Visitor" align="center" />

      {/* Search Bar */}
      <div className="max-w-md mx-auto mt-6">
        <input
          type="text"
          placeholder="Search by name, pass ID, department..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full border border-gray-300 rounded-lg p-3 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
        />
      </div>

      {/* Scan In / Out */}
      <div className="max-w-3xl mx-auto mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Scan IN */}
        <div className="flex gap-2">
          <input
            ref={scanInRef}
            type="text"
            placeholder="Scan Pass ID for IN"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleVisitorActionForCard("in", e.target.value);
                e.target.value = "";
              }
            }}
            className="w-full border border-green-400 rounded-lg p-3 shadow-sm focus:ring-2 focus:ring-green-500 outline-none"
          />
          <Button
            onClick={(e) => {
              const input = e.target.parentNode.querySelector("input");
              handleVisitorActionForCard("in", input.value);
              input.value = "";
            }}
            bgColor="bg-green-600"
            textColor="text-white"
            className="px-4 py-2 rounded-md"
          >
            IN
          </Button>
        </div>

        {/* Scan OUT */}
        <div className="flex gap-2">
          <input
            ref={scanOutRef}
            type="text"
            placeholder="Scan Pass ID for OUT"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleVisitorActionForCard("out", e.target.value);
                e.target.value = "";
              }
            }}
            className="w-full border border-red-400 rounded-lg p-3 shadow-sm focus:ring-2 focus:ring-red-500 outline-none"
          />
          <Button
            onClick={(e) => {
              const input = e.target.parentNode.querySelector("input");
              handleVisitorActionForCard("out", input.value);
              input.value = "";
            }}
            bgColor="bg-red-600"
            textColor="text-white"
            className="px-4 py-2 rounded-md"
          >
            OUT
          </Button>
        </div>
      </div>

      {/* Main Card Container */}
      <div className="mt-10 bg-white shadow-md rounded-xl p-6 border border-gray-200">
        {/* Counters */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          {/* Total / In / Out */}
          <div className="flex gap-6 text-lg font-semibold text-gray-700 items-center">
            <span className="flex items-center gap-2">
              <FaUsers className="text-blue-600 text-xl" />
              Total: {totalVisitors}
            </span>

            <span className="flex items-center gap-2 text-green-600">
              <FaSignInAlt className="text-green-600 text-xl" />
              In: {currentlyIn}
            </span>

            <span className="flex items-center gap-2 text-red-600">
              <FaSignOutAlt className="text-red-600 text-xl" />
              Out: {currentlyOut}
            </span>
          </div>
        </div>

        {/* Visitor List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin h-10 w-10 border-b-2 border-blue-600 rounded-full mx-auto"></div>
            <p className="text-gray-500 mt-4">Loading visitors...</p>
          </div>
        ) : filteredVisitors.length > 0 ? (
          <div className="grid gap-6">
            {filteredVisitors.map((visitor, index) => {
              const isCurrentlyIn =
                visitor.check_in_time && !visitor.check_out_time;
              const atSecurityGate =
                visitor.created_at &&
                !visitor.check_out_time &&
                !visitor.check_in_time;

              return (
                <div
                  key={visitor.pass_id || index}
                  className={`transition-all duration-200 rounded-xl p-6 border ${
                    isCurrentlyIn
                      ? "bg-green-50 border-green-400 shadow-md"
                      : atSecurityGate
                      ? "bg-blue-50 border-blue-400 shadow-md"
                      : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <div className="flex flex-col lg:flex-row items-center lg:items-start gap-6">
                    {/* Photo */}
                    <div
                      className="shrink-0 relative cursor-pointer"
                      onClick={() =>
                        visitor.visitor_photo &&
                        setSelectedImage(visitor.visitor_photo)
                      }
                    >
                      {visitor.visitor_photo ? (
                        <img
                          src={visitor.visitor_photo}
                          alt={`${visitor.visitor_name || "Visitor"}'s photo`}
                          className="w-24 h-24 object-cover rounded-full border-4 border-blue-300 shadow-md hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="w-24 h-24 flex items-center justify-center bg-gray-100 rounded-full border-4 border-gray-300 text-gray-400 shadow-md">
                          <CgProfile className="text-5xl" />
                        </div>
                      )}

                      {isCurrentlyIn && (
                        <span className="absolute -top-2 -right-2 bg-green-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow">
                          Currently In
                        </span>
                      )}
                      {atSecurityGate && (
                        <span className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow">
                          At Security Gate
                        </span>
                      )}
                    </div>

                    {/* Visitor Info */}
                    <div className="flex-1 text-center lg:text-left">
                      <h3 className="text-2xl font-bold text-gray-800 mb-1">
                        {visitor.visitor_name}
                      </h3>

                      <p className="text-sm text-gray-500 mb-3">
                        <span className="font-medium">Pass ID:</span>{" "}
                        {visitor.pass_id}
                      </p>

                      {/* Times */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                        <div className="flex items-center gap-2">
                          <MdAccessTime className="text-green-600 text-xl" />
                          <span className="font-medium">Check In:</span>
                          <span>
                            {visitor.check_in_time
                              ? visitor.check_in_time
                                  .replace("T", " ")
                                  .replace("Z", "")
                              : "N/A"}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <MdAccessTime className="text-red-600 text-xl" />
                          <span className="font-medium">Check Out:</span>
                          <span>
                            {visitor.check_out_time
                              ? visitor.check_out_time
                                  .replace("T", " ")
                                  .replace("Z", "")
                              : "N/A"}
                          </span>
                        </div>
                      </div>

                      {/* Details */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 justify-center lg:justify-start">
                            <MdBusiness className="text-purple-500" />
                            <span>{visitor.name || "N/A"}</span>
                          </div>
                          <div className="flex items-center gap-2 justify-center lg:justify-start">
                            <MdPhone className="text-blue-500" />
                            <span>{visitor.visitor_contact_no || "N/A"}</span>
                          </div>
                          <div className="flex items-center gap-2 justify-center lg:justify-start">
                            <MdBusiness className="text-purple-500" />
                            <span>{visitor.purpose_of_visit || "N/A"}</span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center gap-2 justify-center lg:justify-start">
                            <MdBusiness className="text-purple-500" />
                            <span>{visitor.department_name || "N/A"}</span>
                          </div>
                          <div className="flex items-center gap-2 justify-center lg:justify-start">
                            <MdEmail className="text-green-500" />
                            <span>{visitor.company || "N/A"}</span>
                          </div>
                          <div className="flex items-center gap-2 justify-center lg:justify-start">
                            <MdLocationOn className="text-red-500" />
                            <span>{visitor.vehicle_details || "N/A"}</span>
                          </div>
                        </div>
                      </div>

                      {/* Buttons */}
                      <div className="mt-4 flex flex-wrap justify-center lg:justify-start gap-3">
                        {atSecurityGate && (
                          <Button
                            onClick={() =>
                              handleVisitorActionForCard("in", visitor.pass_id)
                            }
                            bgColor="bg-blue-600"
                            textColor="text-white"
                            className="px-4 py-2 rounded-md flex items-center gap-2"
                          >
                            <FaSignInAlt /> In
                          </Button>
                        )}

                        {isCurrentlyIn && (
                          <>
                            <Button
                              onClick={() =>
                                handleVisitorActionForCard(
                                  "out",
                                  visitor.pass_id
                                )
                              }
                              bgColor="bg-red-600"
                              textColor="text-white"
                              className="px-4 py-2 rounded-md flex items-center gap-2"
                            >
                              <FaSignOutAlt /> Out
                            </Button>

                            <Button
                              onClick={() =>
                                navigate(
                                  `/visitor-pass-display/${visitor.pass_id}`
                                )
                              }
                              bgColor="bg-yellow-500"
                              textColor="text-white"
                              className="px-4 py-2 rounded-md flex items-center gap-2"
                            >
                              🖨️ Reprint Pass
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16">
            <FaUser className="text-6xl text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-gray-600">
              No visitors found
            </h3>
          </div>
        )}
      </div>

      {/* Photo Modal */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50">
          <div className="relative max-w-3xl">
            <img
              src={selectedImage}
              alt="Visitor"
              className="max-h-[80vh] rounded-lg shadow-2xl border-4 border-white"
            />
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-6 -right-6 bg-red-600 text-white rounded-full p-2 shadow-lg"
            >
              <FaTimes className="text-lg" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InOut;
