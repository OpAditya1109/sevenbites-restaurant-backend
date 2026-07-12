const multer = require("multer");

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const fileFilter = (req, file, cb) => {
  if (!IMAGE_TYPES.includes(file.mimetype)) {
    return cb(new Error(`${file.fieldname}: only JPG, PNG, or WEBP images are allowed`));
  }
  cb(null, true);
};

// Used across Restaurant Profile (logo/cover), Categories (category image),
// and Menu Management (item images) — kept separate from the onboarding
// `cloudinaryUpload` middleware so onboarding document rules stay untouched.
const setupImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per image
  fileFilter,
});

// Separate, slightly larger-limit uploader for CSV bulk menu import
const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB CSV
  fileFilter: (req, file, cb) => {
    const okTypes = ["text/csv", "application/vnd.ms-excel", "application/octet-stream"];
    if (!okTypes.includes(file.mimetype) && !file.originalname.toLowerCase().endsWith(".csv")) {
      return cb(new Error("Only .csv files are allowed for bulk import"));
    }
    cb(null, true);
  },
});

module.exports = { setupImageUpload, csvUpload };