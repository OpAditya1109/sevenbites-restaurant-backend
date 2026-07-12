const express = require("express");
const router = express.Router();
const { addReview, getReviewsByRestaurant } = require("../controllers/reviewController");
const verifyUserToken = require("../middleware/verifyUserToken");

router.post("/", verifyUserToken, addReview);
router.get("/:restaurantId", getReviewsByRestaurant);

module.exports = router;