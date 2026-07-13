const PricingConfig = require("../models/PricingConfig");
const { computeCharges } = require("../utils/pricingCalculator");

// Ensures exactly one config doc exists; creates the default one on first use.
async function getOrCreateActiveConfig() {
  let config = await PricingConfig.findOne({ key: "default" });
  if (!config) {
    config = await PricingConfig.create({ key: "default" });
  }
  return config;
}

// GET /api/public/pricing/active
// Public — the app shows these thresholds/rates directly as part of the
// "No Hidden Charges" bill breakdown, so nothing here is sensitive.
exports.getActivePricingConfig = async (req, res) => {
  try {
    const config = await getOrCreateActiveConfig();
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/public/pricing/calculate  { orderValue, distanceKm }
// Public — the Customer App calls this from Cart/Checkout instead of computing
// fees locally. The same function is reused server-side at order placement
// (see orderController.js) so the numbers can never drift from what's charged.
exports.calculateCharges = async (req, res) => {
  try {
    const { orderValue, distanceKm } = req.body;
    if (orderValue === undefined || orderValue === null || isNaN(Number(orderValue))) {
      return res.status(400).json({ success: false, message: "orderValue (number) is required" });
    }
    const config = await getOrCreateActiveConfig();
    const charges = computeCharges({ orderValue, distanceKm }, config);
    res.json({ success: true, data: charges });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/admin/pricing-config — admin-only
exports.getPricingConfigAdmin = async (req, res) => {
  try {
    const config = await getOrCreateActiveConfig();
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/admin/pricing-config — admin-only.
// Body can include any subset of the editable fields; anything else is ignored.
const EDITABLE_FIELDS = [
  "lowOrderValueThreshold",
  "belowThresholdDistanceBands",
  "freeDeliveryRadiusKm",
  "perKmRateBeyondFreeRadius",
  "platformFee",
  "gstRatePercent",
  "isActive",
];

exports.updatePricingConfigAdmin = async (req, res) => {
  try {
    const config = await getOrCreateActiveConfig();
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