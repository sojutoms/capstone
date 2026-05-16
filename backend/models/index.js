// models/index.js
const mongoose = require("mongoose");

// ─── OtpModel ─────────────────────────────────────────────────────────────────
const otpSchema = new mongoose.Schema({
  email:        { type: String, required: true },
  otp:          { type: Number, required: true },
  username:     { type: String, required: true },
  password:     { type: String, required: true },
  phone:        { type: String, default: "" },
  expiresAt:    { type: Date,   required: true },
  resendCount:  { type: Number, default: 0 },
  lastResendAt: { type: Date,   default: Date.now },
}, { timestamps: true });
const OtpModel = mongoose.model("OtpModel", otpSchema);

// ─── Review ───────────────────────────────────────────────────────────────────
// ─── Review ───────────────────────────────────────────────────────────────────
const reviewSchema = new mongoose.Schema({
  productId: { type: Number, required: true, index: true },
  userId:    { type: String, default: "" },           // no longer required
  userName:  { type: String, default: "Anonymous" },
  review:    { type: String, required: true },
  rating:    { type: Number, required: true, min: 1, max: 5 },
  title:     { type: String, default: "" },           // add
  fit:       { type: String, default: "" },           // add
  comfort:   { type: String, default: "" },           // add
  recommend: { type: String, default: "" },           // add
  date:      { type: Date,   default: Date.now },
});
const Review = mongoose.model("Review", reviewSchema);

// ─── SequenceCounter ──────────────────────────────────────────────────────────
const sequenceCounterSchema = new mongoose.Schema({
  name:            { type: String, required: true, unique: true },
  currentSequence: { type: Number, default: 0 },
});
const SequenceCounter = mongoose.model("SequenceCounter", sequenceCounterSchema);

// ─── ShoeSequence ─────────────────────────────────────────────────────────────
const shoeSequenceSchema = new mongoose.Schema(
  {
    // ── SKU identifiers ────────────────────────────────────────────────────────
    skuNumber:      { type: Number, default: 0, index: true },
    productItemId:  { type: Number, default: 0, index: true },
    sequenceNumber: { type: Number, required: true, unique: true, index: true },

    // ── Product reference ──────────────────────────────────────────────────────
    productId:    { type: Number, required: true, index: true },
    productName:  { type: String, required: true },
    productImage: { type: String, default: "" },
    productPrice: { type: Number, default: 0 },
    category:     { type: String, default: "" },
    brand:        { type: String, default: "" },
    size:         { type: String, required: true },

    // ── Status ─────────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ["available", "sold", "reserved"],
      default: "available",
      index: true,
    },

    // ── Timestamps ─────────────────────────────────────────────────────────────
    addedDate:     { type: Date,   default: Date.now },
    soldDate:      { type: Date,   default: null },
    soldToUserId:  { type: String, default: null },
    orderNumber:   { type: String, default: null },
    reservedUntil: { type: Date,   default: null },
    consignedBy: { type: String, default: null },
    soldBy: { type: String, default: null },
  },
  { timestamps: true }
);

shoeSequenceSchema.index({ productId: 1, size: 1 });
shoeSequenceSchema.index({ status: 1, productId: 1 });
shoeSequenceSchema.index({ skuNumber: 1, productItemId: 1 });

const ShoeSequence = mongoose.model("ShoeSequence", shoeSequenceSchema);

// ─── SavedAddress ─────────────────────────────────────────────────────────────
const locationPartSchema = new mongoose.Schema(
  { code: { type: String, default: "" }, name: { type: String, default: "" } },
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

const SavedAddressCollectionSchema = new mongoose.Schema(
  {
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    firstName: { type: String, required: true, trim: true },
    lastName:  { type: String, required: true, trim: true },
    email:     { type: String, default: "", trim: true },
    street:    { type: String, required: true, trim: true },
    phone:     { type: String, required: true, trim: true },
    region:             { type: locationPartSchema },
    province:           { type: locationPartSchema },
    cityOrMunicipality: { type: locationPartSchema },
    barangay:           { type: locationPartSchema },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);
const SavedAddress = mongoose.model("SavedAddress", SavedAddressCollectionSchema);

module.exports = { OtpModel, Review, SequenceCounter, ShoeSequence, SavedAddress };