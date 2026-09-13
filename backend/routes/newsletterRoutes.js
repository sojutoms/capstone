const express = require("express");
const router = express.Router();

const { subscribeNewsletter } = require("../controllers/newsletterController");

// Public endpoint (no auth) — light per-IP throttle to deter scripted spam.
const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map(); // ip -> [timestamps]

const throttle = (req, res, next) => {
  const ip = req.ip || req.socket?.remoteAddress || "unknown";
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    return res.status(429).json({ success: false, error: "Too many attempts. Please wait a moment." });
  }
  recent.push(now);
  hits.set(ip, recent);
  next();
};

router.post("/newsletter/subscribe", throttle, subscribeNewsletter);

module.exports = router;
