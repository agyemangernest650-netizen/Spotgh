-- ============================================================
-- SpotGH v2 — Complete Database Schema
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE user_role AS ENUM ('user','business_owner','admin','super_admin','creator');
CREATE TYPE business_status AS ENUM ('draft','pending','active','suspended','rejected');
CREATE TYPE subscription_tier AS ENUM ('free','starter','pro','enterprise');
CREATE TYPE subscription_status AS ENUM ('active','cancelled','expired','trialing','past_due');
CREATE TYPE payment_status AS ENUM ('pending','paid','failed','refunded');
CREATE TYPE review_status AS ENUM ('pending','approved','rejected');
CREATE TYPE media_type AS ENUM ('logo','cover','gallery','product','service','before','after');
CREATE TYPE booking_status AS ENUM ('pending','confirmed','cancelled','completed','no_show');
CREATE TYPE notification_type AS ENUM ('info','success','warning','danger');
CREATE TYPE promo_type AS ENUM ('percent','fixed');
CREATE TYPE order_status AS ENUM ('pending','confirmed','preparing','ready','delivered','completed','cancelled');
CREATE TYPE fulfillment_type AS ENUM ('pickup','delivery');

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  avatar_public_id TEXT,
  role user_role DEFAULT 'user',
  is_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  is_banned BOOLEAN DEFAULT FALSE,
  ban_reason TEXT,
  notification_preferences JSONB DEFAULT '{"email":true,"sms":false,"push":true}',
  last_login_at TIMESTAMPTZ,
  login_count INTEGER DEFAULT 0,
  referral_code TEXT UNIQUE,
  referred_by UUID REFERENCES public.users(id),
  referral_credit_ghs DECIMAL(10,2) DEFAULT 0,
  trial_used BOOLEAN DEFAULT FALSE,
  reset_token_hash TEXT,
  reset_token_expires TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FRANCHISES (groups multiple businesses under one owner/brand —
-- e.g. "Royal Hotel" with locations in Accra, Kumasi, Takoradi)
-- ============================================================
CREATE TABLE public.franchises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  logo_url TEXT,
  logo_public_id TEXT,
  theme_color TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_franchises_owner ON public.franchises(owner_id);

-- ============================================================
-- SUBSCRIPTION PLANS (platform-defined, editable by creator)
-- ============================================================
CREATE TABLE public.plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tier subscription_tier UNIQUE NOT NULL,
  name TEXT NOT NULL,
  tagline TEXT,
  price_monthly DECIMAL(10,2) NOT NULL DEFAULT 0,
  price_yearly DECIMAL(10,2) NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'GHS',
  color TEXT DEFAULT '#4E0DAD',
  is_popular BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  -- Feature limits
  max_businesses INTEGER DEFAULT 0,
  max_products INTEGER DEFAULT 0,
  max_gallery_photos INTEGER DEFAULT 0,
  max_bookings_per_month INTEGER DEFAULT 0,
  max_ai_generations_per_month INTEGER DEFAULT 0,
  -- Feature flags
  has_whatsapp_button BOOLEAN DEFAULT FALSE,
  has_analytics BOOLEAN DEFAULT FALSE,
  has_advanced_analytics BOOLEAN DEFAULT FALSE,
  has_bookings BOOLEAN DEFAULT FALSE,
  has_online_ordering BOOLEAN DEFAULT FALSE,
  has_custom_template BOOLEAN DEFAULT FALSE,
  has_verified_badge BOOLEAN DEFAULT FALSE,
  has_priority_listing BOOLEAN DEFAULT FALSE,
  has_custom_domain BOOLEAN DEFAULT FALSE,
  has_ai_content BOOLEAN DEFAULT FALSE,
  has_seo_tools BOOLEAN DEFAULT FALSE,
  has_remove_branding BOOLEAN DEFAULT FALSE,
  has_api_access BOOLEAN DEFAULT FALSE,
  support_level TEXT DEFAULT 'none',
  features_list JSONB DEFAULT '[]',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CATEGORIES
-- ============================================================
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  icon TEXT,
  cover_image TEXT,
  template_key TEXT DEFAULT 'default',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  parent_id UUID REFERENCES public.categories(id),
  business_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- LOCATIONS
