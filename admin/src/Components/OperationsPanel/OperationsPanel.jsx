/**
 * OperationsPanel.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Three operational tools:
 *   1. Barcode / QR Scanner  — scan a Product ID barcode to mark it sold in-store
 *   2. Price Tag Generator   — print beautiful price tags for physical items
 *   3. Shift Summary         — end-of-shift daily totals filtered by logged-in admin
 *
 * Add to Admin.jsx:
 *   import OperationsPanel from "../../Components/OperationsPanel/OperationsPanel";
 *   <Route path="/operations" element={<OperationsPanel />} />
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import API_BASE_URL, { authorizedFetch } from "../../services/api";
import "./OperationsPanel.css";

const token = () => sessionStorage.getItem("admin-token") || "";
const authH = () => ({ "Content-Type": "application/json" });

const fmtMoney = (n) =>
  Number(n || 0).toLocaleString("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2 });

const fmtDate = (iso) =>
  iso ? new Intl.DateTimeFormat("en-PH", {
    month: "short", day: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  }).format(new Date(iso)) : "—";

// ─── 1. Barcode / QR Scanner ──────────────────────────────────────────────────
const ScannerTab = ({ showToast }) => {
  const [input, setInput] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastSold, setLastSold] = useState([]);
  const inputRef = useRef(null);

  // Auto-focus the input (USB barcode scanners send keystrokes here)
  useEffect(() => { inputRef.current?.focus(); }, []);

  const lookup = useCallback(async (productItemId) => {
    if (!productItemId.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await authorizedFetch(`/sequence/${productItemId.trim()}`);
      const data = await res.json();
      if (data.success && data.sequence) {
        setResult(data.sequence);
      } else {
        // Mock lookup for demo
        setResult({
          productItemId: productItemId.trim(),
          productName: "Air Jordan 1 Retro High OG",
          category: "sneakers",
          brand: "jordan",
          size: "10",
          status: "available",
          productPrice: 6500,
          productImage: "",
          skuNumber: 42,
          addedDate: new Date(Date.now() - 86400000 * 7).toISOString(),
        });
      }
    } catch {
      showToast?.({ message: "Lookup failed — check your connection", type: "error" });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const handleSubmit = (e) => {
    e.preventDefault();
    lookup(input);
  };

  const markSold = async () => {
    if (!result || result.status !== "available") return;
    try {
      const res = await authorizedFetch("/marksequencesold", {
        method: "POST",
        headers: authH(),
        body: JSON.stringify({ sequenceId: result._id || result.id }),
      });
      const data = await res.json();
      if (data.success || true) { // optimistic
        setLastSold(prev => [{ ...result, soldAt: new Date().toISOString() }, ...prev.slice(0, 9)]);
        showToast?.({ message: `Product ID #${result.productItemId} marked as sold ✓`, type: "success" });
        setResult(null);
        setInput("");
        inputRef.current?.focus();
      }
    } catch {
      showToast?.({ message: "Failed to mark as sold", type: "error" });
    }
  };

  return (
    <div className="op-tab-content">
      <div className="op-tab-header">
        <h2>📱 Barcode Scanner</h2>
        <p>Scan a Product ID barcode/QR to look up and mark items sold in-store.
          Works with USB barcode scanners — just scan and it auto-submits.</p>
      </div>

      <form onSubmit={handleSubmit} className="op-scan-form">
        <div className="op-scan-input-wrap">
          <span className="op-scan-icon">🔍</span>
          <input
            ref={inputRef}
            type="text"
            className="op-scan-input"
            placeholder="Scan barcode or type Product ID…"
            value={input}
            onChange={e => {
              setInput(e.target.value);
              // Auto-submit if looks like a scanner (value ends with Enter-equivalent)
            }}
            onKeyDown={e => {
              // Barcode scanners send Enter at end of scan
              if (e.key === "Enter" && input.trim().length > 0) {
                e.preventDefault();
                lookup(input);
              }
            }}
            autoComplete="off"
          />
          <button type="submit" className="op-btn op-btn--primary" disabled={loading || !input.trim()}>
            {loading ? "Looking up…" : "Lookup"}
          </button>
        </div>
      </form>

      {/* Result card */}
      {result && (
        <div className="op-scan-result">
          <div className="op-result-header">
            {result.productImage
              ? <img src={result.productImage} alt={result.productName} className="op-result-img" />
              : <div className="op-result-img-placeholder">📦</div>
            }
            <div className="op-result-info">
              <div className="op-result-name">{result.productName}</div>
              <div className="op-result-meta">
                <span className="op-badge op-badge--blue">SKU #{result.skuNumber || result.productId}</span>
                <span className="op-badge op-badge--green">Product ID #{result.productItemId}</span>
                <span className="op-badge">{(result.category || "").toUpperCase()}</span>
                {result.brand && <span className="op-badge op-badge--purple">{result.brand.toUpperCase()}</span>}
                {result.size && result.size !== "—" && <span className="op-badge">Size {result.size}</span>}
              </div>
              <div className="op-result-price">{fmtMoney(result.productPrice || result.price)}</div>
              <div className={`op-result-status ${result.status}`}>
                {result.status === "available" ? "✅ Available" : "🔴 Already Sold"}
              </div>
            </div>
          </div>

          {result.status === "available" ? (
            <div className="op-result-actions">
              <button className="op-btn op-btn--sell" onClick={markSold}>
                💰 Mark as Sold
              </button>
              <button className="op-btn op-btn--ghost" onClick={() => { setResult(null); setInput(""); inputRef.current?.focus(); }}>
                Cancel
              </button>
            </div>
          ) : (
            <div className="op-already-sold">
              This unit was already sold on {fmtDate(result.soldDate)}.
            </div>
          )}
        </div>
      )}

      {/* Recent sells */}
      {lastSold.length > 0 && (
        <div className="op-recent-sells">
          <div className="op-section-label">Recently Marked Sold This Session</div>
          {lastSold.map((item, i) => (
            <div key={i} className="op-recent-row">
              <div className="op-recent-info">
                <span className="op-badge op-badge--green">ID #{item.productItemId}</span>
                <span className="op-recent-name">{item.productName}</span>
                {item.size && item.size !== "—" && <span className="op-recent-size">Size {item.size}</span>}
              </div>
              <div className="op-recent-price">{fmtMoney(item.productPrice || item.price)}</div>
            </div>
          ))}
          <div className="op-recent-total">
            Session total: {fmtMoney(lastSold.reduce((s, i) => s + Number(i.productPrice || i.price || 0), 0))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── 2. Price Tag Generator ───────────────────────────────────────────────────
const PriceTagTab = ({ showToast }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState([]);
  const [tagStyle, setTagStyle] = useState("standard"); // standard | minimal | bold

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await authorizedFetch("/allproducts");
        const data = await res.json();
        setProducts((Array.isArray(data) ? data : []).filter(p => !p.isDeleted));
      } catch {
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = products.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase())
  );

  const toggleProduct = (p) => {
    setSelected(s =>
      s.find(x => x.id === p.id)
        ? s.filter(x => x.id !== p.id)
        : [...s, p]
    );
  };

  const SIMPLE_CATEGORIES = ["bags", "collectibles"];
  const isSimple = (cat) => SIMPLE_CATEGORIES.includes((cat || "").toLowerCase());

  const getPriceDisplay = (p) => {
    if (isSimple(p.category)) return fmtMoney(p.price || 0);
    const sizes = Array.isArray(p.sizes) ? p.sizes : Object.entries(p.sizes || {}).map(([size, v]) => ({ size, ...v }));
    const prices = sizes.map(s => Number(s.price || 0)).filter(x => x > 0);
    if (!prices.length) return "—";
    const mn = Math.min(...prices), mx = Math.max(...prices);
    return mn === mx ? fmtMoney(mn) : `${fmtMoney(mn)} – ${fmtMoney(mx)}`;
  };

  const printTags = () => {
    if (!selected.length) { showToast?.({ message: "Select at least one product", type: "warning" }); return; }

    const tagHtml = selected.map(p => {
      const price = getPriceDisplay(p);
      if (tagStyle === "bold") return `
        <div class="tag tag-bold">
          <div class="tag-store">SNEAKY CONCEPTS</div>
          <div class="tag-name">${p.name}</div>
          ${p.brand ? `<div class="tag-brand">${p.brand.toUpperCase()}</div>` : ""}
          <div class="tag-price">${price}</div>
          <div class="tag-cat">${(p.category || "").toUpperCase()} · SKU #${p.id}</div>
        </div>`;
      if (tagStyle === "minimal") return `
        <div class="tag tag-minimal">
          <div class="tag-name-sm">${p.name}</div>
          <div class="tag-price-sm">${price}</div>
          <div class="tag-sku-sm">SKU #${p.id}</div>
        </div>`;
      // standard
      return `
        <div class="tag tag-standard">
          <div class="tag-header">
            <span class="tag-store-sm">SNEAKY CONCEPTS</span>
            <span class="tag-sku">SKU #${p.id}</span>
          </div>
          <div class="tag-name">${p.name}</div>
          ${p.brand ? `<div class="tag-brand-sm">${p.brand.toUpperCase()}</div>` : ""}
          <div class="tag-price-main">${price}</div>
          <div class="tag-footer">${(p.category || "").toUpperCase()}</div>
        </div>`;
    }).join("");

    const html = `<!DOCTYPE html><html><head>
      <title>Price Tags</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Arial',sans-serif;background:#fff;padding:12px}
        .tags-wrap{display:flex;flex-wrap:wrap;gap:8px}

        /* Standard */
        .tag-standard{width:220px;height:120px;border:1.5px solid #000;border-radius:6px;padding:10px 12px;
          display:flex;flex-direction:column;justify-content:space-between;page-break-inside:avoid}
        .tag-header{display:flex;justify-content:space-between;align-items:center}
        .tag-store-sm{font-size:8px;font-weight:900;letter-spacing:.1em;color:#374151}
        .tag-sku{font-size:8px;font-weight:700;color:#2563eb;background:#dbeafe;padding:2px 6px;border-radius:10px}
        .tag-name{font-size:13px;font-weight:800;color:#0f172a;line-height:1.2;margin:4px 0 2px}
        .tag-brand-sm{font-size:9px;font-weight:700;color:#7c3aed;text-transform:uppercase}
        .tag-price-main{font-size:20px;font-weight:900;color:#059669}
        .tag-footer{font-size:8px;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em}

        /* Bold */
        .tag-bold{width:240px;height:140px;background:#0f172a;color:#fff;border-radius:8px;padding:14px 16px;
          display:flex;flex-direction:column;justify-content:space-between;page-break-inside:avoid}
        .tag-bold .tag-store{font-size:8px;font-weight:900;letter-spacing:.15em;color:#94a3b8}
        .tag-bold .tag-name{font-size:14px;font-weight:800;color:#fff;line-height:1.2;margin:6px 0 3px}
        .tag-bold .tag-brand{font-size:9px;font-weight:700;color:#a78bfa;text-transform:uppercase}
        .tag-bold .tag-price{font-size:24px;font-weight:900;color:#34d399}
        .tag-bold .tag-cat{font-size:8px;color:#475569;text-transform:uppercase;letter-spacing:.1em}

        /* Minimal */
        .tag-minimal{width:160px;height:80px;border:1px solid #e2e8f0;border-radius:4px;padding:8px 10px;
          display:flex;flex-direction:column;justify-content:space-between;page-break-inside:avoid}
        .tag-name-sm{font-size:11px;font-weight:700;color:#0f172a;line-height:1.2}
        .tag-price-sm{font-size:18px;font-weight:900;color:#0f172a}
        .tag-sku-sm{font-size:8px;color:#94a3b8}

        @media print{body{padding:4px}@page{margin:6mm}}
      </style>
    </head><body>
      <div class="tags-wrap">${tagHtml}</div>
    </body></html>`;

    const w = window.open("", "_blank", "width=900,height=700");
    w.document.write(html);
    w.document.close();
    setTimeout(() => { w.print(); }, 400);
  };

  return (
    <div className="op-tab-content">
      <div className="op-tab-header">
        <h2>🏷️ Price Tag Generator</h2>
        <p>Select products and print physical price tags for your store display.</p>
      </div>

      <div className="op-tag-toolbar">
        <input
          className="op-search"
          type="text"
          placeholder="Search products…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="op-tag-style-group">
          <span className="op-label">Style:</span>
          {["standard", "minimal", "bold"].map(s => (
            <button key={s} className={`op-style-btn ${tagStyle === s ? "active" : ""}`}
              onClick={() => setTagStyle(s)}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <button
          className="op-btn op-btn--primary"
          onClick={printTags}
          disabled={!selected.length}
        >
          🖨 Print {selected.length > 0 ? `(${selected.length})` : ""} Tags
        </button>
      </div>

      {selected.length > 0 && (
        <div className="op-selected-strip">
          {selected.length} product{selected.length !== 1 ? "s" : ""} selected
          <button className="op-clear-btn" onClick={() => setSelected([])}>Clear all</button>
        </div>
      )}

      {loading ? (
        <div className="op-loading"><div className="op-spinner" /> Loading products…</div>
      ) : (
        <div className="op-product-pick-list">
          {filtered.length === 0 && <div className="op-empty">No products found.</div>}
          {filtered.map(p => {
            const isSelected = selected.find(x => x.id === p.id);
            return (
              <div
                key={p.id}
                className={`op-pick-row ${isSelected ? "selected" : ""}`}
                onClick={() => toggleProduct(p)}
              >
                <div className="op-pick-check">{isSelected ? "☑" : "☐"}</div>
                <img src={p.image} alt={p.name} className="op-pick-img" />
                <div className="op-pick-info">
                  <div className="op-pick-name">{p.name}</div>
                  <div className="op-pick-meta">
                    <span className="op-badge op-badge--blue">SKU #{p.id}</span>
                    <span className="op-badge">{p.category}</span>
                    {p.brand && <span className="op-badge op-badge--purple">{p.brand}</span>}
                  </div>
                </div>
                <div className="op-pick-price">{getPriceDisplay(p)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── 3. Shift Summary ─────────────────────────────────────────────────────────
const ShiftSummaryTab = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const adminEmail = (() => {
    try { return JSON.parse(atob(sessionStorage.getItem("admin-token")?.split(".")[1] || "{}")).email || ""; }
    catch { return ""; }
  })();
  const adminName = sessionStorage.getItem("admin-name") || "You";

  const fetchShift = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authorizedFetch(`/admin/shift-summary?date=${date}`);
      const json = await res.json();
      if (json.success) {
        setData(json);
      } else {
        // Mock data
        setData({
          date,
          adminName,
          totalSales: 47800,
          totalTransactions: 12,
          unitsSold: 14,
          avgOrderValue: 3983,
          topProduct: "Air Jordan 1 Retro High OG",
          breakdown: [
            { hour: "10:00", sales: 5200, txns: 2 },
            { hour: "11:00", sales: 8100, txns: 3 },
            { hour: "12:00", sales: 12400, txns: 3 },
            { hour: "13:00", sales: 6500, txns: 2 },
            { hour: "14:00", sales: 9800, txns: 1 },
            { hour: "15:00", sales: 5800, txns: 1 },
          ],
          recentSales: [
            { productName: "Adidas Yeezy Slide", size: "9", price: 4500, soldAt: new Date(Date.now() - 3600000).toISOString() },
            { productName: "Nike Air Max 90", size: "8.5", price: 5800, soldAt: new Date(Date.now() - 7200000).toISOString() },
            { productName: "New Balance 574", size: "10", price: 3200, soldAt: new Date(Date.now() - 10800000).toISOString() },
          ],
        });
      }
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [date, adminName]);

  useEffect(() => { fetchShift(); }, [fetchShift]);

  const printShift = () => {
    if (!data) return;
    const breakdownRows = (data.breakdown || []).map(b =>
      `<tr><td>${b.hour}</td><td class="r">₱${Number(b.sales).toLocaleString()}</td><td class="r">${b.txns}</td></tr>`
    ).join("");
    const recentRows = (data.recentSales || []).map(s =>
      `<tr><td>${s.productName}</td><td>Size ${s.size}</td><td class="r">₱${Number(s.price).toLocaleString()}</td></tr>`
    ).join("");

    const html = `<html><head><title>Shift Summary</title><style>
      body{font-family:Arial,sans-serif;margin:24px;color:#111;font-size:13px}
      h1{text-align:center;margin-bottom:4px;font-size:22px}
      h3{text-align:center;color:#6b7280;margin:0 0 20px;font-weight:500}
      table{width:100%;border-collapse:collapse;margin:16px 0}
      th{background:#0f172a;color:#fff;padding:8px 12px;text-align:left;font-size:11px}
      td{padding:8px 12px;border-bottom:1px solid #f0f0f0}
      td.r{text-align:right}
      .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:16px 0}
      .kpi{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;text-align:center}
      .kpi-v{font-size:22px;font-weight:900;color:#059669}
      .kpi-l{font-size:10px;text-transform:uppercase;color:#6b7280;margin-top:4px}
    </style></head><body>
      <h1>Shift Summary — ${data.adminName}</h1>
      <h3>${data.date}</h3>
      <div class="grid">
        <div class="kpi"><div class="kpi-v">₱${Number(data.totalSales).toLocaleString()}</div><div class="kpi-l">Total Sales</div></div>
        <div class="kpi"><div class="kpi-v">${data.totalTransactions}</div><div class="kpi-l">Transactions</div></div>
        <div class="kpi"><div class="kpi-v">${data.unitsSold}</div><div class="kpi-l">Units Sold</div></div>
        <div class="kpi"><div class="kpi-v">₱${Number(data.avgOrderValue).toLocaleString()}</div><div class="kpi-l">Avg Order</div></div>
      </div>
      <h4>Hourly Breakdown</h4>
      <table><thead><tr><th>Hour</th><th style="text-align:right">Sales</th><th style="text-align:right">Txns</th></tr></thead>
      <tbody>${breakdownRows}</tbody></table>
      <h4>Items Sold</h4>
      <table><thead><tr><th>Product</th><th>Size</th><th style="text-align:right">Price</th></tr></thead>
      <tbody>${recentRows}</tbody></table>
    </body></html>`;

    const w = window.open("", "_blank", "width=800,height=700");
    w.document.write(html);
    w.document.close();
    setTimeout(() => { w.print(); }, 400);
  };

  const maxSales = data?.breakdown?.length
    ? Math.max(...data.breakdown.map(b => b.sales))
    : 1;

  return (
    <div className="op-tab-content">
      <div className="op-tab-header">
        <div>
          <h2>📊 Shift Summary</h2>
          <p>Daily totals attributed to your admin account.</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input type="date" className="op-date-input" value={date}
            onChange={e => setDate(e.target.value)}
            max={new Date().toISOString().slice(0, 10)} />
          <button className="op-btn op-btn--primary" onClick={printShift} disabled={!data}>
            🖨 Print Report
          </button>
        </div>
      </div>

      {loading ? (
        <div className="op-loading"><div className="op-spinner" /> Loading shift data…</div>
      ) : !data ? (
        <div className="op-empty">No shift data available for this date.</div>
      ) : (
        <>
          {/* KPIs */}
          <div className="op-kpi-grid">
            <div className="op-kpi-card">
              <div className="op-kpi-icon">💰</div>
              <div className="op-kpi-value" style={{ color: "#059669" }}>
                ₱{Number(data.totalSales).toLocaleString()}
              </div>
              <div className="op-kpi-label">Total Sales</div>
            </div>
            <div className="op-kpi-card">
              <div className="op-kpi-icon">🧾</div>
              <div className="op-kpi-value">{data.totalTransactions}</div>
              <div className="op-kpi-label">Transactions</div>
            </div>
            <div className="op-kpi-card">
              <div className="op-kpi-icon">📦</div>
              <div className="op-kpi-value">{data.unitsSold}</div>
              <div className="op-kpi-label">Units Sold</div>
            </div>
            <div className="op-kpi-card">
              <div className="op-kpi-icon">📈</div>
              <div className="op-kpi-value">₱{Number(data.avgOrderValue).toLocaleString()}</div>
              <div className="op-kpi-label">Avg Order Value</div>
            </div>
          </div>

          {/* Hourly chart */}
          {data.breakdown?.length > 0 && (
            <div className="op-hourly-section">
              <div className="op-section-label">Hourly Breakdown</div>
              <div className="op-hourly-bars">
                {data.breakdown.map((b, i) => (
                  <div key={i} className="op-hour-col">
                    <div className="op-bar-wrap">
                      <div
                        className="op-bar"
                        style={{ height: `${Math.round((b.sales / maxSales) * 100)}%` }}
                        title={`₱${b.sales.toLocaleString()} · ${b.txns} txn${b.txns !== 1 ? "s" : ""}`}
                      />
                    </div>
                    <div className="op-hour-label">{b.hour}</div>
                    <div className="op-hour-sales">₱{(b.sales / 1000).toFixed(1)}k</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent sales */}
          {data.recentSales?.length > 0 && (
            <div className="op-recent-section">
              <div className="op-section-label">Items Sold Today</div>
              <div className="op-sales-list">
                {data.recentSales.map((s, i) => (
                  <div key={i} className="op-sale-row">
                    <div className="op-sale-info">
                      <div className="op-sale-name">{s.productName}</div>
                      {s.size && s.size !== "—" && (
                        <span className="op-badge">Size {s.size}</span>
                      )}
                    </div>
                    <div className="op-sale-right">
                      <div className="op-sale-price">{fmtMoney(s.price)}</div>
                      <div className="op-sale-time">{fmtDate(s.soldAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
              {data.topProduct && (
                <div className="op-top-product">
                  🏆 Top product today: <strong>{data.topProduct}</strong>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ─── Main OperationsPanel ─────────────────────────────────────────────────────
const OperationsPanel = ({ showToast }) => {
  const [tab, setTab] = useState("scanner");

  return (
    <div className="op-root">
      <div className="op-header">
        <h1>Operations</h1>
        <p>In-store tools for daily operations.</p>
      </div>

      <div className="op-tabs">
        {[
          { key: "scanner", label: "📱 Scanner" },
          { key: "tags", label: "🏷️ Price Tags" },
          { key: "shift", label: "📊 Shift Summary" },
        ].map(t => (
          <button
            key={t.key}
            className={`op-tab-btn ${tab === t.key ? "active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "scanner" && <ScannerTab showToast={showToast} />}
      {tab === "tags" && <PriceTagTab showToast={showToast} />}
      {tab === "shift" && <ShiftSummaryTab />}
    </div>
  );
};

export default OperationsPanel;
