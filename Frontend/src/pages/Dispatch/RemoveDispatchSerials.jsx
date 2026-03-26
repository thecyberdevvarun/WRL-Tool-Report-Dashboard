import { useState } from "react";
import { useSelector } from "react-redux";
import axios from "axios";
import toast from "react-hot-toast";
import { baseURL } from "../../assets/assets.js";
import { MdDeleteForever } from "react-icons/md";
import { FiSearch, FiRotateCcw, FiTrash2 } from "react-icons/fi";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { HiOutlineExclamationCircle } from "react-icons/hi";
import { MdOutlineTableChart } from "react-icons/md";
import PopupModal from "../../components/ui/PopupModal.jsx";
import Title from "../../components/ui/Title.jsx";

// ── Placeholder ───────────────────────────────────────────────────────────────
function QueryPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
      <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mb-4">
        <MdOutlineTableChart size={36} className="text-red-300" />
      </div>
      <p className="text-lg font-bold text-gray-500">
        Fetch Serials to Preview
      </p>
      <p className="text-sm mt-1.5 text-gray-400 text-center">
        Paste serial numbers or enter a Session ID above, then click{" "}
        <span className="font-semibold text-indigo-500">Fetch Serials</span> to
        preview before deleting.
      </p>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
const RemoveDispatchSerials = () => {
  const user = useSelector((state) => state.auth.user);
  const deletedBy = user?.username || user?.name || user?.email || "Unknown";

  const [inputMode, setInputMode] = useState("serial");
  const [pasteData, setPasteData] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [stage, setStage] = useState("idle"); // idle | preview | result
  const [fetchLoading, setFetchLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [preview, setPreview] = useState([]);
  const [result, setResult] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const parseSerials = (t) =>
    t
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  const parsedSerials = parseSerials(pasteData);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const handleFetch = async () => {
    if (inputMode === "session" && !sessionId.trim()) {
      toast.error("Enter a Session ID.");
      return;
    }
    if (inputMode === "serial" && parsedSerials.length === 0) {
      toast.error("Paste at least one serial.");
      return;
    }

    setFetchLoading(true);
    setPreview([]);
    setResult(null);
    setStage("idle");
    try {
      const body =
        inputMode === "session"
          ? { sessionId: sessionId.trim() }
          : { serialNumbers: parsedSerials };
      const res = await axios.post(
        `${baseURL}dispatch/fetch-error-serials`,
        body,
      );
      setPreview(res.data.preview || []);
      setStage("preview");
      toast.success(`${res.data.total} serial(s) found.`);
    } catch (e) {
      toast.error(e.response?.data?.message || e.message || "Fetch failed.");
    } finally {
      setFetchLoading(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const confirmDelete = async () => {
    setShowDeleteModal(false);
    setDeleteLoading(true);
    try {
      const body =
        inputMode === "session"
          ? { deletedBy, sessionId: sessionId.trim() }
          : { deletedBy, serialNumbers: parsedSerials };
      const res = await axios.post(
        `${baseURL}dispatch/remove-error-serials`,
        body,
      );
      setResult(res.data);
      setStage("result");
      toast.success(res.data.message || "Done!");
    } catch (e) {
      toast.error(e.response?.data?.message || e.message || "Delete failed.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleReset = () => {
    setPasteData("");
    setSessionId("");
    setPreview([]);
    setResult(null);
    setStage("idle");
  };

  const isLoading = fetchLoading || deleteLoading;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 bg-gray-100 min-h-screen rounded-lg">
      <Title title="Remove Dispatch Error Serials" align="center" />

      {/* ── Input Card ── */}
      <div className="w-full rounded-2xl bg-white px-6 py-5 shadow-sm border border-gray-100 mt-5">
        {/* Mode toggle + input */}
        <div className="flex flex-wrap items-end gap-4">
          {/* Left: toggle + input */}
          <div className="flex-1 min-w-[240px] max-w-lg">
            {/* Mode radio */}
            <div className="flex gap-4 mb-2">
              {[
                { val: "serial", label: "Serial Numbers" },
                { val: "session", label: "Session ID" },
              ].map(({ val, label }) => (
                <label
                  key={val}
                  className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer"
                >
                  <input
                    type="radio"
                    name="inputMode"
                    checked={inputMode === val}
                    onChange={() => {
                      setInputMode(val);
                      handleReset();
                    }}
                  />
                  {label}
                </label>
              ))}
            </div>

            {inputMode === "serial" ? (
              <>
                <textarea
                  rows={5}
                  placeholder={
                    "Paste FG Serial Numbers (one per line or comma-separated)\n\nExample: 42558260201263, 42558260201264, 42558260201265"
                  }
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-mono
                             placeholder:text-gray-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100
                             focus:bg-white outline-none transition-all duration-200 resize-none"
                  value={pasteData}
                  onChange={(e) => {
                    setPasteData(e.target.value);
                    setStage("idle");
                    setPreview([]);
                  }}
                  disabled={isLoading}
                />
                {parsedSerials.length > 0 && (
                  <p className="text-xs text-indigo-500 font-medium mt-1">
                    {parsedSerials.length} serial
                    {parsedSerials.length > 1 ? "s" : ""} detected
                  </p>
                )}
              </>
            ) : (
              <div className="relative group">
                <input
                  type="text"
                  placeholder="e.g. WTDP20260319013847"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-mono
                             placeholder:text-gray-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100
                             focus:bg-white outline-none transition-all duration-200"
                  value={sessionId}
                  onChange={(e) => {
                    setSessionId(e.target.value);
                    setStage("idle");
                    setPreview([]);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleFetch()}
                  disabled={isLoading}
                />
                <FiSearch
                  size={15}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors"
                />
              </div>
            )}
          </div>

          {/* Right: buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Fetch button */}
            <button
              onClick={handleFetch}
              disabled={isLoading}
              className={`flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200
                ${
                  isLoading
                    ? "bg-gray-400 cursor-not-allowed shadow-none"
                    : "bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 hover:shadow-md hover:shadow-indigo-200 active:scale-[0.97] cursor-pointer"
                }`}
            >
              {fetchLoading ? (
                <>
                  <AiOutlineLoading3Quarters
                    size={14}
                    className="animate-spin"
                  />{" "}
                  Fetching…
                </>
              ) : (
                <>
                  <FiSearch size={14} /> Fetch Serials
                </>
              )}
            </button>

            {/* Delete button — only after preview */}
            {stage === "preview" && preview.length > 0 && (
              <button
                onClick={() => setShowDeleteModal(true)}
                disabled={isLoading}
                className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white
                           bg-gradient-to-r from-red-500 to-red-600
                           hover:from-red-600 hover:to-red-700 hover:shadow-md hover:shadow-red-200
                           active:scale-[0.97] transition-all duration-200 cursor-pointer shadow-sm"
              >
                {deleteLoading ? (
                  <>
                    <AiOutlineLoading3Quarters
                      size={14}
                      className="animate-spin"
                    />{" "}
                    Deleting…
                  </>
                ) : (
                  <>
                    <FiTrash2 size={14} /> Delete {preview.length} Serial
                    {preview.length > 1 ? "s" : ""}
                  </>
                )}
              </button>
            )}

            {/* Reset button */}
            {(stage !== "idle" || pasteData || sessionId) && (
              <button
                onClick={handleReset}
                disabled={isLoading}
                className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white
                           px-4 py-2.5 text-sm font-medium text-gray-600
                           hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800
                           transition-all duration-200 active:scale-[0.97] cursor-pointer"
              >
                <FiRotateCcw size={13} /> Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Table Card ── */}
      <div className="w-full rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden mt-5">
        {/* Summary bar — only after result */}
        {stage === "result" && result && (
          <div className="flex flex-wrap gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50/60">
            {[
              {
                label: "Total",
                value: result.summary?.total ?? 0,
                cls: "bg-blue-50   text-blue-700   border-blue-200",
              },
              {
                label: "Deleted",
                value: result.summary?.deleted ?? 0,
                cls: "bg-green-50  text-green-700  border-green-200",
              },
              {
                label: "Not Found",
                value: result.summary?.notFound ?? 0,
                cls: "bg-yellow-50 text-yellow-700 border-yellow-200",
              },
              {
                label: "Errors",
                value: result.summary?.withErrors ?? 0,
                cls: "bg-red-50    text-red-700    border-red-200",
              },
            ].map(({ label, value, cls }) => (
              <div
                key={label}
                className={`rounded-xl border px-5 py-2.5 text-center min-w-[90px] ${cls}`}
              >
                <div className="text-2xl font-bold leading-none">{value}</div>
                <div className="text-xs mt-1 opacity-70">{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="p-5">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <AiOutlineLoading3Quarters
                size={28}
                className="animate-spin text-indigo-400 mb-3"
              />
              <p className="text-sm text-gray-400 animate-pulse">
                {fetchLoading
                  ? "Querying database…"
                  : "Executing delete operation…"}
              </p>
            </div>
          ) : stage === "preview" && preview.length > 0 ? (
            <div className="overflow-auto max-h-[480px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 z-10">
                  <tr>
                    {["SR.NO.", "FG Serial No", "Found In"].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr
                      key={i}
                      className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors"
                    >
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {i + 1}
                      </td>
                      <td className="px-4 py-3 font-mono text-sm text-indigo-700 whitespace-nowrap">
                        {row.serial}
                      </td>
                      <td className="px-4 py-3">
                        {row.foundIn?.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {row.foundIn.map((t) => (
                              <span
                                key={t}
                                className="inline-flex items-center bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs px-2 py-0.5 rounded-lg font-medium"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-yellow-600 bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded-lg">
                            Not in DB
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : stage === "result" && result ? (
            <div className="overflow-auto max-h-[480px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 z-10">
                  <tr>
                    {[
                      "Sr.No.",
                      "FG Serial No",
                      "Deleted From",
                      "Not Found In",
                      "Status",
                      "Error",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.details?.map((row, i) => {
                    const hasErr = row.errors?.length > 0;
                    const wasDel = row.deletedFrom?.length > 0;
                    return (
                      <tr
                        key={i}
                        className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors"
                      >
                        <td className="px-4 py-3 text-gray-400 text-xs">
                          {i + 1}
                        </td>
                        <td className="px-4 py-3 font-mono text-sm text-indigo-700 whitespace-nowrap">
                          {row.serial}
                        </td>
                        <td className="px-4 py-3">
                          {wasDel ? (
                            <div className="flex flex-wrap gap-1">
                              {row.deletedFrom.map((t) => (
                                <span
                                  key={t}
                                  className="inline-flex items-center bg-green-50 text-green-700 border border-green-200 text-xs px-2 py-0.5 rounded-lg font-medium"
                                >
                                  {t}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {row.notFoundIn?.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {row.notFoundIn.map((t) => (
                                <span
                                  key={t}
                                  className="inline-flex items-center bg-yellow-50 text-yellow-700 border border-yellow-200 text-xs px-2 py-0.5 rounded-lg font-medium"
                                >
                                  {t}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {hasErr ? (
                            <span className="text-xs bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-lg font-medium">
                              Error
                            </span>
                          ) : wasDel ? (
                            <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-lg font-medium">
                              ✓ Deleted
                            </span>
                          ) : (
                            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-lg">
                              Not Found
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-red-500 font-mono">
                          {hasErr
                            ? row.errors
                                .map((e) => `${e.table}: ${e.error}`)
                                .join(" | ")
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <QueryPlaceholder />
          )}
        </div>
      </div>

      {/* ── Confirmation Modal ── */}
      {showDeleteModal && (
        <PopupModal
          title="Delete Confirmation"
          description={`Are you sure you want to permanently delete ${preview.length} serial(s) from DispatchMaster and tempDispatch? This cannot be undone.`}
          confirmText="Yes, Delete"
          cancelText="Cancel"
          modalId="delete-modal"
          onConfirm={confirmDelete}
          onCancel={() => setShowDeleteModal(false)}
          icon={<MdDeleteForever className="text-red-500 w-12 h-12 mx-auto" />}
        />
      )}
    </div>
  );
};

export default RemoveDispatchSerials;
