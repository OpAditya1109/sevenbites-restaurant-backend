const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, uppercase: true, trim: true, unique: true },
    description: { type: String, trim: true, default: "" },

    // "percentage" -> discountValue is a %, capped by maxDiscount
    // "flat"       -> discountValue is a flat ₹ amount off
    discountType: { type: String, enum: ["percentage", "flat"], required: true },
    discountValue: { type: Number, required: true, min: 0 },
    maxDiscount: { type: Number, default: null }, // cap for percentage coupons, null = no cap

    minOrderValue: { type: Number, default: 0 }, // item total must be >= this

    // Empty array = valid on every restaurant. Otherwise restricted to these restaurants.
    applicableRestaurants: [{ type: mongoose.Schema.Types.ObjectId, ref: "RestaurantPartner" }],

    validFrom: { type: Date, default: Date.now },
    validUntil: { type: Date, required: true },

    usageLimitPerUser: { type: Number, default: 1 }, // how many times one user can redeem this code
    totalUsageLimit: { type: Number, default: null }, // overall cap across all users, null = unlimited
    timesUsed: { type: Number, default: 0 },

    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false }, // surfaced first in "View all coupons"
  },
  { timestamps: true }
);

couponSchema.methods.isCurrentlyValid = function () {
  const now = new Date();
  return this.isActive && this.validFrom <= now && this.validUntil >= now;
};

// Computes the discount amount for a given cart total. Returns 0 if not eligible.
couponSchema.methods.computeDiscount = function (itemTotal) {
  if (itemTotal < this.minOrderValue) return 0;
  if (this.discountType === "flat") {
    return Math.min(this.discountValue, itemTotal);
  }
  const raw = (itemTotal * this.discountValue) / 100;
  return this.maxDiscount ? Math.min(raw, this.maxDiscount) : raw;
};

module.exports = mongoose.model("Coupon", couponSchema);