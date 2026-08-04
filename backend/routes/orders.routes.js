// backend/routes/orders.routes.js
const router = require('express').Router();
const { supabaseAdmin } = require('../config/supabase');
const { verifyToken, requireOwnership, optionalAuth } = require('../middleware/auth.middleware');
const { notify } = require('../services/supabase.service');
const limits = require('../middleware/rateLimit.middleware');
const { v4: uuidv4 } = require('uuid');
const FIRST_ORDER_REFERRAL_BONUS = 10; // GHS — mirrors the constant in user.controller.js#applyReferral

// POST /api/orders/checkout — turn a cart into an order
router.post('/checkout', optionalAuth, limits.orders, async (req, res, next) => {
  try {
    const { business_id, customer_name, customer_phone, customer_email, fulfillment_type, delivery_address, delivery_zone_name, notes, coupon_code } = req.body;
    if (!business_id || !customer_name || !customer_phone) return res.status(400).json({ error: 'Required fields missing' });
    if (fulfillment_type === 'delivery' && !delivery_address) return res.status(400).json({ error: 'Delivery address required' });

    const { data: biz } = await supabaseAdmin.from('businesses').select('owner_id,name,subscription_tier,delivery_fee,delivery_zones,first_order_referral_bonus_paid').eq('id', business_id).single();
    if (!biz) return res.status(404).json({ error: 'Business not found' });
    const { data: plan } = await supabaseAdmin.from('plans').select('has_online_ordering').eq('tier', biz.subscription_tier).single();
    if (!plan?.has_online_ordering) return res.status(403).json({ error: 'This business has not enabled online ordering', code: 'ORDERING_NOT_ENABLED' });

    // Find the cart the same way cart.routes.js does
    const sessionId = req.headers['x-session-id'];
    let q = supabaseAdmin.from('carts').select('id').eq('business_id', business_id);
    q = req.user ? q.eq('user_id', req.user.id) : (sessionId ? q.eq('session_id', sessionId) : null);
    if (!q) return res.status(400).json({ error: 'No cart found' });
    const { data: cart } = await q.maybeSingle();
    if (!cart) return res.status(400).json({ error: 'Your cart is empty' });

    const { data: items, error: itemsErr } = await supabaseAdmin.from('cart_items')
      .select('quantity,products_services(id,name,price,is_available,track_inventory,stock_quantity,allow_backorder)')
      .eq('cart_id', cart.id);
    if (itemsErr) throw itemsErr;
    if (!items?.length) return res.status(400).json({ error: 'Your cart is empty' });

    // Re-validate stock/availability at checkout time, not just at add-to-cart
    // time — someone else may have bought the last units in between.
    for (const item of items) {
      const p = item.products_services;
      if (!p || !p.is_available) return res.status(400).json({ error: `${p?.name || 'An item'} is no longer available` });
      if (p.track_inventory && !p.allow_backorder && p.stock_quantity < item.quantity)
        return res.status(400).json({ error: `Only ${p.stock_quantity} of ${p.name} left in stock`, code: 'INSUFFICIENT_STOCK' });
    }

    const subtotal = items.reduce((sum, i) => sum + i.products_services.price * i.quantity, 0);
    let deliveryFee = 0;
    if (fulfillment_type === 'delivery') {
      const zones = Array.isArray(biz.delivery_zones) ? biz.delivery_zones : [];
      const matchedZone = delivery_zone_name ? zones.find(z => z.name === delivery_zone_name) : null;
      deliveryFee = matchedZone ? Number(matchedZone.fee) || 0 : (biz.delivery_fee || 0);
    }
    const orderNumber = `ORD-${uuidv4().slice(0, 8).toUpperCase()}`;

    // Apply coupon (optional) — re-validated server-side, never trust the client's discount math
    let coupon = null, discountAmount = 0;
    if (coupon_code) {
      const { data: c } = await supabaseAdmin.from('coupons').select('*')
        .eq('business_id', business_id).eq('code', coupon_code.trim().toUpperCase()).eq('is_active', true).maybeSingle();
      if (!c) return res.status(400).json({ error: 'Invalid or inactive coupon code' });
      if (c.expires_at && new Date(c.expires_at) < new Date()) return res.status(400).json({ error: 'This coupon has expired' });
      if (c.max_uses && c.used_count >= c.max_uses) return res.status(400).json({ error: 'This coupon has reached its usage limit' });
      if (subtotal < c.min_order_amount) return res.status(400).json({ error: `Minimum order of GH₵${c.min_order_amount} required for this coupon` });
      coupon = c;
      discountAmount = c.discount_type === 'percent' ? Math.round(subtotal * (c.discount_value / 100) * 100) / 100 : Math.min(c.discount_value, subtotal);
    }

    const { data: order, error: orderErr } = await supabaseAdmin.from('orders').insert({
      order_number: orderNumber, business_id, customer_id: req.user?.id || null,
      customer_name, customer_phone, customer_email: customer_email || null,
      fulfillment_type: fulfillment_type || 'pickup', delivery_address: delivery_address || null,
      delivery_zone_name: fulfillment_type === 'delivery' ? (delivery_zone_name || null) : null, notes: notes || null,
      subtotal, delivery_fee: deliveryFee, discount_amount: discountAmount || 0,
      total: Math.max(0, subtotal + deliveryFee - discountAmount), status: 'pending',
    }).select().single();
    if (orderErr) throw orderErr;
    require('../services/fraud.service').checkOrder(order).catch(() => {});

    if (coupon) {
      await supabaseAdmin.from('coupon_redemptions').insert({ coupon_id: coupon.id, order_id: order.id, customer_id: req.user?.id || null, discount_applied: discountAmount });
      await supabaseAdmin.from('coupons').update({ used_count: coupon.used_count + 1 }).eq('id', coupon.id);
    }

    const orderItems = items.map(i => ({
      order_id: order.id, product_id: i.products_services.id,
      name_snapshot: i.products_services.name, price_snapshot: i.products_services.price, quantity: i.quantity,
    }));
    const { error: oiErr } = await supabaseAdmin.from('order_items').insert(orderItems);
    if (oiErr) throw oiErr;

    // Decrement stock for tracked items. Best-effort per item — if one
    // fails we don't roll back the order itself, since the sale already
    // happened; an admin can reconcile stock manually if this ever hits.
    const LOW_STOCK_THRESHOLD = 5;
    for (const item of items) {
      if (item.products_services.track_inventory) {
        const newStock = Math.max(0, item.products_services.stock_quantity - item.quantity);
        await supabaseAdmin.from('products_services').update({ stock_quantity: newStock }).eq('id', item.products_services.id);
        // Only fire once as stock *crosses* the threshold, not on every
        // subsequent sale while already low, to avoid spamming the owner.
        if (newStock <= LOW_STOCK_THRESHOLD && item.products_services.stock_quantity > LOW_STOCK_THRESHOLD) {
          await notify(biz.owner_id, 'warning', `⚠️ Low stock: ${item.products_services.name}`,
            `Only ${newStock} left for "${item.products_services.name}". Restock soon to avoid missing sales.`,
            `/products?id=${business_id}`);
        }
      }
    }

    await supabaseAdmin.from('carts').delete().eq('id', cart.id); // clears cart_items via cascade
    await notify(biz.owner_id, 'info', `🛒 New order from ${customer_name}`, `Order ${orderNumber} — GHS ${order.total.toFixed(2)}`, `/dashboard?tab=orders&biz=${business_id}`);

    // First-order referral bonus: if this business's owner was referred by
    // someone, and this is genuinely their first-ever order, award the
    // referrer a one-time bonus. Gated on first_order_referral_bonus_paid
    // (not just "count orders === 1") so a race between two near-
    // simultaneous first orders can't double-pay it.
    if (!biz.first_order_referral_bonus_paid) {
      try {
        const { count: priorOrders } = await supabaseAdmin.from('orders').select('id', { count: 'exact', head: true }).eq('business_id', business_id).neq('id', order.id);
        if (!priorOrders) {
          const { data: owner } = await supabaseAdmin.from('users').select('referred_by').eq('id', biz.owner_id).single();
          if (owner?.referred_by) {
            const { error: flagErr } = await supabaseAdmin.from('businesses').update({ first_order_referral_bonus_paid: true }).eq('id', business_id).eq('first_order_referral_bonus_paid', false);
            if (!flagErr) {
              const { data: referrer } = await supabaseAdmin.from('users').select('referral_credit_ghs').eq('id', owner.referred_by).single();
              if (referrer) {
                await supabaseAdmin.from('users').update({ referral_credit_ghs: (referrer.referral_credit_ghs || 0) + FIRST_ORDER_REFERRAL_BONUS }).eq('id', owner.referred_by);
                await notify(owner.referred_by, 'success', '🎉 Referral bonus earned!', `A business you referred just got its first order! GHS ${FIRST_ORDER_REFERRAL_BONUS} credit has been added to your account.`, '/referrals');
              }
            }
          }
        }
      } catch { /* best-effort — never block the order itself over this */ }
    }

    res.status(201).json({ order, order_number: orderNumber });
  } catch (err) { next(err); }
});

