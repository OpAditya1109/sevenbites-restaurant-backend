/**
 * Seeds 10 fake restaurants into the SevenBites DB.
 *
 * Usage (run from the sevenbites-restaurant-backend folder):
 *   node scripts/seedRestaurants.js
 *
 * Safe to re-run — it upserts by email, so it won't create duplicates.
 * All 10 are created with status "approved" so they show up immediately
 * in GET /api/public/restaurants.
 */

require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const RestaurantPartner = require("../models/RestaurantPartner");

// Placeholder food photos (Unsplash direct links) — swap these out with your
// own generated images later, just replace the logoUrl/coverImageUrl/
// restaurantImages/menuImages values below.
const placeholderImg = (seed) => `https://source.unsplash.com/800x600/?restaurant,food&sig=${seed}`;

const restaurants = [
  {
    restaurantName: "Punjabi Tadka Dhaba",
    ownerName: "Harpreet Singh",
    cuisineType: "North Indian",
    cuisine: ["North Indian", "Punjabi"],
    description: "Authentic Punjabi dhaba-style food, rich gravies and tandoori classics.",
    tags: ["Popular", "Pure Veg Options"],
  },
  {
    restaurantName: "Mumbai Vada Pav Co.",
    ownerName: "Sanjay More",
    cuisineType: "Street Food",
    cuisine: ["Street Food", "Maharashtrian"],
    description: "Mumbai-style vada pav, misal pav and quick street bites.",
    tags: ["Budget Friendly", "Quick Bites"],
  },
  {
    restaurantName: "Biryani Blues",
    ownerName: "Ayesha Khan",
    cuisineType: "Biryani",
    cuisine: ["Biryani", "Mughlai"],
    description: "Slow-cooked dum biryanis and Mughlai curries.",
    tags: ["Bestseller", "Non-Veg Special"],
  },
  {
    restaurantName: "South Spice Kitchen",
    ownerName: "Ramesh Iyer",
    cuisineType: "South Indian",
    cuisine: ["South Indian"],
    description: "Dosa, idli, and filter coffee made the traditional way.",
    tags: ["Pure Veg", "Breakfast Favorite"],
  },
  {
    restaurantName: "Wok This Way",
    ownerName: "Wei Chen Fernandes",
    cuisineType: "Chinese",
    cuisine: ["Chinese", "Indo-Chinese"],
    description: "Wok-tossed Indo-Chinese favorites — noodles, fried rice and manchurian.",
    tags: ["Spicy", "Quick Delivery"],
  },
  {
    restaurantName: "The Burger Bunker",
    ownerName: "Karan Mehta",
    cuisineType: "Fast Food",
    cuisine: ["Fast Food", "American"],
    description: "Loaded burgers, crispy fries and thick shakes.",
    tags: ["Trending", "Combo Deals"],
  },
  {
    restaurantName: "Pizza Junction",
    ownerName: "Marco D'Souza",
    cuisineType: "Italian",
    cuisine: ["Italian", "Fast Food"],
    description: "Wood-fired pizzas with classic and desi toppings.",
    tags: ["Bestseller", "Cheesy"],
  },
  {
    restaurantName: "Tandoori Nights",
    ownerName: "Fatima Sheikh",
    cuisineType: "Mughlai",
    cuisine: ["Mughlai", "Tandoori"],
    description: "Kebabs, tikkas and tandoori delicacies for late night cravings.",
    tags: ["Late Night", "Non-Veg Special"],
  },
  {
    restaurantName: "Sweet Tooth Bakery & Desserts",
    ownerName: "Priya Nair",
    cuisineType: "Bakery",
    cuisine: ["Bakery", "Desserts"],
    description: "Fresh cakes, pastries and desserts baked daily.",
    tags: ["New", "Desserts"],
  },
  {
    restaurantName: "Cafe Brew & Bites",
    ownerName: "Aditya Deshmukh",
    cuisineType: "Cafe",
    cuisine: ["Cafe", "Continental"],
    description: "Coffee, sandwiches and all-day breakfast in a cozy cafe setting.",
    tags: ["Cafe", "Work Friendly"],
  },
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB");

  const hashedPassword = await bcrypt.hash("Test@1234", 10);

  for (let i = 0; i < restaurants.length; i++) {
    const r = restaurants[i];
    const idx = i + 1;
    const slug = r.restaurantName.toLowerCase().replace(/[^a-z0-9]+/g, "");

    const doc = {
      restaurantName: r.restaurantName,
      ownerName: r.ownerName,
      contactNumber: `9${String(100000000 + idx).slice(0, 9)}`, // valid 10-digit, starts 6-9
      email: `${slug}@seed.sevenbites.com`,
      address: `${idx} MG Road, Near City Center`,
      city: idx % 2 === 0 ? "Pune" : "Nashik",
      pincode: idx % 2 === 0 ? "411001" : "422001",
      cuisineType: r.cuisineType,
      cuisine: r.cuisine,
      description: r.description,

      restaurantImages: [placeholderImg(`${slug}-1`), placeholderImg(`${slug}-2`)],
      menuImages: [placeholderImg(`${slug}-menu`)],

      fssaiCertificateUrl: placeholderImg(`${slug}-fssai`),
      fssaiLicenseNumber: String(10000000000000 + idx),
      gstCertificateUrl: placeholderImg(`${slug}-gst`),

      bankAccountHolderName: r.ownerName,
      bankAccountNumber: String(100000000000 + idx),
      ifscCode: "HDFC0001234",
      chequeOrPassbookUrl: placeholderImg(`${slug}-cheque`),

      password: hashedPassword,
      status: "approved",

      logoUrl: placeholderImg(`${slug}-logo`),
      coverImageUrl: placeholderImg(`${slug}-cover`),
      deliveryRadiusKm: 5,
      rating: (Math.random() * (4.8 - 3.9) + 3.9).toFixed(1),
      totalRatings: Math.floor(Math.random() * 400) + 20,
      deliveryTime: "25-35 min",
      deliveryFee: 0,
      minOrder: 99,
      tags: r.tags,
    };

    await RestaurantPartner.findOneAndUpdate(
      { email: doc.email },
      { $set: doc },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
    );
    console.log(`Upserted: ${r.restaurantName}`);
  }

  console.log("Done seeding 10 restaurants.");
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});