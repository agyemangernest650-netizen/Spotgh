// backend/controllers/business.controller.js
const { supabaseAdmin } = require('../config/supabase');
const { generateSlug, notify, audit, calcHealthScore, paginate, sanitizeSearchTerm } = require('../services/supabase.service');
const { getDirectoryAccess, getWebsiteAccess } = require('../services/planAccess.service');
const slugify = require('slugify');
const env = require('../config/env');

// GET /api/businesses/check-slug?slug=xyz
exports.checkSlug = async (req, res, next) => {
  try {
    const raw = (req.query.slug || '').trim().toLowerCase();
    const clean = slugify(raw, { lower: true, strict: true });
    if (!clean || clean.length < 3) return res.json({ available: false, reason: 'too_short', suggestion: null });
    if (clean.length > 40) return res.json({ available: false, reason: 'too_long', suggestion: clean.slice(0, 40) });
    if (clean !== raw) return res.json({ available: false, reason: 'invalid_chars', suggestion: clean });

    const RESERVED = ['www', 'api', 'admin', 'app', 'blog', 'help', 'support', 'status', 'about', 'pricing', 'mail', 'dashboard'];
    if (RESERVED.includes(clean)) return res.json({ available: false, reason: 'reserved', suggestion: `${clean}-gh` });

    const { data } = await supabaseAdmin.from('businesses').select('id').eq('slug', clean).maybeSingle();
    if (data) {
      const { data: taken2 } = await supabaseAdmin.from('businesses').select('id').eq('slug', `${clean}-gh`).maybeSingle();
      return res.json({ available: false, reason: 'taken', suggestion: taken2 ? `${clean}-${Math.floor(Math.random()*900+100)}` : `${clean}-gh` });
    }
    res.json({ available: true, slug: clean });
  } catch (err) { next(err); }
};

// GET /api/businesses
exports.list = async (req, res, next) => {
  try {
    const { category, location, search, featured, verified, min_rating, price_range, open_now, sort = 'created_at', page, limit, lat, lng, radius_km } = req.query;
    const { from, to, page: pg, limit: lm } = paginate(page, limit);

    let q = supabaseAdmin.from('businesses_with_stats').select('*', { count: 'exact' }).eq('status', 'active');
    if (category) q = q.eq('category_slug', category);
    if (location) q = q.ilike('city', `%${location}%`);
    if (featured === 'true') q = q.eq('is_featured', true);
    if (verified === 'true') q = q.eq('is_verified', true);
    if (min_rating) q = q.gte('avg_rating', Number(min_rating));
    if (price_range) q = q.in('price_range', price_range.split(','));
    if (search) { const s = sanitizeSearchTerm(search); q = q.or(`name.ilike.%${s}%,description.ilike.%${s}%,city.ilike.%${s}%`); }

    // "Open now" can't be expressed as a simple column filter (it depends on
    // the current time against each business's own operating_hours JSON), so
    // when requested we pull the filtered set and check it in-memory — same
    // approach already used below for GPS distance sorting.
    if (open_now === 'true') {
      const { data, error } = await q;
      if (error) throw error;
      const openOnly = data.filter(isOpenNow);
      if (lat && lng) return respondWithDistance(res, openOnly, lat, lng, radius_km, from, to, pg, lm);
      const sorted = sortBusinesses(openOnly, sort);
      return res.json({ businesses: sorted.slice(from, to + 1), pagination: { total: sorted.length, page: pg, limit: lm, pages: Math.ceil(sorted.length / lm) } });
    }

    // GPS-based "near me" — sort by actual distance instead of the requested sort column
    if (lat && lng) {
      q = q.not('latitude', 'is', null).not('longitude', 'is', null);
      const { data, error } = await q; // pull all matches, then sort/paginate by distance in-memory
      if (error) throw error;
      return respondWithDistance(res, data, lat, lng, radius_km, from, to, pg, lm);
    }

    const cols = { rating: 'avg_rating', popular: 'view_count', name: 'name', created_at: 'created_at' };
    const col  = cols[sort] || 'created_at';
    q = q.order('is_featured', { ascending: false }).order(col, { ascending: sort === 'name' }).range(from, to);

    const { data, error, count } = await q;
    if (error) throw error;
    res.json({ businesses: data, pagination: { total: count, page: pg, limit: lm, pages: Math.ceil(count / lm) } });
  } catch (err) { next(err); }
};

