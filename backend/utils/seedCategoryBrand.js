// utils/seedCategoryBrand.js
const CategoryBrand = require("../models/CategoryBrand");

const DEFAULT_CATEGORIES = [
  { name: "Shoes", slug: "shoes", order: 1 },
  { name: "Watch", slug: "watch", order: 2 },
  { name: "Bags", slug: "bags", order: 3 },
  { name: "Collectibles", slug: "collectibles", order: 4 },
];

const DEFAULT_BRANDS = [
  { name: "Adidas", slug: "adidas", parentCategory: "shoes", order: 1 },
  { name: "Nike", slug: "nike", parentCategory: "shoes", order: 2 },
  { name: "Puma", slug: "puma", parentCategory: "shoes", order: 3 },
  { name: "New Balance", slug: "nb", parentCategory: "shoes", order: 4 },
];

async function seedCategoryBrand() {
  try {
    // Seed categories
    for (const cat of DEFAULT_CATEGORIES) {
      await CategoryBrand.updateOne(
        { type: "category", slug: cat.slug },
        { $setOnInsert: { ...cat, type: "category", isDefault: true } },
        { upsert: true }
      );
    }

    // Seed brands
    for (const brand of DEFAULT_BRANDS) {
      await CategoryBrand.updateOne(
        { type: "brand", slug: brand.slug },
        { $setOnInsert: { ...brand, type: "brand", isDefault: true } },
        { upsert: true }
      );
    }

    console.log("✅ Default categories and brands seeded");
  } catch (err) {
    console.error("❌ Error seeding categories/brands:", err);
  }
}

module.exports = { seedCategoryBrand };