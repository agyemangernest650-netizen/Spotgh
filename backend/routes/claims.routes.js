// backend/routes/claims.routes.js
// "Claim this Business" — a real owner takes over a listing the creator
// added on their behalf before they had an account.
const router = require('express').Router();
const { supabaseAdmin } = require('../config/supabase');
const { verifyToken, requireAdmin } = require('../middleware/auth.middleware');
const { uploaders } = require('../config/cloudinary');
const { notify, audit, paginate } = require('../services/supabase.service');
const limits = require('../middleware/rateLimit.middleware');

// ── Submit a claim request (any logged-in user) ────────────────
router.post('/:businessId', verifyToken, limits.upload, uploaders.claim.single('proof'), async (req, res, next) => {
  try {
    const { full_name, phone, role_at_business, message } = req.body;
    if (!full_name || !phone) return res.status(400).json({ error: 'full_name and phone are required' });

    const { data: biz } = await supabaseAdmin.from('businesses')
      .select('id,name,owner_id,is_claimed').eq('id', req.params.businessId).maybeSingle();
    if (!biz) return res.status(404).json({ error: 'Business not found' });
    if (biz.is_claimed) return res.status(409).json({ error: 'This business has already been claimed' });

    const { data: pending } = await supabaseAdmin.from('business_claims')
      .select('id').eq('business_id', biz.id).eq('requested_by', req.user.id).eq('status', 'pending').maybeSingle();
    if (pending) return res.status(409).json({ error: 'You already have a pending claim request for this business' });

    const { data, error } = await supabaseAdmin.from('business_claims').insert({
      business_id: biz.id, requested_by: req.user.id, full_name, phone,
      role_at_business: role_at_business || null, message: message || null,
      proof_url: req.file ? req.file.path : null,
    }).select().single();
    if (error) throw error;

    res.status(201).json({ claim: data, message: 'Claim submitted. We typically review within 2 business days.' });
  } catch (err) { next(err); }
});

// ── Check my own claim requests ─────────────────────────────────
router.get('/mine', verifyToken, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('business_claims')
      .select('*,businesses(name,slug,city)').eq('requested_by', req.user.id).order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ claims: data });
  } catch (err) { next(err); }
});

// ── Creator: list pending claims ────────────────────────────────
router.get('/pending', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const { from, to, page: pg, limit: lm } = paginate(page, limit);
    const { data, count, error } = await supabaseAdmin.from('business_claims')
      .select('*,businesses(name,slug,city),users!business_claims_requested_by_fkey(full_name,email)', { count: 'exact' })
      .eq('status', 'pending').order('created_at').range(from, to);
    if (error) throw error;
    res.json({ claims: data, pagination: { total: count, page: pg, limit: lm } });
  } catch (err) { next(err); }
});

// ── Creator: approve — transfers ownership ──────────────────────
router.patch('/:id/approve', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { data: claim } = await supabaseAdmin.from('business_claims').select('*').eq('id', req.params.id).single();
    if (!claim) return res.status(404).json({ error: 'Claim not found' });
    if (claim.status !== 'pending') return res.status(409).json({ error: 'Claim already reviewed' });

    await supabaseAdmin.from('businesses')
      .update({ owner_id: claim.requested_by, is_claimed: true }).eq('id', claim.business_id);

    await supabaseAdmin.from('users')
      .update({ role: 'business_owner' }).eq('id', claim.requested_by).eq('role', 'user');

    await supabaseAdmin.from('business_claims').update({
      status: 'approved', reviewed_by: req.user.id, reviewed_at: new Date().toISOString(),
    }).eq('id', claim.id);

    // Any other pending claims on the same business are now moot
    await supabaseAdmin.from('business_claims').update({
      status: 'rejected', reviewed_by: req.user.id, reviewed_at: new Date().toISOString(),
      rejection_reason: 'Another claim for this business was approved.',
    }).eq('business_id', claim.business_id).eq('status', 'pending').neq('id', claim.id);

    await audit(req.user.id, 'approve_claim', 'business', claim.business_id, null, { requested_by: claim.requested_by }, req);
    const { data: biz } = await supabaseAdmin.from('businesses').select('name').eq('id', claim.business_id).single();
    await notify(claim.requested_by, 'success', '🎉 Business claimed!', `You now manage ${biz?.name || 'your business'} on SpotGH.`, '/dashboard');

    res.json({ message: 'Claim approved, ownership transferred' });
  } catch (err) { next(err); }
});

// ── Creator: reject ──────────────────────────────────────────────
router.patch('/:id/reject', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { reason } = req.body;
    const { data: claim } = await supabaseAdmin.from('business_claims').select('*').eq('id', req.params.id).single();
    if (!claim) return res.status(404).json({ error: 'Claim not found' });
    if (claim.status !== 'pending') return res.status(409).json({ error: 'Claim already reviewed' });

    await supabaseAdmin.from('business_claims').update({
      status: 'rejected', reviewed_by: req.user.id, reviewed_at: new Date().toISOString(),
      rejection_reason: reason || null,
    }).eq('id', claim.id);

    await audit(req.user.id, 'reject_claim', 'business', claim.business_id, null, { reason }, req);
    await notify(claim.requested_by, 'warning', 'Claim not approved', reason || 'We could not verify your ownership. Contact support if you believe this is a mistake.', '/dashboard');

    res.json({ message: 'Claim rejected' });
  } catch (err) { next(err); }
});

module.exports = router;
