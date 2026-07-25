// backend/routes/apiV1.routes.js
// Public, read-only API for Enterprise-plan businesses. Authenticated via
// an `X-API-Key` header (generated from the dashboard — see
// business.controller.js createApiKey). A key can only ever read the one
// business it was issued for.
const router = require('express').Router();
const crypto = require('crypto');
const { supabaseAdmin } = require('../config/supabase');
const limits = require('../middleware/rateLimit.middleware');

async function apiKeyAuth(req, res, next) {
  try {
    const raw = req.headers['x-api-key'];
    if (!raw) return res.status(401).json({ error: 'Missing X-API-Key header' });
    const hash = crypto.createHash('sha256').update(raw).digest('hex');
    const { data: key } = await supabaseAdmin.from('api_keys').select('id,business_id,revoked_at').eq('key_hash', hash).is('revoked_at', null).maybeSingle();
    if (!key) return res.status(401).json({ error: 'Invalid or revoked API key' });

    // Re-check on every request, not just at key-creation time — a business
    // that's since downgraded off Enterprise (or been suspended) shouldn't
    // keep working just because its key hasn't been explicitly revoked.
    const { data: biz } = await supabaseAdmin.from('businesses').select('subscription_tier,status').eq('id', key.business_id).single();
    const { data: plan } = await supabaseAdmin.from('plans').select('has_api_access').eq('tier', biz?.subscription_tier).single();
    if (!plan?.has_api_access) return res.status(403).json({ error: 'This business\'s plan no longer includes API access.' });
    if (biz?.status !== 'active') return res.status(403).json({ error: 'This business is not currently active.' });

    supabaseAdmin.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', key.id).then(() => {}, () => {});
    req.apiBusinessId = key.business_id;
    next();
  } catch (err) { next(err); }
}

// Rate limit BEFORE auth — otherwise a flood of invalid-key requests never
// hits the limiter (auth returns 401 before next() is called), so failed
// attempts could be repeated unlimited times.
router.use(limits.api, apiKeyAuth);

// GET /api/v1/business — your own business profile
router.get('/business', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('businesses_with_stats').select('*').eq('id', req.apiBusinessId).single();
    if (error || !data) return res.status(404).json({ error: 'Business not found' });
    res.json({ business: data });
  } catch (err) { next(err); }
});

// GET /api/v1/products — your own products/services
router.get('/products', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('products_services').select('*').eq('business_id', req.apiBusinessId).eq('is_available', true);
    if (error) throw error;
    res.json({ products: data || [] });
  } catch (err) { next(err); }
});

// GET /api/v1/reviews — your own approved reviews, paginated
router.get('/reviews', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const { data, error, count } = await supabaseAdmin.from('reviews')
      .select('rating,comment,created_at', { count: 'exact' }).eq('business_id', req.apiBusinessId).eq('status', 'approved')
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);
    if (error) throw error;
    res.json({ reviews: data || [], pagination: { page, limit, total: count } });
  } catch (err) { next(err); }
});

// GET /api/v1/bookings — your own bookings, paginated (requires has_bookings too)
router.get('/bookings', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const { data, error, count } = await supabaseAdmin.from('bookings')
      .select('*', { count: 'exact' }).eq('business_id', req.apiBusinessId)
      .order('booking_date', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);
    if (error) throw error;
    res.json({ bookings: data || [], pagination: { page, limit, total: count } });
  } catch (err) { next(err); }
});

// GET /api/v1/orders — your own orders, paginated (only meaningful if online ordering is enabled)
router.get('/orders', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const { data, error, count } = await supabaseAdmin.from('orders')
      .select('*, order_items(*)', { count: 'exact' }).eq('business_id', req.apiBusinessId)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);
    if (error) throw error;
    res.json({ orders: data || [], pagination: { page, limit, total: count } });
  } catch (err) { next(err); }
});

module.exports = router;
