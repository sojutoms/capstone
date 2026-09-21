// Shared stock helpers so the cart drawer and cart page enforce the same rules.
export const SIMPLE_CATEGORIES = ["bags", "collectibles"];

export const getAvailableStock = (product, size) => {
  if (!product) return 0;
  const isSimple = product.category && SIMPLE_CATEGORIES.includes(String(product.category).toLowerCase());
  if (isSimple) return Math.max(0, Number(product.stock || 0));

  const targetSize = String(size || "").trim();
  if (Array.isArray(product.sizes)) {
    const sizeData = product.sizes.find((s) => {
      const sSize = String(s.size || "").trim();
      return sSize === targetSize || (parseFloat(sSize) === parseFloat(targetSize) && !isNaN(parseFloat(targetSize)));
    });
    if (sizeData) return Math.max(0, Number(sizeData.quantity || 0));
  } else if (product.sizes && typeof product.sizes === "object") {
    const sizeData = product.sizes[size] || product.sizes[targetSize];
    const q = typeof sizeData === "object" ? sizeData.quantity : sizeData;
    return Number.isFinite(Number(q)) ? Math.max(0, Number(q)) : 0;
  }
  return 0;
};
