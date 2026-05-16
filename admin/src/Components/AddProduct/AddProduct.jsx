import React, { useState, useEffect, useRef, useCallback } from "react";
import "./AddProduct.css";
import upload_area from "../../assets/upload_area.svg";
import API_BASE_URL, { authorizedFetch } from "../../services/api";

const FALLBACK_SHOE_SIZES = ["6", "6.5", "7", "7.5", "8", "8.5", "9", "9.5", "10", "10.5", "11", "11.5", "12", "12.5", "13", "13.5", "14"];
const FALLBACK_SUBCATEGORIES = [
  { label: "Lifestyle", value: "lifestyle" },
  { label: "Running", value: "running" },
  { label: "Football", value: "football" },
  { label: "Basketball", value: "basketball" },
];

const sanitizeCurrencyInput = (raw) => {
  if (raw === null || raw === undefined) return "";
  let v = String(raw).replace(/[,\s]/g, "").replace(/[^\d.]/g, "");
  const parts = v.split(".");
  if (parts.length > 1) v = parts[0] + "." + parts.slice(1).join("");
  if (v.includes(".")) {
    const [intPart, decPart] = v.split(".");
    v = intPart + "." + decPart.slice(0, 2);
  }
  if (v.startsWith("00") && !v.startsWith("0.")) v = v.replace(/^0+/, "0");
  return v;
};

const priceStringToCents = (priceStr) => {
  const sanitized = sanitizeCurrencyInput(priceStr);
  if (sanitized === "" || sanitized === ".") return NaN;
  const num = Number(sanitized);
  if (!Number.isFinite(num)) return NaN;
  return Math.round(num * 100);
};