function respondWithDistance(res, data, lat, lng, radius_km, from, to, pg, lm) {
  const userLat = Number(lat), userLng = Number(lng), maxKm = Number(radius_km) || 25;
  const withDistance = data
    .filter(b => b.latitude != null && b.longitude != null)
    .map(b => ({ ...b, distance_km: Math.round(haversineKm(userLat, userLng, b.latitude, b.longitude) * 10) / 10 }))
    .filter(b => b.distance_km <= maxKm)
    .sort((a, b) => a.distance_km - b.distance_km);
  res.json({ businesses: withDistance.slice(from, to + 1), pagination: { total: withDistance.length, page: pg, limit: lm, pages: Math.ceil(withDistance.length / lm) } });
}

function sortBusinesses(list, sort) {
  const key = { rating: 'avg_rating', popular: 'view_count', name: 'name' }[sort] || 'created_at';
  return [...list].sort((a, b) => {
    if (a.is_featured !== b.is_featured) return b.is_featured ? 1 : -1;
    if (key === 'name') return String(a.name).localeCompare(String(b.name));
    return new Date(b[key] || 0) - new Date(a[key] || 0) || (b[key] || 0) - (a[key] || 0);
  });
}

// Ghana runs on GMT/UTC+0 with no daylight saving, so the server's UTC clock
// is always local Ghana time — no timezone conversion needed here.
function isOpenNow(biz) {
  const hours = biz.operating_hours;
  if (!hours) return false;
  const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const now = new Date();
  const today = hours[days[now.getUTCDay()]];
  if (!today || today.closed || !today.open || !today.close) return false;
  const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes();
  const [oh, om] = today.open.split(':').map(Number);
  const [ch, cm] = today.close.split(':').map(Number);
  const openMin = oh * 60 + om, closeMin = ch * 60 + cm;
  return closeMin > openMin ? (nowMin >= openMin && nowMin < closeMin) : (nowMin >= openMin || nowMin < closeMin);
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// GET /api/businesses/my
exports.myBusinesses = async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('businesses_with_stats').select('*').eq('owner_id', req.user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ businesses: data });
  } catch (err) { next(err); }
};

// GET /api/businesses/trending
exports.trending = async (req, res, next) => {
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: events } = await supabaseAdmin.from('analytics_events')
      .select('business_id').eq('event_type', 'view').gte('created_at', since);
    const counts = {};
    (events || []).forEach(e => { counts[e.business_id] = (counts[e.business_id] || 0) + 1; });
    const topIds = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(e => e[0]);
    if (!topIds.length) {
      const { data } = await supabaseAdmin.from('businesses_with_stats').select('*').eq('status', 'active').order('view_count', { ascending: false }).limit(6);
      return res.json({ businesses: data || [] });
    }
    const { data } = await supabaseAdmin.from('businesses_with_stats').select('*').in('id', topIds).eq('status', 'active');
    const sorted = (data || []).sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0));
    res.json({ businesses: sorted });
  } catch (err) { next(err); }
};

