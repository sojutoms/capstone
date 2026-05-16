// models/LoginAttempt.js
const mongoose = require("mongoose");

const loginAttemptSchema = new mongoose.Schema(
  {
    email:     { type: String, default: "" },       // attempted email (may not exist)
    ip:        { type: String, required: true },
    userAgent: { type: String, default: "" },
    success:   { type: Boolean, required: true },   // true = successful login
    reason:    { type: String, default: "" },       // "wrong_password", "not_found", "banned", etc.
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

// TTL: auto-delete attempts older than 30 days
loginAttemptSchema.index({ timestamp: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });
loginAttemptSchema.index({ ip: 1, timestamp: -1 });
loginAttemptSchema.index({ email: 1, timestamp: -1 });
loginAttemptSchema.index({ success: 1, timestamp: -1 });

const LoginAttempt = mongoose.model("LoginAttempt", loginAttemptSchema);

module.exports = LoginAttempt;