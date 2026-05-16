// ─── normalizeSizesToArray ────────────────────────────────────────────────────
// Accepts either an array of {size, quantity, price} entries or an object map.
// Always returns an array of normalized entries.
function normalizeSizesToArray(sizesInput = {}) {
  if (Array.isArray(sizesInput)) {
    return sizesInput
      .map((entry) => ({
        size: String(entry.size ?? "").trim(),
        quantity: Number.isFinite(Number(entry.quantity))
          ? Math.max(0, parseInt(entry.quantity, 10))
          : 0,
        price: Number.isFinite(Number(entry.price)) ? Number(entry.price) : 0,
      }))
      .filter((e) => e.size !== "");
  }

  const out = [];
  for (const [sizeKey, val] of Object.entries(sizesInput || {})) {
    if (val == null) continue;
    const quantity =
      typeof val === "object" ? Number(val.quantity || 0) : Number(val || 0);
    const price = typeof val === "object" ? Number(val.price || 0) : 0;
    out.push({
      size: String(sizeKey).trim(),
      quantity: Number.isFinite(quantity) ? Math.max(0, parseInt(quantity, 10)) : 0,
      price: Number.isFinite(price) ? Number(price) : 0,
    });
  }
  return out.filter((e) => e.size !== "");
}

// ─── normalizeProductSizes ────────────────────────────────────────────────────
// Converts sizes (array or object) into a keyed map: { "8": { quantity, price } }
const normalizeProductSizes = (sizes = {}, defaultPrice = 0) => {
  const out = {};
  if (!sizes) return out;

  if (Array.isArray(sizes)) {
    for (const entry of sizes) {
      if (!entry || !entry.size) continue;
      out[String(entry.size)] = {
        quantity: Number(entry.quantity || 0),
        price: Number(entry.price !== undefined ? entry.price : defaultPrice),
      };
    }
    return out;
  }

  for (const [k, v] of Object.entries(sizes || {})) {
    if (v == null) continue;
    if (typeof v === "object" && (v.quantity !== undefined || v.price !== undefined)) {
      out[k] = {
        quantity: Number(v.quantity || 0),
        price: Number(v.price !== undefined ? v.price : defaultPrice),
      };
    } else {
      out[k] = { quantity: Number(v || 0), price: defaultPrice };
    }
  }
  return out;
};

// ─── convertMapToDbShape ──────────────────────────────────────────────────────
// Converts the keyed map back to the shape stored in MongoDB (array or object).
const convertMapToDbShape = (map, originalSizesIsArray = false) => {
  if (!map) return originalSizesIsArray ? [] : {};
  if (originalSizesIsArray) {
    return Object.entries(map).map(([size, v]) => ({
      size: String(size),
      quantity: Number(v.quantity || 0),
      price: Number(v.price || 0),
    }));
  }
  const out = {};
  for (const [k, v] of Object.entries(map || {})) {
    out[k] = { quantity: Number(v.quantity || 0), price: Number(v.price || 0) };
  }
  return out;
};

// ─── getSizePriceFromMap ──────────────────────────────────────────────────────
const getSizePriceFromMap = (sizesMap, product, size) => {
  if (!product) return 0;
  if (!size) return Number(product.new_price ?? product.price ?? 0);
  const sizeData = sizesMap?.[size];
  if (sizeData && sizeData.price !== undefined) return Number(sizeData.price || 0);
  return Number(product.new_price ?? product.price ?? 0);
};

module.exports = {
  normalizeSizesToArray,
  normalizeProductSizes,
  convertMapToDbShape,
  getSizePriceFromMap,
};