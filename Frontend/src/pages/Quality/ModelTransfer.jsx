import { useEffect, useRef, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { ArrowLeftRight, ArrowRight, Boxes, History, ListChecks, Loader2, Printer, ScanBarcode, Square, Trash2, X } from "lucide-react";
import { baseURL } from "../../assets/assets";
import SelectField from "../../components/ui/SelectField";
import PopupModal from "../../components/ui/PopupModal";
import HistoryTable from "../../components/ui/HistoryTable";

// Model To Model Transfer (from Garuda): 1 scan or paste the FG serials, Check: they are grouped by product (source
// material); 2 each product gets its destination; 3 a printer, Transfer: each unit is moved and its label printed
// again, PART at a time per product, with progress and Stop.

const MAX = 500; // as the server checks at a time
const PART = 25; // units a request moves (the server takes up to 50)
const STATE = {
  ready: ["bg-slate-100 text-slate-600 border-slate-200", "Ready"],
  moving: ["bg-blue-50 text-blue-700 border-blue-200", "Moving"],
  moved: ["bg-emerald-50 text-emerald-700 border-emerald-200", "Moved"],
  unprinted: ["bg-amber-50 text-amber-700 border-amber-200", "Moved, label not printed"],
  failed: ["bg-red-50 text-red-700 border-red-200", "Failed"],
};

const serialsOf = (text) => [...new Set(text.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean))];
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

