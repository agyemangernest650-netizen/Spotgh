// backend/server.js
const env = require('./config/env'); // validates env vars first
const express = require('express');
const path    = require('path');
const helmet  = require('helmet');
const cors    = require('cors');
const morgan  = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const cron    = require('node-cron');

const { notFound, errorHandler } = require('./middleware/error.middleware');
const limits  = require('./middleware/rateLimit.middleware');

const app = express();

// Trust the first hop reverse proxy (Railway/Render/Heroku/Fly/nginx all sit
// in front of the app in production). Without this, express-rate-limit
// either throws on the X-Forwarded-For header or treats every visitor as
// the same "client" (the proxy's IP), breaking per-user rate limits.
if (env.IS_PROD) app.set('trust proxy', 1);

// Express enables weak ETags globally by default, which was silently
// applying to every /api/* JSON response too — not just the static files
// below that explicitly opt into it. A dynamic, per-user API response
// (e.g. GET /api/businesses/my) has no business being conditionally
// cached like a static asset: when the browser sent a matching
// If-None-Match header, Express returned an empty 304 body instead of
// JSON, which broke frontend code expecting to always parse a response
// body — with no server-side exception, so nothing appeared in the logs
// either. Disabled globally; the static file middleware further down
// still sets its own etag:true, which is unaffected by this.
app.disable('etag');

// ── Security ──────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'","'unsafe-inline'","cdnjs.cloudflare.com","js.paystack.co","unpkg.com","maps.googleapis.com","https://www.googletagmanager.com","https://cdn.jsdelivr.net","https://js.hcaptcha.com","https://newassets.hcaptcha.com"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc:   ["'self'","'unsafe-inline'","fonts.googleapis.com","cdnjs.cloudflare.com","unpkg.com"],
      fontSrc:    ["'self'","fonts.gstatic.com","cdnjs.cloudflare.com"],
      imgSrc:     ["'self'","data:","blob:","res.cloudinary.com","*.googleapis.com","*.gstatic.com","*.openstreetmap.org"],
      connectSrc: ["'self'","*.supabase.co","api.paystack.co","https://www.google-analytics.com","https://region1.google-analytics.com","https://analytics.google.com","https://hcaptcha.com","https://*.hcaptcha.com"],
      frameSrc:   ["'self'","maps.google.com","https://newassets.hcaptcha.com","https://hcaptcha.com"],
      objectSrc:  ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(compression());
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return cb(null, true);
    // In dev allow everything; in prod allow APP_URL and same-origin
    if (!env.IS_PROD || !env.APP_URL || origin === env.APP_URL) return cb(null, true);
    cb(null, false);
  },
  credentials: true,
}));

// ── Paystack webhook — MUST be registered before express.json() ─────────
// Whichever body-parsing middleware runs first consumes the request
// stream; if express.json() ran first, express.raw() below would get an
// already-drained stream and req.body would be a parsed object instead of
// the raw Buffer crypto.createHmac needs, so the signature check would
// fail (or throw) on every single real webhook. Registering this before
// the global JSON parser guarantees express.raw() sees the untouched body.
const crypto = require('crypto');
const { supabaseAdmin } = require('./config/supabase');
app.post('/webhooks/paystack', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    // Paystack (unlike Stripe) has no separate webhook signing secret — the
    // x-paystack-signature header is HMAC SHA512 of the raw payload signed
    // with your regular Secret Key. See Paystack's webhook docs.
    const hash = crypto.createHmac('sha512', env.PAYSTACK_SECRET_KEY).update(req.body).digest('hex');
    if (hash !== req.headers['x-paystack-signature']) return res.sendStatus(401);
    const event = JSON.parse(req.body);
    if (event.event === 'charge.success') {
      const { reference, channel } = event.data;
      await supabaseAdmin.from('payments').update({ status: 'paid', paid_at: new Date().toISOString(), channel }).eq('paystack_reference', reference);
    }
    res.sendStatus(200);
  } catch (err) { console.error('[Webhook]', err.message); res.sendStatus(500); }
});

