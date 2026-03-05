import transporter from "../../config/email.config.js";

// -------------------- Task Completed Email --------------------
export const sendTaskCompletedMail = async ({
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

    const recipients = assignedTo
      .split(",")
      .map((email) => email.trim())
      .filter((email) => email !== "");

    if (recipients.length === 0) {
      console.warn(`No valid recipient emails for task "${title}"`);
      return false;
    }

    const currentYear = new Date().getFullYear();
    const taskUrl = `${process.env.FRONTEND_URL}${process.env.TASK_OVERVIEW_PATH}`;

    const mailOptions = {
      from: {
        name: "Task Notification",
        address: process.env.SMTP_USER,
      },
      to: recipients,
      subject: `Task Completed: ${title}`,
      html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Task Completed</title>
      </head>
      <body style="margin:0; padding:0; font-family:Segoe UI, Arial, sans-serif; background-color:#f4f4f7;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f7; padding:30px 0;">
          <tr>
            <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff; border-radius:12px; box-shadow:0 6px 20px rgba(0,0,0,0.1); overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background-color:#28a745; color:#ffffff; padding:30px 20px; text-align:center;">
              <h1 style="margin:0; font-size:26px;">Task Completed</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:30px 25px; line-height:1.6; color:#333;">
              <p style="margin:0 0 18px 0; font-size:15px;">Hello, ${
                assignedUserName || "Team Member"
              },</p>
              <p style="margin:0 0 18px 0; font-size:15px;">The following task has been marked as <strong>Completed</strong>. Great job!</p>

              <!-- Highlight Section -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#e6ffed; border-radius:8px; padding:20px 25px; margin:20px 0;">
                <tr>
                  <td style="font-size:15px; color:#333;">
                    <p style="margin-bottom:12px;"><strong style="color:#28a745;">Task Title:</strong> ${title}</p>
                    <p style="margin-bottom:12px;"><strong style="color:#28a745;">Description:</strong> ${
                      description || "N/A"
                    }</p>
                    <p style="margin-bottom:12px;"><strong style="color:#28a745;">Department:</strong> ${
                      department || "N/A"
                    }</p>
                    <p style="margin-bottom:12px;"><strong style="color:#28a745;">Priority:</strong> ${
                      priority || "Normal"
                    }</p>
                    <p style="margin-bottom:12px;"><strong style="color:#28a745;">Due Date:</strong> ${
                      dueDate ? new Date(dueDate).toLocaleString() : "N/A"
                    }</p>
                    <p style="margin-bottom:12px;"><strong style="color:#28a745;">Reminder Count:</strong> ${reminderCount}</p>
                    <p style="margin-bottom:12px;"><strong style="color:#28a745;">Status:</strong> ${status}</p>
                  </td>
                </tr>
              </table>

              <p style="font-weight:600; color:#28a745;">You can view this task in the WRL Tool Report:</p>

              <!-- Outlook-safe button -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top:20px;">
                <tr>
                  <td align="center">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" bgcolor="#28a745" style="border-radius:8px;">
                          <a href="${taskUrl}" target="_blank" style="display:inline-block; padding:14px 28px; font-family:Segoe UI, Arial, sans-serif; font-size:16px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:8px; border:1px solid #218838;">
                            View Task
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

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
      `Task completed email sent to ${recipients.join(", ")} — Message ID: ${
        info.messageId
      }`,
    );
    return true;
  } catch (error) {
    console.error(
      `Failed to send task completed email for "${title}":`,
      error.message,
    );
    return false;
  }
};
