const crypto = require("crypto");
const Razorpay = require("razorpay");
const Order = require("../models/Order");
const RestaurantPartner = require("../models/RestaurantPartner");
const Coupon = require("../models/Coupon");
const { getIO } = require("../utils/socket"); // NEW

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// NEW — pushes the freshly placed order straight into the restaurant dashboard's socket room
function notifyRestaurantOfNewOrder(order) {
  try {
    getIO().to(`restaurant_${order.restaurantId}`).emit("new_order", order);
  } catch (e) {
    // Socket isn't critical to order placement — never fail the request because of it
    console.error("Socket emit failed:", e.message);
  }
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
      restaurantId, items, totalAmount, itemTotal, deliveryFee, platformFee, gst,
      couponCode, discountAmount, paymentMethod, deliveryAddress, estimatedDeliveryTime,
      deliveryLatitude, deliveryLongitude, // NEW — from the customer's selected Address doc
    } = orderData || {};

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: "Order must have at least one item" });
    }
    if (!deliveryAddress) {
      return res.status(400).json({ success: false, message: "Delivery address is required" });
    }

    let restaurantName = "";
    let restaurantLatitude = null;
    let restaurantLongitude = null;
    if (restaurantId) {
      const restaurant = await RestaurantPartner.findById(restaurantId);
      restaurantName = restaurant?.restaurantName || "";
      restaurantLatitude = restaurant?.latitude ?? null;
      restaurantLongitude = restaurant?.longitude ?? null;
    }

    const order = await Order.create({
      userId: req.user._id,
      restaurantId,
      restaurantName,
      items,
      totalAmount,
      itemTotal: itemTotal || 0,
      deliveryFee: deliveryFee || 0,
      platformFee: platformFee || 0,
      gst: gst || 0,
      couponCode: couponCode || "",
      discountAmount: discountAmount || 0,
      paymentMethod: paymentMethod || "upi",
      paymentStatus: "paid",
      deliveryAddress,
      restaurantLatitude,
      restaurantLongitude,
      deliveryLatitude: deliveryLatitude ?? null,
      deliveryLongitude: deliveryLongitude ?? null,
      // Real distance-based ETA calculated on the Checkout screen via
      // /public/restaurants/:id/delivery-estimate — falls back to the model
      // default ("30-45 min") only if the client couldn't compute one.
      ...(estimatedDeliveryTime ? { estimatedDeliveryTime } : {}),
      status: "placed",
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
    });

    if (couponCode) {
      Coupon.updateOne({ code: couponCode }, { $inc: { timesUsed: 1 } }).catch(() => {});
    }

    notifyRestaurantOfNewOrder(order); // NEW

    res.status(201).json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.placeOrder = async (req, res) => {
  try {
    const {
      restaurantId, items, totalAmount, itemTotal, deliveryFee, platformFee, gst,
      couponCode, discountAmount, paymentMethod, deliveryAddress, estimatedDeliveryTime,
      deliveryLatitude, deliveryLongitude, // NEW — from the customer's selected Address doc
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: "Order must have at least one item" });
    }
    if (!deliveryAddress) {
      return res.status(400).json({ success: false, message: "Delivery address is required" });
    }

    let restaurantName = "";
    let restaurantLatitude = null;
    let restaurantLongitude = null;
    if (restaurantId) {
      const restaurant = await RestaurantPartner.findById(restaurantId);
      restaurantName = restaurant?.restaurantName || "";
      // Snapshot the restaurant's current coords onto the order — see model comment
      restaurantLatitude = restaurant?.latitude ?? null;
      restaurantLongitude = restaurant?.longitude ?? null;
    }

    const order = await Order.create({
      userId: req.user._id,
      restaurantId,
      restaurantName,
      items,
      totalAmount,
      itemTotal: itemTotal || 0,
      deliveryFee: deliveryFee || 0,
      platformFee: platformFee || 0,
      gst: gst || 0,
      couponCode: couponCode || "",
      discountAmount: discountAmount || 0,
      paymentMethod: paymentMethod || "cod",
      paymentStatus: paymentMethod === "cod" ? "pending" : "paid",
      deliveryAddress,
      restaurantLatitude,
      restaurantLongitude,
      deliveryLatitude: deliveryLatitude ?? null,
      deliveryLongitude: deliveryLongitude ?? null,
      ...(estimatedDeliveryTime ? { estimatedDeliveryTime } : {}),
      status: "placed",
    });

    if (couponCode) {
      Coupon.updateOne({ code: couponCode }, { $inc: { timesUsed: 1 } }).catch(() => {});
    }

    notifyRestaurantOfNewOrder(order); // NEW

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
    // latitude/longitude included as a fallback for orders placed before the
    // restaurantLatitude/restaurantLongitude snapshot fields existed
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

// NEW — hook for the delivery-partner app to push live GPS pings once it exists.
// TODO: once the delivery-partner backend/auth exists, protect this with a
// verifyDeliveryPartnerToken middleware (and check order.assignedRiderId === req.rider._id)
// instead of leaving it open — right now there is no rider auth to check against.
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

    // Same room the tracking screen already joins for order_status_updated
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

// Kept for back-compat / admin use. The restaurant dashboard now uses
// controllers/restaurantOrderController.js instead, which validates status transitions.
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