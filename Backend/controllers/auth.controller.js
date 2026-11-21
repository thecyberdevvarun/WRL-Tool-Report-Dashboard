import sql from "mssql";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { dbConfig1, dbConfig4 } from "../config/db.config.js";
import { tryCatch } from "../utils/try-catch.js";
import { AppError } from "../utils/app-error.js";
import { getClientIp } from "../utils/client-info.js";
import { generateUserCode } from "../utils/user-code.js";
import {
  createSession,
  attachHostToSession,
  revokeSessions,
  logAuthEventWithHost,
} from "../utils/session-store.js";

const BCRYPT_SALT_ROUNDS = 10;

const auditLoginFailure = (req, empcod, detail) =>
  logAuthEventWithHost({
    type: "LOGIN_FAILED",
    userId: empcod,
    ip: getClientIp(req),
    detail,
  });

// ================= SIGNUP =================
// export const signup = tryCatch(async (req, res) => {
//   const { empcod, username, password } = req.body;

//   if (!empcod || !username || !password) {
//     throw new AppError("All fields are required", 400);
//   }

//   const pool = await new sql.ConnectionPool(dbConfig1).connect();

//   try {
//     // 1. Check duplicate user
//     const existing = await pool
//       .request()
//       .input("empcod", sql.VarChar, empcod)
//       .query(`SELECT 1 FROM Users WHERE UserID = @empcod`);

//     if (existing.recordset.length > 0) {
//       throw new AppError("User already exists", 409);
//     }

//     // 2. Generate UserCode (IDMaster/IDValue — shared with admin create-user)
//     const userCode = await generateUserCode(() => pool.request());

//     // 3. Insert user (inactive)
//     // NOTE: Password stays plaintext here (unchanged) since GARUDA/Users may
//     // have consumers outside this app that expect to read it — PasswordHash
//     // is additive, so this app can verify via bcrypt without touching that.
//     const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

//     await pool
//       .request()
//       .input("UserCode", sql.VarChar, userCode)
//       .input("UserID", sql.VarChar, empcod)
//       .input("UserName", sql.VarChar, username)
//       .input("Password", sql.VarChar, password)
//       .input("PasswordHash", sql.VarChar, passwordHash).query(`
//         INSERT INTO Users (
//           UserCode,
//           UserID,
//           UserName,
//           Password,
//           PasswordHash,
//           UserRole,
//           Employee,
//           LastActivityOn,
//           LastPwChOn,
//           WrongPw,
//           Photo,
//           Locked,
//           DefaultForm,
//           SystemUser,
//           Status
//         )
//         VALUES (
//           @UserCode,
//           @UserID,
//           @UserName,
//           @Password,
//           @PasswordHash,
//           223009,
//           NULL,
//           NULL,
//           GETDATE(),
//           0,
//           NULL,
//           0,
//           0,
//           0,
//           200
//         )
//       `);

//     res.status(201).json({
//       success: true,
//       message: "Signup successful. Wait for admin approval.",
//       usercode: userCode,
//     });
//   } finally {
//     await pool.close();
//   }
// });

