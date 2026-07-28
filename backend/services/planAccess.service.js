// backend/services/planAccess.service.js
//
// Directory Listing and Mini-Website are now two independent subscription
// products (see migration 018). This is the one place that resolves what
// a business is actually entitled to for each, so every route/controller
// checks the same thing instead of re-reading the plan tables itself.
//
// Anything still reading `businesses.subscription_tier` / the old `plans`
// table directly hasn't been rewired yet — see CHANGELOG v23 for the list.
const { supabaseAdmin } = require('../config/supabase');

const FREE_DIRECTORY_FALLBACK = { tier: 'free', max_businesses: 1, max_photos: 1 };

// Returns the business's active Directory plan + flags, or the Free
// fallback if there's no active row (shouldn't normally happen — every
// business gets a Free directory subscription at creation).
async function getDirectoryAccess(businessId) {
  const { data: sub } = await supabaseAdmin
    .from('business_directory_subscriptions')
    .select('*,directory_plans(*)')
    .eq('business_id', businessId).eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: false }).limit(1).maybeSingle();
  if (sub?.directory_plans) return { subscription: sub, plan: sub.directory_plans };
  const { data: free } = await supabaseAdmin.from('directory_plans').select('*').eq('tier', 'free').maybeSingle();
  return { subscription: null, plan: free || FREE_DIRECTORY_FALLBACK };
}

// Returns null if the business has no active Website subscription at all
// (either never subscribed, lapsed, or it uses its own external site).
async function getWebsiteAccess(businessId) {
  const { data: sub } = await supabaseAdmin
    .from('business_website_subscriptions')
    .select('*,website_plans(*)')
    .eq('business_id', businessId).eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: false }).limit(1).maybeSingle();
  if (!sub?.website_plans) return null;
  return { subscription: sub, plan: sub.website_plans };
}

async function hasWebsiteAccess(businessId) {
  return !!(await getWebsiteAccess(businessId));
}

// A user's Directory plan for account-level limits (max_businesses) is
// taken from whichever of their businesses has the highest active
// Directory tier — mirrors the old loadPlan behavior of "most recent
// active subscription" closely enough for limit-checking purposes.
async function getUserDirectoryPlan(userId) {
  const { data: subs } = await supabaseAdmin
    .from('business_directory_subscriptions')
    .select('*,directory_plans(*)')
    .eq('user_id', userId).eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: false }).limit(1);
  if (subs?.[0]?.directory_plans) return subs[0].directory_plans;
  const { data: free } = await supabaseAdmin.from('directory_plans').select('*').eq('tier', 'free').maybeSingle();
  return free || FREE_DIRECTORY_FALLBACK;
}

module.exports = { getDirectoryAccess, getWebsiteAccess, hasWebsiteAccess, getUserDirectoryPlan };
