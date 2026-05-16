const jwt = require("jsonwebtoken");
const Product = require("../models/Product");
const StockBatch = require("../models/StockBatch");
const { ShoeSequence } = require("../models/index");
const { getNextSequences, getNextProductItemIds, createSkusForProduct, migrateSkuIds } = require("../utils/sku");
const AuditLog = require("../models/AuditLog");

const JWT_SECRET = process.env.JWT_SECRET || "secret_ecom";
const SIMPLE_CATEGORIES = ["watch", "bags", "collectibles"];

// ─── Helper: extract admin email from request token ───────────────────────────
function getAdminEmailFromRequest(req) {
  try {
    if (req.user && req.user.email) return req.user.email;
    const tokenHeader = req.header("auth-token") || req.header("Authorization") || "";
    const token = tokenHeader.startsWith("Bearer ") ? tokenHeader.slice(7) : tokenHeader;
    if (!token) return null;
    const payload = jwt.verify(token, JWT_SECRET);
    return payload.email || null;
  } catch {
    return null;
  }
}

// ─── Helper: get admin info from request token ────────────────────────────────
function getAdminInfoFromRequest(req) {
  try {
    const tokenHeader = req.header("auth-token") || req.header("Authorization") || "";
    const token = tokenHeader.startsWith("Bearer ") ? tokenHeader.slice(7) : tokenHeader;
    if (!token) return { adminId: null, adminEmail: "", adminName: "", adminRoles: [] };

    const payload = jwt.verify(token, JWT_SECRET);
    return {
      adminId: payload.userId || payload.id || payload._id || null,
      adminEmail: payload.email || "",
      adminName: payload.name || "",
      adminRoles: payload.roles || [],
    };
  } catch {
    return { adminId: null, adminEmail: "", adminName: "", adminRoles: [] };
  }
}

// ─── Helper: get IP and user agent from request ───────────────────────────────
function getCallerInfo(req) {
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress || req.ip || "";
  const userAgent = req.headers["user-agent"] || "";
  return { ip, userAgent };
}

// ─── Helper: write audit log (non-blocking) ───────────────────────────────────
async function writeAudit(action, req, details = {}) {
  try {
    const { adminId, adminEmail, adminName, adminRoles } = getAdminInfoFromRequest(req);
    const { ip, userAgent } = getCallerInfo(req);
    await AuditLog.create({
      action,
      adminId,
      adminEmail,
      adminName,
      adminRoles,
      details,
      ip,
      userAgent,
      timestamp: new Date(),
    });
  } catch (err) {
    console.warn("[AuditLog] write error:", err.message);
  }
}

// ─── Helper: sanitize sizes array before saving ───────────────────────────────
// Removes any array entries missing a `size` field to prevent Mongoose validation errors.
function sanitizeSizesBeforeSave(product) {
  if (Array.isArray(product.sizes)) {
    product.sizes = product.sizes.filter(
      (entry) => entry && entry.size != null && entry.size !== ""
    );
    product.markModified("sizes");
  }
}

// ── Increment a per-product batch counter ────────────────────────────────────
async function getNextBatchNumber(productId) {
  const last = await StockBatch.findOne({ productId })
    .sort({ batchNumber: -1 })
    .select("batchNumber")
    .lean();
  return (last?.batchNumber ?? 0) + 1;
}

