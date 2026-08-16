const express = require("express");
const router = express.Router();

const { fetchUser } = require("../middleware/auth");
const { createCheckoutSession, verifyPayment } = require("../controllers/paymentController");

router.post("/create-checkout-session", fetchUser, createCheckoutSession);
router.get("/payment/verify/:orderNumber", fetchUser, verifyPayment);

module.exports = router;
