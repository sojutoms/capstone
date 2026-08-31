const jwt = require("jsonwebtoken");
const Product = require("../models/Product");
const Users = require("../models/Users");
const { ShoeSequence, Review } = require("../models/index");
const { normalizeSizesToArray } = require("../utils/sizes");
const { getNextSequences, createSkusForProduct } = require("../utils/sku");
const AuditLog = require("../models/AuditLog");
const mongoose = require("mongoose");

const { calculateDiff } = require("../utils/audit");

// Modular Helpers & Migrations
const {
  SIMPLE_CATEGORIES,
  normalizeBrandSlug,
  sanitizeSubCategories,
  sanitizeColorways,
  getNextSkuNumber,
  formatProduct
} = require("../utils/productHelpers");

const {
  fixSizes,
  fixAllSizes,
  migrateSizesWithPrices,
  migrateSkuNumbers
} = require("../utils/migrations");

const { getActiveReservationsMap } = require("../utils/reservations");

const JWT_SECRET = process.env.JWT_SECRET || "secret_ecom";

// ─── Internal Helper: Audit Log ──────────────────────────────────────────────
async function writeAudit(action, req, details = {}) {
  try {
    const admin = req.user || { id: null, email: "system", name: "System" };

    const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || req.ip || "";
    const userAgent = req.headers["user-agent"] || "";

    await AuditLog.create({
      action,
      adminId: admin.id || admin.userId,
      adminEmail: admin.email || "",
      adminName: admin.name || "",
      adminRoles: admin.roles || [],
      details,
      ip,
      userAgent,
      timestamp: new Date(),
    });
  } catch (err) {
    console.warn("[AuditLog] write error:", err.message);
  }
}

