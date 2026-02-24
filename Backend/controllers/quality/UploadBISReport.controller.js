import path from "path";
import fs from "fs";
import sql from "mssql";
import { dbConfig1 } from "../../config/db.config.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";

const uploadDir = path.resolve("uploads", "BISReport");

// Upload file controller
export const uploadBisPdfFile = tryCatch(async (req, res) => {
  const { modelName, year, month, testFrequency, description } = req.body;
  const fileName = req.file?.filename;

  if (
    !modelName ||
    !year ||
    !month ||
    !testFrequency ||
    !description ||
    !fileName
  ) {
    throw new AppError(
      "Missing required fields: modelName, year, month, testFrequency, description or fileName.",
      400,
    );
  }

  const uploadedAt = new Date(Date.now() + 330 * 60000);

  const pool = await sql.connect(dbConfig1);

  try {
    const query = `
      INSERT INTO BISUpload (ModelName, Year, Month, TestFrequency, Description, FileName, UploadAt)
      VALUES (@ModelName, @Year, @Month, @TestFrequency, @Description, @FileName, @UploadAt)
    `;
    const result = await pool
      .request()
      .input("ModelName", sql.VarChar, modelName)
      .input("Year", sql.VarChar, year)
      .input("Month", sql.VarChar, month)
      .input("TestFrequency", sql.VarChar, testFrequency)
      .input("Description", sql.VarChar, description)
      .input("FileName", sql.VarChar, fileName)
      .input("UploadAt", sql.DateTime, uploadedAt)
      .query(query);

    res.status(200).json({
      success: true,
      filename: req.file.originalname,
      fileUrl: `/uploads/BISReport/${req.file.filename}`,
      message: "Uploaded successfully",
    });
  } catch (error) {
    throw new AppError(
      `Failed to upload the BIS Report data:${error.message}`,
      500,
    );
  } finally {
    await pool.close();
  }
});

