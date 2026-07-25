const router = require('express').Router();
const ctrl   = require('../controllers/business.controller');
const { verifyToken, optionalAuth, requireBusinessOwner, requireOwnership, requireAdmin, loadPlan } = require('../middleware/auth.middleware');
const { supabaseAdmin } = require('../config/supabase');
const { paginate, notify } = require('../services/supabase.service');
const { createBusinessRules } = require('../validators/business.validators');
const { handleValidation } = require('../middleware/validate.middleware');

// Public
router.get ('/',              optionalAuth, ctrl.list);
router.get ('/trending',                   ctrl.trending);
router.get ('/slug/:slug',    optionalAuth, ctrl.getBySlug);
router.post('/contact',                    ctrl.contact);
router.post('/:slug/track',                ctrl.track);

// ── Report a business (any logged-in user) ─────────────────────
router.post('/:id/report', verifyToken, async (req, res, next) => {
  try {
    const { reason, details } = req.body;
    if (!reason || !['fake','closed','fraud','inappropriate','duplicate','other'].includes(reason))
      return res.status(400).json({ error: 'Valid reason is required (fake, closed, fraud, inappropriate, duplicate, other)' });

    const { data: biz } = await supabaseAdmin.from('businesses').select('id').eq('id', req.params.id).maybeSingle();
    if (!biz) return res.status(404).json({ error: 'Business not found' });

    const { error } = await supabaseAdmin.from('business_reports').insert({
      business_id: req.params.id, reported_by: req.user.id, reason, details: details || null,
    });
    if (error) throw error;

    await supabaseAdmin.from('businesses')
      .update({ is_flagged: true, flag_reason: reason }).eq('id', req.params.id);

    res.status(201).json({ message: 'Report submitted. Thanks for helping keep SpotGH accurate.' });
  } catch (err) { next(err); }
});

// ── Creator: list flagged businesses ────────────────────────────
router.get('/flagged/list', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('businesses').select('id,name,slug,city,flag_reason,owner_id')
      .eq('is_flagged', true).order('updated_at', { ascending: false });
    if (error) throw error;
    res.json({ businesses: data || [] });
  } catch (err) { next(err); }
});

// ── Creator: full report history for one business ───────────────
router.get('/:id/reports', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('business_reports').select('*, users:reported_by(full_name,email)')
      .eq('business_id', req.params.id).order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ reports: data || [] });
  } catch (err) { next(err); }
});

// ── Creator: clear a business's flag ─────────────────────────────
router.patch('/:id/unflag', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    await supabaseAdmin.from('businesses').update({ is_flagged: false, flag_reason: null }).eq('id', req.params.id);
    await supabaseAdmin.from('business_reports').update({
      status: 'dismissed', reviewed_by: req.user.id, reviewed_at: new Date().toISOString(),
    }).eq('business_id', req.params.id).eq('status', 'open');
    res.json({ message: 'Flag cleared' });
  } catch (err) { next(err); }
});

// Auth required
router.get ('/my',            verifyToken,                        ctrl.myBusinesses);
router.get ('/saved',         verifyToken,                        ctrl.getSaved);
router.post('/saved/:id',     verifyToken,                        ctrl.toggleSave);
// Any signed-in account can register a business (role auto-upgrades to
// business_owner on success in the controller) — plan limits are enforced
// via loadPlan, not a role gate, since a brand-new user has no role yet.
router.post('/',              verifyToken, loadPlan, createBusinessRules, handleValidation, ctrl.create);

// Owner required
router.get   ('/:id',                     optionalAuth,             ctrl.getById);
router.patch ('/:id',                     verifyToken, requireOwnership, ctrl.update);
router.delete('/:id',                     verifyToken, requireOwnership, ctrl.remove);
router.get   ('/:id/health',              verifyToken, requireOwnership, ctrl.healthScore);

