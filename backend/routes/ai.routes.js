// backend/routes/ai.routes.js
const router = require('express').Router();
const { supabaseAdmin } = require('../config/supabase');
const { verifyToken, requireAdmin, requireCreator, requireOwnership, optionalAuth } = require('../middleware/auth.middleware');
const { paginate, notify, audit } = require('../services/supabase.service');
const env = require('../config/env');
const limits = require('../middleware/rateLimit.middleware');
router.use(verifyToken, limits.ai);

// Shared gate: these are paid-plan-only tools (AI content on Pro+, SEO
// tools on Pro+ per the pricing page). Without this, any logged-in user
// on any tier — including Free — could call them for free.
async function requireFeature(featureFlag, req, res) {
  const { business_id } = req.body;
  if (!business_id) { res.status(400).json({ error: 'business_id required' }); return null; }
  const { data: biz } = await supabaseAdmin.from('businesses').select('id,owner_id,subscription_tier').eq('id', business_id).single();
  if (!biz) { res.status(404).json({ error: 'Business not found' }); return null; }
  if (biz.owner_id !== req.user.id && req.user.role !== 'creator') { res.status(403).json({ error: 'Not your business' }); return null; }
  const { data: plan } = await supabaseAdmin.from('plans').select(`${featureFlag},max_ai_generations_per_month`).eq('tier', biz.subscription_tier).single();
  if (!plan?.[featureFlag]) { res.status(403).json({ error: 'This feature isn\'t included in your current plan.', code: 'FEATURE_NOT_INCLUDED', redirect: '/pricing' }); return null; }

  // Each AI call costs real money — even on a plan that includes the
  // feature, cap actual usage per month rather than leaving it unbounded.
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
  const { count } = await supabaseAdmin.from('ai_usage_log').select('id', { count: 'exact' })
    .eq('business_id', business_id).gte('created_at', monthStart.toISOString());
  const limit = plan.max_ai_generations_per_month;
  if (limit !== 999 && count >= limit) {
    res.status(403).json({ error: `You've used all ${limit} AI generations included in your plan this month. Upgrade for more.`, code: 'AI_QUOTA_REACHED', redirect: '/pricing' });
    return null;
  }
  return biz;
}

// Records a completed generation against the monthly quota. Called only
// after the AI call actually succeeds — a failed/errored call shouldn't
// cost the business part of its allowance.
const logAiUsage = (businessId, userId, feature) =>
  supabaseAdmin.from('ai_usage_log').insert({ business_id: businessId, user_id: userId, feature }).then(() => {}, () => {});

router.post('/generate-description', async (req, res, next) => {
  try {
    const { business_name, category, city } = req.body;
    if (!business_name) return res.status(400).json({ error: 'business_name required' });
    if (!(await requireFeature('has_ai_content', req, res))) return;
    if (!env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'AI service not configured' });
    const prompt = `Write a compelling 150-200 word business description for:\nBusiness: ${business_name}\nCategory: ${category||'General'}\nLocation: ${city||'Ghana'}\nBe warm, professional, and Ghana-focused. Output only the description.`;
    const resp = await fetch('https://api.anthropic.com/v1/messages', { method:'POST', headers:{'Content-Type':'application/json','x-api-key':env.ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01'}, body: JSON.stringify({ model:'claude-haiku-4-5-20251001', max_tokens:400, messages:[{role:'user',content:prompt}] }) });
    if (!resp.ok) throw new Error('AI unavailable');
    const d = await resp.json();
    logAiUsage(req.body.business_id, req.user.id, 'generate-description');
    res.json({ description: d.content?.[0]?.text || '' });
  } catch (err) { next(err); }
});
router.post('/generate-meta', async (req, res, next) => {
  try {
    const { business_name, category, city, description } = req.body;
    if (!business_name) return res.status(400).json({ error: 'business_name required' });
    if (!(await requireFeature('has_seo_tools', req, res))) return;
    if (!env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'AI service not configured' });
    const prompt = `Generate JSON with meta_title (max 60 chars) and meta_description (max 155 chars) for: ${business_name}, ${category||''}, ${city||'Ghana'}. Respond ONLY with valid JSON.`;
    const resp = await fetch('https://api.anthropic.com/v1/messages', { method:'POST', headers:{'Content-Type':'application/json','x-api-key':env.ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01'}, body: JSON.stringify({ model:'claude-haiku-4-5-20251001', max_tokens:200, messages:[{role:'user',content:prompt}] }) });
    if (!resp.ok) throw new Error('AI unavailable');
    const d = await resp.json();
    const text = d.content?.[0]?.text?.replace(/```json|```/g,'').trim() || '{}';
    logAiUsage(req.body.business_id, req.user.id, 'generate-meta');
    res.json(JSON.parse(text));
  } catch (err) { next(err); }
});
module.exports = router;
