// backend/controllers/user.controller.js
const { supabaseAdmin } = require('../config/supabase');
const { notify } = require('../services/supabase.service');

exports.getNotifications = async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('notifications').select('*').eq('user_id', req.user.id).order('created_at', { ascending: false }).limit(20);
    if (error) throw error;
    const unread = (data || []).filter(n => !n.is_read).length;
    res.json({ notifications: data, unread_count: unread });
  } catch (err) { next(err); }
};

exports.markAllRead = async (req, res, next) => {
  try {
    await supabaseAdmin.from('notifications').update({ is_read: true }).eq('user_id', req.user.id).eq('is_read', false);
    res.json({ message: 'All marked as read' });
  } catch (err) { next(err); }
};

exports.markOneRead = async (req, res, next) => {
  try {
    const { error } = await supabaseAdmin.from('notifications').update({ is_read: true }).eq('id', req.params.id).eq('user_id', req.user.id);
    if (error) throw error;
    res.json({ message: 'Marked as read' });
  } catch (err) { next(err); }
};

exports.getReferralCode = async (req, res, next) => {
  try {
    let { data: user } = await supabaseAdmin.from('users').select('referral_code, full_name, referral_credit_ghs').eq('id', req.user.id).single();
    if (!user.referral_code) {
      const code = user.full_name.split(' ')[0].toUpperCase().slice(0, 4) + Math.random().toString(36).slice(2, 6).toUpperCase();
      await supabaseAdmin.from('users').update({ referral_code: code }).eq('id', req.user.id);
      user.referral_code = code;
    }
    const { count } = await supabaseAdmin.from('users').select('id', { count: 'exact' }).eq('referred_by', req.user.id);
    res.json({ code: user.referral_code, referrals_count: count || 0, credit_balance: Number(user.referral_credit_ghs || 0), share_url: `${process.env.APP_URL || 'http://localhost:3000'}/register?ref=${user.referral_code}` });
  } catch (err) { next(err); }
};

const SIGNUP_REFERRAL_CREDIT = 5;   // GHS, awarded when the referred person signs up
const FIRST_ORDER_REFERRAL_BONUS = 10; // GHS, awarded when their business's first order completes

exports.applyReferral = async (req, res, next) => {
  try {
    const { code } = req.body;
    const new_user_id = req.user.id; // always the caller's own session — never trust a client-supplied id here
    if (!code) return res.status(400).json({ error: 'code required' });
    const { data: referrer } = await supabaseAdmin.from('users').select('id,referral_credit_ghs').eq('referral_code', code.toUpperCase()).single();
    if (!referrer) return res.status(404).json({ error: 'Invalid referral code' });
    if (referrer.id === new_user_id) return res.status(400).json({ error: 'Cannot refer yourself' });
    const { data: newUser } = await supabaseAdmin.from('users').select('referred_by').eq('id', new_user_id).single();
    if (newUser?.referred_by) return res.status(400).json({ error: 'This account already has a referrer' });

    await supabaseAdmin.from('users').update({ referred_by: referrer.id }).eq('id', new_user_id);
    // This used to just send a notification promising "10% off your next
    // renewal" with nothing anywhere that ever tracked or applied that
    // discount. Now it's a real balance, applied automatically at the
    // next subscription checkout — see payments.routes.js /initialize.
    await supabaseAdmin.from('users').update({ referral_credit_ghs: (referrer.referral_credit_ghs || 0) + SIGNUP_REFERRAL_CREDIT }).eq('id', referrer.id);
    await notify(referrer.id, 'success', '🎉 New Referral!', `Someone joined using your referral code! GHS ${SIGNUP_REFERRAL_CREDIT} credit has been added to your account — it's applied automatically on your next plan payment.`, '/referrals');
    res.json({ message: 'Referral applied' });
  } catch (err) { next(err); }
};

