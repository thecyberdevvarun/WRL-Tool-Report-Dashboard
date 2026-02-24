import sql from "mssql";
import { dbConfig3 } from "../../config/db.config.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";
import { generateTemplateCode } from "../../utils/generateCode.js";
import {
  saveTemplateFile,
  readTemplateFile,
  deleteTemplateFile,
  updateTemplateFile,
  backupTemplateFile,
} from "../../utils/storage/templateStorage.js";

// Get all templates
export const getAllTemplates = tryCatch(async (req, res) => {
  const { category, isActive, search, page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const pool = await new sql.ConnectionPool(dbConfig3).connect();
  const request = pool.request();

  let whereConditions = ["IsDeleted=0"];

  if (category) {
    request.input("category", sql.VarChar, category);
    whereConditions.push("Category = @category");
  }

  if (isActive !== undefined) {
    request.input("isActive", sql.Bit, isActive === "true" ? 1 : 0);
    whereConditions.push("IsActive=@isActive");
  }

  if (search) {
    request.input("search", sql.NVarChar, `%${search}%`);
    whereConditions.push("(Name LIKE @search OR Description LIKE @search)");
  }

  request.input("offset", sql.Int, offset);
  request.input("limit", sql.Int, parseInt(limit));

  const whereClause =
    whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

  const query = `
    WITH TemplateData AS (
      SELECT 
        Id,
        TemplateCode,
        TemplateFileName,
        Name,
        Description,
        Category,
        Version,
        IsActive,
        CreatedBy,
        CreatedAt,
        UpdatedBy,
        UpdatedAt,
        ROW_NUMBER() OVER (ORDER BY CreatedAt DESC) AS RowNum
      FROM AuditTemplates
      ${whereClause}
    )
    SELECT 
      (SELECT COUNT(*) FROM TemplateData) AS TotalCount,
      *
    FROM TemplateData
    WHERE RowNum > @offset AND RowNum <= (@offset + @limit);
  `;

  const result = await request.query(query);
  await pool.close();

  // Load JSON config from files for each template
  const templates = await Promise.all(
    result.recordset.map(async (template) => {
      let config = null;

      if (template.TemplateFileName) {
        try {
          config = await readTemplateFile(template.TemplateFileName);
        } catch (err) {
          console.warn(
            `Could not load config for template ${template.Name}:`,
            err.message,
          );
        }
      }

      return {
        ...template,
        HeaderConfig: config?.headerConfig || null,
        InfoFields: config?.infoFields || [],
        Columns: config?.columns || [],
        DefaultSections: config?.defaultSections || [],
      };
    }),
  );

  res.status(200).json({
    success: true,
    message: "Templates retrieved successfully.",
    data: templates,
    totalCount:
      result.recordset.length > 0 ? result.recordset[0].TotalCount : 0,
    page: parseInt(page),
    limit: parseInt(limit),
  });
});

// Get template by ID
export const getTemplateById = tryCatch(async (req, res) => {
  const { id } = req.params;

  if (!id) {
    throw new AppError("Template ID is required", 400);
  }

  const pool = await new sql.ConnectionPool(dbConfig3).connect();
  const result = await pool.request().input("id", sql.Int, id).query(`
    SELECT 
      Id,
      TemplateCode,
      TemplateFileName,
      Name,
      Description,
      Category,
      Version,
      IsActive,
      CreatedBy,
      CreatedAt,
      UpdatedBy,
      UpdatedAt
    FROM AuditTemplates
    WHERE Id = @id AND IsDeleted = 0
  `);

  await pool.close();

  if (result.recordset.length === 0) {
    throw new AppError("Template not found", 404);
  }

  const template = result.recordset[0];

  // Load JSON config from file
  let config = null;
  if (template.TemplateFileName) {
    try {
      config = await readTemplateFile(template.TemplateFileName);
    } catch (err) {
      console.warn(
        `Could not load config for template ${template.Name}:`,
        err.message,
      );
    }
  }

  res.status(200).json({
    success: true,
    message: "Template retrieved successfully",
    data: {
      ...template,
      HeaderConfig: config?.headerConfig || null,
      InfoFields: config?.infoFields || [],
      Columns: config?.columns || [],
      DefaultSections: config?.defaultSections || [],
    },
  });
});

// Create template
export const createTemplate = tryCatch(async (req, res) => {
  const {
    name,
    description,
    category,
    version = "01",
    isActive,
    headerConfig,
    infoFields,
    columns,
    defaultSections,
  } = req.body;

  if (!name) {
    throw new AppError("Template name is required", 400);
  }

  const templateCode = await generateTemplateCode();
  const createdBy = req.user?.userCode || "SYSTEM";

  // Save JSON config to file first
  const fileResult = await saveTemplateFile({
    templateName: name,
    version: version || "01",
    templateCode,
    headerConfig: headerConfig || {},
    infoFields: infoFields || [],
    columns: columns || [],
    defaultSections: defaultSections || [],
  });

  const pool = await new sql.ConnectionPool(dbConfig3).connect();

  // Insert metadata into database with file reference
  const result = await pool
    .request()
    .input("templateCode", sql.VarChar, templateCode)
    .input("templateFileName", sql.VarChar, fileResult.fileName)
    .input("name", sql.NVarChar, name)
    .input("description", sql.NVarChar, description || null)
    .input("category", sql.VarChar, category || null)
    .input("version", sql.VarChar, version || "01")
    .input("isActive", sql.Bit, isActive !== false ? 1 : 0)
    .input("createdBy", sql.VarChar, createdBy).query(`
      INSERT INTO AuditTemplates (
        TemplateCode, TemplateFileName, Name, Description, Category, Version, IsActive,
        CreatedBy, CreatedAt, UpdatedBy, UpdatedAt
      )
      OUTPUT INSERTED.*
      VALUES (
        @templateCode, @templateFileName, @name, @description, @category, @version, @isActive,
        @createdBy, GETDATE(), @createdBy, GETDATE()
      );
    `);

  await pool.close();

  const template = result.recordset[0];

  res.status(201).json({
    success: true,
    message: "Template created successfully",
    data: {
      ...template,
      HeaderConfig: headerConfig || {},
      InfoFields: infoFields || [],
      Columns: columns || [],
      DefaultSections: defaultSections || [],
    },
  });
});

// Update template
export const updateTemplate = tryCatch(async (req, res) => {
  const { id } = req.params;
  const {
    name,
    description,
    category,
    version,
    isActive,
    headerConfig,
    infoFields,
    columns,
    defaultSections,
  } = req.body;

  if (!id) {
    throw new AppError("Template ID is required", 400);
  }

  const updatedBy = req.user?.userCode || "SYSTEM";

  const pool = await new sql.ConnectionPool(dbConfig3).connect();

  // Get current template
  const checkResult = await pool.request().input("id", sql.Int, id).query(`
    SELECT Id, TemplateCode, TemplateFileName, Name, Version 
    FROM AuditTemplates 
    WHERE Id = @id AND IsDeleted = 0
  `);

  if (checkResult.recordset.length === 0) {
    await pool.close();
    throw new AppError("Template not found", 404);
  }

  const currentTemplate = checkResult.recordset[0];
  const oldFileName = currentTemplate.TemplateFileName;

  // Backup existing template file before update
  if (oldFileName) {
    try {
      await backupTemplateFile(oldFileName);
    } catch (err) {
      console.warn("Could not backup template file:", err.message);
    }
  }

  // Update JSON config file (handles rename if name changed)
  const fileResult = await updateTemplateFile({
    oldFileName,
    templateName: name || currentTemplate.Name,
    version: version || currentTemplate.Version || "01",
    templateCode: currentTemplate.TemplateCode,
    headerConfig: headerConfig || {},
    infoFields: infoFields || [],
    columns: columns || [],
    defaultSections: defaultSections || [],
  });

  // Update metadata in database
  const result = await pool
    .request()
    .input("id", sql.Int, id)
    .input("templateFileName", sql.VarChar, fileResult.fileName)
    .input("name", sql.NVarChar, name)
    .input("description", sql.NVarChar, description || null)
    .input("category", sql.VarChar, category || null)
    .input("version", sql.VarChar, version || "01")
    .input("isActive", sql.Bit, isActive !== false ? 1 : 0)
    .input("updatedBy", sql.VarChar, updatedBy).query(`
      UPDATE AuditTemplates
      SET 
        TemplateFileName = @templateFileName,
        Name = @name,
        Description = @description,
        Category = @category,
        Version = @version,
        IsActive = @isActive,
        UpdatedBy = @updatedBy,
        UpdatedAt = GETDATE()
      OUTPUT INSERTED.*
      WHERE Id = @id AND IsDeleted = 0;
    `);

  await pool.close();

  const template = result.recordset[0];

  res.status(200).json({
    success: true,
    message: "Template updated successfully",
    data: {
      ...template,
      HeaderConfig: headerConfig || {},
      InfoFields: infoFields || [],
      Columns: columns || [],
      DefaultSections: defaultSections || [],
    },
  });
});

// Delete template (soft delete)
export const deleteTemplate = tryCatch(async (req, res) => {
  const { id } = req.params;

  if (!id) {
    throw new AppError("Template ID is required", 400);
  }

  const updatedBy = req.user?.userCode || "SYSTEM";

  const pool = await new sql.ConnectionPool(dbConfig3).connect();

  // Check if template exists
  const checkResult = await pool.request().input("id", sql.Int, id).query(`
    SELECT Id, TemplateCode, TemplateFileName 
    FROM AuditTemplates 
    WHERE Id = @id AND IsDeleted = 0
  `);

  if (checkResult.recordset.length === 0) {
    await pool.close();
    throw new AppError("Template not found", 404);
  }

  const templateFileName = checkResult.recordset[0].TemplateFileName;

  // Check if template is used in any audits
  const auditCheck = await pool
    .request()
    .input("templateId", sql.Int, id)
    .query(
      "SELECT COUNT(*) AS Count FROM Audits WHERE TemplateId = @templateId AND IsDeleted = 0",
    );

  if (auditCheck.recordset[0].Count > 0) {
    await pool.close();
    throw new AppError(
      "Cannot delete template. It is used in existing audits.",
      400,
    );
  }

  // Soft delete in database
  await pool
    .request()
    .input("id", sql.Int, id)
    .input("updatedBy", sql.VarChar, updatedBy).query(`
      UPDATE AuditTemplates
      SET IsDeleted = 1, UpdatedBy = @updatedBy, UpdatedAt = GETDATE()
      WHERE Id = @id;
    `);

  await pool.close();

  // Backup and delete template file
  if (templateFileName) {
    try {
      await backupTemplateFile(templateFileName);
      await deleteTemplateFile(templateFileName);
    } catch (err) {
      console.warn("Could not delete template file:", err.message);
    }
  }

  res.status(200).json({
    success: true,
    message: "Template deleted successfully",
  });
});

// Duplicate template
export const duplicateTemplate = tryCatch(async (req, res) => {
  const { id } = req.params;

  if (!id) {
    throw new AppError("Template ID is required", 400);
  }

  const pool = await new sql.ConnectionPool(dbConfig3).connect();

  // Get original template metadata
  const originalResult = await pool.request().input("id", sql.Int, id).query(`
    SELECT * FROM AuditTemplates WHERE Id = @id AND IsDeleted = 0
  `);

  if (originalResult.recordset.length === 0) {
    await pool.close();
    throw new AppError("Template not found", 404);
  }

  const original = originalResult.recordset[0];
  const newTemplateCode = await generateTemplateCode();
  const createdBy = req.user?.userCode || "SYSTEM";
  const newName = `${original.Name} (Copy)`;

  // Load original template config from file
  let originalConfig = null;
  if (original.TemplateFileName) {
    try {
      originalConfig = await readTemplateFile(original.TemplateFileName);
    } catch (err) {
      console.warn("Could not load original template config:", err.message);
    }
  }

  if (!originalConfig) {
    originalConfig = {
      headerConfig: {},
      infoFields: [],
      columns: [],
      defaultSections: [],
    };
  }

  // Save new template config file
  const fileResult = await saveTemplateFile({
    templateName: newName,
    version: "01",
    templateCode: newTemplateCode,
    headerConfig: originalConfig.headerConfig,
    infoFields: originalConfig.infoFields,
    columns: originalConfig.columns,
    defaultSections: originalConfig.defaultSections,
  });

  // Create new template in database
  const result = await pool
    .request()
    .input("templateCode", sql.VarChar, newTemplateCode)
    .input("templateFileName", sql.VarChar, fileResult.fileName)
    .input("name", sql.NVarChar, newName)
    .input("description", sql.NVarChar, original.Description)
    .input("category", sql.VarChar, original.Category)
    .input("version", sql.VarChar, "01")
    .input("isActive", sql.Bit, 1)
    .input("createdBy", sql.VarChar, createdBy).query(`
      INSERT INTO AuditTemplates (
        TemplateCode, TemplateFileName, Name, Description, Category, Version, IsActive,
        CreatedBy, CreatedAt, UpdatedBy, UpdatedAt
      )
      OUTPUT INSERTED.*
      VALUES (
        @templateCode, @templateFileName, @name, @description, @category, @version, @isActive,
        @createdBy, GETDATE(), @createdBy, GETDATE()
      );
    `);

  await pool.close();

  const template = result.recordset[0];

  res.status(201).json({
    success: true,
    message: "Template duplicated successfully",
    data: {
      ...template,
      HeaderConfig: originalConfig?.headerConfig || null,
      InfoFields: originalConfig?.infoFields || [],
      Columns: originalConfig?.columns || [],
      DefaultSections: originalConfig?.defaultSections || [],
    },
  });
});

// Get template categories
export const getTemplateCategories = tryCatch(async (req, res) => {
  const pool = await new sql.ConnectionPool(dbConfig3).connect();

  const result = await pool.request().query(`
    SELECT DISTINCT Category, COUNT(*) AS Count
    FROM AuditTemplates
    WHERE IsDeleted = 0 AND Category IS NOT NULL
    GROUP BY Category
    ORDER BY Category;
  `);

  await pool.close();

  res.status(200).json({
    success: true,
    message: "Template categories retrieved successfully",
    data: result.recordset,
  });
});
