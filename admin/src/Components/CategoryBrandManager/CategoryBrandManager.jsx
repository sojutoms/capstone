import React, { useState, useEffect, useCallback } from "react";
import "./CategoryBrandManager.css";
import API_BASE_URL, { authorizedFetch } from "../../services/api";

// Headers are now handled by authorizedFetch

const CategoryBrandManager = ({ showToast }) => {
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [loading, setLoading] = useState(false);

  // ── form state ─────────────────────────────────────────────────────────────
  const [newCatName, setNewCatName] = useState("");
  const [catSaving, setCatSaving] = useState(false);

  const [newBrandName, setNewBrandName] = useState("");
  const [newBrandParent, setNewBrandParent] = useState("");
  const [brandSaving, setBrandSaving] = useState(false);

  const [newSizeValue, setNewSizeValue] = useState("");
  const [sizeSaving, setSizeSaving] = useState(false);

  const [newSubName, setNewSubName] = useState("");
  const [newSubParent, setNewSubParent] = useState("");
  const [subSaving, setSubSaving] = useState(false);

  // ── Fetch all ──────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [catRes, brandRes, sizeRes, subRes] = await Promise.all([
        authorizedFetch("/categories"),
        authorizedFetch("/brands"),
        authorizedFetch("/sizes"),
        authorizedFetch("/subcategories"),
      ]);
      const [catData, brandData, sizeData, subData] = await Promise.all([
        catRes.json(), brandRes.json(), sizeRes.json(), subRes.json(),
      ]);
      if (catData.success) setCategories(catData.categories || []);
      if (brandData.success) setBrands(brandData.brands || []);
      if (sizeData.success) setSizes(sizeData.sizes || []);
      if (subData.success) setSubcategories(subData.subcategories || []);
    } catch {
      showToast?.({ message: "Failed to load data", type: "error" });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Category handlers ──────────────────────────────────────────────────────
  const handleAddCategory = async (e) => {
    e.preventDefault();
    const name = newCatName.trim();
    if (!name) return;
    setCatSaving(true);
    try {
      const res = await authorizedFetch("/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      const data = await res.json();
      if (data.success) { setNewCatName(""); await fetchAll(); showToast?.({ message: `Category "${name}" added`, type: "success" }); }
      else showToast?.({ message: data.error || "Failed to add category", type: "error" });
    } catch { showToast?.({ message: "Failed to add category", type: "error" }); }
    finally { setCatSaving(false); }
  };

  const handleDeleteCategory = (slug, name, isDefault) => {
    if (isDefault) { showToast?.({ message: "Cannot delete a default category", type: "error" }); return; }
    showToast?.({
      message: `Delete category "${name}" and all its brands?`, type: "warning", duration: 0,
      actions: [
        { label: "Cancel", variant: "muted", onClick: () => { } },
        {
          label: "Delete", variant: "danger", onClick: async () => {
            try {
              const res = await authorizedFetch(`/categories/${slug}`, { method: "DELETE" });
              const data = await res.json();
              if (data.success) { await fetchAll(); showToast?.({ message: `Category "${name}" deleted`, type: "success" }); }
              else showToast?.({ message: data.error || "Failed to delete", type: "error" });
            } catch { showToast?.({ message: "Failed to delete category", type: "error" }); }
          }
        },
      ],
    });
  };

  // ── Brand handlers ─────────────────────────────────────────────────────────
  const handleAddBrand = async (e) => {
    e.preventDefault();
    const name = newBrandName.trim();
    const parentCategory = newBrandParent.trim();
    if (!name || !parentCategory) return;
    setBrandSaving(true);
    try {
      const res = await authorizedFetch("/brands", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, parentCategory }) });
      const data = await res.json();
      if (data.success) { setNewBrandName(""); setNewBrandParent(""); await fetchAll(); showToast?.({ message: `Brand "${name}" added`, type: "success" }); }
      else showToast?.({ message: data.error || "Failed to add brand", type: "error" });
    } catch { showToast?.({ message: "Failed to add brand", type: "error" }); }
    finally { setBrandSaving(false); }
  };

  const handleDeleteBrand = (slug, name, isDefault) => {
    if (isDefault) { showToast?.({ message: "Cannot delete a default brand", type: "error" }); return; }
    showToast?.({
      message: `Delete brand "${name}"?`, type: "warning", duration: 0,
      actions: [
        { label: "Cancel", variant: "muted", onClick: () => { } },
        {
          label: "Delete", variant: "danger", onClick: async () => {
            try {
              const res = await authorizedFetch(`/brands/${slug}`, { method: "DELETE" });
              const data = await res.json();
              if (data.success) { await fetchAll(); showToast?.({ message: `Brand "${name}" deleted`, type: "success" }); }
              else showToast?.({ message: data.error || "Failed to delete", type: "error" });
            } catch { showToast?.({ message: "Failed to delete brand", type: "error" }); }
          }
        },
      ],
    });
  };

  // ── Size validation ────────────────────────────────────────────────────────
  const [sizeError, setSizeError] = useState("");

  const validateSizeValue = (raw) => {
    const trimmed = raw.trim();
    if (!trimmed) return "Size is required.";
    const num = parseFloat(trimmed);
    if (isNaN(num)) return "Must be a number (e.g. 14 or 14.5).";
    if (num <= 0) return "Size must be greater than 0.";
    if (num > 20) return "Size seems too large. Max is 20.";
    const decimal = Math.round((num % 1) * 10) / 10;
    if (decimal !== 0 && decimal !== 0.5)
      return "Only whole numbers or .5 increments allowed (e.g. 14 or 14.5).";
    // Check duplicate
    const already = sizes.some((s) => parseFloat(s.value) === num);
    if (already) return `Size ${num} already exists.`;
    return "";
  };

  const handleSizeInput = (e) => {
    const val = e.target.value;
    // Only allow digits and at most one decimal point
    if (!/^[\d.]*$/.test(val)) return;
    setNewSizeValue(val);
    if (sizeError) setSizeError(validateSizeValue(val));
  };

  // ── Size handlers ──────────────────────────────────────────────────────────
  const handleAddSize = async (e) => {
    e.preventDefault();
    const value = newSizeValue.trim();
    const err = validateSizeValue(value);
    if (err) { setSizeError(err); return; }
    setSizeError("");
    // Normalize: always store as clean number string e.g. "14" or "14.5"
    const normalized = String(parseFloat(value));
    setSizeSaving(true);
    try {
      const res = await authorizedFetch("/sizes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value: normalized }) });
      const data = await res.json();
      if (data.success) { setNewSizeValue(""); await fetchAll(); showToast?.({ message: `Size "${normalized}" added`, type: "success" }); }
      else showToast?.({ message: data.error || "Failed to add size", type: "error" });
    } catch { showToast?.({ message: "Failed to add size", type: "error" }); }
    finally { setSizeSaving(false); }
  };

  const handleDeleteSize = (id, value, isDefault) => {
    if (isDefault) { showToast?.({ message: "Cannot delete a default size", type: "error" }); return; }
    showToast?.({
      message: `Delete size "${value}"?`, type: "warning", duration: 0,
      actions: [
        { label: "Cancel", variant: "muted", onClick: () => { } },
        {
          label: "Delete", variant: "danger", onClick: async () => {
            try {
              const res = await authorizedFetch(`/sizes/${id}`, { method: "DELETE" });
              const data = await res.json();
              if (data.success) { await fetchAll(); showToast?.({ message: `Size "${value}" deleted`, type: "success" }); }
              else showToast?.({ message: data.error || "Failed to delete", type: "error" });
            } catch { showToast?.({ message: "Failed to delete size", type: "error" }); }
          }
        },
      ],
    });
  };

  // ── Subcategory handlers ───────────────────────────────────────────────────
  const handleAddSubcategory = async (e) => {
    e.preventDefault();
    const name = newSubName.trim();
    const parentCategory = newSubParent.trim();
    if (!name || !parentCategory) return;
    setSubSaving(true);
    try {
      const res = await authorizedFetch("/subcategories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, parentCategory }) });
      const data = await res.json();
      if (data.success) { setNewSubName(""); setNewSubParent(""); await fetchAll(); showToast?.({ message: `Subcategory "${name}" added`, type: "success" }); }
      else showToast?.({ message: data.error || "Failed to add subcategory", type: "error" });
    } catch { showToast?.({ message: "Failed to add subcategory", type: "error" }); }
    finally { setSubSaving(false); }
  };

  const handleDeleteSubcategory = (slug, name, isDefault) => {
    if (isDefault) { showToast?.({ message: "Cannot delete a default subcategory", type: "error" }); return; }
    showToast?.({
      message: `Delete subcategory "${name}"?`, type: "warning", duration: 0,
      actions: [
        { label: "Cancel", variant: "muted", onClick: () => { } },
        {
          label: "Delete", variant: "danger", onClick: async () => {
            try {
              const res = await authorizedFetch(`/subcategories/${slug}`, { method: "DELETE" });
              const data = await res.json();
              if (data.success) { await fetchAll(); showToast?.({ message: `Subcategory "${name}" deleted`, type: "success" }); }
              else showToast?.({ message: data.error || "Failed to delete", type: "error" });
            } catch { showToast?.({ message: "Failed to delete subcategory", type: "error" }); }
          }
        },
      ],
    });
  };

  if (loading) return <div className="cbm-loading">Loading…</div>;

  // Non-shoe categories (simple) can't have sizes/subcategories
  const shoeCategories = categories.filter((c) => !["watch", "bags", "collectibles"].includes(c.slug));

  return (
    <div className="cbm-root">

      {/* ── Categories ── */}
      <div className="cbm-section">
        <h2 className="cbm-section-title chrome-text">Categories</h2>
        <form className="cbm-add-form" onSubmit={handleAddCategory}>
          <div className="cbm-input-group">
            <span className="cbm-input-label">New Category</span>
            <input className="cbm-input" type="text" placeholder="e.g. Footwear" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} maxLength={64} required />
          </div>
          <button type="submit" className="cbm-btn-add" disabled={catSaving || !newCatName.trim()}>{catSaving ? "…" : "Add"}</button>
        </form>
        <div className="cbm-list">
          {categories.length === 0 && <div className="cbm-empty">No categories yet.</div>}
          {categories.map((cat) => (
            <div key={cat.slug} className="cbm-item">
              <div className="cbm-item-info">
                <span className="cbm-item-name">{cat.name}</span>
                <span className="cbm-item-slug">{cat.slug}</span>
                {cat.isDefault && <span className="cbm-badge-default">default</span>}
              </div>
              {!cat.isDefault && <button className="cbm-btn-delete" onClick={() => handleDeleteCategory(cat.slug, cat.name, cat.isDefault)}>Delete</button>}
            </div>
          ))}
        </div>
      </div>

      {/* ── Brands ── */}
      <div className="cbm-section">
        <h2 className="cbm-section-title chrome-text">Brands</h2>
        <form className="cbm-add-form" onSubmit={handleAddBrand}>
          <div className="cbm-input-group">
            <span className="cbm-input-label">Brand Name</span>
            <input className="cbm-input" type="text" placeholder="e.g. Nike" value={newBrandName} onChange={(e) => setNewBrandName(e.target.value)} maxLength={64} required />
          </div>
          <div className="cbm-input-group">
            <span className="cbm-input-label">Category</span>
            <select className="cbm-select" value={newBrandParent} onChange={(e) => setNewBrandParent(e.target.value)} required>
              <option value="">Select...</option>
              {categories.map((cat) => <option key={cat.slug} value={cat.slug}>{cat.name}</option>)}
            </select>
          </div>
          <button type="submit" className="cbm-btn-add" disabled={brandSaving || !newBrandName.trim() || !newBrandParent}>{brandSaving ? "…" : "Add"}</button>
        </form>
        <div className="cbm-list">
          {brands.length === 0 && <div className="cbm-empty">No brands yet.</div>}
          {brands.map((brand) => (
            <div key={brand.slug} className="cbm-item">
              <div className="cbm-item-info">
                <span className="cbm-item-name">{brand.name}</span>
                <span className="cbm-item-slug">{brand.slug}</span>
                <span className="cbm-item-parent">↳ {brand.parentCategory}</span>
                {brand.isDefault && <span className="cbm-badge-default">default</span>}
              </div>
              {!brand.isDefault && <button className="cbm-btn-delete" onClick={() => handleDeleteBrand(brand.slug, brand.name, brand.isDefault)}>Delete</button>}
            </div>
          ))}
        </div>
      </div>

      {/* ── Sizes ── */}
      <div className="cbm-section">
        <h2 className="cbm-section-title chrome-text">
          Shoe Sizes
          <span className="cbm-section-hint-inline">Universal Scale</span>
        </h2>
        <form className="cbm-add-form" onSubmit={handleAddSize}>
          <div className="cbm-input-group">
            <span className="cbm-input-label">US Size</span>
            <input
              className={`cbm-input${sizeError ? " cbm-input--error" : ""}`}
              type="text"
              inputMode="decimal"
              placeholder="14 or 14.5"
              value={newSizeValue}
              onChange={handleSizeInput}
              maxLength={5}
            />
          </div>
          <button type="submit" className="cbm-btn-add" disabled={sizeSaving || !newSizeValue.trim()}>
            {sizeSaving ? "…" : "Add"}
          </button>
        </form>
        {sizeError && (
          <div style={{ fontSize: 11, color: "#dc2626", fontWeight: 500, marginTop: 2 }}>
            {sizeError}
          </div>
        )}
        <div style={{ fontSize: 11, color: "#9ca3af" }}>
          US sizes only · whole numbers or .5 steps (e.g. 14, 14.5)
        </div>
        <div className="cbm-size-grid">
          {sizes.length === 0 && <div className="cbm-empty" style={{ gridColumn: "1/-1" }}>No sizes yet.</div>}
          {sizes
            .slice()
            .sort((a, b) => parseFloat(a.value) - parseFloat(b.value))
            .map((sz) => (
              <div key={sz._id} className={`cbm-size-chip ${sz.isDefault ? "cbm-size-chip--default" : ""}`}>
                <span className="cbm-size-val">{sz.value}</span>
                {sz.isDefault
                  ? <span className="cbm-size-lock" title="Default size">🔒</span>
                  : <button className="cbm-size-del" onClick={() => handleDeleteSize(sz._id, sz.value, sz.isDefault)} title="Delete size">✕</button>
                }
              </div>
            ))}
        </div>
      </div>

      {/* ── Subcategories ── */}
      <div className="cbm-section">
        <h2 className="cbm-section-title chrome-text">
          Subcategories
          <span className="cbm-section-hint-inline">Lifestyles</span>
        </h2>
        <form className="cbm-add-form" onSubmit={handleAddSubcategory}>
          <div className="cbm-input-group">
            <span className="cbm-input-label">Name</span>
            <input className="cbm-input" type="text" placeholder="e.g. Running" value={newSubName} onChange={(e) => setNewSubName(e.target.value)} maxLength={64} required />
          </div>
          <div className="cbm-input-group">
            <span className="cbm-input-label">Parent</span>
            <select className="cbm-select" value={newSubParent} onChange={(e) => setNewSubParent(e.target.value)} required>
              <option value="">Select...</option>
              {shoeCategories.map((cat) => <option key={cat.slug} value={cat.slug}>{cat.name}</option>)}
            </select>
          </div>
          <button type="submit" className="cbm-btn-add" disabled={subSaving || !newSubName.trim() || !newSubParent}>{subSaving ? "…" : "Add"}</button>
        </form>
        <div className="cbm-list">
          {subcategories.length === 0 && <div className="cbm-empty">No subcategories yet.</div>}
          {subcategories.map((sub) => (
            <div key={sub.slug} className="cbm-item">
              <div className="cbm-item-info">
                <span className="cbm-item-name">{sub.name}</span>
                <span className="cbm-item-slug">{sub.slug}</span>
                <span className="cbm-item-parent">↳ {sub.parentCategory}</span>
                {sub.isDefault && <span className="cbm-badge-default">default</span>}
              </div>
              {!sub.isDefault && <button className="cbm-btn-delete" onClick={() => handleDeleteSubcategory(sub.slug, sub.name, sub.isDefault)}>Delete</button>}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

export default CategoryBrandManager;
