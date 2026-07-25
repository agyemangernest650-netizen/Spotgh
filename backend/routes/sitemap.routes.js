// backend/routes/sitemap.routes.js
const router = require('express').Router();
const { supabaseAdmin } = require('../config/supabase');
const env = require('../config/env');

router.get('/sitemap.xml', async (req, res, next) => {
  try {
    const base = env.APP_URL;
    const [{ data: businesses }, { data: categories }, { data: posts }] = await Promise.all([
      supabaseAdmin.from('businesses').select('slug,updated_at').eq('status', 'active').limit(5000),
      supabaseAdmin.from('categories').select('slug').eq('is_active', true),
      supabaseAdmin.from('blog_posts').select('slug,published_at').eq('status', 'published'),
    ]);

    const staticPages = ['', '/pages/directory.html', '/pages/categories.html', '/pages/pricing.html', '/pages/deals.html', '/pages/events.html', '/pages/leads.html', '/pages/blog.html', '/pages/map.html'];

    const urls = [
      ...staticPages.map(p => `<url><loc>${base}${p}</loc><changefreq>daily</changefreq><priority>${p === '' ? '1.0' : '0.7'}</priority></url>`),
      ...(businesses || []).map(b => `<url><loc>${base}/pages/business.html?slug=${b.slug}</loc><lastmod>${(b.updated_at || '').slice(0,10)}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`),
      ...(categories || []).map(c => `<url><loc>${base}/pages/directory.html?category=${c.slug}</loc><changefreq>weekly</changefreq><priority>0.6</priority></url>`),
      ...(posts || []).map(p => `<url><loc>${base}/pages/blog-post.html?slug=${p.slug}</loc><lastmod>${(p.published_at || '').slice(0,10)}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>`),
    ].join('\n');

    res.set('Content-Type', 'application/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`);
  } catch (err) { next(err); }
});

module.exports = router;
