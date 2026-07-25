// backend/routes/sponsored.routes.js
const router = require('express').Router();
const { supabaseAdmin } = require('../config/supabase');
const { verifyToken, requireOwnership, requireAdmin } = require('../middleware/auth.middleware');

// ── Business: create a sponsorship campaign (payment is handled via your existing
// /api/payments flow — call this once the payment for the campaign succeeds) ──
router.post('/business/:businessId', verifyToken, requireOwnership, async (req, res, next) => {
  try {
    const { category_id, city, daily_budget, days } = req.body;
    if (!daily_budget || !days) return res.status(400).json({ error: 'daily_budget and days are required' });

    // Featured/sponsored listings are a Pro+ feature — this endpoint had no
    // plan check at all, so any tier (including Free/Starter) could buy a
    // campaign despite the pricing page saying otherwise.
    const { data: biz } = await supabaseAdmin.from('businesses').select('subscription_tier').eq('id', req.params.businessId).single();
    const { data: plan } = await supabaseAdmin.from('plans').select('has_priority_listing').eq('tier', biz?.subscription_tier).single();
    if (!plan?.has_priority_listing)
      return res.status(403).json({ error: 'Featured/sponsored listings are a Pro plan feature.', code: 'FEATURE_NOT_INCLUDED', redirect: '/pricing' });

    const startsOn = new Date(); const endsOn = new Date(); endsOn.setDate(endsOn.getDate() + Number(days));

    const { data, error } = await supabaseAdmin.from('sponsored_listings').insert({
      business_id: req.params.businessId, category_id: category_id || null, city: city || null,
      daily_budget, starts_on: startsOn.toISOString().slice(0, 10), ends_on: endsOn.toISOString().slice(0, 10),
    }).select().single();
    if (error) throw error;
    res.status(201).json({ campaign: data, total_cost: daily_budget * days });
  } catch (err) { next(err); }
});

// ── Business: view my campaigns ─────────────────────────────────
router.get('/business/:businessId', verifyToken, requireOwnership, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('sponsored_listings').select('*').eq('business_id', req.params.businessId).order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ campaigns: data });
  } catch (err) { next(err); }
});

router.patch('/:id/pause', verifyToken, async (req, res, next) => {
  try {
    const { data: existing } = await supabaseAdmin.from('sponsored_listings').select('business_id,businesses(owner_id)').eq('id', req.params.id).single();
    if (!existing) return res.status(404).json({ error: 'Campaign not found' });
    if (existing.businesses?.owner_id !== req.user.id && req.user.role !== 'creator') return res.status(403).json({ error: 'Not your campaign' });
    const { data, error } = await supabaseAdmin.from('sponsored_listings').update({ status: 'paused' }).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ campaign: data });
  } catch (err) { next(err); }
});

// ── Fetch active sponsored businesses for a given category/city (used by directory/search to inject "Sponsored" rows) ──
router.get('/active', async (req, res, next) => {
  try {
    const { category_id, city } = req.query;
    const today = new Date().toISOString().slice(0, 10);
    let q = supabaseAdmin.from('sponsored_listings')
      .select('id,business_id,businesses(id,name,slug,logo_url,cover_url,tagline,city,avg_rating,review_count,is_verified,subscription_tier,whatsapp,categories(name,icon))')
      .eq('status', 'active').lte('starts_on', today).gte('ends_on', today);
    if (category_id) q = q.eq('category_id', category_id);
    if (city) q = q.eq('city', city);
    const { data, error } = await q.limit(5);
    if (error) throw error;

    // Log an impression for each shown campaign (fire-and-forget)
    for (const d of data || []) {
      supabaseAdmin.from('sponsored_listings').select('impressions').eq('id', d.id).single()
        .then(({ data: row }) => row && supabaseAdmin.from('sponsored_listings').update({ impressions: row.impressions + 1 }).eq('id', d.id));
    }
    res.json({ sponsored: (data || []).filter(d => d.businesses).map(d => ({
      ...d.businesses, category_name: d.businesses.categories?.name, category_icon: d.businesses.categories?.icon,
      sponsored_listing_id: d.id,
    })) });
  } catch (err) { next(err); }
});

// ── Track a click on a sponsored listing ────────────────────────
router.post('/:id/click', async (req, res, next) => {
  try {
    const { data: row } = await supabaseAdmin.from('sponsored_listings').select('clicks').eq('id', req.params.id).single();
    if (row) await supabaseAdmin.from('sponsored_listings').update({ clicks: row.clicks + 1 }).eq('id', req.params.id);
    res.json({ tracked: true });
  } catch (err) { next(err); }
});

// ── Admin: all campaigns + performance ──────────────────────────
router.get('/', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('sponsored_listings').select('*,businesses(name,slug)').order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ campaigns: data });
  } catch (err) { next(err); }
});

module.exports = router;
