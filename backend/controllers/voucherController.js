const Users = require("../models/Users");

// ─── GET /my-vouchers ─────────────────────────────────────────────────────────
// Returns all vouchers on the authenticated user's account.
// Unused, non-expired ones are marked active: true so the frontend can
// show them as usable without client-side date logic.
const getMyVouchers = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: "Unauthorized" });

    const user = await Users.findById(userId, "vouchers points").lean();
    if (!user) return res.status(404).json({ success: false, error: "User not found" });

    const now = new Date();
    const vouchers = (user.vouchers || []).map((v) => {
      const expired = v.expiresAt ? new Date(v.expiresAt) < now : false;
      return {
        _id:             String(v._id),
        code:            v.code,
        title:           v.title,
        message:         v.message || "",
        discountPercent: v.discountPercent,
        maxDiscount:     v.maxDiscount || 0,
        expiresAt:       v.expiresAt || null,
        used:            v.used || false,
        usedAt:          v.usedAt || null,
        issuedAt:        v.issuedAt,
        // Convenience flag for the frontend
        active:          !v.used && !expired,
        expired,
      };
    });

    // Sort: active first (newest issued), then used/expired
    vouchers.sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return new Date(b.issuedAt) - new Date(a.issuedAt);
    });

    return res.json({ success: true, vouchers, points: user.points || 0 });
  } catch (err) {
    console.error("GET /my-vouchers error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

// ─── POST /apply-voucher ──────────────────────────────────────────────────────
// Validates a voucher code against the authenticated user and computes
// the discounted total. Does NOT mark the voucher as used — that happens
// inside placeOrder after the transaction commits.
//
// Body: { code: string, subtotal: number }
// Response: { success, discountAmount, discountPercent, newTotal, voucher }
const applyVoucher = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: "Unauthorized" });

    const { code, subtotal } = req.body;
    if (!code) return res.status(400).json({ success: false, error: "Voucher code is required" });
    if (typeof subtotal !== "number" || subtotal <= 0)
      return res.status(400).json({ success: false, error: "Valid subtotal is required" });

    const user = await Users.findById(userId, "vouchers").lean();
    if (!user) return res.status(404).json({ success: false, error: "User not found" });

    const now = new Date();
    const voucher = (user.vouchers || []).find(
      (v) => v.code === code.trim().toUpperCase()
    );

    if (!voucher)
      return res.status(404).json({ success: false, error: "Voucher not found on your account" });
    if (voucher.used)
      return res.status(400).json({ success: false, error: "This voucher has already been used" });
    if (voucher.expiresAt && new Date(voucher.expiresAt) < now)
      return res.status(400).json({ success: false, error: "This voucher has expired" });

    // Compute discount
    const rawDiscount = (subtotal * voucher.discountPercent) / 100;
    const discountAmount = voucher.maxDiscount > 0
      ? Math.min(rawDiscount, voucher.maxDiscount)
      : rawDiscount;
    const discountAmountRounded = Math.round(discountAmount * 100) / 100;
    const newTotal = Math.max(0, Math.round((subtotal - discountAmountRounded) * 100) / 100);

    return res.json({
      success: true,
      discountAmount:  discountAmountRounded,
      discountPercent: voucher.discountPercent,
      maxDiscount:     voucher.maxDiscount || 0,
      newTotal,
      voucher: {
        _id:             String(voucher._id),
        code:            voucher.code,
        title:           voucher.title,
        message:         voucher.message || "",
        discountPercent: voucher.discountPercent,
        maxDiscount:     voucher.maxDiscount || 0,
        expiresAt:       voucher.expiresAt || null,
      },
    });
  } catch (err) {
    console.error("POST /apply-voucher error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

module.exports = { getMyVouchers, applyVoucher };