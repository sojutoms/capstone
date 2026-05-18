// routes/categoryBrandRoutes.js
const express = require("express");
const router = express.Router();
const CategoryBrand = require("../models/CategoryBrand");
const { requireRole } = require("../middleware/auth");
const ShoeSize    = require("../models/ShoeSize");
const WatchSize   = require("../models/WatchSize");
const Subcategory = require("../models/Subcategory");

// ─── GET all categories ───────────────────────────────────────
router.get("/categories", async (req, res) => {
  try {
    const categories = await CategoryBrand.find({ type: "category" })
      .sort({ order: 1, createdAt: 1 })
      .lean();
    res.json({ success: true, categories });
  } catch (err) {
    console.error("GET /categories error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// ─── GET all brands (optionally filter by parentCategory) ─────
router.get("/brands", async (req, res) => {
  try {
    const filter = { type: "brand" };
    if (req.query.category) filter.parentCategory = req.query.category;

    const brands = await CategoryBrand.find(filter)
      .sort({ order: 1, createdAt: 1 })
      .lean();
    res.json({ success: true, brands });
  } catch (err) {
    console.error("GET /brands error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// ─── POST create category (owner only) ───────────────────────
router.post("/categories", requireRole("owner"), async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: "Name is required" });
    }

    const slug = name.trim().toLowerCase().replace(/\s+/g, "-");

    const existing = await CategoryBrand.findOne({ type: "category", slug });
    if (existing) {
      return res.status(409).json({ success: false, error: "Category already exists" });
    }

    const count = await CategoryBrand.countDocuments({ type: "category" });
    const category = new CategoryBrand({
      type: "category",
      name: name.trim(),
      slug,
      order: count + 1,
      isDefault: false,
    });

    await category.save();
    res.json({ success: true, category });
  } catch (err) {
    console.error("POST /categories error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// ─── POST create brand (owner only) ──────────────────────────
router.post("/brands", requireRole("owner"), async (req, res) => {
  try {
    const { name, parentCategory } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: "Name is required" });
    }
    if (!parentCategory) {
      return res.status(400).json({ success: false, error: "Parent category is required" });
    }

    const slug = name.trim().toLowerCase().replace(/\s+/g, "-");

    const existing = await CategoryBrand.findOne({ type: "brand", slug });
    if (existing) {
      return res.status(409).json({ success: false, error: "Brand already exists" });
    }

    const count = await CategoryBrand.countDocuments({ type: "brand" });
    const brand = new CategoryBrand({
      type: "brand",
      name: name.trim(),
      slug,
      parentCategory,
      order: count + 1,
      isDefault: false,
    });

    await brand.save();
    res.json({ success: true, brand });
  } catch (err) {
    console.error("POST /brands error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// ─── DELETE category (owner only, non-default only) ──────────
router.delete("/categories/:slug", requireRole("owner"), async (req, res) => {
  try {
    const { slug } = req.params;
    const category = await CategoryBrand.findOne({ type: "category", slug });

    if (!category) {
      return res.status(404).json({ success: false, error: "Category not found" });
    }
    if (category.isDefault) {
      return res.status(403).json({ success: false, error: "Cannot delete a default category" });
    }

    await CategoryBrand.deleteOne({ type: "category", slug });

    // Also delete brands that belong to this category
    await CategoryBrand.deleteMany({ type: "brand", parentCategory: slug });

    res.json({ success: true, message: "Category deleted" });
  } catch (err) {
    console.error("DELETE /categories/:slug error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// ─── DELETE brand (owner only, non-default only) ─────────────
router.delete("/brands/:slug", requireRole("owner"), async (req, res) => {
  try {
    const { slug } = req.params;
    const brand = await CategoryBrand.findOne({ type: "brand", slug });

    if (!brand) {
      return res.status(404).json({ success: false, error: "Brand not found" });
    }
    if (brand.isDefault) {
      return res.status(403).json({ success: false, error: "Cannot delete a default brand" });
    }

    await CategoryBrand.deleteOne({ type: "brand", slug });
    res.json({ success: true, message: "Brand deleted" });
  } catch (err) {
    console.error("DELETE /brands/:slug error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// ─── ADD THESE to routes/categoryBrandRoutes.js ───────────────────────────────
// 1. Add imports at the top of categoryBrandRoutes.js:
//      const ShoeSize     = require("../models/ShoeSize");
//      const Subcategory  = require("../models/Subcategory");
//
// 2. Paste the routes below into the file before module.exports

// ══════════════════════════════════════════════════════════════════════════════
// SHOE SIZES
// ══════════════════════════════════════════════════════════════════════════════

// GET all sizes
router.get("/sizes", async (req, res) => {
  try {
    const sizes = await ShoeSize.find().sort({ order: 1, value: 1 }).lean();
    res.json({ success: true, sizes });
  } catch (err) {
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// POST create size (owner only)
router.post("/sizes", requireRole("owner"), async (req, res) => {
  try {
    const { value } = req.body;
    if (!value || !String(value).trim()) {
      return res.status(400).json({ success: false, error: "Size value is required" });
    }

    const trimmed = String(value).trim();

    const existing = await ShoeSize.findOne({ value: trimmed });
    if (existing) {
      return res.status(409).json({ success: false, error: "Size already exists" });
    }

    const count = await ShoeSize.countDocuments();
    const size  = new ShoeSize({ value: trimmed, order: count + 1, isDefault: false });
    await size.save();

    res.json({ success: true, size });
  } catch (err) {
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// DELETE size (owner only, non-default only)
router.delete("/sizes/:id", requireRole("owner"), async (req, res) => {
  try {
    const size = await ShoeSize.findById(req.params.id);
    if (!size)          return res.status(404).json({ success: false, error: "Size not found" });
    if (size.isDefault) return res.status(403).json({ success: false, error: "Cannot delete a default size" });

    await ShoeSize.deleteOne({ _id: req.params.id });
    res.json({ success: true, message: "Size deleted" });
  } catch (err) {
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// SUBCATEGORIES
// ══════════════════════════════════════════════════════════════════════════════

// GET all subcategories (optionally filter by parentCategory)
router.get("/subcategories", async (req, res) => {
  try {
    const filter = {};
    if (req.query.category) filter.parentCategory = req.query.category;

    const subcategories = await Subcategory.find(filter)
      .sort({ order: 1, createdAt: 1 })
      .lean();
    res.json({ success: true, subcategories });
  } catch (err) {
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// POST create subcategory (owner only)
router.post("/subcategories", requireRole("owner"), async (req, res) => {
  try {
    const { name, parentCategory } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: "Name is required" });
    }
    if (!parentCategory) {
      return res.status(400).json({ success: false, error: "Parent category is required" });
    }

    const slug = name.trim().toLowerCase().replace(/\s+/g, "-");

    const existing = await Subcategory.findOne({ slug, parentCategory });
    if (existing) {
      return res.status(409).json({ success: false, error: "Subcategory already exists for this category" });
    }

    const count = await Subcategory.countDocuments({ parentCategory });
    const sub   = new Subcategory({
      name: name.trim(),
      slug,
      parentCategory,
      order: count + 1,
      isDefault: false,
    });
    await sub.save();

    res.json({ success: true, subcategory: sub });
  } catch (err) {
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// DELETE subcategory (owner only, non-default only)
router.delete("/subcategories/:slug", requireRole("owner"), async (req, res) => {
  try {
    const sub = await Subcategory.findOne({ slug: req.params.slug });
    if (!sub)          return res.status(404).json({ success: false, error: "Subcategory not found" });
    if (sub.isDefault) return res.status(403).json({ success: false, error: "Cannot delete a default subcategory" });

    await Subcategory.deleteOne({ slug: req.params.slug });
    res.json({ success: true, message: "Subcategory deleted" });
  } catch (err) {
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// WATCH SIZES (case diameter in mm)
// ══════════════════════════════════════════════════════════════════════════════

router.get("/watch-sizes", async (req, res) => {
  try {
    const sizes = await WatchSize.find().sort({ order: 1, value: 1 }).lean();
    res.json({ success: true, sizes });
  } catch (err) {
    res.status(500).json({ success: false, error: "Server error" });
  }
});

router.post("/watch-sizes", requireRole("owner"), async (req, res) => {
  try {
    const { value } = req.body;
    if (!value || !String(value).trim()) {
      return res.status(400).json({ success: false, error: "Size value is required" });
    }
    const trimmed = String(value).trim();
    const existing = await WatchSize.findOne({ value: trimmed });
    if (existing) {
      return res.status(409).json({ success: false, error: "Size already exists" });
    }
    const size = new WatchSize({ value: trimmed, isDefault: false });
    await size.save();
    res.json({ success: true, size });
  } catch (err) {
    res.status(500).json({ success: false, error: "Server error" });
  }
});

router.delete("/watch-sizes/:id", requireRole("owner"), async (req, res) => {
  try {
    const size = await WatchSize.findById(req.params.id);
    if (!size)          return res.status(404).json({ success: false, error: "Size not found" });
    if (size.isDefault) return res.status(403).json({ success: false, error: "Cannot delete a default size" });
    await WatchSize.deleteOne({ _id: req.params.id });
    res.json({ success: true, message: "Size deleted" });
  } catch (err) {
    res.status(500).json({ success: false, error: "Server error" });
  }
});

module.exports = router;