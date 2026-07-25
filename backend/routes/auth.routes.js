const router = require('express').Router();
const ctrl = require('../controllers/auth.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { verifyCaptcha } = require('../middleware/captcha.middleware');
const { handleValidation } = require('../middleware/validate.middleware');
const v = require('../validators/auth.validators');
const limits = require('../middleware/rateLimit.middleware');

router.post('/register',        limits.auth, v.registerRules, handleValidation, verifyCaptcha, ctrl.register);
router.post('/login',           limits.auth, v.loginRules, handleValidation, ctrl.login);
router.post('/login/2fa-complete', limits.auth, ctrl.completeTwoFactorLogin);
router.post('/oauth/exchange',  limits.auth, ctrl.oauthExchange);
router.post('/logout',                       ctrl.logout);
router.get ('/me',              verifyToken, ctrl.me);
router.patch('/profile',        verifyToken, ctrl.updateProfile);
router.post('/forgot-password', limits.auth, v.forgotPasswordRules, handleValidation, verifyCaptcha, ctrl.forgotPassword);
router.post('/resend-verification', limits.auth, ctrl.resendVerification);
router.post('/reset-password',  limits.auth, v.resetPasswordRules, handleValidation, ctrl.resetPassword);
router.patch('/password',       verifyToken, v.changePasswordRules, handleValidation, ctrl.changePassword);

module.exports = router;
