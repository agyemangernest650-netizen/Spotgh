// backend/routes/payments.routes.js
const router = require('express').Router();
const env = require('../config/env');
const { supabaseAdmin } = require('../config/supabase');
const { verifyToken, requireAdmin, requireCreator, requireOwnership, optionalAuth } = require('../middleware/auth.middleware');
const { paginate, notify, audit } = require('../services/supabase.service');
const { sendEmail, wrap } = require('../services/email.service');
const limits = require('../middleware/rateLimit.middleware');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const PS = process.env.PAYSTACK_SECRET_KEY;
const psH = { Authorization: `Bearer ${PS}`, 'Content-Type': 'application/json' };

// A business that already has its own website doesn't need SpotGH to
// build/host a mini-site for it, so it's billed the discounted
// *_own_website price instead of the full price.
//
// Source of truth: if a business_id is given, its own `has_own_website`
// column always wins — a client can't talk its way into a discount on an
// existing business by lying in the request. `claimedOwnWebsite` is only
// consulted when there's no business yet at all (a first-time visitor
// subscribing before they've created a business, since the app requires
// an active plan before you can add one) — otherwise the discount could
// never apply to that primary signup path. Falls back to the full price
// if neither is available or the discount columns aren't set.
async function resolvePlanPrice(plan, billingCycle, businessId, claimedOwnWebsite) {
  const fullMonthly = plan.price_monthly, fullYearly = plan.price_yearly;
  let ownsWebsite = false;
  if (businessId) {
    const { data: biz } = await supabaseAdmin.from('businesses').select('has_own_website').eq('id', businessId).maybeSingle();
    ownsWebsite = !!biz?.has_own_website;
  } else {
    ownsWebsite = claimedOwnWebsite === true || claimedOwnWebsite === 'true';
  }
  if (ownsWebsite && plan.price_monthly_own_website != null) {
    return billingCycle === 'yearly' ? plan.price_yearly_own_website : plan.price_monthly_own_website;
  }
  return billingCycle === 'yearly' ? fullYearly : fullMonthly;
}

// GET /api/payments/my — user's own payment history
// ============================================================
// v2: independent Directory / Website / Bundle subscriptions
// (migration 018). The legacy endpoints below (plan_tier against the
// single `plans` table) are left untouched for backward compatibility
// with anything not yet updated to call these.
// ============================================================

// Resolves the plan row + monthly/yearly price for a v2 checkout.
// subscription_type: 'directory' | 'website' | 'bundle'
async function resolveV2Plan(subscriptionType, planKey) {
  if (subscriptionType === 'directory') {
    const { data: plan } = await supabaseAdmin.from('directory_plans').select('*').eq('tier', planKey).single();
    if (!plan || plan.tier === 'free') return null;
    return { plan, table: 'directory_plans', kind: 'directory' };
  }
  if (subscriptionType === 'website') {
    const { data: plan } = await supabaseAdmin.from('website_plans').select('*').eq('tier', planKey).single();
    if (!plan) return null;
    return { plan, table: 'website_plans', kind: 'website' };
  }
  if (subscriptionType === 'bundle') {
    const { data: bundle } = await supabaseAdmin.from('bundles').select('*,directory_plans(*),website_plans(*)').eq('key', planKey).eq('is_active', true).single();
    if (!bundle) return null;
    return { plan: bundle, table: 'bundles', kind: 'bundle' };
  }
  return null;
}

function v2Price(resolved, billingCycle) {
  if (resolved.kind === 'bundle') {
    const dir = resolved.plan.directory_plans, web = resolved.plan.website_plans;
    const base = billingCycle === 'yearly' ? Number(dir.price_yearly) + Number(web.price_yearly) : Number(dir.price_monthly) + Number(web.price_monthly);
    return Math.round(base * (1 - resolved.plan.discount_percent / 100));
  }
  return billingCycle === 'yearly' ? Number(resolved.plan.price_yearly) : Number(resolved.plan.price_monthly);
}

