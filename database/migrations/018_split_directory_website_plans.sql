-- ============================================================
-- Migration 018: Split Directory Listing and Mini-Website into
-- two independent subscription products, plus Bundle plans.
--
-- WHY: Previously `plans` bundled directory + website features into one
-- tier a business had to buy as a whole (Free/Standard/Premium/Enterprise).
-- A business that just wants a listing had no way to avoid paying for
-- website features, and vice versa. This migration is purely additive —
-- the old `plans`/`subscriptions` tables and `businesses.subscription_tier`
-- are left in place and untouched (nothing currently reading them breaks),
-- but new code should read from the tables below instead. See CHANGELOG
-- v23 for exactly which parts of the codebase were rewired to the new
-- tables and which were intentionally left on the old ones for now.
--
-- Run this in the Supabase SQL editor after migration 017.
-- Safe to run even if already applied (uses IF NOT EXISTS throughout).
-- ============================================================

-- ------------------------------------------------------------
-- 1. DIRECTORY PLANS (Free / Standard / Premium)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.directory_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tier TEXT UNIQUE NOT NULL CHECK (tier IN ('free','standard','premium')),
  name TEXT NOT NULL,
  tagline TEXT,
  price_monthly NUMERIC NOT NULL DEFAULT 0,
  price_yearly NUMERIC NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'GHS',
  color TEXT DEFAULT '#4E0DAD',
  is_popular BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  -- limits
  max_businesses INTEGER DEFAULT 1,
  max_photos INTEGER DEFAULT 1,
  -- feature flags (directory-side only)
  has_social_links BOOLEAN DEFAULT FALSE,
  has_whatsapp_button BOOLEAN DEFAULT FALSE,
  has_business_hours BOOLEAN DEFAULT FALSE,
  has_verified_badge BOOLEAN DEFAULT FALSE,
  has_better_ranking BOOLEAN DEFAULT FALSE,
  has_analytics BOOLEAN DEFAULT FALSE,
  has_advanced_analytics BOOLEAN DEFAULT FALSE,
  has_featured_offers BOOLEAN DEFAULT FALSE,
  has_homepage_featured BOOLEAN DEFAULT FALSE,
  has_priority_listing BOOLEAN DEFAULT FALSE, -- sponsored search placement
  has_video BOOLEAN DEFAULT FALSE,
  has_flash_deals BOOLEAN DEFAULT FALSE,
  has_priority_support BOOLEAN DEFAULT FALSE,
  has_franchise BOOLEAN DEFAULT FALSE, -- multiple branches
  has_qr_code BOOLEAN DEFAULT FALSE,
  features_list JSONB DEFAULT '[]',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.directory_plans (tier,name,tagline,price_monthly,price_yearly,is_popular,sort_order,
  max_businesses,max_photos,has_social_links,has_whatsapp_button,has_business_hours,has_verified_badge,
  has_better_ranking,has_analytics,has_advanced_analytics,has_featured_offers,has_homepage_featured,
  has_priority_listing,has_video,has_flash_deals,has_priority_support,has_franchise,has_qr_code,features_list)
VALUES
('free','Free Listing','Perfect for new businesses',0,0,false,0,
  1,1,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,
  '["Business name, category, address, phone","1 photo","Basic description","Google Maps location","Reviews","Appears in search"]'),
('standard','Standard','Suitable for small businesses',20,192,true,1,
  3,10,true,true,true,true,true,true,false,true,false,false,false,false,false,false,false,
  '["Everything in Free","Up to 10 photos","Social media links","WhatsApp button","Business hours","Verified badge","Better search ranking","Business analytics","Featured offers"]'),
('premium','Premium','For businesses wanting maximum exposure',50,480,false,2,
  10,999,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,
  '["Everything in Standard","Homepage featured listing","Sponsored search placement","Unlimited photos","Video","Flash Deals","Priority support","Advanced analytics","Multiple branches","Custom business QR code"]')
ON CONFLICT (tier) DO NOTHING;

