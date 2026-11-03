// .NET conversions the Garuda rules rely on (copied from Garuda's server/src/shared), so values compare and print the same.
import { scalar } from "./garuda-db.js";

/** Object.ToString() (bool -> "True"/"False", null -> "") */
export function netString(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "True" : "False";
  if (Buffer.isBuffer(v)) return "System.Byte[]";
  return String(v);
}

/** ParseInt: ""/null -> 0, drops "," and "|", truncates at ".", throws otherwise */
function parseWhole(v) {
  const s = netString(v);
  if (s.replace(/\|/g, "").trim() === "") return 0;
  if (s.toLowerCase() === "true") return 1;
  if (s.toLowerCase() === "false") return 0;
  const t = s.replace(/[,|]/g, "").split(".")[0].trim();
  if (!/^[+-]?\d+$/.test(t)) throw new Error("Input string was not in a correct format");
  return Number(t);
}
export function netInt(v) {
  const n = parseWhole(v);
  if (n > 2147483647 || n < -2147483648) throw new Error("Value was either too large or too small for an Int32.");
  return n;
}
/** ParseDouble: number, or 0 */
export function netDouble(v) {
  const s = netString(v).replace(/\|/g, "");
  if (s.trim() === "") return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}
/** ParseLong: like netInt but 0 instead of throwing */
export function netLong(v) {
  try {
    return parseWhole(v);
  } catch {
    return 0;
  }
}
/** double.ToString() (15 significant digits) */
export function netNum(d) {
  if (Number.isNaN(d)) return "NaN";
  if (!Number.isFinite(d)) return d > 0 ? "∞" : "-∞";
  return String(Number(d.toPrecision(15)));
}
/** a number put straight into SQL text: digits only */
export const requireDigits = (x) => {
  const s = netString(x);
  if (!/^\d+$/.test(s)) throw new Error("Incorrect syntax near '='.");
  return s;
};

const pad = (n) => String(n).padStart(2, "0");
/** DateTime.ToString() on en-IN */
const enInDateTime = (d) => `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours() % 12 || 12)}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${d.getHours() < 12 ? "AM" : "PM"}`;

/** a database value as .NET printed it */
export function toText(v, col) {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return col?.sqlType === "time" ? `${pad(v.getHours())}:${pad(v.getMinutes())}:${pad(v.getSeconds())}` : enInDateTime(v);
  if (typeof v === "boolean") return v ? "True" : "False";
  if (Buffer.isBuffer(v)) return "System.Byte[]";
  if (typeof v === "number") return col && /decimal|numeric|money/.test(col.sqlType) ? v.toFixed(col.scale ?? 0) : netNum(v);
  return String(v);
}

/** who is doing it, as Garuda's session holds it: the user's ID and code, and the business unit (the plant has one) */
let businessUnit;
export async function ctxOf(req) {
  businessUnit ??= netString(await scalar("select top 1 BuCode from BusinessUnit order by BuCode"));
  return { userId: netString(req.user?.id), userCode: netString(req.user?.usercode), businessUnit, superAdmin: req.user?.roleName?.toLowerCase() === "super admin" };
}

/** a page of a history, as the pages read it: { columns: [names], rows: [[cell text]], count, page, pageSize } */
/** ?page= (from 1, as the dashboard's Pagination counts) and ?limit= (10 to 500, default 50) */
export const pageOf = (q) => Math.max(1, Math.floor(Number(q.page) || 1));
export const sizeOf = (q) => Math.min(500, Math.max(10, Math.floor(Number(q.limit) || 50)));
export function listShape(rows, names, total, page, size) {
  return { columns: names, rows: rows.map((r) => names.map((c) => (r[c] == null ? "" : String(r[c])))), count: Number(total) || 0, page, pageSize: size };
}
/** ?start=&end= (YYYY-MM-DDTHH:mm) as checked parameters, and the where they add */
export function rangeOf(q) {
  const range = {};
  for (const [name, key] of [["start", "startTime"], ["end", "endTime"]]) {
    const v = netString(q[name]).trim();
    if (v === "") continue;
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(v) || Number.isNaN(Date.parse(v))) {
      const e = new Error(`The ${name} time is not a date and time`);
      e.statusCode = 400;
      e.isOperational = true;
      throw e;
    }
    range[key] = v.length === 16 ? `${v}:00` : v;
  }
  return range;
}
export const timeWhere = (col, range) => (range.startTime ? ` and ${col} >= @startTime` : "") + (range.endTime ? ` and ${col} <= @endTime` : "");
