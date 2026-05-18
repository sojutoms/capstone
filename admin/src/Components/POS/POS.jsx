import React, { useState, useEffect, useRef } from "react";
import "./POS.css";
import { authorizedFetch } from "../../services/api";

const SIMPLE_CATEGORIES = ["bags", "collectibles"];

const fmt = (n) =>
  `₱${Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const getSizePrice = (product, size) => {
  if (!size || SIMPLE_CATEGORIES.includes((product.category || "").toLowerCase())) {
    return Number(product.price || product.new_price || 0);
  }
  const sz = product.sizes;
  if (!sz) return Number(product.price || 0);
  if (Array.isArray(sz)) {
    const e = sz.find((s) => String(s.size) === String(size));
    return e ? Number(e.price || 0) : Number(product.price || 0);
  }
  const e = sz[String(size)];
  if (!e) return Number(product.price || 0);
  return typeof e === "object" ? Number(e.price || 0) : Number(product.price || 0);
};

const getSizeStock = (product, size) => {
  if (SIMPLE_CATEGORIES.includes((product.category || "").toLowerCase())) {
    return Number(product.stock || 0);
  }
  const sz = product.sizes;
  if (!sz) return 0;
  if (Array.isArray(sz)) {
    const e = sz.find((s) => String(s.size) === String(size));
    return e ? Number(e.quantity || 0) : 0;
  }
  const e = sz[String(size)];
  if (!e) return 0;
  return typeof e === "object" ? Number(e.quantity || 0) : Number(e || 0);
};

const getAvailableSizes = (product) => {
  const isSimple = SIMPLE_CATEGORIES.includes((product.category || "").toLowerCase());
  if (isSimple) return [];
  const sz = product.sizes;
  if (!sz) return [];
  if (Array.isArray(sz)) return sz.filter((s) => Number(s.quantity) > 0).map((s) => String(s.size));
  return Object.entries(sz)
    .filter(([, v]) => {
      const q = typeof v === "object" ? v.quantity : v;
      return Number(q) > 0;
    })
    .map(([k]) => k);
};

const getLowestPrice = (product) => {
  const isSimple = SIMPLE_CATEGORIES.includes((product.category || "").toLowerCase());
  if (isSimple) return Number(product.price || 0);
  const sz = product.sizes;
  if (!sz) return Number(product.price || 0);
  const prices = Array.isArray(sz)
    ? sz.filter((s) => Number(s.quantity) > 0).map((s) => Number(s.price || 0))
    : Object.entries(sz)
        .filter(([, v]) => Number(typeof v === "object" ? v.quantity : v) > 0)
        .map(([, v]) => Number(typeof v === "object" ? v.price : 0));
  const valid = prices.filter((p) => p > 0);
  return valid.length > 0 ? Math.min(...valid) : Number(product.price || 0);
};

// ─── Payment Methods ─────────────────────────────────────────────────────────
const PAYMENT_METHODS = [
  { id: "cash",   label: "Cash",    icon: "💵" },
  { id: "card",   label: "Card",    icon: "💳" },
  { id: "gcash",  label: "GCash",   icon: "📱" },
  { id: "maya",   label: "Maya",    icon: "🏦" },
];

// ─── Size Picker Modal ────────────────────────────────────────────────────────
const SizePickerModal = ({ product, cart, onConfirm, onClose }) => {
  const sizes = getAvailableSizes(product);
  const [selected, setSelected] = useState("");

  return (
    <div className="pos-overlay" onClick={onClose}>
      <div className="pos-modal pos-size-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pos-modal-header">
          <div className="pos-modal-title">Select Size</div>
          <button className="pos-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="pos-size-product">
          <img src={product.image} alt={product.name} className="pos-size-img" />
          <div>
            <div className="pos-size-name">{product.name}</div>
            <div className="pos-size-brand">{product.brand || product.category}</div>
          </div>
        </div>
        <div className="pos-size-grid">
          {sizes.map((sz) => {
            const price = getSizePrice(product, sz);
            const stock = getSizeStock(product, sz);
            const inCart = cart.find((i) => i.key === `${product.id}_${sz}`)?.qty || 0;
            const available = Math.max(0, stock - inCart);
            return (
              <button
                key={sz}
                className={`pos-size-btn ${selected === sz ? "active" : ""} ${available <= 0 ? "oos" : ""}`}
                onClick={() => available > 0 && setSelected(sz)}
                disabled={available <= 0}
              >
                <span className="pos-size-val">{sz}</span>
                <span className="pos-size-price">{fmt(price)}</span>
                <span className="pos-size-stock">{available} left</span>
              </button>
            );
          })}
        </div>
        <button
          className="pos-confirm-btn"
          disabled={!selected}
          onClick={() => selected && onConfirm(product, selected)}
        >
          Add to Order
        </button>
      </div>
    </div>
  );
};

// ─── Payment Modal ────────────────────────────────────────────────────────────
const PaymentModal = ({ cart, subtotal, onClose, onComplete }) => {
  const [method, setMethod] = useState("cash");
  const [cashInput, setCashInput] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);

  const cashAmount = parseFloat(cashInput.replace(/,/g, "")) || 0;
  const change = method === "cash" ? Math.max(0, cashAmount - subtotal) : 0;
  const canProcess = method !== "cash" || cashAmount >= subtotal;

  const handleProcess = async () => {
    setProcessing(true);
    setError(null);
    try {
      await onComplete({ method, cashAmount, change, subtotal });
    } catch (err) {
      setError(err.message || "Sale failed. Please try again.");
      setProcessing(false);
    }
  };

  return (
    <div className="pos-overlay" onClick={onClose}>
      <div className="pos-modal pos-payment-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pos-modal-header">
          <div className="pos-modal-title">Process Payment</div>
          <button className="pos-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="pos-payment-summary">
          <div className="pos-payment-total-label">Total Due</div>
          <div className="pos-payment-total-value">{fmt(subtotal)}</div>
        </div>

        <div className="pos-method-label">Payment Method</div>
        <div className="pos-method-grid">
          {PAYMENT_METHODS.map((m) => (
            <button
              key={m.id}
              className={`pos-method-btn ${method === m.id ? "active" : ""}`}
              onClick={() => setMethod(m.id)}
            >
              <span className="pos-method-icon">{m.icon}</span>
              <span>{m.label}</span>
              {m.id !== "cash" && <span className="pos-placeholder-badge">Placeholder</span>}
            </button>
          ))}
        </div>

        {method === "cash" && (
          <div className="pos-cash-section">
            <label className="pos-cash-label">Cash Tendered</label>
            <div className="pos-cash-input-wrap">
              <span className="pos-cash-symbol">₱</span>
              <input
                type="number"
                className="pos-cash-input"
                placeholder="0.00"
                value={cashInput}
                onChange={(e) => setCashInput(e.target.value)}
                min={subtotal}
                autoFocus
              />
            </div>
            <div className="pos-quick-cash">
              {[subtotal, Math.ceil(subtotal / 100) * 100, Math.ceil(subtotal / 500) * 500, Math.ceil(subtotal / 1000) * 1000]
                .filter((v, i, arr) => arr.indexOf(v) === i)
                .slice(0, 4)
                .map((v) => (
                  <button key={v} className="pos-quick-btn" onClick={() => setCashInput(String(v))}>
                    ₱{Number(v).toLocaleString()}
                  </button>
                ))}
            </div>
            {cashAmount >= subtotal && (
              <div className="pos-change-row">
                <span>Change</span>
                <span className="pos-change-val">{fmt(change)}</span>
              </div>
            )}
          </div>
        )}

        {method !== "cash" && (
          <div className="pos-placeholder-notice">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {PAYMENT_METHODS.find((m) => m.id === method)?.label} payment is a placeholder. No real transaction will occur.
          </div>
        )}

        {error && <div className="pos-payment-error">{error}</div>}

        <button
          className={`pos-process-btn ${!canProcess || processing ? "disabled" : ""}`}
          onClick={handleProcess}
          disabled={!canProcess || processing}
        >
          {processing ? (
            <span className="pos-processing">
              <span className="pos-spinner" />
              Processing…
            </span>
          ) : `Confirm Payment · ${fmt(subtotal)}`}
        </button>
      </div>
    </div>
  );
};

// ─── Receipt Modal ────────────────────────────────────────────────────────────
const ReceiptModal = ({ receipt, onClose }) => {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
  const timeStr = now.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" });
  const receiptNo = receipt.orderNumber || `POS-${Date.now().toString().slice(-8)}`;

  return (
    <div className="pos-overlay" onClick={onClose}>
      <div className="pos-modal pos-receipt-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pos-receipt-header">
          <div className="pos-receipt-logo">GOODSOLES</div>
          <div className="pos-receipt-sub">Point of Sale Receipt</div>
          <div className="pos-receipt-meta">{dateStr} · {timeStr}</div>
          <div className="pos-receipt-no">#{receiptNo}</div>
        </div>

        <div className="pos-receipt-divider">- - - - - - - - - - - - - - - - - - - -</div>

        <div className="pos-receipt-items">
          {receipt.cart.map((item, i) => (
            <div key={i} className="pos-receipt-item">
              <div className="pos-receipt-item-name">
                {item.name}
                {item.size && <span className="pos-receipt-size"> · {item.size}</span>}
              </div>
              <div className="pos-receipt-item-row">
                <span className="pos-receipt-qty">{item.qty} × {fmt(item.unitPrice)}</span>
                <span className="pos-receipt-line">{fmt(item.qty * item.unitPrice)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="pos-receipt-divider">- - - - - - - - - - - - - - - - - - - -</div>

        <div className="pos-receipt-totals">
          <div className="pos-receipt-row"><span>Subtotal</span><span>{fmt(receipt.subtotal)}</span></div>
          <div className="pos-receipt-row bold"><span>Total</span><span>{fmt(receipt.subtotal)}</span></div>
          <div className="pos-receipt-row"><span>Payment ({PAYMENT_METHODS.find(m => m.id === receipt.method)?.label})</span><span>{receipt.method === "cash" ? fmt(receipt.cashAmount) : fmt(receipt.subtotal)}</span></div>
          {receipt.method === "cash" && receipt.change > 0 && (
            <div className="pos-receipt-row change"><span>Change</span><span>{fmt(receipt.change)}</span></div>
          )}
        </div>

        <div className="pos-receipt-divider">- - - - - - - - - - - - - - - - - - - -</div>

        <div className="pos-receipt-footer">
          <div className="pos-receipt-thanks">Thank you for your purchase!</div>
          <div className="pos-receipt-note">This is a POS placeholder receipt.</div>
        </div>

        <div className="pos-receipt-actions">
          <button className="pos-new-sale-btn" onClick={onClose}>New Sale</button>
        </div>
      </div>
    </div>
  );
};

// ─── POS Main ─────────────────────────────────────────────────────────────────
const POS = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [categories, setCategories] = useState([]);

  const [cart, setCart] = useState([]);
  const [sizePicker, setSizePicker] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const [receipt, setReceipt] = useState(null);

  const searchRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      authorizedFetch("/allproducts").then((r) => r.json()),
      authorizedFetch("/categories").then((r) => r.json()),
    ])
      .then(([prods, catData]) => {
        setProducts(Array.isArray(prods) ? prods.filter((p) => !p.isDeleted) : []);
        if (catData.success) setCategories(catData.categories || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = products.filter((p) => {
    const q = search.toLowerCase();
    const matchQ = !q || p.name?.toLowerCase().includes(q) || String(p.id).includes(q) || (p.brand || "").toLowerCase().includes(q);
    const matchC = categoryFilter === "all" || (p.category || "").toLowerCase() === categoryFilter;
    return matchQ && matchC;
  });

  const subtotal = cart.reduce((s, item) => s + item.unitPrice * item.qty, 0);
  const totalItems = cart.reduce((s, item) => s + item.qty, 0);

  const addToCart = (product, size = null) => {
    const isSimple = SIMPLE_CATEGORIES.includes((product.category || "").toLowerCase());
    const unitPrice = getSizePrice(product, size);
    const key = `${product.id}_${size || ""}`;
    const maxStock = isSimple
      ? Number(product.stock || 0)
      : getSizeStock(product, size);

    setCart((prev) => {
      const existing = prev.find((i) => i.key === key);
      if (existing) {
        if (existing.qty >= maxStock) return prev; // already at stock limit
        return prev.map((i) => i.key === key ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { key, productId: product.id, name: product.name, image: product.image, size, unitPrice, qty: 1, maxStock, category: product.category }];
    });
    setSizePicker(null);
  };

  const handleProductClick = (product) => {
    const isSimple = SIMPLE_CATEGORIES.includes((product.category || "").toLowerCase());
    if (isSimple) { addToCart(product, null); return; }
    const sizes = getAvailableSizes(product);
    if (sizes.length === 0) return;
    if (sizes.length === 1) { addToCart(product, sizes[0]); return; }
    setSizePicker(product);
  };

  const updateQty = (key, delta) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.key !== key) return i;
          if (delta > 0 && i.qty >= (i.maxStock ?? Infinity)) return i; // capped at stock
          return { ...i, qty: i.qty + delta };
        })
        .filter((i) => i.qty > 0)
    );
  };

  const removeItem = (key) => setCart((prev) => prev.filter((i) => i.key !== key));

  const handlePaymentComplete = async (paymentInfo) => {
    const saleItems = cart.map((item) => ({
      productId: item.productId,
      size: item.size,
      qty: item.qty,
      unitPrice: item.unitPrice,
    }));

    const res = await authorizedFetch("/admin/pos/sale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: saleItems,
        paymentMethod: paymentInfo.method,
        total: paymentInfo.subtotal,
      }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "Sale failed");

    const cartSnapshot = [...cart];
    setCart([]);
    setShowPayment(false);
    setReceipt({ cart: cartSnapshot, ...paymentInfo, orderNumber: data.orderNumber });
  };

  const handleReceiptClose = () => setReceipt(null);

  return (
    <div className="pos-root">
      {/* ── Left: Product Browser ─── */}
      <div className="pos-left">
        <div className="pos-left-header">
          <h1 className="pos-title chrome-text">POINT OF SALE</h1>
          <div className="pos-search-bar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
            </svg>
            <input
              ref={searchRef}
              type="text"
              placeholder="Search product or SKU…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pos-search-input"
            />
            {search && <button className="pos-search-clear" onClick={() => setSearch("")}>✕</button>}
          </div>
          <div className="pos-cat-tabs">
            <button className={`pos-cat-btn ${categoryFilter === "all" ? "active" : ""}`} onClick={() => setCategoryFilter("all")}>All</button>
            {categories.map((c) => (
              <button key={c.slug} className={`pos-cat-btn ${categoryFilter === c.slug ? "active" : ""}`} onClick={() => setCategoryFilter(c.slug)}>
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="pos-loading">Loading products…</div>
        ) : (
          <div className="pos-product-grid">
            {filtered.length === 0 && <div className="pos-no-results">No products found</div>}
            {filtered.map((p) => {
              const isSimple = SIMPLE_CATEGORIES.includes((p.category || "").toLowerCase());
              const price = getLowestPrice(p);
              const inCart = cart.filter((i) => i.productId === p.id).reduce((s, i) => s + i.qty, 0);
              const sizes = getAvailableSizes(p);
              const outOfStock = !isSimple && sizes.length === 0;
              return (
                <button
                  key={p.id}
                  className={`pos-product-card ${outOfStock ? "oos" : ""} ${inCart > 0 ? "in-cart" : ""}`}
                  onClick={() => !outOfStock && handleProductClick(p)}
                  disabled={outOfStock}
                >
                  {inCart > 0 && <span className="pos-in-cart-badge">{inCart}</span>}
                  <div className="pos-product-img-wrap">
                    <img src={p.image} alt={p.name} className="pos-product-img" />
                    {outOfStock && <div className="pos-oos-overlay">Out of Stock</div>}
                  </div>
                  <div className="pos-product-info">
                    <div className="pos-product-name">{p.name}</div>
                    <div className="pos-product-meta">
                      {p.brand && <span className="pos-product-brand">{p.brand}</span>}
                      <span className="pos-product-price">{price > 0 ? fmt(price) : "—"}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Right: Order Panel ─── */}
      <div className="pos-right">
        <div className="pos-order-header">
          <div className="pos-order-title">Current Order</div>
          {cart.length > 0 && (
            <button className="pos-clear-btn" onClick={() => setCart([])}>Clear All</button>
          )}
        </div>

        <div className="pos-cart-list">
          {cart.length === 0 ? (
            <div className="pos-cart-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              <p>No items added yet</p>
              <p className="pos-cart-empty-sub">Tap a product to add it to the order</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.key} className="pos-cart-item">
                <img src={item.image} alt={item.name} className="pos-cart-img" />
                <div className="pos-cart-info">
                  <div className="pos-cart-name">{item.name}</div>
                  {item.size && <div className="pos-cart-size">Size {item.size}</div>}
                  <div className="pos-cart-price">{fmt(item.unitPrice)}</div>
                </div>
                <div className="pos-cart-controls">
                  <button className="pos-qty-btn" onClick={() => updateQty(item.key, -1)}>−</button>
                  <span className="pos-qty-val">{item.qty}</span>
                  <button className="pos-qty-btn" onClick={() => updateQty(item.key, 1)}>+</button>
                  <button className="pos-remove-btn" onClick={() => removeItem(item.key)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" />
                    </svg>
                  </button>
                </div>
                <div className="pos-cart-line">{fmt(item.qty * item.unitPrice)}</div>
              </div>
            ))
          )}
        </div>

        {cart.length > 0 && (
          <div className="pos-order-footer">
            <div className="pos-totals">
              <div className="pos-total-row"><span>Items</span><span>{totalItems}</span></div>
              <div className="pos-total-row subtotal"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
            </div>
            <button className="pos-pay-btn" onClick={() => setShowPayment(true)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" />
              </svg>
              Process Payment · {fmt(subtotal)}
            </button>
          </div>
        )}
      </div>

      {/* ── Modals ─── */}
      {sizePicker && (
        <SizePickerModal
          product={sizePicker}
          cart={cart}
          onConfirm={(product, size) => addToCart(product, size)}
          onClose={() => setSizePicker(null)}
        />
      )}

      {showPayment && (
        <PaymentModal
          cart={cart}
          subtotal={subtotal}
          onClose={() => setShowPayment(false)}
          onComplete={handlePaymentComplete}
        />
      )}

      {receipt && (
        <ReceiptModal receipt={receipt} onClose={handleReceiptClose} />
      )}
    </div>
  );
};

export default POS;
