require("dotenv").config();
const mongoose = require("mongoose");
const Users = require("../models/Users");
const { OtpModel } = require("../models/index");

(async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const email = process.argv[2];
  if (!email) {
    console.log("Usage: node check_email.js <email>");
    process.exit(1);
  }

  const exact = await Users.findOne({ email });
  console.log("Exact match in Users:", exact ? { _id: exact._id, email: exact.email, name: exact.name } : null);

  const ci = await Users.find({ email: { $regex: `^${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } });
  console.log("Case-insensitive matches in Users:", ci.map(u => ({ _id: u._id, email: u.email })));

  const otpRecords = await OtpModel.find({ email });
  console.log("OTP records for this email:", otpRecords.map(o => ({ email: o.email, otp: o.otp, expiresAt: o.expiresAt, createdAt: o.createdAt })));

  await mongoose.disconnect();
})();
