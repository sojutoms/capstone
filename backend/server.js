require("dotenv").config();

const express = require("express");
const cors = require("cors");

const connectDB = require("./config/db");
const { initializeSequenceCounter } = require("./utils/sku");
const { startBackgroundJobs } = require("./utils/jobs");

// ─── Route imports ────────────────────────────────────────────────────────────
const uploadRoutes  = require("./routes/uploadRoutes");
const productRoutes = require("./routes/productRoutes");
const orderRoutes   = require("./routes/orderRoutes");
const adminRoutes   = require("./routes/adminRoutes");
const userRoutes    = require("./routes/userRoutes");
const cartRoutes    = require("./routes/cartRoutes");
const skuRoutes     = require("./routes/skuRoutes");
const reviewRoutes  = require("./routes/reviewRoutes");
const categoryBrandRoutes = require("./routes/categoryBrandRoutes")
const { seedCategoryBrand } = require("./utils/seedCategoryBrand");
const seedSizesSubcategories = require("./utils/seedSizesSubcategories");

// ─── App setup ────────────────────────────────────────────────────────────────
const app = express();
const port = process.env.PORT || 4000;

// Allowed origins — set ALLOWED_ORIGINS in your .env or Render env vars
// Multiple origins: ALLOWED_ORIGINS=https://sneakyconcepts.com,https://admin.sneakyconcepts.com
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : [
      "http://localhost:3000",
      "http://localhost:5173",
      "http://localhost:8081",   // ← Expo web
      "https://unlaboured-charise-unmachined.ngrok-free.dev",  // ← Expo web (alternate port)
    ];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (Postman, mobile apps, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS blocked: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "auth-token", "Authorization", "ngrok-skip-browser-warning"],
  })
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ─── Connect DB ───────────────────────────────────────────────────────────────
connectDB();

// ─── Routes ───────────────────────────────────────────────────────────────────
app.get("/", (req, res) => res.send("Express App is Running"));

app.use("/", uploadRoutes);
app.use("/", productRoutes);
app.use("/", orderRoutes);
app.use("/", adminRoutes);
app.use("/", userRoutes);
app.use("/", cartRoutes);
app.use("/", skuRoutes);
app.use("/", reviewRoutes);
app.use("/", categoryBrandRoutes);
// ─── Init & background jobs ───────────────────────────────────────────────────
initializeSequenceCounter();
seedCategoryBrand();
seedSizesSubcategories();
startBackgroundJobs();

console.log("✅ SKU Tracking System initialized");

// ─── Start server ─────────────────────────────────────────────────────────────
app.listen(port, () => console.log(`✅ Server running on port ${port}`));