const mongoose = require('mongoose');
require('dotenv').config();

// Define a minimal schema for migration
const Product = mongoose.model('Product', new mongoose.Schema({
    id: Number,
    sizes: mongoose.Schema.Types.Mixed
}, { strict: false }));

async function migrate() {
    try {
        await mongoose.connect(process.env.MONGO_URI || "mongodb+srv://user:pass@cluster.mongodb.net/e-commerce");

        console.log("Connected to MongoDB");

        const products = await Product.find({});
        console.log(`Found ${products.length} products`);

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
                
                await Product.updateOne({ _id: p._id }, { $set: { sizes: newSizes } });
                console.log(`  Updated ${newSizes.length} sizes`);
            }
        }

        console.log("Migration complete");
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

migrate();
