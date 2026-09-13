// config/jwt.js
// Single source of truth for the JWT signing secret. Every controller/middleware
// that needs it should `require("../config/jwt")` instead of reading
// process.env.JWT_SECRET directly — a shared strong secret is only as strong
// as its weakest duplicate fallback.
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error(
    "JWT_SECRET environment variable is not set. Refusing to start with an insecure default — set a strong random value in .env."
  );
}

module.exports = JWT_SECRET;
