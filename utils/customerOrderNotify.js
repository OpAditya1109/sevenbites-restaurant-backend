const { getIO } = require("./socket");
const PushToken = require("../models/PushToken");
const { sendExpoPushAsync } = require("./expoPush");

// Copy shown in the push notification banner (and used by the client to
// rebuild the Notifee tracking card when the push arrives in the background).
const ORDER_PUSH_COPY = {
  placed: { title: "Order Placed", body: "We've received your order." },
  confirmed: { title: "Order Confirmed", body: "The restaurant has accepted your order." },
  preparing: { title: "Being Prepared", body: "Your food is being cooked." },
  ready: { title: "Packed & Ready", body: "Your order is packed and waiting for pickup." },
  out_for_delivery: { title: "Out for Delivery", body: "Your order is on the way!" },
  delivered: { title: "Delivered", body: "Enjoy your meal!" },
  cancelled: { title: "Order Cancelled", body: "Your order was cancelled." },
  rejected: { title: "Order Rejected", body: "The restaurant couldn't accept your order." },
};

// Pushes the update to the customer's app instantly via socket (foreground).
function notifyCustomer(order) {
  try {
    const io = getIO();
    io.to(`user_${order.userId}`).emit("order_status_updated", order);
    io.to(`order_${order._id}`).emit("order_status_updated", order);
  } catch (e) {
    console.error("Socket emit failed:", e.message);
  }
}

// Pushes the same update via Expo Push so the order-tracking notification
// shows even if the app is backgrounded or fully closed.
async function pushOrderUpdateToCustomer(order) {
  try {
    const copy = ORDER_PUSH_COPY[order.status];
    if (!copy) return;

    const tokens = await PushToken.find({ userId: order.userId }).distinct("expoPushToken");
    if (tokens.length === 0) return;

    await sendExpoPushAsync(tokens, {
      title: `${order.restaurantName || "SevenBites"} — ${copy.title}`,
      body: copy.body,
      data: {
        type: "order_status",
        orderId: String(order._id),
        status: order.status,
        restaurantName: order.restaurantName,
        estimatedDeliveryTime: order.estimatedDeliveryTime,
        deliveryAddress: order.deliveryAddress,
      },
    });
  } catch (e) {
    console.error("Push send failed:", e.message);
  }
}

// Convenience wrapper — call this one function anywhere an order is created
// or its status changes.
function notifyCustomerOfOrder(order) {
  notifyCustomer(order);
  pushOrderUpdateToCustomer(order); // fire and forget
}

module.exports = { notifyCustomer, pushOrderUpdateToCustomer, notifyCustomerOfOrder };