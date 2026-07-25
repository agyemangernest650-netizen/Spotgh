-- 008_computed_badges.sql
-- Adds two computed badges alongside the existing is_verified / is_featured:
--   is_top_rated  — avg_rating >= 4.5 with at least 10 approved reviews
--   is_new        — listed within the last 30 days
-- These are derived, not stored, so they always reflect current data.
-- (Exact copy of the original businesses_with_stats view, plus the two new columns.)

CREATE OR REPLACE VIEW public.businesses_with_stats AS
SELECT
  b.*,
  c.name AS category_name, c.slug AS category_slug,
  c.icon AS category_icon, c.template_key AS category_template,
  l.name AS location_name, l.city AS location_city,
  u.full_name AS owner_name, u.email AS owner_email,
  p.name AS plan_name, p.price_monthly AS plan_price,
  COALESCE(r.avg_rating,0) AS avg_rating,
  COALESCE(r.review_count,0) AS review_count,
  COALESCE(m.gallery_count,0) AS gallery_count,
  COALESCE(ps.product_count,0) AS product_count,
  COALESCE(ps.service_count,0) AS service_count,
  COALESCE(bk.booking_count,0) AS booking_count,
  s.status AS subscription_status,
  (COALESCE(r.avg_rating,0) >= 4.5 AND COALESCE(r.review_count,0) >= 10) AS is_top_rated,
  (b.created_at >= NOW() - INTERVAL '30 days') AS is_new
FROM public.businesses b
LEFT JOIN public.categories c ON b.category_id = c.id
LEFT JOIN public.locations l ON b.location_id = l.id
LEFT JOIN public.users u ON b.owner_id = u.id
LEFT JOIN public.plans p ON b.subscription_tier = p.tier
LEFT JOIN (
  SELECT business_id, ROUND(AVG(rating)::numeric,1) AS avg_rating, COUNT(*) AS review_count
  FROM public.reviews WHERE status = 'approved' GROUP BY business_id
) r ON r.business_id = b.id
LEFT JOIN (
  SELECT business_id, COUNT(*) AS gallery_count
  FROM public.business_media WHERE type = 'gallery' GROUP BY business_id
) m ON m.business_id = b.id
LEFT JOIN (
  SELECT business_id,
    COUNT(*) FILTER (WHERE type='product') AS product_count,
    COUNT(*) FILTER (WHERE type='service') AS service_count
  FROM public.products_services WHERE is_available = TRUE GROUP BY business_id
) ps ON ps.business_id = b.id
LEFT JOIN (
  SELECT business_id, COUNT(*) AS booking_count
  FROM public.bookings GROUP BY business_id
) bk ON bk.business_id = b.id
LEFT JOIN (
  SELECT business_id, status, expires_at
  FROM public.subscriptions WHERE status = 'active'
  ORDER BY expires_at DESC LIMIT 1
) s ON s.business_id = b.id;
