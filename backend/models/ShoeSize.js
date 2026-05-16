// models/ShoeSize.js
const mongoose = require("mongoose");

const shoeSizeSchema = new mongoose.Schema(
  {
    value:     { type: String, required: true, unique: true, trim: true }, // "6", "6.5", "13"
    order:     { type: Number, default: 0 },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ShoeSize", shoeSizeSchema);