// Writes the actual subscription row(s) once a v2 payment is confirmed
// (or fully covered by trial/credit) and mirrors the tier onto the
// business's convenience columns.
async function activateV2Subscription({ resolved, userId, businessId, billingCycle, amount, reference, isTrial, bundleId }) {
  const now = new Date();
  const exp = new Date(now);
  if (isTrial) exp.setDate(exp.getDate() + (resolved.plan.free_trial_days || 30));
  else billingCycle === 'yearly' ? exp.setFullYear(exp.getFullYear() + 1) : exp.setMonth(exp.getMonth() + 1);

  async function writeDirectory(plan, amt) {
    await supabaseAdmin.from('business_directory_subscriptions').insert({
      business_id: businessId, user_id: userId, plan_id: plan.id, tier: plan.tier, status: 'active',
      amount_paid: amt, billing_cycle: billingCycle, bundle_id: bundleId || null,
      paystack_reference: reference || null, started_at: now.toISOString(), expires_at: exp.toISOString(),
    });
    if (businessId) await supabaseAdmin.from('businesses').update({ directory_tier: plan.tier, directory_expires_at: exp.toISOString() }).eq('id', businessId);
  }
  async function writeWebsite(plan, amt) {
    await supabaseAdmin.from('business_website_subscriptions').insert({
      business_id: businessId, user_id: userId, plan_id: plan.id, tier: plan.tier, status: 'active',
      amount_paid: amt, billing_cycle: billingCycle, bundle_id: bundleId || null, is_trial: !!isTrial,
      paystack_reference: reference || null, started_at: now.toISOString(), expires_at: exp.toISOString(),
    });
    if (businessId) await supabaseAdmin.from('businesses').update({ website_tier: plan.tier, website_expires_at: exp.toISOString() }).eq('id', businessId);
  }

  if (resolved.kind === 'directory') await writeDirectory(resolved.plan, amount);
  else if (resolved.kind === 'website') await writeWebsite(resolved.plan, amount);
  else if (resolved.kind === 'bundle') {
    // Split the combined amount proportionally across the two rows just
    // for reporting purposes — the business's actual access comes from
    // each row's own tier/expiry, not from how the total was divided.
    const dir = resolved.plan.directory_plans, web = resolved.plan.website_plans;
    const dirShare = billingCycle === 'yearly' ? Number(dir.price_yearly) : Number(dir.price_monthly);
    const webShare = billingCycle === 'yearly' ? Number(web.price_yearly) : Number(web.price_monthly);
    const total = dirShare + webShare || 1;
    await writeDirectory(dir, Math.round(amount * (dirShare / total)));
    await writeWebsite(web, Math.round(amount * (webShare / total)));
  }
  return exp;
}

