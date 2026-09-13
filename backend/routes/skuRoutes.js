const express = require("express");
const router = express.Router();
const {
  addStock,
  getAllSequences,
  markSequenceSold,
  testSequence,
  getSequencesByProduct,
  assignSequence,
  getUserPurchases,
  reserveSequence,
  releaseExpiredReservations,
  getSkuStats,
  restoreSequence,
  deleteSequence,
  createSkusForProductRoute,
  syncProductSkus,
  migrateSkuIdsRoute,
  updateSkuPrice,
  addStockBatch,
  updateSkuPriceV2,
  getProductBatches,
} = require("../controllers/skuController");

const { migrateSkuNumbers } = require("../controllers/productController");
const { authenticate, requireRole } = require('../middleware/auth');

// Inventory staff and above can view/mutate stock & sequences; the handful of
// one-time migrations and price rewrites below are restricted further to
// owner/admin only.
const inventoryAuth = requireRole("owner", "admin", "staff", "inventory_staff");
const skuAdminAuth = requireRole("owner", "admin");

router.post("/addstock", inventoryAuth, addStock);
router.get("/allsequences", inventoryAuth, getAllSequences);
router.post("/marksequencesold", inventoryAuth, markSequenceSold);
router.get("/testsequence/:id", inventoryAuth, testSequence);
router.get("/sequences/:productId", inventoryAuth, getSequencesByProduct);
router.post("/assignsequence", inventoryAuth, assignSequence);
router.get("/userpurchases/:userId", inventoryAuth, getUserPurchases);
router.post("/reservesequence", inventoryAuth, reserveSequence);
router.post("/releaseexpiredreservations", inventoryAuth, releaseExpiredReservations);
router.get("/skustats", inventoryAuth, getSkuStats);
router.post("/restoresequence", inventoryAuth, restoreSequence);
router.delete("/deletesequence", skuAdminAuth, deleteSequence);
router.post("/create_skus_for_product", inventoryAuth, createSkusForProductRoute);
router.post("/sync_product_skus", inventoryAuth, syncProductSkus);

// ─── One-time migration ───────────────────────────────────────────────────────
// POST /migrate-sku-numbers
// Backfills skuNumber onto all existing Products (sorted by id asc, so oldest
// product gets SKU #1) and syncs skuNumber onto their ShoeSequence records.
// Safe to call multiple times — only processes products with skuNumber = null.
router.post("/migrate-sku-numbers", skuAdminAuth, migrateSkuNumbers);
router.post("/admin/migrate-sku-ids", skuAdminAuth, migrateSkuIdsRoute);
router.post("/updateskuprice", skuAdminAuth, updateSkuPrice);

router.post("/addstockbatch",    authenticate, addStockBatch);
router.post("/updateskupricev2", authenticate, updateSkuPriceV2);
router.get( "/batches/:productId", authenticate, getProductBatches);

module.exports = router;