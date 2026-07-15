const crypto = require("crypto");
const Razorpay = require("razorpay");
const Order = require("../models/Order");
const RestaurantPartner = require("../models/RestaurantPartner");
const Coupon = require("../models/Coupon");
const PricingConfig = require("../models/PricingConfig");
const { computeCharges } = require("../utils/pricingCalculator");
const { haversineDistanceKm } = require("../utils/geo");
const { getIO } = require("../utils/socket");
const { notifyCustomerOfOrder } = require("../utils/customerOrderNotify");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

function notifyRestaurantOfNewOrder(order) {
  try {
    getIO().to(`restaurant_${order.restaurantId}`).emit("new_order", order);
  } catch (e) {
    console.error("Socket emit failed:", e.message);
  }
}

async function getActivePricingConfig() {
  let config = await PricingConfig.findOne({ key: "default" });
  if (!config) config = await PricingConfig.create({ key: "default" });
  return config;
}

// Recomputes deliveryFee/platformFee/gst/totalAmount from PricingConfig — never
// trusts the client-sent fee numbers. itemTotal and discountAmount are still
// taken from the client for now (menu-price integrity and coupon re-validation
// at order time are separate concerns, out of scope for this change).
async function recomputeOrderCharges({ restaurant, itemTotal, discountAmount, deliveryLatitude, deliveryLongitude }) {
  const config = await getActivePricingConfig();

  let distanceKm = null;
  if (
    restaurant?.latitude != null &&
    restaurant?.longitude != null &&
    deliveryLatitude != null &&
    deliveryLongitude != null
  ) {
    distanceKm = haversineDistanceKm(restaurant.latitude, restaurant.longitude, deliveryLatitude, deliveryLongitude);
  }

  const charges = computeCharges({ orderValue: itemTotal, distanceKm }, config);
  const safeDiscount = Math.max(0, Number(discountAmount) || 0);
  const totalAmount = Math.max(0, charges.total - safeDiscount);

  return {
    deliveryFee: charges.deliveryFee,
    platformFee: charges.platformFee,
    gst: charges.gst,
    gstRatePercent: charges.gstRatePercent,
    distanceKm: charges.distanceKm,
    totalAmount,
  };
}

exports.createRazorpayOrder = async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: "A valid amount is required" });
    }

    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(Number(amount) * 100),
      currency: "INR",
      receipt: `sb_rcpt_${Date.now()}`,
    });

    res.json({
      success: true,
      data: {
        orderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || "Could not create Razorpay order" });
  }
};

