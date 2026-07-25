// backend/validators/auth.validators.js
const { body } = require('express-validator');

// Ghana numbers in either local (0XXXXXXXXX) or international (+233XXXXXXXXX)
// format; strips spaces/dashes first since the frontend's own placeholder
// ("+233 XX XXX XXXX") shows spaces as the expected format.
const phoneRule = body('phone').optional({ values: 'falsy' })
  .customSanitizer(v => typeof v === 'string' ? v.replace(/[\s-]/g, '') : v)
  .matches(/^(\+233|0)\d{9}$/).withMessage('Phone must be a valid Ghana number (e.g. 024XXXXXXX or +233XXXXXXXXX)');

exports.registerRules = [
  body('email').trim().isEmail().withMessage('A valid email is required').normalizeEmail({ gmail_remove_dots: false }),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('full_name').trim().isLength({ min: 2, max: 100 }).withMessage('Full name must be 2-100 characters')
    .matches(/^[\p{L}\s.'-]+$/u).withMessage('Full name contains invalid characters'),
  phoneRule,
];

exports.loginRules = [
  body('email').trim().isEmail().withMessage('A valid email is required').normalizeEmail({ gmail_remove_dots: false }),
  body('password').notEmpty().withMessage('Password is required'),
];

exports.forgotPasswordRules = [
  body('email').trim().isEmail().withMessage('A valid email is required').normalizeEmail({ gmail_remove_dots: false }),
];

exports.resetPasswordRules = [
  body('token').notEmpty().withMessage('Reset token is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
];

exports.changePasswordRules = [
  body('current_password').notEmpty().withMessage('Current password is required'),
  body('new_password').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
];
