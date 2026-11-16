import { createSlice } from "@reduxjs/toolkit";

// Master Config tables (materials, downtime reasons, departments, quality
// defects, shifts) are seeded from the database via useSyncMasterConfig on
// app load. These fallbacks only matter for edge cases (redux-persist
// rehydrating an older stored state, or before the initial sync completes).
const INIT_DEPARTMENTS = [];

// Shift names match FactoryOS API shift_name values (Shift 1, Shift 2, Shift 3)
export const INIT_SHIFTS = [];

const masterConfigSlice = createSlice({
  name: "masterConfig",
  initialState: {
    materials:        [],
    downtimeReasons:  [],
    departments:      INIT_DEPARTMENTS,
    qualityDefects:   [],
    machines:         [],
    plans:            [],
    checkpointLibrary: [],
    shifts:           INIT_SHIFTS,
    // Effective-dated snapshots of `shifts` — see selectShiftHistory /
    // resolveShiftAsOf in utils/productionLogic.js for how a historical date
    // resolves the shift config that actually applied on that date.
    shiftHistory:     [],
    // Which shift(s) each machine is currently assigned to, and the full
    // assign/unassign log — see resolveMachineShiftsAsOf in
    // utils/productionLogic.js.
    machineShiftAllocations: [],
    machineShiftAllocationHistory: [],
    // Logged entries captured from production reports
    downtimeEntries:  [],
    qualityEntries:   [],
    // Password required to open Log Quality modal (managed from Quality Config)
    qualityPassword:  "",
  },
  reducers: {
    // ── Materials ─────────────────────────────────────────────────────────────
    setMaterials:      (s, { payload }) => { s.materials = payload; },
    addMaterial:       (s, { payload }) => { s.materials.push(payload); },
    updateMaterial:    (s, { payload }) => { s.materials = s.materials.map((m) => m.id === payload.id ? payload : m); },
    deleteMaterial:    (s, { payload }) => { s.materials = s.materials.filter((m) => m.id !== payload); },
    bulkAddMaterials:  (s, { payload }) => {
      // Merge: update existing by sapCode, append new ones
      const existing = new Map(s.materials.map(m => [m.sapCode, m]));
      payload.forEach(m => existing.set(m.sapCode, { ...existing.get(m.sapCode), ...m }));
      s.materials = Array.from(existing.values());
    },

    // ── Downtime Reasons ──────────────────────────────────────────────────────
    setDowntimeReasons:   (s, { payload }) => { s.downtimeReasons = payload; },
    addDowntimeReason:    (s, { payload }) => { s.downtimeReasons.push(payload); },
    updateDowntimeReason: (s, { payload }) => { s.downtimeReasons = s.downtimeReasons.map((r) => r.id === payload.id ? payload : r); },
    deleteDowntimeReason: (s, { payload }) => { s.downtimeReasons = s.downtimeReasons.filter((r) => r.id !== payload); },

    // ── Departments ───────────────────────────────────────────────────────────
    setDepartments:    (s, { payload }) => { s.departments = payload; },
    addDepartment:     (s, { payload }) => { s.departments.push(payload); },
    updateDepartment:  (s, { payload }) => { s.departments = s.departments.map((d) => d.id === payload.id ? payload : d); },
    deleteDepartment:  (s, { payload }) => { s.departments = s.departments.filter((d) => d.id !== payload); },

    // ── Quality Defects ───────────────────────────────────────────────────────
    setQualityDefects:   (s, { payload }) => { s.qualityDefects = payload; },
    addQualityDefect:    (s, { payload }) => { s.qualityDefects.push(payload); },
    updateQualityDefect: (s, { payload }) => { s.qualityDefects = s.qualityDefects.map((q) => q.id === payload.id ? payload : q); },
    deleteQualityDefect: (s, { payload }) => { s.qualityDefects = s.qualityDefects.filter((q) => q.id !== payload); },

    // ── Machines ──────────────────────────────────────────────────────────────
    setMachines: (s, { payload }) => { s.machines = payload; },

    // ── Production Plans ──────────────────────────────────────────────────────
    setPlans: (s, { payload }) => { s.plans = payload; },

    // ── Checkpoint Library ───────────────────────────────────────────────────
    setCheckpointLibrary: (s, { payload }) => { s.checkpointLibrary = payload; },

    // ── Shifts ────────────────────────────────────────────────────────────────
    // Guard against undefined s.shifts (happens when redux-persist rehydrates
    // an older stored state that was saved before the shifts field was added).
    setShifts:   (s, { payload }) => { s.shifts = payload; },
    setShiftHistory: (s, { payload }) => { s.shiftHistory = payload; },
    setMachineShiftAllocations: (s, { payload }) => { s.machineShiftAllocations = payload; },
    setMachineShiftAllocationHistory: (s, { payload }) => { s.machineShiftAllocationHistory = payload; },
    addShift:    (s, { payload }) => {
      if (!Array.isArray(s.shifts)) s.shifts = INIT_SHIFTS.map(x => ({ ...x }));
      s.shifts.push(payload);
    },
    updateShift: (s, { payload }) => {
      if (!Array.isArray(s.shifts)) s.shifts = INIT_SHIFTS.map(x => ({ ...x }));
      s.shifts = s.shifts.map((sh) => sh.id === payload.id ? payload : sh);
    },
    deleteShift: (s, { payload }) => {
      if (!Array.isArray(s.shifts)) s.shifts = INIT_SHIFTS.map(x => ({ ...x }));
      s.shifts = s.shifts.filter((sh) => sh.id !== payload);
    },

    // ── Logged entries (captured from production monitoring) ──────────────────
    setQualityPassword: (s, { payload }) => { s.qualityPassword = payload; },

    // ── Logged entries (captured from production monitoring) ──────────────────
    logDowntimeEntry: (s, { payload }) => {
      if (!Array.isArray(s.downtimeEntries)) s.downtimeEntries = [];
      s.downtimeEntries.unshift({ ...payload, id: Date.now() });
    },
    logQualityEntry: (s, { payload }) => {
      if (!Array.isArray(s.qualityEntries)) s.qualityEntries = [];
      s.qualityEntries.unshift({ ...payload, id: Date.now() });
    },
    deleteDowntimeEntry: (s, { payload }) => { s.downtimeEntries = (s.downtimeEntries ?? []).filter((e) => e.id !== payload); },
    deleteQualityEntry:  (s, { payload }) => { s.qualityEntries  = (s.qualityEntries  ?? []).filter((e) => e.id !== payload); },
  },
  extraReducers: (builder) => {
    // When redux-persist rehydrates an old stored state that has no `shifts`
    // field, initialise it from INIT_SHIFTS so the rest of the app never
    // sees undefined.
    builder.addCase("persist/REHYDRATE", (state, action) => {
      const mc = action.payload?.masterConfig;
      if (mc && !Array.isArray(mc.shifts)) {
        state.shifts = INIT_SHIFTS.map(x => ({ ...x }));
      }
      if (mc && !Array.isArray(mc.departments)) {
        state.departments = INIT_DEPARTMENTS.map(x => ({ ...x }));
      }
      if (mc && !Array.isArray(mc.downtimeEntries)) {
        state.downtimeEntries = [];
      }
      if (mc && !Array.isArray(mc.qualityEntries)) {
        state.qualityEntries = [];
      }
      // Default noOfSheet and actualComponentsPerSheet to 1 for any material
      // that was saved without these fields (or with 0 / empty string).
      if (mc && Array.isArray(mc.materials)) {
        state.materials = mc.materials.map((m) => ({
          ...m,
          noOfSheet: parseFloat(m.noOfSheet) > 0 ? m.noOfSheet : 1,
          actualComponentsPerSheet: parseFloat(m.actualComponentsPerSheet) > 0 ? m.actualComponentsPerSheet : 1,
        }));
      }
    });
  },
});

