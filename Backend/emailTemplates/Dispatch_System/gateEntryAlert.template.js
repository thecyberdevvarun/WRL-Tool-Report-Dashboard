import transporter from "../../config/email.config.js";

// -------------------- Gate Entry Alert Email --------------------
export const sendGateEntryAlertMail = async (gateEntries) => {
  try {
    if (!Array.isArray(gateEntries) || gateEntries.length === 0) {
      console.warn("No Gate Entry data to email.");
      return false;
    }

    const headers = [
      "GATE ENTRY NUMBER",
      "GATE ENTRY DATE",
      "PO NUMBER",
      "LINE ITEM",
      "PO DATE",
      "INVOICE VALUE",
      "BASIC RATE",
      "HSN CODE AS PER INVOICE",
      "GRN:103",
      "GRN:101 /105",
      "SUPPLIER CODE",
      "SUPPLIER NAME",
      "INVOICE NO.",
      "INVOICE DATE",
      "ITEM CODE",
      "DESCRIPTION OF THE GOODS",
      "UOM",
      "INVOICE QTY.",
      "RECEIVED QTY.",
      "DISCREPANCY",
      "MATERIAL GROUP",
      "VEHICLE NO.",
      "DELIVERY TYPE",
      "VEHICLE NAME",
      "VEHICLE TYPE",
      "FUEL TYPE",
      "TOTAL CARRYING CAPACITY OF THE VEHICLE",
      "REMARKS",
    ];

    const tableRows = gateEntries
      .map(
        (entry) => `
      <tr>${headers.map((h, i) => `<td>${entry[i] || ""}</td>`).join("")}</tr>
    `,
      )
      .join("");

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f4f6f9;
      font-family: Arial, sans-serif;
    }

    .container {
      width: 95%;
      max-width: 1200px;
      margin: 20px auto;
      background: #ffffff;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
      padding: 20px;
    }

    .header {
      background: linear-gradient(90deg, #2575fc, #1a5edb);
      color: white;
      padding: 15px 20px;
      border-radius: 6px 6px 0 0;
      font-size: 18px;
      font-weight: bold;
      text-align: center;
      letter-spacing: 0.5px;
    }

    .subtext {
      font-size: 13px;
      color: #666;
      margin: 15px 0;
    }

    table {
      border-collapse: collapse;
      width: 100%;
      font-size: 12px;
    }

    th {
      background-color: #2575fc;
      color: white;
      padding: 8px;
      text-align: left;
      position: sticky;
      top: 0;
    }

    td {
      padding: 6px;
      border: 1px solid #e0e0e0;
    }

    tr:nth-child(even) {
      background-color: #f9fbff;
    }

    tr:hover {
      background-color: #eef3ff;
    }

    .footer {
      margin-top: 25px;
      font-size: 12px;
      color: #777;
      border-top: 1px solid #eee;
      padding-top: 10px;
    }

    .highlight {
      color: #2575fc;
      font-weight: bold;
    }

  </style>
</head>

<body>
  <div class="container">
    
    <div class="header">
      Gate Entry Report
    </div>

    <p class="subtext">
      Please find below the latest <span class="highlight">Gate Entry details</span>.
      This is an automated notification from the WRL Security System.
    </p>

    <table>
      <thead>
        <tr>
          ${headers.map((h) => `<th>${h}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
    
    <div class="footer" style="margin-top:25px; font-size:12px; color:#777; border-top:1px solid #eee; padding-top:15px; text-align:center;">
  <div style="font-size:11px; color:#9a9a9a;">
    © 2026 MES Team | Western Refrigeration Pvt. Ltd.<br/>
    This is a system-generated notification. Please do not reply to this email.
  </div>
</div>
  </div>
</body>
</html>
    `;

    const mailOptions = {
      from: { name: "WRL Inward Alert", address: process.env.SMTP_USER },
      to: [
        "sujith.s@westernequipments.com",
        "rahul.bagul@westernequipments.com",
        "shubhanshu.dixit@westernequipments.com",
        "shubham.singh@westernequipments.com",
        "ashutosh.jena@westernequipments.com",
        "jenish.gandhi@westernequipments.com",
        "mayank.garg@westernequipments.com",
        "devesh.gaur@westernequipments.com",
        "vinay.yadav@westernequipments.com",
        "rushikesh.naik@westernequipments.com",
        "harshal.prajapati@westernequipments.com",
        "vaikunth.surve@westernequipments.com",
        "store.tadgam@westernequipments.com",
        "vikash.kumar@westernequipments.com",
        "vatsal.patel@westernequipments.com",
      ],
      subject: "Gate Entry Report",
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Gate Entry report email sent:", info.messageId);
    return true;
  } catch (error) {
    console.error("Error sending Gate Entry email:", error);
    return false;
  }
};
