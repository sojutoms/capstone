require("dotenv").config();
const jwt = require("jsonwebtoken");
const axios = require("axios");
const mongoose = require("mongoose");
const Product = require("../models/Product");

const BASE = "http://localhost:4000";
const JWT_SECRET = process.env.JWT_SECRET || "secret_ecom";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  await mongoose.connect(process.env.MONGO_URI);

  // Pick a real, non-deleted product with a main image + at least 2 sub images
  // (front/left/back at minimum) for a decent multiview result.
  const product = await Product.findOne({
    isDeleted: { $ne: true },
    image: { $exists: true, $ne: "" },
    $expr: { $gte: [{ $size: { $ifNull: ["$subImages", []] } }, 2] },
  }).lean();

  if (!product) {
    console.log("No eligible product found (needs image + 2 subImages). Aborting.");
    process.exit(1);
  }

  console.log(`Testing on product #${product.id} — "${product.name}"`);
  console.log("front:", product.image);
  console.log("subImages:", product.subImages);

  const token = jwt.sign({ id: 0, email: "test@internal", roles: ["admin"] }, JWT_SECRET, { expiresIn: "1h" });
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const genRes = await axios.post(`${BASE}/generate-3d-model`, { productId: product.id }, { headers });
  console.log("generate-3d-model response:", genRes.data);

  const deadline = Date.now() + 6 * 60 * 1000;
  while (Date.now() < deadline) {
    const { data } = await axios.get(`${BASE}/model-status/${product.id}`, { headers });
    console.log(`[${new Date().toISOString()}] status:`, data.model3d.status);
    if (data.model3d.status === "ready") {
      console.log("SUCCESS. glbUrl:", data.model3d.glbUrl);
      console.log("frames:", data.model3d.turntableFrames.length, data.model3d.turntableFrames[0]);
      break;
    }
    if (data.model3d.status === "failed") {
      console.log("FAILED:", data.model3d.error);
      break;
    }
    await sleep(5000);
  }

  await mongoose.disconnect();
  process.exit(0);
})().catch((err) => {
  console.error("SCRIPT ERROR:", err.response?.data || err.message);
  process.exit(1);
});
