import { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { baseURL } from "../../assets/assets";
import {
  FiSearch,
  FiRotateCcw,
  FiClock,
  FiStopCircle,
  FiPlay,
  FiActivity,
  FiMapPin,
  FiCalendar,
  FiBarChart2,
  FiList,
  FiMaximize2,
  FiChevronDown,
  FiMinimize2,
} from "react-icons/fi";
import { AiOutlineLoading3Quarters } from "react-icons/ai";

import Title from "../../components/ui/Title";
import Loader from "../../components/ui/Loader";
import ExportButton from "../../components/ui/ExportButton";
import EmptyState from "../../components/ui/EmptyState";

// ─── Inner Tab Config ───────────────────────────────────────────
const INNER_TABS = [
  {
    key: "summary",
    label: "Summary Report",
    icon: FiBarChart2,
    activeBg: "bg-indigo-50",
    activeBorder: "border-indigo-500",
    activeText: "text-indigo-700",
    iconActive: "text-indigo-600",
    headerGradient: "from-indigo-600 to-purple-600",
    lightBg: "bg-indigo-50/30",
  },
  {
    key: "detail",
    label: "Detail Report",
    icon: FiList,
    activeBg: "bg-teal-50",
    activeBorder: "border-teal-500",
    activeText: "text-teal-700",
    iconActive: "text-teal-600",
    headerGradient: "from-teal-600 to-emerald-600",
    lightBg: "bg-teal-50/30",
  },
];

// ─── Format seconds to HH:MM:SS ────────────────────────────────
function formatSeconds(seconds) {
  if (!seconds || seconds <= 0) return "00:00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Duration Badge
function DurationBadge({ duration, seconds }) {
  const isHigh = seconds > 600;
  const isMedium = seconds > 120;

  const color = isHigh
    ? "bg-red-50 text-red-700 border-red-200"
    : isMedium
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-emerald-50 text-emerald-700 border-emerald-200";

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold rounded-full border ${color}`}
    >
      <FiClock size={10} />
      {duration}
    </span>
  );
}

// ─── Summary Table ──────────────────────────────────────────────
function SummaryTable({ data, tabConfig }) {
  const headers = [
    "Sr No",
    "Station Name",
    "Total Stop Time",
    "Total Stops",
    "Avg per Stop",
  ];

  const totalStops = data.reduce(
    (sum, d) => sum + (d.Total_Stop_Count || 0),
    0,
  );
  const totalSeconds = data.reduce((sum, d) => sum + (d.Total_Seconds || 0), 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="w-full overflow-x-auto overflow-y-auto max-h-[550px] rounded-xl border border-gray-200 shadow-sm relative">
        <table
          className="w-full text-sm border-collapse"
          style={{ minWidth: "700px" }}
        >
          <colgroup>
            <col style={{ width: "60px" }} />
            <col style={{ width: "250px" }} />
            <col style={{ width: "150px" }} />
            <col style={{ width: "120px" }} />
            <col style={{ width: "150px" }} />
          </colgroup>

          {/* ── STICKY HEADER ── */}
          <thead className="sticky top-0 z-20">
            <tr
              className={`bg-gradient-to-r ${tabConfig.headerGradient} text-white`}
            >
              {headers.map((h, i) => (
                <th
                  key={i}
                  className="px-4 py-3.5 text-[10px] font-semibold uppercase tracking-wider text-center 
                             border-r border-white/10 last:border-r-0
                             first:rounded-tl-xl last:rounded-tr-xl
                             backdrop-blur-sm"
                  style={{
                    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          {/* ── BODY ── */}
          <tbody className="divide-y divide-gray-100">
            {data.length > 0 ? (
              data.map((item, index) => {
                const isTop = index === 0;
                const rowBg = isTop
                  ? "bg-red-50/40"
                  : index % 2 === 0
                    ? "bg-white"
                    : tabConfig.lightBg || "bg-gray-50/60";

                const avgSeconds =
                  item.Total_Stop_Count > 0
                    ? Math.round(
                        (item.Total_Seconds || 0) / item.Total_Stop_Count,
                      )
                    : 0;

                return (
                  <tr
                    key={index}
                    className={`text-center transition-all duration-200 ${rowBg} 
                               hover:bg-indigo-50/60 hover:shadow-[inset_3px_0_0_0_theme(colors.indigo.400)]`}
                  >
                    <td className="px-4 py-3 align-middle">
                      <span
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold
                                    transition-transform duration-200 hover:scale-110
                                    ${
                                      isTop
                                        ? "bg-red-100 text-red-700 ring-2 ring-red-200"
                                        : "bg-gray-100 text-gray-700"
                                    }`}
                      >
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-middle text-left">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center
                                      ${isTop ? "bg-red-100" : "bg-gray-100"}`}
                        >
                          <FiMapPin
                            size={12}
                            className={isTop ? "text-red-500" : "text-gray-400"}
                          />
                        </div>
                        <span
                          className={`text-xs font-semibold ${isTop ? "text-red-700" : "text-gray-800"}`}
                        >
                          {item.Station_Name}
                        </span>
                        {isTop && (
                          <span className="px-1.5 py-0.5 text-[8px] font-bold uppercase bg-red-100 text-red-600 rounded-md">
                            Highest
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <DurationBadge
                        duration={item.Total_Stop_Time}
                        seconds={item.Total_Seconds}
                      />
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold rounded-full border
                                    ${
                                      item.Total_Stop_Count > 10
                                        ? "bg-red-50 text-red-700 border-red-200"
                                        : item.Total_Stop_Count > 5
                                          ? "bg-amber-50 text-amber-700 border-amber-200"
                                          : "bg-gray-100 text-gray-700 border-gray-200"
                                    }`}
                      >
                        <FiStopCircle size={10} />
                        {item.Total_Stop_Count}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <span className="text-xs text-gray-600 font-mono bg-gray-50 px-2 py-1 rounded-lg">
                        {formatSeconds(avgSeconds)}
                      </span>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={headers.length}>
                  <EmptyState message="No stop & loss data found for the selected filters." />
                </td>
              </tr>
            )}
          </tbody>

          {/* ── STICKY FOOTER ── */}
          {data.length > 0 && (
            <tfoot className="sticky bottom-0 z-20">
              <tr
                className="bg-gradient-to-r from-gray-800 to-gray-900 text-white"
                style={{
                  boxShadow: "0 -2px 8px rgba(0,0,0,0.1)",
                }}
              >
                <td
                  className="px-4 py-3.5 text-center text-[10px] font-bold uppercase tracking-wider
                             first:rounded-bl-xl"
                  colSpan={2}
                >
                  <div className="flex items-center justify-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
                      <FiBarChart2 size={12} />
                    </span>
                    TOTAL ({data.length} stations)
                  </div>
                </td>
                <td className="px-4 py-3.5 text-center">
                  <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-full bg-white/15 backdrop-blur-sm">
                    <FiClock size={10} />
                    {formatSeconds(totalSeconds)}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-center">
                  <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-full bg-white/15 backdrop-blur-sm">
                    <FiStopCircle size={10} />
                    {totalStops}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-center last:rounded-br-xl">
                  <span className="text-xs font-bold font-mono bg-white/10 px-3 py-1 rounded-full">
                    {totalStops > 0
                      ? formatSeconds(Math.round(totalSeconds / totalStops))
                      : "—"}
                  </span>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

// ─── Detail Table (Accordion Grouped by Station) ────────────────
function DetailTable({ data, tabConfig }) {
  const [expandedStations, setExpandedStations] = useState(new Set());

  // ── Group data by Station_Name ──
  const groupedData = useMemo(() => {
    const groups = {};
    data.forEach((item) => {
      const key = item.Station_Name || "Unknown Station";
      if (!groups[key]) {
        groups[key] = {
          stationName: key,
          records: [],
          totalSeconds: 0,
          longStops: 0,
        };
      }
      groups[key].records.push(item);
      groups[key].totalSeconds += item.Duration_Seconds || 0;
      if ((item.Duration_Seconds || 0) > 600) {
        groups[key].longStops += 1;
      }
    });

    // Sort by total seconds descending (worst stations first)
    return Object.values(groups).sort(
      (a, b) => b.totalSeconds - a.totalSeconds,
    );
  }, [data]);

  // ── Toggle single station ──
  const toggleStation = (stationName) => {
    setExpandedStations((prev) => {
      const next = new Set(prev);
      if (next.has(stationName)) {
        next.delete(stationName);
      } else {
        next.add(stationName);
      }
      return next;
    });
  };

  // ── Grand totals ──
  const totalDetailSeconds = data.reduce(
    (sum, d) => sum + (d.Duration_Seconds || 0),
    0,
  );
  const totalLongStops = data.filter(
    (d) => (d.Duration_Seconds || 0) > 600,
  ).length;

  return (
    <div className="flex flex-col gap-3">
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            {groupedData.length} Stations · {data.length} Total Stops
          </span>
        </div>
      </div>

      {/* ── Accordion Container ── */}
      <div className="w-full rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* ── Scrollable Area ── */}
        <div className="overflow-y-auto max-h-[550px]">
          {groupedData.length > 0 ? (
            groupedData.map((group, gIndex) => {
              const isExpanded = expandedStations.has(group.stationName);
              const isWorst = gIndex === 0;
              const stopCount = group.records.length;

              return (
                <div
                  key={group.stationName}
                  className="border-b border-gray-100 last:border-b-0"
                >
                  {/* ── Station Accordion Header ── */}
                  <button
                    onClick={() => toggleStation(group.stationName)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all duration-200 cursor-pointer
                               ${
                                 isExpanded
                                   ? `bg-gradient-to-r ${tabConfig.headerGradient} text-white shadow-sm`
                                   : isWorst
                                     ? "bg-red-50/60 hover:bg-red-50"
                                     : gIndex % 2 === 0
                                       ? "bg-white hover:bg-gray-50"
                                       : "bg-gray-50/40 hover:bg-gray-100/60"
                               }`}
                  >
                    {/* Chevron */}
                    <span
                      className={`transition-transform duration-300 ${isExpanded ? "rotate-0" : "-rotate-90"}`}
                    >
                      <FiChevronDown
                        size={16}
                        className={
                          isExpanded ? "text-white/80" : "text-gray-400"
                        }
                      />
                    </span>

                    {/* Station Icon + Name */}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0
                                    ${
                                      isExpanded
                                        ? "bg-white/15"
                                        : isWorst
                                          ? "bg-red-100"
                                          : "bg-gray-100"
                                    }`}
                      >
                        <FiMapPin
                          size={13}
                          className={
                            isExpanded
                              ? "text-white/80"
                              : isWorst
                                ? "text-red-500"
                                : "text-gray-400"
                          }
                        />
                      </div>
                      <span
                        className={`text-sm font-bold truncate
                                    ${isExpanded ? "text-white" : isWorst ? "text-red-700" : "text-gray-800"}`}
                      >
                        {group.stationName}
                      </span>
                      {isWorst && !isExpanded && (
                        <span className="px-1.5 py-0.5 text-[8px] font-bold uppercase bg-red-100 text-red-600 rounded-md shrink-0">
                          Highest
                        </span>
                      )}
                    </div>

                    {/* Stats Badges */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Stop Count */}
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded-full
                                    ${
                                      isExpanded
                                        ? "bg-white/15 text-white"
                                        : stopCount > 10
                                          ? "bg-red-50 text-red-700 border border-red-200"
                                          : stopCount > 5
                                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                                            : "bg-gray-100 text-gray-600 border border-gray-200"
                                    }`}
                      >
                        <FiStopCircle size={10} />
                        {stopCount} {stopCount === 1 ? "stop" : "stops"}
                      </span>

                      {/* Long Stops */}
                      {group.longStops > 0 && (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded-full
                                      ${isExpanded ? "bg-red-400/30 text-red-100" : "bg-red-50 text-red-600 border border-red-200"}`}
                        >
                          {group.longStops} long
                        </span>
                      )}

                      {/* Total Duration */}
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded-full font-mono
                                    ${
                                      isExpanded
                                        ? "bg-white/15 text-white"
                                        : group.totalSeconds > 600
                                          ? "bg-red-50 text-red-700 border border-red-200"
                                          : group.totalSeconds > 120
                                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                                            : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    }`}
                      >
                        <FiClock size={10} />
                        {formatSeconds(group.totalSeconds)}
                      </span>
                    </div>
                  </button>

                  {/* ── Expanded Records Table ── */}
                  <div
                    className={`transition-all duration-300 ease-in-out overflow-hidden
                               ${isExpanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"}`}
                  >
                    <div className="bg-white">
                      {/* Sub-table header */}
                      <div
                        className={`grid grid-cols-12 gap-0 px-4 py-2.5 text-[9px] font-bold uppercase tracking-widest
                                    bg-gradient-to-r ${tabConfig.headerGradient} bg-opacity-5`}
                        style={{
                          background:
                            "linear-gradient(to right, rgba(99,102,241,0.06), rgba(16,185,129,0.06))",
                        }}
                      >
                        <div className="col-span-1 text-center text-gray-400">
                          #
                        </div>
                        <div className="col-span-2 text-center text-gray-400">
                          Date
                        </div>
                        <div className="col-span-3 text-center text-gray-400">
                          Stop Time
                        </div>
                        <div className="col-span-3 text-center text-gray-400">
                          Start Time
                        </div>
                        <div className="col-span-3 text-center text-gray-400">
                          Duration
                        </div>
                      </div>

                      {/* Sub-table rows */}
                      {group.records.map((item, rIndex) => {
                        const seconds = item.Duration_Seconds || 0;
                        const isLong = seconds > 600;
                        const isMedium = seconds > 120;

                        return (
                          <div
                            key={rIndex}
                            className={`grid grid-cols-12 gap-0 px-4 py-3 items-center border-t border-gray-100/80
                                       transition-colors duration-150
                                       ${
                                         isLong
                                           ? "bg-red-50/30"
                                           : rIndex % 2 === 0
                                             ? "bg-white"
                                             : "bg-gray-50/40"
                                       }
                                       hover:bg-indigo-50/30`}
                          >
                            {/* Row Number */}
                            <div className="col-span-1 flex justify-center">
                              <span
                                className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-bold
                                            ${
                                              isLong
                                                ? "bg-red-100 text-red-600"
                                                : isMedium
                                                  ? "bg-amber-100 text-amber-600"
                                                  : "bg-gray-100 text-gray-500"
                                            }`}
                              >
                                {item.Sr_No}
                              </span>
                            </div>

                            {/* Date */}
                            <div className="col-span-2 flex justify-center">
                              <span className="inline-flex items-center gap-1 text-[11px] text-gray-600 font-medium bg-gray-50 px-2 py-0.5 rounded-md">
                                <FiCalendar
                                  size={9}
                                  className="text-gray-400"
                                />
                                {item.Date.split("T")[0]}
                              </span>
                            </div>

                            {/* Stop Time */}
                            <div className="col-span-3 flex justify-center">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-red-50 text-red-600 border border-red-200">
                                <FiStopCircle size={10} />
                                {item.Stop_Time}
                              </span>
                            </div>

                            {/* Start Time */}
                            <div className="col-span-3 flex justify-center">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200">
                                <FiPlay size={10} />
                                {item.Start_Time}
                              </span>
                            </div>

                            {/* Duration */}
                            <div className="col-span-3 flex justify-center items-center gap-2">
                              <DurationBadge
                                duration={item.Duration}
                                seconds={seconds}
                              />
                              {isLong && (
                                <span className="text-[8px] font-bold uppercase text-red-500 animate-pulse">
                                  ⚠ Long
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* Station subtotal */}
                      <div className="grid grid-cols-12 gap-0 px-4 py-2.5 items-center bg-gray-100/80 border-t border-gray-200">
                        <div className="col-span-1" />
                        <div className="col-span-2" />
                        <div className="col-span-3 flex justify-center">
                          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                            Subtotal
                          </span>
                        </div>
                        <div className="col-span-3 flex justify-center">
                          <span className="text-[10px] font-bold text-gray-500">
                            {stopCount} {stopCount === 1 ? "stop" : "stops"}
                          </span>
                        </div>
                        <div className="col-span-3 flex justify-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded-full bg-gray-200 text-gray-700">
                            <FiClock size={9} />
                            {formatSeconds(group.totalSeconds)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-10">
              <EmptyState message="No detail data found for the selected filters." />
            </div>
          )}
        </div>

        {/* ── STICKY GRAND TOTAL FOOTER ── */}
        {data.length > 0 && (
          <div
            className="sticky bottom-0 z-20 bg-gradient-to-r from-gray-800 to-gray-900 text-white px-4 py-3.5
                       flex items-center justify-between rounded-b-xl"
            style={{
              boxShadow: "0 -4px 12px rgba(0,0,0,0.12)",
            }}
          >
            {/* Left: Total Info */}
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
                <FiList size={13} />
              </span>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-white/50">
                  Grand Total
                </p>
                <p className="text-xs font-bold text-white/90">
                  {groupedData.length} Stations · {data.length} Records
                </p>
              </div>
            </div>

            {/* Center: Long Stops */}
            <div className="flex items-center gap-3">
              {totalLongStops > 0 && (
                <span className="inline-flex items-center gap-1 px-3 py-1 text-[10px] font-bold rounded-full bg-red-500/25 text-red-200 border border-red-400/30">
                  <FiStopCircle size={10} />
                  {totalLongStops} Long Stops (&gt;10 min)
                </span>
              )}
            </div>

            {/* Right: Total Duration */}
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold uppercase tracking-widest text-white/50">
                Total Duration
              </span>
              <span className="inline-flex items-center gap-1 px-3.5 py-1.5 text-xs font-bold rounded-full bg-white/15 backdrop-blur-sm border border-white/10">
                <FiClock size={11} />
                {formatSeconds(totalDetailSeconds)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Placeholder ────────────────────────────────────────────────
function QueryPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
      <div className="w-20 h-20 rounded-full bg-indigo-50 flex items-center justify-center mb-4 animate-pulse">
        <FiActivity size={36} className="text-indigo-300" />
      </div>
      <p className="text-lg font-bold text-gray-500">Stop & Loss Report</p>
      <p className="text-sm mt-1.5 text-gray-400 text-center">
        Select date range and location, then click{" "}
        <span className="font-semibold text-indigo-500">Query</span> to view the
        report.
      </p>
    </div>
  );
}

function StopLossReport() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [location, setLocation] = useState("");
  const [locations, setLocations] = useState([]);

  const [activeTab, setActiveTab] = useState(INNER_TABS[0].key);
  const [queried, setQueried] = useState(false);

  const [tabCache, setTabCache] = useState({
    summary: { data: [], loading: false, fetched: false },
    detail: { data: [], loading: false, fetched: false },
  });

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const res = await axios.get(`${baseURL}prod/stop-loss/locations`);
        setLocations(res?.data?.data || []);
      } catch (error) {
        console.error("Failed to fetch locations:", error);
      }
    };
    fetchLocations();
  }, []);

  const fetchTabData = useCallback(
    async (tabKey) => {
      const endpoint =
        tabKey === "summary"
          ? "prod/stop-loss/summary"
          : "prod/stop-loss/detail";

      setTabCache((prev) => ({
        ...prev,
        [tabKey]: { ...prev[tabKey], loading: true },
      }));

      try {
        const res = await axios.get(`${baseURL}${endpoint}`, {
          params: { fromDate, toDate, location },
        });

        const data = res?.data?.data || [];

        setTabCache((prev) => ({
          ...prev,
          [tabKey]: { data, loading: false, fetched: true },
        }));
      } catch (error) {
        console.error(`Failed to fetch ${tabKey}:`, error);
        toast.error(`Failed to fetch ${tabKey} data.`);

        setTabCache((prev) => ({
          ...prev,
          [tabKey]: { ...prev[tabKey], loading: false },
        }));
      }
    },
    [fromDate, toDate, location],
  );

  const handleQuery = async () => {
    if (!fromDate || !toDate) {
      toast.error("Please select From Date and To Date.");
      return;
    }
    if (!location) {
      toast.error("Please select a Location.");
      return;
    }

    setTabCache({
      summary: { data: [], loading: false, fetched: false },
      detail: { data: [], loading: false, fetched: false },
    });

    setQueried(true);
    await fetchTabData(activeTab);
  };

  const handleTabSwitch = useCallback(
    (tabKey) => {
      setActiveTab(tabKey);
      if (queried && !tabCache[tabKey].fetched && !tabCache[tabKey].loading) {
        fetchTabData(tabKey);
      }
    },
    [queried, tabCache, fetchTabData],
  );

  const handleReset = () => {
    setFromDate("");
    setToDate("");
    setLocation("");
    setQueried(false);
    setActiveTab(INNER_TABS[0].key);
    setTabCache({
      summary: { data: [], loading: false, fetched: false },
      detail: { data: [], loading: false, fetched: false },
    });
  };

  const currentCache = tabCache[activeTab];
  const currentTab = INNER_TABS.find((t) => t.key === activeTab);

  return (
    <div className="p-6 bg-gray-100 min-h-screen rounded-lg">
      <Title title="Stop Loss Report" align="center" />

      {/* ─── Filters ───────────────────────────────────────── */}
      <div className="w-full rounded-2xl bg-white px-6 py-5 shadow-sm border border-gray-100 mt-5">
        <div className="flex flex-wrap items-end gap-4">
          {/* From Date */}
          <div className="min-w-[200px]">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              From Date & Time
            </label>
            <div className="relative">
              <input
                type="datetime-local"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm
                           focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100
                           focus:bg-white outline-none transition-all duration-200"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
          </div>

          {/* To Date */}
          <div className="min-w-[200px]">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              To Date & Time
            </label>
            <div className="relative">
              <input
                type="datetime-local"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm
                           focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100
                           focus:bg-white outline-none transition-all duration-200"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
          </div>

          {/* Location */}
          <div className="min-w-[220px]">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Location
            </label>
            <div className="relative">
              <select
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm
                           appearance-none cursor-pointer
                           focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100
                           focus:bg-white outline-none transition-all duration-200"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              >
                <option value="">Select Location</option>
                {locations.map((loc, i) => (
                  <option key={i} value={loc.Location}>
                    {loc.Location}
                  </option>
                ))}
              </select>
              <FiMapPin
                size={14}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleQuery}
              disabled={currentCache.loading}
              className={`flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold
                         text-white shadow-sm transition-all duration-200 cursor-pointer
                         ${
                           currentCache.loading
                             ? "bg-gray-400 cursor-not-allowed shadow-none"
                             : "bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 hover:shadow-md hover:shadow-indigo-200 active:scale-[0.97]"
                         }`}
            >
              {currentCache.loading ? (
                <>
                  <AiOutlineLoading3Quarters
                    size={14}
                    className="animate-spin"
                  />
                  Searching…
                </>
              ) : (
                <>
                  <FiSearch size={14} />
                  Query
                </>
              )}
            </button>

            {queried && (
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white
                           px-4 py-2.5 text-sm font-medium text-gray-600
                           hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800
                           transition-all duration-200 active:scale-[0.97] cursor-pointer"
              >
                <FiRotateCcw size={13} />
                Reset
              </button>
            )}
          </div>

          {/* Filter Info Badge */}
          {queried && location && (
            <div
              className="ml-auto flex items-center gap-3 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50
                            border border-indigo-200/60 px-4 py-2.5 shadow-sm"
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                <FiMapPin size={15} className="text-indigo-600" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-indigo-400 tracking-widest leading-none">
                  Location
                </p>
                <p className="text-sm font-bold text-indigo-700 mt-0.5">
                  {location}
                </p>
              </div>
              <div className="w-px h-8 bg-indigo-200/60" />
              <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                <FiCalendar size={15} className="text-indigo-600" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-indigo-400 tracking-widest leading-none">
                  Period
                </p>
                <p className="text-[11px] font-semibold text-indigo-700 mt-0.5">
                  {fromDate?.replace("T", " ")} → {toDate?.replace("T", " ")}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Tabs + Report ─────────────────────────────────── */}
      <div className="w-full rounded-2xl bg-white shadow-sm border border-gray-100 mt-5 p-4">
        {/* Tab Bar */}
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/60 px-4 rounded-t-xl">
          <div className="flex gap-1 pt-2">
            {INNER_TABS.map((tab) => {
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.key;
              const cache = tabCache[tab.key];
              const count = cache.fetched ? cache.data.length : null;
              const isLoading = cache.loading;

              return (
                <button
                  key={tab.key}
                  onClick={() => handleTabSwitch(tab.key)}
                  className={`relative flex items-center gap-2 px-5 py-3 text-sm font-medium
                             whitespace-nowrap rounded-t-xl transition-all duration-200 cursor-pointer
                    ${
                      isActive
                        ? `${tab.activeBg} ${tab.activeText} border-t-2 border-x ${tab.activeBorder} border-x-gray-100 -mb-[1px] shadow-sm`
                        : "text-gray-500 hover:text-gray-700 hover:bg-gray-100/70"
                    }`}
                >
                  <span
                    className={`transition-colors ${isActive ? tab.iconActive : "text-gray-400"}`}
                  >
                    {isLoading ? (
                      <AiOutlineLoading3Quarters
                        size={15}
                        className="animate-spin"
                      />
                    ) : (
                      <TabIcon size={16} />
                    )}
                  </span>
                  {tab.label}
                  {count != null && (
                    <span
                      className={`ml-1 inline-flex items-center justify-center min-w-[22px] h-5 px-1.5
                                      rounded-full text-[10px] font-bold transition-colors
                                      ${isActive ? `${tab.activeBg} ${tab.activeText}` : "bg-gray-200 text-gray-500"}`}
                    >
                      {count}
                    </span>
                  )}
                  {cache.fetched && !isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 ml-1" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Export */}
          {queried && currentCache.fetched && currentCache.data.length > 0 && (
            <ExportButton
              data={currentCache.data}
              filename={`Stop_Loss_${activeTab === "summary" ? "Summary" : "Detail"}_Report`}
            />
          )}
        </div>

        {/* Content Area */}
        <div className="p-5">
          {!queried ? (
            <QueryPlaceholder />
          ) : currentCache.loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader />
              <p className="mt-4 text-sm text-gray-400 animate-pulse flex items-center gap-2">
                <AiOutlineLoading3Quarters size={13} className="animate-spin" />
                Fetching {currentTab.label}…
              </p>
            </div>
          ) : currentCache.fetched ? (
            <div className="animate-fadeIn">
              {activeTab === "summary" ? (
                <SummaryTable data={currentCache.data} tabConfig={currentTab} />
              ) : (
                <DetailTable data={currentCache.data} tabConfig={currentTab} />
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <AiOutlineLoading3Quarters
                size={24}
                className="animate-spin mb-3"
              />
              <p className="text-sm">Loading {currentTab.label}…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default StopLossReport;
