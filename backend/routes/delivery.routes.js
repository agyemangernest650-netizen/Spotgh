// backend/routes/delivery.routes.js
const router = require('express').Router();
const { supabaseAdmin } = require('../config/supabase');
const { verifyToken } = require('../middleware/auth.middleware');
const { notify } = require('../services/supabase.service');

// ── Owner: assign a rider + push a status/location update ──────
router.patch('/:orderId', verifyToken, async (req, res, next) => {
  try {
    const { delivery_status, rider_name, rider_phone, latitude, longitude, note } = req.body;
    const { data: order } = await supabaseAdmin.from('orders').select('id,customer_id,order_number,business_id,businesses(owner_id,name)').eq('id', req.params.orderId).single();
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.businesses?.owner_id !== req.user.id && req.user.role !== 'creator')
      return res.status(403).json({ error: 'Not your business' });

    const updates = {};
    if (delivery_status) updates.delivery_status = delivery_status;
    if (rider_name) updates.rider_name = rider_name;
    if (rider_phone) updates.rider_phone = rider_phone;
    if (latitude !== undefined) updates.rider_latitude = latitude;
    if (longitude !== undefined) updates.rider_longitude = longitude;
    if (delivery_status === 'delivered') updates.delivered_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin.from('orders').update(updates).eq('id', order.id).select().single();
    if (error) throw error;

    await supabaseAdmin.from('delivery_status_log').insert({ order_id: order.id, status: delivery_status || 'location_update', latitude: latitude || null, longitude: longitude || null, note: note || null });

    if (delivery_status && order.customer_id) {
      const messages = { preparing: 'Your order is being prepared', out_for_delivery: 'Your order is on the way!', delivered: 'Your order has been delivered' };
      if (messages[delivery_status]) await notify(order.customer_id, 'info', `Order ${order.order_number}`, messages[delivery_status], '/orders');
    }
    res.json({ order: data });
  } catch (err) { next(err); }
});

// ── Customer: track an order's delivery in real time ────────────
router.get('/:orderId/track', verifyToken, async (req, res, next) => {
  try {
    const { data: order } = await supabaseAdmin.from('orders')
      .select('id,customer_id,order_number,delivery_status,rider_name,rider_phone,rider_latitude,rider_longitude,delivered_at,businesses(name,latitude,longitude)')
      .eq('id', req.params.orderId).single();
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.customer_id !== req.user.id && req.user.role !== 'creator')
      return res.status(403).json({ error: 'Not your order' });

    const { data: log } = await supabaseAdmin.from('delivery_status_log').select('*').eq('order_id', order.id).order('created_at');
    res.json({ order, timeline: log });
  } catch (err) { next(err); }
});

module.exports = router;
