const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const Users = require("../models/Users");
const { OtpModel } = require("../models/index");
const sendEmail = require("../config/mailer");

const JWT_SECRET = process.env.JWT_SECRET || "secret_ecom";

// ─── POST /login ──────────────────────────────────────────────────────────────
const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await Users.findOne({ email });
    if (!user) return res.status(401).json({ success: false, errors: "Invalid credentials" });

    let isMatch = false;
    if (user.password.startsWith("$2b$") || user.password.startsWith("$2a$")) {
      isMatch = await bcrypt.compare(password, user.password);
    } else {
      isMatch = user.password === password;
    }
    if (!isMatch) return res.status(401).json({ success: false, errors: "Invalid credentials" });

    const token = jwt.sign({ user: { id: String(user._id) } }, JWT_SECRET);
    res.json({ success: true, token });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, errors: "Server error" });
  }
};

// ─── POST /signup ─────────────────────────────────────────────────────────────
const signup = async (req, res) => {
  const { firstName, lastName, email, phone, password } = req.body;
  try {
    if (!firstName || !lastName)
      return res.status(400).json({ success: false, errors: "First and last name are required" });
    if (/\d/.test(firstName) || /\d/.test(lastName))
      return res.status(400).json({ success: false, errors: "Names cannot contain numbers" });

    if (!phone || !/^\d{11}$/.test(phone))
      return res.status(400).json({ success: false, field: "phone", errors: "Phone number must be exactly 11 digits." });

    const existingUser = await Users.findOne({ email });
    if (existingUser)
      return res.status(400).json({ success: false, field: "email", errors: "Email already exists" });

    const existingPhone = await Users.findOne({ phone });
    if (existingPhone)
      return res.status(400).json({ success: false, field: "phone", errors: "Phone number is already in use." });

    const otp = Math.floor(100000 + Math.random() * 900000);
    // Clear legacy OTPs
    await OtpModel.deleteMany({ email });
    await OtpModel.create({
      email,
      otp,
      username: `${firstName} ${lastName}`,
      phone,
      password,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      resendCount: 0,
      lastResendAt: new Date(),
    });

    await sendEmail(
      email,
      "Your One-Time Password (OTP) Verification",
      `<p>Hi ${firstName},</p>
       <p>Your OTP verification code is: <strong style="font-size:20px;">${otp}</strong></p>
       <p>This code expires in <strong>5 minutes</strong>.</p>
       <p>If you did not request this, please ignore this email.</p>
       <br/><p>— GoodSoles PH</p>`
    );

    res.json({ success: true, message: "OTP sent to email" });
  } catch (err) {
    const fs = require("fs");
    const errorLog = `[${new Date().toISOString()}] Signup OTP error: ${err.message}\n${err.stack}\n\n`;
    fs.appendFileSync("signup_error.log", errorLog);
    console.error("Signup OTP error:", err);
    res.status(500).json({ success: false, errors: "Server error", debug: err.message });
  }
};

// ─── POST /verify-otp ─────────────────────────────────────────────────────────
const verifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  if (!/^\d{6}$/.test(otp))
    return res.status(400).json({ success: false, errors: "OTP must be a 6-digit number" });

  try {
    const record = await OtpModel.findOne({ email, otp });
    if (!record) return res.json({ success: false, errors: "Invalid OTP" });
    if (record.expiresAt < Date.now()) return res.json({ success: false, errors: "Expired OTP" });

    if (record.phone) {
      const existingPhone = await Users.findOne({ phone: record.phone });
      if (existingPhone) {
        await OtpModel.deleteOne({ _id: record._id });
        return res.json({ success: false, errors: "Phone number is already in use." });
      }
    }

    const user = new Users({
      name: record.username,
      email: record.email,
      phone: record.phone || "",
      password: record.password,
      cartData: {},
    });
    await user.save();
    await OtpModel.deleteOne({ _id: record._id });

    const token = jwt.sign({ user: { id: String(user._id) } }, JWT_SECRET);
    res.json({ success: true, token });
  } catch (err) {
    console.error("Verify OTP error:", err);
    res.status(500).json({ success: false, errors: "Server error" });
  }
};

