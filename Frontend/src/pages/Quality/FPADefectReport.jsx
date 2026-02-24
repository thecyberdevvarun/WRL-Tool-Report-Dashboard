import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import Title from "../../components/ui/Title";
import Button from "../../components/ui/Button";
import SelectField from "../../components/ui/SelectField";
import DateTimePicker from "../../components/ui/DateTimePicker";
import ExportButton from "../../components/ui/ExportButton";
import FpaBarGraph from "../../components/graphs/FpaReportsBarGraph";
import Loader from "../../components/ui/Loader";
import { baseURL } from "../../assets/assets";

// Chart Register
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  BarController,
  LineController,
  Tooltip,
  Legend,
  Title as ChartTitle,
} from "chart.js";
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  BarController,
  LineController,
  Tooltip,
  Legend,
  ChartTitle
);

const FpaDefectReport = () => {
  const [reportType, setReportType] = useState("Daily");
  const [startDate, setStart] = useState("");
  const [endDate, setEnd] = useState("");
  const [model, setModel] = useState("");
  const [defect, setDefect] = useState("");
  const [top, setTop] = useState(5);
  const [variants, setVariants] = useState([]);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    axios
      .get(`${baseURL}shared/model-variants`)
      .then((res) =>
        setVariants(
          res.data.map((x) => ({
            label: x.MaterialName,
            value: x.MaterialName,
          }))
        )
      );
  }, []);

  const fetchReport = async () => {
    if (!startDate || !endDate) return toast.error("Select Start & End Date");

    setLoading(true);
    try {
      const res = await axios.get(`${baseURL}quality/fpa-defect-report`, {
        params: {
          ReportType: reportType,
          StartDate: startDate,
          EndDate: endDate,
          Model: model,
          DefectName: defect,
          TopCount: top,
        },
      });
      setData(res.data.results || []);
    } catch {
      toast.error("Failed");
    }
    setLoading(false);
  };

  const chart = useMemo(() => {
    if (!data.length) return null;
    return {
      labels: data.map((x) => x.AddDefect || x.MonthName || x.Year),
      datasets: [
        {
          label: `Top ${top} Defects`,
          data: data.map((x) => x.TotalCount),
          backgroundColor: "rgba(99,102,241,.7)",
        },
      ],
    };
  }, [data, top]);

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <Title title="📊 FPA Defect Report" align="center" />

      <div className="grid md:grid-cols-2 gap-4 mt-6">
        <div className="bg-purple-50 border p-4 rounded-xl shadow space-y-3">
          <SelectField
            label="Report Type"
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
            options={[
              { label: "Daily", value: "Daily" },
              { label: "Monthly", value: "Monthly" },
              { label: "Yearly", value: "Yearly" },
            ]}
          />

          <DateTimePicker
            label="Start Date"
            value={startDate}
            onChange={(e) => setStart(e.target.value)}
          />
          <DateTimePicker
            label="End Date"
            value={endDate}
            onChange={(e) => setEnd(e.target.value)}
          />

          <SelectField
            label="Model (optional)"
            value={model}
            options={variants}
            onChange={(e) => setModel(e.target.value)}
          />

          <input
            className="p-2 border rounded w-full"
            placeholder="Defect LIKE"
            value={defect}
            onChange={(e) => setDefect(e.target.value)}
          />

          {/* Top Count Dropdown */}
          <SelectField
            label="Top Defects"
            value={top}
            onChange={(e) => setTop(e.target.value)}
            options={[5, 10, 15, 20, 30].map((n) => ({
              label: `Top ${n}`,
              value: n,
            }))}
          />

          <Button onClick={fetchReport} disabled={loading}>
            {loading ? "Loading..." : "Load Report"}
          </Button>

          {data.length > 0 && (
            <ExportButton data={data} filename="FPA_Report" />
          )}
        </div>

        {/* Show chart only when Monthly/Yearly */}
        {chart && reportType !== "Daily" && (
          <div className="bg-white p-4 rounded shadow">
            <FpaBarGraph
              title="Defect Trend"
              labels={chart.labels}
              datasets={chart.datasets}
            />
          </div>
        )}
      </div>

      {/* TABLE */}
      <div className="bg-white p-5 rounded shadow mt-6">
        {loading ? (
          <Loader />
        ) : data.length > 0 ? (
          <table className="w-full border text-xs">
            <thead className="bg-gray-300 text-center font-bold">
              <tr>
                {Object.keys(data[0]).map((c) => (
                  <th key={c} className="border px-2 py-1">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((r, i) => (
                <tr key={i} className="hover:bg-gray-100 text-center">
                  {Object.entries(r).map(([key, v], j) => {
                    // detect date format & convert
                    let value = v;
                    if (
                      typeof v === "string" &&
                      v.includes("T") &&
                      v.includes("Z")
                    ) {
                      value = v.replace("T", " ").replace("Z", "").slice(0, 10);
                      // If you want only date -> value = v.slice(0,10)
                    }

                    return (
                      <td key={j} className="border px-2 py-1">
                        {value ?? "-"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-center py-4">No Data</p>
        )}
      </div>
    </div>
  );
};

export default FpaDefectReport;