router.post('/v2/initialize', verifyToken, limits.payments, async (req, res, next) => {
  try {
    const { subscription_type, plan_key, billing_cycle = 'monthly', business_id, promo_code } = req.body;
    const resolved = await resolveV2Plan(subscription_type, plan_key);
    if (!resolved) return res.status(400).json({ error: 'Invalid plan' });

    let amount = v2Price(resolved, billing_cycle);
    let discount = 0;
    if (promo_code) {
      const { data: promo } = await supabaseAdmin.from('promo_codes').select('*').eq('code', promo_code.toUpperCase()).eq('is_active', true).single();
      if (promo && (!promo.valid_until || new Date(promo.valid_until) > new Date()) && (!promo.max_uses || promo.used_count < promo.max_uses)) {
        discount = promo.type === 'percent' ? (amount * promo.value) / 100 : promo.value;
        amount = Math.max(0, amount - discount);
      }
    }

    // First month free on Website Starter — mirrors the legacy Directory
    // trial mechanic, but tracked separately (users.website_trial_used)
    // so someone can use both trials once each (one per product).
    let isTrial = false;
    const { data: buyer } = await supabaseAdmin.from('users').select('referral_credit_ghs,website_trial_used').eq('id', req.user.id).single();
    if (resolved.kind === 'website' && resolved.plan.tier === 'starter' && billing_cycle === 'monthly' && !buyer?.website_trial_used) {
      isTrial = true; amount = 0;
    }

    let creditApplied = 0;
    const availableCredit = Number(buyer?.referral_credit_ghs || 0);
    if (!isTrial && availableCredit > 0 && amount > 0) {
      creditApplied = Math.min(availableCredit, amount);
      amount = Math.max(0, amount - creditApplied);
      await supabaseAdmin.from('users').update({ referral_credit_ghs: availableCredit - creditApplied }).eq('id', req.user.id);
    }

    const reference = `SGH2-${uuidv4().replace(/-/g, '').slice(0, 16).toUpperCase()}`;
    const planName = resolved.kind === 'bundle' ? resolved.plan.name : resolved.plan.name;

    if (amount <= 0) {
      const bundleId = resolved.kind === 'bundle' ? resolved.plan.id : null;
      await supabaseAdmin.from('payments').insert({
        user_id: req.user.id, business_id: business_id || null, amount: 0, currency: 'GHS', status: 'paid',
        paid_at: new Date().toISOString(), paystack_reference: reference,
        description: isTrial ? `SpotGH ${planName} - ${billing_cycle} (first month free trial)` : `SpotGH ${planName} - ${billing_cycle} (fully covered by referral credit)`,
        metadata: { subscription_type, plan_key, billing_cycle, promo_code: promo_code || null, discount_amount: discount, referral_credit_applied: creditApplied, is_trial: isTrial },
      });
      const exp = await activateV2Subscription({ resolved, userId: req.user.id, businessId: business_id || null, billingCycle: billing_cycle, amount: 0, reference, isTrial, bundleId });
      if (isTrial) await supabaseAdmin.from('users').update({ website_trial_used: true }).eq('id', req.user.id);
      await notify(req.user.id, 'success', isTrial ? '🎉 Your free Starter Website month has started!' : '🎉 Plan activated with referral credit!',
        isTrial ? 'Your Starter mini-website is live free for the next 30 days — no payment needed.' : `Your ${planName} plan is now active, fully covered by your referral credit.`,
        '/pages/dashboard.html');
      return res.json({ fully_covered: true, is_trial: isTrial, redirect: `/pages/dashboard.html?payment=success`, referral_credit_applied: creditApplied, plan: planName, expires_at: exp.toISOString() });
    }

    await supabaseAdmin.from('payments').insert({
      user_id: req.user.id, business_id: business_id || null, amount, currency: 'GHS', status: 'pending',
      paystack_reference: reference, description: `SpotGH ${planName} - ${billing_cycle}`,
      metadata: { subscription_type, plan_key, billing_cycle, promo_code: promo_code || null, discount_amount: discount, referral_credit_applied: creditApplied },
    });
    const pRes = await axios.post('https://api.paystack.co/transaction/initialize', {
      email: req.user.email, amount: Math.round(amount * 100), currency: 'GHS', reference,
      callback_url: `${process.env.APP_URL}/api/payments/v2/verify/${reference}`,
      channels: ['card', 'mobile_money', 'bank'],
      metadata: { user_id: req.user.id, subscription_type, plan_key, billing_cycle, business_id: business_id || null },
    }, { headers: psH });
    res.json({ authorization_url: pRes.data.data.authorization_url, reference, amount, discount, referral_credit_applied: creditApplied, plan: planName });
  } catch (err) { next(err); }
});

