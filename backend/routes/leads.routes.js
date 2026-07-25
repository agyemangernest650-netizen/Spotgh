// backend/routes/leads.routes.js
const router = require('express').Router();
const { supabaseAdmin } = require('../config/supabase');
const { verifyToken, requireBusinessOwner, optionalAuth } = require('../middleware/auth.middleware');
const { notify, paginate } = require('../services/supabase.service');
const limits = require('../middleware/rateLimit.middleware');

// Haversine distance in km — used to scope notifications to nearby businesses
const distanceKm = (lat1, lon1, lat2, lon2) => {
  if ([lat1, lon1, lat2, lon2].some(v => v === null || v === undefined)) return null;
  const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ── Create a lead (customer posts a request) ────────────────
router.post('/', verifyToken, limits.contact, async (req, res, next) => {
  try {
    const { category_id, title, description, city, budget_min, budget_max, needed_by, latitude, longitude } = req.body;
    if (!title || !description || !city) return res.status(400).json({ error: 'title, description and city are required' });

    const { data: lead, error } = await supabaseAdmin.from('leads').insert({
      customer_id: req.user.id, category_id: category_id || null, title, description, city,
      budget_min: budget_min || null, budget_max: budget_max || null, needed_by: needed_by || null,
      latitude: latitude || null, longitude: longitude || null,
    }).select().single();
    if (error) throw error;

    // Notify matching businesses: same category, in the same city, on a plan with has_leads
    let q = supabaseAdmin.from('businesses')
      .select('id,owner_id,name,latitude,longitude,subscription_tier,plans!inner(has_leads)')
      .eq('city', city).eq('plans.has_leads', true).eq('status', 'active');
    if (category_id) q = q.eq('category_id', category_id);
    const { data: matches } = await q.limit(200);

    await Promise.all((matches || []).map(biz =>
      notify(biz.owner_id, 'info', `📢 New lead: ${title}`, `A customer in ${city} needs: ${description.slice(0, 100)}`, `/pages/leads.html?id=${lead.id}`)
    ));

    res.status(201).json({ lead, notified_businesses: matches?.length || 0 });
  } catch (err) { next(err); }
});

// ── Browse open leads (business side — filtered to their category/city) ─
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const { city, category_id, page, limit } = req.query;
    const { from, to, page: pg, limit: lm } = paginate(page, limit);
    let q = supabaseAdmin.from('leads')
      .select('*,categories(name),lead_quotes(count)', { count: 'exact' })
      .eq('status', 'open').order('created_at', { ascending: false });
    if (city) q = q.eq('city', city);
    if (category_id) q = q.eq('category_id', category_id);
    const { data, count, error } = await q.range(from, to);
    if (error) throw error;
    res.json({ leads: data, pagination: { total: count, page: pg, limit: lm } });
  } catch (err) { next(err); }
});

// ── My leads (customer) ──────────────────────────────────────
router.get('/mine', verifyToken, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('leads')
      .select('*,categories(name),lead_quotes(*,businesses(id,name,slug,logo_url,avg_rating))')
      .eq('customer_id', req.user.id).order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ leads: data });
  } catch (err) { next(err); }
});

// ── Single lead detail ───────────────────────────────────────
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('leads')
      .select('*,categories(name),lead_quotes(*,businesses(id,name,slug,logo_url,avg_rating,phone,whatsapp))')
      .eq('id', req.params.id).single();
    if (error || !data) return res.status(404).json({ error: 'Lead not found' });
    res.json({ lead: data });
  } catch (err) { next(err); }
});

// ── Business sends a quote (gated by has_leads plan flag) ────
router.post('/:id/quotes', verifyToken, requireBusinessOwner, limits.contact, async (req, res, next) => {
  try {
    const { business_id, price, message } = req.body;
    if (!business_id || !price || !message) return res.status(400).json({ error: 'business_id, price and message are required' });

    const { data: biz } = await supabaseAdmin.from('businesses').select('id,owner_id,name,subscription_tier').eq('id', business_id).single();
    if (!biz) return res.status(404).json({ error: 'Business not found' });
    if (biz.owner_id !== req.user.id && req.user.role !== 'creator')
      return res.status(403).json({ error: 'Not your business' });

    const { data: plan } = await supabaseAdmin.from('plans').select('has_leads').eq('tier', biz.subscription_tier).single();
    if (!plan?.has_leads) return res.status(403).json({ error: 'Upgrade to Pro or Enterprise to respond to leads', code: 'LEADS_NOT_ENABLED' });

    const { data: lead } = await supabaseAdmin.from('leads').select('id,customer_id,title,status').eq('id', req.params.id).single();
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    if (lead.status !== 'open') return res.status(400).json({ error: 'This lead is no longer open' });

    const { data: quote, error } = await supabaseAdmin.from('lead_quotes')
      .insert({ lead_id: lead.id, business_id, price, message }).select().single();
    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'You already quoted this lead' });
      throw error;
    }
    await supabaseAdmin.from('leads').update({ quote_count: (lead.quote_count || 0) + 1 }).eq('id', lead.id);
    await notify(lead.customer_id, 'info', `💬 New quote for "${lead.title}"`, `${biz.name} sent you a quote of GH₵${price}`, `/pages/leads.html?id=${lead.id}`);

    res.status(201).json({ quote });
  } catch (err) { next(err); }
});

// ── Customer accepts a quote → awards the lead ──────────────
router.patch('/:id/award/:quoteId', verifyToken, async (req, res, next) => {
  try {
    const { data: lead } = await supabaseAdmin.from('leads').select('id,customer_id,status,title').eq('id', req.params.id).single();
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    if (lead.customer_id !== req.user.id) return res.status(403).json({ error: 'Not your lead' });
    if (lead.status !== 'open') return res.status(400).json({ error: 'Lead already resolved' });

    const { data: quote } = await supabaseAdmin.from('lead_quotes').select('id,business_id,businesses(owner_id,name)').eq('id', req.params.quoteId).eq('lead_id', lead.id).single();
    if (!quote) return res.status(404).json({ error: 'Quote not found' });

    await supabaseAdmin.from('leads').update({ status: 'awarded', awarded_business_id: quote.business_id }).eq('id', lead.id);
    await supabaseAdmin.from('lead_quotes').update({ status: 'accepted' }).eq('id', quote.id);
    await supabaseAdmin.from('lead_quotes').update({ status: 'declined' }).eq('lead_id', lead.id).neq('id', quote.id);
    await notify(quote.businesses.owner_id, 'success', `🎉 You won a lead!`, `You were awarded "${lead.title}"`, `/pages/leads.html?id=${lead.id}`);

    res.json({ message: 'Lead awarded', lead_id: lead.id, business_id: quote.business_id });
  } catch (err) { next(err); }
});

// ── Customer cancels a lead ──────────────────────────────────
router.patch('/:id/cancel', verifyToken, async (req, res, next) => {
  try {
    const { data: lead } = await supabaseAdmin.from('leads').select('id,customer_id,status').eq('id', req.params.id).single();
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    if (lead.customer_id !== req.user.id) return res.status(403).json({ error: 'Not your lead' });
    if (lead.status !== 'open') return res.status(400).json({ error: 'Lead already resolved' });
    const { data, error } = await supabaseAdmin.from('leads').update({ status: 'cancelled' }).eq('id', lead.id).select().single();
    if (error) throw error;
    res.json({ lead: data });
  } catch (err) { next(err); }
});

module.exports = router;
