// Groq's chat completions API is OpenAI-compatible (same request/response
// shape as api.openai.com/v1/chat/completions), so this reuses the same
// GROQ_API_KEY already wired up for the admin sales-analysis feature.
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
// openai/gpt-oss-120b is an actual OpenAI open-weight model, served here via
// Groq's OpenAI-compatible endpoint. It's a reasoning model — it burns some
// tokens "thinking" before writing the final reply — so reasoning_effort is
// kept low and max_tokens has headroom above a normal chat model.
const MODEL = "openai/gpt-oss-120b";

const SYSTEM_PROMPT = `You are the customer support assistant for GoodSoles PH, an online sneaker/streetwear store based in the Philippines (Robinsons Galleria, EDSA, Quezon City). Answer customer questions about orders, shipping, returns, and the site using ONLY the facts below. Be brief and friendly. If something isn't covered here, say you're not sure and suggest they email goodsoles.ph@gmail.com or call 0967-442-6109.

Reply in plain text only — no markdown (no **bold**, no #headings, no markdown bullet lists). Use short lines or simple dashes if you need a list.

STORE INFO
- Categories: Shoes, Watches, Bags, Collectibles. Brands include Nike, Adidas, Puma, New Balance, Seiko.
- Hours: Mon–Sun 10:00 AM – 9:00 PM.
- Contact: goodsoles.ph@gmail.com, 0967-442-6109.

SHIPPING (fee depends on the delivery region, not order size)
- Metro Manila (NCR): FREE, 1–2 business days
- Nearby Luzon (Central Luzon, CALABARZON): ₱150, 2–3 business days
- Rest of Luzon (Ilocos, Cagayan Valley, CAR, MIMAROPA, Bicol): ₱220, 3–5 business days
- Visayas: ₱300, 4–6 business days
- Mindanao / Remote: ₱380, 5–8 business days
- The exact fee and delivery estimate is shown at checkout once a region is selected.

PAYMENT
- Card / GCash / Maya via a secure PayMongo checkout, or Cash on Delivery (COD) — no extra handling fee for COD.
- Online (card/e-wallet) orders must be paid within 15 minutes of checkout or the order is automatically cancelled and stock released.

RETURNS & EXCHANGES
- Free returns within 30 days of delivery. Items must be unworn, in original condition, with tags and packaging, plus proof of purchase.
- To return: log in, go to Order History, select the item and a reason, print the prepaid label, then drop it off.
- Free exchanges: return the item and place a new order for the size/color you want.
- Refunds are processed within 5–7 business days after the return is received, back to the original payment method.

VOUCHERS & LOYALTY
- Customers can redeem loyalty points for discount vouchers, then apply a voucher at checkout.

ACCOUNT
- Customers can track orders and view order status (pending, confirmed, shipping, delivered, cancelled) from Order History after logging in.`;

const chatWithBot = async (req, res) => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ success: false, error: "messages array is required" });
    }

    // Only forward role/content, cap history length, and cap message size so
    // a malicious or runaway client can't blow up the request/cost.
    const trimmed = messages
      .slice(-12)
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));

    if (trimmed.length === 0) {
      return res.status(400).json({ success: false, error: "No valid messages provided" });
    }

    const response = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 500,
        temperature: 0.4,
        reasoning_effort: "low",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...trimmed],
      }),
    });

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content;
    if (!reply) {
      console.error("chatWithBot: no reply from Groq", data);
      return res.status(502).json({ success: false, error: "Chat assistant is unavailable right now." });
    }

    return res.json({ success: true, reply });
  } catch (err) {
    console.error("chatWithBot error:", err.message);
    return res.status(500).json({ success: false, error: "Chat assistant is unavailable right now." });
  }
};

module.exports = { chatWithBot };
