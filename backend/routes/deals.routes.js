// backend/routes/deals.routes.js
const router = require('express').Router();
const { supabaseAdmin } = require('../config/supabase');
const { verifyToken, requireAdmin, requireCreator, requireOwnership, optionalAuth } = require('../middleware/auth.middleware');
const { paginate, notify, audit } = require('../services/supabase.service');
const limits = require('../middleware/rateLimit.middleware');
router.get('/', async (req, res, next) => {
  try {
    const { page, limit } = req.query; const { from, to, page: pg, limit: lm } = paginate(page, limit);
    const { data, count } = await supabaseAdmin.from('business_deals').select('*,businesses(name,slug,logo_url,city,whatsapp,phone)', { count: 'exact' }).eq('is_active',true).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).range(from, to);
    res.json({ deals: data, pagination: { total: count, page: pg, limit: lm } });
  } catch (err) { next(err); }
});
router.post('/', verifyToken, async (req, res, next) => {
  try {
    const { business_id, title, description, discount_text, expires_at } = req.body;
    if (!business_id || !title || !expires_at) return res.status(400).json({ error: 'business_id, title and expires_at required' });
    const { data: biz } = await supabaseAdmin.from('businesses').select('owner_id').eq('id', business_id).single();
    if (!biz || biz.owner_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
    const { data, error } = await supabaseAdmin.from('business_deals').insert({ business_id, title, description: description || null, discount_text: discount_text || null, expires_at, is_active: true }).select().single();
    if (error) throw error; res.status(201).json({ deal: data });
  } catch (err) { next(err); }
});
router.get('/my', verifyToken, async (req, res, next) => {
  try {
    const { data: bizIds } = await supabaseAdmin.from('businesses').select('id').eq('owner_id', req.user.id);
    const ids = (bizIds || []).map(b => b.id);
    if (!ids.length) return res.json({ deals: [] });
    const { data } = await supabaseAdmin.from('business_deals').select('*,businesses(name,slug,logo_url)').in('business_id', ids).order('created_at', { ascending: false });
    res.json({ deals: data || [] });
  } catch (err) { next(err); }
});
router.patch('/:id', verifyToken, async (req, res, next) => {
  try {
    const { data: deal } = await supabaseAdmin.from('business_deals').select('businesses(owner_id)').eq('id', req.params.id).single();
    if (!deal || (deal.businesses.owner_id !== req.user.id && req.user.role !== 'creator')) return res.status(403).json({ error: 'Not authorized' });
    const { title, description, discount_text, expires_at, is_active } = req.body;
    const updates = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (discount_text !== undefined) updates.discount_text = discount_text;
    if (expires_at !== undefined) updates.expires_at = expires_at;
    if (is_active !== undefined) updates.is_active = is_active;
    const { data, error } = await supabaseAdmin.from('business_deals').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ deal: data });
  } catch (err) { next(err); }
});
router.delete('/:id', verifyToken, async (req, res, next) => {
  try {
    const { data: deal } = await supabaseAdmin.from('business_deals').select('businesses(owner_id)').eq('id', req.params.id).single();
    if (!deal || (deal.businesses.owner_id !== req.user.id && req.user.role !== 'creator')) return res.status(403).json({ error: 'Not authorized' });
    await supabaseAdmin.from('business_deals').delete().eq('id', req.params.id);
    res.json({ message: 'Deal deleted' });
  } catch (err) { next(err); }
});
module.exports = router;
