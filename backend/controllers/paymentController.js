const crypto = require("crypto");
const paymongo = require("../utils/paymongo");
const Orders = require("../models/Orders");
const Product = require("../models/Product");
const { finalizeOnlineOrderPayment, SIMPLE_CATEGORIES } = require("./orderController");
const { getReservedQtyForItem } = require("../utils/reservations");

const FRONTEND_URL = (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
const WEBHOOK_SECRET = process.env.PAYMONGO_WEBHOOK_SECRET || "";

// How long a checkout session "holds" the last unit(s) of an item for the
// buyer who clicked Pay Now, before another buyer can claim them instead.
const CHECKOUT_RESERVATION_MINUTES = 15;

// ─── POST /create-checkout-session ─────────────────────────────────────────────
const createCheckoutSession = async (req, res) => {
  try {
    const { orderNumber } = req.body;
    if (!orderNumber) return res.status(400).json({ success: false, error: "orderNumber is required" });

    const order = await Orders.findOne({ orderNumber });
    if (!order) return res.status(404).json({ success: false, error: "Order not found" });
    if (String(order.userId || "") !== String(req.user.id))
      return res.status(403).json({ success: false, error: "Not allowed" });
    if (order.paymentStatus === "paid")
      return res.status(400).json({ success: false, error: "Order is already paid" });

    // Inventory isn't committed for online orders until payment is confirmed,
    // so re-check current availability (minus what other in-flight checkouts
    // are already holding) right before sending this buyer to pay. This is
    // what actually stops a second buyer from paying for the last unit —
    // finalizeOnlineOrderPayment's oversold flag is only the fallback for the
    // (much narrower) case where two of these checks land at the same instant.
    if (!order.inventoryCommitted) {
      // Nothing was ever deducted for this order (deferred commit), so a sold-out
      // checkout can never be completed — cancel it right away instead of leaving
      // an "unpaid" order sitting in the buyer's order history that looks like
      // it's still pending. Same endpoint serves both a fresh checkout attempt
      // (PlaceOrder) and a retry from an existing order (OrderHistory), so this
      // fixes the phantom-order issue in both places at once.
      const cancelDeadOrder = async () => {
        await Orders.updateOne(
          { orderNumber, status: "pending" },
          { $set: { status: "cancelled", updatedAt: new Date() } }
        );
      };

      // checkoutReservedUntil is a hard, non-renewable deadline: it's set once
      // on the *first* checkout attempt and never pushed back by a retry. If a
      // retry click reset it every time, a buyer could keep an item's stock
      // reserved indefinitely just by repeatedly clicking "Complete Payment"
      // without ever actually paying. Once the original 15-minute window is
      // up, cancel it right here (don't wait for the cron) and refuse to
      // start a new session for it.
      if (order.checkoutReservedUntil && order.checkoutReservedUntil <= new Date()) {
        await cancelDeadOrder();
        return res.status(410).json({
          success: false,
          expired: true,
          error: "This order's 15-minute payment window has expired and it has been cancelled. Please place a new order.",
        });
      }

      for (const it of order.items) {
        const product = await Product.findOne({ id: it.id, isDeleted: { $ne: true } });
        if (!product) {
          await cancelDeadOrder();
          return res.status(409).json({ success: false, error: `${it.name} is no longer available.`, soldOut: true });
        }

        const isSimple = SIMPLE_CATEGORIES.includes(String(product.category || "").toLowerCase());
        let actualStock;
        if (isSimple) {
          actualStock = Number(product.stock || 0);
        } else {
          const sizesArray = Array.isArray(product.sizes) ? product.sizes : [];
          const sizeEntry = sizesArray.find((s) => String(s.size).trim() === String(it.size || "").trim());
          actualStock = sizeEntry ? Number(sizeEntry.quantity || 0) : 0;
        }

        const reservedByOthers = await getReservedQtyForItem(it.id, it.size, order.orderNumber);
        const trulyAvailable = actualStock - reservedByOthers;

        if (trulyAvailable < it.quantity) {
          await cancelDeadOrder();
          return res.status(409).json({
            success: false,
            soldOut: true,
            error: `${it.name}${it.size ? ` (size ${it.size})` : ""} is no longer available — someone else is already checking out the last unit.`,
          });
        }
      }

      // Only set the deadline on the first attempt — a retry within the same
      // window reuses it as-is rather than pushing it further out.
      if (!order.checkoutReservedUntil) {
        order.checkoutReservedUntil = new Date(Date.now() + CHECKOUT_RESERVATION_MINUTES * 60 * 1000);
      }
    }

    const amountCentavos = Math.round(Number(order.total) * 100);
    if (!Number.isFinite(amountCentavos) || amountCentavos <= 0)
      return res.status(400).json({ success: false, error: "Invalid order total" });

    // Break the charge into separate line items so the shipping fee is
    // actually visible on PayMongo's own hosted page — bundling everything
    // into one lump "Order X" line (as before) meant the fee was correctly
    // charged but invisible there, which read as "shipping isn't working"
    // even though the saved order total always included it correctly.
    const subtotalCentavos = Math.round(Number(order.subtotal || 0) * 100);
    const discountCentavos = Math.round(Number(order.discountAmount || 0) * 100);
    const shippingCentavos = Math.round(Number(order.shippingFee || 0) * 100);
    const merchandiseCentavos = Math.max(0, subtotalCentavos - discountCentavos);

    const lineItems = [
      {
        currency: "PHP",
        amount: merchandiseCentavos,
        name: `Order ${order.orderNumber} — Merchandise${discountCentavos > 0 ? " (after discount)" : ""}`,
        quantity: 1,
      },
    ];
    if (shippingCentavos > 0) {
      lineItems.push({
        currency: "PHP",
        amount: shippingCentavos,
        name: "Shipping Fee",
        quantity: 1,
      });
    }
    // Reconcile any rounding drift onto the merchandise line so the sum
    // charged always matches order.total exactly.
    const lineItemsSum = lineItems.reduce((sum, li) => sum + li.amount, 0);
    if (lineItemsSum !== amountCentavos) {
      lineItems[0].amount += amountCentavos - lineItemsSum;
    }

    const response = await paymongo.post("/checkout_sessions", {
      data: {
        attributes: {
          send_email_receipt: false,
          show_description: true,
          show_line_items: true,
          description: `GoodSoles Order ${order.orderNumber}`,
          line_items: lineItems,
          payment_method_types: ["card", "gcash", "paymaya"],
          success_url: `${FRONTEND_URL}/orders?paymentStatus=success&orderNumber=${encodeURIComponent(order.orderNumber)}`,
          cancel_url: `${FRONTEND_URL}/placeorder?paymentStatus=cancelled&orderNumber=${encodeURIComponent(order.orderNumber)}`,
        },
      },
    });

    const session = response.data.data;
    order.checkoutSessionId = session.id;
    order.paymentStatus = "awaiting_payment";
    await order.save();

    return res.json({ success: true, checkoutUrl: session.attributes.checkout_url });
  } catch (err) {
    console.error("createCheckoutSession error:", err.response?.data || err.message);
    return res.status(500).json({ success: false, error: "Could not start payment" });
  }
};

// ─── Shared: pull paid/failed state out of a PayMongo checkout session ────────
const resolveSessionPaymentStatus = (session) => {
  const payments = session?.attributes?.payments || [];
  const paidPayment = payments.find((p) => p.attributes?.status === "paid");
  if (paidPayment) return { status: "paid", paymentIntentId: session?.attributes?.payment_intent?.id || null };

  const paymentIntentStatus = session?.attributes?.payment_intent?.attributes?.status;
  if (paymentIntentStatus === "succeeded") return { status: "paid", paymentIntentId: session?.attributes?.payment_intent?.id || null };
  if (["awaiting_payment_method", "awaiting_next_action", "processing"].includes(paymentIntentStatus))
    return { status: "awaiting_payment", paymentIntentId: session?.attributes?.payment_intent?.id || null };

  return { status: null, paymentIntentId: null };
};

// ─── GET /payment/verify/:orderNumber ──────────────────────────────────────────
const verifyPayment = async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const order = await Orders.findOne({ orderNumber });
    if (!order) return res.status(404).json({ success: false, error: "Order not found" });
    if (String(order.userId || "") !== String(req.user.id))
      return res.status(403).json({ success: false, error: "Not allowed" });

    if (order.paymentStatus === "paid" || !order.checkoutSessionId) {
      return res.json({ success: true, paymentStatus: order.paymentStatus });
    }

    const response = await paymongo.get(`/checkout_sessions/${order.checkoutSessionId}`);
    const { status, paymentIntentId } = resolveSessionPaymentStatus(response.data.data);

    if (status === "paid" && order.paymentStatus !== "paid") {
      if (paymentIntentId) await Orders.updateOne({ orderNumber }, { $set: { paymentIntentId } });
      await finalizeOnlineOrderPayment(orderNumber);
    }

    const fresh = await Orders.findOne({ orderNumber }, "paymentStatus oversold");
    return res.json({ success: true, paymentStatus: fresh.paymentStatus, oversold: fresh.oversold });
  } catch (err) {
    console.error("verifyPayment error:", err.response?.data || err.message);
    return res.status(500).json({ success: false, error: "Could not verify payment" });
  }
};

