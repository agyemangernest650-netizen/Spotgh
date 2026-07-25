# 🏙️ SpotGH — MVC Structure

Ghana's premier multi-tenant business directory & SaaS platform.

## 📁 Structure
```
spotgh-mvc/
├── backend/
│   ├── server.js                  ← Express entry point
│   ├── config/
│   │   ├── env.js                 ← All env vars (validates on startup)
│   │   ├── supabase.js            ← Supabase client
│   │   └── cloudinary.js          ← Cloudinary + multer
│   ├── controllers/
│   │   ├── auth.controller.js     ← Register, login, logout, profile
│   │   ├── business.controller.js ← Full business CRUD + products + health
│   │   ├── upload.controller.js   ← Logo, cover, gallery, avatar uploads
│   │   └── user.controller.js     ← Notifications, referral, analytics
│   ├── middleware/
│   │   ├── auth.middleware.js     ← JWT verify, role guards, ownership check
│   │   ├── error.middleware.js    ← 404 + global error handler
│   │   └── rateLimit.middleware.js← Rate limiters per route type
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── business.routes.js
│   │   ├── upload.routes.js
│   │   ├── user.routes.js
│   │   ├── categories.routes.js
│   │   ├── search.routes.js
│   │   ├── reviews.routes.js
│   │   ├── bookings.routes.js
│   │   ├── payments.routes.js     ← Paystack init + verify + featured spots
│   │   ├── subscriptions.routes.js
│   │   ├── deals.routes.js
│   │   ├── map.routes.js
│   │   ├── ai.routes.js           ← AI description + meta generator
│   │   ├── admin.routes.js
│   │   └── creator.routes.js      ← Super admin panel
│   └── services/
│       ├── supabase.service.js    ← slug gen, notify, audit, health score
│       └── cloudinary.service.js  ← delete, replace, buildGalleryItems
│
├── frontend/
│   ├── index.html                 ← Homepage
│   ├── sw.js                      ← Service worker (PWA)
│   ├── manifest.json              ← PWA manifest
│   ├── pages/
│   │   ├── login.html / register.html / forgot-password.html
│   │   ├── dashboard.html         ← Business owner dashboard
│   │   ├── business.html          ← Business mini-site
│   │   ├── business-edit.html     ← Edit business form
│   │   ├── directory.html         ← Search & browse
│   │   ├── pricing.html           ← Plans + Paystack checkout
│   │   ├── map.html               ← Leaflet.js interactive map
│   │   ├── deals.html             ← Business deals/promotions
│   │   ├── analytics.html         ← Business analytics
│   │   ├── gallery.html           ← Gallery management
│   │   ├── products.html          ← Products & services
│   │   ├── bookings.html          ← Bookings management
│   │   ├── health.html            ← Business health score
│   │   ├── profile.html           ← User profile + referral
│   │   ├── admin.html             ← Admin panel
│   │   └── creator.html           ← Creator super admin
│   └── assets/
│       ├── css/styles.css         ← Complete design system + dark mode
│       └── js/
│           ├── theme.js           ← Dark mode (loads first)
│           ├── api.js             ← API client
│           ├── auth.js            ← Auth helpers
│           ├── main.js            ← UI components, toast, PWA, tour
│           ├── login.js
│           ├── register.js
│           └── dashboard.js
│
├── database/
│   ├── schema.sql                 ← Main Supabase schema
│   └── schema_supplement.sql     ← Deals + messaging tables
│
├── .env.example
├── package.json
└── README.md
```

## 🚀 Quick Start (3 steps)

### 1. Install
```bash
npm install
cp .env.example .env
# Fill in your credentials in .env
```

### 2. Database
1. Go to [supabase.com](https://supabase.com) → New Project
2. Open SQL Editor
3. Run these files in order (paste each one's contents and Run):
   1. `database/schema.sql`
   2. `database/schema_supplement.sql`
   3. `database/schema_v16_leads.sql`
   4. `database/schema_v16_availability.sql`
   5. `database/schema_v16_events.sql`
   6. `database/schema_v16_coupons.sql`
   7. `database/schema_v16_verification.sql`
   8. `database/schema_v17_growth.sql`
   9. `database/schema_v17_trust_safety.sql`
   10. `database/schema_v17_delivery_push.sql`
   11. `database/migrations/014_feature_matrix_update.sql`
   12. `database/migrations/015_pricing_and_own_website.sql`
   13. `database/migrations/016_growth_journey_pricing.sql`

   (`schema_enterprise_features.sql`, `schema_messaging.sql`, `schema_referral_credits.sql`, `schema_saved_products.sql`, `schema_tier1_commerce.sql`, `schema_trial_and_price_update.sql`, and `migrations/002`–`013` are already included inside `schema.sql` — skip those on a fresh install.)

### 3. Run
```bash
npm run dev
# Visit http://localhost:3000
```

## 🌐 Key URLs
| URL | Description |
|-----|-------------|
| `http://localhost:3000` | Homepage |
| `http://localhost:3000/pages/directory.html` | Browse businesses |
| `http://localhost:3000/pages/pricing.html` | Plans & payment |
| `http://localhost:3000/pages/dashboard.html` | Owner dashboard |
| `http://localhost:3000/pages/admin.html` | Admin panel |
| `http://localhost:3000/pages/creator.html` | Creator panel |

## 🔑 Env Variables Required
| Variable | Where to get |
|----------|-------------|
| `SUPABASE_URL` + keys | supabase.com → Project Settings |
| `CLOUDINARY_*` | cloudinary.com → Dashboard |
| `PAYSTACK_*` | paystack.com → Settings → API |
| `JWT_SECRET` | Any random 32+ char string |
| `ARKESEL_API_KEY` | arkesel.com (Ghana SMS) |
| `ANTHROPIC_API_KEY` | console.anthropic.com |

## 💳 Subscription Plans
| Plan | Price | Features |
|------|-------|---------|
| Free | GH₵0 | Browse only |
| Starter | GH₵49/mo | 1 business, WhatsApp button, 10 photos |
| Pro | GH₵99/mo | 3 businesses, bookings, AI tools, analytics |
| Enterprise | GH₵249/mo | Unlimited everything, custom domain |

## 🇬🇭 Made for Ghana