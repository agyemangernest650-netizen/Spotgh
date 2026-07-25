// backend/routes/reports.routes.js
// "Report this Business" — any logged-in user can flag a listing for
// moderation (fake, permanently closed, fraud, inappropriate, duplicate).
const router = require('express').Router();
const { supabaseAdmin } = require('../config/supabase');
const { verifyToken, requireAdmin } = require('../middleware/auth.middleware');
const { notify, audit, paginate } = require('../services/supabase.service');
const limits = require('../middleware/rateLimit.middleware');

const REASONS = ['fake', 'closed', 'fraud', 'inappropriate', 'duplicate', 'other'];

// ── Submit a report (any logged-in user) ────────────────────────
router.post('/:businessId', verifyToken, limits.contact, async (req, res, next) => {
  try {
    const { reason, details } = req.body;
    if (!reason || !REASONS.includes(reason))
      return res.status(400).json({ error: `reason must be one of: ${REASONS.join(', ')}` });

    const { data: biz } = await supabaseAdmin.from('businesses').select('id').eq('id', req.params.businessId).maybeSingle();
    if (!biz) return res.status(404).json({ error: 'Business not found' });

    const { data: existing } = await supabaseAdmin.from('business_reports')
      .select('id').eq('business_id', biz.id).eq('reported_by', req.user.id).eq('status', 'open').maybeSingle();
    if (existing) return res.status(409).json({ error: 'You already have an open report for this business' });

    const { data, error } = await supabaseAdmin.from('business_reports').insert({
      business_id: biz.id, reported_by: req.user.id, reason, details: details || null,
    }).select().single();
    if (error) throw error;

    // Auto-flag after 3+ open reports so the creator sees it without digging
    const { count } = await supabaseAdmin.from('business_reports')
      .select('id', { count: 'exact', head: true }).eq('business_id', biz.id).eq('status', 'open');
    if (count >= 3) await supabaseAdmin.from('businesses').update({ is_flagged: true, flag_reason: 'Multiple user reports' }).eq('id', biz.id);

    res.status(201).json({ report: data, message: 'Report submitted. Thanks for helping keep SpotGH trustworthy.' });
  } catch (err) { next(err); }
});

// ── Creator: list open reports ───────────────────────────────────
router.get('/open', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const { from, to, page: pg, limit: lm } = paginate(page, limit);
    const { data, count, error } = await supabaseAdmin.from('business_reports')
      .select('*,businesses(name,slug,city),users!business_reports_reported_by_fkey(full_name,email)', { count: 'exact' })
      .eq('status', 'open').order('created_at', { ascending: false }).range(from, to);
    if (error) throw error;
    res.json({ reports: data, pagination: { total: count, page: pg, limit: lm } });
  } catch (err) { next(err); }
});

// ── Creator: resolve (action taken — e.g. business suspended/edited) ─────
router.patch('/:id/resolve', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { data: rep } = await supabaseAdmin.from('business_reports').select('*').eq('id', req.params.id).single();
    if (!rep) return res.status(404).json({ error: 'Report not found' });

    await supabaseAdmin.from('business_reports').update({
      status: 'resolved', reviewed_by: req.user.id, reviewed_at: new Date().toISOString(),
    }).eq('id', rep.id);
    await audit(req.user.id, 'resolve_report', 'business', rep.business_id, null, { report_id: rep.id }, req);

    res.json({ message: 'Report marked resolved' });
  } catch (err) { next(err); }
});

// ── Creator: dismiss (no action needed) ───────────────────────────
router.patch('/:id/dismiss', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { data: rep } = await supabaseAdmin.from('business_reports').select('*').eq('id', req.params.id).single();
    if (!rep) return res.status(404).json({ error: 'Report not found' });

    await supabaseAdmin.from('business_reports').update({
      status: 'dismissed', reviewed_by: req.user.id, reviewed_at: new Date().toISOString(),
    }).eq('id', rep.id);

    // If this was the last open report, clear the auto-flag
    const { count } = await supabaseAdmin.from('business_reports')
      .select('id', { count: 'exact', head: true }).eq('business_id', rep.business_id).eq('status', 'open');
    if (!count) await supabaseAdmin.from('businesses').update({ is_flagged: false, flag_reason: null }).eq('id', rep.business_id);

    await audit(req.user.id, 'dismiss_report', 'business', rep.business_id, null, { report_id: rep.id }, req);
    res.json({ message: 'Report dismissed' });
  } catch (err) { next(err); }
});

module.exports = router;
