import axios from "axios";
import { baseURL } from "../../../assets/assets";

/* ─────────────────────────────────────────────────────────────────────────
   BRAZING DASHBOARD — shared config
   The 3 lines are fixed here (NOT stored in the DashboardConfig table).
   Machines, operators, photos, cameras and counts all come from the backend.
───────────────────────────────────────────────────────────────────────── */

export const ENDPOINT = `${baseURL}dashboard/brazing-performance`;
export const REFRESH_MS = 15_000;

// Efficiency colour bands (%)
export const EFF_GOOD = 95;
export const EFF_WARN = 85;

// `key` is sent to the backend as ?line=<key> and used in the URL /display/brazing/<key>
export const BRAZING_LINES = [
  {
    key: "freezer",
    label: "Freezer",
    description: "Freezer brazing machines",
    accent: "#1d4ed8",
  },
  {
    key: "visi",
    label: "Visi Cooler",
    description: "Visi cooler brazing machines",
    accent: "#7c3aed",
  },
  {
    key: "sus",
    label: "SUS",
    description: "SUS brazing machines",
    accent: "#0f766e",
  },
];

// Brazing dashboards open on the existing /display/:slug route (slug = "brazing-<line key>"),
// so no extra route has to be registered. ProductionDashboard/index.jsx hands these slugs to BrazingDashboard.
export const BRAZING_SLUG_PREFIX = "brazing-";
export const brazingPath = (key) => `/display/${BRAZING_SLUG_PREFIX}${key}`;

/* ── helpers ── */
export const num = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export const fmt = (v) => {
  const n = num(v);
  return n === null ? "—" : n.toLocaleString();
};

const pad = (n) => String(n).padStart(2, "0");
const toISODate = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Shift A 08:00–20:00 (today) · Shift B 20:00–08:00 (dated by the evening it started)
export const detectCurrentShift = () => {
  const now = new Date();
  const hour = now.getHours();
  if (hour >= 8 && hour < 20) return { shift: "A", shiftDate: toISODate(now) };
  const d = new Date(now);
  if (hour < 8) d.setDate(d.getDate() - 1);
  return { shift: "B", shiftDate: toISODate(d) };
};

export const SHIFT_HOURS = { A: "08:00 to 20:00", B: "20:00 to 08:00" };

// Efficiency = Total OK / Total joints. Uses the backend value when it sends one.
export const effPct = (m) => {
  const given = num(m?.Efficiency);
  if (given !== null) return given;
  const joints = num(m?.TotalJoints);
  const ok = num(m?.TotalOk);
  return joints > 0 && ok !== null ? (ok / joints) * 100 : null;
};

export const effTone = (pct) =>
  pct === null
    ? { color: "#94a3b8", text: "No output yet" }
    : pct >= EFF_GOOD
      ? { color: "#16a34a", text: "On target" }
      : pct >= EFF_WARN
        ? { color: "#d97706", text: "Watch" }
        : { color: "#dc2626", text: "Below target" };

/* ── API ──────────────────────────────────────────────────────────────────
   GET dashboard/brazing-performance?line=freezer&shiftDate=2026-11-12&shift=A
   → { success, data: { machines: [{
         MachineName, CameraUrl, OperatorName, OperatorCode, OperatorPhoto,
         TotalJoints, TotalOk, TotalNotOk, Efficiency }] } }
   CameraUrl, OperatorPhoto and Efficiency are optional.
─────────────────────────────────────────────────────────────────────────── */
export const fetchBrazing = async (lineKey, { shiftDate, shift }) => {
  const res = await axios.get(ENDPOINT, {
    params: { line: lineKey, shiftDate, shift },
  });
  const body = res.data?.data ?? res.data;
  return Array.isArray(body?.machines) ? body.machines : [];
};
