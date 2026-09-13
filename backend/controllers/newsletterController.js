const { NewsletterSubscriber } = require("../models");
const sendEmail = require("../config/mailer");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ─── POST /newsletter/subscribe ────────────────────────────────────────────────
const subscribeNewsletter = async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();

  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ success: false, error: "Enter a valid email address." });
  }

  try {
    const existing = await NewsletterSubscriber.findOne({ email });
    if (existing) {
      return res.json({ success: true, message: "You're already on the list." });
    }

    await NewsletterSubscriber.create({ email });

    // Best-effort — a subscriber shouldn't see an error just because the
    // welcome email failed to send; the subscription itself already succeeded.
    try {
      await sendEmail(
        email,
        "Welcome to the Collective — GoodSoles PH",
        `<p>Hi there,</p>
         <p>You're officially on the GoodSoles PH priority list. Expect early access to limited drops, curated collections, and private events straight to this inbox.</p>
         <br/><p>— GoodSoles PH</p>`
      );
    } catch (emailErr) {
      console.error("Newsletter welcome email failed:", emailErr.message);
    }

    res.json({ success: true, message: "You're in. Watch your inbox for priority drops." });
  } catch (err) {
    if (err.code === 11000) {
      return res.json({ success: true, message: "You're already on the list." });
    }
    console.error("Newsletter subscribe error:", err);
    res.status(500).json({ success: false, error: "Something went wrong. Please try again." });
  }
};

module.exports = { subscribeNewsletter };
