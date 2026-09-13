require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("../models/Product");

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const p = await Product.findOne({ id: 2 }, "name image").lean();
  console.log(JSON.stringify(p));
  await mongoose.disconnect();
})();
