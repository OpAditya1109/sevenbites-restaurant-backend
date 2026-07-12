const express = require("express");
const router = express.Router();
const {
  getRestaurantOrders,
  getRestaurantOrderById,
  respondToOrder,
  updateRestaurantOrderStatus,
} = require("../controllers/restaurantOrderController");
const verifyRestaurantToken = require("../middleware/verifyRestaurantToken");

router.use(verifyRestaurantToken);

router.get("/", getRestaurantOrders);
router.get("/:id", getRestaurantOrderById);
router.patch("/:id/respond", respondToOrder);
router.patch("/:id/status", updateRestaurantOrderStatus);

module.exports = router;