-- ============================================================
CREATE TABLE public.locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  city TEXT NOT NULL,
  region TEXT,
  country TEXT DEFAULT 'Ghana',
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- BUSINESSES
-- ============================================================
CREATE TABLE public.businesses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id),
  franchise_id UUID REFERENCES public.franchises(id) ON DELETE SET NULL,
  location_id UUID REFERENCES public.locations(id),

  -- Identity
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  tagline TEXT,
  description TEXT,
  established_year INTEGER,

  -- Contact
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  website TEXT,
  delivery_fee DECIMAL(12,2) DEFAULT 0,
  delivery_zones JSONB DEFAULT '[]',
  first_order_referral_bonus_paid BOOLEAN DEFAULT FALSE,
  custom_domain TEXT UNIQUE,
  custom_domain_verified BOOLEAN DEFAULT FALSE,
  custom_domain_token TEXT,

  -- Address
  address TEXT,
  city TEXT,
  region TEXT,
  country TEXT DEFAULT 'Ghana',
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),

  -- Media
  logo_url TEXT,
  logo_public_id TEXT,
  cover_url TEXT,
  cover_public_id TEXT,

  -- Business details
  operating_hours JSONB DEFAULT '{
    "monday":{"open":"08:00","close":"18:00","closed":false},
    "tuesday":{"open":"08:00","close":"18:00","closed":false},
    "wednesday":{"open":"08:00","close":"18:00","closed":false},
    "thursday":{"open":"08:00","close":"18:00","closed":false},
    "friday":{"open":"08:00","close":"18:00","closed":false},
    "saturday":{"open":"09:00","close":"16:00","closed":false},
    "sunday":{"open":null,"close":null,"closed":true}
  }',
  social_links JSONB DEFAULT '{}',
  amenities TEXT[],
  tags TEXT[],

  -- Customization
  template_key TEXT DEFAULT 'default',
  theme_color TEXT DEFAULT '#4E0DAD',
  accent_color TEXT DEFAULT '#F6A012',
  custom_css TEXT,

  -- SEO
  meta_title TEXT,
  meta_description TEXT,
  keywords TEXT[],

  -- Status
  status business_status DEFAULT 'draft',
  rejection_reason TEXT,
  admin_notes TEXT,

  -- Subscription
  subscription_tier subscription_tier DEFAULT 'free',
  subscription_expires_at TIMESTAMPTZ,

  -- Flags
  is_featured BOOLEAN DEFAULT FALSE,
  is_verified BOOLEAN DEFAULT FALSE,
  is_promoted BOOLEAN DEFAULT FALSE,
  featured_until TIMESTAMPTZ,
  is_claimed BOOLEAN NOT NULL DEFAULT TRUE,
  is_flagged BOOLEAN NOT NULL DEFAULT FALSE,
  flag_reason TEXT,
  price_range TEXT CHECK (price_range IN ('$','$$','$$$','$$$$')),

  -- Category-template fields (generic + reusable across categories rather
  -- than one column per category — e.g. emergency_contact covers both a
  -- hospital's emergency line and an auto garage's towing number)
  emergency_contact TEXT,
  insurance_accepted TEXT[],
  nearby_attractions TEXT[],
  measurement_guide TEXT,
  health_tips TEXT,

  -- Google Calendar sync (bookings) — refresh token is long-lived, so it's
  -- the only thing that needs persisting; access tokens are re-derived
  -- per-request from it and never stored.
  google_calendar_connected BOOLEAN NOT NULL DEFAULT FALSE,
  google_calendar_refresh_token TEXT,
  google_calendar_id TEXT DEFAULT 'primary',

  -- Analytics
  view_count INTEGER DEFAULT 0,
  whatsapp_click_count INTEGER DEFAULT 0,
  call_click_count INTEGER DEFAULT 0,
  website_click_count INTEGER DEFAULT 0,

  -- Timestamps
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SUBSCRIPTIONS
-- ============================================================
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id),
  plan_id UUID NOT NULL REFERENCES public.plans(id),
  tier subscription_tier NOT NULL,
  status subscription_status DEFAULT 'active',

  -- Billing
  amount_paid DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'GHS',
  billing_cycle TEXT DEFAULT 'monthly', -- monthly | yearly
  discount_amount DECIMAL(10,2) DEFAULT 0,
  promo_code_used TEXT,
  is_trial BOOLEAN DEFAULT FALSE,

  -- Paystack
  paystack_reference TEXT UNIQUE,
  paystack_subscription_code TEXT,
  paystack_customer_code TEXT,

  -- Dates
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,

  -- Auto-renew
  auto_renew BOOLEAN DEFAULT TRUE,
  renewal_reminder_sent BOOLEAN DEFAULT FALSE,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PAYMENTS
