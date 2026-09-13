require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("../models/Product");

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const products = await Product.find({ category: { $in: ["nike", "adidas", "puma", "nb"] } }, "id name image subImages").lean();
  const good = products.filter((p) => p.image && (p.subImages || []).length >= 3);
  good.slice(0, 3).forEach((p) => {
    console.log(`id=${p.id} "${p.name}"`);
    console.log(`  main: ${p.image}`);
    (p.subImages || []).forEach((s, i) => console.log(`  sub${i}: ${s}`));
  });
  console.log(`\n${good.length} products have 4+ images total`);
  await mongoose.disconnect();
})();