// Owner-only weekly stats teaser for the mini-website (full breakdown lives on /pages/analytics.html)
router.get('/:id/views-summary', verifyToken, requireOwnership, async (req, res, next) => {
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabaseAdmin
      .from('analytics_events').select('event_type')
      .eq('business_id', req.params.id).gte('created_at', since);
    if (error) throw error;
    const counts = (data || []).reduce((acc, e) => { acc[e.event_type] = (acc[e.event_type] || 0) + 1; return acc; }, {});
    res.json({ views_7d: counts.view || 0, clicks_7d: (data || []).length - (counts.view || 0) });
  } catch (err) { next(err); }
});

// Reviews for this business — business.js's "Reviews" tab calls these exact
// paths; they were never defined anywhere, so the tab silently failed.
router.get('/:id/reviews', optionalAuth, async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const { from, to, page: pg, limit: lm } = paginate(page, limit);
    const { data, count } = await supabaseAdmin
      .from('reviews')
      .select('*,users:reviewer_id(full_name,avatar_url)', { count: 'exact' })
      .eq('business_id', req.params.id).eq('status', 'approved')
      .order('created_at', { ascending: false })
      .range(from, to);
    const userReview = req.user ? (data || []).find(r => r.reviewer_id === req.user.id) || null : null;
    res.json({ reviews: data || [], total: count, page: pg, limit: lm, user_review: userReview });
  } catch (err) { next(err); }
});

router.post('/:id/reviews', verifyToken, async (req, res, next) => {
  try {
    const { rating, comment } = req.body;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'rating 1-5 required' });
    const { data: existing } = await supabaseAdmin.from('reviews')
      .select('id').eq('business_id', req.params.id).eq('reviewer_id', req.user.id).maybeSingle();
    if (existing) return res.status(409).json({ error: 'You have already reviewed this business' });
    const { data, error } = await supabaseAdmin.from('reviews')
      .insert({ business_id: req.params.id, reviewer_id: req.user.id, rating, content: comment || null })
      .select('*,users:reviewer_id(full_name,avatar_url)').single();
    if (error) throw error;
    const { data: biz } = await supabaseAdmin.from('businesses').select('name,owner_id,slug').eq('id', req.params.id).single();
    if (biz) await notify(biz.owner_id, 'success', `⭐ New ${rating}-star review for ${biz.name}`, (comment || '').slice(0, 100) || `${rating} star review received`, `/pages/business.html?slug=${biz.slug}`);
    res.status(201).json({ review: data });
  } catch (err) { next(err); }
});

router.get   ('/:id/products',            optionalAuth,             ctrl.getProducts);
router.post  ('/:id/products',            verifyToken, requireOwnership, loadPlan, ctrl.addProduct);
router.patch ('/:id/products/:itemId',    verifyToken, requireOwnership, ctrl.updateProduct);
router.delete('/:id/products/:itemId',    verifyToken, requireOwnership, ctrl.deleteProduct);

// ── Enterprise features: custom domain + API access ─────────
router.post  ('/:id/custom-domain',        verifyToken, requireOwnership, ctrl.setCustomDomain);
router.post  ('/:id/custom-domain/verify', verifyToken, requireOwnership, ctrl.verifyCustomDomain);
router.delete('/:id/custom-domain',        verifyToken, requireOwnership, ctrl.removeCustomDomain);
router.get   ('/:id/api-keys',             verifyToken, requireOwnership, ctrl.listApiKeys);
router.post  ('/:id/api-keys',             verifyToken, requireOwnership, ctrl.createApiKey);
router.delete('/:id/api-keys/:keyId',      verifyToken, requireOwnership, ctrl.revokeApiKey);

// Staff / team profiles — public list (shown on the mini-website), owner-only writes
router.get   ('/:id/staff',                                            ctrl.listStaff);
router.post  ('/:id/staff',                verifyToken, requireOwnership, ctrl.addStaff);
router.patch ('/:id/staff/:staffId',       verifyToken, requireOwnership, ctrl.updateStaff);
router.delete('/:id/staff/:staffId',       verifyToken, requireOwnership, ctrl.removeStaff);

module.exports = router;
