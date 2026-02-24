// components/FpaDefectDetailModal.jsx
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLazyGetFpaDefectDetailsQuery } from "../redux/api/fpaReportApi";
import { closeDefectModal } from "../redux/fpaReportSlice";
import Loader from "./ui/Loader";
import { IoCloseOutline } from "react-icons/io5";
import { HiOutlineSearch } from "react-icons/hi";
import { FiImage, FiDownload } from "react-icons/fi";
import { baseURL } from "../assets/assets.js";
import toast from "react-hot-toast";

const SERVER_URL = new URL(baseURL).origin;

const FpaDefectDetailModal = () => {
  const dispatch = useDispatch();
  const { selectedFGSRNo } = useSelector((state) => state.fpaReport);

  const [triggerFetch, { data: defectData, isLoading, isFetching }] =
    useLazyGetFpaDefectDetailsQuery();

  const [failedImages, setFailedImages] = useState({});
  const [downloadingIndex, setDownloadingIndex] = useState(null);

  useEffect(() => {
    if (selectedFGSRNo) {
      triggerFetch({ fgsrNo: selectedFGSRNo });
      setFailedImages({});
    }
  }, [selectedFGSRNo, triggerFetch]);

  const handleClose = () => dispatch(closeDefectModal());

  // Build correct image URL
  const getImageUrl = (imageName) => {
    if (!imageName) return null;
    return `${SERVER_URL}/uploads/FpaDefectImages/${imageName}`;
  };

  /**
   * Download image using fetch + blob approach
   * Works for same-origin and cross-origin images
   * Forces browser to download instead of opening in new tab
   */
  const handleDownloadImage = async (imageName, index) => {
    if (!imageName) return;

    const imageUrl = getImageUrl(imageName);
    setDownloadingIndex(index);

    try {
      const response = await fetch(imageUrl);

      if (!response.ok) {
        throw new Error("Failed to download image");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = imageName; // File name for download
      document.body.appendChild(link);
      link.click();

      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success("Image downloaded successfully");
    } catch (error) {
      console.error("Download failed:", error);
      toast.error("Failed to download image");
    } finally {
      setDownloadingIndex(null);
    }
  };

  const defects = defectData?.data || [];
  const loading = isLoading || isFetching;

  const categoryStyle = {
    critical: "bg-red-50 text-red-700 border-red-200",
    major: "bg-orange-50 text-orange-700 border-orange-200",
    minor: "bg-yellow-50 text-yellow-700 border-yellow-200",
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Defect Details</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              FGSRNo: <span className="font-mono">{selectedFGSRNo}</span>
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md p-1 transition-colors cursor-pointer"
          >
            <IoCloseOutline size={22} />
          </button>
        </div>

        {/* Summary */}
        {!loading && defects.length > 0 && (
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex flex-wrap gap-6 text-sm">
            <div>
              <span className="text-gray-500">Total: </span>
              <span className="font-semibold">{defects.length}</span>
            </div>
            <div>
              <span className="text-gray-500">Critical: </span>
              <span className="font-semibold text-red-600">
                {
                  defects.filter(
                    (d) => d.Category?.toLowerCase() === "critical",
                  ).length
                }
              </span>
            </div>
            <div>
              <span className="text-gray-500">Major: </span>
              <span className="font-semibold text-orange-600">
                {
                  defects.filter((d) => d.Category?.toLowerCase() === "major")
                    .length
                }
              </span>
            </div>
            <div>
              <span className="text-gray-500">Minor: </span>
              <span className="font-semibold text-yellow-600">
                {
                  defects.filter((d) => d.Category?.toLowerCase() === "minor")
                    .length
                }
              </span>
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-auto p-6">
          {loading && <Loader />}

          {!loading && defects.length === 0 && (
            <div className="text-center py-12">
              <HiOutlineSearch className="text-gray-300 text-5xl mx-auto mb-3" />
              <p className="text-gray-500">No defect details found.</p>
            </div>
          )}

          {!loading && defects.length > 0 && (
            <div className="space-y-4">
              {defects.map((defect, index) => {
                const catKey = defect.Category?.toLowerCase() || "minor";
                const style = categoryStyle[catKey] || categoryStyle.minor;
                const isDownloading = downloadingIndex === index;

                return (
                  <div key={index} className={`border rounded-lg p-4 ${style}`}>
                    <div className="flex items-start justify-between gap-4">
                      {/* Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-mono text-gray-500">
                            #{index + 1}
                          </span>
                          <span className="text-xs font-bold uppercase tracking-wide">
                            {defect.Category}
                          </span>
                        </div>

                        <div className="mb-2">
                          <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">
                            Defect
                          </p>
                          <p className="text-sm font-medium text-gray-800">
                            {defect.AddDefect || "—"}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">
                            Remark
                          </p>
                          <p className="text-sm text-gray-600">
                            {defect.Remark || "—"}
                          </p>
                        </div>
                      </div>

                      {/* Download Button */}
                      <div className="flex-shrink-0">
                        {defect.DefectImage && (
                          <button
                            onClick={() =>
                              handleDownloadImage(defect.DefectImage, index)
                            }
                            disabled={isDownloading}
                            className={`w-20 h-20 rounded border flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
                              isDownloading
                                ? "bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed"
                                : "bg-white border-gray-300 text-blue-600 hover:bg-blue-50 hover:border-blue-400"
                            }`}
                            title={`Download ${defect.DefectImage}`}
                          >
                            <FiDownload
                              size={20}
                              className={isDownloading ? "animate-bounce" : ""}
                            />
                            <span className="text-[10px] font-medium">
                              {isDownloading ? "Saving..." : "Download"}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FpaDefectDetailModal;
