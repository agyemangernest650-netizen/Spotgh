// backend/routes/availability.routes.js
const router = require('express').Router();
const { supabaseAdmin } = require('../config/supabase');
const { verifyToken, requireOwnership } = require('../middleware/auth.middleware');

// ── Get a business's weekly hours + blocked dates (public) ──
router.get('/:businessId', async (req, res, next) => {
  try {
    const { data: hours, error: e1 } = await supabaseAdmin.from('business_hours')
      .select('*').eq('business_id', req.params.businessId).order('day_of_week');
    if (e1) throw e1;
    const { data: blocked, error: e2 } = await supabaseAdmin.from('blocked_dates')
      .select('id,blocked_date,reason').eq('business_id', req.params.businessId)
      .gte('blocked_date', new Date().toISOString().slice(0, 10)).order('blocked_date');
    if (e2) throw e2;
    res.json({ hours, blocked_dates: blocked });
  } catch (err) { next(err); }
});

// ── Set weekly hours (owner) — replaces the full week in one call ──
router.put('/:businessId/hours', verifyToken, requireOwnership, async (req, res, next) => {
  try {
    const { hours } = req.body; // [{ day_of_week, open_time, close_time, is_closed, slot_minutes }]
    if (!Array.isArray(hours) || !hours.length) return res.status(400).json({ error: 'hours array required' });
    const rows = hours.map(h => ({
      business_id: req.params.businessId, day_of_week: h.day_of_week,
      open_time: h.is_closed ? null : h.open_time, close_time: h.is_closed ? null : h.close_time,
      is_closed: !!h.is_closed, slot_minutes: h.slot_minutes || 60,
    }));
    const { error } = await supabaseAdmin.from('business_hours')
      .upsert(rows, { onConflict: 'business_id,day_of_week' });
    if (error) throw error;
    res.json({ message: 'Business hours updated' });
  } catch (err) { next(err); }
});

// ── Block a date (owner) ─────────────────────────────────────
router.post('/:businessId/blocked-dates', verifyToken, requireOwnership, async (req, res, next) => {
  try {
    const { blocked_date, reason } = req.body;
    if (!blocked_date) return res.status(400).json({ error: 'blocked_date required' });
    const { data, error } = await supabaseAdmin.from('blocked_dates')
      .insert({ business_id: req.params.businessId, blocked_date, reason: reason || null }).select().single();
    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'Date already blocked' });
      throw error;
    }
    res.status(201).json({ blocked_date: data });
  } catch (err) { next(err); }
});

// ── Unblock a date (owner) ───────────────────────────────────
router.delete('/:businessId/blocked-dates/:id', verifyToken, requireOwnership, async (req, res, next) => {
  try {
    const { error } = await supabaseAdmin.from('blocked_dates').delete()
      .eq('id', req.params.id).eq('business_id', req.params.businessId);
    if (error) throw error;
    res.json({ message: 'Date unblocked' });
  } catch (err) { next(err); }
});

// ── Open time slots for a given date (public — powers the booking widget) ──
router.get('/:businessId/slots', async (req, res, next) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date query param required (YYYY-MM-DD)' });
    const dow = new Date(date + 'T00:00:00').getDay();

    const { data: hours } = await supabaseAdmin.from('business_hours')
      .select('*').eq('business_id', req.params.businessId).eq('day_of_week', dow).maybeSingle();
    if (!hours || hours.is_closed) return res.json({ date, slots: [], closed: true });

    const { data: blocked } = await supabaseAdmin.from('blocked_dates')
      .select('id').eq('business_id', req.params.businessId).eq('blocked_date', date).maybeSingle();
    if (blocked) return res.json({ date, slots: [], closed: true, reason: 'blocked' });

    const { data: existing } = await supabaseAdmin.from('bookings')
      .select('booking_time').eq('business_id', req.params.businessId).eq('booking_date', date)
      .in('status', ['pending', 'confirmed']);
    const taken = new Set((existing || []).map(b => b.booking_time?.slice(0, 5)));

    const slots = [];
    const [oh, om] = hours.open_time.split(':').map(Number);
    const [ch, cm] = hours.close_time.split(':').map(Number);
    let cur = oh * 60 + om;
    const end = ch * 60 + cm;
    while (cur + hours.slot_minutes <= end) {
      const h = String(Math.floor(cur / 60)).padStart(2, '0');
      const m = String(cur % 60).padStart(2, '0');
      const label = `${h}:${m}`;
      slots.push({ time: label, available: !taken.has(label) });
      cur += hours.slot_minutes;
    }
    res.json({ date, slots, closed: false });
  } catch (err) { next(err); }
});

module.exports = router;