// ── Core Middleware ───────────────────────────────────────
app.use(morgan(env.IS_PROD ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser(env.APP_SECRET));

// ── Mini-Website Subdomains ──────────────────────────────
// Requires a wildcard DNS record (*.{ROOT_DOMAIN}) pointed at this server.
// buka-restaurant.spotgh.com  →  serves /pages/business.html?slug=buka-restaurant
// spotgh.com / www.spotgh.com / localhost continue to the normal site.
app.use(async (req, res, next) => {
  const host = (req.headers.host || '').split(':')[0];
  const root = env.ROOT_DOMAIN;
  const reserved = ['www', 'api', 'admin', root];
  if (host && host !== root && host.endsWith(`.${root}`)) {
    const sub = host.slice(0, -1 * (root.length + 1));
    if (sub && !reserved.includes(sub) && req.path === '/') {
      req.url = `/pages/business.html?slug=${sub}`;
    }
    return next();
  }
  // Custom domain (Enterprise plan): any other host hitting this server
  // gets checked against verified custom domains. Gating on
  // subscription_tier here (not just custom_domain_verified) means this
  // automatically stops resolving the moment a business's Enterprise plan
  // lapses, with no extra cron job needed.
  if (host && host !== root && host !== `www.${root}` && req.path === '/') {
    try {
      const { supabaseAdmin } = require('./config/supabase');
      const { data: biz } = await supabaseAdmin.from('businesses').select('slug')
        .eq('custom_domain', host).eq('custom_domain_verified', true)
        .eq('subscription_tier', 'enterprise').eq('status', 'active').single();
      if (biz) req.url = `/pages/business.html?slug=${biz.slug}`;
    } catch {}
  }
  next();
});

// ── robots.txt ──────────────────────────────────────────────────────────
app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(
`User-agent: *
Allow: /
Disallow: /api/
Disallow: /pages/dashboard.html
Disallow: /pages/admin.html
Disallow: /pages/creator.html
Disallow: /pages/business-edit.html
Disallow: /pages/deals-manager.html
Disallow: /pages/payment-history.html
Disallow: /pages/subscriptions.html
Disallow: /pages/analytics.html
Disallow: /pages/bookings.html
Disallow: /pages/checkout.html
Disallow: /pages/orders.html
Disallow: /pages/business-orders.html
Disallow: /pages/messages.html
Disallow: /pages/saved.html
Disallow: /pages/referrals.html
Disallow: /pages/profile.html
Disallow: /pages/oauth-callback.html

Sitemap: ${env.APP_URL}/sitemap.xml
`);
});

// ── Per-business Open Graph tags ──────────────────────────
// Social crawlers (WhatsApp/Facebook/Twitter link previews) don't run JS,
// so business.js setting document.title/meta tags client-side is invisible
// to them. This injects the real business name/photo into the static HTML
// before it's served, for both the ?slug= path and mini-site subdomains
// (which rewrite req.url to the same path above).
app.get('/pages/business.html', async (req, res, next) => {
  const slug = req.query.slug;
  if (!slug) return next();
  const fs = require('fs').promises;
  const filePath = path.join(__dirname, '../frontend/pages/business.html');
  let html;
  try { html = await fs.readFile(filePath, 'utf8'); } catch { return next(); }

  // Business lookup is best-effort — if Supabase hiccups, we still want to
  // serve the page with generic (not raw placeholder) meta tags rather than
  // failing the whole request or leaking __OG_TITLE__ literal text.
  let biz = null;
  try {
    const { supabaseAdmin } = require('./config/supabase');
    ({ data: biz } = await supabaseAdmin.from('businesses')
      .select('name,tagline,description,cover_url,logo_url,slug,meta_title,meta_description')
      .eq('slug', slug).eq('status', 'active').maybeSingle());
  } catch {}

  const esc = (s) => String(s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const title = esc(biz?.meta_title) || (biz ? `${esc(biz.name)} | SpotGH` : 'Business | SpotGH');
  const desc  = esc(biz?.meta_description) || esc(biz?.tagline || biz?.description?.slice(0, 160) || 'Find trusted businesses across Ghana on SpotGH.');
  const image = biz?.cover_url || biz?.logo_url || `${env.APP_URL}/assets/images/og-default.png`;
  const url   = `${env.APP_URL}/pages/business.html?slug=${biz?.slug || slug}`;
  const out = html
    .replace(/__OG_TITLE__/g, title)
    .replace(/__OG_DESC__/g, desc)
    .replace(/__OG_IMAGE__/g, image)
    .replace(/__OG_URL__/g, url);
  res.set('Content-Type', 'text/html').send(out);
});

// ── Static Frontend ───────────────────────────────────────
// sw.js must never be cached by the browser — service workers can only detect
// updates by re-fetching this exact file, and a stale cached copy (e.g. from
// the maxAge:'7d' below) means the browser never even asks the server if
// anything changed, so a new deploy silently never takes effect on normal loads.
app.get('/sw.js', (req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, '../frontend/sw.js'));
});

