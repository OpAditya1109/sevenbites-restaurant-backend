const mongoose = require("mongoose");

const restaurantPayoutSchema = new mongoose.Schema(
  {
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: "RestaurantPartner", required: true, index: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    totalOrders: { type: Number, required: true, default: 0 },
    totalNetSettlement: { type: Number, required: true, default: 0 },
    payoutStatus: { type: String, enum: ["pending", "processed"], default: "pending" },
    payoutDate: { type: Date, default: null },
    transactionRef: { type: String, default: "" },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("RestaurantPayout", restaurantPayoutSchema);