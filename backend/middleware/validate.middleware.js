// backend/middleware/validate.middleware.js
const { validationResult } = require('express-validator');

// Drop this after a chain of express-validator rules on any route. Collects
// all failures at once (rather than stopping at the first) so the frontend
// can show every problem in one round trip instead of one-error-per-submit.
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  return res.status(400).json({
    error: errors.array()[0].msg,
    errors: errors.array().map(e => ({ field: e.path, message: e.msg })),
  });
};

module.exports = { handleValidation };