// GET /api/orders/business/:id — business owner's order list
router.get('/business/:id', verifyToken, requireOwnership, async (req, res, next) => {
  try {
    const { status } = req.query;
    let q = supabaseAdmin.from('orders').select('*,order_items(*)', { count: 'exact' }).eq('business_id', req.params.id);
    if (status) q = q.eq('status', status);
    const { data, count, error } = await q.order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ orders: data || [], total: count });
  } catch (err) { next(err); }
});

// GET /api/orders/my — customer's own order history
router.get('/my', verifyToken, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('orders')
      .select('*,order_items(*),businesses(name,slug,logo_url,phone)')
      .eq('customer_id', req.user.id).order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ orders: data || [] });
  } catch (err) { next(err); }
});

// GET /api/orders/track?order_number=X&phone=Y — guest order lookup.
// No auth, but requires knowing BOTH the order number and the phone
// number used at checkout, so this can't be used to enumerate orders.
// Must be declared before GET /:id below, or that wildcard route would
// swallow requests to /track first (treating "track" as an order id).
router.get('/track', async (req, res, next) => {
  try {
    const { order_number, phone } = req.query;
    if (!order_number || !phone) return res.status(400).json({ error: 'order_number and phone are required' });
    const { data: order } = await supabaseAdmin.from('orders')
      .select('*,order_items(*),businesses(name,slug,phone,logo_url)')
      .eq('order_number', order_number.toUpperCase()).eq('customer_phone', phone).maybeSingle();
    if (!order) return res.status(404).json({ error: 'No order found with that order number and phone number' });
    res.json({ order });
  } catch (err) { next(err); }
});