app.use(express.static(path.join(__dirname, '../frontend'), {
  maxAge: env.IS_PROD ? '7d' : '0',
  etag: true,
  index: 'index.html',
  setHeaders: (res, filePath) => {
    // HTML pages must always be revalidated — CSP headers and any other
    // per-response changes ship as part of this same cached response, so a
    // long maxAge here means browsers can silently keep serving stale pages
    // (and stale security headers) for up to 7 days after every deploy.
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
}));

const { notify } = require('./services/supabase.service');
const { sendEmail, wrap } = require('./services/email.service');
const { sendSMS } = require('./services/sms.service');

// Sitemap is served by routes/sitemap.routes.js (mounted below), which
// includes categories and blog posts in addition to businesses.

// ── Health Check (Railway / Render / uptime monitors) ────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', env: env.NODE_ENV, ts: new Date().toISOString() }));

// Public config for the frontend — SUPABASE_ANON_KEY is safe to expose
// client-side by design (it's how every Supabase browser app works; RLS,
// not secrecy, is what protects data). Needed so the frontend can drive
// Supabase's hosted Google/Facebook OAuth flow directly.
app.get('/api/config', (req, res) => res.json({ supabaseUrl: env.SUPABASE_URL, supabaseAnonKey: env.SUPABASE_ANON_KEY, gaTrackingId: env.GA_TRACKING_ID, hcaptchaSiteKey: env.HCAPTCHA_SITE_KEY || null }));

// ── API Routes ────────────────────────────────────────────
app.use('/api',          limits.global);
app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

app.use('/api/auth',     require('./routes/auth.routes'));
app.use('/api/businesses', require('./routes/business.routes'));
app.use('/api/upload',   require('./routes/upload.routes'));
app.use('/api/user',     require('./routes/user.routes'));

// Additional inline routes (payments, search, admin, etc.)
app.use('/api/categories', require('./routes/categories.routes'));
app.use('/api/locations',  require('./routes/locations.routes'));
app.use('/api/search',     require('./routes/search.routes'));
app.use('/api/reviews',    require('./routes/reviews.routes'));
app.use('/api/bookings',   require('./routes/bookings.routes'));
app.use('/api/cart',       require('./routes/cart.routes'));
app.use('/api/orders',     require('./routes/orders.routes'));
app.use('/api/messages',   require('./routes/messages.routes'));
app.use('/api/payments',   require('./routes/payments.routes'));
app.use('/api/deals',      require('./routes/deals.routes'));
app.use('/api/map',        require('./routes/map.routes'));
app.use('/api/ai',         require('./routes/ai.routes'));
app.use('/api/admin',      require('./routes/admin.routes'));
app.use('/api/creator',    require('./routes/creator.routes'));
app.use('/api/subscriptions', require('./routes/subscriptions.routes'));
app.use('/api/v1',         require('./routes/apiV1.routes'));
app.use('/api/calendar',   require('./routes/calendar.routes'));
app.use('/api/franchises', require('./routes/franchise.routes'));

// v16 additions — leads marketplace, appointment availability, events,
// coupons, business verification
// (custom domains + QR codes were already implemented pre-v16 — see
// business.controller.js setCustomDomain/verifyCustomDomain and business.js toggleQR)
app.use('/api/leads',        require('./routes/leads.routes'));
app.use('/api/availability', require('./routes/availability.routes'));
app.use('/api/events',       require('./routes/events.routes'));
app.use('/api/coupons',      require('./routes/coupons.routes'));
app.use('/api/verification', require('./routes/verification.routes'));
app.use('/api/claims',       require('./routes/claims.routes'));
app.use('/api/reports',      require('./routes/reports.routes'));

// v17 additions — loyalty, invoices, support, blog, newsletter, sponsored ads,
// push notifications, delivery tracking, 2FA/security, fraud review, nearby GPS (map.routes extended)
app.use('/api/loyalty',      require('./routes/loyalty.routes'));
app.use('/api/invoices',     require('./routes/invoices.routes'));
app.use('/api/support',      require('./routes/support.routes'));
app.use('/api/blog',         require('./routes/blog.routes'));
app.use('/api/newsletter',   require('./routes/newsletter.routes'));
app.use('/api/sponsored',    require('./routes/sponsored.routes'));
app.use('/api/push',         require('./routes/push.routes'));
app.use('/api/delivery',     require('./routes/delivery.routes'));
app.use('/api/security',     require('./routes/security.routes'));
app.use('/api/fraud',        require('./routes/fraud.routes'));
app.use('/', require('./routes/sitemap.routes'));

// ── Page Routes — explicitly serve HTML files so they always resolve ──────
const fs = require('fs');
const pagesDir = path.join(__dirname, '../frontend/pages');
app.get('/pages/:page', (req, res, next) => {
  const file = path.join(pagesDir, req.params.page);
  // Only serve .html files that actually exist
  if (req.params.page.endsWith('.html') && fs.existsSync(file)) {
    return res.sendFile(file);
  }
  next();
});

// ── SPA Fallback — only for true client-side routes (not real files) ─────
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  // If it looks like a file request (has extension) and wasn't served by static, 404 it
  if (path.extname(req.path)) return res.status(404).sendFile(path.join(__dirname, '../frontend/pages/404.html'));
  // Otherwise serve index.html for client-side navigation
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ── Error Handlers ────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Cron Jobs ─────────────────────────────────────────────
cron.schedule('0 1 * * *', async () => {
  try {
    // 0. Warn owners whose subscription expires within 3 days (once each)
    const in3Days = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const { data: expiringSoon } = await supabaseAdmin
      .from('subscriptions')
      .select('id, user_id, tier, expires_at')
      .eq('status', 'active')
      .eq('renewal_reminder_sent', false)
      .lt('expires_at', in3Days)
      .gt('expires_at', new Date().toISOString());
    for (const s of expiringSoon || []) {
      const daysLeft = Math.max(1, Math.ceil((new Date(s.expires_at) - Date.now()) / 86400000));
      await notify(s.user_id, 'warning', `⏰ Your ${s.tier} plan expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
        `Renew now to keep your business visible on SpotGH without interruption.`, '/pages/pricing.html');
      const { data: u } = await supabaseAdmin.from('users').select('email,full_name,phone').eq('id', s.user_id).single();
      if (u?.email) {
        await sendEmail(u.email, `Your SpotGH plan expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
          wrap('Your plan is about to expire', `Hi ${u.full_name || 'there'}, your <strong>${s.tier}</strong> plan expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Renew now so your business listing doesn't drop back to the Free tier.`,
          'Renew Now', `${env.APP_URL}/pages/pricing.html`));
      }
      if (u?.phone) await sendSMS(u.phone, `SpotGH: Your ${s.tier} plan expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Renew at spotgh.com/pages/pricing.html to stay visible.`);
      await supabaseAdmin.from('subscriptions').update({ renewal_reminder_sent: true }).eq('id', s.id);
    }

    // 1. Mark expired subscriptions (covers Starter's one paid month and every other paid plan)
    const { data: expiredSubs } = await supabaseAdmin
      .from('subscriptions')
      .update({ status: 'expired' })
      .eq('status', 'active')
      .lt('expires_at', new Date().toISOString())
      .select('business_id, user_id, tier');

    // 2. Downgrade the businesses behind those subscriptions back to the Free tier.
    //    Starter is a ONE-TIME paid month, not a recurring/auto-renewing plan — once it
    //    lapses the owner falls back to Free (listing hidden from search) until they pay
    //    again or upgrade to Pro/Enterprise from the dashboard.
    if (expiredSubs?.length) {
      const bizIds = expiredSubs.filter(s => s.business_id).map(s => s.business_id);
      if (bizIds.length) {
        await supabaseAdmin.from('businesses')
          .update({ subscription_tier: 'free', status: 'pending', subscription_expires_at: null })
          .in('id', bizIds);
      }
      for (const s of expiredSubs) {
        if (s.user_id) {
          await notify(s.user_id, 'warning', '⏰ Your plan has ended',
            `Your ${s.tier} plan has expired. Renew the same plan or upgrade to keep your business live and visible to customers.`,
            '/pages/pricing.html');
          const { data: u } = await supabaseAdmin.from('users').select('email,full_name').eq('id', s.user_id).single();
          if (u?.email) {
            await sendEmail(u.email, 'Your SpotGH plan has ended',
              wrap('Your plan has ended', `Hi ${u.full_name || 'there'}, your <strong>${s.tier}</strong> plan expired and your business listing has been moved back to the Free tier. Renew the same plan or upgrade any time — it's entirely on your schedule.`,
              'Renew or Upgrade', `${env.APP_URL}/pages/pricing.html`));
          }
        }
      }
    }

    await supabaseAdmin.from('businesses').update({ is_featured: false }).eq('is_featured', true).lt('featured_until', new Date().toISOString()).not('featured_until','is',null);
    console.log(`[CRON] Daily cleanup done — ${expiredSubs?.length || 0} subscription(s) expired & downgraded`);
  } catch (err) { console.error('[CRON]', err.message); }
});

// ── Start ─────────────────────────────────────────────────
app.listen(env.PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║            SpotGH MVC — Running            ║
╠══════════════════════════════════════════╣
║  Mode:    ${env.NODE_ENV.padEnd(31)}║
║  Port:    ${String(env.PORT).padEnd(31)}║
║  Frontend:  http://localhost:${env.PORT.toString().padEnd(13)}║
╚══════════════════════════════════════════╝
  `);
});

module.exports = app;