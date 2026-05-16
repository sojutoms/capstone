const express = require("express");
const router = express.Router();
const { fetchUser, authenticate } = require("../middleware/auth");
const { SavedAddress } = require("../models/index");
const {
  login,
  signup,
  verifyOtp,
  forgotPassword,
  resetPassword,
  getAllUsers,
  removeUser,
  blockUser,
  getUserProfile,
  updateUserProfile,
  changeUserPassword,
  getUserFavorites,
  addFavorite,
  removeFavorite,
  clearFavorites,
  saveAddress,
  getSavedAddresses,
  deleteAddress,
  deleteUser,
  updateAddress,
  verifyCurrentPassword,
  sendChangePasswordOtp,
  resendOtp,
  redeemPoints,
} = require("../controllers/userController");

// Auth
router.post("/login", login);
router.post("/signup", signup);
router.post("/verify-otp", verifyOtp);
router.post("/resend-otp", resendOtp);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// User management (admin)
router.get("/allusers", getAllUsers);
router.post("/removeuser", removeUser);
router.post("/blockuser", blockUser);

// Profile
router.get("/user/profile", fetchUser, getUserProfile);
router.put("/user/profile", fetchUser, updateUserProfile);
router.put("/user/changepassword", fetchUser, changeUserPassword);
router.post("/user/verify-current-password", fetchUser, verifyCurrentPassword);
router.post("/user/send-change-password-otp", fetchUser, sendChangePasswordOtp);
router.post("/redeempoints", fetchUser, redeemPoints);

// Authenticated user delete (user deletes their own account)
router.delete("/user", fetchUser, deleteUser);

// Favorites
router.get("/userfavorites", fetchUser, getUserFavorites);
router.post("/addfavorite", fetchUser, addFavorite);
router.post("/removefavorite", fetchUser, removeFavorite);
router.post("/clearfavorites", fetchUser, clearFavorites);

// Saved addresses (embedded in user doc)
router.post("/saveaddress", fetchUser, saveAddress);
router.get("/getsavedaddresses", fetchUser, getSavedAddresses);
router.put("/updateaddress/:index", fetchUser, updateAddress);
router.delete("/deleteaddress/:index", fetchUser, deleteAddress);

// Saved addresses (separate collection — authenticate middleware)
router.get("/savedaddresses", authenticate, async (req, res) => {
  try {
    const addresses = await SavedAddress.find({ userId: req.userId }).sort({ isDefault: -1, createdAt: -1 });
    res.json({ success: true, addresses });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

router.post("/savedaddresses", authenticate, async (req, res) => {
  const { action, id, address } = req.body || {};
  try {
    if (!action) return res.status(400).json({ success: false, error: "Missing action" });

    if (action === "create") {
      const payload = { ...(address || {}), userId: req.userId };
      if (payload.isDefault) await SavedAddress.updateMany({ userId: req.userId }, { $set: { isDefault: false } });
      const saved = new SavedAddress(payload);
      await saved.save();
      const addresses = await SavedAddress.find({ userId: req.userId }).sort({ isDefault: -1, createdAt: -1 });
      return res.json({ success: true, addresses, saved });
    }

    if (action === "update") {
      if (!id) return res.status(400).json({ success: false, error: "Missing id for update" });
      const existing = await SavedAddress.findOne({ _id: id, userId: req.userId });
      if (!existing) return res.status(404).json({ success: false, error: "Address not found" });
      const payload = address || {};
      if (payload.isDefault) await SavedAddress.updateMany({ userId: req.userId }, { $set: { isDefault: false } });
      Object.assign(existing, payload);
      await existing.save();
      const addresses = await SavedAddress.find({ userId: req.userId }).sort({ isDefault: -1, createdAt: -1 });
      return res.json({ success: true, addresses, saved: existing });
    }

    if (action === "delete") {
      if (!id) return res.status(400).json({ success: false, error: "Missing id for delete" });
      const deleted = await SavedAddress.findOneAndDelete({ _id: id, userId: req.userId });
      if (!deleted) return res.status(404).json({ success: false, error: "Address not found" });
      if (deleted.isDefault) {
        const another = await SavedAddress.findOne({ userId: req.userId }).sort({ createdAt: -1 });
        if (another) { another.isDefault = true; await another.save(); }
      }
      const addresses = await SavedAddress.find({ userId: req.userId }).sort({ isDefault: -1, createdAt: -1 });
      return res.json({ success: true, addresses });
    }

    if (action === "setDefault") {
      if (!id) return res.status(400).json({ success: false, error: "Missing id for setDefault" });
      await SavedAddress.updateMany({ userId: req.userId }, { $set: { isDefault: false } });
      const addressDoc = await SavedAddress.findOneAndUpdate(
        { _id: id, userId: req.userId },
        { $set: { isDefault: true } },
        { new: true }
      );
      if (!addressDoc) return res.status(404).json({ success: false, error: "Address not found" });
      const addresses = await SavedAddress.find({ userId: req.userId }).sort({ isDefault: -1, createdAt: -1 });
      return res.json({ success: true, addresses, saved: addressDoc });
    }

    return res.status(400).json({ success: false, error: "Unknown action" });
  } catch (err) {
    console.error("POST /savedaddresses error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

module.exports = router;