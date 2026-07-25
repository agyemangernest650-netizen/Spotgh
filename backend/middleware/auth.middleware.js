// backend/middleware/auth.middleware.js
const jwt = require('jsonwebtoken');
const { supabaseAdmin } = require('../config/supabase');
const env = require('../config/env');

const verifyToken = async (req, res, next) => {
  try {
    const token =
      req.headers.authorization?.replace('Bearer ', '') ||
      req.cookies?.auth_token;

    if (!token) return res.status(401).json({ error: 'Authentication required' });

    const decoded = jwt.verify(token, env.JWT_SECRET);
    const { data: user, error } = await supabaseAdmin
      .from('users').select('*').eq('id', decoded.userId).single();

    if (error || !user)  return res.status(401).json({ error: 'User not found' });
    if (!user.is_active) return res.status(403).json({ error: 'Account suspended' });
    if (user.is_banned)  return res.status(403).json({ error: 'Account banned' });

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError')
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const token =
      req.headers.authorization?.replace('Bearer ', '') ||
      req.cookies?.auth_token;
    if (!token) return next();
    const decoded = jwt.verify(token, env.JWT_SECRET);
    const { data: user } = await supabaseAdmin
      .from('users').select('*').eq('id', decoded.userId).single();
    req.user = user || null;
  } catch {
    req.user = null;
  }
  next();
};

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  if (!roles.includes(req.user.role))
    return res.status(403).json({ error: `Access denied. Required: ${roles.join(' or ')}` });
  next();
};

// SpotGH only has three roles: creator (platform admin), business_owner, user.
// requireAdmin is kept as a name (routes read more clearly with it) but now
// means exactly the same thing as requireCreator.
const requireAdmin         = requireRole('creator');
const requireBusinessOwner = requireRole('business_owner', 'creator');
const requireCreator       = requireRole('creator');

const requireOwnership = async (req, res, next) => {
  try {
    if (req.user?.role === 'creator') return next();
    const id = req.params.businessId || req.params.id;
    const { data: biz } = await supabaseAdmin
      .from('businesses').select('id,owner_id').eq('id', id).single();
    if (!biz) return res.status(404).json({ error: 'Business not found' });
    if (biz.owner_id !== req.user.id)
      return res.status(403).json({ error: 'You do not own this business' });
    req.business = biz;
    next();
  } catch (err) { next(err); }
};

const loadPlan = async (req, res, next) => {
  try {
    const { supabaseAdmin } = require('../config/supabase');
    const { data: subs } = await supabaseAdmin
      .from('subscriptions').select('tier,expires_at,plans(*)')
      .eq('user_id', req.user.id).eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: false }).limit(1);
    if (subs?.[0]?.plans) { req.plan = subs[0].plans; return next(); }
    const { data: free } = await supabaseAdmin.from('plans').select('*').eq('tier', 'free').single();
    req.plan = free || null;
    next();
  } catch (err) { next(err); }
};

module.exports = {
  verifyToken,
  optionalAuth,
  requireRole,
  requireAdmin,
  requireBusinessOwner,
  requireCreator,
  requireOwnership,
  loadPlan,
};