// ================= LOGIN =================
export const login = tryCatch(async (req, res) => {
  const { empcod, password } = req.body;

  if (!empcod || !password) {
    throw new AppError("Employee code and password are required.", 400);
  }

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    // 1. Check user
    const checkUser = await pool.request().input("empcod", sql.VarChar, empcod)
      .query(`
        SELECT UserID, Status, Locked 
        FROM Users 
        WHERE UserID = @empcod
      `);

    if (checkUser.recordset.length === 0) {
      auditLoginFailure(req, empcod, "User not found");
      throw new AppError("User not found", 404);
    }

    const { Status, Locked } = checkUser.recordset[0];

    if (Status !== 1) {
      auditLoginFailure(req, empcod, "Account not activated");
      throw new AppError("Account not activated. Contact admin.", 403);
    }

    if (Locked === 1) {
      auditLoginFailure(req, empcod, "Account is locked");
      throw new AppError("Account is locked", 403);
    }

    // 2. Fetch the user's stored credentials — no password in the WHERE
    // clause anymore, since the match is now done in JS (bcrypt or, for
    // rows not yet migrated, a legacy plaintext fallback below).
    const result = await pool.request().input("empcod", sql.VarChar, empcod)
      .query(`
        SELECT
          U.UserCode,
          U.UserName,
          U.UserID,
          U.UserRole,
          U.Password,
          U.PasswordHash,
          R.RoleName
        FROM Users U
        JOIN UserRoles R ON U.UserRole = R.RoleCode
        WHERE U.UserID = @empcod
      `);

    const user = result.recordset[0];

    if (!user) {
      throw new AppError("Invalid credentials", 401);
    }

    let passwordMatches = false;

    if (user.PasswordHash) {
      // Already migrated — verify against the bcrypt hash.
      passwordMatches = await bcrypt.compare(password, user.PasswordHash);
    } else if (user.Password === password) {
      // Legacy row, never migrated. Plaintext still matches — accept this
      // login, then transparently backfill PasswordHash so this user is on
      // bcrypt from their next login onward. Password (plaintext) is left
      // untouched — only the new, additive column is written here.
      passwordMatches = true;
      const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
      await pool
        .request()
        .input("empcod", sql.VarChar, empcod)
        .input("passwordHash", sql.VarChar, passwordHash)
        .query(
          `UPDATE Users SET PasswordHash = @passwordHash WHERE UserID = @empcod`,
        );
    }

    if (!passwordMatches) {
      auditLoginFailure(req, empcod, "Wrong password");
      throw new AppError("Invalid credentials", 401);
    }

    // 3. Update last activity
    await pool.request().input("empcod", sql.VarChar, empcod).query(`
        UPDATE Users
        SET LastActivityOn = GETDATE()
        WHERE UserID = @empcod
      `);

    // 4. Server-side session (powers Settings > User Access: who is logged in,
    // IP/host, force logout). If the session store is unreachable the login
    // still succeeds — the token just carries no sid, so it can't be revoked
    // individually (it is still blocked if the account gets deactivated).
    const ip = getClientIp(req);
    const userAgent = (req.headers["user-agent"] || "").slice(0, 500);
    let sid = randomUUID();
    try {
      await createSession({ sid, user, ip, userAgent });
      attachHostToSession(sid, ip)
        .then((host) =>
          logAuthEventWithHost({
            type: "LOGIN_SUCCESS",
            userId: user.UserID,
            userName: user.UserName,
            ip,
            detail: host ? undefined : "Host name could not be resolved",
          }),
        )
        .catch((err) =>
          console.error("[Session] host lookup failed:", err.message),
        );
    } catch (err) {
      console.error("[Session] could not create session record:", err.message);
      sid = undefined;
    }

    // 5. JWT
    const token = jwt.sign(
      {
        id: user.UserID,
        name: user.UserName,
        usercode: user.UserCode,
        role: user.UserRole,
        roleName: user.RoleName,
        sid,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      success: true,
      message: "Login successful",
      user: {
        id: user.UserID,
        name: user.UserName,
        usercode: user.UserCode,
        role: user.UserRole, // numeric role code
        roleName: user.RoleName.toLowerCase(), // role name string
      },
    });
  } finally {
    await pool.close();
  }
});