// GET /api/businesses/slug/:slug
exports.getBySlug = async (req, res, next) => {
  try {
    const { data: business, error } = await supabaseAdmin
      .from('businesses_with_stats').select('*').eq('slug', req.params.slug).eq('status', 'active').single();
    if (error || !business) return res.status(404).json({ error: 'Business not found' });

    const [galleryRes, productsRes, reviewsRes, similarRes, dealsRes, savedRes, staffRes, beforeAfterRes] = await Promise.all([
      supabaseAdmin.from('business_media').select('*').eq('business_id', business.id).eq('type', 'gallery').order('sort_order'),
      supabaseAdmin.from('products_services').select('*').eq('business_id', business.id).eq('is_available', true).order('type').order('sort_order'),
      supabaseAdmin.from('reviews').select('*, users:reviewer_id(full_name,avatar_url)').eq('business_id', business.id).eq('status', 'approved').order('created_at', { ascending: false }).limit(10),
      supabaseAdmin.from('businesses_with_stats').select('*').eq('category_id', business.category_id).eq('status', 'active').neq('id', business.id).limit(4),
      supabaseAdmin.from('business_deals').select('*').eq('business_id', business.id).eq('is_active', true).gt('expires_at', new Date().toISOString()).limit(3),
      req.user
        ? supabaseAdmin.from('saved_businesses').select('id').eq('user_id', req.user.id).eq('business_id', business.id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabaseAdmin.from('business_staff').select('*').eq('business_id', business.id).eq('is_active', true).order('sort_order'),
      supabaseAdmin.from('business_media').select('*').eq('business_id', business.id).in('type', ['before','after']).order('sort_order'),
    ]);
    business.is_saved = !!savedRes?.data;

    // Track view asynchronously
    supabaseAdmin.rpc('increment_business_view', { business_slug: req.params.slug }).catch(() => {});
    supabaseAdmin.from('analytics_events').insert({
      business_id: business.id, event_type: 'view',
      visitor_id: req.headers['x-visitor-id'] || null,
      referrer: req.headers.referer || null,
    }).catch(() => {});

    // Directory Listing and Mini-Website are independent subscriptions
    // (migration 018) — see planAccess.service.js.
    const websiteAccess = await getWebsiteAccess(business.id);
    business.has_website = !!websiteAccess;
    business.has_bookings = !!websiteAccess?.plan.has_bookings;
    business.has_online_ordering = !!websiteAccess?.plan.has_online_payments;
    business.has_custom_template = !!websiteAccess?.plan.has_custom_template;
    business.hide_branding = websiteAccess?.plan.tier === 'business_pro';

    res.json({
      business,
      gallery:           galleryRes.data  || [],
      productsServices:  productsRes.data || [],
      reviews:           reviewsRes.data  || [],
      similarBusinesses: similarRes.data  || [],
      deals:             dealsRes.data    || [],
      staff:             staffRes.data    || [],
      beforeAfter:        beforeAfterRes.data || [],
    });
  } catch (err) { next(err); }
};

// GET /api/businesses/:id
exports.getById = async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('businesses_with_stats').select('*').eq('id', req.params.id).single();
    if (error || !data) return res.status(404).json({ error: 'Business not found' });
    res.json({ business: data });
  } catch (err) { next(err); }
};

// GET /api/businesses/:id/health
exports.healthScore = async (req, res, next) => {
  try {
    const { data: biz } = await supabaseAdmin.from('businesses_with_stats').select('*').eq('id', req.params.id).single();
    if (!biz) return res.status(404).json({ error: 'Business not found' });
    res.json(calcHealthScore(biz));
  } catch (err) { next(err); }
};

// Best-effort reachability check for a business's claimed external website.
// Not a hard gate — legitimate sites often block bot HEAD requests — so a
// failure here just leaves own_website_verified false for an admin to see,
// it never blocks creation (isURL() in the validator already confirmed the
// format is at least well-formed).
async function checkUrlReachable(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: controller.signal });
    clearTimeout(timeout);
    return resp.ok || (resp.status >= 200 && resp.status < 400);
  } catch {
    return false;
  }
}

