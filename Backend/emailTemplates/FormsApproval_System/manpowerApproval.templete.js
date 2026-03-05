import transporter from "../../config/email.config.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const sendManpowerApprovalMail = async ({
  to,
  requestCode,
  departmentName,
  requiredDate,
  approvedDET,
  approvedITI,
  approvedCASUAL,
  actualDET,
  actualITI,
  actualCASUAL,
  additionalDET,
  additionalITI,
  additionalCASUAL,
  overtimeFrom,
  overtimeTo,
  overtimeTotal,
  responsibleStaff,
  justification,
  employees = [],
  role,
  pdfBuffer,
  currentStatus = "Pending",
}) => {
  try {
    const baseUrl = process.env.BACKEND_URL || "http://localhost:3000";

    const approveUrl = `${baseUrl}/api/v1/manpower/email-action/${requestCode}/${role}/approve`;
    const rejectUrl = `${baseUrl}/api/v1/manpower/email-action/${requestCode}/${role}/reject`;

    // Security only receives the final list — no action buttons
    const isSecurityRole = role === "Security";

    const employeeRows = employees.length
      ? employees
          .map(
            (emp, index) => `
        <tr>
          <td style="padding:6px;border:1px solid #ccc;text-align:center;">${index + 1}</td>
          <td style="padding:6px;border:1px solid #ccc;">${emp.empCode || ""}</td>
          <td style="padding:6px;border:1px solid #ccc;">${emp.empName || ""}</td>
          <td style="padding:6px;border:1px solid #ccc;">${emp.category || ""}</td>
          <td style="padding:6px;border:1px solid #ccc;">${emp.location || ""}</td>
          <td style="padding:6px;border:1px solid #ccc;">${emp.contactNo || ""}</td>
          <td style="padding:6px;border:1px solid #ccc;">${emp.travellingBy || ""}</td>
        </tr>`,
          )
          .join("")
      : `<tr><td colspan="7" style="padding:8px;text-align:center;border:1px solid #ccc;">No Employees Added</td></tr>`;

    const mailOptions = {
      from: {
        name: "WRL HR Automation",
        address: process.env.SMTP_USER,
      },
      to,
      subject: isSecurityRole
        ? `Approved Manpower List — ${departmentName} (${requestCode})`
        : `Manpower Approval Request — ${departmentName} (${requestCode})`,

      attachments: [
        {
          filename: "wrl-logo.png",
          path: path.join(__dirname, "../../assets/wrl-logo.png"),
          cid: "wrlLogo",
        },
        ...(pdfBuffer
          ? [
              {
                filename: `WRL-Manpower-${requestCode}.pdf`,
                content: pdfBuffer,
              },
            ]
          : []),
      ],

      html: `
      <html>
      <body style="font-family:'Times New Roman', serif; background:#ffffff; padding:40px; color:#000;">
        <div style="max-width:900px;margin:auto;">

          <!-- HEADER -->
          <div style="text-align:center;background:#003366;padding:20px;border-radius:6px 6px 0 0;">
            <img src="cid:wrlLogo" height="60" style="margin-bottom:8px;"/><br/>
            <h2 style="margin:0;color:#fff;">Western Refrigeration Pvt. Ltd.</h2>
            <h4 style="margin:5px 0 0 0;color:#cce0ff;">
              ${isSecurityRole ? "Approved Manpower List" : "Manpower Approval Request"}
            </h4>
          </div>

          <hr style="border:1px solid #003366;margin:0;"/>

          <!-- STATUS BANNER -->
          <div style="margin-top:15px;padding:10px 15px;border-left:5px solid #003366;background:#f0f4ff;">
            <strong>Current Status:</strong> ${currentStatus}
          </div>

          <!-- BASIC DETAILS -->
          <table width="100%" style="margin-top:20px;font-size:14px;border-collapse:collapse;">
            <tr>
              <td style="padding:6px;"><strong>Request Code:</strong> ${requestCode}</td>
              <td style="padding:6px;"><strong>Department:</strong> ${departmentName}</td>
            </tr>
            <tr>
              <td style="padding:6px;">
                <strong>Required Date:</strong>
                ${requiredDate ? new Date(requiredDate).toLocaleDateString("en-IN") : "-"}
              </td>
              <td style="padding:6px;"><strong>Responsible Staff:</strong> ${responsibleStaff || "-"}</td>
            </tr>
          </table>

          <!-- MANPOWER HEADCOUNT -->
          <h4 style="margin-top:25px;color:#003366;">Manpower Headcount</h4>
          <table border="1" cellpadding="8" cellspacing="0" width="100%"
                 style="border-collapse:collapse;text-align:center;font-size:13px;">
            <tr style="background:#003366;color:#fff;">
              <th style="text-align:left;padding:8px;"></th>
              <th>DET</th>
              <th>ITI</th>
              <th>CASUAL</th>
              <th>Total</th>
            </tr>
            <tr>
              <td style="text-align:left;padding:8px;"><strong>Approved</strong></td>
              <td>${approvedDET ?? 0}</td>
              <td>${approvedITI ?? 0}</td>
              <td>${approvedCASUAL ?? 0}</td>
              <td><strong>${(+approvedDET || 0) + (+approvedITI || 0) + (+approvedCASUAL || 0)}</strong></td>
            </tr>
            <tr style="background:#f9f9f9;">
              <td style="text-align:left;padding:8px;"><strong>Actual Required</strong></td>
              <td>${actualDET ?? 0}</td>
              <td>${actualITI ?? 0}</td>
              <td>${actualCASUAL ?? 0}</td>
              <td><strong>${(+actualDET || 0) + (+actualITI || 0) + (+actualCASUAL || 0)}</strong></td>
            </tr>
            <tr>
              <td style="text-align:left;padding:8px;"><strong>Additional Required</strong></td>
              <td>${additionalDET ?? 0}</td>
              <td>${additionalITI ?? 0}</td>
              <td>${additionalCASUAL ?? 0}</td>
              <td><strong>${(+additionalDET || 0) + (+additionalITI || 0) + (+additionalCASUAL || 0)}</strong></td>
            </tr>
          </table>

          <!-- OVERTIME -->
          <h4 style="margin-top:25px;color:#003366;">Overtime Details</h4>
          <table border="1" cellpadding="8" cellspacing="0" width="100%"
                 style="border-collapse:collapse;text-align:center;font-size:13px;">
            <tr style="background:#003366;color:#fff;">
              <th>From</th>
              <th>To</th>
              <th>Total Hours</th>
            </tr>
            <tr>
              <td>${overtimeFrom || "-"}</td>
              <td>${overtimeTo || "-"}</td>
              <td>${overtimeTotal ?? 0}</td>
            </tr>
          </table>

          <!-- JUSTIFICATION -->
          <h4 style="margin-top:25px;color:#003366;">Justification</h4>
          <p style="border:1px solid #ccc;padding:10px;border-radius:4px;background:#fafafa;">
            ${justification || "-"}
          </p>

          <!-- EMPLOYEE LIST -->
          <h4 style="margin-top:25px;color:#003366;">Employee List</h4>
          <table border="1" cellpadding="6" cellspacing="0" width="100%"
                 style="border-collapse:collapse;font-size:13px;">
            <tr style="background:#003366;color:#fff;">
              <th>#</th>
              <th>Emp Code</th>
              <th>Name</th>
              <th>Category</th>
              <th>Location</th>
              <th>Contact</th>
              <th>Travelling By</th>
            </tr>
            ${employeeRows}
          </table>

          <!-- SIGNATURE AREA -->
          <table width="100%" style="margin-top:50px;">
            <tr>
              <td style="text-align:left;">___________________________<br/>HOD Approval</td>
              <td style="text-align:center;">___________________________<br/>HR Approval</td>
              <td style="text-align:right;">___________________________<br/>Plant Head Approval</td>
            </tr>
          </table>

          <!-- ACTION BUTTONS — hidden for Security -->
          ${
            !isSecurityRole
              ? `
          <div style="text-align:center;margin-top:40px;">
            <a href="${approveUrl}"
               style="background:#003366;color:#fff;padding:12px 30px;
                      text-decoration:none;border-radius:4px;font-size:14px;margin-right:20px;">
              ✅ APPROVE
            </a>
            <a href="${rejectUrl}"
               style="background:#cc0000;color:#fff;padding:12px 30px;
                      text-decoration:none;border-radius:4px;font-size:14px;">
              ❌ REJECT
            </a>
          </div>`
              : `
          <div style="text-align:center;margin-top:40px;padding:15px;
                      background:#e8f5e9;border-radius:6px;border:1px solid #a5d6a7;">
            <p style="margin:0;color:#2e7d32;font-size:14px;font-weight:bold;">
              This manpower request has been fully approved. Please allow entry accordingly.
            </p>
          </div>`
          }

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

        </div>
      </body>
      </html>
      `,
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error("Mail error:", error);
    return false;
  }
};
