// The Garuda database (pool1) for the pages copied from the Garuda app (FG Scrap, Model To Model Transfer, Material
// Barcode reprint): query / queryTable / scalar / execute with named parameters, and one transaction around a unit of
// work. Its own pool so dates are read as the server's local time (useUTC false), as Garuda reads them.
import sql from "mssql";
import { dbConfig1 } from "../config/db.config.js";

let pool;
let connecting;
const connect = () => {
  pool ??= new sql.ConnectionPool({
    ...dbConfig1,
    database: process.env.DB_NAME1,
    options: { ...dbConfig1.options, useUTC: false },
  });
  return (connecting ??= pool.connect().catch((e) => {
    pool = connecting = undefined;
    throw e;
  }));
};

function bind(request, params) {
  for (const [name, value] of Object.entries(params)) request.input(name, value);
  return request;
}

/** rows of the first result set */
export async function query(text, params = {}, tx = null) {
  await connect();
  return (await bind((tx ?? pool).request(), params).query(text)).recordset ?? [];
}

/** rows plus column metadata (name, SQL type, scale), as a .NET DataTable reads them (unnamed columns Column1 ...) */
export async function queryTable(text, params = {}, tx = null) {
  await connect();
  const req = bind((tx ?? pool).request(), params);
  req.arrayRowMode = true;
  const r = await req.query(text);
  const meta = r.columns?.[0] ?? [];
  let unnamed = 0;
  const seen = new Set();
  const columns = meta.map((c) => {
    let name = c.name || `Column${++unnamed}`;
    for (let n = 1; seen.has(name.toLowerCase()); n++) name = `${c.name || "Column"}${n}`;
    seen.add(name.toLowerCase());
    return { name, type: c.type?.declaration ?? "", scale: c.scale ?? 0 };
  });
  const rows = (r.recordset ?? []).map((a) => Object.fromEntries(columns.map((c, i) => [c.name, a[i]])));
  return { columns, rows };
}

/** first column of the first row, or null */
export async function scalar(text, params = {}, tx = null) {
  const rows = await query(text, params, tx);
  return rows.length ? Object.values(rows[0])[0] : null;
}

/** rows affected */
export async function execute(text, params = {}, tx = null) {
  await connect();
  const r = await bind((tx ?? pool).request(), params).query(text);
  return r.rowsAffected.reduce((a, b) => a + b, 0);
}

/** fn(tx) inside one transaction; rolled back on any error */
export async function transaction(fn) {
  await connect();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const result = await fn(tx);
    await tx.commit();
    return result;
  } catch (e) {
    await tx.rollback().catch(() => {}); // SQL Server may have rolled back already: keep the real error
    throw e;
  }
}