// ─── POST /addstock ───────────────────────────────────────────────────────────
const addStock = async (req, res) => {
  const { productId, size, quantity, price } = req.body;
  try {
    if (!productId || !size || !quantity || quantity < 1)
      return res.status(400).json({ success: false, error: "Product ID, size, and quantity (min 1) are required" });
    if (!price || price <= 0)
      return res.status(400).json({ success: false, error: "Price is required and must be greater than 0" });

    const sizePrice = parseFloat(price);
    const product = await Product.findOne({ id: productId });
    if (!product) return res.status(404).json({ success: false, error: "Product not found" });

    const consignedBy = getAdminEmailFromRequest(req);
    const isSimpleCat = SIMPLE_CATEGORIES.includes((product.category || "").toLowerCase());
    const normalizedSize = isSimpleCat ? "—" : size;
    const productBrand = product.brand || "";
    const skuNumber = product.id;

    const [sequences, pidRange] = await Promise.all([
      getNextSequences(quantity),
      getNextProductItemIds(product.id, quantity),
    ]);

    const sequenceInserts = [];
    for (let i = 0; i < quantity; i++) {
      sequenceInserts.push({
        skuNumber,
        productItemId: pidRange.start + i,
        sequenceNumber: sequences.start + i,
        productId: product.id,
        productName: product.name,
        productImage: product.image,
        productPrice: sizePrice,
        category: product.category,
        brand: productBrand,
        size: normalizedSize,
        status: "available",
        addedDate: new Date(),
        consignedBy,
      });
    }
    await ShoeSequence.insertMany(sequenceInserts);

    let updatedProduct;
    if (isSimpleCat) {
      const skuCount = await ShoeSequence.countDocuments({ productId: product.id, status: "available" });
      updatedProduct = await Product.findOneAndUpdate(
        { id: product.id },
        { $set: { stock: skuCount, available: skuCount > 0 } },
        { new: true }
      );
    } else {
      // product.sizes is an ARRAY of { size, quantity, price }, not an object
      const currentSizesArray = Array.isArray(product.sizes) ? [...product.sizes] : [];
      const existingIdx = currentSizesArray.findIndex(e => String(e.size) === String(normalizedSize));
      if (existingIdx !== -1) {
        currentSizesArray[existingIdx] = {
          size: normalizedSize,
          quantity: Number(currentSizesArray[existingIdx].quantity || 0) + quantity,
          price: sizePrice,
        };
      } else {
        currentSizesArray.push({ size: normalizedSize, quantity: quantity, price: sizePrice });
      }

      // Calculate total stock for top-level field
      const totalStock = currentSizesArray.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);

      updatedProduct = await Product.findOneAndUpdate(
        { id: product.id },
        { 
          $set: { 
            sizes: currentSizesArray,
            stock: totalStock,
            available: totalStock > 0
          } 
        },
        { new: true }
      );
    }


    // Audit log for stock add
    writeAudit("stock_add", req, {
      productId: product.id,
      productName: product.name,
      skuNumber,
      size: normalizedSize,
      quantity,
      price: sizePrice,
    });

    const range = quantity === 1
      ? `#${pidRange.start}`
      : `#${pidRange.start}–${pidRange.end}`;

    res.json({
      success: true,
      message: `Added ${quantity} unit(s) at ₱${sizePrice}`,
      sequenceRange: range,
      skuNumber,
      productItemIdRange: { start: pidRange.start, end: pidRange.end },
      sequences: { start: sequences.start, end: sequences.end },
    });
  } catch (err) {
    console.error("POST /addstock error:", err);
    res.status(500).json({ success: false, error: "Server error: " + err.message });
  }
};

// ─── GET /allsequences ────────────────────────────────────────────────────────
const getAllSequences = async (req, res) => {
  try {
    const sequences = await ShoeSequence.find({})
      .sort({ productId: 1, productItemId: 1 })
      // explicitly select what we need — keeps response lean
      .select([
        "skuNumber", "productItemId", "sequenceNumber",
        "productId", "productName", "productImage",
        "productPrice", "category", "brand", "size",
        "status", "addedDate", "soldDate",
        "consignedBy", "soldBy", "soldToUserId",
        "orderNumber",
        // new fields
        "batchId", "batchNumber", "costPrice", "priceHistory",
      ].join(" "))
      .lean();
    res.json(sequences);
  } catch (err) {
    console.error("GET /allsequences error:", err);
    res.status(500).json([]);
  }
};

// ─── POST /marksequencesold ───────────────────────────────────────────────────
const markSequenceSold = async (req, res) => {
  try {
    const { sequenceId } = req.body;
    if (!sequenceId) return res.status(400).json({ success: false, error: "Sequence ID is required" });

    const soldBy = getAdminEmailFromRequest(req);

    const sequence = await ShoeSequence.findByIdAndUpdate(
      sequenceId,
      { $set: { status: "sold", soldDate: new Date(), soldBy } },
      { new: true }
    );
    if (!sequence) return res.status(404).json({ success: false, error: "SKU not found" });

    try {
      const product = await Product.findOne({ id: sequence.productId });
      if (product) {
        const isSimpleCat = SIMPLE_CATEGORIES.includes((product.category || "").toLowerCase());
        if (isSimpleCat) {
          const skuCount = await ShoeSequence.countDocuments({ productId: product.id, status: "available" });
          await Product.findByIdAndUpdate(product._id, { $set: { stock: skuCount, available: skuCount > 0 } });
        } else {
          // product.sizes is an ARRAY of { size, quantity, price }
          const currentSizesArray = Array.isArray(product.sizes) ? [...product.sizes] : [];
          const sz = String(sequence.size);
          const existingIdx = currentSizesArray.findIndex(e => String(e.size) === sz);
          
          if (existingIdx !== -1) {
            currentSizesArray[existingIdx].quantity = Math.max(0, Number(currentSizesArray[existingIdx].quantity || 0) - 1);
            
            // Calculate total stock for top-level field
            const totalStock = currentSizesArray.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);
            
            await Product.findOneAndUpdate(
              { id: product.id },
              { 
                $set: { 
                  sizes: currentSizesArray,
                  stock: totalStock,
                  available: totalStock > 0
                } 
              },
              { new: true }
            );
          }
        }
      }
    } catch (updateErr) {
      console.error("Error updating product stock:", updateErr);
    }


    // Audit log for mark sold
    writeAudit("mark_sold", req, {
      sequenceId: sequence._id,
      productId: sequence.productId,
      productName: sequence.productName,
      skuNumber: sequence.skuNumber,
      size: sequence.size,
      sequenceNumber: sequence.sequenceNumber,
    });

    return res.json({ success: true, message: "SKU marked as sold and stock updated" });
  } catch (err) {
    console.error("FATAL ERROR in /marksequencesold:", err);
    return res.status(500).json({ success: false, error: "Server error", message: err.message });
  }
};

