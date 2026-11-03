import { useEffect, useRef, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { History, Layers, ListChecks, Loader2, Printer, ScanBarcode, Square, Tag, Trash2, X } from "lucide-react";
import { baseURL } from "../../assets/assets";
import SelectField from "../../components/ui/SelectField";
import PopupModal from "../../components/ui/PopupModal";
import HistoryTable from "../../components/ui/HistoryTable";

// Material Barcode reprint (from Garuda): the FG label, the assembly barcode or the foaming barcode, found by its
// serial, printed again with a reason (each reprint is logged). One label, many labels at once, or the history.

const MAX = 500; // as the server checks at a time
const PART = 25; // labels a request prints (the server takes up to 50)
const KIND = { FG: "bg-emerald-50 text-emerald-700 border-emerald-200", Assembly: "bg-blue-50 text-blue-700 border-blue-200", Foaming: "bg-amber-50 text-amber-700 border-amber-200" };
const STATE = {
  ready: ["bg-slate-100 text-slate-600 border-slate-200", "Ready"],
  printing: ["bg-blue-50 text-blue-700 border-blue-200", "Printing"],
  printed: ["bg-emerald-50 text-emerald-700 border-emerald-200", "Printed"],
  failed: ["bg-red-50 text-red-700 border-red-200", "Failed"],
};
const serialsOf = (text) => [...new Set(text.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean))];
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const when = (d) => (d ? new Date(d).toLocaleString("en-IN") : "—");
const message = (err, fallback) => err?.response?.data?.message || fallback;