// ─── POST /webhooks/paymongo (raw body) ────────────────────────────────────────
const handlePaymongoWebhook = async (req, res) => {
  try {
    const signatureHeader = req.header("Paymongo-Signature") || "";
    const rawBody = req.body; // Buffer, because this route uses express.raw()

    if (WEBHOOK_SECRET) {
      const parts = Object.fromEntries(
        signatureHeader.split(",").map((p) => p.split("=").map((s) => s.trim()))
      );
      const signedPayload = `${parts.t}.${rawBody.toString("utf8")}`;
      const expected = crypto.createHmac("sha256", WEBHOOK_SECRET).update(signedPayload).digest("hex");
      const provided = parts.te || parts.li; // test (te) vs live (li) signature key
      if (!provided || expected !== provided) {
        console.warn("Paymongo webhook signature mismatch");
        return res.status(400).send("Invalid signature");
      }
    }

    const event = JSON.parse(rawBody.toString("utf8"));
    const eventType = event?.data?.attributes?.type;
    const eventData = event?.data?.attributes?.data;

    if (eventType === "checkout_session.payment.paid") {
      const sessionId = eventData?.id;
      const order = sessionId ? await Orders.findOne({ checkoutSessionId: sessionId }) : null;
      if (order && order.paymentStatus !== "paid") {
        const paymentIntentId = eventData?.attributes?.payment_intent?.id;
        if (paymentIntentId) await Orders.updateOne({ _id: order._id }, { $set: { paymentIntentId } });
        await finalizeOnlineOrderPayment(order.orderNumber);
      }
    }

    return res.status(200).send("ok");
  } catch (err) {
    console.error("handlePaymongoWebhook error:", err.message);
    return res.status(500).send("error");
  }
};

module.exports = { createCheckoutSession, verifyPayment, handlePaymongoWebhook };
