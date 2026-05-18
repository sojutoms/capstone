const { SequenceCounter, ShoeSequence } = require("../models/index");
const Product = require("../models/Product");

const SIMPLE_CATEGORIES = ["bags", "collectibles"];

// ─── getNextSequences ─────────────────────────────────────────────────────────
async function getNextSequences(count) {
  try {
    let counter = await SequenceCounter.findOne({ name: "global" });
    if (!counter) {
      counter = new SequenceCounter({ name: "global", currentSequence: 0 });
      await counter.save();
    }
    const startSeq = counter.currentSequence + 1;
    const endSeq   = counter.currentSequence + count;
    counter.currentSequence = endSeq;
    await counter.save();
    return { start: startSeq, end: endSeq };
  } catch (err) {
    console.error("getNextSequences error:", err);
    throw err;
  }
}

// ─── getNextProductItemIds ────────────────────────────────────────────────────
async function getNextProductItemIds(productId, count) {
  const existing = await ShoeSequence.countDocuments({ productId: Number(productId) });
  return { start: existing + 1, end: existing + count };
}

// ─── initializeSequenceCounter ────────────────────────────────────────────────
async function initializeSequenceCounter() {
  try {
    const exists = await SequenceCounter.findOne({ name: "global" });
    if (!exists) {
      await SequenceCounter.create({ name: "global", currentSequence: 0 });
      console.log("✅ Sequence counter initialized");
    }
  } catch (err) {
    console.error("Error initializing sequence counter:", err);
  }
}

// ─── createSkusForProduct ─────────────────────────────────────────────────────
// IMPORTANT: First-time creation only. Guard skips if records already exist.
// For subsequent stock additions use POST /addstock.
//
// Options:
//   sizesOverride  – array of { size, quantity, price } to use instead of product.sizes
//   defaultPrice   – fallback price if size entry has no price
//   consignedBy    – email of the admin/staff who is adding this stock (from JWT)
async function createSkusForProduct(productId, options = {}) {
  const defaultPrice  = options.defaultPrice  ?? null;
  const sizesOverride = options.sizesOverride || options.sizes || null;
  const consignedBy   = options.consignedBy   ?? null;   // ← staff email audit field

  const product = await Product.findOne({ id: Number(productId) }).lean();
  if (!product) return { success: false, error: "Product not found" };

  const isSimpleCat  = SIMPLE_CATEGORIES.includes((product.category || "").toLowerCase());
  const productBrand = product.brand || "";
  const skuNumber = options.skuNumber ?? product.skuNumber ?? product.id;

  // ── Guard: if ANY records already exist for this product, do nothing ──────
  const existingTotal = await ShoeSequence.countDocuments({ productId: product.id });
  if (existingTotal > 0) {
    return { success: true, created: 0, message: "SKUs already exist — use addStock to add more units" };
  }

  // ── Simple category (watch/bags/collectibles) ─────────────────────────────
  if (isSimpleCat) {
    const stock = Number(product.stock || 0);
    if (stock <= 0) return { success: true, created: 0, message: "No stock to create SKUs for" };

    const price    = defaultPrice ?? product.price ?? 0;
    const seqRange = await getNextSequences(stock);
    const pidRange = await getNextProductItemIds(product.id, stock);

    const inserts = [];
    for (let i = 0; i < stock; i++) {
      inserts.push({
        skuNumber,
        productItemId:  pidRange.start + i,
        sequenceNumber: seqRange.start + i,
        productId:      product.id,
        productName:    product.name,
        productImage:   product.image || "",
        productPrice:   Number(price),
        category:       product.category || "",
        brand:          productBrand,
        size:           "—",
        status:         "available",
        addedDate:      new Date(),
        consignedBy,                         // ← staff audit field
      });
    }
    await ShoeSequence.insertMany(inserts);
    return { success: true, created: stock };
  }

  // ── Shoe/sized product ────────────────────────────────────────────────────
  let sizesSource = sizesOverride ?? (product.sizes || []);
  let sizesArray  = [];

  if (Array.isArray(sizesSource)) {
    sizesArray = sizesSource.map((e) => ({
      size:     String(e.size ?? "").trim(),
      quantity: Number(e.quantity || 0),
      price:    e.price != null ? Number(e.price) : (defaultPrice ?? product.new_price ?? 0),
    }));
  } else {
    sizesArray = Object.entries(sizesSource).map(([k, v]) => {
      if (v && typeof v === "object") {
        return { size: k, quantity: Number(v.quantity || 0), price: v.price != null ? Number(v.price) : (defaultPrice ?? 0) };
      }
      return { size: k, quantity: Number(v || 0), price: defaultPrice ?? 0 };
    });
  }

  sizesArray = sizesArray.filter((e) => e.size && e.quantity > 0);
  if (sizesArray.length === 0) return { success: true, created: 0, message: "No sizes with stock" };

  const totalToCreate = sizesArray.reduce((sum, e) => sum + e.quantity, 0);
  const seqRange = await getNextSequences(totalToCreate);
  const pidRange = await getNextProductItemIds(product.id, totalToCreate);

  const inserts = [];
  let offset = 0;
  for (const sizeEntry of sizesArray) {
    for (let u = 0; u < sizeEntry.quantity; u++) {
      inserts.push({
        skuNumber,
        productItemId:  pidRange.start + offset,
        sequenceNumber: seqRange.start + offset,
        productId:      product.id,
        productName:    product.name,
        productImage:   product.image || "",
        productPrice:   Number(sizeEntry.price),
        category:       product.category || "",
        brand:          productBrand,
        size:           sizeEntry.size,
        status:         "available",
        addedDate:      new Date(),
        consignedBy,                         // ← staff audit field
      });
      offset++;
    }
  }

  await ShoeSequence.insertMany(inserts);
  return { success: true, created: inserts.length };
}

// ─── migrateSkuIds ────────────────────────────────────────────────────────────
async function migrateSkuIds() {
  console.log("🔄 Migrating skuNumber and productItemId...");
  const allSeqs  = await ShoeSequence.find({}).sort({ sequenceNumber: 1 }).lean();
  const products = await Product.find({}, "id").lean();
  const pidMap   = {};
  products.forEach((p) => { pidMap[String(p.id)] = p.id; });

  const byProduct = {};
  for (const seq of allSeqs) {
    const pid = String(seq.productId);
    if (!byProduct[pid]) byProduct[pid] = [];
    byProduct[pid].push(seq);
  }

  let updated = 0;
  for (const [pid, seqs] of Object.entries(byProduct)) {
    const skuNumber = pidMap[pid] || Number(pid);
    seqs.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    for (let i = 0; i < seqs.length; i++) {
      const seq = seqs[i];
      if (seq.skuNumber === skuNumber && seq.productItemId === i + 1) continue;
      await ShoeSequence.updateOne({ _id: seq._id }, { $set: { skuNumber, productItemId: i + 1 } });
      updated++;
    }
  }
  console.log(`✅ Migration done. Updated ${updated} records.`);
  return { updated };
}

module.exports = { getNextSequences, getNextProductItemIds, initializeSequenceCounter, createSkusForProduct, migrateSkuIds };