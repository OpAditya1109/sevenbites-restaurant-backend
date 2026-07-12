const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["Home", "Work", "Other"], default: "Home" },
    label: { type: String, trim: true },
    flatNo: { type: String, trim: true },
    street: { type: String, required: [true, "Street is required"], trim: true },
    landmark: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, default: "Maharashtra", trim: true },
    pincode: { type: String, trim: true },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Address", addressSchema);