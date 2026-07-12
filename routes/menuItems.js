const express = require("express");
const { parse } = require("csv-parse/sync");

const verifyRestaurantToken = require("../middleware/verifyRestaurantToken");
const { setupImageUpload, csvUpload } = require("../middleware/setupImageUpload");
const uploadBufferToCloudinary = require("../utils/uploadBufferToCloudinary");
const MenuItem = require("../models/MenuItem");
const Category = require("../models/Category");

const router = express.Router();
const imagesUpload = setupImageUpload.array("images", 6);

function parseJSONField(value, fallback) {
  if (value === undefined) return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

// GET /api/setup/menu-items — list with search & filters for the Menu Management table
// Query params: search, category, foodType, availability(true/false), bestseller(true), recommended(true)
router.get("/", verifyRestaurantToken, async (req, res) => {
  try {
    const { search, category, foodType, availability, bestseller, recommended, stockStatus } = req.query;

    const filter = { restaurant: req.restaurantId };
    if (category) filter.category = category;
    if (foodType) filter.foodType = foodType;
    if (availability !== undefined) filter.isAvailable = availability === "true";
    if (bestseller === "true") filter.isBestseller = true;
    if (recommended === "true") filter.isRecommended = true;
    if (stockStatus) filter.stockStatus = stockStatus;
    if (search?.trim()) filter.$text = { $search: search.trim() };

    const items = await MenuItem.find(filter).sort({ category: 1, order: 1, createdAt: -1 }).populate("category", "name");
    return res.json({ success: true, items });
  } catch (err) {
    console.error("Fetch menu items error:", err);
    return res.status(500).json({ success: false, message: "Something went wrong." });
  }
});

// POST /api/setup/menu-items — create item
router.post("/", verifyRestaurantToken, imagesUpload, async (req, res) => {
  try {
    const {
      name, description, category, price, discountPrice, foodType,
      isBestseller, isRecommended, prepTimeMinutes, isAvailable, stockStatus,
    } = req.body;

    const errors = {};
    if (!name?.trim()) errors.name = "Item name is required";
    if (!category) errors.category = "Category is required";
    if (price === undefined || isNaN(price) || Number(price) < 0) errors.price = "Enter a valid price";
    if (discountPrice !== undefined && discountPrice !== "" && Number(discountPrice) > Number(price)) {
      errors.discountPrice = "Discount price cannot exceed the base price";
    }
    if (!["veg", "non-veg", "egg"].includes(foodType)) errors.foodType = "Select veg, non-veg, or egg";

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    const categoryDoc = await Category.findOne({ _id: category, restaurant: req.restaurantId });
    if (!categoryDoc) {
      return res.status(400).json({ success: false, errors: { category: "Category not found for this restaurant" } });
    }

    const files = req.files || [];
    const imageResults = await Promise.all(
      files.map((f) => uploadBufferToCloudinary(f.buffer, "sevenbites/setup/menu-items"))
    );

    const item = await MenuItem.create({
      restaurant: req.restaurantId,
      category,
      name: name.trim(),
      description: description?.trim(),
      price: Number(price),
      discountPrice: discountPrice ? Number(discountPrice) : undefined,
      foodType,
      isBestseller: isBestseller === "true" || isBestseller === true,
      isRecommended: isRecommended === "true" || isRecommended === true,
      prepTimeMinutes: prepTimeMinutes ? Number(prepTimeMinutes) : 15,
      images: imageResults.map((r) => r.secure_url),
      isAvailable: isAvailable === undefined ? true : isAvailable === "true" || isAvailable === true,
      stockStatus: stockStatus || "in_stock",
      addOns: parseJSONField(req.body.addOns, []),
      variants: parseJSONField(req.body.variants, []),
    });

    return res.status(201).json({ success: true, item });
  } catch (err) {
    console.error("Create menu item error:", err);
    return res.status(500).json({ success: false, message: "Something went wrong." });
  }
});

// PATCH /api/setup/menu-items/:id — edit item (partial update, optionally appends new images)
router.patch("/:id", verifyRestaurantToken, imagesUpload, async (req, res) => {
  try {
    const item = await MenuItem.findOne({ _id: req.params.id, restaurant: req.restaurantId });
    if (!item) return res.status(404).json({ success: false, message: "Menu item not found" });

    const {
      name, description, category, price, discountPrice, foodType,
      isBestseller, isRecommended, prepTimeMinutes, isAvailable, stockStatus, removeImageUrls,
    } = req.body;

    if (name !== undefined) item.name = name.trim();
    if (description !== undefined) item.description = description.trim();
    if (category !== undefined) {
      const categoryDoc = await Category.findOne({ _id: category, restaurant: req.restaurantId });
      if (!categoryDoc) return res.status(400).json({ success: false, errors: { category: "Category not found" } });
      item.category = category;
    }
    if (price !== undefined) item.price = Number(price);
    if (discountPrice !== undefined) item.discountPrice = discountPrice === "" ? undefined : Number(discountPrice);
    if (foodType !== undefined) item.foodType = foodType;
    if (isBestseller !== undefined) item.isBestseller = isBestseller === "true" || isBestseller === true;
    if (isRecommended !== undefined) item.isRecommended = isRecommended === "true" || isRecommended === true;
    if (prepTimeMinutes !== undefined) item.prepTimeMinutes = Number(prepTimeMinutes);
    if (isAvailable !== undefined) item.isAvailable = isAvailable === "true" || isAvailable === true;
    if (stockStatus !== undefined) item.stockStatus = stockStatus;
    if (req.body.addOns !== undefined) item.addOns = parseJSONField(req.body.addOns, item.addOns);
    if (req.body.variants !== undefined) item.variants = parseJSONField(req.body.variants, item.variants);

    const toRemove = parseJSONField(removeImageUrls, []);
    if (Array.isArray(toRemove) && toRemove.length) {
      item.images = item.images.filter((url) => !toRemove.includes(url));
    }

    const files = req.files || [];
    if (files.length) {
      const imageResults = await Promise.all(
        files.map((f) => uploadBufferToCloudinary(f.buffer, "sevenbites/setup/menu-items"))
      );
      item.images.push(...imageResults.map((r) => r.secure_url));
    }

    await item.save();
    return res.json({ success: true, item });
  } catch (err) {
    console.error("Update menu item error:", err);
    return res.status(500).json({ success: false, message: "Something went wrong." });
  }
});

// PATCH /api/setup/menu-items/:id/availability — quick toggle used by the table switch
router.patch("/:id/availability", verifyRestaurantToken, async (req, res) => {
  try {
    const { isAvailable } = req.body;
    const item = await MenuItem.findOneAndUpdate(
      { _id: req.params.id, restaurant: req.restaurantId },
      { $set: { isAvailable: !!isAvailable } },
      { new: true }
    );
    if (!item) return res.status(404).json({ success: false, message: "Menu item not found" });
    return res.json({ success: true, item });
  } catch (err) {
    console.error("Toggle availability error:", err);
    return res.status(500).json({ success: false, message: "Something went wrong." });
  }
});

// DELETE /api/setup/menu-items/:id
router.delete("/:id", verifyRestaurantToken, async (req, res) => {
  try {
    const deleted = await MenuItem.findOneAndDelete({ _id: req.params.id, restaurant: req.restaurantId });
    if (!deleted) return res.status(404).json({ success: false, message: "Menu item not found" });
    return res.json({ success: true });
  } catch (err) {
    console.error("Delete menu item error:", err);
    return res.status(500).json({ success: false, message: "Something went wrong." });
  }
});

// POST /api/setup/menu-items/bulk-import — CSV columns:
// name,description,category,price,discountPrice,foodType,prepTimeMinutes,isBestseller,isRecommended,isAvailable,stockStatus
router.post("/bulk-import", verifyRestaurantToken, csvUpload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "CSV file is required" });

    const rows = parse(req.file.buffer.toString("utf-8"), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    const categories = await Category.find({ restaurant: req.restaurantId });
    const categoryByName = new Map(categories.map((c) => [c.name.toLowerCase(), c._id]));

    const results = { created: 0, failed: [] };

    for (const [i, row] of rows.entries()) {
      const rowNum = i + 2; // account for header row
      const categoryId = categoryByName.get((row.category || "").toLowerCase().trim());

      if (!row.name?.trim() || !categoryId || !row.price || isNaN(Number(row.price))) {
        results.failed.push({ row: rowNum, reason: "Missing/invalid name, category, or price" });
        continue;
      }

      try {
        await MenuItem.create({
          restaurant: req.restaurantId,
          category: categoryId,
          name: row.name.trim(),
          description: row.description?.trim(),
          price: Number(row.price),
          discountPrice: row.discountPrice ? Number(row.discountPrice) : undefined,
          foodType: ["veg", "non-veg", "egg"].includes(row.foodType) ? row.foodType : "veg",
          prepTimeMinutes: row.prepTimeMinutes ? Number(row.prepTimeMinutes) : 15,
          isBestseller: row.isBestseller === "true" || row.isBestseller === "1",
          isRecommended: row.isRecommended === "true" || row.isRecommended === "1",
          isAvailable: row.isAvailable === undefined || row.isAvailable === "true" || row.isAvailable === "1",
          stockStatus: ["in_stock", "out_of_stock", "limited"].includes(row.stockStatus) ? row.stockStatus : "in_stock",
        });
        results.created += 1;
      } catch (e) {
        results.failed.push({ row: rowNum, reason: e.message });
      }
    }

    return res.json({ success: true, ...results });
  } catch (err) {
    console.error("Bulk import error:", err);
    return res.status(500).json({ success: false, message: "Could not parse CSV file. Check the format and try again." });
  }
});

module.exports = router;