const mongoose = require("mongoose");
const axios = require("axios");
const Orders = require("../models/Orders");
const Users = require("../models/Users");
const Product = require("../models/Product");
const { ShoeSequence } = require("../models/index");
const { normalizeProductSizes, convertMapToDbShape, getSizePriceFromMap } = require("../utils/sizes");

const SIMPLE_CATEGORIES = ["bags", "collectibles"];
const NCR_PSGC_CODE = "1300000000";

// ─── helpers ──────────────────────────────────────────────────────────────────
async function restoreStockForOrder(order) {
  if (!order || !Array.isArray(order.items)) return;
  for (const it of order.items) {
    const sizeKey = String(it.size || "").trim();
    const qty = Number(it.quantity || 0);
    if (!qty) continue;

    const product = await Product.findOne({ id: Number(it.id) });
    if (!product) continue;

    if (!sizeKey) {
      product.stock = (product.stock || 0) + qty;
      product.salesCount = Math.max(0, (product.salesCount || 0) - qty);
      product.available = product.stock > 0;
      await product.save();
      continue;
    }

    const sizesArray = Array.isArray(product.sizes) ? product.sizes : [];
    const sizeIndex = sizesArray.findIndex((s) => String(s.size).trim() === sizeKey);
    if (sizeIndex !== -1) {
      product.sizes[sizeIndex].quantity = (product.sizes[sizeIndex].quantity || 0) + qty;
    } else {
      product.sizes.push({ size: sizeKey, quantity: qty, price: it.price || 0 });
    }
    product.salesCount = Math.max(0, (product.salesCount || 0) - qty);
    product.available = product.sizes.some((s) => Number(s.quantity) > 0);
    product.markModified("sizes");
    await product.save();
  }
}

async function enqueueRefundIfNeeded(order) {
  try {
    const nonCod = !order.paymentMethod || !/cash|cod/i.test(order.paymentMethod);
    if (nonCod) console.log(`Enqueue refund placeholder for order ${order.orderNumber}`);
  } catch (err) {
    console.error("enqueueRefundIfNeeded error:", err);
  }
}

// ─── deriveDisplayStatus ──────────────────────────────────────────────────────
// Single source of truth for what status pill to show on both admin and
// customer sides. Called server-side so the frontend just reads `displayStatus`.
//
// Mapping:
//   order.status "refund_requested" + refundStatus "pending"   → "refund_requested"
//   order.status "refund_requested" + refundStatus "approved"  → "refund_approved"
//   order.status "completed"        + refundStatus "rejected"  → "refund_rejected"
//   order.status "refunded"                                    → "refunded"
//   anything else                                              → order.status as-is
const deriveDisplayStatus = (order) => {
  const s  = order.status      || "pending";
  const rs = order.refundStatus || null;

  if (s === "refund_requested") {
    if (rs === "approved") return "refund_approved";
    return "refund_requested"; // pending or null
  }
  if (s === "completed" && rs === "rejected") return "refund_rejected";
  return s;
};

