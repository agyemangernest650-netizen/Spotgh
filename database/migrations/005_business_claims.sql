-- 005_business_claims.sql
-- "Claim this Business" — lets a real owner take over a listing that was
-- added by the creator/an admin on their behalf before they signed up.
-- Run AFTER schema_v16_verification.sql

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS is_claimed BOOLEAN NOT NULL DEFAULT TRUE;

-- Existing rows are all owned by a real signed-up user already, so default
-- them to claimed=true. Only businesses the creator deliberately marks as
-- unclaimed (owner_id = creator's own account, is_claimed = false) show the
-- "Claim this Business" button on the mini-website.

CREATE TABLE IF NOT EXISTS public.business_claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  role_at_business TEXT,
  message TEXT,
  proof_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_claims_business ON public.business_claims(business_id);
CREATE INDEX IF NOT EXISTS idx_claims_status   ON public.business_claims(status);

ALTER TABLE public.business_claims ENABLE ROW LEVEL SECURITY;
-- Note: business reporting ("Report this Business") is defined separately
-- in 006_business_reports.sql, not here.
