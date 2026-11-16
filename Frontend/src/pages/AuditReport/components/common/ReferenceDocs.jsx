import { useRef } from "react";
import { FaFilePdf, FaFileExcel, FaFileAlt, FaUpload, FaTrash, FaExternalLinkAlt } from "react-icons/fa";
import { baseURL } from "../../../../assets/assets.js";

// BOM Sheet + CRF reference files of a template (or, on an audit, the ones
// attached when that audit was started). Read-only unless onUpload is given.
const KINDS = [
  { kind: "bom", label: "BOM Sheet", file: "bomFileName", original: "bomOriginalName" },
  { kind: "crf", label: "CRF", file: "crfFileName", original: "crfOriginalName" },
];

const docUrl = (fileName) => `${baseURL}audit-report/documents/${encodeURIComponent(fileName)}`;

const iconFor = (name = "") =>
  /\.pdf$/i.test(name) ? FaFilePdf : /\.xlsx?$/i.test(name) ? FaFileExcel : FaFileAlt;

export default function ReferenceDocs({ docs, onUpload, onRemove, busyKind, compact = false }) {
  const inputs = useRef({});
  const editable = typeof onUpload === "function";
  const present = KINDS.filter((k) => docs?.[k.file]);
  if (!editable && present.length === 0) return null;

  const list = editable ? KINDS : present;

  return (
    <div className={compact ? "flex flex-wrap items-center gap-2" : "bg-white rounded-2xl border border-gray-200 shadow-sm p-5"}>
      {!compact && (
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
          Reference Documents
        </h2>
      )}
      {compact && <span className="text-xs font-semibold text-gray-500">Reference:</span>}
      <div className={compact ? "contents" : "grid grid-cols-1 md:grid-cols-2 gap-3"}>
        {list.map(({ kind, label, file, original }) => {
          const fileName = docs?.[file];
          const shownName = docs?.[original] || fileName;
          const Icon = iconFor(fileName);
          const busy = busyKind === kind;

          if (compact) {
            return (
              <a
                key={kind}
                href={docUrl(fileName)}
                target="_blank"
                rel="noopener noreferrer"
                title={shownName}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100"
              >
                <Icon size={12} /> {label} <FaExternalLinkAlt size={9} />
              </a>
            );
          }

          return (
            <div key={kind} className="flex items-center gap-3 rounded-xl border border-gray-200 p-3">
              <Icon className={fileName ? "text-indigo-500" : "text-gray-300"} size={20} />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-gray-700">{label}</div>
                {fileName ? (
                  <a
                    href={docUrl(fileName)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-xs text-indigo-600 hover:underline"
                    title={shownName}
                  >
                    {shownName}
                  </a>
                ) : (
                  <div className="text-xs text-gray-400">Not uploaded</div>
                )}
              </div>
              {editable && (
                <>
                  <input
                    ref={(el) => (inputs.current[kind] = el)}
                    type="file"
                    accept=".pdf,.xlsx,.xls"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (f) onUpload(kind, f);
                    }}
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => inputs.current[kind]?.click()}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50"
                    aria-label={`${fileName ? "Replace" : "Upload"} ${label}`}
                  >
                    <FaUpload size={10} /> {busy ? "Saving…" : fileName ? "Replace" : "Upload"}
                  </button>
                  {fileName && onRemove && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onRemove(kind)}
                      className="p-2 rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-50"
                      aria-label={`Remove ${label}`}
                      title={`Remove ${label}`}
                    >
                      <FaTrash size={11} />
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
      {editable && !compact && (
        <p className="mt-2 text-[11px] text-gray-400">
          PDF or Excel, up to 20 MB. Audits already started keep the file that was attached at the time.
        </p>
      )}
    </div>
  );
}
