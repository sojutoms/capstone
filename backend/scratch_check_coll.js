const mongoose = require('mongoose');
require('dotenv').config();

async function check() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log("Collections:", collections.map(c => c.name));
        
        const products = await mongoose.connection.db.collection('products').find({}).limit(1).toArray();
        console.log("First product in 'products':", JSON.stringify(products[0], null, 2));
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
check();
