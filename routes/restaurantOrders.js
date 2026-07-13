const express = require("express");
const router = express.Router();
const {
  getRestaurantOrders,
  getRestaurantOrderById,
  respondToOrder,
  updateRestaurantOrderStatus,
} = require("../controllers/restaurantOrderController");
const { getRestaurantAnalytics } = require("../controllers/restaurantAnalyticsController");
const verifyRestaurantToken = require("../middleware/verifyRestaurantToken");

router.use(verifyRestaurantToken);

// IMPORTANT: /analytics must come before /:id, or Express matches "analytics"
// as an :id param and this route never gets hit.
router.get("/analytics", getRestaurantAnalytics);

router.get("/", getRestaurantOrders);
router.get("/:id", getRestaurantOrderById);
router.patch("/:id/respond", respondToOrder);
router.patch("/:id/status", updateRestaurantOrderStatus);

module.exports = router;