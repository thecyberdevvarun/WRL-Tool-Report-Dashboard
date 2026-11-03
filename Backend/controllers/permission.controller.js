import sql from "mssql";
import { dbConfig3 } from "../config/db.config.js";
import { tryCatch }  from "../utils/try-catch.js";
import { AppError }  from "../utils/app-error.js";

// ── Shared helpers ─────────────────────────────────────────────────────────────

/**
 * Flatten { [sectionKey]: { [path]: boolean } }
 * into    [{ sectionKey, path, canAccess }]
 */
const flattenPermissions = (obj) => {
  const rows = [];
  for (const sectionKey of Object.keys(obj)) {
    const section = obj[sectionKey];
    if (!section || typeof section !== "object" || Array.isArray(section)) continue;
    for (const path of Object.keys(section)) {
      rows.push({ sectionKey, path, canAccess: Boolean(section[path]) });
    }
  }
  return rows;
};

/**
 * Delete all existing permissions for `role` then bulk-insert `rows`.
 * Wrapped in a transaction — if any INSERT fails the DELETE is rolled back
 * and the role retains its previous permissions.
 */
const applyPermissions = async (pool, role, rows, updatedBy = "system") => {
  const safeUpdatedBy = String(updatedBy || "system");
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    await new sql.Request(transaction)
      .input("role", sql.NVarChar(100), role.toLowerCase())
      .query(`DELETE FROM RolePermissions WHERE RoleName = @role`);

    for (const { sectionKey, path, canAccess } of rows) {
      await new sql.Request(transaction)
        .input("role",      sql.NVarChar(100), role.toLowerCase())
        .input("section",   sql.NVarChar(100), sectionKey)
        .input("path",      sql.NVarChar(500), path)
        .input("access",    sql.Bit,           canAccess ? 1 : 0)
        .input("updatedBy", sql.NVarChar(100), safeUpdatedBy)
        .query(`
          INSERT INTO RolePermissions (RoleName, SectionKey, Path, CanAccess, UpdatedBy, UpdatedAt)
          VALUES (@role, @section, @path, @access, @updatedBy, GETDATE())
        `);
    }

    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};

/* =========================================================
   HIDDEN PAGES — global, temporary "hide from menu + block route" switch.
   Stored as a JSON array of "sectionKey|path" in AppSettings('hiddenPages').
   Super Admin is never affected, so they can always un-hide.
========================================================= */
const HIDDEN_KEY = "hiddenPages";