router.get('/v2/verify/:reference', async (req, res) => {
  try {
    const pRes = await axios.get(`https://api.paystack.co/transaction/verify/${req.params.reference}`, { headers: psH });
    const txn = pRes.data.data;
    const { data: payment } = await supabaseAdmin.from('payments').select('*').eq('paystack_reference', req.params.reference).single();
    if (!payment || payment.status === 'paid') return res.redirect(`${process.env.APP_URL}/?payment=already_processed`);
    if (txn.status !== 'success') {
      await supabaseAdmin.from('payments').update({ status: 'failed' }).eq('paystack_reference', req.params.reference);
      return res.redirect(`${process.env.APP_URL}/pages/pricing.html?payment=failed`);
    }
    const meta = payment.metadata;
    const authCode = txn.authorization?.reusable ? txn.authorization.authorization_code : null;
    await supabaseAdmin.from('payments').update({ status: 'paid', paid_at: new Date().toISOString(), paystack_transaction_id: String(txn.id), channel: txn.channel, authorization_code: authCode }).eq('paystack_reference', req.params.reference);

    const resolved = await resolveV2Plan(meta.subscription_type, meta.plan_key);
    const bundleId = resolved.kind === 'bundle' ? resolved.plan.id : null;
    const exp = await activateV2Subscription({ resolved, userId: payment.user_id, businessId: meta.business_id || null, billingCycle: meta.billing_cycle, amount: payment.amount, reference: req.params.reference, isTrial: false, bundleId });

    const planName = resolved.plan.name;
    await notify(payment.user_id, 'success', '🎉 Payment Successful!', `Your ${planName} plan is now active.`, '/pages/dashboard.html');
    const { data: u } = await supabaseAdmin.from('users').select('email,full_name').eq('id', payment.user_id).single();
    if (u?.email) {
      await sendEmail(u.email, `Receipt: ${planName} plan — GHS ${payment.amount}`,
        wrap('Payment received', `Hi ${u.full_name || 'there'}, your payment of <strong>GHS ${payment.amount}</strong> for the <strong>${planName}</strong> plan (${meta.billing_cycle}) was successful. Your plan is active until <strong>${exp.toDateString()}</strong>.`,
        'Go to Dashboard', `${env.APP_URL}/pages/dashboard.html`));
    }
    return res.redirect(`${process.env.APP_URL}/pages/dashboard.html?payment=success`);
  } catch (err) { return res.redirect(`${process.env.APP_URL}/pages/pricing.html?payment=error`); }
});

router.post('/v2/renew', verifyToken, limits.payments, async (req, res, next) => {
  try {
    const { subscription_type, plan_key, billing_cycle = 'monthly', business_id } = req.body;
    const resolved = await resolveV2Plan(subscription_type, plan_key);
    if (!resolved) return res.status(400).json({ error: 'Invalid plan' });
    const { data: saved } = await supabaseAdmin.from('payments').select('authorization_code').eq('user_id', req.user.id).eq('status', 'paid').not('authorization_code', 'is', null).order('created_at', { ascending: false }).limit(1);
    const authCode = saved?.[0]?.authorization_code;
    if (!authCode) return res.status(400).json({ error: 'No saved payment method on file. Please pay with card or mobile money once to enable one-click renewal.', code: 'NO_SAVED_METHOD' });

    const amount = v2Price(resolved, billing_cycle);
    const reference = `CLGH2-${uuidv4().replace(/-/g, '').slice(0, 16).toUpperCase()}`;
    await supabaseAdmin.from('payments').insert({ user_id: req.user.id, business_id: business_id || null, amount, currency: 'GHS', status: 'pending', paystack_reference: reference, description: `SpotGH ${resolved.plan.name} renewal - ${billing_cycle}`, metadata: { subscription_type, plan_key, billing_cycle, renewal: true } });

    const chargeRes = await axios.post('https://api.paystack.co/transaction/charge_authorization', { authorization_code: authCode, email: req.user.email, amount: Math.round(amount * 100), currency: 'GHS', reference }, { headers: psH });
    const txn = chargeRes.data.data;
    if (txn.status !== 'success') {
      await supabaseAdmin.from('payments').update({ status: 'failed', failure_reason: txn.gateway_response || 'Charge failed' }).eq('paystack_reference', reference);
      return res.status(400).json({ error: txn.gateway_response || 'Renewal charge failed. Try paying manually instead.' });
    }
    await supabaseAdmin.from('payments').update({ status: 'paid', paid_at: new Date().toISOString(), paystack_transaction_id: String(txn.id), channel: txn.channel, authorization_code: authCode }).eq('paystack_reference', reference);
    const bundleId = resolved.kind === 'bundle' ? resolved.plan.id : null;
    const exp = await activateV2Subscription({ resolved, userId: req.user.id, businessId: business_id || null, billingCycle: billing_cycle, amount, reference, isTrial: false, bundleId });
    await notify(req.user.id, 'success', '🎉 Plan Renewed!', `Your ${resolved.plan.name} plan is active until ${exp.toDateString()}.`, '/pages/dashboard.html');
    res.json({ message: 'Renewed successfully', expires_at: exp.toISOString() });
  } catch (err) {
    if (err.response?.data) return res.status(400).json({ error: err.response.data.message || 'Renewal failed' });
    next(err);
  }
});

