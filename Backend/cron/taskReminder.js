import cron from "node-cron";
import sql from "mssql";
import { sendTaskReminderEmail } from "./sendTaskReminderEmail.js";
import { dbConfig4 } from "../config/db.js";

// Runs every hour
cron.schedule("0 * * * *", async () => {
  const pool = await new sql.ConnectionPool(dbConfig4).connect();

  try {
    const query = `
      SELECT *
      FROM Tasks
      WHERE 
        DueDate > GETDATE()
        AND ReminderCount > 0
    `;

    const result = await pool.request().query(query);

    for (const task of result.recordset) {
      await sendTaskReminderEmail({
        title: task.Title,
        description: task.Description,
        assignedTo: task.AssignedTo,
        department: task.Department,
        priority: task.Priority,
        dueDate: task.DueDate,
        reminderCount: task.ReminderCount,
      });

      // decrement reminder count
      await pool
        .request()
        .input("id", sql.Int, task.Id)
        .query(
          `UPDATE Tasks SET ReminderCount = ReminderCount - 1 WHERE Id = @id`
        );
    }
  } catch (err) {
    console.error("Reminder cron failed:", err);
  } finally {
    await pool.close();
  }
});
