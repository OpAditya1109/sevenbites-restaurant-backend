const mongoose = require("mongoose");

const notificationCampaignSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    scheduleType: { type: String, enum: ["once", "recurring"], default: "recurring" },
    // Standard 5-field cron, e.g. "0 12,19 * * *" (daily 12pm & 7pm) or
    // "0 */3 * * *" (every 3 hours). Admin sets this per campaign — never hardcoded.
    cronExpression: { type: String, required: true },
    active: { type: Boolean, default: true },
    lastSentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("NotificationCampaign", notificationCampaignSchema);