router.get('/my', verifyToken, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('payments')
      .select('id,amount,currency,status,paid_at,created_at,description,paystack_reference,channel,plans(name,tier),businesses(name,slug)')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    res.json({ payments: data || [] });
  } catch (err) { next(err); }
});

router.post('/initialize', verifyToken, limits.payments, async (req, res, next) => {
  try {
    const { plan_tier, billing_cycle='monthly', business_id, promo_code, has_own_website, website } = req.body;
    const { data: plan } = await supabaseAdmin.from('plans').select('*').eq('tier', plan_tier).single();
    if (!plan || plan.tier==='free') return res.status(400).json({ error: 'Invalid plan' });
    let amount = await resolvePlanPrice(plan, billing_cycle, business_id, has_own_website);
    let discount = 0;
    if (promo_code) {
      const { data: promo } = await supabaseAdmin.from('promo_codes').select('*').eq('code', promo_code.toUpperCase()).eq('is_active',true).single();
      if (promo && (!promo.valid_until || new Date(promo.valid_until)>new Date()) && (!promo.max_uses||promo.used_count<promo.max_uses)) {
        discount = promo.type==='percent' ? (amount*promo.value)/100 : promo.value;
        amount = Math.max(0, amount-discount);
      }
    }
    // First month free on Starter — the ONE point where the free trial is
    // granted (previously this fired silently on a user's first business
    // creation regardless of which plan they picked; now it only fires when
    // someone explicitly chooses Starter, and only for monthly billing).
    let isTrial = false;
    const { data: buyer } = await supabaseAdmin.from('users').select('referral_credit_ghs,trial_used').eq('id', req.user.id).single();
    if (plan_tier === 'starter' && billing_cycle === 'monthly' && !buyer?.trial_used) {
      isTrial = true;
      amount = 0;
    }
    // Auto-apply any referral credit the user has earned (from referring
    // signups or their referrals' first orders — see applyReferral and
    // orders.routes.js), on top of any promo code above. Capped at the
    // remaining amount so credit can never make a plan go negative.
    let creditApplied = 0;
    const availableCredit = Number(buyer?.referral_credit_ghs || 0);
    if (!isTrial && availableCredit > 0 && amount > 0) {
      creditApplied = Math.min(availableCredit, amount);
      amount = Math.max(0, amount - creditApplied);
      await supabaseAdmin.from('users').update({ referral_credit_ghs: availableCredit - creditApplied }).eq('id', req.user.id);
    }
    const reference = `SGH-${uuidv4().replace(/-/g,'').slice(0,16).toUpperCase()}`;

    // Fully covered by referral credit (or a free trial) — sending a ₵0
    // amount to Paystack's API isn't reliable, so skip it entirely and
    // activate the subscription directly, mirroring what /verify/:reference
    // does for a real payment.
    if (amount <= 0) {
      const now = new Date(); const exp = new Date(now);
      billing_cycle === 'yearly' ? exp.setFullYear(exp.getFullYear() + 1) : exp.setMonth(exp.getMonth() + 1);
      const description = isTrial
        ? `SpotGH ${plan.name} - ${billing_cycle} (first month free trial)`
        : `SpotGH ${plan.name} - ${billing_cycle} (fully covered by referral credit)`;
      await supabaseAdmin.from('payments').insert({ user_id: req.user.id, business_id: business_id || null, plan_id: plan.id, amount: 0, currency: 'GHS', status: 'paid', paid_at: now.toISOString(), paystack_reference: reference, description, metadata: { plan_tier, billing_cycle, promo_code: promo_code || null, discount_amount: discount, referral_credit_applied: creditApplied, is_trial: isTrial, claimed_own_website: business_id ? null : !!has_own_website, claimed_website: business_id ? null : (website || null) } });
      await supabaseAdmin.from('subscriptions').insert({ user_id: req.user.id, business_id: business_id || null, plan_id: plan.id, tier: plan_tier, status: 'active', amount_paid: 0, billing_cycle, paystack_reference: reference, started_at: now.toISOString(), expires_at: exp.toISOString(), is_trial: isTrial });
      if (business_id) await supabaseAdmin.from('businesses').update({ subscription_tier: plan_tier, subscription_expires_at: exp.toISOString(), status: 'pending' }).eq('id', business_id);
      if (isTrial) await supabaseAdmin.from('users').update({ trial_used: true }).eq('id', req.user.id);
      const notifTitle = isTrial ? '🎉 Your free Starter month has started!' : '🎉 Plan activated with referral credit!';
      const notifBody = isTrial ? `Your Starter mini-website is live free for the next 30 days — no payment needed.` : `Your ${plan.name} plan is now active — fully covered by your referral credit, no payment needed.`;
      await notify(req.user.id, 'success', notifTitle, notifBody, '/pages/dashboard.html');
      return res.json({ fully_covered: true, is_trial: isTrial, redirect: `/pages/dashboard.html?payment=success&plan=${plan_tier}`, referral_credit_applied: creditApplied, plan: plan.name });
    }

    await supabaseAdmin.from('payments').insert({ user_id: req.user.id, business_id: business_id||null, plan_id: plan.id, amount, currency:'GHS', status:'pending', paystack_reference: reference, description:`SpotGH ${plan.name} - ${billing_cycle}`, metadata:{ plan_tier, billing_cycle, promo_code:promo_code||null, discount_amount:discount, referral_credit_applied:creditApplied, claimed_own_website: business_id ? null : !!has_own_website, claimed_website: business_id ? null : (website || null) } });
    const pRes = await axios.post('https://api.paystack.co/transaction/initialize', { email: req.user.email, amount: Math.round(amount*100), currency:'GHS', reference, callback_url:`${process.env.APP_URL}/api/payments/verify/${reference}`, channels:['card','mobile_money','bank'], metadata:{ user_id:req.user.id, plan_tier, billing_cycle, business_id:business_id||null } }, { headers: psH });
    res.json({ authorization_url: pRes.data.data.authorization_url, reference, amount, discount, referral_credit_applied: creditApplied, plan: plan.name });
  } catch (err) { next(err); }
});

