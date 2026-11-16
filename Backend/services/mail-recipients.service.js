import sql from "mssql";

/** Emails of every ACTIVE recipient ticked for one task. */
export const getRecipientEmails = async (taskKey, pool = global.pool3) => {
  const r = await pool.request().input("k", sql.NVarChar(100), taskKey).query(`
      SELECT DISTINCT r.Email
      FROM MailRecipients r
      JOIN MailRecipientTasks t ON t.RecipientId = r.Id
      WHERE r.Status = 1 AND t.TaskKey = @k
    `);
  return r.recordset.map((x) => x.Email);
};

/**
 * Active recipients ticked for AT LEAST ONE of the given tasks, each with the
 * subset of those tasks they have: [{ email, tasks: ["task_a", ...] }]
 */
export const getRecipientsByTasks = async (taskKeys, pool = global.pool3) => {
  const keys = [...new Set(taskKeys)];
  if (!keys.length) return [];
  const req = pool.request();
  const placeholders = keys.map((k, i) => {
    req.input(`k${i}`, sql.NVarChar(100), k);
    return `@k${i}`;
  });
  const r = await req.query(`
    SELECT r.Email, t.TaskKey
    FROM MailRecipients r
    JOIN MailRecipientTasks t ON t.RecipientId = r.Id
    WHERE r.Status = 1 AND t.TaskKey IN (${placeholders.join(",")})
  `);
  const byEmail = new Map();
  for (const row of r.recordset) {
    if (!byEmail.has(row.Email))
      byEmail.set(row.Email, { email: row.Email, tasks: [] });
    byEmail.get(row.Email).tasks.push(row.TaskKey);
  }
  return [...byEmail.values()];
};
