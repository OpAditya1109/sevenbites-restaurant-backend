const mongoose = require("mongoose");

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

// One day's schedule, e.g. { day: "monday", isOpen: true, openTime: "10:00", closeTime: "23:00" }
const daySchema = new mongoose.Schema(
  {
    day: { type: String, enum: DAYS, required: true },
    isOpen: { type: Boolean, default: true },
    openTime: { type: String, default: "10:00" }, // 24h "HH:mm"
    closeTime: { type: String, default: "23:00" },
    breakStart: { type: String, default: null }, // e.g. lunch break "15:00"
    breakEnd: { type: String, default: null },
  },
  { _id: false }
);

const holidaySchema = new mongoose.Schema(
  {
    date: { type: String, required: true }, // "YYYY-MM-DD"
    reason: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const restaurantTimingSchema = new mongoose.Schema(
  {
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RestaurantPartner",
      required: true,
      unique: true,
    },
    weeklySchedule: {
      type: [daySchema],
      default: () => DAYS.map((day) => ({ day, isOpen: true, openTime: "10:00", closeTime: "23:00" })),
    },
    // Delivery can run on a narrower window than dine-in/opening hours
    deliveryHours: {
      sameAsOpeningHours: { type: Boolean, default: true },
      openTime: { type: String, default: "10:00" },
      closeTime: { type: String, default: "22:30" },
    },
    holidays: { type: [holidaySchema], default: [] },
    isTemporarilyClosed: { type: Boolean, default: false },
    temporaryCloseReason: { type: String, trim: true, default: "" },
    temporaryCloseUntil: { type: String, default: null }, // "YYYY-MM-DD", null = indefinite
  },
  { timestamps: true }
);

module.exports = mongoose.model("RestaurantTiming", restaurantTimingSchema);
module.exports.DAYS = DAYS;