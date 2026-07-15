const express = require("express");
const router = express.Router();
const verifyUserToken = require("../middleware/verifyUserToken");
const { registerPushToken } = require("../controllers/notificationController");

router.post("/register-token", verifyUserToken, registerPushToken);

module.exports = router;