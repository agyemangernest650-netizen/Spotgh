-- ============================================================
-- SpotGH — Enterprise features: custom domain + API access
-- Run AFTER schema_trial_and_price_update.sql
-- ============================================================

-- ── Custom domain (Enterprise) ──────────────────────────────
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS custom_domain TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS custom_domain_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS custom_domain_token TEXT;

CREATE INDEX IF NOT EXISTS idx_businesses_custom_domain ON public.businesses(custom_domain) WHERE custom_domain IS NOT NULL;

-- ── API access (Enterprise) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  key_prefix TEXT NOT NULL,        -- first 8 chars shown in the dashboard, e.g. "sgh_live_a1b2c3d4"
  key_hash TEXT NOT NULL,          -- sha256 of the full key — the raw key is only ever shown once, at creation
  name TEXT DEFAULT 'Default key',
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_api_keys_business ON public.api_keys(business_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON public.api_keys(key_hash) WHERE revoked_at IS NULL;

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
-- All access to this table goes through the backend's service-role key
-- (same pattern as the rest of the app), so no anon-key policies are
-- needed here beyond enabling RLS as a default-deny baseline.
