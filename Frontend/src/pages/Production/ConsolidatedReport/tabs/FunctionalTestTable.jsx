import { useState } from "react";
import EmptyState from "../../../../components/ui/EmptyState";
import { FiCheckCircle, FiXCircle, FiClock } from "react-icons/fi";
import { BsLightningCharge } from "react-icons/bs";
import { TbGasStation, TbReportAnalytics } from "react-icons/tb";
import { MdOutlineMultilineChart } from "react-icons/md";

// ─── Inner Tab Config ───────────────────────────────────────────
const INNER_TABS = [
  {
    key: "gasCharging",
    label: "Gas Charging",
    icon: TbGasStation,
    activeBg: "bg-teal-50",
    activeBorder: "border-teal-500",
    activeText: "text-teal-700",
    iconActive: "text-teal-600",
    headerGradient: "from-teal-600 to-emerald-600",
    lightBg: "bg-teal-50/50",
  },
  {
    key: "est",
    label: "EST",
    fullLabel: "Electrical Safety Test",
    icon: BsLightningCharge,
    activeBg: "bg-amber-50",
    activeBorder: "border-amber-500",
    activeText: "text-amber-700",
    iconActive: "text-amber-600",
    headerGradient: "from-amber-500 to-orange-600",
    lightBg: "bg-amber-50/50",
  },
  {
    key: "mft",
    label: "MFT",
    fullLabel: "Multi-Function Test",
    icon: MdOutlineMultilineChart,
    activeBg: "bg-indigo-50",
    activeBorder: "border-indigo-500",
    activeText: "text-indigo-700",
    iconActive: "text-indigo-600",
    headerGradient: "from-indigo-500 to-purple-600",
    lightBg: "bg-indigo-50/50",
  },
  {
    key: "cpt",
    label: "CPT",
    fullLabel: "Compressor Performance Test",
    icon: TbReportAnalytics,
    activeBg: "bg-rose-50",
    activeBorder: "border-rose-500",
    activeText: "text-rose-700",
    iconActive: "text-rose-600",
    headerGradient: "from-rose-500 to-pink-600",
    lightBg: "bg-rose-50/50",
  },
];

