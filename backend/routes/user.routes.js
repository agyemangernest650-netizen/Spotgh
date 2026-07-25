const router = require('express').Router();
const ctrl   = require('../controllers/user.controller');
const { verifyToken } = require('../middleware/auth.middleware');

router.get  ('/notifications',          verifyToken, ctrl.getNotifications);
router.patch('/notifications/read-all', verifyToken, ctrl.markAllRead);
router.patch('/notifications/:id/read', verifyToken, ctrl.markOneRead);
router.patch('/profile',                verifyToken, ctrl.updateProfile);
router.get  ('/referral/code',          verifyToken, ctrl.getReferralCode);
router.post ('/referral/apply',         verifyToken, ctrl.applyReferral);
router.get  ('/analytics/:businessId',  verifyToken, ctrl.getAnalytics);

router.get   ('/favorites',                verifyToken, ctrl.getFavorites);
router.post  ('/favorites/:businessId',    verifyToken, ctrl.addFavorite);
router.delete('/favorites/:businessId',    verifyToken, ctrl.removeFavorite);
router.get   ('/favorite-products',              verifyToken, ctrl.getFavoriteProducts);
router.post  ('/favorite-products/:productId',   verifyToken, ctrl.addFavoriteProduct);
router.delete('/favorite-products/:productId',   verifyToken, ctrl.removeFavoriteProduct);

module.exports = router;
