const mongoose = require('mongoose');
require('dotenv').config();

async function migrate() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB");

        const collection = mongoose.connection.db.collection('products');
        const products = await collection.find({}).toArray();
        console.log(`Found ${products.length} products in collection`);

        let count = 0;
        for (const p of products) {
            if (p.sizes && !Array.isArray(p.sizes) && typeof p.sizes === 'object') {
                console.log(`Migrating product ${p.id} (${p.name || 'unnamed'})`);
                const newSizes = Object.entries(p.sizes).map(([size, data]) => {
                    return {
                        size: size,
                        quantity: typeof data === 'object' ? (data.quantity || 0) : (Number(data) || 0),
                        price: typeof data === 'object' ? (data.price || 0) : 0
                    };
                });
                
                await collection.updateOne({ _id: p._id }, { $set: { sizes: newSizes } });
                console.log(`  Updated ${newSizes.length} sizes`);
                count++;
            }
        }

        console.log(`Migration complete. Updated ${count} products.`);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

migrate();
