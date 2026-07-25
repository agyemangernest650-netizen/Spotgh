-- ============================================================
-- SpotGH — Appointment availability + blocked dates
-- Run AFTER schema_v16_leads.sql
-- ============================================================

-- Weekly recurring working hours per business
CREATE TABLE IF NOT EXISTS public.business_hours (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday
  open_time TIME,
  close_time TIME,
  is_closed BOOLEAN NOT NULL DEFAULT FALSE,
  slot_minutes INTEGER NOT NULL DEFAULT 60,
  UNIQUE(business_id, day_of_week)
);
CREATE INDEX IF NOT EXISTS idx_business_hours_biz ON public.business_hours(business_id);

-- One-off blocked dates (holidays, fully booked days, etc.)
CREATE TABLE IF NOT EXISTS public.blocked_dates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  blocked_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, blocked_date)
);
CREATE INDEX IF NOT EXISTS idx_blocked_dates_biz ON public.blocked_dates(business_id, blocked_date);

ALTER TABLE public.business_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_dates  ENABLE ROW LEVEL SECURITY;