// POST /api/businesses
exports.create = async (req, res, next) => {
  try {
    const { name, tagline, description, phone, whatsapp, email, website, has_own_website,
            address, city, region, country, category_id, social_links,
            theme_color, template_key, meta_title, meta_description,
            operating_hours, amenities, signup_type, custom_slug,
            force_directory_tier, force_website_tier } = req.body;
    if (!name) return res.status(400).json({ error: 'Business name is required' });

    // Only the platform admin can comp a Directory/Website tier for free —
    // never trust these two fields from a regular caller's request body.
    const isCreator = req.user.role === 'creator';
    const DIRECTORY_TIERS = ['free', 'standard', 'premium'];
    const WEBSITE_TIERS = ['starter', 'professional', 'business_pro'];
    const compDirectoryTier = isCreator && DIRECTORY_TIERS.includes(force_directory_tier) ? force_directory_tier : null;
    const compWebsiteTier = isCreator && WEBSITE_TIERS.includes(force_website_tier) ? force_website_tier : null;

    // signup_type: 'directory' (listing only), 'website' (mini-website only,
    // still gets the free Directory listing since every business has one —
    // it's just not upgraded), or 'both'. Defaults to 'both' for any caller
    // that hasn't been updated to send it, matching the old behavior where
    // every business without its own external site got a mini-website.
    const wantsWebsite = signup_type !== 'directory' || !!compWebsiteTier;

    // Check business limit from Directory plan (a Directory subscription
    // always exists, even for a website-only signup). The creator role
    // manages listings on behalf of other businesses and isn't bound by
    // its own account's plan limit.
    const plan = req.plan;

    if (!isCreator && plan && plan.max_businesses !== 999) {
      const { count } = await supabaseAdmin.from('businesses').select('id', { count: 'exact' }).eq('owner_id', req.user.id).neq('status', 'rejected');
      if (count >= plan.max_businesses) {
        return res.status(403).json({ error: `Your ${plan.name} plan allows ${plan.max_businesses} business(es). Upgrade to add more.`, code: 'LIMIT_REACHED', redirect: '/pricing' });
      }
    }

    const ownsWebsite = has_own_website === true || has_own_website === 'true';
    const ownWebsiteVerified = ownsWebsite ? await checkUrlReachable(website) : null;

    let slug;
    if (custom_slug) {
      const clean = slugify(custom_slug, { lower: true, strict: true });
      const RESERVED = ['www', 'api', 'admin', 'app', 'blog', 'help', 'support', 'status', 'about', 'pricing', 'mail', 'dashboard'];
      if (clean.length < 3 || clean.length > 40 || RESERVED.includes(clean)) {
        return res.status(400).json({ error: 'That domain name isn\'t valid — please choose another.' });
      }
      const { data: taken } = await supabaseAdmin.from('businesses').select('id').eq('slug', clean).maybeSingle();
      if (taken) return res.status(409).json({ error: 'That domain name was just taken — please choose another.', code: 'SLUG_TAKEN' });
      slug = clean;
    } else {
      slug = await generateSlug(name);
    }
    const { data: business, error } = await supabaseAdmin.from('businesses').insert({
      owner_id: req.user.id, name, slug,
      tagline: tagline || null, description: description || null,
      phone: phone || null, whatsapp: whatsapp || null,
      email: email || null, website: ownsWebsite ? website : null,
      has_own_website: ownsWebsite, own_website_verified: ownWebsiteVerified,
      address: address || null, city: city || null,
      region: region || null, country: country || 'Ghana',
      category_id: category_id || null,
      social_links: social_links || {},
      theme_color: theme_color || '#4E0DAD',
      template_key: template_key || 'default',
      meta_title: meta_title || null, meta_description: meta_description || null,
      ...(operating_hours ? { operating_hours } : {}),
      ...(amenities ? { amenities } : {}),
      subscription_tier: req.plan?.tier || 'free', // legacy column, left for backward compat
      status: 'pending',
    }).select().single();
    if (error) throw error;

    if (req.user.role === 'user')
      await supabaseAdmin.from('users').update({ role: 'business_owner' }).eq('id', req.user.id);

    // Every business gets a Directory subscription — Free unless the owner
    // already has an active paid Directory plan on their account (checked
    // above via req.plan), in which case it's the same tier.
    const now = new Date();
    const farFuture = new Date(now); farFuture.setFullYear(farFuture.getFullYear() + 100);
    const dirTierToGrant = compDirectoryTier || (plan?.tier === 'free' || !plan ? 'free' : plan.tier);
    const { data: dirPlan } = await supabaseAdmin.from('directory_plans').select('*').eq('tier', dirTierToGrant).maybeSingle();
    if (dirPlan) {
      // A creator-comped tier is free and doesn't expire, same as the Free
      // tier's own "forever" expiry — it's an admin grant, not a paid term.
      const dirExpires = (dirPlan.tier === 'free' || compDirectoryTier) ? farFuture : now;
      await supabaseAdmin.from('business_directory_subscriptions').insert({
        business_id: business.id, user_id: req.user.id, plan_id: dirPlan.id, tier: dirPlan.tier,
        status: 'active', amount_paid: 0, billing_cycle: 'monthly',
        started_at: now.toISOString(), expires_at: dirExpires.toISOString(),
      });
      await supabaseAdmin.from('businesses').update({ directory_tier: dirPlan.tier, directory_expires_at: dirExpires.toISOString() }).eq('id', business.id);
    }

    // Website-only/Both signups without their own external site get a
    // Starter Website subscription — first month free, once per account
    // (see users.website_trial_used), same mechanic as the existing
    // account-wide directory trial in payments.routes.js.
    if (compWebsiteTier) {
      // Creator comp: grant the requested Website tier directly, free,
      // for a year — doesn't touch the account's own trial eligibility
      // and isn't blocked by has_own_website, since the creator is
      // building this business's mini-website on their behalf.
      const { data: compPlan } = await supabaseAdmin.from('website_plans').select('*').eq('tier', compWebsiteTier).maybeSingle();
      if (compPlan) {
        const exp = new Date(now); exp.setFullYear(exp.getFullYear() + 1);
        await supabaseAdmin.from('business_website_subscriptions').insert({
          business_id: business.id, user_id: req.user.id, plan_id: compPlan.id, tier: compPlan.tier,
          status: 'active', amount_paid: 0, billing_cycle: 'monthly', is_trial: false,
          started_at: now.toISOString(), expires_at: exp.toISOString(),
        });
        await supabaseAdmin.from('businesses').update({ website_tier: compPlan.tier, website_expires_at: exp.toISOString() }).eq('id', business.id);
      }
    } else if (wantsWebsite && !ownsWebsite) {
      const { data: starterPlan } = await supabaseAdmin.from('website_plans').select('*').eq('tier', 'starter').maybeSingle();
      const { data: buyer } = await supabaseAdmin.from('users').select('website_trial_used').eq('id', req.user.id).single();
      const isTrial = starterPlan && !buyer?.website_trial_used;
      if (starterPlan && isTrial) {
        const exp = new Date(now); exp.setDate(exp.getDate() + (starterPlan.free_trial_days || 30));
        await supabaseAdmin.from('business_website_subscriptions').insert({
          business_id: business.id, user_id: req.user.id, plan_id: starterPlan.id, tier: starterPlan.tier,
          status: 'active', amount_paid: 0, billing_cycle: 'monthly', is_trial: true,
          started_at: now.toISOString(), expires_at: exp.toISOString(),
        });
        await supabaseAdmin.from('businesses').update({ website_tier: starterPlan.tier, website_expires_at: exp.toISOString() }).eq('id', business.id);
        await supabaseAdmin.from('users').update({ website_trial_used: true }).eq('id', req.user.id);
      }
      // If the trial's already used, the owner still gets the listing —
      // they just need to subscribe to a Website plan from the pricing
      // page (or their business dashboard) to activate the mini-website.
    }

    if (ownsWebsite) {
      await notify(req.user.id, 'info', '🔗 Your website is linked',
        ownWebsiteVerified
          ? `We confirmed ${website} is live and linked it to your SpotGH listing.`
          : `We saved ${website} on your listing, but couldn't confirm it responded — double check the link still works.`,
        `/dashboard?tab=businesses`);
    } else if (wantsWebsite) {
      await notify(req.user.id, 'info', '🌐 Your SpotGH mini-website is being generated',
        `${business.name} will get its own SpotGH mini-website once approved — no external site needed.`,
        `/dashboard?tab=businesses`);
    }

    await notify(req.user.id, 'info', '📋 Business submitted!',
      `${business.name} is under review. Usually approved within 24 hours.`,
      `/dashboard?tab=businesses`);

    await audit(req.user.id, 'business_created', 'business', business.id, null, { name, slug }, req);

    res.status(201).json({ message: 'Business submitted for review!', business });
  } catch (err) { next(err); }
};

