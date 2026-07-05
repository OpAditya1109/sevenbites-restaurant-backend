const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const upload = require("../middleware/cloudinaryUpload");
const verifyRestaurantToken = require("../middleware/verifyRestaurantToken");
const uploadBufferToCloudinary = require("../utils/uploadBufferToCloudinary");
const RestaurantPartner = require("../models/RestaurantPartner");

const router = express.Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[6-9]\d{9}$/;
const PINCODE_REGEX = /^\d{6}$/;
const FSSAI_REGEX = /^\d{14}$/;
const BANK_ACC_REGEX = /^\d{9,18}$/;
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

const uploadFields = upload.fields([
  { name: "restaurantImages", maxCount: 5 },
  { name: "menuImages", maxCount: 10 },
  { name: "fssaiCertificate", maxCount: 1 },
  { name: "gstCertificate", maxCount: 1 },
  { name: "chequeOrPassbook", maxCount: 1 },
]);

router.post("/register", uploadFields, async (req, res) => {
  try {
    const {
      restaurantName, ownerName, contactNumber, email, address, city, pincode,
      cuisineType, description, fssaiLicenseNumber, bankAccountHolderName,
      bankAccountNumber, confirmAccountNumber, ifscCode, password,
    } = req.body;
    const ifsc = (ifscCode || "").toUpperCase();

    const errors = {};
    if (!restaurantName?.trim()) errors.restaurantName = "Restaurant name is required";
    if (!ownerName?.trim()) errors.ownerName = "Owner name is required";
    if (!PHONE_REGEX.test(contactNumber || "")) errors.contactNumber = "Enter a valid 10-digit number starting 6-9";
    if (!EMAIL_REGEX.test(email || "")) errors.email = "Enter a valid email address";
    if (!address?.trim()) errors.address = "Address is required";
    if (!city?.trim()) errors.city = "City is required";
    if (!PINCODE_REGEX.test(pincode || "")) errors.pincode = "Enter a valid 6-digit pincode";
    if (description && description.length > 300) errors.description = "Description must be under 300 characters";
    if (!FSSAI_REGEX.test(fssaiLicenseNumber || "")) errors.fssaiLicenseNumber = "FSSAI number must be exactly 14 digits";
    if (!bankAccountHolderName?.trim()) errors.bankAccountHolderName = "Account holder name is required";
    if (!BANK_ACC_REGEX.test(bankAccountNumber || "")) errors.bankAccountNumber = "Enter a valid account number (9-18 digits)";
    if (bankAccountNumber !== confirmAccountNumber) errors.confirmAccountNumber = "Account numbers do not match";
    if (!IFSC_REGEX.test(ifsc)) errors.ifscCode = "Enter a valid IFSC code";
    if (!password || password.length < 8) errors.password = "Password must be at least 8 characters";

    const files = req.files || {};
    const restaurantImages = files.restaurantImages || [];
    const menuImages = files.menuImages || [];
    const fssaiCertificate = files.fssaiCertificate?.[0];
    const gstCertificate = files.gstCertificate?.[0];
    const chequeOrPassbook = files.chequeOrPassbook?.[0];

    if (restaurantImages.length < 1 || restaurantImages.length > 5) errors.restaurantImages = "Upload 1 to 5 restaurant images";
    if (menuImages.length < 1 || menuImages.length > 10) errors.menuImages = "Upload 1 to 10 menu images";
    if (!fssaiCertificate) errors.fssaiCertificate = "FSSAI certificate (PDF) is required";
    if (!chequeOrPassbook) errors.chequeOrPassbook = "Cancelled cheque / passbook is required";

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    const existing = await RestaurantPartner.findOne({
      $or: [{ email: email.toLowerCase().trim() }, { contactNumber }],
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        errors: { email: "An account with this email or phone number already exists" },
      });
    }

    const [restaurantImageResults, menuImageResults, fssaiResult, gstResult, chequeResult] = await Promise.all([
      Promise.all(restaurantImages.map((f) => uploadBufferToCloudinary(f.buffer, "sevenbites/restaurants/images"))),
      Promise.all(menuImages.map((f) => uploadBufferToCloudinary(f.buffer, "sevenbites/restaurants/menu"))),
      uploadBufferToCloudinary(fssaiCertificate.buffer, "sevenbites/restaurants/documents", "raw"),
      gstCertificate
        ? uploadBufferToCloudinary(gstCertificate.buffer, "sevenbites/restaurants/documents", "raw")
        : Promise.resolve(null),
      uploadBufferToCloudinary(
        chequeOrPassbook.buffer,
        "sevenbites/restaurants/documents",
        chequeOrPassbook.mimetype === "application/pdf" ? "raw" : "image"
      ),
    ]);

    const hashedPassword = await bcrypt.hash(password, 10);

    const restaurant = await RestaurantPartner.create({
      restaurantName: restaurantName.trim(),
      ownerName: ownerName.trim(),
      contactNumber,
      email: email.toLowerCase().trim(),
      address: address.trim(),
      city: city.trim(),
      pincode,
      cuisineType: cuisineType?.trim() || undefined,
      description: description?.trim() || undefined,
      restaurantImages: restaurantImageResults.map((r) => r.secure_url),
      menuImages: menuImageResults.map((r) => r.secure_url),
      fssaiCertificateUrl: fssaiResult.secure_url,
      fssaiLicenseNumber,
      gstCertificateUrl: gstResult ? gstResult.secure_url : undefined,
      bankAccountHolderName: bankAccountHolderName.trim(),
      bankAccountNumber,
      ifscCode: ifsc,
      chequeOrPassbookUrl: chequeResult.secure_url,
      password: hashedPassword,
      status: "pending",
    });

    const token = jwt.sign({ id: restaurant._id }, process.env.JWT_SECRET, { expiresIn: "30d" });
    const { password: _pw, ...restaurantData } = restaurant.toObject();

    return res.status(201).json({ success: true, token, restaurant: restaurantData });
  } catch (err) {
    console.error("Restaurant registration error:", err);
    return res.status(500).json({ success: false, message: "Something went wrong. Please try again." });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: "Email/phone and password are required" });
    }

    const restaurant = await RestaurantPartner.findOne({
      $or: [{ email: identifier.toLowerCase().trim() }, { contactNumber: identifier.trim() }],
    }).select("+password");

    if (!restaurant) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const match = await bcrypt.compare(password, restaurant.password);
    if (!match) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const token = jwt.sign({ id: restaurant._id }, process.env.JWT_SECRET, { expiresIn: "30d" });
    const { password: _pw, ...restaurantData } = restaurant.toObject();

    return res.json({ success: true, token, restaurant: restaurantData });
  } catch (err) {
    console.error("Restaurant login error:", err);
    return res.status(500).json({ success: false, message: "Something went wrong. Please try again." });
  }
});

router.get("/me", verifyRestaurantToken, async (req, res) => {
  try {
    const restaurant = await RestaurantPartner.findById(req.restaurantId);
    if (!restaurant) {
      return res.status(404).json({ success: false, message: "Restaurant not found" });
    }
    return res.json({ success: true, restaurant });
  } catch (err) {
    console.error("Fetch restaurant profile error:", err);
    return res.status(500).json({ success: false, message: "Something went wrong." });
  }
});

module.exports = router;