export const {
  setMaterials, addMaterial, updateMaterial, deleteMaterial, bulkAddMaterials,
  setDowntimeReasons, addDowntimeReason, updateDowntimeReason, deleteDowntimeReason,
  setDepartments, addDepartment, updateDepartment, deleteDepartment,
  setQualityDefects, addQualityDefect, updateQualityDefect, deleteQualityDefect,
  setMachines,
  setPlans,
  setCheckpointLibrary,
  setShifts, setShiftHistory, addShift, updateShift, deleteShift,
  setMachineShiftAllocations, setMachineShiftAllocationHistory,
  setQualityPassword,
  logDowntimeEntry, logQualityEntry, deleteDowntimeEntry, deleteQualityEntry,
} = masterConfigSlice.actions;

export default masterConfigSlice.reducer;

// ── Selectors ─────────────────────────────────────────────────────────────────
export const selectMaterials       = (s) => s.masterConfig?.materials ?? [];
export const selectDowntimeReasons = (s) => s.masterConfig?.downtimeReasons ?? [];
export const selectDepartments      = (s) => s.masterConfig?.departments ?? [];
export const selectQualityDefects  = (s) => s.masterConfig?.qualityDefects ?? [];
export const selectMachines        = (s) => s.masterConfig?.machines ?? [];
export const selectPlans           = (s) => s.masterConfig?.plans ?? [];
export const selectCheckpointLibrary = (s) => s.masterConfig?.checkpointLibrary ?? [];
export const selectShifts          = (s) => s.masterConfig?.shifts ?? INIT_SHIFTS;
export const selectShiftHistory    = (s) => s.masterConfig?.shiftHistory ?? [];
export const selectMachineShiftAllocations        = (s) => s.masterConfig?.machineShiftAllocations ?? [];
export const selectMachineShiftAllocationHistory  = (s) => s.masterConfig?.machineShiftAllocationHistory ?? [];
export const selectDowntimeEntries = (s) => s.masterConfig?.downtimeEntries ?? [];
export const selectQualityEntries  = (s) => s.masterConfig?.qualityEntries ?? [];
export const selectQualityPassword = (s) => s.masterConfig?.qualityPassword ?? "";

