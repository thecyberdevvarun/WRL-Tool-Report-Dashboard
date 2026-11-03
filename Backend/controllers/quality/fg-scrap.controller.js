// FG Scrap (copied from Garuda: server/src/modules/production/fg-scraps): a unit taken out of production. The browser
// sends the serial, the category and the remark; the job card and components come from the server's own lookup. All in
// one transaction; a unit already scrapped is refused; the category is checked against the list.
// Dashboard rule (owner, 3 Nov 2026): a unit whose FG label is printed (its job card has a label from an FG label
// printing stage) can be scrapped by a Super Admin only.
import { tryCatch } from "../../utils/try-catch.js";
import { AppError } from "../../utils/app-error.js";
import { execute, query, scalar, transaction } from "../../utils/garuda-db.js";
import { ctxOf, listShape, netInt, netString, pageOf, sizeOf, rangeOf, timeWhere } from "../../utils/garuda-convert.js";

const SCRAPPED = 99;
const FG_STAGE = 6; // ProductionProcess.ProdcutionStage of FG / SUS FG LABEL PRINTING
const ALREADY = "This unit is already scrapped";
const FG_PRINTED = "The FG label of this unit is printed: only a Super Admin can scrap it.";
const MAX_SERIAL = 100;
const MAX_REMARK = 150; // FGScrap.Remark

const pad = (n) => String(n).padStart(2, "0");
/** a scrapped component's serial, as the original marks it (the minutes, not the seconds) */
const scrappedSerial = (serial, d = new Date()) => `${netString(serial)}-SCRAP${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${String(d.getFullYear()).slice(-2)}-${pad(d.getMinutes())}`;

const componentStatus = async (serial) => netInt(await scalar("Select Status from MaterialBarcode where Serial=@s", { s: serial }));
/** the unit's job card has a label from an FG label printing stage: usually its stage label (ProcessStageLabel at that
 *  stage, while the label's barcode row stays at component scanning), else a barcode row made at that stage */
const fgLabelPrinted = async (serial) =>
  (await query(
    `declare @doc nvarchar(30) = (select top 1 DocNo from MaterialBarcode where Serial=@s);
    select 1 x where exists (select 1 from ProcessStageLabel l join ProductionProcess p on p.ProcessCode = l.ProcessCode
        where p.ProdcutionStage = ${FG_STAGE} and l.PSNo = @doc)
      or exists (select 1 from MaterialBarcode f join ProductionProcess p on p.ProcessCode = f.ProcessCode
        where p.ProdcutionStage = ${FG_STAGE} and f.DocNo = @doc)`,
    { s: serial },
  )).length > 0;

const serialOf = (v) => {
  const s = netString(v).trim();
  if (s === "") throw new AppError("Scan the unit", 400);
  if (s.length > MAX_SERIAL) throw new AppError(`A serial has at most ${MAX_SERIAL} characters`, 400);
  return s;
};

const categoryList = async () => (await query("Select ID, Type from ScrapReasons")).map((r) => ({ value: netString(r.ID), label: netString(r.Type).trim() }));

export const getScrapCategories = tryCatch(async (_req, res) => {
  res.json({ success: true, data: await categoryList() });
});

/** the unit and its components: { serial, fgLabelPrinted, components: [{ category, material, process, serial }] } */
export const getScrapUnit = tryCatch(async (req, res) => {
  const serial = serialOf(req.params.serial);
  const ctx = await ctxOf(req);
  const rows = await query(
    "Select mc.Type[Category]  , m.Name[Material],w.Name[Process],pb.Serial from ProcessInputBOMScan pb inner join ProductionProcess w on pb.processCode  =w.ProcessCode  inner join Material m on pb.Material=m.MatCode  left join MaterialCategoryType mc on m.Type =mc.ID where pb.PSNo=(Select DocNo from MaterialBarcode where Serial=@s)",
    { s: serial },
  );
  if (!rows.length) throw new AppError("Invaild Barcode Scanned", 400);
  if ((await componentStatus(serial)) === SCRAPPED) throw new AppError(ALREADY, 400);
  const printed = await fgLabelPrinted(serial);
  if (printed && !ctx.superAdmin) throw new AppError(FG_PRINTED, 403);
  res.json({
    success: true,
    data: { serial, fgLabelPrinted: printed, components: rows.map((r) => ({ category: netString(r.Category), material: netString(r.Material), process: netString(r.Process), serial: netString(r.Serial) })) },
  });
});

