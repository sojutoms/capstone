const express = require("express");
const router = express.Router();
const { Review } = require("../models/index");

router.post("/addreview", async (req, res) => {
  const { productId, review, rating } = req.body;
  if (!productId || !review || !rating)
    return res.json({ success: false, error: "Missing fields" });
  try {
    const newReview = new Review({ productId, review, rating });
    await newReview.save();
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

router.get("/getreviews/:productId", async (req, res) => {
  const reviews = await Review.find({ productId: req.params.productId }).sort({ date: -1 });
  res.json(reviews);
});

module.exports = router;