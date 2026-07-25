// backend/routes/loyalty.routes.js
const router = require('express').Router();
const { supabaseAdmin } = require('../config/supabase');
const { verifyToken, requireOwnership } = require('../middleware/auth.middleware');

// ── Customer: my points at a business ─────────────────────────
router.get('/business/:businessId/mine', verifyToken, async (req, res, next) => {
  try {
    const { data } = await supabaseAdmin.from('loyalty_points').select('*')
      .eq('customer_id', req.user.id).eq('business_id', req.params.businessId).maybeSingle();
    const { data: biz } = await supabaseAdmin.from('businesses').select('loyalty_points_per_ghs,loyalty_redemption_rate').eq('id', req.params.businessId).single();
    res.json({ balance: data?.balance || 0, lifetime_earned: data?.lifetime_earned || 0, ...biz });
  } catch (err) { next(err); }
});

// ── Customer: all my points across businesses ─────────────────
router.get('/mine', verifyToken, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('loyalty_points')
      .select('*,businesses(name,slug,logo_url)').eq('customer_id', req.user.id).order('balance', { ascending: false });
    if (error) throw error;
    res.json({ points: data });
  } catch (err) { next(err); }
});

// ── Earn points (called internally after a paid order — also exposed for manual award by owner) ──
router.post('/business/:businessId/earn', verifyToken, requireOwnership, async (req, res, next) => {
  try {
    const { customer_id, points, reason, order_id } = req.body;
    if (!customer_id || !points) return res.status(400).json({ error: 'customer_id and points are required' });
    await awardPoints(customer_id, req.params.businessId, points, reason || 'Manual award', order_id);
    res.json({ message: 'Points awarded' });
  } catch (err) { next(err); }
});

// ── Redeem points for a discount at checkout ──────────────────
router.post('/business/:businessId/redeem', verifyToken, async (req, res, next) => {
  try {
    const { points } = req.body;
    if (!points || points <= 0) return res.status(400).json({ error: 'points must be a positive number' });

    const { data: account } = await supabaseAdmin.from('loyalty_points').select('*')
      .eq('customer_id', req.user.id).eq('business_id', req.params.businessId).maybeSingle();
    if (!account || account.balance < points) return res.status(400).json({ error: 'Not enough points' });

    const { data: biz } = await supabaseAdmin.from('businesses').select('loyalty_redemption_rate').eq('id', req.params.businessId).single();
    const discountValue = Math.round(points * (biz.loyalty_redemption_rate || 0.1) * 100) / 100;

    await supabaseAdmin.from('loyalty_points').update({ balance: account.balance - points }).eq('id', account.id);
    await supabaseAdmin.from('loyalty_transactions').insert({ customer_id: req.user.id, business_id: req.params.businessId, points: -points, reason: 'Redeemed for discount' });

    res.json({ points_redeemed: points, discount_value: discountValue, remaining_balance: account.balance - points });
  } catch (err) { next(err); }
});

// Shared helper — call this from orders.routes.js after a paid order to auto-earn points
async function awardPoints(customerId, businessId, points, reason, orderId = null) {
  const { data: existing } = await supabaseAdmin.from('loyalty_points').select('*').eq('customer_id', customerId).eq('business_id', businessId).maybeSingle();
  if (existing) {
    await supabaseAdmin.from('loyalty_points').update({
      balance: existing.balance + points, lifetime_earned: existing.lifetime_earned + Math.max(0, points), updated_at: new Date().toISOString(),
    }).eq('id', existing.id);
  } else {
    await supabaseAdmin.from('loyalty_points').insert({ customer_id: customerId, business_id: businessId, balance: points, lifetime_earned: Math.max(0, points) });
  }
  await supabaseAdmin.from('loyalty_transactions').insert({ customer_id: customerId, business_id: businessId, points, reason, order_id: orderId });
}

module.exports = router;
module.exports.awardPoints = awardPoints;
