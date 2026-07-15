const mongoose = require("mongoose");

const pushTokenSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // One user can have multiple tokens (multiple devices) — don't assume 1:1,
    // so we key uniqueness on the token itself, not the user.
    expoPushToken: { type: String, required: true, unique: true },
    platform: { type: String, enum: ["android", "ios", "unknown"], default: "android" },
  },
  { timestamps: true } // gives us updatedAt for free, same convention as every other model here
);

module.exports = mongoose.model("PushToken", pushTokenSchema);