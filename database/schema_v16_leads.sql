-- ============================================================
-- SpotGH — Lead Marketplace
-- Run AFTER schema_referral_credits.sql
--
-- Customer posts a request ("caterer for 200 people in Accra").
-- Matching businesses (by category + city/radius) get notified.
-- Only Pro/Enterprise businesses (has_leads flag) may send quotes —
-- this is the upsell lever for free/starter businesses.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  city TEXT NOT NULL,
  budget_min NUMERIC(10,2),
  budget_max NUMERIC(10,2),
  needed_by DATE,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','awarded','expired','cancelled')),
  awarded_business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
  quote_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days')
);
CREATE INDEX IF NOT EXISTS idx_leads_category ON public.leads(category_id);
CREATE INDEX IF NOT EXISTS idx_leads_city     ON public.leads(city);
CREATE INDEX IF NOT EXISTS idx_leads_status   ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_customer ON public.leads(customer_id);

CREATE TABLE IF NOT EXISTS public.lead_quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  price NUMERIC(10,2) NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','viewed','accepted','declined')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lead_id, business_id)
);
CREATE INDEX IF NOT EXISTS idx_lead_quotes_lead     ON public.lead_quotes(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_quotes_business ON public.lead_quotes(business_id);

-- Plan gate: which tiers may send quotes
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS has_leads BOOLEAN DEFAULT FALSE;
UPDATE public.plans SET has_leads = TRUE WHERE tier IN ('pro','enterprise');

ALTER TABLE public.leads      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_quotes ENABLE ROW LEVEL SECURITY;
