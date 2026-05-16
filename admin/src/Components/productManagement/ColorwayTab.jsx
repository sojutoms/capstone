import React, { useState, useEffect } from "react";
import API_BASE_URL, { authorizedFetch } from "../../services/api";

const FALLBACK_SHOE_SIZES = ["6", "6.5", "7", "7.5", "8", "8.5", "9", "9.5", "10", "10.5", "11", "11.5", "12", "12.5", "13", "13.5", "14"];
const SIMPLE_CATEGORIES = ["watch", "bags", "collectibles"];

const sanitizeCurrencyInput = (raw) => {
  if (raw === null || raw === undefined) return "";
  let v = String(raw).replace(/[,\s]/g, "").replace(/[^\d.]/g, "");
  const parts = v.split(".");
  if (parts.length > 1) v = parts[0] + "." + parts.slice(1).join("");
  if (v.includes(".")) { const [i, d] = v.split("."); v = i + "." + d.slice(0, 2); }
  return v;
};

const priceStringToCents = (s) => {
  const clean = sanitizeCurrencyInput(s);
  if (clean === "" || clean === ".") return NaN;
  const n = Number(clean);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
};

const ColorwayTab = ({ allproducts, getEffectiveSizes, showToast, onColorwayAdded }) => {
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

  const [step, setStep] = useState("list");
  const [search, setSearch] = useState("");
  const [parent, setParent] = useState(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [mainImgFile, setMainImgFile] = useState(null);
  const [mainImgPrev, setMainImgPrev] = useState("");
  const [subImgFiles, setSubImgFiles] = useState([]);
  const [subImgPrevs, setSubImgPrevs] = useState([]);
  const [sizes, setSizes] = useState({});
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const authH = { "Content-Type": "application/json" };

  const eligibleProducts = allproducts.filter(
    (p) => !p.isDeleted && !SIMPLE_CATEGORIES.includes((p.category || "").toLowerCase()) && !p.parentId
  );

  const filtered = eligibleProducts.filter(
    (p) =>
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      String(p.id).includes(search)
  );

  const selectParent = (product) => {
    setParent(product);
    const live = getEffectiveSizes(product);
    const initSizes = {};
    shoeSizes.forEach((s) => {
      initSizes[s] = { quantity: "", price: String(live[s]?.price || "") };
    });
    setSizes(initSizes);
    setName(""); setDescription("");
    setMainImgFile(null); setMainImgPrev("");
    setSubImgFiles([]); setSubImgPrevs([]);
    setErrors({});
    setStep("form");
  };

  const reset = () => {
    setStep("list"); setParent(null);
    setName(""); setDescription("");
    setMainImgFile(null); setMainImgPrev("");
    setSubImgFiles([]); setSubImgPrevs([]);
    setSizes({}); setErrors({});
    setSaving(false);
  };

  const handleMainImg = (file) => {
    if (!file) return;
    setMainImgFile(file);
    setMainImgPrev(URL.createObjectURL(file));
  };

  const handleSubImgs = (files) => {
    const arr = Array.from(files).slice(0, 4);
    setSubImgFiles(arr);
    setSubImgPrevs(arr.map((f) => URL.createObjectURL(f)));
  };

  const handleSizeQty = (size, raw) => {
    const qty = raw === "" ? "" : Math.max(0, parseInt(raw || 0, 10) || 0);
    setSizes((prev) => ({ ...prev, [size]: { ...prev[size], quantity: qty } }));
    setErrors((prev) => ({ ...prev, sizes: "" }));
  };

  const handleSizePrice = (size, raw) => {
    setSizes((prev) => ({ ...prev, [size]: { ...prev[size], price: sanitizeCurrencyInput(raw) } }));
    setErrors((prev) => ({ ...prev, sizes: "" }));
  };

  const validate = () => {
    const nextErrors = {};
    if (!name.trim()) nextErrors.name = "Colorway name is required.";
    if (!mainImgFile) nextErrors.mainImg = "Main image is required.";
    let hasStock = false;
    for (const [, obj] of Object.entries(sizes)) {
      const qty = Number(obj.quantity || 0);
      if (qty > 0) {
        hasStock = true;
        const cents = priceStringToCents(obj.price || "");
        if (!Number.isFinite(cents) || cents < 0) {
          nextErrors.sizes = "Enter valid prices for all sizes with stock.";
          break;
        }
      }
    }
    if (!hasStock) nextErrors.sizes = "At least one size must have quantity > 0.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || saving) return;
    setSaving(true);
    try {
      let imageUrl = "";
      const fdMain = new FormData();
      fdMain.append("product", mainImgFile);
      const mainRes = await authorizedFetch("/upload", { method: "POST", body: fdMain });
      const mainData = await mainRes.json();
      if (!mainData.success) { showToast({ message: "Main image upload failed.", type: "error" }); setSaving(false); return; }
      imageUrl = mainData.image_url;

      let subImageUrls = [];
      if (subImgFiles.length > 0) {
        const fdSub = new FormData();
        subImgFiles.forEach((f) => fdSub.append("product", f));
        const subRes = await authorizedFetch("/upload-multiple", { method: "POST", body: fdSub });
        const subData = await subRes.json();
        if (subData.success) subImageUrls = subData.image_urls;
      }

      const sizesPayload = FALLBACK_SHOE_SIZES
        .map((s) => {
          const obj = sizes[s] || { quantity: 0, price: "" };
          const qty = Number(obj.quantity || 0);
          const priceCents = priceStringToCents(obj.price || "");
          return { size: String(s), quantity: qty, price: Number.isFinite(priceCents) ? priceCents / 100 : 0 };
        })
        .filter((s) => s.quantity > 0 || s.price > 0);

      const payload = {
        parentId: parent.id,
        name: name.trim(),
        description: description.trim() || "",
        image: imageUrl,
        subImages: subImageUrls,
        sizes: sizesPayload,
      };

      const res = await authorizedFetch("/addcolorway", {
        method: "POST",
        headers: authH,
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        showToast({ message: `Colorway added — SKU #${data.id}`, type: "success" });
        if (onColorwayAdded) onColorwayAdded();
        reset();
      } else { showToast({ message: data.error || "Failed to add colorway.", type: "error" }); }
    } catch (err) { showToast({ message: "Error: " + err.message, type: "error" }); }
    finally { setSaving(false); }
  };

  if (step === "list") {
    return (
      <div className="acw-container animate-in">
        <div className="tab-header">
          <h1 className="chrome-text">ADD COLORWAY</h1>
          <p className="tab-subtitle">Select a base product to create a new color variant with inherited attributes.</p>
        </div>

        <div className="search-wrapper glass">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="search-icon"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input className="acw-search-luxe" type="text" placeholder="Search by name or SKU #…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <div className="acw-product-grid">
          {filtered.map((p) => {
            const live = getEffectiveSizes(p);
            const totalStock = Object.values(live).reduce((s, o) => s + Number(o.quantity || 0), 0);
            return (
              <div key={p.id} className="acw-product-card glass-medium" onClick={() => selectParent(p)}>
                <div className="card-visual">
                  <img src={p.image} alt={p.name} />
                  <div className="card-overlay">
                    <span className="overlay-text">SELECT PARENT</span>
                  </div>
                </div>
                <div className="card-content">
                  <div className="card-sku">SKU #{p.id}</div>
                  <div className="card-name">{p.name}</div>
                  <div className="card-meta">
                    <span className={`stock-pill ${totalStock === 0 ? "out" : "ok"}`}>
                      {totalStock} IN STOCK
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

  return (
    <div className="acw-form-container animate-in">
      <div className="form-header">
        <button className="back-btn-luxe" onClick={reset}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m15 18-6-6 6-6"/></svg>
          BACK TO SELECTION
        </button>
        <div className="parent-context glass-medium">
          <img src={parent.image} alt="" className="parent-thumb" />
          <div className="parent-info">
            <span className="info-label">PARENT PRODUCT</span>
            <span className="info-name">{parent.name}</span>
            <span className="info-sku">SKU #{parent.id}</span>
          </div>
        </div>
      </div>

      <div className="acw-grid">
        <div className="acw-left">
          <div className="form-row">
            <div className="form-section">
              <label className="form-label">COLORWAY NAME</label>
              <input className={`form-input-luxe ${errors.name ? "error" : ""}`} type="text" placeholder="e.g. 'Midnight Navy'" value={name} onChange={(e) => setName(e.target.value)} />
              {errors.name && <span className="field-error">{errors.name}</span>}
            </div>
            <div className="form-section">
              <label className="form-label">DESCRIPTION (OPTIONAL)</label>
              <textarea className="form-input-luxe" rows={2} placeholder="Tell the story..." value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>

          <div className="inventory-section glass-strong">
            <div className="section-header">
              <h3 className="section-title">SIZES & INITIAL STOCK</h3>
              <span className="section-badge">VARIANT</span>
            </div>
            <div className="sized-inventory-grid">
              {shoeSizes.map((sz, idx) => (
                <div key={idx} className={`size-row glass-medium ${Number(sizes[sz]?.quantity) > 0 ? "active" : ""}`}>
                  <div className="size-header">{sz}</div>
                    <div 
                      className="size-inputs" 
                      style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px", overflow: "visible" }}
                    >
                    <input className="luxe-num-input" type="number" placeholder="QTY" value={sizes[sz]?.quantity ?? ""} onChange={(e) => handleSizeQty(sz, e.target.value)} />
                    <input className="luxe-num-input" type="number" placeholder="Price" value={sizes[sz]?.price ?? ""} onChange={(e) => handleSizePrice(sz, e.target.value)} />
                  </div>
                </div>
              ))}
            </div>
            {errors.sizes && <p className="field-error">{errors.sizes}</p>}
          </div>
        </div>

        <div className="acw-right">
          <div className="form-section">
            <label className="form-label">MAIN VISUAL</label>
            <div className="image-upload-box glass">
              <label htmlFor="cw-main-upload" className="image-dropzone">
                <img src={mainImgPrev || parent.image} className="preview-img" alt="" />
                <div className="upload-overlay">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                  <span>{mainImgFile ? "REPLACE IMAGE" : "UPLOAD IMAGE"}</span>
                </div>
              </label>
              <input type="file" id="cw-main-upload" hidden onChange={(e) => handleMainImg(e.target.files?.[0])} />
            </div>
            {errors.mainImg && <span className="field-error">{errors.mainImg}</span>}
          </div>

          <div className="form-section">
            <label className="form-label">GALLERY (MAX 4)</label>
            <div className="sub-images-grid">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="sub-image-box glass">
                  {subImgPrevs[i] ? (
                    <img src={subImgPrevs[i]} alt="" />
                  ) : (
                    <div className="empty-sub-slot">+</div>
                  )}
                </div>
              ))}
              <input type="file" id="cw-sub-upload" multiple hidden onChange={(e) => handleSubImgs(e.target.files)} />
              <label htmlFor="cw-sub-upload" className="sub-file-overlay"></label>
            </div>
          </div>

          <div className="meta-context glass-medium">
            <label className="form-label">INHERITED ATTRIBUTES</label>
            <div className="meta-row"><span className="m-key">Category:</span> <span className="m-val">{parent.category}</span></div>
            <div className="meta-row"><span className="m-key">Brand:</span> <span className="m-val">{parent.brand || "NONE"}</span></div>
          </div>
        </div>
      </div>

      <div className="acw-footer">
        <button className="footer-btn-secondary" onClick={reset}>Discard Changes</button>
        <button className="footer-btn-primary" onClick={handleSubmit} disabled={saving}>
          {saving ? "SAVING VARIANT..." : "CREATE COLORWAY"}
        </button>
      </div>
    </div>
  );
};

export default ColorwayTab;
