import { useEffect, useRef, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { AlertTriangle, Boxes, History, Loader2, Save, ScanBarcode, ShieldAlert, Trash2, X } from "lucide-react";
import { baseURL } from "../../assets/assets";
import SelectField from "../../components/ui/SelectField";
import InputField from "../../components/ui/InputField";
import HistoryTable from "../../components/ui/HistoryTable";

// FG Scrap (from Garuda): scan a unit, see its components, give the category and remark, scrap it. A unit whose FG
// label is printed can be scrapped by a Super Admin only (the server checks it too).

const Spinner = ({ cls = "w-4 h-4" }) => <Loader2 className={`animate-spin ${cls}`} />;

const SectionLabel = ({ icon: Icon, children }) => (
  <div className="flex items-center gap-1.5 mb-3">
    <Icon className="w-3 h-3 text-slate-400" />
    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">{children}</p>
  </div>
);

const EMPTY = { serial: "", unit: null, category: "", remark: "" };

const FGScrap = () => {
  const [tab, setTab] = useState("scrap");
  const [state, setState] = useState(EMPTY);
  const [categories, setCategories] = useState([]);
  const [busy, setBusy] = useState(false);
  const scanRef = useRef(null);
  const patch = (p) => setState((s) => ({ ...s, ...p }));

  useEffect(() => {
    axios
      .get(`${baseURL}quality/fg-scrap/categories`)
      .then((res) => setCategories(res.data.data))
      .catch((err) => toast.error(err?.response?.data?.message || "Could not load the scrap categories"));
  }, []);

  // the scanner's box is ready again whenever no unit is scanned
  useEffect(() => {
    if (tab === "scrap" && !busy && !state.unit) scanRef.current?.focus();
  }, [tab, busy, state.unit]);

  const scan = async () => {
    const serial = state.serial.trim();
    if (!serial) return;
    setBusy(true);
    try {
      const res = await axios.get(`${baseURL}quality/fg-scrap/units/${encodeURIComponent(serial)}`);
      patch({ serial: res.data.data.serial, unit: res.data.data });
    } catch (err) {
      toast.error(err?.response?.data?.message || "Could not find this unit");
      patch({ serial: "" });
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!state.category) return toast.error("Choose a scrap category");
    if (!state.remark.trim()) return toast.error("Please Enter Remark");
    setBusy(true);
    try {
      const res = await axios.post(`${baseURL}quality/fg-scrap`, { unit: state.unit.serial, category: state.category, remark: state.remark.trim() });
      toast.success(`${res.data.message}: ${res.data.data.serial}`);
      setState(EMPTY);
    } catch (err) {
      // nothing was scrapped: the page stays as it is, to correct and save again
      toast.error(err?.response?.data?.message || "Scrap failed");
    } finally {
      setBusy(false);
    }
  };

  const components = state.unit?.components ?? [];

  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      {/* ── PAGE HEADER ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shadow-sm shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-tight">FG Scrap</h1>
          <p className="text-[11px] text-slate-400">Quality · Take a unit out of production</p>
        </div>
        <div className="inline-flex p-1 rounded-xl bg-slate-50 border border-slate-200">
          {[
            ["scrap", "Scrap a unit", Trash2],
            ["history", "Scrap history", History],
          ].map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                tab === key ? "bg-white text-blue-700 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-3">
        {tab === "history" ? (
          <HistoryTable url="quality/fg-scrap/history" filename="FG_Scrap_History.xlsx" emptyText="Nothing has been scrapped yet." />
        ) : (
          <>
            {/* Unit */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <SectionLabel icon={ScanBarcode}>Unit</SectionLabel>
              <div className="flex gap-2 max-w-xl">
                <div className="relative flex-1">
                  <ScanBarcode className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    ref={scanRef}
                    value={state.serial}
                    readOnly={!!state.unit}
                    onChange={(e) => patch({ serial: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && !state.unit && scan()}
                    placeholder="Scan the unit"
                    className={`w-full pl-9 pr-3 py-2.5 border rounded-lg text-sm font-mono text-slate-800 outline-none focus:ring-2 focus:ring-blue-100 ${
                      state.unit ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white focus:border-blue-400"
                    }`}
                  />
                </div>
                {state.unit ? (
                  <button onClick={() => setState(EMPTY)} disabled={busy} className="flex items-center gap-1.5 px-4 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 cursor-pointer">
                    <X className="w-3.5 h-3.5" /> Change
                  </button>
                ) : (
                  <button onClick={scan} disabled={busy || !state.serial.trim()} className="flex items-center gap-1.5 px-5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 cursor-pointer">
                    {busy ? <Spinner /> : <ScanBarcode className="w-3.5 h-3.5" />} Go
                  </button>
                )}
              </div>
              {state.unit?.fgLabelPrinted && (
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <ShieldAlert className="w-4 h-4 shrink-0" /> The FG label of this unit is printed: only a Super Admin can scrap it.
                </div>
              )}
            </div>

            {/* Components */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <SectionLabel icon={Boxes}>Components scanned into this unit</SectionLabel>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      {["Category", "Material", "Process", "Serial"].map((h) => (
                        <th key={h} className="px-3 py-2 text-left font-semibold text-slate-500 uppercase tracking-wide text-[10px]">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {components.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-3 py-6 text-center text-slate-400">
                          Scan a unit to see its components.
                        </td>
                      </tr>
                    )}
                    {components.map((r, i) => (
                      <tr key={`${r.serial}-${i}`}>
                        <td className="px-3 py-2 text-slate-700">{r.category}</td>
                        <td className="px-3 py-2 text-slate-700">{r.material}</td>
                        <td className="px-3 py-2 text-slate-700">{r.process}</td>
                        <td className="px-3 py-2 font-mono text-slate-700">{r.serial}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Scrap details */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <SectionLabel icon={AlertTriangle}>Scrap details</SectionLabel>
              <div className="grid gap-4 sm:grid-cols-2 max-w-3xl">
                <SelectField label="Scrap Category" options={categories} value={state.category} onChange={(e) => patch({ category: e.target.value ?? "" })} />
                <InputField label="Remark" value={state.remark} onChange={(e) => patch({ remark: e.target.value.slice(0, 150) })} disabled={!state.unit} placeholder="Why this unit is scrapped" />
              </div>
              <button
                onClick={save}
                disabled={busy || !state.unit}
                className="mt-4 flex items-center gap-2 px-6 py-2.5 rounded-lg bg-red-600 text-white text-xs font-semibold shadow-sm hover:bg-red-700 disabled:opacity-50 cursor-pointer"
              >
                {busy && state.unit ? <Spinner /> : <Save className="w-4 h-4" />} Scrap unit
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FGScrap;
