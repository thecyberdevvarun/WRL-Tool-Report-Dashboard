// Label printing, copied unchanged from Garuda (server/src/modules/production/labels.service.js): the in-process label
// (FG label, assembly / foaming barcode) built from its MaterialTag template and sent raw to the printer: to its IP
// (TCP 9100) or, without an IP, to the Windows printer driver on this server (raw-print.ps1). The printer check pings
// it, as Garuda does: the dashboard runs on Windows.
import net from "node:net";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { query, queryTable, scalar, execute } from "../utils/garuda-db.js";
import { netString, netInt, requireDigits, toText } from "../utils/garuda-convert.js";

const run = promisify(execFile);
const pad = (n) => String(n).padStart(2, '0');
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// DateTime.Now.ToString(...) on en-IN ("/" prints as the culture's "-")
const ddMMMyyyy = (d) => `${pad(d.getDate())}-${MON[d.getMonth()]}-${d.getFullYear()}`;
const ddMMMyyHHmm = (d) => `${pad(d.getDate())}-${MON[d.getMonth()]}-${String(d.getFullYear()).slice(-2)} ${pad(d.getHours())}:${pad(d.getMinutes())} `;
const MMcommayyyy = (d) => `${pad(d.getMonth() + 1)},${d.getFullYear()}`;

/** A DataTable as the original read it: ADO column names, values as .NET ToString(). */
async function table(sql, params, tx) {
  const t = await queryTable(sql, params, tx);
  return { columns: t.columns.map((c) => c.name), rows: t.rows.map((r) => Object.fromEntries(t.columns.map((c) => [c.name, toText(r[c.name], { sqlType: c.type, scale: c.scale })]))) };
}
const upper = (s) => netString(s).toUpperCase();
const replaceAll = (s, a, b) => s.split(a).join(b);
/** prnString.Replace("[COL]", value) for every column of the first row, or "" when there is none */
function fillColumns(prn, t, value = (v) => upper(v)) {
  for (const c of t.columns) prn = replaceAll(prn, `[${c.toUpperCase()}]`, t.rows.length ? value(t.rows[0][c], c) : '');
  return prn;
}
/** AVLabelPrint.ReplaceNewLine: a MaterialTagField with a Length wraps the value (a "\n" after every Length chars) */
function replaceNewLine(fields, field, str, prn) {
  const f = fields.rows.find((r) => upper(r.FieldName) === field.toUpperCase());
  if (f && netInt(f.Length) > 0) {
    const len = netInt(f.Length);
    let out = '';
    for (let i = 0; i < str.length; i += len) out += `${str.slice(i, i + len)}\n`;
    return replaceAll(prn, `[${field}]`, out);
  }
  return replaceAll(prn, `[${field}]`, str);
}


// ---- printers ----------------------------------------------------------------------------------------------------

/** TitleControl.FillPrinter / AU.FillALLBarcodePrinterList: printers of the business unit (the only one preselected). */
export async function printerOptions(businessUnit) {
  const rows = await query('Select ROWID,Name from BarcodePrinter Where BusinessUnit=@bu', { bu: netString(businessUnit) });
  const options = [{ value: '', text: 'Select A Value' }, ...rows.map((r) => ({ value: netString(r.ROWID), text: netString(r.Name) }))];
  return { options, value: options.length === 2 ? options[1].value : '' };
}

/** AVLabelPrint.GetPrinterDetail */
export async function printerDetail(printerId) {
  const r = (await query('Select * from barcodePrinter where RowID=@id', { id: netInt(printerId) }))[0];
  return r ? { name: netString(r.Name), IP: netString(r.IP), driver: netString(r.Driver) } : { name: '', IP: '', driver: '' };
}

/** WrapperAvatar.PingHost (Ping.Send, 5 s) */
export async function pingHost(host) {
  if (process.platform !== 'win32') return false;
  try {
    const { stdout } = await run('ping', ['-n', '1', '-w', '5000', host], { windowsHide: true });
    return /TTL=/i.test(stdout);
  } catch {
    return false;
  }
}

/** AU.CheckPrinterStatus: a printer with an IP must answer a ping. */
export async function printerOnline(printerId) {
  const r = (await query('select * from BarcodePrinter Where ROWID=@id', { id: netInt(printerId) }))[0];
  if (!r) throw new Error('There is no row at position 0.');
  return netString(r.IP) === '' || (await pingHost(netString(r.IP)));
}

