const express = require("express");
const router = express.Router();
const { fetchUser } = require("../middleware/auth");
const { getCart, addToCart, removeFromCart, clearCart } = require("../controllers/cartController");

router.post("/getcart", fetchUser, getCart);
router.post("/addtocart", fetchUser, addToCart);
router.post("/removefromcart", fetchUser, removeFromCart);
router.post("/clearcart", fetchUser, clearCart);

module.exports = router;