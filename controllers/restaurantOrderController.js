const Order = require("../models/Order");
const RestaurantSettlementConfig = require("../models/RestaurantSettlementConfig");
const { computeSettlement } = require("../utils/settlementCalculator");
const { getIO } = require("../utils/socket");

// Statuses the restaurant is allowed to move an order INTO, keyed by its CURRENT status.
// Mirrors the linear kitchen-flow used by every food-delivery dashboard (Zomato/Swiggy included):
// placed -> confirmed -> preparing -> ready -> out_for_delivery -> delivered
const ALLOWED_TRANSITIONS = {
  placed: ["confirmed", "rejected"],
  confirmed: ["preparing"],
  preparing: ["ready"],
  ready: ["out_for_delivery"],
  out_for_delivery: ["delivered"],
};

const STATUS_TIMESTAMP_FIELD = {
  confirmed: "confirmedAt",
  preparing: "preparingAt",
  ready: "readyAt",
  out_for_delivery: "outForDeliveryAt",
  delivered: "deliveredAt",
};

// Ensures exactly one settlement config doc exists — same pattern as
// pricingController.js's getOrCreateActiveConfig().
async function getOrCreateActiveSettlementConfig() {
  let config = await RestaurantSettlementConfig.findOne({ key: "default" });
  if (!config) {
    config = await RestaurantSettlementConfig.create({ key: "default" });
  }
  return config;
}

// Pushes the update to the customer's app instantly — both a per-user room (order list/home
// screen) and a per-order room (the live tracking screen if they're on it)
function notifyCustomer(order) {
  try {
    const io = getIO();
    io.to(`user_${order.userId}`).emit("order_status_updated", order);
    io.to(`order_${order._id}`).emit("order_status_updated", order);
  } catch (e) {
    console.error("Socket emit failed:", e.message);
  }
}

// GET /api/setup/orders?status=placed  (comma-separated statuses supported, e.g. "confirmed,preparing")
exports.getRestaurantOrders = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = { restaurantId: req.restaurantId };

    if (status) {
      const statuses = status.split(",").map((s) => s.trim()).filter(Boolean);
      filter.status = { $in: statuses };
    }

    const orders = await Order.find(filter).sort({ createdAt: -1 }).populate("userId", "name phone");
    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/setup/orders/:id
exports.getRestaurantOrderById = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, restaurantId: req.restaurantId }).populate(
      "userId",
      "name phone"
    );
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /api/setup/orders/:id/respond   body: { action: "accept" | "reject", reason? }
exports.respondToOrder = async (req, res) => {
  try {
    const { action, reason } = req.body;
    if (!["accept", "reject"].includes(action)) {
      return res.status(400).json({ success: false, message: "action must be 'accept' or 'reject'" });
    }

    const order = await Order.findOne({ _id: req.params.id, restaurantId: req.restaurantId });
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    if (order.status !== "placed") {
      return res.status(400).json({ success: false, message: `Order already ${order.status}, cannot respond again` });
    }

    if (action === "accept") {
      order.status = "confirmed";
      order.confirmedAt = new Date();
    } else {
      order.status = "rejected";
      order.rejectionReason = reason || "Rejected by restaurant";
      order.cancelledAt = new Date();
    }

    await order.save();
    notifyCustomer(order);
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /api/setup/orders/:id/status   body: { status }
exports.updateRestaurantOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findOne({ _id: req.params.id, restaurantId: req.restaurantId });
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    const allowedNext = ALLOWED_TRANSITIONS[order.status] || [];
    if (!allowedNext.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot move order from '${order.status}' to '${status}'. Allowed: ${allowedNext.join(", ") || "none"}`,
      });
    }

    order.status = status;
    const tsField = STATUS_TIMESTAMP_FIELD[status];
    if (tsField) order[tsField] = new Date();

    // NEW — compute + store restaurant settlement figures only once the order
    // is actually delivered. Cancelled/rejected orders never reach this branch,
    // so they never count toward commission.
    if (status === "delivered") {
      const config = await getOrCreateActiveSettlementConfig();
      const settlement = computeSettlement(
        { itemTotal: order.itemTotal, totalAmount: order.totalAmount, paymentMethod: order.paymentMethod },
        config
      );
      order.commissionAmount = settlement.commissionAmount;
      order.fulfilmentFee = settlement.fulfilmentFee;
      order.paymentGatewayCharge = settlement.paymentGatewayCharge;
      order.netSettlement = settlement.netSettlement;
      order.settlementComputedAt = new Date();
    }

    await order.save();
    notifyCustomer(order);
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};