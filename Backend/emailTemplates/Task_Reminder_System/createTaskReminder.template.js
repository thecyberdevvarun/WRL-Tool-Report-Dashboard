import transporter from "../../config/email.config.js";

// -------------------- Create Task Reminder Email --------------------
export const sendTaskReminderMail = async ({
  title,
  description,
  assignedTo,
  assignedUserName,
  department,
  priority,
  dueDate,
  reminderCount,
  status,
}) => {
  try {
    // Validate recipients
    if (!assignedTo || assignedTo.trim() === "") {
      console.warn(`No recipient email provided for task "${title}"`);
      return false;
    }

    // Support comma-separated emails
    const recipients = assignedTo
      .split(",")
      .map((email) => email.trim())
      .filter((email) => email !== "");

    if (recipients.length === 0) {
      console.warn(`No valid recipient emails for task "${title}"`);
      return false;
    }

    const currentYear = new Date().getFullYear();

    // const taskUrl = `${FRONTEND_URL}${TASK_OVERVIEW_PATH}?taskId=${taskId}`;
    const taskUrl = `${process.env.FRONTEND_URL}${process.env.TASK_OVERVIEW_PATH}`;

    const mailOptions = {
      from: {
        name: "Task Reminder",
        address: process.env.SMTP_USER,
      },
      to: recipients,
      subject: `Task Reminder: ${title}`,
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Task Reminder</title>
        </head>
        <body style="margin:0; padding:0; font-family:Segoe UI, Arial, sans-serif; background-color:#f4f4f7;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f7; padding:30px 0;">
            <tr>
              <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff; border-radius:12px; box-shadow:0 6px 20px rgba(0,0,0,0.1); overflow:hidden;">
          
          <!-- Header -->
          <tr>
            <td style="background-color:#0052cc; color:#ffffff; padding:30px 20px; text-align:center;">
              <h1 style="margin:0; font-size:26px;">Task Reminder</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:30px 25px; line-height:1.6; color:#333;">
              <p style="margin:0 0 18px 0; font-size:15px;">Hello, ${
                assignedUserName || "Team Member"
              },</p>
              <p style="margin:0 0 18px 0; font-size:15px;">This is a reminder mail for a task assigned to you. Please review the details below and update the status in the WRL Tool Report if the task has been completed.</p>

              <!-- Highlight Section -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f8ff; border-radius:8px; padding:20px 25px; margin:20px 0;">
                <tr>
                  <td style="font-size:15px; color:#333;">
                    <p style="margin-bottom:12px;"><strong style="color:#0052cc;">Task Title:</strong> ${title}</p>
                    <p style="margin-bottom:12px;"><strong style="color:#0052cc;">Description:</strong> ${
                      description || "N/A"
                    }</p>
                    <p style="margin-bottom:12px;"><strong style="color:#0052cc;">Department:</strong> ${
                      department || "N/A"
                    }</p>
                    <p style="margin-bottom:12px;"><strong style="color:#0052cc;">Priority:</strong> ${
                      priority || "Normal"
                    }</p>
                    <p style="margin-bottom:12px;"><strong style="color:#0052cc;">Due Date:</strong> ${
                      dueDate ? new Date(dueDate).toLocaleString() : "N/A"
                    }</p>
                    <p style="margin-bottom:12px;"><strong style="color:#0052cc;">Reminder Count:</strong> ${reminderCount}</p>
                    <p style="margin-bottom:12px;"><strong style="color:#0052cc;">Status:</strong> ${status} </p>
                  </td>
                </tr>
              </table>

              <p style="font-weight:600; color:#0052cc;">You can update the task status directly in the WRL Tool Report:</p>

              <!-- Outlook-safe button -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top:20px;">
                <tr>
                  <td align="center">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" bgcolor="#0052cc" style="border-radius:8px;">
                          <a href="${taskUrl}" target="_blank" style="display:inline-block; padding:14px 28px; font-family:Segoe UI, Arial, sans-serif; font-size:16px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:8px; border:1px solid #0041a8;">
                            Go to Task
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin-top:20px; font-size:15px;">If you have already completed this task, updating the status will prevent further reminders.</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:12px;">
              <div style="font-size:12px; color:#777; border-top:1px solid #eee; padding-top:15px; text-align:center;">
                <div style="font-size:11px; color:#9a9a9a;">
                  © ${currentYear} MES Team | Western Refrigeration Pvt. Ltd.<br/>
                  This is a system-generated notification. Please do not reply to this email.
                </div>
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(
      `Task reminder email sent to ${recipients.join(", ")} — Message ID: ${
        info.messageId
      }`,
    );
    return true;
  } catch (error) {
    console.error(
      `Failed to send task reminder email for "${title}":`,
      error.message,
    );
    return false;
  }
};
