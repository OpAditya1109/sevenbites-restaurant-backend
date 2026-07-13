// Computes delivery fee / platform fee / GST from a PricingConfig doc.
// Used by:
//   - controllers/pricingController.js  (preview endpoint the Customer App calls)
//   - controllers/orderController.js    (server-side recompute at order placement)
// Never duplicate this math anywhere else — everything is driven by `config`.

function computeDeliveryFee({ orderValue, distanceKm }, config) {
  const freeRadius = config.freeDeliveryRadiusKm;
  const extraKm = distanceKm == null ? 0 : Math.max(0, distanceKm - freeRadius);
  const extraKmCharged = Math.ceil(extraKm); // partial km beyond the radius rounds up
  const extraDistanceFee = extraKmCharged * config.perKmRateBeyondFreeRadius;

  if (orderValue < config.lowOrderValueThreshold) {
    const bands = [...config.belowThresholdDistanceBands].sort(
      (a, b) => a.maxDistanceKm - b.maxDistanceKm
    );
    // Unknown distance (no address pin yet) → fall back to the widest band.
    let bandFee = bands.length ? bands[bands.length - 1].fee : 0;
    if (distanceKm != null) {
      const match = bands.find((b) => distanceKm <= b.maxDistanceKm);
      bandFee = match ? match.fee : bands[bands.length - 1].fee;
    }
    return Math.round(bandFee + extraDistanceFee);
  }

  // orderValue >= threshold → free within the radius, ₹/km beyond it
  return Math.round(extraDistanceFee);
}

function computeCharges({ orderValue, distanceKm }, config) {
  const safeOrderValue = Math.max(0, Number(orderValue) || 0);
  const safeDistanceKm =
    distanceKm === null || distanceKm === undefined || Number.isNaN(Number(distanceKm))
      ? null
      : Number(distanceKm);

  const deliveryFee = computeDeliveryFee(
    { orderValue: safeOrderValue, distanceKm: safeDistanceKm },
    config
  );
  const platformFee = Math.round(config.platformFee);
  const gstableAmount = deliveryFee + platformFee;
  const gst = Math.round((gstableAmount * config.gstRatePercent) / 100);
  const total = Math.round(safeOrderValue + deliveryFee + platformFee + gst);

  return {
    orderValue: safeOrderValue,
    distanceKm: safeDistanceKm,
    deliveryFee,
    platformFee,
    gstRatePercent: config.gstRatePercent,
    gst,
    total,
    isFreeDelivery: deliveryFee === 0,
  };
}

module.exports = { computeCharges };