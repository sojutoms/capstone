require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const Users = require("../models/Users");

const EMAIL = "paymongo-test@goodsolesph.test";
const PASSWORD = "TestPass123!";

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  let user = await Users.findOne({ email: EMAIL });
  if (!user) {
    const hashed = await bcrypt.hash(PASSWORD, 10);
    user = new Users({
      name: "PayMongo Test",
      email: EMAIL,
      password: hashed,
      phone: "09990000000",
      cartData: {},
    });
    await user.save();
    console.log("Created test user:", EMAIL);
  } else {
    console.log("Test user already exists:", EMAIL);
  }
  console.log("USER_ID=" + user._id);
  await mongoose.disconnect();
})();