const Spinner = ({ cls = "w-4 h-4" }) => <Loader2 className={`animate-spin ${cls}`} />;
const Pill = ({ cls, children }) => <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cls}`}>{children}</span>;
const SectionLabel = ({ n, icon: Icon, children }) => (
  <div className="flex items-center gap-2 mb-3">
    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">{n}</span>
    <Icon className="w-3.5 h-3.5 text-slate-400" />
    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">{children}</p>
  </div>
);
const Card = ({ className = "", children }) => <div className={`bg-white rounded-xl border border-slate-200 shadow-sm p-4 ${className}`}>{children}</div>;
const ReasonField = ({ value, onChange, disabled, rows = 3 }) => (
  <div>
    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Reason for the reprint</label>
    <textarea
      rows={rows}
      maxLength={500}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder="e.g. label damaged"
      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
    />
  </div>
);

/** the business unit's printers, the only one chosen by itself */
const usePrinters = () => {
  const [printers, setPrinters] = useState([]);
  const [printer, setPrinter] = useState("");
  useEffect(() => {
    axios
      .get(`${baseURL}quality/barcode-reprint/printers`)
      .then((res) => {
        const p = res.data.data;
        setPrinters(p.options.filter((o) => o.value !== "").map((o) => ({ value: o.value, label: o.text })));
        setPrinter(p.value ?? "");
      })
      .catch((err) => toast.error(message(err, "Could not load the printers")));
  }, []);
  return { printers, printer, setPrinter };
};

const Detail = ({ label, children }) => (
  <div className="min-w-0">
    <dt className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{label}</dt>
    <dd className="mt-0.5 truncate text-xs font-semibold text-slate-800">{children || "—"}</dd>
  </div>
);

/* ── One label ── */
const OneLabel = () => {
  const [scan, setScan] = useState("");
  const [label, setLabel] = useState(null);
  const [finding, setFinding] = useState(false);
  const [remark, setRemark] = useState("");
  const [printing, setPrinting] = useState(false);
  const { printers, printer, setPrinter } = usePrinters();
  const scanRef = useRef(null);

  useEffect(() => {
    if (!label) scanRef.current?.focus();
  }, [label]);

  const find = async () => {
    if (!scan.trim()) return;
    setFinding(true);
    try {
      setLabel((await axios.get(`${baseURL}quality/barcode-reprint/${encodeURIComponent(scan.trim())}`)).data.data);
      setRemark("");
    } catch (err) {
      setLabel(null);
      toast.error(message(err, "Label not found"), { id: "reprint-find" });
    } finally {
      setFinding(false);
    }
  };
  const clear = () => (setScan(""), setLabel(null), setRemark(""));

  const print = async () => {
    if (!remark.trim()) return toast.error("Enter the reason for the reprint.");
    if (!printer) return toast.error("Select a printer.");
    setPrinting(true);
    try {
      const done = (await axios.post(`${baseURL}quality/barcode-reprint`, { barcodeNo: label.barcodeNo, printer, remark })).data.data;
      toast.success(`${done.kind} label ${done.serial} sent to the printer`);
      clear(); // ready for the next label
    } catch (err) {
      toast.error(message(err, "Reprint failed"));
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="grid gap-3 lg:grid-cols-10 items-start">
      <Card className="lg:col-span-10">
        <SectionLabel n={1} icon={ScanBarcode}>Scan the label</SectionLabel>
        <div className="flex gap-2 max-w-xl">
          <div className="relative flex-1">
            <ScanBarcode className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              ref={scanRef}
              value={scan}
              readOnly={!!label}
              onChange={(e) => setScan(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !label && find()}
              placeholder="The FG serial, the assembly S… or the foaming F… serial (or the barcode number)"
              className={`w-full pl-9 pr-3 py-2.5 border rounded-lg text-sm font-mono text-slate-800 outline-none focus:ring-2 focus:ring-blue-100 ${
                label ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white focus:border-blue-400"
              }`}
            />
          </div>
          {label ? (
            <button onClick={clear} className="flex items-center gap-1.5 px-4 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 cursor-pointer">
              <X className="w-3.5 h-3.5" /> Change
            </button>
          ) : (
            <button onClick={find} disabled={finding || !scan.trim()} className="flex items-center gap-1.5 px-5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 cursor-pointer">
              {finding ? <Spinner /> : <ScanBarcode className="w-3.5 h-3.5" />} Go
            </button>
          )}
        </div>
      </Card>
      {label && (
        <>
          <Card className="lg:col-span-6">
            <SectionLabel n={2} icon={Tag}>Label</SectionLabel>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Pill cls={KIND[label.kind] ?? STATE.ready[0]}>
                {label.kind} {label.kind === "FG" ? "label" : "barcode"}
              </Pill>
              <span className="font-mono text-base font-bold tracking-wide text-slate-800">{label.serial}</span>
            </div>
            <dl className="grid gap-x-5 gap-y-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <Detail label="Material">{label.material}</Detail>
              </div>
              <Detail label="Material code">{label.materialAlias}</Detail>
              {label.kind === "FG" && <Detail label="Assembly serial">{label.alias}</Detail>}
              <Detail label="Barcode No">{String(label.barcodeNo)}</Detail>
              <Detail label="Job card">{label.jobCard}</Detail>
              <Detail label="Production order">{label.productionOrder}</Detail>
              <Detail label="Process">{label.processName}</Detail>
              <Detail label="Created on">{when(label.createdOn)}</Detail>
              <Detail label="Reprints">{`${label.reprints}${label.lastReprint ? ` (last ${when(label.lastReprint)})` : ""}`}</Detail>
            </dl>
          </Card>
          <Card className="lg:col-span-4">
            <SectionLabel n={3} icon={Printer}>Reprint</SectionLabel>
            <div className="grid gap-4">
              <SelectField label="Printer" options={printers} value={printer} onChange={(e) => !printing && setPrinter(e.target.value)} placeholder="Choose a printer…" />
              <ReasonField value={remark} onChange={setRemark} disabled={printing} />
              <div className="flex flex-wrap gap-2">
                <button onClick={print} disabled={printing || !remark.trim() || !printer} className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 cursor-pointer">
                  {printing ? <Spinner cls="w-3.5 h-3.5" /> : <Printer className="w-3.5 h-3.5" />} Reprint
                </button>
                <button onClick={clear} disabled={printing} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 cursor-pointer">
                  Scan another
                </button>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
};

/* ── Many labels ── */
const ManyLabels = () => {
  const [text, setText] = useState("");
  const [rows, setRows] = useState(null); // [{ serial, kind?, barcodeNo?, material?, jobCard?, error?, state? }]
  const [checking, setChecking] = useState(false);
  const [remark, setRemark] = useState("");
  const [progress, setProgress] = useState(null); // { done, total } while printing
  const [confirm, setConfirm] = useState(null); // the labels to print, while asking
  const { printers, printer, setPrinter } = usePrinters();
  const stop = useRef(false);

  const serials = serialsOf(text);
  const found = rows?.filter((r) => r.barcodeNo) ?? [];
  const missing = (rows?.length ?? 0) - found.length;
  const printing = progress !== null;
  const toPrint = found.filter((r) => r.state === "ready");
  const toRetry = found.filter((r) => r.state === "failed");

  const check = async () => {
    if (serials.length > MAX) return toast.error(`Check at most ${MAX} serials at a time (${serials.length} given).`);
    setChecking(true);
    try {
      const list = (await axios.post(`${baseURL}quality/barcode-reprint/check`, { serials })).data.data;
      setRows(list.map((r) => (r.barcodeNo ? { ...r, state: "ready" } : r)));
    } catch (err) {
      toast.error(message(err, "Check failed"));
    } finally {
      setChecking(false);
    }
  };

  // the labels in `todo`, PART at a time; Stop ends it after the part being printed
  const print = async (todo) => {
    setConfirm(null);
    stop.current = false;
    let done = 0;
    let sent = 0;
    let refused = false;
    setProgress({ done, total: todo.length });
    const mark = (list, state, results) =>
      setRows((rs) =>
        rs.map((r) => {
          const hit = results?.find((x) => String(x.barcodeNo) === String(r.barcodeNo));
          if (hit) return { ...r, state: hit.ok ? "printed" : "failed", error: hit.ok ? undefined : hit.error };
          return list.some((x) => x.barcodeNo === r.barcodeNo) ? { ...r, state } : r;
        }),
      );
    try {
      for (let i = 0; i < todo.length && !stop.current; i += PART) {
        const part = todo.slice(i, i + PART);
        mark(part, "printing");
        try {
          const res = (await axios.post(`${baseURL}quality/barcode-reprint/many`, { barcodeNos: part.map((r) => String(r.barcodeNo)), printer, remark })).data.data;
          mark(part, "failed", res);
          sent += res.filter((x) => x.ok).length;
        } catch (err) {
          // the whole part refused (printer offline, reason missing ...): it can be printed again; the rest stays ready
          const why = message(err, "Print failed");
          mark(part, "failed", part.map((r) => ({ barcodeNo: r.barcodeNo, ok: false, error: why })));
          refused = true;
          toast.error(why);
        }
        done += part.length;
        setProgress({ done, total: todo.length });
        if (refused) break;
      }
    } finally {
      setProgress(null);
    }
    const failed = done - sent;
    const left = todo.length - done;
    if (left) toast(`${sent} printed, ${failed} failed, ${left} not sent${stop.current ? " (stopped)" : ""}`);
    else if (failed) toast.error(`${sent} printed, ${failed} failed: print the failed ones again`);
    else toast.success(`${plural(sent, "label")} printed`);
  };

  const printerName = printers.find((o) => o.value === printer)?.label ?? "the printer";

  return (
    <div className="grid gap-3 lg:grid-cols-10 items-start">
      {confirm && (
        <PopupModal
          title={`Print ${plural(confirm.length, "label")}?`}
          description={`They are sent to ${printerName}, each logged with the reason given.`}
          confirmText="Print"
          cancelText="Cancel"
          onConfirm={() => print(confirm)}
          onCancel={() => setConfirm(null)}
          confirmButtonColor="bg-blue-600 hover:bg-blue-700"
        />
      )}
      <Card className="lg:col-span-4">
        <SectionLabel n={1} icon={ScanBarcode}>Serials</SectionLabel>
        <textarea
          rows={12}
          value={text}
          onChange={(e) => (setText(e.target.value), setRows(null))}
          disabled={printing}
          placeholder={"42734261000346\n42734261000347\n…"}
          aria-label="Serials"
          className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-[13px] text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button onClick={check} disabled={!serials.length || printing || checking} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 cursor-pointer">
            {checking ? <Spinner cls="w-3.5 h-3.5" /> : <ListChecks className="w-3.5 h-3.5" />} Check {serials.length || ""}
          </button>
          <button onClick={() => (setText(""), setRows(null))} disabled={printing || (!text && !rows)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50 cursor-pointer">
            <Trash2 className="w-3.5 h-3.5" /> Clear
          </button>
          <span className="text-[11px] text-slate-400">{plural(serials.length, "serial")} (repeats counted once, up to {MAX})</span>
        </div>
      </Card>

      <Card className="lg:col-span-6">
        <SectionLabel n={2} icon={ListChecks}>Labels</SectionLabel>
        {!rows ? (
          <p className="text-xs text-slate-400">Check the serials to see what will be printed, in this order.</p>
        ) : (
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Pill cls={STATE.printed[0]}>{found.length} found</Pill>
              {missing > 0 && <Pill cls={STATE.failed[0]}>{missing} not found</Pill>}
              {found.some((r) => r.state === "printed") && <Pill cls={STATE.printing[0]}>{found.filter((r) => r.state === "printed").length} printed</Pill>}
              {missing > 0 && !printing && (
                <button onClick={() => (setRows((rs) => rs.filter((r) => r.barcodeNo)), setText(found.map((r) => r.serial).join("\n")))} className="px-3 py-1 rounded-lg border border-slate-200 text-slate-600 text-[11px] font-semibold hover:bg-slate-50 cursor-pointer">
                  Remove not found
                </button>
              )}
            </div>
            <div className="max-h-[26rem] overflow-auto rounded-lg border border-slate-200">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50">
                  <tr>
                    {["#", "Serial", "Label", "Material", "Job Card", "Status"].map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-semibold text-slate-500 uppercase tracking-wide text-[10px]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r, i) => (
                    <tr key={r.serial} className={r.barcodeNo ? undefined : "bg-red-50/60"}>
                      <td className="px-3 py-1.5 text-slate-400">{i + 1}</td>
                      <td className="px-3 py-1.5 font-mono text-slate-700">{r.serial}</td>
                      <td className="px-3 py-1.5">{r.kind ? <Pill cls={KIND[r.kind]}>{r.kind}</Pill> : "—"}</td>
                      <td className="max-w-52 truncate px-3 py-1.5 text-slate-700" title={r.material}>
                        {r.material ?? "—"}
                      </td>
                      <td className="px-3 py-1.5 text-slate-700">{r.jobCard ?? "—"}</td>
                      <td className="px-3 py-1.5" title={r.error}>
                        {r.barcodeNo ? <Pill cls={STATE[r.state][0]}>{STATE[r.state][1]}</Pill> : <span className="text-red-600">Not found</span>}
                        {r.state === "failed" && r.error && <span className="ml-2 text-[11px] text-red-600">{r.error}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>

      {found.length > 0 && (
        <Card className="lg:col-span-10">
          <SectionLabel n={3} icon={Printer}>Print</SectionLabel>
          <div className="grid items-end gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]">
            <SelectField label="Printer" options={printers} value={printer} onChange={(e) => !printing && setPrinter(e.target.value)} placeholder="Choose a printer…" />
            <ReasonField value={remark} onChange={setRemark} disabled={printing} rows={1} />
            <div className="flex flex-wrap gap-2">
              {printing ? (
                <button onClick={() => (stop.current = true)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 cursor-pointer">
                  <Square className="w-3.5 h-3.5" /> Stop after this part
                </button>
              ) : (
                <>
                  <button onClick={() => setConfirm(toPrint)} disabled={!toPrint.length || !printer || !remark.trim()} className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 cursor-pointer">
                    <Printer className="w-3.5 h-3.5" /> Print {plural(toPrint.length, "label")}
                  </button>
                  {toRetry.length > 0 && (
                    <button onClick={() => setConfirm(toRetry)} disabled={!printer || !remark.trim()} className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50 cursor-pointer">
                      <Printer className="w-3.5 h-3.5" /> Print {toRetry.length} failed again
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
          {printing && (
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-[11px] text-slate-500">
                <span>Printing…</span>
                <span className="font-mono">
                  {progress.done} / {progress.total}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full bg-blue-600 transition-[width]" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

const VIEWS = [
  ["one", "One label", Printer],
  ["many", "Many labels", Layers],
  ["history", "Reprint history", History],
];

const BarcodeReprint = () => {
  const [view, setView] = useState("one");
  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      {/* ── PAGE HEADER ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shadow-sm shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-tight">Material Barcode Reprint</h1>
          <p className="text-[11px] text-slate-400">Quality · Reprint an FG label, an assembly or a foaming barcode</p>
        </div>
        <div className="inline-flex p-1 rounded-xl bg-slate-50 border border-slate-200">
          {VIEWS.map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                view === key ? "bg-white text-blue-700 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-3">
        {view === "one" && <OneLabel />}
        {view === "many" && <ManyLabels />}
        {view === "history" && <HistoryTable url="quality/barcode-reprint/history" filename="Barcode_Reprint_History.xlsx" emptyText="No reprints yet." />}
      </div>
    </div>
  );
};

export default BarcodeReprint;
