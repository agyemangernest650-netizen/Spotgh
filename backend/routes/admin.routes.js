// backend/routes/admin.routes.js
const router = require('express').Router();
const { supabaseAdmin } = require('../config/supabase');
const { verifyToken, requireAdmin, requireCreator, requireOwnership, optionalAuth } = require('../middleware/auth.middleware');
const { paginate, notify, audit, sanitizeSearchTerm } = require('../services/supabase.service');
const { sendSMS } = require('../services/sms.service');
const limits = require('../middleware/rateLimit.middleware');
router.use(verifyToken, requireAdmin);
router.get('/dashboard', async (req, res, next) => {
  try {
    const [u,b,p,r] = await Promise.all([
      supabaseAdmin.from('users').select('id',{count:'exact'}),
      supabaseAdmin.from('businesses').select('id',{count:'exact'}).eq('status','active'),
      supabaseAdmin.from('businesses').select('id',{count:'exact'}).eq('status','pending'),
      supabaseAdmin.from('reviews').select('id',{count:'exact'}),
    ]);
    const { data: recent } = await supabaseAdmin.from('businesses_admin_view').select('*').order('created_at',{ascending:false}).limit(10);
    res.json({ stats:{ total_users:u.count||0, active_businesses:b.count||0, pending_businesses:p.count||0, total_reviews:r.count||0 }, recent_businesses:recent||[] });
  } catch (err) { next(err); }
});
router.get('/businesses', async (req, res, next) => {
  try {
    const { status, search, page, limit } = req.query; const { from, to, page:pg, limit:lm } = paginate(page, limit);
    let q = supabaseAdmin.from('businesses_admin_view').select('*',{count:'exact'});
    if (status) q = q.eq('status',status);
    if (search) { const s = sanitizeSearchTerm(search); q = q.or(`name.ilike.%${s}%,owner_email.ilike.%${s}%`); }
    const { data, count } = await q.order('created_at',{ascending:false}).range(from,to);
    res.json({ businesses:data, pagination:{total:count,page:pg,limit:lm} });
  } catch (err) { next(err); }
});
router.patch('/businesses/:id/status', async (req, res, next) => {
  try {
    const { status, reason } = req.body;
    if (!['active','pending','suspended','rejected'].includes(status)) return res.status(400).json({error:'Invalid status'});
    const updates = { status }; if (status==='active') updates.published_at = new Date().toISOString(); if (reason) updates.rejection_reason = reason;
    const { data, error } = await supabaseAdmin.from('businesses').update(updates).eq('id',req.params.id).select().single();
    if (error) throw error;
    await audit(req.user.id, `business_${status}`, 'business', req.params.id, null, {reason}, req);
    if (status==='active') {
      await notify(data.owner_id,'success',`✅ ${data.name} is now live!`,`Your business has been approved. Share your link!`,`/pages/business.html?slug=${data.slug}`);
      const { data: owner } = await supabaseAdmin.from('users').select('phone').eq('id', data.owner_id).maybeSingle();
      if (owner?.phone) await sendSMS(owner.phone, `SpotGH: Great news! ${data.name} is now live and visible to customers. View it at spotgh.com/pages/business.html?slug=${data.slug}`);
    }
    if (status==='rejected') await notify(data.owner_id,'danger',`❌ ${data.name} was not approved`, reason||'Please review our guidelines and resubmit.',`/pages/dashboard.html?tab=businesses`);
    res.json({ business:data });
  } catch (err) { next(err); }
});
router.patch('/businesses/:id/featured', async (req, res, next) => {
  try {
    const { is_featured } = req.body;
    const { data, error } = await supabaseAdmin.from('businesses').update({is_featured}).eq('id',req.params.id).select().single();
    if (error) throw error; res.json({ business:data });
  } catch (err) { next(err); }
});
router.get('/users', async (req, res, next) => {
  try {
    const { role, search, page, limit } = req.query; const { from, to, page:pg, limit:lm } = paginate(page, limit);
    let q = supabaseAdmin.from('users').select('id,email,full_name,role,is_active,is_banned,created_at,last_login_at',{count:'exact'});
    if (role) q = q.eq('role',role); if (search) { const s = sanitizeSearchTerm(search); q = q.or(`full_name.ilike.%${s}%,email.ilike.%${s}%`); }
    const { data, count } = await q.order('created_at',{ascending:false}).range(from,to);
    res.json({ users:data, pagination:{total:count,page:pg,limit:lm} });
  } catch (err) { next(err); }
});
router.patch('/users/:id', async (req, res, next) => {
  try {
    const { role, is_active, is_banned, ban_reason } = req.body; const updates = {};
    // Plain 'admin' accounts may only move users between the two ordinary,
    // non-privileged roles. Granting admin/super_admin/creator (or editing
    // an existing admin/super_admin/creator's role) requires the dedicated
    // creator-only endpoint (/api/creator/users/:id) -- otherwise any admin
    // could silently promote themselves (or an ally) to super_admin.
    const ELEVATED_ROLES = ['admin', 'super_admin', 'creator'];
    const ASSIGNABLE_ROLES = ['user', 'business_owner'];
    if (role) {
      if (!ASSIGNABLE_ROLES.includes(role))
        return res.status(403).json({ error: 'Only super_admin/creator can grant elevated roles. Use the creator console.' });
      const { data: target } = await supabaseAdmin.from('users').select('role').eq('id', req.params.id).single();
      if (target && ELEVATED_ROLES.includes(target.role))
        return res.status(403).json({ error: 'Only super_admin/creator can modify an elevated account.' });
      updates.role = role;
    }
    if (is_active!==undefined) updates.is_active=is_active;
    if (is_banned!==undefined) { updates.is_banned=is_banned; if(ban_reason) updates.ban_reason=ban_reason; }
    const { data, error } = await supabaseAdmin.from('users').update(updates).eq('id',req.params.id).select().single();
    if (error) throw error;
    await audit(req.user.id,'user_updated','user',req.params.id,null,updates,req);
    res.json({ user:data });
  } catch (err) { next(err); }
});
module.exports = router;
