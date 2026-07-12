const express = require("express");
const router = express.Router();
const { getUserAddresses, addAddress, deleteAddress, setDefaultAddress } = require("../controllers/addressController");
const verifyUserToken = require("../middleware/verifyUserToken");

router.use(verifyUserToken);
router.get("/", getUserAddresses);
router.post("/", addAddress);
router.delete("/:id", deleteAddress);
router.put("/:id/default", setDefaultAddress);

module.exports = router;