// PATCH /api/businesses/:id
exports.update = async (req, res, next) => {
  try {
    const allowed = [
      'name','tagline','description','phone','whatsapp','email','website','has_own_website',
      'address','city','region','country','latitude','longitude',
      'category_id','location_id','operating_hours','social_links',
      'theme_color','accent_color','template_key','custom_css',
      'meta_title','meta_description','keywords','amenities','tags','delivery_fee','delivery_zones',
      'emergency_contact','insurance_accepted','nearby_attractions','measurement_guide','health_tips','price_range',
    ];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    // Re-validate/re-check reachability if they're changing their answer or URL
    if (updates.has_own_website !== undefined || updates.website !== undefined) {
      const willOwnWebsite = updates.has_own_website !== undefined ? !!updates.has_own_website : true;
      if (willOwnWebsite && updates.website) {
        updates.own_website_verified = await checkUrlReachable(updates.website);
      } else if (!willOwnWebsite) {
        updates.website = null;
        updates.own_website_verified = null;
      }
    }

    // Free tier gets a basic listing only (no mini-website) — blocks all
    // visual customization. Starter gets a full mini-website but on the
    // default look (category-driven template_key still applies, since
    // that's just content layout — e.g. a restaurant's "Menu" section vs
    // a salon's "Book" section — not a paid design perk). Pro+ additionally
    // gets has_custom_template: their own theme_color/accent_color/custom_css.
    const websiteAccessForUpdate = await getWebsiteAccess(req.params.id);
    if (!websiteAccessForUpdate) {
      ['theme_color', 'accent_color', 'template_key', 'custom_css'].forEach(k => delete updates[k]);
    } else if (!websiteAccessForUpdate.plan.has_custom_template) {
      ['theme_color', 'accent_color', 'custom_css'].forEach(k => delete updates[k]);
    }

    const { data: business, error } = await supabaseAdmin
      .from('businesses').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ business, message: 'Business updated' });
  } catch (err) { next(err); }
};

