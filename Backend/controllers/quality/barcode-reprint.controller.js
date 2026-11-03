// Material Barcode reprint (copied from Garuda: server/src/modules/masters/material-barcode-reprint.js): the FG label and
// the foaming and assembly barcodes, found by the serial scanned, printed again on a printer of the business unit, each
// reprint logged in BarcodePrintTrail with its reason. The label printed is the in-process label (DocType 4001).
//   FG        a stage label at an FG label printing stage (ProdcutionStage 6); a barcode at stage 6 with no stage label too
//   Assembly  a stage label whose serial starts with S
//   Foaming   a stage label whose serial starts with another letter (F foaming, L door / lid foaming)
// Any other barcode (component scans, GRN labels ...) is refused.
import { tryCatch } from "../../utils/try-catch.js";
import { AppError } from "../../utils/app-error.js";
import { execute, query, scalar } from "../../utils/garuda-db.js";
import { printInProcess, printerDetail, printerOnline, printerOptions } from "../../services/label-print.service.js";
import { ctxOf, listShape, netString, pageOf, sizeOf, rangeOf, timeWhere } from "../../utils/garuda-convert.js";

const FG_STAGE = 6;
const NOT_A_LABEL = "No FG label, assembly or foaming barcode has this serial.";
const MAX_CHECK = 500;
const MAX_PRINT = 50;

/** the label kind of a barcode row (see the top), or null when it is none of the three */
function kindOf({ stage, labelProcess, labelStage, serial }) {
  if (labelProcess == null) return Number(stage) === FG_STAGE ? "FG" : null;
  if (Number(labelStage) === FG_STAGE) return "FG";
  const first = String(serial ?? "").charAt(0).toUpperCase();
  if (first === "S") return "Assembly";
  return /[A-Z]/.test(first) ? "Foaming" : null;
}
/** kindOf in SQL (the history) */
const KIND_SQL = `case when psl.ProcessCode is null then case when pp.ProdcutionStage = ${FG_STAGE} then 'FG' end
    when lp.ProdcutionStage = ${FG_STAGE} then 'FG'
    when upper(left(mb.Serial, 1)) = 'S' then 'Assembly'
    when upper(left(mb.Serial, 1)) like '[A-Z]' then 'Foaming' end`;

/** each value (by Serial, or BarcodeNo) with its barcode row in the business unit, in list order; one query */
async function lookup(values, by, businessUnit) {
  const col = by === "BarcodeNo" ? "cast(mb.BarcodeNo as nvarchar(30))" : "mb.Serial";
  const rows = await query(
    `select cast(j.[key] as int) idx, mb.BarcodeNo barcodeNo, mb.Serial serial, mb.Alias alias, mb.CreatedOn createdOn,
        mb.ProcessCode process, isnull(lp.Name, pp.Name) processName, pp.ProdcutionStage stage, psl.ProcessCode labelProcess,
        lp.ProdcutionStage labelStage,
        m.MatCode materialCode, m.Name material, m.Alias materialAlias, ps.Alias jobCard, ph.Alias productionOrder,
        (select count(*) from BarcodePrintTrail t where t.BarcodeNo=mb.BarcodeNo) reprints,
        (select max(t.PrintedOn) from BarcodePrintTrail t where t.BarcodeNo=mb.BarcodeNo) lastReprint
      from openjson(@list) j
      join MaterialBarcode mb on ${col} = j.value and mb.DocType=4001 and mb.BusinessUnit=@bu
      left join ProductionProcess pp on pp.ProcessCode=mb.ProcessCode
      outer apply (select top 1 p.ProcessCode from ProcessStageLabel p where p.BarcodeNo=mb.Serial) psl
      left join ProductionProcess lp on lp.ProcessCode=psl.ProcessCode
      left join Material m on m.MatCode=mb.Material
      left join ProcessOrder ps on ps.PSNo=mb.DocNo
      left join PRODHeader ph on ph.PRODNo=ps.PRODNo`,
    { list: JSON.stringify(values), bu: netString(businessUnit) },
  );
  const at = new Map(rows.map((r) => [r.idx, r]));
  return values.map((_, i) => {
    const r = at.get(i);
    const kind = r ? kindOf(r) : null;
    if (!kind) return null;
    const { idx, stage, labelProcess, labelStage, process, ...label } = r;
    return { ...label, barcodeNo: netString(label.barcodeNo), kind };
  });
}

/** the reason and printer every reprint needs, checked once */
async function printSetup({ printer, remark }, ctx) {
  const why = netString(remark).trim();
  if (why === "") throw new AppError("Enter the reason for the reprint.", 400);
  if (why.length > 500) throw new AppError("The reason is longer than 500 characters.", 400);
  if (netString(printer) === "") throw new AppError("Select a printer.", 400);
  if (!(await printerOptions(ctx.businessUnit)).options.some((o) => o.value !== "" && o.value === netString(printer))) throw new AppError("Select a printer of your business unit.", 400);
  if (!(await printerOnline(printer))) throw new AppError("The printer is offline.", 400);
  return { why, bp: await printerDetail(printer) };
}

/** one label printed again and logged in BarcodePrintTrail */
async function printOne(label, { why, bp }, ctx) {
  await printInProcess(label.barcodeNo, bp, ctx.userId);
  await execute("Insert into BarcodePrintTrail(BarcodeNo,PrintedBy,Remark)Values(@b,@u,@r)", { b: netString(label.barcodeNo), u: ctx.userCode, r: why });
}

export const getReprintPrinters = tryCatch(async (req, res) => {
  res.json({ success: true, data: await printerOptions((await ctxOf(req)).businessUnit) });
});

