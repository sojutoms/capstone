import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import "./productManagement.css";
import cross_icon from "../../assets/cross_icon.png";
import edit_icon from "../../assets/edit_icon.png";
import AddProduct from "../AddProduct/AddProduct";
import CategoryBrandManager from "../CategoryBrandManager/CategoryBrandManager";
import upload_area from "../../assets/upload_area.svg";
import API_BASE_URL, { authorizedFetch } from "../../services/api";
import { Toasts, useToastManager } from "../Shared/ToastManager";
import StockIndicator from "../Shared/StockIndicator";
import ColorwayTab from "./ColorwayTab";
import StockTab from "./StockTab";



// ─── Constants ────────────────────────────────────────────────────────────────
const SIMPLE_CATEGORIES = ["watch", "bags", "collectibles"];
const SHOE_SUBCATEGORIES = ["lifestyle", "running", "football", "basketball"];
const FALLBACK_SHOE_SIZES = ["6", "6.5", "7", "7.5", "8", "8.5", "9", "9.5", "10", "10.5", "11", "11.5", "12", "12.5", "13"];





function sizesArrayOrMapToMap(sizes = {}, defaultPrice = 0) {
  const out = {};
  if (!sizes) return out;
  if (Array.isArray(sizes)) {
    for (const e of sizes) {
      if (!e || !e.size) continue;
      out[String(e.size)] = { quantity: Number(e.quantity || 0), price: Number(e.price || defaultPrice) };
    }
    return out;
  }
  for (const [k, v] of Object.entries(sizes || {})) {
    if (v == null) continue;
    out[k] = typeof v === "object"
      ? { quantity: Number(v.quantity || 0), price: Number(v.price !== undefined ? v.price : defaultPrice) }
      : { quantity: Number(v || 0), price: defaultPrice };
  }
  return out;
}

const shoeSizes = FALLBACK_SHOE_SIZES;

const buildSizesFromSequences = (sequences = []) => {
  const out = {};
  sequences.forEach((seq) => {
    const size = String(seq.size || "—");
    if (!out[size]) out[size] = { quantity: 0, price: 0 };
    if (seq.status === "available") {
      out[size].quantity += 1;
      const p = Number(seq.productPrice || seq.price || 0);
      if (p > 0) out[size].price = p;
    }
  });
  return out;
};

const PRICE_REASONS = [
  { value: "clearance", label: "🏷️ Clearance / Sale", hint: "Moving old stock at reduced price" },
  { value: "correction", label: "✏️ Price Correction", hint: "Fix an incorrectly entered price" },
  { value: "restock", label: "📦 New Batch / Market Update", hint: "Prices changed with latest supply" },
  { value: "markdown", label: "📉 Permanent Markdown", hint: "Competitive price adjustment" },
];

