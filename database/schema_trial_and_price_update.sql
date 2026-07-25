-- ============================================================
-- SpotGH — Plan price/limit update + 30-day free trial
-- Run AFTER schema.sql and schema_supplement.sql
-- Safe to run on a live database (existing rows are updated,
-- nothing is dropped or recreated).
-- ============================================================

-- ---------------------------------------------------------
-- 1. Update existing plan rows (schema.sql's seed INSERT only
--    runs once on a fresh install — this is what actually
--    changes prices/limits on a database that's already live).
-- ---------------------------------------------------------
UPDATE public.plans SET
  price_monthly = 20,
  price_yearly  = 192,
  max_products  = 25,
  max_gallery_photos = 25,
  features_list = '["1 business mini-website","WhatsApp contact button","25 products/services","25 gallery photos","Basic analytics","Email support","Valid for 1 month — no auto-renewal","Renew or upgrade anytime after"]'
WHERE tier = 'starter';

UPDATE public.plans SET
  price_monthly = 60,
  price_yearly  = 576,
  max_products  = 60,
  max_gallery_photos = 60,
  features_list = '["3 business mini-websites","60 products/services","60 gallery photos","Advanced analytics","Online bookings","Custom template","Verified badge","Priority listing","AI content tools","SEO tools","Priority support"]'
WHERE tier = 'pro';

UPDATE public.plans SET
  price_monthly = 200,
  price_yearly  = 1920
WHERE tier = 'enterprise';

-- Yearly prices above assume the pricing page's existing "Save 20%"
-- annual-billing badge (monthly x 12 x 0.8). Adjust price_yearly by
-- hand if you want a different annual discount.

-- ---------------------------------------------------------
-- 2. Columns needed for the 30-day free Starter trial
-- ---------------------------------------------------------

-- Tracks whether a user has already used their one-time free trial,
-- so they can't get repeated free months by deleting and re-creating
-- a business.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS trial_used BOOLEAN DEFAULT FALSE;

-- Marks a subscription row as a free trial grant rather than a paid
-- one (amount_paid will be 0 either way, but this makes it easy to
-- tell trials apart from comped/admin-granted subscriptions in
-- reporting, and lets the dashboard show a "Free trial" badge).
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS is_trial BOOLEAN DEFAULT FALSE;