-- ------------------------------------------------------------
-- 2. WEBSITE PLANS (Starter / Professional / Business Pro)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.website_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tier TEXT UNIQUE NOT NULL CHECK (tier IN ('starter','professional','business_pro')),
  name TEXT NOT NULL,
  tagline TEXT,
  price_monthly NUMERIC NOT NULL DEFAULT 0,
  price_yearly NUMERIC NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'GHS',
  color TEXT DEFAULT '#4E0DAD',
  is_popular BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  free_trial_days INTEGER DEFAULT 0, -- Starter: first month free, once per account
  -- feature flags (website-side only)
  has_custom_template BOOLEAN DEFAULT FALSE, -- unlocks theme_color/accent_color/custom_css
  has_custom_domain BOOLEAN DEFAULT FALSE,
  has_bookings BOOLEAN DEFAULT FALSE,
  has_blog BOOLEAN DEFAULT FALSE,
  has_testimonials BOOLEAN DEFAULT FALSE,
  has_seo_tools BOOLEAN DEFAULT FALSE,
  has_analytics BOOLEAN DEFAULT FALSE,
  has_multi_page BOOLEAN DEFAULT FALSE,
  has_forms BOOLEAN DEFAULT FALSE,
  has_google_indexing BOOLEAN DEFAULT FALSE,
  has_online_payments BOOLEAN DEFAULT FALSE,
  has_product_catalog BOOLEAN DEFAULT FALSE,
  has_appointment_scheduling BOOLEAN DEFAULT FALSE,
  has_staff_management BOOLEAN DEFAULT FALSE,
  has_customer_dashboard BOOLEAN DEFAULT FALSE,
  has_email_notifications BOOLEAN DEFAULT FALSE,
  has_sms_notifications BOOLEAN DEFAULT FALSE,
  has_ai_content BOOLEAN DEFAULT FALSE,
  has_priority_support BOOLEAN DEFAULT FALSE,
  max_products INTEGER DEFAULT 25,
  max_gallery_photos INTEGER DEFAULT 25,
  max_ai_generations_per_month INTEGER DEFAULT 0,
  features_list JSONB DEFAULT '[]',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.website_plans (tier,name,tagline,price_monthly,price_yearly,is_popular,sort_order,free_trial_days,
  has_custom_template,has_custom_domain,has_bookings,has_blog,has_testimonials,has_seo_tools,has_analytics,
  has_multi_page,has_forms,has_google_indexing,has_online_payments,has_product_catalog,has_appointment_scheduling,
  has_staff_management,has_customer_dashboard,has_email_notifications,has_sms_notifications,has_ai_content,
  has_priority_support,max_products,max_gallery_photos,max_ai_generations_per_month,features_list)
VALUES
('starter','Starter Website','Perfect for salons, barbers, tailors, restaurants',20,192,true,0,30,
  true,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,
  25,25,0,'["Custom template","About page","Services","Gallery","Contact page","WhatsApp","Google Maps","spotgh.com/business/your-name","First month free, then billed monthly"]'),
('professional','Professional Website','Everything in Starter, plus a real domain and SEO',50,480,false,1,0,
  true,true,true,true,true,true,true,true,true,true,false,false,false,false,false,false,false,false,false,
  60,60,0,'["Everything in Starter","Custom domain support","Booking system","Blog","Testimonials","SEO tools","Analytics","Multiple pages","Forms","Google indexing","e.g. www.yourbusiness.com"]'),
('business_pro','Business Pro','Full business website with payments and staff',100,960,false,2,0,
  true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,
  999,999,50,'["Everything in Professional","Online payments","Product catalog","Appointment scheduling","Staff management","Customer dashboard","Email notifications","SMS notifications","AI content assistance (50/month)","Priority support"]')
ON CONFLICT (tier) DO NOTHING;

-- ------------------------------------------------------------
-- 3. BUNDLES (Directory + Website at a discount)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bundles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  tagline TEXT,
  directory_plan_id UUID NOT NULL REFERENCES public.directory_plans(id),
  website_plan_id UUID NOT NULL REFERENCES public.website_plans(id),
  discount_percent NUMERIC NOT NULL DEFAULT 15,
  is_popular BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.bundles (key,name,tagline,directory_plan_id,website_plan_id,discount_percent,is_popular,sort_order)
SELECT 'standard_starter','Standard + Starter Website','Discounted bundle',
  d.id, w.id, 15, false, 0
FROM public.directory_plans d, public.website_plans w
WHERE d.tier='standard' AND w.tier='starter'
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.bundles (key,name,tagline,directory_plan_id,website_plan_id,discount_percent,is_popular,sort_order)
SELECT 'premium_professional','Premium + Professional Website','Most popular',
  d.id, w.id, 15, true, 1
FROM public.directory_plans d, public.website_plans w
WHERE d.tier='premium' AND w.tier='professional'
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.bundles (key,name,tagline,directory_plan_id,website_plan_id,discount_percent,is_popular,sort_order)
SELECT 'premium_business_pro','Premium + Business Pro Website','Complete business package',
  d.id, w.id, 20, false, 2
FROM public.directory_plans d, public.website_plans w
WHERE d.tier='premium' AND w.tier='business_pro'
ON CONFLICT (key) DO NOTHING;