const formatCurrencyForDisplay = (priceStr) => {
  const cents = priceStringToCents(priceStr);
  if (!Number.isFinite(cents)) return "";
  return new Intl.NumberFormat("en-PH", {
    style: "currency", currency: "PHP",
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(cents / 100);
};

const SIMPLE_CATEGORIES = ["watch", "bags", "collectibles"];

// ─────────────────────────────────────────────────────────────────────────────
// Image upload helpers
//
// WHY we do this on the backend:
//   Cloudinary serves images from res.cloudinary.com. Browser fetch of those
//   URLs hits CORS restrictions, so client-side hashing silently fails and
//   always reports "unique". The only reliable duplicate check is server-side
//   using Cloudinary's public_id (the stable identifier Cloudinary assigns
//   every upload regardless of what the original filename was).
//
// Flow for main image:
//   1. POST file to  POST /check-duplicate-image
//   2. Backend uploads to Cloudinary, extracts public_id, compares against
//      every stored product image's public_id.
//   3a. duplicate === true  → backend already deleted the orphan from Cloudinary;
//       frontend shows error, nothing is saved.
//   3b. duplicate === false → image_url is the committed Cloudinary URL;
//       frontend stores it and uses it when saving the product.
//
// Flow for sub-images:
//   Same idea via  POST /check-duplicate-images-multiple
// ─────────────────────────────────────────────────────────────────────────────

const getAdminHeaders = (isFormData = false) => {
  const token = sessionStorage.getItem("admin-token");
  const headers = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(token && { "auth-token": token, "Authorization": `Bearer ${token}` })
  };
  return headers;
};

const uploadAndCheckMain = async (file) => {
  const fd = new FormData();
  fd.append("product", file);
  const res = await authorizedFetch("/check-duplicate-image", {
    method: "POST",
    body: fd,
  });
  if (!res.ok) throw new Error(`Image check failed: ${res.status}`);
  return res.json(); // { success, duplicate, image_url }
};

const uploadAndCheckMultiple = async (files) => {
  const fd = new FormData();
  files.forEach((f) => fd.append("product", f));
  const res = await authorizedFetch("/check-duplicate-images-multiple", {
    method: "POST",
    body: fd,
  });
  if (!res.ok) throw new Error(`Image check failed: ${res.status}`);
  return res.json(); // { success, duplicate, image_urls }
};

// Name duplicate check — scans /allproducts, no extra backend route needed
const checkNameDuplicate = async (name) => {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return { duplicate: false, matchedName: null };
  try {
    const res = await authorizedFetch("/allproducts");
    const data = await res.json();
    const products = data.products ?? data ?? [];
    const match = products.find((p) => (p.name ?? "").trim().toLowerCase() === normalized);
    return { duplicate: !!match, matchedName: match?.name ?? null };
  } catch {
    return { duplicate: false, matchedName: null };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
const AddProduct = ({ onAdded }) => {
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [shoeSizes, setShoeSizes] = useState(FALLBACK_SHOE_SIZES);
  const [shoeSubcats, setShoeSubcats] = useState(FALLBACK_SUBCATEGORIES);
  const [loadingMeta, setLoadingMeta] = useState(true);

  // Local File objects — used for preview only
  const [mainImageFile, setMainImageFile] = useState(null);
  const [subImageFiles, setSubImageFiles] = useState([]);

  // Committed Cloudinary URLs returned after the duplicate-check upload.
  // These are what get saved to the product — NOT re-uploaded at submit time.
  const [committedMainUrl, setCommittedMainUrl] = useState("");
  const [committedSubUrls, setCommittedSubUrls] = useState([]);

  const [productDetails, setProductDetails] = useState({
    name: "", category: "", brand: "", description: "",
  });
  const [singleStock, setSingleStock] = useState(0);
  const [singlePrice, setSinglePrice] = useState("");
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedSubCategories, setSelectedSubCategories] = useState([]);
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);
  const [sizes, setSizes] = useState({});

  // idle | checking | ok | duplicate
  const [nameCheckStatus, setNameCheckStatus] = useState("idle");
  const [mainImageCheckStatus, setMainImageCheckStatus] = useState("idle");
  const [subImageCheckStatus, setSubImageCheckStatus] = useState("idle");
  const nameCheckTimerRef = useRef(null);

  useEffect(() => {
    setSizes(shoeSizes.reduce((acc, s) => ({ ...acc, [s]: { quantity: 0, price: "" } }), {}));
  }, [shoeSizes]);

  useEffect(() => {
    const fetchMeta = async () => {
      setLoadingMeta(true);
      try {
        const token = sessionStorage.getItem("admin-token");
        const headers = {
          "Content-Type": "application/json",
          ...(token && { "auth-token": token, "Authorization": `Bearer ${token}` })
        };
        const [catRes, brandRes, sizeRes, subRes] = await Promise.all([
          authorizedFetch("/categories"),
          authorizedFetch("/brands"),
          authorizedFetch("/sizes").catch(() => ({ json: async () => ({}) })),
          authorizedFetch("/subcategories").catch(() => ({ json: async () => ({}) })),
        ]);
        const [catData, brandData, sizeData, subData] = await Promise.all([
          catRes.json(), brandRes.json(), sizeRes.json(), subRes.json(),
        ]);
        if (catData.success) setCategories(catData.categories || []);
        if (brandData.success) setBrands(brandData.brands || []);
        if (sizeData.success && sizeData.sizes?.length > 0)
          setShoeSizes(sizeData.sizes.map((s) => s.value).sort((a, b) => parseFloat(a) - parseFloat(b)));
        if (subData.success && subData.subcategories?.length > 0)
          setShoeSubcats(subData.subcategories.map((s) => ({ label: s.name, value: s.slug, parentCategory: s.parentCategory })));
        if (catData.success && catData.categories.length > 0)
          setProductDetails((p) => ({ ...p, category: catData.categories[0].slug }));
      } catch (err) {
        console.error("Failed to load meta:", err);
      } finally {
        setLoadingMeta(false);
      }
    };
    fetchMeta();
  }, []);

  const isSimpleCategory = SIMPLE_CATEGORIES.includes(productDetails.category);
  const isShoeCategory = !isSimpleCategory && productDetails.category !== "";
  const availableBrands = brands.filter((b) => b.parentCategory === productDetails.category);
  const availableSubcats = shoeSubcats.filter((sc) => !sc.parentCategory || sc.parentCategory === productDetails.category);

  const addToast = (type, message, options = {}) => {
    const id = ++toastIdRef.current;
    const toast = { id, type, message, duration: options.duration ?? 4000 };
    setToasts((t) => [...t, toast]);
    if (toast.duration > 0) setTimeout(() => removeToast(id), toast.duration);
  };
  const removeToast = (id) => setToasts((t) => t.filter((x) => x.id !== id));

  // ── Name check (debounced 600 ms + on blur) ──────────────────────────────
  const triggerNameCheck = useCallback((name) => {
    setNameCheckStatus("idle");
    clearTimeout(nameCheckTimerRef.current);
    if (!name.trim()) return;
    nameCheckTimerRef.current = setTimeout(async () => {
      setNameCheckStatus("checking");
      const { duplicate, matchedName } = await checkNameDuplicate(name);
      setNameCheckStatus(duplicate ? "duplicate" : "ok");
      setErrors((prev) => ({
        ...prev,
        name: duplicate
          ? `A product named "${matchedName ?? name.trim()}" already exists. Please use a different name.`
          : "",
      }));
    }, 600);
  }, []);

  // ── Main image: upload immediately on file select ────────────────────────
  const handleMainImage = async (e) => {
    const file = e.target.files?.[0] || null;
    setMainImageFile(file);
    setCommittedMainUrl("");
    setMainImageCheckStatus("idle");
    setErrors((prev) => ({ ...prev, mainImage: "" }));
    if (!file) return;

    setMainImageCheckStatus("checking");
    try {
      const result = await uploadAndCheckMain(file);
      if (!result.success) {
        setMainImageCheckStatus("idle");
        setErrors((prev) => ({ ...prev, mainImage: "Image upload failed. Please try again." }));
        return;
      }
      if (result.duplicate) {
        setMainImageCheckStatus("duplicate");
        setErrors((prev) => ({
          ...prev,
          mainImage: "This image is already used by another product. Please choose a different image.",
        }));
      } else {
        setMainImageCheckStatus("ok");
        setCommittedMainUrl(result.image_url);
      }
    } catch (err) {
      console.error("Main image check error:", err);
      setMainImageCheckStatus("idle");
      setErrors((prev) => ({ ...prev, mainImage: "Image upload failed. Please try again." }));
    }
  };

  // ── Sub images: upload immediately on file select ────────────────────────
  const handleSubImages = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, 4);
    setSubImageFiles(files);
    setCommittedSubUrls([]);
    setSubImageCheckStatus("idle");
    setErrors((prev) => ({ ...prev, subImages: "" }));
    if (files.length === 0) return;

    setSubImageCheckStatus("checking");
    try {
      const result = await uploadAndCheckMultiple(files);
      if (!result.success) {
        setSubImageCheckStatus("idle");
        setErrors((prev) => ({ ...prev, subImages: "Sub-image upload failed. Please try again." }));
        return;
      }
      if (result.duplicate) {
        setSubImageCheckStatus("duplicate");
        setErrors((prev) => ({
          ...prev,
          subImages: "One or more sub-images are already used by another product. Please choose different images.",
        }));
      } else {
        setSubImageCheckStatus("ok");
        setCommittedSubUrls(result.image_urls);
      }
    } catch (err) {
      console.error("Sub-image check error:", err);
      setSubImageCheckStatus("idle");
      setErrors((prev) => ({ ...prev, subImages: "Sub-image upload failed. Please try again." }));
    }
  };

  const changeHandler = (e) => {
    const { name, value } = e.target;
    if (name === "category") {
      const newBrands = brands.filter((b) => b.parentCategory === value);
      setProductDetails((p) => ({ ...p, category: value, brand: newBrands.length > 0 ? newBrands[0].slug : "" }));
      setErrors((prev) => ({ ...prev, category: "", brand: "" }));
      setSelectedSubCategories([]);
      setSizes(shoeSizes.reduce((acc, s) => ({ ...acc, [s]: { quantity: 0, price: "" } }), {}));
      setSingleStock(0);
      setSinglePrice("");
      return;
    }
    if (name === "name") {
      setProductDetails((p) => ({ ...p, name: value }));
      setErrors((prev) => ({ ...prev, name: "" }));
      setNameCheckStatus("idle");
      triggerNameCheck(value);
      return;
    }
    setProductDetails((p) => ({ ...p, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleNameBlur = () => {
    clearTimeout(nameCheckTimerRef.current);
    if (productDetails.name.trim()) triggerNameCheck(productDetails.name);
  };

  const toggleSubCategory = (value) =>
    setSelectedSubCategories((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]
    );

  const handleSizeQuantityChange = (size, raw) => {
    setSizes((prev) => ({ ...prev, [size]: { ...prev[size], quantity: Math.max(0, parseInt(raw || 0, 10) || 0) } }));
    setErrors((prev) => ({ ...prev, sizes: "" }));
  };

  const handleSizePriceChange = (size, raw) => {
    setSizes((prev) => ({ ...prev, [size]: { ...prev[size], price: sanitizeCurrencyInput(raw) } }));
    setErrors((prev) => ({ ...prev, sizes: "" }));
  };

  const handleSingleStockChange = (raw) => {
    setSingleStock(Math.max(0, parseInt(raw || 0, 10) || 0));
    setErrors((prev) => ({ ...prev, single: "" }));
  };

  const handleSinglePriceChange = (raw) => {
    setSinglePrice(sanitizeCurrencyInput(raw));
    setErrors((prev) => ({ ...prev, single: "" }));
  };

  // ── Validation ───────────────────────────────────────────────────────────
  const validateAll = async () => {
    const nextErrors = {};

    if (!productDetails.name.trim()) {
      nextErrors.name = "Product title is required.";
    } else if (nameCheckStatus !== "ok") {
      const { duplicate, matchedName } = await checkNameDuplicate(productDetails.name);
      if (duplicate) {
        nextErrors.name = `A product named "${matchedName ?? productDetails.name.trim()}" already exists.`;
        setNameCheckStatus("duplicate");
      } else {
        setNameCheckStatus("ok");
      }
    }

    if (!mainImageFile) {
      nextErrors.mainImage = "Main image is required.";
    } else if (mainImageCheckStatus === "duplicate") {
      nextErrors.mainImage = "This image is already used by another product.";
    } else if (mainImageCheckStatus !== "ok") {
      nextErrors.mainImage = "Please wait for the image check to complete.";
    }

    if (subImageCheckStatus === "duplicate") {
      nextErrors.subImages = "One or more sub-images are already used by another product.";
    }

    if (!productDetails.category) nextErrors.category = "Category is required.";
    if (availableBrands.length > 0 && !productDetails.brand) nextErrors.brand = "Brand is required for this category.";

    if (isSimpleCategory) {
      if (!Number.isInteger(singleStock) || singleStock <= 0) nextErrors.single = "Stock must be greater than 0.";
      const cents = priceStringToCents(singlePrice || "");
      if (!Number.isFinite(cents) || cents < 0) nextErrors.single = (nextErrors.single ? nextErrors.single + " " : "") + "Enter a valid price.";
    } else {
      let hasStock = false;
      for (const [, obj] of Object.entries(sizes)) {
        if (Number(obj.quantity || 0) > 0) {
          hasStock = true;
          const cents = priceStringToCents(obj.price);
          if (!Number.isFinite(cents) || cents < 0) { nextErrors.sizes = "Enter valid prices for sizes with stock."; break; }
        }
      }
      if (!hasStock) nextErrors.sizes = "At least one size must have quantity > 0.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  // Images are already uploaded (done on file-select). We just save the product
  // with the committed Cloudinary URLs — no second upload needed.
  const Add_Product = async () => {
    if (isSubmitting) return;
    const isValid = await validateAll();
    if (!isValid) { addToast("error", "Please fix the highlighted errors."); return; }

    setIsSubmitting(true);
    const token = sessionStorage.getItem("admin-token") || "";
    try {
      const product = {
        name: productDetails.name,
        category: productDetails.category,
        brand: availableBrands.length > 0 ? productDetails.brand : "",
        description: productDetails.description,
        image: committedMainUrl,
        subImages: committedSubUrls,
        subCategories: isShoeCategory ? selectedSubCategories : [],
        ...(isSimpleCategory
          ? { stock: Number(singleStock || 0), price: (() => { const c = priceStringToCents(singlePrice || ""); return Number.isFinite(c) ? c / 100 : 0; })() }
          : { sizes: shoeSizes.map((s) => { const obj = sizes[s] || {}; const c = priceStringToCents(obj.price || ""); return { size: String(s), quantity: Number(obj.quantity || 0), price: Number.isFinite(c) ? c / 100 : 0 }; }) }
        ),
      };

      const saveRes = await authorizedFetch("/addproduct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(product),
      });
      const saveData = await saveRes.json();

      if (saveData.success) {
        addToast("success", `Product added — assigned SKU #${saveData.id ?? saveData.productId ?? "—"}. You can now add colorways from the Add Colorway tab.`);
        setProductDetails({ name: "", category: categories[0]?.slug || "", brand: "", description: "" });
        setMainImageFile(null);
        setSubImageFiles([]);
        setCommittedMainUrl("");
        setCommittedSubUrls([]);
        setSizes(shoeSizes.reduce((acc, s) => ({ ...acc, [s]: { quantity: 0, price: "" } }), {}));
        setSingleStock(0);
        setSinglePrice("");
        setSelectedSubCategories([]);
        setErrors({});
        setNameCheckStatus("idle");
        setMainImageCheckStatus("idle");
        setSubImageCheckStatus("idle");
        if (typeof onAdded === "function") onAdded(saveData.id ?? saveData);
      } else {
        if (saveData.field) setErrors((prev) => ({ ...prev, [saveData.field]: saveData.errors }));
        addToast("error", saveData.errors || saveData.error || "Failed to add product.");
        if (typeof onAdded === "function") onAdded(null);
      }
    } catch (err) {
      console.error(err);
      addToast("error", "An unexpected error occurred.");
      if (typeof onAdded === "function") onAdded(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const sizeSummary = Object.entries(sizes)
    .filter(([, obj]) => Number(obj.quantity || 0) > 0)
    .map(([s, obj]) => `${s}: ${obj.quantity}${obj.price ? ` @ ${formatCurrencyForDisplay(obj.price)}` : ""}`)
    .join(" • ");

  const hasValidStockForSimple = singleStock > 0 && Number.isFinite(priceStringToCents(singlePrice || ""));
  const hasValidStockForSizes = Object.values(sizes).some((obj) => Number(obj.quantity || 0) > 0);
  const isAnyChecking = nameCheckStatus === "checking" || mainImageCheckStatus === "checking" || subImageCheckStatus === "checking";
  const hasDuplicateError = nameCheckStatus === "duplicate" || mainImageCheckStatus === "duplicate" || subImageCheckStatus === "duplicate";

  const canSubmit =
    !isSubmitting &&
    !isAnyChecking &&
    !hasDuplicateError &&
    productDetails.name.trim() &&
    mainImageFile &&
    mainImageCheckStatus === "ok" &&
    productDetails.category &&
    (availableBrands.length > 0 ? !!productDetails.brand : true) &&
    (isSimpleCategory ? hasValidStockForSimple : hasValidStockForSizes);

  // ── Inline status badges ──────────────────────────────────────────────────
  const NameStatusBadge = () => {
    if (!productDetails.name.trim()) return null;
    if (nameCheckStatus === "checking") return <span className="m-badge-cw checking">CHECKING...</span>;
    if (nameCheckStatus === "ok") return <span className="m-badge-cw ok">AVAILABLE</span>;
    if (nameCheckStatus === "duplicate") return <span className="m-badge-cw error">TAKEN</span>;
    return null;
  };

  const ImageStatusBadge = ({ status }) => {
    if (status === "checking") return <div className="status-badge checking">⏳ VERIFYING...</div>;
    if (status === "ok") return <div className="status-badge ok">✓ UNIQUE</div>;
    if (status === "duplicate") return <div className="status-badge error">✗ DUPLICATE</div>;
    return null;
  };

  if (loadingMeta) return <div className="add-product"><p style={{ padding: 24 }}>Loading categories...</p></div>;

  return (
      <div className="add-product-container animate-in">
        <div className="info-banner glass-medium">
          <div className="info-icon">💡</div>
          <div className="info-content">
            <strong>SKU Numbering:</strong> Products are assigned a global <strong>SKU #</strong>. Units receive unique <strong>Product IDs</strong> when added to stock.
            <br />
            <span className="info-hint">Add color variants via the <strong>Add Colorway</strong> tab after saving.</span>
          </div>
        </div>

        {hasDuplicateError && (
          <div className="error-banner glass-danger">
            <div className="error-icon">⚠</div>
            <div className="error-content">
              <strong>DUPLICATE DETECTED</strong>
              {nameCheckStatus === "duplicate" && <div>• Name <strong>"{productDetails.name}"</strong> is already in use.</div>}
              {mainImageCheckStatus === "duplicate" && <div>• Main image is already used.</div>}
              {subImageCheckStatus === "duplicate" && <div>• One or more sub-images are already used.</div>}
            </div>
          </div>
        )}

        <div className="add-product-grid">
          <div className="add-product-left">
            <div className="form-section">
              <label className="form-label">PRODUCT TITLE <NameStatusBadge /></label>
              <input
                value={productDetails.name}
                onChange={changeHandler}
                onBlur={handleNameBlur}
                type="text"
                name="name"
                placeholder="Enter product title..."
                className={`form-input-luxe ${errors.name ? "error" : nameCheckStatus === "ok" ? "valid" : ""}`}
              />
              {errors.name && <div className="field-error">{errors.name}</div>}
            </div>

            <div className="form-row">
              <div className="form-section">
                <label className="form-label">CATEGORY</label>
                <select value={productDetails.category} onChange={changeHandler} name="category" className={`form-select-luxe ${errors.category ? "error" : ""}`}>
                  <option value="">Select Category</option>
                  {categories.map((cat) => <option key={cat.slug} value={cat.slug}>{cat.name}</option>)}
                </select>
                {errors.category && <div className="field-error">{errors.category}</div>}
              </div>

              {availableBrands.length > 0 && (
                <div className="form-section">
                  <label className="form-label">BRAND</label>
                  <select value={productDetails.brand} onChange={changeHandler} name="brand" className={`form-select-luxe ${errors.brand ? "error" : ""}`}>
                    <option value="">Select Brand</option>
                    {availableBrands.map((b) => <option key={b.slug} value={b.slug}>{b.name}</option>)}
                  </select>
                  {errors.brand && <div className="field-error">{errors.brand}</div>}
                </div>
              )}
            </div>

            {isShoeCategory && availableSubcats.length > 0 && (
              <div className="form-section">
                <label className="form-label">SUB CATEGORIES <span className="label-hint">(OPTIONAL)</span></label>
                <div className="subcat-chip-grid">
                  {availableSubcats.map(({ label, value }) => {
                    const active = selectedSubCategories.includes(value);
                    return (
                      <button key={value} type="button" onClick={() => toggleSubCategory(value)}
                        className={`subcat-chip ${active ? "active" : ""}`}>
                        {active && <span className="chip-check">✓</span>}{label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="form-section">
              <label className="form-label">DESCRIPTION</label>
              <textarea value={productDetails.description} onChange={changeHandler} name="description" rows={5} placeholder="Write a short description..." className="form-input-luxe" />
            </div>
          </div>

          <div className="add-product-right">
            <div className="form-section">
              <label className="form-label">MAIN IMAGE</label>
              <div className="image-upload-box glass">
                <label htmlFor="main-file-input" className="image-dropzone">
                  <img
                    src={mainImageFile ? URL.createObjectURL(mainImageFile) : upload_area}
                    className="preview-img"
                    alt="main preview"
                  />
                  <div className="upload-overlay">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                    <span>{mainImageFile ? "REPLACE IMAGE" : "UPLOAD IMAGE"}</span>
                  </div>
                </label>
                <input onChange={handleMainImage} type="file" id="main-file-input" accept="image/*" hidden />
                <ImageStatusBadge status={mainImageCheckStatus} />
              </div>
              {errors.mainImage && <div className="field-error">{errors.mainImage}</div>}
            </div>

            {!isSimpleCategory && (
              <div className="form-section">
                <label className="form-label">SUB IMAGES <span className="label-hint">(MAX 4)</span></label>
                <div className="sub-images-grid">
                  {[0, 1, 2, 3].map(i => (
                    <div key={i} className="sub-image-box glass">
                      {subImageFiles[i] ? (
                        <img src={URL.createObjectURL(subImageFiles[i])} alt={`Sub ${i}`} />
                      ) : (
                        <div className="empty-sub-slot">+</div>
                      )}
                    </div>
                  ))}
                  <input type="file" multiple accept="image/*" onChange={handleSubImages} className="sub-file-input" />
                </div>
                <ImageStatusBadge status={subImageCheckStatus} />
                {errors.subImages && <div className="field-error">{errors.subImages}</div>}
              </div>
            )}
          </div>
        </div>

        <div className="inventory-section glass-strong">
          <div className="section-header">
            <h3 className="section-title">STOCK & PRICING</h3>
            {isSimpleCategory ? (
               <span className="section-badge">SIMPLE ITEM</span>
            ) : (
               <span className="section-badge">SIZED ITEM</span>
            )}
          </div>

          {isSimpleCategory ? (
            <div className="simple-inventory-grid">
              <div className="inventory-field">
                <label className="form-label">UNITS</label>
                <div className="luxe-input-group">
                  <span className="group-prefix">QTY</span>
                  <input type="number" className="luxe-num-input" min="0" step="1" placeholder="0" value={String(singleStock ?? "")} onChange={(e) => handleSingleStockChange(e.target.value)} />
                </div>
              </div>
              <div className="inventory-field">
                <label className="form-label">PRICE</label>
                <div className="luxe-input-group">
                  <span className="group-prefix">₱</span>
                  <input type="number" inputMode="decimal" className="luxe-num-input" min="0" step="0.01" placeholder="0.00" value={singlePrice ?? ""} onChange={(e) => handleSinglePriceChange(e.target.value)} />
                </div>
              </div>
            </div>
          ) : (
            <div className="sized-inventory-grid">
              {shoeSizes.map((size) => (
                <div key={size} className="size-row glass-medium">
                  <div className="size-header">{size}</div>
                  <div 
                    className="size-inputs" 
                    style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px", overflow: "visible" }}
                  >
                    <input className="luxe-num-input" type="number" placeholder="QTY" min="0" step="1" value={String(sizes[size]?.quantity ?? "")} onChange={(e) => handleSizeQuantityChange(size, e.target.value)} />
                    <input className="luxe-num-input" type="number" placeholder="PRICE" inputMode="decimal" min="0" step="0.01" value={sizes[size]?.price ?? ""} onChange={(e) => handleSizePriceChange(size, e.target.value)} />
                  </div>
                </div>
              ))}
            </div>
          )}
          {errors.single && <div className="field-error">{errors.single}</div>}
          {errors.sizes && <div className="field-error">{errors.sizes}</div>}
        </div>

        <div className="add-product-footer">
          <button onClick={Add_Product} className="submit-btn-luxe" disabled={!canSubmit}>
            {isSubmitting ? "PROCESSING..." : isAnyChecking ? "VALIDATING..." : "SAVE PRODUCT"}
          </button>
        </div>
      </div>
  );
};

const badge = {
  checking: { fontSize: 12, color: "#6b7280", marginLeft: 8 },
  ok: { fontSize: 12, color: "#16a34a", marginLeft: 8, fontWeight: 600 },
  error: { fontSize: 12, color: "#dc2626", marginLeft: 8, fontWeight: 600 },
};

export default AddProduct;