/** AIPPrint.PrintData: ping, port check, then the bytes (Encoding.ASCII: other characters become "?"). */
export async function sendToIp(text, ip, port = 9100) {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) throw new Error('Wrong IP Address!');
  if (!(await pingHost(ip))) return false;
  const bytes = Buffer.from([...text].map((ch) => (ch.charCodeAt(0) < 128 ? ch.charCodeAt(0) : 63)));
  return new Promise((resolve) => {
    const s = net.connect({ host: ip, port, noDelay: true });
    s.setTimeout(20000);
    s.on('connect', () => s.end(bytes, () => resolve(true)));
    s.on('error', () => resolve(false));
    s.on('timeout', () => {
      s.destroy();
      resolve(false);
    });
  });
}

/** ADriverPrint.SendStringToPrinter: RAW job "TIM_LABEL_PRINT" through the Windows spooler (ANSI code page). */
export async function sendToDriver(printerName, text) {
  if (process.platform !== 'win32') return false;
  const script = fileURLToPath(new URL('./raw-print.ps1', import.meta.url));
  await run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, printerName, Buffer.from(text, 'utf8').toString('base64')], { windowsHide: true }).catch(() => {});
  return true;
}

/** The pages' "IP given -> network, else driver" step (port "0" = 9100). */
async function deliver(prn, ip, driver, { retry = false } = {}) {
  if (ip !== '' && ip !== '0') {
    if (!(await sendToIp(prn, ip)) && retry) await sendToIp(prn, ip);
  } else await sendToDriver(driver, prn);
}


/** The tag of a material: its own, its category's, else the default (TagType 1). */
async function materialTag(matCode, categoryFirst) {
  const own = () => scalar(`select PrnCommand from MaterialTag where TagCode=(select TagCode from Material where MatCode=${matCode} )`);
  const cat = () => scalar(`select PrnCommand from MaterialTag where TagCode=(select TagCode from MaterialCategory where CategoryCode=(select Category from Material where MatCode=${matCode} )) `);
  let prn = netString(await (categoryFirst ? cat() : own()));
  if (prn === '') prn = netString(await (categoryFirst ? own() : cat()));
  if (prn === '') prn = netString(await scalar('select PrnCommand from MaterialTag where TagType=1'));
  if (prn === '') throw new Error('Print Tag or PRN is Not assigned for the Material Category');
  return prn;
}

/** AVLabelPrint.PrintGRNLabel (text only; marks the barcode printed when asked) */

