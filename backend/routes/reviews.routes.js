// backend/routes/reviews.routes.js
const router = require('express').Router();
const { supabaseAdmin } = require('../config/supabase');
const { verifyToken, requireAdmin, requireCreator, requireOwnership, optionalAuth } = require('../middleware/auth.middleware');
const { paginate, notify, audit } = require('../services/supabase.service');
const limits = require('../middleware/rateLimit.middleware');

// GET /api/reviews/featured — public. Real 5-star reviews with actual
// written feedback, used as testimonials on the homepage/pricing page.
// Deliberately not hand-written marketing copy: this only ever shows
// genuine reviewer content, and simply returns an empty list until real
// ones exist rather than falling back to placeholder quotes.
router.get('/featured', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 6, 12);
    const { data, error } = await supabaseAdmin
      .from('reviews')
      .select('id,rating,title,content,created_at,users:reviewer_id(full_name,avatar_url),businesses(name,slug,logo_url,category_id,categories(name))')
      .eq('status', 'approved')
      .eq('is_flagged', false)
      .eq('rating', 5)
      .not('content', 'is', null)
      .order('helpful_count', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit * 3); // over-fetch, then filter for length below
    if (error) throw error;
    const featured = (data || [])
      .filter(r => (r.content || '').trim().length >= 40)
      .slice(0, limit);
    res.json({ reviews: featured });
  } catch (err) { next(err); }
});

// POST /api/reviews/:id/flag — any logged-in user can flag a review
router.post('/:id/flag', verifyToken, async (req, res, next) => {
  try {
    const { reason } = req.body;
    const { error } = await supabaseAdmin.from('reviews')
      .update({ is_flagged: true, flag_reason: reason || 'Reported by user' })
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Review flagged for moderation' });
  } catch (err) { next(err); }
});

// GET /api/reviews/flagged — admin/creator view flagged reviews
router.get('/flagged', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('reviews')
      .select('*, users:reviewer_id(full_name,email), businesses(name,slug,owner_id)')
      .eq('is_flagged', true)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ reviews: data || [] });
  } catch (err) { next(err); }
});

// PATCH /api/reviews/:id/unflag — admin/creator clear a flag
router.patch('/:id/unflag', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('reviews')
      .update({ is_flagged: false, flag_reason: null })
      .eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ review: data });
  } catch (err) { next(err); }
});

router.post('/', verifyToken, async (req, res, next) => {
  try {
    const { business_id, rating, title, content } = req.body;
    if (!business_id || !rating) return res.status(400).json({ error: 'business_id and rating required' });
    if (rating < 1 || rating > 5) return res.status(400).json({ error: 'rating must be 1-5' });
    const { data: existing } = await supabaseAdmin.from('reviews').select('id').eq('business_id', business_id).eq('reviewer_id', req.user.id).maybeSingle();
    if (existing) return res.status(409).json({ error: 'You have already reviewed this business' });
    const { data, error } = await supabaseAdmin.from('reviews').insert({ business_id, reviewer_id: req.user.id, rating, title: title || null, content: content || null }).select().single();
    if (error) throw error;
    require('../services/fraud.service').checkReview(data).catch(() => {});
    const { data: biz } = await supabaseAdmin.from('businesses').select('name,owner_id,slug').eq('id', business_id).single();
    if (biz) await notify(biz.owner_id, 'success', `⭐ New ${rating}-star review for ${biz.name}`, content?.slice(0,100) || `${rating} star review received`, `/business?slug=${biz.slug}`);
    res.status(201).json({ review: data });
  } catch (err) { next(err); }
});
router.patch('/:id/reply', verifyToken, async (req, res, next) => {
  try {
    const { reply } = req.body; if (!reply) return res.status(400).json({ error: 'reply required' });
    const { data: review } = await supabaseAdmin.from('reviews').select('*,businesses(owner_id)').eq('id', req.params.id).single();
    if (!review) return res.status(404).json({ error: 'Not found' });
    if (review.businesses.owner_id !== req.user.id && req.user.role !== 'creator') return res.status(403).json({ error: 'Not authorized' });
    const { data, error } = await supabaseAdmin.from('reviews').update({ owner_reply: reply, owner_replied_at: new Date().toISOString() }).eq('id', req.params.id).select().single();
    if (error) throw error; res.json({ review: data });
  } catch (err) { next(err); }
});
router.delete('/:id', verifyToken, async (req, res, next) => {
  try {
    const { data: r } = await supabaseAdmin.from('reviews').select('reviewer_id').eq('id', req.params.id).single();
    if (!r) return res.status(404).json({ error: 'Not found' });
    if (r.reviewer_id !== req.user.id && req.user.role !== 'creator') return res.status(403).json({ error: 'Not authorized' });
    await supabaseAdmin.from('reviews').delete().eq('id', req.params.id);
    res.json({ message: 'Review deleted' });
  } catch (err) { next(err); }
});
module.exports = router;
