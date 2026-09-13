// controllers/securityController.js
const jwt = require("jsonwebtoken");
const AuditLog = require("../models/AuditLog");
const AdminSession = require("../models/AdminSession");
const LoginAttempt = require("../models/LoginAttempt");
const Users = require("../models/Users");

const JWT_SECRET = require("../config/jwt");

// ─── Helper: extract caller info from request ─────────────────────────────────
const getCallerInfo = (req) => {
  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    req.ip ||
    "";
  const userAgent = req.headers["user-agent"] || "";
  return { ip, userAgent };
};

// ─── Helper: decode token WITHOUT throwing ────────────────────────────────────
const safeDecodeToken = (tokenHeader) => {
  if (!tokenHeader) return null;
  const token = tokenHeader.startsWith("Bearer ") ? tokenHeader.slice(7) : tokenHeader;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
};

// ─── Helper: get admin info from request token ────────────────────────────────
const getAdminFromReq = async (req) => {
  const tokenHeader = req.header("auth-token") || req.header("Authorization") || "";
  const payload = safeDecodeToken(tokenHeader);
  if (!payload) return { adminId: null, adminEmail: "", adminName: "", adminRoles: [] };

  const userId = payload.userId || payload.id || payload._id || null;
  let adminName = payload.name || "";
  let adminEmail = payload.email || "";
  const adminRoles = payload.roles || [];

  if (userId && (!adminName || !adminEmail)) {
    try {
      const user = await Users.findById(userId).select("name email").lean();
      if (user) { adminName = user.name || ""; adminEmail = user.email || ""; }
    } catch { /* non-fatal */ }
  }

  return { adminId: userId, adminEmail, adminName, adminRoles };
};

// ═══════════════════════════════════════════════════════════════════════════════
// AUDIT LOG
// ═══════════════════════════════════════════════════════════════════════════════

const writeAuditLog = async (req, res) => {
  try {
    const { action, details = {}, timestamp } = req.body;
    const { ip, userAgent } = getCallerInfo(req);
    const { adminId, adminEmail, adminName, adminRoles } = await getAdminFromReq(req);

    const entry = await AuditLog.create({
      action: action || "unknown",
      adminId,
      adminEmail,
      adminName,
      adminRoles,
      details,
      ip,
      userAgent,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
    });

    return res.json({ success: true, id: entry._id });
  } catch (err) {
    console.error("[AuditLog] write error:", err.message);
    return res.json({ success: false, error: err.message });
  }
};

