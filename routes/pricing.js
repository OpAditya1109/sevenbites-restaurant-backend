const express = require("express");
const router = express.Router();
const { getActivePricingConfig, calculateCharges } = require("../controllers/pricingController");

router.get("/active", getActivePricingConfig);
router.post("/calculate", calculateCharges);

module.exports = router;