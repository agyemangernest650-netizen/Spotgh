// backend/routes/locations.routes.js
const router = require('express').Router();
const { supabaseAdmin } = require('../config/supabase');
const cache = require('../services/cache.service');

// GET /api/locations — public. Backs the city/region filter dropdowns
// (directory search, business creation) so they reflect the actual
// `locations` table instead of a hardcoded list of Ghanaian cities
// baked into the frontend. Also makes future expansion beyond Ghana
// just a matter of seeding new rows — `country` is already a column
// on this table, not something the frontend needs to know about.
router.get('/', async (req, res, next) => {
  try {
    const data = await cache.wrap('locations:active', 10 * 60 * 1000, async () => {
      const { data, error } = await supabaseAdmin
        .from('locations')
        .select('id,name,slug,city,region,country')
        .eq('is_active', true)
        .order('city');
      if (error) throw error;
      return data;
    });
    res.json({ locations: data });
  } catch (err) { next(err); }
});

module.exports = router;
