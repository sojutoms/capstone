// models/StockBatch.js
const mongoose = require("mongoose");

/**
 * StockBatch — one record per "Add Stock" intake event.
 *
 * Every ShoeSequence created in that event stores batchId → this doc's _id,
 * so you can always trace which batch a unit came from, filter price edits
 * to a specific batch, and build a full intake history.
 */
const stockBatchSchema = new mongoose.Schema(
  {
    // ── Identity ───────────────────────────────────────────────────────────────
    productId:    { type: Number, required: true, index: true },
    productName:  { type: String, default: "" },
    batchNumber:  { type: Number, default: 0 },   // auto-incremented per product

    // ── Intake metadata ────────────────────────────────────────────────────────
    supplierName:      { type: String, default: "" },
    costPrice:         { type: Number, default: 0 },  // what you paid per unit
    notes:             { type: String, default: "" },
    receivedDate:      { type: Date,   default: Date.now },
    addedBy:           { type: String, default: null }, // admin email

    // ── What was added ─────────────────────────────────────────────────────────
    // Array of { size, quantity, sellingPrice } — one entry per size in this batch
    lines: [
      {
        size:         { type: String, required: true },
        quantity:     { type: Number, required: true },
        sellingPrice: { type: Number, required: true },
      },
    ],
    totalUnits: { type: Number, default: 0 },

    // ── Product ID range created ───────────────────────────────────────────────
    pidStart: { type: Number, default: 0 },
    pidEnd:   { type: Number, default: 0 },

    category: { type: String, default: "" },
    brand:    { type: String, default: "" },
  },
  { timestamps: true }
);

stockBatchSchema.index({ productId: 1, createdAt: -1 });

const StockBatch = mongoose.model("StockBatch", stockBatchSchema);
module.exports = StockBatch;