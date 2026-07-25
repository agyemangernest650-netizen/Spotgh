// backend/controllers/upload.controller.js
const { supabaseAdmin } = require('../config/supabase');
const { deleteImage, replaceImage, buildGalleryItems } = require('../services/cloudinary.service');

exports.uploadLogo = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { data: biz } = await supabaseAdmin.from('businesses').select('logo_public_id').eq('id', req.params.id).single();
    if (biz?.logo_public_id) await deleteImage(biz.logo_public_id);
    const { data, error } = await supabaseAdmin.from('businesses')
      .update({ logo_url: req.file.path, logo_public_id: req.file.filename })
      .eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ url: req.file.path, business: data });
  } catch (err) { next(err); }
};

exports.uploadMenu = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { data: biz } = await supabaseAdmin.from('businesses').select('menu_pdf_public_id').eq('id', req.params.id).single();
    if (biz?.menu_pdf_public_id) await deleteImage(biz.menu_pdf_public_id, { resource_type: 'raw' });
    const { data, error } = await supabaseAdmin.from('businesses')
      .update({ menu_pdf_url: req.file.path, menu_pdf_public_id: req.file.filename })
      .eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ url: req.file.path, business: data });
  } catch (err) { next(err); }
};

exports.uploadCover = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { data: biz } = await supabaseAdmin.from('businesses').select('cover_public_id').eq('id', req.params.id).single();
    if (biz?.cover_public_id) await deleteImage(biz.cover_public_id);
    const { data, error } = await supabaseAdmin.from('businesses')
      .update({ cover_url: req.file.path, cover_public_id: req.file.filename })
      .eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ url: req.file.path });
  } catch (err) { next(err); }
};

exports.uploadGallery = async (req, res, next) => {
  try {
    if (!req.files?.length) return res.status(400).json({ error: 'No files uploaded' });
    const type = ['before','after'].includes(req.query.type) ? req.query.type : 'gallery';
    if (type === 'gallery') {
      const { data: biz } = await supabaseAdmin.from('businesses').select('subscription_tier').eq('id', req.params.id).single();
      const { data: plan } = await supabaseAdmin.from('plans').select('max_gallery_photos,name').eq('tier', biz?.subscription_tier).single();
      const { count } = await supabaseAdmin.from('business_media').select('id', { count: 'exact' }).eq('business_id', req.params.id).eq('type', 'gallery');
      if (plan?.max_gallery_photos !== 999 && count >= plan?.max_gallery_photos)
        return res.status(403).json({ error: `Gallery limit reached (${plan.max_gallery_photos} on ${plan.name} plan)`, code: 'LIMIT_REACHED' });
      const items = buildGalleryItems(req.files, req.params.id, count || 0, type);
      const { data, error } = await supabaseAdmin.from('business_media').insert(items).select();
      if (error) throw error;
      return res.json({ images: data });
    }
    // before/after photos aren't counted against the gallery plan limit —
    // they're a separate, smaller-volume category by nature.
    const { count: baCount } = await supabaseAdmin.from('business_media').select('id', { count: 'exact' }).eq('business_id', req.params.id).eq('type', type);
    const items = buildGalleryItems(req.files, req.params.id, baCount || 0, type);
    const { data, error } = await supabaseAdmin.from('business_media').insert(items).select();
    if (error) throw error;
    res.json({ images: data });
  } catch (err) { next(err); }
};

exports.deleteGallery = async (req, res, next) => {
  try {
    const { data: media } = await supabaseAdmin.from('business_media').select('*').eq('id', req.params.mediaId).eq('business_id', req.params.id).single();
    if (!media) return res.status(404).json({ error: 'Image not found' });
    await deleteImage(media.public_id);
    await supabaseAdmin.from('business_media').delete().eq('id', req.params.mediaId);
    res.json({ message: 'Image deleted' });
  } catch (err) { next(err); }
};

exports.uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { data, error } = await supabaseAdmin.from('users')
      .update({ avatar_url: req.file.path }).eq('id', req.user.id).select().single();
    if (error) throw error;
    res.json({ url: req.file.path });
  } catch (err) { next(err); }
};

exports.uploadProductImage = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { data, error } = await supabaseAdmin.from('products_services')
      .update({ image_url: req.file.path, image_public_id: req.file.filename })
      .eq('id', req.params.itemId).eq('business_id', req.params.id).select().single();
    if (error) throw error;
    res.json({ url: req.file.path, item: data });
  } catch (err) { next(err); }
};

exports.getGallery = async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('business_media').select('*').eq('business_id', req.params.id).order('sort_order');
    if (error) throw error;
    res.json({ media: data });
  } catch (err) { next(err); }
};

exports.uploadStaffPhoto = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    // Doesn't touch any table — the frontend attaches this URL to a
    // business_staff row via POST/PATCH /api/businesses/:id/staff.
    res.json({ url: req.file.path });
  } catch (err) { next(err); }
};
