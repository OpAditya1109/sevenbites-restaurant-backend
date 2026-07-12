const Review = require("../models/Review");

exports.addReview = async (req, res) => {
  try {
    const { restaurantId, orderId, rating, comment, images } = req.body;
    const review = await Review.create({
      userId: req.user._id,
      restaurantId,
      orderId,
      rating,
      comment,
      images,
    });
    res.status(201).json({ success: true, data: review });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: "You've already reviewed this restaurant" });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getReviewsByRestaurant = async (req, res) => {
  try {
    const reviews = await Review.find({ restaurantId: req.params.restaurantId })
      .sort({ createdAt: -1 })
      .populate("userId", "name avatar");
    res.json({ success: true, data: reviews });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};