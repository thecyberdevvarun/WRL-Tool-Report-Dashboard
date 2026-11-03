// Model To Model Transfer (copied from Garuda: server/src/modules/production/model-transfers): FG units moved to another
// model by a list of their serials. The serials are checked and grouped by product (source material), each group gets
// its destination, then each unit is moved with the original's statements, its label printed again, and logged in
// ModelToModel one serial a row. Each unit's move and log are one transaction.
import { tryCatch } from "../../utils/try-catch.js";
import { AppError } from "../../utils/app-error.js";
import { execute, query, scalar, transaction } from "../../utils/garuda-db.js";
import { printInProcess, printerDetail, printerOnline } from "../../services/label-print.service.js";
import { ctxOf, listShape, netDouble, netInt, netLong, netNum, netString, pageOf, sizeOf, rangeOf, timeWhere } from "../../utils/garuda-convert.js";

const MAX_CHECK = 500;
const MAX_MOVE = 50;
const FG_TYPE = 100;
const SCRAPPED = 99;
const num = (v) => {
  const s = netString(v).trim();
  if (!/^-?\d+(\.\d+)?$/.test(s)) throw new Error(`Incorrect syntax near '${s}'.`);
  return s;
};
const option = (rows, value, label) => rows.map((r) => ({ value: netString(r[value]), label: netString(r[label]) }));

/** what the page chooses from: the FG materials and the printers */
export const getTransferOptions = tryCatch(async (_req, res) => {
  const [materials, printers] = await Promise.all([query(`Select MatCode, Name from Material Where Type=${FG_TYPE} order by Name`), query("Select ROWID, Name from BarcodePrinter")]);
  res.json({ success: true, data: { materials: option(materials, "MatCode", "Name"), printers: option(printers, "ROWID", "Name") } });
});

/** why a barcode row cannot be transferred, or null when it can */
const refusal = (r) => (!r ? "No barcode has this serial." : netInt(r.status) === SCRAPPED ? "This unit is scrapped (status 99)." : netInt(r.materialType) !== FG_TYPE ? "Not an FG material." : null);

/** { serials }: checked and grouped by product: { groups: [{ materialCode, material, materialAlias, units }], refused } */
export const checkTransfer = tryCatch(async (req, res) => {
  const serials = req.body?.serials;
  if (!Array.isArray(serials)) throw new AppError("Send the serials as a list.", 400);
  const list = [...new Set(serials.map((s) => netString(s).trim()).filter((s) => s !== ""))];
  if (!list.length) throw new AppError("Scan or paste at least one FG serial.", 400);
  if (list.length > MAX_CHECK) throw new AppError(`Check at most ${MAX_CHECK} serials at a time (${list.length} given).`, 400);
  if (list.some((s) => s.length > 100)) throw new AppError("A serial is longer than 100 characters.", 400);
  const rows = await query(
    `select cast(j.[key] as int) idx, mb.BarcodeNo barcodeNo, mb.Serial serial, mb.Status status, m.MatCode materialCode,
        m.Name material, m.Alias materialAlias, m.Type materialType
      from openjson(@list) j
      join MaterialBarcode mb on mb.Serial = j.value
      left join Material m on m.MatCode = mb.Material`,
    { list: JSON.stringify(list) },
  );
  const at = new Map(rows.map((r) => [r.idx, r]));
  const groups = new Map();
  const refused = [];
  list.forEach((serial, i) => {
    const r = at.get(i) ?? null;
    const why = refusal(r);
    if (why) return void refused.push({ serial, error: why });
    const key = netString(r.materialCode);
    if (!groups.has(key)) groups.set(key, { materialCode: key, material: r.material, materialAlias: r.materialAlias, units: [] });
    groups.get(key).units.push({ serial: r.serial, barcodeNo: netString(r.barcodeNo) });
  });
  res.json({ success: true, data: { groups: [...groups.values()], refused } });
});

