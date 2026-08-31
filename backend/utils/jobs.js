const Product = require("../models/Product");
const { ShoeSequence } = require("../models/index");
const { autoCancelUnpaidOnlineOrders, autoCancelExpiredReservedOrders } = require("../controllers/orderController");

// ─── Auto-update "isNew" status ───────────────────────────────────────────────
// Products older than 30 days lose their "new" flag.
async function autoUpdateNewStatus() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 7);

    const result = await Product.updateMany(
      { isNew: true, date: { $lt: thirtyDaysAgo } },
      { $set: { isNew: false } }
    );

    if (result.modifiedCount > 0) {
      console.log(`✅ Auto-updated ${result.modifiedCount} products: removed "new" status`);
    }
  } catch (err) {
    console.error("❌ Error auto-updating new status:", err);
  }
}

// ─── Auto-release expired SKU reservations ────────────────────────────────────
// Runs every 5 minutes. Reserved SKUs past their reservedUntil date go back to available.
async function autoReleaseExpiredReservations() {
  try {
    const result = await ShoeSequence.updateMany(
      { status: "reserved", reservedUntil: { $lt: new Date() } },
      { $set: { status: "available", soldToUserId: null, reservedUntil: null } }
    );

    if (result.modifiedCount > 0) {
      console.log(`✅ Released ${result.modifiedCount} expired reservations`);
    }
  } catch (err) {
    console.error("Auto-release reservations error:", err);
  }
}

// ─── Start all background jobs ────────────────────────────────────────────────
function startBackgroundJobs() {
  // Run once on startup
  autoUpdateNewStatus();

  // Then on a schedule
  setInterval(autoUpdateNewStatus, 24 * 60 * 60 * 1000);       // every 24 hours
  setInterval(autoReleaseExpiredReservations, 5 * 60 * 1000);  // every 5 minutes
  setInterval(autoCancelUnpaidOnlineOrders, 5 * 60 * 1000);    // every 5 minutes
  setInterval(autoCancelExpiredReservedOrders, 60 * 1000);     // every 1 minute — keeps the 15-min payment window tight

  console.log("✅ Background jobs started");
}

module.exports = { startBackgroundJobs };