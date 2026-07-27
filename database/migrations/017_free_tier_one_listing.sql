-- ============================================================
-- Migration: Free tier = 1 business, 1 gallery photo
-- Run this in the Supabase SQL editor on your EXISTING database.
--
-- Previously Free allowed 0 businesses and 0 gallery photos, with a
-- separate "first listing ever" mechanism silently upgrading new users
-- to a free Starter trial instead. That's been replaced: Free now
-- genuinely supports one basic listing with one photo on its own, and
-- the free-month trial only grants when someone explicitly chooses
-- Starter at checkout (see payments.routes.js).
-- ============================================================

UPDATE public.plans
SET max_businesses = 1,
    max_gallery_photos = 1,
    features_list = '["List 1 business (1 photo)", "Browse directory", "Save businesses", "Write reviews"]'::jsonb
WHERE tier = 'free';