/** AVMM.UpdateLocation(location, barcode, StockAdd: true): the barcode's quantity into the location's stock row */
async function updateLocationAdd(locationCode, barcode, tx) {
  const d = (await query(`Select * from MaterialBarcode where BarcodeNo = ${num(barcode)}`, {}, tx))[0];
  if (!d) return false;
  const [m, batch, cArea, qty, uom, st] = [netInt(d.Material), netLong(d.Batch), netInt(d.Area), netDouble(d.CurrentQty), netInt(d.Uom), netInt(d.QCStatus)];
  const [hold, release, rejected] = [st === 11 ? qty : 0, st === 12 ? qty : 0, st === 13 ? qty : 0];
  const loc = num(locationCode);
  const area = netLong(loc) <= 0 ? netLong(d.Area) : netLong(await scalar(`Select Area from StorageArea where StorageCode=${loc}`, {}, tx));
  if (netDouble(await scalar(`select Qty from MaterialStock where Material=${m} and StorageCode = ${loc} and Batch=${batch} and Area=${cArea}`, {}, tx)) > 0) {
    await execute(`Update MaterialStock set Qty=qty+${netNum(qty)},HoldQty= HoldQty+${netNum(hold)},ReleasedQty=ReleasedQty+${netNum(release)} , RejectedQty=RejectedQty+${netNum(rejected)} where Material=${m}and StorageCode = ${loc} and Batch=${batch} and Area=${cArea}`, {}, tx);
  } else {
    await execute(`insert into MaterialStock (StorageCode,Material,Batch,Qty,HoldQty,ReleasedQty,RejectedQty,Uom,Area,Department,BusinessUnit) values(${loc},${m},${batch},${netNum(qty)},${netNum(hold)},${netNum(release)},${netNum(rejected)},${uom},${area}, ${netInt(d.Department)},${netInt(d.BusinessUnit)})`, {}, tx);
  }
  if (netLong(loc) > 0) await execute(`Update MaterialBarcode set Status=1,  StorageCode=${loc},Area=${area} where BarcodeNo = ${num(barcode)}`, {}, tx);
  else await execute(`Update MaterialBarcode set Status=1,  StorageCode=${loc} where BarcodeNo = ${num(barcode)}`, {}, tx);
  return true;
}

/** one barcode moved to the destination material, as ModelToModelTransferWRL does: its stock row, the barcode, its job
 *  card, then its location */
async function moveBarcode(d, des, tx) {
  await execute(`Update MaterialStock set Qty=qty-${num(d.CurrentQty)},ReleasedQty=ReleasedQty-${num(d.CurrentQty)} where Material=${num(d.Material)}  and  StorageCode=${num(d.StorageCode)}  and Batch=${num(d.Batch)}`, {}, tx);
  await execute(`Update MaterialBarcode set Material=${num(des)} where BarcodeNo=${num(d.BarcodeNo)}`, {}, tx);
  await execute(`Update ProcessOrder set Material=${num(des)} where PSNo=${num(d.DocNo)}`, {}, tx);
  await updateLocationAdd(netString(d.StorageCode), netString(d.BarcodeNo), tx);
}

/** a moved barcode's label printed again: its routing stage's number of copies (at least once) */
async function printMoved(d, bp, ctx) {
  const copies = netInt(await scalar(`Select NoofCopy from RoutingTrans where routecode=(Select Routing from ProcessOrder where PSNO=${num(d.DocNo)}) and ProcessCode=${num(d.ProcessCode)}`));
  let j = 0;
  do {
    await printInProcess(netString(d.BarcodeNo), bp, ctx.userId);
    j++;
  } while (j < copies);
}

/** { source, destination, barcodeNos, printer }: up to MAX_MOVE units of one source moved, in order, each label printed
 *  again and the move logged; a unit that is no longer of the source (or not live) is reported and the rest go on.
 *  [{ barcodeNo, serial, ok, printed, error? }] */
