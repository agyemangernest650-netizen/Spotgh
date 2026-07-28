// backend/routes/subscriptions.routes.js
const router = require('express').Router();
const { supabaseAdmin } = require('../config/supabase');
const { verifyToken, requireAdmin, requireCreator, requireOwnership, optionalAuth } = require('../middleware/auth.middleware');
const { paginate, notify, audit } = require('../services/supabase.service');
const cache = require('../services/cache.service');
const limits = require('../middleware/rateLimit.middleware');

// Public — the pricing page needs to list active plans for anonymous
// visitors. /creator/plans is locked to the super-admin (router.use
// verifyToken, requireCreator in creator.routes.js), so it can never be
// used here; this is the only endpoint that actually returns plan data
// to a normal visitor.
router.get('/plans', async (req, res, next) => {
  try {
    const data = await cache.wrap('plans:active', 5 * 60 * 1000, async () => {
      const { data, error } = await supabaseAdmin
        .from('plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data || [];
    });
    res.json({ plans: data });
  } catch (err) { next(err); }
});

// ============================================================
// v2: independent Directory / Website / Bundle plans (migration 018)
// ============================================================
router.get('/directory-plans', async (req, res, next) => {
  try {
    const data = await cache.wrap('directory_plans:active', 5 * 60 * 1000, async () => {
      const { data, error } = await supabaseAdmin.from('directory_plans').select('*').eq('is_active', true).order('sort_order');
      if (error) throw error;
      return data || [];
    });
    res.json({ plans: data });
  } catch (err) { next(err); }
});

router.get('/website-plans', async (req, res, next) => {
  try {
    const data = await cache.wrap('website_plans:active', 5 * 60 * 1000, async () => {
      const { data, error } = await supabaseAdmin.from('website_plans').select('*').eq('is_active', true).order('sort_order');
      if (error) throw error;
      return data || [];
    });
    res.json({ plans: data });
  } catch (err) { next(err); }
});

router.get('/bundles', async (req, res, next) => {
  try {
    const data = await cache.wrap('bundles:active', 5 * 60 * 1000, async () => {
      const { data, error } = await supabaseAdmin.from('bundles').select('*,directory_plans(*),website_plans(*)').eq('is_active', true).order('sort_order');
      if (error) throw error;
      return data || [];
    });
    res.json({ bundles: data });
  } catch (err) { next(err); }
});

// GET /api/subscriptions/status-v2?business_id= — what a specific business
// currently has on each track, for the dashboard's "Manage Plan" screens.
router.get('/status-v2', verifyToken, async (req, res, next) => {
  try {
    const { getDirectoryAccess, getWebsiteAccess } = require('../services/planAccess.service');
    const business_id = req.query.business_id;
    if (!business_id) return res.status(400).json({ error: 'business_id is required' });
    const [directory, website] = await Promise.all([getDirectoryAccess(business_id), getWebsiteAccess(business_id)]);
    res.json({
      directory: directory ? { tier: directory.plan.tier, name: directory.plan.name, expires_at: directory.subscription?.expires_at || null } : null,
      website: website ? { tier: website.plan.tier, name: website.plan.name, expires_at: website.subscription?.expires_at || null, is_trial: !!website.subscription?.is_trial } : null,
    });
  } catch (err) { next(err); }
});

router.get('/active', verifyToken, async (req, res, next) => {
  try {
    const { data } = await supabaseAdmin.from('subscriptions').select('*,plans(*)').eq('user_id',req.user.id).eq('status','active').gt('expires_at',new Date().toISOString()).order('expires_at',{ascending:false}).limit(1);
    res.json({ subscription: data?.[0]||null });
  } catch (err) { next(err); }
});
router.get('/my', verifyToken, async (req, res, next) => {
  try {
    const { data } = await supabaseAdmin.from('subscriptions').select('*,plans(*),businesses(name,slug)').eq('user_id',req.user.id).order('created_at',{ascending:false});
    res.json({ subscriptions: data });
  } catch (err) { next(err); }
});
router.patch('/:id/cancel', verifyToken, async (req, res, next) => {
  try {
    const { reason } = req.body;
    const { data: sub } = await supabaseAdmin.from('subscriptions').select('user_id').eq('id',req.params.id).single();
    if (!sub || sub.user_id!==req.user.id) return res.status(403).json({ error:'Not authorized' });
    const { data, error } = await supabaseAdmin.from('subscriptions').update({ status:'cancelled', cancelled_at:new Date().toISOString(), cancel_reason:reason||null }).eq('id',req.params.id).select().single();
    if (error) throw error; res.json({ subscription:data, message:'Subscription cancelled. Access continues until expiry.' });
  } catch (err) { next(err); }
});
router.get('/status', verifyToken, async (req, res, next) => {
  try {
    const business_id = req.query.business_id || null;
    let q = supabaseAdmin.from('subscriptions').select('*,plans(*)').eq('user_id', req.user.id).order('expires_at', { ascending: false }).limit(1);
    if (business_id) q = q.eq('business_id', business_id);
    const { data } = await q;
    const sub = data?.[0] || null;
    if (!sub) return res.json({ subscription: null, tier: 'free', is_active: false, days_left: 0, message: 'No active plan. Start with Starter to publish your business.' });
    const now = new Date();
    const expires = new Date(sub.expires_at);
    const isActive = sub.status === 'active' && expires > now;
    const daysLeft = Math.max(0, Math.ceil((expires - now) / 86400000));
    let message = null;
    if (!isActive) message = `Your ${sub.tier} plan has ended. Renew it or upgrade to keep your listing live.`;
    else if (sub.tier === 'starter' && daysLeft <= 5) message = `Your Starter month ends in ${daysLeft} day${daysLeft===1?'':'s'}. Renew or upgrade anytime — it won't renew automatically.`;
    res.json({ subscription: sub, tier: isActive ? sub.tier : 'free', is_active: isActive, days_left: daysLeft, message });
  } catch (err) { next(err); }
});
module.exports = router;
