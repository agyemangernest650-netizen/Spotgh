-- ============================================================
-- Migration: New pricing + mandatory "already have a website?" field
-- Run this in the Supabase SQL editor on your existing database.
-- Safe to run even if already applied.
-- ============================================================

-- New pricing: Starter 20, Premium (tier key stays 'pro' — see note below) 50,
-- Enterprise 100 GHS/month. Yearly kept at the same ~9.6x multiplier
-- (20% off an annual commitment) the existing plans already use.
UPDATE public.plans SET price_monthly = 20,  price_yearly = 192 WHERE tier = 'starter';
UPDATE public.plans SET price_monthly = 50,  price_yearly = 480, name = 'Premium' WHERE tier = 'pro';
UPDATE public.plans SET price_monthly = 100, price_yearly = 960 WHERE tier = 'enterprise';
-- Note: the tier column itself stays 'pro' — renaming the enum value would
-- touch every `tier === 'pro'` check across the codebase for no functional
-- gain. Only the customer-facing `name` changed to "Premium".

-- Every business must now say, at creation, whether it already has its own
-- website. NOT NULL can't be added directly (existing rows have no answer),
-- so existing rows are backfilled to false (treated as "wants a SpotGH
-- mini-website", which is what they already have) and NOT NULL is enforced
-- going forward at the application layer (see business.validators.js) since
-- Postgres has no clean "required only for new rows" constraint.
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS has_own_website BOOLEAN;
UPDATE public.businesses SET has_own_website = false WHERE has_own_website IS NULL;
ALTER TABLE public.businesses ALTER COLUMN has_own_website SET DEFAULT false;

-- Best-effort reachability check result for the URL they gave us (see
-- validateExternalWebsite in business.controller.js) — not a hard gate,
-- since a real site can legitimately block bot HEAD requests. Lets an
-- admin see at a glance which claimed websites didn't respond.
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS own_website_verified BOOLEAN;
