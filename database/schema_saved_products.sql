-- ============================================================
-- SpotGH — Saved products (per-item favorites for quick reorder)
-- Run AFTER schema_tier1_commerce.sql
-- ============================================================
CREATE TABLE IF NOT EXISTS public.saved_products (
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products_services(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, product_id)
);
ALTER TABLE public.saved_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_saved_products" ON public.saved_products
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
