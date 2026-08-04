// backend/routes/creator.routes.js
const router = require('express').Router();
const { supabaseAdmin } = require('../config/supabase');
const { verifyToken, requireAdmin, requireCreator, requireOwnership, optionalAuth } = require('../middleware/auth.middleware');
const { paginate, notify, audit, sanitizeSearchTerm } = require('../services/supabase.service');
const limits = require('../middleware/rateLimit.middleware');
router.use(verifyToken, requireCreator);
router.get('/dashboard', async (req, res, next) => {
  try {
    const [u,b,p,paymentsRes,subsRes] = await Promise.all([
      supabaseAdmin.from('users').select('id',{count:'exact'}),
      supabaseAdmin.from('businesses').select('id',{count:'exact'}).eq('status','active'),
      supabaseAdmin.from('businesses').select('id',{count:'exact'}).eq('status','pending'),
      supabaseAdmin.from('payments').select('amount').eq('status','paid'),
      supabaseAdmin.from('subscriptions').select('tier,plans(price_monthly)').eq('status','active'),
    ]);
    const totalRevenue = (paymentsRes.data||[]).reduce((s,p)=>s+parseFloat(p.amount),0);
    const mrr = (subsRes.data||[]).reduce((s,s2)=>s+parseFloat(s2.plans?.price_monthly||0),0);
    const tierBreakdown = {free:0,starter:0,pro:0,enterprise:0};
    (subsRes.data||[]).forEach(s=>{if(tierBreakdown[s.tier]!==undefined)tierBreakdown[s.tier]++;});
    const {data:recentPayments}=await supabaseAdmin.from('payments').select('*,users(full_name,email),plans(name,tier)').eq('status','paid').order('paid_at',{ascending:false}).limit(10);
    const {data:recentSignups}=await supabaseAdmin.from('users').select('id,full_name,email,role,created_at').order('created_at',{ascending:false}).limit(8);
    const {data:revenueHistory}=await supabaseAdmin.from('revenue_stats').select('*').limit(12);
    res.json({ stats:{total_users:u.count||0,active_businesses:b.count||0,pending_businesses:p.count||0,total_revenue:totalRevenue,mrr,active_subscriptions:subsRes.data?.length||0,tier_breakdown:tierBreakdown}, revenue_history:revenueHistory||[], recent_payments:recentPayments||[], recent_signups:recentSignups||[] });
  } catch (err) { next(err); }
});
router.get('/businesses', async (req, res, next) => {
  try {
    const {status,tier,search,page,limit}=req.query; const {from,to,page:pg,limit:lm}=paginate(page,limit);
    let q=supabaseAdmin.from('businesses_admin_view').select('*',{count:'exact'});
    if(status)q=q.eq('status',status); if(tier)q=q.eq('subscription_tier',tier);
    if(search){const s=sanitizeSearchTerm(search);q=q.or(`name.ilike.%${s}%,owner_email.ilike.%${s}%`);}
    const {data,count}=await q.order('created_at',{ascending:false}).range(from,to);
    res.json({businesses:data,pagination:{total:count,page:pg,limit:lm}});
  } catch (err) { next(err); }
});
router.patch('/businesses/:id', async (req, res, next) => {
  try {
    const allowed=['status','is_featured','is_verified','subscription_tier','subscription_expires_at','admin_notes','rejection_reason'];
    const updates={}; allowed.forEach(k=>{if(req.body[k]!==undefined)updates[k]=req.body[k];});
    if(updates.status==='active')updates.published_at=new Date().toISOString();
    const {data,error}=await supabaseAdmin.from('businesses').update(updates).eq('id',req.params.id).select().single();
    if(error)throw error;
    await audit(req.user.id,'business_updated','business',req.params.id,null,updates,req);
    res.json({business:data});
  } catch (err) { next(err); }
});
router.post('/businesses/:id/grant-subscription', async (req, res, next) => {
  try {
    const {tier,months=1,reason='Manual grant'}=req.body;
    const exp=new Date(); exp.setMonth(exp.getMonth()+parseInt(months));
    const {data:biz}=await supabaseAdmin.from('businesses').select('owner_id').eq('id',req.params.id).single();
    const {data:plan}=await supabaseAdmin.from('plans').select('id').eq('tier',tier).single();
    await supabaseAdmin.from('subscriptions').insert({business_id:req.params.id,user_id:biz.owner_id,plan_id:plan.id,tier,status:'active',amount_paid:0,billing_cycle:'manual',started_at:new Date().toISOString(),expires_at:exp.toISOString(),metadata:{granted_by:req.user.id,reason}});
    await supabaseAdmin.from('businesses').update({subscription_tier:tier,subscription_expires_at:exp.toISOString()}).eq('id',req.params.id);
    await audit(req.user.id,'subscription_granted','business',req.params.id,null,{tier,months},req);
    res.json({message:`${tier} subscription granted for ${months} month(s)`});
  } catch (err) { next(err); }
});
router.get('/users', async (req, res, next) => {
  try {
    const {role,search,page,limit}=req.query; const {from,to,page:pg,limit:lm}=paginate(page,limit);
    let q=supabaseAdmin.from('users').select('*',{count:'exact'});
    if(role)q=q.eq('role',role); if(search){const s=sanitizeSearchTerm(search);q=q.or(`full_name.ilike.%${s}%,email.ilike.%${s}%`);}
    const {data,count}=await q.order('created_at',{ascending:false}).range(from,to);
    res.json({users:data,pagination:{total:count,page:pg,limit:lm}});
  } catch (err) { next(err); }
});
router.patch('/users/:id', async (req, res, next) => {
  try {
    const {role,is_active,is_banned,ban_reason}=req.body; const updates={};
    if(role)updates.role=role; if(is_active!==undefined)updates.is_active=is_active;
    if(is_banned!==undefined){updates.is_banned=is_banned;if(ban_reason)updates.ban_reason=ban_reason;}
    const {data,error}=await supabaseAdmin.from('users').update(updates).eq('id',req.params.id).select().single();
    if(error)throw error;
    await audit(req.user.id,'user_updated','user',req.params.id,null,updates,req);
    res.json({user:data});
  } catch (err) { next(err); }
});
router.get('/payments', async (req, res, next) => {
  try {
    const {status,page,limit}=req.query; const {from,to,page:pg,limit:lm}=paginate(page,limit);
    let q=supabaseAdmin.from('payments').select('*,users(full_name,email),plans(name,tier)',{count:'exact'});
    if(status)q=q.eq('status',status);
    const {data,count}=await q.order('created_at',{ascending:false}).range(from,to);
    res.json({payments:data,pagination:{total:count,page:pg,limit:lm}});
  } catch (err) { next(err); }
});
router.get('/settings', async (req, res, next) => {
  try {
    const {data}=await supabaseAdmin.from('platform_settings').select('*');
    const settings={}; (data||[]).forEach(s=>settings[s.key]=s.value);
    res.json({settings});
  } catch (err) { next(err); }
});
router.patch('/settings', async (req, res, next) => {
  try {
    const {settings}=req.body;
    for(const [key,value] of Object.entries(settings)){
      await supabaseAdmin.from('platform_settings').upsert({key,value,updated_by:req.user.id,updated_at:new Date().toISOString()},{onConflict:'key'});
    }
    await audit(req.user.id,'settings_updated','platform_settings',null,null,settings,req);
    res.json({message:'Settings updated'});
  } catch (err) { next(err); }
});
router.get('/plans', async (req, res, next) => {
  try {
    const {data}=await supabaseAdmin.from('plans').select('*').order('sort_order');
    res.json({plans:data});
  } catch (err) { next(err); }
});
router.patch('/plans/:id', async (req, res, next) => {
  try {
    const allowed=['name','tagline','price_monthly','price_yearly','price_monthly_own_website','price_yearly_own_website','color','is_popular','is_active','max_businesses','max_products','max_gallery_photos','has_whatsapp_button','has_website','has_analytics','has_advanced_analytics','has_bookings','has_custom_template','has_verified_badge','has_priority_listing','has_franchise','has_custom_domain','has_ai_content','has_seo_tools','features_list','support_level'];
    const updates={}; allowed.forEach(k=>{if(req.body[k]!==undefined)updates[k]=req.body[k];});
    const {data,error}=await supabaseAdmin.from('plans').update(updates).eq('id',req.params.id).select().single();
    if(error)throw error;
    require('../services/cache.service').invalidate('plans:active');
    await audit(req.user.id,'plan_updated','plan',req.params.id,null,updates,req);
    res.json({plan:data});
  } catch (err) { next(err); }
});
// ── v2: independent Directory / Website / Bundle plan editors ──
router.get('/directory-plans', async (req, res, next) => {
  try {
    const { data } = await supabaseAdmin.from('directory_plans').select('*').order('sort_order');
    res.json({ plans: data });
  } catch (err) { next(err); }
});
router.patch('/directory-plans/:id', async (req, res, next) => {
  try {
    const allowed = ['name','tagline','price_monthly','price_yearly','color','is_popular','is_active','max_businesses','max_photos','has_social_links','has_whatsapp_button','has_business_hours','has_verified_badge','has_better_ranking','has_analytics','has_advanced_analytics','has_featured_offers','has_homepage_featured','has_priority_listing','has_video','has_flash_deals','has_priority_support','has_franchise','has_qr_code','features_list','sort_order'];
    const updates = {}; allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    const { data, error } = await supabaseAdmin.from('directory_plans').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    require('../services/cache.service').invalidate('directory_plans:active');
    await audit(req.user.id, 'directory_plan_updated', 'directory_plan', req.params.id, null, updates, req);
    res.json({ plan: data });
  } catch (err) { next(err); }
});
router.get('/website-plans', async (req, res, next) => {
  try {
    const { data } = await supabaseAdmin.from('website_plans').select('*').order('sort_order');
    res.json({ plans: data });
  } catch (err) { next(err); }
});
router.patch('/website-plans/:id', async (req, res, next) => {
  try {
    const allowed = ['name','tagline','price_monthly','price_yearly','color','is_popular','is_active','free_trial_days','has_custom_template','has_custom_domain','has_bookings','has_blog','has_testimonials','has_seo_tools','has_analytics','has_multi_page','has_forms','has_google_indexing','has_online_payments','has_product_catalog','has_appointment_scheduling','has_staff_management','has_customer_dashboard','has_email_notifications','has_sms_notifications','has_ai_content','has_priority_support','has_api_access','max_products','max_gallery_photos','max_ai_generations_per_month','features_list','sort_order'];
    const updates = {}; allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    const { data, error } = await supabaseAdmin.from('website_plans').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    require('../services/cache.service').invalidate('website_plans:active');
    await audit(req.user.id, 'website_plan_updated', 'website_plan', req.params.id, null, updates, req);
    res.json({ plan: data });
  } catch (err) { next(err); }
});
router.get('/bundles', async (req, res, next) => {
  try {
    const { data } = await supabaseAdmin.from('bundles').select('*,directory_plans(name,tier),website_plans(name,tier)').order('sort_order');
    res.json({ bundles: data });
  } catch (err) { next(err); }
});
router.patch('/bundles/:id', async (req, res, next) => {
  try {
    const allowed = ['name','tagline','discount_percent','is_popular','is_active','sort_order'];
    const updates = {}; allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    const { data, error } = await supabaseAdmin.from('bundles').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    require('../services/cache.service').invalidate('bundles:active');
    res.json({ bundle: data });
  } catch (err) { next(err); }
});

