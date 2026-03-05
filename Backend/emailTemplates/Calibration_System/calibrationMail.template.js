import transporter from "../../config/email.config.js";

/* ================= EMAIL SUBJECTS ================= */
export const ESCALATION_SUBJECTS = {
  0: "Calibration Due Soon (15 Days)",
  1: "Calibration Warning (10 Days)",
  2: "Calibration CRITICAL (5 Days)",
  3: "AUDIT RISK – Calibration Overdue",
};

/* ================= SEND MAIL ================= */
export const sendCalibrationMail = async ({ level, asset, to, cc }) => {
  const html = `
<div style="font-family:Arial,sans-serif">

  <h3 style="color:#b91c1c">
    Calibration Escalation – Level L${level}
  </h3>

  <table border="1" cellpadding="8" cellspacing="0"
         style="border-collapse:collapse">
    <tr><td><b>Equipment</b></td><td>${asset.EquipmentName}</td></tr>
    <tr><td><b>Identification</b></td><td>${asset.IdentificationNo}</td></tr>
    <tr><td><b>Location</b></td><td>${asset.Location}</td></tr>
    <tr><td><b>Next Due Date</b></td><td>${asset.NextCalibrationDate}</td></tr>
    <tr><td><b>Days Left</b></td><td>${asset.DaysLeft}</td></tr>
  </table>

  <p style="color:#dc2626;font-weight:bold;margin-top:10px">
    Immediate action required to avoid audit non-compliance.
  </p>

  <!-- Footer -->
  <div style="margin-top:25px; font-size:12px; color:#777; border-top:1px solid #eee; padding-top:15px; text-align:center;">
    <div style="font-size:11px; color:#9a9a9a;">
      © ${new Date().getFullYear()} MES Team | Western Refrigeration Pvt. Ltd.<br/>
      This is a system-generated notification. Please do not reply to this email.
    </div>
  </div>

</div>
  `;

  await transporter.sendMail({
    from: `"Calibration System" <${process.env.SMTP_USER}>`,
    to,
    cc,
    subject: ESCALATION_SUBJECTS[level],
    html,
  });
};
