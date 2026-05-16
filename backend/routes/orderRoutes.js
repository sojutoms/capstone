const express = require("express");
const router  = express.Router();
const multer  = require("multer");

const { fetchUser, requireRole } = require("../middleware/auth");
const upload = require("../config/multer"); // Cloudinary multer config

const {
  getOrderHistory,
  cancelOrder,
  confirmOrderReceived,
  requestReturn,
  requestRefund,
  adminGetRefunds,
  adminGetRefundById,
  adminUpdateRefundStatus,
  placeOrder,
  validateCart,
} = require("../controllers/orderController");

const { getMyVouchers, applyVoucher } = require("../controllers/voucherController");

// ─── Multer: refund media upload (Cloudinary) ──────────────────────────────────
// Reuses the project-wide Cloudinary multer config (../config/multer).
// Max 6 files, 50 MB each. Accepted: images + videos.
const ACCEPTED_MIME_TYPES = [
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "video/mp4", "video/quicktime", "video/webm",
];
const MAX_FILES   = 6;
const MAX_SIZE_MB = 50;

// Override the limits on the shared uploader so refund uploads respect the caps.
// We wrap the shared `upload` config but call `.array()` with explicit limits.
// If your multer config already accepts limits via options you can adjust there;
// otherwise we apply a thin wrapper here.
const refundUpload = (req, res, next) => {
  // Use the shared Cloudinary storage but constrain to 6 files / 50 MB each
  upload.array("media", MAX_FILES)(req, res, (err) => {
    if (!err) {
      // Post-upload MIME validation
      const files = req.files || [];
      const badFile = files.find((f) => !ACCEPTED_MIME_TYPES.includes(f.mimetype));
      if (badFile) {
        return res.status(400).json({
          success: false,
          error: `Unsupported file type: ${badFile.mimetype}. Use JPG, PNG, WebP, GIF, MP4, MOV, or WebM.`,
        });
      }
      const oversized = files.find((f) => f.size > MAX_SIZE_MB * 1024 * 1024);
      if (oversized) {
        return res.status(400).json({
          success: false,
          error: `"${oversized.originalname}" exceeds the ${MAX_SIZE_MB} MB limit.`,
        });
      }
      return next();
    }

    if (err instanceof multer.MulterError) {
      const messages = {
        LIMIT_FILE_COUNT:      `Too many files. Maximum ${MAX_FILES} files allowed.`,
        LIMIT_FILE_SIZE:       `File too large. Maximum ${MAX_SIZE_MB} MB per file.`,
        LIMIT_UNEXPECTED_FILE: err.message || "Unsupported file type.",
      };
      return res.status(400).json({
        success: false,
        error: messages[err.code] || err.message,
      });
    }

    console.error("refundUpload error:", err);
    return res.status(500).json({ success: false, error: "File upload failed." });
  });
};

// ─── Customer routes ───────────────────────────────────────────────────────────
router.get( "/orderhistory",                         fetchUser, getOrderHistory);
router.post("/placeorder",                           fetchUser, placeOrder);
router.post("/order/:orderNumber/cancel",            fetchUser, cancelOrder);
router.post("/order/:orderNumber/confirm-received",  fetchUser, confirmOrderReceived);
router.post("/order/:orderNumber/return",            fetchUser, requestReturn);
router.post("/order/:orderNumber/refund",            fetchUser, refundUpload, requestRefund);
router.post("/validate-cart",                        fetchUser, validateCart);

// ── Voucher routes ─────────────────────────────────────────────────────────────
router.get( "/my-vouchers",    fetchUser, getMyVouchers);
router.post("/apply-voucher",  fetchUser, applyVoucher);

// ─── Admin refund routes ───────────────────────────────────────────────────────
// Accept both "admin" and "owner" roles.
router.get( "/admin/refunds",           requireRole("admin", "owner"), adminGetRefunds);
router.get( "/admin/refund/:id",        requireRole("admin", "owner"), adminGetRefundById);
router.post("/admin/refund/:id/status", requireRole("admin", "owner"), adminUpdateRefundStatus);

// Add this TEMPORARILY to your orderRoutes.js to debug
// Remove after fixing

router.get("/debug/refunds", async (req, res) => {
  try {
    const Orders = require("../models/Orders");

    // 1. Count ALL orders
    const totalOrders = await Orders.countDocuments({});

    // 2. Find orders with status refund_requested
    const byStatus = await Orders.find({ status: "refund_requested" }).lean();

    // 3. Find orders where refundRequest field exists at all
    const withRefundField = await Orders.find({
      refundRequest: { $exists: true }
    }).lean();

    // 4. Find orders where refundRequest is not null
    const withRefundNotNull = await Orders.find({
      refundRequest: { $ne: null }
    }).lean();

    // 5. Raw sample — just grab the first refund_requested order and show its full doc
    const sample = byStatus[0] || null;

    return res.json({
      totalOrders,
      byStatusCount: byStatus.length,
      byStatusOrderNumbers: byStatus.map(o => o.orderNumber),
      withRefundFieldCount: withRefundField.length,
      withRefundNotNullCount: withRefundNotNull.length,
      // Show the full refundRequest sub-doc of the first match
      sampleRefundRequest: sample ? {
        orderNumber: sample.orderNumber,
        status: sample.status,
        refundRequest: sample.refundRequest,
        refundReason: sample.refundReason,
      } : null,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message, stack: err.stack });
  }
});

module.exports = router;