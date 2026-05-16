import React, { useEffect, useState, useMemo, useCallback } from "react";
import "./SKUviewer.css";
import API_BASE_URL, { authorizedFetch } from "../../services/api";

const SIMPLE_CATEGORIES = ["watch", "bags", "collectibles"];

// ─── Luxe Select Component ───────────────────────────────────────────────────
const LuxeSelect = ({ value, options, onChange, placeholder = "Select option", style }) => {
  const [open, setOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const rootRef = React.useRef(null);

  useEffect(() => {
    const handleClick = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const toggle = () => {
    if (!open && rootRef.current) {
      const rect = rootRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setOpenUp(spaceBelow < 300);
    }
    setOpen(!open);
  };

  const selectedOption = options.find(o => String(o.value) === String(value)) || options[0];

  return (
    <div className={`luxe-select-root ${open ? 'open' : ''} ${openUp ? 'up' : ''}`} ref={rootRef} style={{ minWidth: '160px', ...style }}>
      <div className="luxe-select-trigger" onClick={toggle}>
        {selectedOption ? selectedOption.label.toUpperCase() : placeholder.toUpperCase()}
      </div>
      {open && (
        <div className="luxe-select-dropdown">
          {options.map((opt) => (
            <div
              key={opt.value}
              className={`luxe-select-option ${String(value) === String(opt.value) ? 'selected' : ''}`}
              onClick={() => { onChange(opt.value); setOpen(false); }}
            >
              {opt.label.toUpperCase()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── SKUViewer ────────────────────────────────────────────────────────────────
const SKUViewer = () => {
  const [allSequences, setAllSequences] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterBrand, setFilterBrand] = useState("all");
  const [page, setPage] = useState(1);
  const itemsPerPage = 12;

  const [selectedSkuGroup, setSelectedSkuGroup] = useState(null);
  const [showProductIds, setShowProductIds] = useState(false);
  const [productIdsData, setProductIdsData] = useState(null);
  const [pidSearch, setPidSearch] = useState("");
  const [pidFilterSize, setPidFilterSize] = useState("all");
  const [pidFilterStatus, setPidFilterStatus] = useState("all");
  const [pidSort, setPidSort] = useState({ key: "productItemId", dir: "asc" });
  const [pidPage, setPidPage] = useState(1);
  const pidPerPage = 15;

  const [selectedUnit, setSelectedUnit] = useState(null);

  const [showSummaryTable, setShowSummaryTable] = useState(false);
  const [summaryFilter, setSummaryFilter] = useState("all");

  const [toasts, setToasts] = useState([]);
  const toastRef = React.useRef(0);
  const addToast = useCallback((message, type = "success") => {
    const id = ++toastRef.current;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const [confirm, setConfirm] = useState({ open: false, message: "", onConfirm: null });
  const showConfirm = (msg, fn) => setConfirm({ open: true, message: msg, onConfirm: fn });
  const dismissConfirm = () => setConfirm({ open: false, message: "", onConfirm: null });

  const adminRoles = JSON.parse(sessionStorage.getItem("admin-roles") || "[]");
  const isOwner = adminRoles.includes("owner");
  const isAdmin = adminRoles.includes("admin");
  const isInventoryStaff = adminRoles.includes("inventory_staff");
  const canModify = isOwner || isAdmin || isInventoryStaff;

  const getAdminToken = () => sessionStorage.getItem("admin-token") || "";

  // ── Helpers ──────────────────────────────────────────────────────────────
  const productMap = useMemo(() => {
    const m = {};
    products.forEach((p) => { m[String(p.id)] = p; });
    return m;
  }, [products]);

  const getBrand = useCallback((seq) => {
    if (seq.brand) return seq.brand;
    return productMap[String(seq.productId)]?.brand || "";
  }, [productMap]);

  const getSkuNumber = (seq) => seq.skuNumber || seq.productId || "—";
  const getProductItemId = (seq) => seq.productItemId || seq.sequenceNumber || "—";

  const getUnitPrice = useCallback((seq) => {
    if (!seq) return 0;
    if (seq.productPrice && Number(seq.productPrice) > 0) return Number(seq.productPrice);
    if (seq.price && Number(seq.price) > 0) return Number(seq.price);
    const p = productMap[String(seq.productId)];
    return Number(p?.new_price || p?.price || 0);
  }, [productMap]);

  const formatPrice = (n) => {
    if (!n || Number(n) === 0) return "—";
    return Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }) : "—";

  const normalizeSizes = (sizes = [], fallbackPrice = 0) => {
    const out = {};
    if (Array.isArray(sizes)) {
      sizes.forEach((e) => { if (e?.size) out[e.size] = { quantity: Number(e.quantity || 0), price: Number(e.price ?? fallbackPrice) }; });
      return out;
    }
    for (const [k, v] of Object.entries(sizes || {})) {
      if (!v) continue;
      out[k] = { quantity: Number(v.quantity || 0), price: Number(v.price ?? fallbackPrice) };
    }
    return out;
  };

  const computeAvgPrice = (p) => {
    const sz = normalizeSizes(p.sizes || {}, p.new_price || 0);
    const entries = Object.values(sz).filter((s) => s.price !== undefined);
    if (!entries.length) return p.new_price || p.price || 0;
    return entries.reduce((a, e) => a + Number(e.price || 0), 0) / entries.length;
  };

  const isSimpleCat = (cat) => SIMPLE_CATEGORIES.includes((cat || "").toLowerCase());

  const getPriceRange = (seqs) => {
    const prices = seqs.map((s) => getUnitPrice(s)).filter((p) => p > 0);
    if (!prices.length) return "—";
    const mn = Math.min(...prices);
    const mx = Math.max(...prices);
    if (mn === mx) return `₱${formatPrice(mn)}`;
    return `₱${formatPrice(mn)} – ₱${formatPrice(mx)}`;
  };

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchSequences = useCallback(async () => {
    try { setAllSequences(await authorizedFetch("/allsequences").then((r) => r.json()).then((d) => Array.isArray(d) ? d : [])); }
    catch { setAllSequences([]); }
  }, []);

  const fetchProducts = useCallback(async () => {
    try { setProducts(await authorizedFetch("/allproducts").then((r) => r.json()).then((d) => Array.isArray(d) ? d.filter((p) => !p.isDeleted) : [])); }
    catch { setProducts([]); }
  }, []);

  const fetchMeta = useCallback(async () => {
    try {
      const [catData, brandData] = await Promise.all([
        authorizedFetch("/categories").then((r) => r.json()),
        authorizedFetch("/brands").then((r) => r.json()),
      ]);
      if (catData.success) setCategories(catData.categories || []);
      if (brandData.success) setBrands(brandData.brands || []);
    } catch { }
  }, []);

  useEffect(() => { fetchSequences(); fetchProducts(); fetchMeta(); }, [fetchSequences, fetchProducts, fetchMeta]);

  useEffect(() => {
    const handler = async () => { await fetchSequences(); await fetchProducts(); };
    window.addEventListener("skus-updated", handler);
    window.addEventListener("stock-updated", handler);
    return () => { window.removeEventListener("skus-updated", handler); window.removeEventListener("stock-updated", handler); };
  }, [fetchSequences, fetchProducts]);

  // ── Mark sold ─────────────────────────────────────────────────────────────
  const markAsSold = async (seq) => {
    showConfirm(`Mark Product ID #${getProductItemId(seq)} as sold?`, async () => {
      dismissConfirm();
      const sequenceId = seq._id || seq.id;
      if (!sequenceId) { addToast("No sequence ID", "error"); return; }
      try {
        const r = await authorizedFetch("/marksequencesold", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sequenceId }),
        }).then((r) => r.json());
        if (!r.success) { addToast("Failed: " + (r.error || "Unknown"), "error"); return; }
        addToast(`Product ID #${getProductItemId(seq)} marked as sold`);
        setSelectedUnit(null);
        await fetchSequences();
        await fetchProducts();
        window.dispatchEvent(new CustomEvent("saleslog-updated"));
      } catch (e) { addToast("Failed: " + e.message, "error"); }
    });
  };

  // ── Group sequences by product ────────────────────────────────────────────
  const skuGroups = useMemo(() => {
    const groups = {};
    allSequences.forEach((seq) => {
      const key = String(seq.productId);
      if (!groups[key]) groups[key] = [];
      groups[key].push(seq);
    });
    return groups;
  }, [allSequences]);

  const skuSummaries = useMemo(() => {
    return Object.entries(skuGroups).map(([productId, seqs]) => {
      const product = productMap[productId];
      const name = seqs[0]?.productName || product?.name || "—";
      const image = seqs[0]?.productImage || product?.image || "";
      const category = seqs[0]?.category || product?.category || "";
      const brand = getBrand(seqs[0]) || product?.brand || "";
      const skuNum = getSkuNumber(seqs[0]);
      const available = seqs.filter((s) => s.status === "available");
      const sold = seqs.filter((s) => s.status === "sold");
      const availSizes = [...new Set(available.map((s) => s.size).filter((s) => s && s !== "—"))].sort((a, b) => parseFloat(a) - parseFloat(b));
      const priceRange = getPriceRange(seqs);
      const status = available.length > 0 ? "available" : (sold.length > 0 ? "sold" : "available");
      return { productId, skuNum, name, image, category, brand, seqs, available, sold, availSizes, priceRange, status, totalUnits: seqs.length };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skuGroups, productMap, getBrand]);

  // ── Colorway helpers ──────────────────────────────────────────────────────
  // For a given group, find the root parentId and all siblings (colorways).
  // A colorway product has parentId set; the base product has no parentId.
  const getColorwayFamily = useCallback((group) => {
    const product = productMap[String(group.productId)];
    if (!product) return { parent: null, colorways: [] };

    // Determine the root parent id
    const rootParentId = product.parentId ? product.parentId : product.id;

    // Parent product
    const parent = productMap[String(rootParentId)] || null;

    // All child colorway products
    const colorways = products.filter(
      (p) => !p.isDeleted && String(p.parentId) === String(rootParentId)
    );

    return { parent, colorways, rootParentId };
  }, [productMap, products]);

  // Given a productId, find its skuSummary group (for navigating to a colorway's group)
  const findGroupByProductId = useCallback((productId) => {
    return skuSummaries.find((g) => String(g.productId) === String(productId)) || null;
  }, [skuSummaries]);

  // ── Main filter ───────────────────────────────────────────────────────────
  const brandsForFilter = filterCategory === "all" ? brands : brands.filter((b) => b.parentCategory === filterCategory);

  const filteredSummaries = useMemo(() => {
    let list = skuSummaries;

    // IMPORTANT: In the grid, show only BASE products (no parentId) so colorways
    // don't appear as separate cards. Their stock is navigable via the modal swatches.
    list = list.filter((g) => {
      const product = productMap[String(g.productId)];
      return !product?.parentId;
    });

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const isNum = !isNaN(q) && q !== "";
      list = list.filter((g) =>
        isNum
          ? String(g.skuNum) === q
          : g.name.toLowerCase().includes(q) || g.brand.toLowerCase().includes(q) || g.category.toLowerCase().includes(q)
      );
    }
    if (filterStatus !== "all") list = list.filter((g) => filterStatus === "available" ? g.available.length > 0 : g.sold.length > 0);
    if (filterCategory !== "all") list = list.filter((g) => g.category.toLowerCase() === filterCategory.toLowerCase());
    if (filterBrand !== "all") list = list.filter((g) => g.brand.toLowerCase() === filterBrand.toLowerCase());
    return list.sort((a, b) => Number(b.skuNum) - Number(a.skuNum));
  }, [skuSummaries, searchQuery, filterStatus, filterCategory, filterBrand, productMap]);

  const totalPages = Math.max(1, Math.ceil(filteredSummaries.length / itemsPerPage));
  const paginated = filteredSummaries.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalUnits = allSequences.length;
  const availableUnits = allSequences.filter((s) => s.status === "available").length;
  const soldUnits = allSequences.filter((s) => s.status === "sold").length;
  const uniqueSkuCount = Object.keys(skuGroups).length;

  const categoryStats = useMemo(() => {
    const acc = {};
    allSequences.forEach((s) => {
      if (s.status !== "available") return;
      const brand = getBrand(s);
      const key = brand ? `${(s.category || "").toUpperCase()} · ${brand.toUpperCase()}` : (s.category || "unknown").toUpperCase();
      acc[key] = (acc[key] || 0) + 1;
    });
    return acc;
  }, [allSequences, getBrand]);

  // ── Modals ────────────────────────────────────────────────────────────────
  const openSkuModal = (group) => { setSelectedSkuGroup(group); };

  const openProductIds = (group) => {
    setProductIdsData(group);
    setPidSearch(""); setPidFilterSize("all"); setPidFilterStatus("all");
    setPidSort({ key: "productItemId", dir: "asc" }); setPidPage(1);
    setShowProductIds(true);
  };

  // ── Product IDs filter/sort ───────────────────────────────────────────────
  const pidFiltered = useMemo(() => {
    if (!productIdsData) return [];
    let list = productIdsData.seqs.slice();
    if (pidFilterStatus !== "all") list = list.filter((s) => s.status === pidFilterStatus);
    if (pidFilterSize !== "all") list = list.filter((s) => String(s.size) === pidFilterSize);
    if (pidSearch.trim()) {
      const q = pidSearch.trim().toLowerCase();
      list = list.filter((s) =>
        String(getProductItemId(s)).includes(q) ||
        (s.size || "").toLowerCase().includes(q) ||
        String(getUnitPrice(s)).includes(q) ||
        (s.consignedBy || "").toLowerCase().includes(q) ||
        (s.soldBy || "").toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      const dir = pidSort.dir === "asc" ? 1 : -1;
      if (pidSort.key === "productItemId") return (Number(getProductItemId(a)) - Number(getProductItemId(b))) * dir;
      if (pidSort.key === "size") return ((parseFloat(a.size) || 0) - (parseFloat(b.size) || 0)) * dir;
      if (pidSort.key === "price") return (getUnitPrice(a) - getUnitPrice(b)) * dir;
      if (pidSort.key === "addedDate") return ((a.addedDate ? new Date(a.addedDate).getTime() : 0) - (b.addedDate ? new Date(b.addedDate).getTime() : 0)) * dir;
      if (pidSort.key === "soldDate") return ((a.soldDate ? new Date(a.soldDate).getTime() : 0) - (b.soldDate ? new Date(b.soldDate).getTime() : 0)) * dir;
      if (pidSort.key === "consignedBy") return ((a.consignedBy || "").localeCompare(b.consignedBy || "")) * dir;
      if (pidSort.key === "soldBy") return ((a.soldBy || "").localeCompare(b.soldBy || "")) * dir;
      return 0;
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productIdsData, pidSearch, pidFilterStatus, pidFilterSize, pidSort]);

  const pidTotalPages = Math.max(1, Math.ceil(pidFiltered.length / pidPerPage));
  const pidPaginated = pidFiltered.slice((pidPage - 1) * pidPerPage, pidPage * pidPerPage);

  const togglePidSort = (key) => { setPidPage(1); setPidSort((prev) => prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }); };
  const pidSortInd = (key) => pidSort.key !== key ? "↕" : pidSort.dir === "asc" ? "↑" : "↓";

  // ── Summary table ─────────────────────────────────────────────────────────
  const summaryOptions = useMemo(() => {
    const set = new Set();
    products.forEach((p) => { if (p.category) set.add(p.category.toLowerCase()); });
    return ["all", ...Array.from(set)];
  }, [products]);

  const productStockSummaries = useMemo(() => {
    const list = products.filter((p) => summaryFilter === "all" || (p.category || "").toLowerCase() === summaryFilter);
    return list.map((p) => {
      const sz = normalizeSizes(p.sizes || {}, 0);
      const isSimple = isSimpleCat(p.category);
      const total = isSimple
        ? Number(p.stock || 0) || Object.values(sz).reduce((s, o) => s + o.quantity, 0)
        : Object.values(sz).reduce((s, o) => s + o.quantity, 0);
      const lowSizes = isSimple ? {} : Object.fromEntries(Object.entries(sz).filter(([, o]) => o.quantity > 0 && o.quantity <= 3));
      const outSizes = isSimple ? {} : Object.fromEntries(Object.entries(sz).filter(([, o]) => o.quantity === 0));
      return { id: p.id, skuNum: p.id, name: p.name, category: p.category, brand: p.brand || "", total, lowSizes, outSizes, avgPrice: computeAvgPrice(p) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, summaryFilter]);

  // ── Badge helpers ─────────────────────────────────────────────────────────
  const ConsignedByBadge = ({ email }) => {
    if (!email) return <span style={{ color: "#666", fontSize: 11 }}>—</span>;
    return (
      <span style={{ display: "inline-block", background: "rgba(34, 197, 94, 0.1)", color: "#4ade80", border: "1px solid rgba(34, 197, 94, 0.2)", borderRadius: 5, padding: "1px 7px", fontSize: 11, fontWeight: 600, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={email}>{email}</span>
    );
  };

  const SoldByBadge = ({ email }) => {
    if (!email) return <span style={{ color: "#666", fontSize: 11 }}>—</span>;
    return (
      <span style={{ display: "inline-block", background: "rgba(59, 130, 246, 0.1)", color: "#60a5fa", border: "1px solid rgba(59, 130, 246, 0.2)", borderRadius: 5, padding: "1px 7px", fontSize: 11, fontWeight: 600, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={email}>{email}</span>
    );
  };

  const pidColCount = (cat) => isSimpleCat(cat) ? 7 : 8;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="sku-viewer">

      {/* ── Toasts ── */}
      <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 3000, display: "flex", flexDirection: "column", gap: 8 }}>
        {toasts.map((t) => (
          <div key={t.id} style={{ background: t.type === "error" ? "rgba(239, 68, 68, 0.1)" : "rgba(34, 197, 94, 0.1)", border: `1px solid ${t.type === "error" ? "rgba(239, 68, 68, 0.2)" : "rgba(34, 197, 94, 0.2)"}`, color: t.type === "error" ? "#f87171" : "#4ade80", padding: "12px 16px", borderRadius: 8, fontSize: 13, boxShadow: "0 2px 8px rgba(0,0,0,.12)", maxWidth: 340 }}>
            {t.message}
          </div>
        ))}
      </div>

      {/* ── Confirm modal ── */}
      {confirm.open && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 2500, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={dismissConfirm}>
          <div style={{ background: "#1a1a1a", borderRadius: 12, padding: "28px 32px", maxWidth: 420, width: "90%", boxShadow: "0 8px 32px rgba(0,0,0,.2)" }} onClick={(e) => e.stopPropagation()}>
            <p style={{ fontSize: 15, color: "#e0e0e0", margin: "0 0 20px", lineHeight: 1.5 }}>{confirm.message}</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={dismissConfirm} style={{ padding: "9px 18px", borderRadius: 6, border: "none", background: "rgba(255,255,255,0.08)", color: "#f5f5f5", cursor: "pointer", fontWeight: 600 }}>Cancel</button>
              <button onClick={confirm.onConfirm} style={{ padding: "9px 18px", borderRadius: 6, border: "none", background: "#f87171", color: "#fff", cursor: "pointer", fontWeight: 600 }}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="sku-header animate-in">
        <h1 className="chrome-text">SKU VIEWER</h1>
        <div className="header-buttons">
          <button className="page-btn" onClick={() => { fetchSequences(); fetchProducts(); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 8 }}><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.85.83 6.72 2.24L21 8M21 3v5h-5"/></svg>
            REFRESH
          </button>
          <button className={`page-btn ${showSummaryTable ? "active" : ""}`} onClick={() => setShowSummaryTable((s) => !s)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 8 }}><path d="M3 3v18h18M18 17V9M13 17V5M8 17v-3"/></svg>
            STOCK SUMMARY
          </button>
        </div>
      </div>

      <div className="sku-stats animate-in">
        <div className="stat-box glass-medium">
          <span className="stat-label">UNIQUE MODELS</span>
          <span className="stat-value">{uniqueSkuCount}</span>
          <span className="stat-sub">Across all categories</span>
        </div>
        <div className="stat-box glass-medium">
          <span className="stat-label">AVAILABLE UNITS</span>
          <span className="stat-value available">{availableUnits}</span>
          <span className="stat-sub">Ready for sale</span>
        </div>
        <div className="stat-box glass-medium">
          <span className="stat-label">SOLD UNITS</span>
          <span className="stat-value sold">{soldUnits}</span>
          <span className="stat-sub">Revenue generated</span>
        </div>
        <div className="stat-box glass-medium">
          <span className="stat-label">TOTAL INVENTORY</span>
          <span className="stat-value">{totalUnits}</span>
          <span className="stat-sub">Lifetime units managed</span>
        </div>
      </div>

      {/* ── Stock Summary Table ── */}
      {showSummaryTable && (
        <div className="summary-table-wrapper glass-strong animate-in">
          <div className="summary-table-header">
            <h3 className="chrome-text" style={{ fontSize: '20px' }}>INVENTORY HEALTH REPORT</h3>
            <div className="summary-controls">
              <LuxeSelect 
                value={summaryFilter} 
                onChange={setSummaryFilter} 
                options={summaryOptions.map((b) => ({ value: b, label: b === "all" ? "ALL CATEGORIES" : b.toUpperCase() }))} 
              />
              <button className="page-btn" onClick={() => setShowSummaryTable(false)}>CLOSE</button>
            </div>
          </div>
          <div className="summary-table-scroll">
            <table className="summary-table">
              <thead>
                <tr>
                  <th>MASTER SKU</th>
                  <th>BRAND / CATEGORY</th>
                  <th>PRODUCT IDENTITY</th>
                  <th>STOCK LEVEL</th>
                  <th>ALERTS (SIZES)</th>
                  <th>VALUATION</th>
                </tr>
              </thead>
              <tbody>
                {productStockSummaries.length === 0 && (
                  <tr><td colSpan="6" style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>NO INVENTORY DATA AVAILABLE</td></tr>
                )}
                {productStockSummaries.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 800, color: "var(--accent-white)" }}>#{p.skuNum}</td>
                    <td className="summary-brand">
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>{(p.category || "—").toUpperCase()}</span>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>{p.brand ? p.brand.toUpperCase() : "HOUSE"}</span>
                      </div>
                    </td>
                    <td className="summary-product">
                      <button className="summary-product-link" onClick={() => {
                        const group = skuSummaries.find((g) => String(g.productId) === String(p.id));
                        if (group) openSkuModal(group);
                      }}>
                        {p.name?.toUpperCase() || "—"}
                      </button>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: '16px', fontWeight: 800 }}>{p.total}</span>
                        <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>UNITS</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 12, flexDirection: 'column' }}>
                        {Object.keys(p.lowSizes).length > 0 && (
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <span className="low-stock" style={{ fontSize: '9px', fontWeight: 800 }}>LOW:</span>
                            <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{Object.keys(p.lowSizes).join(", ")}</span>
                          </div>
                        )}
                        {Object.keys(p.outSizes).length > 0 && (
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <span className="out-stock" style={{ fontSize: '9px', fontWeight: 800 }}>OUT:</span>
                            <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{Object.keys(p.outSizes).join(", ")}</span>
                          </div>
                        )}
                        {Object.keys(p.lowSizes).length === 0 && Object.keys(p.outSizes).length === 0 && (
                          <span style={{ color: '#4ade80', fontSize: '10px', fontWeight: 800 }}>✅ HEALTHY</span>
                        )}
                      </div>
                    </td>
                    <td style={{ fontWeight: 700, color: '#fff' }}>₱{formatPrice(p.avgPrice)} <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: 400 }}>AVG</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Filters ── */}
      <div className="sku-controls animate-in glass">
        <div className="search-wrapper-luxe">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="search-icon"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input type="text" placeholder="Search SKU, Product, or Brand..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }} className="search-input-luxe" />
        </div>
        <div className="filter-group">
          <LuxeSelect 
            value={filterCategory} 
            onChange={(val) => { setFilterCategory(val); setFilterBrand("all"); setPage(1); }}
            options={[
              { value: "all", label: "ALL CATEGORIES" },
              ...categories.map(cat => ({ value: cat.slug, label: cat.name.toUpperCase() }))
            ]}
          />
          {brandsForFilter.length > 0 && (
            <LuxeSelect 
              value={filterBrand} 
              onChange={(val) => { setFilterBrand(val); setPage(1); }}
              options={[
                { value: "all", label: "ALL BRANDS" },
                ...brandsForFilter.map(b => ({ value: b.slug, label: b.name.toUpperCase() }))
              ]}
            />
          )}
        </div>
        <div className="results-badge">{filteredSummaries.length} SKUs FOUND</div>
      </div>

      {/* ── SKU Grid ── */}
      <div className="sku-grid animate-in">
        {paginated.length === 0 && (
          <div className="no-results glass-medium">
            <div className="no-results-icon">📦</div>
            <div className="no-results-text">NO SKUS MATCHING YOUR SEARCH</div>
            <div className="no-results-sub">Try adjusting your filters or use different keywords.</div>
          </div>
        )}
        {paginated.map((group) => {
          const simple = isSimpleCat(group.category);
          const cwCount = products.filter((p) => !p.isDeleted && String(p.parentId) === String(group.productId)).length;
          return (
            <div key={group.productId} className={`sku-card glass-medium ${group.available.length > 0 ? "available" : "sold"}`} onClick={() => openSkuModal(group)}>
              <div className="sku-card-header">
                <span className="sku-number">SKU #{group.skuNum}</span>
                <span className={`sku-status ${group.available.length > 0 ? "available" : "sold"}`}>
                  {group.available.length > 0 ? `${group.available.length} AVAILABLE` : "SOLD OUT"}
                </span>
              </div>
              <div className="sku-card-body">
                <div className="sku-card-img-wrapper">
                  <img src={group.image} alt={group.name} className="sku-image" />
                  {cwCount > 0 && <span className="cw-count-badge" title={`${cwCount} Colorways`}>{cwCount}</span>}
                </div>
                <div className="sku-info">
                  <h3 className="sku-product-name">{group.name}</h3>
                  <div className="sku-meta">
                    <span className="sku-brand">{(group.category || "").toUpperCase()}</span>
                    {group.brand && <span className="sku-brand accent">{group.brand.toUpperCase()}</span>}
                  </div>
                  {!simple && group.availSizes.length > 0 && (
                    <div className="sku-sizes-row">
                      {group.availSizes.slice(0, 5).map((sz) => (
                        <span key={sz} className="sku-size-dot">{sz}</span>
                      ))}
                      {group.availSizes.length > 5 && <span className="sku-size-more">+{group.availSizes.length - 5}</span>}
                    </div>
                  )}
                </div>
              </div>
              <div className="sku-card-footer">
                <div className="sku-price-range">{group.priceRange}</div>
                <div className="sku-total-units">{group.totalUnits} UNITS TOTAL</div>
              </div>
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="sku-pagination">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="page-btn">← Previous</button>
          <div className="page-info">Page <strong>{page}</strong> of <strong>{totalPages}</strong></div>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="page-btn">Next →</button>
        </div>
      )}

      {/* ── SKU Summary Modal ── */}
      {selectedSkuGroup && (() => {
        const { parent, colorways, rootParentId } = getColorwayFamily(selectedSkuGroup);
        const isColorwayProduct = !!productMap[String(selectedSkuGroup.productId)]?.parentId;

        // The "active" colorway in the switcher is the one currently shown in the modal
        const activeProductId = selectedSkuGroup.productId;

        // Aggregate stock across base + all colorways for the SKU line
        const allFamilyProductIds = [String(rootParentId), ...colorways.map((c) => String(c.id))];
        const familySequences = allSequences.filter((s) => allFamilyProductIds.includes(String(s.productId)));
        const familyAvailable = familySequences.filter((s) => s.status === "available").length;
        const familySold = familySequences.filter((s) => s.status === "sold").length;

        return (
          <div className="sku-modal-overlay" onClick={() => setSelectedSkuGroup(null)}>
            <div className="sku-modal glass-strong animate-in" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close" onClick={() => setSelectedSkuGroup(null)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
              
              <div className="modal-sidebar">
                <div className="modal-image-wrap glass-medium">
                  <img src={selectedSkuGroup.image} alt={selectedSkuGroup.name} className="modal-hero-image" />
                </div>
                <div className="modal-quick-stats">
                  <div className="m-stat glass">
                    <span className="m-stat-label">AVAILABLE</span>
                    <span className="m-stat-value success">{selectedSkuGroup.available.length}</span>
                  </div>
                  <div className="m-stat glass">
                    <span className="m-stat-label">COMPLETED</span>
                    <span className="m-stat-value">{selectedSkuGroup.sold.length}</span>
                  </div>
                </div>
              </div>

              <div className="modal-main-content">
                <div className="m-header">
                  <span className="m-sku-badge">MASTER SKU #{rootParentId}</span>
                  <h2 className="chrome-text" style={{ fontSize: '28px' }}>{selectedSkuGroup.name}</h2>
                  <div className="m-tags">
                    <span className="m-tag">{(selectedSkuGroup.category || "").toUpperCase()}</span>
                    {selectedSkuGroup.brand && <span className="m-tag accent">{selectedSkuGroup.brand.toUpperCase()}</span>}
                  </div>
                </div>

                <div className="m-grid">
                  <div className="m-detail">
                    <label>DYNAMIC PRICE RANGE</label>
                    <span className="m-value price">{selectedSkuGroup.priceRange}</span>
                  </div>
                  
                  {!isSimpleCat(selectedSkuGroup.category) && (
                    <div className="m-detail">
                      <label>ACTIVE SIZES IN STOCK</label>
                      <div className="m-sizes-grid">
                        {selectedSkuGroup.availSizes.length > 0 ? (
                          selectedSkuGroup.availSizes.map((sz) => (
                            <span key={sz} className="m-size-pill glass-medium">US M {sz}</span>
                          ))
                        ) : <span className="m-no-data">CURRENTLY UNAVAILABLE</span>}
                      </div>
                    </div>
                  )}

                  {(parent || colorways.length > 0) && (
                    <div className="m-detail">
                      <label>COLORWAY FAMILY <span className="m-count">({colorways.length + 1} VARIANTS)</span></label>
                      <div className="m-swatches">
                        {parent && (
                          <button
                            className={`m-swatch glass-medium ${String(activeProductId) === String(parent.id) ? "active" : ""}`}
                            onClick={() => {
                              const pg = findGroupByProductId(parent.id);
                              if (pg) setSelectedSkuGroup(pg);
                            }}
                            title={parent.name}
                          >
                            <img src={parent.image} alt={parent.name} />
                            <span className={`m-dot ${allSequences.some(s => String(s.productId) === String(parent.id) && s.status === "available") ? "live" : ""}`} />
                          </button>
                        )}
                        {colorways.map((cw) => {
                          const cg = findGroupByProductId(cw.id);
                          const av = allSequences.some(s => String(s.productId) === String(cw.id) && s.status === "available");
                          return (
                            <button
                              key={cw.id}
                              className={`m-swatch glass-medium ${String(activeProductId) === String(cw.id) ? "active" : ""}`}
                              onClick={() => cg && setSelectedSkuGroup(cg)}
                              title={cw.name}
                            >
                              <img src={cw.image} alt={cw.name} />
                              <span className={`m-dot ${av ? "live" : ""}`} />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="m-actions">
                  <button className="m-btn-primary" onClick={() => { setSelectedSkuGroup(null); openProductIds(selectedSkuGroup); }}>
                    VIEW FULL UNIT BREAKDOWN
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Product IDs List Modal ── */}
      {showProductIds && productIdsData && (
        <div className="sku-modal-overlay" onClick={() => setShowProductIds(false)}>
          <div className="sizes-modal glass-strong animate-in" onClick={(e) => e.stopPropagation()}>
            <button className="modal-back" onClick={() => { setShowProductIds(false); setSelectedSkuGroup(productIdsData); }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              BACK TO SUMMARY
            </button>
            <button className="modal-close" onClick={() => setShowProductIds(false)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
            <div className="sizes-modal-header">
              <h2 className="chrome-text" style={{ fontSize: '24px' }}>UNIT BREAKDOWN — MASTER SKU #{productIdsData.skuNum}</h2>
              <p className="sizes-product-name">{productIdsData.name.toUpperCase()}</p>
              <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
                <span className="m-tag">{(productIdsData.category || "").toUpperCase()}</span>
                {productIdsData.brand && <span className="m-tag accent">{productIdsData.brand.toUpperCase()}</span>}
              </div>
            </div>

            {!isSimpleCat(productIdsData.category) && (
              <div className="sizes-chips" style={{ padding: "0 40px 16px" }}>
                <div className={`size-chip glass-medium available ${pidFilterSize === "all" ? "active-size" : ""}`} onClick={() => { setPidFilterSize("all"); setPidPage(1); }}>ALL SIZES</div>
                {[...new Set(productIdsData.seqs.map((s) => s.size).filter((s) => s && s !== "—"))].sort((a, b) => parseFloat(a) - parseFloat(b)).map((size) => {
                  const avail = productIdsData.seqs.filter((s) => s.size === size && s.status === "available").length;
                  return (
                    <div key={size} className={`size-chip glass-medium ${avail > 0 ? "available" : "unavailable"} ${pidFilterSize === size ? "active-size" : ""}`} onClick={() => { setPidFilterSize(size); setPidPage(1); }}>
                      US M {size}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="sizes-search-section glass">
              <div className="search-wrapper-luxe mini">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="search-icon">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
                </svg>
                <input 
                  type="text" 
                  placeholder="SEARCH UNITS..." 
                  className="sizes-search-input-luxe" 
                  value={pidSearch} 
                  onChange={(e) => { setPidSearch(e.target.value); setPidPage(1); }} 
                />
              </div>
              <LuxeSelect 
                value={pidFilterStatus} 
                onChange={(val) => { setPidFilterStatus(val); setPidPage(1); }}
                options={[
                  { value: "all", label: "ALL STATUS" },
                  { value: "available", label: "AVAILABLE" },
                  { value: "sold", label: "SOLD" }
                ]}
              />
            </div>

            <div className="sizes-table-wrapper">
              <table className="sizes-table">
                <thead>
                  <tr>
                    <th className="th-sortable" onClick={() => togglePidSort("productItemId")}>UNIT ID {pidSortInd("productItemId")}</th>
                    <th>STATUS</th>
                    {!isSimpleCat(productIdsData.category) && <th className="th-sortable" onClick={() => togglePidSort("size")}>SIZE {pidSortInd("size")}</th>}
                    <th className="th-sortable" onClick={() => togglePidSort("price")}>PRICE {pidSortInd("price")}</th>
                    <th className="th-sortable" onClick={() => togglePidSort("consignedBy")}>CONSIGNER {pidSortInd("consignedBy")}</th>
                    <th className="th-sortable" onClick={() => togglePidSort("addedDate")}>DATE IN {pidSortInd("addedDate")}</th>
                    <th className="th-sortable" onClick={() => togglePidSort("soldDate")}>DATE OUT {pidSortInd("soldDate")}</th>
                    <th className="th-sortable" onClick={() => togglePidSort("soldBy")}>STAFF {pidSortInd("soldBy")}</th>
                  </tr>
                </thead>
                <tbody>
                  {pidPaginated.length === 0 && (
                    <tr><td colSpan={pidColCount(productIdsData.category)} style={{ textAlign: "center", padding: 32, color: "var(--text-tertiary)" }}>No units matching your criteria.</td></tr>
                  )}
                  {pidPaginated.map((seq) => {
                    const simple = isSimpleCat(productIdsData.category);
                    return (
                      <tr key={seq._id || seq.sequenceNumber} className={seq.status === "sold" ? "row-sold" : ""} onClick={() => setSelectedUnit(seq)}>
                        <td className="sku-link" style={{ color: "var(--accent-white)", fontWeight: 700 }}>#{getProductItemId(seq)}</td>
                        <td><span className={`sku-status ${seq.status}`}>{seq.status.toUpperCase()}</span></td>
                        {!simple && <td style={{ fontWeight: 600 }}>US M {seq.size}</td>}
                        <td style={{ fontWeight: 700, color: '#fff' }}>₱{formatPrice(getUnitPrice(seq))}</td>
                        <td><ConsignedByBadge email={seq.consignedBy} /></td>
                        <td style={{ fontSize: '11px', fontWeight: 600 }}>{fmtDate(seq.addedDate)}</td>
                        <td style={{ fontSize: '11px', fontWeight: 600, color: seq.soldDate ? "#f87171" : "var(--text-tertiary)" }}>{fmtDate(seq.soldDate)}</td>
                        <td><SoldByBadge email={seq.soldBy} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="sizes-pagination glass">
              <div className="sizes-page-info">Showing <strong>{pidPaginated.length}</strong> of <strong>{pidFiltered.length}</strong> individual units</div>
              <div className="sizes-page-controls">
                <button className="page-btn" onClick={() => setPidPage((p) => Math.max(1, p - 1))} disabled={pidPage === 1}>PREV</button>
                <div className="page-info">Page <strong>{pidPage}</strong> of <strong>{pidTotalPages}</strong></div>
                <button className="page-btn" onClick={() => setPidPage((p) => Math.min(pidTotalPages, p + 1))} disabled={pidPage === pidTotalPages}>NEXT</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Individual Unit Detail Modal ── */}
      {selectedUnit && (
        <div className="sku-modal-overlay" style={{ zIndex: 2200 }} onClick={() => setSelectedUnit(null)}>
          <div className="sku-modal glass-strong animate-in" onClick={(e) => e.stopPropagation()} style={{ gridTemplateColumns: '1fr', maxWidth: '520px' }}>
            <button className="modal-close" onClick={() => setSelectedUnit(null)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
            <div className="modal-main-content" style={{ padding: '40px' }}>
              <div className="m-header" style={{ marginBottom: '32px' }}>
                <span className="m-sku-badge">UNIT ID #{getProductItemId(selectedUnit)}</span>
                <h2 className="chrome-text" style={{ fontSize: '24px' }}>{selectedUnit.productName.toUpperCase()}</h2>
                <div className={`sku-status ${selectedUnit.status}`} style={{ width: 'fit-content', marginTop: '12px' }}>{selectedUnit.status.toUpperCase()}</div>
              </div>

              <div className="modal-image-section" style={{ marginBottom: '32px' }}>
                <div className="modal-image-wrap glass-medium" style={{ height: '300px' }}>
                  <img src={selectedUnit.productImage || ""} alt={selectedUnit.productName} className="modal-hero-image" />
                </div>
              </div>

              <div className="m-grid" style={{ gap: '20px' }}>
                <div className="meta-row-luxe glass">
                  <span className="m-key">MASTER SKU</span>
                  <span className="m-val">#{getSkuNumber(selectedUnit)}</span>
                </div>
                <div className="meta-row-luxe glass">
                  <span className="m-key">UNIT PRICE</span>
                  <span className="m-val" style={{ color: 'var(--accent-white)' }}>₱{formatPrice(getUnitPrice(selectedUnit))}</span>
                </div>
                <div className="meta-row-luxe glass">
                  <span className="m-key">CATEGORY</span>
                  <span className="m-val">{selectedUnit.category?.toUpperCase()}</span>
                </div>
                {getBrand(selectedUnit) && (
                  <div className="meta-row-luxe glass">
                    <span className="m-key">BRAND</span>
                    <span className="m-val">{getBrand(selectedUnit).toUpperCase()}</span>
                  </div>
                )}
                {!isSimpleCat(selectedUnit.category) && (
                  <div className="meta-row-luxe glass">
                    <span className="m-key">SIZE</span>
                    <span className="m-val">US M {selectedUnit.size}</span>
                  </div>
                )}
                <div className="meta-row-luxe glass">
                  <span className="m-key">LOCATION</span>
                  <span className="m-val">{selectedUnit.location || "GALLERIA BRANCH"}</span>
                </div>
                <div className="meta-row-luxe glass">
                  <span className="m-key">CONSIGNER</span>
                  <span className="m-val" style={{ textTransform: 'none', color: '#4ade80' }}>{selectedUnit.consignedBy || "HOUSE STOCK"}</span>
                </div>
                <div className="meta-row-luxe glass">
                  <span className="m-key">DATE RECEIVED</span>
                  <span className="m-val">{fmtDate(selectedUnit.addedDate)}</span>
                </div>
                {selectedUnit.status === "sold" && (
                  <>
                    <div className="meta-row-luxe glass" style={{ borderColor: 'rgba(248, 113, 113, 0.2)' }}>
                      <span className="m-key">DATE SOLD</span>
                      <span className="m-val" style={{ color: '#f87171' }}>{fmtDate(selectedUnit.soldDate)}</span>
                    </div>
                    <div className="meta-row-luxe glass">
                      <span className="m-key">FULFILLED BY</span>
                      <span className="m-val" style={{ textTransform: 'none', color: '#60a5fa' }}>{selectedUnit.soldBy || "CUSTOMER CHECKOUT"}</span>
                    </div>
                  </>
                )}
              </div>

              {selectedUnit.status === "available" && canModify && (
                <div className="m-actions" style={{ paddingTop: '32px', marginTop: '32px' }}>
                  <button className="m-btn-primary" onClick={() => markAsSold(selectedUnit)} style={{ background: '#f87171', color: '#fff' }}>
                    MARK AS SOLD
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default SKUViewer;