function fmtPrice(n) {
  if (!n || Number(n) === 0) return "—";
  return `₱${Number(n).toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const makeEditColorway = (cw = {}) => ({
  name: cw.name || "",
  hex: cw.hex || "#000000",
  image: cw.image || "",
  subImages: Array.isArray(cw.subImages) ? cw.subImages : [],
  _newMainFile: null,
  _newMainPreview: "",
  _newSubFiles: [],
  _newSubPreviews: [],
});

const sanitizeCurrencyInput = (raw) => {
  if (raw === null || raw === undefined) return "";
  let v = String(raw).replace(/[,\s]/g, "").replace(/[^\d.]/g, "");
  const parts = v.split(".");
  if (parts.length > 1) v = parts[0] + "." + parts.slice(1).join("");
  if (v.includes(".")) { const [i, d] = v.split("."); v = i + "." + d.slice(0, 2); }
  if (v.startsWith("00") && !v.startsWith("0.")) v = v.replace(/^0+/, "0");
  return v;
};

const priceStringToCents = (s) => {
  const clean = sanitizeCurrencyInput(s);
  if (clean === "" || clean === ".") return NaN;
  const n = Number(clean);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
};


// ═══════════════════════════════════════════════════════════════════════════════
// ─── Main ProductManagement ───────────────────────────────────────════════════
// ═══════════════════════════════════════════════════════════════════════════════
const ProductManagement = () => {
  const adminRoles = JSON.parse(sessionStorage.getItem("admin-roles") || "[]");
  const isOwner = adminRoles.includes("owner");
  const isAdmin = adminRoles.includes("admin");
  const isStaff = adminRoles.includes("staff");
  const isInventoryStaff = adminRoles.includes("inventory_staff");

  const CAN = {
    addProducts: isOwner || isAdmin,
    editProducts: isOwner || isAdmin,
    removeProducts: isOwner || isAdmin,
    addStock: isOwner || isAdmin || isInventoryStaff,
    viewProducts: true,
    manageCategories: isOwner,
  };

  const [tab, setTab] = useState("products");
  const [allproducts, setAllProducts] = useState([]);
  const [allSequences, setAllSequences] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editedDetails, setEditedDetails] = useState(null);

  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedBrand, setSelectedBrand] = useState("all");
  const [productPage, setProductPage] = useState(1);
  const [showDeleted, setShowDeleted] = useState(false);
  const [stockFilter, setStockFilter] = useState("all");
  // New: filter to show only base products or only colorways
  const [colorwayFilter, setColorwayFilter] = useState("all"); // "all" | "base" | "colorway"
  const itemsPerPage = 12;

  const { toasts, showToast, removeToast } = useToastManager();

  const showDeletedRef = useRef(showDeleted);
  useEffect(() => { showDeletedRef.current = showDeleted; }, [showDeleted]);

  const fetchMeta = useCallback(async () => {
    try {
      const [catRes, brandRes] = await Promise.all([authorizedFetch("/categories"), authorizedFetch("/brands")]);
      const catData = await catRes.json();
      const brandData = await brandRes.json();
      if (catData.success) setCategories(catData.categories || []);
      if (brandData.success) setBrands(brandData.brands || []);
    } catch (e) { console.error("Failed to load meta:", e); }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await authorizedFetch(`/allproducts?showDeleted=${showDeletedRef.current}`);
      const data = await res.json();
      setAllProducts(data || []);
    } catch {
      setAllProducts([]);
      showToast({ message: "Failed to load products", type: "error" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchSequences = useCallback(async () => {
    try {
      const data = await authorizedFetch("/allsequences").then((r) => r.json());
      setAllSequences(Array.isArray(data) ? data : []);
    } catch { setAllSequences([]); }
  }, []);

  useEffect(() => { fetchProducts(); fetchSequences(); fetchMeta(); }, [fetchProducts, fetchSequences, fetchMeta]);
  useEffect(() => { fetchProducts(); }, [showDeleted, fetchProducts]);

  useEffect(() => {
    const onStockUpdated = () => { fetchProducts(); fetchSequences(); };
    window.addEventListener("stock-updated", onStockUpdated);
    window.addEventListener("skus-updated", onStockUpdated);
    return () => { window.removeEventListener("stock-updated", onStockUpdated); window.removeEventListener("skus-updated", onStockUpdated); };
  }, [fetchProducts, fetchSequences]);

  const liveStockByProduct = useMemo(() => {
    const grouped = {};
    allSequences.forEach((seq) => {
      const pid = String(seq.productId);
      if (!grouped[pid]) grouped[pid] = [];
      grouped[pid].push(seq);
    });
    const result = {};
    Object.entries(grouped).forEach(([pid, seqs]) => { result[pid] = buildSizesFromSequences(seqs); });
    return result;
  }, [allSequences]);

  const getEffectiveSizes = useCallback((product) => {
    const isSimple = SIMPLE_CATEGORIES.includes((product.category || "").toLowerCase());
    if (isSimple) {
      const availSeqs = allSequences.filter((s) => String(s.productId) === String(product.id) && s.status === "available");
      const qty = availSeqs.length > 0 ? availSeqs.length : Number(product.stock || 0);
      const price = availSeqs.length > 0
        ? Number(availSeqs[availSeqs.length - 1]?.productPrice || availSeqs[availSeqs.length - 1]?.price || product.price || 0)
        : Number(product.price || 0);
      return { single: { quantity: qty, price } };
    }
    const fromSeqs = liveStockByProduct[String(product.id)];
    if (fromSeqs && Object.keys(fromSeqs).length > 0) {
      const productSizes = sizesArrayOrMapToMap(product.sizes || {}, 0);
      const merged = { ...fromSeqs };
      Object.entries(productSizes).forEach(([size, obj]) => { if (!merged[size]) merged[size] = { quantity: 0, price: obj.price || 0 }; });
      return merged;
    }
    return sizesArrayOrMapToMap(product.sizes || {}, 0);
  }, [allSequences, liveStockByProduct]);

  const brandsForSelectedCategory = selectedCategory === "all" ? brands : brands.filter((b) => b.parentCategory === selectedCategory);
  const handleCategoryChange = (cat) => { setSelectedCategory(cat); setSelectedBrand("all"); setProductPage(1); };

  const confirmAndRemoveProduct = (id, name) => {
    showToast({
      message: `Remove product "${name}"?`, type: "warning", duration: 0,
      actions: [
        { label: "Cancel", variant: "muted", onClick: () => { } },
        {
          label: "Remove", variant: "danger", onClick: async () => {
            try {
              await authorizedFetch("/removeproduct", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
              await fetchProducts();
              showToast({ message: "Product removed", type: "success" });
            } catch { showToast({ message: "Failed to remove product", type: "error" }); }
          }
        },
      ],
    });
  };

  const remove_product = (id) => { const p = allproducts.find((p) => p.id === id) || {}; confirmAndRemoveProduct(id, p.name || "product"); };
  const restore_product = async (id) => {
    try {
      await authorizedFetch("/restoreproduct", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      await fetchProducts();
      showToast({ message: "Product restored", type: "success" });
    } catch { showToast({ message: "Failed to restore product", type: "error" }); }
  };

  // ── Edit helpers ────────────────────────────────────────────────────────────
  const startEdit = (product) => {
    setEditingProduct(product);
    const isSimple = SIMPLE_CATEGORIES.includes((product.category || "").toLowerCase());
    const colorways = Array.isArray(product.colorways)
      ? product.colorways.map((cw) => makeEditColorway(cw))
      : [];

    if (isSimple) {
      setEditedDetails({ ...product, price: product.price !== undefined ? Number(product.price) : 0, stock: product.stock !== undefined ? Number(product.stock) : 0, sizes: {}, subCategories: [], colorways });
      return;
    }
    const liveSizes = getEffectiveSizes(product);
    const editedSizes = shoeSizes.reduce((acc, s) => { acc[s] = { quantity: liveSizes[s]?.quantity || 0, price: liveSizes[s]?.price || 0 }; return acc; }, {});
    setEditedDetails({ ...product, sizes: editedSizes, subCategories: Array.isArray(product.subCategories) ? product.subCategories : [], colorways });
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    if (name === "category") {
      const isSimple = SIMPLE_CATEGORIES.includes(value.toLowerCase());
      setEditedDetails((prev) => ({ ...prev, [name]: value, subCategories: isSimple ? [] : (prev.subCategories || []) }));
      return;
    }
    setEditedDetails((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubCategoryToggle = (sc) => {
    setEditedDetails((prev) => {
      const current = Array.isArray(prev.subCategories) ? prev.subCategories : [];
      return { ...prev, subCategories: current.includes(sc) ? current.filter((x) => x !== sc) : [...current, sc] };
    });
  };

  const handleImageChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setEditedDetails((prev) => ({ ...prev, image: reader.result }));
    reader.readAsDataURL(file);
  };

  const addEditColorway = () =>
    setEditedDetails((prev) => ({ ...prev, colorways: [...(prev.colorways || []), makeEditColorway()] }));

  const removeEditColorway = (i) =>
    setEditedDetails((prev) => ({ ...prev, colorways: (prev.colorways || []).filter((_, idx) => idx !== i) }));

  const updateEditColorway = (i, field, value) =>
    setEditedDetails((prev) => ({
      ...prev,
      colorways: (prev.colorways || []).map((cw, idx) => idx === i ? { ...cw, [field]: value } : cw),
    }));

  const handleEditColorwayMainImage = (i, file) => {
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setEditedDetails((prev) => ({
      ...prev,
      colorways: (prev.colorways || []).map((cw, idx) =>
        idx === i ? { ...cw, _newMainFile: file, _newMainPreview: preview } : cw
      ),
    }));
  };

  const handleEditColorwaySubImages = (i, files) => {
    const arr = Array.from(files).slice(0, 4);
    setEditedDetails((prev) => ({
      ...prev,
      colorways: (prev.colorways || []).map((cw, idx) =>
        idx === i ? { ...cw, _newSubFiles: arr, _newSubPreviews: arr.map((f) => URL.createObjectURL(f)) } : cw
      ),
    }));
  };

  const saveEdit = async () => {
    if (!editingProduct || !editedDetails) return;
    const token = sessionStorage.getItem("admin-token") || "";
    const cat = ((editedDetails.category || editingProduct.category) || "").toLowerCase();
    const isSimple = SIMPLE_CATEGORIES.includes(cat);
    const authH = { "Content-Type": "application/json", ...(token ? { "auth-token": token } : {}) };

    try {
      const finalColorways = [];
      for (const cw of (editedDetails.colorways || [])) {
        let mainUrl = cw.image || "";
        let subUrls = cw.subImages || [];
        if (cw._newMainFile) {
          const fd = new FormData();
          fd.append("product", cw._newMainFile);
          const r = await authorizedFetch("/upload", { method: "POST", body: fd });
          const d = await r.json();
          if (d.success) mainUrl = d.image_url;
        }
        if (cw._newSubFiles?.length > 0) {
          const fd = new FormData();
          cw._newSubFiles.forEach((f) => fd.append("product", f));
          const r = await authorizedFetch("/upload-multiple", { method: "POST", body: fd });
          const d = await r.json();
          if (d.success) subUrls = d.image_urls;
        }
        finalColorways.push({ name: cw.name.trim(), hex: cw.hex || "", image: mainUrl, subImages: subUrls });
      }

      if (isSimple) {
        const epRes = await authorizedFetch("/editproduct", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editingProduct.id, name: editedDetails.name, category: editedDetails.category, brand: editedDetails.brand || "", description: editedDetails.description, image: editedDetails.image, subImages: editedDetails.subImages || [], subCategories: [], colorways: finalColorways, price: Number(editingProduct.price || 0), stock: Number(editingProduct.stock || 0), sizes: [] }) });
        const epBody = await epRes.json().catch(() => ({}));
        if (!epRes.ok) { showToast({ message: epBody.error || "Failed to save product", type: "error" }); return; }
      } else {
        const liveSizes = getEffectiveSizes(editingProduct);
        const sizesPayloadArray = shoeSizes.map((s) => ({ size: String(s), quantity: Number(liveSizes[s]?.quantity || 0), price: Number(liveSizes[s]?.price || 0) }));
        const epRes = await authorizedFetch("/editproduct", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editingProduct.id, name: editedDetails.name, category: editedDetails.category, brand: editedDetails.brand || "", description: editedDetails.description, image: editedDetails.image, subImages: editedDetails.subImages || [], subCategories: editedDetails.subCategories || [], colorways: finalColorways, sizes: sizesPayloadArray }) });
        const epBody = await epRes.json().catch(() => ({}));
        if (!epRes.ok) { showToast({ message: epBody.error || "Failed to save product", type: "error" }); return; }
      }

      setEditingProduct(null);
      setEditedDetails(null);
      showToast({ message: "Product details updated", type: "success" });
      fetchProducts().catch(console.error);
      fetchSequences().catch(console.error);
    } catch { showToast({ message: "Failed to save product", type: "error" }); }
  };

  // ─── Search/Filter States ───
  const [viewMode, setViewMode] = useState("grid"); // grid | list
  let filteredProducts = [...allproducts];

  if (colorwayFilter === "base") filteredProducts = filteredProducts.filter((p) => !p.parentId);
  if (colorwayFilter === "colorway") filteredProducts = filteredProducts.filter((p) => !!p.parentId);

  if (stockFilter === "low") filteredProducts = filteredProducts.filter((p) => {
    const sizes = getEffectiveSizes(p);
    if (SIMPLE_CATEGORIES.includes((p.category || "").toLowerCase())) { const qty = sizes.single?.quantity ?? Number(p.stock || 0); return qty > 0 && qty <= 3; }
    return Object.values(sizes).some((obj) => obj.quantity > 0 && obj.quantity <= 3);
  });
  else if (stockFilter === "out") filteredProducts = filteredProducts.filter((p) => {
    const sizes = getEffectiveSizes(p);
    if (SIMPLE_CATEGORIES.includes((p.category || "").toLowerCase())) { const qty = sizes.single?.quantity ?? Number(p.stock || 0); return qty === 0; }
    return Object.values(sizes).some((obj) => obj.quantity === 0);
  });

  if (selectedCategory !== "all") filteredProducts = filteredProducts.filter((p) => (p.category || "").toLowerCase() === selectedCategory.toLowerCase());
  if (selectedBrand !== "all") filteredProducts = filteredProducts.filter((p) => (p.brand || "").toLowerCase() === selectedBrand.toLowerCase());

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (a.createdAt && b.createdAt) return new Date(b.createdAt) - new Date(a.createdAt);
    if (typeof a.id === "number" && typeof b.id === "number") return b.id - a.id;
    return String(b.id || "").localeCompare(String(a.id || ""));
  });

  const totalProductPages = Math.max(1, Math.ceil(sortedProducts.length / itemsPerPage));
  const paginatedProducts = sortedProducts.slice((productPage - 1) * itemsPerPage, productPage * itemsPerPage);

  const totalProducts = allproducts.filter((p) => !p.isDeleted && !p.parentId).length;
  const colorwayProducts = allproducts.filter((p) => !p.isDeleted && !!p.parentId).length;
  const lowStockCount = allproducts.filter((p) => {
    if (p.isDeleted) return false;
    const sizes = getEffectiveSizes(p);
    if (SIMPLE_CATEGORIES.includes((p.category || "").toLowerCase())) { const qty = sizes.single?.quantity ?? Number(p.stock || 0); return qty > 0 && qty <= 3; }
    return Object.values(sizes).some((obj) => obj.quantity > 0 && obj.quantity <= 3);
  }).length;
  const outOfStockCount = allproducts.filter((p) => {
    if (p.isDeleted) return false;
    const sizes = getEffectiveSizes(p);
    if (SIMPLE_CATEGORIES.includes((p.category || "").toLowerCase())) { const qty = sizes.single?.quantity ?? Number(p.stock || 0); return qty === 0; }
    return Object.values(sizes).some((obj) => obj.quantity === 0);
  }).length;

  const renderProductRow = (product, idx) => {
    const id = product.id ?? idx;
    const isColorway = !!product.parentId;
    const displaySizes = getEffectiveSizes(product);
    const totalStock = Object.values(displaySizes).reduce((sum, obj) => sum + Number(obj.quantity || 0), 0);
    const priceValues = Object.values(displaySizes).map((s) => Number(s.price || 0)).filter((p) => p > 0);
    const minPrice = priceValues.length > 0 ? Math.min(...priceValues) : 0;
    const maxPrice = priceValues.length > 0 ? Math.max(...priceValues) : 0;

    return (
      <div key={id} className={`product-list-row ${product.isDeleted ? "deleted" : ""}`}>
        <div className="row-cell cell-img"><img src={product.image} alt="" /></div>
        <div className="row-cell cell-info">
          <div className="row-name">{product.name}</div>
          <div className="row-sku">SKU #{product.id} {isColorway && `(Parent: #${product.parentId})`}</div>
        </div>
        <div className="row-cell cell-cat">{product.category}</div>
        <div className="row-cell cell-brand">{product.brand || "—"}</div>
        <div className="row-cell cell-price">{minPrice > 0 ? `₱${minPrice.toLocaleString()}` : "—"}</div>
        <div className="row-cell cell-stock">
          <span className={`stock-pill-small ${totalStock <= 3 ? "danger" : totalStock <= 5 ? "warning" : "ok"}`}>
            {totalStock} units
          </span>
        </div>
        <div className="row-cell cell-actions">
          <button onClick={() => startEdit(product)} className="action-btn"><img src={edit_icon} alt="Edit" /></button>
          {!product.isDeleted ? (
            <button onClick={() => remove_product(product.id)} className="action-btn"><img src={cross_icon} alt="Remove" /></button>
          ) : (
            <button onClick={() => restore_product(product.id)} className="restore-link">Restore</button>
          )}
        </div>
      </div>
    );
  };

  const renderProductCard = (product, idx) => {
    const id = product.id ?? idx;
    const isSimple = SIMPLE_CATEGORIES.includes((product.category || "").toLowerCase());
    const isColorway = !!product.parentId;
    const displaySizes = getEffectiveSizes(product);
    const totalStock = Object.values(displaySizes).reduce((sum, obj) => sum + Number(obj.quantity || 0), 0);
    const lowSizesList = Object.fromEntries(Object.entries(displaySizes).filter(([, obj]) => obj.quantity > 0 && obj.quantity <= 3));
    const outSizesList = Object.fromEntries(Object.entries(displaySizes).filter(([, obj]) => obj.quantity === 0));
    const highlightMode = stockFilter === "low" ? "low" : stockFilter === "out" ? "out" : null;
    const priceValues = Object.values(displaySizes).map((s) => Number(s.price || 0)).filter((p) => p > 0);
    const minPrice = priceValues.length > 0 ? Math.min(...priceValues) : 0;
    const maxPrice = priceValues.length > 0 ? Math.max(...priceValues) : 0;
    const subCats = Array.isArray(product.subCategories) ? product.subCategories : [];
    const cwCount = isColorway ? 0 : allproducts.filter((x) => x.parentId === product.id && !x.isDeleted).length;

    // Find parent name for colorway badge
    const parentProduct = isColorway ? allproducts.find((p) => p.id === product.parentId) : null;

    return (
      <div key={id} className={`listproduct-item stagger-item ${product.isDeleted ? "deleted" : ""}`}>
        <div className="listproduct-format">
          {product.isDeleted && <span className="deleted-badge">Deleted</span>}
          <div className="product-card-header">
            <div className="product-card-img-wrapper">
              <img src={product.image} alt={product.name} className="listproduct-product-icon" />
              {isColorway && (
                <div className="acw-parent-badge-mini" title={`Colorway of ${parentProduct ? parentProduct.name : `#${product.parentId}`}`}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M1 2h4a3 3 0 0 1 0 6H1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
              )}
            </div>
            <div className="product-card-info">
              <div className="product-card-top">
                <span className="prod-sku-pill">#{product.id}</span>
                {product.brand && <span className="prod-brand-pill">{product.brand}</span>}
              </div>
              <h3 className="prod-title">{product.name}</h3>
              <div className="product-prices">
                <span className="prod-price-range">{minPrice > 0 ? `₱${minPrice.toLocaleString()}${minPrice !== maxPrice ? ` – ₱${maxPrice.toLocaleString()}` : ""}` : "—"}</span>
              </div>
              <div className="product-tags-row">
                <span className="prod-tag-mini">{product.category}</span>
                {subCats.slice(0, 2).map((sc) => <span key={sc} className="prod-tag-mini accent">{sc}</span>)}
                {cwCount > 0 && <span className="prod-tag-mini info">{cwCount} CW</span>}
              </div>
            </div>
          </div>
          {!isSimple ? (
            <StockIndicator sizes={displaySizes} highlightOnly={highlightMode} />
          ) : (
            <div className="stock-indicator">
              <div className="stock-label">Stock</div>
              <div className={`total-stock ${totalStock <= 5 ? "warning" : ""} ${totalStock <= 3 ? "danger" : ""}`}>{totalStock} item{totalStock !== 1 ? "s" : ""}</div>
            </div>
          )}
          {!isSimple && stockFilter === "low" && Object.keys(lowSizesList).length > 0 && (
            <div className="low-stock-sizes"><strong>Low stock sizes:</strong>{" "}{Object.entries(lowSizesList).map(([size, obj]) => <span key={size} className="low-size">{size} ({obj.quantity})</span>)}</div>
          )}
          {!isSimple && stockFilter === "out" && (
            <div className="out-stock-sizes"><strong>Out of stock sizes:</strong>{" "}{Object.keys(outSizesList).length > 0 ? Object.keys(outSizesList).map((size) => <span key={size} className="out-size">{size}</span>) : <span className="out-size">None</span>}</div>
          )}
          {!product.isDeleted && CAN.editProducts && (
            <div className="listproduct-action-icons">
              <img onClick={() => startEdit(product)} className="listproduct-edit-icon" src={edit_icon} alt="Edit" />
              <img onClick={() => remove_product(product.id)} className="listproduct-remove-icon" src={cross_icon} alt="Remove" />
            </div>
          )}
          {product.isDeleted && CAN.editProducts && <button className="restore-btn" onClick={() => restore_product(product.id)}>Restore Product</button>}
          {isStaff && !isAdmin && !isOwner && <div className="readonly-badge">View Only</div>}
        </div>
      </div>
    );
  };

  return (
    <div className="product-management animate-in">
      <div className="panel-header">
        <h1 className="chrome-text">PRODUCT MANAGEMENT</h1>
        {isStaff && !isAdmin && !isOwner && <div className="role-context-banner">Logged in as &nbsp;<strong>Staff</strong> — view only.</div>}
        {isInventoryStaff && !isAdmin && !isOwner && <div className="role-context-banner inventory">Logged in as &nbsp;<strong>Inventory Staff</strong> — stock only.</div>}
        {isAdmin && !isOwner && <div className="role-context-banner admin">Logged in as &nbsp;<strong>Admin</strong> — full access.</div>}
        {isOwner && <div className="role-context-banner owner">Logged in as &nbsp;<strong>Owner</strong> — full access.</div>}
      </div>

      <div className="tab-navigation glass-strong">
        <button className={`page-btn ${tab === "products" ? "active" : ""}`} onClick={() => setTab("products")}>Products</button>
        {CAN.addProducts && <button className={`page-btn ${tab === "add" ? "active" : ""}`} onClick={() => setTab("add")}>Add Product</button>}
        {CAN.addProducts && <button className={`page-btn ${tab === "colorway" ? "active" : ""}`} onClick={() => setTab("colorway")}>Add Colorway</button>}
        {CAN.addStock && <button className={`page-btn ${tab === "addstock" ? "active" : ""}`} onClick={() => setTab("addstock")}>Add Stock</button>}
        {CAN.manageCategories && <button className={`page-btn ${tab === "categories" ? "active" : ""}`} onClick={() => setTab("categories")}>Categories & Brands</button>}
      </div>

      {tab === "products" && (
        <>
          {CAN.editProducts && (
            <div className="dashboard-stats">
              <div className="stat-card glass stagger-1"><div className="stat-label">Base Products</div><div className="stat-value">{totalProducts}</div><div className="stat-change">Active inventory</div></div>
              <div className="stat-card glass stagger-2"><div className="stat-label">Colorways</div><div className="stat-value">{colorwayProducts}</div><div className="stat-change">Color variants</div></div>
              <div className="stat-card glass stagger-3"><div className="stat-label">Low Stock</div><div className="stat-value">{lowStockCount}</div><div className="stat-change negative">≤3 pairs</div></div>
              <div className="stat-card glass stagger-4"><div className="stat-label">Out of Stock</div><div className="stat-value">{outOfStockCount}</div><div className="stat-change negative">Any size at 0</div></div>
            </div>
          )}
          <div className="listproduct-controls glass">
            <div className="left-controls">
              <div className="view-mode-toggle">
                <button className={`view-btn ${viewMode === "grid" ? "active" : ""}`} onClick={() => setViewMode("grid")}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                </button>
                <button className={`view-btn ${viewMode === "list" ? "active" : ""}`} onClick={() => setViewMode("list")}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                </button>
              </div>
              <label className="category-label">Category</label>
              <select className="category-select" value={selectedCategory} onChange={(e) => handleCategoryChange(e.target.value)}>
                <option value="all">All Categories</option>
                {categories.map((cat) => <option key={cat.slug} value={cat.slug}>{cat.name}</option>)}
              </select>
              <div className="filter-chips">
                {["all", "low", "out"].map((f) => (
                  <button key={f} className={`filter-chip ${stockFilter === f ? "active" : ""}`} onClick={() => { setStockFilter(f); setProductPage(1); }}>
                    {f === "all" ? "All Stock" : f === "low" ? "Low Stock" : "Out of Stock"}
                  </button>
                ))}
              </div>
            </div>
            <div className="right-controls">
              <div className="results-count">{sortedProducts.length} results</div>
            </div>
          </div>

          {viewMode === "grid" ? (
            <div className="listproduct-allproducts">
              {paginatedProducts.length === 0 && <div className="no-products">No products found</div>}
              {paginatedProducts.map(renderProductCard)}
            </div>
          ) : (
            <div className="listproduct-list-view glass animate-in">
              <div className="list-view-header">
                <div className="header-cell cell-img">Img</div>
                <div className="header-cell cell-info">Product Name / SKU</div>
                <div className="header-cell cell-cat">Category</div>
                <div className="header-cell cell-brand">Brand</div>
                <div className="header-cell cell-price">Price</div>
                <div className="header-cell cell-stock">Stock</div>
                <div className="header-cell cell-actions">Actions</div>
              </div>
              <div className="list-view-body">
                {paginatedProducts.length === 0 && <div className="no-products">No products found</div>}
                {paginatedProducts.map(renderProductRow)}
              </div>
            </div>
          )}

          <div className="listproduct-pagination">
            <button className="page-btn" onClick={() => setProductPage((p) => Math.max(p - 1, 1))} disabled={productPage === 1}>Previous</button>
            <div className="page-info">Page {productPage} of {totalProductPages}</div>
            <button className="page-btn" onClick={() => setProductPage((p) => Math.min(p + 1, totalProductPages))} disabled={productPage === totalProductPages}>Next</button>
          </div>
        </>
      )}


      {tab === "add" && (
        CAN.addProducts
          ? <div style={{ marginTop: 24, width: "100%" }}>
            <AddProduct onAdded={async (newProductId) => {
              try { await fetchProducts(); await fetchSequences(); if (newProductId) showToast({ message: `Product added — SKU #${newProductId} assigned`, type: "success" }); }
              catch { showToast({ message: "Product added but list refresh failed", type: "warning" }); }
            }} />
          </div>
          : <div className="access-denied">Only Owners and Admins can add products.</div>
      )}

      {tab === "colorway" && (
        CAN.addProducts
          ? <ColorwayTab
            allproducts={allproducts}
            getEffectiveSizes={getEffectiveSizes}
            showToast={showToast}
            onColorwayAdded={() => { fetchProducts(); fetchSequences(); }}
          />
          : <div className="access-denied">Only Owners and Admins can add colorways.</div>
      )}

      {tab === "addstock" && (
        CAN.addStock
          ? <StockTab
            allproducts={allproducts}
            getEffectiveSizes={getEffectiveSizes}
            showToast={showToast}
            onStockUpdated={() => { fetchProducts(); fetchSequences(); }}
          />
          : <div className="access-denied">You don't have permission to update stock.</div>
      )}

      {tab === "categories" && (
        CAN.manageCategories
          ? <div style={{ marginTop: 24, width: "100%" }}><CategoryBrandManager showToast={showToast} /></div>
          : <div className="access-denied">🔒 Only the Owner can manage categories and brands.</div>
      )}

      {/* ── Edit Modal ──────────────────────────────────────────────────────── */}
      {editingProduct && editedDetails && CAN.editProducts && (
        <div className="edit-modal-overlay" onClick={() => { setEditingProduct(null); setEditedDetails(null); }}>
          <div className="edit-modal-content glass-strong" onClick={e => e.stopPropagation()}>
            <div className="edit-modal-header">
              <div className="header-left">
                <h1 className="chrome-text">EDIT PRODUCT</h1>
                <div className="header-meta">
                  {editedDetails.parentId && <span className="m-badge-cw">COLORWAY</span>}
                  <span className="m-sku-ref">SKU #{editingProduct.id}</span>
                </div>
              </div>
              <button className="m-close-btn" onClick={() => { setEditingProduct(null); setEditedDetails(null); }}>✕</button>
            </div>

            <div className="edit-modal-grid">
              <div className="edit-modal-left">
                <form id="product-edit-form" className="edit-modal-form" onSubmit={(e) => { e.preventDefault(); saveEdit(); }}>
                  <div className="form-section">
                    <label className="form-label">PRODUCT TITLE</label>
                    <input className="form-input-luxe" type="text" name="name" value={editedDetails.name} onChange={handleEditChange} placeholder="Enter product title..." required />
                  </div>

                  {editedDetails.parentId ? (
                    <div className="edit-inheritance-banner glass-medium">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M7 17l9.2-9.2M17 17V7H7" />
                      </svg>
                      <span>Inherited from parent: <strong>{editedDetails.category}</strong> {editedDetails.brand && ` · ${editedDetails.brand}`}</span>
                    </div>
                  ) : (
                    <div className="form-row">
                      <div className="form-section">
                        <label className="form-label">CATEGORY</label>
                        <select className="form-select-luxe" name="category" value={editedDetails.category} onChange={handleEditChange}>
                          {categories.map((cat) => <option key={cat.slug} value={cat.slug}>{cat.name}</option>)}
                        </select>
                      </div>
                      <div className="form-section">
                        <label className="form-label">BRAND</label>
                        <select className="form-select-luxe" name="brand" value={editedDetails.brand || ""} onChange={handleEditChange}>
                          <option value="">No brand</option>
                          {brands.filter((b) => b.parentCategory === editedDetails.category).map((b) => <option key={b.slug} value={b.slug}>{b.name}</option>)}
                        </select>
                      </div>
                    </div>
                  )}

                  {!SIMPLE_CATEGORIES.includes((editedDetails.category || "").toLowerCase()) && (
                    <div className="form-section">
                      <label className="form-label">SUB CATEGORIES</label>
                      <div className="edit-subcat-grid">
                        {SHOE_SUBCATEGORIES.map((sc) => {
                          const checked = Array.isArray(editedDetails.subCategories) && editedDetails.subCategories.includes(sc);
                          return (
                            <label key={sc} className={`cbm-subcategory-toggle ${checked ? "active" : ""}`}>
                              <input type="checkbox" checked={checked} onChange={() => handleSubCategoryToggle(sc)} />
                              {sc}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="form-section">
                    <label className="form-label">DESCRIPTION</label>
                    <textarea className="form-input-luxe" name="description" value={editedDetails.description} onChange={handleEditChange} rows={4} placeholder="Product storytelling..." />
                  </div>

                  <div className="inventory-preview-box glass-medium">
                    <div className="box-header">
                      <span className="box-title">INVENTORY STATUS</span>
                      <span className="box-badge">LIVE VIEW</span>
                    </div>
                    
                    <div className="inventory-scroll-area">
                      {SIMPLE_CATEGORIES.includes((editedDetails.category || "").toLowerCase()) ? (
                        <div className="simple-stock-row">
                          <div className="stock-stat"><span className="stat-key">Units</span><span className="stat-val">{getEffectiveSizes(editingProduct).single?.quantity ?? Number(editingProduct.stock || 0)}</span></div>
                          <div className="stock-stat"><span className="stat-key">Price</span><span className="stat-val">₱{Number(getEffectiveSizes(editingProduct).single?.price || editingProduct.price || 0).toLocaleString()}</span></div>
                        </div>
                      ) : (
                        <div className="sizes-grid-luxe">
                          {(() => {
                            const liveSizes = getEffectiveSizes(editingProduct);
                            return shoeSizes.map((size) => {
                              const qty = liveSizes[size]?.quantity || 0;
                              const price = liveSizes[size]?.price || 0;
                              if (qty === 0 && price === 0) return null;
                              return (
                                <div key={size} className="size-card-mini">
                                  <span className="size-num">{size}</span>
                                  <div className="size-info">
                                    <span className="size-qty">{qty} units</span>
                                    <span className="size-price">₱{price.toLocaleString()}</span>
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      )}
                    </div>
                    <div className="box-hint">Use <strong>Add Stock</strong> tab to manage prices and inventory.</div>
                  </div>
                </form>
              </div>

              <div className="edit-modal-right">
                <div className="visual-section">
                  <label className="form-label">PRODUCT VISUAL</label>
                  <div className="image-preview-wrapper">
                    <img src={editedDetails.image || upload_area} alt="Preview" className="image-main" />
                    <label className="image-action-overlay">
                      <input type="file" accept="image/*" onChange={handleImageChange} />
                      <div className="action-content">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                        <span>Replace Image</span>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="meta-details-box glass-medium">
                  <label className="form-label">META DETAILS</label>
                  <div className="meta-grid-luxe">
                    <div className="meta-item"><span className="meta-key">Parent SKU:</span> <span className="meta-val">{editedDetails.parentId || "—"}</span></div>
                    <div className="meta-item"><span className="meta-key">Category:</span> <span className="meta-val">{(editedDetails.category || "").toUpperCase()}</span></div>
                    <div className="meta-item"><span className="meta-key">Brand:</span> <span className="meta-val">{(editedDetails.brand || "—").toUpperCase()}</span></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="edit-modal-footer">
              <button type="button" className="footer-btn-secondary" onClick={() => { setEditingProduct(null); setEditedDetails(null); }}>Discard Changes</button>
              <button type="submit" form="product-edit-form" className="footer-btn-primary">Update Product</button>
            </div>
          </div>
        </div>
      )}

      <Toasts toasts={toasts} removeToast={removeToast} />
    </div>
  );
};

export default ProductManagement;