router.get('/promo-codes', async (req, res, next) => {
  try {
    const {data}=await supabaseAdmin.from('promo_codes').select('*').order('created_at',{ascending:false});
    res.json({promo_codes:data});
  } catch (err) { next(err); }
});
router.post('/promo-codes', async (req, res, next) => {
  try {
    const {code,description,type,value,max_uses,valid_until}=req.body;
    const {data,error}=await supabaseAdmin.from('promo_codes').insert({code:code.toUpperCase().trim(),description,type,value:parseFloat(value),max_uses:max_uses||null,valid_until:valid_until||null,created_by:req.user.id}).select().single();
    if(error)throw error;
    await audit(req.user.id,'promo_created','promo_code',data.id,null,{code:data.code},req);
    res.status(201).json({promo_code:data});
  } catch (err) { next(err); }
});
router.patch('/promo-codes/:id', async (req, res, next) => {
  try {
    const {is_active}=req.body;
    const {data,error}=await supabaseAdmin.from('promo_codes').update({is_active}).eq('id',req.params.id).select().single();
    if(error)throw error; res.json({promo_code:data});
  } catch (err) { next(err); }
});
router.get('/audit-logs', async (req, res, next) => {
  try {
    const {page,limit}=req.query; const {from,to,page:pg,limit:lm}=paginate(page,limit);
    const {data,count}=await supabaseAdmin.from('audit_logs').select('*,users:actor_id(full_name,email)',{count:'exact'}).order('created_at',{ascending:false}).range(from,to);
    res.json({logs:data,pagination:{total:count,page:pg,limit:lm}});
  } catch (err) { next(err); }
});
router.get('/export/businesses', async (req, res, next) => {
  try {
    const { data } = await supabaseAdmin.from('businesses_admin_view').select('name,owner_email,city,category_name,status,subscription_tier,view_count,avg_rating,review_count,created_at').order('created_at', { ascending: false });
    const header = 'Name,Owner Email,City,Category,Status,Tier,Views,Avg Rating,Reviews,Created\n';
    const rows = (data || []).map(b =>
      [b.name, b.owner_email, b.city, b.category_name, b.status, b.subscription_tier,
       b.view_count, b.avg_rating, b.review_count, b.created_at].map(v => `"${(v||'').toString().replace(/"/g,'""')}"`).join(',')
    ).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="businesses.csv"');
    res.send(header + rows);
  } catch (err) { next(err); }
});

