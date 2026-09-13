require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("../models/Product");

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const products = await Product.find({}, "id name category image subImages").lean();
  const sorted = products
    .map((p) => ({ ...p, total: (p.image ? 1 : 0) + (p.subImages || []).length }))
    .sort((a, b) => b.total - a.total);
  sorted.slice(0, 8).forEach((p) => {
    console.log(`id=${p.id} "${p.name}" cat=${p.category} total=${p.total}`);
  });
  await mongoose.disconnect();
})();