// ─── GET /allproducts ─────────────────────────────────────────────────────────
const getAllProducts = async (req, res) => {
  const showDeleted = req.query.showDeleted === "true";
  const filter = showDeleted ? {} : { isDeleted: { $ne: true } };

  try {
    const products = await Product.find(filter).lean();
    const reservedMap = await getActiveReservationsMap();

    // Identify top sellers per brand for badges
    const brandGroups = {};
    products.forEach((p) => {
      const groupKey = p.brand || p.category || "unknown";
      if (!brandGroups[groupKey]) brandGroups[groupKey] = [];
      brandGroups[groupKey].push(p);
    });

    const topSellerIds = new Set();
    for (const group of Object.values(brandGroups)) {
      const top = group.reduce((max, p) => (p.salesCount > (max.salesCount || 0) ? p : max), group[0] || {});
      if (top && top.id !== undefined) topSellerIds.add(String(top.id));
    }

    const productsWithFlags = products.map((p) => formatProduct(p, topSellerIds, reservedMap));
    res.send(productsWithFlags);
  } catch (err) {
    console.error("Error fetching products:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

// ─── POST /addproduct ─────────────────────────────────────────────────────────
const addProduct = async (req, res) => {
  try {
    const incoming = req.body || {};
    const category = (incoming.category || "").toString().toLowerCase().trim();
    const brand = normalizeBrandSlug(incoming.brand);

    // Auth context
    let adminEmail = null;
    try {
      const token = req.header("auth-token") || "";
      const payload = jwt.verify(token, JWT_SECRET);
      adminEmail = payload.email;
    } catch { }

    const last = await Product.findOne({}).sort({ id: -1 }).lean();
    const id = last && last.id ? last.id + 1 : 1;
    const skuNumber = await getNextSkuNumber();
    const colorways = sanitizeColorways(incoming.colorways);

    // Simple categories
    if (SIMPLE_CATEGORIES.includes(category)) {
      const stock = parseInt(incoming.stock);
      const price = parseFloat(incoming.price);

      if (isNaN(stock) || stock <= 0 || isNaN(price) || price < 0) {
        return res.status(400).json({ success: false, error: "Invalid stock or price." });
      }

      const productDoc = new Product({
        id, skuNumber, category, brand: "", colorways,
        name: incoming.name || "",
        image: incoming.image || "",
        subImages: incoming.subImages || [],
        description: incoming.description || "",
        price, stock, sizes: [],
        featured: incoming.featured || false,
      });

      await productDoc.save();

      // Create SKUs
      const seqRange = await getNextSequences(stock);
      const inserts = Array.from({ length: stock }).map((_, i) => ({
        sequenceNumber: seqRange.start + i,
        productId: productDoc.id,
        skuNumber,
        productRef: productDoc.id,
        productName: productDoc.name,
        productImage: productDoc.image || "",
        productPrice: price,
        category,
        brand: "",
        size: "—",
        status: "available",
        addedDate: new Date(),
        consignedBy: adminEmail,
      }));
      await ShoeSequence.insertMany(inserts);

      writeAudit("product_add", req, { productId: productDoc.id, skuNumber, category });
      return res.json({ success: true, id: productDoc.id, skuNumber });
    }

    // Shoe category
    const subCategories = sanitizeSubCategories(incoming.subCategories);
    const sizesArray = normalizeSizesToArray(incoming.sizes || {});
    const totalStock = sizesArray.reduce((sum, s) => sum + Number(s.quantity || 0), 0);

    if (totalStock <= 0) return res.status(400).json({ success: false, error: "Stock required." });

    const product = new Product({
      id, skuNumber, category, brand, subCategories, colorways,
      name: incoming.name || "",
      image: incoming.image || "",
      subImages: incoming.subImages || [],
      description: incoming.description || "",
      sizes: sizesArray,
      stock: totalStock,
      available: true,
      featured: incoming.featured || false,
    });

    await product.save();
    await createSkusForProduct(product.id, { sizesOverride: sizesArray, consignedBy: adminEmail });

    writeAudit("product_add", req, { productId: product.id, skuNumber, category, brand });
    return res.json({ success: true, id: product.id, skuNumber });

  } catch (err) {
    console.error("Add product error:", err);
    res.status(500).json({ success: false, error: "Server error", details: err.message });
  }
};

// ─── POST /editproduct ────────────────────────────────────────────────────────
const editProduct = async (req, res) => {
  try {
    const { id } = req.body;
    const product = await Product.findOne({ id: Number(id) });
    if (!product) return res.status(404).json({ success: false, error: "Not found" });

    const oldSnapshot = product.toObject();

    // Update basic fields
    const fields = ["name", "image", "subImages", "category", "description", "featured", "isNew", "isTopSellerInBrand", "price"];
    fields.forEach(f => { if (req.body[f] !== undefined) product[f] = req.body[f]; });

    if (req.body.brand !== undefined) product.brand = normalizeBrandSlug(req.body.brand);
    if (req.body.colorways !== undefined) product.colorways = sanitizeColorways(req.body.colorways);

    // Size handling
    if (req.body.sizes) {
      product.sizes = normalizeSizesToArray(req.body.sizes);
      product.stock = product.sizes.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);
      product.available = product.stock > 0;
    }

    await product.save();

    // Calculate diff for audit
    const diff = calculateDiff(oldSnapshot, product.toObject());

    // Sync sequences
    await ShoeSequence.updateMany(
      { $or: [{ productRef: product.id }, { productId: product.id }] },
      { $set: { productName: product.name, productImage: product.image, brand: product.brand, skuNumber: product.skuNumber } }
    );

    writeAudit("product_edit", req, { productId: product.id, name: product.name, changes: diff });
    return res.json({ success: true, updated: product });

  } catch (err) {
    console.error("Edit product error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

// ─── Other Actions ────────────────────────────────────────────────────────────
const removeProduct = async (req, res) => {
  const { id } = req.body;
  try {
    await Product.updateOne({ id }, { $set: { isDeleted: true } });
    writeAudit("product_delete", req, { id });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: "Failed" }); }
};

const restoreProduct = async (req, res) => {
  const { id } = req.body;
  try {
    await Product.updateOne({ id }, { $set: { isDeleted: false } });
    writeAudit("product_restore", req, { id });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: "Failed" }); }
};

const getFeatured = async (req, res) => {
  try {
    const top = await Product.find({ isDeleted: { $ne: true } }).sort({ salesCount: -1 }).limit(4);
    res.json(top);
  } catch (err) { res.status(500).json({ success: false }); }
};

// ─── Review Logic ─────────────────────────────────────────────────────────────
const addReview = async (req, res) => {
  try {
    const { productId, rating, review, title, fit, comfort, recommend } = req.body;
    
    let userName = "Anonymous";
    let userId = "";
    
    const token = req.header("auth-token");
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret_ecom");
        // Token structure is { user: { id: "..." } }
        const foundUserId = decoded.user?.id || decoded.id || "";
        if (foundUserId) {
          userId = foundUserId;
          const userDoc = await Users.findById(userId);
          if (userDoc) {
            userName = userDoc.name || "User";
          }
        }
      } catch (err) {
        console.error("Review auth error:", err);
      }
    }

    const newReview = new Review({
      productId: Number(productId),
      userId,
      userName,
      rating: Number(rating),
      review: (review || "").trim(),
      title: (title || "").trim(),
      fit: fit || "",
      comfort: comfort || "",
      recommend: recommend || "",
      date: new Date(),
    });

    await newReview.save();
    res.json({ success: true, reviewId: newReview._id });
  } catch (err) {
    console.error("addReview error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

const getReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ productId: Number(req.params.productId) }).sort({ date: -1 }).lean();
    res.json(reviews);
  } catch (err) { res.status(500).json({ success: false }); }
};

