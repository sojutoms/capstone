// models/AdminSession.js
const mongoose = require("mongoose");

const adminSessionSchema = new mongoose.Schema(
  {
    // The JWT token string (store full token so we can invalidate by value)
    token:      { type: String, required: true, unique: true, index: true },

    // Who owns this session
    adminId:    { type: mongoose.Schema.Types.ObjectId, ref: "Users", required: true },
    adminEmail: { type: String, required: true },
    adminName:  { type: String, default: "" },
    adminRoles: { type: [String], default: [] },

    // Network / device info captured at login
    ip:        { type: String, default: "" },
    userAgent: { type: String, default: "" },

    // Lifecycle
    loginAt:    { type: Date, default: Date.now },
    lastActive: { type: Date, default: Date.now },
    expiresAt:  { type: Date, required: true },   // set to JWT expiry
    isActive:   { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

// TTL index — MongoDB auto-deletes expired session documents
adminSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
adminSessionSchema.index({ adminId: 1, isActive: 1 });

const AdminSession = mongoose.model("AdminSession", adminSessionSchema);

module.exports = AdminSession;