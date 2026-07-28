// backend/routes/bookings.routes.js
const router = require('express').Router();
const { supabaseAdmin } = require('../config/supabase');
const { verifyToken, requireAdmin, requireCreator, requireOwnership, optionalAuth } = require('../middleware/auth.middleware');
const { paginate, notify, audit } = require('../services/supabase.service');
const { sendSMS } = require('../services/sms.service');
const gcal = require('../services/googleCalendar.service');
const limits = require('../middleware/rateLimit.middleware');
const { v4: uuidv4 } = require('uuid');
router.post('/', optionalAuth, async (req, res, next) => {
  try {
    const { business_id, customer_name, customer_phone, booking_date, booking_time, customer_email, service_id, notes } = req.body;
    if (!business_id || !customer_name || !customer_phone || !booking_date || !booking_time) return res.status(400).json({ error: 'Required fields missing' });
    const { data: biz } = await supabaseAdmin.from('businesses').select('owner_id,name,phone,google_calendar_connected,google_calendar_refresh_token,google_calendar_id').eq('id', business_id).single();
    if (!biz) return res.status(404).json({ error: 'Business not found' });
    const { getWebsiteAccess } = require('../services/planAccess.service');
    const websiteAccess = await getWebsiteAccess(business_id);
    if (!websiteAccess?.plan.has_bookings) return res.status(403).json({ error: 'This business has not enabled bookings', code: 'BOOKINGS_NOT_ENABLED' });
    const code = uuidv4().slice(0,8).toUpperCase();
    const { data, error } = await supabaseAdmin.from('bookings').insert({ business_id, customer_id: req.user?.id || null, service_id: service_id || null, customer_name, customer_email: customer_email || null, customer_phone, booking_date, booking_time, notes: notes || null, confirmation_code: code, status: 'pending' }).select().single();
    if (error) throw error;
    await notify(biz.owner_id, 'info', `📅 New booking from ${customer_name}`, `${booking_date} at ${booking_time}. Code: ${code}`, `/pages/dashboard.html?tab=bookings&biz=${business_id}`);
    const { data: owner } = await supabaseAdmin.from('users').select('phone').eq('id', biz.owner_id).maybeSingle();
    if (owner?.phone) await sendSMS(owner.phone, `SpotGH: New booking for ${biz.name} from ${customer_name}, ${booking_date} at ${booking_time}. Code: ${code}`);

    // Calendar sync failures should never block the booking itself succeeding.
    if (biz.google_calendar_connected && biz.google_calendar_refresh_token) {
      gcal.createBookingEvent({
        refreshToken: biz.google_calendar_refresh_token,
        calendarId: biz.google_calendar_id,
        business: biz, booking: data,
      }).then(eventId => {
        if (eventId) supabaseAdmin.from('bookings').update({ google_event_id: eventId }).eq('id', data.id).then(() => {}, () => {});
      }).catch(() => {});
    }

    res.status(201).json({ booking: data, confirmation_code: code });
  } catch (err) { next(err); }
});
router.get('/business/:id', verifyToken, requireOwnership, async (req, res, next) => {
  try {
    const { status, page, limit } = req.query; const { from, to, page: pg, limit: lm } = paginate(page, limit);
    let q = supabaseAdmin.from('bookings').select('*,products_services(name)', { count: 'exact' }).eq('business_id', req.params.id);
    if (status) q = q.eq('status', status);
    const { data, count } = await q.order('booking_date').order('booking_time').range(from, to);
    res.json({ bookings: data, pagination: { total: count, page: pg, limit: lm } });
  } catch (err) { next(err); }
});
router.patch('/:id/status', verifyToken, async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['confirmed','cancelled','completed','no_show'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    // This previously had no ownership check — any logged-in user could
    // change any booking's status just by knowing its ID.
    const { data: existing } = await supabaseAdmin.from('bookings').select('id,business_id,customer_id,customer_name,customer_phone,businesses(owner_id,name,slug)').eq('id', req.params.id).single();
    if (!existing) return res.status(404).json({ error: 'Booking not found' });
    if (existing.businesses?.owner_id !== req.user.id && req.user.role !== 'creator')
      return res.status(403).json({ error: 'Not your business' });
    const { data, error } = await supabaseAdmin.from('bookings').update({ status }).eq('id', req.params.id).select().single();
    if (error) throw error;
    // Nudge for a review once the appointment is actually complete — many
    // bookings come from guest customers without accounts, so this reaches
    // them by whichever contact info is actually available.
    if (status === 'completed') {
      const bizName = existing.businesses?.name || 'the business';
      const link = `/pages/business.html?slug=${existing.businesses?.slug || ''}#reviews`;
      if (existing.customer_id) await notify(existing.customer_id, 'info', `How was your visit to ${bizName}?`, `Leave a quick review to help other customers.`, link);
      if (existing.customer_phone) await sendSMS(existing.customer_phone, `SpotGH: Thanks for visiting ${bizName}! We'd love your feedback — leave a review at spotgh.com${link}`);
    }
    res.json({ booking: data });
  } catch (err) { next(err); }
});
module.exports = router;
