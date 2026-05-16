import React from "react";

const getStockLevel = (qty) => {
  if (qty === 0) return "empty";
  if (qty <= 3) return "low";
  if (qty <= 5) return "medium";
  return "high";
};

const normalizeSizes = (sizes = [], defaultPrice = 0) => {
  const out = {};
  if (!sizes) return out;
  if (Array.isArray(sizes)) {
    for (const entry of sizes) {
      if (!entry || !entry.size) continue;
      out[String(entry.size)] = { quantity: Number(entry.quantity || 0), price: Number(entry.price !== undefined ? entry.price : defaultPrice) };
    }
    return out;
  }
  for (const [k, v] of Object.entries(sizes || {})) {
    if (v == null) continue;
    if (typeof v === "object" && (v.quantity !== undefined || v.price !== undefined)) {
      out[k] = { quantity: Number(v.quantity || 0), price: Number(v.price !== undefined ? v.price : defaultPrice) };
    } else {
      out[k] = { quantity: Number(v || 0), price: defaultPrice };
    }
  }
  return out;
};

const StockIndicator = ({ sizes, highlightOnly }) => {
  const sizesObj = normalizeSizes(sizes || [], 0);
  const sizesQtyEntries = Object.entries(sizesObj).map(([size, obj]) => [size, obj.quantity]);
  let entries = sizesQtyEntries;
  if (highlightOnly === "low") entries = entries.filter(([, q]) => q > 0 && q <= 3);
  else if (highlightOnly === "out") entries = entries.filter(([, q]) => q === 0);
  else entries = entries.filter(([, q]) => q > 0);
  const totalStock = sizesQtyEntries.reduce((sum, [, q]) => sum + q, 0);

  if (entries.length === 0) {
    if (highlightOnly === "out" && totalStock === 0 && Object.keys(sizesObj).length > 0)
      return <div className="stock-indicator"><div className="stock-label">Sizes out</div><div className="total-stock danger">All sizes out of stock</div></div>;
    if (highlightOnly === "low")
      return <div className="stock-indicator"><div className="stock-label">Low stock</div><div className="total-stock">No low-stock sizes</div></div>;
    if (Object.keys(sizesObj).length === 0)
      return <div className="stock-indicator"><div className="stock-label">Stock</div><div className="total-stock danger">Out of stock</div></div>;
    return <div className="stock-indicator"><div className="stock-label">Sizes in Stock</div><div className="total-stock">No sizes to show</div></div>;
  }

  return (
    <div className="stock-indicator">
      <div className="stock-label">{highlightOnly === "low" ? "Low stock sizes" : highlightOnly === "out" ? "Out sizes" : "Sizes in Stock"}</div>
      <div className="stock-visual">
        {entries.slice(0, 8).map(([size, qty]) => (
          <div key={size} className={`stock-badge ${getStockLevel(qty)}`}>{size}: {qty}</div>
        ))}
        {entries.length > 8 && <div className="stock-badge medium">+{entries.length - 8} more</div>}
      </div>
      <div className={`total-stock ${totalStock <= 5 ? "warning" : ""} ${totalStock <= 3 ? "danger" : ""}`}>Total: {totalStock} pairs</div>
    </div>
  );
};

export default StockIndicator;
