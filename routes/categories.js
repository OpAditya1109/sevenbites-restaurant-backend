const express = require("express");

const verifyRestaurantToken = require("../middleware/verifyRestaurantToken");
const { setupImageUpload } = require("../middleware/setupImageUpload");
const uploadBufferToCloudinary = require("../utils/uploadBufferToCloudinary");
const Category = require("../models/Category");
const MenuItem = require("../models/MenuItem");

const router = express.Router();
const singleImage = setupImageUpload.single("image");

// GET /api/setup/categories — list, ordered for display (dashboard reorder view & Customer App rail)
router.get("/", verifyRestaurantToken, async (req, res) => {
  try {
    const categories = await Category.find({ restaurant: req.restaurantId }).sort({ order: 1, createdAt: 1 });
    return res.json({ success: true, categories });
  } catch (err) {
    console.error("Fetch categories error:", err);
    return res.status(500).json({ success: false, message: "Something went wrong." });
  }
});

// POST /api/setup/categories — add category
router.post("/", verifyRestaurantToken, singleImage, async (req, res) => {
  try {
    const { name, status } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ success: false, errors: { name: "Category name is required" } });
    }

    const existing = await Category.findOne({ restaurant: req.restaurantId, name: name.trim() });
    if (existing) {
      return res.status(409).json({ success: false, errors: { name: "A category with this name already exists" } });
    }

    let imageUrl = null;
    if (req.file) {
      const result = await uploadBufferToCloudinary(req.file.buffer, "sevenbites/setup/categories");
      imageUrl = result.secure_url;
    }

    const lastCategory = await Category.findOne({ restaurant: req.restaurantId }).sort({ order: -1 });
    const nextOrder = lastCategory ? lastCategory.order + 1 : 0;

    const category = await Category.create({
      restaurant: req.restaurantId,
      name: name.trim(),
      image: imageUrl,
      status: status === "inactive" ? "inactive" : "active",
      order: nextOrder,
    });

    return res.status(201).json({ success: true, category });
  } catch (err) {
    console.error("Create category error:", err);
    return res.status(500).json({ success: false, message: "Something went wrong." });
  }
});

// PATCH /api/setup/categories/reorder — bulk order update, e.g. after a drag-and-drop reorder
// Body: { order: [{ id, order }, ...] }
router.patch("/reorder", verifyRestaurantToken, async (req, res) => {
  try {
    const { order } = req.body;
    if (!Array.isArray(order)) {
      return res.status(400).json({ success: false, message: "order must be an array of { id, order }" });
    }

    await Promise.all(
      order.map(({ id, order: pos }) =>
        Category.updateOne({ _id: id, restaurant: req.restaurantId }, { $set: { order: pos } })
      )
    );

    const categories = await Category.find({ restaurant: req.restaurantId }).sort({ order: 1 });
    return res.json({ success: true, categories });
  } catch (err) {
    console.error("Reorder categories error:", err);
    return res.status(500).json({ success: false, message: "Something went wrong." });
  }
});

// PATCH /api/setup/categories/:id — edit category (name, image, status)
router.patch("/:id", verifyRestaurantToken, singleImage, async (req, res) => {
  try {
    const category = await Category.findOne({ _id: req.params.id, restaurant: req.restaurantId });
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    const { name, status } = req.body;
    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ success: false, errors: { name: "Category name cannot be empty" } });
      category.name = name.trim();
    }
    if (status !== undefined) category.status = status === "inactive" ? "inactive" : "active";

    if (req.file) {
      const result = await uploadBufferToCloudinary(req.file.buffer, "sevenbites/setup/categories");
      category.image = result.secure_url;
    }

    await category.save();
    return res.json({ success: true, category });
  } catch (err) {
    console.error("Update category error:", err);
    if (err.code === 11000) {
      return res.status(409).json({ success: false, errors: { name: "A category with this name already exists" } });
    }
    return res.status(500).json({ success: false, message: "Something went wrong." });
  }
});

// DELETE /api/setup/categories/:id — blocked if it still has menu items, to keep the Customer App consistent
router.delete("/:id", verifyRestaurantToken, async (req, res) => {
  try {
    const itemCount = await MenuItem.countDocuments({ category: req.params.id, restaurant: req.restaurantId });
    if (itemCount > 0) {
      return res.status(409).json({
        success: false,
        message: `Move or delete the ${itemCount} menu item(s) in this category first`,
      });
    }

    const deleted = await Category.findOneAndDelete({ _id: req.params.id, restaurant: req.restaurantId });
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }
    return res.json({ success: true });
  } catch (err) {
    console.error("Delete category error:", err);
    return res.status(500).json({ success: false, message: "Something went wrong." });
  }
});

module.exports = router;