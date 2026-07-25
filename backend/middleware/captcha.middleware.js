// backend/middleware/captcha.middleware.js
const axios = require('axios');
const env = require('../config/env');

// Verifies an hCaptcha token from the request body (`h-captcha-response`,
// the field hCaptcha's widget auto-populates inside any <form> it sits in).
// If HCAPTCHA_SECRET isn't configured, this silently no-ops — same pattern
// as VAPID/push: don't block signups/logins in dev or before the site owner
// has set up a captcha account, but enforce it the moment the key exists.
const verifyCaptcha = async (req, res, next) => {
  if (!env.HCAPTCHA_SECRET) return next();

  const token = req.body['h-captcha-response'] || req.body.captchaToken;
  if (!token) return res.status(400).json({ error: 'Please complete the captcha.' });

  try {
    const { data } = await axios.post('https://hcaptcha.com/siteverify', new URLSearchParams({
      secret: env.HCAPTCHA_SECRET,
      response: token,
      ...(req.ip && { remoteip: req.ip }),
    }));
    if (!data.success) return res.status(400).json({ error: 'Captcha verification failed. Please try again.' });
    next();
  } catch {
    // If hCaptcha's own service is down, fail open rather than blocking every
    // signup/login on the site — a captcha outage shouldn't become a full outage.
    next();
  }
};

module.exports = { verifyCaptcha };
