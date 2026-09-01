// Shared product-data helpers — previously copy-pasted identically across
// HomeScreen, ShoesScreen, WatchesScreen, BagsScreen, and CollectiblesScreen.
// Pulling them out here means every screen resolves prices/badges the same
// way, so a card never looks "uniform" by accident.

export const toNumber = (v) => {
  if (v === null || v === undefined || v === "") return NaN;
  if (typeof v === "object") return NaN;
  if (typeof v === "string") return Number(v.replace(/[, ]+/g, ""));
  return Number(v);
};

const PRICE_KEYS = ["price", "amount", "retail_price", "value", "new_price", "price_php", "php", "p"];
const QTY_KEYS   = ["quantity", "qty", "stock", "available", "inventory"];

const findPriceInEntry = (entry) => {
  if (!entry) return NaN;
  if (typeof entry === "number" || typeof entry === "string") {
    const n = toNumber(entry);
    return Number.isFinite(n) ? n : NaN;
  }
  if (Array.isArray(entry)) {
    for (const it of entry) {
      const p = findPriceInEntry(it);
      if (Number.isFinite(p)) return p;
    }
  }
  if (typeof entry === "object") {
    for (const k of PRICE_KEYS) {
      if (entry[k] !== undefined) {
        const p = toNumber(entry[k]);
        if (Number.isFinite(p)) return p;
      }
    }
    for (const val of Object.values(entry)) {
      const p = findPriceInEntry(val);
      if (Number.isFinite(p)) return p;
    }
  }
  return NaN;
};

const isAvailableEntry = (entry) => {
  if (!entry) return false;
  if (typeof entry !== "object") return true;
  for (const k of QTY_KEYS) {
    if (entry[k] !== undefined) {
      const q = toNumber(entry[k]);
      return Number.isFinite(q) && q > 0;
    }
  }
  return true;
};

export const getLowestPrice = (product) => {
  let prices = [];
  if (product.sizes) {
    Object.values(product.sizes).forEach((entry) => {
      if (!isAvailableEntry(entry)) return;
      const p = findPriceInEntry(entry);
      if (Number.isFinite(p) && p > 0) prices.push(p);
    });
  }
  if (prices.length === 0) {
    const p1 = findPriceInEntry(product.new_price);
    const p2 = findPriceInEntry(product.price);
    if (Number.isFinite(p1)) prices.push(p1);
    if (Number.isFinite(p2)) prices.push(p2);
  }
  return prices.length === 0 ? null : Math.min(...prices);
};

export const getBadge = (product, index) => {
  if (product.is_new || product.badge === "new") return { label: "NEW", style: "new" };
  if (product.is_hot || product.badge === "hot") return { label: "HOT", style: "hot" };
  if (product.old_price)                         return { label: "SALE", style: "sale" };
  if (index % 5 === 0)                           return { label: "NEW", style: "new" };
  if (index % 7 === 3)                           return { label: "HOT", style: "hot" };
  return null;
};

export const isOutOfStock = (item) => {
  if (!item.sizes || !Object.keys(item.sizes).length) return Number(item.stock || 0) <= 0;
  return Object.values(item.sizes).every((sz) => {
    const qty = typeof sz === "object" ? sz.quantity : Number(sz);
    return Number(qty || 0) <= 0;
  });
};
