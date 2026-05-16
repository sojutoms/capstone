// utils/seedSizesSubcategories.js
// Call this from your main index.js:  require("./utils/seedSizesSubcategories")();

const ShoeSize    = require("../models/ShoeSize");
const Subcategory = require("../models/Subcategory");

const DEFAULT_SIZES = [
  "6","6.5","7","7.5","8","8.5","9","9.5","10","10.5","11","11.5","12","12.5","13"
];

const DEFAULT_SUBCATEGORIES = [
  { name: "Lifestyle",   parentCategory: "shoes" },
  { name: "Running",     parentCategory: "shoes" },
  { name: "Football",    parentCategory: "shoes" },
  { name: "Basketball",  parentCategory: "shoes" },
];

const seedSizesSubcategories = async () => {
  try {
    // ── Sizes ──────────────────────────────────────────────────────────────
    for (let i = 0; i < DEFAULT_SIZES.length; i++) {
      const value = DEFAULT_SIZES[i];
      const exists = await ShoeSize.findOne({ value });
      if (!exists) {
        await ShoeSize.create({ value, order: i + 1, isDefault: true });
        console.log(`✅ Seeded default size: ${value}`);
      }
    }

    // ── Subcategories ──────────────────────────────────────────────────────
    for (let i = 0; i < DEFAULT_SUBCATEGORIES.length; i++) {
      const { name, parentCategory } = DEFAULT_SUBCATEGORIES[i];
      const slug   = name.toLowerCase().replace(/\s+/g, "-");
      const exists = await Subcategory.findOne({ slug, parentCategory });
      if (!exists) {
        await Subcategory.create({ name, slug, parentCategory, order: i + 1, isDefault: true });
        console.log(`✅ Seeded default subcategory: ${name} (${parentCategory})`);
      }
    }
  } catch (err) {
    console.warn("Seed sizes/subcategories error:", err.message);
  }
};

module.exports = seedSizesSubcategories;