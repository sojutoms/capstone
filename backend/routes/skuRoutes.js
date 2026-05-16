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
const { authenticate } = require('../middleware/auth');

router.post("/addstock", addStock);
router.get("/allsequences", getAllSequences);
router.post("/marksequencesold", markSequenceSold);
router.get("/testsequence/:id", testSequence);
router.get("/sequences/:productId", getSequencesByProduct);
router.post("/assignsequence", assignSequence);
router.get("/userpurchases/:userId", getUserPurchases);
router.post("/reservesequence", reserveSequence);
router.post("/releaseexpiredreservations", releaseExpiredReservations);
router.get("/skustats", getSkuStats);
router.post("/restoresequence", restoreSequence);
router.delete("/deletesequence", deleteSequence);
router.post("/create_skus_for_product", createSkusForProductRoute);
router.post("/sync_product_skus", syncProductSkus);

// ─── One-time migration ───────────────────────────────────────────────────────
// POST /migrate-sku-numbers
// Backfills skuNumber onto all existing Products (sorted by id asc, so oldest
// product gets SKU #1) and syncs skuNumber onto their ShoeSequence records.
// Safe to call multiple times — only processes products with skuNumber = null.
router.post("/migrate-sku-numbers", migrateSkuNumbers);
router.post("/admin/migrate-sku-ids", migrateSkuIdsRoute);
router.post("/updateskuprice", updateSkuPrice);

router.post("/addstockbatch",    authenticate, addStockBatch);
router.post("/updateskupricev2", authenticate, updateSkuPriceV2);
router.get( "/batches/:productId", authenticate, getProductBatches);

module.exports = router;