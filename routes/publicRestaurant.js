const express = require("express");

const RestaurantPartner = require("../models/RestaurantPartner");
const RestaurantTiming = require("../models/RestaurantTiming");
const Category = require("../models/Category");
const MenuItem = require("../models/MenuItem");

const router = express.Router();

// Shared projection so the Customer App never sees bank/document/auth fields
const PUBLIC_PROFILE_FIELDS =
  "restaurantName description cuisineType cuisine address city pincode logoUrl coverImageUrl " +
  "googleMapLink latitude longitude deliveryRadiusKm fssaiLicenseNumber gstNumber status createdAt " +
  "rating totalRatings deliveryTime deliveryFee minOrder tags";

// GET /api/public/restaurants — approved restaurants only, for the Customer App home/listing feed
router.get("/", async (req, res) => {
  try {
    const restaurants = await RestaurantPartner.find({ status: "approved" }).select(PUBLIC_PROFILE_FIELDS);
    return res.json({ success: true, restaurants });
  } catch (err) {
    console.error("Public restaurant list error:", err);
    return res.status(500).json({ success: false, message: "Something went wrong." });
  }
});

// GET /api/public/restaurants/:id — full profile only (lightweight, for a header/card)
router.get("/:id", async (req, res) => {
  try {
    const restaurant = await RestaurantPartner.findOne({ _id: req.params.id, status: "approved" }).select(
      PUBLIC_PROFILE_FIELDS
    );
    if (!restaurant) return res.status(404).json({ success: false, message: "Restaurant not found" });
    return res.json({ success: true, restaurant });
  } catch (err) {
    console.error("Public restaurant fetch error:", err);
    return res.status(500).json({ success: false, message: "Something went wrong." });
  }
});

// GET /api/public/restaurants/:id/full — the single call the Customer App needs to render
// the entire restaurant page: profile + live open/closed status + categories + menu, grouped.
router.get("/:id/full", async (req, res) => {
  try {
    const restaurant = await RestaurantPartner.findOne({ _id: req.params.id, status: "approved" }).select(
      PUBLIC_PROFILE_FIELDS
    );
    if (!restaurant) return res.status(404).json({ success: false, message: "Restaurant not found" });

    const [timing, categories, menuItems] = await Promise.all([
      RestaurantTiming.findOne({ restaurant: restaurant._id }),
      Category.find({ restaurant: restaurant._id, status: "active" }).sort({ order: 1 }),
      MenuItem.find({ restaurant: restaurant._id, isAvailable: true }).sort({ order: 1, createdAt: -1 }),
    ]);

    const menuByCategory = categories.map((cat) => ({
      category: { id: cat._id, name: cat.name, image: cat.image },
      items: menuItems.filter((item) => String(item.category) === String(cat._id)),
    }));

    const isOpenNow = computeIsOpenNow(timing);

    return res.json({
      success: true,
      restaurant,
      timing,
      isOpenNow,
      menu: menuByCategory,
    });
  } catch (err) {
    console.error("Public restaurant full fetch error:", err);
    return res.status(500).json({ success: false, message: "Something went wrong." });
  }
});

function computeIsOpenNow(timing) {
  if (!timing) return true;
  if (timing.isTemporarilyClosed) return false;

  const now = new Date();
  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const today = dayNames[now.getDay()];
  const todaySchedule = timing.weeklySchedule.find((d) => d.day === today);
  if (!todaySchedule || !todaySchedule.isOpen) return false;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [openH, openM] = todaySchedule.openTime.split(":").map(Number);
  const [closeH, closeM] = todaySchedule.closeTime.split(":").map(Number);
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  if (currentMinutes < openMinutes || currentMinutes > closeMinutes) return false;

  if (todaySchedule.breakStart && todaySchedule.breakEnd) {
    const [bsH, bsM] = todaySchedule.breakStart.split(":").map(Number);
    const [beH, beM] = todaySchedule.breakEnd.split(":").map(Number);
    const breakStartMinutes = bsH * 60 + bsM;
    const breakEndMinutes = beH * 60 + beM;
    if (currentMinutes >= breakStartMinutes && currentMinutes <= breakEndMinutes) return false;
  }

  return true;
}

module.exports = router;