/** the FG / foaming / assembly label with this serial (or barcode number) */
export const findReprintLabel = tryCatch(async (req, res) => {
  const ctx = await ctxOf(req);
  const s = netString(req.params.serial).trim();
  if (s === "" || s.length > 100) throw new AppError("Scan or type the serial of the label.", 400);
  let [hit] = await lookup([s], "Serial", ctx.businessUnit);
  if (!hit && /^\d{1,18}$/.test(s)) [hit] = await lookup([s], "BarcodeNo", ctx.businessUnit);
  if (!hit) throw new AppError(NOT_A_LABEL, 404);
  res.json({ success: true, data: hit });
});

/** { serials }: each one found (the label) or not ({ serial, error }), in list order, blanks and repeats left out */
export const checkReprintLabels = tryCatch(async (req, res) => {
  const ctx = await ctxOf(req);
  const serials = req.body?.serials;
  if (!Array.isArray(serials)) throw new AppError("Send the serials as a list.", 400);
  const list = [...new Set(serials.map((s) => netString(s).trim()).filter((s) => s !== ""))];
  if (!list.length) throw new AppError("Scan or paste at least one serial.", 400);
  if (list.length > MAX_CHECK) throw new AppError(`Check at most ${MAX_CHECK} serials at a time (${list.length} given).`, 400);
  if (list.some((s) => s.length > 100)) throw new AppError("A serial is longer than 100 characters.", 400);
  const found = await lookup(list, "Serial", ctx.businessUnit);
  res.json({ success: true, data: list.map((serial, i) => found[i] ?? { serial, error: NOT_A_LABEL }) });
});

/** { barcodeNo, printer, remark }: the label printed again */
export const reprintLabel = tryCatch(async (req, res) => {
  const ctx = await ctxOf(req);
  const setup = await printSetup(req.body ?? {}, ctx);
  const [label] = await lookup([netString(req.body?.barcodeNo)], "BarcodeNo", ctx.businessUnit);
  if (!label) throw new AppError(NOT_A_LABEL, 404);
  await printOne(label, setup, ctx);
  res.json({ success: true, data: { ...label, reprints: Number(label.reprints) + 1 } });
});

/** { barcodeNos, printer, remark }: up to MAX_PRINT labels printed in order, one reason for all; a label that fails is
 *  reported and the rest go on. [{ barcodeNo, ok, error? }] */
export const reprintLabels = tryCatch(async (req, res) => {
  const ctx = await ctxOf(req);
  const { barcodeNos } = req.body ?? {};
  if (!Array.isArray(barcodeNos) || !barcodeNos.length) throw new AppError("Send the labels to print as a list.", 400);
  if (barcodeNos.length > MAX_PRINT) throw new AppError(`Print at most ${MAX_PRINT} labels in one request.`, 400);
  const list = barcodeNos.map((b) => netString(b).trim());
  if (list.some((b) => !/^\d{1,18}$/.test(b))) throw new AppError("A barcode number is not valid.", 400);
  const setup = await printSetup(req.body, ctx);
  const labels = await lookup(list, "BarcodeNo", ctx.businessUnit);
  const out = [];
  for (const [i, label] of labels.entries()) {
    if (!label) {
      out.push({ barcodeNo: list[i], ok: false, error: NOT_A_LABEL });
      continue;
    }
    try {
      await printOne(label, setup, ctx);
      out.push({ barcodeNo: list[i], serial: label.serial, ok: true });
    } catch (e) {
      out.push({ barcodeNo: list[i], serial: label.serial, ok: false, error: e.message });
    }
  }
  res.json({ success: true, data: out });
});

/** the reprints in the business unit (BarcodePrintTrail), newest first (?page=&start=&end=) */
export const getReprintHistory = tryCatch(async (req, res) => {
  const ctx = await ctxOf(req);
  const page = pageOf(req.query);
  const size = sizeOf(req.query);
  const range = rangeOf(req.query);
  const params = { bu: ctx.businessUnit, from: (page - 1) * size, size, ...range };
  const base = `from BarcodePrintTrail t
      join MaterialBarcode mb on mb.BarcodeNo = t.BarcodeNo and mb.DocType = 4001 and mb.BusinessUnit = @bu
      left join ProductionProcess pp on pp.ProcessCode = mb.ProcessCode
      outer apply (select top 1 p.ProcessCode from ProcessStageLabel p where p.BarcodeNo = mb.Serial) psl
      left join ProductionProcess lp on lp.ProcessCode = psl.ProcessCode
      where ${KIND_SQL} is not null${timeWhere("t.PrintedOn", range)}`;
  const names = ["Reprinted On", "Label", "Serial", "Material", "Job Card", "Reason", "Reprinted By"];
  const [rows, total] = await Promise.all([
    query(
      `select format(t.PrintedOn, 'dd-MM-yyyy hh:mm:ss tt') [Reprinted On], ${KIND_SQL} [Label], mb.Serial [Serial], m.Name [Material],
          ps.Alias [Job Card], t.Remark [Reason], isnull(u.UserName, cast(t.PrintedBy as nvarchar(20))) [Reprinted By]
        ${base.replace("left join ProductionProcess", "left join Material m on m.MatCode = mb.Material\n      left join ProcessOrder ps on ps.PSNo = mb.DocNo\n      left join Users u on u.UserCode = t.PrintedBy\n      left join ProductionProcess")}
        order by t.PrintedOn desc offset @from rows fetch next @size rows only`,
      params,
    ),
    scalar(`select count(*) ${base}`, params),
  ]);
  res.json({ success: true, data: listShape(rows, names, total, page, size) });
});
