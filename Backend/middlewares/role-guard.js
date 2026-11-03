import sql from "mssql";
import { AppError } from "../utils/app-error.js";
import { connectToDB, dbConfig3 } from "../config/db.config.js";
import { readHiddenPages } from "../controllers/permission.controller.js";

/**
 * Middleware to restrict access to Super Admin only
 */
export const requireSuperAdmin = (req, res, next) => {
  const userRole = req.user?.roleName?.toLowerCase();

  if (!userRole || userRole !== "super admin") {
    throw new AppError("Access denied. Super Admin only.", 403);
  }

  next();
};

/**
 * Middleware to restrict access to specific roles
 * @param {Array<string>} allowedRoles - Array of role names (lowercase)
 */
export const requireRoles = (...allowedRoles) => {
  return (req, res, next) => {
    const userRole = req.user?.roleName?.toLowerCase();

    if (!userRole) {
      throw new AppError("Role not found", 400);
    }

    if (!allowedRoles.includes(userRole)) {
      throw new AppError("Access denied. Insufficient permissions.", 403);
    }

    next();
  };
};

/**
 * Middleware for the API behind one page: the user's role must be allowed that page (Settings › role permissions, as
 * the menu shows it). Super Admin always is, unless the page is hidden.
 * @param {string} sectionKey - the menu section (e.g. "quality")
 * @param {string} path - the page's path (e.g. "/quality/fg-scrap")
 */
export const requirePageAccess = (sectionKey, path) => async (req, res, next) => {
  try {
    const role = req.user?.roleName?.toLowerCase();
    if (!role) throw new AppError("Role not found", 400);
    const pool = await connectToDB(dbConfig3);
    if ((await readHiddenPages(pool)).includes(`${sectionKey}|${path}`)) throw new AppError("Access denied. This page is hidden.", 403);
    if (role !== "super admin") {
      const r = await pool
        .request()
        .input("role", sql.NVarChar(100), role)
        .input("section", sql.NVarChar(100), sectionKey)
        .input("path", sql.NVarChar(500), path)
        .query("SELECT TOP 1 CanAccess FROM RolePermissions WHERE RoleName = @role AND SectionKey = @section AND Path = @path");
      if (!r.recordset[0]?.CanAccess) throw new AppError("Access denied. Insufficient permissions.", 403);
    }
    next();
  } catch (err) {
    next(err);
  }
};
