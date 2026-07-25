-- ============================================================
-- Migration: Two-track pricing + "growth journey" plan renaming
-- Run this in the Supabase SQL editor on your existing database.
-- Safe to run even if already applied.
-- ============================================================

-- Two prices per paid tier: the existing price_monthly/price_yearly stay
-- as the price for a business that needs SpotGH to build & host its
-- mini-website. New *_own_website columns are a discounted price for a
-- business that already has its own website and just wants the directory
-- listing + plan perks (AI tools, analytics, etc.) — no mini-website to
-- build. ~25-30% off, rounded to clean cedi amounts. Adjust these if you
-- want a different discount.
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS price_monthly_own_website NUMERIC;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS price_yearly_own_website  NUMERIC;

UPDATE public.plans SET price_monthly_own_website = 0,  price_yearly_own_website = 0   WHERE tier = 'free';
UPDATE public.plans SET price_monthly_own_website = 15, price_yearly_own_website = 144 WHERE tier = 'starter';   -- Standard: 20 -> 15
UPDATE public.plans SET price_monthly_own_website = 35, price_yearly_own_website = 336 WHERE tier = 'pro';       -- Premium: 50 -> 35
UPDATE public.plans SET price_monthly_own_website = 70, price_yearly_own_website = 672 WHERE tier = 'enterprise'; -- Enterprise: 100 -> 70

-- "Growth journey" naming — each tier gets a name that tells the story of
-- where a business is headed, not just a price tier label. The tier key
-- itself stays as-is (free/starter/pro/enterprise) for the same reason as
-- before: renaming it would touch every tier check across the codebase.
UPDATE public.plans SET name = 'Free',       tagline = 'Get Found',                        is_popular = false WHERE tier = 'free';
UPDATE public.plans SET name = 'Standard',   tagline = 'Grow Your Business',                is_popular = true  WHERE tier = 'starter';
UPDATE public.plans SET name = 'Premium',    tagline = 'Become a Market Leader',            is_popular = false WHERE tier = 'pro';
UPDATE public.plans SET name = 'Enterprise', tagline = 'Scale Across Multiple Locations',   is_popular = false WHERE tier = 'enterprise';
