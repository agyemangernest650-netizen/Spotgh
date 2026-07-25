// backend/middleware/rateLimit.middleware.js
const rateLimit = require('express-rate-limit');

const make = (windowMs, max, message) =>
  rateLimit({ windowMs, max, message: { error: message }, standardHeaders: true, legacyHeaders: false });

module.exports = {
  global:   make(15 * 60 * 1000, 200, 'Too many requests, please try again later.'),
  auth:     make(15 * 60 * 1000,  15, 'Too many auth attempts, please wait.'),
  upload:   make(60  * 1000,      20, 'Too many uploads, slow down.'),
  payments: make(60  * 1000,      30, 'Too many payment requests.'),
  ai:       make(60  * 1000,      10, 'Too many AI requests.'),
  reviews:  make(60  * 60 * 1000,  5, 'Review submission limit reached, try again later.'),
  search:   make(15  * 60 * 1000, 100, 'Too many searches, please slow down.'),
  contact:  make(60  * 60 * 1000,  5, 'Too many messages sent, please try again later.'),
  api:      make(60  * 1000,     120, 'API rate limit exceeded. Max 120 requests/minute.'),
  orders:   make(60  * 1000,      10, 'Too many orders placed, please slow down.'),
  messages: make(60  * 1000,      20, 'Too many messages sent, please slow down.'),
};
