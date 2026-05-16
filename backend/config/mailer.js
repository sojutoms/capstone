const nodemailer = require("nodemailer");

// Configure transporter using Gmail
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

const sendEmail = async (to, subject, htmlContent) => {
  try {
    const info = await transporter.sendMail({
      from: `"GoodSoles PH" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html: htmlContent,
    });

    console.log("✅ Email sent via Gmail:", info.messageId);
    return info;
  } catch (error) {
    console.error("❌ Gmail email failed:", error?.message || error);
    throw error;
  }
};

module.exports = sendEmail;