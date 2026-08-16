const crypto = require("crypto");
const paymongo = require("../utils/paymongo");
const Orders = require("../models/Orders");

const FRONTEND_URL = (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
const WEBHOOK_SECRET = process.env.PAYMONGO_WEBHOOK_SECRET || "";

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

    const amountCentavos = Math.round(Number(order.total) * 100);
    if (!Number.isFinite(amountCentavos) || amountCentavos <= 0)
      return res.status(400).json({ success: false, error: "Invalid order total" });

    const response = await paymongo.post("/checkout_sessions", {
      data: {
        attributes: {
          send_email_receipt: false,
          show_description: true,
          show_line_items: true,
          description: `GoodSoles Order ${order.orderNumber}`,
          line_items: [
            {
              currency: "PHP",
              amount: amountCentavos,
              name: `Order ${order.orderNumber}`,
              quantity: 1,
            },
          ],
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
      order.paymentStatus = "paid";
      order.paymentIntentId = paymentIntentId;
      order.paidAt = new Date();
      await order.save();
    }

    return res.json({ success: true, paymentStatus: order.paymentStatus });
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
        order.paymentStatus = "paid";
        order.paidAt = new Date();
        order.paymentIntentId = eventData?.attributes?.payment_intent?.id || order.paymentIntentId;
        await order.save();
      }
    }

    return res.status(200).send("ok");
  } catch (err) {
    console.error("handlePaymongoWebhook error:", err.message);
    return res.status(500).send("error");
  }
};

module.exports = { createCheckoutSession, verifyPayment, handlePaymongoWebhook };
