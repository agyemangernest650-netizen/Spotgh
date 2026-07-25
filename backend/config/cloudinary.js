// backend/config/cloudinary.js
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const env = require('./env');

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key:    env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Factory — creates a multer+cloudinary storage for a given folder & transforms
const makeStorage = (folder, transforms = []) =>
  new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => ({
      folder: `spotgh/${folder}`,
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      transformation: transforms,
      public_id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    }),
  });

// Separate storage for non-image documents (PDF menus/price lists)
const makeRawStorage = (folder) =>
  new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => ({
      folder: `spotgh/${folder}`,
      resource_type: 'raw',
      allowed_formats: ['pdf'],
      public_id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    }),
  });

// Verification docs — accepts either an ID photo (jpg/png) or a scanned PDF certificate
const makeDocStorage = (folder) =>
  new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => ({
      folder: `spotgh/${folder}`,
      resource_type: file.mimetype === 'application/pdf' ? 'raw' : 'image',
      allowed_formats: ['jpg', 'jpeg', 'png', 'pdf'],
      public_id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    }),
  });

const fileFilter = (req, file, cb) =>
  file.mimetype.startsWith('image/')
    ? cb(null, true)
    : cb(new Error('Only image files are allowed'), false);

const pdfFilter = (req, file, cb) =>
  file.mimetype === 'application/pdf'
    ? cb(null, true)
    : cb(new Error('Only PDF files are allowed'), false);

const limits = { fileSize: 10 * 1024 * 1024 }; // 10 MB

const uploaders = {
  logo:    multer({ storage: makeStorage('logos',   [{ width: 500,  height: 500,  crop: 'limit' }, { quality: 'auto', fetch_format: 'auto' }]), fileFilter, limits }),
  cover:   multer({ storage: makeStorage('covers',  [{ width: 1200, height: 400,  crop: 'fill', gravity: 'auto' }, { quality: 'auto', fetch_format: 'auto' }]), fileFilter, limits }),
  gallery: multer({ storage: makeStorage('gallery', [{ width: 1200, height: 900,  crop: 'limit' }, { quality: 'auto', fetch_format: 'auto' }]), fileFilter, limits }),
  product: multer({ storage: makeStorage('products',[{ width: 800,  height: 800,  crop: 'limit' }, { quality: 'auto', fetch_format: 'auto' }]), fileFilter, limits }),
  avatar:  multer({ storage: makeStorage('avatars', [{ width: 200,  height: 200,  crop: 'fill', gravity: 'face' }, { quality: 'auto', fetch_format: 'auto' }]), fileFilter, limits }),
  staff:   multer({ storage: makeStorage('staff',   [{ width: 300,  height: 300,  crop: 'fill', gravity: 'face' }, { quality: 'auto', fetch_format: 'auto' }]), fileFilter, limits }),
  menu:    multer({ storage: makeRawStorage('menus'), fileFilter: pdfFilter, limits: { fileSize: 15 * 1024 * 1024 } }),
  verification: multer({ storage: makeDocStorage('verification'), limits: { fileSize: 15 * 1024 * 1024 },
    fileFilter: (req, file, cb) =>
      ['image/jpeg','image/png','application/pdf'].includes(file.mimetype)
        ? cb(null, true)
        : cb(new Error('Only JPG, PNG, or PDF files are allowed'), false) }),
  claim: multer({ storage: makeDocStorage('claims'), limits: { fileSize: 15 * 1024 * 1024 },
    fileFilter: (req, file, cb) =>
      ['image/jpeg','image/png','application/pdf'].includes(file.mimetype)
        ? cb(null, true)
        : cb(new Error('Only JPG, PNG, or PDF files are allowed'), false) }),
};

const deleteImage = async (publicId, options = {}) => {
  if (!publicId) return;
  try { return await cloudinary.uploader.destroy(publicId, options); }
  catch (err) { console.error('[Cloudinary] Delete error:', err.message); }
};

const optimizedUrl = (publicId, opts = {}) =>
  cloudinary.url(publicId, { quality: 'auto', fetch_format: 'auto', ...opts });

module.exports = { cloudinary, uploaders, deleteImage, optimizedUrl };
