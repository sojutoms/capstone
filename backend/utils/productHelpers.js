const Product = require("../models/Product");

const SIMPLE_CATEGORIES = ["bags", "collectibles"];
const WATCH_CATEGORIES  = ["watch"];
const SHOE_SUBCATEGORIES = ["lifestyle", "running", "football", "basketball"];

/**
 * Normalizes brand names into URL-friendly slugs.
 */
const normalizeBrandSlug = (brand) => {
  return (brand || "").toString().toLowerCase().trim().replace(/\s+/g, "-");
};

/**
 * Sanitizes incoming shoe sub-categories against an allowed list.
 */
const sanitizeSubCategories = (raw) => {
  if (!raw) return [];
  const arr = Array.isArray(raw)
    ? raw
    : String(raw).split(",").map((s) => s.trim());
  return [
    ...new Set(
      arr
        .map((s) => String(s).toLowerCase().trim())
        .filter((s) => SHOE_SUBCATEGORIES.includes(s))
    ),
  ];
};

/**
 * Sanitizes incoming colorway objects for the schema.
 */
const sanitizeColorways = (raw) => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((cw) => cw && typeof cw === "object" && String(cw.name || "").trim())
    .map((cw) => ({
      name: String(cw.name || "").trim(),
      hex: String(cw.hex || "#000000").trim() || "#000000",
      image: String(cw.image || "").trim(),
      subImages: Array.isArray(cw.subImages)
        ? cw.subImages.map((u) => String(u || "").trim()).filter(Boolean)
        : [],
    }));
};

/**
 * Retrieves the next available global SKU number.
 */
const getNextSkuNumber = async () => {
  const last = await Product.findOne({ skuNumber: { $ne: null } })
    .sort({ skuNumber: -1 })
    .lean();
  return (last?.skuNumber || 0) + 1;
};

/**
 * Formats a raw product document with calculated flags (isNew, priceRange, etc.)
 */
const formatProduct = (product, topSellerIds = new Set()) => {
  const fallbackPrice = product.price !== undefined && product.price !== null ? Number(product.price) : 0;
  
  // Normalize sizes to object mapping if not already
  const sizes = {};
  if (Array.isArray(product.sizes)) {
    product.sizes.forEach((entry) => {
      if (!entry || !entry.size) return;
      sizes[String(entry.size)] = {
        quantity: Number(entry.quantity || 0),
        price: Number(entry.price !== undefined ? entry.price : fallbackPrice),
      };
    });
  } else {
    Object.entries(product.sizes || {}).forEach(([k, v]) => {
      sizes[k] = {
        quantity: Number(v.quantity || 0),
        price: Number(v.price !== undefined ? v.price : fallbackPrice),
      };
    });
  }

  const priceValues = Object.values(sizes)
    .map((s) => Number(s.price || 0))
    .filter((p) => !isNaN(p));

  let minPrice = fallbackPrice;
  let maxPrice = fallbackPrice;
  if (priceValues.length > 0) {
    minPrice = Math.min(...priceValues);
    maxPrice = Math.max(...priceValues);
  }

  const totalStock = Object.values(sizes).reduce((sum, s) => sum + Number(s.quantity || 0), 0) || Number(product.stock || 0);

  const now = Date.now();
  const productDate = product.date ? new Date(product.date).getTime() : now;
  const daysOld = (now - productDate) / (1000 * 60 * 60 * 24);
  
  return {
    ...product,
    sizes,
    priceRange: { min: minPrice, max: maxPrice },
    totalStock,
    isNew: daysOld <= 7,
    isJustIn: daysOld > 7 && daysOld <= 14, // Refined logic
    isTopSellerInBrand: topSellerIds.has(String(product.id)),
  };
};

module.exports = {
  SIMPLE_CATEGORIES,
  WATCH_CATEGORIES,
  SHOE_SUBCATEGORIES,
  normalizeBrandSlug,
  sanitizeSubCategories,
  sanitizeColorways,
  getNextSkuNumber,
  formatProduct
};
