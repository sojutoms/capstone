const express = require("express");
const router = express.Router();

const { chatWithBot } = require("../controllers/chatbotController");

// Simple in-memory per-IP throttle — this endpoint is public (guests can
// chat too) and calls a paid API, so it needs some abuse protection even
// without a full rate-limiting library.
const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 15;
const hits = new Map(); // ip -> [timestamps]

const throttle = (req, res, next) => {
  const ip = req.ip || req.socket?.remoteAddress || "unknown";
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    return res.status(429).json({ success: false, error: "You're sending messages too quickly. Please wait a moment." });
  }
  recent.push(now);
  hits.set(ip, recent);
  next();
};

router.post("/chatbot", throttle, chatWithBot);

module.exports = router;
