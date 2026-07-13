// Computes restaurant-side settlement figures from a RestaurantSettlementConfig doc.
// Used by controllers/restaurantOrderController.js at the moment an order is
// marked "delivered". Mirrors utils/pricingCalculator.js — never duplicate
// this math anywhere else; everything is driven by `config`.

const ONLINE_PAYMENT_METHODS = ["upi", "card", "wallet"];

function computeSettlement({ itemTotal, totalAmount, paymentMethod }, config) {
  const safeItemTotal = Math.max(0, Number(itemTotal) || 0);
  const safeTotalAmount = Math.max(0, Number(totalAmount) || 0);

  // Commission applies to food value only — not delivery/platform/GST.
  const commissionAmount = Math.round((safeItemTotal * config.commissionPercent) / 100);

  const fulfilmentFee = Math.round(config.fulfilmentFee);

  // PG charge only applies to online/prepaid orders — always 0 for COD.
  const paymentGatewayCharge = ONLINE_PAYMENT_METHODS.includes(paymentMethod)
    ? Math.round((safeTotalAmount * config.paymentGatewayChargePercent) / 100)
    : 0;

  const netSettlement = Math.round(safeItemTotal - commissionAmount - fulfilmentFee - paymentGatewayCharge);

  return { commissionAmount, fulfilmentFee, paymentGatewayCharge, netSettlement };
}

module.exports = { computeSettlement };