-- ============================================================
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id),
  business_id UUID REFERENCES public.businesses(id),
  subscription_id UUID REFERENCES public.subscriptions(id),
  plan_id UUID REFERENCES public.plans(id),

  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'GHS',
  status payment_status DEFAULT 'pending',
  payment_method TEXT DEFAULT 'card',

  -- Paystack
  paystack_reference TEXT UNIQUE,
  paystack_transaction_id TEXT,
  channel TEXT, -- card | mobile_money | bank
  authorization_code TEXT, -- reusable Paystack authorization, enables one-click renewal

  -- Details
  description TEXT,
  metadata JSONB DEFAULT '{}',
  failure_reason TEXT,

  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PROMO CODES
-- ============================================================
CREATE TABLE public.promo_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  type promo_type DEFAULT 'percent',
  value DECIMAL(10,2) NOT NULL,
  max_uses INTEGER,
  used_count INTEGER DEFAULT 0,
  min_plan_tier subscription_tier,
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PROMO CODE USES
-- ============================================================
CREATE TABLE public.promo_code_uses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  promo_code_id UUID REFERENCES public.promo_codes(id),
  user_id UUID REFERENCES public.users(id),
  business_id UUID REFERENCES public.businesses(id),
  discount_amount DECIMAL(10,2),
  used_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(promo_code_id, user_id)
);

-- ============================================================
-- BUSINESS MEDIA
-- ============================================================
CREATE TABLE public.business_media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  type media_type DEFAULT 'gallery',
  url TEXT NOT NULL,
  public_id TEXT NOT NULL,
  alt_text TEXT,
  caption TEXT,
  sort_order INTEGER DEFAULT 0,
  width INTEGER,
  height INTEGER,
  format TEXT,
  size_bytes INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AI USAGE LOG (enforces plans.max_ai_generations_per_month —
-- real API cost per call, so Pro's "AI content tools" needs a cap
-- rather than being genuinely unlimited)
-- ============================================================
CREATE TABLE public.ai_usage_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  feature TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_ai_usage_business_month ON public.ai_usage_log(business_id, created_at);

-- ============================================================
-- BUSINESS STAFF (stylists / doctors / mechanics / team profiles —
-- shared across whichever category templates want to show a team)
-- ============================================================
CREATE TABLE public.business_staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  photo_url TEXT,
  bio TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- BUSINESS CLAIMS ("Claim this Business")
-- ============================================================
CREATE TABLE public.business_claims (
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
CREATE INDEX idx_claims_business ON public.business_claims(business_id);
CREATE INDEX idx_claims_status   ON public.business_claims(status);

-- ============================================================
-- BUSINESS REPORTS ("Report this Business")
-- ============================================================
CREATE TABLE public.business_reports (
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
CREATE INDEX idx_breports_business ON public.business_reports(business_id);
CREATE INDEX idx_breports_status   ON public.business_reports(status);

-- ============================================================
-- PRODUCTS & SERVICES
-- ============================================================
CREATE TABLE public.products_services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('product','service')),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  price DECIMAL(12,2),
  price_currency TEXT DEFAULT 'GHS',
  price_unit TEXT,
  duration_minutes INTEGER,
  image_url TEXT,
  image_public_id TEXT,
  is_available BOOLEAN DEFAULT TRUE,
  is_featured BOOLEAN DEFAULT FALSE,
  is_new_arrival BOOLEAN DEFAULT FALSE,
  track_inventory BOOLEAN DEFAULT FALSE,
  stock_quantity INTEGER DEFAULT 0,
  allow_backorder BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  tags TEXT[],
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, slug)
);

-- ============================================================
-- CART & ORDERS (Tier 1 commerce — payment collected offline)
-- ============================================================
CREATE TABLE public.carts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  session_id TEXT,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_carts_user ON public.carts(user_id, business_id);
CREATE INDEX idx_carts_session ON public.carts(session_id, business_id);

CREATE TABLE public.cart_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cart_id UUID NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products_services(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cart_id, product_id)
);

