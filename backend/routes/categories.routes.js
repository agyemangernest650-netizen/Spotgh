// backend/routes/categories.routes.js
const router = require('express').Router();
const { supabaseAdmin } = require('../config/supabase');
const { verifyToken, requireAdmin, requireCreator, requireOwnership, optionalAuth } = require('../middleware/auth.middleware');
const { paginate, notify, audit } = require('../services/supabase.service');
const cache = require('../services/cache.service');
const limits = require('../middleware/rateLimit.middleware');
router.get('/', async (req, res, next) => {
  try {
    const data = await cache.wrap('categories:active', 5 * 60 * 1000, async () => {
      const { data, error } = await supabaseAdmin.from('categories').select('*').eq('is_active', true).order('sort_order');
      if (error) throw error;
      return data;
    });
    res.json({ categories: data });
  } catch (err) { next(err); }
});
router.get('/:slug', async (req, res, next) => {
  try {
    const { data: cat } = await supabaseAdmin.from('categories').select('*').eq('slug', req.params.slug).single();
    if (!cat) return res.status(404).json({ error: 'Category not found' });
    const { data: businesses } = await supabaseAdmin.from('businesses_with_stats').select('*').eq('category_slug', req.params.slug).eq('status', 'active').order('is_featured', { ascending: false }).limit(24);
    res.json({ category: cat, businesses: businesses || [] });
  } catch (err) { next(err); }
});
module.exports = router;
