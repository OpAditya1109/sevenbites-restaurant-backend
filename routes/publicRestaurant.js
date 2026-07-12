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

// GET /api/public/restaurants/:id/delivery-estimate?lat=&lng=
// Uses the restaurant's exact saved location vs the customer's exact drop pin
// (both lat/lng) to give a real distance-based ETA instead of a flat guess.
router.get("/:id/delivery-estimate", async (req, res) => {
  try {
    const { lat, lng } = req.query;
    const destLat = Number(lat);
    const destLng = Number(lng);

    const restaurant = await RestaurantPartner.findOne({ _id: req.params.id, status: "approved" }).select(
      "restaurantName latitude longitude deliveryTime"
    );
    if (!restaurant) return res.status(404).json({ success: false, message: "Restaurant not found" });

    // Prep time — how long the kitchen needs to get the order ready. Falls back
    // to a sensible default if the restaurant hasn't set exact prep timing.
    const prepMinutes = 15;

    if (
      !restaurant.latitude ||
      !restaurant.longitude ||
      Number.isNaN(destLat) ||
      Number.isNaN(destLng)
    ) {
      // No exact coordinates on one side — fall back to the restaurant's listed range.
      return res.json({
        success: true,
        data: {
          distanceKm: null,
          prepMinutes,
          travelMinutes: null,
          minMinutes: 30,
          maxMinutes: 45,
          etaText: restaurant.deliveryTime || "30-45 min",
        },
      });
    }

    const distanceKm = haversineDistanceKm(
      restaurant.latitude,
      restaurant.longitude,
      destLat,
      destLng
    );

    // Average city delivery-partner speed, incl. traffic/signals/parking.
    const AVG_SPEED_KMPH = 22;
    const travelMinutes = Math.max(5, Math.round((distanceKm / AVG_SPEED_KMPH) * 60));

    const minMinutes = prepMinutes + travelMinutes;
    const maxMinutes = minMinutes + 10; // buffer for kitchen/traffic variance

    return res.json({
      success: true,
      data: {
        distanceKm: Math.round(distanceKm * 10) / 10,
        prepMinutes,
        travelMinutes,
        minMinutes,
        maxMinutes,
        etaText: `${minMinutes}-${maxMinutes} min`,
      },
    });
  } catch (err) {
    console.error("Delivery estimate error:", err);
    return res.status(500).json({ success: false, message: "Something went wrong." });
  }
});

function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

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