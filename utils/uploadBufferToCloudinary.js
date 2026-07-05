const streamifier = require("streamifier");
const { cloudinary } = require("../middleware/cloudinaryUpload");

function uploadBufferToCloudinary(buffer, folder, resourceType = "image") {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
}

module.exports = uploadBufferToCloudinary;
