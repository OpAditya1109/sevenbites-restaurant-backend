const RestaurantSettlementConfig = require("../models/RestaurantSettlementConfig");
const RestaurantPayout = require("../models/RestaurantPayout");

async function getOrCreateActiveSettlementConfig() {
  let config = await RestaurantSettlementConfig.findOne({ key: "default" });
  if (!config) {
    config = await RestaurantSettlementConfig.create({ key: "default" });
  }
  return config;
}

// GET /api/admin/settlement/config — admin-only
exports.getSettlementConfigAdmin = async (req, res) => {
  try {
    const config = await getOrCreateActiveSettlementConfig();
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/admin/settlement/config — admin-only
const EDITABLE_FIELDS = ["commissionPercent", "fulfilmentFee", "paymentGatewayChargePercent", "isActive"];

exports.updateSettlementConfigAdmin = async (req, res) => {
  try {
    const config = await getOrCreateActiveSettlementConfig();
    for (const field of EDITABLE_FIELDS) {
      if (req.body[field] !== undefined) {
        config[field] = req.body[field];
      }
    }
    config.updatedBy = req.body.updatedBy || "admin";
    await config.save();
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/admin/settlement/payouts — admin-only, records a payout manually
// (no automated payout processing yet — this just tracks history)
exports.recordPayout = async (req, res) => {
  try {
    const {
      restaurantId, periodStart, periodEnd, totalOrders,
      totalNetSettlement, payoutStatus, payoutDate, transactionRef, notes,
    } = req.body;

    if (!restaurantId || !periodStart || !periodEnd) {
      return res.status(400).json({
        success: false,
        message: "restaurantId, periodStart and periodEnd are required",
      });
    }

    const payout = await RestaurantPayout.create({
      restaurantId,
      periodStart,
      periodEnd,
      totalOrders: totalOrders || 0,
      totalNetSettlement: totalNetSettlement || 0,
      payoutStatus: payoutStatus || "pending",
      payoutDate: payoutDate || null,
      transactionRef: transactionRef || "",
      notes: notes || "",
    });

    res.status(201).json({ success: true, data: payout });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /api/admin/settlement/payouts/:id — admin-only, e.g. mark as processed
exports.updatePayoutStatus = async (req, res) => {
  try {
    const { payoutStatus, payoutDate, transactionRef } = req.body;
    const payout = await RestaurantPayout.findById(req.params.id);
    if (!payout) return res.status(404).json({ success: false, message: "Payout not found" });

    if (payoutStatus) payout.payoutStatus = payoutStatus;
    if (transactionRef !== undefined) payout.transactionRef = transactionRef;
    if (payoutDate !== undefined) payout.payoutDate = payoutDate;
    if (payoutStatus === "processed" && !payout.payoutDate) payout.payoutDate = new Date();

    await payout.save();
    res.json({ success: true, data: payout });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/admin/settlement/restaurants/:restaurantId/payouts — admin-only
exports.listPayoutsForRestaurant = async (req, res) => {
  try {
    const payouts = await RestaurantPayout.find({ restaurantId: req.params.restaurantId }).sort({ createdAt: -1 });
    res.json({ success: true, data: payouts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};