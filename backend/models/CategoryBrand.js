// models/CategoryBrand.js
const mongoose = require("mongoose");

const categoryBrandSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: ["category", "brand"],
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    // slug is the lowercase key used in DB/filtering (e.g. "new balance" → "nb")
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    // brands belong to a category (e.g. adidas belongs to "shoes")
    parentCategory: {
      type: String,
      default: null,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Compound unique index: type + slug
categoryBrandSchema.index({ type: 1, slug: 1 }, { unique: true });

const CategoryBrand = mongoose.model("CategoryBrand", categoryBrandSchema);

module.exports = CategoryBrand;