export const transferUnits = tryCatch(async (req, res) => {
  const { source, destination, barcodeNos, printer } = req.body ?? {};
  const ctx = await ctxOf(req);
  const lost = (status) => (netInt(status) === SCRAPPED ? "This unit is scrapped (status 99)." : "This unit is no longer of the source material.");
  const [src, des] = [netString(source).trim(), netString(destination).trim()];
  if (!/^\d{1,18}$/.test(src) || !/^\d{1,18}$/.test(des)) throw new AppError("Choose the source and the destination material.", 400);
  if (src === des) throw new AppError("The destination is the same material as the source.", 400);
  if (!Array.isArray(barcodeNos) || !barcodeNos.length) throw new AppError("Send the units to transfer as a list.", 400);
  if (barcodeNos.length > MAX_MOVE) throw new AppError(`Transfer at most ${MAX_MOVE} units in one request.`, 400);
  const list = barcodeNos.map((b) => netString(b).trim());
  if (list.some((b) => !/^\d{1,18}$/.test(b))) throw new AppError("A barcode number is not valid.", 400);
  if (netString(printer) === "") throw new AppError("Select a printer.", 400);
  const types = await query("select MatCode, Type from Material where MatCode in (@s, @d)", { s: src, d: des });
  if (!types.some((t) => netString(t.MatCode) === des && netInt(t.Type) === FG_TYPE)) throw new AppError("The destination is not an FG material.", 400);
  const bp = await printerDetail(printer);
  if (bp.name === "") throw new AppError("Select a printer.", 400);
  if (!(await printerOnline(printer))) throw new AppError("The printer is offline.", 400);
  const rows = await query("select mb.* from openjson(@list) j join MaterialBarcode mb on cast(mb.BarcodeNo as nvarchar(30)) = j.value", { list: JSON.stringify(list) });
  const byNo = new Map(rows.map((r) => [netString(r.BarcodeNo), r]));
  const out = [];
  for (const b of list) {
    const d = byNo.get(b);
    if (!d || netString(d.Material) !== src || netInt(d.Status) === SCRAPPED) {
      out.push({ barcodeNo: b, serial: d?.Serial ?? null, ok: false, printed: false, error: !d ? "No such barcode." : lost(d.Status) });
      continue;
    }
    try {
      await transaction(async (tx) => {
        // locked and checked again: a second request for this unit waits here, and finds it already moved
        const [now] = await query("select Material, Status from MaterialBarcode with (updlock, rowlock) where BarcodeNo=@b", { b }, tx);
        if (netString(now?.Material) !== src || netInt(now?.Status) === SCRAPPED) throw new Error(lost(now?.Status));
        await moveBarcode(d, des, tx);
        await execute("Insert into ModelToModel(SrcMaterial,DestMaterial,StartSerial,EndSerial,qty,UserCode) Values(@s,@d,@n,@n,1,@u)", { s: src, d: des, n: netString(d.Serial), u: netInt(ctx.userCode) }, tx);
      });
    } catch (e) {
      out.push({ barcodeNo: b, serial: d.Serial, ok: false, printed: false, error: e.message });
      continue;
    }
    try {
      await printMoved(d, bp, ctx);
      out.push({ barcodeNo: b, serial: d.Serial, ok: true, printed: true });
    } catch (e) {
      out.push({ barcodeNo: b, serial: d.Serial, ok: true, printed: false, error: `Moved, but the label did not print: ${e.message}` });
    }
  }
  res.json({ success: true, data: out });
});

/** the transfers so far (ModelToModel), newest first (?page=&start=&end=) */
export const getTransferHistory = tryCatch(async (req, res) => {
  const page = pageOf(req.query);
  const size = sizeOf(req.query);
  const range = rangeOf(req.query);
  const params = { from: (page - 1) * size, size, ...range };
  const when = timeWhere("t.RefDate", range);
  const names = ["Ref No", "Transferred On", "Serial", "From", "To", "Qty", "Transferred By"];
  const [rows, total] = await Promise.all([
    query(
      `select t.Refno [Ref No], format(t.RefDate, 'dd-MM-yyyy hh:mm:ss tt') [Transferred On], t.StartSerial [Serial],
          isnull(s.Name, cast(t.SrcMaterial as nvarchar(30))) [From], isnull(d.Name, cast(t.DestMaterial as nvarchar(30))) [To],
          cast(t.Qty as int) [Qty], isnull(u.UserName, cast(t.UserCode as nvarchar(20))) [Transferred By]
        from ModelToModel t
        left join Material s on s.MatCode = t.SrcMaterial
        left join Material d on d.MatCode = t.DestMaterial
        left join Users u on u.UserCode = t.UserCode
        where 1=1${when}
        order by t.RefDate desc offset @from rows fetch next @size rows only`,
      params,
    ),
    scalar(`select count(*) from ModelToModel t where 1=1${when}`, params),
  ]);
  res.json({ success: true, data: listShape(rows, names, total, page, size) });
});
