-- ============================================================
-- Migration 019: API access -> Business Pro Website plan
--
-- The old bundled system only granted API access on Enterprise (the top
-- tier). Enterprise's website-side equivalent in the new split system is
-- Business Pro, so that's where this lands: API keys read a business's
-- own listing + website data, which is a developer/integration feature
-- that pairs naturally with the rest of Business Pro (staff management,
-- customer dashboard, online payments).
-- ============================================================

ALTER TABLE public.website_plans ADD COLUMN IF NOT EXISTS has_api_access BOOLEAN DEFAULT FALSE;

UPDATE public.website_plans SET has_api_access = true WHERE tier = 'business_pro';
UPDATE public.website_plans SET has_api_access = false WHERE tier IN ('starter','professional');
