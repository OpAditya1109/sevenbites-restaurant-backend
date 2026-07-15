const PushToken = require("../models/PushToken");

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const CHUNK_SIZE = 100; // Expo's batch limit per request

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Sends a push notification to one or more Expo push tokens.
 * Batches in chunks of 100 (Expo's limit) and deletes any token Expo reports
 * as DeviceNotRegistered so PushToken never accumulates dead entries.
 *
 * @param {string[]} tokens
 * @param {{ title: string, body: string, data?: object, priority?: string }} payload
 */
async function sendExpoPushAsync(tokens, { title, body, data = {}, priority = "high" } = {}) {
  const validTokens = (tokens || []).filter(
    (t) => typeof t === "string" && t.startsWith("ExponentPushToken")
  );
  if (validTokens.length === 0) return { sent: 0, errors: [] };

  const chunks = chunkArray(validTokens, CHUNK_SIZE);
  const errors = [];
  let sent = 0;

  for (const chunk of chunks) {
    const messages = chunk.map((to) => ({
      to,
      title,
      body,
      data,
      priority,
      sound: "default",
      // Matches the Android channel id created client-side in ensureNotificationChannel()
      channelId: "order_tracking",
    }));

    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
        },
        body: JSON.stringify(messages),
      });

      const json = await res.json();
      const tickets = json?.data || [];

      for (let i = 0; i < tickets.length; i++) {
        const ticket = tickets[i];
        const token = chunk[i];

        if (ticket.status === "error") {
          errors.push({ token, ...ticket });
          console.error("Expo push error:", token, ticket.message, ticket.details);

          if (ticket.details?.error === "DeviceNotRegistered") {
            await PushToken.deleteOne({ expoPushToken: token }).catch(() => {});
          }
        } else {
          sent += 1;
        }
      }
    } catch (err) {
      console.error("Expo push request failed:", err.message);
      errors.push({ error: err.message });
    }
  }

  return { sent, errors };
}

module.exports = { sendExpoPushAsync };