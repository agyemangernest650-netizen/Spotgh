-- ============================================================
-- Migration: AI usage quotas per plan
-- Run this in the Supabase SQL editor on your existing database.
-- ============================================================
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS max_ai_generations_per_month INTEGER DEFAULT 0;

UPDATE public.plans SET max_ai_generations_per_month = 0   WHERE tier IN ('free','starter');
UPDATE public.plans SET max_ai_generations_per_month = 20  WHERE tier = 'pro';
UPDATE public.plans SET max_ai_generations_per_month = 999 WHERE tier = 'enterprise';

CREATE TABLE IF NOT EXISTS public.ai_usage_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  feature TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_business_month ON public.ai_usage_log(business_id, created_at);
ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;
