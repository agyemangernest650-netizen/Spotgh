-- ============================================================
-- SpotGH — Business events
-- Run AFTER schema_v16_availability.sql
-- ============================================================
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  location TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  ticket_url TEXT,
  price NUMERIC(10,2),
  is_free BOOLEAN DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming','ongoing','past','cancelled')),
  interested_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_events_business ON public.events(business_id);
CREATE INDEX IF NOT EXISTS idx_events_starts   ON public.events(starts_at);

CREATE TABLE IF NOT EXISTS public.event_interests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

ALTER TABLE public.events           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_interests  ENABLE ROW LEVEL SECURITY;
