const express = require("express");

const verifyRestaurantToken = require("../middleware/verifyRestaurantToken");
const { setupImageUpload } = require("../middleware/setupImageUpload");
const uploadBufferToCloudinary = require("../utils/uploadBufferToCloudinary");
const RestaurantPartner = require("../models/RestaurantPartner");

const router = express.Router();

const uploadFields = setupImageUpload.fields([
  { name: "logo", maxCount: 1 },
  { name: "coverImage", maxCount: 1 },
]);

// GET /api/setup/profile — everything the Restaurant Profile page needs
router.get("/", verifyRestaurantToken, async (req, res) => {
  try {
    const restaurant = await RestaurantPartner.findById(req.restaurantId);
    if (!restaurant) {
      return res.status(404).json({ success: false, message: "Restaurant not found" });
    }
    return res.json({ success: true, restaurant });
  } catch (err) {
    console.error("Fetch profile setup error:", err);
    return res.status(500).json({ success: false, message: "Something went wrong." });
  }
});

// PATCH /api/setup/profile — update editable profile fields, optionally replacing logo/cover
router.patch("/", verifyRestaurantToken, uploadFields, async (req, res) => {
  try {
    const {
      restaurantName,
      description,
      cuisineType,
      address,
      contactNumber,
      email,
      googleMapLink,
      latitude,
      longitude,
      deliveryRadiusKm,
      fssaiLicenseNumber,
      gstNumber,
    } = req.body;

    const restaurant = await RestaurantPartner.findById(req.restaurantId);
    if (!restaurant) {
      return res.status(404).json({ success: false, message: "Restaurant not found" });
    }

    const errors = {};
    if (restaurantName !== undefined && !restaurantName.trim()) errors.restaurantName = "Restaurant name cannot be empty";
    if (description !== undefined && description.length > 300) errors.description = "Description must be under 300 characters";
    if (deliveryRadiusKm !== undefined && (isNaN(deliveryRadiusKm) || deliveryRadiusKm < 0 || deliveryRadiusKm > 50)) {
      errors.deliveryRadiusKm = "Delivery radius must be between 0 and 50 km";
    }
    if (fssaiLicenseNumber !== undefined && !/^\d{14}$/.test(fssaiLicenseNumber)) {
      errors.fssaiLicenseNumber = "FSSAI number must be exactly 14 digits";
    }
    if (gstNumber && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstNumber.toUpperCase())) {
      errors.gstNumber = "Enter a valid 15-character GSTIN";
    }
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    const files = req.files || {};
    if (files.logo?.[0]) {
      const result = await uploadBufferToCloudinary(files.logo[0].buffer, "sevenbites/setup/logos");
      restaurant.logoUrl = result.secure_url;
    }
    if (files.coverImage?.[0]) {
      const result = await uploadBufferToCloudinary(files.coverImage[0].buffer, "sevenbites/setup/covers");
      restaurant.coverImageUrl = result.secure_url;
    }

    if (restaurantName !== undefined) restaurant.restaurantName = restaurantName.trim();
    if (description !== undefined) restaurant.description = description.trim();
    if (cuisineType !== undefined) restaurant.cuisineType = cuisineType.trim();
    if (address !== undefined) restaurant.address = address.trim();
    if (contactNumber !== undefined) restaurant.contactNumber = contactNumber.trim();
    if (email !== undefined) restaurant.email = email.trim().toLowerCase();
    if (googleMapLink !== undefined) restaurant.googleMapLink = googleMapLink.trim();
    if (latitude !== undefined) restaurant.latitude = latitude === "" ? null : Number(latitude);
    if (longitude !== undefined) restaurant.longitude = longitude === "" ? null : Number(longitude);
    if (deliveryRadiusKm !== undefined) restaurant.deliveryRadiusKm = Number(deliveryRadiusKm);
    if (fssaiLicenseNumber !== undefined) restaurant.fssaiLicenseNumber = fssaiLicenseNumber;
    if (gstNumber !== undefined) restaurant.gstNumber = gstNumber ? gstNumber.toUpperCase() : null;

    await restaurant.save();
    return res.json({ success: true, restaurant });
  } catch (err) {
    console.error("Update profile setup error:", err);
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: "Email or contact number already in use" });
    }
    return res.status(500).json({ success: false, message: "Something went wrong." });
  }
});

module.exports = router;