// GET /api/orders/:id — single order (owner of the business, or the customer who placed it)
router.get('/:id', verifyToken, async (req, res, next) => {
  try {
    const { data: order, error } = await supabaseAdmin.from('orders')
      .select('*,order_items(*),businesses(name,slug,owner_id,phone,logo_url)').eq('id', req.params.id).single();
    if (error || !order) return res.status(404).json({ error: 'Order not found' });
    const isOwner = order.businesses?.owner_id === req.user.id;
    const isCustomer = order.customer_id === req.user.id;
    if (!isOwner && !isCustomer && req.user.role !== 'creator')
      return res.status(403).json({ error: 'Not your order' });
    res.json({ order });
  } catch (err) { next(err); }
});

// PATCH /api/orders/:id/status — business owner updates fulfillment status
router.patch('/:id/status', verifyToken, async (req, res, next) => {
  try {
    const { status } = req.body;
    const valid = ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'completed', 'cancelled'];
    if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const { data: order } = await supabaseAdmin.from('orders').select('id,customer_id,order_number,business_id,total,businesses(owner_id,name,slug,loyalty_points_per_ghs)').eq('id', req.params.id).single();
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.businesses?.owner_id !== req.user.id && req.user.role !== 'creator')
      return res.status(403).json({ error: 'Not your business' });

    const { data, error } = await supabaseAdmin.from('orders').update({
      status, updated_at: new Date().toISOString(),
      ...(status === 'delivered' ? { delivered_at: new Date().toISOString(), delivery_status: 'delivered' } : {}),
    }).eq('id', req.params.id).select().single();
    if (error) throw error;

    await supabaseAdmin.from('delivery_status_log').insert({ order_id: order.id, status });

    // Earn loyalty points once an order is completed
    if (status === 'completed' && order.customer_id) {
      const rate = order.businesses?.loyalty_points_per_ghs ?? 1;
      const points = Math.floor(Number(order.total || 0) * rate);
      if (points > 0) await require('./loyalty.routes').awardPoints(order.customer_id, order.business_id, points, `Order ${order.order_number}`, order.id);
    }

    if (order.customer_id) {
      const statusMessages = {
        confirmed: 'Your order has been confirmed', preparing: 'Your order is being prepared',
        ready: 'Your order is ready for pickup', delivered: 'Your order has been delivered',
        completed: 'Your order is complete', cancelled: 'Your order was cancelled',
      };
      if (statusMessages[status]) {
        await notify(order.customer_id, status === 'cancelled' ? 'warning' : 'success',
          `Order ${order.order_number} update`, `${statusMessages[status]} by ${order.businesses.name}.`, '/orders');
      }
      // Nudge for a review once the order is actually complete — reviews
      // otherwise only happen if a customer thinks to leave one unprompted.
      if (status === 'completed') {
        await notify(order.customer_id, 'info', `How was your order from ${order.businesses.name}?`,
          `Leave a quick review to help other customers — it only takes a moment.`,
          `/business?slug=${order.businesses.slug || ''}#reviews`);
      }
    }
    res.json({ order: data });
  } catch (err) { next(err); }
});

module.exports = router;