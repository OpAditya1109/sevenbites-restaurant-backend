require("dotenv").config();
const http = require("http");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");

const { initSocket } = require("./utils/socket");

const restaurantPartnerRoutes = require("./routes/restaurantPartner");

// ---- Restaurant Setup Module ----
const restaurantProfileSetupRoutes = require("./routes/restaurantProfileSetup");
const restaurantTimingsRoutes = require("./routes/restaurantTimings");
const categoriesRoutes = require("./routes/categories");
const menuItemsRoutes = require("./routes/menuItems");
const publicRestaurantRoutes = require("./routes/publicRestaurant");
const restaurantOrdersRoutes = require("./routes/restaurantOrders"); // NEW — restaurant-side order management

const app = express();
const server = http.createServer(app); // NEW — Socket.io shares this same HTTP server/port

// Allow your Next.js frontend (and any other origin you add) to call this API
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : "*",
  })
);
app.use(express.json());

// NEW — boot Socket.io
initSocket(server);

app.get("/health", (req, res) => {
  res.json({ success: true, message: "SevenBites restaurant backend is running" });
});

// Onboarding (registration/login) — unchanged
app.use("/api/restaurants", restaurantPartnerRoutes);

// Restaurant Setup Module — authenticated, partner-facing
app.use("/api/setup/profile", restaurantProfileSetupRoutes);
app.use("/api/setup/timings", restaurantTimingsRoutes);
app.use("/api/setup/categories", categoriesRoutes);
app.use("/api/setup/menu-items", menuItemsRoutes);
app.use("/api/setup/orders", restaurantOrdersRoutes); // NEW — live order management

// Public, unauthenticated — this is what the SevenBites Customer App reads from
app.use("/api/public/restaurants", publicRestaurantRoutes);

// Customer App — auth, orders, addresses, reviews
app.use("/api/auth", require("./routes/auth"));
app.use("/api/orders", require("./routes/orders"));
app.use("/api/address", require("./routes/address"));
app.use("/api/reviews", require("./routes/reviews"));
app.use("/api/coupons", require("./routes/coupons")); // NEW — "View all coupons" + apply-coupon on Cart screen
// Pricing — public preview/calculate + admin-key-gated config management
app.use("/api/public/pricing", require("./routes/pricing"));
app.use("/api/admin/pricing-config", require("./routes/adminPricing"));
app.use("/api/admin/settlement", require("./routes/adminSettlement")); // NEW — commission/fulfilment/PG config + payout recording

// Turns multer/file validation errors into clean JSON instead of a raw HTML crash
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err?.message) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next(err);
});

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("Connected to MongoDB");
    server.listen(PORT, () => console.log(`Restaurant backend running on port ${PORT}`)); // CHANGED: server.listen
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });