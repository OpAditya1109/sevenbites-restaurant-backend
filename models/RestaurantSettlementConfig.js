const mongoose = require("mongoose");

// Restaurant-side settlement config — mirrors PricingConfig.js's pattern, but
// drives what the RESTAURANT is charged (commission/fulfilment/PG), separate
// from what the CUSTOMER is charged (delivery fee/platform fee/GST in
// PricingConfig.js). Never mix the two.
const restaurantSettlementConfigSchema = new mongoose.Schema(
  {
    // Always exactly one config doc — enforced by this fixed key + unique index.
    key: { type: String, default: "default", unique: true },

    // Applied to itemTotal only (food value) — never to delivery/platform/GST.
    commissionPercent: { type: Number, default: 20 },

    // Flat, per completed (delivered) order.
    fulfilmentFee: { type: Number, default: 25 },

    // Applied to totalAmount, but only for online/prepaid orders (upi/card/wallet).
    // Always 0 for COD — see utils/settlementCalculator.js.
    paymentGatewayChargePercent: { type: Number, default: 2 },

    isActive: { type: Boolean, default: true },
    updatedBy: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("RestaurantSettlementConfig", restaurantSettlementConfigSchema);