// DELETE /api/businesses/:id
exports.remove = async (req, res, next) => {
  try {
    await supabaseAdmin.from('businesses').delete().eq('id', req.params.id);
    await audit(req.user.id, 'business_deleted', 'business', req.params.id, null, null, req);
    res.json({ message: 'Business deleted' });
  } catch (err) { next(err); }
};

// GET /api/businesses/:id/products
exports.getProducts = async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('products_services').select('*').eq('business_id', req.params.id).order('type').order('sort_order');
    if (error) throw error;
    res.json({ items: data });
  } catch (err) { next(err); }
};

// POST /api/businesses/:id/products
exports.addProduct = async (req, res, next) => {
  try {
    const { type, name, description, price, price_unit, duration_minutes, is_available, is_new_arrival, tags, image_url, track_inventory, stock_quantity, allow_backorder } = req.body;
    if (!type || !name) return res.status(400).json({ error: 'type and name are required' });
    if (!['product','service'].includes(type)) return res.status(400).json({ error: 'type must be product or service' });

    // Products/services are a mini-website feature — gated by the
    // business's Website plan, not its Directory plan.
    const websiteAccessForProduct = await getWebsiteAccess(req.params.id);
    if (!websiteAccessForProduct)
      return res.status(403).json({ error: 'Product/service catalogs require a Website plan.', code: 'FEATURE_NOT_INCLUDED', redirect: '/pricing' });
    if (websiteAccessForProduct.plan.max_products !== 999) {
      const { count } = await supabaseAdmin.from('products_services').select('id',{count:'exact'}).eq('business_id', req.params.id);
      if (count >= websiteAccessForProduct.plan.max_products)
        return res.status(403).json({ error: `Plan limit: ${websiteAccessForProduct.plan.max_products} products/services`, code: 'LIMIT_REACHED' });
    }

    const slug = slugify(name, { lower: true, strict: true }) + '-' + Date.now();
    const { data, error } = await supabaseAdmin.from('products_services').insert({
      business_id: req.params.id, type, name, slug,
      description: description || null, price: price || null,
      price_unit: price_unit || null, duration_minutes: duration_minutes || null,
      image_url: image_url || null,
      is_available: is_available !== false, is_new_arrival: !!is_new_arrival, tags: tags || null,
      track_inventory: !!track_inventory, stock_quantity: stock_quantity || 0, allow_backorder: !!allow_backorder,
    }).select().single();
    if (error) throw error;
    res.status(201).json({ item: data });
  } catch (err) { next(err); }
};

// PATCH /api/businesses/:id/products/:itemId
exports.updateProduct = async (req, res, next) => {
  try {
    const allowed = ['name','description','price','price_unit','duration_minutes','is_available','is_new_arrival','sort_order','tags','image_url','track_inventory','stock_quantity','allow_backorder'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    const { data, error } = await supabaseAdmin.from('products_services').update(updates).eq('id', req.params.itemId).eq('business_id', req.params.id).select().single();
    if (error) throw error;
    res.json({ item: data });
  } catch (err) { next(err); }
};

// DELETE /api/businesses/:id/products/:itemId
exports.deleteProduct = async (req, res, next) => {
  try {
    await supabaseAdmin.from('products_services').delete().eq('id', req.params.itemId).eq('business_id', req.params.id);
    res.json({ message: 'Item deleted' });
  } catch (err) { next(err); }
};

// POST /api/businesses/contact
exports.contact = async (req, res, next) => {
  try {
    const { business_id, sender_name, sender_email, sender_phone, message } = req.body;
    if (!business_id || !sender_name || !message) return res.status(400).json({ error: 'Required fields missing' });
    const { error } = await supabaseAdmin.from('contact_submissions').insert({ business_id, sender_name, sender_email: sender_email || null, sender_phone: sender_phone || null, message });
    if (error) throw error;
    res.json({ message: 'Message sent!' });
  } catch (err) { next(err); }
};

// POST /api/businesses/saved/:id — toggle save
exports.toggleSave = async (req, res, next) => {
  try {
    const { data: existing } = await supabaseAdmin.from('saved_businesses').select('*').eq('user_id', req.user.id).eq('business_id', req.params.id).maybeSingle();
    if (existing) {
      await supabaseAdmin.from('saved_businesses').delete().eq('user_id', req.user.id).eq('business_id', req.params.id);
      return res.json({ saved: false });
    }
    await supabaseAdmin.from('saved_businesses').insert({ user_id: req.user.id, business_id: req.params.id });
    res.json({ saved: true });
  } catch (err) { next(err); }
};

// GET /api/businesses/saved
exports.getSaved = async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('saved_businesses').select('businesses_with_stats(*)').eq('user_id', req.user.id);
    if (error) throw error;
    res.json({ data: (data || []).map(r => r.businesses_with_stats).filter(Boolean) });
  } catch (err) { next(err); }
};

