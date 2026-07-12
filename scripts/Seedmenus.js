
/**
 * Seeds realistic categories + menu items for all 10 seed restaurants.
 * No images needed right now — images field is left empty and can be
 * filled in later via updateFromAssets.js.
 *
 * Usage:
 *   node scripts/seedMenus.js
 *
 * Safe to re-run — upserts categories by (restaurant, name) and menu
 * items by (restaurant, name), so re-running just updates prices/details
 * instead of duplicating.
 */

require("dotenv").config();
const mongoose = require("mongoose");

const RestaurantPartner = require("../models/RestaurantPartner");
const Category = require("../models/Category");
const MenuItem = require("../models/MenuItem");

// slug -> { categories: [name...], items: [{ category, name, price, foodType, description, isBestseller }] }
const MENUS = {
  punjabitadkadhaba: {
    categories: ["Starters", "Main Course", "Breads", "Rice & Biryani", "Beverages"],
    items: [
      { category: "Starters", name: "Paneer Tikka", price: 249, foodType: "veg", description: "Chargrilled cottage cheese marinated in spiced yogurt.", isBestseller: true },
      { category: "Starters", name: "Amritsari Fish Tikka", price: 329, foodType: "non-veg", description: "Fried fish marinated in Amritsari spices." },
      { category: "Main Course", name: "Butter Chicken", price: 349, foodType: "non-veg", description: "Tandoori chicken simmered in creamy tomato gravy.", isBestseller: true },
      { category: "Main Course", name: "Dal Makhani", price: 249, foodType: "veg", description: "Black lentils slow-cooked with butter and cream." },
      { category: "Main Course", name: "Palak Paneer", price: 259, foodType: "veg", description: "Cottage cheese cubes in a spiced spinach gravy." },
      { category: "Breads", name: "Butter Naan", price: 59, foodType: "veg", description: "Tandoor-baked leavened bread brushed with butter." },
      { category: "Breads", name: "Lachha Paratha", price: 65, foodType: "veg", description: "Multi-layered crispy whole wheat paratha." },
      { category: "Rice & Biryani", name: "Jeera Rice", price: 179, foodType: "veg", description: "Basmati rice tempered with cumin." },
      { category: "Beverages", name: "Sweet Lassi", price: 99, foodType: "veg", description: "Chilled sweetened yogurt drink." },
    ],
  },

  mumbaivadapavco: {
    categories: ["Street Favorites", "Sides", "Beverages"],
    items: [
      { category: "Street Favorites", name: "Vada Pav", price: 40, foodType: "veg", description: "Spiced potato fritter in a soft pav with chutneys.", isBestseller: true },
      { category: "Street Favorites", name: "Misal Pav", price: 89, foodType: "veg", description: "Spicy sprouted moth bean curry topped with farsan.", isBestseller: true },
      { category: "Street Favorites", name: "Pav Bhaji", price: 99, foodType: "veg", description: "Mashed mixed vegetable curry with buttered pav." },
      { category: "Street Favorites", name: "Dabeli", price: 49, foodType: "veg", description: "Sweet-spicy potato filling in a pav with peanuts and pomegranate." },
      { category: "Sides", name: "Sabudana Vada", price: 69, foodType: "veg", description: "Crispy sago and peanut fritters." },
      { category: "Beverages", name: "Cutting Chai", price: 20, foodType: "veg", description: "Classic small-glass Mumbai-style tea." },
    ],
  },

  biryaniblues: {
    categories: ["Starters", "Biryani", "Curries", "Accompaniments"],
    items: [
      { category: "Starters", name: "Chicken 65", price: 229, foodType: "non-veg", description: "Deep-fried spicy Chettinad-style chicken bites.", isBestseller: true },
      { category: "Biryani", name: "Hyderabadi Chicken Biryani", price: 289, foodType: "non-veg", description: "Dum-cooked basmati rice layered with marinated chicken.", isBestseller: true },
      { category: "Biryani", name: "Mutton Biryani", price: 349, foodType: "non-veg", description: "Slow-cooked mutton and basmati rice in sealed dum style." },
      { category: "Biryani", name: "Veg Dum Biryani", price: 219, foodType: "veg", description: "Mixed vegetables and basmati rice cooked in dum style." },
      { category: "Curries", name: "Mirchi Ka Salan", price: 149, foodType: "veg", description: "Tangy peanut and sesame curry with green chillies." },
      { category: "Accompaniments", name: "Raita", price: 59, foodType: "veg", description: "Cooling spiced yogurt side." },
      { category: "Accompaniments", name: "Shahi Tukda", price: 129, foodType: "veg", description: "Fried bread soaked in sweetened rabri." },
    ],
  },

  southspicekitchen: {
    categories: ["Tiffin", "Main Course", "Beverages"],
    items: [
      { category: "Tiffin", name: "Masala Dosa", price: 129, foodType: "veg", description: "Crisp rice crepe filled with spiced potato masala.", isBestseller: true },
      { category: "Tiffin", name: "Idli Sambar", price: 99, foodType: "veg", description: "Steamed rice cakes served with lentil sambar and chutney.", isBestseller: true },
      { category: "Tiffin", name: "Medu Vada", price: 89, foodType: "veg", description: "Crispy fried lentil doughnuts." },
      { category: "Tiffin", name: "Rava Uttapam", price: 119, foodType: "veg", description: "Semolina pancake topped with onions and chillies." },
      { category: "Main Course", name: "Curd Rice", price: 109, foodType: "veg", description: "Comfort rice tempered and mixed with yogurt." },
      { category: "Beverages", name: "Filter Coffee", price: 49, foodType: "veg", description: "Strong South Indian filter coffee with chicory." },
    ],
  },

  wokthisway: {
    categories: ["Starters", "Noodles & Rice", "Main Course"],
    items: [
      { category: "Starters", name: "Veg Spring Rolls", price: 179, foodType: "veg", description: "Crispy rolls stuffed with julienned vegetables." },
      { category: "Starters", name: "Chilli Paneer", price: 229, foodType: "veg", description: "Wok-tossed paneer in spicy soy-chilli sauce.", isBestseller: true },
      { category: "Starters", name: "Dragon Chicken", price: 259, foodType: "non-veg", description: "Crispy chicken tossed in a fiery dragon sauce." },
      { category: "Noodles & Rice", name: "Hakka Noodles", price: 189, foodType: "veg", description: "Stir-fried noodles with vegetables and soy sauce.", isBestseller: true },
      { category: "Noodles & Rice", name: "Schezwan Fried Rice", price: 199, foodType: "veg", description: "Fried rice tossed in spicy schezwan sauce." },
      { category: "Main Course", name: "Chicken Manchurian", price: 249, foodType: "non-veg", description: "Fried chicken tossed in a tangy manchurian gravy." },
    ],
  },

  theburgerbunker: {
    categories: ["Burgers", "Sides", "Shakes"],
    items: [
      { category: "Burgers", name: "Classic Chicken Burger", price: 179, foodType: "non-veg", description: "Grilled chicken patty with lettuce and house sauce.", isBestseller: true },
      { category: "Burgers", name: "Double Cheese Veg Burger", price: 159, foodType: "veg", description: "Crispy veg patty loaded with double cheese.", isBestseller: true },
      { category: "Burgers", name: "Peri Peri Paneer Burger", price: 169, foodType: "veg", description: "Spiced peri peri paneer patty burger." },
      { category: "Sides", name: "Peri Peri Fries", price: 129, foodType: "veg", description: "Crispy fries tossed in peri peri seasoning." },
      { category: "Sides", name: "Loaded Nachos", price: 189, foodType: "veg", description: "Nachos topped with cheese, salsa and jalapenos." },
      { category: "Shakes", name: "Oreo Cold Coffee Shake", price: 149, foodType: "veg", description: "Cold coffee blended with Oreo crumbs." },
    ],
  },

  pizzajunction: {
    categories: ["Pizzas", "Sides", "Pasta"],
    items: [
      { category: "Pizzas", name: "Margherita Pizza", price: 199, foodType: "veg", description: "Classic pizza with tomato, mozzarella and basil.", isBestseller: true },
      { category: "Pizzas", name: "Farmhouse Pizza", price: 279, foodType: "veg", description: "Loaded with capsicum, onion, tomato and mushroom." },
      { category: "Pizzas", name: "Chicken Tikka Pizza", price: 329, foodType: "non-veg", description: "Tandoori chicken tikka on a cheesy pizza base.", isBestseller: true },
      { category: "Sides", name: "Cheesy Garlic Bread", price: 149, foodType: "veg", description: "Toasted bread loaded with garlic butter and cheese." },
      { category: "Pasta", name: "Penne Alfredo", price: 229, foodType: "veg", description: "Penne pasta in a creamy white sauce." },
      { category: "Pasta", name: "Chicken Arrabiata", price: 259, foodType: "non-veg", description: "Pasta in a spicy tomato-chilli sauce with chicken." },
    ],
  },

  tandoorinights: {
    categories: ["Kebabs", "Main Course", "Breads"],
    items: [
      { category: "Kebabs", name: "Seekh Kebab", price: 259, foodType: "non-veg", description: "Minced mutton skewers grilled in the tandoor.", isBestseller: true },
      { category: "Kebabs", name: "Chicken Malai Tikka", price: 279, foodType: "non-veg", description: "Creamy marinated chicken chunks, tandoor-grilled.", isBestseller: true },
      { category: "Kebabs", name: "Paneer Tikka Achari", price: 239, foodType: "veg", description: "Pickle-spiced grilled cottage cheese." },
      { category: "Main Course", name: "Mutton Rogan Josh", price: 379, foodType: "non-veg", description: "Slow-cooked mutton curry in aromatic Kashmiri spices." },
      { category: "Main Course", name: "Tandoori Chicken (Half)", price: 269, foodType: "non-veg", description: "Classic charcoal-grilled tandoori chicken." },
      { category: "Breads", name: "Roomali Roti", price: 49, foodType: "veg", description: "Thin handkerchief-style whole wheat bread." },
    ],
  },

  sweettoothbakerydesserts: {
    categories: ["Cakes", "Pastries", "Indian Sweets", "Bakes"],
    items: [
      { category: "Cakes", name: "Chocolate Truffle Cake (Slice)", price: 129, foodType: "veg", description: "Rich chocolate sponge layered with truffle ganache.", isBestseller: true },
      { category: "Cakes", name: "Red Velvet Slice", price: 139, foodType: "veg", description: "Classic red velvet with cream cheese frosting." },
      { category: "Pastries", name: "Chocolate Croissant", price: 99, foodType: "veg", description: "Buttery, flaky croissant filled with chocolate." },
      { category: "Pastries", name: "Fudge Brownie", price: 89, foodType: "veg", description: "Dense chocolate brownie with walnuts.", isBestseller: true },
      { category: "Indian Sweets", name: "Gulab Jamun (2 pc)", price: 79, foodType: "veg", description: "Soft milk dumplings soaked in sugar syrup." },
      { category: "Bakes", name: "New York Cheesecake", price: 159, foodType: "veg", description: "Creamy baked cheesecake with a biscuit base." },
    ],
  },

  cafebrewbites: {
    categories: ["Coffee & Beverages", "Sandwiches", "Light Bites"],
    items: [
      { category: "Coffee & Beverages", name: "Cappuccino", price: 129, foodType: "veg", description: "Espresso with steamed milk foam.", isBestseller: true },
      { category: "Coffee & Beverages", name: "Cold Brew", price: 149, foodType: "veg", description: "Slow-steeped smooth cold coffee." },
      { category: "Sandwiches", name: "Club Sandwich", price: 199, foodType: "non-veg", description: "Triple-layered sandwich with chicken, egg and veggies.", isBestseller: true },
      { category: "Sandwiches", name: "Veg Grilled Sandwich", price: 149, foodType: "veg", description: "Grilled sandwich with cheese and mixed vegetables." },
      { category: "Light Bites", name: "Pasta in White Sauce", price: 219, foodType: "veg", description: "Creamy white sauce pasta with herbs." },
      { category: "Light Bites", name: "Blueberry Muffin", price: 89, foodType: "veg", description: "Soft muffin loaded with blueberries." },
    ],
  },
};

