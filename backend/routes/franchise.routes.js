// backend/routes/franchise.routes.js
const router = require('express').Router();
const { supabaseAdmin } = require('../config/supabase');
const { verifyToken } = require('../middleware/auth.middleware');
const { audit } = require('../services/supabase.service');
const { deleteImage } = require('../services/cloudinary.service');
const uploaders = require('../config/cloudinary').uploaders;

router.use(verifyToken);

// A franchise only ever belongs to whoever created it — creator/super admin
// concept doesn't apply here the way it does for platform-wide admin
// routes, since this is an owner's own brand grouping, not shared platform
// data. Loads the franchise and 403s if the caller isn't its owner.
async function loadOwnFranchise(req, res, next) {
  const { data: franchise } = await supabaseAdmin.from('franchises').select('*').eq('id', req.params.id).maybeSingle();
  if (!franchise) return res.status(404).json({ error: 'Franchise not found' });
  if (franchise.owner_id !== req.user.id && req.user.role !== 'creator')
    return res.status(403).json({ error: 'Not your franchise' });
  req.franchise = franchise;
  next();
}

// GET /api/franchises/mine — every franchise the caller owns, each with
// aggregated stats across all its locations.
router.get('/mine', async (req, res, next) => {
  try {
    const { data: franchises, error } = await supabaseAdmin.from('franchises').select('*').eq('owner_id', req.user.id).order('created_at', { ascending: false });
    if (error) throw error;

    const withStats = await Promise.all((franchises || []).map(async (f) => {
      const { data: businesses } = await supabaseAdmin.from('businesses_with_stats').select('id,view_count,whatsapp_click_count,avg_rating,review_count,booking_count').eq('franchise_id', f.id);
      const locations = businesses || [];
      const totalViews = locations.reduce((s, b) => s + (b.view_count || 0), 0);
      const totalWhatsapp = locations.reduce((s, b) => s + (b.whatsapp_click_count || 0), 0);
      const totalBookings = locations.reduce((s, b) => s + (b.booking_count || 0), 0);
      const ratedLocations = locations.filter(b => b.review_count > 0);
      const avgRating = ratedLocations.length
        ? (ratedLocations.reduce((s, b) => s + Number(b.avg_rating || 0), 0) / ratedLocations.length).toFixed(1)
        : null;
      return { ...f, location_count: locations.length, total_views: totalViews, total_whatsapp_clicks: totalWhatsapp, total_bookings: totalBookings, avg_rating: avgRating };
    }));

    res.json({ franchises: withStats });
  } catch (err) { next(err); }
});

// POST /api/franchises — create a new franchise brand
// Franchise grouping is a Pro+ feature — gate it on whether the caller owns
// at least one business on a plan with has_franchise true. Previously this
// had no plan check at all: any account, including Free, could group
// businesses into a franchise.
router.post('/', async (req, res, next) => {
  try {
    const { name, description, theme_color } = req.body;
    if (!name) return res.status(400).json({ error: 'Franchise name is required' });

    if (req.user.role !== 'creator') {
      const { getDirectoryAccess } = require('../services/planAccess.service');
      const { data: businesses } = await supabaseAdmin.from('businesses').select('id').eq('owner_id', req.user.id);
      const accessChecks = await Promise.all((businesses || []).map(b => getDirectoryAccess(b.id)));
      const hasFranchiseFeature = accessChecks.some(a => a?.plan.has_franchise);
      if (!hasFranchiseFeature)
        return res.status(403).json({ error: 'Franchise grouping is a Premium Directory plan feature. Upgrade a business to Premium first.', code: 'FEATURE_NOT_INCLUDED', redirect: '/pricing' });
    }

    const { data, error } = await supabaseAdmin.from('franchises').insert({ owner_id: req.user.id, name, description: description || null, theme_color: theme_color || null }).select().single();
    if (error) throw error;
    await audit(req.user.id, 'franchise_created', 'franchise', data.id, null, { name }, req);
    res.status(201).json({ franchise: data });
  } catch (err) { next(err); }
});

