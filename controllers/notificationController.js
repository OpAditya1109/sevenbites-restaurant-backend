const PushToken = require("../models/PushToken");

// POST /api/notifications/register-token   body: { expoPushToken, platform }
exports.registerPushToken = async (req, res) => {
  try {
    const { expoPushToken, platform } = req.body;
    if (!expoPushToken || typeof expoPushToken !== "string") {
      return res.status(400).json({ success: false, message: "expoPushToken is required" });
    }

    const doc = await PushToken.findOneAndUpdate(
      { expoPushToken },
      { userId: req.user._id, expoPushToken, platform: platform || "android" },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, data: doc });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};