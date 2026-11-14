import { useState } from "react";
import { Download, LoaderCircle } from "lucide-react";
import { exportToXls } from "../../utils/exportToXls.js";
import toast from "react-hot-toast";

const ExportButton = ({
  data,
  fetchData,
  filename = "export",
  className = "",
  label = "Download",
}) => {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    if (loading) return;

    setLoading(true);

    try {
      let exportData = data;

      if (typeof fetchData === "function") {
        exportData = await fetchData();
      }

      if (!Array.isArray(exportData) || exportData.length === 0) {
        toast.error("No data available for export.");
        return;
      }

      const currentDate = new Date().toISOString().split("T")[0];

      const finalFilename = filename.endsWith(".xlsx")
        ? filename
        : `${filename}_${currentDate}.xlsx`;

      exportToXls(exportData, finalFilename);

      toast.success("File downloaded successfully!");
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Failed to export file. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className={`
      flex items-center gap-1
      text-[10px]
      text-emerald-700 hover:text-emerald-900
      font-semibold
      border border-emerald-200
      rounded-md
      px-1.5 py-0.5
      hover:bg-emerald-50
      transition
      cursor-pointer
      disabled:opacity-50 disabled:cursor-not-allowed
      ${className}
    `}
    >
      {loading ? (
        <>
          <LoaderCircle className="w-2.5 h-2.5 animate-spin" />
          Preparing...
        </>
      ) : (
        <>
          <Download className="w-2.5 h-2.5" />
          {label}
        </>
      )}
    </button>
  );
};

export default ExportButton;