exports.verifyPaymentAndPlaceOrder = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderData } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: "Missing payment verification details" });
    }

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: "Payment verification failed" });
    }

    const {
      restaurantId, items, itemTotal, couponCode, discountAmount, paymentMethod,
      deliveryAddress, estimatedDeliveryTime, deliveryLatitude, deliveryLongitude,
    } = orderData || {};

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: "Order must have at least one item" });
    }
    if (!deliveryAddress) {
      return res.status(400).json({ success: false, message: "Delivery address is required" });
    }

    let restaurant = null;
    let restaurantName = "";
    if (restaurantId) {
      restaurant = await RestaurantPartner.findById(restaurantId);
      restaurantName = restaurant?.restaurantName || "";
    }

    // Server is now the source of truth for these — client-sent fee/total values are ignored.
    const charges = await recomputeOrderCharges({
      restaurant,
      itemTotal: itemTotal || 0,
      discountAmount,
      deliveryLatitude,
      deliveryLongitude,
    });

    const order = await Order.create({
      userId: req.user._id,
      restaurantId,
      restaurantName,
      items,
      totalAmount: charges.totalAmount,
      itemTotal: itemTotal || 0,
      deliveryFee: charges.deliveryFee,
      platformFee: charges.platformFee,
      gst: charges.gst,
      gstRatePercent: charges.gstRatePercent,
      distanceKm: charges.distanceKm,
      couponCode: couponCode || "",
      discountAmount: Math.max(0, Number(discountAmount) || 0),
      paymentMethod: paymentMethod || "upi",
      paymentStatus: "paid",
      deliveryAddress,
      restaurantLatitude: restaurant?.latitude ?? null,
      restaurantLongitude: restaurant?.longitude ?? null,
      deliveryLatitude: deliveryLatitude ?? null,
      deliveryLongitude: deliveryLongitude ?? null,
      ...(estimatedDeliveryTime ? { estimatedDeliveryTime } : {}),
      status: "placed",
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
    });

    if (couponCode) {
      Coupon.updateOne({ code: couponCode }, { $inc: { timesUsed: 1 } }).catch(() => {});
    }

    notifyRestaurantOfNewOrder(order);
    notifyCustomerOfOrder(order); // NEW — customer gets the "Order Placed" notification immediately

    res.status(201).json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.placeOrder = async (req, res) => {
  try {
    const {
      restaurantId, items, itemTotal, couponCode, discountAmount, paymentMethod,
      deliveryAddress, estimatedDeliveryTime, deliveryLatitude, deliveryLongitude,
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: "Order must have at least one item" });
    }
    if (!deliveryAddress) {
      return res.status(400).json({ success: false, message: "Delivery address is required" });
    }

    let restaurant = null;
    let restaurantName = "";
    if (restaurantId) {
      restaurant = await RestaurantPartner.findById(restaurantId);
      restaurantName = restaurant?.restaurantName || "";
    }

    const charges = await recomputeOrderCharges({
      restaurant,
      itemTotal: itemTotal || 0,
      discountAmount,
      deliveryLatitude,
      deliveryLongitude,
    });

    const order = await Order.create({
      userId: req.user._id,
      restaurantId,
      restaurantName,
      items,
      totalAmount: charges.totalAmount,
      itemTotal: itemTotal || 0,
      deliveryFee: charges.deliveryFee,
      platformFee: charges.platformFee,
      gst: charges.gst,
      gstRatePercent: charges.gstRatePercent,
      distanceKm: charges.distanceKm,
      couponCode: couponCode || "",
      discountAmount: Math.max(0, Number(discountAmount) || 0),
      paymentMethod: paymentMethod || "cod",
      paymentStatus: paymentMethod === "cod" ? "pending" : "paid",
      deliveryAddress,
      restaurantLatitude: restaurant?.latitude ?? null,
      restaurantLongitude: restaurant?.longitude ?? null,
      deliveryLatitude: deliveryLatitude ?? null,
      deliveryLongitude: deliveryLongitude ?? null,
      ...(estimatedDeliveryTime ? { estimatedDeliveryTime } : {}),
      status: "placed",
    });

    if (couponCode) {
      Coupon.updateOne({ code: couponCode }, { $inc: { timesUsed: 1 } }).catch(() => {});
    }

    notifyRestaurantOfNewOrder(order);
    notifyCustomerOfOrder(order); // NEW — customer gets the "Order Placed" notification immediately

    res.status(201).json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getUserOrders = async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .populate("restaurantId", "restaurantName logoUrl");
    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, userId: req.user._id }).populate(
      "restaurantId",
      "restaurantName logoUrl address latitude longitude"
    );
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateRiderLocation = async (req, res) => {
  try {
    const { latitude, longitude, riderName } = req.body;
    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return res.status(400).json({ success: false, message: "latitude and longitude (numbers) are required" });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    order.riderLatitude = latitude;
    order.riderLongitude = longitude;
    order.riderLocationUpdatedAt = new Date();
    if (riderName) order.riderName = riderName;
    await order.save();

    getIO().to(`order_${order._id}`).emit("order_location_updated", {
      _id: order._id,
      riderLatitude: order.riderLatitude,
      riderLongitude: order.riderLongitude,
      riderName: order.riderName,
      riderLocationUpdatedAt: order.riderLocationUpdatedAt,
    });

    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.cancelOrder = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, userId: req.user._id });
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    if (["delivered", "cancelled", "rejected", "out_for_delivery"].includes(order.status)) {
      return res.status(400).json({ success: false, message: `Cannot cancel order with status: ${order.status}` });
    }
    order.status = "cancelled";
    order.cancelledAt = new Date();
    order.cancelReason = req.body.reason || "Cancelled by user";
    await order.save();
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ["placed", "confirmed", "preparing", "ready", "out_for_delivery", "delivered", "cancelled", "rejected"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }
    const update = { status };
    if (status === "delivered") update.deliveredAt = new Date();
    const order = await Order.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};