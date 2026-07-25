// backend/routes/newsletter.routes.js
const router = require('express').Router();
const { supabaseAdmin } = require('../config/supabase');
const { verifyToken, requireAdmin } = require('../middleware/auth.middleware');
const { sendEmail, wrap } = require('../services/email.service');
const env = require('../config/env');
const limits = require('../middleware/rateLimit.middleware');

// ── Subscribe ──────────────────────────────────────────────────
router.post('/subscribe', limits.contact, async (req, res, next) => {
  try {
    const { email, city } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });
    const { error } = await supabaseAdmin.from('newsletter_subscribers').upsert(
      { email: email.toLowerCase().trim(), city: city || null, unsubscribed_at: null }, { onConflict: 'email' }
    );
    if (error) throw error;
    res.status(201).json({ message: 'Subscribed! Watch your inbox for new businesses and deals.' });
  } catch (err) { next(err); }
});

// ── Unsubscribe (one-click link in emails) ──────────────────────
router.get('/unsubscribe', async (req, res, next) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).send('Missing email');
    await supabaseAdmin.from('newsletter_subscribers').update({ unsubscribed_at: new Date().toISOString() }).eq('email', email.toLowerCase());
    res.send('<h2>You have been unsubscribed.</h2><p>You will no longer receive SpotGH emails.</p>');
  } catch (err) { next(err); }
});

// ── Admin: broadcast an email to all active subscribers ────────
router.post('/broadcast', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { subject, body_html } = req.body;
    if (!subject || !body_html) return res.status(400).json({ error: 'subject and body_html are required' });
    const { data: subs, error } = await supabaseAdmin.from('newsletter_subscribers').select('email').is('unsubscribed_at', null);
    if (error) throw error;

    const { data: broadcast } = await supabaseAdmin.from('newsletter_broadcasts').insert({
      subject, body_html, sent_by: req.user.id, recipient_count: subs.length,
    }).select().single();

    // Fire-and-forget in small batches so the request returns quickly
    (async () => {
      for (const s of subs) {
        const unsubLink = `${env.APP_URL}/api/newsletter/unsubscribe?email=${encodeURIComponent(s.email)}`;
        try { await sendEmail(s.email, subject, wrap(`${body_html}<p style="font-size:.75rem;color:#999;margin-top:2rem"><a href="${unsubLink}">Unsubscribe</a></p>`)); }
        catch (e) { console.error('Broadcast send failed for', s.email, e.message); }
      }
    })();

    res.status(202).json({ message: `Broadcast queued to ${subs.length} subscribers`, broadcast_id: broadcast.id });
  } catch (err) { next(err); }
});

router.get('/broadcasts', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('newsletter_broadcasts').select('*').order('sent_at', { ascending: false }).limit(50);
    if (error) throw error;
    res.json({ broadcasts: data });
  } catch (err) { next(err); }
});

module.exports = router;
