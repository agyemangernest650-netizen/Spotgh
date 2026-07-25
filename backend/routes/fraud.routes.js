// backend/routes/fraud.routes.js
const router = require('express').Router();
const { supabaseAdmin } = require('../config/supabase');
const { verifyToken, requireAdmin } = require('../middleware/auth.middleware');
const { paginate } = require('../services/supabase.service');

router.get('/', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { status, severity, page, limit } = req.query;
    const { from, to, page: pg, limit: lm } = paginate(page, limit);
    let q = supabaseAdmin.from('fraud_flags').select('*', { count: 'exact' }).order('created_at', { ascending: false });
    if (status) q = q.eq('status', status); else q = q.eq('status', 'open');
    if (severity) q = q.eq('severity', severity);
    const { data, count, error } = await q.range(from, to);
    if (error) throw error;
    res.json({ flags: data, pagination: { total: count, page: pg, limit: lm } });
  } catch (err) { next(err); }
});

router.patch('/:id', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { status } = req.body; // 'dismissed' or 'confirmed'
    if (!['dismissed', 'confirmed'].includes(status)) return res.status(400).json({ error: 'status must be dismissed or confirmed' });
    const { data, error } = await supabaseAdmin.from('fraud_flags').update({ status, reviewed_by: req.user.id }).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ flag: data });
  } catch (err) { next(err); }
});

module.exports = router;
