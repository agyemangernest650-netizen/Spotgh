const router = require('express').Router();
const ctrl   = require('../controllers/upload.controller');
const { verifyToken, requireOwnership } = require('../middleware/auth.middleware');
const { uploaders } = require('../config/cloudinary');
const limits = require('../middleware/rateLimit.middleware');

router.use(verifyToken, limits.upload);

router.get   ('/:id/gallery',                                                        ctrl.getGallery);
router.patch ('/:id/gallery/reorder', requireOwnership, async (req, res, next) => {
  try {
    const { photo_ids } = req.body;
    if (!Array.isArray(photo_ids)) return res.status(400).json({ error: 'photo_ids array required' });
    const { supabaseAdmin } = require('../config/supabase');
    await Promise.all(photo_ids.map((id, idx) =>
      supabaseAdmin.from('business_media').update({ sort_order: idx }).eq('id', id).eq('business_id', req.params.id)
    ));
    res.json({ message: 'Order saved' });
  } catch (err) { next(err); }
});
router.post  ('/:id/logo',    requireOwnership, uploaders.logo.single('logo'),       ctrl.uploadLogo);
router.post  ('/:id/cover',   requireOwnership, uploaders.cover.single('cover'),     ctrl.uploadCover);
router.post  ('/:id/menu',    requireOwnership, uploaders.menu.single('menu'),       ctrl.uploadMenu);
router.post  ('/:id/gallery', requireOwnership, uploaders.gallery.array('images',10),ctrl.uploadGallery);
router.delete('/:id/gallery/:mediaId', requireOwnership,                             ctrl.deleteGallery);
router.post  ('/:id/product/:itemId', requireOwnership, uploaders.product.single('image'), ctrl.uploadProductImage);
router.post  ('/:id/staff-photo', requireOwnership, uploaders.staff.single('photo'), ctrl.uploadStaffPhoto);
router.post  ('/avatar',               uploaders.avatar.single('avatar'),            ctrl.uploadAvatar);

module.exports = router;