// ─── POST /resend-otp ─────────────────────────────────────────────────────────
// Cooldown rules:
//   resendCount == 0 (first resend after initial send) → 1 min cooldown
//   resendCount == 1 (second resend)                   → 2 min cooldown
//   resendCount >= 2 (third resend and beyond)         → 3 min cooldown
const resendOtp = async (req, res) => {
  const { email, type } = req.body; // type: "signup" | "forgot"
  if (!email) return res.status(400).json({ success: false, errors: "Email is required." });

  try {
    // Find the most recent OTP record for this email
    const record = await OtpModel.findOne({ email }).sort({ createdAt: -1 });
    if (!record) return res.status(404).json({ success: false, errors: "No OTP request found for this email." });

    const resendCount = record.resendCount || 0;
    const lastResendAt = record.lastResendAt || record.createdAt || new Date(0);

    // Determine cooldown in milliseconds based on how many resends have happened
    let cooldownMs;
    if (resendCount === 0) {
      cooldownMs = 1 * 60 * 1000; // 1 minute after first OTP
    } else if (resendCount === 1) {
      cooldownMs = 2 * 60 * 1000; // 2 minutes after first resend
    } else {
      cooldownMs = 3 * 60 * 1000; // 3 minutes after second+ resend
    }

    const timeSinceLast = Date.now() - new Date(lastResendAt).getTime();
    if (timeSinceLast < cooldownMs) {
      const remainingMs = cooldownMs - timeSinceLast;
      const remainingSecs = Math.ceil(remainingMs / 1000);
      return res.status(429).json({
        success: false,
        errors: `Please wait before requesting a new OTP.`,
        remainingSeconds: remainingSecs,
      });
    }

    // Generate new OTP
    const newOtp = Math.floor(100000 + Math.random() * 900000);

    // Update the existing record: new OTP, refreshed expiry, incremented resendCount
    await OtpModel.updateOne(
      { _id: record._id },
      {
        $set: {
          otp: newOtp,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
          lastResendAt: new Date(),
        },
        $inc: { resendCount: 1 },
      }
    );

    const recipientName = record.username ? record.username.split(" ")[0] : "there";
    const isSignup = type === "signup" || !!record.phone; // heuristic: signup records have phone

    const subject = isSignup
      ? "Your New OTP Verification Code — GoodSoles PH"
      : "Your New Password Reset Code — GoodSoles PH";

    const body = isSignup
      ? `<p>Hi ${recipientName},</p>
         <p>You requested a new OTP. Your new verification code is: <strong style="font-size:20px;">${newOtp}</strong></p>
         <p>This code expires in <strong>5 minutes</strong>.</p>
         <p>If you did not request this, please ignore this email.</p>
         <br/><p>— GoodSoles PH</p>`
      : `<p>Hi ${recipientName},</p>
         <p>You requested a new password reset code: <strong style="font-size:20px;">${newOtp}</strong></p>
         <p>This code expires in <strong>5 minutes</strong>.</p>
         <p>If you did not request a password reset, please secure your account immediately.</p>
         <br/><p>— GoodSoles PH</p>`;

    await sendEmail(email, subject, body);

    // Tell the frontend what the NEXT cooldown will be (after this resend)
    const nextResendCount = resendCount + 1;
    let nextCooldownMs;
    if (nextResendCount === 1) {
      nextCooldownMs = 2 * 60 * 1000;
    } else {
      nextCooldownMs = 3 * 60 * 1000;
    }

    res.json({
      success: true,
      message: "New OTP sent to email.",
      nextCooldownSeconds: Math.ceil(nextCooldownMs / 1000),
    });
  } catch (err) {
    console.error("Resend OTP error:", err);
    res.status(500).json({ success: false, errors: "Server error" });
  }
};

// ─── POST /forgot-password ────────────────────────────────────────────────────
const forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await Users.findOne({ email });
    if (!user) return res.status(404).json({ success: false, errors: "Email not found" });

    const otp = Math.floor(100000 + Math.random() * 900000);
    await OtpModel.create({
      email,
      otp,
      username: user.name,
      password: user.password,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      resendCount: 0,
      lastResendAt: new Date(),
    });

    await sendEmail(
      email,
      "Password Reset OTP — GoodSoles PH",
      `<p>Hi ${user.name},</p>
       <p>Your password reset OTP is: <strong style="font-size:20px;">${otp}</strong></p>
       <p>This code expires in <strong>5 minutes</strong>.</p>
       <p>If you did not request a password reset, please ignore this email.</p>
       <br/><p>— GoodSoles PH</p>`
    );

    console.log("📨 Forgot Password OTP sent via Brevo to:", email);
    res.json({ success: true, message: "OTP sent to email" });
  } catch (err) {
    console.error("Forgot Password error:", err);
    res.status(500).json({ success: false, errors: "Server error" });
  }
};

