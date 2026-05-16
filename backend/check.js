// Save as check.js in your backend folder and run: node check.js
require("dotenv").config();
const mongoose = require("mongoose");
const { ShoeSequence } = require("./models/index");

mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI).then(async () => {
    const seqs = await ShoeSequence.find({
        soldBy: { $exists: true, $nin: [null, ""] },
        $or: [
            { orderNumber: { $exists: false } },
            { orderNumber: "" },
            { orderNumber: null },
            { orderNumber: { $regex: /^STORE-/i } }
        ]
    }).lean();

    console.log("Count:", seqs.length);
    seqs.forEach((s, i) => {
        console.log(`[${i}]`, JSON.stringify({
            orderNumber: s.orderNumber,
            soldDate: s.soldDate,
            productPrice: s.productPrice,
            productName: s.productName,
        }));
    });

    mongoose.disconnect();
});