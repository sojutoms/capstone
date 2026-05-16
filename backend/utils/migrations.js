const Product = require("../models/Product");
const { ShoeSequence } = require("../models/index");

/**
 * Migration: Normalizes size mapping for legacy products.
 */
const fixSizes = async (req, res) => {
  try {
    const products = await Product.find({});
    let fixed = 0;
    for (const product of products) {
      if (
        Array.isArray(product.sizes) ||
        (product.sizes && Object.keys(product.sizes).some((key) => !isNaN(key)))
      ) {
        const oldSizes = product.sizes;
        const newSizes = {};
        if (Array.isArray(oldSizes)) {
          oldSizes.forEach((value, index) => {
            if (value !== undefined && value !== null && value !== 0) {
              const shoeSize = (5 + index * 0.5).toString();
              newSizes[shoeSize] = value;
            }
          });
        } else {
          Object.entries(oldSizes).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== 0) {
              const shoeSize = !isNaN(key) ? (5 + parseFloat(key) * 0.5).toString() : key;
              newSizes[shoeSize] = value;
            }
          });
        }
        product.sizes = newSizes;
        product.markModified("sizes");
        await product.save();
        fixed++;
      }
    }
    res.json({ success: true, message: `Fixed ${fixed} products`, totalProducts: products.length });
  } catch (err) {
    console.error("Fix sizes error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Migration: Ensures all size keys are strings.
 */
const fixAllSizes = async (req, res) => {
  try {
    const products = await Product.find({});
    let fixed = 0;
    for (const product of products) {
      if (product.sizes && typeof product.sizes === "object") {
        const newSizes = {};
        Object.entries(product.sizes).forEach(([key, value]) => {
          newSizes[String(key)] = value;
        });
        await Product.updateOne({ id: product.id }, { $set: { sizes: newSizes } });
        fixed++;
      }
    }
    res.json({ success: true, message: `Fixed ${fixed} products` });
  } catch (err) {
    console.error("Fix error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Migration: Converts old size integers to { quantity, price } objects.
 */
const migrateSizesWithPrices = async (req, res) => {
  try {
    const products = await Product.find({});
    let migrated = 0;
    let skipped = 0;

    for (const product of products) {
      if (product.sizes && typeof product.sizes === "object") {
        const newSizes = {};
        let needsMigration = false;

        for (const [size, value] of Object.entries(product.sizes)) {
          if (typeof value === "object" && value.quantity !== undefined) {
            newSizes[size] = value;
          } else {
            needsMigration = true;
            newSizes[size] = { quantity: Number(value) || 0, price: product.new_price || 0 };
          }
        }

        if (needsMigration) {
          product.sizes = newSizes;
          product.markModified("sizes");
          await product.save();
          migrated++;
        } else {
          skipped++;
        }
      }
    }

    res.json({ success: true, message: "Migration complete", migrated, skipped, total: products.length });
  } catch (err) {
    console.error("Migration error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Migration: Assigns SKU numbers to legacy products missing them.
 */
const migrateSkuNumbers = async (req, res) => {
  try {
    const products = await Product.find({ skuNumber: null }).sort({ id: 1 }).lean();
    if (products.length === 0) {
      return res.json({ success: true, message: "All products already have a skuNumber", migrated: 0 });
    }

    const highest = await Product.findOne({ skuNumber: { $ne: null } })
      .sort({ skuNumber: -1 })
      .lean();
    let nextSku = (highest?.skuNumber || 0) + 1;

    let migrated = 0;
    for (const p of products) {
      await Product.updateOne({ _id: p._id }, { $set: { skuNumber: nextSku } });
      await ShoeSequence.updateMany(
        { $or: [{ productRef: p.id }, { productId: p.id }] },
        { $set: { skuNumber: nextSku } }
      );
      nextSku++;
      migrated++;
    }

    return res.json({ success: true, migrated, message: `Assigned skuNumber to ${migrated} products` });
  } catch (err) {
    console.error("migrate-sku-numbers error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = {
  fixSizes,
  fixAllSizes,
  migrateSizesWithPrices,
  migrateSkuNumbers
};
