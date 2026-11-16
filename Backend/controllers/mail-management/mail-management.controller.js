import sql from "mssql";
import { tryCatch } from "../../utils/try-catch.js";
import { AppError } from "../../utils/app-error.js";
import { strOrNull } from "../iot/master-config/helpers.js";
import { sendTestMails } from "../../services/mail-task-tests.service.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isDuplicate = (err) => err?.number === 2627 || err?.number === 2601;

// One recipient (or all) with the list of task keys they're ticked for.
const loadRecipients = async (id = null) => {
  const req = global.pool3.request();
  if (id) req.input("id", sql.Int, id);
  const r = await req.query(`
    SELECT r.Id AS id, r.Name AS name, r.Email AS email, r.Department AS department,
           r.Designation AS designation, r.Status AS status, t.TaskKey AS taskKey
    FROM MailRecipients r
    LEFT JOIN MailRecipientTasks t ON t.RecipientId = r.Id
    ${id ? "WHERE r.Id = @id" : ""}
    ORDER BY r.Name, r.Id
  `);
  const byId = new Map();
  for (const row of r.recordset) {
    if (!byId.has(row.id)) {
      byId.set(row.id, {
        id: row.id,
        name: row.name,
        email: row.email,
        department: row.department,
        designation: row.designation,
        status: !!row.status,
        tasks: [],
      });
    }
    if (row.taskKey) byId.get(row.id).tasks.push(row.taskKey);
  }
  return [...byId.values()];
};

// Only task keys that exist in MailTasks are accepted.
const validTaskKeys = async (tasks) => {
  const list = [...new Set((Array.isArray(tasks) ? tasks : []).map(String))];
  if (!list.length) return [];
  const r = await global.pool3.request().query(`SELECT TaskKey FROM MailTasks`);
  const known = new Set(r.recordset.map((x) => x.TaskKey));
  const bad = list.filter((k) => !known.has(k));
  if (bad.length)
    throw new AppError(`Unknown mail task: ${bad.join(", ")}`, 400);
  return list;
};

// Insert (id = null) or update a recipient and replace its task ticks — one transaction.
const saveRecipient = async (id, body = {}) => {
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  if (!name) throw new AppError("Name is required", 400);
  if (!EMAIL_RE.test(email))
    throw new AppError("Enter a valid email address", 400);
  const tasks = await validTaskKeys(body.tasks);

  const tx = new sql.Transaction(global.pool3);
  await tx.begin();
  try {
    const rq = new sql.Request(tx)
      .input("name", sql.NVarChar(200), name)
      .input("email", sql.NVarChar(200), email)
      .input("dept", sql.NVarChar(200), strOrNull(body.department))
      .input("desig", sql.NVarChar(200), strOrNull(body.designation))
      .input("status", sql.Bit, body.status === false ? 0 : 1);

    let rid = id;
    if (id) {
      const u = await rq.input("id", sql.Int, id).query(`
        UPDATE MailRecipients
        SET Name = @name, Email = @email, Department = @dept, Designation = @desig,
            Status = @status, UpdatedAt = GETDATE()
        OUTPUT INSERTED.Id AS id
        WHERE Id = @id
      `);
      if (!u.recordset.length) throw new AppError("Recipient not found", 404);
    } else {
      const i = await rq.query(`
        INSERT INTO MailRecipients (Name, Email, Department, Designation, Status)
        OUTPUT INSERTED.Id AS id
        VALUES (@name, @email, @dept, @desig, @status)
      `);
      rid = i.recordset[0].id;
    }

    await new sql.Request(tx)
      .input("rid", sql.Int, rid)
      .query(`DELETE FROM MailRecipientTasks WHERE RecipientId = @rid`);
    for (const key of tasks) {
      await new sql.Request(tx)
        .input("rid", sql.Int, rid)
        .input("key", sql.NVarChar(100), key)
        .query(
          `INSERT INTO MailRecipientTasks (RecipientId, TaskKey) VALUES (@rid, @key)`,
        );
    }
    await tx.commit();
    return rid;
  } catch (err) {
    await tx.rollback().catch(() => {});
    if (isDuplicate(err))
      throw new AppError("That email is already in the list.", 400);
    throw err;
  }
};

export const getMailTasks = tryCatch(async (_req, res) => {
  const r = await global.pool3
    .request()
    .query(
      `SELECT TaskKey AS [key], Name AS name, Description AS description FROM MailTasks ORDER BY SortOrder, Name`,
    );
  res.json({ success: true, data: r.recordset });
});

export const getMailRecipients = tryCatch(async (_req, res) => {
  res.json({ success: true, data: await loadRecipients() });
});

export const createMailRecipient = tryCatch(async (req, res) => {
  const rid = await saveRecipient(null, req.body);
  res.status(201).json({ success: true, data: (await loadRecipients(rid))[0] });
});

export const updateMailRecipient = tryCatch(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new AppError("Invalid id", 400);
  await saveRecipient(id, req.body);
  res.json({ success: true, data: (await loadRecipients(id))[0] });
});

export const deleteMailRecipient = tryCatch(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new AppError("Invalid id", 400);
  await global.pool3
    .request()
    .input("id", sql.Int, id)
    .query(`DELETE FROM MailRecipients WHERE Id = @id`);
  res.json({ success: true });
});

// Sends a real test of the chosen mail(s) to this ONE saved recipient (never to anyone else).
export const testMailRecipient = tryCatch(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new AppError("Invalid id", 400);
  const [recipient] = await loadRecipients(id);
  if (!recipient) throw new AppError("Recipient not found", 404);

  const requested = Array.isArray(req.body?.tasks) ? req.body.tasks.map(String) : recipient.tasks;
  const tasks = requested.filter((k) => recipient.tasks.includes(k));
  if (!tasks.length) throw new AppError("Select at least one of this person's mails to test.", 400);

  const { startDate } = req.body || {};
  const results = await sendTestMails(recipient.email, tasks, { startDate });
  res.json({ success: true, data: results });
});