router.get('/verify/:reference', async (req, res) => {
  try {
    const pRes = await axios.get(`https://api.paystack.co/transaction/verify/${req.params.reference}`, { headers: psH });
    const txn = pRes.data.data;
    const { data: payment } = await supabaseAdmin.from('payments').select('*').eq('paystack_reference', req.params.reference).single();
    if (!payment || payment.status==='paid') return res.redirect(`${process.env.APP_URL}/?payment=already_processed`);
    if (txn.status!=='success') {
      await supabaseAdmin.from('payments').update({ status:'failed' }).eq('paystack_reference', req.params.reference);
      return res.redirect(`${process.env.APP_URL}/pages/pricing.html?payment=failed`);
    }
    const meta = payment.metadata; const now = new Date(); const exp = new Date(now);
    meta.billing_cycle==='yearly' ? exp.setFullYear(exp.getFullYear()+1) : exp.setMonth(exp.getMonth()+1);
    const authCode = txn.authorization?.reusable ? txn.authorization.authorization_code : null;
    await supabaseAdmin.from('payments').update({ status:'paid', paid_at: now.toISOString(), paystack_transaction_id: String(txn.id), channel: txn.channel, authorization_code: authCode }).eq('paystack_reference', req.params.reference);
    const { data: plan } = await supabaseAdmin.from('plans').select('id,name').eq('tier', meta.plan_tier).single();
    await supabaseAdmin.from('subscriptions').insert({ user_id: payment.user_id, business_id: meta.business_id||null, plan_id: plan.id, tier: meta.plan_tier, status:'active', amount_paid: payment.amount, billing_cycle: meta.billing_cycle, paystack_reference: req.params.reference, started_at: now.toISOString(), expires_at: exp.toISOString() });
    if (meta.business_id) await supabaseAdmin.from('businesses').update({ subscription_tier: meta.plan_tier, subscription_expires_at: exp.toISOString(), status:'pending' }).eq('id', meta.business_id);
    await notify(payment.user_id, 'success', '🎉 Payment Successful!', `Your ${plan.name} plan is now active.`, `/pages/dashboard.html`);
    const { data: u } = await supabaseAdmin.from('users').select('email,full_name').eq('id', payment.user_id).single();
    if (u?.email) {
      await sendEmail(u.email, `Receipt: ${plan.name} plan — GHS ${payment.amount}`,
        wrap('Payment received', `Hi ${u.full_name || 'there'}, your payment of <strong>GHS ${payment.amount}</strong> for the <strong>${plan.name}</strong> plan (${meta.billing_cycle}) was successful. Your plan is active until <strong>${exp.toDateString()}</strong>. It will not auto-renew — we'll remind you before it ends.`,
        'Go to Dashboard', `${env.APP_URL}/pages/dashboard.html`));
    }
    return res.redirect(`${process.env.APP_URL}/pages/dashboard.html?payment=success&plan=${meta.plan_tier}`);
  } catch (err) { return res.redirect(`${process.env.APP_URL}/pages/pricing.html?payment=error`); }
});

