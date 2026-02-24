import sql, { dbConfig1 } from "../../config/db.config.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";
import { convertToIST } from "../../utils/convertToIST.js";

export const getDispatchHoldDetails = tryCatch(async (req, res) => {
  const { startDate, endDate, status } = req.query;

  if (!startDate || !endDate) {
    throw new AppError(
      "Missing required query parameters: startDate or endDate.",
      400
    );
  }

  const istStart = convertToIST(startDate);
  const istEnd = convertToIST(endDate);

  let statusCondition = "";
  if (status) {
    const lowerStatus = status.toLowerCase();
    if (lowerStatus === "hold") {
      statusCondition =
        "dh.HoldDatetime BETWEEN @startDate AND @endDate AND mb.Status = 11 AND dh.ReleasedDateTime IS NULL ORDER BY dh.HoldDatetime DESC";
    } else if (lowerStatus === "release") {
      statusCondition =
        "dh.ReleasedDateTime BETWEEN @startDate AND @endDate AND dh.ReleasedDateTime IS NOT NULL ORDER BY dh.ReleasedDateTime DESC";
    } else {
      statusCondition = `    	mb.Status IN (1, 11)
	AND dh.HoldDatetime BETWEEN @startDate AND @endDate
    ORDER BY
      dh.HoldDatetime DESC`;
    }
  }

  const query = `
    SELECT
      m.Name AS ModelNo,
      dh.Serial AS FGSerialNo,
      dh.DefectCode AS HoldReason,
      dh.HoldDatetime AS HoldDate,
      u.UserName AS HoldBy,
      DATEDIFF(
        DAY,
        dh.HoldDateTime,
        ISNULL(dh.ReleasedDateTime, GETDATE())
    ) AS DaysOnHold,
      ISNULL(dh.Action, 'Not Released') AS CorrectiveAction,
      dh.ReleasedDateTime AS ReleasedOn,
      us.UserName AS ReleasedBy,
      CASE
        WHEN dh.ReleasedDateTime IS NULL THEN 'Hold'
        ELSE 'Release'
      END AS Status
    FROM DispatchHold AS dh
    INNER JOIN MaterialBarcode mb ON mb.Serial = dh.Serial
    INNER JOIN Material m ON m.MatCode = dh.Material
    LEFT JOIN Users u ON u.UserCode = dh.HoldUserCode
    LEFT JOIN Users us ON us.UserCode = dh.ReleasedUserCode
    WHERE
    ${statusCondition};
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool
      .request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate", sql.DateTime, istEnd)
      .query(query);

    res.status(200).json({
      success: true,
      message: "Dispatch Hold Details data retrieved successfully.",
      data: result.recordset,
      totalCount: result.recordset.length,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch the Dispatch Hold Details data:${error.message}`,
      500
    );
  } finally {
    await pool.close();
  }
});
