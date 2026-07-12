const express = require("express");
const router = express.Router();
const { register, login, getProfile, updateProfile } = require("../controllers/authController");
const verifyUserToken = require("../middleware/verifyUserToken");

router.post("/register", register);
router.post("/login", login);
router.get("/profile", verifyUserToken, getProfile);
router.put("/profile", verifyUserToken, updateProfile);

module.exports = router;