// backend/routes/cart.routes.js
const router = require('express').Router();
const { supabaseAdmin } = require('../config/supabase');
const { optionalAuth } = require('../middleware/auth.middleware');

// Carts work for guests too (no account needed to browse a business and
// add items) — identified by an X-Session-Id header the frontend
// generates and stores in localStorage. Logged-in users are identified
// by their user id instead, same as the rest of the app.
function cartOwner(req) {
  if (req.user) return { user_id: req.user.id };
  const sessionId = req.headers['x-session-id'];
  if (!sessionId) return null;
  return { session_id: sessionId };
}

async function getOrCreateCart(business_id, owner) {
  let q = supabaseAdmin.from('carts').select('*').eq('business_id', business_id);
  q = owner.user_id ? q.eq('user_id', owner.user_id) : q.eq('session_id', owner.session_id);
  const { data: existing } = await q.maybeSingle();
  if (existing) return existing;
  const { data: created, error } = await supabaseAdmin.from('carts').insert({ business_id, ...owner }).select().single();
  if (error) throw error;
  return created;
}

// GET /api/cart/:businessId — current cart contents
router.get('/:businessId', optionalAuth, async (req, res, next) => {
  try {
    const owner = cartOwner(req);
    if (!owner) return res.json({ items: [], subtotal: 0 });
    let q = supabaseAdmin.from('carts').select('id').eq('business_id', req.params.businessId);
    q = owner.user_id ? q.eq('user_id', owner.user_id) : q.eq('session_id', owner.session_id);
    const { data: cart } = await q.maybeSingle();
    if (!cart) return res.json({ items: [], subtotal: 0 });

    const { data: items, error } = await supabaseAdmin.from('cart_items')
      .select('id,quantity,products_services(id,name,price,image_url,is_available,track_inventory,stock_quantity,allow_backorder)')
      .eq('cart_id', cart.id);
    if (error) throw error;

    const subtotal = (items || []).reduce((sum, i) => sum + (i.products_services?.price || 0) * i.quantity, 0);
    res.json({ cart_id: cart.id, items: items || [], subtotal });
  } catch (err) { next(err); }
});

// POST /api/cart/:businessId/items — add or increment an item
router.post('/:businessId/items', optionalAuth, async (req, res, next) => {
  try {
    const owner = cartOwner(req);
    if (!owner) return res.status(400).json({ error: 'Missing session — X-Session-Id header required for guest carts' });
    const { product_id, quantity = 1 } = req.body;
    if (!product_id) return res.status(400).json({ error: 'product_id required' });

    const { data: product } = await supabaseAdmin.from('products_services').select('id,is_available,track_inventory,stock_quantity,allow_backorder,business_id').eq('id', product_id).single();
    if (!product || product.business_id !== req.params.businessId) return res.status(404).json({ error: 'Product not found' });
    if (!product.is_available) return res.status(400).json({ error: 'This item is currently unavailable' });
    if (product.track_inventory && !product.allow_backorder && product.stock_quantity < quantity)
      return res.status(400).json({ error: `Only ${product.stock_quantity} left in stock`, code: 'INSUFFICIENT_STOCK' });

    const cart = await getOrCreateCart(req.params.businessId, owner);
    const { data: existing } = await supabaseAdmin.from('cart_items').select('id,quantity').eq('cart_id', cart.id).eq('product_id', product_id).maybeSingle();

    if (existing) {
      const newQty = existing.quantity + quantity;
      if (product.track_inventory && !product.allow_backorder && product.stock_quantity < newQty)
        return res.status(400).json({ error: `Only ${product.stock_quantity} left in stock`, code: 'INSUFFICIENT_STOCK' });
      const { error } = await supabaseAdmin.from('cart_items').update({ quantity: newQty }).eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin.from('cart_items').insert({ cart_id: cart.id, product_id, quantity });
      if (error) throw error;
    }
    res.status(201).json({ success: true });
  } catch (err) { next(err); }
});

// PATCH /api/cart/items/:itemId — set exact quantity (0 removes it)
router.patch('/items/:itemId', optionalAuth, async (req, res, next) => {
  try {
    const owner = cartOwner(req);
    if (!owner) return res.status(400).json({ error: 'Missing session' });
    const { quantity } = req.body;
    if (typeof quantity !== 'number' || quantity < 0) return res.status(400).json({ error: 'Invalid quantity' });

    // Verify the cart item actually belongs to this owner before touching it
    const { data: item } = await supabaseAdmin.from('cart_items').select('id,cart_id,carts(user_id,session_id)').eq('id', req.params.itemId).single();
    if (!item) return res.status(404).json({ error: 'Item not found' });
    const owns = owner.user_id ? item.carts?.user_id === owner.user_id : item.carts?.session_id === owner.session_id;
    if (!owns) return res.status(403).json({ error: 'Not your cart' });

    if (quantity === 0) {
      const { error } = await supabaseAdmin.from('cart_items').delete().eq('id', req.params.itemId);
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin.from('cart_items').update({ quantity }).eq('id', req.params.itemId);
      if (error) throw error;
    }
    res.json({ success: true });
  } catch (err) { next(err); }
});

// DELETE /api/cart/:businessId — clear the whole cart (e.g. after checkout)
router.delete('/:businessId', optionalAuth, async (req, res, next) => {
  try {
    const owner = cartOwner(req);
    if (!owner) return res.json({ success: true });
    let q = supabaseAdmin.from('carts').select('id').eq('business_id', req.params.businessId);
    q = owner.user_id ? q.eq('user_id', owner.user_id) : q.eq('session_id', owner.session_id);
    const { data: cart } = await q.maybeSingle();
    if (cart) await supabaseAdmin.from('carts').delete().eq('id', cart.id); // cart_items cascade
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
