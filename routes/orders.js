const express = require("express");
const router = express.Router();
const {
  placeOrder,
  getUserOrders,
  getOrderById,
  cancelOrder,
  updateOrderStatus,
  createRazorpayOrder,
  verifyPaymentAndPlaceOrder,
} = require("../controllers/orderController");
const verifyUserToken = require("../middleware/verifyUserToken");

// Razorpay flow (upi / card / wallet): create order -> pay in app -> verify -> order saved
router.post("/create-razorpay-order", verifyUserToken, createRazorpayOrder);
router.post("/verify-payment", verifyUserToken, verifyPaymentAndPlaceOrder);

// Cash on Delivery — straight to order creation, no payment gateway
router.post("/", verifyUserToken, placeOrder);
router.get("/my-orders", verifyUserToken, getUserOrders);
router.get("/:id", verifyUserToken, getOrderById);
router.put("/:id/cancel", verifyUserToken, cancelOrder);
router.put("/:id/status", updateOrderStatus); // TODO: protect with restaurant-partner auth once dashboard order view is built

module.exports = router;