-- ------------------------------------------------------------
-- 4. PER-BUSINESS SUBSCRIPTIONS (one active row per type, independent)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.business_directory_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id),
  plan_id UUID NOT NULL REFERENCES public.directory_plans(id),
  tier TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','expired','cancelled')),
  amount_paid NUMERIC NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'GHS',
  billing_cycle TEXT DEFAULT 'monthly',
  bundle_id UUID REFERENCES public.bundles(id), -- set if purchased as part of a bundle
  paystack_reference TEXT UNIQUE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  auto_renew BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_biz_dir_subs_business ON public.business_directory_subscriptions(business_id);

CREATE TABLE IF NOT EXISTS public.business_website_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id),
  plan_id UUID NOT NULL REFERENCES public.website_plans(id),
  tier TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','expired','cancelled')),
  amount_paid NUMERIC NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'GHS',
  billing_cycle TEXT DEFAULT 'monthly',
  bundle_id UUID REFERENCES public.bundles(id),
  is_trial BOOLEAN DEFAULT FALSE,
  paystack_reference TEXT UNIQUE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  auto_renew BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_biz_web_subs_business ON public.business_website_subscriptions(business_id);

-- A business's "do you already have your own website" answer means it
-- will never need a Website subscription at all — separate from whether
-- it *has* one of ours. Column already exists from migration 015.

-- ------------------------------------------------------------
-- 5. Track which one-time free perks a user has used, per product
-- (separate from the old single `users.trial_used`, which stays as-is
-- for the legacy bundled Starter trial so nothing existing breaks).
-- ------------------------------------------------------------
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS website_trial_used BOOLEAN DEFAULT FALSE;

-- ------------------------------------------------------------
-- 6. Backfill: give every EXISTING business a Directory subscription
-- matching what it already effectively has, so nothing regresses.
-- Website subscription is only backfilled for businesses whose old
-- plan actually included a website (has_website=true) and who don't
-- already say they have their own external site.
-- ------------------------------------------------------------
INSERT INTO public.business_directory_subscriptions (business_id, user_id, plan_id, tier, status, amount_paid, billing_cycle, started_at, expires_at)
SELECT b.id, b.owner_id, dp.id,
  CASE b.subscription_tier WHEN 'free' THEN 'free' WHEN 'starter' THEN 'standard' ELSE 'premium' END,
  'active', 0, 'monthly', COALESCE(b.created_at, NOW()),
  COALESCE(b.subscription_expires_at, NOW() + INTERVAL '100 years')
FROM public.businesses b
JOIN public.directory_plans dp ON dp.tier = CASE b.subscription_tier WHEN 'free' THEN 'free' WHEN 'starter' THEN 'standard' ELSE 'premium' END
WHERE NOT EXISTS (SELECT 1 FROM public.business_directory_subscriptions s WHERE s.business_id = b.id);

INSERT INTO public.business_website_subscriptions (business_id, user_id, plan_id, tier, status, amount_paid, billing_cycle, started_at, expires_at)
SELECT b.id, b.owner_id, wp.id,
  CASE b.subscription_tier WHEN 'starter' THEN 'starter' ELSE 'professional' END,
  'active', 0, 'monthly', COALESCE(b.created_at, NOW()),
  COALESCE(b.subscription_expires_at, NOW() + INTERVAL '100 years')
FROM public.businesses b
JOIN public.website_plans wp ON wp.tier = CASE b.subscription_tier WHEN 'starter' THEN 'starter' ELSE 'professional' END
WHERE b.subscription_tier IN ('starter','pro','enterprise')
  AND COALESCE(b.has_own_website, false) = false
  AND NOT EXISTS (SELECT 1 FROM public.business_website_subscriptions s WHERE s.business_id = b.id);

-- Convenience read columns on businesses so the frontend doesn't need a
-- join for the common case (source of truth stays the subscription
-- tables above; these are kept in sync by payments.routes.js).
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS directory_tier TEXT DEFAULT 'free';
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS directory_expires_at TIMESTAMPTZ;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS website_tier TEXT; -- NULL = no website subscription
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS website_expires_at TIMESTAMPTZ;

UPDATE public.businesses b SET
  directory_tier = s.tier, directory_expires_at = s.expires_at
FROM public.business_directory_subscriptions s
WHERE s.business_id = b.id AND s.status = 'active';

UPDATE public.businesses b SET
  website_tier = s.tier, website_expires_at = s.expires_at
FROM public.business_website_subscriptions s
WHERE s.business_id = b.id AND s.status = 'active';
