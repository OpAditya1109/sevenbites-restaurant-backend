const multer = require("multer");
const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const IMAGE_TYPES = ["image/jpeg", "image/png"];
const PDF_TYPE = "application/pdf";

const fileFilter = (req, file, cb) => {
  const { fieldname, mimetype } = file;

  if (["restaurantImages", "menuImages"].includes(fieldname)) {
    if (!IMAGE_TYPES.includes(mimetype)) {
      return cb(new Error(`${fieldname}: only JPG/PNG images are allowed`));
    }
  } else if (["fssaiCertificate", "gstCertificate"].includes(fieldname)) {
    if (mimetype !== PDF_TYPE) {
      return cb(new Error(`${fieldname}: only PDF files are allowed`));
    }
  } else if (fieldname === "chequeOrPassbook") {
    if (![...IMAGE_TYPES, PDF_TYPE].includes(mimetype)) {
      return cb(new Error("chequeOrPassbook: only JPG, PNG, or PDF files are allowed"));
    }
  }
  cb(null, true);
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file, matches spec for every file type
  fileFilter,
});

module.exports = upload;
module.exports.cloudinary = cloudinary;
