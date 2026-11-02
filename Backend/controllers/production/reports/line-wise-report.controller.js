import sql from "mssql";
import { dbConfig1 } from "../../../config/db.config.js";
import { tryCatch } from "../../../utils/try-catch.js";
import { AppError } from "../../../utils/app-error.js";

// -- Shared pool (reuse from main controller or duplicate here) ----------------
let _pool = null;
const getPool = async () => {
  if (_pool) return _pool;
  _pool = await new sql.ConnectionPool(dbConfig1).connect();
  _pool.on("error", () => {
    _pool = null;
  });
  return _pool;
};

const runTimeQuery = async (query, StartTime, EndTime) => {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("StartTime", sql.VarChar, StartTime)
    .input("EndTime", sql.VarChar, EndTime)
    .query(query);
  return result.recordset;
};

// -- Helper: builds the per-hour model breakdown CTE query --------------------
// stationCodes : array of numbers, e.g. [1220005] or [1220005, 1230013]
// remarkFilter : optional SQL fragment e.g. "AND b.Remark = 12501" (pass "" to skip)
const buildModelBreakdownQuery = (stationCodes, remarkFilter = "") => {
  const stationIn = stationCodes.join(",");
  return `
WITH Psno AS (
  SELECT DocNo, Material
  FROM MaterialBarcode
  WHERE PrintStatus = 1 AND Status <> 99 AND Type NOT IN (200)
),
Base AS (
  SELECT
    DATEPART(HOUR, b.ActivityOn)   AS TIMEHOUR,
    m.MatCode,
    m.Name,
    ISNULL(mc.Alias, 'N/A')        AS Category
  FROM Psno
  JOIN ProcessActivity  b  ON b.PSNo          = Psno.DocNo
  JOIN WorkCenter       c  ON b.StationCode   = c.StationCode
  JOIN Material         m  ON Psno.Material   = m.MatCode
  LEFT JOIN MaterialCategory mc ON mc.CategoryCode = m.Category
  WHERE
    b.ActivityType = 5
    AND c.StationCode IN (${stationIn})
    AND b.ActivityOn BETWEEN @StartTime AND @EndTime
    ${remarkFilter}
)
SELECT
  TIMEHOUR,
  MatCode,
  Name,
  Category,
  COUNT(*) AS Model_Count
FROM Base
GROUP BY TIMEHOUR, MatCode, Name, Category
ORDER BY TIMEHOUR, Model_Count DESC;`;
};

// -----------------------------------------------------------------------------
//  FINAL LOADING — model breakdown
// -----------------------------------------------------------------------------

