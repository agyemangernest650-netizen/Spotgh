// backend/routes/coupons.routes.js
const router = require('express').Router();
const { supabaseAdmin } = require('../config/supabase');
const { verifyToken, requireOwnership } = require('../middleware/auth.middleware');
const { notify } = require('../services/supabase.service');

// ── List a business's coupons (owner) ────────────────────────
router.get('/business/:businessId', verifyToken, requireOwnership, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('coupons').select('*').eq('business_id', req.params.businessId).order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ coupons: data });
  } catch (err) { next(err); }
});

// ── Create coupon (owner) ─────────────────────────────────────
router.post('/business/:businessId', verifyToken, requireOwnership, async (req, res, next) => {
  try {
    const { code, discount_type, discount_value, min_order_amount, max_uses, starts_at, expires_at } = req.body;
    if (!code || !discount_type || !discount_value) return res.status(400).json({ error: 'code, discount_type and discount_value are required' });
    if (!['percent','fixed'].includes(discount_type)) return res.status(400).json({ error: 'discount_type must be percent or fixed' });
    if (discount_type === 'percent' && discount_value > 100) return res.status(400).json({ error: 'Percent discount cannot exceed 100' });

    const { data, error } = await supabaseAdmin.from('coupons').insert({
      business_id: req.params.businessId, code: code.trim().toUpperCase(), discount_type, discount_value,
      min_order_amount: min_order_amount || 0, max_uses: max_uses || null,
      starts_at: starts_at || new Date().toISOString(), expires_at: expires_at || null,
    }).select().single();
    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'You already have a coupon with that code' });
      throw error;
    }
    res.status(201).json({ coupon: data });
  } catch (err) { next(err); }
});

// ── Toggle active / update coupon (owner) ─────────────────────
router.patch('/:id', verifyToken, async (req, res, next) => {
  try {
    const { data: existing } = await supabaseAdmin.from('coupons').select('id,business_id,businesses(owner_id)').eq('id', req.params.id).single();
    if (!existing) return res.status(404).json({ error: 'Coupon not found' });
    if (existing.businesses?.owner_id !== req.user.id && req.user.role !== 'creator')
      return res.status(403).json({ error: 'Not your coupon' });
    const allowed = ['is_active','max_uses','expires_at','discount_value','min_order_amount'];
    const updates = {};
    for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];
    const { data, error } = await supabaseAdmin.from('coupons').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ coupon: data });
  } catch (err) { next(err); }
});

// ── Delete coupon (owner) ─────────────────────────────────────
router.delete('/:id', verifyToken, async (req, res, next) => {
  try {
    const { data: existing } = await supabaseAdmin.from('coupons').select('id,businesses(owner_id)').eq('id', req.params.id).single();
    if (!existing) return res.status(404).json({ error: 'Coupon not found' });
    if (existing.businesses?.owner_id !== req.user.id && req.user.role !== 'creator')
      return res.status(403).json({ error: 'Not your coupon' });
    const { error } = await supabaseAdmin.from('coupons').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Coupon deleted' });
  } catch (err) { next(err); }
});

// ── Validate a code at checkout (public) — does NOT redeem yet ──
router.post('/validate', async (req, res, next) => {
  try {
    const { business_id, code, order_amount } = req.body;
    if (!business_id || !code) return res.status(400).json({ error: 'business_id and code are required' });
    const { data: coupon } = await supabaseAdmin.from('coupons').select('*')
      .eq('business_id', business_id).eq('code', code.trim().toUpperCase()).eq('is_active', true).maybeSingle();
    if (!coupon) return res.status(404).json({ error: 'Invalid or inactive coupon code' });
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) return res.status(400).json({ error: 'This coupon has expired' });
    if (coupon.max_uses && coupon.used_count >= coupon.max_uses) return res.status(400).json({ error: 'This coupon has reached its usage limit' });
    if (order_amount && order_amount < coupon.min_order_amount) return res.status(400).json({ error: `Minimum order of GH₵${coupon.min_order_amount} required` });

    const discount = coupon.discount_type === 'percent'
      ? Math.round((order_amount || 0) * (coupon.discount_value / 100) * 100) / 100
      : coupon.discount_value;
    res.json({ valid: true, coupon_id: coupon.id, discount_type: coupon.discount_type, discount_value: coupon.discount_value, discount_amount: discount });
  } catch (err) { next(err); }
});

// ── Redeem (called by orders flow once payment succeeds) ─────
router.post('/redeem', verifyToken, async (req, res, next) => {
  try {
    const { coupon_id, order_id, discount_applied } = req.body;
    if (!coupon_id || discount_applied === undefined) return res.status(400).json({ error: 'coupon_id and discount_applied are required' });
    const { data: coupon } = await supabaseAdmin.from('coupons').select('id,code,used_count,max_uses,business_id').eq('id', coupon_id).single();
    if (!coupon) return res.status(404).json({ error: 'Coupon not found' });
    if (coupon.max_uses && coupon.used_count >= coupon.max_uses) return res.status(400).json({ error: 'Coupon usage limit reached' });

    await supabaseAdmin.from('coupon_redemptions').insert({ coupon_id, order_id: order_id || null, customer_id: req.user.id, discount_applied });
    await supabaseAdmin.from('coupons').update({ used_count: coupon.used_count + 1 }).eq('id', coupon_id);

    const { data: biz } = await supabaseAdmin.from('businesses').select('owner_id,name').eq('id', coupon.business_id).maybeSingle();
    if (biz?.owner_id) await notify(biz.owner_id, 'info', '🎟️ Coupon redeemed', `A customer just used code ${coupon.code} on ${biz.name}.`, '/pages/dashboard.html?tab=coupons');

    res.status(201).json({ message: 'Coupon redeemed' });
  } catch (err) { next(err); }
});

module.exports = router;
