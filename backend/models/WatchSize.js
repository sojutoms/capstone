const mongoose = require("mongoose");

const WatchSizeSchema = new mongoose.Schema(
  {
    value: { type: String, required: true, unique: true },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("WatchSize", WatchSizeSchema);