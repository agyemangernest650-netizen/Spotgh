// backend/routes/push.routes.js
const router = require('express').Router();
const webpush = require('web-push');
const { supabaseAdmin } = require('../config/supabase');
const { verifyToken, requireOwnership } = require('../middleware/auth.middleware');

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(`mailto:${process.env.SUPPORT_EMAIL || 'support@spotgh.com'}`, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
}

router.get('/vapid-public-key', (req, res) => res.json({ key: process.env.VAPID_PUBLIC_KEY || null }));

// ── Save a browser's push subscription ───────────────────────
router.post('/subscribe', verifyToken, async (req, res, next) => {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) return res.status(400).json({ error: 'Invalid subscription object' });
    const { error } = await supabaseAdmin.from('push_subscriptions').upsert(
      { user_id: req.user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth }, { onConflict: 'user_id,endpoint' }
    );
    if (error) throw error;
    res.status(201).json({ message: 'Push notifications enabled' });
  } catch (err) { next(err); }
});

router.post('/unsubscribe', verifyToken, async (req, res, next) => {
  try {
    const { endpoint } = req.body;
    await supabaseAdmin.from('push_subscriptions').delete().eq('user_id', req.user.id).eq('endpoint', endpoint);
    res.json({ message: 'Push notifications disabled' });
  } catch (err) { next(err); }
});

// ── Internal helper — call from anywhere (orders, bookings, leads, etc.) to push a notification ──
async function sendPush(userId, title, body, url = '/') {
  if (!process.env.VAPID_PUBLIC_KEY) return; // push not configured — silently skip
  const { data: subs } = await supabaseAdmin.from('push_subscriptions').select('*').eq('user_id', userId);
  for (const sub of subs || []) {
    const pushSub = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } };
    try { await webpush.sendNotification(pushSub, JSON.stringify({ title, body, url })); }
    catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id); // expired subscription
    }
  }
}

// ── Business owner: send a manual push to a customer (e.g. "order ready") ──
router.post('/business/:businessId/send', verifyToken, requireOwnership, async (req, res, next) => {
  try {
    const { user_id, title, body, url } = req.body;
    if (!user_id || !title || !body) return res.status(400).json({ error: 'user_id, title and body are required' });
    await sendPush(user_id, title, body, url);
    res.json({ message: 'Push sent (if the customer has notifications enabled)' });
  } catch (err) { next(err); }
});

module.exports = router;
module.exports.sendPush = sendPush;
