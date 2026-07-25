// backend/routes/blog.routes.js
const router = require('express').Router();
const slugify = require('slugify');
const { supabaseAdmin } = require('../config/supabase');
const { verifyToken, requireCreator } = require('../middleware/auth.middleware');
const { paginate } = require('../services/supabase.service');

// ── Public: list published posts ───────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const { from, to, page: pg, limit: lm } = paginate(page, limit);
    const { data, count, error } = await supabaseAdmin.from('blog_posts')
      .select('id,slug,title,excerpt,cover_url,published_at,view_count', { count: 'exact' })
      .eq('status', 'published').order('published_at', { ascending: false }).range(from, to);
    if (error) throw error;
    res.json({ posts: data, pagination: { total: count, page: pg, limit: lm } });
  } catch (err) { next(err); }
});

// ── Public: single post by slug (also bumps view count + fetches featured businesses) ──
router.get('/:slug', async (req, res, next) => {
  try {
    const { data: post, error } = await supabaseAdmin.from('blog_posts').select('*').eq('slug', req.params.slug).eq('status', 'published').single();
    if (error || !post) return res.status(404).json({ error: 'Post not found' });
    await supabaseAdmin.from('blog_posts').update({ view_count: post.view_count + 1 }).eq('id', post.id);

    let featured = [];
    if (post.featured_business_ids?.length) {
      const { data } = await supabaseAdmin.from('businesses').select('id,name,slug,logo_url,city,avg_rating').in('id', post.featured_business_ids);
      featured = data || [];
    }
    res.json({ post, featured_businesses: featured });
  } catch (err) { next(err); }
});

// ── Admin/creator: create post ──────────────────────────────────
router.post('/', verifyToken, requireCreator, async (req, res, next) => {
  try {
    const { title, excerpt, content, cover_url, featured_business_ids, meta_title, meta_description, status } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'title and content are required' });
    let slug = slugify(title, { lower: true, strict: true });
    const { data: clash } = await supabaseAdmin.from('blog_posts').select('id').eq('slug', slug).maybeSingle();
    if (clash) slug = `${slug}-${Date.now().toString(36)}`;

    const { data, error } = await supabaseAdmin.from('blog_posts').insert({
      author_id: req.user.id, slug, title, excerpt: excerpt || null, content, cover_url: cover_url || null,
      featured_business_ids: featured_business_ids || [], meta_title: meta_title || title, meta_description: meta_description || excerpt || null,
      status: status === 'published' ? 'published' : 'draft',
      published_at: status === 'published' ? new Date().toISOString() : null,
    }).select().single();
    if (error) throw error;
    res.status(201).json({ post: data });
  } catch (err) { next(err); }
});

// ── Admin/creator: update post (publishing sets published_at once) ──
router.patch('/:id', verifyToken, requireCreator, async (req, res, next) => {
  try {
    const allowed = ['title','excerpt','content','cover_url','featured_business_ids','meta_title','meta_description','status'];
    const updates = {};
    for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];
    if (updates.status === 'published') {
      const { data: existing } = await supabaseAdmin.from('blog_posts').select('published_at').eq('id', req.params.id).single();
      if (!existing?.published_at) updates.published_at = new Date().toISOString();
    }
    const { data, error } = await supabaseAdmin.from('blog_posts').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ post: data });
  } catch (err) { next(err); }
});

// ── Admin/creator: list all posts (including drafts) ────────────
router.get('/admin/all', verifyToken, requireCreator, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('blog_posts').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ posts: data });
  } catch (err) { next(err); }
});

router.delete('/:id', verifyToken, requireCreator, async (req, res, next) => {
  try {
    const { error } = await supabaseAdmin.from('blog_posts').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Post deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
