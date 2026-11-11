// Single source of truth for a product's "display price" (the lowest price a
// customer can actually buy it for). The product card (Item.jsx) and the shop
// price filter / price sort (ShopCategory.jsx) both use this, so a product can
// never show one price on its card but be filtered by a different one — e.g.
// an out-of-stock size priced ₱8 used to put a ₱3,600 shoe under "Under ₱1000".

const PRICE_KEYS = ["price", "amount", "retail_price", "value", "new_price", "price_php", "php", "p"];
const QTY_KEYS = ["quantity", "qty", "stock", "available", "inventory"];

const toNumber = (v) => {
  if (v === null || v === undefined || v === "") return NaN;
  if (typeof v === "object") return NaN;
  if (typeof v === "string") return Number(v.replace(/[, ₱\s]+/g, ""));
  return Number(v);
};

const findPriceInEntry = (entry) => {
  if (entry === null || entry === undefined) return NaN;
  if (typeof entry === "number" || typeof entry === "string") {
    const n = toNumber(entry);
    return Number.isFinite(n) ? n : NaN;
  }
  if (Array.isArray(entry)) {
    for (const it of entry) {
      const p = findPriceInEntry(it);
      if (Number.isFinite(p)) return p;
    }
    return NaN;
  }
  for (const k of PRICE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(entry, k)) {
      const p = toNumber(entry[k]);
      if (Number.isFinite(p)) return p;
    }
  }
  for (const val of Object.values(entry)) {
    const p = findPriceInEntry(val);
    if (Number.isFinite(p)) return p;
  }
  return NaN;
};

const isAvailableEntry = (entry) => {
  if (entry === null || entry === undefined) return false;
  if (typeof entry !== "object") return true;
  for (const k of QTY_KEYS) {
    if (Object.prototype.hasOwnProperty.call(entry, k)) {
      const q = toNumber(entry[k]);
      return Number.isFinite(q) && q > 0;
    }
  }
  return true;
};

// Prices of sizes that are actually in stock (and priced above zero).
export const gatherPricesFromSizes = (sizes) => {
  if (!sizes || typeof sizes !== "object") return [];
  const prices = [];
  Object.values(sizes).forEach((entry) => {
    if (!isAvailableEntry(entry)) return;
    const p = findPriceInEntry(entry);
    if (Number.isFinite(p) && p > 0) prices.push(p);
  });
  return prices;
};

const gatherFallbackPrices = (product) => {
  const candidates = [];
  for (const k of ["new_price", "price", "price_map", "variants", "prices", "priceList"]) {
    if (product[k] !== undefined) {
      const p = findPriceInEntry(product[k]);
      if (Number.isFinite(p) && p > 0) candidates.push(p);
    }
  }
  return candidates;
};

/**
 * Lowest purchasable price for a product (or for Item props).
 * Uses in-stock sizes first; falls back to flat price fields.
 * Returns NaN when no valid price exists.
 */
export const getDisplayPrice = (product) => {
  if (!product) return NaN;
  const sizes = product.sizes || product.variants || product.price_map;
  const sizePrices = gatherPricesFromSizes(sizes);
  const all = sizePrices.length > 0 ? sizePrices : gatherFallbackPrices(product);
  return all.length > 0 ? Math.min(...all) : NaN;
};