CREATE TABLE public.orders (
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
  delivery_zone_name TEXT,
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  status order_status NOT NULL DEFAULT 'pending',
  payment_method TEXT DEFAULT 'cash_on_pickup',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_orders_business ON public.orders(business_id, created_at DESC);
CREATE INDEX idx_orders_customer ON public.orders(customer_id, created_at DESC);

CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products_services(id) ON DELETE SET NULL,
  name_snapshot TEXT NOT NULL,
  price_snapshot DECIMAL(12,2) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0)
);
CREATE INDEX idx_order_items_order ON public.order_items(order_id);

ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- REVIEWS
-- ============================================================
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title TEXT,
  content TEXT,
  owner_reply TEXT,
  owner_replied_at TIMESTAMPTZ,
  status review_status DEFAULT 'approved',
  is_flagged BOOLEAN DEFAULT FALSE,
  flag_reason TEXT,
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, reviewer_id)
);

-- ============================================================
-- BOOKINGS
-- ============================================================
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.users(id),
  service_id UUID REFERENCES public.products_services(id),

  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT NOT NULL,

  booking_date DATE NOT NULL,
  booking_time TIME NOT NULL,
  duration_minutes INTEGER,
  notes TEXT,

  status booking_status DEFAULT 'pending',
  payment_status payment_status DEFAULT 'pending',
  amount DECIMAL(12,2),
  currency TEXT DEFAULT 'GHS',
  confirmation_code TEXT UNIQUE,

  reminder_sent BOOLEAN DEFAULT FALSE,
  google_event_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ANALYTICS EVENTS
-- ============================================================
CREATE TABLE public.analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  visitor_id TEXT,
  referrer TEXT,
  user_agent TEXT,
  ip_country TEXT,
  city TEXT,
  device_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SAVED BUSINESSES
-- ============================================================
CREATE TABLE public.saved_businesses (
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, business_id)
);

CREATE TABLE public.saved_products (
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products_services(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, product_id)
);
ALTER TABLE public.saved_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_saved_products" ON public.saved_products
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type notification_type DEFAULT 'info',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  action_url TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CONTACT SUBMISSIONS
-- ============================================================
CREATE TABLE public.contact_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  sender_email TEXT,
  sender_phone TEXT,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AUDIT LOGS (Creator only)
-- ============================================================
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID REFERENCES public.users(id),
  actor_role TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- BROADCAST EMAILS
-- ============================================================
CREATE TABLE public.broadcast_emails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_by UUID REFERENCES public.users(id),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  target TEXT DEFAULT 'all', -- all | business_owners | users | plan:pro
  sent_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'draft', -- draft | sending | sent | failed
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PLATFORM SETTINGS
-- ============================================================
CREATE TABLE public.platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES public.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FAVORITES (saved businesses)
-- ============================================================
CREATE TABLE public.favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, business_id)
);
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY favorites_owner_rw ON public.favorites FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_favorites_user ON public.favorites(user_id);
CREATE INDEX idx_favorites_business ON public.favorites(business_id);

-- ============================================================
-- API KEYS (Enterprise plan feature)
-- ============================================================
CREATE TABLE public.api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  name TEXT DEFAULT 'Default key',
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_api_keys_business ON public.api_keys(business_id);
CREATE INDEX idx_api_keys_hash ON public.api_keys(key_hash) WHERE revoked_at IS NULL;

-- ============================================================
-- MESSAGES (in-app customer <-> business owner threads)
-- ============================================================
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('customer','owner')),
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_messages_thread ON public.messages(business_id, customer_id, created_at);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_businesses_owner ON public.businesses(owner_id);
CREATE INDEX idx_businesses_category ON public.businesses(category_id);
CREATE INDEX idx_businesses_franchise ON public.businesses(franchise_id) WHERE franchise_id IS NOT NULL;
CREATE INDEX idx_businesses_status ON public.businesses(status);
CREATE INDEX idx_businesses_slug ON public.businesses(slug);
CREATE INDEX idx_businesses_tier ON public.businesses(subscription_tier);
CREATE INDEX idx_businesses_featured ON public.businesses(is_featured) WHERE is_featured = TRUE;
CREATE INDEX idx_businesses_search ON public.businesses USING gin(
  to_tsvector('english', coalesce(name,'') || ' ' || coalesce(description,'') || ' ' || coalesce(tagline,''))
);
CREATE INDEX idx_businesses_name_trgm ON public.businesses USING gin(name gin_trgm_ops);
CREATE INDEX idx_analytics_business ON public.analytics_events(business_id);
CREATE INDEX idx_analytics_created ON public.analytics_events(created_at DESC);
CREATE INDEX idx_payments_user ON public.payments(user_id);
CREATE INDEX idx_payments_status ON public.payments(status);
CREATE INDEX idx_subscriptions_business ON public.subscriptions(business_id);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, is_read);
CREATE INDEX idx_audit_logs_actor ON public.audit_logs(actor_id);
CREATE INDEX idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- ============================================================
-- VIEWS
-- ============================================================
CREATE VIEW public.businesses_with_stats AS
SELECT
  b.*,
  c.name AS category_name, c.slug AS category_slug,
  c.icon AS category_icon, c.template_key AS category_template,
  l.name AS location_name, l.city AS location_city,
  u.full_name AS owner_name,
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

