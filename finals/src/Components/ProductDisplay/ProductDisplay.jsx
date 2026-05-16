import React, { useContext, useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import "./ProductDisplay.css";
import star_icon from "../Assets/star_icon.png";
import star_dull_icon from "../Assets/star_dull_icon.png";
import { ShopContext } from "../../Context/ShopContext";
import { FavoritesContext } from "../../Context/FavoritesContext";
import API_BASE_URL from "../../services/api";

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const ProductSkeleton = () => (
  <div className="productdisplay">
    <div className="productdisplay-left">
      <div className="productdisplay-img-list">
        {[1, 2, 3].map((i) => <div key={i} className="skeleton skeleton-thumbnail" />)}
      </div>
      <div className="productdisplay-img"><div className="skeleton skeleton-main-image" /></div>
    </div>
    <div className="productdisplay-right">
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-rating" />
      <div className="skeleton skeleton-price" />
      <div className="skeleton skeleton-description" />
      <div className="skeleton skeleton-description" />
      <div className="skeleton skeleton-sizes" />
      <div className="skeleton skeleton-button" />
    </div>
    <div className="productdisplay-reviews-right">
      <div className="skeleton skeleton-reviews-header" />
    </div>
  </div>
);

const SIMPLE_CATEGORIES = ["watch", "bags", "collectibles"];

const toNumber = (v) => {
  if (v === null || v === undefined || v === "") return NaN;
  if (typeof v === "object") return NaN;
  if (typeof v === "string") return Number(v.replace(/[, ₱\s]+/g, ""));
  return Number(v);
};

const extractPrice = (price) => {
  if (price === null || price === undefined) return NaN;
  const prim = toNumber(price);
  if (Number.isFinite(prim)) return prim;
  if (typeof price === "object") {
    if (price.price !== undefined) {
      const p = toNumber(price.price);
      if (Number.isFinite(p)) return p;
    }
    const vals = Object.values(price).map((v) => {
      if (v === null || v === undefined) return NaN;
      if (typeof v === "object") return v.price !== undefined ? toNumber(v.price) : NaN;
      return toNumber(v);
    }).filter(Number.isFinite);
    if (vals.length === 0) return NaN;
    return Math.min(...vals);
  }
  return NaN;
};

const formatPrice = (price) => {
  const num = typeof price === "number" ? price : extractPrice(price);
  if (!Number.isFinite(num) || num <= 0) return null;
  return new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 }).format(num);
};

const StarRow = ({ rating, max = 5 }) => (
  <div className="review-rating">
    {Array.from({ length: max }, (_, i) => (
      <img key={i} src={i < Math.round(rating || 0) ? star_icon : star_dull_icon} alt="" />
    ))}
  </div>
);

// ─── Size conversion tables ───────────────────────────────────────────────────
const SIZE_CONVERSIONS = {
  US: ["6", "6.5", "7", "7.5", "8", "8.5", "9", "9.5", "10", "10.5", "11", "11.5", "12", "12.5", "13", "13.5", "14", "14.5", "15"],
  UK: ["5.5", "6", "6.5", "7", "7.5", "8", "8.5", "9", "9.5", "10", "10.5", "11", "11.5", "12", "12.5", "13", "13.5", "14", "14.5"],
  EU: ["38.5", "39", "40", "40.5", "41", "42", "42.5", "43", "44", "44.5", "45", "46", "46.5", "47", "48", "48.5", "49", "49.5", "50"],
  JP: ["235", "240", "245", "250", "255", "260", "265", "270", "275", "280", "285", "290", "295", "300", "305", "310", "315", "320", "325"],
};
const SYSTEM_LABELS = { US: "US size", UK: "UK size", EU: "EU size", JP: "JP (mm)" };
const SYSTEMS = ["US", "UK", "EU", "JP"];

const getConvertedSize = (usSize, system) => {
  const idx = SIZE_CONVERSIONS.US.indexOf(usSize);
  if (idx !== -1) return SIZE_CONVERSIONS[system][idx];
  const usNum = parseFloat(usSize);
  const lastUS = parseFloat(SIZE_CONVERSIONS.US[SIZE_CONVERSIONS.US.length - 1]);
  const steps = Math.round((usNum - lastUS) / 0.5);
  const lastEU = parseFloat(SIZE_CONVERSIONS.EU[SIZE_CONVERSIONS.EU.length - 1]);
  const lastUK = parseFloat(SIZE_CONVERSIONS.UK[SIZE_CONVERSIONS.UK.length - 1]);
  const lastJP = parseFloat(SIZE_CONVERSIONS.JP[SIZE_CONVERSIONS.JP.length - 1]);
  if (system === "EU") return String(lastEU + steps * 0.5);
  if (system === "UK") return String(lastUK + steps * 0.5);
  if (system === "JP") return String(lastJP + steps * 5);
  return usSize;
};