// ─── GET /orderhistory ────────────────────────────────────────────────────────
const getOrderHistory = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(50, parseInt(req.query.limit, 10) || 5));
    const userIdStr = String(req.user?.id || "");
    if (!userIdStr) return res.status(401).json({ success: false, error: "Unauthorized" });

    const userIdObj = mongoose.Types.ObjectId.isValid(userIdStr) ? new mongoose.Types.ObjectId(userIdStr) : null;
    const { status } = req.query;

    console.log(`[OrderHistory] User: ${userIdStr}, Status Filter: ${status}`);

    // ─── Query Construction ──────────────────────────────────────────────────
    let query = {
      $or: [
        { userId: userIdStr },
        { user: userIdStr },
        ...(userIdObj ? [
          { userId: userIdObj },
          { user: userIdObj }
        ] : [])
      ]
    };

    if (status && status !== "all") {
      let statusMatch;
      if (status === "return") {
        statusMatch = {
          $or: [
            { status: { $in: ["refund_requested", "refunded"] } },
            { refundStatus: { $exists: true, $ne: null } }
          ]
        };
      } else {
        // Handle potential case variations or multiple backend status mappings
        if (status === "confirmed") {
          statusMatch = { status: { $in: ["confirmed", "processing"] } };
        } else if (status === "shipping") {
          statusMatch = { status: { $in: ["shipping", "shipped"] } };
        } else {
          statusMatch = { status };
        }
      }
      
      // Combine with user filter
      query = { $and: [query, statusMatch] };
    }

    console.log("[OrderHistory] Final Query:", JSON.stringify(query));

    const total = await Orders.countDocuments(query);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const orders = await Orders.find(query)
      .sort({ timestamp: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Lifetime stats still need to be calculated across all orders
    const statsAgg = await Orders.aggregate([
      { 
        $match: { 
          $or: [
            { userId: userIdStr },
            { user: userIdStr },
            ...(userIdObj ? [{ userId: userIdObj }, { user: userIdObj }] : [])
          ]
        } 
      },
      { 
        $group: { 
          _id: null, 
          totalSpend: { $sum: { $convert: { input: "$total", to: "double", onError: 0, onNull: 0 } } },
          totalOrders: { $sum: 1 },
          earliestOrder: { $min: { $ifNull: ["$timestamp", "$createdAt"] } }
        } 
      }
    ]);

    const lifetimeStats = statsAgg[0] || { totalSpend: 0, totalOrders: 0, earliestOrder: null };

    const enriched = orders.map((o) => ({ ...o, displayStatus: deriveDisplayStatus(o) }));

    return res.json({
      success: true,
      orders: enriched,
      page,
      limit,
      total,
      totalPages,
      lifetimeStats
    });
  } catch (err) {
    console.error("Order history error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

// ─── GET /order/:orderNumber ───────────────────────────────────────────────────
// Owner-scoped lookup used by the post-checkout receipt page (including the
// redirect back from a PayMongo hosted checkout session, which lands on a
// fresh page load with no React Router state).
const getOrderByNumber = async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ success: false, error: "Unauthorized" });

    const order = await Orders.findOne({ orderNumber }).lean();
    if (!order) return res.status(404).json({ success: false, error: "Order not found" });
    if (String(order.userId || "") !== String(userId))
      return res.status(403).json({ success: false, error: "Not allowed to view this order" });

    return res.json({ success: true, order: { ...order, displayStatus: deriveDisplayStatus(order) } });
  } catch (err) {
    console.error("getOrderByNumber error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

// ─── ADMIN: GET /admin/orders ─────────────────────────────────────────────────
const adminGetOrders = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit = Math.max(1, Math.min(50, parseInt(req.query.limit, 10) || 12));
    const { status, q } = req.query;

    let filter = {};
    if (status && status !== "all") filter.status = status;

    if (q && q.trim()) {
      const esc = q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const rx  = new RegExp(esc, "i");
      const searchOr = [
        { orderNumber: rx },
        { "deliveryInfo.firstName": rx },
        { "deliveryInfo.lastName":  rx },
        { "deliveryInfo.email":     rx },
        { userId: rx },
      ];
      filter = Object.keys(filter).length
        ? { $and: [filter, { $or: searchOr }] }
        : { $or: searchOr };
    }

    const total  = await Orders.countDocuments(filter);
    const orders = await Orders.find(filter)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const enriched = orders.map((o) => ({
      ...o,
      displayStatus: deriveDisplayStatus(o),
      buyer: {
        name:  `${o.deliveryInfo?.firstName || ""} ${o.deliveryInfo?.lastName || ""}`.trim() || "—",
        email: o.deliveryInfo?.email || "—",
        phone: o.deliveryInfo?.phone || "—",
      },
    }));

    return res.json({ success: true, orders: enriched, total, page, totalPages: Math.max(1, Math.ceil(total / limit)) });
  } catch (err) {
    console.error("adminGetOrders error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

// ─── ADMIN: GET /admin/order/:orderNumber ─────────────────────────────────────
const adminGetOrder = async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const o = await Orders.findOne({ orderNumber }).lean();
    if (!o) return res.status(404).json({ success: false, error: "Order not found" });

    return res.json({
      success: true,
      order: {
        ...o,
        displayStatus: deriveDisplayStatus(o),
        buyer: {
          name:  `${o.deliveryInfo?.firstName || ""} ${o.deliveryInfo?.lastName || ""}`.trim() || "—",
          email: o.deliveryInfo?.email || "—",
          phone: o.deliveryInfo?.phone || "—",
        },
      },
    });
  } catch (err) {
    console.error("adminGetOrder error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

// ─── ADMIN: POST /admin/order/:orderNumber/status ─────────────────────────────
const adminUpdateOrderStatus = async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const { status, rider } = req.body;
    const adminId = req.user && (req.user.userId || req.user.id || req.user._id);

    const order = await Orders.findOne({ orderNumber });
    if (!order) return res.status(404).json({ success: false, error: "Order not found" });

    const now = new Date();
    order.status    = status;
    order.updatedAt = now;

    if (status === "delivered") order.deliveredAt = now;
    if (status === "completed") order.completedAt = now;

    if (status === "cancelled") {
      await restoreStockForOrder(order.toObject());
      try {
        await ShoeSequence.updateMany(
          { orderNumber, status: "sold" },
          { $set: { status: "available", soldDate: null, soldToUserId: null, orderNumber: null } }
        );
      } catch (err) { console.error("SKU restore on admin cancel failed:", err); }
      if (order.voucherCode) {
        try {
          await Users.findOneAndUpdate(
            { "vouchers.code": order.voucherCode },
            { $set: { "vouchers.$.used": false, "vouchers.$.usedAt": null, "vouchers.$.usedOnOrder": null } }
          );
        } catch (err) { console.error("Voucher restore on admin cancel failed:", err); }
      }
    }

    if (status === "shipping" && rider) {
      order.rider = {
        name:  (rider.name  || "").trim(),
        plate: (rider.plate || "").trim(),
        phone: (rider.phone || "").trim(),
      };
    }

    if (adminId) {
      order.processedBy = {
        email: req.user.email || null,
        name:  req.user.name  || null,
      };
    }

    await order.save();
    const saved = order.toObject();

    return res.json({
      success: true,
      order: {
        ...saved,
        displayStatus: deriveDisplayStatus(saved),
        buyer: {
          name:  `${saved.deliveryInfo?.firstName || ""} ${saved.deliveryInfo?.lastName || ""}`.trim() || "—",
          email: saved.deliveryInfo?.email || "—",
          phone: saved.deliveryInfo?.phone || "—",
        },
      },
    });
  } catch (err) {
    console.error("adminUpdateOrderStatus error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

// ─── POST /order/:orderNumber/cancel ─────────────────────────────────────────
const cancelOrder = async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ success: false, error: "Unauthorized" });

    const order = await Orders.findOne({ orderNumber }).lean();
    if (!order) return res.status(404).json({ success: false, error: "Order not found" });
    if (String(order.userId || "") !== String(userId))
      return res.status(403).json({ success: false, error: "Not allowed to cancel this order" });

    const currentStatus = (order.status || "pending").toLowerCase();
    if (!["pending", "confirmed"].includes(currentStatus))
      return res.status(400).json({ success: false, error: `Cannot cancel an order with status '${currentStatus}'` });

    const updatedDoc = await Orders.findOneAndUpdate(
      { orderNumber },
      { $set: { status: "cancelled", updatedAt: new Date() } },
      { new: true }
    );
    if (!updatedDoc)
      return res.status(409).json({ success: false, error: "Order state changed, please refresh and try again" });

    const updated = updatedDoc.toObject();

    if (updated.voucherCode && userId) {
      try {
        await Users.findOneAndUpdate(
          { _id: userId, "vouchers.code": updated.voucherCode },
          { $set: { "vouchers.$.used": false, "vouchers.$.usedAt": null, "vouchers.$.usedOnOrder": null } }
        );
      } catch (err) { console.error("Voucher restore on cancel error:", err); }
    }

    try { await restoreStockForOrder(updated); } catch (err) { console.error("restoreStockForOrder failed:", err); }

    try {
      const skuResult = await ShoeSequence.updateMany(
        { orderNumber: updated.orderNumber, status: "sold" },
        { $set: { status: "available", soldDate: null, soldToUserId: null, orderNumber: null } }
      );
      console.log(`SKUs restored: ${skuResult.modifiedCount}`);
    } catch (err) { console.error("SKU restore failed:", err); }

    return res.json({ success: true, order: { ...updated, displayStatus: deriveDisplayStatus(updated) } });
  } catch (err) {
    console.error("cancelOrder error:", err);
    return res.status(500).json({ success: false, error: "Server error while cancelling order." });
  }
};

// ─── POST /order/:orderNumber/confirm-received ────────────────────────────────
const confirmOrderReceived = async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ success: false, error: "Unauthorized" });

    const order = await Orders.findOne({ orderNumber });
    if (!order) return res.status(404).json({ success: false, error: "Order not found" });
    if (String(order.userId || "") !== String(userId))
      return res.status(403).json({ success: false, error: "Not allowed to confirm this order" });
    if (order.status !== "delivered")
      return res.status(400).json({
        success: false,
        error: `Order cannot be confirmed in its current status: '${order.status}'`,
      });

    const now = new Date();
    order.status      = "completed";
    order.completedAt = now;
    order.updatedAt   = now;
    await order.save();

    // Award points logic is now handled in placeOrder.

    const saved = order.toObject();
    return res.json({ success: true, order: { ...saved, displayStatus: deriveDisplayStatus(saved) } });
  } catch (err) {
    console.error("confirmOrderReceived error:", err);
    return res.status(500).json({ success: false, error: "Server error while confirming receipt." });
  }
};