router.get('/history', verifyToken, async (req, res, next) => {
  try {
    const { data } = await supabaseAdmin.from('payments').select('*,plans(name,tier)').eq('user_id', req.user.id).order('created_at', { ascending:false }).limit(20);
    res.json({ payments: data });
  } catch (err) { next(err); }
});

router.post('/validate-promo', verifyToken, async (req, res, next) => {
  try {
    const { code, amount } = req.body;
    const { data: promo } = await supabaseAdmin.from('promo_codes').select('*').eq('code', code.toUpperCase()).eq('is_active',true).single();
    if (!promo) return res.status(404).json({ error: 'Invalid promo code' });
    if (promo.valid_until && new Date(promo.valid_until)<new Date()) return res.status(400).json({ error: 'Promo expired' });
    if (promo.max_uses && promo.used_count>=promo.max_uses) return res.status(400).json({ error: 'Usage limit reached' });
    const { data: used } = await supabaseAdmin.from('promo_code_uses').select('id').eq('promo_code_id',promo.id).eq('user_id',req.user.id).maybeSingle();
    if (used) return res.status(400).json({ error: 'Already used this code' });
    const discount = promo.type==='percent' ? (amount*promo.value)/100 : promo.value;
    res.json({ valid:true, promo:{ code:promo.code, type:promo.type, value:promo.value, description:promo.description }, discount, final_amount: Math.max(0,amount-discount) });
  } catch (err) { next(err); }
});

