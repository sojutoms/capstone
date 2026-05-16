const nodemailer = require("nodemailer");

async function main() {
  // Configure transporter
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "nickitomiyama@gmail.com",       // your Gmail address
      pass: "larvdvwlvixafhot"               // your Gmail App Password
    }
  });

  // Verify connection
  transporter.verify((error, success) => {
    if (error) {
      console.error("❌ Gmail auth failed:", error);
    } else {
      console.log("✅ Gmail is ready to send emails");
    }
  });

  // Send a test email
  const info = await transporter.sendMail({
    from: "nickitomiyama@gmail.com",
    to: "yourtestemail@example.com",         // replace with your own email
    subject: "Test Email from Nodemailer",
    text: "Hello! This is a test email to confirm Gmail + Nodemailer setup."
  });

  console.log("📨 Email sent:", info.messageId);
}

main().catch(console.error);
