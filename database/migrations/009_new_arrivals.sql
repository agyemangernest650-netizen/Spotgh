-- ============================================================
-- Migration: "New Arrivals" flag for products/services
-- Run this in the Supabase SQL editor on your existing database.
-- Safe to run even if already applied (IF NOT EXISTS).
-- ============================================================
ALTER TABLE public.products_services ADD COLUMN IF NOT EXISTS is_new_arrival BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_products_new_arrival ON public.products_services(business_id, is_new_arrival) WHERE is_new_arrival = TRUE;
