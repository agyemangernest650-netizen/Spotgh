// backend/routes/events.routes.js
const router = require('express').Router();
const { supabaseAdmin } = require('../config/supabase');
const { verifyToken, requireOwnership, optionalAuth } = require('../middleware/auth.middleware');
const { paginate } = require('../services/supabase.service');

// ── Browse upcoming events (public, optionally filtered by city) ──
router.get('/', async (req, res, next) => {
  try {
    const { city, page, limit } = req.query;
    const { from, to, page: pg, limit: lm } = paginate(page, limit);
    let q = supabaseAdmin.from('events')
      .select('*,businesses!inner(name,slug,logo_url,city)', { count: 'exact' })
      .neq('status', 'cancelled').gte('starts_at', new Date().toISOString())
      .order('starts_at');
    if (city) q = q.eq('businesses.city', city);
    const { data, count, error } = await q.range(from, to);
    if (error) throw error;
    res.json({ events: data, pagination: { total: count, page: pg, limit: lm } });
  } catch (err) { next(err); }
});

// ── Events for one business (public — powers the mini-site) ──
router.get('/business/:businessId', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('events')
      .select('*').eq('business_id', req.params.businessId).neq('status', 'cancelled').order('starts_at');
    if (error) throw error;
    res.json({ events: data });
  } catch (err) { next(err); }
});

// ── Single event ──────────────────────────────────────────────
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('events')
      .select('*,businesses(name,slug,logo_url,whatsapp,phone)').eq('id', req.params.id).single();
    if (error || !data) return res.status(404).json({ error: 'Event not found' });
    let interested = false;
    if (req.user) {
      const { data: mine } = await supabaseAdmin.from('event_interests')
        .select('id').eq('event_id', req.params.id).eq('user_id', req.user.id).maybeSingle();
      interested = !!mine;
    }
    res.json({ event: data, interested });
  } catch (err) { next(err); }
});

// ── Create event (owner) ──────────────────────────────────────
router.post('/business/:businessId', verifyToken, requireOwnership, async (req, res, next) => {
  try {
    const { title, description, cover_url, location, starts_at, ends_at, ticket_url, price, is_free } = req.body;
    if (!title || !starts_at) return res.status(400).json({ error: 'title and starts_at are required' });
    const { data, error } = await supabaseAdmin.from('events').insert({
      business_id: req.params.businessId, title, description: description || null, cover_url: cover_url || null,
      location: location || null, starts_at, ends_at: ends_at || null, ticket_url: ticket_url || null,
      price: is_free ? null : price || null, is_free: is_free !== false,
    }).select().single();
    if (error) throw error;
    res.status(201).json({ event: data });
  } catch (err) { next(err); }
});

// ── Update event (owner) ──────────────────────────────────────
router.patch('/:id', verifyToken, async (req, res, next) => {
  try {
    const { data: existing } = await supabaseAdmin.from('events').select('id,business_id,businesses(owner_id)').eq('id', req.params.id).single();
    if (!existing) return res.status(404).json({ error: 'Event not found' });
    if (existing.businesses?.owner_id !== req.user.id && req.user.role !== 'creator')
      return res.status(403).json({ error: 'Not your event' });
    const allowed = ['title','description','cover_url','location','starts_at','ends_at','ticket_url','price','is_free','status'];
    const updates = {};
    for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];
    const { data, error } = await supabaseAdmin.from('events').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ event: data });
  } catch (err) { next(err); }
});

// ── Delete event (owner) ──────────────────────────────────────
router.delete('/:id', verifyToken, async (req, res, next) => {
  try {
    const { data: existing } = await supabaseAdmin.from('events').select('id,businesses(owner_id)').eq('id', req.params.id).single();
    if (!existing) return res.status(404).json({ error: 'Event not found' });
    if (existing.businesses?.owner_id !== req.user.id && req.user.role !== 'creator')
      return res.status(403).json({ error: 'Not your event' });
    const { error } = await supabaseAdmin.from('events').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Event deleted' });
  } catch (err) { next(err); }
});

// ── Toggle "interested" (customer) ────────────────────────────
router.post('/:id/interested', verifyToken, async (req, res, next) => {
  try {
    const { data: event } = await supabaseAdmin.from('events').select('id,interested_count').eq('id', req.params.id).single();
    if (!event) return res.status(404).json({ error: 'Event not found' });
    const { data: existing } = await supabaseAdmin.from('event_interests')
      .select('id').eq('event_id', req.params.id).eq('user_id', req.user.id).maybeSingle();
    if (existing) {
      await supabaseAdmin.from('event_interests').delete().eq('id', existing.id);
      await supabaseAdmin.from('events').update({ interested_count: Math.max(0, event.interested_count - 1) }).eq('id', req.params.id);
      return res.json({ interested: false });
    }
    await supabaseAdmin.from('event_interests').insert({ event_id: req.params.id, user_id: req.user.id });
    await supabaseAdmin.from('events').update({ interested_count: event.interested_count + 1 }).eq('id', req.params.id);
    res.json({ interested: true });
  } catch (err) { next(err); }
});

module.exports = router;
