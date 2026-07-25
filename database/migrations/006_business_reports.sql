-- 006_business_reports.sql
-- "Report this Business" — lets any user flag a listing for moderation
-- (fake business, permanently closed, fraud, inappropriate content, duplicate).

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS flag_reason TEXT;

CREATE TABLE IF NOT EXISTS public.business_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  reported_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('fake','closed','fraud','inappropriate','duplicate','other')),
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_breports_business ON public.business_reports(business_id);
CREATE INDEX IF NOT EXISTS idx_breports_status   ON public.business_reports(status);

ALTER TABLE public.business_reports ENABLE ROW LEVEL SECURITY;