// ================= CHANGE PASSWORD =================
// Self-service only — always scoped to req.user.id (the authenticated
// caller), never a client-supplied user id. Mirrors login()'s verify logic
// (PasswordHash if migrated, else plaintext fallback) and signup()'s
// dual-column write (Password + PasswordHash) so the legacy plaintext column
// stays in sync for any consumer of Users outside this app.
export const changePassword = tryCatch(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const empcod = req.user.id;

  if (!currentPassword || !newPassword) {
    throw new AppError("Current password and new password are required.", 400);
  }
  if (newPassword.length < 6) {
    throw new AppError("New password must be at least 6 characters.", 400);
  }

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool
      .request()
      .input("empcod", sql.VarChar, empcod)
      .query(`SELECT Password, PasswordHash FROM Users WHERE UserID = @empcod`);

    const user = result.recordset[0];
    if (!user) {
      throw new AppError("User not found", 404);
    }

    let passwordMatches = false;
    if (user.PasswordHash) {
      passwordMatches = await bcrypt.compare(
        currentPassword,
        user.PasswordHash,
      );
    } else if (user.Password === currentPassword) {
      passwordMatches = true;
    }

    if (!passwordMatches) {
      throw new AppError("Current password is incorrect", 401);
    }

    const newPasswordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);

    await pool
      .request()
      .input("empcod", sql.VarChar, empcod)
      .input("newPassword", sql.VarChar, newPassword)
      .input("newPasswordHash", sql.VarChar, newPasswordHash).query(`
        UPDATE Users
        SET Password = @newPassword, PasswordHash = @newPasswordHash, LastPwChOn = GETDATE()
        WHERE UserID = @empcod
      `);

    logAuthEventWithHost({
      type: "PASSWORD_CHANGED",
      userId: empcod,
      userName: req.user.name,
      ip: getClientIp(req),
      detail: "Changed by the user",
    });

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } finally {
    await pool.close();
  }
});

// ================= MY PHOTO =================
// Streams the logged-in user's photo straight from CLMS's Images table (a
// JPEG blob, keyed by Name.Code via NameCode, matched here through the
// caller's own login id — UserID/empcod is the same value as CLMS's
// Name.IDCardNo for real employee accounts). Always scoped to req.user.id,
// never a client-supplied code, since this is "my" profile photo, not a
// lookup of an arbitrary employee. Plain 404 (no JSON body) when there's no
// photo on file — e.g. the "root" system account has no CLMS record — so
// the frontend's <img> onError fallback can swap in an initials avatar.
export const getMyPhoto = tryCatch(async (req, res) => {
  const empcod = req.user.id;
  if (!empcod) return res.status(404).end();

  const pool = await new sql.ConnectionPool(dbConfig4).connect();
  try {
    const result = await pool
      .request()
      .input("empcod", sql.NVarChar(50), empcod).query(`
        SELECT TOP 1 i.LabourImage
        FROM Name AS n
        INNER JOIN Images AS i ON i.NameCode = n.Code
        WHERE n.IDCardNo = @empcod AND DATALENGTH(i.LabourImage) > 0
      `);

    const photo = result.recordset[0]?.LabourImage;
    if (!photo) return res.status(404).end();

    res.set("Content-Type", "image/jpeg");
    res.set("Cache-Control", "private, max-age=3600");
    res.set("Vary", "Cookie"); // response depends on who's logged in, not just the URL
    res.send(photo);
  } finally {
    await pool.close();
  }
});

// ================= SESSION HEARTBEAT =================
// Cheap authenticated ping the frontend calls periodically: it keeps this
// session's "last seen" fresh, and — because authenticate() rejects a revoked
// session — is how a force-logout reaches an idle browser tab within a minute
// instead of only at that user's next click.
export const sessionPing = (req, res) => {
  res.status(200).json({ success: true });
};

// ================= LOGOUT =================
// Not behind authenticate() (a dead/revoked session must still be able to
// clear its cookie), so the token is decoded here on a best-effort basis to
// close out the matching session row.
export const logout = tryCatch(async (req, res) => {
  const token = req.cookies?.token;
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET, {
        ignoreExpiration: true,
      });
      if (decoded.sid) {
        const ended = await revokeSessions({
          sid: decoded.sid,
          reason: "user",
          revokedBy: decoded.id,
        });
        if (ended) {
          logAuthEventWithHost({
            type: "LOGOUT",
            userId: decoded.id,
            userName: decoded.name,
            ip: getClientIp(req),
          });
        }
      }
    } catch (err) {
      // Bad/absent token or session store hiccup — the cookie is cleared below regardless.
    }
  }

  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  });

  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
});