export const readHiddenPages = async (pool) => {
  const r = await pool
    .request()
    .input("k", sql.NVarChar(100), HIDDEN_KEY)
    .query(`SELECT Value FROM AppSettings WHERE SettingKey = @k`);
  try {
    const list = JSON.parse(r.recordset[0]?.Value || "[]");
    return Array.isArray(list) ? list.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
};

export const getHiddenPages = tryCatch(async (req, res) => {
  const pool = await new sql.ConnectionPool(dbConfig3).connect();
  try {
    res.json({ success: true, data: await readHiddenPages(pool) });
  } finally {
    await pool.close();
  }
});

export const setPageHidden = tryCatch(async (req, res) => {
  const { sectionKey, path, hidden } = req.body || {};
  if (!sectionKey || !path || typeof hidden !== "boolean") {
    throw new AppError("sectionKey, path and hidden (boolean) are required", 400);
  }
  const id = `${sectionKey}|${path}`;
  const pool = await new sql.ConnectionPool(dbConfig3).connect();
  try {
    const set = new Set(await readHiddenPages(pool));
    if (hidden) set.add(id);
    else set.delete(id);
    await pool
      .request()
      .input("k", sql.NVarChar(100), HIDDEN_KEY)
      .input("v", sql.NVarChar(sql.MAX), JSON.stringify([...set]))
      .input("by", sql.NVarChar(100), String(req.user?.name || req.user?.usercode || "system"))
      .query(`
        MERGE AppSettings AS t
        USING (SELECT @k AS SettingKey) AS s ON t.SettingKey = s.SettingKey
        WHEN MATCHED THEN UPDATE SET Value = @v, UpdatedBy = @by, UpdatedAt = GETDATE()
        WHEN NOT MATCHED THEN INSERT (SettingKey, Value, UpdatedBy, UpdatedAt) VALUES (@k, @v, @by, GETDATE());
      `);
    res.json({ success: true, data: [...set] });
  } finally {
    await pool.close();
  }
});

/* =========================================================
   GET LOGGED-IN USER PERMISSIONS
   GET /permissions/me
========================================================= */
export const getMyPermissions = tryCatch(async (req, res) => {
  // FIX: was req.user?.roleName.toLowerCase() — crashes when roleName is undefined
  const role = req.user?.roleName?.toLowerCase();
  if (!role) throw new AppError("Role not found", 400);

  const pool = await new sql.ConnectionPool(dbConfig3).connect();
  try {
    const hidden = new Set(await readHiddenPages(pool));
    const result = await pool
      .request()
      .input("role", sql.NVarChar(100), role)
      .query(`
        SELECT SectionKey, Path, CanAccess
        FROM   RolePermissions
        WHERE  RoleName = @role
      `);

    // FIX: cast BIT → boolean (MSSQL driver returns 1/0 or true/false by version)
    const permissionMap = {};
    result.recordset.forEach(({ SectionKey, Path, CanAccess }) => {
      if (!permissionMap[SectionKey]) permissionMap[SectionKey] = {};
      permissionMap[SectionKey][Path] = Boolean(CanAccess) && !hidden.has(`${SectionKey}|${Path}`);
    });

    res.json({ success: true, role, permissions: permissionMap });
  } finally {
    await pool.close();
  }
});

/* =========================================================
   ADMIN: GET PERMISSIONS FOR A SPECIFIC ROLE
   GET /permissions/:role
========================================================= */
export const getRolePermissions = tryCatch(async (req, res) => {
  const { role } = req.params;
  if (!role) throw new AppError("Role parameter is required", 400);

  const pool = await new sql.ConnectionPool(dbConfig3).connect();
  try {
    const result = await pool
      .request()
      .input("role", sql.NVarChar(100), role.toLowerCase())
      .query(`
        SELECT SectionKey, Path, CanAccess
        FROM   RolePermissions
        WHERE  RoleName = @role
      `);

    const permissionMap = {};
    result.recordset.forEach(({ SectionKey, Path, CanAccess }) => {
      if (!permissionMap[SectionKey]) permissionMap[SectionKey] = {};
      permissionMap[SectionKey][Path] = Boolean(CanAccess); // FIX: cast
    });

    res.json({ success: true, data: permissionMap });
  } finally {
    await pool.close();
  }
});

/* =========================================================
   ADMIN: UPDATE ROLE PERMISSIONS   PUT /:role
   Body: { [sectionKey]: { [path]: boolean } }
========================================================= */
export const updateRolePermissionsByRole = tryCatch(async (req, res) => {
  const { role }       = req.params;
  const permissionsObj = req.body;

  if (!role) throw new AppError("Role parameter is required", 400);
  if (!permissionsObj || typeof permissionsObj !== "object" || Array.isArray(permissionsObj)) {
    throw new AppError(
      "Body must be a permissions object: { [sectionKey]: { [path]: boolean } }",
      400
    );
  }

  const rows      = flattenPermissions(permissionsObj);
  const updatedBy = req.user?.name || req.user?.usercode || "system";

  const pool = await new sql.ConnectionPool(dbConfig3).connect();
  try {
    // FIX: wrapped in transaction — previously a failed INSERT left the role
    // with zero permissions because the DELETE had already committed.
    await applyPermissions(pool, role, rows, updatedBy);
    res.json({ success: true, message: "Permissions updated successfully" });
  } finally {
    await pool.close();
  }
});

/* =========================================================
   ADMIN: UPDATE ROLE PERMISSIONS   POST /admin/update
   Body: { role: string, permissions: { [sectionKey]: { [path]: boolean } } }

   This is the format dispatched by the frontend Redux thunk.

   FIX: the original handler validated `Array.isArray(permissions)` but the
   frontend sends an Object — it was broken. Now unified with the same
   { [sectionKey]: { [path]: boolean } } shape as the PUT endpoint above.
========================================================= */
export const updateRolePermissions = tryCatch(async (req, res) => {
  const { role, permissions: permissionsObj } = req.body;

  if (!role) throw new AppError("role is required", 400);
  if (!permissionsObj || typeof permissionsObj !== "object" || Array.isArray(permissionsObj)) {
    throw new AppError(
      "permissions must be an object: { [sectionKey]: { [path]: boolean } }",
      400
    );
  }

  const rows      = flattenPermissions(permissionsObj);
  const updatedBy = req.user?.name || req.user?.usercode || "system";

  const pool = await new sql.ConnectionPool(dbConfig3).connect();
  try {
    await applyPermissions(pool, role, rows, updatedBy); // FIX: transactional
    res.json({ success: true, message: "Permissions updated successfully" });
  } finally {
    await pool.close();
  }
});

/* =========================================================
   ADMIN: COPY PERMISSIONS FROM ONE ROLE TO ANOTHER  (NEW)
   POST /admin/copy
   Body: { fromRole: string, toRole: string }

   Uses a single server-side INSERT … SELECT — no N+1 round-trips.
========================================================= */
export const copyRolePermissions = tryCatch(async (req, res) => {
  const { fromRole, toRole } = req.body;

  if (!fromRole || !toRole)
    throw new AppError("fromRole and toRole are required", 400);
  if (fromRole.toLowerCase() === toRole.toLowerCase())
    throw new AppError("Source and destination roles must be different", 400);

  const pool        = await new sql.ConnectionPool(dbConfig3).connect();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    const copyUpdatedBy = String(req.user?.name || req.user?.usercode || "system");

    // 1. Wipe target role's permissions
    await new sql.Request(transaction)
      .input("toRole", sql.NVarChar(100), toRole.toLowerCase())
      .query(`DELETE FROM RolePermissions WHERE RoleName = @toRole`);

    // 2. Copy source → target in a single statement (no N+1)
    await new sql.Request(transaction)
      .input("fromRole",  sql.NVarChar(100), fromRole.toLowerCase())
      .input("toRole",    sql.NVarChar(100), toRole.toLowerCase())
      .input("updatedBy", sql.NVarChar(100), copyUpdatedBy)
      .query(`
        INSERT INTO RolePermissions (RoleName, SectionKey, Path, CanAccess, UpdatedBy, UpdatedAt)
        SELECT @toRole, SectionKey, Path, CanAccess, @updatedBy, GETDATE()
        FROM   RolePermissions
        WHERE  RoleName = @fromRole
      `);

    await transaction.commit();
    res.json({
      success: true,
      message: `Permissions copied from "${fromRole}" to "${toRole}" successfully`,
    });
  } catch (err) {
    await transaction.rollback();
    throw err;
  } finally {
    await pool.close();
  }
});

/* =========================================================
   ADMIN: GET ALL ROLES
   GET /roles

   FIX: was using undefined `dbConfig1` (never imported) → ReferenceError
   at runtime. Now uses dbConfig3. Update to point at whatever database
   actually holds your UserRoles table if it differs.
========================================================= */
export const getAllRoles = tryCatch(async (req, res) => {
  const pool = await new sql.ConnectionPool(dbConfig3).connect();
  try {
    const result = await pool.request().query(`
      SELECT RoleCode, RoleName
      FROM   UserRoles
      ORDER  BY RoleName
    `);
    res.json({ success: true, roles: result.recordset });
  } finally {
    await pool.close();
  }
});