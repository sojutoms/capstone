require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("../models/Product");

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const p = await Product.findOne({ id: 1 }, "name image subImages").lean();
  console.log(JSON.stringify({ image: p.image, subImages: p.subImages }, null, 2));
  await mongoose.disconnect();
})();
