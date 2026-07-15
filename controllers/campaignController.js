const cronParser = require("cron-parser");
const NotificationCampaign = require("../models/NotificationCampaign");
const PushToken = require("../models/PushToken");
const { sendExpoPushAsync } = require("../utils/expoPush");

function validateCron(expr) {
  try {
    cronParser.parseExpression(expr);
    return true;
  } catch {
    return false;
  }
}

// POST /api/admin/campaigns
exports.createCampaign = async (req, res) => {
  try {
    const { title, body, scheduleType, cronExpression, active } = req.body;
    if (!title || !body || !cronExpression) {
      return res.status(400).json({ success: false, message: "title, body and cronExpression are required" });
    }
    if (!validateCron(cronExpression)) {
      return res.status(400).json({ success: false, message: "Invalid cronExpression" });
    }

    const campaign = await NotificationCampaign.create({
      title,
      body,
      scheduleType: scheduleType || "recurring",
      cronExpression,
      active: active !== undefined ? active : true,
    });

    res.status(201).json({ success: true, data: campaign });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/admin/campaigns
exports.listCampaigns = async (req, res) => {
  try {
    const campaigns = await NotificationCampaign.find().sort({ createdAt: -1 });
    res.json({ success: true, data: campaigns });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/admin/campaigns/:id
exports.updateCampaign = async (req, res) => {
  try {
    const { title, body, scheduleType, cronExpression, active } = req.body;
    if (cronExpression !== undefined && !validateCron(cronExpression)) {
      return res.status(400).json({ success: false, message: "Invalid cronExpression" });
    }

    const campaign = await NotificationCampaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ success: false, message: "Campaign not found" });

    if (title !== undefined) campaign.title = title;
    if (body !== undefined) campaign.body = body;
    if (scheduleType !== undefined) campaign.scheduleType = scheduleType;
    if (cronExpression !== undefined) campaign.cronExpression = cronExpression;
    if (active !== undefined) campaign.active = active;

    await campaign.save();
    res.json({ success: true, data: campaign });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

async function sendCampaignToAllUsers(campaign) {
  const tokens = await PushToken.find().distinct("expoPushToken");
  const result = await sendExpoPushAsync(tokens, {
    title: campaign.title,
    body: campaign.body,
    data: { type: "marketing", campaignId: String(campaign._id) },
  });
  campaign.lastSentAt = new Date();
  if (campaign.scheduleType === "once") campaign.active = false;
  await campaign.save();
  return result;
}

// POST /api/admin/campaigns/:id/send-now — manual trigger outside schedule
exports.sendCampaignNow = async (req, res) => {
  try {
    const campaign = await NotificationCampaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ success: false, message: "Campaign not found" });

    const result = await sendCampaignToAllUsers(campaign);
    res.json({ success: true, data: { campaign, result } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/admin/campaigns/run-due
//
// Hit this periodically from an EXTERNAL scheduler (Render Cron Job,
// cron-job.org, GitHub Actions schedule, etc.) — e.g. every 15 minutes.
// It checks each active campaign's cronExpression against "now" and sends
// any that are due.
//
// Why an external hit instead of an in-process node-cron scheduler?
// Render's free web-service tier spins the instance down after idle
// traffic. That silently kills any in-memory setInterval/node-cron timer —
// campaigns would just stop firing with no error anywhere, and you'd only
// notice when users complain they stopped getting notified. An external
// scheduler hitting this endpoint doesn't depend on the process staying
// warm. If you later move to an always-on paid Render instance, the
// in-process alternative below is a fine (simpler) replacement.
//
// /*
// const cron = require("node-cron");
// async function scheduleAllCampaignsInProcess() {
//   const campaigns = await NotificationCampaign.find({ active: true });
//   campaigns.forEach((c) => {
//     cron.schedule(c.cronExpression, async () => {
//       const fresh = await NotificationCampaign.findById(c._id);
//       if (fresh?.active) await sendCampaignToAllUsers(fresh);
//     });
//   });
// }
// // call scheduleAllCampaignsInProcess() once after mongoose.connect() in server.js
// */
exports.runDueCampaigns = async (req, res) => {
  try {
    const campaigns = await NotificationCampaign.find({ active: true });
    const windowMinutes = 15; // should roughly match how often the external scheduler hits this
    const now = new Date();
    const sentCampaigns = [];

    for (const campaign of campaigns) {
      try {
        const interval = cronParser.parseExpression(campaign.cronExpression, { currentDate: now });
        const prevFire = interval.prev().toDate();
        const sinceLast = campaign.lastSentAt || campaign.createdAt;
        const dueWindowStart = new Date(now.getTime() - windowMinutes * 60 * 1000);

        const isDue = prevFire > sinceLast && prevFire >= dueWindowStart;
        if (isDue) {
          await sendCampaignToAllUsers(campaign);
          sentCampaigns.push(campaign.title);
        }
      } catch (err) {
        console.error(`Skipping campaign ${campaign._id} — cron parse/send error:`, err.message);
      }
    }

    res.json({ success: true, data: { checked: campaigns.length, sent: sentCampaigns } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};