// backend/services/cloudinary.service.js
const { cloudinary, deleteImage, optimizedUrl } = require('../config/cloudinary');

// Delete old image before uploading new one
const replaceImage = async (oldPublicId, newPublicId) => {
  if (oldPublicId && oldPublicId !== newPublicId) {
    await deleteImage(oldPublicId);
  }
};

// Build a gallery array from multer files
const buildGalleryItems = (files, businessId, existingCount = 0, type = 'gallery') =>
  files.map((f, i) => ({
    business_id: businessId,
    type,
    url: f.path,
    public_id: f.filename,
    sort_order: existingCount + i,
  }));

module.exports = { deleteImage, optimizedUrl, replaceImage, buildGalleryItems };
