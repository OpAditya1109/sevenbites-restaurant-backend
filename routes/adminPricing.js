const express = require("express");
const router = express.Router();
const verifyAdminKey = require("../middleware/verifyAdminKey");
const { getPricingConfigAdmin, updatePricingConfigAdmin } = require("../controllers/pricingController");

router.use(verifyAdminKey);
router.get("/", getPricingConfigAdmin);
router.put("/", updatePricingConfigAdmin);

module.exports = router;