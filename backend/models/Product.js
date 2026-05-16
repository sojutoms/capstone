const mongoose = require("mongoose");

const sizeEntrySchema = new mongoose.Schema(
  {
    size:     { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, default: 0, min: 0 },
    price:    { type: Number, required: true, default: 0, min: 0 },
  },
  { _id: false }
);

// ── Colorway sub-document ─────────────────────────────────────────────────────
// Each colorway is an alternate color variant of the same shoe model.
// name      — display label, e.g. "Love Letter", "Court Blue"
// hex       — optional CSS swatch color, e.g. "#1a3bcc"
// image     — main product image URL for this colorway
// subImages — gallery thumbnail URLs for this colorway (max 4)
const colorwaySchema = new mongoose.Schema(
  {
    name:      { type: String, required: true, trim: true },
    hex:       { type: String, default: "#000000" },
    image:     { type: String, default: "" },
    subImages: { type: [String], default: [] },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },

    parentId: { type: Number, default: null, index: true },

    // ── skuNumber: product-model level identifier (one per product added).
    //    e.g. "Adidas Samba" = SKU #1, "Nike Dunk" = SKU #2.
    //    Assigned automatically on addProduct. Never changes after creation.
    skuNumber: { type: Number, index: true, default: null },

    name:      { type: String, required: true, trim: true },
    image:     { type: String, default: "" },
    subImages: { type: [String], default: [] },

    // ── colorways: alternate color variants of this exact model.
    //    Each entry carries its own images (main + gallery).
    //    Sizes, description, category, brand, and reviews are shared across all colorways.
    colorways: { type: [colorwaySchema], default: [] },

    // ── category: "shoes" | "watch" | "bags" | "collectibles" | custom
    category: { type: String, index: true, default: "" },

    // ── brand: "adidas" | "nike" | "puma" | "nb" | custom (only for shoes)
    brand: { type: String, index: true, default: "" },

    // ── subCategories: only relevant for shoes
    //    e.g. ["lifestyle", "running"] — stored lowercase, multi-select
    subCategories: { type: [String], default: [] },

    description: { type: String, default: "" },
    sizes:       { type: [sizeEntrySchema], default: [] },
    price:       { type: Number, default: 0, min: 0 },
    stock:       { type: Number, default: 0, min: 0 },
    featured:    { type: Boolean, default: false },
    salesCount:  { type: Number, default: 0 },
    isNew:       { type: Boolean, default: false },
    available:   { type: Boolean, default: true },
    isDeleted:   { type: Boolean, default: false },
    isTopSellerInBrand: { type: Boolean, default: false },
    tags:        { type: [String], default: [] },
  },
  {
    timestamps: { createdAt: "date", updatedAt: "updatedAt" },
  }
);

const Product = mongoose.model("Product", productSchema);

module.exports = Product;