const getAuditLog = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(100, parseInt(req.query.limit || "25", 10));
    const action = req.query.action || "";
    const q = (req.query.q || "").trim();

    const filter = {};
    if (action && action !== "all") filter.action = action;
    if (q) {
      filter.$or = [
        { adminEmail: { $regex: q, $options: "i" } },
        { adminName: { $regex: q, $options: "i" } },
        { "details.productName": { $regex: q, $options: "i" } },
      ];
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ timestamp: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    return res.json({ success: true, logs, total, page, limit });
  } catch (err) {
    console.error("[AuditLog] read error:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// SESSIONS
// ═══════════════════════════════════════════════════════════════════════════════

const ADMIN_ROLES = ["owner", "admin", "staff", "inventory_staff"];
const ACTIVE_THRESHOLD_MS = 15 * 60 * 1000; // 15 min

const getActiveSessions = async (req, res) => {
  try {
    const tokenHeader = req.header("auth-token") || req.header("Authorization") || "";
    const rawToken = tokenHeader.startsWith("Bearer ") ? tokenHeader.slice(7) : tokenHeader;

    // All active sessions, newest first
    const allSessions = await AdminSession.find({ isActive: true })
      .sort({ lastActive: -1 })
      .lean();

    // Deduplicate by email — keep only the most-recent session per admin.
    // Also skip any session that has no admin roles (customer sessions that
    // somehow ended up in this collection).
    const seen = new Set();
    const uniqueSessions = [];
    for (const s of allSessions) {
      if (!s.adminEmail) continue;
      const roles = s.adminRoles || [];
      if (!roles.some((r) => ADMIN_ROLES.includes(r))) continue;
      if (seen.has(s.adminEmail)) continue;
      seen.add(s.adminEmail);
      uniqueSessions.push(s);
    }

    const now = Date.now();
    const result = uniqueSessions.map((s) => ({
      id: s._id,
      adminEmail: s.adminEmail,
      adminName: s.adminName,
      roles: s.adminRoles || [],
      role: (s.adminRoles || [])[0] || "staff",
      ip: s.ip,
      device: s.userAgent,
      loginAt: s.loginAt,
      lastActive: s.lastActive,
      isCurrent: s.token === rawToken,
      isOnline: !!(s.lastActive && now - new Date(s.lastActive).getTime() < ACTIVE_THRESHOLD_MS),
    }));

    return res.json({ success: true, sessions: result });
  } catch (err) {
    console.error("[Sessions] read error:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ─── POST /admin/logout ───────────────────────────────────────────────────────
// Deactivates the caller's own current session. Without this, "logging out"
// only ever cleared client-side storage — the AdminSession row stayed
// isActive:true until its natural ~12h expiry, so /admin/sessions and
// isTokenActive() had no way to tell a real logout apart from an idle tab.
const adminLogout = async (req, res) => {
  try {
    const tokenHeader = req.header("auth-token") || req.header("Authorization") || "";
    const token = tokenHeader.startsWith("Bearer ") ? tokenHeader.slice(7) : tokenHeader;
    if (!token) return res.status(400).json({ success: false, error: "No token provided" });
    await AdminSession.updateOne({ token, isActive: true }, { $set: { isActive: false } });
    return res.json({ success: true });
  } catch (err) {
    console.error("[Sessions] logout error:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};

const forceLogout = async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ success: false, error: "sessionId required" });

    const session = await AdminSession.findByIdAndUpdate(
      sessionId,
      { isActive: false },
      { new: true }
    );
    if (!session) return res.status(404).json({ success: false, error: "Session not found" });

    const { ip, userAgent } = getCallerInfo(req);
    const { adminId, adminEmail, adminName, adminRoles } = await getAdminFromReq(req);
    await AuditLog.create({
      action: "force_logout",
      adminId, adminEmail, adminName, adminRoles,
      details: { targetEmail: session.adminEmail, sessionId },
      ip, userAgent,
    });

    return res.json({ success: true, message: `Session for ${session.adminEmail} terminated` });
  } catch (err) {
    console.error("[Sessions] force-logout error:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// LOGIN ALERTS
// ═══════════════════════════════════════════════════════════════════════════════

const getLoginAlerts = async (req, res) => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const byIp = await LoginAttempt.aggregate([
      { $match: { success: false, timestamp: { $gte: since } } },
      {
        $group: {
          _id: "$ip",
          attempts: { $sum: 1 },
          emails: { $addToSet: "$email" },
          lastSeen: { $max: "$timestamp" },
          userAgent: { $last: "$userAgent" },
        },
      },
      { $match: { attempts: { $gte: 3 } } },
      { $sort: { attempts: -1 } },
      { $limit: 20 },
    ]);

    const alerts = byIp.map((row, i) => {
      const severity = row.attempts >= 8 ? "danger" : "warning";
      return {
        id: `alert-ip-${i}`,
        type: "failed_login",
        severity,
        email: (row.emails || []).filter(Boolean).join(", ") || "unknown",
        ip: row._id,
        attempts: row.attempts,
        timestamp: row.lastSeen,
        message: `${row.attempts} failed login attempt${row.attempts !== 1 ? "s" : ""} from ${row._id}`,
      };
    });

    const offHours = await LoginAttempt.find({
      success: true,
      timestamp: { $gte: since },
      $expr: {
        $or: [
          { $lt: [{ $hour: "$timestamp" }, 6] },
          { $gte: [{ $hour: "$timestamp" }, 23] },
        ],
      },
    })
      .sort({ timestamp: -1 })
      .limit(5)
      .lean();

    offHours.forEach((a, i) => {
      alerts.push({
        id: `alert-offhours-${i}`,
        type: "off_hours",
        severity: "info",
        email: a.email,
        ip: a.ip,
        attempts: 1,
        timestamp: a.timestamp,
        message: `Login at unusual hour from ${a.ip}`,
      });
    });

    return res.json({ success: true, alerts });
  } catch (err) {
    console.error("[LoginAlerts] error:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// Exported helpers
// ═══════════════════════════════════════════════════════════════════════════════

const recordLoginAttempt = async ({ email, ip, userAgent, success, reason = "" }) => {
  try {
    await LoginAttempt.create({ email, ip, userAgent, success, reason });
  } catch (err) {
    console.warn("[LoginAttempt] record error:", err.message);
  }
};

const createSession = async ({ token, adminId, adminEmail, adminName, adminRoles, ip, userAgent, expiresAt }) => {
  try {
    await AdminSession.create({
      token,
      adminId,
      adminEmail,
      adminName,
      adminRoles,
      ip,
      userAgent,
      loginAt: new Date(),
      lastActive: new Date(),
      expiresAt: expiresAt ? new Date(expiresAt) : new Date(Date.now() + 8 * 60 * 60 * 1000),
      isActive: true,
    });
  } catch (err) {
    console.warn("[Session] create error:", err.message);
  }
};

const touchSession = async (token) => {
  try {
    await AdminSession.updateOne({ token, isActive: true }, { lastActive: new Date() });
  } catch { /* non-fatal */ }
};

/**
 * isTokenActive(token) → boolean
 * Exact-token match against AdminSession only. There used to be a fallback
 * here that treated ANY other active session for the same admin as proof
 * this token was still fine — which meant force-logging-out one session
 * never actually worked whenever the admin had more than one session row
 * (the common case, since nothing previously marked sessions inactive on a
 * normal logout). That fallback also rewrote the other session's stored
 * token to the just-revoked one. Removed — a revoked token must not validate
 * just because some other session happens to still be active.
 */
const isTokenActive = async (token) => {
  try {
    const session = await AdminSession.findOne({ token, isActive: true }).lean();
    return !!session;
  } catch (err) {
    console.warn("[isTokenActive] error, failing closed:", err.message);
    return false;
  }
};

module.exports = {
  writeAuditLog,
  getAuditLog,
  getActiveSessions,
  adminLogout,
  forceLogout,
  getLoginAlerts,
  recordLoginAttempt,
  createSession,
  touchSession,
  isTokenActive,
  getCallerInfo,
};