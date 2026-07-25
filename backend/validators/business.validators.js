// backend/validators/business.validators.js
const { body } = require('express-validator');

const isYes = v => v === true || v === 'true';
const isNo  = v => v === false || v === 'false';

// Every new business must answer this — not optional. If they say yes,
// they must also give a valid URL; if no, nothing else is required (SpotGH
// builds the mini-website from the rest of the form, same as before).
//
// Note: uses custom()/if(fn) rather than isBoolean()/equals('true') —
// those both call validator.js's assertString() internally, which throws
// a TypeError on an actual JS boolean instead of a string. The frontend
// sends a real boolean (has_own_website: true/false) in the JSON body,
// not the string 'true', so isBoolean()/equals('true') would either crash
// the request or silently skip the "website required" check.
exports.createBusinessRules = [
  body('has_own_website')
    .custom(v => isYes(v) || isNo(v))
    .withMessage('Please tell us whether you already have a website'),
  body('website')
    .if((value, { req }) => isYes(req.body.has_own_website))
    .trim().notEmpty().withMessage('Please enter your website URL')
    .isURL({ require_protocol: true }).withMessage('Enter a valid website URL, including https://'),
];