// ─── GET /myreviews — mobile-only: every review the logged-in user wrote,
// enriched with the product's name/image so it can be displayed without a
// second round-trip per item. ─────────────────────────────────────────────
const getMyReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ userId: String(req.user.id) }).sort({ date: -1 }).lean();
    const productIds = [...new Set(reviews.map((r) => r.productId))];
    const products = await Product.find({ id: { $in: productIds } }, "id name image").lean();
    const productMap = new Map(products.map((p) => [p.id, p]));

    const enriched = reviews.map((r) => ({
      ...r,
      productName:  productMap.get(r.productId)?.name  || "Product",
      productImage: productMap.get(r.productId)?.image || null,
    }));

    res.json({ success: true, reviews: enriched });
  } catch (err) {
    console.error("getMyReviews error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

const getNewCollections = async (req, res) => {
  try {
    const products = await Product.find({ isDeleted: { $ne: true } }).sort({ date: -1 }).limit(8);
    res.json(products);
  } catch (err) { res.status(500).json({ success: false }); }
};

const toggleNew = async (req, res) => {
  try {
    const { id, isNew } = req.body;
    await Product.updateOne({ id }, { $set: { isNew } });
    writeAudit("toggle_new", req, { id, isNew });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false }); }
};

const bulkUpdateNew = async (req, res) => {
  try {
    const { ids, isNew } = req.body;
    await Product.updateMany({ id: { $in: ids } }, { $set: { isNew } });
    writeAudit("bulk_update_new", req, { ids, isNew });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false }); }
};


const addColorway = async (req, res) => {
  try {
    const { parentId, name, description, image, subImages, sizes } = req.body;
    const parent = await Product.findOne({ id: parentId });
    if (!parent) return res.status(404).json({ success: false, error: "Parent product not found" });

    const last = await Product.findOne({}).sort({ id: -1 }).lean();
    const id = last && last.id ? last.id + 1 : 1;
    const skuNumber = await getNextSkuNumber();

    const product = new Product({
      id,
      skuNumber,
      parentId,
      name,
      description: description || parent.description,
      image,
      subImages: subImages || [],
      category: parent.category,
      brand: parent.brand,
      subCategories: parent.subCategories,
      sizes: sizes || [],
      stock: (sizes || []).reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0),
      available: true,
    });

    await product.save();
    await createSkusForProduct(product.id, { sizesOverride: sizes });

    writeAudit("add_colorway", req, { productId: id, parentId, name });
    res.json({ success: true, id, skuNumber });
  } catch (err) {
    console.error("Add colorway error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

module.exports = {
  getAllProducts, addProduct, editProduct, removeProduct, restoreProduct, getFeatured,
  getNewCollections, toggleNew, bulkUpdateNew, addColorway,
  fixSizes, fixAllSizes, migrateSizesWithPrices, migrateSkuNumbers,
  addReview, getReviews, getMyReviews
};