const Spinner = ({ cls = "w-4 h-4" }) => <Loader2 className={`animate-spin ${cls}`} />;
const Pill = ({ cls, children }) => <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cls}`}>{children}</span>;
const SectionLabel = ({ n, icon: Icon, children }) => (
  <div className="flex items-center gap-2 mb-3">
    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">{n}</span>
    <Icon className="w-3.5 h-3.5 text-slate-400" />
    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">{children}</p>
  </div>
);

const Transfer = ({ options: { materials, printers } }) => {
  const [text, setText] = useState("");
  const [groups, setGroups] = useState(null); // [{ materialCode, material, materialAlias, destination, units: [{ serial, barcodeNo, state, error? }] }]
  const [refused, setRefused] = useState([]);
  const [checking, setChecking] = useState(false);
  const [printer, setPrinter] = useState(() => (printers.length === 1 ? printers[0].value : ""));
  const [progress, setProgress] = useState(null); // { done, total } while moving
  const [confirming, setConfirming] = useState(false);
  const stop = useRef(false);

  const serials = serialsOf(text);
  const moving = progress !== null;
  const units = (groups ?? []).flatMap((g) => g.units);
  const ready = (groups ?? []).filter((g) => g.units.some((u) => u.state === "ready" || u.state === "failed"));
  const todo = ready.flatMap((g) => g.units.filter((u) => u.state === "ready" || u.state === "failed"));
  const unset = ready.filter((g) => !g.destination);
  const count = (state) => units.filter((u) => u.state === state).length;
  const reset = () => (setGroups(null), setRefused([]));

  const check = async () => {
    if (serials.length > MAX) return toast.error(`Check at most ${MAX} serials at a time (${serials.length} given).`);
    setChecking(true);
    try {
      const { data } = (await axios.post(`${baseURL}quality/model-transfer/check`, { serials })).data;
      setGroups(data.groups.map((g) => ({ ...g, destination: "", units: g.units.map((u) => ({ ...u, state: "ready" })) })));
      setRefused(data.refused);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Check failed");
    } finally {
      setChecking(false);
    }
  };

  const setGroup = (code, p) => setGroups((gs) => gs.map((g) => (g.materialCode === code ? { ...g, ...p } : g)));
  const markUnits = (code, list, state, results) =>
    setGroups((gs) =>
      gs.map((g) =>
        g.materialCode !== code
          ? g
          : {
              ...g,
              units: g.units.map((u) => {
                const hit = results?.find((x) => String(x.barcodeNo) === String(u.barcodeNo));
                if (hit) return { ...u, state: !hit.ok ? "failed" : hit.printed ? "moved" : "unprinted", error: hit.error };
                return list.some((x) => x.barcodeNo === u.barcodeNo) ? { ...u, state } : u;
              }),
            },
      ),
    );

  const transfer = async () => {
    setConfirming(false);
    stop.current = false;
    let done = 0;
    let ok = 0;
    let refusedPart = false;
    setProgress({ done, total: todo.length });
    try {
      for (const g of ready) {
        const list = g.units.filter((u) => u.state === "ready" || u.state === "failed");
        for (let i = 0; i < list.length && !stop.current && !refusedPart; i += PART) {
          const part = list.slice(i, i + PART);
          markUnits(g.materialCode, part, "moving");
          try {
            const res = (await axios.post(`${baseURL}quality/model-transfer`, { source: g.materialCode, destination: g.destination, barcodeNos: part.map((u) => u.barcodeNo), printer })).data.data;
            markUnits(g.materialCode, part, "failed", res);
            ok += res.filter((x) => x.ok).length;
          } catch (err) {
            // the whole part refused (printer offline, destination ...): nothing in it moved; it can be sent again
            const message = err?.response?.data?.message || "Transfer failed";
            markUnits(g.materialCode, part, "failed", part.map((u) => ({ barcodeNo: u.barcodeNo, ok: false, error: message })));
            refusedPart = true;
            toast.error(message);
          }
          done += part.length;
          setProgress({ done, total: todo.length });
        }
        if (stop.current || refusedPart) break;
      }
    } finally {
      setProgress(null);
    }
    const left = todo.length - done;
    const failed = done - ok;
    if (left) toast(`${ok} moved, ${failed} failed, ${left} not sent${stop.current ? " (stopped)" : ""}`);
    else if (failed) toast.error(`${ok} moved, ${failed} failed: send the failed ones again`);
    else toast.success(`${plural(ok, "unit")} transferred`);
  };

  const nameOf = (v) => materials.find((o) => o.value === v)?.label ?? v;

  return (
    <div className="grid gap-3 lg:grid-cols-10 items-start">
      {confirming && (
        <PopupModal
          title={`Transfer ${plural(todo.length, "unit")}?`}
          description="Each unit's material, stock, job card and location change, and its label is printed again."
          confirmText="Transfer"
          cancelText="Cancel"
          onConfirm={transfer}
          onCancel={() => setConfirming(false)}
          confirmButtonColor="bg-blue-600 hover:bg-blue-700"
        >
          <ul className="mt-3 text-left text-xs text-slate-600 space-y-1">
            {ready.map((g) => (
              <li key={g.materialCode}>
                {g.units.filter((u) => u.state !== "moved" && u.state !== "unprinted").length} × {g.material} → <b>{nameOf(g.destination)}</b>
              </li>
            ))}
          </ul>
        </PopupModal>
      )}

      {/* 1 FG serials */}
      <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <SectionLabel n={1} icon={ScanBarcode}>FG serials</SectionLabel>
        <textarea
          rows={14}
          value={text}
          onChange={(e) => (setText(e.target.value), reset())}
          disabled={moving}
          placeholder={"42214260201910\n42214260201912\n…"}
          aria-label="FG serials"
          className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-[13px] text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button onClick={check} disabled={!serials.length || moving || checking} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 cursor-pointer">
            {checking ? <Spinner cls="w-3.5 h-3.5" /> : <ListChecks className="w-3.5 h-3.5" />} Check {serials.length || ""}
          </button>
          <button onClick={() => (setText(""), reset())} disabled={moving || (!text && !groups)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50 cursor-pointer">
            <Trash2 className="w-3.5 h-3.5" /> Clear
          </button>
        </div>
        <p className="mt-1.5 text-[11px] text-slate-400">
          {plural(serials.length, "serial")} (repeats counted once, up to {MAX})
        </p>
      </div>

      {/* 2 Products */}
      <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <SectionLabel n={2} icon={Boxes}>Products</SectionLabel>
        {!groups ? (
          <p className="text-xs text-slate-400">Check the serials to group them here by their product.</p>
        ) : (
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Pill cls={STATE.moved[0]}>
                {plural(units.length, "unit")} in {plural(groups.length, "product")}
              </Pill>
              {refused.length > 0 && <Pill cls={STATE.failed[0]}>{refused.length} refused</Pill>}
              {count("moved") + count("unprinted") > 0 && <Pill cls={STATE.moving[0]}>{count("moved") + count("unprinted")} moved</Pill>}
              {count("unprinted") > 0 && <Pill cls={STATE.unprinted[0]}>{plural(count("unprinted"), "label")} to reprint</Pill>}
            </div>
            {groups.map((g) => (
              <div key={g.materialCode} className="rounded-lg border border-slate-200">
                <div className="grid items-center gap-3 border-b border-slate-100 bg-slate-50/60 px-3 py-2.5 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto]">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-800" title={g.material}>
                      {g.material}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {g.materialAlias || g.materialCode} · {plural(g.units.length, "unit")}
                    </p>
                  </div>
                  <ArrowRight className="hidden md:block w-4 h-4 text-slate-400" />
                  <SelectField
                    options={materials.filter((o) => o.value !== g.materialCode)}
                    value={g.destination}
                    onChange={(e) => !moving && setGroup(g.materialCode, { destination: e.target.value })}
                    placeholder="Move to … (type to search)"
                  />
                  <button
                    onClick={() => setGroups((gs) => gs.filter((x) => x.materialCode !== g.materialCode))}
                    disabled={moving}
                    title="Leave this product out"
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <details className="px-3 py-2">
                  <summary className="cursor-pointer text-[11px] font-semibold text-slate-500">Serials</summary>
                  <ul className="mt-2 grid max-h-56 gap-1 overflow-auto text-xs sm:grid-cols-2">
                    {g.units.map((u) => (
                      <li key={u.barcodeNo} className="flex min-w-0 items-center gap-2" title={u.error}>
                        <span className="font-mono text-slate-700">{u.serial}</span>
                        <Pill cls={STATE[u.state][0]}>{STATE[u.state][1]}</Pill>
                        {u.state === "failed" && u.error && <span className="truncate text-[11px] text-red-600">{u.error}</span>}
                      </li>
                    ))}
                  </ul>
                </details>
              </div>
            ))}
            {refused.length > 0 && (
              <details open className="rounded-lg border border-red-200 bg-red-50/50 px-3 py-2">
                <summary className="cursor-pointer text-xs font-semibold text-red-700">Refused ({refused.length})</summary>
                <ul className="mt-2 grid max-h-48 gap-1 overflow-auto text-xs">
                  {refused.map((r) => (
                    <li key={r.serial}>
                      <span className="font-mono">{r.serial}</span> <span className="text-slate-500">— {r.error}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>

      {/* 3 Transfer */}
      {groups?.length > 0 && (
        <div className="lg:col-span-10 bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <SectionLabel n={3} icon={Printer}>Transfer</SectionLabel>
          <div className="flex flex-wrap items-end gap-4">
            <SelectField label="Printer" className="w-full max-w-sm" options={printers} value={printer} onChange={(e) => !moving && setPrinter(e.target.value)} placeholder="Choose a printer…" />
            {moving ? (
              <button onClick={() => (stop.current = true)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 cursor-pointer">
                <Square className="w-3.5 h-3.5" /> Stop after this part
              </button>
            ) : (
              <button
                onClick={() => setConfirming(true)}
                disabled={!todo.length || !printer || unset.length > 0}
                className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                {todo.length && count("failed") === todo.length ? `Send ${todo.length} failed again` : `Transfer ${plural(todo.length, "unit")}`}
              </button>
            )}
          </div>
          {unset.length > 0 && !moving && (
            <p className="mt-2 text-[11px] text-amber-700">
              Choose a destination for {unset.length === 1 ? unset[0].material : `${unset.length} products`} (or leave {unset.length === 1 ? "it" : "them"} out).
            </p>
          )}
          {moving && (
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-[11px] text-slate-500">
                <span>Transferring…</span>
                <span className="font-mono">
                  {progress.done} / {progress.total}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full bg-blue-600 transition-[width]" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const ModelTransfer = () => {
  const [tab, setTab] = useState("transfer");
  const [options, setOptions] = useState(null);

  useEffect(() => {
    axios
      .get(`${baseURL}quality/model-transfer/options`)
      .then((res) => setOptions(res.data.data))
      .catch((err) => toast.error(err?.response?.data?.message || "Could not load the materials and printers"));
  }, []);

  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      {/* ── PAGE HEADER ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shadow-sm shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-tight">Model To Model Transfer</h1>
          <p className="text-[11px] text-slate-400">Quality · Move FG units to another model by their serials</p>
        </div>
        <div className="inline-flex p-1 rounded-xl bg-slate-50 border border-slate-200">
          {[
            ["transfer", "Transfer", ArrowLeftRight],
            ["history", "Transfer history", History],
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
          <HistoryTable url="quality/model-transfer/history" filename="Model_Transfer_History.xlsx" emptyText="No transfers yet." />
        ) : !options ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-400 text-xs">
            <Spinner /> Loading…
          </div>
        ) : (
          <Transfer options={options} />
        )}
      </div>
    </div>
  );
};

export default ModelTransfer;
