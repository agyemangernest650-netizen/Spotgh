// backend/routes/messages.routes.js
const router = require('express').Router();
const { supabaseAdmin } = require('../config/supabase');
const { verifyToken, requireOwnership } = require('../middleware/auth.middleware');
const { notify } = require('../services/supabase.service');
const limits = require('../middleware/rateLimit.middleware');

// GET /api/messages/:businessId — the logged-in customer's own thread with this business
router.get('/:businessId', verifyToken, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('messages')
      .select('*').eq('business_id', req.params.businessId).eq('customer_id', req.user.id)
      .order('created_at', { ascending: true });
    if (error) throw error;
    // Mark the owner's messages as read now that the customer opened the thread
    await supabaseAdmin.from('messages').update({ read_at: new Date().toISOString() })
      .eq('business_id', req.params.businessId).eq('customer_id', req.user.id).eq('sender_role', 'owner').is('read_at', null);
    res.json({ messages: data || [] });
  } catch (err) { next(err); }
});

// POST /api/messages/:businessId — customer sends a message
router.post('/:businessId', verifyToken, limits.messages, async (req, res, next) => {
  try {
    const { body } = req.body;
    if (!body?.trim()) return res.status(400).json({ error: 'Message body required' });
    const { data: biz } = await supabaseAdmin.from('businesses').select('owner_id,name').eq('id', req.params.businessId).single();
    if (!biz) return res.status(404).json({ error: 'Business not found' });

    const { data, error } = await supabaseAdmin.from('messages').insert({
      business_id: req.params.businessId, customer_id: req.user.id, sender_role: 'customer', body: body.trim(),
    }).select().single();
    if (error) throw error;

    await notify(biz.owner_id, 'info', `💬 New message about ${biz.name}`, body.trim().slice(0, 100), `/pages/messages.html?id=${req.params.businessId}&customer=${req.user.id}`);
    res.status(201).json({ message: data });
  } catch (err) { next(err); }
});

// GET /api/messages/business/:id — owner's inbox: all threads for this business
router.get('/business/:id', verifyToken, requireOwnership, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('messages')
      .select('*,users!messages_customer_id_fkey(full_name,avatar_url)')
      .eq('business_id', req.params.id).order('created_at', { ascending: false });
    if (error) throw error;
    // Group into threads by customer, most recent message first per thread
    const threads = {};
    for (const m of data || []) {
      if (!threads[m.customer_id]) threads[m.customer_id] = { customer_id: m.customer_id, customer_name: m.users?.full_name || 'Customer', customer_avatar: m.users?.avatar_url, messages: [], unread_count: 0 };
      threads[m.customer_id].messages.push(m);
      if (m.sender_role === 'customer' && !m.read_at) threads[m.customer_id].unread_count++;
    }
    res.json({ threads: Object.values(threads).sort((a, b) => new Date(b.messages[0].created_at) - new Date(a.messages[0].created_at)) });
  } catch (err) { next(err); }
});

// POST /api/messages/business/:id/reply — owner replies to a specific customer thread
router.post('/business/:id/reply', verifyToken, requireOwnership, limits.messages, async (req, res, next) => {
  try {
    const { customer_id, body } = req.body;
    if (!customer_id || !body?.trim()) return res.status(400).json({ error: 'customer_id and body required' });
    const { data: biz } = await supabaseAdmin.from('businesses').select('name').eq('id', req.params.id).single();

    const { data, error } = await supabaseAdmin.from('messages').insert({
      business_id: req.params.id, customer_id, sender_role: 'owner', body: body.trim(),
    }).select().single();
    if (error) throw error;

    await notify(customer_id, 'info', `💬 ${biz?.name || 'A business'} replied`, body.trim().slice(0, 100), `/pages/business.html?id=${req.params.id}`);
    res.status(201).json({ message: data });
  } catch (err) { next(err); }
});

module.exports = router;
