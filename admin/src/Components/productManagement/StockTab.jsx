import React, { useState, useEffect } from "react";
import API_BASE_URL, { authorizedFetch } from "../../services/api";

const FALLBACK_SHOE_SIZES = ["6", "6.5", "7", "7.5", "8", "8.5", "9", "9.5", "10", "10.5", "11", "11.5", "12", "12.5", "13", "13.5", "14"];
const SIMPLE_CATEGORIES = ["bags", "collectibles"];
const PRICE_REASONS = [
  { value: "clearance", label: "Clearance / Markdown", hint: "Lower prices to move old stock" },
  { value: "promo", label: "Promotion", hint: "Temporary discount" },
  { value: "market", label: "Market Adjustment", hint: "Align with current resale prices" },
  { value: "restock", label: "New Batch / Restock", hint: "Adjusting price for new inventory" },
];

const fmtPrice = (v) => "₱" + (Number(v) || 0).toLocaleString();

const StockTab = ({ allproducts, getEffectiveSizes, showToast, onStockUpdated }) => {
  const [mode, setMode] = useState("list");
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [shoeSizes, setShoeSizes] = useState(FALLBACK_SHOE_SIZES);
  useEffect(() => {
    authorizedFetch("/sizes")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const sorted = data.map((s) => s.value).sort((a, b) => Number(a) - Number(b));
          setShoeSizes(sorted);
        }
      })
      .catch((err) => console.error("Size fetch error:", err));
  }, []);

  const [batchSupplier, setBatchSupplier] = useState("");
  const [batchCost, setBatchCost] = useState("");
  const [batchNotes, setBatchNotes] = useState("");
  const [batchDate, setBatchDate] = useState(new Date().toISOString().split("T")[0]);
  const [sizeLines, setSizeLines] = useState({});
  const [saving, setSaving] = useState(false);

  const [batches, setBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [priceMode, setPriceMode] = useState("all");
  const [editSizePrices, setEditSizePrices] = useState({});
  const [olderThanDays, setOlderThanDays] = useState(30);
  const [selectedBatch, setSelectedBatch] = useState("");
  const [priceReason, setPriceReason] = useState("clearance");
  const [previewCounts, setPreviewCounts] = useState({});
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [savingPrices, setSavingPrices] = useState(false);

  const isSimple = selectedProduct
    ? SIMPLE_CATEGORIES.includes((selectedProduct.category || "").toLowerCase())
    : false;
  const activeSizes = isSimple ? ["—"] : shoeSizes;
  const authH = { "Content-Type": "application/json" };

  const filtered = allproducts
    .filter((p) => !p.isDeleted)
    .filter((p) =>
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      String(p.id).includes(search)
    );

  const selectProduct = (product) => {
    setSelectedProduct(product);
    setMode("addstock");
    const live = getEffectiveSizes(product);
    const lines = {};
    const sizes = SIMPLE_CATEGORIES.includes((product.category || "").toLowerCase()) ? ["—"] : shoeSizes;
    sizes.forEach((s) => {
      const existingPrice = live[s]?.price || 0;
      lines[s] = { qty: "", price: existingPrice > 0 ? existingPrice : "" };
    });
    setSizeLines(lines);
    setBatchSupplier(""); setBatchCost(""); setBatchNotes("");
    setBatchDate(new Date().toISOString().split("T")[0]);
    const editPrices = {};
    sizes.forEach((s) => { editPrices[s] = ""; });
    setEditSizePrices(editPrices);
    setPriceMode("all"); setOlderThanDays(30); setSelectedBatch("");
    setPriceReason("clearance"); setPreviewCounts({});
  };

  const reset = () => { setSelectedProduct(null); setMode("list"); setBatches([]); };

  useEffect(() => {
    if (mode !== "editprice" || !selectedProduct) return;
    const load = async () => {
      setLoadingBatches(true);
      try {
        const res = await authorizedFetch(`/batches/${selectedProduct.id}`);
        const data = await res.json();
        setBatches(data.success ? data.batches : []);
      } catch { setBatches([]); }
      finally { setLoadingBatches(false); }
    };
    load();
  }, [mode, selectedProduct]);

  useEffect(() => {
    if (mode !== "editprice" || !selectedProduct) return;
    const buildPreviews = async () => {
      setLoadingPreview(true);
      const live = getEffectiveSizes(selectedProduct);
      const sizes = isSimple ? ["—"] : FALLBACK_SHOE_SIZES;
      const counts = {};
      for (const sz of sizes) {
        if (!live[sz] || live[sz].quantity === 0) { counts[sz] = 0; continue; }
        if (priceMode === "all") {
          counts[sz] = live[sz].quantity;
        } else if (priceMode === "older_than") {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - Number(olderThanDays || 0));
          const relevantBatches = batches.filter((b) => new Date(b.receivedDate) <= cutoff);
          counts[sz] = relevantBatches.reduce((sum, b) => {
            const line = b.lines?.find((l) => l.size === sz);
            return sum + Math.min(line?.quantity || 0, b.availableUnits || 0);
          }, 0);
        } else if (priceMode === "batch") {
          const batch = batches.find((b) => String(b._id) === selectedBatch);
          if (!batch) { counts[sz] = 0; continue; }
          const line = batch.lines?.find((l) => l.size === sz);
          counts[sz] = line ? Math.min(line.quantity, batch.availableUnits || 0) : 0;
        }
      }
      setPreviewCounts(counts);
      setLoadingPreview(false);
    };
    buildPreviews();
  }, [mode, priceMode, olderThanDays, selectedBatch, selectedProduct, batches]);

  const handleSaveStock = async () => {
    if (!selectedProduct) return;
    const validLines = activeSizes
      .map((s) => ({ size: s, quantity: Number(sizeLines[s]?.qty || 0), sellingPrice: Number(sizeLines[s]?.price || 0) }))
      .filter((l) => l.quantity > 0);
    if (validLines.length === 0) { showToast({ message: "Add at least one unit — enter qty and price for a size.", type: "warning" }); return; }
    const missingPrice = validLines.find((l) => l.sellingPrice <= 0);
    if (missingPrice) { showToast({ message: `Missing selling price for size ${missingPrice.size}`, type: "warning" }); return; }
    setSaving(true);
    try {
      const res = await authorizedFetch("/addstockbatch", { method: "POST", headers: authH, body: JSON.stringify({ productId: selectedProduct.id, supplierName: batchSupplier, costPrice: Number(batchCost) || 0, notes: batchNotes, receivedDate: batchDate, lines: validLines }) });
      const data = await res.json();
      if (!data.success) { showToast({ message: data.error || "Failed to add stock", type: "error" }); return; }
      const total = validLines.reduce((s, l) => s + l.quantity, 0);
      showToast({ message: `Batch #${data.batchNumber} added — ${total} unit(s)`, type: "success" });
      onStockUpdated();
      reset();
    } catch (err) { showToast({ message: "Error: " + err.message, type: "error" }); }
    finally { setSaving(false); }
  };

  const handleSavePrices = async () => {
    if (!selectedProduct) return;
    const live = getEffectiveSizes(selectedProduct);
    const sizes = isSimple ? ["—"] : FALLBACK_SHOE_SIZES;
    const sizesToUpdate = sizes.filter((sz) => Number(editSizePrices[sz]) > 0 && (live[sz]?.quantity || 0) > 0);
    if (sizesToUpdate.length === 0) { showToast({ message: "Enter a new price for at least one size that has stock.", type: "warning" }); return; }
    if (priceMode === "batch" && !selectedBatch) { showToast({ message: "Select a batch to update.", type: "warning" }); return; }
    setSavingPrices(true);
    const errs = [];
    let totalUpdated = 0;
    for (const sz of sizesToUpdate) {
      const newPrice = Number(editSizePrices[sz]);
      try {
        const res = await authorizedFetch("/updateskupricev2", { method: "POST", headers: authH, body: JSON.stringify({ productId: selectedProduct.id, size: sz, newPrice, mode: priceMode, olderThanDays: priceMode === "older_than" ? Number(olderThanDays) : undefined, batchId: priceMode === "batch" ? selectedBatch : undefined, reason: priceReason }) });
        const data = await res.json();
        if (data.success) totalUpdated += data.modifiedCount || 0;
        else errs.push(`Size ${sz}: ${data.error || "failed"}`);
      } catch (e) { errs.push(`Size ${sz}: ${e.message}`); }
    }
    setSavingPrices(false);
    if (errs.length > 0) { showToast({ message: errs.join(" · "), type: "error" }); }
    else if (totalUpdated === 0) { showToast({ message: "No units matched your filter — nothing changed.", type: "info" }); }
    else {
      showToast({ message: `Prices updated on ${totalUpdated} unit(s)`, type: "success" });
      onStockUpdated();
      reset();
    }
  };

  if (mode === "list") {
    return (
      <div className="ast-container animate-in">
        <div className="tab-header">
          <h1 className="chrome-text">STOCK & PRICING</h1>
          <p className="tab-subtitle">Manage inventory batches and dynamic pricing across your product catalog.</p>
        </div>

        <div className="search-wrapper glass">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="search-icon"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input className="acw-search-luxe" type="text" placeholder="Search by name or SKU #…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <div className="acw-product-grid">
          {filtered.map((p) => {
            const live = getEffectiveSizes(p);
            const totalStock = Object.values(live).reduce((s, o) => s + Number(o.quantity || 0), 0);
            const stockStatus = totalStock === 0 ? "out" : totalStock <= 5 ? "low" : "ok";
            return (
              <div key={p.id} className="acw-product-card glass-medium" onClick={() => selectProduct(p)}>
                <div className="card-visual">
                  <img src={p.image} alt={p.name} />
                  <div className="card-overlay">
                    <span className="overlay-text">MANAGE INVENTORY</span>
                  </div>
                </div>
                <div className="card-content">
                  <div className="card-sku">SKU #{p.id}</div>
                  <div className="card-name">{p.name} {p.parentId && <span className="variant-tag">VARIANT</span>}</div>
                  <div className="card-meta">
                    <span className={`stock-pill ${stockStatus}`}>
                      {totalStock} {stockStatus === "low" ? "LOW STOCK" : "IN STOCK"}
                    </span>
                    <span className="category-pill">{p.category}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const live = getEffectiveSizes(selectedProduct);
  const totalAdding = activeSizes.reduce((s, sz) => s + Number(sizeLines[sz]?.qty || 0), 0);
  const isColorway = !!selectedProduct?.parentId;

  return (
    <div className="ast-editor-container animate-in">
      <div className="form-header">
        <button className="back-btn-luxe" onClick={reset}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m15 18-6-6 6-6"/></svg>
          BACK TO LIST
        </button>
        <div className="parent-context glass-medium">
          <img src={selectedProduct.image} alt="" className="parent-thumb" />
          <div className="parent-info">
            <span className="info-label">MANAGING PRODUCT</span>
            <span className="info-name">{selectedProduct.name}</span>
            <span className="info-sku">SKU #{selectedProduct.id}</span>
          </div>
        </div>
      </div>

      <div className="ast-mode-switcher glass">
        <button className={`mode-tab ${mode === "addstock" ? "active" : ""}`} onClick={() => setMode("addstock")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
          ADD NEW BATCH
        </button>
        <button className={`mode-tab ${mode === "editprice" ? "active" : ""}`} onClick={() => setMode("editprice")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8M12 18V6"/></svg>
          ADJUST PRICING
        </button>
      </div>

      {mode === "addstock" && (
        <div className="ast-panel animate-in">
          <div className="batch-info-grid">
            <div className="form-section">
              <label className="form-label">SUPPLIER / CONSIGNER</label>
              <input className="form-input-luxe" type="text" placeholder="e.g. JD Sports" value={batchSupplier} onChange={(e) => setBatchSupplier(e.target.value)} />
            </div>
            <div className="form-section">
              <label className="form-label">DATE RECEIVED</label>
              <input className="form-input-luxe" type="date" value={batchDate} onChange={(e) => setBatchDate(e.target.value)} />
            </div>
            <div className="form-section">
              <label className="form-label">BATCH NOTES</label>
              <input className="form-input-luxe" type="text" placeholder="e.g. Deadstock condition" value={batchNotes} onChange={(e) => setBatchNotes(e.target.value)} />
            </div>
          </div>

          <div className="inventory-section glass-strong">
            <div className="section-header">
              <h3 className="section-title">{isSimple ? "UNIT DETAILS" : "SIZE BREAKDOWN"}</h3>
              <span className="section-badge">INVENTORY GRID</span>
            </div>
            <div className="sized-inventory-grid">
              {shoeSizes.map((sz) => {
                const currentQty = live[sz]?.quantity || 0;
                const currentPrice = live[sz]?.price || 0;
                const addingQty = Number(sizeLines[sz]?.qty || 0);
                const hasInput = sizeLines[sz]?.qty !== "" && addingQty > 0;
                const priceReadOnly = currentQty > 0 && currentPrice > 0;
                return (
                  <div key={sz} className="size-row">
                    <div className="size-header">{sz}</div>
                    <div
                      className="size-inputs"
                      style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px", overflow: "visible" }}
                    >
                      <input className="luxe-num-input" type="number" placeholder="QTY" value={sizeLines[sz]?.qty || ""} onChange={(e) => setSizeLines((prev) => ({ ...prev, [sz]: { ...prev[sz], qty: e.target.value } }))} />
                      <input
                        className="luxe-num-input"
                        type="number"
                        placeholder="Price"
                        value={sizeLines[sz]?.price || ""}
                        readOnly={priceReadOnly}
                        tabIndex={priceReadOnly ? -1 : 0}
                        onChange={priceReadOnly ? undefined : (e) => setSizeLines((prev) => ({ ...prev, [sz]: { ...prev[sz], price: e.target.value } }))}
                        style={priceReadOnly ? { opacity: 0.5, cursor: "not-allowed", background: "rgba(255,255,255,0.03)" } : {}}
                        title={priceReadOnly ? "Price is locked — size still has stock. Use Adjust Pricing to change." : "Set selling price for this size"}
                      />
                    </div>
                    {hasInput && <div className="preview-indicator">NEW TOTAL: {currentQty + addingQty}</div>}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="acw-footer">
            <button className="footer-btn-secondary" onClick={reset}>Discard</button>
            <button className="footer-btn-primary" onClick={handleSaveStock} disabled={saving || totalAdding === 0}>
              {saving ? "SAVING BATCH..." : "CONFIRM NEW STOCK"}
            </button>
          </div>
        </div>
      )}

      {mode === "editprice" && (
        <div className="ast-panel animate-in">
          <div className="inventory-section glass-strong">
            <div className="section-header">
              <h3 className="section-title">PRICE ADJUSTMENTS {loadingPreview && <span className="loading-dots">...</span>}</h3>
              <span className="section-badge">BULK UPDATE</span>
            </div>
            <div className="price-adjustment-list">
              {activeSizes.map((sz) => {
                const currentQty = live[sz]?.quantity || 0;
                const currentPrice = live[sz]?.price || 0;
                if (currentQty === 0 && currentPrice === 0) return null;
                const newP = Number(editSizePrices[sz] || 0);
                const changed = newP > 0 && newP !== currentPrice;
                const count = previewCounts[sz] || 0;
                return (
                  <div key={sz} className={`price-row-luxe glass-medium ${changed ? "active" : ""}`}>
                    <div className="row-size">{sz}</div>
                    <div className="row-meta">
                      <span className="row-stock">{currentQty} STOCK</span>
                      <span className="row-current">{fmtPrice(currentPrice)}</span>
                    </div>
                    <div className="row-input">
                      <input className="luxe-num-input" type="number" placeholder="NEW PRICE" value={editSizePrices[sz] || ""} onChange={(e) => setEditSizePrices((prev) => ({ ...prev, [sz]: e.target.value }))} />
                    </div>
                    {changed && count > 0 && (
                      <div className="preview-indicator">
                        {count} UNITS → {fmtPrice(newP)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="acw-footer">
            <button className="footer-btn-secondary" onClick={reset}>Discard</button>
            <button className="footer-btn-primary" onClick={handleSavePrices} disabled={savingPrices}>
              {savingPrices ? "APPLYING CHANGES..." : "UPDATE PRICING"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockTab;