// ── Shift utilities ────────────────────────────────────────────────────────────
// Convert "HH:MM" → minutes since midnight
export const toMins = (hhmm) => {
  if (!hhmm) return 0;
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

// Shift duration in minutes (handles overnight shifts)
export const shiftDurationMins = (shift) => {
  if (!shift) return 0;
  const s = toMins(shift.startTime);
  let e   = toMins(shift.endTime);
  if (e <= s) e += 1440; // crosses midnight
  return e - s;
};

// Tea breaks are configured as a count (0-3), not a duration — no length
// field exists in ShiftConfigs, so a fixed per-break length is assumed.
const TEA_BREAK_MINS = 15;

// Total configured break minutes for a shift: the lunch/dinner window
// (breakStart-breakEnd) plus assumed tea-break time.
export const shiftBreakMins = (shift) => {
  if (!shift) return 0;
  let mins = 0;
  if (shift.breakStart && shift.breakEnd) {
    const s = toMins(shift.breakStart);
    let e   = toMins(shift.breakEnd);
    if (e <= s) e += 1440; // crosses midnight
    mins += e - s;
  }
  mins += (parseInt(shift.teaBreaks, 10) || 0) * TEA_BREAK_MINS;
  return mins;
};

// Shift duration minus configured breaks — the actual production time
// available, used as the OEE planned-time denominator (NOT for wall-clock
// displays like shift progress/remaining time, which use shiftDurationMins).
export const shiftPlannedProductionMins = (shift) =>
  Math.max(0, shiftDurationMins(shift) - shiftBreakMins(shift));

// True when the current clock time falls inside this shift's window
export const isActiveShift = (shift) => {
  if (!shift) return false;
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  const s   = toMins(shift.startTime);
  let   e   = toMins(shift.endTime);
  if (e <= s) {
    // Overnight — active if cur >= start OR cur < end
    return cur >= s || cur < e;
  }
  return cur >= s && cur < e;
};

// Elapsed minutes into a shift (0 if not started yet)
export const shiftElapsedMins = (shift) => {
  if (!shift) return 0;
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  const s   = toMins(shift.startTime);
  let elapsed = cur - s;
  if (elapsed < 0) elapsed += 1440; // wrap for overnight
  const dur = shiftDurationMins(shift);
  return Math.min(elapsed, dur);
};

/**
 * Given a shift config and a "base date" string (YYYY-MM-DD), return the
 * exact calendar start/end datetimes for that shift occurrence.
 *
 * Shift 1 (08:00–20:00) on 2024-06-04 → start: "2024-06-04 08:00", end: "2024-06-04 20:00"
 * Shift 2 (20:00–08:00) on 2024-06-04 → start: "2024-06-04 20:00", end: "2024-06-05 08:00"
 */
export const getShiftWindow = (shift, baseDate) => {
  if (!shift || !baseDate) return null;
  const p2 = n => String(n).padStart(2, "0");
  const isoStr = d => `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`;
  const ssm = toMins(shift.startTime);
  const sem = toMins(shift.endTime);
  if (ssm === null || sem === null) return null;

  const isOvernight = sem <= ssm;
  const startD = new Date(baseDate + "T00:00:00");
  const endD   = new Date(baseDate + "T00:00:00");
  if (isOvernight) endD.setDate(endD.getDate() + 1);

  return {
    startDate:     isoStr(startD),
    endDate:       isoStr(endD),
    startTime:     shift.startTime,
    endTime:       shift.endTime,
    startDatetime: `${isoStr(startD)} ${shift.startTime}`,
    endDatetime:   `${isoStr(endD)} ${shift.endTime}`,
    isOvernight,
  };
};

/**
 * Extract the actual program name from a machine barcode string.
 *
 * The barcode format is:  % O<machineNumber>(<programName>)  [(<extra>)]
 *
 * Examples:
 *   "% O0001(1130596-C-OUTER-BTM-FLT-875H-NEW)" → "1130596-C-OUTER-BTM-FLT-875H-NEW"
 *   "% O9030(NCT-FJOB-A-5B)  (AMNC-F-JOB)"      → "NCT-FJOB-A-5B"
 *
 * Falls back to the raw barcode if the pattern is not found.
 */
export const extractProgramName = (barcode) => {
  if (!barcode) return null;
  // Capture the content inside the FIRST parentheses that follow O<digits>
  const m = String(barcode).match(/O\d+\(([^)]+)\)/);
  return m ? m[1].trim() : String(barcode).trim();
};

