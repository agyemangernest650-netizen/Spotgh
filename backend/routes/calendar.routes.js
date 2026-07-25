// backend/routes/calendar.routes.js
const router = require('express').Router();
const { supabaseAdmin } = require('../config/supabase');
const { verifyToken, requireOwnership } = require('../middleware/auth.middleware');
const gcal = require('../services/googleCalendar.service');
const env = require('../config/env');

// GET /api/calendar/:id/connect — owner clicks "Connect Google Calendar",
// gets redirected to Google's consent screen.
router.get('/:id/connect', verifyToken, requireOwnership, (req, res) => {
  if (!gcal.isConfigured) return res.status(503).json({ error: 'Google Calendar sync is not configured on this server.' });
  res.redirect(gcal.getAuthUrl(req.params.id));
});

// GET /api/calendar/callback — Google redirects here after consent.
// Not behind verifyToken: Google's redirect is a plain browser navigation
// with no way to attach our auth header, so ownership is instead enforced
// by state carrying the exact business ID that requested the /connect
// redirect in the first place — nothing else lets a caller choose it.
router.get('/callback', async (req, res) => {
  try {
    const { code, state: businessId, error: oauthError } = req.query;
    if (oauthError) return res.redirect(`${env.APP_URL}/pages/business-edit.html?id=${businessId}&calendar=denied`);
    if (!code || !businessId) return res.redirect(`${env.APP_URL}/pages/dashboard.html?calendar=error`);

    const refreshToken = await gcal.exchangeCodeForRefreshToken(code);
    if (!refreshToken) {
      // Google only issues a refresh_token on first-ever consent for this
      // app+account pair. If we don't already have one stored, ask them to
      // revoke access in their Google Account and reconnect to force a new one.
      const { data: biz } = await supabaseAdmin.from('businesses').select('google_calendar_refresh_token').eq('id', businessId).maybeSingle();
      if (!biz?.google_calendar_refresh_token)
        return res.redirect(`${env.APP_URL}/pages/business-edit.html?id=${businessId}&calendar=reauth_needed`);
      await supabaseAdmin.from('businesses').update({ google_calendar_connected: true }).eq('id', businessId);
      return res.redirect(`${env.APP_URL}/pages/business-edit.html?id=${businessId}&calendar=connected`);
    }

    await supabaseAdmin.from('businesses').update({
      google_calendar_connected: true,
      google_calendar_refresh_token: refreshToken,
    }).eq('id', businessId);
    res.redirect(`${env.APP_URL}/pages/business-edit.html?id=${businessId}&calendar=connected`);
  } catch (err) {
    res.redirect(`${env.APP_URL}/pages/dashboard.html?calendar=error`);
  }
});

// DELETE /api/calendar/:id/disconnect
router.delete('/:id/disconnect', verifyToken, requireOwnership, async (req, res, next) => {
  try {
    await supabaseAdmin.from('businesses').update({
      google_calendar_connected: false,
      google_calendar_refresh_token: null,
    }).eq('id', req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// GET /api/calendar/:id/status
router.get('/:id/status', verifyToken, requireOwnership, async (req, res, next) => {
  try {
    const { data } = await supabaseAdmin.from('businesses').select('google_calendar_connected').eq('id', req.params.id).single();
    res.json({ connected: !!data?.google_calendar_connected, available: gcal.isConfigured });
  } catch (err) { next(err); }
});

module.exports = router;
