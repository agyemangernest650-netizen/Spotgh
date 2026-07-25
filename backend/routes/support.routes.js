// backend/routes/support.routes.js
const router = require('express').Router();
const { supabaseAdmin } = require('../config/supabase');
const { verifyToken, requireAdmin, optionalAuth } = require('../middleware/auth.middleware');
const { notify, paginate } = require('../services/supabase.service');
const limits = require('../middleware/rateLimit.middleware');

// ── Create a ticket ────────────────────────────────────────────
router.post('/', optionalAuth, limits.contact, async (req, res, next) => {
  try {
    const { subject, category, message, business_id, guest_email } = req.body;
    if (!subject || !message) return res.status(400).json({ error: 'subject and message are required' });
    if (!req.user && !guest_email) return res.status(400).json({ error: 'guest_email is required when not logged in' });

    const { data: ticket, error } = await supabaseAdmin.from('support_tickets').insert({
      user_id: req.user?.id || null, business_id: business_id || null, subject, category: category || 'general',
    }).select().single();
    if (error) throw error;

    await supabaseAdmin.from('support_ticket_messages').insert({
      ticket_id: ticket.id, sender_role: 'user', sender_id: req.user?.id || null,
      body: guest_email ? `[from ${guest_email}]\n${message}` : message,
    });
    res.status(201).json({ ticket });
  } catch (err) { next(err); }
});

// ── My tickets ───────────────────────────────────────────────
router.get('/mine', verifyToken, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('support_tickets').select('*').eq('user_id', req.user.id).order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ tickets: data });
  } catch (err) { next(err); }
});

// ── Ticket detail + messages ───────────────────────────────────
router.get('/:id', verifyToken, async (req, res, next) => {
  try {
    const { data: ticket } = await supabaseAdmin.from('support_tickets').select('*').eq('id', req.params.id).single();
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    if (ticket.user_id !== req.user.id && req.user.role !== 'creator')
      return res.status(403).json({ error: 'Not your ticket' });
    const { data: messages } = await supabaseAdmin.from('support_ticket_messages').select('*').eq('ticket_id', ticket.id).order('created_at');
    res.json({ ticket, messages });
  } catch (err) { next(err); }
});

// ── Reply to a ticket (user or admin) ──────────────────────────
router.post('/:id/reply', verifyToken, async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'message is required' });
    const { data: ticket } = await supabaseAdmin.from('support_tickets').select('*').eq('id', req.params.id).single();
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    const isAdmin = req.user.role === 'creator';
    if (ticket.user_id !== req.user.id && !isAdmin) return res.status(403).json({ error: 'Not your ticket' });

    await supabaseAdmin.from('support_ticket_messages').insert({ ticket_id: ticket.id, sender_role: isAdmin ? 'admin' : 'user', sender_id: req.user.id, body: message });
    if (isAdmin) {
      await supabaseAdmin.from('support_tickets').update({ status: 'in_progress' }).eq('id', ticket.id);
      if (ticket.user_id) await notify(ticket.user_id, 'info', 'Support replied', `New reply on "${ticket.subject}"`, `/pages/support.html?id=${ticket.id}`);
    }
    res.status(201).json({ message: 'Reply sent' });
  } catch (err) { next(err); }
});

// ── Admin: list all tickets, filterable ────────────────────────
router.get('/', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { status, page, limit } = req.query;
    const { from, to, page: pg, limit: lm } = paginate(page, limit);
    let q = supabaseAdmin.from('support_tickets').select('*,users(full_name,email)', { count: 'exact' }).order('created_at', { ascending: false });
    if (status) q = q.eq('status', status);
    const { data, count, error } = await q.range(from, to);
    if (error) throw error;
    res.json({ tickets: data, pagination: { total: count, page: pg, limit: lm } });
  } catch (err) { next(err); }
});

// ── Admin: update status/priority ──────────────────────────────
router.patch('/:id', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const allowed = ['status', 'priority'];
    const updates = {};
    for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];
    const { data, error } = await supabaseAdmin.from('support_tickets').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ ticket: data });
  } catch (err) { next(err); }
});

module.exports = router;
