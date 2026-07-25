-- ============================================================
-- SpotGH — In-app messaging (customer <-> business owner)
-- Run AFTER schema_referral_credits.sql
--
-- Threaded implicitly by (business_id, customer_id) pair — one
-- conversation per customer per business, same model as carts.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('customer','owner')),
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON public.messages(business_id, customer_id, created_at);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