// ─── Status Badge ───────────────────────────────────────────────
function StatusBadge({ status }) {
  const normalized = (status || "").toUpperCase();
  const config = {
    PASS: {
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      border: "border-emerald-200",
      icon: <FiCheckCircle size={11} />,
    },
    OK: {
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      border: "border-emerald-200",
      icon: <FiCheckCircle size={11} />,
    },
    FAIL: {
      bg: "bg-red-50",
      text: "text-red-700",
      border: "border-red-200",
      icon: <FiXCircle size={11} />,
    },
    NG: {
      bg: "bg-red-50",
      text: "text-red-700",
      border: "border-red-200",
      icon: <FiXCircle size={11} />,
    },
    PENDING: {
      bg: "bg-amber-50",
      text: "text-amber-700",
      border: "border-amber-200",
      icon: <FiClock size={11} />,
    },
  };
  const s = config[normalized] || {
    bg: "bg-gray-50",
    text: "text-gray-600",
    border: "border-gray-200",
    icon: null,
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold rounded-full border ${s.bg} ${s.text} ${s.border}`}
    >
      {s.icon}
      {status}
    </span>
  );
}

// ─── Gas Charging Table ─────────────────────────────────────────
function GasChargingTable({ data, tabConfig }) {
  const headers = [
    "Sr No",
    "Result ID",
    "Date",
    "Time",
    "Barcode",
    "Model Name",
    "Model",
    "Runtime",
    "Refrigerant",
    "Set Gas Weight",
    "Actual Gas Weight",
    "Leak Set Value",
    "Leak Test Value",
    "Leak Test Time",
    "Set Evacuation Value",
    "Actual Evacuation Value",
    "Actual Evacuation Time",
    "Performance",
    "Fault Code",
    "Fault Name",
    "Sync Status",
    "Machine",
  ];

  const getResult = (item) =>
    item.PERFORMANCE ?? item.RESULT ?? item.STATUS ?? "";

  return (
    <div className="overflow-x-auto overflow-y-auto max-h-[450px]">
      <table
        className="w-full text-sm border-collapse"
        style={{ minWidth: "1400px" }}
      >
        <thead>
          <tr
            className={`bg-gradient-to-r ${tabConfig.headerGradient} text-white`}
          >
            {headers.map((h, i) => (
              <th
                key={i}
                className="px-3 py-3 text-[10px] font-semibold uppercase tracking-wider text-center border-r border-white/10 last:border-r-0"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="divide-y divide-gray-100">
          {data.length > 0 ? (
            data.map((item, index) => {
              const result = getResult(item);
              const isFail = ["FAIL", "NG"].includes(result?.toUpperCase());

              const rowBg = isFail
                ? "bg-red-50/50"
                : index % 2 === 0
                  ? "bg-white"
                  : tabConfig.lightBg;

              return (
                <tr
                  key={index}
                  className={`text-center transition-colors duration-150 ${rowBg} hover:bg-indigo-50/40`}
                >
                  <td className="px-3 py-3 font-semibold text-gray-600">
                    {index + 1}
                  </td>
                  <td className="px-3 py-3 font-mono">
                    {item.Result_ID || "—"}
                  </td>
                  <td className="px-3 py-3">{item.DATE || "—"}</td>
                  <td className="px-3 py-3 font-mono text-xs">
                    {item.TIME || "—"}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs">
                    {item.BARCODE || "—"}
                  </td>
                  <td className="px-3 py-3 text-left">
                    {item.MODELNAME || "—"}
                  </td>
                  <td className="px-3 py-3">{item.MODEL || "—"}</td>
                  <td className="px-3 py-3 font-mono">
                    {item.RUNTIME_SECONDS?.trim() || "—"}
                  </td>
                  <td className="px-3 py-3 uppercase">
                    {item.REFRIGERANT || "—"}
                  </td>
                  <td className="px-3 py-3 font-mono">
                    {item.SET_GAS_WEIGHT?.trim() || "—"}
                  </td>
                  <td className="px-3 py-3 font-mono">
                    {item.ACTUAL_GAS_WEIGHT?.trim() || "—"}
                  </td>
                  <td className="px-3 py-3 font-mono">
                    {item.LEAK_SET_VALUE?.trim() || "—"}
                  </td>
                  <td className="px-3 py-3 font-mono">
                    {item.LEAK_TEST_VALUE?.trim() || "—"}
                  </td>
                  <td className="px-3 py-3 font-mono">
                    {item.LEAK_TEST_TIME?.trim() || "—"}
                  </td>
                  <td className="px-3 py-3 font-mono">
                    {item.SET_EVACUATION_VALUE?.trim() || "—"}
                  </td>
                  <td className="px-3 py-3 font-mono">
                    {item.ACTUAL_EVACUATION_VALUE?.trim() || "—"}
                  </td>
                  <td className="px-3 py-3 font-mono">
                    {item.ACTUAL_EVACUATION_TIME?.trim() || "—"}
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge status={result} />
                  </td>
                  <td className="px-3 py-3">{item.FaultCode || "—"}</td>
                  <td className="px-3 py-3">{item.FaultName || "—"}</td>
                  <td className="px-3 py-3">{item.SyncStatus || "—"}</td>
                  <td className="px-3 py-3">{item.MACHINE || "—"}</td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={headers.length}>
                <EmptyState message="No Gas Charging data found." />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── EST Table ──────────────────────────────────────────────────
function ESTTable({ data = [], tabConfig }) {
  const headerGroups = [
    { label: "Sr No", colSpan: 1, children: ["Sr No"] },
    { label: "Ref No", colSpan: 1, children: ["Ref No"] },
    { label: "Model No", colSpan: 1, children: ["Model No"] },
    { label: "Serial No", colSpan: 1, children: ["Serial No"] },
    { label: "Date Time", colSpan: 1, children: ["Date Time"] },
    { label: "Operator", colSpan: 1, children: ["Operator"] },
    {
      label: "ECT",
      colSpan: 4,
      children: ["Set Ohms", "Set Time", "Read Ohms", "Result"],
    },
    {
      label: "HV",
      colSpan: 4,
      children: ["Set KV", "Set MA", "Set Time", "Read KV", "Result"],
    },
    {
      label: "IR",
      colSpan: 4,
      children: ["Set Mohms", "Set Time", "Read Mohms", "Result"],
    },
    {
      label: "LCT LN",
      colSpan: 5,
      children: ["Set MA", "Set Time", "Read MA", "Read Vtg", "Result"],
    },
    {
      label: "LCT NL",
      colSpan: 3,
      children: ["Read MA", "Read Vtg", "Result"],
    },
    { label: "Final Result", colSpan: 1, children: ["Final Result"] },
    { label: "Status", colSpan: 1, children: ["Status"] },
  ];

  const formatDateTime = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleString();
  };

  const getFinalResult = (item) => item?.result ?? "";
  const isSingleColumn = (group) => group.colSpan === 1;

  return (
    <div className="overflow-x-auto overflow-y-auto max-h-[450px]">
      <table
        className="w-full text-sm border-collapse"
        style={{ minWidth: "2200px" }}
      >
        <thead>
          <tr
            className={`bg-gradient-to-r ${tabConfig?.headerGradient} text-white`}
          >
            {headerGroups.map((group, i) => (
              <th
                key={i}
                colSpan={group.children.length}
                rowSpan={isSingleColumn(group) ? 2 : 1}
                className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-center 
                  border border-white/20
                  ${!isSingleColumn(group) ? "border-b-2 border-b-white/40" : ""}
                `}
              >
                {group.label}
              </th>
            ))}
          </tr>
          <tr
            className={`bg-gradient-to-r ${tabConfig?.headerGradient} text-white/90`}
          >
            {headerGroups
              .filter((group) => !isSingleColumn(group))
              .flatMap((group, gi) =>
                group.children.map((child, ci) => (
                  <th
                    key={`${gi}-${ci}`}
                    className="px-2 py-2 text-[9px] font-semibold uppercase tracking-wider text-center 
                      border border-white/10"
                  >
                    {child}
                  </th>
                )),
              )}
          </tr>
        </thead>

        <tbody className="divide-y divide-gray-100">
          {data.length > 0 ? (
            data.map((item, index) => {
              const finalResult = getFinalResult(item);
              const isFail =
                finalResult && finalResult.toUpperCase() !== "PASS";

              const rowBg = isFail
                ? "bg-red-50/50"
                : index % 2 === 0
                  ? "bg-white"
                  : tabConfig?.lightBg;

              return (
                <tr
                  key={index}
                  className={`text-center transition-colors duration-150 ${rowBg} hover:bg-indigo-50/40`}
                >
                  <td className="px-3 py-3 font-semibold text-gray-600 border border-gray-100">
                    {index + 1}
                  </td>
                  <td className="px-3 py-3 font-mono border border-gray-100">
                    {item.RefNo ?? "—"}
                  </td>
                  <td className="px-3 py-3 text-left border border-gray-100">
                    {item.model_no ?? "—"}
                  </td>
                  <td className="px-3 py-3 font-mono border border-gray-100">
                    {item.serial_no ?? "—"}
                  </td>
                  <td className="px-3 py-3 text-xs border border-gray-100">
                    {formatDateTime(item.date_time)}
                  </td>
                  <td className="px-3 py-3 border border-gray-100">
                    {item.operator ?? "—"}
                  </td>
                  <td className="px-3 py-3 border border-gray-100">
                    {item.set_ect_ohms ?? "—"}
                  </td>
                  <td className="px-3 py-3 border border-gray-100">
                    {item.set_ect_time ?? "—"}
                  </td>
                  <td className="px-3 py-3 border border-gray-100">
                    {item.read_ect_ohms ?? "—"}
                  </td>
                  <td className="px-3 py-3 border border-gray-100">
                    <StatusBadge status={item.ect_result} />
                  </td>
                  <td className="px-3 py-3 border border-gray-100">
                    {item.set_hv_kv ?? "—"}
                  </td>
                  <td className="px-3 py-3 border border-gray-100">
                    {item.set_hv_ma ?? "—"}
                  </td>
                  <td className="px-3 py-3 border border-gray-100">
                    {item.set_hv_time ?? "—"}
                  </td>
                  <td className="px-3 py-3 border border-gray-100">
                    {item.read_hv_kv ?? "—"}
                  </td>
                  <td className="px-3 py-3 border border-gray-100">
                    <StatusBadge status={item.hv_result} />
                  </td>
                  <td className="px-3 py-3 border border-gray-100">
                    {item.set_ir_mohms ?? "—"}
                  </td>
                  <td className="px-3 py-3 border border-gray-100">
                    {item.set_ir_time ?? "—"}
                  </td>
                  <td className="px-3 py-3 border border-gray-100">
                    {item.read_ir_mohms ?? "—"}
                  </td>
                  <td className="px-3 py-3 border border-gray-100">
                    <StatusBadge status={item.ir_result} />
                  </td>
                  <td className="px-3 py-3 border border-gray-100">
                    {item.set_lct_ma ?? "—"}
                  </td>
                  <td className="px-3 py-3 border border-gray-100">
                    {item.set_lct_time ?? "—"}
                  </td>
                  <td className="px-3 py-3 border border-gray-100">
                    {item.read_lct_ln_ma ?? "—"}
                  </td>
                  <td className="px-3 py-3 border border-gray-100">
                    {item.read_lct_ln_Vtg ?? "—"}
                  </td>
                  <td className="px-3 py-3 border border-gray-100">
                    <StatusBadge status={item.lct_ln_result} />
                  </td>
                  <td className="px-3 py-3 border border-gray-100">
                    {item.read_lct_nl_ma ?? "—"}
                  </td>
                  <td className="px-3 py-3 border border-gray-100">
                    {item.read_lct_nl_Vtg ?? "—"}
                  </td>
                  <td className="px-3 py-3 border border-gray-100">
                    <StatusBadge status={item.lct_nl_result} />
                  </td>
                  <td className="px-3 py-3 border border-gray-100">
                    <StatusBadge status={item.result} />
                  </td>
                  <td className="px-3 py-3 border border-gray-100">
                    <StatusBadge
                      status={item.status === 1 ? "Active" : "Inactive"}
                    />
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td
                colSpan={headerGroups.reduce(
                  (sum, g) => sum + g.children.length,
                  0,
                )}
                className="py-10"
              >
                <EmptyState message="No EST data found." />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── MFT Table ──────────────────────────────────────────────────
function MFTTable({ data, tabConfig }) {
  const headers = [
    "Sr No",
    "ID",
    "Product Code",
    "Equipment No",
    "Pass/Fail Time",
    "MFT No",
    "Status",
    "Error Code",
    "Start Time",
    "Stop Time",
    "Reason",
    "PDF File Name",
    "Sync Status",
  ];

  const getResult = (item) => item.STATUS ?? "";

  return (
    <div className="overflow-x-auto overflow-y-auto max-h-[450px]">
      <table
        className="w-full text-sm border-collapse"
        style={{ minWidth: "1200px" }}
      >
        <thead>
          <tr
            className={`bg-gradient-to-r ${tabConfig.headerGradient} text-white`}
          >
            {headers.map((h, i) => (
              <th
                key={i}
                className="px-3 py-3 text-[10px] font-semibold uppercase tracking-wider text-center border-r border-white/10 last:border-r-0"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="divide-y divide-gray-100">
          {data.length > 0 ? (
            data.map((item, index) => {
              const result = getResult(item);
              const isFail = !["PASS", "PASSED"].includes(
                result?.toUpperCase(),
              );

              const rowBg = isFail
                ? "bg-red-50/50"
                : index % 2 === 0
                  ? "bg-white"
                  : tabConfig.lightBg;

              return (
                <tr
                  key={index}
                  className={`text-center transition-colors duration-150 ${rowBg} hover:bg-indigo-50/40`}
                >
                  <td className="px-3 py-3 font-semibold text-gray-600">
                    {index + 1}
                  </td>
                  <td className="px-3 py-3 font-mono">{item.ID || "—"}</td>
                  <td className="px-3 py-3">{item.PRODUCT_CODE || "—"}</td>
                  <td className="px-3 py-3 font-mono text-xs">
                    {item.EQUIPMENT_NO || "—"}
                  </td>
                  <td className="px-3 py-3">{item.PASS_FAILED_TIMES || "—"}</td>
                  <td className="px-3 py-3 font-mono">{item.MFT_NO || "—"}</td>
                  <td className="px-3 py-3">
                    <StatusBadge status={item.STATUS} />
                  </td>
                  <td className="px-3 py-3">{item.ERRORCODE || "—"}</td>
                  <td className="px-3 py-3 text-xs">
                    {item.START_TIME || "—"}
                  </td>
                  <td className="px-3 py-3 text-xs">{item.STOP_TIME || "—"}</td>
                  <td className="px-3 py-3 text-left">{item.REASON || "—"}</td>
                  <td className="px-3 py-3">{item.PDFFileName || "—"}</td>
                  <td className="px-3 py-3">
                    {item.SYNCSTATUS === 1 ? "Synced" : "Pending"}
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={headers.length}>
                <EmptyState message="No MFT data found." />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── CPT Table ──────────────────────────────────────────────────
function CPTTable({ data = [], tabConfig }) {
  const headerGroups = [
    { label: "Sr No", colSpan: 1, children: ["Sr No"] },
    { label: "Result ID", colSpan: 1, children: ["Result ID"] },
    { label: "Date", colSpan: 1, children: ["Date"] },
    { label: "Time", colSpan: 1, children: ["Time"] },
    { label: "Barcode", colSpan: 1, children: ["Barcode"] },
    { label: "Model", colSpan: 1, children: ["Model"] },
    { label: "Model Name", colSpan: 1, children: ["Model Name"] },
    { label: "Runtime (Min)", colSpan: 1, children: ["Runtime (Min)"] },
    {
      label: "Temperature",
      colSpan: 2,
      children: ["Min", "Max"],
    },
    {
      label: "Current (A)",
      colSpan: 2,
      children: ["Min", "Max"],
    },
    {
      label: "Voltage (V)",
      colSpan: 2,
      children: ["Min", "Max"],
    },
    {
      label: "Power (W)",
      colSpan: 2,
      children: ["Min", "Max"],
    },
    { label: "Performance", colSpan: 1, children: ["Performance"] },
    { label: "Fault Code", colSpan: 1, children: ["Fault Code"] },
    { label: "Fault Name", colSpan: 1, children: ["Fault Name"] },
    { label: "Area ID", colSpan: 1, children: ["Area ID"] },
  ];

  const isSingleColumn = (group) => group.colSpan === 1;

  const getResult = (item) => item.PERFORMANCE ?? "";

  // Format long decimal numbers to 4 decimal places
  const formatNum = (val) => {
    if (val === null || val === undefined) return "—";
    const num = Number(val);
    if (isNaN(num)) return val;
    return num % 1 === 0 ? num.toString() : num.toFixed(4);
  };

  return (
    <div className="overflow-x-auto overflow-y-auto max-h-[450px]">
      <table
        className="w-full text-sm border-collapse"
        style={{ minWidth: "1800px" }}
      >
        {/* ── HEADER ── */}
        <thead>
          {/* ROW 1: Parent group headers */}
          <tr
            className={`bg-gradient-to-r ${tabConfig?.headerGradient} text-white`}
          >
            {headerGroups.map((group, i) => (
              <th
                key={i}
                colSpan={group.children.length}
                rowSpan={isSingleColumn(group) ? 2 : 1}
                className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-center 
                  border border-white/20
                  ${!isSingleColumn(group) ? "border-b-2 border-b-white/40" : ""}
                `}
              >
                {group.label}
              </th>
            ))}
          </tr>

          {/* ROW 2: Child sub-headers (only for multi-column groups) */}
          <tr
            className={`bg-gradient-to-r ${tabConfig?.headerGradient} text-white/90`}
          >
            {headerGroups
              .filter((group) => !isSingleColumn(group))
              .flatMap((group, gi) =>
                group.children.map((child, ci) => (
                  <th
                    key={`${gi}-${ci}`}
                    className="px-2 py-2 text-[9px] font-semibold uppercase tracking-wider text-center 
                      border border-white/10"
                  >
                    {child}
                  </th>
                )),
              )}
          </tr>
        </thead>

        {/* ── BODY ── */}
        <tbody className="divide-y divide-gray-100">
          {data.length > 0 ? (
            data.map((item, index) => {
              const result = getResult(item);
              const isFail = ["FAIL", "NG"].includes(result?.toUpperCase());

              const rowBg = isFail
                ? "bg-red-50/50"
                : index % 2 === 0
                  ? "bg-white"
                  : tabConfig?.lightBg;

              return (
                <tr
                  key={index}
                  className={`text-center transition-colors duration-150 ${rowBg} hover:bg-rose-50/40`}
                >
                  {/* Sr No */}
                  <td className="px-3 py-3 font-semibold text-gray-600 border border-gray-100">
                    {index + 1}
                  </td>

                  {/* Result ID */}
                  <td className="px-3 py-3 font-mono border border-gray-100">
                    {item.Result_ID ?? "—"}
                  </td>

                  {/* Date */}
                  <td className="px-3 py-3 border border-gray-100">
                    {item.DATE ?? "—"}
                  </td>

                  {/* Time */}
                  <td className="px-3 py-3 font-mono text-xs border border-gray-100">
                    {item.TIME ?? "—"}
                  </td>

                  {/* Barcode */}
                  <td className="px-3 py-3 font-mono text-xs border border-gray-100">
                    {item.BARCODE ?? "—"}
                  </td>

                  {/* Model */}
                  <td className="px-3 py-3 border border-gray-100">
                    {item.MODEL ?? "—"}
                  </td>

                  {/* Model Name */}
                  <td className="px-3 py-3 text-left border border-gray-100">
                    {item.MODELNAME ?? "—"}
                  </td>

                  {/* Runtime Minutes */}
                  <td className="px-3 py-3 font-mono font-semibold border border-gray-100">
                    {item.RUNTIME_MINUTES ?? "—"}
                  </td>

                  {/* Temperature — Min, Max */}
                  <td className="px-3 py-3 font-mono text-xs border border-gray-100">
                    {formatNum(item.MIN_TEMPERATURE)}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs border border-gray-100">
                    {formatNum(item.MAX_TEMPERATURE)}
                  </td>

                  {/* Current — Min, Max */}
                  <td className="px-3 py-3 font-mono text-xs border border-gray-100">
                    {formatNum(item.MIN_CURRENT)}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs border border-gray-100">
                    {formatNum(item.MAX_CURRENT)}
                  </td>

                  {/* Voltage — Min, Max */}
                  <td className="px-3 py-3 font-mono text-xs border border-gray-100">
                    {formatNum(item.MIN_VOLTAGE)}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs border border-gray-100">
                    {formatNum(item.MAX_VOLTAGE)}
                  </td>

                  {/* Power — Min, Max */}
                  <td className="px-3 py-3 font-mono text-xs border border-gray-100">
                    {formatNum(item.MIN_POWER)}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs border border-gray-100">
                    {formatNum(item.MAX_POWER)}
                  </td>

                  {/* Performance */}
                  <td className="px-3 py-3 border border-gray-100">
                    <StatusBadge status={result} />
                  </td>

                  {/* Fault Code */}
                  <td className="px-3 py-3 font-mono border border-gray-100">
                    {item.FaultCode ?? "—"}
                  </td>

                  {/* Fault Name */}
                  <td className="px-3 py-3 text-left text-xs border border-gray-100">
                    {item.FaultName ?? "—"}
                  </td>

                  {/* Area ID */}
                  <td className="px-3 py-3 font-mono border border-gray-100">
                    {item.AREA_ID ?? "—"}
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td
                colSpan={headerGroups.reduce(
                  (sum, g) => sum + g.children.length,
                  0,
                )}
                className="py-10"
              >
                <EmptyState message="No CPT data found." />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Inner Tab Table Map ────────────────────────────────────────
const INNER_TABLE_MAP = {
  gasCharging: GasChargingTable,
  est: ESTTable,
  mft: MFTTable,
  cpt: CPTTable,
};

// ─── Main Component ─────────────────────────────────────────────
function FunctionalTestTable({ data }) {
  // data = { gasCharging: [...], est: [...], mft: [...], cpt: [...] }
  const gasData = data?.gasCharging || [];
  const estData = data?.est || [];
  const mftData = data?.mft || [];
  const cptData = data?.cpt || [];

  const dataMap = {
    gasCharging: gasData,
    est: estData,
    mft: mftData,
    cpt: cptData,
  };

  // Find first tab with data
  const firstWithData = INNER_TABS.find((t) => dataMap[t.key]?.length > 0);
  const [activeInnerTab, setActiveInnerTab] = useState(
    firstWithData?.key || INNER_TABS[0].key,
  );

  const activeTabConfig = INNER_TABS.find((t) => t.key === activeInnerTab);
  const activeData = dataMap[activeInnerTab] || [];
  const ActiveTable = INNER_TABLE_MAP[activeInnerTab];

  const totalRecords =
    gasData.length + estData.length + mftData.length + cptData.length;

  if (totalRecords === 0) {
    return (
      <EmptyState message="No functional test data found for this serial number." />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ─── Inner Tabs Card ─────────────────────────────────── */}
      <div className="w-full rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Tab Bar */}
        <div className="flex items-center bg-gray-50/80 border-b border-gray-200 px-2 pt-2">
          {INNER_TABS.map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeInnerTab === tab.key;
            const count = dataMap[tab.key]?.length || 0;
            const hasFail = dataMap[tab.key]?.some((d) =>
              ["FAIL", "NG"].includes(
                (
                  d.RESULT ??
                  d.Result ??
                  d.STATUS ??
                  d.Status ??
                  d.result ??
                  d.PERFORMANCE ??
                  ""
                ).toUpperCase(),
              ),
            );

            return (
              <button
                key={tab.key}
                onClick={() => setActiveInnerTab(tab.key)}
                className={`relative flex items-center gap-2 px-5 py-3 text-sm font-medium
                           whitespace-nowrap rounded-t-xl transition-all duration-200 cursor-pointer
                  ${
                    isActive
                      ? `${tab.activeBg} ${tab.activeText} border-t-2 border-x ${tab.activeBorder} border-x-gray-200 -mb-[1px] shadow-sm`
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-100/70"
                  }`}
              >
                <span
                  className={`transition-colors ${isActive ? tab.iconActive : "text-gray-400"}`}
                >
                  <TabIcon size={16} />
                </span>

                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.split(" ")[0]}</span>

                <span
                  className={`ml-1 inline-flex items-center justify-center min-w-[22px] h-5 px-1.5
                                  rounded-full text-[10px] font-bold transition-colors
                                  ${isActive ? `${tab.activeBg} ${tab.activeText}` : "bg-gray-200 text-gray-500"}`}
                >
                  {count}
                </span>

                {hasFail && !isActive && (
                  <span className="w-2 h-2 rounded-full bg-red-400 ml-1 animate-pulse" />
                )}
              </button>
            );
          })}
        </div>

        {/* Table Content */}
        <div className="animate-fadeIn">
          <ActiveTable data={activeData} tabConfig={activeTabConfig} />
        </div>
      </div>
    </div>
  );
}

export default FunctionalTestTable;
