const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RestaurantPartner",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    image: { type: String, default: null }, // Cloudinary URL, shown in Customer App category rail
    order: { type: Number, default: 0, index: true }, // controls display order in both dashboard & Customer App
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  { timestamps: true }
);

// A restaurant can't have two categories with the exact same name
categorySchema.index({ restaurant: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Category", categorySchema);