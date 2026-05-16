const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema(
  {
    id:       { type: Number, required: true },
    name:     { type: String, required: true },
    image:    { type: String, default: "" },
    price:    { type: Number, required: true },
    quantity: { type: Number, required: true },
    size:     { type: String, required: false, default: "" },
  },
  { _id: false }
);

const locationPartSchema = new mongoose.Schema(
  {
    code: { type: String, default: "" },
    name: { type: String, default: "" },
  },
  { _id: false }
);

const deliveryInfoSchema = new mongoose.Schema(
  {
    firstName: {
      type: String, required: true, trim: true,
      validate: { validator: (v) => /^[A-Za-z\s'-]+$/.test(v), message: "First name can only contain letters, spaces, hyphens, and apostrophes" },
    },
    lastName: {
      type: String, required: true, trim: true,
      validate: { validator: (v) => /^[A-Za-z\s'-]+$/.test(v), message: "Last name can only contain letters, spaces, hyphens, and apostrophes" },
    },
    email: {
      type: String, required: true, trim: true, lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid email address with a domain"],
    },
    street:             { type: String, required: true, trim: true },
    phone: {
      type: String, required: true, trim: true,
      validate: { validator: (v) => /^\d{11}$/.test((v || "").replace(/\D/g, "")), message: "Phone number must be exactly 11 digits" },
    },
    region:             { type: locationPartSchema, required: true },
    province:           { type: locationPartSchema, required: false },
    cityOrMunicipality: { type: locationPartSchema, required: true },
    barangay:           { type: locationPartSchema, required: true },
  },
  { _id: false }
);

deliveryInfoSchema.pre("validate", function (next) {
  try {
    const info = this;
    if (!info.region || !info.region.code) return next(new Error("Region code is required"));
    if (!info.cityOrMunicipality || !info.cityOrMunicipality.code) return next(new Error("City/Municipality code is required"));
    if (!info.barangay || !info.barangay.code) return next(new Error("Barangay code is required"));
    const provinceLessRegionCodes = ["1300000000"];
    if (!provinceLessRegionCodes.includes(String(info.region.code))) {
      if (!info.province || !info.province.code) return next(new Error("Province code is required for the selected region"));
    }
    return next();
  } catch (err) { return next(err); }
});

const orderSchema = new mongoose.Schema(
  {
    userId:        { type: String, default: "" },
    items:         { type: [itemSchema], required: true },
    subtotal:        { type: Number, default: 0 },
    discountAmount:  { type: Number, default: 0 },
    discountPercent: { type: Number, default: 0 },
    total:           { type: Number, required: true, default: 0 },
    pointsUsed:      { type: Number, default: 0 },
    pointsDiscount:  { type: Number, default: 0 },

    // ── Shipping ──────────────────────────────────────────────────────────────
    shippingFee:       { type: Number, default: 0 },
    shippingTierLabel: { type: String, default: null },
    codFee:            { type: Number, default: 0 },

    // ── Voucher ───────────────────────────────────────────────────────────────
    voucherCode:  { type: String, default: null },
    voucherTitle: { type: String, default: null },

    deliveryInfo:  { type: deliveryInfoSchema, required: true },
    paymentMethod: { type: String, required: true },
    orderNumber:   { type: String, required: true, unique: true, index: true },

    status: {
      type: String,
      default: "pending",
      enum: [
        "pending",
        "confirmed",
        "processing",
        "shipping",
        "shipped",
        "delivered",        // ← admin marks as delivered; customer must confirm
        "completed",        // ← customer confirmed receipt (or auto after 3 days)
        "cancelled",
        "refund_requested",
        "refunded",
      ],
    },

    // ── Status timestamps ─────────────────────────────────────────────────────
    deliveredAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },

    // ── Rider details ─────────────────────────────────────────────────────────
    rider: {
      name:  { type: String, default: null },
      plate: { type: String, default: null },
      phone: { type: String, default: null },
    },

    processedBy: {
      email: { type: String, default: null },
      name:  { type: String, default: null },
    },

    // ── Refund flat fields (reliable — always persisted regardless of subdoc) ──
    // These are the source of truth. The refundRequest subdoc is kept for
    // backwards compatibility only but is NOT relied on for reads.
    refundReason:      { type: String, default: null },
    refundNotes:       { type: String, default: null },
    refundMedia:       { type: Array,  default: [] },      // Cloudinary media objects [{url, type, originalName, size}]
    refundStatus:      { type: String, default: null },    // pending | approved | rejected | refunded
    refundAdminNote:   { type: String, default: null },
    refundSubmittedAt: { type: Date,   default: null },
    refundResolvedAt:  { type: Date,   default: null },
    refundResolvedBy:  { type: String, default: null },

    returns: { type: mongoose.Schema.Types.Mixed, default: [] },
  },
  {
    timestamps: { createdAt: "timestamp", updatedAt: "updatedAt" },
  }
);

const Orders = mongoose.model("Orders", orderSchema);
module.exports = Orders;