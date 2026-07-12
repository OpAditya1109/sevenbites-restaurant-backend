const crypto = require("crypto");
const Razorpay = require("razorpay");
const Order = require("../models/Order");
const RestaurantPartner = require("../models/RestaurantPartner");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Step 1 of online payment: frontend calls this to get a Razorpay order to
// open in the checkout widget. Nothing is saved to our DB yet.
exports.createRazorpayOrder = async (req, res) => {
  try {
    const { amount } = req.body; // amount in rupees (e.g. grandTotal from checkout)

    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: "A valid amount is required" });
    }

    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(Number(amount) * 100), // Razorpay expects paise
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

// Step 2 of online payment: frontend calls this after the Razorpay checkout
// succeeds, sending back the ids/signature it received. We verify the
// signature ourselves (never trust the client) and only THEN create the
// real Order in our DB, marked as paid.
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

    // Signature checks out — the payment is genuine. Now place the order.
    const { restaurantId, items, totalAmount, deliveryFee, paymentMethod, deliveryAddress } = orderData || {};

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: "Order must have at least one item" });
    }
    if (!deliveryAddress) {
      return res.status(400).json({ success: false, message: "Delivery address is required" });
    }

    let restaurantName = "";
    if (restaurantId) {
      const restaurant = await RestaurantPartner.findById(restaurantId);
      restaurantName = restaurant?.restaurantName || "";
    }

    const order = await Order.create({
      userId: req.user._id,
      restaurantId,
      restaurantName,
      items,
      totalAmount,
      deliveryFee: deliveryFee || 0,
      paymentMethod: paymentMethod || "upi",
      paymentStatus: "paid",
      deliveryAddress,
      status: "placed",
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
    });

    res.status(201).json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Used only for Cash on Delivery — no payment gateway involved.
exports.placeOrder = async (req, res) => {
  try {
    const { restaurantId, items, totalAmount, deliveryFee, paymentMethod, deliveryAddress } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: "Order must have at least one item" });
    }
    if (!deliveryAddress) {
      return res.status(400).json({ success: false, message: "Delivery address is required" });
    }

    let restaurantName = "";
    if (restaurantId) {
      const restaurant = await RestaurantPartner.findById(restaurantId);
      restaurantName = restaurant?.restaurantName || "";
    }

    const order = await Order.create({
      userId: req.user._id,
      restaurantId,
      restaurantName,
      items,
      totalAmount,
      deliveryFee: deliveryFee || 0,
      paymentMethod: paymentMethod || "cod",
      paymentStatus: paymentMethod === "cod" ? "pending" : "paid",
      deliveryAddress,
      status: "placed",
    });

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
      "restaurantName logoUrl address"
    );
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.cancelOrder = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, userId: req.user._id });
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    if (["delivered", "cancelled", "out_for_delivery"].includes(order.status)) {
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

// For restaurant dashboard / admin use later
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ["placed", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"];
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