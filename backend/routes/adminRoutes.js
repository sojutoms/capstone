// routes/adminRoutes.js
const express = require("express");
const router = express.Router();
const { requireRole } = require("../middleware/auth");

const {
  getAdminOrders,
  getAdminOrder,
  updateOrderStatus,
  getStatsOverview,
  getMonthlySales,
  getCategorySales,
  getLowStock,
  getSalesData,
  getSalesLog,
  giveVoucher,
  adminLogin,
  assignRole,
  createStaff,
  getAllReviews,
  deleteReview,
  posSale,
} = require("../controllers/adminController");

const {
  writeAuditLog,
  getAuditLog,
  getActiveSessions,
  forceLogout,
  getLoginAlerts,
} = require("../controllers/securityController");

const adminAuth = requireRole("owner", "admin", "staff");
const ownerAuth = requireRole("owner");

// ─── Auth (Public for login) ──────────────────────────────────────────────────
router.post("/admin/login", adminLogin);

// ─── Protected Routes ─────────────────────────────────────────────────────────

// ─── Orders ──────────────────────────────────────────────────────────────────
router.get("/admin/orders", adminAuth, getAdminOrders);
router.get("/admin/order/:orderNumber", adminAuth, getAdminOrder);
router.post("/admin/order/:orderNumber/status", adminAuth, updateOrderStatus);

// ─── Stats / Sales ────────────────────────────────────────────────────────────
router.get("/admin/stats/overview", adminAuth, getStatsOverview);
router.get("/admin/stats/monthly-sales", adminAuth, getMonthlySales);
router.get("/admin/stats/category-sales", adminAuth, getCategorySales);
router.get("/admin/stats/low-stock", adminAuth, getLowStock);
router.get("/salesdata", adminAuth, getSalesData);
router.get("/saleslog", adminAuth, getSalesLog);

// ─── Users / Roles ────────────────────────────────────────────────────────────
router.post("/admin/give-voucher", adminAuth, giveVoucher);
router.post("/admin/assign-role", ownerAuth, assignRole);
router.post("/admin/create-staff", ownerAuth, createStaff);
router.get("/admin/allreviews", adminAuth, getAllReviews);
router.delete("/admin/deletereview/:reviewId", adminAuth, deleteReview);

// ─── Security — Audit Log ─────────────────────────────────────────────────────
router.post("/admin/audit-log", adminAuth, writeAuditLog);
router.get("/admin/audit-log", ownerAuth, getAuditLog);

// ─── Security — Sessions ──────────────────────────────────────────────────────
router.get("/admin/sessions", ownerAuth, getActiveSessions);
router.post("/admin/force-logout", ownerAuth, forceLogout);

// ─── Security — Login Alerts ──────────────────────────────────────────────────
router.get("/admin/login-alerts", ownerAuth, getLoginAlerts);

// ─── POS ──────────────────────────────────────────────────────────────────────
router.post("/admin/pos/sale", adminAuth, posSale);

// ─── AI Analysis Proxy ────────────────────────────────────────────────────────
router.post("/admin/ai/sales-analysis", adminAuth, async (req, res) => {
  try {
    const { trend, categorySales } = req.body;

    const topCategory = categorySales?.length > 0
      ? categorySales.reduce((max, c) => (c.sales > max.sales ? c : max)).category
      : "unknown";

    const prompt = `You are a concise e-commerce analyst. Given the following data, write ONE short paragraph (2-3 sentences, max 60 words) explaining the most likely reasons for the sales change. Be specific and actionable. Do NOT use bullet points.

Data:
- Previous month (${trend.previousMonth}) sales: ₱${Number(trend.previousSales).toLocaleString()}
- Current month (${trend.currentMonth}) sales: ₱${Number(trend.currentSales).toLocaleString()}
- Change: ${trend.direction === "up" ? "+" : "-"}${trend.percent}%
- Best performing category: ${topCategory}

Respond with plain text only.`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        max_tokens: 300,
        reasoning_effort: "low",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "No analysis available.";
    res.json({ success: true, analysis: text });
  } catch (err) {
    console.error("AI analysis error:", err);
    res.status(500).json({ success: false, error: "Failed to generate analysis" });
  }
});

module.exports = router;
