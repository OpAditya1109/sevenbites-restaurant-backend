const express = require("express");
const router = express.Router();
const verifyAdminKey = require("../middleware/verifyAdminKey");
const {
  getSettlementConfigAdmin,
  updateSettlementConfigAdmin,
  recordPayout,
  updatePayoutStatus,
  listPayoutsForRestaurant,
} = require("../controllers/adminSettlementController");

router.use(verifyAdminKey);

router.get("/config", getSettlementConfigAdmin);
router.put("/config", updateSettlementConfigAdmin);

router.post("/payouts", recordPayout);
router.patch("/payouts/:id", updatePayoutStatus);
router.get("/restaurants/:restaurantId/payouts", listPayoutsForRestaurant);

module.exports = router;