const convertSizeDisplay = (usSize, system) => {
  const val = getConvertedSize(usSize, system);
  if (system === "EU") return `EU ${val}`;
  if (system === "JP") return `${val} mm`;
  return `${system} ${val}`;
};

const getCrossRef = (usSize, activeSystem) => activeSystem === "US" ? `EU ${getConvertedSize(usSize, "EU")}` : `US ${usSize}`;
const getAllConversions = (usSize) => `US ${usSize} · UK ${getConvertedSize(usSize, "UK")} · EU ${getConvertedSize(usSize, "EU")} · JP ${getConvertedSize(usSize, "JP")}mm`;

const FALLBACK_SIZES = ["6", "6.5", "7", "7.5", "8", "8.5", "9", "9.5", "10", "10.5", "11", "11.5", "12", "12.5", "13"];

// ─── Component ────────────────────────────────────────────────────────────────
const ProductDisplay = ({ product, loading = false }) => {
  const { addToCart, cartItems } = useContext(ShopContext);
  const { addToFavorites, removeFromFavorites, isFavorite } = useContext(FavoritesContext);
  const navigate = useNavigate();

  // ── Dynamic sizes from API ────────────────────────────────────────────────
  const [dynamicSizes, setDynamicSizes] = useState(FALLBACK_SIZES);

  useEffect(() => {
    fetch(`${API_BASE_URL}/sizes`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.sizes?.length > 0) {
          setDynamicSizes(
            data.sizes.map((s) => s.value).sort((a, b) => parseFloat(a) - parseFloat(b))
          );
        }
      })
      .catch(() => { });
  }, []);

  const location = useLocation();
  const [selectedSize, setSelectedSize] = useState(location.state?.initialSize || "");
  const [sizeSystem, setSizeSystem] = useState("US");
  const [reviews, setReviews] = useState([]);
  const [averageRating, setAverageRating] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [mainImage, setMainImage] = useState(product?.image || "");
  const [showReviews, setShowReviews] = useState(false);
  const [sizeDropdownOpen, setSizeDropdownOpen] = useState(false);
  const sizeDropdownRef = useRef(null);
  const [favoriteLocal, setFavoriteLocal] = useState(() => (product ? Boolean(isFavorite(product.id)) : false));

  // ── Colorway state ────────────────────────────────────────────────────────
  const [selectedColorway, setSelectedColorway] = useState(null);

  // ── NEW: child colorway products fetched from API ─────────────────────────
  const [childColorways, setChildColorways] = useState([]);
  const [cwLoading, setCwLoading] = useState(false);
  const [parentProduct, setParentProduct] = useState(null);

  const isSimpleCategory = product && typeof product.category === "string"
    ? SIMPLE_CATEGORIES.includes(product.category.toLowerCase()) : false;

  const initialPrice = (() => {
    if (!product) return NaN;
    if (isSimpleCategory) { const p = extractPrice(product.price ?? product.new_price); return Number.isFinite(p) ? p : NaN; }
    const p = extractPrice(product.new_price ?? product.price);
    return Number.isFinite(p) ? p : NaN;
  })();

  const [displayPrice, setDisplayPrice] = useState(() => Number.isFinite(initialPrice) ? initialPrice : NaN);
  const [isZooming, setIsZooming] = useState(false);
  const [zoomPosition, setZoomPosition] = useState({ x: 50, y: 50 });
  const imageRef = useRef(null);
  const [addingToCart, setAddingToCart] = useState(false);
  const [lifestyleMode, setLifestyleMode] = useState(false);

  // Touch zoom refs and state for mobile
  const touchZoomedRef = useRef(false);
  const [touchZoomed, setTouchZoomed] = useState(false);
  const [touchOrigin, setTouchOrigin] = useState({ x: 50, y: 50 });
  const touchMoved = useRef(false);
  const imgContainerRef = useRef(null);

  // Register non-passive touchmove so preventDefault works
  useEffect(() => {
    const el = imgContainerRef.current;
    if (!el) return;
    const onTouchMove = (e) => {
      if (!touchZoomedRef.current) return;
      e.preventDefault();
      touchMoved.current = true;
      const touch = e.touches[0];
      const { left, top, width, height } = imageRef.current.getBoundingClientRect();
      setTouchOrigin({
        x: Math.max(0, Math.min(100, ((touch.clientX - left) / width) * 100)),
        y: Math.max(0, Math.min(100, ((touch.clientY - top) / height) * 100)),
      });
    };
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => el.removeEventListener("touchmove", onTouchMove);
  }, []);

  const handleTouchStart = (e) => {
    touchMoved.current = false;
    const touch = e.touches[0];
    const { left, top, width, height } = imageRef.current.getBoundingClientRect();
    setTouchOrigin({
      x: Math.max(0, Math.min(100, ((touch.clientX - left) / width) * 100)),
      y: Math.max(0, Math.min(100, ((touch.clientY - top) / height) * 100)),
    });
  };

  const handleTouchEnd = () => {
    if (!touchMoved.current) {
      const next = !touchZoomedRef.current;
      touchZoomedRef.current = next;
      setTouchZoomed(next);
    }
    touchMoved.current = false;
  };

  // ── Stock helpers ─────────────────────────────────────────────────────────
  const findSizeEntry = (sizesInput, sizeKey) => {
    if (!sizesInput) return undefined;
    if (Array.isArray(sizesInput)) return sizesInput.find((e) => String(e?.size ?? "").trim() === String(sizeKey).trim());
    const entry = sizesInput?.[sizeKey];
    if (entry === undefined) return undefined;
    if (typeof entry === "object") return { size: String(sizeKey), quantity: entry.quantity, price: entry.price };
    return { size: String(sizeKey), quantity: entry, price: undefined };
  };

  const getSizeStock = (size) => {
    if (!product) return 0;
    const sizeData = findSizeEntry(product.sizes || {}, size);
    if (sizeData === null || sizeData === undefined) return 0;
    if (typeof sizeData === "object") {
      if (sizeData.quantity !== undefined) { const q = toNumber(sizeData.quantity); return Number.isFinite(q) ? q : 0; }
      return 0;
    }
    if (typeof sizeData === "number" || typeof sizeData === "string") { const q = toNumber(sizeData); return Number.isFinite(q) ? q : 0; }
    return 0;
  };

  const getSizePrice = (size) => {
    if (!product) return NaN;
    const sizeData = findSizeEntry(product.sizes || {}, size);
    if (!sizeData) return extractPrice(product.new_price ?? product.price) || NaN;
    if (typeof sizeData === "object" && sizeData.price !== undefined) {
      const p = toNumber(sizeData.price);
      return Number.isFinite(p) ? p : extractPrice(product.new_price ?? product.price) || NaN;
    }
    const prim = toNumber(sizeData.quantity ?? sizeData);
    if (Number.isFinite(prim) && typeof sizeData !== "object") return prim;
    return extractPrice(product.new_price ?? product.price) || NaN;
  };

  const getRemainingStock = (usSize) => {
    if (!product) return 0;
    const totalStock = getSizeStock(usSize);
    const inCart = cartItems[`${product.id}_${usSize}`] || 0;
    return Math.max(0, totalStock - inCart);
  };

  const getSimpleRemaining = () => {
    if (!product) return 0;
    const total = Number.isFinite(toNumber(product.stock)) ? Number(toNumber(product.stock)) : 0;
    const inCart = cartItems[`${product.id}_`] || 0;
    return Math.max(0, total - inCart);
  };

  const getLowestAvailablePrice = () => {
    if (isSimpleCategory) { const base = extractPrice(product?.price ?? product?.new_price); return Number.isFinite(base) ? base : NaN; }
    const sizesObj = product?.sizes;
    if (!sizesObj || typeof sizesObj !== "object") { const base = extractPrice(product?.new_price ?? product?.price); return Number.isFinite(base) ? base : NaN; }
    const keys = Array.isArray(sizesObj) ? sizesObj.map((e) => String(e.size)) : Object.keys(sizesObj);
    const prices = keys.map((s) => { const stock = getSizeStock(s); if (stock <= 0) return NaN; return getSizePrice(s); }).filter(Number.isFinite);
    if (prices.length > 0) return Math.min(...prices);
    const base = extractPrice(product?.new_price ?? product?.price);
    return Number.isFinite(base) ? base : NaN;
  };

  const getAddToCartState = () => {
    if (!product) return { disabled: true, label: "ADD TO BAG" };
    const hasSizes = product.sizes && (Array.isArray(product.sizes) ? product.sizes.length > 0 : Object.keys(product.sizes).length > 0);
    if (!isSimpleCategory && hasSizes && !selectedSize) return { disabled: true, label: "ADD TO BAG" };
    if (isSimpleCategory) {
      const total = Number.isFinite(toNumber(product.stock)) ? Number(toNumber(product.stock)) : 0;
      if (total <= 0) return { disabled: true, label: "OUT OF STOCK" };
      if (getSimpleRemaining() <= 0) return { disabled: true, label: "MAX IN BAG" };
      return { disabled: false, label: "ADD TO BAG" };
    }
    if (selectedSize) {
      const totalStock = getSizeStock(selectedSize);
      if (totalStock <= 0) return { disabled: true, label: "OUT OF STOCK" };
      if (getRemainingStock(selectedSize) <= 0) return { disabled: true, label: "MAX IN BAG" };
    }
    return { disabled: false, label: "ADD TO BAG" };
  };

  const fetchReviews = useCallback(async () => {
    if (!product?.id) return;
    try {
      const res = await fetch(`${API_BASE_URL}/getreviews/${product.id}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setReviews(list);
      const total = list.reduce((sum, r) => sum + (r.rating || 0), 0);
      setAverageRating(list.length ? total / list.length : 0);
      setReviewCount(list.length);
    } catch (err) {
      console.error("Failed to fetch reviews:", err);
    }
  }, [product?.id]);

  // ── Reset state when product changes ─────────────────────────────────────
  useEffect(() => {
    if (product?.id) {
      fetchReviews();
      setMainImage(product.image || "");
      
      const initialSize = location.state?.initialSize || "";
      setSelectedSize(initialSize);
      
      setSelectedColorway(null);
      setSizeDropdownOpen(false);
      
      const basePrice = (() => {
        if (initialSize) {
          const sPrice = getSizePrice(initialSize);
          if (Number.isFinite(toNumber(sPrice))) return Number(sPrice);
        }
        if (isSimpleCategory) { const p = extractPrice(product.price ?? product.new_price); return Number.isFinite(p) ? p : NaN; }
        const p = extractPrice(product.new_price ?? product.price);
        return Number.isFinite(p) ? p : NaN;
      })();
      setDisplayPrice(Number.isFinite(basePrice) ? basePrice : NaN);
      setFavoriteLocal(Boolean(isFavorite(product.id)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id, location.state?.initialSize]);

  // ── NEW: fetch child colorway products from API ───────────────────────────
  useEffect(() => {
    if (!product?.id) return;

    // Determine the root parentId:
    // - if this product IS a colorway, its parentId is the base product
    // - if this product is a base product, its own id is the parentId
    const rootParentId = product.parentId ? product.parentId : product.id;

    setCwLoading(true);
    setChildColorways([]);
    setParentProduct(null);

    fetch(`${API_BASE_URL}/allproducts`)
      .then((r) => r.json())
      .then((all) => {
        if (!Array.isArray(all)) return;

        // Children: all non-deleted products that point to the root parent
        const children = all.filter(
          (p) => !p.isDeleted && String(p.parentId) === String(rootParentId)
        );

        // Find the parent product itself (for the "Default" swatch)
        const parent = all.find(
          (p) => !p.isDeleted && String(p.id) === String(rootParentId)
        );

        if (parent) setParentProduct(parent);

        // Normalize each child into the colorway shape ProductDisplay expects
        const normalized = children.map((child) => ({
          _productId: child.id,
          _isProductColorway: true,
          name: child.name,
          image: child.image || "",
          subImages: Array.isArray(child.subImages) ? child.subImages : [],
          hex: child.hex || "",
          sizes: child.sizes || {},
          stock: child.stock,
        }));

        setChildColorways(normalized);
      })
      .catch(() => { })
      .finally(() => setCwLoading(false));
  }, [product?.id, product?.parentId]);

  useEffect(() => {
    if (!product) return;
    const ctxFav = Boolean(isFavorite(product.id));
    if (ctxFav !== favoriteLocal) setFavoriteLocal(ctxFav);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFavorite(product?.id)]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (sizeDropdownRef.current && !sizeDropdownRef.current.contains(e.target))
        setSizeDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Merged colorways ──────────────────────────────────────────────────────
  // Legacy embedded colorways (product.colorways[]) + new product-based colorways
  const embeddedColorways = Array.isArray(product?.colorways) ? product.colorways : [];
  const childNames = new Set(childColorways.map((c) => c.name.toLowerCase()));
  // Drop embedded entries that are already covered by a child product
  const filteredEmbedded = embeddedColorways.filter(
    (cw) => !childNames.has((cw.name || "").toLowerCase())
  );
  const allColorways = [...filteredEmbedded, ...childColorways];
  const hasColorways = allColorways.length > 0;

  // ── Colorway handlers ─────────────────────────────────────────────────────
  const handleColorwayClick = (cw) => {
    if (cw._isProductColorway) {
      // Navigate to that colorway product's own page so its sizes/stock render correctly
      navigate(`/product/${cw._productId}`);
      return;
    }
    // Legacy embedded colorway — swap images in place
    setSelectedColorway(cw);
    setMainImage(cw.image || product.image || "");
  };

  const handleDefaultColorway = () => {
    if (product.parentId && parentProduct) {
      // Currently on a colorway page → go back to the base product
      navigate(`/product/${parentProduct.id}`);
      return;
    }
    setSelectedColorway(null);
    setMainImage(product.image || "");
  };

  const activeSubImages = selectedColorway?.subImages?.length > 0
    ? selectedColorway.subImages
    : (product?.subImages || []);

  // ── Toast system ──────────────────────────────────────────────────────────
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);
  const toastTimersRef = useRef({});

  const addToast = (type, message, duration = 3500) => {
    const id = ++toastIdRef.current;
    setToasts((t) => [...t, { id, type, message }]);
    if (duration > 0) {
      const timer = setTimeout(() => removeToast(id), duration);
      toastTimersRef.current[id] = timer;
    }
  };

  const removeToast = (id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    if (toastTimersRef.current[id]) { clearTimeout(toastTimersRef.current[id]); delete toastTimersRef.current[id]; }
  };

  useEffect(() => {
    return () => { Object.values(toastTimersRef.current).forEach((t) => clearTimeout(t)); toastTimersRef.current = {}; };
  }, []);

  const handleMouseMove = (e) => {
    if (!imageRef.current) return;
    const { left, top, width, height } = imageRef.current.getBoundingClientRect();
    setZoomPosition({
      x: Math.max(0, Math.min(100, ((e.clientX - left) / width) * 100)),
      y: Math.max(0, Math.min(100, ((e.clientY - top) / height) * 100)),
    });
  };

  const handleAddToCart = async () => {
    const token = localStorage.getItem("auth-token");
    if (!token) { navigate("/login"); return; }
    const hasSizes = product.sizes && (Array.isArray(product.sizes) ? product.sizes.length > 0 : Object.keys(product.sizes).length > 0);
    if (hasSizes && !isSimpleCategory && !selectedSize) {
      addToast("error", "Please select a size before adding to cart.");
      setSizeDropdownOpen(true);
      return;
    }
    try {
      setAddingToCart(true);
      const result = await addToCart(product.id, selectedSize || null);
      if (result && result.success) addToast("success", "Product added to Bag.");
    } catch (err) {
      console.error("Add to cart error:", err);
      addToast("error", "Failed to add to cart. Please try again.");
    } finally {
      setAddingToCart(false);
    }
  };

  const handleFavoriteClick = async () => {
    if (!product) return;
    const token = localStorage.getItem("auth-token");
    if (!token) { navigate("/login"); return; }
    const currentlyFav = isFavorite(product.id);
    setFavoriteLocal(!currentlyFav);
    const result = currentlyFav
      ? await removeFromFavorites(product.id)
      : await addToFavorites(product.id);
    if (!result || !result.success) {
      setFavoriteLocal(Boolean(isFavorite(product.id)));
      addToast("error", "Could not update favorites. Please try again.");
    } else {
      addToast("success", currentlyFav ? "Removed from your favorites." : "Added to your favorites.");
    }
  };

  const handleSizeClick = (size) => {
    const remaining = getRemainingStock(size);
    if (remaining > 0) {
      setSelectedSize(size);
      setSizeDropdownOpen(false);
      const sizePrice = getSizePrice(size);
      const p = Number.isFinite(toNumber(sizePrice)) ? Number(sizePrice) : extractPrice(product.new_price ?? product.price);
      setDisplayPrice(Number.isFinite(p) ? p : NaN);
    }
  };

  if (loading || !product) return <ProductSkeleton />;

  const isFav = favoriteLocal;
  const lowestAvailablePrice = getLowestAvailablePrice();
  const { disabled: addDisabled, label: addLabel } = getAddToCartState();
  const hasSizes = product.sizes && (Array.isArray(product.sizes) ? product.sizes.length > 0 : Object.keys(product.sizes).length > 0);
  const selectedSizeRemaining = selectedSize ? getRemainingStock(selectedSize) : null;

  const brandDisplay = product.brand || null;
  const subCategoryDisplay = (() => {
    if (product.subCategory) return product.subCategory;
    if (product.sub_category) return product.sub_category;
    if (Array.isArray(product.subCategories) && product.subCategories.length > 0)
      return product.subCategories.join(", ");
    return null;
  })();

  return (
    <>
      <div className="toast-container" aria-live="polite" aria-atomic="true">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type === "success" ? "success" : t.type === "error" ? "error" : ""}`}>
            <div className="toast-message">
              {t.type === "success" ? "✓" : t.type === "error" ? "!" : "i"}
              <span style={{ marginLeft: 8 }}>{t.message}</span>
            </div>
            <button className="toast-close" onClick={() => removeToast(t.id)} aria-label="Dismiss">×</button>
          </div>
        ))}
      </div>

      <div className="productdisplay">

      {/* ── Left: images ─────────────────────────────────────────────────── */}
      <div className="productdisplay-left">
        <div className="productdisplay-img-list">
          {activeSubImages.map((img, index) => (
            <img key={index} src={img} alt={`Product angle ${index}`}
              onClick={() => setMainImage(img)}
              className={`thumbnail ${mainImage === img ? "active" : ""}`}
            />
          ))}
        </div>
        <div className="productdisplay-img"
          ref={imgContainerRef}
          onMouseMove={handleMouseMove}
          onMouseEnter={() => setIsZooming(true)}
          onMouseLeave={() => setIsZooming(false)}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}>
          
          {/* Lifestyle Toggle */}
          {product.subImages && product.subImages.length > 0 && (
            <div className="lifestyle-toggle">
              <button 
                className={`lifestyle-btn ${!lifestyleMode ? 'active' : ''}`}
                onClick={() => { setLifestyleMode(false); setMainImage(product.image); }}
              >
                STUDIO
              </button>
              <button 
                className={`lifestyle-btn ${lifestyleMode ? 'active' : ''}`}
                onClick={() => { setLifestyleMode(true); setMainImage(product.subImages[0]); }}
              >
                LIFESTYLE
              </button>
            </div>
          )}

          <img
            ref={imageRef}
            className={`productdisplay-main-img ${lifestyleMode ? 'lifestyle-view' : ''}`}
            src={mainImage || product.image || "https://via.placeholder.com/400x400"}
            alt="Main product view"
            style={{
              transform: (isZooming || touchZoomed) ? "scale(1.5)" : "scale(1)",
              transformOrigin: touchZoomed
                ? `${touchOrigin.x}% ${touchOrigin.y}%`
                : `${zoomPosition.x}% ${zoomPosition.y}%`,
              transition: (isZooming || touchZoomed) ? "none" : "transform 0.3s ease",
            }}
          />
          {(isZooming || touchZoomed) && (
            <div className="zoom-indicator">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M12.5 12.5L17 17M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12z" stroke="white" strokeWidth="2" strokeLinecap="round" />
              </svg>
              {touchZoomed ? "Tap to zoom out • Drag to pan" : "Hover to zoom"}
            </div>
          )}
        </div>
      </div>

      {/* ── Right: product info ───────────────────────────────────────────── */}
      <div className="productdisplay-right">
        <div className="product-entrance-stagger">
          <p className="product-category-brand">{brandDisplay || "STREETWEAR"}</p>
          <h1>{product.name}</h1>
        </div>

        <div className="product-authenticity-seal">
          <div className="seal-content">
            <div className="seal-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div className="seal-text">
              <span className="seal-title">AUTHENTIC GUARANTEED</span>
              <span className="seal-sub">Verified by GOODSOLES experts</span>
            </div>
          </div>
        </div>

        {selectedColorway && !selectedColorway._isProductColorway && (
          <div className="colorway-active-badge">
            <span className="colorway-active-dot" style={{ background: selectedColorway.hex || "#ccc" }} />
            {selectedColorway.name}
          </div>
        )}

        <div className="productdisplay-right-stars">
          {Array.from({ length: 5 }, (_, i) => (
            <img key={i} src={i < Math.round(averageRating) ? star_icon : star_dull_icon}
              alt={i < Math.round(averageRating) ? "star" : "dull star"} />
          ))}
          <p>({reviewCount})</p>
        </div>

        <div className="productdisplay-right-prices">
          {Number.isFinite(extractPrice(product.old_price)) &&
            Number.isFinite(selectedSize ? displayPrice : lowestAvailablePrice) &&
            extractPrice(product.old_price) > (selectedSize ? displayPrice : lowestAvailablePrice) && (
              <div className="productdisplay-right-price-old">₱{formatPrice(product.old_price)}</div>
            )}
          <div className="productdisplay-right-price-new">
            {selectedSize ? (
              <>₱{formatPrice(displayPrice)}<span className="size-price-indicator"> (Size {selectedSize})</span></>
            ) : (
              <>
                {Number.isFinite(lowestAvailablePrice)
                  ? <><span className="from-label">From </span>₱{formatPrice(lowestAvailablePrice)}</>
                  : <div className="price-unavailable">Price unavailable</div>}
              </>
            )}
          </div>
        </div>

        <div className="productdisplay-right-description">
          {product.description || "No description available."}
        </div>

        {/* Shipping Upsell Message */}
        <div className="product-shipping-upsell">
          { (selectedSize ? displayPrice : lowestAvailablePrice) >= 5000 ? (
            <div className="upsell-qualified">
              <span className="upsell-line"></span>
              <p>This item qualifies for <strong>COMPLIMENTARY SHIPPING</strong></p>
            </div>
          ) : Number.isFinite(selectedSize ? displayPrice : lowestAvailablePrice) ? (
            <div className="upsell-pending">
              <span className="upsell-line" style={{ width: `${((selectedSize ? displayPrice : lowestAvailablePrice) / 5000) * 100}%` }}></span>
              <p>Add this to your bag and you're only <strong>₱{(5000 - (selectedSize ? displayPrice : lowestAvailablePrice)).toLocaleString()}</strong> away from elite delivery.</p>
            </div>
          ) : null}
        </div>

        {/* Category / Brand / Tags */}
        <div className="productdisplay-meta-tags">
          <span className="meta-tag">
            <span className="meta-tag-label">Category</span>
            <span className="meta-tag-value">{product.category}</span>
          </span>
          {brandDisplay && (
            <span className="meta-tag">
              <span className="meta-tag-label">Brand</span>
              <span className="meta-tag-value">{brandDisplay}</span>
            </span>
          )}
          <span className="meta-tag">
            <span className="meta-tag-label">Tags</span>
            <span className="meta-tag-value">{subCategoryDisplay || "—"}</span>
          </span>
        </div>

        {/* ── Colorway switcher ─────────────────────────────────────────── */}
        {(hasColorways || cwLoading) && (
          <div className="colorway-selector">
            <div className="colorway-selector-label">
              Color:
              <span className="colorway-selector-name">
                {/* Label shows the active colorway name, or the parent name if we're
                    currently viewing a child colorway product */}
                {selectedColorway && !selectedColorway._isProductColorway
                  ? selectedColorway.name
                  : product.parentId
                    ? product.name          // we ARE the colorway — show our own name
                    : "Default"}
              </span>
            </div>

            <div className="colorway-swatches">
              {/* Default swatch → always points to the base/parent product */}
              <button
                className={`colorway-swatch ${!product.parentId && !selectedColorway ? "active" : ""}`}
                onClick={handleDefaultColorway}
                title={parentProduct ? parentProduct.name : "Default"}
                type="button"
              >
                <img
                  src={parentProduct ? parentProduct.image : product.image}
                  alt={parentProduct ? parentProduct.name : "Default"}
                />
              </button>

              {/* All colorways (embedded + product-based children) */}
              {allColorways.map((cw, i) => {
                const isActive = cw._isProductColorway
                  ? String(cw._productId) === String(product.id)   // currently on this colorway's page
                  : selectedColorway?.name === cw.name;             // legacy embedded selection

                return (
                  <button
                    key={i}
                    className={`colorway-swatch ${isActive ? "active" : ""}`}
                    onClick={() => handleColorwayClick(cw)}
                    title={cw.name}
                    type="button"
                  >
                    {cw.image
                      ? <img src={cw.image} alt={cw.name} />
                      : <span className="colorway-hex-dot" style={{ background: cw.hex || "#ccc" }} />}
                  </button>
                );
              })}
            </div>

            {cwLoading && (
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>
                Loading colorways…
              </div>
            )}
          </div>
        )}

        {/* Size selector — non-simple products */}
        {!isSimpleCategory && hasSizes && (
          <div className="productdisplay-right-size">
            <div className="size-header">
              <h1>Select Size</h1>
              <Link to="/size-guide" className="size-guide-link">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M8 7V11M8 5V5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                Size Guide
              </Link>
            </div>

            {/* System tabs */}
            <div className="sz-tabs" role="tablist" aria-label="Size system">
              {SYSTEMS.map((sys) => (
                <button key={sys} className={`sz-tab ${sizeSystem === sys ? "active" : ""}`}
                  onClick={() => setSizeSystem(sys)} role="tab" aria-selected={sizeSystem === sys} type="button">
                  {sys}
                </button>
              ))}
            </div>

            {/* Dropdown */}
            <div className="size-dropdown" ref={sizeDropdownRef}>
              <button
                className={`sz-trigger ${!selectedSize ? "placeholder" : ""} ${sizeDropdownOpen ? "open" : ""}`}
                onClick={() => setSizeDropdownOpen((o) => !o)}
                type="button"
                aria-haspopup="listbox"
                aria-expanded={sizeDropdownOpen}
              >
                <div className="sz-trigger-left">
                  <span className="sz-trigger-label">{SYSTEM_LABELS[sizeSystem]}</span>
                  <span className={`sz-trigger-value ${!selectedSize ? "placeholder" : ""}`}>
                    {selectedSize ? convertSizeDisplay(selectedSize, sizeSystem) : "Choose a size"}
                  </span>
                </div>
                <svg className={`dropdown-chevron ${sizeDropdownOpen ? "open" : ""}`}
                  width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {sizeDropdownOpen && (
                <div className="sz-dropdown-menu" role="listbox">
                  {dynamicSizes.map((size) => {
                    const totalStock = getSizeStock(size);
                    const remaining = getRemainingStock(size);
                    const sizePrice = getSizePrice(size);
                    const isOutOfStock = totalStock === 0;
                    const isMaxedInCart = !isOutOfStock && remaining <= 0;
                    const dispVal = convertSizeDisplay(size, sizeSystem);
                    const crossRef = getCrossRef(size, sizeSystem);
                    return (
                      <button key={size}
                        className={`sz-dropdown-item ${selectedSize === size ? "active" : ""} ${isOutOfStock || isMaxedInCart ? "out-of-stock" : ""}`}
                        onClick={() => !isOutOfStock && !isMaxedInCart && handleSizeClick(size)}
                        disabled={isOutOfStock || isMaxedInCart}
                        type="button" role="option" aria-selected={selectedSize === size}
                      >
                        <div className="sz-item-left">
                          <span className="sz-item-size">{dispVal}</span>
                          <span className="sz-item-crossref">{crossRef}</span>
                        </div>
                        <div className="sz-item-right">
                          {isOutOfStock ? (
                            <span className="sz-item-oos">Out of stock</span>
                          ) : isMaxedInCart ? (
                            <span className="sz-item-oos">Max in bag</span>
                          ) : (
                            <>
                              <span className="sz-item-price">₱{formatPrice(sizePrice)}</span>
                              <span className="sz-item-stock">{remaining} left</span>
                            </>
                          )}
                        </div>
                        {selectedSize === size && (
                          <svg className="sz-item-check" width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M2.5 7l3 3 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {selectedSize && (
              <div className="sz-selection-bar">
                <span className="sz-selection-conversions">{getAllConversions(selectedSize)}</span>
                <span className="sz-selection-price">
                  {selectedSizeRemaining !== null && selectedSizeRemaining <= 3 && selectedSizeRemaining > 0 && (
                    <span className="sz-low-stock-hint">{selectedSizeRemaining} left · </span>
                  )}
                  ₱{formatPrice(displayPrice)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Simple category stock */}
        {isSimpleCategory && (
          <div className="productdisplay-simple-meta">
            <div className="simple-stock">
              {Number.isFinite(toNumber(product.stock)) ? (
                <span>
                  {(() => {
                    const total = Number(toNumber(product.stock));
                    const remaining = getSimpleRemaining();
                    if (total <= 0) return "Out of stock";
                    if (remaining <= 0) return "Max quantity in bag";
                    return `${remaining} in stock`;
                  })()}
                </span>
              ) : null}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="product-actions">
          <button className="add-to-cart-btn" onClick={handleAddToCart} disabled={addingToCart || addDisabled}>
            {addingToCart ? "Adding..." : addLabel}
          </button>
          <button
            className={`favorite-btn ${isFav ? "active" : ""}`}
            onClick={handleFavoriteClick}
            title={isFav ? "Remove from favorites" : "Add to favorites"}
            aria-pressed={isFav}
          >
            <svg width="24" height="24" viewBox="0 0 24 24"
              fill={isFav ? "currentColor" : "none"}
              stroke="currentColor" strokeWidth="1.5"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            <span>Favorite</span>
          </button>
        </div>
      </div>

      {/* ── Reviews ──────────────────────────────────────────────────────── */}
      <div className="productdisplay-reviews-right">
        <div className="reviews-header" onClick={() => setShowReviews(!showReviews)}>
          <h2>Reviews ({reviewCount})</h2>
          <span className={`arrow ${showReviews ? "open" : ""}`}>▼</span>
        </div>

        {showReviews && (
          <div className="reviews-content">
            {reviews.length === 0 ? (
              <div className="no-reviews-container">
                <p>No reviews yet.</p>
                <p className="no-reviews-subtitle">Purchase this product to leave a review.</p>
              </div>
            ) : (
              <div className="reviews-list">
                {reviews.map((r, i) => (
                  <div key={i} className="review-card">
                    <StarRow rating={r.rating} />
                    {r.title && <p className="review-title"><strong>{r.title}</strong></p>}
                    <p className="review-body">{r.review}</p>
                    <div className="review-meta">
                      {r.fit && <span className="review-tag">Fit: {r.fit}</span>}
                      {r.comfort && <span className="review-tag">Comfort: {r.comfort}</span>}
                      {r.recommend && <span className="review-tag">Recommends: {r.recommend}</span>}
                    </div>
                    {r.userName && r.userName !== "Anonymous" && (
                      <p className="review-author">— {r.userName}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  </>
);
};

export default ProductDisplay;
