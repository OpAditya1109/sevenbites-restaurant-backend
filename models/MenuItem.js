const mongoose = require("mongoose");

// A single selectable option inside a variant group, e.g. { label: "Large", priceDelta: 80 }
const variantOptionSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    priceDelta: { type: Number, default: 0 }, // added to base price when this option is picked
  },
  { _id: false }
);

// A variant group, e.g. "Size" -> [Small, Medium, Large] or "Spice Level" -> [Mild, Medium, Hot]
const variantGroupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // "Size", "Spice Level"
    required: { type: Boolean, default: false }, // must customer pick one?
    options: { type: [variantOptionSchema], default: [] },
  },
  { _id: false }
);

// Add-ons, e.g. "Extra Cheese" +₹40
const addOnSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    inStock: { type: Boolean, default: true },
  },
  { _id: false }
);

const menuItemSchema = new mongoose.Schema(
  {
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RestaurantPartner",
      required: true,
      index: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 400 },

    price: { type: Number, required: true, min: 0 },
    discountPrice: {
      type: Number,
      min: 0,
      validate: {
        validator: function (v) {
          return v == null || v <= this.price;
        },
        message: "Discount price cannot be greater than the base price",
      },
    },

    foodType: {
      type: String,
      enum: ["veg", "non-veg", "egg"],
      required: true,
      default: "veg",
    },

    isBestseller: { type: Boolean, default: false },
    isRecommended: { type: Boolean, default: false },

    prepTimeMinutes: { type: Number, min: 0, default: 15 },

    images: [{ type: String }], // Cloudinary URLs, first image treated as primary/hero in Customer App

    isAvailable: { type: Boolean, default: true }, // manual on/off toggle by restaurant
    stockStatus: {
      type: String,
      enum: ["in_stock", "out_of_stock", "limited"],
      default: "in_stock",
    },

    addOns: { type: [addOnSchema], default: [] },
    variants: { type: [variantGroupSchema], default: [] },

    order: { type: Number, default: 0 }, // display order within its category
  },
  { timestamps: true }
);

menuItemSchema.index({ restaurant: 1, name: "text", description: "text" });

// Convenience virtual so both dashboard and Customer App can just read `effectivePrice`
menuItemSchema.virtual("effectivePrice").get(function () {
  return this.discountPrice != null ? this.discountPrice : this.price;
});
menuItemSchema.set("toJSON", { virtuals: true });
menuItemSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("MenuItem", menuItemSchema);