const Coupon = require("../models/Coupon");
const Order = require("../models/Order");

// Shared: does this coupon apply to this restaurant?
const appliesToRestaurant = (coupon, restaurantId) => {
  if (!coupon.applicableRestaurants || coupon.applicableRestaurants.length === 0) return true;
  if (!restaurantId) return false;
  return coupon.applicableRestaurants.some((r) => String(r) === String(restaurantId));
};

// How many times has this user already redeemed this coupon (on delivered/placed, non-cancelled orders)?
const getUserRedemptionCount = async (userId, code) => {
  return Order.countDocuments({
    userId,
    couponCode: code,
    status: { $ne: "cancelled" },
  });
};

// GET /api/coupons?restaurantId=&orderValue=
// Returns every live coupon, each annotated with whether it's eligible for this
// cart right now (so "View all coupons" can show locked ones with a reason too).
exports.getActiveCoupons = async (req, res) => {
  try {
    const { restaurantId, orderValue } = req.query;
    const cartValue = Number(orderValue) || 0;
    const now = new Date();

    const coupons = await Coupon.find({
      isActive: true,
      validFrom: { $lte: now },
      validUntil: { $gte: now },
    }).sort({ isFeatured: -1, discountValue: -1 });

    const annotated = await Promise.all(
      coupons.map(async (c) => {
        const restaurantOk = appliesToRestaurant(c, restaurantId);
        const orderValueOk = cartValue >= c.minOrderValue;

        let usageOk = true;
        if (req.user?._id) {
          const used = await getUserRedemptionCount(req.user._id, c.code);
          usageOk = used < c.usageLimitPerUser;
        }
        const capOk = c.totalUsageLimit == null || c.timesUsed < c.totalUsageLimit;

        const eligible = restaurantOk && orderValueOk && usageOk && capOk;
        let reason = null;
        if (!restaurantOk) reason = "Not valid on this restaurant";
        else if (!orderValueOk) reason = `Add ₹${Math.ceil(c.minOrderValue - cartValue)} more to unlock`;
        else if (!usageOk) reason = "Already used";
        else if (!capOk) reason = "Coupon fully redeemed";

        const potentialDiscount = orderValueOk ? c.computeDiscount(cartValue) : 0;

        return {
          _id: c._id,
          code: c.code,
          description: c.description,
          discountType: c.discountType,
          discountValue: c.discountValue,
          maxDiscount: c.maxDiscount,
          minOrderValue: c.minOrderValue,
          validUntil: c.validUntil,
          isFeatured: c.isFeatured,
          eligible,
          reason,
          potentialDiscount: Math.round(potentialDiscount),
        };
      })
    );

    return res.json({ success: true, data: annotated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/coupons/apply  { code, restaurantId, orderValue }
// Validates a code against the current cart and returns the discount to apply.
exports.applyCoupon = async (req, res) => {
  try {
    const { code, restaurantId, orderValue } = req.body;
    const cartValue = Number(orderValue) || 0;

    if (!code) {
      return res.status(400).json({ success: false, message: "Coupon code is required" });
    }

    const coupon = await Coupon.findOne({ code: String(code).toUpperCase().trim() });
    if (!coupon) {
      return res.status(404).json({ success: false, message: "Invalid coupon code" });
    }
    if (!coupon.isCurrentlyValid()) {
      return res.status(400).json({ success: false, message: "This coupon has expired" });
    }
    if (!appliesToRestaurant(coupon, restaurantId)) {
      return res.status(400).json({ success: false, message: "This coupon isn't valid on this restaurant" });
    }
    if (cartValue < coupon.minOrderValue) {
      return res.status(400).json({
        success: false,
        message: `Add ₹${Math.ceil(coupon.minOrderValue - cartValue)} more to use this coupon`,
      });
    }
    if (coupon.totalUsageLimit != null && coupon.timesUsed >= coupon.totalUsageLimit) {
      return res.status(400).json({ success: false, message: "This coupon has been fully redeemed" });
    }

    const usedByUser = await getUserRedemptionCount(req.user._id, coupon.code);
    if (usedByUser >= coupon.usageLimitPerUser) {
      return res.status(400).json({ success: false, message: "You've already used this coupon" });
    }

    const discountAmount = Math.round(coupon.computeDiscount(cartValue));

    return res.json({
      success: true,
      data: {
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType,
        discountAmount,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};