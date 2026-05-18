const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const Orders = require("../models/Orders");
const Users = require("../models/Users");
const Product = require("../models/Product");
const { ShoeSequence, Review } = require("../models/index");
const { enqueueRefundIfNeeded } = require("./orderController");
const {
  recordLoginAttempt,
  createSession,
  getCallerInfo,
} = require("./securityController");
const AuditLog = require("../models/AuditLog");

const JWT_SECRET = process.env.JWT_SECRET || "secret_ecom";
const SIMPLE_CATEGORIES = ["bags", "collectibles"];

// ─── Helper: write audit log (non-blocking) ───────────────────────────────────
async function writeAudit(action, req, details = {}) {
  try {
    const tokenHeader = req.header("auth-token") || req.header("Authorization") || "";
    const token = tokenHeader.startsWith("Bearer ") ? tokenHeader.slice(7) : tokenHeader;
    let adminId = null, adminEmail = "", adminName = "", adminRoles = [];
    if (token) {
      try {
        const payload = jwt.verify(token, JWT_SECRET);
        adminId = payload.userId || payload.id || payload._id || null;
        adminEmail = payload.email || "";
        adminName = payload.name || "";
        adminRoles = payload.roles || [];
      } catch { }
    }
    const { ip, userAgent } = getCallerInfo(req);
    await AuditLog.create({
      action,
      adminId,
      adminEmail,
      adminName,
      adminRoles,
      details,
      ip,
      userAgent,
      timestamp: new Date(),
    });
  } catch (err) {
    console.warn("[AuditLog] write error:", err.message);
  }
}

function getAdminFromRequest(req) {
  try {
    if (req.user && req.user.email) return { email: req.user.email || null, name: req.user.name || null };
    const tokenHeader = req.header("auth-token") || req.header("Authorization") || "";
    const token = tokenHeader.startsWith("Bearer ") ? tokenHeader.slice(7) : tokenHeader;
    if (!token) return null;
    const payload = jwt.verify(token, JWT_SECRET);
    return { email: payload.email || null, name: payload.name || null };
  } catch { return null; }
}

