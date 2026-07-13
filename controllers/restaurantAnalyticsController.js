const mongoose = require("mongoose");
const Order = require("../models/Order");
const RestaurantPayout = require("../models/RestaurantPayout");

// GET /api/setup/orders/analytics?from=2026-06-01&to=2026-06-30
// Protected by verifyRestaurantToken (see routes/restaurantOrders.js) — restaurant
// only ever sees its own figures. Aggregation-driven so this stays fast even as
// the Order collection grows; never fetch-all-and-compute-in-JS here.
exports.getRestaurantAnalytics = async (req, res) => {
  try {
    const { from, to } = req.query;

    const match = {
      restaurantId: new mongoose.Types.ObjectId(req.restaurantId),
      status: "delivered",
    };
    if (from || to) {
      match.deliveredAt = {};
      if (from) match.deliveredAt.$gte = new Date(from);
      if (to) match.deliveredAt.$lte = new Date(to);
    }

    const [summaryAgg, bestSellingItems, payoutHistory] = await Promise.all([
      Order.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalSales: { $sum: "$itemTotal" },
            commissionDeducted: { $sum: "$commissionAmount" },
            fulfilmentCharges: { $sum: "$fulfilmentFee" },
            paymentGatewayCharges: { $sum: "$paymentGatewayCharge" },
            netSettlement: { $sum: "$netSettlement" },
          },
        },
      ]),
      Order.aggregate([
        { $match: match },
        { $unwind: "$items" },
        {
          $group: {
            _id: { $ifNull: ["$items.menuItemId", "$items.name"] },
            name: { $first: "$items.name" },
            totalQuantity: { $sum: "$items.quantity" },
          },
        },
        { $sort: { totalQuantity: -1 } },
        { $limit: 10 },
        { $project: { _id: 0, name: 1, totalQuantity: 1 } },
      ]),
      RestaurantPayout.find({ restaurantId: req.restaurantId }).sort({ periodEnd: -1, createdAt: -1 }),
    ]);

    const summary = summaryAgg[0] || {};

    res.json({
      success: true,
      data: {
        totalOrders: summary.totalOrders || 0,
        totalSales: summary.totalSales || 0,
        commissionDeducted: summary.commissionDeducted || 0,
        fulfilmentCharges: summary.fulfilmentCharges || 0,
        paymentGatewayCharges: summary.paymentGatewayCharges || 0,
        netSettlement: summary.netSettlement || 0,
        bestSellingItems,
        payoutHistory,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};