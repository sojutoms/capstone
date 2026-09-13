const jwt = require("jsonwebtoken");

const JWT_SECRET = require("../config/jwt");
const { isTokenActive } = require("../controllers/securityController");

/**
 * Generic helper to extract token from headers.
 * Supports:
 *   - "Authorization: Bearer <token>"
 *   - "auth-token" header
 */
const getTokenFromRequest = (req) => {
    const authHeader = req.header("Authorization") || "";
    const legacyHeader = req.header("auth-token") || "";

    if (authHeader.startsWith("Bearer ")) {
        return authHeader.slice(7);
    }
    return legacyHeader || null;
};

/**
 * requireRole(...roles)
 * Middleware that verifies the JWT and checks the caller has at least one
 * of the allowed roles.
 */
const requireRole = (...allowedRoles) => async (req, res, next) => {
    try {
        const token = getTokenFromRequest(req);
        if (!token) {
            return res.status(401).json({ success: false, error: "No token provided" });
        }

        const payload = jwt.verify(token, JWT_SECRET);

        if (payload.user) {
            req.user = { ...payload.user, ...payload };
        } else {
            req.user = payload;
        }

        if (req.user.userId && !req.user.id) req.user.id = req.user.userId;
        if (req.user.id && !req.user.userId) req.user.userId = req.user.id;

        if (allowedRoles.length > 0) {
            const userRoles = Array.isArray(req.user.roles) ? req.user.roles : [];
            const hasRole = allowedRoles.some((r) => userRoles.includes(r));

            if (!hasRole) {
                return res.status(403).json({ success: false, error: "Insufficient permissions" });
            }

            // Admin-role-gated routes must also re-check against the live
            // AdminSession record, so a force-logout or revoked session
            // actually cuts the admin off instead of the token staying valid
            // until it naturally expires.
            const sessionStillActive = await isTokenActive(token);
            if (!sessionStillActive) {
                return res.status(401).json({ success: false, error: "Session has been revoked. Please log in again." });
            }
        }

        next();
    } catch (err) {
        console.error("[requireRole] Auth error:", err.message);
        return res.status(401).json({ success: false, error: "Invalid or expired token" });
    }
};

/**
 * fetchUser
 * Standard middleware for user-level routes.
 * Verifies token and attaches user info to req.user.
 */
const fetchUser = (req, res, next) => {
    try {
        const token = getTokenFromRequest(req);
        if (!token) {
            return res.status(401).json({ success: false, error: "No token provided" });
        }

        const payload = jwt.verify(token, JWT_SECRET);

        // Normalize req.user
        if (payload.user) {
            req.user = { ...payload.user, ...payload };
        } else {
            req.user = payload;
        }

        // Ensure id and userId are both present
        if (req.user.userId && !req.user.id) req.user.id = req.user.userId;
        if (req.user.id && !req.user.userId) req.user.userId = req.user.id;

        next();
    } catch (err) {
        return res.status(401).json({ success: false, error: "Invalid or expired token" });
    }
};

/**
 * authenticate
 * Alias for fetchUser used in some routes.
 */
const authenticate = fetchUser;

module.exports = { requireRole, fetchUser, authenticate };