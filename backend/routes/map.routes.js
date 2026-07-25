// backend/routes/map.routes.js
const router = require('express').Router();
const { supabaseAdmin } = require('../config/supabase');
const { verifyToken, requireAdmin, requireCreator, requireOwnership, optionalAuth } = require('../middleware/auth.middleware');
const { paginate, notify, audit } = require('../services/supabase.service');
const limits = require('../middleware/rateLimit.middleware');
router.get('/businesses', async (req, res, next) => {
  try {
    const { category, location, search, lat, lng, radius_km } = req.query;
    let q = supabaseAdmin.from('businesses').select('id,name,slug,city,latitude,longitude,logo_url,is_featured,whatsapp,phone').eq('status','active').not('latitude','is',null).not('longitude','is',null);
    if (category) q = q.eq('category_id', category);
    if (location) q = q.ilike('city', `%${location}%`);
    if (search) q = q.ilike('name', `%${search}%`);
    const { data, error } = await q.limit(500);
    if (error) throw error;

    let pins = data;
    if (lat && lng) {
      const userLat = Number(lat), userLng = Number(lng), maxKm = Number(radius_km) || 15;
      pins = pins.map(b => ({ ...b, distance_km: haversine(userLat, userLng, b.latitude, b.longitude) }))
        .filter(b => b.distance_km <= maxKm)
        .sort((a, b) => a.distance_km - b.distance_km);
    }
    res.json({ pins: pins.slice(0, 200) });
  } catch (err) { next(err); }
});

// ── Nearby businesses — dedicated endpoint for "near me" UI (requires GPS coords) ──
router.get('/nearby', async (req, res, next) => {
  try {
    const { lat, lng, radius_km, category, page, limit } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'lat and lng are required' });
    const { from, to, page: pg, limit: lm } = paginate(page, limit);

    let q = supabaseAdmin.from('businesses')
      .select('id,name,slug,city,latitude,longitude,logo_url,cover_url,avg_rating,review_count,categories(name)')
      .eq('status', 'active').not('latitude', 'is', null).not('longitude', 'is', null);
    if (category) q = q.eq('category_id', category);
    const { data, error } = await q.limit(1000);
    if (error) throw error;

    const userLat = Number(lat), userLng = Number(lng), maxKm = Number(radius_km) || 10;
    const nearby = data
      .map(b => ({ ...b, distance_km: Math.round(haversine(userLat, userLng, b.latitude, b.longitude) * 10) / 10 }))
      .filter(b => b.distance_km <= maxKm)
      .sort((a, b) => a.distance_km - b.distance_km);

    res.json({ businesses: nearby.slice(from, to + 1), pagination: { total: nearby.length, page: pg, limit: lm } });
  } catch (err) { next(err); }
});

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

module.exports = router;
