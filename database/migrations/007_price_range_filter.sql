-- 007_price_range_filter.sql
-- Adds a simple price-tier filter ($ / $$ / $$$ / $$$$) businesses can set
-- on their profile, used by the new search filters (open now / price / rating).

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS price_range TEXT CHECK (price_range IN ('$','$$','$$$','$$$$'));
