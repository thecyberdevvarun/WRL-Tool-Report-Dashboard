import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { Inbox, Loader2, Search, X } from "lucide-react";
import { baseURL } from "../../assets/assets";
import ExportButton from "./ExportButton";
import Pagination from "./Pagination";

/* ──────────────────────────────────────────
   A history from the server, newest first: an optional time range, the
   page as a table, export, pages. The server answers
   { columns: [names], rows: [[cell text]], count, page, pageSize }.
────────────────────────────────────────── */
const HistoryTable = ({ url, filename, emptyText = "Nothing yet." }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [range, setRange] = useState({ start: "", end: "" }); // typed
  const [applied, setApplied] = useState({ start: "", end: "" }); // in use

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit };
      if (applied.start) params.start = applied.start;
      if (applied.end) params.end = applied.end;
      const res = await axios.get(`${baseURL}${url}`, { params });
      setData(res.data.data);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Could not load the history");
    } finally {
      setLoading(false);
    }
  }, [url, page, limit, applied]);

  useEffect(() => {
    load();
  }, [load]);

  const columns = data?.columns ?? [];
  const rows = data?.rows ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.count / data.pageSize)) : 1;
  const asObjects = () => rows.map((r) => Object.fromEntries(columns.map((c, i) => [c, r[i]])));
  const filtered = applied.start || applied.end;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-0">
      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3 px-4 py-3 border-b border-slate-100">
        {["start", "end"].map((k) => (
          <div key={k}>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
              {k === "start" ? "From" : "To"}
            </label>
            <input
              type="datetime-local"
              value={range[k]}
              onChange={(e) => setRange((r) => ({ ...r, [k]: e.target.value }))}
              className="px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-700 bg-white outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        ))}
        <button
          onClick={() => {
            setPage(1);
            setApplied(range);
          }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 cursor-pointer"
        >
          <Search className="w-3.5 h-3.5" /> Apply
        </button>
        {filtered && (
          <button
            onClick={() => {
              setPage(1);
              setRange({ start: "", end: "" });
              setApplied({ start: "", end: "" });
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" /> Clear
          </button>
        )}
        <div className="ml-auto">{rows.length > 0 && <ExportButton fetchData={async () => asObjects()} filename={filename} />}</div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-400 text-xs">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400">
            <Inbox className="w-8 h-8" />
            <p className="text-xs">{filtered ? "Nothing in this time range." : emptyText}</p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-50 z-10">
              <tr>
                {columns.map((c) => (
                  <th key={c} className="px-3 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wide text-[10px] border-b border-slate-200 whitespace-nowrap">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-blue-50/40">
                  {r.map((v, j) => (
                    <td key={j} className="px-3 py-2 text-slate-700 whitespace-nowrap">
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {data && data.count > 0 && (
        <div className="border-t border-slate-100 px-3 py-2">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalRecords={data.count}
            limit={limit}
            onPageChange={setPage}
            onLimitChange={(l) => {
              setPage(1);
              setLimit(l);
            }}
            isLoading={loading}
            compact
          />
        </div>
      )}
    </div>
  );
};

export default HistoryTable;