/** { unit, category, remark }: the unit scrapped, or nothing changed */
export const scrapUnit = tryCatch(async (req, res) => {
  const text = (v) => (typeof v === "string" || typeof v === "number" ? String(v).trim() : "");
  const serial = serialOf(req.body?.unit);
  const category = text(req.body?.category);
  const remark = text(req.body?.remark);
  if (!/^\d+$/.test(category)) throw new AppError("Choose a scrap category", 400);
  if (remark === "") throw new AppError("Please Enter Remark", 400);
  if (remark.length > MAX_REMARK) throw new AppError(`A remark has at most ${MAX_REMARK} characters`, 400);
  const ctx = await ctxOf(req);
  if ((await componentStatus(serial)) === SCRAPPED) throw new AppError(ALREADY, 400);
  if ((await fgLabelPrinted(serial)) && !ctx.superAdmin) throw new AppError(FG_PRINTED, 403);
  if (!(await categoryList()).some((c) => c.value === category)) throw new AppError("Choose a scrap category from the list", 400);
  const rows = await query("Select PSNo, BarcodeNo, Serial from ProcessInputBOMScan where PSNo=(select DocNo from MaterialBarcode where Serial=@s)", { s: serial });
  if (!rows.length) throw new AppError("This barcode is not known, or it has no scanned components", 400);
  await transaction(async (tx) => {
    // locked and checked again: a second request for this unit waits here, and finds it already scrapped
    const [now] = await query("select Status from MaterialBarcode with (updlock, rowlock) where Serial=@s", { s: serial }, tx);
    if (netInt(now?.Status) === SCRAPPED) throw new AppError(ALREADY, 400);
    const station = await scalar("select top 1 StationCode from ProcessActivity where PSNo=@p order by ROWID desc", { p: rows[0].PSNo }, tx);
    await execute("Update MaterialBarcode set Status=@status where Serial=@s", { status: SCRAPPED, s: serial }, tx);
    const at = new Date();
    for (const r of rows) {
      const marked = scrappedSerial(r.Serial, at);
      await execute("Update MaterialBarcode set Serial=@marked where BarcodeNo=@b", { marked, b: r.BarcodeNo }, tx);
      await execute("Update ProcessInputBOMScan set Serial=@marked where Serial=@old", { marked, old: r.Serial }, tx);
      await execute(
        "insert into FGScrap (BarcodeNo, Serial, PSNo, Remark, SCRAPCATEGORY, LastStation, UserID, ScrapDate) values (@b, @old, @p, @remark, @category, @station, @user, getdate())",
        { b: r.BarcodeNo, old: r.Serial, p: r.PSNo, remark, category: Number(category), station, user: ctx.userId },
        tx,
      );
    }
  });
  res.json({ success: true, message: "Unit scrapped", data: { serial } });
});

/** the units / items scrapped on job cards of the business unit, newest first (?page=&start=&end=) */
export const getScrapHistory = tryCatch(async (req, res) => {
  const ctx = await ctxOf(req);
  const page = pageOf(req.query);
  const size = sizeOf(req.query);
  const range = rangeOf(req.query);
  const params = { bu: netInt(ctx.businessUnit), from: (page - 1) * size, size, ...range };
  const when = timeWhere("s.ScrapDate", range);
  const names = ["Scrapped On", "Serial", "Material", "Scrap Category", "Last Station", "Remark", "Scrapped By"];
  const [rows, total] = await Promise.all([
    query(
      `select format(s.ScrapDate, 'dd-MM-yyyy hh:mm:ss tt') [Scrapped On], s.Serial [Serial], isnull(mi.Name, mp.Name) [Material],
          isnull(sr.Type, cast(s.SCRAPCATEGORY as nvarchar(50))) [Scrap Category], isnull(w.Name, s.LastStation) [Last Station], s.Remark [Remark],
          isnull(u.UserName, s.UserID) [Scrapped By]
        from FGScrap s
        join ProcessOrder po on po.PSNo = s.PSNo
        left join MaterialBarcode mb on mb.BarcodeNo = s.BarcodeNo
        left join Material mi on mi.MatCode = mb.Material
        left join Material mp on mp.MatCode = po.Material
        left join ScrapReasons sr on sr.ID = s.SCRAPCATEGORY
        left join WorkCenter w on w.StationCode = s.LastStation
        left join Users u on u.UserID = s.UserID
        where po.BusinessUnit = @bu${when}
        order by s.ScrapDate desc offset @from rows fetch next @size rows only`,
      params,
    ),
    scalar(`select count(*) from FGScrap s join ProcessOrder po on po.PSNo = s.PSNo where po.BusinessUnit = @bu${when}`, params),
  ]);
  res.json({ success: true, data: listShape(rows, names, total, page, size) });
});
