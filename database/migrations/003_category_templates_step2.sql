-- ============================================================
-- Migration: Category mini-website templates — STEP 2
-- Run this AFTER 002_category_templates.sql (step 1) has finished
-- running successfully as its own separate query.
-- ============================================================

-- New generic, reusable fields on businesses (not one column per
-- category — e.g. emergency_contact covers both a hospital's emergency
-- line and an auto garage's towing number).
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS emergency_contact TEXT;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS insurance_accepted TEXT[];
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS nearby_attractions TEXT[];
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS measurement_guide TEXT;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS health_tips TEXT;

-- Staff/team profiles (stylists, doctors, mechanics) — shared across
-- whichever category templates want to show a team.
CREATE TABLE IF NOT EXISTS public.business_staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  photo_url TEXT,
  bio TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_staff_business ON public.business_staff(business_id);
CREATE INDEX IF NOT EXISTS idx_business_media_type ON public.business_media(business_id, type);

DROP TRIGGER IF EXISTS trg_business_staff_updated ON public.business_staff;
CREATE TRIGGER trg_business_staff_updated BEFORE UPDATE ON public.business_staff
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- No RLS on business_staff — same reasoning as products_services/categories:
-- this is public catalog data meant to display on the business's own public
-- mini-website, not private data like bookings/payments.
