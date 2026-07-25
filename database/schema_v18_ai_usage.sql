-- ============================================================
-- SpotGH v18 — AI usage quotas
-- Run AFTER schema_v17_growth.sql
--
-- Adds a real monthly cap behind has_ai_content, instead of only the
-- 10-req/min rate limiter in rateLimit.middleware.js (which stops bursts/
-- abuse but not a business quietly running thousands of generations a
-- month on the same plan). 999 follows the existing "unlimited" convention
-- used by max_products / max_gallery_photos / max_bookings_per_month.
-- ============================================================
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS max_ai_generations_per_month INTEGER DEFAULT 0;
UPDATE public.plans SET max_ai_generations_per_month = 0   WHERE tier IN ('free','starter');
UPDATE public.plans SET max_ai_generations_per_month = 50  WHERE tier = 'pro';
UPDATE public.plans SET max_ai_generations_per_month = 999 WHERE tier = 'enterprise';

-- One row per generation call, so usage can be counted per business per
-- calendar month and broken down by which tool is getting used.
CREATE TABLE IF NOT EXISTS public.ai_usage_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  feature TEXT NOT NULL, -- description | seo_meta | marketing_post | review_reply | product_description | event_announcement | social_caption
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_business_month ON public.ai_usage_log(business_id, created_at);

ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;
