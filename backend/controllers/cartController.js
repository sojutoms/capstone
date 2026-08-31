const Users = require("../models/Users");
const Product = require("../models/Product");
const { getReservedQtyForItem } = require("../utils/reservations");

// ─── POST /getcart ────────────────────────────────────────────────────────────
const getCart = async (req, res) => {
  try {
    const user = await Users.findById(req.user.id);
    if (!user || !user.cartData) return res.json([]);

    const cartArray = Object.entries(user.cartData).map(([key, quantity]) => {
      const [itemId, size] = key.split("_");
      return { itemId, size, quantity };
    });

    res.json(cartArray);
  } catch (err) {
    console.error("Error fetching cart:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

// ─── POST /addtocart ──────────────────────────────────────────────────────────
const addToCart = async (req, res) => {
  const { itemId, size } = req.body;
  const key = `${itemId}_${size}`;
  try {
    const user = await Users.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, error: "User not found" });

    // Stock Validation
    const product = await Product.findOne({ id: Number(itemId) });
    if (!product) return res.status(404).json({ success: false, error: "Product not found" });

    const currentQtyInCart = (user.cartData && user.cartData[key]) || 0;

    // Check stock based on category — minus whatever's currently held by an
    // active checkout reservation, so the cart can never accept more than
    // what's actually shown as available on the product page.
    const isSimple = ["bags", "collectibles"].includes((product.category || "").toLowerCase());

    if (isSimple) {
      const reserved = await getReservedQtyForItem(product.id, "");
      const trulyAvailable = Math.max(0, (product.stock || 0) - reserved);
      if (currentQtyInCart + 1 > trulyAvailable) {
        return res.status(400).json({ success: false, error: "Not enough stock available" });
      }
    } else {
      const sizeEntry = (product.sizes || []).find(s => String(s.size) === String(size));
      const reserved = await getReservedQtyForItem(product.id, size);
      const trulyAvailable = Math.max(0, (sizeEntry?.quantity || 0) - reserved);
      if (!sizeEntry || currentQtyInCart + 1 > trulyAvailable) {
        return res.status(400).json({ success: false, error: "Not enough stock available for this size" });
      }
    }

    if (!user.cartData || typeof user.cartData !== "object") user.cartData = {};
    const currentCart = { ...user.cartData };
    currentCart[key] = currentCart[key] ? currentCart[key] + 1 : 1;

    user.cartData = currentCart;
    user.markModified("cartData");
    await user.save();
    res.json({ success: true });
  } catch (err) {
    console.error("Add to cart error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};


// ─── POST /removefromcart ─────────────────────────────────────────────────────
const removeFromCart = async (req, res) => {
  const { itemId, size } = req.body;
  const key = `${itemId}_${size}`;
  try {
    const user = await Users.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, error: "User not found" });

    if (user.cartData && typeof user.cartData === "object" && user.cartData[key]) {
      const updatedCart = { ...user.cartData };
      if (updatedCart[key] > 1) updatedCart[key] -= 1;
      else delete updatedCart[key];

      user.cartData = updatedCart;
      user.markModified("cartData");
      await user.save();
      return res.json({ success: true });
    }

    res.json({ success: false, error: "Item not found in cart" });
  } catch (err) {
    console.error("Remove from cart error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

// ─── POST /clearcart ──────────────────────────────────────────────────────────
const clearCart = async (req, res) => {
  try {
    const user = await Users.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, error: "User not found" });
    user.cartData = {};
    user.markModified("cartData");
    await user.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: "Server error" });
  }
};

module.exports = { getCart, addToCart, removeFromCart, clearCart };