/** AVLabelPrint.PrintInProcessLabel (WRL: not the TMEIC variant) */
export async function buildInProcess(barcodeNo, userId, now = new Date()) {
  const b = requireDigits(barcodeNo);
  let head = await table(`select ps.Material,ps.Alias[ProcessOrder],M.Name[FGMaterial],m.Alias[FGCode],po.Alias[ProductionOrder],l.Name[HCustomer],cp.Name[CurrentProcess],np.Name[NextProcess],po.CustID,po.TrackID,ps.MainPSNO,ps.Batch[BATCH1],u.Alias[U1],po.Qty[BSIZE],b.name[PLANT]  from ProcessOrder ps left join PRODHeader po on ps.PRODNo=po.PRODNo left join SOHeader so on po.SalesOrder =so.SONo left join Ledger l on so.Customer=l.LedgerCode left join ProductionProcess cp on ps.CurrentProcess=cp.ProcessCode left join ProductionProcess np on np.ProcessCode=ps.NextProcess left join Material m on m.MatCode =ps.Material left join UnitOfMeasure u on ps.Uom = u.UomCode left join BusinessUnit b on po.BusinessUnit =b.bucode  where ps.PSNo=(select Docno from MaterialBarcode where BarcodeNo=${b})`);
  if (!head.rows.length) head = await table(`select ps.Material,ps.Alias[ProcessOrder],M.Name[FGMaterial],m.Alias[FGCode],po.Alias[ProductionOrder],l.Name[HCustomer],cp.Name[CurrentProcess],np.Name[NextProcess],po.CustID,po.TrackID,ps.MainPSNO  from ProcessOrder ps left join PRODHeader po on ps.PRODNo=po.PRODNo left join SOHeader so on po.SalesOrder =so.SONo left join Ledger l on so.Customer=l.LedgerCode left join ProductionProcess cp on ps.CurrentProcess=cp.ProcessCode left join ProductionProcess np on np.ProcessCode=ps.NextProcess left join Material m on m.MatCode =ps.Material  where ps.PSNo=(Select PSNO from ProcessStageLabel where BarcodeNo=(select Serial from MaterialBarcode where BarcodeNo=${b}))`);
  const mat = await table(`select mb.WorkCenter,m.SRetailRate[MRP],mb.BarcodeNo,mb.Vserial,mb.Serial, m.MatCode,m.Alias,m.Name[ItemName],m.AltName  ,mb.CurrentQty[QTY], mb.Serial2, u.Alias[U1],ih.VendorBatch,FORMAT (ih.ExpiryDate, 'dd/MM/yyyy') as ExpiryDate,ih.Manufacturer,ih.ManufBatch,FORMAT (ih.ManufDate, 'dd/MM/yyyy') as ManufDate,ih.Batch,mb.Alias as [REFBARCODE],FORMAT (mb.CreatedOn, 'dd/MM/yyyy')[CreatedOn],FORMAT (mb.ExpiryDate, 'dd/MM/yyyy')[BAREXPIRY],mb.Serial2,mb1.Serial[MHE],mb.GrossWeight[GRWT],mb.TareWeight[TRWT],mb.NetWeigh[NETWT],U2.Alias[U2],mb.WeighingScale[WTNO] from MaterialBarcode mb inner join Material m on mb.Material=m.MatCode left join MaterialBatch  ih on ih.BatchNo =mb.Batch LEFT join MaterialBarcode mb1 on  mb1.BarcodeNo =mb.HUID  inner join UnitOfMeasure u on mb.Uom=u.UomCode left join UnitOfMeasure U2 on mb.WeightUom = U2.UomCode  where mb.BarcodeNo=${b}`);
  if (!head.rows.length) throw new Error('There is no row at position 0.'); // dtHeader.Rows[0]["MainPSNO"]
  const vq = (src, val, where) => table(`Select v.${val}[VariantValue],f.Name[VariantField] from ${src} mv inner join VariantFieldValue   v on mv.ValueCode=v.Code inner join VariantField f on v.Field=f.FieldCode ${where}`);
  const pvar = await vq('VariantTran', 'Name', ` where mv.VariantCode=${netInt(head.rows[0].MainPSNO)}`);
  const modelOf = `ModelCode=(Select Model From Material where MatCode=(select Material from MaterialBarcode where BarcodeNo=${b}))`;
  const vars = await vq('ModelVariant', 'Name', `   where ${modelOf}`);
  const matVar = await vq('MaterialVariant ', 'Name', `   where MatCode=${head.rows[0].Material}`);
  const varP = await vq('ModelVariant', 'Prefix', `   where ${modelOf}`);
  const matVarP = await vq('MaterialVariant ', 'Prefix', `   where MatCode=${head.rows[0].Material}`);
  const outBom = await table(`select us.UserName[USER],pout.StationCode,wc.Alias[STATION],pout.Remark from ProcessOutputBOMBarcode pout inner join Users us on pout.Operator = us.UserCode inner join WorkCenter wc on pout.StationCode = wc.StationCode where BarcodeNo =${b}`);
  if (!mat.rows.length) throw new Error('There is no row at position 0.'); // dtMat.Rows[0]["MatCode"]
  const fields = await table(`Select * from MaterialTagField where TagCode=(select TagCode from MaterialCategory where CategoryCode=(select Category from Material where MatCode=${mat.rows[0].MatCode} )) `);
  let prn = await materialTag(mat.rows[0].MatCode, true);
  prn = replaceAll(prn, '[PREFIX]', '');
  // dtField is a table (never null): header and BOM values as stored, material values upper-cased, all wrapped
  for (const c of head.columns) prn = replaceNewLine(fields, c.toUpperCase(), head.rows[0][c], prn);
  for (const c of mat.columns) prn = replaceNewLine(fields, c.toUpperCase(), upper(mat.rows[0][c]), prn);
  if (outBom.rows.length) for (const c of outBom.columns) prn = replaceNewLine(fields, c.toUpperCase(), outBom.rows[0][c], prn);
  else for (const c of outBom.columns) prn = replaceAll(prn, `[${c.toUpperCase()}]`, '');
  for (const [t, pre] of [[pvar, ''], [vars, ''], [matVar, ''], [varP, 'P-'], [matVarP, 'P-']]) {
    for (const r of t.rows) prn = replaceAll(prn, `[${pre}${upper(r.VariantField)}]`, netString(r.VariantValue));
  }
  prn = replaceAll(prn, '[MDATE]', MMcommayyyy(now));
  prn = replaceAll(prn, '[PDATE]', ddMMMyyHHmm(now));
  prn = replaceAll(prn, '[PRINTDATE]', ddMMMyyyy(now));
  return replaceAll(prn, '[USER]', `${netString(userId)} On ${ddMMMyyyy(now)}`);
}

/** Build + deliver, as the page's print step did ("None"/""/"0" printer: nothing). */

/** Build + deliver, as the page's print step did ("None"/""/"0" printer: nothing). Only the in-process label here. */
export async function printInProcess(barcodeNo, printer, userId) {
  if (printer.name === "None" || printer.name === "" || printer.name === "0") return;
  const prn = await buildInProcess(barcodeNo, userId);
  await deliver(prn, printer.IP, printer.driver);
  await execute(`Update MaterialBarcode set PrintStatus=1 where BarcodeNo=${requireDigits(barcodeNo)}`);
}