-- Admin/creator-only variant of the above — the only difference is
-- owner_email. This used to be on the public view and leaked to every
-- anonymous visitor via select('*') on any public listing/business-detail
-- endpoint. Only backend/routes/admin.routes.js and creator.routes.js
-- (both already gated by requireAdmin/requireCreator) should ever query
-- this one.
CREATE VIEW public.businesses_admin_view AS
SELECT bws.*, u.email AS owner_email
FROM public.businesses_with_stats bws
LEFT JOIN public.users u ON bws.owner_id = u.id;

-- Platform revenue view
CREATE VIEW public.revenue_stats AS
SELECT
  DATE_TRUNC('month', paid_at) AS month,
  SUM(amount) AS total_revenue,
  COUNT(*) AS total_payments,
  COUNT(DISTINCT user_id) AS unique_payers
FROM public.payments
WHERE status = 'paid'
GROUP BY DATE_TRUNC('month', paid_at)
ORDER BY month DESC;

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_businesses_updated BEFORE UPDATE ON public.businesses FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products_services FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_reviews_updated BEFORE UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_business_staff_updated BEFORE UPDATE ON public.business_staff FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_franchises_updated BEFORE UPDATE ON public.franchises FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION increment_business_view(business_slug TEXT)
RETURNS VOID AS $$
BEGIN UPDATE public.businesses SET view_count = view_count + 1 WHERE slug = business_slug; END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_code_uses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.franchises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
-- bookings holds customer PII (name/email/phone); like payments/subscriptions
-- above, it's only ever touched via the backend's service-role key, so
-- default-deny (no policy) is the correct, safe setting here.
-- No policies on the 10 tables above is intentional: the app only ever
-- touches them via the backend's service-role key (which always bypasses
-- RLS), so this is a pure default-deny against direct public/anon API
-- access, with no legitimate access path to preserve.

CREATE POLICY "public_view_active_businesses" ON public.businesses
  FOR SELECT USING (status = 'active' OR owner_id = auth.uid());
CREATE POLICY "owners_insert_business" ON public.businesses
  FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owners_update_business" ON public.businesses
  FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "public_view_approved_reviews" ON public.reviews
  FOR SELECT USING (status = 'approved' OR reviewer_id = auth.uid());
CREATE POLICY "auth_insert_review" ON public.reviews
  FOR INSERT WITH CHECK (auth.uid() = reviewer_id);
CREATE POLICY "own_notifications" ON public.notifications
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_saved" ON public.saved_businesses
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- SEED DATA
-- ============================================================

-- Plans
INSERT INTO public.plans (tier,name,tagline,price_monthly,price_yearly,color,is_popular,max_businesses,max_products,max_gallery_photos,max_bookings_per_month,max_ai_generations_per_month,has_whatsapp_button,has_analytics,has_advanced_analytics,has_bookings,has_online_ordering,has_custom_template,has_verified_badge,has_priority_listing,has_custom_domain,has_ai_content,has_seo_tools,has_remove_branding,has_api_access,support_level,features_list,sort_order) VALUES
('free','Free','Just browsing',0,0,'#7A7874',false,0,0,0,0,0,false,false,false,false,false,false,false,false,false,false,false,false,false,'none','["Browse directory","Save businesses","Write reviews"]',0),
('starter','Starter','One paid month to get discovered',20,192,'#4E0DAD',false,1,25,25,0,0,true,true,false,false,true,false,false,false,false,false,false,false,false,'email','["1 business mini-website","WhatsApp contact button","25 products/services","25 gallery photos","Online ordering","Basic analytics","Email support","Valid for 1 month — no auto-renewal","Renew or upgrade anytime after"]',1),
('pro','Pro','Grow your business',60,576,'#F6A012',true,3,60,60,100,20,true,true,true,true,true,true,true,true,false,true,true,false,false,'priority','["3 business mini-websites","60 products/services","60 gallery photos","Online ordering","Advanced analytics","Online bookings","Custom template","Verified badge","Priority listing","AI content tools (20/month)","SEO tools","Priority support"]',2),
('enterprise','Enterprise','Scale without limits',200,1920,'#00B09B',false,999,999,999,999,999,true,true,true,true,true,true,true,true,true,true,true,true,true,'dedicated','["Unlimited businesses","Unlimited everything","Online ordering","Custom domain","White-label option","API access","Unlimited AI content","Dedicated account manager","Phone support"]',3);

