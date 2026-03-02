import sql from "mssql";
import { dbConfig3 } from "../../config/db.config.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";
import { generateAuditCode } from "../../utils/generateCode.js";
import {
  processAuditImages,
  deleteAuditImages,
  cleanupRemovedImages,
} from "../../utils/auditImageProcessor.js";
import { deleteMultipleImages } from "../../utils/storage/imageStorage.js";

// ==================== HELPERS ====================

/**
 * Calculates audit summary from sections.
 * Supports both new structure (section.stages[].checkPoints[])
 * and old flat structure (section.checkPoints[]).
 */
const calculateSummary = (sections) => {
  let pass = 0,
    fail = 0,
    warning = 0,
    pending = 0,
    na = 0;

  if (!sections || !Array.isArray(sections)) {
    return { pass: 0, fail: 0, warning: 0, pending: 0, na: 0, total: 0 };
  }

  sections.forEach((section) => {
    if (!section) return;

    if (section.stages && Array.isArray(section.stages)) {
      // New structure: section → stages[] → checkPoints[]
      section.stages.forEach((stage) => {
        if (stage?.checkPoints && Array.isArray(stage.checkPoints)) {
          stage.checkPoints.forEach((cp) => {
            if (!cp) return;
            const status = (cp.status || "pending").toLowerCase().trim();
            if (status === "pass") pass++;
            else if (status === "fail") fail++;
            else if (status === "warning") warning++;
            else if (status === "na") na++;
            else pending++;
          });
        }
      });
    } else if (section.checkPoints && Array.isArray(section.checkPoints)) {
      // Old flat structure: section → checkPoints[]
      section.checkPoints.forEach((cp) => {
        if (!cp) return;
        const status = (cp.status || "pending").toLowerCase().trim();
        if (status === "pass") pass++;
        else if (status === "fail") fail++;
        else if (status === "warning") warning++;
        else if (status === "na") na++;
        else pending++;
      });
    }
  });

  const total = pass + fail + warning + pending + na;
  return { pass, fail, warning, pending, na, total };
};

const safeJsonParse = (str, defaultVal) => {
  if (!str) return defaultVal;
  if (typeof str === "object") return str;
  try {
    return JSON.parse(str);
  } catch {
    return defaultVal;
  }
};