exports.getAnalytics = async (req, res, next) => {
  try {
    const { businessId } = req.params;
    const { days = 30 } = req.query;

    // This previously had no ownership check at all — any logged-in user
    // could view any business's analytics just by knowing its ID.
    const { data: biz } = await supabaseAdmin.from('businesses').select('owner_id,subscription_tier').eq('id', businessId).single();
    if (!biz) return res.status(404).json({ error: 'Business not found' });
    if (biz.owner_id !== req.user.id && req.user.role !== 'creator')
      return res.status(403).json({ error: 'Not your business' });

    const { data: plan } = await supabaseAdmin.from('plans').select('has_analytics,has_advanced_analytics').eq('tier', biz.subscription_tier).single();
    if (!plan?.has_analytics)
      return res.status(403).json({ error: "Analytics isn't included in your current plan.", code: 'FEATURE_NOT_INCLUDED', redirect: '/pricing' });

    const since = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000).toISOString();
    // Previous period of equal length, immediately before `since`, so the
    // dashboard can show "views ↑25%" style deltas rather than bare totals.
    const prevSince = new Date(Date.now() - parseInt(days) * 2 * 24 * 60 * 60 * 1000).toISOString();
    const [viewsRes, eventsRes, reviewsRes, bizRes, ordersRes, prevViewsRes, prevEventsRes, prevOrdersRes] = await Promise.all([
      supabaseAdmin.from('analytics_events').select('created_at').eq('business_id', businessId).eq('event_type', 'view').gte('created_at', since),
      supabaseAdmin.from('analytics_events').select('event_type,created_at').eq('business_id', businessId).neq('event_type', 'view').gte('created_at', since),
      supabaseAdmin.from('reviews').select('rating,created_at,owner_reply').eq('business_id', businessId).eq('status', 'approved'),
      supabaseAdmin.from('businesses_with_stats').select('view_count,avg_rating,review_count,whatsapp_click_count,logo_url,cover_url,description,gallery_count,phone,whatsapp,operating_hours,is_verified,has_own_website,own_website_verified,created_at,updated_at,is_top_rated,is_new').eq('id', businessId).single(),
      supabaseAdmin.from('orders').select('total,status,created_at').eq('business_id', businessId).gte('created_at', since),
      supabaseAdmin.from('analytics_events').select('created_at').eq('business_id', businessId).eq('event_type', 'view').gte('created_at', prevSince).lt('created_at', since),
      supabaseAdmin.from('analytics_events').select('event_type,created_at').eq('business_id', businessId).neq('event_type', 'view').gte('created_at', prevSince).lt('created_at', since),
      supabaseAdmin.from('orders').select('total,status').eq('business_id', businessId).gte('created_at', prevSince).lt('created_at', since),
    ]);
    const viewsByDay = {};
    (viewsRes.data || []).forEach(v => { const d = v.created_at.split('T')[0]; viewsByDay[d] = (viewsByDay[d] || 0) + 1; });
    const eventCounts = {};
    (eventsRes.data || []).forEach(e => { eventCounts[e.event_type] = (eventCounts[e.event_type] || 0) + 1; });
    // Cancelled orders don't count toward revenue — everything else does,
    // including still-pending ones, since payment is collected offline
    // and "pending" just means not yet fulfilled, not unpaid.
    const validOrders = (ordersRes.data || []).filter(o => o.status !== 'cancelled');
    const orderRevenue = validOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);

    const prevEventCounts = {};
    (prevEventsRes.data || []).forEach(e => { prevEventCounts[e.event_type] = (prevEventCounts[e.event_type] || 0) + 1; });
    const prevValidOrders = (prevOrdersRes.data || []).filter(o => o.status !== 'cancelled');

    // % change vs. the prior period of the same length. Null (not 0 or
    // negative-infinity) when there's nothing to compare against yet, so
    // the frontend can show "—" instead of a misleading "∞%" or "0%".
    const pctChange = (curr, prev) => {
      if (!prev) return curr > 0 ? null : 0;
      return Math.round(((curr - prev) / prev) * 100);
    };

    const summary = {
      total_views: bizRes.data?.view_count || 0,
      views_period: viewsRes.data?.length || 0,
      views_period_change_pct: pctChange(viewsRes.data?.length || 0, (prevViewsRes.data || []).length),
      avg_rating: bizRes.data?.avg_rating || 0,
      total_reviews: bizRes.data?.review_count || 0,
      whatsapp_clicks: eventCounts['whatsapp_click'] || 0,
      whatsapp_clicks_change_pct: pctChange(eventCounts['whatsapp_click'] || 0, prevEventCounts['whatsapp_click'] || 0),
      call_clicks: eventCounts['call_click'] || 0,
      call_clicks_change_pct: pctChange(eventCounts['call_click'] || 0, prevEventCounts['call_click'] || 0),
      orders_period: validOrders.length,
      orders_period_change_pct: pctChange(validOrders.length, prevValidOrders.length),
      order_revenue_period: orderRevenue,
    };

    // Plain-language, rule-based suggestions from what's actually missing on
    // the profile — not a general "improve engagement" platitude, but a
    // specific next action.
    const tips = [];
    if ((bizRes.data?.gallery_count || 0) === 0) tips.push('Adding photos could improve engagement — listings with photos get more views.');
    if (!bizRes.data?.logo_url) tips.push("You haven't added a logo yet — it's the first thing customers notice.");
    if (!bizRes.data?.description) tips.push('Add a description so customers know what makes your business worth visiting.');
    if ((bizRes.data?.review_count || 0) === 0) tips.push('Ask a happy customer to leave your first review — it builds trust for everyone after.');
    const galleryCount = bizRes.data?.gallery_count || 0;
    if (galleryCount > 0 && galleryCount < 5) tips.push(`Your profile could use ${5 - galleryCount} more photo${5 - galleryCount === 1 ? '' : 's'} to improve visibility.`);
    if ((reviewsRes.data || []).some(r => !r.owner_reply)) tips.push('Businesses that respond to reviews usually see more customer engagement.');

    // Same default template as the businesses.operating_hours column default
    // (schema.sql) — used only to detect whether an owner has ever touched
    // their hours, not to validate the hours themselves.
    const DEFAULT_HOURS = JSON.stringify({
      monday:{open:'08:00',close:'18:00',closed:false}, tuesday:{open:'08:00',close:'18:00',closed:false},
      wednesday:{open:'08:00',close:'18:00',closed:false}, thursday:{open:'08:00',close:'18:00',closed:false},
      friday:{open:'08:00',close:'18:00',closed:false}, saturday:{open:'09:00',close:'16:00',closed:false},
      sunday:{open:null,close:null,closed:true},
    });
    const hoursCustomized = JSON.stringify(bizRes.data?.operating_hours || {}) !== DEFAULT_HOURS;

    // Profile completeness — equal-weighted checklist of fields a customer
    // actually sees, not every column on the row.
    const completenessChecks = [
      !!bizRes.data?.description, !!bizRes.data?.logo_url, !!bizRes.data?.cover_url,
      galleryCount >= 5, !!bizRes.data?.phone, !!bizRes.data?.whatsapp,
      hoursCustomized, (bizRes.data?.review_count || 0) > 0,
    ];
    const completenessPct = Math.round((completenessChecks.filter(Boolean).length / completenessChecks.length) * 100);

    const totalReviews = (reviewsRes.data || []).length;
    const repliedReviews = (reviewsRes.data || []).filter(r => r.owner_reply).length;
    const responseRatePct = totalReviews ? Math.round((repliedReviews / totalReviews) * 100) : null;
    const recentActivity = (viewsRes.data?.length || 0) > 0 || validOrders.length > 0
      || (bizRes.data?.updated_at && new Date(bizRes.data.updated_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const avgRating = Number(bizRes.data?.avg_rating || 0);

    // Composite trust score, 0–100: verified status (25) + profile
    // completeness (25) + review response rate (20) + average rating (20)
    // + recent activity (10). Response rate defaults to half-credit when
    // there are no reviews yet, so a brand-new business isn't punished for
    // something it hasn't had the chance to do.
    const trustScore = Math.round(
      (bizRes.data?.is_verified ? 25 : 0) +
      (completenessPct / 100) * 25 +
      ((responseRatePct === null ? 50 : responseRatePct) / 100) * 20 +
      (Math.min(avgRating, 5) / 5) * 20 +
      (recentActivity ? 10 : 0)
    );
    const trustBand = trustScore >= 80 ? 'Excellent' : trustScore >= 60 ? 'Good' : trustScore >= 40 ? 'Fair' : 'Needs Improvement';

    const checklist = [
      { key: 'profile', label: 'Complete your profile', done: !!bizRes.data?.description && !!bizRes.data?.logo_url && !!bizRes.data?.cover_url },
      { key: 'photos', label: 'Upload 10 photos', done: galleryCount >= 10 },
      { key: 'verified', label: 'Get verified', done: !!bizRes.data?.is_verified },
      { key: 'hours', label: 'Add business hours', done: hoursCustomized },
      { key: 'website', label: 'Publish your website', done: !!bizRes.data?.has_own_website && !!bizRes.data?.own_website_verified },
      { key: 'share', label: 'Share your listing', done: (eventCounts['share'] || 0) > 0 },
    ];

    const badges = [
      { icon: '🌟', label: 'New Business', earned: !!bizRes.data?.is_new },
      { icon: '📸', label: 'Photo Expert', earned: galleryCount >= 10 },
      { icon: '💬', label: 'Fast Responder', earned: totalReviews >= 3 && (responseRatePct || 0) >= 80 },
      { icon: '⭐', label: 'Highly Rated', earned: !!bizRes.data?.is_top_rated },
      { icon: '🔥', label: 'Trending', earned: (summary.views_period_change_pct || 0) >= 50 },
      { icon: '🏆', label: 'Trusted Business', earned: !!bizRes.data?.is_verified && avgRating >= 4 && (bizRes.data?.review_count || 0) >= 10 },
    ];

    const trust = { score: trustScore, band: trustBand, completeness_pct: completenessPct, response_rate_pct: responseRatePct, recent_activity: recentActivity, is_verified: !!bizRes.data?.is_verified };

    // Starter gets the headline numbers only; day-by-day trend, full event
    // breakdown, and rating distribution are the "advanced" tier feature.
    // Trust score, checklist, and badges are shown at every tier — they're
    // meant to nudge free/starter owners toward upgrading, not gate them.
    if (!plan.has_advanced_analytics) return res.json({ summary, tips, trust, checklist, badges, advanced_locked: true });

    res.json({
      summary,
      tips,
      trust,
      checklist,
      badges,
      views_by_day: viewsByDay,
      event_breakdown: eventCounts,
      rating_distribution: [1,2,3,4,5].map(r => ({ rating: r, count: (reviewsRes.data || []).filter(rv => rv.rating === r).length })),
    });
  } catch (err) { next(err); }
};

