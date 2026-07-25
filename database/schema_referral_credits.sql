-- ============================================================
-- SpotGH — Referral credit system
-- Run AFTER schema_saved_products.sql
--
-- Fixes a real pre-existing bug: applyReferral() in user.controller.js
-- sent a notification promising "10% off your next renewal" for every
-- signup referral, but no code anywhere ever tracked or applied that
-- discount. This migration adds the balance column that makes the
-- promise real, plus a new milestone bonus when a referred business
-- owner's business completes its first order.
-- ============================================================
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS referral_credit_ghs DECIMAL(10,2) DEFAULT 0;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS first_order_referral_bonus_paid BOOLEAN DEFAULT FALSE;
