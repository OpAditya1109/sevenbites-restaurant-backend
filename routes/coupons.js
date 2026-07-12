const express = require("express");
const router = express.Router();
const { getActiveCoupons, applyCoupon } = require("../controllers/couponController");
const verifyUserToken = require("../middleware/verifyUserToken");

router.use(verifyUserToken);
router.get("/", getActiveCoupons);
router.post("/apply", applyCoupon);

module.exports = router;