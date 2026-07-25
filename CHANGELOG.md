# SpotGH v16 — What's New

## 1. Run these SQL files in order (Supabase SQL editor), after your existing schema:
1. `database/schema_v16_leads.sql` — Lead Marketplace
2. `database/schema_v16_availability.sql` — business hours + blocked dates
3. `database/schema_v16_events.sql` — events
4. `database/schema_v16_coupons.sql` — coupons (also adds `orders.discount_amount`)
5. `database/schema_v16_verification.sql` — verification requests

## 2. New backend routes (already registered in `server.js`)
- `/api/leads` — post a request, browse, quote, award, cancel
- `/api/availability` — weekly hours, blocked dates, open-slot lookup
- `/api/events` — CRUD + browse + "interested" toggle
- `/api/coupons` — CRUD, validate, redeem
- `/api/verification` — submit docs, admin approve/reject
- `backend/config/cloudinary.js` — added a `verification` uploader (jpg/png/pdf)

## 3. New/updated frontend pages
- `pages/leads.html` + `assets/js/leads.js` — public Lead Marketplace (post + browse + quote)
- `pages/events.html` + `assets/js/events.js` — public events browse/detail
- `pages/events-manager.html` + `assets/js/events-manager.js` — owner event management
- `assets/js/deals-manager.js` — extended with a Coupons section
- `assets/js/checkout.js` — coupon code input + live discount preview
- `assets/js/business-edit.js` — added Verification and Availability (weekly hours + blocked dates) cards
- `assets/js/business.js` — booking form now pulls real open slots from `/api/availability` instead of a free-text time field
- `assets/js/dashboard.js` — quick-link buttons for Events Manager and Lead Marketplace
- `index.html` — added a Leads nav link

## Already existed before this build (no changes needed)
- Verified badge display (`is_verified` column + badge in `business.js`)
- Custom domain connect/verify (`business.controller.js` + UI in `business-edit.js`)
- Business QR code (`business.js`, via api.qrserver.com)
- Business chat (`messages` table/routes)
- Business analytics/insights (`analytics.routes.js`)
- AI content assistant (`ai.routes.js`)

## Notes / follow-ups
- **Lead Marketplace** gating: only businesses on a plan with `has_leads = true` (Pro/Enterprise) can send quotes — this is set automatically by the migration.
- **Verification**: submitting a request doesn't auto-verify; an admin must approve it via `PATCH /api/verification/:id/approve`. You'll want a small admin UI panel for this queue (`GET /api/verification/pending`) — not built yet, wire it into your existing `admin.html`/`admin.js`.
- **Availability**: if a business hasn't set weekly hours yet, the booking widget on their mini-site falls back to a manual time input, so nothing breaks for existing businesses.

---

# v17 — Growth, monetization, trust & safety

## Not code — you'll need to do these yourself
- **Native iOS/Android apps** — a real mobile app needs its own codebase (React Native/Flutter) and app store accounts. Your PWA manifest already lets people "Add to Home Screen," which covers a lot of the same ground without that overhead.
- **Running Google/Facebook/Instagram/TikTok ad campaigns** — these are marketing actions (accounts, budgets, creative) not code. What's built: the *landing surfaces* those ads point to are now stronger (SEO, blog, structured data).
- **Google Business Profile** — set this up directly at business.google.com; nothing to build.
- **Posting social content / YouTube/TikTok videos** — content creation, not code.

## New SQL (run in order after v16's files)
1. `database/schema_v17_growth.sql` — loyalty points, invoices, sponsored listings, blog, newsletter
2. `database/schema_v17_trust_safety.sql` — 2FA columns, fraud flags, support tickets
3. `database/schema_v17_delivery_push.sql` — delivery tracking, push subscriptions

