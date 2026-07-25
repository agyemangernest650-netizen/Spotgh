-- ============================================================
-- SpotGH v4 — Additional Schema
-- Run AFTER schema.sql
-- ============================================================

-- Deals / Promotions
CREATE TABLE IF NOT EXISTS public.business_deals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  discount_text TEXT,
  image_url TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_deals_business ON public.business_deals(business_id);
CREATE INDEX IF NOT EXISTS idx_deals_expires ON public.business_deals(expires_at);

-- Menu / price-list PDF on businesses (for the mini-website's Menu link)
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS menu_pdf_url TEXT;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS menu_pdf_public_id TEXT;

-- increment_counter function (add if missing)
CREATE OR REPLACE FUNCTION public.increment_counter(table_name TEXT, column_name TEXT, row_id UUID)
RETURNS VOID AS $$
BEGIN
  EXECUTE format('UPDATE public.%I SET %I = %I + 1 WHERE id = $1', table_name, column_name, column_name) USING row_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS for new tables
ALTER TABLE public.business_deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_view_active_deals" ON public.business_deals FOR SELECT USING (is_active = TRUE);