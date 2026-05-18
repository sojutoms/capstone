const https = require("https");

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || "sneakyconcepts123@gmail.com";
const SENDER_NAME = process.env.BREVO_SENDER_NAME || "GoodSoles PH";

const sendEmail = (to, subject, htmlContent) => {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      sender: { name: SENDER_NAME, email: SENDER_EMAIL },
      to: [{ email: to }],
      subject,
      htmlContent,
    });

    const options = {
      hostname: "api.brevo.com",
      path: "/v3/smtp/email",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": BREVO_API_KEY,
        "Content-Length": Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log("✅ Email sent via Brevo to:", to);
          resolve(body);
        } else {
          const err = new Error(`Brevo API error ${res.statusCode}: ${body}`);
          console.error("❌ Brevo send failed:", err.message);
          reject(err);
        }
      });
    });

    req.on("error", (err) => {
      console.error("❌ Brevo request error:", err.message);
      reject(err);
    });

    req.write(payload);
    req.end();
  });
};

module.exports = sendEmail;