// GET /api/franchises/:id — detail + every location with its own stats
router.get('/:id', loadOwnFranchise, async (req, res, next) => {
  try {
    const { data: businesses, error } = await supabaseAdmin.from('businesses_with_stats').select('*').eq('franchise_id', req.franchise.id).order('name');
    if (error) throw error;
    res.json({ franchise: req.franchise, locations: businesses || [] });
  } catch (err) { next(err); }
});

// PATCH /api/franchises/:id
router.patch('/:id', loadOwnFranchise, async (req, res, next) => {
  try {
    const allowed = ['name', 'description', 'theme_color'];
    const updates = {}; allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    const { data, error } = await supabaseAdmin.from('franchises').update(updates).eq('id', req.franchise.id).select().single();
    if (error) throw error;
    res.json({ franchise: data });
  } catch (err) { next(err); }
});

// DELETE /api/franchises/:id — member businesses aren't deleted, just
// ungrouped (franchise_id set to null via ON DELETE SET NULL)
router.delete('/:id', loadOwnFranchise, async (req, res, next) => {
  try {
    if (req.franchise.logo_public_id) await deleteImage(req.franchise.logo_public_id).catch(() => {});
    await supabaseAdmin.from('franchises').delete().eq('id', req.franchise.id);
    await audit(req.user.id, 'franchise_deleted', 'franchise', req.franchise.id, req.franchise, null, req);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /api/franchises/:id/logo
router.post('/:id/logo', loadOwnFranchise, uploaders.logo.single('logo'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    if (req.franchise.logo_public_id) await deleteImage(req.franchise.logo_public_id).catch(() => {});
    const { data, error } = await supabaseAdmin.from('franchises').update({ logo_url: req.file.path, logo_public_id: req.file.filename }).eq('id', req.franchise.id).select().single();
    if (error) throw error;
    res.json({ url: req.file.path, franchise: data });
  } catch (err) { next(err); }
});

// POST /api/franchises/:id/businesses — add one of the caller's own
// businesses to this franchise (can't add someone else's business)
router.post('/:id/businesses', loadOwnFranchise, async (req, res, next) => {
  try {
    const { business_id } = req.body;
    if (!business_id) return res.status(400).json({ error: 'business_id required' });
    const { data: biz } = await supabaseAdmin.from('businesses').select('id,owner_id').eq('id', business_id).maybeSingle();
    if (!biz) return res.status(404).json({ error: 'Business not found' });
    if (biz.owner_id !== req.user.id) return res.status(403).json({ error: 'You can only add your own businesses to a franchise' });
    const { data, error } = await supabaseAdmin.from('businesses').update({ franchise_id: req.franchise.id }).eq('id', business_id).select().single();
    if (error) throw error;
    res.json({ business: data });
  } catch (err) { next(err); }
});

// DELETE /api/franchises/:id/businesses/:businessId — remove from the
// franchise (the business itself keeps existing, just ungrouped)
router.delete('/:id/businesses/:businessId', loadOwnFranchise, async (req, res, next) => {
  try {
    const { data: biz } = await supabaseAdmin.from('businesses').select('id,owner_id,franchise_id').eq('id', req.params.businessId).maybeSingle();
    if (!biz || biz.franchise_id !== req.franchise.id) return res.status(404).json({ error: 'That business is not part of this franchise' });
    await supabaseAdmin.from('businesses').update({ franchise_id: null }).eq('id', req.params.businessId);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /api/franchises/:id/apply-branding — push the franchise's logo/
// theme_color to every member location in one click, rather than an
// owner having to edit each business individually.
router.post('/:id/apply-branding', loadOwnFranchise, async (req, res, next) => {
  try {
    const updates = {};
    if (req.franchise.logo_url) updates.logo_url = req.franchise.logo_url;
    if (req.franchise.theme_color) updates.theme_color = req.franchise.theme_color;
    if (!Object.keys(updates).length) return res.status(400).json({ error: 'Set a franchise logo or theme color first' });
    const { data, error } = await supabaseAdmin.from('businesses').update(updates).eq('franchise_id', req.franchise.id).select('id');
    if (error) throw error;
    res.json({ updated_count: data?.length || 0 });
  } catch (err) { next(err); }
});

module.exports = router;
