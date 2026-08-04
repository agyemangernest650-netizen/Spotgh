// backend/routes/verification.routes.js
const router = require('express').Router();
const { supabaseAdmin } = require('../config/supabase');
const { verifyToken, requireOwnership, requireAdmin } = require('../middleware/auth.middleware');
const { uploaders } = require('../config/cloudinary');
const { notify, audit, paginate } = require('../services/supabase.service');
const limits = require('../middleware/rateLimit.middleware');

// ── Submit a verification request (owner) ────────────────────
router.post('/business/:businessId', verifyToken, requireOwnership, limits.upload,
  uploaders.verification.single('document'), async (req, res, next) => {
  try {
    const { document_type, document_number } = req.body;
    if (!document_type || !['ghana_card','business_registration','tin'].includes(document_type))
      return res.status(400).json({ error: 'Valid document_type is required (ghana_card, business_registration, or tin)' });
    if (!req.file) return res.status(400).json({ error: 'Document file is required' });

    const { data: pending } = await supabaseAdmin.from('verification_requests')
      .select('id').eq('business_id', req.params.businessId).eq('status', 'pending').maybeSingle();
    if (pending) return res.status(409).json({ error: 'You already have a pending verification request' });

    const { data, error } = await supabaseAdmin.from('verification_requests').insert({
      business_id: req.params.businessId, submitted_by: req.user.id, document_type,
      document_url: req.file.path, document_number: document_number || null,
    }).select().single();
    if (error) throw error;

    res.status(201).json({ request: data, message: 'Verification request submitted. We typically review within 2 business days.' });
  } catch (err) { next(err); }
});

// ── Check my business's verification status (owner) ──────────
router.get('/business/:businessId', verifyToken, requireOwnership, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('verification_requests')
      .select('*').eq('business_id', req.params.businessId).order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ requests: data });
  } catch (err) { next(err); }
});

// ── Admin: list pending requests ──────────────────────────────
router.get('/pending', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const { from, to, page: pg, limit: lm } = paginate(page, limit);
    const { data, count, error } = await supabaseAdmin.from('verification_requests')
      .select('*,businesses(name,slug,city),users!verification_requests_submitted_by_fkey(name,email)', { count: 'exact' })
      .eq('status', 'pending').order('created_at').range(from, to);
    if (error) throw error;
    res.json({ requests: data, pagination: { total: count, page: pg, limit: lm } });
  } catch (err) { next(err); }
});

// ── Admin: approve ────────────────────────────────────────────
router.patch('/:id/approve', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { data: reqRow } = await supabaseAdmin.from('verification_requests').select('*').eq('id', req.params.id).single();
    if (!reqRow) return res.status(404).json({ error: 'Request not found' });

    await supabaseAdmin.from('verification_requests').update({ status: 'approved', reviewed_by: req.user.id, reviewed_at: new Date().toISOString() }).eq('id', reqRow.id);
    const { data: biz } = await supabaseAdmin.from('businesses').update({ is_verified: true }).eq('id', reqRow.business_id).select('owner_id,name').single();
    await audit(req.user.id, 'approve_verification', 'business', reqRow.business_id, null, { status: 'approved' }, req);
    if (biz) await notify(biz.owner_id, 'success', '✅ Business verified!', `${biz.name} now has a verified badge.`, `/dashboard`);

    res.json({ message: 'Verification approved' });
  } catch (err) { next(err); }
});

// ── Admin: reject ──────────────────────────────────────────────
router.patch('/:id/reject', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { reason } = req.body;
    const { data: reqRow } = await supabaseAdmin.from('verification_requests').select('*').eq('id', req.params.id).single();
    if (!reqRow) return res.status(404).json({ error: 'Request not found' });

    await supabaseAdmin.from('verification_requests').update({
      status: 'rejected', reviewed_by: req.user.id, reviewed_at: new Date().toISOString(), rejection_reason: reason || null,
    }).eq('id', reqRow.id);
    const { data: biz } = await supabaseAdmin.from('businesses').select('owner_id,name').eq('id', reqRow.business_id).single();
    await audit(req.user.id, 'reject_verification', 'business', reqRow.business_id, null, { status: 'rejected', reason }, req);
    if (biz) await notify(biz.owner_id, 'warning', 'Verification not approved', reason || 'Please review your documents and try again.', `/dashboard`);

    res.json({ message: 'Verification rejected' });
  } catch (err) { next(err); }
});

module.exports = router;