// ==================== GET ALL AUDITS ====================
export const getAllAudits = tryCatch(async (req, res) => {
  const {
    templateId,
    status,
    search,
    startDate,
    endDate,
    page = 1,
    limit = 50,
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);

  let pool;
  try {
    pool = await new sql.ConnectionPool(dbConfig3).connect();
    const request = pool.request();

    const whereConditions = ["IsDeleted = 0"];

    if (templateId) {
      request.input("templateId", sql.Int, templateId);
      whereConditions.push("TemplateId = @templateId");
    }
    if (status) {
      request.input("status", sql.VarChar, status);
      whereConditions.push("Status = @status");
    }
    if (search) {
      request.input("search", sql.NVarChar, `%${search}%`);
      whereConditions.push(
        "(ReportName LIKE @search OR TemplateName LIKE @search OR AuditCode LIKE @search)",
      );
    }
    if (startDate) {
      request.input("startDate", sql.DateTime, new Date(startDate));
      whereConditions.push("CreatedAt >= @startDate");
    }
    if (endDate) {
      request.input("endDate", sql.DateTime, new Date(endDate));
      whereConditions.push("CreatedAt <= @endDate");
    }

    request.input("offset", sql.Int, offset);
    request.input("limit", sql.Int, parseInt(limit));

    const whereClause = `WHERE ${whereConditions.join(" AND ")}`;

    const result = await request.query(`
      WITH AuditData AS (
        SELECT 
          Id, AuditCode, TemplateId, TemplateName, ReportName,
          FormatNo, RevNo, RevDate, Notes, Status,
          InfoData, Sections, Summary, Signatures, Columns, InfoFields, HeaderConfig,
          CreatedBy, CreatedAt, UpdatedBy, UpdatedAt,
          SubmittedBy, SubmittedAt, ApprovedBy, ApprovedAt, ApprovalComments,
          ROW_NUMBER() OVER (ORDER BY CreatedAt DESC) AS RowNum
        FROM Audits
        ${whereClause}
      )
      SELECT 
        (SELECT COUNT(*) FROM AuditData) AS TotalCount, *
      FROM AuditData
      WHERE RowNum > @offset AND RowNum <= (@offset + @limit);
    `);

    const audits = result.recordset.map((audit) => ({
      ...audit,
      InfoData: safeJsonParse(audit.InfoData, {}),
      Sections: safeJsonParse(audit.Sections, []),
      Summary: safeJsonParse(audit.Summary, {}),
      Signatures: safeJsonParse(audit.Signatures, {}),
      Columns: safeJsonParse(audit.Columns, []),
      InfoFields: safeJsonParse(audit.InfoFields, []),
      HeaderConfig: safeJsonParse(audit.HeaderConfig, {}),
    }));

    res.status(200).json({
      success: true,
      message: "Audits retrieved successfully",
      data: audits,
      totalCount:
        result.recordset.length > 0 ? result.recordset[0].TotalCount : 0,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } finally {
    if (pool) await pool.close();
  }
});

// ==================== GET AUDIT BY ID ====================
export const getAuditById = tryCatch(async (req, res) => {
  const { id } = req.params;
  if (!id) throw new AppError("Audit ID is required", 400);

  let pool;
  try {
    pool = await new sql.ConnectionPool(dbConfig3).connect();
    const result = await pool.request().input("id", sql.Int, id).query(`
      SELECT 
        Id, AuditCode, TemplateId, TemplateName, ReportName,
        FormatNo, RevNo, RevDate, Notes, Status,
        InfoData, Sections, Columns, InfoFields, HeaderConfig,
        Signatures, Summary,
        CreatedBy, CreatedAt, UpdatedBy, UpdatedAt,
        SubmittedBy, SubmittedAt, ApprovedBy, ApprovedAt, ApprovalComments
      FROM Audits
      WHERE Id = @id AND IsDeleted = 0
    `);

    if (result.recordset.length === 0)
      throw new AppError("Audit not found", 404);

    const audit = result.recordset[0];
    res.status(200).json({
      success: true,
      message: "Audit retrieved successfully",
      data: {
        ...audit,
        InfoData: safeJsonParse(audit.InfoData, {}),
        Sections: safeJsonParse(audit.Sections, []),
        Columns: safeJsonParse(audit.Columns, []),
        InfoFields: safeJsonParse(audit.InfoFields, []),
        HeaderConfig: safeJsonParse(audit.HeaderConfig, {}),
        Signatures: safeJsonParse(audit.Signatures, {}),
        Summary: safeJsonParse(audit.Summary, {}),
      },
    });
  } finally {
    if (pool) await pool.close();
  }
});

// ==================== CREATE AUDIT ====================
export const createAudit = tryCatch(async (req, res) => {
  const {
    templateId,
    templateName,
    reportName,
    formatNo,
    revNo,
    revDate,
    notes,
    infoData,
    sections,
    columns,
    infoFields,
    headerConfig,
    signatures,
    status = "submitted",
  } = req.body;

  if (!templateId || !reportName) {
    throw new AppError("Template ID and Report Name are required", 400);
  }

  const auditCode = await generateAuditCode("AUD");
  const createdBy = req.user?.userCode || "SYSTEM";

  // Process images: extract base64 objects → save to disk → replace with filenames
  const { sections: processedSections, savedImages } = await processAuditImages(
    sections,
    auditCode,
  );

  const summary = calculateSummary(processedSections);

  let pool;
  try {
    pool = await new sql.ConnectionPool(dbConfig3).connect();

    // Load template defaults if not provided
    let finalColumns = columns;
    let finalInfoFields = infoFields;
    let finalHeaderConfig = headerConfig;
    let finalTemplateName = templateName;

    if (!columns || !infoFields || !headerConfig) {
      const templateResult = await pool
        .request()
        .input("templateId", sql.Int, templateId)
        .query(
          "SELECT Name, Columns, InfoFields, HeaderConfig FROM AuditTemplates WHERE Id = @templateId",
        );

      if (templateResult.recordset.length > 0) {
        const tmpl = templateResult.recordset[0];
        finalColumns = columns || safeJsonParse(tmpl.Columns, []);
        finalInfoFields = infoFields || safeJsonParse(tmpl.InfoFields, []);
        finalHeaderConfig =
          headerConfig || safeJsonParse(tmpl.HeaderConfig, {});
        finalTemplateName = templateName || tmpl.Name;
      }
    }

    const result = await pool
      .request()
      .input("auditCode", sql.VarChar, auditCode)
      .input("templateId", sql.Int, templateId)
      .input("templateName", sql.NVarChar, finalTemplateName)
      .input("reportName", sql.NVarChar, reportName)
      .input("formatNo", sql.VarChar, formatNo || null)
      .input("revNo", sql.VarChar, revNo || null)
      .input("revDate", sql.Date, revDate ? new Date(revDate) : null)
      .input("notes", sql.NVarChar, notes || null)
      .input("status", sql.VarChar, status)
      .input("infoData", sql.NVarChar, JSON.stringify(infoData || {}))
      .input("sections", sql.NVarChar, JSON.stringify(processedSections || []))
      .input("columns", sql.NVarChar, JSON.stringify(finalColumns || []))
      .input("infoFields", sql.NVarChar, JSON.stringify(finalInfoFields || []))
      .input(
        "headerConfig",
        sql.NVarChar,
        JSON.stringify(finalHeaderConfig || {}),
      )
      .input("signatures", sql.NVarChar, JSON.stringify(signatures || {}))
      .input("summary", sql.NVarChar, JSON.stringify(summary))
      .input("createdBy", sql.VarChar, createdBy).query(`
        INSERT INTO Audits (
          AuditCode, TemplateId, TemplateName, ReportName, FormatNo, RevNo, RevDate,
          Notes, Status, InfoData, Sections, Columns, InfoFields, HeaderConfig,
          Signatures, Summary, CreatedBy, CreatedAt, UpdatedBy, UpdatedAt
        )
        OUTPUT INSERTED.*
        VALUES (
          @auditCode, @templateId, @templateName, @reportName, @formatNo, @revNo, @revDate,
          @notes, @status, @infoData, @sections, @columns, @infoFields, @headerConfig,
          @signatures, @summary, @createdBy, GETDATE(), @createdBy, GETDATE()
        );
      `);

    const audit = result.recordset[0];

    await pool
      .request()
      .input("auditId", sql.Int, audit.Id)
      .input("action", sql.VarChar, "created")
      .input("actionBy", sql.VarChar, createdBy)
      .input("newData", sql.NVarChar, JSON.stringify(audit)).query(`
        INSERT INTO AuditHistory (AuditId, Action, ActionBy, ActionAt, NewData)
        VALUES (@auditId, @action, @actionBy, GETDATE(), @newData);
      `);

    res.status(201).json({
      success: true,
      message: "Audit created successfully",
      imagesUploaded: savedImages.length,
      data: {
        ...audit,
        InfoData: safeJsonParse(audit.InfoData, {}),
        Sections: safeJsonParse(audit.Sections, []),
        Columns: safeJsonParse(audit.Columns, []),
        InfoFields: safeJsonParse(audit.InfoFields, []),
        HeaderConfig: safeJsonParse(audit.HeaderConfig, {}),
        Signatures: safeJsonParse(audit.Signatures, {}),
        Summary: safeJsonParse(audit.Summary, {}),
      },
    });
  } catch (error) {
    // Rollback: delete any images saved before the DB insert failed
    if (savedImages.length > 0) {
      await deleteMultipleImages(savedImages.map((img) => img.fileName));
    }
    throw error;
  } finally {
    if (pool) await pool.close();
  }
});

// ==================== UPDATE AUDIT ====================
export const updateAudit = tryCatch(async (req, res) => {
  const { id } = req.params;
  const {
    reportName,
    formatNo,
    revNo,
    revDate,
    notes,
    infoData,
    sections,
    signatures,
    status,
  } = req.body;

  if (!id) throw new AppError("Audit ID is required", 400);

  const updatedBy = req.user?.userCode || "SYSTEM";
  let savedImages = [];

  let pool;
  try {
    pool = await new sql.ConnectionPool(dbConfig3).connect();

    const currentResult = await pool
      .request()
      .input("id", sql.Int, id)
      .query("SELECT * FROM Audits WHERE Id = @id AND IsDeleted = 0");

    if (currentResult.recordset.length === 0)
      throw new AppError("Audit not found", 404);

    const currentAudit = currentResult.recordset[0];

    if (currentAudit.Status === "approved") {
      throw new AppError("Cannot edit an approved audit", 400);
    }

    let processedSections = sections;

    if (sections) {
      const result = await processAuditImages(sections, currentAudit.AuditCode);
      processedSections = result.sections;
      savedImages = result.savedImages;

      // Clean up images that were removed in this update
      const oldSections = safeJsonParse(currentAudit.Sections, []);
      await cleanupRemovedImages(oldSections, processedSections);
    }

    const summary = processedSections
      ? calculateSummary(processedSections)
      : safeJsonParse(currentAudit.Summary, {});

    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .input("reportName", sql.NVarChar, reportName || currentAudit.ReportName)
      .input(
        "formatNo",
        sql.VarChar,
        formatNo !== undefined ? formatNo : currentAudit.FormatNo,
      )
      .input(
        "revNo",
        sql.VarChar,
        revNo !== undefined ? revNo : currentAudit.RevNo,
      )
      .input(
        "revDate",
        sql.Date,
        revDate ? new Date(revDate) : currentAudit.RevDate,
      )
      .input(
        "notes",
        sql.NVarChar,
        notes !== undefined ? notes : currentAudit.Notes,
      )
      .input("status", sql.VarChar, status || currentAudit.Status)
      .input(
        "infoData",
        sql.NVarChar,
        infoData ? JSON.stringify(infoData) : currentAudit.InfoData,
      )
      .input(
        "sections",
        sql.NVarChar,
        processedSections
          ? JSON.stringify(processedSections)
          : currentAudit.Sections,
      )
      .input(
        "signatures",
        sql.NVarChar,
        signatures ? JSON.stringify(signatures) : currentAudit.Signatures,
      )
      .input("summary", sql.NVarChar, JSON.stringify(summary))
      .input("updatedBy", sql.VarChar, updatedBy).query(`
        UPDATE Audits
        SET 
          ReportName = @reportName, FormatNo = @formatNo, RevNo = @revNo,
          RevDate = @revDate, Notes = @notes, Status = @status,
          InfoData = @infoData, Sections = @sections, Signatures = @signatures,
          Summary = @summary, UpdatedBy = @updatedBy, UpdatedAt = GETDATE()
        OUTPUT INSERTED.*
        WHERE Id = @id AND IsDeleted = 0;
      `);

    const audit = result.recordset[0];

    await pool
      .request()
      .input("auditId", sql.Int, id)
      .input("action", sql.VarChar, "updated")
      .input("actionBy", sql.VarChar, updatedBy)
      .input("previousData", sql.NVarChar, JSON.stringify(currentAudit))
      .input("newData", sql.NVarChar, JSON.stringify(audit)).query(`
        INSERT INTO AuditHistory (AuditId, Action, ActionBy, ActionAt, PreviousData, NewData)
        VALUES (@auditId, @action, @actionBy, GETDATE(), @previousData, @newData);
      `);

    res.status(200).json({
      success: true,
      message: "Audit updated successfully",
      imagesUploaded: savedImages.length,
      data: {
        ...audit,
        InfoData: safeJsonParse(audit.InfoData, {}),
        Sections: safeJsonParse(audit.Sections, []),
        Columns: safeJsonParse(audit.Columns, []),
        InfoFields: safeJsonParse(audit.InfoFields, []),
        HeaderConfig: safeJsonParse(audit.HeaderConfig, {}),
        Signatures: safeJsonParse(audit.Signatures, {}),
        Summary: safeJsonParse(audit.Summary, {}),
      },
    });
  } catch (error) {
    if (savedImages.length > 0) {
      await deleteMultipleImages(savedImages.map((img) => img.fileName));
    }
    throw error;
  } finally {
    if (pool) await pool.close();
  }
});

// ==================== DELETE AUDIT ====================
export const deleteAudit = tryCatch(async (req, res) => {
  const { id } = req.params;
  if (!id) throw new AppError("Audit ID is required", 400);

  const updatedBy = req.user?.userCode || "SYSTEM";

  let pool;
  try {
    pool = await new sql.ConnectionPool(dbConfig3).connect();

    const checkResult = await pool
      .request()
      .input("id", sql.Int, id)
      .query(
        "SELECT Id, Status, Sections FROM Audits WHERE Id = @id AND IsDeleted = 0",
      );

    if (checkResult.recordset.length === 0)
      throw new AppError("Audit not found", 404);

    const currentAudit = checkResult.recordset[0];

    if (currentAudit.Status === "approved") {
      throw new AppError("Cannot delete an approved audit", 400);
    }

    // Delete associated images
    const sections = safeJsonParse(currentAudit.Sections, []);
    await deleteAuditImages(sections);

    await pool
      .request()
      .input("id", sql.Int, id)
      .input("updatedBy", sql.VarChar, updatedBy).query(`
        UPDATE Audits
        SET IsDeleted = 1, UpdatedBy = @updatedBy, UpdatedAt = GETDATE()
        WHERE Id = @id;
      `);

    await pool
      .request()
      .input("auditId", sql.Int, id)
      .input("action", sql.VarChar, "deleted")
      .input("actionBy", sql.VarChar, updatedBy).query(`
        INSERT INTO AuditHistory (AuditId, Action, ActionBy, ActionAt)
        VALUES (@auditId, @action, @actionBy, GETDATE());
      `);

    res.status(200).json({
      success: true,
      message: "Audit and associated images deleted successfully",
    });
  } finally {
    if (pool) await pool.close();
  }
});

// ==================== APPROVE AUDIT ====================
export const approveAudit = tryCatch(async (req, res) => {
  const { id } = req.params;
  const { approverName, comments } = req.body;

  if (!id) throw new AppError("Audit ID is required", 400);
  if (!approverName) throw new AppError("Approver name is required", 400);

  const approvedBy = req.user?.userCode || approverName;

  let pool;
  try {
    pool = await new sql.ConnectionPool(dbConfig3).connect();

    const checkResult = await pool
      .request()
      .input("id", sql.Int, id)
      .query("SELECT * FROM Audits WHERE Id = @id AND IsDeleted = 0");

    if (checkResult.recordset.length === 0)
      throw new AppError("Audit not found", 404);

    const currentAudit = checkResult.recordset[0];
    if (currentAudit.Status !== "submitted") {
      throw new AppError(
        `Cannot approve audit with status: ${currentAudit.Status}`,
        400,
      );
    }

    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .input("approvedBy", sql.VarChar, approverName)
      .input("comments", sql.NVarChar, comments || null)
      .input("updatedBy", sql.VarChar, approvedBy).query(`
        UPDATE Audits
        SET 
          Status = 'approved', ApprovedBy = @approvedBy, ApprovedAt = GETDATE(),
          ApprovalComments = @comments, UpdatedBy = @updatedBy, UpdatedAt = GETDATE()
        OUTPUT INSERTED.*
        WHERE Id = @id AND IsDeleted = 0;
      `);

    const audit = result.recordset[0];

    await pool
      .request()
      .input("auditId", sql.Int, id)
      .input("action", sql.VarChar, "approved")
      .input("actionBy", sql.VarChar, approverName)
      .input("comments", sql.NVarChar, comments || null).query(`
        INSERT INTO AuditHistory (AuditId, Action, ActionBy, ActionAt, Comments)
        VALUES (@auditId, @action, @actionBy, GETDATE(), @comments);
      `);

    res.status(200).json({
      success: true,
      message: "Audit approved successfully",
      data: {
        ...audit,
        InfoData: safeJsonParse(audit.InfoData, {}),
        Sections: safeJsonParse(audit.Sections, []),
        Columns: safeJsonParse(audit.Columns, []),
        InfoFields: safeJsonParse(audit.InfoFields, []),
        HeaderConfig: safeJsonParse(audit.HeaderConfig, {}),
        Signatures: safeJsonParse(audit.Signatures, {}),
        Summary: safeJsonParse(audit.Summary, {}),
      },
    });
  } finally {
    if (pool) await pool.close();
  }
});

// ==================== REJECT AUDIT ====================
export const rejectAudit = tryCatch(async (req, res) => {
  const { id } = req.params;
  const { approverName, comments } = req.body;

  if (!id) throw new AppError("Audit ID is required", 400);
  if (!approverName) throw new AppError("Approver name is required", 400);
  if (!comments) throw new AppError("Rejection reason is required", 400);

  const rejectedBy = req.user?.userCode || approverName;

  let pool;
  try {
    pool = await new sql.ConnectionPool(dbConfig3).connect();

    const checkResult = await pool
      .request()
      .input("id", sql.Int, id)
      .query("SELECT * FROM Audits WHERE Id = @id AND IsDeleted = 0");

    if (checkResult.recordset.length === 0)
      throw new AppError("Audit not found", 404);

    const currentAudit = checkResult.recordset[0];
    if (currentAudit.Status !== "submitted") {
      throw new AppError(
        `Cannot reject audit with status: ${currentAudit.Status}`,
        400,
      );
    }

    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .input("approvedBy", sql.VarChar, approverName)
      .input("comments", sql.NVarChar, comments)
      .input("updatedBy", sql.VarChar, rejectedBy).query(`
        UPDATE Audits
        SET 
          Status = 'rejected', ApprovedBy = @approvedBy, ApprovedAt = GETDATE(),
          ApprovalComments = @comments, UpdatedBy = @updatedBy, UpdatedAt = GETDATE()
        OUTPUT INSERTED.*
        WHERE Id = @id AND IsDeleted = 0;
      `);

    const audit = result.recordset[0];

    await pool
      .request()
      .input("auditId", sql.Int, id)
      .input("action", sql.VarChar, "rejected")
      .input("actionBy", sql.VarChar, approverName)
      .input("comments", sql.NVarChar, comments).query(`
        INSERT INTO AuditHistory (AuditId, Action, ActionBy, ActionAt, Comments)
        VALUES (@auditId, @action, @actionBy, GETDATE(), @comments);
      `);

    res.status(200).json({
      success: true,
      message: "Audit rejected successfully",
      data: {
        ...audit,
        InfoData: safeJsonParse(audit.InfoData, {}),
        Sections: safeJsonParse(audit.Sections, []),
        Columns: safeJsonParse(audit.Columns, []),
        InfoFields: safeJsonParse(audit.InfoFields, []),
        HeaderConfig: safeJsonParse(audit.HeaderConfig, {}),
        Signatures: safeJsonParse(audit.Signatures, {}),
        Summary: safeJsonParse(audit.Summary, {}),
      },
    });
  } finally {
    if (pool) await pool.close();
  }
});

// ==================== GET AUDIT HISTORY ====================
export const getAuditHistory = tryCatch(async (req, res) => {
  const { id } = req.params;
  if (!id) throw new AppError("Audit ID is required", 400);

  let pool;
  try {
    pool = await new sql.ConnectionPool(dbConfig3).connect();
    const result = await pool.request().input("auditId", sql.Int, id).query(`
      SELECT Id, AuditId, Action, ActionBy, ActionAt, Comments
      FROM AuditHistory
      WHERE AuditId = @auditId
      ORDER BY ActionAt DESC;
    `);

    res.status(200).json({
      success: true,
      message: "Audit history retrieved successfully",
      data: result.recordset,
    });
  } finally {
    if (pool) await pool.close();
  }
});

// ==================== GET AUDIT STATS ====================
export const getAuditStats = tryCatch(async (req, res) => {
  const { startDate, endDate, templateId } = req.query;

  let pool;
  try {
    pool = await new sql.ConnectionPool(dbConfig3).connect();
    const request = pool.request();

    const whereConditions = ["IsDeleted = 0"];

    if (startDate) {
      request.input("startDate", sql.DateTime, new Date(startDate));
      whereConditions.push("CreatedAt >= @startDate");
    }
    if (endDate) {
      request.input("endDate", sql.DateTime, new Date(endDate));
      whereConditions.push("CreatedAt <= @endDate");
    }
    if (templateId) {
      request.input("templateId", sql.Int, templateId);
      whereConditions.push("TemplateId = @templateId");
    }

    const whereClause = `WHERE ${whereConditions.join(" AND ")}`;

    const result = await request.query(`
      SELECT 
        COUNT(*) AS TotalAudits,
        SUM(CASE WHEN Status = 'submitted' THEN 1 ELSE 0 END) AS SubmittedCount,
        SUM(CASE WHEN Status = 'approved' THEN 1 ELSE 0 END) AS ApprovedCount,
        SUM(CASE WHEN Status = 'rejected' THEN 1 ELSE 0 END) AS RejectedCount
      FROM Audits
      ${whereClause};
    `);

    const templateStats = await request.query(`
      SELECT 
        TemplateName, TemplateId,
        COUNT(*) AS AuditCount,
        SUM(CASE WHEN Status = 'approved' THEN 1 ELSE 0 END) AS ApprovedCount
      FROM Audits
      ${whereClause}
      GROUP BY TemplateName, TemplateId
      ORDER BY AuditCount DESC;
    `);

    res.status(200).json({
      success: true,
      message: "Audit statistics retrieved successfully",
      data: {
        summary: result.recordset[0],
        templateStats: templateStats.recordset,
      },
    });
  } finally {
    if (pool) await pool.close();
  }
});
