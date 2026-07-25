// backend/routes/search.routes.js
const router = require('express').Router();
const { supabaseAdmin } = require('../config/supabase');
const { verifyToken, requireAdmin, requireCreator, requireOwnership, optionalAuth } = require('../middleware/auth.middleware');
const { paginate, notify, audit, sanitizeSearchTerm } = require('../services/supabase.service');
const limits = require('../middleware/rateLimit.middleware');
router.get('/', async (req, res, next) => {
  try {
    const { q, category, location, min_rating, price_range, verified, open_now, page, limit } = req.query;
    const { from, to, page: pg, limit: lm } = paginate(page, limit);
    let qb = supabaseAdmin.from('businesses_with_stats').select('*', { count: 'exact' }).eq('status', 'active');
    if (q) { const s = sanitizeSearchTerm(q); qb = qb.or(`name.ilike.%${s}%,description.ilike.%${s}%,city.ilike.%${s}%`); }
    if (category) qb = qb.eq('category_slug', category);
    if (location) qb = qb.ilike('city', `%${location}%`);
    if (verified === 'true') qb = qb.eq('is_verified', true);
    if (min_rating) qb = qb.gte('avg_rating', Number(min_rating));
    if (price_range) qb = qb.in('price_range', price_range.split(','));

    if (open_now === 'true') {
      const { data, error } = await qb;
      if (error) throw error;
      const openOnly = data.filter(isOpenNow).sort((a, b) => (b.is_featured - a.is_featured) || (b.avg_rating - a.avg_rating));
      return res.json({ businesses: openOnly.slice(from, to + 1), pagination: { total: openOnly.length, page: pg, limit: lm, pages: Math.ceil(openOnly.length / lm) } });
    }

    const { data, count } = await qb.order('is_featured', { ascending: false }).order('avg_rating', { ascending: false }).range(from, to);
    res.json({ businesses: data, pagination: { total: count, page: pg, limit: lm, pages: Math.ceil(count / lm) } });
  } catch (err) { next(err); }
});

// Ghana runs on GMT/UTC+0 with no daylight saving, so the server's UTC clock
// is always local Ghana time — no timezone conversion needed here.
function isOpenNow(biz) {
  const hours = biz.operating_hours;
  if (!hours) return false;
  const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const now = new Date();
  const today = hours[days[now.getUTCDay()]];
  if (!today || today.closed || !today.open || !today.close) return false;
  const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes();
  const [oh, om] = today.open.split(':').map(Number);
  const [ch, cm] = today.close.split(':').map(Number);
  const openMin = oh * 60 + om, closeMin = ch * 60 + cm;
  return closeMin > openMin ? (nowMin >= openMin && nowMin < closeMin) : (nowMin >= openMin || nowMin < closeMin);
}
router.get('/autocomplete', async (req, res, next) => {
  try {
    const { q } = req.query; if (!q || q.length < 2) return res.json({ businesses: [], categories: [] });
    const [bizRes, catRes] = await Promise.all([
      supabaseAdmin.from('businesses').select('name,slug,city,logo_url').eq('status','active').ilike('name',`${q}%`).limit(5),
      supabaseAdmin.from('categories').select('name,slug,icon').eq('is_active',true).ilike('name',`${q}%`).limit(3),
    ]);
    res.json({ businesses: bizRes.data || [], categories: catRes.data || [] });
  } catch (err) { next(err); }
});

// POST /api/search/smart — "Find a tailor near East Legon under GH₵200"
router.post('/smart', optionalAuth, limits.ai, async (req, res, next) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'query is required' });
    if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'Smart search is not configured' });

    const { data: categories } = await supabaseAdmin.from('categories').select('id,name').is('parent_id', null);
    const catList = (categories || []).map(c => `${c.id}:${c.name}`).join(', ');

    const prompt = `You turn a shopper's plain-English search into structured filters for a Ghana business directory.
Query: "${query}"
Available categories (id:name): ${catList}
Respond ONLY with JSON: {"category_id": "<uuid or null>", "city": "<string or null>", "area": "<string or null, e.g. East Legon>", "max_price": <number or null>, "keywords": "<remaining descriptive keywords or null>"}`;

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 300, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!resp.ok) throw new Error('AI unavailable');
    const d = await resp.json();
    let filters = {};
    try { filters = JSON.parse((d.content?.[0]?.text || '{}').replace(/```json|```/g, '').trim()); } catch { filters = {}; }

    let qb = supabaseAdmin.from('businesses_with_stats').select('*').eq('status', 'active');
    if (filters.category_id) qb = qb.eq('category_id', filters.category_id);
    if (filters.city) qb = qb.ilike('city', `%${filters.city}%`);
    if (filters.area) { const s = sanitizeSearchTerm(filters.area); qb = qb.or(`address.ilike.%${s}%,name.ilike.%${s}%`); }
    if (filters.keywords) qb = qb.ilike('name', `%${filters.keywords}%`);
    const { data: results, error } = await qb.order('is_featured', { ascending: false }).order('avg_rating', { ascending: false }).limit(30);
    if (error) throw error;

    // Price filtering happens after the main query since prices live on products_services, not businesses
    let businesses = results;
    if (filters.max_price && results.length) {
      const ids = results.map(b => b.id);
      const { data: cheapEnough } = await supabaseAdmin.from('products_services').select('business_id').in('business_id', ids).lte('price', filters.max_price);
      const matchSet = new Set((cheapEnough || []).map(p => p.business_id));
      businesses = results.filter(b => matchSet.has(b.id));
    }

    res.json({ interpreted: filters, businesses });
  } catch (err) { next(err); }
});

module.exports = router;
