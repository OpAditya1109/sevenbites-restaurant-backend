const mongoose = require("mongoose");

const restaurantPartnerSchema = new mongoose.Schema(
  {
    restaurantName: { type: String, required: true, trim: true },
    ownerName: { type: String, required: true, trim: true },
    contactNumber: { type: String, required: true, unique: true, match: /^[6-9]\d{9}$/ },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    address: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, match: /^\d{6}$/ },
    cuisineType: { type: String, trim: true },
    description: { type: String, maxlength: 300 },

    restaurantImages: [{ type: String, required: true }],
    menuImages: [{ type: String, required: true }],

    fssaiCertificateUrl: { type: String, required: true },
    fssaiLicenseNumber: { type: String, required: true, match: /^\d{14}$/ },
    gstCertificateUrl: { type: String },

    bankAccountHolderName: { type: String, required: true, trim: true },
    bankAccountNumber: { type: String, required: true, match: /^\d{9,18}$/ },
    ifscCode: { type: String, required: true, match: /^[A-Z]{4}0[A-Z0-9]{6}$/ },
    chequeOrPassbookUrl: { type: String, required: true },

    password: { type: String, required: true, select: false },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    // ---- Restaurant Setup Module fields (Restaurant Profile page) ----
    // These power the restaurant "hero" card/listing in the Customer App directly.
    logoUrl: { type: String, default: null },
    coverImageUrl: { type: String, default: null },
    googleMapLink: { type: String, trim: true, default: null },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    deliveryRadiusKm: { type: Number, min: 0, max: 50, default: 5 },
    gstNumber: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
      validate: {
        validator: (v) => !v || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(v),
        message: "Enter a valid 15-character GSTIN",
      },
    },
       cuisine: [{ type: String, trim: true }], // e.g. ["North Indian", "Mughlai"] — shown as tags on the app
    rating: { type: Number, default: 4.0, min: 0, max: 5 }, // auto-updated by Review post-save hook
    totalRatings: { type: Number, default: 0 },
    deliveryTime: { type: String, default: "30-45 min" },
    deliveryFee: { type: Number, default: 0 },
    minOrder: { type: Number, default: 0 },
    tags: [String],
  },
  { timestamps: true }
);

module.exports = mongoose.model("RestaurantPartner", restaurantPartnerSchema);