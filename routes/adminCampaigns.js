const express = require("express");
const router = express.Router();
const verifyAdminKey = require("../middleware/verifyAdminKey");
const {
  createCampaign,
  listCampaigns,
  updateCampaign,
  sendCampaignNow,
  runDueCampaigns,
} = require("../controllers/campaignController");

router.use(verifyAdminKey);

router.post("/", createCampaign);
router.get("/", listCampaigns);
router.put("/:id", updateCampaign);
router.post("/:id/send-now", sendCampaignNow);
router.post("/run-due", runDueCampaigns);

module.exports = router;