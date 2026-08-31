const Orders = require("../models/Orders");

// Orders currently holding a live (unexpired, unpaid, not-yet-cancelled)
// checkout reservation. Shared filter for every reservation lookup below.
const activeReservationFilter = () => ({
  paymentMethod: "online",
  inventoryCommitted: false,
  paymentStatus: { $ne: "paid" },
  status: "pending",
  checkoutReservedUntil: { $gt: new Date() },
});

// Sum of quantity every order currently holding a live reservation is
// claiming, grouped by "productId_size". Used to make the publicly displayed
// stock reflect items someone is actively paying for right now, without
// touching the real Product stock (nothing is deducted until payment is
// confirmed — see finalizeOnlineOrderPayment).
async function getActiveReservationsMap() {
  const holders = await Orders.find(activeReservationFilter(), "items").lean();

  const map = {};
  for (const o of holders) {
    for (const it of o.items || []) {
      const key = `${it.id}_${it.size || ""}`;
      map[key] = (map[key] || 0) + Number(it.quantity || 0);
    }
  }
  return map;
}

// Sum of quantity reserved for one exact product/size right now. Pass
// excludeOrderNumber to leave a specific order's own hold out of the count
// (used when re-checking that same order's own checkout).
async function getReservedQtyForItem(productId, size, excludeOrderNumber = null) {
  const filter = {
    ...activeReservationFilter(),
    items: { $elemMatch: { id: productId, size: size || "" } },
  };
  if (excludeOrderNumber) filter.orderNumber = { $ne: excludeOrderNumber };

  const holders = await Orders.find(filter, "items").lean();

  let total = 0;
  for (const o of holders) {
    for (const it of o.items || []) {
      if (it.id === productId && String(it.size || "") === String(size || "")) total += Number(it.quantity || 0);
    }
  }
  return total;
}

module.exports = { getActiveReservationsMap, getReservedQtyForItem };
