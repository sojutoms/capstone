import React, { useContext, useState, useMemo, useCallback, useRef, useEffect } from "react";
import { ShopContext } from "../Context/ShopContext";
import Item from "../Components/Item/Item";
import CategorySkeleton from "../Components/Skeleton/CategorySkeleton";
import "./CSS/ShopCategory.css";
import API_BASE_URL from "../services/api";

const CATEGORY_META = {
  shoes:        { label: "Shoes",        tagline: "Step into the culture. Curated kicks, every drop." },
  watch:        { label: "Watches",      tagline: "Time pieces worth wearing. Every second counts." },
  bags:         { label: "Bags",         tagline: "Carry what matters. Style that travels with you." },
  collectibles: { label: "Collectibles", tagline: "Rare finds. Limited runs. Own a piece of culture." },
};

const SLIDER_MIN = 0;
const SLIDER_MAX = 30000;
const PAGE_SIZE  = 9;

const priceRanges = [
  { label: "All Prices",       min: 0,     max: Infinity },
  { label: "Under ₱1000",     min: 0,     max: 1000 },
  { label: "₱1000 - ₱5000",  min: 1000,  max: 5000 },
  { label: "₱5000 - ₱10000", min: 5000,  max: 10000 },
  { label: "Over ₱10000",     min: 10000, max: Infinity },
];

const rangeToSlider = (range) => {
  if (range.label === "All Prices") return [SLIDER_MIN, SLIDER_MAX];
  return [range.min, range.max === Infinity ? SLIDER_MAX : range.max];
};

const sliderToRange = (low, high) => {
  if (low === SLIDER_MIN && high === SLIDER_MAX) return priceRanges[0];
  for (const r of priceRanges) {
    if (r.label === "All Prices") continue;
    const rMax = r.max === Infinity ? SLIDER_MAX : r.max;
    if (low === r.min && high === rMax) return r;
  }
  return {
    label: `₱${low.toLocaleString()} - ₱${high === SLIDER_MAX ? "30000+" : high.toLocaleString()}`,
    min: low, max: high === SLIDER_MAX ? Infinity : high, custom: true,
  };
};