// ─── POST /order/:orderNumber/return ─────────────────────────────────────────
const requestReturn = async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ success: false, error: "Unauthorized" });

    const order = await Orders.findOne({ orderNumber }).lean();
    if (!order) return res.status(404).json({ success: false, error: "Order not found" });

    const isOwner = String(order.userId || "") === String(userId);
    const isAdmin = !!(req.user && req.user.isAdmin);
    if (!isOwner && !isAdmin)
      return res.status(403).json({ success: false, error: "Not allowed to request return for this order" });
    if ((order.status || "").toLowerCase() !== "completed")
      return res.status(400).json({ success: false, error: "Returns are only allowed for completed orders" });

    const reason = (req.body.reason || "").trim();
    if (!reason) return res.status(400).json({ success: false, error: "Return reason is required" });

    const returnRequest = {
      _id: new mongoose.Types.ObjectId(),
      requestedAt: new Date(), requestedBy: userId, reason,
      notes: req.body.notes || null, status: "requested",
      imagePath: req.file ? `/images/${req.file.filename}` : null,
      updatedAt: new Date(),
    };

    await Orders.findOneAndUpdate(
      { orderNumber },
      { $push: { returns: returnRequest }, $set: { updatedAt: new Date() } },
      { new: true }
    ).lean();

    res.json({ success: true, returnRequest });
  } catch (err) {
    console.error("requestReturn error:", err);
    res.status(500).json({ success: false, error: "Server error while submitting return." });
  }
};

