import { useState, useEffect, useMemo, useRef } from "react";
import { ChevronDown, Check, Search, X } from "lucide-react";

/**
 * Multi-select dropdown with checkboxes (same behaviour as the Category / Defect
 * filters on the Rework Report) — searchable, Select all / Deselect all, selected
 * chips, and a clear button.
 *
 * options  : [{ value, label }]  (plain strings also work)
 * value    : array of selected option values            (empty array = "All")
 * onChange : (nextValues: string[]) => void
 */
const optValue = (o) => (typeof o === "string" ? o : o.value);
const optLabel = (o) => (typeof o === "string" ? o : o.label);

const MultiSelectField = ({
  label,
  options = [],
  value = [],
  onChange,
  allLabel = "All",
  searchPlaceholder = "Search...",
  icon: Icon,
  className = "",
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    const close = () => {
      setOpen(false);
      setSearch("");
    };
    const onMouseDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) close();
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const labelOf = useMemo(() => {
    const map = new Map(options.map((o) => [optValue(o), optLabel(o)]));
    return (v) => map.get(v) ?? v; // fall back to the raw value if it's no longer in options
  }, [options]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? options.filter((o) => String(optLabel(o)).toLowerCase().includes(q))
      : options;
  }, [options, search]);

  const toggle = (v) =>
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  const clearAll = () => onChange([]);

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((o) => value.includes(optValue(o)));
  const toggleAllFiltered = () => {
    const vals = filtered.map(optValue);
    onChange(
      allFilteredSelected
        ? value.filter((v) => !vals.includes(v))
        : [...new Set([...value, ...vals])],
    );
  };

  const summary =
    value.length === 0
      ? allLabel
      : value.length === 1
        ? labelOf(value[0])
        : `${value.length} selected`;

  return (
    <div className={`relative ${className}`} ref={ref}>
      {label && (
        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
          {label}
        </label>
      )}

      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border bg-white text-xs text-slate-700 hover:border-blue-300 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all ${
          value.length > 0
            ? "border-blue-400 ring-1 ring-blue-100"
            : "border-slate-200"
        }`}
      >
        <span className="flex items-center gap-1.5 truncate">
          {value.length > 0 && Icon && (
            <Icon className="w-3 h-3 text-blue-500 shrink-0" />
          )}
          <span className="truncate">{summary}</span>
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {value.length > 0 && (
            <span
              role="button"
              aria-label={`Clear ${label || "selection"}`}
              onClick={(e) => {
                e.stopPropagation();
                clearAll();
              }}
              className="w-4 h-4 rounded-full bg-slate-200 hover:bg-red-100 text-slate-500 hover:text-red-600 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-2.5 h-2.5" />
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 z-50 w-72 max-w-[90vw] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Filter by {label?.toLowerCase() || "option"}
            </span>
            {value.length > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="text-[10px] text-blue-600 hover:underline font-semibold"
              >
                Clear all
              </button>
            )}
          </div>

          {options.length > 0 && (
            <div className="px-3 py-2 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={searchPlaceholder}
                  autoFocus
                  className="w-full pl-6 pr-6 py-1.5 border border-slate-200 rounded-md text-xs text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                />
                {search && (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => setSearch("")}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2"
                  >
                    <X className="w-3 h-3 text-slate-400 hover:text-slate-600" />
                  </button>
                )}
              </div>
            </div>
          )}

          {filtered.length > 0 && (
            <div className="px-3 py-1.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <button
                type="button"
                onClick={toggleAllFiltered}
                className="text-[10px] font-semibold text-blue-600 hover:underline transition-colors"
              >
                {allFilteredSelected
                  ? "Deselect all"
                  : search
                    ? "Select all matching"
                    : "Select all"}
              </button>
              <span className="text-[10px] text-slate-400 font-mono">
                {filtered.length} of {options.length}
              </span>
            </div>
          )}

          <div
            role="listbox"
            aria-multiselectable="true"
            className="py-1 max-h-52 overflow-auto"
          >
            {filtered.length > 0 ? (
              filtered.map((o) => {
                const v = optValue(o);
                const active = value.includes(v);
                return (
                  <button
                    key={v}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => toggle(v)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left transition-colors ${
                      active
                        ? "bg-blue-50 text-blue-700"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                        active
                          ? "bg-blue-600 border-blue-600"
                          : "border-slate-300 bg-white"
                      }`}
                    >
                      {active && (
                        <Check className="w-3 h-3 text-white" strokeWidth={3} />
                      )}
                    </span>
                    <span className="truncate">{optLabel(o)}</span>
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-4 text-center text-[11px] text-slate-400">
                {search
                  ? "No options match your search"
                  : "No options available"}
              </div>
            )}
          </div>

          {value.length > 0 && (
            <div className="px-3 py-2 border-t border-slate-100 bg-slate-50">
              <div className="flex flex-wrap gap-1">
                {value.map((v) => (
                  <span
                    key={v}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold border border-blue-200 max-w-[140px]"
                  >
                    <span className="truncate">{labelOf(v)}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${labelOf(v)}`}
                      onClick={() => toggle(v)}
                      className="hover:text-blue-900 transition-colors shrink-0"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MultiSelectField;
