// models/Subcategory.js
const mongoose = require("mongoose");

const subcategorySchema = new mongoose.Schema(
  {
    name:           { type: String, required: true, trim: true },
    slug:           { type: String, required: true, unique: true, trim: true },
    parentCategory: { type: String, required: true, trim: true }, // matches category slug
    order:          { type: Number, default: 0 },
    isDefault:      { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Subcategory", subcategorySchema);