const ShopCategory = (props) => {
  const { all_product, isLoadingProducts } = useContext(ShopContext);
  const lockedBrand = props.brand || null;

  const [filters,      setFilters]      = useState({ priceRange: priceRanges[0], subCategory: "All" });
  const [sliderValues, setSliderValues] = useState([SLIDER_MIN, SLIDER_MAX]);
  const [sortOption,   setSortOption]   = useState("featured");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showFilters,  setShowFilters]  = useState(true);
  const [currentPage,  setCurrentPage]  = useState(1);
  const [animState,    setAnimState]    = useState("idle");

  // ── Dynamic subcategories from API ────────────────────────────────────────
  const [apiSubcats, setApiSubcats] = useState([]); // [{ name, slug, parentCategory }]

  useEffect(() => {
    // Trigger initial entry animation
    setAnimState("enter-up");
    const t = setTimeout(() => setAnimState("idle"), 800);

    fetch(`${API_BASE_URL}/subcategories${props.category ? `?category=${props.category}` : ""}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setApiSubcats(data.subcategories || []);
      })
      .catch(() => {});
    
    return () => clearTimeout(t);
  }, [props.category]);

  const gridRef           = useRef(null);
  const topSentinelRef    = useRef(null);
  const bottomSentinelRef = useRef(null);
  const locked            = useRef(false);
  const minThumbRef       = useRef(null);
  const maxThumbRef       = useRef(null);

  useEffect(() => { setCurrentPage(1); setAnimState("idle"); }, [filters, sortOption]);

  const handlePriceRangeChange = (range) => {
    setFilters((prev) => ({ ...prev, priceRange: range }));
    setSliderValues(rangeToSlider(range));
  };

  const handleSliderMin = (e) => {
    const val = Math.min(Number(e.target.value), sliderValues[1] - 500);
    const nv  = [val, sliderValues[1]];
    setSliderValues(nv);
    setFilters((prev) => ({ ...prev, priceRange: sliderToRange(nv[0], nv[1]) }));
  };

  const handleSliderMax = (e) => {
    const val = Math.max(Number(e.target.value), sliderValues[0] + 500);
    const nv  = [sliderValues[0], val];
    setSliderValues(nv);
    setFilters((prev) => ({ ...prev, priceRange: sliderToRange(nv[0], nv[1]) }));
  };

  const leftPct  = ((sliderValues[0] - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * 100;
  const rightPct = ((sliderValues[1] - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * 100;

  const formatSliderLabel = (val) => {
    if (val >= SLIDER_MAX) return "₱30k+";
    if (val >= 1000) return `₱${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}k`;
    return `₱${val}`;
  };

  const toNumber = useCallback((v) => {
    if (v == null || v === "") return NaN;
    if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
    if (typeof v === "string") { const n = Number(v.replace(/[, ₱\s]+/g, "")); return Number.isFinite(n) ? n : NaN; }
    return NaN;
  }, []);

  const getNumericPrice = useCallback((product) => {
    if (!product) return NaN;

    // Handle sizes when it's an object (from backend)
    if (product.sizes && typeof product.sizes === "object" && !Array.isArray(product.sizes)) {
      const sizeValues = Object.values(product.sizes);
      if (sizeValues.length > 0) {
        const prices = sizeValues
          .filter((s) => s && typeof s === "object" && s.price !== undefined)
          .map((s) => toNumber(s.price))
          .filter((n) => Number.isFinite(n) && n > 0);
        if (prices.length > 0) return Math.min(...prices);
      }
    }

    // Handle sizes when it's an array (legacy format)
    if (Array.isArray(product.sizes) && product.sizes.length > 0) {
      const prices = product.sizes
        .map((s) => (!s ? NaN : typeof s === "object" && s.price !== undefined ? toNumber(s.price) : toNumber(s)))
        .filter((n) => Number.isFinite(n) && n > 0);
      if (prices.length > 0) return Math.min(...prices);
    }

    // Fallback to price fields
    for (const c of [product.price, product.new_price, product.price_php, product.amount, product.value]) {
      const n = toNumber(c);
      if (Number.isFinite(n) && n > 0) return n;
    }

    // Use priceRange from backend if available
    if (product.priceRange && typeof product.priceRange === "object") {
      if (Number.isFinite(product.priceRange.min) && product.priceRange.min > 0) {
        return product.priceRange.min;
      }
    }

    return NaN;
  }, [toNumber]);

  // ── Build available subcategories ─────────────────────────────────────────
  // Merge: API-defined subcats + any slugs already on products (for backwards compat)
  const availableSubCategories = useMemo(() => {
    const fromProducts = new Set();
    all_product.forEach((item) => {
      if (props.category === item.category && Array.isArray(item.subCategories))
        item.subCategories.forEach((sc) => { if (sc) fromProducts.add(sc); });
    });

    // Build a display map: slug → display name
    const displayMap = {};
    apiSubcats.forEach((sc) => { displayMap[sc.slug] = sc.name; });

    // Collect all slugs that exist in products
    const allSlugs = new Set([...fromProducts]);

    // Also add any API subcats for this category even if no product has them yet
    apiSubcats
      .filter((sc) => !sc.parentCategory || sc.parentCategory === props.category)
      .forEach((sc) => allSlugs.add(sc.slug));

    return Array.from(allSlugs)
      .sort()
      .map((slug) => ({ slug, label: displayMap[slug] || (slug.charAt(0).toUpperCase() + slug.slice(1)) }));
  }, [all_product, props.category, apiSubcats]);

  const filteredProducts = useMemo(() => {
    let products = all_product.filter((item) => props.category === item.category);
    if (lockedBrand) products = products.filter((item) => (item.brand || "").toLowerCase() === lockedBrand.toLowerCase());
    if (filters.priceRange.label !== "All Prices") {
      products = products.filter((item) => {
        const p = getNumericPrice(item);
        return Number.isFinite(p) && p >= filters.priceRange.min && p <= filters.priceRange.max;
      });
    }
    if (filters.subCategory !== "All") {
      products = products.filter((item) =>
        Array.isArray(item.subCategories) && item.subCategories.includes(filters.subCategory)
      );
    }
    return products;
  }, [all_product, props.category, lockedBrand, filters, getNumericPrice]);

  const sortedProducts = useMemo(() => {
    const p = [...filteredProducts];
    switch (sortOption) {
      case "newest":     return p.sort((a, b) => (b.id || 0) - (a.id || 0));
      case "price-high": return p.sort((a, b) => (getNumericPrice(b) || 0) - (getNumericPrice(a) || 0));
      case "price-low":  return p.sort((a, b) => (getNumericPrice(a) || 0) - (getNumericPrice(b) || 0));
      case "name-asc":   return p.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      case "name-desc":  return p.sort((a, b) => (b.name || "").localeCompare(a.name || ""));
      default:           return p;
    }
  }, [filteredProducts, sortOption, getNumericPrice]);

  const totalPages   = Math.ceil(sortedProducts.length / PAGE_SIZE);
  const currentItems = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return sortedProducts.slice(start, start + PAGE_SIZE);
  }, [sortedProducts, currentPage]);

  const changePage = useCallback((next, dir) => {
    if (locked.current) return;
    if (next < 1 || next > totalPages || next === currentPage) return;
    locked.current = true;
    setAnimState(dir === "down" ? "exit-up" : "exit-down");
    setTimeout(() => {
      setCurrentPage(next);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        setAnimState(dir === "down" ? "enter-up" : "enter-down");
        if (gridRef.current) gridRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
        setTimeout(() => { setAnimState("idle"); locked.current = false; }, 480);
      }));
    }, 280);
  }, [currentPage, totalPages]);

  useEffect(() => {
    const el = bottomSentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) changePage(currentPage + 1, "down"); },
      { threshold: 0.9 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [currentPage, totalPages, changePage]);

  useEffect(() => {
    const el = topSentinelRef.current;
    if (!el || currentPage <= 1) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) changePage(currentPage - 1, "up"); },
      { threshold: 0.9 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [currentPage, changePage]);

  const clearAllFilters = () => {
    setFilters({ priceRange: priceRanges[0], subCategory: "All" });
    setSliderValues([SLIDER_MIN, SLIDER_MAX]);
  };

  const hasActiveFilters = () => filters.priceRange.label !== "All Prices" || filters.subCategory !== "All";

  const getSortLabel = () => {
    switch (sortOption) {
      case "newest":     return "Newest";
      case "price-high": return "High → Low";
      case "price-low":  return "Low → High";
      case "name-asc":   return "A – Z";
      case "name-desc":  return "Z – A";
      default:           return "Best Seller";
    }
  };

  const meta = CATEGORY_META[props.category?.toLowerCase()] || {};

  return (
    <div className="shopcategory-page">
      {props.banner ? (
        <img className="shopcategory-banner" src={props.banner} alt="" />
      ) : (
        <div className="shopcategory-header">
          <h1 className="shopcategory-header-title">{meta.label || props.category}</h1>
          {meta.tagline && <p className="shopcategory-header-tagline">{meta.tagline}</p>}
        </div>
      )}

      <div className="shopcategory-body">
        {showFilters && (
          <aside className="shopcategory-sidebar">
            <div className="shopcategory-sidebar-inner">
              <div className="shopcategory-sidebar-section">
                <h3 className="shopcategory-sidebar-heading">
                  <span className="sidebar-heading-line" />Price Range
                </h3>
                {priceRanges.map((range, idx) => {
                  const active = filters.priceRange.label === range.label;
                  return (
                    <button key={idx} onClick={() => handlePriceRangeChange(range)}
                      className={`shopcategory-filter-btn${active ? " active" : ""}`}>
                      <span className="shopcategory-radio">{active && <span className="shopcategory-radio-dot" />}</span>
                      {range.label}
                    </button>
                  );
                })}
                <div className="shopcategory-price-slider-wrap">
                  <div className="shopcategory-price-slider-labels">
                    <span className="shopcategory-price-slider-label">{formatSliderLabel(sliderValues[0])}</span>
                    <span className="shopcategory-price-slider-label">{formatSliderLabel(sliderValues[1])}</span>
                  </div>
                  <div className="shopcategory-slider-track-container">
                    <div className="shopcategory-slider-track" />
                    <div className="shopcategory-slider-range" style={{ left: `${leftPct}%`, width: `${rightPct - leftPct}%` }} />
                    <input ref={minThumbRef} type="range" className="shopcategory-slider-input" min={SLIDER_MIN} max={SLIDER_MAX} step={100} value={sliderValues[0]} onChange={handleSliderMin} />
                    <input ref={maxThumbRef} type="range" className="shopcategory-slider-input" min={SLIDER_MIN} max={SLIDER_MAX} step={100} value={sliderValues[1]} onChange={handleSliderMax} />
                  </div>
                </div>
              </div>

              {/* ── Dynamic subcategory filter ── */}
              {availableSubCategories.length > 0 && (
                <div className="shopcategory-sidebar-section">
                  <h3 className="shopcategory-sidebar-heading">
                    <span className="sidebar-heading-line" />Style
                  </h3>
                  <div className="shopcategory-brand-chips">
                    <button
                      onClick={() => setFilters((p) => ({ ...p, subCategory: "All" }))}
                      className={`shopcategory-brand-chip${filters.subCategory === "All" ? " active" : ""}`}>
                      All
                    </button>
                    {availableSubCategories.map(({ slug, label }) => (
                      <button key={slug}
                        onClick={() => setFilters((p) => ({ ...p, subCategory: slug }))}
                        className={`shopcategory-brand-chip${filters.subCategory === slug ? " active" : ""}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {totalPages > 1 && (
                <div className="sidebar-page-indicator">
                  <div className="sidebar-page-fraction">
                    <span className="spi-current">{String(currentPage).padStart(2, "0")}</span>
                    <div className="spi-track"><div className="spi-fill" style={{ height: `${(currentPage / totalPages) * 100}%` }} /></div>
                    <span className="spi-total">{String(totalPages).padStart(2, "0")}</span>
                  </div>
                  <span className="spi-label">page</span>
                </div>
              )}
            </div>
          </aside>
        )}

        <div className="shopcategory-main">
          <div className="shopcategory-topbar">
            <div className="shopcategory-topbar-left">
              <span className="shopcategory-result-count"><strong>{sortedProducts.length}</strong> Results</span>
              {totalPages > 1 && (
                <span className="shopcategory-page-badge">
                  {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, sortedProducts.length)}
                </span>
              )}
              {hasActiveFilters() && <button onClick={clearAllFilters} className="shopcategory-clear-btn">Clear All</button>}
            </div>
            <div className="shopcategory-topbar-right">
              <button onClick={() => setShowFilters(!showFilters)} className={`shopcategory-toggle-btn${showFilters ? " active" : ""}`}>
                <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
                  <path d="M2 4h16M5 10h10M8 16h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                {showFilters ? "Hide" : "Filters"}
              </button>
              <div className="shopcategory-sort-wrapper">
                <button onClick={() => setShowSortMenu(!showSortMenu)} className="shopcategory-sort-btn">
                  <span>Sort: {getSortLabel()}</span>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className={showSortMenu ? "open" : ""}>
                    <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
                {showSortMenu && (
                  <div className="shopcategory-sort-dropdown">
                    {[
                      { value: "featured",   label: "Best Seller" },
                      { value: "newest",     label: "Newest" },
                      { value: "price-low",  label: "Price: Low → High" },
                      { value: "price-high", label: "Price: High → Low" },
                      { value: "name-asc",   label: "Name: A–Z" },
                      { value: "name-desc",  label: "Name: Z–A" },
                    ].map((opt) => (
                      <button key={opt.value}
                        onClick={() => { setSortOption(opt.value); setShowSortMenu(false); }}
                        className={`shopcategory-sort-option${sortOption === opt.value ? " active" : ""}`}>
                        {opt.label}
                        {sortOption === opt.value && (
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                            <path d="M3 8L6 11L13 4" stroke="#f5f5f0" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {currentPage > 1 && (
            <div ref={topSentinelRef} className="sc-sentinel sc-sentinel--top">
              <span className="sc-sentinel-arrow">↑</span>
              <span className="sc-sentinel-text">Page {currentPage - 1}</span>
            </div>
          )}

          <div ref={gridRef} className={`shopcategory-grid-wrapper anim-${animState}`}>
            <div className="shopcategory-grid">
              {isLoadingProducts ? (
                Array(6).fill(0).map((_, i) => <CategorySkeleton key={i} />)
              ) : (
                currentItems.map((item, i) => {
                  const numericPrice = getNumericPrice(item);
                  return (
                    <div key={item.id} className="sc-item" style={{ "--i": i }}>
                      <Item
                        id={item.id} name={item.name} image={item.image}
                        sizes={item.sizes || item.variants || item.price_map}
                        price={Number.isFinite(numericPrice) ? numericPrice : undefined}
                        new_price={item.new_price} old_price={item.old_price}
                        isNew={item.isNew} salesCount={item.salesCount || 0}
                      />
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {sortedProducts.length === 0 && (
            <div className="shopcategory-empty">No products found matching your filters.</div>
          )}

          {currentPage < totalPages ? (
            <div ref={bottomSentinelRef} className="sc-sentinel sc-sentinel--bottom">
              {animState.startsWith("exit") || animState.startsWith("enter") ? (
                <div className="sc-sentinel-dots"><span /><span /><span /></div>
              ) : (
                <>
                  <span className="sc-sentinel-text">Page {currentPage + 1}</span>
                  <span className="sc-sentinel-arrow">↓</span>
                </>
              )}
            </div>
          ) : totalPages > 1 ? (
            <div className="sc-end-marker"><span>✦</span><span>end of results</span><span>✦</span></div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default ShopCategory;
