import { useEffect, useState } from "react";
import { FaUsers, FaDoorOpen, FaCalendarAlt, FaChartBar } from "react-icons/fa";
import { Bar, Pie } from "react-chartjs-2";
import {
  Chart,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import axios from "axios";
import toast from "react-hot-toast";
import { baseURL } from "../../assets/assets";
import SelectField from "../../components/ui/SelectField";

// Register Chart.js components
Chart.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

// Function to generate a dynamic color palette
const generateColorPalette = (numDepartments) => {
  const baseColors = [
    // Expanded color palette
    "rgba(255, 99, 132, 0.6)", // Pink
    "rgba(54, 162, 235, 0.6)", // Blue
    "rgba(255, 206, 86, 0.6)", // Yellow
    "rgba(75, 192, 192, 0.6)", // Teal
    "rgba(153, 102, 255, 0.6)", // Purple
    "rgba(255, 159, 64, 0.6)", // Orange
    "rgba(199, 199, 199, 0.6)", // Gray
    "rgba(83, 102, 255, 0.6)", // Indigo
    "rgba(40, 159, 64, 0.6)", // Green
    "rgba(210, 99, 132, 0.6)", // Coral
    "rgba(90, 162, 235, 0.6)", // Sky Blue
    "rgba(255, 165, 0, 0.6)", // Dark Orange
    "rgba(138, 43, 226, 0.6)", // Blue Violet
    "rgba(255, 20, 147, 0.6)", // Deep Pink
    "rgba(0, 128, 128, 0.6)", // Teal
    "rgba(255, 69, 0, 0.6)", // Red Orange
  ];

  const borderColors = baseColors.map((color) => color.replace("0.6)", "1)"));

  return {
    backgroundColor: baseColors.slice(0, numDepartments),
    borderColor: borderColors.slice(0, numDepartments),
  };
};

const DashboardCard = ({ icon: Icon, title, value, color }) => (
  <div className="bg-white shadow-md rounded-lg p-4 flex items-center">
    <div className={`mr-4 p-3 rounded-full ${color}`}>
      <Icon className="text-white text-2xl" />
    </div>
    <div>
      <p className="text-gray-500 text-sm">{title}</p>
      <h2 className="text-2xl font-bold">{value}</h2>
    </div>
  </div>
);

const Dashboard = () => {
  const [dashboardData, setDashboardData] = useState({
    totalVisitors: 0,
    activeVisitors: 0,
    todayVisits: 0,
    departments: [],
    recentVisitors: [],
    visitorTrend: [],
  });
  const Filter = [
    { label: "Day", value: "day" },
    { label: "Month", value: "month" },
  ];
  const [filter, setFilter] = useState(Filter[0]);

  const getDashboardStats = async () => {
    try {
      const res = await axios.get(`${baseURL}visitor/dashboard-stats`, {
        params: {
          filter: filter.value,
        },
      });

      if (res?.data?.success) {
        const data = res?.data?.dashboardStats;
        setDashboardData({
          activeVisitors: data.activeVisitors || 0,
          departments: data.departments || [],
          recentVisitors: data.recentVisitors || [],
          todayVisits: data.todayVisits || 0,
          totalVisitors: data.totalVisitors || 0,
          visitorTrend: data.visitorTrend || [],
        });
      }
    } catch (error) {
      console.error("Failed to fetch dashboard stats", error);
      toast.error("Failed to load dashboard data");
    }
  };

  useEffect(() => {
    getDashboardStats();
  }, [filter]);

  // ------------------------------------------------------------
  // BAR CHART CONFIGURATION
  // ------------------------------------------------------------

  // Generate labels based on selected filter (month/day)
  const barChartLabels = dashboardData.visitorTrend.map((item) => {
    // If "month" filter is active → show month names
    if (filter.value === "month") {
      return item.month;
    }

    // Otherwise → show day number only (1–31)
    return new Date(item.date).getDate();
  });

  // Generate dataset values (visitor count)
  const barChartValues = dashboardData.visitorTrend.map(
    (item) => item.visitors
  );

  // -------------------------
  // BAR CHART DATA
  // -------------------------
  const barChartData = {
    labels: barChartLabels,
    datasets: [
      {
        label: filter.value === "month" ? "Monthly Visitors" : "Daily Visitors",

        // Visitor numbers
        data: barChartValues,

        // Attractive gradient-like colors
        backgroundColor: [
          "rgba(54, 162, 235, 0.7)",
          "rgba(75, 192, 192, 0.7)",
          "rgba(153, 102, 255, 0.7)",
          "rgba(255, 159, 64, 0.7)",
        ],

        borderColor: "rgba(75, 75, 75, 0.8)",
        borderWidth: 1.5,
        borderRadius: 5, // Smooth rounded bars for a modern look
      },
    ],
  };

  // -------------------------
  // BAR CHART OPTIONS
  // -------------------------
  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false, // Allow custom height in container

    plugins: {
      legend: {
        display: true, // Show a nice legend
        labels: {
          font: { size: 12, weight: "bold" },
          color: "#333",
        },
      },

      title: {
        display: true,
        text:
          filter.value === "month"
            ? `Monthly Visitors - ${new Date().getFullYear()}`
            : `Daily Visitors - ${new Date().toLocaleString("default", {
                month: "long",
              })} ${new Date().getFullYear()}`,

        font: { size: 16, weight: "bold" },
        color: "#222",
        padding: { top: 10, bottom: 15 },
      },

      tooltip: {
        enabled: true,
        backgroundColor: "rgba(0,0,0,0.8)",
        titleFont: { size: 14 },
        bodyFont: { size: 12 },
        padding: 10,
        callbacks: {
          label: (ctx) => `Visitors: ${ctx.raw}`, // Custom tooltip label
        },
      },
    },

    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          font: { size: 11 },
          color: "#444",
        },
        grid: {
          color: "rgba(200, 200, 200, 0.3)",
        },
      },

      x: {
        ticks: {
          font: { size: 11 },
          color: "#444",
        },
        grid: {
          display: false, // Cleaner look
        },
      },
    },
  };

  // Pie Chart Configuration
  const pieChartData = {
    labels: dashboardData.departments.map((dept) => dept.department_name),
    datasets: [
      {
        label: "Visitors by Department",
        data: dashboardData?.departments.map((dept) => dept.visitor_count),
        ...generateColorPalette(dashboardData.departments.length),
      },
    ],
  };

  const pieChartOptions = {
    maintainAspectRatio: false, // Key change for size control
    responsive: true,
    height: 250, // Specify a fixed height
    plugins: {
      legend: {
        display: false, // Hide legend to save space
      },
      title: {
        display: true,
        text: "Visitors by Department",
        font: {
          size: 14, // Reduced font size
        },
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            const label = context.label || "";
            const value = context.parsed || 0;
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(2);
            return `${label}: ${value} (${percentage}%)`;
          },
        },
      },
    },
    cutout: "50%", // Increased cut-out for a more compact look
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 overflow-x-hidden max-w-full">
      <h1 className="text-3xl font-bold text-center mb-4">
        Visitor Management Dashboard
      </h1>
      <div className="flex items-center justify-end my-4">
        <SelectField
          options={Filter}
          value={filter.value}
          onChange={(e) => {
            const selected = Filter.find(
              (item) => item.value === e.target.value
            );
            setFilter(selected);
          }}
          className="max-w-24 block"
        />
      </div>

      {/* Dashboard Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <DashboardCard
          icon={FaUsers}
          title="Total Visitors"
          value={dashboardData.totalVisitors}
          color="bg-blue-500"
        />
        <DashboardCard
          icon={FaDoorOpen}
          title="Active Visitors"
          value={dashboardData.activeVisitors}
          color="bg-green-500"
        />
        <DashboardCard
          icon={FaCalendarAlt}
          title="Today's Visits"
          value={dashboardData.todayVisits}
          color="bg-purple-500"
        />
        <DashboardCard
          icon={FaChartBar}
          title="Departments"
          value={dashboardData.departments.length}
          color="bg-red-500"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Visitor Trend Bar Chart */}
        <div className="bg-white shadow-md rounded-lg p-4">
          <div className="h-[250px]">
            {dashboardData.visitorTrend.length > 0 ? (
              <Bar data={barChartData} options={barChartOptions} />
            ) : (
              <p className="text-center text-gray-500">
                No trend data available
              </p>
            )}
          </div>

          {/* -------------------------- Scrollable Trend Data Table -------------------------- */}
          {dashboardData.visitorTrend.length > 0 && (
            <div className="mt-4 max-h-48 overflow-y-auto border border-gray-200 rounded">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="p-2 border-b border-gray-200 text-center">
                      {filter.value === "month" ? "Month" : "Date"}
                    </th>
                    <th className="p-2 border-b border-gray-200 text-center">
                      Visitors
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dashboardData.visitorTrend.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="p-2 border-b border-gray-200 text-center">
                        {filter.value === "month"
                          ? item.month
                          : new Date(item.date).toLocaleDateString()}
                      </td>
                      <td className="p-2 border-b border-gray-200 text-center">
                        {item.visitors}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Department Distribution Pie Chart */}
        <div className="bg-white shadow-md rounded-lg p-4">
          <div className="h-[250px]">
            {" "}
            {/* Fixed height container */}
            {dashboardData.departments.length > 0 ? (
              <Pie data={pieChartData} options={pieChartOptions} />
            ) : (
              <p className="text-center text-gray-500">
                No department data available
              </p>
            )}
          </div>

          {/* Department Legend */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            {dashboardData.departments.map((dept, index) => (
              <div key={dept.id} className="flex items-center text-xs">
                <span
                  className="inline-block w-3 h-3 mr-2 rounded-full"
                  style={{
                    backgroundColor: generateColorPalette(
                      dashboardData.departments.length
                    ).backgroundColor[index],
                  }}
                />
                <span>
                  {dept.department_name}: {dept.visitor_count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Visitors */}
      <div className="mt-8 bg-white shadow-md rounded-lg p-6">
        <h3 className="text-xl font-semibold mb-4">Recent Visitors</h3>
        {dashboardData.recentVisitors.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="p-3">Visitor Name</th>
                <th className="p-3">Department to Visit</th>
                <th className="p-3">Employee to Visit</th>
                <th className="p-3">Check-In Time</th>
                <th className="p-3">Check-Out Time</th>
              </tr>
            </thead>
            <tbody>
              {dashboardData.recentVisitors.map((visitor) => (
                <tr key={visitor.id} className="border-b">
                  <td className="p-3">{visitor.visitor_name}</td>
                  <td className="p-3">{visitor.department_name}</td>
                  <td className="p-3">{visitor.employee_name}</td>
                  <td className="p-3">
                    {visitor.check_in_time &&
                      visitor.check_in_time.replace("T", " ").replace("Z", "")}
                  </td>
                  <td className="p-3">
                    {visitor.check_out_time === null ? (
                      <span className="text-green-600 font-bold">
                        Currently In
                      </span>
                    ) : (
                      visitor.check_out_time.replace("T", " ").replace("Z", "")
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-center text-gray-500">No recent visitors</p>
        )}
      </div>
    </div>
  );
};

export default Dashboard;