// ─── POST /order/:orderNumber/refund ─────────────────────────────────────────
const requestRefund = async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const reason = (req.body.reason || "").trim();
    const notes  = (req.body.notes  || "").trim();
    const userId = req.user && req.user.id;

    if (!userId) return res.status(401).json({ success: false, error: "Unauthorized" });
    if (!reason)
      return res.status(400).json({ success: false, error: "Please select a reason for the refund." });

    const files = req.files || [];
    if (files.length === 0)
      return res.status(400).json({ success: false, error: "At least one photo or video is required." });

    const order = await Orders.findOne({ orderNumber });
    if (!order) return res.status(404).json({ success: false, error: "Order not found" });

    const isOwner = String(order.userId || "") === String(userId);
    const isAdmin = !!(req.user && (req.user.isAdmin || (Array.isArray(req.user.roles) && req.user.roles.includes("admin"))));
    if (!isOwner && !isAdmin)
      return res.status(403).json({ success: false, error: "Not allowed" });

    const DELIVERED_AUTO_COMPLETE_MS = 3 * 24 * 60 * 60 * 1000;
    const rawStatus = (order.status || "").toLowerCase();

    if (rawStatus === "delivered") {
      const deliveredAt = order.deliveredAt || order.updatedAt;
      const elapsed = deliveredAt ? Date.now() - new Date(deliveredAt).getTime() : 0;
      if (elapsed >= DELIVERED_AUTO_COMPLETE_MS) {
        const nowPromo = new Date();
        order.status      = "completed";
        order.completedAt = order.completedAt || nowPromo;
        order.updatedAt   = nowPromo;
        await order.save();
      } else {
        return res.status(400).json({ success: false, error: "Refunds only allowed for completed orders" });
      }
    } else if (rawStatus !== "completed") {
      return res.status(400).json({ success: false, error: "Refunds only allowed for completed orders" });
    }

    if (order.refundStatus && order.refundStatus !== null)
      return res.status(409).json({ success: false, error: "Refund already requested for this order" });

    const REFUND_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
    const completedAt = order.completedAt || order.updatedAt;
    if (completedAt && Date.now() - new Date(completedAt).getTime() > REFUND_WINDOW_MS) {
      return res.status(400).json({
        success: false,
        error: "Refund window has expired. Refunds must be requested within 3 days of order completion.",
      });
    }

    const mediaPaths = files.map((f) => ({
      url:          f.path,
      type:         f.mimetype && f.mimetype.startsWith("video/") ? "video" : "image",
      originalName: f.originalname,
      size:         f.size,
    }));

    const now = new Date();
    order.status            = "refund_requested";
    order.refundReason      = reason;
    order.refundNotes       = notes || null;
    order.refundMedia       = mediaPaths;
    order.refundStatus      = "pending";
    order.refundAdminNote   = null;
    order.refundSubmittedAt = now;
    order.refundResolvedAt  = null;
    order.refundResolvedBy  = null;
    order.updatedAt         = now;

    if (typeof order.markModified === "function") order.markModified("refundMedia");
    await order.save();

    const saved = order.toObject();
    return res.json({ success: true, order: { ...saved, displayStatus: deriveDisplayStatus(saved) } });
  } catch (err) {
    console.error("Refund request error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

// ─── ADMIN: GET /admin/refunds ────────────────────────────────────────────────
const adminGetRefunds = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit = Math.max(1, Math.min(50, parseInt(req.query.limit, 10) || 10));
    const { status, q } = req.query;

    const REFUND_ORDER_STATUSES = ["refund_requested", "refunded"];

    let filter;
    if (status && status !== "all") {
      if (status === "pending")  filter = { status: "refund_requested", refundStatus: { $in: ["pending", null] } };
      else if (status === "refunded") filter = { status: "refunded" };
      else if (status === "rejected") filter = { refundStatus: "rejected" };
      else if (status === "approved") filter = { refundStatus: "approved" };
      else filter = { status: { $in: REFUND_ORDER_STATUSES } };
    } else {
      filter = {
        $or: [
          { status: { $in: REFUND_ORDER_STATUSES } },
          { refundReason:  { $exists: true, $ne: null } },
          { refundStatus:  { $exists: true, $ne: null } },
        ],
      };
    }

    if (q && q.trim()) {
      const esc = q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const rx  = new RegExp(esc, "i");
      filter = { $and: [filter, { $or: [
        { orderNumber: rx },
        { "deliveryInfo.firstName": rx },
        { "deliveryInfo.lastName":  rx },
        { "deliveryInfo.email":     rx },
      ]}]};
    }

    const total  = await Orders.countDocuments(filter);
    const orders = await Orders.find(filter)
      .sort({ refundSubmittedAt: -1, updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const refunds = orders.map((o) => {
      let refundStatus = o.refundStatus;
      if (!refundStatus) {
        if (o.status === "refunded") refundStatus = "refunded";
        else if (o.status === "completed" && o.refundReason) refundStatus = "rejected";
        else refundStatus = "pending";
      }
      return {
        _id:         o._id,
        orderNumber: o.orderNumber,
        buyer: {
          name:  `${o.deliveryInfo?.firstName || ""} ${o.deliveryInfo?.lastName || ""}`.trim() || "—",
          email: o.deliveryInfo?.email || "—",
          phone: o.deliveryInfo?.phone || "—",
        },
        items:       o.items || [],
        total:       o.total,
        reason:      o.refundReason    || "—",
        notes:       o.refundNotes     || null,
        media:       o.refundMedia     || [],
        status:      refundStatus,
        adminNote:   o.refundAdminNote || null,
        submittedAt: o.refundSubmittedAt || o.updatedAt,
        resolvedAt:  o.refundResolvedAt  || null,
      };
    });

    return res.json({ success: true, refunds, total, page, totalPages: Math.max(1, Math.ceil(total / limit)) });
  } catch (err) {
    console.error("adminGetRefunds error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

// ─── ADMIN: GET /admin/refund/:id ─────────────────────────────────────────────
const adminGetRefundById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ success: false, error: "Invalid id" });

    const o = await Orders.findById(id).lean();
    const hasRefund = o && (o.refundStatus || o.refundReason || ["refund_requested", "refunded"].includes(o.status));
    if (!hasRefund) return res.status(404).json({ success: false, error: "Refund request not found" });

    let refundStatus = o.refundStatus;
    if (!refundStatus) {
      if (o.status === "refunded") refundStatus = "refunded";
      else if (o.status === "completed" && o.refundReason) refundStatus = "rejected";
      else refundStatus = "pending";
    }

    return res.json({
      success: true,
      refund: {
        _id:           o._id,
        orderNumber:   o.orderNumber,
        buyer: {
          name:  `${o.deliveryInfo?.firstName || ""} ${o.deliveryInfo?.lastName || ""}`.trim() || "—",
          email: o.deliveryInfo?.email || "—",
          phone: o.deliveryInfo?.phone || "—",
        },
        items:         o.items || [],
        total:         o.total,
        paymentMethod: o.paymentMethod,
        reason:        o.refundReason      || "—",
        notes:         o.refundNotes       || null,
        media:         o.refundMedia       || [],
        status:        refundStatus,
        adminNote:     o.refundAdminNote   || null,
        submittedAt:   o.refundSubmittedAt || o.updatedAt,
        resolvedAt:    o.refundResolvedAt  || null,
      },
    });
  } catch (err) {
    console.error("adminGetRefundById error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

// ─── ADMIN: POST /admin/refund/:id/status ─────────────────────────────────────
const adminUpdateRefundStatus = async (req, res) => {
  try {
    const { id }                = req.params;
    const { status, adminNote } = req.body;
    const adminId = req.user && (req.user.userId || req.user.id || req.user._id);

    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ success: false, error: "Invalid id" });

    const VALID_TRANSITIONS = ["approved", "rejected", "refunded"];
    if (!VALID_TRANSITIONS.includes(status))
      return res.status(400).json({ success: false, error: `Invalid status. Must be one of: ${VALID_TRANSITIONS.join(", ")}` });

    const order = await Orders.findById(id);
    const hasRefund = order && (order.refundStatus || order.refundReason || ["refund_requested", "refunded"].includes(order.status));
    if (!hasRefund) return res.status(404).json({ success: "Refund request not found" });

    // Derive current refund sub-status from flat field
    let current = order.refundStatus;
    if (!current) {
      if (order.status === "refund_requested") current = "pending";
      else if (order.status === "refunded")    current = "refunded";
      else if (order.status === "completed" && order.refundReason) current = "rejected";
      else current = "pending";
    }

    const ALLOWED = {
      pending:  ["approved", "rejected"],
      approved: ["refunded"],
      rejected: [],
      refunded: [],
    };

    if (!ALLOWED[current] || !ALLOWED[current].includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Cannot transition refund from "${current}" to "${status}"`,
      });
    }

    const now = new Date();
    order.refundStatus     = status;
    order.refundAdminNote  = (adminNote || "").trim() || order.refundAdminNote || null;
    order.refundResolvedAt = now;
    order.refundResolvedBy = adminId ? String(adminId) : null;
    order.updatedAt        = now;

    // Sync top-level order.status:
    //   approved  → stays "refund_requested" (money not yet sent)
    //   rejected  → revert to "completed"
    //   refunded  → "refunded"
    if (status === "refunded") order.status = "refunded";
    else if (status === "rejected") order.status = "completed";

    await order.save();
    const saved = order.toObject();

    return res.json({
      success: true,
      refund: {
        _id:           saved._id,
        orderNumber:   saved.orderNumber,
        status:        saved.refundStatus,
        adminNote:     saved.refundAdminNote,
        resolvedAt:    saved.refundResolvedAt,
        displayStatus: deriveDisplayStatus(saved),  // e.g. "refund_approved"
      },
    });
  } catch (err) {
    console.error("adminUpdateRefundStatus error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

// ─── POST /placeorder ─────────────────────────────────────────────────────────
const placeOrder = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { items, total: clientTotal, deliveryInfo, paymentMethod, voucherCode, pointsUsed } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0)
      return res.status(400).json({ success: false, error: "Invalid items" });
    if (!deliveryInfo || typeof deliveryInfo !== "object")
      return res.status(400).json({ success: false, error: "Delivery info required" });
    if (!paymentMethod)
      return res.status(400).json({ success: false, error: "Payment method required" });

    const sanitize = (s) => (typeof s === "string" ? s.trim() : "");
    const firstName   = sanitize(deliveryInfo.firstName || "");
    const lastName    = sanitize(deliveryInfo.lastName  || "");
    const email       = sanitize(deliveryInfo.email     || "").toLowerCase();
    const phoneRaw    = sanitize(deliveryInfo.phone     || "");
    const phoneDigits = phoneRaw.replace(/\D/g, "");

    if (!firstName) return res.status(400).json({ success: false, error: "First name is required" });
    if (!/^[A-Za-z\s'-]+$/.test(firstName)) return res.status(400).json({ success: false, error: "First name cannot contain numbers or special characters" });
    if (!lastName) return res.status(400).json({ success: false, error: "Last name is required" });
    if (!/^[A-Za-z\s'-]+$/.test(lastName)) return res.status(400).json({ success: false, error: "Last name cannot contain numbers or special characters" });
    if (!email) return res.status(400).json({ success: false, error: "Email is required" });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ success: false, error: "Enter a valid email address with a domain" });
    if (!phoneDigits) return res.status(400).json({ success: false, error: "Phone number is required" });
    if (!/^\d{10,11}$/.test(phoneDigits)) return res.status(400).json({ success: false, error: "Phone number must be 10 or 11 digits" });

    const di = deliveryInfo;
    if (!di.region || (!di.region.code && !di.region.name))
      return res.status(400).json({ success: false, error: "Region code required" });
    if (!di.cityOrMunicipality || (!di.cityOrMunicipality.code && !di.cityOrMunicipality.name))
      return res.status(400).json({ success: false, error: "City/Municipality code required" });
    if (!di.barangay || (!di.barangay.code && !di.barangay.name))
      return res.status(400).json({ success: false, error: "Barangay code required" });

    const normalizeRegionId = (region) => {
      if (!region) return "";
      if (region.code) { const c = String(region.code).trim(); const digits = c.replace(/\D/g, ""); return digits || c.toUpperCase(); }
      if (region.name) return String(region.name).trim().toLowerCase();
      return "";
    };

    const regionNormalized = normalizeRegionId(di.region);
    const regionMatchesNCR =
      regionNormalized === NCR_PSGC_CODE ||
      String(regionNormalized).toUpperCase() === "NCR" ||
      String(regionNormalized).includes("national capital") ||
      String(regionNormalized).includes("metro manila");

    if (!di.province || (!di.province.code && !di.province.name)) {
      if (regionMatchesNCR) { di.province = { code: NCR_PSGC_CODE, name: "Metro Manila" }; }
      else return res.status(400).json({ success: false, error: "Province code required for the selected region" });
    } else {
      if (regionMatchesNCR && !di.province.code) { di.province.code = NCR_PSGC_CODE; if (!di.province.name) di.province.name = "Metro Manila"; }
    }

    const ENABLE_PSGC_VERIFICATION = true;
    if (ENABLE_PSGC_VERIFICATION) {
      try {
        const base = "https://psgc.cloud/api";
        const regionQuery = di.region.code ? di.region.code : di.region.name;
        const regionRes = await axios.get(`${base}/regions/${encodeURIComponent(regionQuery)}`).catch(() => null);
        if (!regionRes || !regionRes.data) {
          if (di.region.name) {
            const searchRes = await axios.get(`${base}/regions`).catch(() => null);
            const list = Array.isArray(searchRes?.data) ? searchRes.data : [];
            const found = list.find((r) => String(r.name).trim().toLowerCase() === String(di.region.name).trim().toLowerCase());
            if (!found) throw new Error("Invalid region code or name");
          } else throw new Error("Invalid region code");
        }

        if (String(di.province.code) !== NCR_PSGC_CODE) {
          const provQuery = di.province.code ? di.province.code : di.province.name;
          const provRes = await axios.get(`${base}/provinces/${encodeURIComponent(provQuery)}`).catch(() => null);
          if (!provRes || !provRes.data) {
            if (di.province.name) {
              const provListRes = await axios.get(`${base}/provinces`).catch(() => null);
              const provList = Array.isArray(provListRes?.data) ? provListRes.data : [];
              const foundProv = provList.find((p) => String(p.name).trim().toLowerCase() === String(di.province.name).trim().toLowerCase());
              if (!foundProv) throw new Error("Invalid province code or name");
            } else throw new Error("Invalid province code");
          } else {
            if (provRes.data.region_code && di.region.code && String(provRes.data.region_code) !== String(di.region.code))
              throw new Error("Province does not belong to selected region");
          }
        }

        const cityQuery = di.cityOrMunicipality.code ? di.cityOrMunicipality.code : di.cityOrMunicipality.name;
        if (String(di.province.code) === NCR_PSGC_CODE) {
          const regionCitiesRes = await axios.get(`${base}/regions/${encodeURIComponent(NCR_PSGC_CODE)}/cities-municipalities`).catch(() => null);
          const regionCities = Array.isArray(regionCitiesRes?.data) ? regionCitiesRes.data : [];
          const foundCity = regionCities.find((c) => {
            if (di.cityOrMunicipality.code && c.code) return String(c.code) === String(di.cityOrMunicipality.code);
            if (di.cityOrMunicipality.name && c.name) return String(c.name || "").trim().toLowerCase() === String(di.cityOrMunicipality.name || "").trim().toLowerCase();
            return false;
          });
          if (!foundCity) throw new Error("Invalid city/municipality for NCR/Metro Manila");
        } else {
          const cityRes = await axios.get(`${base}/cities-municipalities/${encodeURIComponent(cityQuery)}`).catch(() => null);
          if (!cityRes || !cityRes.data) {
            let fallbackList = [];
            if (di.province && di.province.code) {
              const provCitiesRes = await axios.get(`${base}/provinces/${encodeURIComponent(di.province.code)}/cities-municipalities`).catch(() => null);
              fallbackList = Array.isArray(provCitiesRes?.data) ? provCitiesRes.data : [];
            } else {
              const regionCitiesRes = await axios.get(`${base}/regions/${encodeURIComponent(regionQuery)}/cities-municipalities`).catch(() => null);
              fallbackList = Array.isArray(regionCitiesRes?.data) ? regionCitiesRes.data : [];
            }
            const foundCity = fallbackList.find((c) => {
              if (di.cityOrMunicipality.code && c.code) return String(c.code) === String(di.cityOrMunicipality.code);
              if (di.cityOrMunicipality.name && c.name) return String(c.name || "").trim().toLowerCase() === String(di.cityOrMunicipality.name || "").trim().toLowerCase();
              return false;
            });
            if (!foundCity) throw new Error("Invalid city/municipality code or name");
          } else {
            if (cityRes.data.province_code && di.province && di.province.code && String(cityRes.data.province_code) !== String(di.province.code))
              throw new Error("City/Municipality does not belong to selected province");
            if (cityRes.data.region_code) {
              const cityRegion = String(cityRes.data.region_code || "").replace(/\D/g, "");
              const regionDigits = String(normalizeRegionId(di.region) || "").replace(/\D/g, "");
              if (cityRegion && regionDigits && cityRegion !== regionDigits) throw new Error("City/Municipality does not belong to selected region");
            }
          }
        }

        const barangayQuery = di.barangay.code ? di.barangay.code : di.barangay.name;
        const barangayRes = await axios.get(`${base}/barangays/${encodeURIComponent(barangayQuery)}`).catch(() => null);
        if (!barangayRes || !barangayRes.data) {
          const fallback = await axios.get(`${base}/barangays?city_code=${encodeURIComponent(cityQuery)}`).catch(() => null);
          const list = Array.isArray(fallback?.data) ? fallback.data : [];
          const found = list.find((b) => {
            if (di.barangay.code && b.code) return String(b.code) === String(di.barangay.code);
            if (di.barangay.name && b.name) return String(b.name || "").trim().toLowerCase() === String(di.barangay.name || "").trim().toLowerCase();
            return false;
          });
          if (!found) throw new Error("Invalid barangay code or name");
        } else {
          if (barangayRes.data.city_code && String(barangayRes.data.city_code) !== String(di.cityOrMunicipality.code))
            throw new Error("Barangay does not belong to selected city/municipality");
        }
      } catch (psgcErr) {
        return res.status(400).json({ success: false, error: `PSGC validation failed: ${psgcErr.message}` });
      }
    }

    let appliedVoucher  = null;
    let discountAmount  = 0;
    let discountPercent = 0;

    if (voucherCode) {
      const userForVoucher = await Users.findById(req.user.id, "vouchers").lean();
      const now = new Date();
      const voucher = (userForVoucher?.vouchers || []).find(
        (v) => v.code === String(voucherCode).trim().toUpperCase()
      );
      if (!voucher) return res.status(400).json({ success: false, error: "Voucher not found on your account" });
      if (voucher.used) return res.status(400).json({ success: false, error: "This voucher has already been used" });
      if (voucher.expiresAt && new Date(voucher.expiresAt) < now)
        return res.status(400).json({ success: false, error: "This voucher has expired" });
      appliedVoucher  = voucher;
      discountPercent = voucher.discountPercent;
    }

    let pointsDiscount = 0;
    const requestedPoints = Number(pointsUsed || 0);
    if (requestedPoints > 0) {
      const userForPoints = await Users.findById(req.user.id, "points").lean();
      if ((userForPoints?.points || 0) < requestedPoints)
        return res.status(400).json({ success: false, error: "Insufficient reward points" });
      pointsDiscount = (requestedPoints / 100) * 50;
    }

    let finalOrderNumber = null;
    let assignedSkus     = [];

    await session.withTransaction(async () => {
      let computedSubtotal = 0;
      const orderItems     = [];
      const productUpdates = [];

      for (const it of items) {
        if (!it.id || !it.quantity) throw new Error("Invalid item format");
        const product = await Product.findOne({ id: Number(it.id), isDeleted: { $ne: true } }).session(session);
        if (!product) throw new Error(`Product not found: ${it.id}`);

        const category = String(product.category || "").toLowerCase();
        const isSimple = SIMPLE_CATEGORIES.includes(category);
        const qtyReq   = Number(it.quantity || 0);
        if (qtyReq <= 0) throw new Error(`Invalid quantity for product ${product.name}`);

        if (isSimple) {
          const available = Number(product.stock || 0);
          if (available < qtyReq) throw new Error(`Insufficient stock for ${product.name}. Available: ${available}, Requested: ${qtyReq}`);
          const price = Number(product.new_price ?? product.price ?? 0);
          computedSubtotal += price * qtyReq;
          productUpdates.push({ productId: product._id, id: product.id, simple: true, qty: qtyReq });
          orderItems.push({ id: product.id, name: product.name, image: product.image, price, quantity: qtyReq, size: "" });
          continue;
        }

        const sizesMap = normalizeProductSizes(product.sizes || {}, Number(product.new_price || 0));
        const sizeKey  = String(it.size || "");
        if (!sizeKey || !Object.prototype.hasOwnProperty.call(sizesMap, sizeKey))
          throw new Error(`Invalid size "${sizeKey}" for product ${product.name}`);

        const available = Number(sizesMap[sizeKey]?.quantity || 0);
        if (available < qtyReq) throw new Error(`Insufficient stock for ${product.name} size ${sizeKey}. Available: ${available}, Requested: ${qtyReq}`);

        const price = getSizePriceFromMap(sizesMap, product, sizeKey);
        computedSubtotal += price * qtyReq;
        sizesMap[sizeKey].quantity = Math.max(0, available - qtyReq);
        productUpdates.push({ productId: product._id, id: product.id, updatedSizesMap: sizesMap, qty: qtyReq });
        orderItems.push({ id: product.id, name: product.name, image: product.image, price, quantity: qtyReq, size: sizeKey });
      }

      if (appliedVoucher) {
        const rawDiscount = (computedSubtotal * appliedVoucher.discountPercent) / 100;
        discountAmount = appliedVoucher.maxDiscount > 0
          ? Math.min(rawDiscount, appliedVoucher.maxDiscount)
          : rawDiscount;
        discountAmount = Math.round(discountAmount * 100) / 100;
      }

      const maxAllowedPointsDiscount = computedSubtotal * 0.7;
      if (pointsDiscount > maxAllowedPointsDiscount) {
        pointsDiscount = maxAllowedPointsDiscount;
      }
      pointsDiscount = Math.round(pointsDiscount * 100) / 100;

      const computedTotal = Math.max(0, Math.round((computedSubtotal - discountAmount - pointsDiscount) * 100) / 100);
      if (typeof clientTotal === "number" && Math.abs(clientTotal - computedTotal) > 1)
        console.warn("Client total mismatch; using server computed total", { clientTotal, computedTotal });

      const orderNumber = "ORD-" + Date.now();
      finalOrderNumber  = orderNumber;

      // Enforce Free Shipping threshold on server
      let finalShippingFee = Number(req.body.shippingFee || 0);
      if (computedSubtotal >= 5000) {
        finalShippingFee = 0;
      }
      const finalCodFee = Number(req.body.codFee || 0);

      const orderDoc = new Orders({
        userId: String(req.user.id || ""),
        items:  orderItems,
        subtotal:        Math.round(computedSubtotal * 100) / 100,
        discountAmount:  Math.round((discountAmount + pointsDiscount) * 100) / 100,
        discountPercent: appliedVoucher ? appliedVoucher.discountPercent : 0,
        pointsUsed:      requestedPoints,
        pointsDiscount:  pointsDiscount,
        shippingFee:     finalShippingFee,
        codFee:          finalCodFee,
        total:           Math.max(0, Math.round((computedSubtotal - discountAmount - pointsDiscount + finalShippingFee + finalCodFee) * 100) / 100),
        voucherCode:     appliedVoucher ? appliedVoucher.code  : null,
        voucherTitle:    appliedVoucher ? appliedVoucher.title : null,
        deliveryInfo: {
          firstName, lastName, email,
          street:             sanitize(di.street || ""),
          phone:              phoneDigits,
          region:             { code: String(di.region.code || ""),             name: String(di.region.name || "")             },
          province:           { code: String(di.province.code || ""),           name: String(di.province.name || "")           },
          cityOrMunicipality: { code: String(di.cityOrMunicipality.code || ""), name: String(di.cityOrMunicipality.name || "") },
          barangay:           { code: String(di.barangay.code || ""),           name: String(di.barangay.name || "")           },
        },
        paymentMethod: String(paymentMethod),
        orderNumber,
        status:      "pending",
        deliveredAt: null,
        completedAt: null,
      });

      assignedSkus = [];

      for (const it of orderItems) {
        const qty      = Number(it.quantity || 0);
        const sizeKey  = String(it.size || "");
        const skuQuery = { productId: it.id, status: "available" };
        if (sizeKey) skuQuery.size = sizeKey;

        const availableSkus = await ShoeSequence.find(skuQuery)
          .sort({ sequenceNumber: 1 }).limit(qty).session(session).lean();

        const skuIds = availableSkus.map((s) => s._id);
        if (skuIds.length > 0) {
          await ShoeSequence.updateMany(
            { _id: { $in: skuIds }, status: "available" },
            { $set: { status: "sold", soldDate: new Date(), soldToUserId: String(req.user.id || ""), orderNumber } },
            { session }
          );
          for (const sku of availableSkus)
            assignedSkus.push({ sequenceNumber: sku.sequenceNumber, productName: sku.productName, size: sizeKey || "" });
        }

        if (availableSkus.length < qty)
          console.warn(`Not enough SKUs for product ${it.name}${sizeKey ? ` size ${sizeKey}` : ""}. Needed ${qty}, found ${availableSkus.length}`);
      }

      for (const pu of productUpdates) {
        const product = await Product.findOne({ _id: pu.productId }).session(session);
        if (!product) throw new Error(`Product not found during update: ${pu.id}`);

        if (pu.simple) {
          product.stock      = Math.max(0, (product.stock || 0) - Number(pu.qty || 0));
          product.salesCount = (product.salesCount || 0) + Number(pu.qty || 0);
          product.available  = product.stock > 0;
          await product.save({ session });
          continue;
        }

        const originalWasArray = Array.isArray(product.sizes);
        product.sizes = convertMapToDbShape(pu.updatedSizesMap, originalWasArray);
        if (typeof product.markModified === "function") product.markModified("sizes");
        await product.save({ session });

        product.salesCount = (product.salesCount || 0) + Number(pu.qty || 0);

        if (product.sizes && Object.keys(product.sizes).length > 0) {
          const anyAvailable = Object.values(product.sizes).some((v) =>
            typeof v === "object" && v.quantity !== undefined ? Number(v.quantity) > 0 : Number(v) > 0
          );
          product.available = anyAvailable;
        } else if (typeof product.stock === "number") {
          product.stock     = Math.max(0, (product.stock || 0) - Number(pu.qty || 0));
          product.available = product.stock > 0;
        }

        if (typeof product.markModified === "function") product.markModified("sizes");
        await product.save({ session });
      }

      if (requestedPoints > 0) {
        await Users.findByIdAndUpdate(req.user.id, { $inc: { points: -requestedPoints } }).session(session);
      }
      
      await orderDoc.save({ session });

      if (appliedVoucher) {
        await Users.findOneAndUpdate(
          { _id: req.user.id, "vouchers.code": appliedVoucher.code },
          { $set: { "vouchers.$.used": true, "vouchers.$.usedAt": new Date(), "vouchers.$.usedOnOrder": orderNumber } },
          { session }
        );
      }

      const user = await Users.findById(req.user.id).session(session);
      if (user) {
        user.cartData = {};
        if (typeof user.markModified === "function") user.markModified("cartData");

        // Award points at a rate of 1 point per 100 Pesos spent (0.5% - 1% effective cashback)
        // This prevents the "high points" exploit reported by the user.
        const pointsEarned = Math.floor((orderDoc.total || 0) / 100);
        user.points = (user.points || 0) + pointsEarned;
        
        await user.save({ session });
        console.log(`✅ Awarded ${pointsEarned} points to user ${user.email} for order ${finalOrderNumber}`);
      }
    });

    return res.json({
      success: true,
      orderNumber:    finalOrderNumber,
      discountAmount: discountAmount || 0,
      assignedSkus:   assignedSkus.length > 0 ? assignedSkus : undefined,
      message:        "Order placed successfully",
    });
  } catch (err) {
    console.error("FATAL ERROR in /placeorder:", err);
    return res.status(400).json({ success: false, error: err?.message || "Server error" });
  } finally {
    try { await session.endSession(); } catch (e) { console.warn("Failed to end session:", e); }
  }
};

// ─── POST /validate-cart ──────────────────────────────────────────────────────
const validateCart = async (req, res) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items))
      return res.status(400).json({ success: false, error: "Items required" });

    const results = [];
    for (const it of items) {
      const product = await Product.findOne({ id: Number(it.id), isDeleted: { $ne: true } }).lean();
      if (!product) {
        results.push({ id: it.id, size: it.size, available: false, reason: "Product no longer exists" });
        continue;
      }
      const isSimple = SIMPLE_CATEGORIES.includes(String(product.category || "").toLowerCase());
      if (isSimple) {
        const stock = Number(product.stock || 0);
        results.push({ id: it.id, size: it.size, available: stock >= Number(it.quantity || 1), stock, reason: stock < Number(it.quantity || 1) ? "Out of stock" : null });
      } else {
        const sizesArray = Array.isArray(product.sizes) ? product.sizes : [];
        const sizeEntry  = sizesArray.find((s) => String(s.size).trim() === String(it.size || "").trim());
        const stock      = sizeEntry ? Number(sizeEntry.quantity || 0) : 0;
        results.push({ id: it.id, size: it.size, available: stock >= Number(it.quantity || 1), stock, reason: stock < Number(it.quantity || 1) ? "Out of stock" : null });
      }
    }

    const allAvailable = results.every((r) => r.available);
    res.json({ success: true, results, allAvailable });
  } catch (err) {
    console.error("POST /validate-cart error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

// ─── Auto-complete cron ────────────────────────────────────────────────────────
const autoCompleteDeliveredOrders = async () => {
  try {
    const THREE_DAYS_AGO = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const now = new Date();
    const result = await Orders.updateMany(
      { status: "delivered", deliveredAt: { $lte: THREE_DAYS_AGO } },
      { $set: { status: "completed", completedAt: now, updatedAt: now } }
    );
    if (result.modifiedCount > 0)
      console.log(`[autoComplete] ${result.modifiedCount} order(s) auto-completed after 3-day delivery window.`);
  } catch (err) {
    console.error("[autoComplete] Error running auto-complete cron:", err);
  }
};

module.exports = {
  getOrderHistory,
  getOrderByNumber,
  cancelOrder,
  confirmOrderReceived,
  requestReturn,
  requestRefund,
  adminGetOrders,
  adminGetOrder,
  adminUpdateOrderStatus,
  adminGetRefunds,
  adminGetRefundById,
  adminUpdateRefundStatus,
  placeOrder,
  validateCart,
  enqueueRefundIfNeeded,
  autoCompleteDeliveredOrders,
};