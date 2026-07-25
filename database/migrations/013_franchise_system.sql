-- ============================================================
-- Migration: Franchise system
-- Groups multiple businesses under one owner/brand (e.g. "Royal Hotel"
-- with locations in Accra, Kumasi, Takoradi) for grouped branding and
-- aggregated analytics across all locations.
-- Run this in the Supabase SQL editor on your existing database.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.franchises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  logo_url TEXT,
  logo_public_id TEXT,
  theme_color TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_franchises_owner ON public.franchises(owner_id);

ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS franchise_id UUID REFERENCES public.franchises(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_businesses_franchise ON public.businesses(franchise_id) WHERE franchise_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_franchises_updated ON public.franchises;
CREATE TRIGGER trg_franchises_updated BEFORE UPDATE ON public.franchises FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.franchises ENABLE ROW LEVEL SECURITY;
