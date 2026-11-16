import sql from "mssql";
import { MAIL_TASKS } from "./mail-tasks.registry.js";

const createTables = async (pool3) => {
  await pool3.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'MailTasks')
    BEGIN
      CREATE TABLE MailTasks (
        TaskKey     NVARCHAR(100) NOT NULL PRIMARY KEY,
        Name        NVARCHAR(200) NOT NULL,
        Description NVARCHAR(500) NULL,
        SortOrder   INT           NOT NULL DEFAULT 0
      );
    END

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'MailRecipients')
    BEGIN
      CREATE TABLE MailRecipients (
        Id          INT IDENTITY(1,1) PRIMARY KEY,
        Name        NVARCHAR(200) NOT NULL,
        Email       NVARCHAR(200) NOT NULL UNIQUE,
        Department  NVARCHAR(200) NULL,
        Designation NVARCHAR(200) NULL,
        Status      BIT           NOT NULL DEFAULT 1,
        CreatedAt   DATETIME      NOT NULL DEFAULT GETDATE(),
        UpdatedAt   DATETIME      NOT NULL DEFAULT GETDATE()
      );
    END

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'MailRecipientTasks')
    BEGIN
      CREATE TABLE MailRecipientTasks (
        RecipientId INT           NOT NULL REFERENCES MailRecipients(Id) ON DELETE CASCADE,
        TaskKey     NVARCHAR(100) NOT NULL REFERENCES MailTasks(TaskKey),
        PRIMARY KEY (RecipientId, TaskKey)
      );
    END
  `);
};

const syncTasks = async (pool3) => {
  for (const [i, t] of MAIL_TASKS.entries()) {
    await pool3
      .request()
      .input("k", sql.NVarChar(100), t.key)
      .input("n", sql.NVarChar(200), t.name)
      .input("d", sql.NVarChar(500), t.description ?? null)
      .input("o", sql.Int, (i + 1) * 10).query(`
        MERGE MailTasks AS t
        USING (SELECT @k AS TaskKey) AS s ON t.TaskKey = s.TaskKey
        WHEN MATCHED THEN UPDATE SET Name = @n, Description = @d, SortOrder = @o
        WHEN NOT MATCHED THEN INSERT (TaskKey, Name, Description, SortOrder) VALUES (@k, @n, @d, @o);
      `);
  }
};

// One-time copy of the two old lists into the new tables. Guarded by an AppSettings
// flag, so deleting everyone later never re-imports.
const importLegacy = async (pool3, pool1) => {
  const done = await pool3
    .request()
    .input("k", sql.NVarChar(100), LEGACY_FLAG)
    .query(`SELECT 1 AS x FROM AppSettings WHERE SettingKey = @k`);
  if (done.recordset.length) return;

  const people = new Map(); // lower-cased email → person
  const add = (p) => {
    const email = String(p.email || "").trim();
    if (!email) return;
    const key = email.toLowerCase();
    const cur = people.get(key);
    if (!cur) {
      people.set(key, {
        name: (p.name || "").trim() || email.split("@")[0],
        email,
        department: p.department || null,
        designation: p.designation || null,
        status: !!p.status,
        tasks: new Set(p.tasks),
      });
    } else {
      p.tasks.forEach((t) => cur.tasks.add(t));
      cur.status = cur.status || !!p.status; // on both lists: active if active on either
    }
  };

  const subs = await pool3
    .request()
    .query(
      `SELECT EmpName, Email, Department, Designation, Subscriptions, Status FROM MailSubscribers`,
    );
  for (const s of subs.recordset) {
    const tasks = (s.Subscriptions || "")
      .split("|")
      .map((x) => x.trim())
      .map((x) => TOKEN_TO_TASK[x])
      .filter(Boolean);
    add({
      name: s.EmpName,
      email: s.Email,
      department: s.Department,
      designation: s.Designation,
      status: s.Status,
      tasks,
    });
  }

  // If this read fails we abort the whole import (flag NOT set) so it retries next start.
  const chem = await pool1
    .request()
    .query(`SELECT Name, Email, Status FROM ChemBulkStorageRecipients`);
  for (const c of chem.recordset) {
    add({
      name: c.Name,
      email: c.Email,
      status: c.Status,
      tasks: ["chemical_bulk_storage"],
    });
  }

  const tx = new sql.Transaction(pool3);
  await tx.begin();
  try {
    for (const p of people.values()) {
      const ins = await new sql.Request(tx)
        .input("name", sql.NVarChar(200), p.name)
        .input("email", sql.NVarChar(200), p.email)
        .input("dept", sql.NVarChar(200), p.department)
        .input("desig", sql.NVarChar(200), p.designation)
        .input("status", sql.Bit, p.status ? 1 : 0).query(`
          INSERT INTO MailRecipients (Name, Email, Department, Designation, Status)
          OUTPUT INSERTED.Id AS id
          VALUES (@name, @email, @dept, @desig, @status)
        `);
      const rid = ins.recordset[0].id;
      for (const key of p.tasks) {
        await new sql.Request(tx)
          .input("rid", sql.Int, rid)
          .input("key", sql.NVarChar(100), key)
          .query(
            `INSERT INTO MailRecipientTasks (RecipientId, TaskKey) VALUES (@rid, @key)`,
          );
      }
    }
    await new sql.Request(tx)
      .input("k", sql.NVarChar(100), LEGACY_FLAG)
      .query(
        `INSERT INTO AppSettings (SettingKey, Value, UpdatedBy) VALUES (@k, 'done', 'system')`,
      );
    await tx.commit();
    console.log(
      `[MailManagement] Imported ${people.size} recipient(s) from the old mail lists.`,
    );
  } catch (err) {
    await tx.rollback().catch(() => {});
    throw err;
  }
};

export const runMailManagementMigration = async (pool3) => {
  await createTables(pool3);
  await syncTasks(pool3);
};