// POST /api/businesses/:slug/track
exports.track = async (req, res) => {
  try {
    const { event_type } = req.body;
    const valid = ['whatsapp_click','call_click','website_click','direction_click','share'];
    if (!valid.includes(event_type)) return res.status(400).json({ error: 'Invalid event_type' });
    const { data: biz } = await supabaseAdmin.from('businesses').select('id').eq('slug', req.params.slug).single();
    if (!biz) return res.status(404).json({ error: 'Not found' });
    await supabaseAdmin.from('analytics_events').insert({ business_id: biz.id, event_type, visitor_id: req.headers['x-visitor-id'] || null });
    res.json({ success: true });
  } catch { res.json({ success: false }); }
};

// ── Custom Domain (Enterprise plan feature) ─────────────────────────────
// Full DNS + automatic SSL provisioning is infrastructure (a reverse proxy
// with ACME/Let's Encrypt, or a service like Cloudflare for SaaS) that has
// to live outside this codebase. What lives here is the real, working
// part: the business owner points their domain's TXT and A/CNAME records
// at us, we verify they actually control it, and server.js's host-based
// router (see the "Mini-Website Subdomains" block) then serves their
// listing whenever a verified custom domain hits this server.
const crypto = require('crypto');
const dns = require('dns').promises;

exports.setCustomDomain = async (req, res, next) => {
  try {
    const { domain } = req.body;
    if (!domain || !/^([a-z0-9-]+\.)+[a-z]{2,}$/i.test(domain.trim()))
      return res.status(400).json({ error: 'Enter a valid domain, e.g. www.yourbusiness.com' });
    const clean = domain.trim().toLowerCase();

    const websiteAccessForDomain = await getWebsiteAccess(req.params.id);
    if (!websiteAccessForDomain?.plan.has_custom_domain)
      return res.status(403).json({ error: 'Custom domains are a Professional Website plan feature.', code: 'FEATURE_NOT_INCLUDED', redirect: '/pricing' });

    const { data: taken } = await supabaseAdmin.from('businesses').select('id').eq('custom_domain', clean).neq('id', req.params.id).maybeSingle();
    if (taken) return res.status(409).json({ error: 'That domain is already connected to another listing.' });

    const token = crypto.randomBytes(16).toString('hex');
    const { error } = await supabaseAdmin.from('businesses').update({
      custom_domain: clean, custom_domain_verified: false, custom_domain_token: token,
    }).eq('id', req.params.id);
    if (error) throw error;

    res.json({
      domain: clean,
      instructions: {
        txt: { host: `_spotgh-verify.${clean}`, type: 'TXT', value: token },
        cname: { host: clean, type: 'CNAME', value: env.ROOT_DOMAIN },
      },
      message: 'Add the TXT record below at your domain registrar, then click Verify. Once verified, also point your domain\'s CNAME (or A record, per your host\'s instructions) at us so traffic actually reaches your listing.',
    });
  } catch (err) { next(err); }
};

