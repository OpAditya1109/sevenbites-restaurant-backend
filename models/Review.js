const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: "RestaurantPartner", required: true, index: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    rating: { type: Number, required: [true, "Rating is required"], min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 500 },
    images: [String],
  },
  { timestamps: true }
);

reviewSchema.index({ userId: 1, restaurantId: 1 }, { unique: true });

reviewSchema.post("save", async function () {
  const RestaurantPartner = require("./RestaurantPartner");
  const reviews = await this.constructor.find({ restaurantId: this.restaurantId });
  const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  await RestaurantPartner.findByIdAndUpdate(this.restaurantId, {
    rating: Math.round(avg * 10) / 10,
    totalRatings: reviews.length,
  });
});

module.exports = mongoose.model("Review", reviewSchema);