/**
 * Quick SAP Code extractor — returns the FIRST numeric sequence.
 * Used for display labels and as a first-pass hint.
 * Full multi-number lookup is handled by getMaterialByModel below.
 *
 * Step 1 — Extract SAP Code:
 *   Scan the incoming string for the FIRST continuous numeric sequence.
 *   Examples:
 *     "1114769-UNIT-FRAME-425HE"              → "1114769"
 *     "1126358-TOP-LID-D375H-SPCL-TOOL"       → "1126358"
 *     "% O9030(NCT-FJOB-A-5B)  (AMNC-F-JOB)" → "9030"
 *
 * Step 2 — Exact match in Master Data SAP Code column.
 *
 * Step 3 — Return matching record, or null if not found.
 */
export const extractSapCode = (modelString) => {
  if (!modelString) return null;
  const match = String(modelString).match(/\d+/);
  return match ? match[0] : null;
};

/**
 * Material lookup — tries ALL numeric sequences in the program name,
 * longest first (most likely to be the SAP code).
 *
 * For each candidate number it runs 3 checks:
 *   1. Exact SAP Code match
 *   2. Leading-zero stripped SAP Code match   (e.g. "0110294" → "110294")
 *   3. Stripped number appears anywhere in Part Name
 *      (e.g. "110294" inside "PC/EMB INNER BTM D350-375H_110294")
 *
 * Sorted longest-first so a 7-digit SAP code is tried before a 2-digit
 * sequence, preventing false positives on short numbers.
 */
export const getMaterialByModel = (materials, modelString) => {
  if (!modelString || !materials?.length) return null;

  // Extract every numeric run and sort longest first
  const allNums = [...String(modelString).matchAll(/\d+/g)]
    .map((m) => m[0])
    .sort((a, b) => b.length - a.length);

  if (!allNums.length) return null;

  for (const num of allNums) {
    // Step 1: Exact SAP Code match
    const exact = materials.find((m) => m.sapCode === num);
    if (exact) return exact;

    // Step 2: Strip leading zeros, retry SAP Code match
    const stripped = num.replace(/^0+/, "");
    if (stripped && stripped !== num) {
      const noZero = materials.find((m) => m.sapCode === stripped);
      if (noZero) return noZero;
    }

    // Step 3: Number (stripped) appears as substring in Part Name
    //   guard: only numbers with 4+ digits to avoid false positives
    const search = stripped || num;
    if (search.length >= 4) {
      const inName = materials.find(
        (m) => m.partName && m.partName.includes(search)
      );
      if (inName) return inName;
    }
  }

  return null;
};