exports.verifyCustomDomain = async (req, res, next) => {
  try {
    const { data: biz } = await supabaseAdmin.from('businesses').select('custom_domain,custom_domain_token').eq('id', req.params.id).single();
    if (!biz?.custom_domain) return res.status(400).json({ error: 'No custom domain set for this listing yet.' });

    let records = [];
    try { records = await dns.resolveTxt(`_spotgh-verify.${biz.custom_domain}`); }
    catch { return res.status(400).json({ error: 'TXT record not found yet — DNS changes can take up to 24 hours to propagate.', verified: false }); }

    const found = records.flat().some(v => v === biz.custom_domain_token);
    if (!found) return res.status(400).json({ error: 'TXT record found, but the value doesn\'t match. Double-check what you pasted.', verified: false });

    await supabaseAdmin.from('businesses').update({ custom_domain_verified: true }).eq('id', req.params.id);
    res.json({ verified: true });
  } catch (err) { next(err); }
};

exports.removeCustomDomain = async (req, res, next) => {
  try {
    await supabaseAdmin.from('businesses').update({ custom_domain: null, custom_domain_verified: false, custom_domain_token: null }).eq('id', req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
};

// ── API Access (Enterprise plan feature) ────────────────────────────────
// A real, scoped read-only API: a business gets a key that can only ever
// read that one business's own public data (profile, products, reviews).
// See routes/apiV1.routes.js for the authenticated endpoints themselves.
exports.createApiKey = async (req, res, next) => {
  try {
    const websiteAccessForApi = await getWebsiteAccess(req.params.id);
    if (!websiteAccessForApi?.plan.has_api_access)
      return res.status(403).json({ error: 'API access is a Business Pro Website plan feature.', code: 'FEATURE_NOT_INCLUDED', redirect: '/pricing' });

    const { count } = await supabaseAdmin.from('api_keys').select('id', { count: 'exact' }).eq('business_id', req.params.id).is('revoked_at', null);
    if (count >= 5) return res.status(403).json({ error: 'Maximum of 5 active API keys per business. Revoke one first.' });

    const raw = `sgh_live_${crypto.randomBytes(24).toString('hex')}`;
    const hash = crypto.createHash('sha256').update(raw).digest('hex');
    const { data, error } = await supabaseAdmin.from('api_keys').insert({
      business_id: req.params.id, user_id: req.user.id, key_prefix: raw.slice(0, 16),
      key_hash: hash, name: req.body?.name || 'Default key',
    }).select('id,key_prefix,name,created_at').single();
    if (error) throw error;

    // The raw key is only ever shown here — we only stored its hash.
    res.status(201).json({ key: raw, ...data });
  } catch (err) { next(err); }
};

exports.listApiKeys = async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('api_keys')
      .select('id,key_prefix,name,last_used_at,created_at,revoked_at')
      .eq('business_id', req.params.id).order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ keys: data || [] });
  } catch (err) { next(err); }
};

exports.revokeApiKey = async (req, res, next) => {
  try {
    const { error } = await supabaseAdmin.from('api_keys').update({ revoked_at: new Date().toISOString() })
      .eq('id', req.params.keyId).eq('business_id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) { next(err); }
};

// ── Staff / team profiles (stylists, doctors, mechanics, etc.) ────────────
exports.listStaff = async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('business_staff')
      .select('*').eq('business_id', req.params.id).eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (error) throw error;
    res.json({ staff: data || [] });
  } catch (err) { next(err); }
};

exports.addStaff = async (req, res, next) => {
  try {
    const { name, role, photo_url, bio, sort_order } = req.body;
    if (!name) return res.status(400).json({ error: 'Staff name is required' });
    const { data, error } = await supabaseAdmin.from('business_staff')
      .insert({ business_id: req.params.id, name, role, photo_url, bio, sort_order: sort_order || 0 })
      .select().single();
    if (error) throw error;
    res.status(201).json({ staff: data });
  } catch (err) { next(err); }
};

exports.updateStaff = async (req, res, next) => {
  try {
    const { name, role, photo_url, bio, sort_order, is_active } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (role !== undefined) updates.role = role;
    if (photo_url !== undefined) updates.photo_url = photo_url;
    if (bio !== undefined) updates.bio = bio;
    if (sort_order !== undefined) updates.sort_order = sort_order;
    if (is_active !== undefined) updates.is_active = is_active;
    const { data, error } = await supabaseAdmin.from('business_staff')
      .update(updates).eq('id', req.params.staffId).eq('business_id', req.params.id)
      .select().single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Staff member not found' });
    res.json({ staff: data });
  } catch (err) { next(err); }
};

exports.removeStaff = async (req, res, next) => {
  try {
    const { error } = await supabaseAdmin.from('business_staff')
      .delete().eq('id', req.params.staffId).eq('business_id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) { next(err); }
};