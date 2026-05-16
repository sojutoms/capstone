// models/AuditLog.js
const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    // The action key — matches ACTION_META keys in SecurityPanel.jsx
    action: {
      type: String,
      required: true,
      enum: [
        "login",
        "logout",
        "product_add",
        "product_edit",
        "product_delete",
        "stock_add",
        "price_edit",
        "order_status",
        "user_block",
        "user_unblock",
        "role_assign",
        "voucher_issue",
        "category_add",
        "category_delete",
        "force_logout",
        "mark_sold",
        "unknown",
      ],
      default: "unknown",
    },

    // Who performed the action
    adminId:    { type: mongoose.Schema.Types.ObjectId, ref: "Users", default: null },
    adminEmail: { type: String, default: "" },
    adminName:  { type: String, default: "" },
    adminRoles: { type: [String], default: [] },

    // Arbitrary detail payload — productId, orderNumber, etc.
    details: { type: mongoose.Schema.Types.Mixed, default: {} },

    // Network info
    ip:        { type: String, default: "" },
    userAgent: { type: String, default: "" },

    // Allow the frontend to pass its own ISO timestamp (falls back to now)
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

// Fast queries: newest-first, filter by action, filter by admin
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ adminEmail: 1, timestamp: -1 });

const AuditLog = mongoose.model("AuditLog", auditLogSchema);

module.exports = AuditLog;