async function seedRestaurantMenu(slug, data) {
  const restaurant = await RestaurantPartner.findOne({ email: `${slug}@seed.sevenbites.com` });
  if (!restaurant) {
    console.log(`Skipping "${slug}" — no restaurant found. Run seedRestaurants.js first.`);
    return;
  }

  console.log(`\n--- ${restaurant.restaurantName} ---`);

  // Upsert categories, keep a name -> _id map
  const categoryMap = {};
  for (let i = 0; i < data.categories.length; i++) {
    const name = data.categories[i];
    const category = await Category.findOneAndUpdate(
      { restaurant: restaurant._id, name },
      { $set: { restaurant: restaurant._id, name, order: i, status: "active" } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    categoryMap[name] = category._id;
  }

  for (const item of data.items) {
    await MenuItem.findOneAndUpdate(
      { restaurant: restaurant._id, name: item.name },
      {
        $set: {
          restaurant: restaurant._id,
          category: categoryMap[item.category],
          name: item.name,
          description: item.description,
          price: item.price,
          foodType: item.foodType,
          isBestseller: !!item.isBestseller,
          isAvailable: true,
          images: [],
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log(`  ${item.name} — ₹${item.price} (${item.foodType})`);
  }
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB");

  for (const slug of Object.keys(MENUS)) {
    await seedRestaurantMenu(slug, MENUS[slug]);
  }

  console.log("\nDone seeding menus for all restaurants.");
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});