## New dependencies (run `npm install`)
- `web-push` — push notifications
- `bcryptjs` — hashing 2FA backup codes
- (2FA/TOTP itself uses only Node's built-in `crypto` — no new dependency)

## New env vars to set
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` — generate with `npx web-push generate-vapid-keys`; push notifications silently no-op until these are set
- `ANTHROPIC_API_KEY` — already needed for the AI description tool; now also powers `/api/search/smart`

## Feature-by-feature
- **Nearby-by-GPS** — `GET /api/businesses` now actually honors the `lat`/`lng` params your frontend was already sending (it silently ignored them before). Also added `GET /api/map/nearby` for a dedicated "near me" view.
- **AI-powered search** — `POST /api/search/smart` + `pages/smart-search.html`. Parses "a tailor near East Legon under GH₵200" into filters using Claude, then queries your existing tables.
- **Loyalty points** — `/api/loyalty/*`. Auto-earns when a business owner marks an order "completed"; redeemable for a discount. Shows a small balance widget on the business mini-site.
- **Invoices/receipts** — `/api/invoices/*`. Generates a stored invoice from a completed order plus a printable HTML view at `/api/invoices/:id/print` (customer hits "Print → Save as PDF").
- **Vendor sales dashboard** — extends your existing `analytics.routes.js`/`analytics.js` rather than duplicating it; no new files needed there since it already covers revenue/views.
- **Delivery tracking** — `/api/delivery/*`. Owner updates status/rider location, customer polls `/track` for a live status. Uses new columns on `orders`.
- **2FA** — `/api/security/2fa/*`, hooked directly into login (`auth.controller.js`): if enabled, login returns `requires_2fa` + a 5-minute pending token instead of a session, which the frontend exchanges via `/api/auth/login/2fa-complete`. UI lives at `pages/account.html`.
- **Fraud detection** — `services/fraud.service.js`, rule-based (rate of orders per phone number, unusually large orders, thin 5-star reviews). Hooked into order checkout and review creation. Admin review queue at `/api/fraud`.
- **Business comparison** — `pages/compare.html`, compare up to 3 businesses side by side via `?ids=`.
- **Support tickets** — `/api/support/*` + `pages/support.html`. Works for logged-in users and guests (email required).
- **Sponsored/boosted listings** — `/api/sponsored/*`. A business pays for a date-ranged campaign in a category/city; `/api/sponsored/active` is ready for you to inject "Sponsored" rows into directory/search results (not yet wired into `directory.js` — happy to do that next if you want it visually integrated rather than just available via API).
- **Push notifications** — `/api/push/*` + `sw-push.js` service worker + toggle in `pages/account.html`. No-ops safely until VAPID keys are set.
- **Blog (SEO content)** — `/api/blog/*` + `pages/blog.html` + `pages/blog-post.html`. Publish "Top Restaurants in Accra"-style posts with featured business chips; picked up automatically by the sitemap.
- **Newsletter (email marketing)** — `/api/newsletter/*`. Signup form now live in the homepage footer; admin broadcast endpoint sends via your existing email service.
- **WhatsApp share button** — added to every business listing page (distinct from the existing "contact this business" WhatsApp button).
- **Google AdSense** — `assets/js/ads.js` + `ads.txt` + slots on homepage, directory, and business pages. **Replace the placeholder `ca-pub-0000000000000000` in `ads.js` and the publisher ID in `ads.txt`** once you're approved for AdSense — until then, slots render an empty placeholder so nothing looks broken.
- **SEO** — `robots.txt` + dynamic `/sitemap.xml` (lists every active business, category, and published blog post automatically).

## Known scope limits (flagging so nothing's a surprise)
- 2FA backup codes are shown once at setup time; there's no regenerate-codes endpoint yet.

---

# v17.1 — Closed the two remaining gaps

- **Sponsored listings are now visually live** in `directory.js` — a "Sponsored" row renders above the regular grid (page 1 only, filtered to the current category/city), using the same card component as normal listings, with click tracking wired to `/api/sponsored/:id/click`.
- **Admin panels added** to `admin.html`/`admin.js` for the three queues that only had APIs before:
  - **Verification** — approve/reject Ghana Card/business registration submissions, with a link to view the uploaded document
  - **Fraud Flags** — dismiss or confirm rule-based fraud signals
  - **Support Tickets** — list open tickets, click through to the existing thread view to reply

---

# v17.2 — Debug pass

Went through every new/modified file looking for real bugs (not just syntax): traced every require() path, cross-checked every frontend `API.*` call against actual registered backend routes/methods, checked Express route-ordering for shadowing, verified DB column names against actual schema, and reviewed the full login/2FA flow end to end. Found and fixed:

1. **Crash bug** — `business.js` had two `const ld = document.createElement('script')` declarations in the same scope (mine, plus one that already existed for JSON-LD). This threw a hard syntax error and would have broken every business detail page. Removed my duplicate — the pre-existing JSON-LD implementation was actually more complete than what I added (it already covered address, email, geo — my SEO addition earlier this session was redundant).
2. **Account lockout bug (the serious one)** — enabling 2FA in `account.html` would have **locked users out at their next login**. `login.js` never checked for the `requires_2fa` response the backend now sends; it would just receive `{requires_2fa, pending_token}` and try to read a `.token` that isn't there. Added a proper second step to `login.js`: on `requires_2fa`, it now shows a code-entry form (with a backup-code fallback) that calls `POST /api/auth/login/2fa-complete`.
3. **Wrong field name** — `smart-search.js` read `b.categories?.name`, but the `/api/search/smart` endpoint queries the `businesses_with_stats` view, which returns a flat `category_name` column, not a nested `categories` object. Results were rendering with a blank category. Fixed.
4. **Dead code** — `checkNewUser` (the signup-rate fraud heuristic) was written but never called from anywhere. Wired it into `auth.controller.js`'s `register` handler.

Also confirmed (no bug, just noting): `/api/security/2fa/verify-login` and `/api/map/nearby` are working endpoints that aren't currently called by any frontend code — the actual login-2FA flow goes through `/api/auth/login/2fa-complete` instead, and "near me" goes through `/api/businesses?lat=&lng=`. Both extra endpoints are harmless to leave in place if you want them for something else later, but you don't need to wire them in for anything to work.

---

# v18.2 — Role simplification + growth-list gap fill

**Role simplification.** SpotGH now recognizes only 3 roles in application logic: `creator`, `business_owner`, `user`. Removed all `admin`/`super_admin` checks from `auth.middleware.js` (`requireAdmin` now means exactly what `requireCreator` means), 12 route/controller files, and 4 frontend files (`creator.js`, `admin.js`, `main.js`, `business.js`). Postgres can't drop enum values, so `admin`/`super_admin` remain valid in the `user_role` type but are inert — `004_simplify_roles.sql` folds any existing accounts on those roles into `creator`.

**New: Business claim feature.** A business the creator adds on someone's behalf (`is_claimed = false`) now shows a "Claim this Business" banner on its mini-website. Submitting a claim (name, phone, role, optional proof document) creates a `business_claims` row; approving from the new Creator → Moderation tab transfers `owner_id` and promotes the user's role to `business_owner`. See `005_business_claims.sql`, `backend/routes/claims.routes.js`.

**New: Report a business.** Any logged-in user can report a listing (fake, closed, fraud, inappropriate, duplicate, other) from its mini-website. 3+ open reports auto-sets `is_flagged` on the business so it surfaces without digging. Creator → Moderation → Reports lets you resolve or dismiss. See `006_business_reports.sql`, `backend/routes/reports.routes.js`.

**New: Top Rated / New Business badges.** Computed (not stored) via `businesses_with_stats`: `is_top_rated` (avg rating ≥ 4.5 with 10+ approved reviews) and `is_new` (listed in the last 30 days). Now rendered consistently across every business card variant (enterprise/pro/starter in `main.js`, category pages, directory, and the business detail page) — previously only category.js showed these, and even there the CSS classes didn't exist yet. Added the missing CSS.

**New: Price range + search filter fixes.** `price_range` ($ / $$ / $$$ / $$$$) added to businesses (`007_price_range_filter.sql`); `min_rating`, `price_range`, `verified`, `open_now` filters already existed server-side in `/businesses` and `/search` but the directory page UI didn't expose rating or open-now, and had two live bugs: the price dropdown sent `"1"/"2"/"3"` while the backend expects `$`/`$$`/`$$$`/`$$$$` (silently matched nothing), and the city dropdown sent `?city=` while both endpoints read `?location=` (city filter was a no-op). Fixed both, added rating and open-now controls.

**Also fixed:** `.btn--success` was used across `admin.js`, `bookings.js`, and `creator.js` but was never defined in `styles.css` — those "Approve/Confirm" buttons never got their green styling. Added the missing rule.




---

# v22 — Franchise system + feature matrix rework

## New: Franchise system
Group multiple businesses under one owner/brand (e.g. "Royal Hotel" with locations in Accra, Kumasi, Takoradi) for shared branding and aggregated cross-location analytics. See `013_franchise_system.sql`, `backend/routes/franchise.routes.js`.
- `/api/franchises` — create, list "mine" with aggregated stats (views, WhatsApp clicks, bookings, avg rating), get detail, update, delete
- Add/remove one of your own businesses to a franchise
- Franchise logo upload + one-click "apply branding" to push logo/theme color to every member location
- Deleting a franchise ungroups its businesses rather than deleting them

## Feature matrix rework (`014_feature_matrix_update.sql`)
Plan tiers now line up with a single matrix:

| Feature | Free | Starter | Pro | Enterprise |
|---|---|---|---|---|
| Business Listing | ✅ | ✅ | ✅ | ✅ |
| Business Website | ❌ | ✅ | ✅ | ✅ |
| AI Tools | ❌ | ✅ | ✅ | ✅ |
| Analytics | ❌ | ✅ | ✅ | ✅ |
| Featured Listing | ❌ | ❌ | ✅ | ✅ |
| Booking | ❌ | ❌ | ✅ | ✅ |
| Franchise | ❌ | ❌ | ✅ | ✅ |
| Custom Domain | ❌ | ❌ | ✅ | ✅ |
| API Access | ❌ | ❌ | ❌ | ✅ |

- Free now gets `max_businesses = 1` (previously 0) — a real basic listing, just without a mini-website.
- Two new plan columns: `has_website`, `has_franchise`.
- **New: every brand-new owner's first-ever business now gets a free 30-day Starter trial** (mini-website, AI tools, analytics) at business-creation time — no card required. Previously the trial only fired as a fallback once someone hit the Free plan's business cap, which with the old `max_businesses = 0` meant it accidentally fired on every first listing; with Free now allowing 1 listing, it wouldn't have fired at all without this change, so listing #1 would've silently gotten a bare listing with no way to try the website.

## Bugs found and fixed in this pass
1. **Franchise creation had no plan gate at all** — any account on any tier, including Free, could create a franchise and group businesses under it. Added a check that the caller owns at least one business on a plan with `has_franchise`.
2. **Sponsored/featured listing campaigns had no plan gate** — `POST /api/sponsored/business/:businessId` let any tier buy a featured-listing campaign. Added a `has_priority_listing` check.
3. **Stale error message** — custom domain's 403 said "Enterprise plan feature"; it's Pro+ under the new matrix. Fixed the copy.
4. **Mini-website fields left editable on Free** — `business.controller.js` update() would silently let a Free-tier (no-website) listing set `template_key`/`theme_color`/`custom_css`. Now strips those fields from the update when the plan lacks `has_website`, rather than erroring on the whole request.
5. Admin plan-editor allowlist (`creator.routes.js`) was missing the two new columns (`has_website`, `has_franchise`) — added so they're actually editable from the panel.

---

# v22.1 — Tier-based templates + listing clarification

## Listing vs mini-website: same record, one automatic listing
Confirmed by code inspection: a business is a single database row shared by the directory listing AND its mini-site page (`business.html?slug=...`). There's no separate "list it" step — once an owner fills out the business form and an admin flips `status` to `active` (all directory/search queries filter `status = 'active'`), it automatically appears in directory search results and its individual page goes live at the same time. The owner never re-lists it separately.

## Tier-based templates (previously a dead flag)
`has_custom_template` existed in the `plans` table and was advertised on the pricing page ("Custom template" under Pro) but was **never actually checked anywhere in the code** — same class of bug as `has_website` last time. Wired it up, and split it apart from `has_website` since they're different things:
- **`template_key`** (restaurant/salon/shop/etc. — drives content layout: section labels, what's led with) stays free for every tier, since it reflects the business's category, not a paid perk.
- **`theme_color` / `accent_color` / `custom_css`** (visual branding) now require `has_custom_template` specifically:
  - **Free** (no `has_website`) — basic listing, no customization at all, default look.
  - **Starter** (`has_website` but no `has_custom_template`) — full mini-website, category-appropriate layout, but locked to the default SpotGH brand color. Submitting a custom color/CSS is silently dropped rather than erroring.
  - **Pro / Enterprise** (`has_custom_template`) — full color/CSS customization respected.
- `getBySlug` now returns `has_website` and `has_custom_template` on the business payload so the frontend can render the right tier; `business.js`'s `accent`/`accentDark` only honor a stored `theme_color` when `has_custom_template` is true.

---

# v22.2 — New pricing + mandatory "already have a website?" question

## New pricing (`015_pricing_and_own_website.sql`)
- Starter: ₵20/mo (unchanged)
- Pro renamed **Premium** in customer-facing copy: ₵50/mo (was ₵60)
- Enterprise: ₵100/mo (was ₵200)
- Yearly prices recalculated at the same ~9.6x (20%-off) multiplier the plans already used. The `tier` column itself stays `'pro'` internally — renaming it would touch every `tier === 'pro'` check across the codebase for no functional gain, so only the `name` field changed.

## New: "Do you already have a website?" is now a required question at signup
Previously the Website field on the business form was a plain optional text input with no validation. Now:
- **Required, not optional** — `business.validators.js` rejects creation if `has_own_website` isn't explicitly answered.
- **Yes** → must supply a URL, validated for format (`isURL`) server-side and client-side. SpotGH also does a best-effort HEAD request (`checkUrlReachable`, 5s timeout) to confirm it's live — this is informational (`own_website_verified` on the business record), not a hard gate, since legitimate sites can block bot HEAD requests.
- **No** → nothing else required; SpotGH generates the mini-website exactly as before (tier-based template from v22.1).
- Editable later too — changing the answer or URL on `PATCH /api/businesses/:id` re-runs the reachability check.
- New columns: `businesses.has_own_website` (backfilled `false` on existing rows), `businesses.own_website_verified`.

---

# v22.2.1 — Error check / validator fix

Ran a full syntax sweep (`node --check`) across every backend and frontend JS file — no syntax errors in the codebase.

Found and fixed one real logic bug from the v22.2 change: `business.validators.js` used `.isBoolean()` and `.equals('true')`, which both call validator.js's `assertString()` internally and throw a `TypeError` (or silently fail to match) on an actual JS boolean rather than the string `'true'`. Since `business-edit.js` sends `has_own_website` as a real boolean in the JSON body — not the string `'true'` — this meant the "website URL required when yes" rule could either crash the request or silently never fire. Replaced with plain `custom()`/`if(fn)` predicate functions that accept both a real boolean and a `'true'`/`'false'` string, so it's robust either way.

---

# v22.3 — Two-track pricing + "growth journey" plan names

## Two-track pricing (`016_growth_journey_pricing.sql`)
Every paid tier now has two prices:
- **Full price** (`price_monthly`/`price_yearly`) — for a business that needs SpotGH to build & host its mini-website (unchanged from v22.2: Standard ₵20, Premium ₵50, Enterprise ₵100).
- **Own-website price** (`price_monthly_own_website`/`price_yearly_own_website`) — a ~25-30% discount for a business that already has its own website and just wants the directory listing + plan perks, since there's no mini-website to build. Set as **Standard ₵15, Premium ₵35, Enterprise ₵70** — adjust these in the migration or from the admin plan editor if you want a different discount, these were a starting-point guess.
- `payments.routes.js` now looks up the business's `has_own_website` flag (set at signup — see v22.2) via a shared `resolvePlanPrice()` helper and charges the matching track automatically on both `/initialize` and `/renew`. Falls back to the full price if there's no business yet or the discount columns are unset.
- The pricing page has a new "Build me a mini-website" / "I already have a website" toggle next to the monthly/yearly one, so the displayed price matches what they'll actually be charged.

## "Growth journey" plan naming
Plan names/taglines now tell a story instead of just labeling a price tier:

| Tier key | Name | Tagline |
|---|---|---|
| free | Free | Get Found |
| starter | **Standard** (renamed from Starter) | Grow Your Business ⭐ Most Popular |
| pro | Premium | Become a Market Leader |
| enterprise | Enterprise | Scale Across Multiple Locations |

- "Most Popular" moved from Premium to Standard (`is_popular` flag flipped).
- Tier keys (`free`/`starter`/`pro`/`enterprise`) are unchanged internally, same reasoning as the Pro→Premium rename in v22.2 — only the customer-facing `name`/`tagline` changed.
- Updated all hardcoded "Starter" copy on the pricing page (intro paragraph, FAQ) to "Standard". Searched the whole codebase for any other string comparisons against the old `'Starter'` display name — none found, so nothing else breaks.

---

# v22.4 — Trust & Growth dashboard

## Error check / debug pass
Ran a full `node --check` sweep across all 115 backend/frontend JS files — no syntax errors. Found and fixed one real bug: the site-wide "favorite" heart button on business cards (`main.js`) called `POST/DELETE /api/users/favorites/:id` (plural), but the backend only mounts `/api/user/favorites/:id` (singular, `user.routes.js`). Every click on that button, on every card, anywhere on the site, was silently 404ing. Fixed to the singular path.

Also noticed `about.html`, `help.html`, and `status.html` existed but weren't linked from anywhere — added a "Company" footer column (About Us / Help Center / System Status) alongside Legal on every page that has the full footer.

## New: Customer Trust Score
`GET /api/user/analytics/:businessId` now returns a `trust` object — a 0–100 composite score shown on every plan tier (not gated, since it's meant to nudge owners toward completing their profile):
- Verified status (25 pts)
- Profile completeness (25 pts) — description, logo, cover photo, 5+ gallery photos, phone, WhatsApp, customized business hours, and at least one review, equally weighted
- Review response rate (20 pts) — % of approved reviews with an `owner_reply`; defaults to half-credit with zero reviews so a brand-new business isn't penalized for something it hasn't had the chance to do yet
- Average rating (20 pts)
- Recent activity (10 pts) — any views/orders in the selected period, or a profile update in the last 30 days

Banded as Excellent (80+) / Good (60+) / Fair (40+) / Needs Improvement (<40).

## New: Guided Growth checklist
Same endpoint returns a `checklist` array: complete your profile, upload 10 photos, get verified, add business hours, publish your website, share your listing. "Add business hours" is considered done once the owner's `operating_hours` differ from the default template (not just present, since every business starts with the same default hours). "Share your listing" checks for at least one `share` analytics event on the business.

## New: Achievement badges
Also returned as a `badges` array — 🌟 New Business, 📸 Photo Expert (10+ photos), 💬 Fast Responder (3+ reviews, 80%+ replied), ⭐ Highly Rated (reuses the existing `is_top_rated` view flag), 🔥 Trending (views up 50%+ period-over-period), 🏆 Trusted Business (verified + 4★+ average + 10+ reviews).

## Note on "Business Comparison"
This-month-vs-last-month deltas (views, WhatsApp clicks, calls, orders) already existed from the advanced-analytics `pctChange()` logic added earlier — no change needed there beyond what's listed above. Direction-request tracking (`direction_click`) and photo/engagement tips were likewise already live; only the "N more photos needed" and "reply to your reviews" phrasing were added to match the requested copy.

`frontend/assets/js/analytics.js` renders all three (trust score, checklist, badges) as new cards on both the basic and advanced dashboard views.