// ─── GET /testsequence/:id ────────────────────────────────────────────────────
const testSequence = async (req, res) => {
  try {
    const sequence = await ShoeSequence.findById(req.params.id);
    if (!sequence) return res.json({ found: false });
    return res.json({
      found: true,
      sequence: {
        id: sequence.id,
        skuNumber: sequence.skuNumber,
        productItemId: sequence.productItemId,
        sequenceNumber: sequence.sequenceNumber,
        productId: sequence.productId,
        size: sequence.size,
        status: sequence.status,
        brand: sequence.brand,
        consignedBy: sequence.consignedBy,
        soldBy: sequence.soldBy,
      },
    });
  } catch (err) {
    return res.json({ error: err.message });
  }
};

// ─── GET /sequences/:productId ────────────────────────────────────────────────
const getSequencesByProduct = async (req, res) => {
  const { productId } = req.params;
  try {
    const sequences = await ShoeSequence.find({ productId: Number(productId) })
      .sort({ productItemId: 1 })
      .lean();
    res.json(sequences);
  } catch (err) {
    console.error("GET /sequences/:productId error:", err);
    res.status(500).json([]);
  }
};

// ─── POST /assignsequence ─────────────────────────────────────────────────────
const assignSequence = async (req, res) => {
  const { productId, size, userId } = req.body;
  try {
    const query = { productId: Number(productId), status: "available" };
    if (size) query.size = String(size);
    const sequence = await ShoeSequence.findOne(query).sort({ productItemId: 1 });
    if (!sequence)
      return res.status(404).json({ success: false, error: "No available SKU for this product/size" });

    sequence.status = "sold";
    sequence.soldDate = new Date();
    sequence.soldToUserId = userId || null;
    await sequence.save();

    res.json({
      success: true,
      skuNumber: sequence.skuNumber,
      productItemId: sequence.productItemId,
      sequenceNumber: sequence.sequenceNumber,
      sequenceId: sequence._id,
    });
  } catch (err) {
    console.error("POST /assignsequence error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

// ─── GET /userpurchases/:userId ───────────────────────────────────────────────
const getUserPurchases = async (req, res) => {
  const { userId } = req.params;
  try {
    const sequences = await ShoeSequence.find({ soldToUserId: userId, status: "sold" })
      .sort({ soldDate: -1 })
      .lean();
    const enriched = [];
    for (const seq of sequences) {
      const product = await Product.findOne({ id: seq.productId }, "new_price").lean();
      enriched.push({
        skuNumber: seq.skuNumber,
        productItemId: seq.productItemId,
        sequenceNumber: seq.sequenceNumber,
        productName: seq.productName,
        productImage: seq.productImage,
        size: seq.size,
        soldDate: seq.soldDate,
        price: product ? product.new_price : 0,
        brand: seq.brand || "",
      });
    }
    res.json(enriched);
  } catch (err) {
    console.error("GET /userpurchases/:userId error:", err);
    res.status(500).json([]);
  }
};

// ─── POST /reservesequence ────────────────────────────────────────────────────
const reserveSequence = async (req, res) => {
  const { productId, size, userId, minutes = 15 } = req.body;
  try {
    const sequence = await ShoeSequence.findOne({
      productId: Number(productId),
      size: String(size),
      status: "available",
    }).sort({ productItemId: 1 });
    if (!sequence) return res.status(404).json({ success: false, error: "No available SKU" });

    sequence.status = "reserved";
    sequence.soldToUserId = userId;
    sequence.reservedUntil = new Date(Date.now() + minutes * 60 * 1000);
    await sequence.save();
    res.json({ success: true, skuNumber: sequence.skuNumber, productItemId: sequence.productItemId, sequenceNumber: sequence.sequenceNumber });
  } catch (err) {
    console.error("POST /reservesequence error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

// ─── POST /releaseexpiredreservations ─────────────────────────────────────────
const releaseExpiredReservations = async (req, res) => {
  try {
    const result = await ShoeSequence.updateMany(
      { status: "reserved", reservedUntil: { $lt: new Date() } },
      { $set: { status: "available", soldToUserId: null, reservedUntil: null } }
    );
    res.json({ success: true, released: result.modifiedCount });
  } catch (err) {
    console.error("POST /releaseexpiredreservations error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

// ─── GET /skustats ────────────────────────────────────────────────────────────
const getSkuStats = async (req, res) => {
  try {
    const [total, available, sold, reserved] = await Promise.all([
      ShoeSequence.countDocuments(),
      ShoeSequence.countDocuments({ status: "available" }),
      ShoeSequence.countDocuments({ status: "sold" }),
      ShoeSequence.countDocuments({ status: "reserved" }),
    ]);
    const latest = await ShoeSequence.findOne().sort({ sequenceNumber: -1 });
    res.json({
      success: true,
      total, available, sold, reserved,
      latestSequence: latest ? latest.sequenceNumber : 0,
    });
  } catch (err) {
    console.error("GET /skustats error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

// ─── POST /restoresequence ────────────────────────────────────────────────────
const restoreSequence = async (req, res) => {
  const { sequenceId } = req.body;
  try {
    const sequence = await ShoeSequence.findById(sequenceId);
    if (!sequence) return res.status(404).json({ success: false, error: "Sequence not found" });

    sequence.status = "available";
    sequence.soldDate = null;
    sequence.soldToUserId = null;
    sequence.reservedUntil = null;
    sequence.soldBy = null;
    await sequence.save();

    const product = await Product.findOne({ id: sequence.productId });
    if (product) {
      const isSimpleCat = SIMPLE_CATEGORIES.includes((product.category || "").toLowerCase());
      if (isSimpleCat) {
        const skuCount = await ShoeSequence.countDocuments({ productId: product.id, status: "available" });
        await Product.findOneAndUpdate(
          { id: product.id },
          { $set: { stock: skuCount, available: skuCount > 0 } }
        );
      } else {
        // product.sizes is an ARRAY of { size, quantity, price }
        const currentSizesArray = Array.isArray(product.sizes) ? [...product.sizes] : [];
        const sz = String(sequence.size);
        const existingIdx = currentSizesArray.findIndex(e => String(e.size) === sz);

        if (existingIdx !== -1) {
          currentSizesArray[existingIdx].quantity = Number(currentSizesArray[existingIdx].quantity || 0) + 1;
          
          // Calculate total stock for top-level field
          const totalStock = currentSizesArray.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);
          
          await Product.findOneAndUpdate(
            { id: product.id },
            { 
              $set: { 
                sizes: currentSizesArray,
                stock: totalStock,
                available: totalStock > 0
              } 
            },
            { new: true }
          );
        }
      }
    }


    res.json({ success: true, sequence });
  } catch (err) {
    console.error("POST /restoresequence error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

// ─── DELETE /deletesequence ───────────────────────────────────────────────────
const deleteSequence = async (req, res) => {
  try {
    const { sequenceId } = req.body;
    if (!sequenceId) return res.status(400).json({ success: false, error: "Sequence ID is required" });

    const sequence = await ShoeSequence.findByIdAndDelete(sequenceId);
    if (!sequence) return res.status(404).json({ success: false, error: "SKU not found" });

    try {
      const product = await Product.findOne({ id: sequence.productId });
      if (product) {
        const isSimpleCat = SIMPLE_CATEGORIES.includes((product.category || "").toLowerCase());
        if (isSimpleCat) {
          const skuCount = await ShoeSequence.countDocuments({ productId: product.id, status: "available" });
          await Product.findOneAndUpdate(
            { id: product.id },
            { $set: { stock: skuCount, available: skuCount > 0 } }
          );
        } else {
          // product.sizes is an ARRAY of { size, quantity, price }
          const currentSizesArray = Array.isArray(product.sizes) ? [...product.sizes] : [];
          const sz = String(sequence.size);
          const existingIdx = currentSizesArray.findIndex(e => String(e.size) === sz);

          if (existingIdx !== -1) {
            currentSizesArray[existingIdx].quantity = Math.max(0, Number(currentSizesArray[existingIdx].quantity || 0) - 1);
            
            // Calculate total stock for top-level field
            const totalStock = currentSizesArray.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);
            
            await Product.findOneAndUpdate(
              { id: product.id },
              { 
                $set: { 
                  sizes: currentSizesArray,
                  stock: totalStock,
                  available: totalStock > 0
                } 
              },
              { new: true }
            );
          }
        }
      }
    } catch (updateErr) {
      console.error("Error updating product stock after delete:", updateErr);
    }


    res.json({ success: true, message: "SKU deleted successfully", sequenceNumber: sequence.sequenceNumber });
  } catch (error) {
    console.error("Delete sequence error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to delete SKU" });
  }
};

// ─── POST /create_skus_for_product ────────────────────────────────────────────
const createSkusForProductRoute = async (req, res) => {
  try {
    const { productId, sizes, defaultQuantity, defaultPrice } = req.body;
    if (!productId) return res.status(400).json({ success: false, error: "productId is required" });

    let sizesOverride = null;
    if (Array.isArray(sizes)) {
      sizesOverride = sizes.map((s) => ({ size: String(s.size), quantity: Number(s.quantity || defaultQuantity || 0), price: s.price == null ? (defaultPrice ?? null) : Number(s.price) }));
    } else if (sizes && typeof sizes === "object") {
      sizesOverride = Object.entries(sizes).map(([size, val]) => {
        if (val == null) return null;
        if (typeof val === "object") return { size: String(size), quantity: Number(val.quantity ?? defaultQuantity ?? 0), price: val.price == null ? (defaultPrice ?? null) : Number(val.price) };
        return { size: String(size), quantity: Number(val || defaultQuantity || 0), price: defaultPrice ?? null };
      }).filter(Boolean);
    }

    const result = await createSkusForProduct(productId, {
      sizesOverride: sizesOverride && sizesOverride.length ? sizesOverride : undefined,
      defaultQuantity: defaultQuantity ?? 1,
      defaultPrice: defaultPrice ?? null,
    });

    return res.json({ success: true, created: result?.created ?? 0, details: result || {} });
  } catch (err) {
    console.error("POST /create_skus_for_product error:", err);
    return res.status(500).json({ success: false, error: err.message || "Server error" });
  }
};

// ─── POST /sync_product_skus ──────────────────────────────────────────────────
const syncProductSkus = async (req, res) => {
  try {
    const { productId } = req.body || {};
    let createdTotal = 0;

    if (productId) {
      try { const r = await createSkusForProduct(productId); if (r?.created) createdTotal += r.created; } catch (e) { console.warn(`sync failed for ${productId}`, e); }
      return res.json({ success: true, createdTotal, productId });
    }

    const products = await Product.find({ isDeleted: { $ne: true } }).lean();
    for (const p of products) {
      try { const r = await createSkusForProduct(p.id); if (r?.created) createdTotal += r.created; } catch (e) { console.warn(`sync failed for ${p.id}`, e); }
    }

    return res.json({ success: true, createdTotal });
  } catch (err) {
    console.error("POST /sync_product_skus error:", err);
    return res.status(500).json({ success: false, error: err.message || "Server error" });
  }
};

// ─── POST /admin/migrate-sku-ids ─────────────────────────────────────────────
const migrateSkuIdsRoute = async (req, res) => {
  try {
    const result = await migrateSkuIds();
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("POST /admin/migrate-sku-ids error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── POST /admin/deduplicate-skus ────────────────────────────────────────────
const deduplicateSkusRoute = async (req, res) => {
  try {
    const products = await Product.find({}).lean();
    let totalDeleted = 0;
    const report = [];

    for (const product of products) {
      const isSimple = SIMPLE_CATEGORIES.includes((product.category || "").toLowerCase());

      if (isSimple) {
        const expectedStock = Number(product.stock || 0);
        const allSeqs = await ShoeSequence.find({ productId: product.id }).sort({ sequenceNumber: 1 }).lean();
        const availSeqs = allSeqs.filter((s) => s.status === "available");
        const excess = Math.max(0, availSeqs.length - expectedStock);
        if (excess > 0) {
          const toDelete = availSeqs.slice(availSeqs.length - excess).map((s) => s._id);
          await ShoeSequence.deleteMany({ _id: { $in: toDelete } });
          totalDeleted += excess;
          report.push({ product: product.name, id: product.id, deleted: excess });
        }
      } else {
        const sizesMap = {};
        if (Array.isArray(product.sizes)) {
          product.sizes.forEach((e) => { 
            if (e?.size) sizesMap[String(e.size)] = Number(e.quantity || 0); 
          });
        }

        const allSeqs = await ShoeSequence.find({ productId: product.id }).sort({ sequenceNumber: 1 }).lean();
        const sizeSet = [...new Set(allSeqs.map((s) => s.size))];

        for (const size of sizeSet) {
          const expected = sizesMap[size] ?? 0;
          const availSeqs = allSeqs.filter((s) => s.size === size && s.status === "available");
          const excess = Math.max(0, availSeqs.length - expected);
          if (excess > 0) {
            const toDelete = availSeqs.slice(availSeqs.length - excess).map((s) => s._id);
            await ShoeSequence.deleteMany({ _id: { $in: toDelete } });
            totalDeleted += excess;
            report.push({ product: product.name, id: product.id, size, deleted: excess });
          }
        }
      }

    }

    const migResult = await migrateSkuIds();
    res.json({ success: true, totalDeleted, report, migrationUpdated: migResult.updated });
  } catch (err) {
    console.error("POST /admin/deduplicate-skus error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── POST /updateskuprice ─────────────────────────────────────────────────────
const updateSkuPrice = async (req, res) => {
  const { productId, size, price } = req.body;
  try {
    if (!productId || !size || !price || Number(price) <= 0)
      return res.status(400).json({ success: false, error: "productId, size, and a price > 0 are required" });

    const newPrice = parseFloat(price);

    // 1. Update all available (and reserved) sequences for this product+size
    const seqResult = await ShoeSequence.updateMany(
      { productId: Number(productId), size: String(size) },
      { $set: { productPrice: newPrice } }
    );

    // 2. Sync the price into the product document
    const product = await Product.findOne({ id: Number(productId) });
    let oldPrice = null;
    if (product) {
      const isSimpleCat = SIMPLE_CATEGORIES.includes((product.category || "").toLowerCase());
      if (isSimpleCat) {
        oldPrice = product.price;
        await Product.findOneAndUpdate({ id: product.id }, { $set: { price: newPrice } });
      } else {
        const currentSizesArray = Array.isArray(product.sizes) ? [...product.sizes] : [];
        const sz = String(size);
        const existingIdx = currentSizesArray.findIndex(e => String(e.size) === sz);

        if (existingIdx !== -1) {
          oldPrice = currentSizesArray[existingIdx].price;
          currentSizesArray[existingIdx].price = newPrice;
        } else {
          currentSizesArray.push({ size: sz, quantity: 0, price: newPrice });
        }

        await Product.findOneAndUpdate(
          { id: product.id },
          { $set: { sizes: currentSizesArray } }
        );
      }
    }



      // Audit log for price edit
      writeAudit("price_edit", req, {
        productId: product.id,
        productName: product.name,
        size: String(size),
        oldPrice,
        newPrice,
        skuCountUpdated: seqResult.modifiedCount,
      });

    return res.json({

      success: true,
      message: `Price updated to ₱${newPrice} on ${seqResult.modifiedCount} SKU(s)`,
      modifiedCount: seqResult.modifiedCount,
    });
  } catch (err) {
    console.error("POST /updateskuprice error:", err);
    return res.status(500).json({ success: false, error: "Server error: " + err.message });
  }
};

const addStockBatch = async (req, res) => {
  const {
    productId,
    supplierName = "",
    costPrice = 0,
    notes = "",
    receivedDate,
    lines = [],
  } = req.body;

  try {
    // ── Validate ──────────────────────────────────────────────────────────────
    if (!productId)
      return res.status(400).json({ success: false, error: "productId is required" });

    if (!Array.isArray(lines) || lines.length === 0)
      return res.status(400).json({ success: false, error: "lines[] is required and must not be empty" });

    const validLines = lines.filter(
      (l) => l && l.size && Number(l.quantity) > 0 && Number(l.sellingPrice) > 0
    );
    if (validLines.length === 0)
      return res.status(400).json({ success: false, error: "No valid lines — each line needs size, quantity > 0, and sellingPrice > 0" });

    const product = await Product.findOne({ id: Number(productId) });
    if (!product)
      return res.status(404).json({ success: false, error: "Product not found" });

    const addedBy = getAdminEmailFromRequest(req);
    const isSimple = SIMPLE_CATEGORIES.includes((product.category || "").toLowerCase());
    const totalUnits = validLines.reduce((s, l) => s + Number(l.quantity), 0);
    const batchNumber = await getNextBatchNumber(product.id);
    const intakeDate = receivedDate ? new Date(receivedDate) : new Date();

    // ── Allocate global counters once for the whole batch ─────────────────────
    const [sequences, pidRange] = await Promise.all([
      getNextSequences(totalUnits),
      getNextProductItemIds(product.id, totalUnits),
    ]);

    // ── Create batch document FIRST so we have its _id ────────────────────────
    const batch = await StockBatch.create({
      productId: product.id,
      productName: product.name,
      batchNumber,
      supplierName,
      costPrice: Number(costPrice) || 0,
      notes,
      receivedDate: intakeDate,
      addedBy,
      lines: validLines.map((l) => ({
        size: isSimple ? "—" : String(l.size),
        quantity: Number(l.quantity),
        sellingPrice: Number(l.sellingPrice),
      })),
      totalUnits,
      pidStart: pidRange.start,
      pidEnd: pidRange.end,
      category: product.category,
      brand: product.brand || "",
    });

    // ── Create one ShoeSequence per unit ──────────────────────────────────────
    let seqCursor = sequences.start;
    let pidCursor = pidRange.start;
    const inserts = [];

    for (const line of validLines) {
      const normalizedSize = isSimple ? "—" : String(line.size);
      const qty = Number(line.quantity);
      const sellPrice = Number(line.sellingPrice);

      for (let i = 0; i < qty; i++) {
        inserts.push({
          skuNumber: product.id,
          productItemId: pidCursor,
          sequenceNumber: seqCursor,
          productId: product.id,
          productName: product.name,
          productImage: product.image,
          productPrice: sellPrice,
          category: product.category,
          brand: product.brand || "",
          size: normalizedSize,
          status: "available",
          addedDate: intakeDate,
          consignedBy: supplierName || addedBy,
          // ── NEW batch tracking fields ──────────────────────────────────────
          batchId: batch._id,
          batchNumber,
          costPrice: Number(costPrice) || 0,
          // ── Initial price history entry ────────────────────────────────────
          priceHistory: [
            {
              price: sellPrice,
              changedAt: intakeDate,
              changedBy: addedBy,
              reason: "initial_intake",
            },
          ],
        });
        seqCursor++;
        pidCursor++;
      }
    }

    await ShoeSequence.insertMany(inserts);

    // ── Update Product document sizes / stock ─────────────────────────────────
    let updatedProduct;
    if (isSimple) {
      const skuCount = await ShoeSequence.countDocuments({
        productId: product.id, status: "available",
      });
      updatedProduct = await Product.findOneAndUpdate(
        { id: product.id },
        { $set: { stock: skuCount, available: skuCount > 0 } },
        { new: true }
      );
    } else {
      // product.sizes is an ARRAY of { size, quantity, price }, not an object
      const currentSizesArray = Array.isArray(product.sizes) ? [...product.sizes] : [];
      for (const line of validLines) {
        const sz = String(line.size);
        const qty = Number(line.quantity);
        const price = Number(line.sellingPrice);
        const existingIdx = currentSizesArray.findIndex(e => String(e.size) === sz);
        if (existingIdx !== -1) {
          currentSizesArray[existingIdx] = {
            size: sz,
            quantity: Number(currentSizesArray[existingIdx].quantity || 0) + qty,
            price: price,
          };
        } else {
          currentSizesArray.push({ size: sz, quantity: qty, price: price });
        }
      }

      // Calculate total stock for top-level field
      const totalStock = currentSizesArray.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);

      updatedProduct = await Product.findOneAndUpdate(
        { id: product.id },
        { 
          $set: { 
            sizes: currentSizesArray,
            stock: totalStock,
            available: totalStock > 0
          } 
        },
        { new: true }
      );
    }


    return res.json({
      success: true,
      message: `Batch #${batchNumber} — ${totalUnits} unit(s) added`,
      batchId: batch._id,
      batchNumber,
      totalUnits,
      pidStart: pidRange.start,
      pidEnd: pidRange.end,
    });
  } catch (err) {
    console.error("POST /addstockbatch error:", err);
    return res.status(500).json({ success: false, error: "Server error: " + err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /updateskupricev2
// Body: {
//   productId,
//   size,          // required for shoe products; pass "—" for simple cats
//   newPrice,      // new selling price > 0
//   mode,          // "all" | "older_than" | "batch"
//   olderThanDays, // required when mode === "older_than"
//   batchId,       // required when mode === "batch"
//   reason,        // optional label: "clearance" | "correction" | "restock" | free text
// }
// ─────────────────────────────────────────────────────────────────────────────
const updateSkuPriceV2 = async (req, res) => {
  const {
    productId,
    size,
    newPrice,
    mode = "all",
    olderThanDays,
    batchId,
    reason = "manual_edit",
  } = req.body;

  try {
    if (!productId || !newPrice || Number(newPrice) <= 0)
      return res.status(400).json({ success: false, error: "productId and newPrice > 0 are required" });

    const price = parseFloat(newPrice);
    const changedBy = getAdminEmailFromRequest(req);
    const changedAt = new Date();

    // ── Build the query filter ────────────────────────────────────────────────
    const baseFilter = {
      productId: Number(productId),
      status: "available",   // only touch unsold units
    };

    // For shoe products, scope to the requested size
    const product = await Product.findOne({ id: Number(productId) });
    if (!product) return res.status(404).json({ success: false, error: "Product not found" });
    const isSimple = SIMPLE_CATEGORIES.includes((product.category || "").toLowerCase());

    if (!isSimple && size) baseFilter.size = String(size);

    if (mode === "older_than") {
      const days = Number(olderThanDays);
      if (!days || days < 1)
        return res.status(400).json({ success: false, error: "olderThanDays must be >= 1 for 'older_than' mode" });
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      baseFilter.addedDate = { $lte: cutoff };
    }

    if (mode === "batch") {
      if (!batchId)
        return res.status(400).json({ success: false, error: "batchId is required for 'batch' mode" });
      baseFilter.batchId = batchId;
    }

    // ── Preview count (returned even if 0 so UI can warn) ────────────────────
    const affectedCount = await ShoeSequence.countDocuments(baseFilter);

    if (affectedCount === 0) {
      return res.json({
        success: true,
        message: "No matching units found — nothing was changed.",
        modifiedCount: 0,
      });
    }

    // ── Push to priceHistory + update productPrice ────────────────────────────
    const updateResult = await ShoeSequence.updateMany(
      baseFilter,
      {
        $set: { productPrice: price },
        $push: {
          priceHistory: {
            price: price,
            changedAt,
            changedBy,
            reason,
          },
        },
      }
    );

    // ── Sync product document price for the affected size ────────────────────
    if (isSimple) {
      await Product.findOneAndUpdate({ id: product.id }, { $set: { price } });
    } else if (size) {
      const currentSizesArray = Array.isArray(product.sizes) ? [...product.sizes] : [];
      const sz = String(size);
      const existingIdx = currentSizesArray.findIndex(e => String(e.size) === sz);

      if (existingIdx !== -1) {
        currentSizesArray[existingIdx].price = price;
      } else {
        currentSizesArray.push({ size: sz, quantity: 0, price });
      }

      await Product.findOneAndUpdate(
        { id: product.id },
        { $set: { sizes: currentSizesArray } }
      );
    }


    return res.json({
      success: true,
      message: `Price updated to ₱${price} on ${updateResult.modifiedCount} unit(s)`,
      modifiedCount: updateResult.modifiedCount,
      mode,
      newPrice: price,
    });
  } catch (err) {
    console.error("POST /updateskupricev2 error:", err);
    return res.status(500).json({ success: false, error: "Server error: " + err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /batches/:productId
// Returns all StockBatch documents for a product, newest first.
// Used by the "pick a batch" dropdown in the Edit Price tab.
// ─────────────────────────────────────────────────────────────────────────────
const getProductBatches = async (req, res) => {
  try {
    const batches = await StockBatch.find({ productId: Number(req.params.productId) })
      .sort({ createdAt: -1 })
      .lean();

    // Enrich each batch with live available-unit count
    const enriched = await Promise.all(
      batches.map(async (b) => {
        const availableUnits = await ShoeSequence.countDocuments({
          batchId: b._id,
          status: "available",
        });
        return { ...b, availableUnits };
      })
    );

    return res.json({ success: true, batches: enriched });
  } catch (err) {
    console.error("GET /batches/:productId error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

module.exports = {
  addStock,
  getAllSequences,
  markSequenceSold,
  testSequence,
  getSequencesByProduct,
  assignSequence,
  getUserPurchases,
  reserveSequence,
  releaseExpiredReservations,
  getSkuStats,
  restoreSequence,
  deleteSequence,
  createSkusForProductRoute,
  syncProductSkus,
  migrateSkuIdsRoute,
  deduplicateSkusRoute,
  updateSkuPrice,
  addStockBatch,
  updateSkuPriceV2,
  getProductBatches,
};