router.get('/export/users', async (req, res, next) => {
  try {
    const { data } = await supabaseAdmin.from('users').select('full_name,email,role,is_active,is_banned,created_at').order('created_at', { ascending: false });
    const header = 'Name,Email,Role,Active,Banned,Joined\n';
    const rows = (data || []).map(u =>
      [u.full_name, u.email, u.role, u.is_active, u.is_banned, u.created_at].map(v => `"${(v||'').toString().replace(/"/g,'""')}"`).join(',')
    ).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="users.csv"');
    res.send(header + rows);
  } catch (err) { next(err); }
});

// Build a mini-website for a business owner without payment flow
router.post('/build-website', async (req, res, next) => {
  try {
    const { owner_email, owner_name, business_name, tagline, description, phone, whatsapp,
            city, region, category_id, template_key, theme_color, amenities, operating_hours,
            social_links, tier = 'starter', months = 1, notes = '' } = req.body;
    if (!owner_email || !business_name || !category_id)
      return res.status(400).json({ error: 'owner_email, business_name, and category_id are required' });

    // Find or create the owner user account
    let { data: owner } = await supabaseAdmin.from('users').select('id,full_name,email').eq('email', owner_email.toLowerCase().trim()).maybeSingle();
    if (!owner) {
      const tempPassword = Math.random().toString(36).slice(-10);
      const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email: owner_email.toLowerCase().trim(), password: tempPassword, email_confirm: true,
        user_metadata: { full_name: owner_name || owner_email.split('@')[0] },
      });
      if (authErr) throw authErr;
      const { data: newUser } = await supabaseAdmin.from('users').insert({
        id: authUser.user.id, email: owner_email.toLowerCase().trim(),
        full_name: owner_name || owner_email.split('@')[0], role: 'user',
      }).select().single();
      owner = newUser;
    }

    // Create the business
    const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const baseSlug = slugify(business_name);
    const slug = `${baseSlug}-${Date.now()}`;
    const { data: business, error: bizErr } = await supabaseAdmin.from('businesses').insert({
      owner_id: owner.id, name: business_name, slug, tagline: tagline || null,
      description: description || null, phone: phone || null, whatsapp: whatsapp || null,
      city: city || null, region: region || null, country: 'GH',
      category_id, template_key: template_key || 'default', theme_color: theme_color || '#4E0DAD',
      amenities: amenities || null, operating_hours: operating_hours || null,
      social_links: social_links || {},
      status: 'active', published_at: new Date().toISOString(),
      subscription_tier: tier,
    }).select().single();
    if (bizErr) throw bizErr;

    // Grant subscription without payment
    const { data: plan } = await supabaseAdmin.from('plans').select('id').eq('tier', tier).maybeSingle();
    if (plan) {
      const exp = new Date(); exp.setMonth(exp.getMonth() + parseInt(months));
      await supabaseAdmin.from('subscriptions').insert({
        business_id: business.id, user_id: owner.id, plan_id: plan.id, tier,
        status: 'active', amount_paid: 0, billing_cycle: 'manual',
        started_at: new Date().toISOString(), expires_at: exp.toISOString(),
        metadata: { granted_by: req.user.id, reason: notes || 'Built by creator', no_payment: true },
      });
      await supabaseAdmin.from('businesses').update({ subscription_tier: tier, subscription_expires_at: exp.toISOString() }).eq('id', business.id);
    }

    await notify(owner.id, 'success', `🎉 Your business "${business_name}" is live!`,
      `Your SpotGH mini-website has been set up and is ready to share.`, `/business?slug=${slug}`);
    await audit(req.user.id, 'website_built', 'business', business.id, null, { owner_email, tier, months }, req);

    res.status(201).json({ business, owner: { id: owner.id, email: owner.email, full_name: owner.full_name }, message: `Mini-website built and ${tier} plan granted for ${months} month(s)` });
  } catch (err) { next(err); }
});

module.exports = router;
