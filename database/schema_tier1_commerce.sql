-- ============================================================
-- SpotGH — Tier 1 commerce: cart, orders, inventory
-- Run AFTER schema_enterprise_features.sql
-- Payment is collected offline (cash / mobile money on pickup or
-- delivery) — no money moves through SpotGH at this stage.
-- ============================================================

-- ── Business-configurable delivery fee ──────────────────────
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(12,2) DEFAULT 0;
-- Optional per-zone delivery pricing, e.g. [{"name":"Accra Central","fee":10},{"name":"Outside Accra","fee":25}].
-- If empty/null, checkout falls back to the flat delivery_fee above.
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS delivery_zones JSONB DEFAULT '[]';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_zone_name TEXT;

-- ── Inventory fields on existing products_services table ───
ALTER TABLE public.products_services
  ADD COLUMN IF NOT EXISTS track_inventory BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS stock_quantity INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS allow_backorder BOOLEAN DEFAULT FALSE;

-- ── Cart (one per customer per business — matches the site's
-- existing single-vendor-at-a-time checkout model) ──────────
CREATE TABLE IF NOT EXISTS public.carts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  session_id TEXT, -- for guest carts before login
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_carts_user ON public.carts(user_id, business_id);
CREATE INDEX IF NOT EXISTS idx_carts_session ON public.carts(session_id, business_id);

CREATE TABLE IF NOT EXISTS public.cart_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cart_id UUID NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products_services(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cart_id, product_id)
);

-- ── Orders ───────────────────────────────────────────────────
CREATE TYPE order_status AS ENUM ('pending','confirmed','preparing','ready','delivered','completed','cancelled');
CREATE TYPE fulfillment_type AS ENUM ('pickup','delivery');

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number TEXT UNIQUE NOT NULL,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.users(id),
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  fulfillment_type fulfillment_type NOT NULL DEFAULT 'pickup',
  delivery_address TEXT,
  notes TEXT,
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  delivery_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  status order_status NOT NULL DEFAULT 'pending',
  payment_method TEXT DEFAULT 'cash_on_pickup', -- 'cash_on_pickup' | 'cash_on_delivery' | 'mobile_money'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_orders_business ON public.orders(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON public.orders(customer_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products_services(id) ON DELETE SET NULL,
  name_snapshot TEXT NOT NULL,   -- preserved even if the product is later edited/deleted
  price_snapshot DECIMAL(12,2) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0)
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);

ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
-- As with the rest of this app, all access goes through the backend's
-- service-role key, so RLS here is a default-deny baseline, not the
-- primary access control mechanism (that's done in the route/controller
-- ownership checks).

-- ── Plan gating: online ordering is a paid-plan feature ─────
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS has_online_ordering BOOLEAN DEFAULT FALSE;
UPDATE public.plans SET has_online_ordering = TRUE WHERE tier IN ('starter','pro','enterprise');
