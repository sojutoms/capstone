// models/ShoeSequence.js
// If your ShoeSequence schema is defined inline in models/index.js, apply
// these same field additions there instead.

const mongoose = require("mongoose");

const shoeSequenceSchema = new mongoose.Schema(
  {
    // ── sequenceNumber ────────────────────────────────────────────────────────
    // Global auto-incrementing counter. Legacy field — kept forever for
    // backward compatibility with any code that still references it.
    sequenceNumber: { type: Number, required: true, unique: true, index: true },

    // ── productId ─────────────────────────────────────────────────────────────
    // Per-unit identifier shown in the admin UI as "Product ID #X".
    // For all NEW records this equals sequenceNumber (same global counter).
    // Old records that predate this field will have it backfilled by
    // GET /allsequences (runtime normalization) and POST /migrate-sku-numbers
    // (permanent DB backfill).
    productId: { type: Number, index: true, default: null },

    // ── skuNumber ─────────────────────────────────────────────────────────────
    // Product-model level identifier — one per distinct product added.
    // Denormalized copy of Product.skuNumber for fast reads without a join.
    // e.g. every ShoeSequence record for "Adidas Samba" has skuNumber = 1.
    skuNumber: { type: Number, index: true, default: null },

    // ── productRef ────────────────────────────────────────────────────────────
    // Canonical FK to the parent Product document (Product.id, not _id).
    // Preferred over the old `productId` field when filtering by product.
    // Old records without productRef can be matched via `productId` using
    // the $or queries in skuController.
    productRef: { type: Number, index: true, default: null },

    // ── existing fields ───────────────────────────────────────────────────────
    productName: { type: String, default: "" },
    productImage: { type: String, default: "" },
    productPrice: { type: Number, default: 0 },
    category: { type: String, default: "" },
    brand: { type: String, default: "" },
    size: { type: String, default: "—" },
    status: {
      type: String,
      enum: ["available", "sold", "reserved"],
      default: "available",
      index: true,
    },
    condition: { type: String, default: "10" },
    location: { type: String, default: "Robinsons Galleria" },
    addedDate: { type: Date, default: Date.now },
    soldDate: { type: Date, default: null },
    soldToUserId: { type: String, default: null },
    reservedUntil: { type: Date, default: null },
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: "StockBatch", default: null, index: true },
    batchNumber: { type: Number, default: null },
    costPrice: { type: Number, default: 0 },
    priceHistory: [{ price: Number, changedAt: Date, changedBy: String, reason: String }],

    price: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient product+status lookups (used everywhere)
shoeSequenceSchema.index({ productRef: 1, status: 1 });
shoeSequenceSchema.index({ skuNumber: 1, status: 1 });

const ShoeSequence = mongoose.model("ShoeSequence", shoeSequenceSchema);

module.exports = ShoeSequence;