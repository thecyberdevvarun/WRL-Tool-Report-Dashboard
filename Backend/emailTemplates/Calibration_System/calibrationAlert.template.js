import transporter from "../../config/email.config.js";

// -------------------- Calibration Alert Email --------------------
export function sendCalibrationAlertMail(to, asset, subject, reportLink = "#") {
  if (!to) return;

  const status =
    asset.Status == "Valid"
      ? "Calibrated"
      : asset.Status == "Expired"
        ? "Expired"
        : "Due Soon";

  const html = `
        <div style="font-family:Arial;padding:15px">
          <h2 style="color:#1a73e8">${subject}</h2>
          <table border="1" cellspacing="0" cellpadding="7" style="border-collapse:collapse;width:100%;font-size:14px;margin-top:10px">
            <tr style="background:#cfe2ff;font-weight:bold;text-align:center">
              <td>Equipment</td>
              <td>ID No</td>
              <td>Least Count</td>
              <td>Range</td>
              <td>Location</td>
              <td>Last Calibrated</td>
              <td>Next Calibration</td>
              <td>Status</td>
              <td>Escalation</td>
              <td>Calibration Report</td>
              <td>Remarks</td>
            </tr>

            <tr style="text-align:center">
              <td>${asset.EquipmentName}</td>
              <td>${asset.IdentificationNo}</td>
              <td>${asset.LeastCount}</td>
              <td>${asset.RangeValue}</td>
              <td>${asset.Location}</td>
              <td>${asset.LastCalibrationDate ?? "-"}</td>
              <td>${asset.ValidTill ?? "-"}</td>
              <td><b>${status}</b></td>
              <td>${asset.EscalationLevel ?? "Not Escalated"}</td>
              <td><a href="${reportLink}" style="color:#007bff;text-decoration:underline" target="_blank">View Report</a></td>
              <td>${asset.Remarks ?? "-"}</td>
            </tr>
          </table>

          <p style="margin-top:10px;color:#e62e2e;font-weight:bold">⚠ Kindly take required action to avoid calibration expiry.</p>

          <!-- Footer -->
          <div style="margin-top:25px; font-size:12px; color:#777; border-top:1px solid #eee; padding-top:15px; text-align:center;">
            <div style="font-size:11px; color:#9a9a9a;">
              © ${new Date().getFullYear()} MES Team | Western Refrigeration Pvt. Ltd.<br/>
              This is a system-generated notification. Please do not reply to this email.
            </div>
          </div>
        </div>
    `;

  transporter.sendMail(
    { from: `Calibration System <${process.env.MAIL_ID}>`, to, subject, html },
    (err) =>
      err
        ? console.log("Mail Send Error:", err)
        : console.log("Mail sent to", to),
  );
}
