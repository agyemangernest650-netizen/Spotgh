-- ============================================================
-- Migration: Feature matrix update
-- Reshapes what each plan tier includes:
--   Free:       Business Listing only
--   Starter:    + Website, AI Tools, Analytics
--   Pro:        + Featured Listing, Booking, Franchise, Custom Domain
--   Enterprise: + API Access
-- Free tier also goes from 0 -> 1 business slot, since it now gets a
-- basic listing (no mini-website/template) for free rather than
-- nothing at all.
-- Run this in the Supabase SQL editor on your existing database.
-- Safe to run even if already applied.
-- ============================================================

ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS has_website  BOOLEAN DEFAULT FALSE;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS has_franchise BOOLEAN DEFAULT FALSE;

-- Free: listing only, everything else off
UPDATE public.plans SET
  max_businesses = 1,
  has_website = false, has_ai_content = false, has_seo_tools = false,
  has_analytics = false, has_advanced_analytics = false,
  has_priority_listing = false, has_bookings = false,
  has_franchise = false, has_custom_domain = false, has_api_access = false
WHERE tier = 'free';

-- Starter: + website, AI tools, analytics
UPDATE public.plans SET
  has_website = true, has_ai_content = true, has_seo_tools = true,
  has_analytics = true, has_advanced_analytics = false,
  has_priority_listing = false, has_bookings = false,
  has_franchise = false, has_custom_domain = false, has_api_access = false
WHERE tier = 'starter';

-- Pro: + featured listing, booking, franchise, custom domain
UPDATE public.plans SET
  has_website = true, has_ai_content = true, has_seo_tools = true,
  has_analytics = true, has_advanced_analytics = true,
  has_priority_listing = true, has_bookings = true,
  has_franchise = true, has_custom_domain = true, has_api_access = false
WHERE tier = 'pro';

-- Enterprise: everything, including API access
UPDATE public.plans SET
  has_website = true, has_ai_content = true, has_seo_tools = true,
  has_analytics = true, has_advanced_analytics = true,
  has_priority_listing = true, has_bookings = true,
  has_franchise = true, has_custom_domain = true, has_api_access = true
WHERE tier = 'enterprise';

UPDATE public.plans SET features_list =
  '["Browse directory","Save businesses","Write reviews","1 basic business listing (no mini-website)"]'
WHERE tier = 'free';

UPDATE public.plans SET features_list =
  '["1 business mini-website","WhatsApp contact button","25 products/services","25 gallery photos","Online ordering","AI content tools","Analytics","Email support","Valid for 1 month — no auto-renewal","Renew or upgrade anytime after"]'
WHERE tier = 'starter';

UPDATE public.plans SET features_list =
  '["3 business mini-websites","60 products/services","60 gallery photos","Online ordering","Advanced analytics","Online bookings","Custom template","Verified badge","Featured/priority listing","Franchise grouping across locations","Custom domain","AI content tools (20/month)","SEO tools","Priority support"]'
WHERE tier = 'pro';

UPDATE public.plans SET features_list =
  '["Unlimited businesses","Unlimited everything","Online ordering","Custom domain","White-label option","API access","Unlimited AI content","Franchise grouping","Dedicated account manager","Phone support"]'
WHERE tier = 'enterprise';