router.get('/saved-method', verifyToken, async (req, res, next) => {
  try {
    const { data } = await supabaseAdmin.from('payments').select('authorization_code,channel').eq('user_id', req.user.id).eq('status','paid').not('authorization_code','is',null).order('created_at',{ascending:false}).limit(1);
    res.json({ has_saved_method: !!data?.[0], channel: data?.[0]?.channel || null });
  } catch (err) { next(err); }
});

router.post('/renew', verifyToken, limits.payments, async (req, res, next) => {
  try {
    const { plan_tier, billing_cycle='monthly', business_id } = req.body;
    const { data: plan } = await supabaseAdmin.from('plans').select('*').eq('tier', plan_tier).single();
    if (!plan || plan.tier==='free') return res.status(400).json({ error: 'Invalid plan' });
    const { data: saved } = await supabaseAdmin.from('payments').select('authorization_code').eq('user_id', req.user.id).eq('status','paid').not('authorization_code','is',null).order('created_at',{ascending:false}).limit(1);
    const authCode = saved?.[0]?.authorization_code;
    if (!authCode) return res.status(400).json({ error: 'No saved payment method on file. Please pay with card or mobile money once to enable one-click renewal.', code: 'NO_SAVED_METHOD' });

    const amount = await resolvePlanPrice(plan, billing_cycle, business_id);
    const reference = `CLGH-${uuidv4().replace(/-/g,'').slice(0,16).toUpperCase()}`;
    await supabaseAdmin.from('payments').insert({ user_id: req.user.id, business_id: business_id||null, plan_id: plan.id, amount, currency:'GHS', status:'pending', paystack_reference: reference, description:`SpotGH ${plan.name} renewal - ${billing_cycle}`, metadata:{ plan_tier, billing_cycle, renewal:true } });

    const chargeRes = await axios.post('https://api.paystack.co/transaction/charge_authorization',
      { authorization_code: authCode, email: req.user.email, amount: Math.round(amount*100), currency:'GHS', reference },
      { headers: psH });
    const txn = chargeRes.data.data;
    if (txn.status !== 'success') {
      await supabaseAdmin.from('payments').update({ status:'failed', failure_reason: txn.gateway_response||'Charge failed' }).eq('paystack_reference', reference);
      return res.status(400).json({ error: txn.gateway_response || 'Renewal charge failed. Try paying manually instead.' });
    }

    const now = new Date(); const exp = new Date(now);
    billing_cycle==='yearly' ? exp.setFullYear(exp.getFullYear()+1) : exp.setMonth(exp.getMonth()+1);
    await supabaseAdmin.from('payments').update({ status:'paid', paid_at: now.toISOString(), paystack_transaction_id: String(txn.id), channel: txn.channel, authorization_code: authCode }).eq('paystack_reference', reference);
    await supabaseAdmin.from('subscriptions').insert({ user_id: req.user.id, business_id: business_id||null, plan_id: plan.id, tier: plan_tier, status:'active', amount_paid: amount, billing_cycle, paystack_reference: reference, started_at: now.toISOString(), expires_at: exp.toISOString() });
    if (business_id) await supabaseAdmin.from('businesses').update({ subscription_tier: plan_tier, subscription_expires_at: exp.toISOString(), status:'pending' }).eq('id', business_id);
    await notify(req.user.id, 'success', '🎉 Plan Renewed!', `Your ${plan.name} plan is active until ${exp.toDateString()}.`, '/pages/dashboard.html');
    res.json({ message: 'Renewed successfully', expires_at: exp.toISOString() });
  } catch (err) {
    if (err.response?.data) return res.status(400).json({ error: err.response.data.message || 'Renewal failed' });
    next(err);
  }
});

module.exports = router;