/** All Loading stations combined (1220005 + 1230013) — no remark filter */
export const getFinalLoadingModelBreakdown = tryCatch(async (req, res) => {
  const { StartTime, EndTime } = req.query;
  const query = buildModelBreakdownQuery([1220005, 1230013]);
  try {
    const data = await runTimeQuery(query, StartTime, EndTime);
    res.status(200).json({
      success: true,
      message: "Final Loading model breakdown fetched",
      data,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Final Loading model breakdown: ${error.message}`,
      500,
    );
  }
});

/** HP Frz Loading (station 1220005, remark 12501) */
export const getFinalLoadingHPFrzModelBreakdown = tryCatch(async (req, res) => {
  const { StartTime, EndTime } = req.query;
  const query = buildModelBreakdownQuery([1220005], "AND b.Remark = 12501");
  try {
    const data = await runTimeQuery(query, StartTime, EndTime);
    res.status(200).json({
      success: true,
      message: "Final Loading HP Frz model breakdown fetched",
      data,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Final Loading HP Frz model breakdown: ${error.message}`,
      500,
    );
  }
});

/** HP Choc Loading (station 1220005, remark 12305) */
export const getFinalLoadingHPChocModelBreakdown = tryCatch(
  async (req, res) => {
    const { StartTime, EndTime } = req.query;
    const query = buildModelBreakdownQuery([1220005], "AND b.Remark = 12305");
    try {
      const data = await runTimeQuery(query, StartTime, EndTime);
      res.status(200).json({
        success: true,
        message: "Final Loading HP Choc model breakdown fetched",
        data,
      });
    } catch (error) {
      throw new AppError(
        `Failed to fetch Final Loading HP Choc model breakdown: ${error.message}`,
        500,
      );
    }
  },
);

/** HP VISI Loading (station 1220005, remark 12605) */
export const getFinalLoadingHPVISIModelBreakdown = tryCatch(
  async (req, res) => {
    const { StartTime, EndTime } = req.query;
    const query = buildModelBreakdownQuery([1220005], "AND b.Remark = 12605");
    try {
      const data = await runTimeQuery(query, StartTime, EndTime);
      res.status(200).json({
        success: true,
        message: "Final Loading HP VISI model breakdown fetched",
        data,
      });
    } catch (error) {
      throw new AppError(
        `Failed to fetch Final Loading HP VISI model breakdown: ${error.message}`,
        500,
      );
    }
  },
);

/** HP SUS Loading (station 1230013, remark 12304) */
export const getFinalLoadingHPSUSModelBreakdown = tryCatch(async (req, res) => {
  const { StartTime, EndTime } = req.query;
  const query = buildModelBreakdownQuery([1230013], "AND b.Remark = 12304");
  try {
    const data = await runTimeQuery(query, StartTime, EndTime);
    res.status(200).json({
      success: true,
      message: "Final Loading HP SUS model breakdown fetched",
      data,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Final Loading HP SUS model breakdown: ${error.message}`,
      500,
    );
  }
});

// -----------------------------------------------------------------------------
//  FINAL LINE — model breakdown
// -----------------------------------------------------------------------------

/** HP Frz Final Line (station 1220010, remark 12501) */
export const getFinalHPFrzModelBreakdown = tryCatch(async (req, res) => {
  const { StartTime, EndTime } = req.query;
  const query = buildModelBreakdownQuery([1220010], "AND b.Remark = 12501");
  try {
    const data = await runTimeQuery(query, StartTime, EndTime);
    res.status(200).json({
      success: true,
      message: "Final HP Frz model breakdown fetched",
      data,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Final HP Frz model breakdown: ${error.message}`,
      500,
    );
  }
});

/** HP Choc Final Line (station 1220010, remark 12305) */
export const getFinalHPChocModelBreakdown = tryCatch(async (req, res) => {
  const { StartTime, EndTime } = req.query;
  const query = buildModelBreakdownQuery([1220010], "AND b.Remark = 12305");
  try {
    const data = await runTimeQuery(query, StartTime, EndTime);
    res.status(200).json({
      success: true,
      message: "Final HP Choc model breakdown fetched",
      data,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Final HP Choc model breakdown: ${error.message}`,
      500,
    );
  }
});

/** HP VISI Final Line (station 1220010, remark 12605) */
export const getFinalHPVISIModelBreakdown = tryCatch(async (req, res) => {
  const { StartTime, EndTime } = req.query;
  const query = buildModelBreakdownQuery([1220010], "AND b.Remark = 12605");
  try {
    const data = await runTimeQuery(query, StartTime, EndTime);
    res.status(200).json({
      success: true,
      message: "Final HP VISI model breakdown fetched",
      data,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Final HP VISI model breakdown: ${error.message}`,
      500,
    );
  }
});

/** HP SUS Final Line (station 1230017, remark 12304) */
export const getFinalHPSUSModelBreakdown = tryCatch(async (req, res) => {
  const { StartTime, EndTime } = req.query;
  const query = buildModelBreakdownQuery([1230017], "AND b.Remark = 12304");
  try {
    const data = await runTimeQuery(query, StartTime, EndTime);
    res.status(200).json({
      success: true,
      message: "Final HP SUS model breakdown fetched",
      data,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Final HP SUS model breakdown: ${error.message}`,
      500,
    );
  }
});

// -----------------------------------------------------------------------------
//  POST FOAMING — model breakdown
// -----------------------------------------------------------------------------

/** Post Foaming Grp A (stations 1220003) */
export const getPostHPGrpAModelBreakdown = tryCatch(async (req, res) => {
  const { StartTime, EndTime } = req.query;
  const query = buildModelBreakdownQuery([1220003]);
  try {
    const data = await runTimeQuery(query, StartTime, EndTime);
    res.status(200).json({
      success: true,
      message: "Post HP Frz model breakdown fetched",
      data,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Post HP Frz model breakdown: ${error.message}`,
      500,
    );
  }
});

/** Post Foaming Grp B (stations 1220004) */
export const getPostHPGrpBModelBreakdown = tryCatch(async (req, res) => {
  const { StartTime, EndTime } = req.query;
  const query = buildModelBreakdownQuery([1220004]);
  try {
    const data = await runTimeQuery(query, StartTime, EndTime);
    res.status(200).json({
      success: true,
      message: "Post HP Frz model breakdown fetched",
      data,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Post HP Frz model breakdown: ${error.message}`,
      500,
    );
  }
});

/** Choclate Post (1230012 + 1230007) remark 12305 */
export const getChocPostHPModelBreakdown = tryCatch(async (req, res) => {
  const { StartTime, EndTime } = req.query;
  const query = buildModelBreakdownQuery(
    [1230012, 1230007],
    "AND b.Remark = 12305",
  );
  try {
    const data = await runTimeQuery(query, StartTime, EndTime);
    res.status(200).json({
      success: true,
      message: "Post HP VISI model breakdown fetched",
      data,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Post HP VISI model breakdown: ${error.message}`,
      500,
    );
  }
});

/** Manual Post (stations 1230007) */
export const getFOWPostHPModelBreakdown = tryCatch(async (req, res) => {
  const { StartTime, EndTime } = req.query;
  const query = buildModelBreakdownQuery([1230007], "AND b.Remark = 12201");
  try {
    const data = await runTimeQuery(query, StartTime, EndTime);
    res.status(200).json({
      success: true,
      message: "Post HP VISI model breakdown fetched",
      data,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Post HP VISI model breakdown: ${error.message}`,
      500,
    );
  }
});

/** Post VISI (station 1230012, remark 12605) */
export const getPostHPVISIModelBreakdown = tryCatch(async (req, res) => {
  const { StartTime, EndTime } = req.query;
  const query = buildModelBreakdownQuery([1230012], "AND b.Remark = 12605");
  try {
    const data = await runTimeQuery(query, StartTime, EndTime);
    res.status(200).json({
      success: true,
      message: "Post HP VISI model breakdown fetched",
      data,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Post HP VISI model breakdown: ${error.message}`,
      500,
    );
  }
});

/** Post SUS (station 1230012, remark 12304) */
export const getPostHPSUSModelBreakdown = tryCatch(async (req, res) => {
  const { StartTime, EndTime } = req.query;
  const query = buildModelBreakdownQuery([1230012], "AND b.Remark = 12304");
  try {
    const data = await runTimeQuery(query, StartTime, EndTime);
    res.status(200).json({
      success: true,
      message: "Post HP SUS model breakdown fetched",
      data,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Post HP SUS model breakdown: ${error.message}`,
      500,
    );
  }
});

// -----------------------------------------------------------------------------
//  FOAMING — model breakdown
// -----------------------------------------------------------------------------

/** Foaming Station A (station 1220001) */
export const getFoamingHpFomAModelBreakdown = tryCatch(async (req, res) => {
  const { StartTime, EndTime } = req.query;
  const query = buildModelBreakdownQuery([1220001]);
  try {
    const data = await runTimeQuery(query, StartTime, EndTime);
    res.status(200).json({
      success: true,
      message: "Foaming HP Fom A model breakdown fetched",
      data,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Foaming HP Fom A model breakdown: ${error.message}`,
      500,
    );
  }
});

/** Foaming Station B (station 1220002) */
export const getFoamingHpFomBModelBreakdown = tryCatch(async (req, res) => {
  const { StartTime, EndTime } = req.query;
  const query = buildModelBreakdownQuery([1220002]);
  try {
    const data = await runTimeQuery(query, StartTime, EndTime);
    res.status(200).json({
      success: true,
      message: "Foaming HP Fom B model breakdown fetched",
      data,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch Foaming HP Fom B model breakdown: ${error.message}`,
      500,
    );
  }
});
