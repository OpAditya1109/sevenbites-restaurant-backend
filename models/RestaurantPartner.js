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
  },
  { timestamps: true }
);

module.exports = mongoose.model("RestaurantPartner", restaurantPartnerSchema);