exports.getFavorites = async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('saved_businesses')
      .select('created_at, business:businesses_with_stats(id,name,slug,logo_url,city,category_name,avg_rating,review_count,category_icon)')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ data: (data || []).map(r => r.business) });
  } catch (err) { next(err); }
};

exports.addFavorite = async (req, res, next) => {
  try {
    const { businessId } = req.params;
    const { data, error } = await supabaseAdmin
      .from('saved_businesses')
      .upsert({ user_id: req.user.id, business_id: businessId }, { onConflict: 'user_id,business_id' })
      .select().single();
    if (error) throw error;
    res.json({ saved: true, message: 'Saved to favourites' });
  } catch (err) { next(err); }
};

exports.removeFavorite = async (req, res, next) => {
  try {
    const { businessId } = req.params;
    const { error } = await supabaseAdmin.from('saved_businesses').delete().eq('user_id', req.user.id).eq('business_id', businessId);
    if (error) throw error;
    res.json({ message: 'Removed from favorites' });
  } catch (err) { next(err); }
};

// Per-product favorites — separate from the business-level ones above.
// Lets a customer save a specific item (not the whole business) and
// quickly re-add it to cart later without re-browsing the catalog.
exports.getFavoriteProducts = async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('saved_products')
      .select('created_at, product:products_services(id,name,price,image_url,is_available,track_inventory,stock_quantity,allow_backorder,business_id,businesses(name,slug))')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ data: (data || []).map(r => r.product).filter(Boolean) });
  } catch (err) { next(err); }
};
exports.addFavoriteProduct = async (req, res, next) => {
  try {
    const { error } = await supabaseAdmin.from('saved_products')
      .upsert({ user_id: req.user.id, product_id: req.params.productId }, { onConflict: 'user_id,product_id' });
    if (error) throw error;
    res.json({ saved: true, message: 'Saved!' });
  } catch (err) { next(err); }
};
exports.removeFavoriteProduct = async (req, res, next) => {
  try {
    const { error } = await supabaseAdmin.from('saved_products').delete().eq('user_id', req.user.id).eq('product_id', req.params.productId);
    if (error) throw error;
    res.json({ message: 'Removed from saved items' });
  } catch (err) { next(err); }
};

// PATCH /api/user/profile — profile.js calls this exact path; it never existed
// before (only /api/auth/profile did, and that doesn't accept avatar_url).
exports.updateProfile = async (req, res, next) => {
  try {
    const { full_name, phone, avatar_url, notification_preferences } = req.body;
    const updates = {};
    if (full_name !== undefined) updates.full_name = full_name;
    if (phone !== undefined) updates.phone = phone;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;
    if (notification_preferences !== undefined) updates.notification_preferences = notification_preferences;
    const { data: user, error } = await supabaseAdmin.from('users').update(updates).eq('id', req.user.id).select().single();
    if (error) throw error;
    res.json({ user, message: 'Profile updated' });
  } catch (err) { next(err); }
};