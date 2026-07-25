-- ============================================================
-- SpotGH v18 — Franchise management
-- Run AFTER schema_v18_ai_usage.sql
--
-- Pro (3 businesses) and Enterprise (unlimited) already let one owner run
-- several business listings via businesses.owner_id, but there was no way
-- to group locations under one brand or see combined stats across them.
-- This adds that grouping layer on top of the existing multi-business
-- support, gated the same way other Pro+ features are.
-- ============================================================
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS has_franchise_management BOOLEAN DEFAULT FALSE;
UPDATE public.plans SET has_franchise_management = TRUE WHERE tier IN ('pro','enterprise');

CREATE TABLE IF NOT EXISTS public.franchises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Nullable: a business only belongs to a franchise once its owner links it.
-- ON DELETE SET NULL so removing a franchise doesn't delete its branches.
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS franchise_id UUID REFERENCES public.franchises(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_businesses_franchise ON public.businesses(franchise_id) WHERE franchise_id IS NOT NULL;

ALTER TABLE public.franchises ENABLE ROW LEVEL SECURITY;