async function restoreStockForOrder(order) {
  if (!order || !Array.isArray(order.items)) return;
  for (const it of order.items) {
    const sizeKey = String(it.size || "").trim();
    const qty = Number(it.quantity || 0);
    if (!qty) continue;
    const product = await Product.findOne({ id: Number(it.id) });
    if (!product) continue;
    const isSimple = SIMPLE_CATEGORIES.includes((product.category || "").toLowerCase());
    if (isSimple) {
      const skuCount = await ShoeSequence.countDocuments({ productId: product.id, status: "available" });
      product.stock = skuCount;
      product.salesCount = Math.max(0, (product.salesCount || 0) - qty);
      product.available = product.stock > 0;
      await product.save();
      continue;
    }
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

const getAdminOrders = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, parseInt(req.query.limit) || 12);
    const status = req.query.status;
    const q = (req.query.q || "").trim();
    const filter = {};
    if (status && status !== "all") filter.status = status;
    let userIdFilter = null;
    if (q) {
      const usersMatched = await Users.find(
        { $or: [{ name: { $regex: q, $options: "i" } }, { email: { $regex: q, $options: "i" } }] }, "_id"
      ).lean();
      userIdFilter = usersMatched.map((u) => String(u._id));
    }
    let finalFilter = { ...filter };
    if (q) {
      finalFilter = {
        ...filter,
        $or: [
          { orderNumber: { $regex: `^${q}$`, $options: "i" } },
          { orderNumber: { $regex: q, $options: "i" } },
          ...(userIdFilter && userIdFilter.length ? [{ userId: { $in: userIdFilter } }] : []),
        ],
      };
    }
    const total = await Orders.countDocuments(finalFilter);
    const orders = await Orders.find(finalFilter).sort({ timestamp: -1 }).skip((page - 1) * limit).limit(limit).lean();
    const userIds = [...new Set(orders.map((o) => String(o.userId)).filter(Boolean))];
    const users = await Users.find({ _id: { $in: userIds } }, "name email phone").lean();
    const usersById = users.reduce((acc, u) => { acc[String(u._id)] = u; return acc; }, {});
    const out = orders.map((o) => ({
      _id: o._id, orderNumber: o.orderNumber, userId: o.userId,
      buyer: usersById[String(o.userId)] || null,
      items: o.items, subtotal: o.subtotal, total: o.total,
      discountAmount: o.discountAmount || 0, discountPercent: o.discountPercent || 0,
      voucherCode: o.voucherCode || null, voucherTitle: o.voucherTitle || null,
      status: o.status || "pending", paymentMethod: o.paymentMethod,
      deliveryInfo: o.deliveryInfo, timestamp: o.timestamp,
      updatedAt: o.updatedAt || o.timestamp, processedBy: o.processedBy || null,
      // ── Include rider so admin list panel can show it immediately ──────────
      rider: o.rider || null,
    }));
    res.json({ success: true, orders: out, page, limit, total });
  } catch (err) {
    console.error("GET /admin/orders error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

const getAdminOrder = async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const order = await Orders.findOne({ orderNumber }).lean();
    if (!order) return res.status(404).json({ success: false, error: "Order not found" });
    const buyer = order.userId ? await Users.findById(order.userId, "name email phone").lean() : null;
    res.json({ success: true, order: { ...order, buyer } });
  } catch (err) {
    console.error("GET /admin/order/:orderNumber error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { orderNumber } = req.params;
    let { status, rider } = req.body;
    if (!status) return res.status(400).json({ success: false, error: "Missing status" });
    status = String(status).trim().toLowerCase().replace(/\s+/g, "_").replace(/-+/g, "_");

    const allowed = [
      "pending", "confirmed", "shipping", "delivered",
      "completed", "cancelled", "refund_requested", "refunded",
    ];
    if (!allowed.includes(status))
      return res.status(400).json({ success: false, error: "Invalid status" });

    // ── Validate rider details when marking as shipping ────────────────────
    if (status === "shipping") {
      if (!rider || typeof rider !== "object")
        return res.status(400).json({ success: false, error: "Rider details are required when marking as shipping." });

      const riderName = String(rider.name || "").trim();
      const riderPlate = String(rider.plate || "").trim();
      const riderPhone = String(rider.phone || "").trim();

      if (!riderName)
        return res.status(400).json({ success: false, error: "Rider name is required." });
      if (!/^[A-Za-z\s'-]+$/.test(riderName))
        return res.status(400).json({ success: false, error: "Rider name must contain letters only." });
      if (riderName.length < 2 || riderName.length > 54)
        return res.status(400).json({ success: false, error: "Rider name must be 2–54 characters." });

      if (!riderPlate)
        return res.status(400).json({ success: false, error: "Rider plate number is required." });
      if (!/^[A-Z]{2,3}[\s-]?\d{3,4}$/i.test(riderPlate))
        return res.status(400).json({ success: false, error: "Enter a valid PH plate number (e.g. ABC 1234)." });

      if (!riderPhone)
        return res.status(400).json({ success: false, error: "Rider phone number is required." });
      if (!/^\d+$/.test(riderPhone))
        return res.status(400).json({ success: false, error: "Rider phone must contain digits only." });
      if (riderPhone.length !== 11)
        return res.status(400).json({ success: false, error: "Rider phone must be exactly 11 digits." });
      if (!riderPhone.startsWith("09"))
        return res.status(400).json({ success: false, error: "Rider phone must start with 09." });
    }

    const admin = getAdminFromRequest(req);
    const processedBy = admin ? { email: admin.email, name: admin.name } : { email: null, name: null };

    const orderBefore = await Orders.findOne({ orderNumber }).lean();
    if (!orderBefore) return res.status(404).json({ success: false, error: "Order not found" });

    // ── Build the update ───────────────────────────────────────────────────
    const statusUpdate = { status, updatedAt: new Date(), processedBy };

    if (status === "delivered" && !orderBefore.deliveredAt) {
      statusUpdate.deliveredAt = new Date();
    }
    if (status === "completed" && !orderBefore.completedAt) {
      statusUpdate.completedAt = new Date();
    }

    // ── Save rider details when shipping ───────────────────────────────────
    if (status === "shipping" && rider) {
      statusUpdate.rider = {
        name: String(rider.name || "").trim(),
        plate: String(rider.plate || "").trim().toUpperCase(),
        phone: String(rider.phone || "").trim(),
      };
    }

    const order = await Orders.findOneAndUpdate(
      { orderNumber },
      { $set: statusUpdate },
      { new: true }
    ).lean();
    if (!order) return res.status(404).json({ success: false, error: "Order not found" });

    if (status !== "cancelled" && processedBy.email) {
      (async () => {
        try {
          await ShoeSequence.updateMany(
            { orderNumber: order.orderNumber },
            { $set: { soldBy: processedBy.email } }
          );
        } catch (err) { console.error("soldBy write error:", err); }
      })();
    }

    if (status === "cancelled") {
      (async () => {
        try {
          const skuResult = await ShoeSequence.updateMany(
            { orderNumber: order.orderNumber, status: "sold" },
            { $set: { status: "available", soldDate: null, soldToUserId: null, orderNumber: null, soldBy: null } }
          );
          console.log(`Admin cancel -- SKUs restored: ${skuResult.modifiedCount}`);
          await restoreStockForOrder(orderBefore);
          if (orderBefore.voucherCode && orderBefore.userId) {
            await Users.findOneAndUpdate(
              { _id: orderBefore.userId, "vouchers.code": orderBefore.voucherCode },
              { $set: { "vouchers.$.used": false, "vouchers.$.usedAt": null, "vouchers.$.usedOnOrder": null } }
            );
            console.log(`Voucher ${orderBefore.voucherCode} restored after admin cancel`);
          }
        } catch (err) { console.error("Admin cancel -- error:", err); }
      })();
    }

    if (status === "refunded") {
      (async () => {
        try {
          if (typeof enqueueRefundIfNeeded === "function") await enqueueRefundIfNeeded(order);
        } catch (err) { console.error("refund background task error:", err); }
      })();
    }

    // Audit log for order status change
    writeAudit("order_status", req, {
      orderNumber: order.orderNumber,
      previousStatus: orderBefore.status,
      newStatus: status,
      totalAmount: order.totalAmount,
    });

    res.json({ success: true, order });
  } catch (err) {
    console.error("POST /admin/order/:orderNumber/status error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

const getStatsOverview = async (req, res) => {
  try {
    const startOfYear = new Date(`${new Date().getFullYear()}-01-01`);
    const [onlineSalesAgg, storeSalesAgg, userCount, productCount, topSpenderAgg] = await Promise.all([
      Orders.aggregate([
        {
          $match: {
            status: { $nin: ["cancelled", "Cancelled"] },
            timestamp: { $gte: startOfYear }
          }
        },
        { $group: { _id: null, totalSales: { $sum: { $ifNull: ["$total", 0] } } } }
      ]),
      ShoeSequence.aggregate([
        {
          $match: {
            soldBy: { $exists: true, $nin: [null, ""] },
            $expr: {
              $and: [
                { $gte: ["$soldDate", startOfYear.toISOString()] },
                {
                  $not: {
                    $regexMatch: {
                      input: { $ifNull: ["$orderNumber", ""] },
                      regex: "^ORD-",
                      options: "i"
                    }
                  }
                }
              ]
            }
          }
        },
        { $group: { _id: null, totalSales: { $sum: { $ifNull: ["$productPrice", { $ifNull: ["$price", 0] }] } } } }
      ]),
      Users.countDocuments(),
      Product.countDocuments({ available: true }),
      Orders.aggregate([
        {
          $match: {
            status: { $nin: ["cancelled", "Cancelled"] },
            timestamp: { $gte: startOfYear }
          }
        },
        { $group: { _id: "$userId", totalSpent: { $sum: { $ifNull: ["$total", 0] } } } },
        { $sort: { totalSpent: -1 } },
        { $limit: 1 },
      ]),
    ]);

    const onlineTotal = onlineSalesAgg[0]?.totalSales || 0;
    const storeTotal = storeSalesAgg[0]?.totalSales || 0;
    const totalSales = onlineTotal + storeTotal;
    const topSpenderId = topSpenderAgg[0]?._id;
    const topSpenderTotal = topSpenderAgg[0]?.totalSpent || 0;
    let topSpender = null;
    if (topSpenderId) {
      const user = await Users.findById(topSpenderId, "name email").lean();
      if (user) topSpender = { name: user.name, email: user.email, totalSpent: topSpenderTotal };
    }

    res.json({ success: true, totalSales, totalUsers: userCount, totalProducts: productCount, topSpender });
  } catch (err) {
    console.error("GET /admin/stats/overview error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

const getMonthlySales = async (req, res) => {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const sales = await Orders.aggregate([
      { $match: { status: { $nin: ["cancelled"] }, timestamp: { $gte: new Date(`${year}-01-01`), $lt: new Date(`${year + 1}-01-01`) } } },
      { $group: { _id: { month: { $month: "$timestamp" } }, total: { $sum: "$total" } } },
      { $sort: { "_id.month": 1 } },
    ]);
    const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const totals = Array(12).fill(0);
    sales.forEach(({ _id, total }) => { totals[_id.month - 1] = total; });
    res.json({ success: true, labels, totals });
  } catch (err) {
    console.error("GET /admin/stats/monthly-sales error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

const getCategorySales = async (req, res) => {
  try {
    const sales = await Orders.aggregate([
      { $match: { status: { $nin: ["cancelled"] } } },
      { $unwind: "$items" },
      { $lookup: { from: "products", localField: "items.id", foreignField: "id", as: "productInfo" } },
      { $unwind: "$productInfo" },
      { $group: { _id: "$productInfo.category", total: { $sum: { $multiply: ["$items.price", "$items.quantity"] } } } },
      { $sort: { total: -1 } },
    ]);
    res.json(sales.map((s) => ({ category: s._id || "Uncategorized", total: s.total })));
  } catch (err) {
    console.error("GET /admin/stats/category-sales error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

const getLowStock = async (req, res) => {
  try {
    const products = await Product.find({ available: true }).lean();
    const lowStock = [];
    products.forEach((p) => {
      const sizes = p.sizes || {};
      for (const size in sizes) {
        const qty = Number(sizes[size]);
        if (qty > 0 && qty <= 3) lowStock.push({ id: p.id, name: p.name, category: p.category, size, quantity: qty });
      }
    });
    res.json({ products: lowStock });
  } catch (err) {
    console.error("Low stock error:", err);
    res.status(500).json({ error: "Failed to fetch low stock data" });
  }
};

const getSalesData = async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const month = req.query.month ? parseInt(req.query.month, 10) : null;
    const period = req.query.period || (month ? "month" : "year");
    const weekStr = req.query.week || null;
    const dayStr = req.query.day || null;

    let rangeStart, rangeEnd;
    const now = new Date();

    if (period === "day" || dayStr) {
      const d = dayStr ? new Date(dayStr) : now;
      rangeStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
      rangeEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0);
    } else if (period === "week" || weekStr) {
      let monday;
      if (weekStr && weekStr.includes("-W")) {
        const [wy, wn] = weekStr.split("-W").map(Number);
        const jan4 = new Date(wy, 0, 4);
        const dow = jan4.getDay() || 7;
        const firstMon = new Date(jan4.getTime() - (dow - 1) * 86400000);
        monday = new Date(firstMon.getTime() + (wn - 1) * 7 * 86400000);
      } else {
        const d = now.getDay() || 7;
        monday = new Date(now.getTime() - (d - 1) * 86400000);
        monday.setHours(0, 0, 0, 0);
      }
      rangeStart = monday;
      rangeEnd = new Date(monday.getTime() + 7 * 86400000);
    } else if (period === "month" || month) {
      const m = month || now.getMonth() + 1;
      rangeStart = new Date(year, m - 1, 1);
      rangeEnd = new Date(year, m, 1);
    } else {
      rangeStart = new Date(year, 0, 1);
      rangeEnd = new Date(year + 1, 0, 1);
    }

    const matchFilter = {
      status: { $nin: ["cancelled", "Cancelled"] },
      timestamp: { $gte: rangeStart, $lt: rangeEnd },
    };

    // Store filter matching getStatsOverview logic
    const storeMatch = {
      soldBy: { $exists: true, $nin: [null, ""] },
      soldDate: { $gte: rangeStart.toISOString(), $lt: rangeEnd.toISOString() },
      $or: [
        { orderNumber: { $exists: false } },
        { orderNumber: "" },
        { orderNumber: null },
        { orderNumber: { $regex: /^STORE-/, $options: "i" } }
      ]
    };

    const allProducts = await Product.find({}, "id name category brand sizes price").lean();
    const productCatalogueMap = {};
    allProducts.forEach((p) => { productCatalogueMap[String(p.id)] = p; });

    // 1. Online Sales Aggregation
    const salesAgg = await Orders.aggregate([
      { $match: matchFilter }, { $unwind: "$items" },
      { $addFields: { "items.quantity": { $ifNull: ["$items.quantity", 0] }, "items.price": { $ifNull: ["$items.price", 0] } } },
      { $match: { "items.id": { $ne: null } } },
      { $group: { _id: "$items.id", name: { $first: "$items.name" }, salesCount: { $sum: "$items.quantity" }, salesTotal: { $sum: { $multiply: ["$items.quantity", "$items.price"] } } } },
    ]);

    // 2. Store Sales Aggregation
    const storeSalesAgg = await ShoeSequence.aggregate([
      { $match: storeMatch },
      { $group: { _id: "$productId", name: { $first: "$productName" }, salesCount: { $sum: 1 }, salesTotal: { $sum: { $ifNull: ["$productPrice", { $ifNull: ["$price", 0] }] } } } }
    ]);

    const salesMap = {};
    salesAgg.forEach((s) => {
      const pid = String(s._id);
      salesMap[pid] = { name: s.name, salesCount: s.salesCount, salesTotal: s.salesTotal };
    });
    storeSalesAgg.forEach((s) => {
      const pid = String(s._id);
      if (salesMap[pid]) {
        salesMap[pid].salesCount += s.salesCount;
        salesMap[pid].salesTotal += s.salesTotal;
      } else {
        salesMap[pid] = { name: s.name, salesCount: s.salesCount, salesTotal: s.salesTotal };
      }
    });

    // 3. Size Breakdowns (Include both Online and Store)
    const onlineSizeAgg = await Orders.aggregate([
      { $match: matchFilter }, { $unwind: "$items" },
      {
        $addFields: {
          "items.quantity": { $ifNull: ["$items.quantity", 0] },
          "items.price": { $ifNull: ["$items.price", 0] },
          "items.size": { $cond: [{ $or: [{ $eq: ["$items.size", null] }, { $eq: ["$items.size", ""] }] }, "—", "$items.size"] },
        },
      },
      { $match: { "items.id": { $ne: null } } },
      {
        $group: {
          _id: { productId: "$items.id", size: "$items.size" },
          unitPrice: { $last: "$items.price" },
          qtySold: { $sum: "$items.quantity" },
          subtotal: { $sum: { $multiply: ["$items.quantity", "$items.price"] } },
        },
      }
    ]);

    const storeSizeAgg = await ShoeSequence.aggregate([
      { $match: storeMatch },
      {
        $group: {
          _id: { productId: "$productId", size: { $ifNull: ["$size", "—"] } },
          unitPrice: { $last: { $ifNull: ["$productPrice", { $ifNull: ["$price", 0] }] } },
          qtySold: { $sum: 1 },
          subtotal: { $sum: { $ifNull: ["$productPrice", { $ifNull: ["$price", 0] }] } }
        }
      }
    ]);

    const combinedSizeAgg = [...onlineSizeAgg];
    storeSizeAgg.forEach(s => {
      const existing = combinedSizeAgg.find(o => String(o._id.productId) === String(s._id.productId) && o._id.size === s._id.size);
      if (existing) {
        existing.qtySold += s.qtySold;
        existing.subtotal += s.subtotal;
      } else {
        combinedSizeAgg.push(s);
      }
    });

    const sizeBreakdownMap = {};
    combinedSizeAgg.forEach((row) => {
      const pid = String(row._id.productId);
      const size = String(row._id.size);
      let unitPrice = Number(row.unitPrice || 0);
      if (!unitPrice) {
        const cat = productCatalogueMap[pid];
        if (cat) {
          const sizeEntry = Array.isArray(cat.sizes) ? cat.sizes.find((s) => String(s.size) === size) : null;
          unitPrice = sizeEntry ? Number(sizeEntry.price || 0) : Number(cat.price || 0);
        }
      }
      if (!sizeBreakdownMap[pid]) sizeBreakdownMap[pid] = [];
      sizeBreakdownMap[pid].push({ size, unitPrice, qtySold: Number(row.qtySold || 0), subtotal: Number(row.subtotal || 0) });
    });

    const products = allProducts.map((p) => {
      const key = String(p.id);
      const entry = salesMap[key] || { salesCount: 0, salesTotal: 0 };
      return {
        id: p.id, name: p.name, category: p.category || "", brand: p.brand || "",
        salesCount: entry.salesCount, salesTotal: Number(entry.salesTotal || 0),
        sizeBreakdown: (sizeBreakdownMap[key] || []).filter((r) => r.qtySold > 0),
      };
    });
    products.sort((a, b) => b.salesCount - a.salesCount || b.salesTotal - a.salesTotal);

    const brandMap = {};
    products.forEach((p) => {
      const key = p.brand || p.category || "other";
      if (!brandMap[key]) brandMap[key] = { brand: key, salesCount: 0, salesTotal: 0 };
      brandMap[key].salesCount += p.salesCount;
      brandMap[key].salesTotal += p.salesTotal;
    });
    const brandPerformance = Object.values(brandMap).sort((a, b) => b.salesTotal - a.salesTotal);

    const grandTotals = products.reduce(
      (acc, prod) => { acc.totalUnits += prod.salesCount; acc.totalAmount += prod.salesTotal; return acc; },
      { totalUnits: 0, totalAmount: 0 }
    );

    // Totals for the header cards
    const ordersTotalAgg = await Orders.aggregate([
      { $match: matchFilter },
      { $group: { _id: null, ordersTotal: { $sum: { $ifNull: ["$total", 0] } }, ordersCount: { $sum: 1 } } },
    ]);
    const storeGrandAgg = await ShoeSequence.aggregate([
      { $match: storeMatch },
      { $group: { _id: null, totalSales: { $sum: { $ifNull: ["$productPrice", { $ifNull: ["$price", 0] }] } }, count: { $sum: 1 } } }
    ]);

    const combinedOrdersTotal = (ordersTotalAgg[0]?.ordersTotal || 0) + (storeGrandAgg[0]?.totalSales || 0);
    const combinedOrdersCount = (ordersTotalAgg[0]?.ordersCount || 0) + (storeGrandAgg[0]?.count || 0);

    let periodSummary = [];
    if (period === "day" || dayStr) {
      const hourlyAgg = await Orders.aggregate([
        { $match: matchFilter },
        { $addFields: { orderUnits: { $reduce: { input: { $ifNull: ["$items", []] }, initialValue: 0, in: { $add: ["$$value", { $ifNull: ["$$this.quantity", 0] }] } } } } },
        { $group: { _id: { hour: { $hour: "$timestamp" } }, amount: { $sum: { $ifNull: ["$total", 0] } }, units: { $sum: { $ifNull: ["$orderUnits", 0] } } } },
        { $sort: { "_id.hour": 1 } },
      ]);
      // Note: ShoeSequence might not have precise hourly data, usually just soldDate string.
      // For now we primarily use online for hourly, or we could parse soldDate if it's ISO.
      periodSummary = hourlyAgg.map((h) => ({ label: `${String(h._id.hour).padStart(2, "0")}:00`, amount: h.amount, units: h.units }));
    } else if (period === "week" || weekStr) {
      const dailyOnlineAgg = await Orders.aggregate([
        { $match: matchFilter },
        { $addFields: { orderUnits: { $reduce: { input: { $ifNull: ["$items", []] }, initialValue: 0, in: { $add: ["$$value", { $ifNull: ["$$this.quantity", 0] }] } } } } },
        { $group: { _id: { year: { $year: "$timestamp" }, month: { $month: "$timestamp" }, day: { $dayOfMonth: "$timestamp" } }, amount: { $sum: { $ifNull: ["$total", 0] } }, units: { $sum: { $ifNull: ["$orderUnits", 0] } } } },
      ]);
      // For store sales, parse soldDate
      const dailyStoreAgg = await ShoeSequence.aggregate([
        { $match: storeMatch },
        {
          $addFields: { soldDateObj: { $dateFromString: { dateString: "$soldDate" } } }
        },
        { $group: { _id: { year: { $year: "$soldDateObj" }, month: { $month: "$soldDateObj" }, day: { $dayOfMonth: "$soldDateObj" } }, amount: { $sum: { $ifNull: ["$productPrice", { $ifNull: ["$price", 0] }] } }, units: { $sum: 1 } } }
      ]);

      const combinedDaily = [...dailyOnlineAgg];
      dailyStoreAgg.forEach(s => {
        const existing = combinedDaily.find(o => o._id.year === s._id.year && o._id.month === s._id.month && o._id.day === s._id.day);
        if (existing) {
          existing.amount += s.amount;
          existing.units += s.units;
        } else {
          combinedDaily.push(s);
        }
      });
      combinedDaily.sort((a, b) => a._id.year - b._id.year || a._id.month - b._id.month || a._id.day - b._id.day);

      const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      periodSummary = combinedDaily.map((d) => {
        const date = new Date(d._id.year, d._id.month - 1, d._id.day);
        const dow = (date.getDay() + 6) % 7;
        return { label: `${dayNames[dow]} ${String(d._id.month).padStart(2, "0")}/${String(d._id.day).padStart(2, "0")}`, amount: d.amount, units: d.units };
      });
    } else {
      const monthlyOnlineAgg = await Orders.aggregate([
        { $match: matchFilter },
        { $addFields: { orderUnits: { $reduce: { input: { $ifNull: ["$items", []] }, initialValue: 0, in: { $add: ["$$value", { $ifNull: ["$$this.quantity", 0] }] } } } } },
        { $group: { _id: { month: { $month: "$timestamp" }, year: { $year: "$timestamp" } }, amount: { $sum: { $ifNull: ["$total", 0] } }, units: { $sum: { $ifNull: ["$orderUnits", 0] } } } },
      ]);
      const monthlyStoreAgg = await ShoeSequence.aggregate([
        { $match: storeMatch },
        { $addFields: { soldDateObj: { $dateFromString: { dateString: "$soldDate" } } } },
        { $group: { _id: { month: { $month: "$soldDateObj" }, year: { $year: "$soldDateObj" } }, amount: { $sum: { $ifNull: ["$productPrice", { $ifNull: ["$price", 0] }] } }, units: { $sum: 1 } } }
      ]);

      const combinedMonthly = [...monthlyOnlineAgg];
      monthlyStoreAgg.forEach(s => {
        const existing = combinedMonthly.find(o => o._id.year === s._id.year && o._id.month === s._id.month);
        if (existing) {
          existing.amount += s.amount;
          existing.units += s.units;
        } else {
          combinedMonthly.push(s);
        }
      });
      combinedMonthly.sort((a, b) => a._id.year - b._id.year || a._id.month - b._id.month);

      periodSummary = combinedMonthly.map((m) => ({
        label: `${new Date(m._id.year, m._id.month - 1).toLocaleString("default", { month: "short" })} ${m._id.year}`,
        month: new Date(m._id.year, m._id.month - 1).toLocaleString("default", { month: "short" }),
        year: m._id.year, amount: m.amount, units: m.units,
      }));
    }

    const monthlySummary = periodSummary.map((p) => ({ ...p, month: p.month || p.label }));

    res.json({
      success: true, products, monthlySummary, periodSummary, brandPerformance, period, rangeStart, rangeEnd,
      grandTotals: { totalUnits: grandTotals.totalUnits, totalAmount: Number(grandTotals.totalAmount.toFixed(2)) },
      totals: { ordersTotal: Number(combinedOrdersTotal.toFixed(2)), ordersCount: combinedOrdersCount },
    });
  } catch (err) {
    console.error("Sales data error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

const getSalesLog = async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const month = req.query.month ? parseInt(req.query.month, 10) : null;
    const period = req.query.period || (month ? "month" : "year");
    const weekStr = req.query.week || null;
    const dayStr = req.query.day || null;

    let rangeStart, rangeEnd;
    const now = new Date();

    if (period === "day" || dayStr) {
      const d = dayStr ? new Date(dayStr) : now;
      rangeStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
      rangeEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0);
    } else if (period === "week" || weekStr) {
      let monday;
      if (weekStr && weekStr.includes("-W")) {
        const [wy, wn] = weekStr.split("-W").map(Number);
        const jan4 = new Date(wy, 0, 4);
        const dow = jan4.getDay() || 7;
        const firstMon = new Date(jan4.getTime() - (dow - 1) * 86400000);
        monday = new Date(firstMon.getTime() + (wn - 1) * 7 * 86400000);
      } else {
        const d = now.getDay() || 7;
        monday = new Date(now.getTime() - (d - 1) * 86400000);
        monday.setHours(0, 0, 0, 0);
      }
      rangeStart = monday;
      rangeEnd = new Date(monday.getTime() + 7 * 86400000);
    } else if (period === "month" || month) {
      const m = month || now.getMonth() + 1;
      rangeStart = new Date(year, m - 1, 1);
      rangeEnd = new Date(year, m, 1);
    } else {
      rangeStart = new Date(year, 0, 1);
      rangeEnd = new Date(year + 1, 0, 1);
    }

    const orders = await Orders.find({
      timestamp: { $gte: rangeStart, $lt: rangeEnd },
      status: { $nin: ["cancelled", "Cancelled"] },
    }).sort({ timestamp: -1 }).lean();

    const userIds = [...new Set(orders.map((o) => String(o.userId)).filter(Boolean))];
    const users = await Users.find({ _id: { $in: userIds } }, "name email").lean();
    const usersById = users.reduce((acc, u) => { acc[String(u._id)] = u; return acc; }, {});

    const allItemIds = [
      ...new Set(orders.flatMap((o) => (o.items || []).map((it) => Number(it.id)).filter(Boolean))),
    ];
    const productDocs = await Product.find({ id: { $in: allItemIds } }, "id name category brand").lean();
    const productById = productDocs.reduce((acc, p) => { acc[String(p.id)] = p; return acc; }, {});

    let rowId = 0;
    const onlineLogs = [];

    for (const order of orders) {
      const buyer = usersById[String(order.userId)] || null;
      const orderTs = order.timestamp ? new Date(order.timestamp).toISOString() : null;
      const status = (order.status || "pending").toLowerCase();
      const payment = order.paymentMethod || "—";
      const voucherCode = order.voucherCode || null;
      const voucherTitle = order.voucherTitle || null;
      const discountPct = order.discountPercent || 0;
      const totalDiscount = order.discountAmount || 0;
      const orderSubtotal = order.subtotal || order.total || 0;

      for (const item of order.items || []) {
        const prodId = String(item.id || "");
        const prod = productById[prodId] || null;
        const unitPrice = Number(item.price || 0);
        const qty = Number(item.quantity || 1);
        const size = item.size || "—";

        let lineDiscount = 0;
        if (totalDiscount > 0 && orderSubtotal > 0) {
          const itemRevenue = unitPrice * qty;
          lineDiscount = Math.round(((itemRevenue / orderSubtotal) * totalDiscount) * 100) / 100;
        }

        const lineTotal = Math.max(0, Math.round((unitPrice * qty - lineDiscount) * 100) / 100);

        onlineLogs.push({
          id: `${String(order._id)}-${rowId++}`,
          orderId: order.orderNumber || String(order._id),
          orderNumber: order.orderNumber || String(order._id),
          product: prod?.name || item.name || "Unknown Product",
          category: prod?.category || item.category || "—",
          brand: prod?.brand || item.brand || "—",
          size,
          unitPrice,
          qty,
          voucherCode,
          voucherTitle,
          discountPercent: discountPct,
          discount: lineDiscount,
          total: lineTotal,
          status,
          channel: "online",
          buyer: buyer?.name || "Guest",
          buyerEmail: buyer?.email || null,
          soldBy: null,
          payment,
          soldAt: orderTs,
        });
      }
    }

    const allSoldBySeqs = await ShoeSequence.find({
      soldBy: { $exists: true, $nin: [null, ""] },
    }).lean();


    const rangeStartMs = rangeStart.getTime();
    const rangeEndMs = rangeEnd.getTime() + 60 * 60 * 1000;

    const candidateStoreSeqs = allSoldBySeqs.filter((s) => {
      if (!s.soldDate) return false;
      const soldMs = new Date(s.soldDate).getTime();
      return soldMs >= rangeStartMs && soldMs < rangeEndMs;
    });


    const storeSoldSeqs = candidateStoreSeqs.filter((s) => {
      const on = s.orderNumber;
      if (on === undefined || on === null || on === "") return true;
      if (String(on).startsWith("STORE-")) return true;
      return false;
    });


    const seqProductIds = [...new Set(storeSoldSeqs.map((s) => s.productId).filter(Boolean))];
    const seqProductDocs = await Product.find({ id: { $in: seqProductIds } }, "id name category brand").lean();
    const seqProductById = seqProductDocs.reduce((acc, p) => { acc[String(p.id)] = p; return acc; }, {});

    const storeLogs = storeSoldSeqs.map((seq) => {
      const prod = seqProductById[String(seq.productId)] || null;
      const unitPrice = Number(seq.productPrice || seq.price || 0);

      return {
        id: `SEQ-${String(seq._id)}`,
        orderId: `STORE-${seq.productItemId || seq.sequenceNumber}`,
        orderNumber: `STORE-${seq.productItemId || seq.sequenceNumber}`,
        product: seq.productName || prod?.name || "Unknown Product",
        category: seq.category || prod?.category || "—",
        brand: seq.brand || prod?.brand || "—",
        size: seq.size || "—",
        unitPrice,
        qty: 1,
        voucherCode: null,
        voucherTitle: null,
        discountPercent: 0,
        discount: 0,
        total: unitPrice,
        status: "completed",
        channel: "store",
        buyer: null,
        buyerEmail: null,
        soldBy: seq.soldBy,
        payment: seq.paymentMethod || "Cash",
        soldAt: seq.soldDate ? new Date(seq.soldDate).toISOString() : null,
      };
    });

    const logs = [...onlineLogs, ...storeLogs].sort((a, b) => {
      const ta = a.soldAt ? new Date(a.soldAt).getTime() : 0;
      const tb = b.soldAt ? new Date(b.soldAt).getTime() : 0;
      return tb - ta;
    });


    res.json({ success: true, logs, total: logs.length });
  } catch (err) {
    console.error("GET /saleslog error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

const giveVoucher = async (req, res) => {
  try {
    const admin = getAdminFromRequest(req);
    const { userId, title, message, discountPercent, maxDiscount, expiresAt } = req.body;

    if (!userId) return res.status(400).json({ success: false, error: "userId is required" });
    if (!title) return res.status(400).json({ success: false, error: "title is required" });
    if (!discountPercent || Number(discountPercent) <= 0 || Number(discountPercent) > 100)
      return res.status(400).json({ success: false, error: "discountPercent must be between 1 and 100" });

    const user = await Users.findById(userId);
    if (!user) return res.status(404).json({ success: false, error: "User not found" });

    const code = `VC-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

    const voucher = {
      code,
      title: title.trim(),
      message: (message || "").trim(),
      discountPercent: Number(discountPercent),
      maxDiscount: Number(maxDiscount || 0),
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      used: false,
      usedAt: null,
      usedOnOrder: null,
      issuedAt: new Date(),
      issuedBy: admin?.email || null,
    };

    user.vouchers.push(voucher);
    await user.save();

    const saved = user.vouchers[user.vouchers.length - 1];

    return res.json({
      success: true,
      message: `Voucher "${code}" issued to ${user.name}`,
      voucher: {
        _id: String(saved._id), code: saved.code, title: saved.title,
        message: saved.message, discountPercent: saved.discountPercent,
        maxDiscount: saved.maxDiscount, expiresAt: saved.expiresAt,
        issuedAt: saved.issuedAt, issuedBy: saved.issuedBy,
      },
    });
  } catch (err) {
    console.error("POST /admin/give-voucher error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

const adminLogin = async (req, res) => {
  const { email, password } = req.body;
  const { ip, userAgent } = getCallerInfo(req);

  try {
    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Email and password required" });
    }

    const user = await Users.findOne({ email: String(email).toLowerCase().trim() });

    if (!user) {
      await recordLoginAttempt({
        email: String(email).toLowerCase().trim(),
        ip, userAgent, success: false,
        reason: "user_not_found",
      });
      return res.status(401).json({ success: false, error: "Invalid credentials" });
    }

    let isMatch = false;
    if (user.password.startsWith("$2b$") || user.password.startsWith("$2a$")) {
      const bcrypt = require("bcrypt");
      isMatch = await bcrypt.compare(password, user.password);
    } else {
      isMatch = user.password === password;
    }

    if (!isMatch) {
      await recordLoginAttempt({
        email: String(email).toLowerCase().trim(),
        ip, userAgent, success: false,
        reason: "wrong_password",
      });
      return res.status(401).json({ success: false, error: "Invalid credentials" });
    }

    const allowedRoles = ["owner", "admin", "staff", "inventory_staff"];
    const hasAccess = Array.isArray(user.roles) && user.roles.some((r) => allowedRoles.includes(r));
    if (!hasAccess) {
      await recordLoginAttempt({
        email: user.email, ip, userAgent, success: false,
        reason: "no_admin_role",
      });
      return res.status(403).json({ success: false, error: "Access denied. No admin privileges." });
    }

    const token = jwt.sign(
      { userId: String(user._id), roles: user.roles, name: user.name, email: user.email },
      JWT_SECRET, { expiresIn: "12h" }
    );

    await recordLoginAttempt({
      email: user.email, ip, userAgent, success: true, reason: "",
    });

    await createSession({
      token,
      adminId: String(user._id),
      adminEmail: user.email,
      adminName: user.name,
      adminRoles: user.roles,
      ip,
      userAgent,
      expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
    });

    res.json({ success: true, token, roles: user.roles, name: user.name });
  } catch (err) {
    console.error("Admin login error:", err);
    await recordLoginAttempt({ email: String(email || "").toLowerCase(), ip, userAgent, success: false, reason: "server_error" }).catch(() => { });
    res.status(500).json({ success: false, error: "Server error" });
  }
};

const assignRole = async (req, res) => {
  try {
    const { userId, roles } = req.body;
    const incoming = Array.isArray(roles) ? roles : [];
    const validRoles = ["owner", "admin", "staff", "inventory_staff"];
    const cleanRoles = [...new Set(incoming.filter((r) => validRoles.includes(r)))];
    await Users.findByIdAndUpdate(userId, { $set: { roles: cleanRoles } });
    const updated = await Users.findById(userId).select("name email roles phone status");
    res.json({ success: true, user: updated });
  } catch (err) {
    console.error("POST /admin/assign-role error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

const createStaff = async (req, res) => {
  try {
    const { name, email, password, phone, role } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ success: false, error: "Name, email, and password are required" });
    const allowedRoles = ["admin", "staff", "inventory_staff"];
    if (!allowedRoles.includes(role))
      return res.status(400).json({ success: false, error: "Invalid role. Allowed: admin, staff, inventory_staff" });
    const normalizedEmail = String(email).toLowerCase().trim();
    const existing = await Users.findOne({ email: normalizedEmail });
    if (existing) return res.status(409).json({ success: false, error: "An account with this email already exists" });
    const newUser = new Users({
      name: name.trim(), email: normalizedEmail, password,
      phone: phone ? phone.trim() : "", roles: [role], status: "active", cartData: {},
    });
    await newUser.save();
    return res.json({
      success: true, message: "Staff account created successfully",
      user: { id: String(newUser._id), name: newUser.name, email: newUser.email, phone: newUser.phone, roles: newUser.roles },
    });
  } catch (err) {
    console.error("POST /admin/create-staff error:", err);
    if (err.code === 11000) return res.status(409).json({ success: false, error: "Email already in use" });
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

const getAllReviews = async (req, res) => {
  try {
    const reviews = await Review.find()
      .sort({ date: -1 })
      .lean();
    
    // Enrich with product names and images
    const productIds = [...new Set(reviews.map(r => r.productId))];
    const products = await Product.find({ id: { $in: productIds } }, "id name image colorways").lean();
    const productMap = products.reduce((acc, p) => { 
      let bestImage = p.image;
      if (!bestImage && p.colorways?.length > 0) {
        bestImage = p.colorways[0].image;
      }
      acc[p.id] = { name: p.name, image: bestImage }; 
      return acc; 
    }, {});

    // Fetch user names for "Anonymous" reviews if userId exists
    const anonymousUserIds = [...new Set(reviews.filter(r => r.userName === "Anonymous" && r.userId).map(r => r.userId))];
    const userDocs = await Users.find({ _id: { $in: anonymousUserIds } }, "name").lean();
    const userMap = userDocs.reduce((acc, u) => { acc[String(u._id)] = u.name; return acc; }, {});

    const enriched = reviews.map(r => {
      const pInfo = productMap[r.productId];
      let displayUserName = r.userName || "Anonymous";
      const isAnonymous = displayUserName.trim().toLowerCase() === "anonymous";
      
      if (isAnonymous && r.userId && userMap[String(r.userId)]) {
        displayUserName = userMap[String(r.userId)];
      }

      return {
        ...r,
        userName: displayUserName,
        productName: pInfo ? pInfo.name : "Deleted Product",
        productImage: pInfo ? pInfo.image : ""
      };
    });

    res.json({ success: true, reviews: enriched });
  } catch (err) {
    console.error("GET /admin/allreviews error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};
const deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    await Review.findByIdAndDelete(reviewId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to delete review" });
  }
};

// ─── POST /admin/pos/sale ─────────────────────────────────────────────────────
const posSale = async (req, res) => {
  try {
    const { items, paymentMethod, total } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0)
      return res.status(400).json({ success: false, error: "No items provided" });

    const tokenHeader = req.header("auth-token") || req.header("Authorization") || "";
    const token = tokenHeader.startsWith("Bearer ") ? tokenHeader.slice(7) : tokenHeader;
    let soldBy = null;
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      soldBy = payload.name || payload.email || null;
    } catch {}

    const orderNumber = `STORE-${Date.now()}`;
    const soldDate = new Date();
    const errors = [];
    const results = [];

    for (const item of items) {
      const numProductId = Number(item.productId);
      const numQty = Math.max(1, Number(item.qty || 1));
      const size = item.size;

      try {
        const product = await Product.findOne({ id: numProductId });
        if (!product) { errors.push(`Product ${numProductId} not found`); continue; }

        const isSimple = SIMPLE_CATEGORIES.includes((product.category || "").toLowerCase());

        // Mark ShoeSequence records as sold
        const skuQuery = { productId: numProductId, status: "available" };
        if (!isSimple && size && size !== "—") skuQuery.size = String(size);

        const availableSkus = await ShoeSequence.find(skuQuery)
          .sort({ sequenceNumber: 1 }).limit(numQty).lean();

        if (availableSkus.length > 0) {
          await ShoeSequence.updateMany(
            { _id: { $in: availableSkus.map((s) => s._id) }, status: "available" },
            { $set: { status: "sold", soldDate, soldBy, orderNumber } }
          );
        }

        // Deduct from Product stock
        if (isSimple) {
          product.stock = Math.max(0, (product.stock || 0) - numQty);
          await product.save();
        } else {
          const sz = product.sizes;
          if (sz && typeof sz === "object") {
            const key = String(size);
            if (Array.isArray(sz)) {
              const entry = sz.find((s) => String(s.size) === key);
              if (entry) entry.quantity = Math.max(0, (entry.quantity || 0) - numQty);
            } else if (sz[key]) {
              const entry = sz[key];
              if (typeof entry === "object") {
                sz[key] = { ...entry, quantity: Math.max(0, (entry.quantity || 0) - numQty) };
              } else {
                sz[key] = Math.max(0, Number(entry) - numQty);
              }
              product.markModified("sizes");
            }
          }
          await product.save();
        }

        results.push({ productId: numProductId, size, qty: numQty, skuMarked: availableSkus.length });
      } catch (itemErr) {
        errors.push(`Product ${numProductId}: ${itemErr.message}`);
      }
    }

    if (results.length === 0 && errors.length > 0)
      return res.status(400).json({ success: false, error: errors.join("; ") });

    return res.json({ success: true, orderNumber, soldDate, results, errors });
  } catch (err) {
    console.error("POST /admin/pos/sale error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

module.exports = {
  getAdminOrders, getAdminOrder, updateOrderStatus, getStatsOverview,
  getMonthlySales, getCategorySales, getLowStock, getSalesData, getSalesLog,
  giveVoucher, adminLogin, assignRole, createStaff, getAllReviews, deleteReview,
  posSale,
};