// Get files list controller
export const getBisPdfFiles = tryCatch(async (_, res) => {
  const pool = await sql.connect(dbConfig1);

  try {
    const query = `
      SELECT * FROM BISUpload
      ORDER BY SrNo DESC
    `;
    const result = await pool.request().query(query);

    const files = result.recordset.map((file) => ({
      srNo: file.SrNo,
      modelName: file.ModelName,
      year: file.Year,
      month: file.Month,
      testFrequency: file.TestFrequency,
      description: file.Description,
      fileName: file.FileName,
      url: `/uploads-bis-pdf/${file.FileName}`,
      uploadAt: file.UploadAt,
    }));

    res.status(200).json({
      success: true,
      message: "BIS PDF Files retrieved successfully.",
      files,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch the BIS PDF Files:${error.message}`,
      500,
    );
  } finally {
    await pool.close();
  }
});

// Download file controller
export const downloadBisPdfFile = tryCatch(async (req, res) => {
  const { srNo } = req.params;
  const { filename } = req.query;

  if (!srNo) {
    throw new AppError("Missing required field: SrNo.", 400);
  }

  const filePath = path.join(uploadDir, filename);
  let pool;

  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: "File not found",
      });
    }

    // Verify file in database
    pool = await sql.connect(dbConfig1);

    const query = `
      SELECT FileName, ModelName, Year, Month
      FROM BISUpload 
      WHERE SrNo = @SrNo
    `;

    const result = await pool
      .request()
      .input("SrNo", sql.Int, parseInt(srNo))
      .query(query);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "File record not found in database",
      });
    }

    // Set headers for file download
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/pdf");

    // Stream the file
    const fileStream = fs.createReadStream(filePath);

    fileStream.pipe(res);

    fileStream.on("error", (error) => {
      console.error("File streaming error:", error);
      res.status(500).json({
        success: false,
        message: "Error streaming file",
      });
    });
  } catch (error) {
    throw new AppError(
      `Failed to download Bis Pdf File data:${error.message}`,
      500,
    );
  } finally {
    await pool.close();
  }
});

// Delete file controller
export const deleteBisPdfFile = tryCatch(async (req, res) => {
  const { srNo } = req.params;
  const { filename } = req.query;

  if (!srNo) {
    throw new AppError("Missing required fields: SrNo.", 400);
  }

  const filePath = path.join(uploadDir, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: "File not found" });
  }

  try {
    // Delete the physical file
    fs.unlinkSync(filePath);

    // Connect to DB and delete the record based on filename and year
    const pool = await sql.connect(dbConfig1);
    const query = `
      DELETE FROM BISUpload 
      WHERE SrNo = @SrNo
    `;

    const result = await pool
      .request()
      .input("SrNo", sql.Int, parseInt(srNo))
      .query(query);

    res
      .status(200)
      .json({ success: true, message: "File deleted successfully" });
  } catch (error) {
    throw new AppError(
      `Failed to delete the BIS PDF file:${error.message}`,
      500,
    );
  } finally {
    await pool.close();
  }
});

// Update BIS File Controller
export const updateBisPdfFile = tryCatch(async (req, res) => {
  const { srNo } = req.params;
  const { modelName, year, month, testFrequency, description } = req.body;
  const newFile = req.file; // New file (if uploaded)

  // Validate required fields
  if (!modelName || !year || !month || !testFrequency || !description) {
    // If a new file was uploaded but validation fails, delete it
    if (newFile) {
      const newFilePath = path.join(uploadDir, newFile.filename);
      if (fs.existsSync(newFilePath)) {
        fs.unlinkSync(newFilePath);
      }
    }
    throw new AppError(
      "Missing required fields: modelName, year, month, testFrequency or description.",
      400,
    );
  }

  let pool;

  try {
    pool = await sql.connect(dbConfig1);

    // Step 1: Get the existing record to preserve the old filename
    const existingQuery = `SELECT FileName FROM BISUpload WHERE SrNo = @SrNo`;
    const existingResult = await pool
      .request()
      .input("SrNo", sql.Int, parseInt(srNo))
      .query(existingQuery);

    if (existingResult.recordset.length === 0) {
      // If record not found and new file was uploaded, delete it
      if (newFile) {
        const newFilePath = path.join(uploadDir, newFile.filename);
        if (fs.existsSync(newFilePath)) {
          fs.unlinkSync(newFilePath);
        }
      }
      return res.status(404).json({
        success: false,
        message: "Record not found",
      });
    }

    const oldFileName = existingResult.recordset[0].FileName;

    // Step 2: Determine which filename to use
    // If new file uploaded -> use new filename, else -> keep old filename
    const finalFileName = newFile ? newFile.filename : oldFileName;

    // Step 3: If new file uploaded, delete the old file from disk
    if (newFile && oldFileName) {
      const oldFilePath = path.join(uploadDir, oldFileName);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
        console.log(`Deleted old file: ${oldFileName}`);
      }
    }

    // Step 4: Update the database record
    const updateQuery = `
      UPDATE BISUpload 
      SET 
        ModelName = @ModelName, 
        Year = @Year,
        Month = @Month,
        TestFrequency = @TestFrequency,
        Description = @Description,
        FileName = @FileName
      WHERE SrNo = @SrNo
    `;

    const updateResult = await pool
      .request()
      .input("ModelName", sql.VarChar, modelName)
      .input("Year", sql.VarChar, year)
      .input("Month", sql.VarChar, month)
      .input("TestFrequency", sql.VarChar, testFrequency)
      .input("Description", sql.VarChar, description)
      .input("FileName", sql.VarChar, finalFileName) // ✅ Uses existing filename if no new file
      .input("SrNo", sql.Int, parseInt(srNo))
      .query(updateQuery);

    if (updateResult.rowsAffected[0] === 0) {
      return res.status(404).json({
        success: false,
        message: "No changes made",
      });
    }

    res.status(200).json({
      success: true,
      message: "BIS Report updated successfully",
      data: {
        srNo: srNo,
        modelName,
        year,
        month,
        testFrequency,
        description,
        fileName: finalFileName,
        fileUrl: `/uploads/BISReport/${finalFileName}`,
        fileUpdated: !!newFile, // true if new file was uploaded
      },
    });
  } catch (error) {
    console.error("Update error:", error);

    // Cleanup: If update failed and new file was uploaded, delete it
    if (newFile) {
      const newFilePath = path.join(uploadDir, newFile.filename);
      if (fs.existsSync(newFilePath)) {
        fs.unlinkSync(newFilePath);
      }
    }

    throw new AppError(`Failed to update BIS Report: ${error.message}`, 500);
  } finally {
    if (pool) {
      await pool.close();
    }
  }
});

export const getBisReportStatus = tryCatch(async (_, res) => {
  const pool = await sql.connect(dbConfig1);

  try {
    const filesQuery = `
      SELECT * FROM BISUpload
      ORDER BY SrNo DESC
    `;
    const filesResult = await pool.request().query(filesQuery);

    const files = filesResult.recordset.map((file) => ({
      srNo: file.SrNo,
      modelName: file.ModelName,
      year: file.Year,
      month: file.Month,
      testFrequency: file.testFrequency,
      description: file.Description,
      fileName: file.FileName,
      url: `/uploads-bis-pdf/${file.FileName}`,
      uploadAt: file.UploadAT,
    }));

    // Then, fetch the BIS Report Status
    const istDate = new Date(Date.now() + 330 * 60000);
    const formattedDate = istDate.toISOString().slice(0, 19).replace("T", " ");

    const statusQuery = `
      WITH Psno AS (
      SELECT DocNo, Material 
      FROM MaterialBarcode 
      WHERE PrintStatus = 1 AND Status <> 99
    ),
    FilteredData AS (
      SELECT 
        m.Name AS FullModel,
        LEFT(m.Name, 9) AS Model_Prefix,
        b.ActivityOn,
        CASE WHEN RIGHT(m.Name, 1) = 'R' THEN 'R' ELSE '' END AS HasRT
      FROM Psno
      JOIN ProcessActivity b ON b.PSNo = Psno.DocNo
      JOIN WorkCenter c ON b.StationCode = c.StationCode
      JOIN Material m ON m.MatCode = Psno.Material
      WHERE m.CertificateControl <> 0
        AND b.ActivityType = 5
        AND c.StationCode IN (1220010)
        AND b.ActivityOn BETWEEN '2022-01-01 00:00:01' AND @CurrentDate
    ),
    ProductionSummary AS (
      SELECT 
        Model_Prefix,
        YEAR(ActivityOn) AS Activity_Year,
        MAX(HasRT) AS LastChar, -- Will be 'R' if any model ends with 'R'
        COUNT(*) AS Model_Count
      FROM FilteredData
      GROUP BY Model_Prefix, YEAR(ActivityOn)
    ),
    -- Deduplicate BISUpload table
    DedupedBIS AS (
      SELECT *
        FROM (
          SELECT *,
            ROW_NUMBER() OVER (
              PARTITION BY LEFT(ModelName, 9), Year
              ORDER BY ModelName
            ) AS rn
          FROM BISUpload
        ) AS sub
      WHERE rn = 1
    ),
    FinalResult AS (
      SELECT 
        COALESCE(b.ModelName, 
                 CONCAT(p.Model_Prefix, CASE WHEN p.LastChar = 'R' THEN ' RT' ELSE '' END)
        ) AS ModelName,
        p.Activity_Year AS Year,
        b.Month,
        p.Model_Count AS Prod_Count,
        CASE 
            WHEN b.ModelName IS NOT NULL THEN 'Test Completed'
            ELSE 'Test Pending'
        END AS Status,
        b.FileName,
        b.Description
    FROM ProductionSummary p
    LEFT JOIN DedupedBIS b
      ON LEFT(b.ModelName, 9) = p.Model_Prefix
     AND b.Year = p.Activity_Year
     AND (
         RIGHT(b.ModelName, 2) != 'RT' -- normal model
         OR (RIGHT(b.ModelName, 2) = 'RT' AND p.LastChar = 'R') -- RT logic
     )
)
SELECT * 
FROM FinalResult
ORDER BY ModelName, Year;
    `;

    const statusResult = await pool
      .request()
      .input("CurrentDate", sql.DateTime, new Date(formattedDate))
      .query(statusQuery);

    const status = statusResult.recordset.map((item) => ({
      ...item,
      fileUrl: item.FileName ? `/uploads-bis-pdf/${item.FileName}` : null,
    }));

    // Combine files and status
    const combinedResult = {
      files: files,
      status: status,
    };

    res.status(200).json({
      success: true,
      message: "BIS Report status data retrieved successfully",
      ...combinedResult,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch the BIS Report status data:${error.message}`,
      500,
    );
  } finally {
    await pool.close();
  }
});