-- Categories
INSERT INTO public.categories (name,slug,description,icon,template_key,sort_order) VALUES
('Restaurants & Food','restaurants','Local restaurants, chop bars, fast food, and eateries','🍽️','restaurant',1),
('Beauty & Salons','beauty-salons','Hair salons, barbershops, nail studios, and beauty centers','💄','salon',2),
('Hotels & Lodging','hotels','Hotels, guesthouses, hostels, and short-let apartments','🏨','hotel',3),
('Fashion & Clothing','fashion','Fashion designers, boutiques, tailors, and clothing stores','👗','fashion',4),
('Electronics & Tech','electronics','Electronics shops, phone repair, IT services','📱','shop',5),
('Electricians & Plumbers','trades','Electricians, plumbers, carpenters, and skilled tradesmen','🔧','trades',6),
('Supermarkets & Retail','retail','Supermarkets, provision stores, pharmacies','🛒','shop',7),
('Healthcare & Clinics','healthcare','Clinics, pharmacies, dental offices, and health centers','🏥','healthcare',8),
('Education & Tutoring','education','Schools, tutorial centers, vocational training','📚','education',9),
('Auto & Transport','auto','Car dealerships, mechanics, car wash, transport','🚗','auto',10),
('Real Estate','real-estate','Property agents, developers, rental services','🏠','realestate',11),
('Financial Services','finance','Forex bureaus, insurance, accounting, advisors','💰','finance',12),
('Gyms & Fitness','fitness','Gyms, fitness centers, yoga studios, sports clubs','💪','fitness',13),
('Photography & Events','events','Photographers, videographers, event planners','📸','events',14),
('Agriculture & Farming','agriculture','Farm produce, agro-processing, seeds, equipment','🌾','default',15),
('Legal Services','legal','Law firms, notaries, legal consultants','⚖️','default',16);

-- Locations
INSERT INTO public.locations (name,slug,city,region) VALUES
('Accra Central','accra-central','Accra','Greater Accra'),
('East Legon','east-legon','Accra','Greater Accra'),
('Osu','osu','Accra','Greater Accra'),
('Cantonments','cantonments','Accra','Greater Accra'),
('Lapaz','lapaz','Accra','Greater Accra'),
('Madina','madina','Accra','Greater Accra'),
('Tema','tema','Tema','Greater Accra'),
('Kumasi Central','kumasi-central','Kumasi','Ashanti'),
('Adum','adum','Kumasi','Ashanti'),
('Takoradi','takoradi','Takoradi','Western'),
('Cape Coast','cape-coast','Cape Coast','Central'),
('Tamale','tamale','Tamale','Northern'),
('Sunyani','sunyani','Sunyani','Bono'),
('Ho','ho','Ho','Volta');

-- Platform settings
INSERT INTO public.platform_settings (key,value,description) VALUES
('site_name','"SpotGH"','Platform name'),
('site_tagline','"Discover trusted businesses in Ghana, or build your own business website"','Platform tagline'),
('maintenance_mode','false','Enable maintenance mode'),
('allow_free_listing','false','Allow free tier to create businesses'),
('trial_days','7','Free trial days on paid plans'),
('featured_spots_limit','8','Max featured businesses on homepage'),
('max_images_free','0','Gallery limit for free tier'),
('paystack_enabled','true','Enable Paystack payments'),
('email_notifications','true','Enable email notifications'),
('new_business_notification_email','"admin@spotgh.com"','Email for new business alerts');
