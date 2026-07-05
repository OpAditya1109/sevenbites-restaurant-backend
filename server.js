require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");

const restaurantPartnerRoutes = require("./routes/restaurantPartner");

const app = express();

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

app.get("/health", (req, res) => {
  res.json({ success: true, message: "SevenBites restaurant backend is running" });
});

app.use("/api/restaurants", restaurantPartnerRoutes);

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
    app.listen(PORT, () => console.log(`Restaurant backend running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });
