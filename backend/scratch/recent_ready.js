require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("../models/Product");

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const products = await Product.find({ "model3d.status": { $in: ["ready", "processing", "rendering", "failed"] } }, "id name isDeleted image subImages model3d createdAt").sort({ id: -1 }).limit(5).lean();
  products.forEach(p => {
    console.log(`id=${p.id} "${p.name}" isDeleted=${p.isDeleted} status=${p.model3d?.status}`);
    console.log(`  image: ${p.image}`);
    (p.subImages||[]).forEach((s,i) => console.log(`  sub${i}: ${s}`));
  });
  await mongoose.disconnect();
})();
