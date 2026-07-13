const mongoose = require("mongoose");

const distanceBandSchema = new mongoose.Schema(
  {
    maxDistanceKm: { type: Number, required: true },
    fee: { type: Number, required: true },
  },
  { _id: false }
);

const pricingConfigSchema = new mongoose.Schema(
  {
    // Always exactly one config doc — enforced by this fixed key + unique index.
    key: { type: String, default: "default", unique: true },

    // Below this order value, delivery fee is banded by distance (see below).
    // At/above it, delivery is free within freeDeliveryRadiusKm.
    lowOrderValueThreshold: { type: Number, default: 99 },

    // Only used when orderValue < lowOrderValueThreshold.
    // Keep sorted by maxDistanceKm — the last band's fee also acts as the
    // fallback when distance can't be determined (e.g. no address pin yet).
    belowThresholdDistanceBands: {
      type: [distanceBandSchema],
      default: [
        { maxDistanceKm: 3, fee: 20 },
        { maxDistanceKm: 6, fee: 30 },
      ],
    },

    // Radius covered by "free delivery" once orderValue >= lowOrderValueThreshold.
    freeDeliveryRadiusKm: { type: Number, default: 6 },

    // Applies beyond freeDeliveryRadiusKm, regardless of order-value tier.
    perKmRateBeyondFreeRadius: { type: Number, default: 10 },

    // Flat, per order, regardless of order value or distance.
    platformFee: { type: Number, default: 8 },

    // GST is charged on (deliveryFee + platformFee) only — never on food value.
    gstRatePercent: { type: Number, default: 18 },
    gstAppliesTo: {
      type: String,
      enum: ["delivery_and_platform_fee"],
      default: "delivery_and_platform_fee",
    },

    isActive: { type: Boolean, default: true },
    updatedBy: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PricingConfig", pricingConfigSchema);