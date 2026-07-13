const mongoose = require("mongoose");

// Snapshot of a selected variant/add-on at order time — prices don't change retroactively if restaurant edits menu later
const orderItemSchema = new mongoose.Schema(
  {
    menuItemId: { type: mongoose.Schema.Types.ObjectId, ref: "MenuItem" },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    selectedVariants: [
      {
        groupName: String,
        optionLabel: String,
        priceDelta: Number,
      },
    ],
    selectedAddOns: [
      {
        name: String,
        price: Number,
      },
    ],
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: "RestaurantPartner", required: true, index: true },
    restaurantName: { type: String, default: "" },
    items: [orderItemSchema],
    totalAmount: { type: Number, required: true },
    itemTotal: { type: Number, default: 0 },
    deliveryFee: { type: Number, default: 0 },
    platformFee: { type: Number, default: 0 },
    gst: { type: Number, default: 0 },
    couponCode: { type: String, default: "" },
    discountAmount: { type: Number, default: 0 },
    // NEW — snapshot of what drove the fee calc, for auditing/support
    distanceKm: { type: Number, default: null },
    gstRatePercent: { type: Number, default: null },
    paymentMethod: { type: String, enum: ["upi", "card", "cod", "wallet"], default: "cod" },
    paymentStatus: { type: String, enum: ["pending", "paid", "failed"], default: "pending" },
    razorpayOrderId: { type: String, default: "" },
    razorpayPaymentId: { type: String, default: "" },
    razorpaySignature: { type: String, default: "" },
    deliveryAddress: { type: String, required: true },
    // NEW — coordinates needed to render a real map on the tracking screen.
    // Restaurant coords are snapshotted at order-creation time (so the pin stays
    // correct even if the restaurant edits its profile address later).
    restaurantLatitude: { type: Number, default: null },
    restaurantLongitude: { type: Number, default: null },
    deliveryLatitude: { type: Number, default: null },
    deliveryLongitude: { type: Number, default: null },
    // NEW — live rider position, written by the delivery-partner app once it exists.
    // Null until the rider's app starts sending GPS pings after pickup.
    riderLatitude: { type: Number, default: null },
    riderLongitude: { type: Number, default: null },
    riderName: { type: String, default: "" },
    riderLocationUpdatedAt: { type: Date, default: null },
    status: {
      type: String,
      // NEW — "ready" (packed, waiting for pickup) and "rejected" (restaurant declined)
      enum: ["placed", "confirmed", "preparing", "ready", "out_for_delivery", "delivered", "cancelled", "rejected"],
      default: "placed",
    },
    estimatedDeliveryTime: { type: String, default: "30-45 min" },
    // NEW — timeline stamps for the dashboard + customer order-tracking screen
    confirmedAt: { type: Date },
    preparingAt: { type: Date },
    readyAt: { type: Date },
    outForDeliveryAt: { type: Date },
    deliveredAt: { type: Date },
    cancelledAt: { type: Date },
    cancelReason: { type: String, default: "" },
    rejectionReason: { type: String, default: "" }, // NEW
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);