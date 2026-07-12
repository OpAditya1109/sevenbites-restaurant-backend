const express = require("express");

const verifyRestaurantToken = require("../middleware/verifyRestaurantToken");
const RestaurantTiming = require("../models/RestaurantTiming");
const { DAYS } = require("../models/RestaurantTiming");

const router = express.Router();

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

function validateSchedule(weeklySchedule) {
  if (!Array.isArray(weeklySchedule)) return "weeklySchedule must be an array of 7 days";
  for (const entry of weeklySchedule) {
    if (!DAYS.includes(entry.day)) return `Invalid day: ${entry.day}`;
    if (entry.isOpen) {
      if (!TIME_REGEX.test(entry.openTime) || !TIME_REGEX.test(entry.closeTime)) {
        return `${entry.day}: opening/closing time must be in HH:mm format`;
      }
      if (entry.breakStart && !TIME_REGEX.test(entry.breakStart)) return `${entry.day}: invalid break start time`;
      if (entry.breakEnd && !TIME_REGEX.test(entry.breakEnd)) return `${entry.day}: invalid break end time`;
    }
  }
  return null;
}

// GET /api/setup/timings — fetch (or lazily create default) timing doc
router.get("/", verifyRestaurantToken, async (req, res) => {
  try {
    // findOneAndUpdate+upsert is atomic at the DB level, so two near-simultaneous
    // requests (e.g. React Strict Mode firing an effect twice in dev) can't both
    // pass a "does it exist?" check and then race to create duplicate docs.
    const timing = await RestaurantTiming.findOneAndUpdate(
      { restaurant: req.restaurantId },
      { $setOnInsert: { restaurant: req.restaurantId } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    return res.json({ success: true, timing });
  } catch (err) {
    console.error("Fetch timings error:", err);
    return res.status(500).json({ success: false, message: "Something went wrong." });
  }
});

// PUT /api/setup/timings — replace the full timing configuration
router.put("/", verifyRestaurantToken, async (req, res) => {
  try {
    const { weeklySchedule, deliveryHours, holidays, isTemporarilyClosed, temporaryCloseReason, temporaryCloseUntil } = req.body;

    if (weeklySchedule) {
      const error = validateSchedule(weeklySchedule);
      if (error) return res.status(400).json({ success: false, message: error });
    }
    if (deliveryHours && !deliveryHours.sameAsOpeningHours) {
      if (!TIME_REGEX.test(deliveryHours.openTime) || !TIME_REGEX.test(deliveryHours.closeTime)) {
        return res.status(400).json({ success: false, message: "Delivery hours must be in HH:mm format" });
      }
    }

    const update = {};
    if (weeklySchedule) update.weeklySchedule = weeklySchedule;
    if (deliveryHours) update.deliveryHours = deliveryHours;
    if (holidays) update.holidays = holidays;
    if (isTemporarilyClosed !== undefined) update.isTemporarilyClosed = isTemporarilyClosed;
    if (temporaryCloseReason !== undefined) update.temporaryCloseReason = temporaryCloseReason;
    if (temporaryCloseUntil !== undefined) update.temporaryCloseUntil = temporaryCloseUntil;

    const timing = await RestaurantTiming.findOneAndUpdate(
      { restaurant: req.restaurantId },
      { $set: update },
      { new: true, upsert: true, runValidators: true }
    );

    return res.json({ success: true, timing });
  } catch (err) {
    console.error("Update timings error:", err);
    return res.status(500).json({ success: false, message: "Something went wrong." });
  }
});

// PATCH /api/setup/timings/temporary-close — quick toggle used by the "Temporary Close" switch
router.patch("/temporary-close", verifyRestaurantToken, async (req, res) => {
  try {
    const { isTemporarilyClosed, temporaryCloseReason, temporaryCloseUntil } = req.body;
    const timing = await RestaurantTiming.findOneAndUpdate(
      { restaurant: req.restaurantId },
      {
        $set: {
          isTemporarilyClosed: !!isTemporarilyClosed,
          temporaryCloseReason: temporaryCloseReason || "",
          temporaryCloseUntil: temporaryCloseUntil || null,
        },
      },
      { new: true, upsert: true }
    );
    return res.json({ success: true, timing });
  } catch (err) {
    console.error("Toggle temporary close error:", err);
    return res.status(500).json({ success: false, message: "Something went wrong." });
  }
});

module.exports = router;