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

// req.plan now resolves the user's Directory plan (business listing
// limits: max_businesses, max_photos, etc.) — see planAccess.service.js.
// Directory and Website are independent subscriptions as of migration 018;
// website-specific gating (has_bookings, has_custom_domain, etc.) is
// checked per-business via getWebsiteAccess(), not through req.plan.
const loadPlan = async (req, res, next) => {
  try {
    const { getUserDirectoryPlan } = require('../services/planAccess.service');
    req.plan = await getUserDirectoryPlan(req.user.id);
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
