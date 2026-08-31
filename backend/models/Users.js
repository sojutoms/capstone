const mongoose = require("mongoose");

const locationPartSchema = new mongoose.Schema(
  {
    code: { type: String, default: "" },
    name: { type: String, default: "" },
  },
  { _id: false }
);

const savedAddressSchema = new mongoose.Schema(
  {
    firstName:          { type: String, required: true, trim: true },
    lastName:           { type: String, required: true, trim: true },
    email:              { type: String, required: true, trim: true, lowercase: true },
    street:             { type: String, required: true, trim: true },
    phone:              { type: String, required: true, trim: true },
    region:             { type: locationPartSchema, required: true },
    province:           { type: locationPartSchema, required: false },
    cityOrMunicipality: { type: locationPartSchema, required: true },
    barangay:           { type: locationPartSchema, required: true },
  },
  { _id: false }
);

// ─── Voucher sub-schema ───────────────────────────────────────────────────────
// Each voucher is stored directly on the user document so it's always
// scoped to one recipient. The admin creates it via POST /admin/give-voucher.
const voucherSchema = new mongoose.Schema(
  {
    // Human-readable code shown to the customer (e.g. "SAVE10-A3F9")
    code:            { type: String, required: true },
    // Short title shown on the voucher card (e.g. "10% Off Your Next Order")
    title:           { type: String, required: true },
    // Full message / terms the admin wrote
    message:         { type: String, default: "" },
    // Discount percentage (0–100)
    discountPercent: { type: Number, required: true, min: 0, max: 100 },
    // Maximum peso discount that can be applied (0 = no cap)
    maxDiscount:     { type: Number, required: true, default: 0 },
    // Hard expiry date — null means no expiry
    expiresAt:       { type: Date, default: null },
    // Voucher is consumed once per use
    used:            { type: Boolean, default: false },
    usedAt:          { type: Date, default: null },
    // Which order consumed it
    usedOnOrder:     { type: String, default: null },
    // When the admin issued it
    issuedAt:        { type: Date, default: Date.now },
    // Admin who issued it (email for audit trail)
    issuedBy:        { type: String, default: null },
  },
  { _id: true }   // keep _id so each voucher has a unique Mongo ID
);

const userSchema = new mongoose.Schema(
  {
    name:           { type: String, required: true, trim: true },
    email:          { type: String, required: true, unique: true, lowercase: true, trim: true },
    password:       { type: String, required: true },
    phone:          { type: String, default: "" },
    // Mobile-only profile extras (city/province + a short bio, capped at 15
    // words — enforced in the controller, not here, so partial saves from
    // other flows never get blocked by mongoose validators).
    place:          { type: String, default: "", trim: true },
    photo:          { type: String, default: "" },
    bio:            { type: String, default: "", trim: true },
    status:         { type: String, default: "active", enum: ["active", "inactive", "banned"] },
    cartData:       { type: mongoose.Schema.Types.Mixed, default: {} },
    favorites:      { type: [String], default: [] },
    savedAddresses: { type: [savedAddressSchema], default: [] },
    // ── Vouchers assigned to this user ────────────────────────────────────────
    vouchers:       { type: [voucherSchema], default: [] },
    points:         { type: Number, default: 0, min: 0 },
    roles:          { type: [String], default: [] },
    lastLogin:      { type: Date },
    date:           { type: Date, default: Date.now },
  },
  { timestamps: true }
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ phone: 1 }, { unique: true, sparse: true });

const Users = mongoose.model("Users", userSchema);

module.exports = Users;