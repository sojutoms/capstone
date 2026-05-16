const mongoose = require("mongoose");
const Orders = require("./models/Orders");
require("dotenv").config();

async function check() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb+srv://sneakyconcepts:sneakyconcepts@cluster0.p7u1u.mongodb.net/SneakyConcepts");
  
  const userId = "67d64390be107f9618a8ba4f"; // I'll use the user's ID if I can find it, or I'll just check ALL orders
  const orders = await Orders.find({}).lean();
  console.log("Total orders in DB:", orders.length);
  
  const userOrders = orders.filter(o => o.userId === userId || String(o.userId) === userId);
  console.log("User orders found:", userOrders.length);
  
  userOrders.forEach((o, i) => {
    console.log(`Order ${i+1}: ${o.orderNumber}, Total: ${o.total}, Type: ${typeof o.total}`);
  });
  
  process.exit();
}
check();