// ─── POST /reset-password ─────────────────────────────────────────────────────
const resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;
  try {
    const record = await OtpModel.findOne({ email, otp });
    if (!record) return res.json({ success: false, errors: "Invalid OTP" });
    if (record.expiresAt < Date.now()) return res.json({ success: false, errors: "Expired OTP" });

    await Users.updateOne({ email }, { $set: { password: newPassword } });
    await OtpModel.deleteOne({ _id: record._id });
    res.json({ success: true, message: "Password reset successful" });
  } catch (err) {
    console.error("Reset Password error:", err);
    res.status(500).json({ success: false, errors: "Server error" });
  }
};

// ─── GET /allusers ────────────────────────────────────────────────────────────
const Orders = require("../models/Orders");

const getAllUsers = async (req, res) => {
  try {
    const users = await Users.find({}).lean();
    const orders = await Orders.find({}).lean();

    const purchasesByUser = {};
    for (const o of orders) {
      const uid = String(o.userId || "");
      purchasesByUser[uid] = purchasesByUser[uid] || [];
      for (const it of o.items || []) {
        purchasesByUser[uid].push({ id: it.id || null, name: it.name || "", qty: it.quantity || it.qty || 1, price: it.price || 0, date: o.timestamp || o.date || null });
      }
    }

    const out = users.map((u) => {
      const uid = String(u._id);
      return { id: uid, name: u.name || "", email: u.email || "", phone: u.phone || "", status: u.status || "active", createdAt: u.date || null, roles: u.roles || [], purchases: purchasesByUser[uid] || [] };
    });

    res.json(out);
  } catch (err) {
    console.error("GET /allusers error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// ─── POST /removeuser (admin) ────────────────────────────────────────────────
const removeUser = async (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ success: false, error: "Missing id" });
  try {
    await Users.deleteOne({ _id: id });
    res.json({ success: true });
  } catch (err) {
    console.error("remove user error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

// ─── DELETE /user (authenticated user deletes own account) ───────────────────
const deleteUser = async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ success: false, error: "Unauthorized" });

    const user = await Users.findById(userId);
    if (!user) return res.status(404).json({ success: false, error: "User not found" });

    try { await OtpModel.deleteMany({ email: user.email }); }
    catch (e) { console.warn("Failed to delete OTP records for user:", e); }

    try { await Orders.deleteMany({ userId: userId }); }
    catch (e) { console.warn("Failed to delete orders for user:", e); }

    await Users.findByIdAndDelete(userId);
    return res.json({ success: true, message: "Account deleted" });
  } catch (err) {
    console.error("DELETE /user error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

// ─── POST /blockuser ──────────────────────────────────────────────────────────
const blockUser = async (req, res) => {
  const { id, block } = req.body;
  if (!id || typeof block === "undefined")
    return res.status(400).json({ success: false, error: "Missing parameters" });
  try {
    const status = block ? "blocked" : "active";
    await Users.updateOne({ _id: id }, { $set: { status } });
    res.json({ success: true, status });
  } catch (err) {
    console.error("block user error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

// ─── GET /user/profile ────────────────────────────────────────────────────────
const getUserProfile = async (req, res) => {
  try {
    const user = await Users.findById(req.user.id).select("-password -cartData").lean();
    if (!user) return res.status(404).json({ success: false, error: "User not found" });
    res.json({ success: true, user });
  } catch (err) {
    console.error("GET /user/profile error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

// ─── PUT /user/profile ────────────────────────────────────────────────────────
const updateUserProfile = async (req, res) => {
  try {
    const { firstName, lastName, email, newsletter, currency, phone, place, bio, photo } = req.body;

    if (phone !== undefined && phone !== "") {
      if (!/^\d{11}$/.test(phone))
        return res.status(400).json({ success: false, error: "Phone number must be exactly 11 digits." });
      const existing = await Users.findOne({ phone, _id: { $ne: req.user.id } });
      if (existing)
        return res.status(400).json({ success: false, error: "Phone number is already in use." });
    }

    // Bio is optional, but capped — matches the 15-word max enforced
    // client-side on mobile.
    let trimmedBio;
    if (bio !== undefined) {
      trimmedBio = String(bio || "").trim();
      const wordCount = trimmedBio.split(/\s+/).filter(Boolean).length;
      if (trimmedBio && wordCount > 15)
        return res.status(400).json({ success: false, error: "Bio must be 15 words or fewer." });
    }

    // This endpoint is used both for full profile-info saves (web, mobile's
    // Edit Profile — send everything) and single-field patches (mobile's
    // avatar upload — sends only `photo`). Only touch fields that were
    // actually provided, so a photo-only call can never blank out the name
    // by resolving firstName/lastName as "undefined undefined".
    const setFields = {};
    if (firstName !== undefined || lastName !== undefined) {
      setFields.firstName = firstName;
      setFields.lastName  = lastName;
      setFields.name      = `${firstName || ""} ${lastName || ""}`.trim();
    }
    if (email !== undefined)      setFields.email      = email;
    if (newsletter !== undefined) setFields.newsletter = newsletter;
    if (currency !== undefined)   setFields.currency   = currency;
    if (phone !== undefined)      setFields.phone      = phone || "";
    if (place !== undefined)      setFields.place      = String(place || "").trim();
    if (bio !== undefined)        setFields.bio        = trimmedBio;
    if (photo !== undefined)      setFields.photo      = String(photo || "");

    const updated = await Users.findByIdAndUpdate(
      req.user.id,
      { $set: setFields },
      { new: true, runValidators: true }
    ).select("-password -cartData").lean();

    if (!updated) return res.status(404).json({ success: false, error: "User not found" });
    res.json({ success: true, user: updated });
  } catch (err) {
    console.error("PUT /user/profile error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

// ─── POST /user/verify-current-password ──────────────────────────────────────
const verifyCurrentPassword = async (req, res) => {
  const { currentPassword } = req.body;
  if (!currentPassword)
    return res.status(400).json({ success: false, message: "Current password is required." });
  try {
    const user = await Users.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found." });

    let isMatch = false;
    if (user.password.startsWith("$2b$") || user.password.startsWith("$2a$")) {
      isMatch = await bcrypt.compare(currentPassword, user.password);
    } else {
      isMatch = user.password === currentPassword;
    }

    if (!isMatch) return res.json({ success: false, message: "Incorrect current password." });
    res.json({ success: true });
  } catch (err) {
    console.error("POST /user/verify-current-password error:", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── POST /user/send-change-password-otp ─────────────────────────────────────
const sendChangePasswordOtp = async (req, res) => {
  try {
    const user = await Users.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found." });

    const existingOtp = await OtpModel.findOne({ email: user.email });
    if (existingOtp) await OtpModel.deleteOne({ email: user.email });

    const otp = Math.floor(100000 + Math.random() * 900000);
    await OtpModel.create({
      email: user.email,
      otp,
      username: user.name,
      password: user.password,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    await sendEmail(
      user.email,
      "Password Change Verification Code — GoodSoles PH",
      `<p>Hi ${user.name},</p>
       <p>Your password change verification code is: <strong style="font-size:20px;">${otp}</strong></p>
       <p>This code expires in <strong>5 minutes</strong>.</p>
       <p>If you did not request this, please secure your account immediately.</p>
       <br/><p>— GoodSoles PH</p>`
    );

    res.json({ success: true, message: "OTP sent to your email." });
  } catch (err) {
    console.error("POST /user/send-change-password-otp error:", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── PUT /user/changepassword ─────────────────────────────────────────────────
const changeUserPassword = async (req, res) => {
  const { currentPassword, newPassword, otp } = req.body;
  if (!currentPassword || !newPassword)
    return res.status(400).json({ success: false, message: "Both current and new password are required." });
  if (!otp)
    return res.status(400).json({ success: false, message: "OTP is required." });

  try {
    const user = await Users.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found." });

    let isMatch = false;
    if (user.password.startsWith("$2b$") || user.password.startsWith("$2a$")) {
      isMatch = await bcrypt.compare(currentPassword, user.password);
    } else {
      isMatch = user.password === currentPassword;
    }
    if (!isMatch) return res.json({ success: false, message: "Incorrect current password." });

    const record = await OtpModel.findOne({ email: user.email, otp: Number(otp) });
    if (!record) return res.json({ success: false, message: "Invalid OTP." });
    if (record.expiresAt < Date.now()) {
      await OtpModel.deleteOne({ _id: record._id });
      return res.json({ success: false, message: "OTP has expired. Please try again." });
    }
    await OtpModel.deleteOne({ _id: record._id });

    const hashed = await bcrypt.hash(newPassword, 10);
    await Users.findByIdAndUpdate(req.user.id, { $set: { password: hashed } });
    res.json({ success: true, message: "Password updated successfully." });
  } catch (err) {
    console.error("PUT /user/changepassword error:", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── Favorites ────────────────────────────────────────────────────────────────
const getUserFavorites = async (req, res) => {
  try {
    const user = await Users.findById(req.user.id);
    res.json({ success: true, favorites: user.favorites || [] });
  } catch (err) {
    console.error("GET /userfavorites error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch favorites" });
  }
};

const addFavorite = async (req, res) => {
  const { productId } = req.body;
  if (!productId) return res.status(400).json({ success: false, error: "Missing productId" });
  try {
    const user = await Users.findById(req.user.id);
    if (!user.favorites.includes(productId)) { user.favorites.push(productId); await user.save(); }
    res.json({ success: true, favorites: user.favorites });
  } catch (err) {
    console.error("POST /addfavorite error:", err);
    res.status(500).json({ success: false, error: "Failed to add favorite" });
  }
};

const removeFavorite = async (req, res) => {
  const { productId } = req.body;
  if (!productId) return res.status(400).json({ success: false, error: "Missing productId" });
  try {
    const user = await Users.findById(req.user.id);
    user.favorites = user.favorites.filter((id) => id !== productId);
    await user.save();
    res.json({ success: true, favorites: user.favorites });
  } catch (err) {
    console.error("POST /removefavorite error:", err);
    res.status(500).json({ success: false, error: "Failed to remove favorite" });
  }
};

const clearFavorites = async (req, res) => {
  try {
    const user = await Users.findById(req.user.id);
    user.favorites = [];
    await user.save();
    res.json({ success: true, favorites: [] });
  } catch (err) {
    console.error("POST /clearfavorites error:", err);
    res.status(500).json({ success: false, error: "Failed to clear favorites" });
  }
};

// ─── Saved Addresses ──────────────────────────────────────────────────────────
const saveAddress = async (req, res) => {
  try {
    const { address } = req.body;
    if (!address || typeof address !== "object")
      return res.status(400).json({ success: false, error: "Invalid address data" });
    if (!address.firstName || !address.lastName)
      return res.status(400).json({ success: false, error: "Name is required" });
    if (!address.street)
      return res.status(400).json({ success: false, error: "Street address is required" });
    if (!address.phone)
      return res.status(400).json({ success: false, error: "Phone is required" });

    const savedAddress = {
      firstName: String(address.firstName || "").trim(),
      lastName: String(address.lastName || "").trim(),
      email: String(address.email || "").trim(),
      street: String(address.street || "").trim(),
      phone: String(address.phone || "").trim(),
      region: { code: String(address.region?.code || ""), name: String(address.region?.name || "") },
      province: { code: String(address.province?.code || ""), name: String(address.province?.name || "") },
      cityOrMunicipality: { code: String(address.cityOrMunicipality?.code || ""), name: String(address.cityOrMunicipality?.name || "") },
      barangay: { code: String(address.barangay?.code || ""), name: String(address.barangay?.name || "") },
    };

    const user = await Users.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, error: "User not found" });
    if (!user.savedAddresses) user.savedAddresses = [];

    const addressExists = user.savedAddresses.some(
      (addr) => addr.street === savedAddress.street &&
        addr.barangay?.code === savedAddress.barangay.code &&
        addr.cityOrMunicipality?.code === savedAddress.cityOrMunicipality.code
    );
    if (addressExists) return res.json({ success: true, message: "Address already saved", addresses: user.savedAddresses });

    user.savedAddresses.push(savedAddress);
    if (typeof user.markModified === "function") user.markModified("savedAddresses");
    await user.save();
    return res.json({ success: true, message: "Address saved successfully", addresses: user.savedAddresses });
  } catch (err) {
    console.error("Error saving address:", err);
    return res.status(500).json({ success: false, error: "Server error", message: err.message });
  }
};

const getSavedAddresses = async (req, res) => {
  try {
    const user = await Users.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, error: "User not found" });
    return res.json({ success: true, addresses: user.savedAddresses || [] });
  } catch (err) {
    console.error("Error getting saved addresses:", err);
    return res.status(500).json({ success: false, error: "Server error", message: err.message });
  }
};

const deleteAddress = async (req, res) => {
  try {
    const index = parseInt(req.params.index);
    const user = await Users.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, error: "User not found" });
    if (!user.savedAddresses || index < 0 || index >= user.savedAddresses.length)
      return res.status(400).json({ success: false, error: "Invalid address index" });

    user.savedAddresses.splice(index, 1);
    if (typeof user.markModified === "function") user.markModified("savedAddresses");
    await user.save();
    return res.json({ success: true, message: "Address deleted successfully", addresses: user.savedAddresses });
  } catch (err) {
    console.error("Error deleting address:", err);
    return res.status(500).json({ success: false, error: "Server error", message: err.message });
  }
};

const updateAddress = async (req, res) => {
  try {
    const index = parseInt(req.params.index);
    const user = await Users.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, error: "User not found" });
    if (!user.savedAddresses || index < 0 || index >= user.savedAddresses.length)
      return res.status(400).json({ success: false, error: "Invalid address index" });

    const address = req.body;
    if (!address || typeof address !== "object")
      return res.status(400).json({ success: false, error: "Invalid address data" });

    user.savedAddresses[index] = {
      firstName: String(address.firstName || "").trim(),
      lastName: String(address.lastName || "").trim(),
      email: String(address.email || "").trim(),
      street: String(address.street || "").trim(),
      phone: String(address.phone || "").trim(),
      region: { code: String(address.region?.code || ""), name: String(address.region?.name || "") },
      province: { code: String(address.province?.code || ""), name: String(address.province?.name || "") },
      cityOrMunicipality: { code: String(address.cityOrMunicipality?.code || ""), name: String(address.cityOrMunicipality?.name || "") },
      barangay: { code: String(address.barangay?.code || ""), name: String(address.barangay?.name || "") },
    };

    if (typeof user.markModified === "function") user.markModified("savedAddresses");
    await user.save();
    return res.json({ success: true, message: "Address updated successfully", addresses: user.savedAddresses });
  } catch (err) {
    console.error("Error updating address:", err);
    return res.status(500).json({ success: false, error: "Server error", message: err.message });
  }
};

// ─── Loyalty Points Redemption ────────────────────────────────────────────────
const redeemPoints = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { pointsToRedeem } = req.body;

    if (!pointsToRedeem || typeof pointsToRedeem !== "number" || pointsToRedeem <= 0) {
      return res.status(400).json({ success: false, error: "Invalid points amount" });
    }

    if (pointsToRedeem % 100 !== 0) {
      return res.status(400).json({ success: false, error: "Points must be redeemed in increments of 100" });
    }

    const user = await Users.findById(userId);
    if (!user) return res.status(404).json({ success: false, error: "User not found" });

    if ((user.points || 0) < pointsToRedeem) {
      return res.status(400).json({ success: false, error: "Insufficient points" });
    }

    // Conversion rate: 100 points = ₱1 (or $1 if you prefer, but sticking to ₱1 for simplicity)
    // Actually, user said 100 points = $1. Let's assume ₱1 = $0.018, so ₱56 = $1.
    // To match SHEIN's feel, let's use: 100 points = ₱50 (approx $1).
    const discountValue = (pointsToRedeem / 100) * 50; 

    const voucherCode = `PTS-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const newVoucher = {
      code: voucherCode,
      title: `₱${discountValue} Loyalty Reward`,
      message: `Redeemed from ${pointsToRedeem} points.`,
      discountPercent: 0, // Points vouchers use absolute discount
      maxDiscount: discountValue,
      isPointsVoucher: true, // Tag it
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      issuedAt: new Date(),
    };

    user.points -= pointsToRedeem;
    user.vouchers.push(newVoucher);
    await user.save();

    res.json({ success: true, message: `Successfully redeemed ${pointsToRedeem} points for a ₱${discountValue} voucher!`, points: user.points, voucher: newVoucher });
  } catch (err) {
    console.error("Redeem points error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

module.exports = {
  login,
  signup,
  verifyOtp,
  resendOtp,
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
  redeemPoints,
};