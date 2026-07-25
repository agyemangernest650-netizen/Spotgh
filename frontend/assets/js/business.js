// assets/js/business.js
document.addEventListener('DOMContentLoaded', async () => {
  loadComponents();

  const slug = new URLSearchParams(location.search).get('slug');
  if (!slug) { location.href = '/pages/directory.html'; return; }

  const main = document.getElementById('pageMain');
  main.innerHTML = `<div class="container" style="padding:3rem 1rem;text-align:center">
    <div class="spinner" style="margin:0 auto 1rem"></div><p>Loading…</p></div>`;

  try {
    const { business: biz, gallery, productsServices, similarBusinesses, deals, staff, beforeAfter } = await API.get(`/businesses/slug/${slug}`);
    document.title = `${biz.name} | SpotGH`;

    // Note: views are already recorded server-side in the getBySlug controller

    const user     = Auth.getUser();
    const isOwner  = user && biz.owner_id === user.id;
    const tier     = biz.subscription_tier || 'free';
    const hasBkng  = !!biz.has_bookings;
    const hasOrdering = !!biz.has_online_ordering && productsServices?.some(p => p.type === 'product');
    const hasProds = productsServices?.length > 0;
    const hasAmenities = biz.amenities?.length > 0;
    const hasCustomTemplate = !!biz.has_custom_template;
    const accent   = hasCustomTemplate && biz.theme_color ? biz.theme_color : 'var(--clr-primary)';
    const accentDark = hasCustomTemplate ? (shadeColor(biz.theme_color, -15) || 'var(--clr-primary-dark)') : 'var(--clr-primary-dark)';

    // Template variants — what a category's mini-website leads with.
    // template_key comes from the business's category (set at onboarding).
    const TEMPLATES = {
      restaurant: { productLabel: 'Menu', productIcon: 'fa-solid fa-utensils', leadWith: 'products' },
      shop:       { productLabel: 'Products', productIcon: 'fa-solid fa-box', leadWith: 'products' },
      retail:     { productLabel: 'Products', productIcon: 'fa-solid fa-box', leadWith: 'products' },
      salon:      { productLabel: 'Services', productIcon: 'fa-solid fa-spa', leadWith: 'book', teamLabel: 'Our Stylists' },
      fitness:    { productLabel: 'Services', productIcon: 'fa-solid fa-dumbbell', leadWith: 'book' },
      healthcare: { productLabel: 'Services', productIcon: 'fa-solid fa-stethoscope', leadWith: 'book', teamLabel: 'Our Doctors' },
      trades:     { productLabel: 'Services', productIcon: 'fa-solid fa-screwdriver-wrench', leadWith: 'book', teamLabel: 'Our Mechanics' },
      events:     { productLabel: 'Packages', productIcon: 'fa-solid fa-camera', leadWith: 'book' },
      hotel:      { productLabel: 'Rooms & Rates', productIcon: 'fa-solid fa-bed', leadWith: 'amenities' },
      fashion:    { productLabel: 'Collection', productIcon: 'fa-solid fa-shirt', leadWith: 'gallery' },
      education:  { productLabel: 'Courses & Programs', productIcon: 'fa-solid fa-graduation-cap', leadWith: 'book', teamLabel: 'Our Instructors' },
      auto:       { productLabel: 'Services', productIcon: 'fa-solid fa-car', leadWith: 'book', teamLabel: 'Our Mechanics' },
      realestate: { productLabel: 'Listings', productIcon: 'fa-solid fa-house', leadWith: 'products' },
      finance:    { productLabel: 'Services', productIcon: 'fa-solid fa-sack-dollar', leadWith: 'book', teamLabel: 'Our Advisors' },
      default:    { productLabel: 'Products', productIcon: 'fa-solid fa-box', leadWith: 'about' },
    };
    const tplKey = TEMPLATES[biz.template_key] ? biz.template_key : 'default';
    const tpl = TEMPLATES[tplKey];

    // Persistent owner banner — replaces the old floating "Edit" button that
    // sat in the cover photo's corner (easy to miss, especially on mobile,
    // and gave no sense of whether the mini-site was actually live). This
    // sits above the fold on every load so an owner always knows at a
    // glance: (1) they're looking at their own live site, (2) whether it's
    // actually published or still pending/suspended, and (3) has one-tap
    // access to editing and the full dashboard.
    const STATUS_INFO = {
      active:    { label: '🟢 Live',              badge: 'badge--success' },
      pending:   { label: '🟡 Pending review',    badge: 'badge--warning' },
      suspended: { label: '🔴 Suspended',         badge: 'badge--danger'  },
      rejected:  { label: '🔴 Not approved',      badge: 'badge--danger'  },
    };
    const ownerBanner = isOwner ? (() => {
      const si = STATUS_INFO[biz.status] || { label: biz.status || 'Unknown', badge: 'badge--ghost' };
      return `
      <div style="position:sticky;top:var(--navbar-h,64px);z-index:20;background:var(--clr-surface-1);border-bottom:1px solid var(--clr-border);box-shadow:var(--shadow-sm,0 1px 4px rgba(0,0,0,.06))">
        <div class="container" style="display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;padding:.6rem 1rem">
          <i class="fa-solid fa-eye" style="color:var(--clr-text-2)"></i>
          <span style="font-size:.8rem;font-weight:600;color:var(--clr-text-2)">You're viewing your live mini-website</span>
          <span class="badge ${si.badge}">${si.label}</span>
          <span id="ownerBannerStats" style="font-size:.8rem;color:var(--clr-text-2)" hidden></span>
          <div style="margin-left:auto;display:flex;gap:.5rem;flex-wrap:wrap">
            <a href="/pages/dashboard.html" class="btn btn--outline btn--sm"><i class="fa-solid fa-gauge"></i> Dashboard</a>
            <a href="/pages/business-edit.html?id=${biz.id}" class="btn btn--primary btn--sm"><i class="fa-solid fa-pen"></i> Edit</a>
          </div>
        </div>
      </div>`;
    })() : '';

    main.innerHTML = `
      ${ownerBanner}
      <div class="container" style="padding:.85rem 1rem;font-size:.8rem;color:var(--clr-text-3)">
        <a href="/" style="color:var(--clr-text-3);text-decoration:none">Home</a>
        <span style="margin:0 .4rem">/</span>
        <a href="/pages/directory.html" style="color:var(--clr-text-3);text-decoration:none">Businesses</a>
        ${biz.category_name ? `<span style="margin:0 .4rem">/</span><a href="/pages/directory.html?category=${biz.category_slug||''}" style="color:var(--clr-text-3);text-decoration:none">${biz.category_name}</a>` : ''}
        <span style="margin:0 .4rem">/</span>
        <span style="color:var(--clr-text-2);font-weight:600">${biz.name}</span>
      </div>
      <!-- Hero / Cover -->
      <div style="position:relative;height:clamp(180px,30vw,320px);background:var(--clr-surface-2);overflow:hidden">
        ${biz.cover_url
          ? `<img src="${biz.cover_url}" alt="Cover" style="width:100%;height:100%;object-fit:cover">`
          : `<div style="width:100%;height:100%;background:linear-gradient(135deg,${accent},${accentDark})"></div>`}
        <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.5),transparent)"></div>
      </div>

      <div class="container" style="max-width:900px;margin:0 auto;padding:0 1rem 4rem">
        <!-- Profile strip -->
        <div style="display:flex;align-items:flex-end;gap:1rem;margin-top:-3rem;margin-bottom:1.5rem;flex-wrap:wrap">
          <div style="width:96px;height:96px;border-radius:16px;border:4px solid var(--clr-surface-1);overflow:hidden;background:var(--clr-surface-2);flex-shrink:0;box-shadow:0 4px 16px rgba(0,0,0,.15)">
            ${biz.logo_url
              ? `<img src="${biz.logo_url}" style="width:100%;height:100%;object-fit:cover">`
              : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:2.5rem">${biz.category_icon || '🏢'}</div>`}
          </div>
          <div style="flex:1;min-width:0;padding-bottom:.5rem">
            <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
              <h1 style="font-size:clamp(1.25rem,4vw,1.75rem);font-weight:800;margin:0">${biz.name}</h1>
              ${biz.is_verified ? '<span class="badge badge--success" title="Verified"><i class="fa-solid fa-circle-check"></i> Verified</span>' : ''}
              ${biz.is_featured ? '<span class="badge badge--primary">⭐ Featured</span>' : ''}
              ${biz.is_top_rated ? '<span class="badge" style="background:#F6A012;color:#fff" title="Top Rated"><i class="fa-solid fa-trophy"></i> Top Rated</span>' : ''}
              ${biz.is_new ? '<span class="badge" style="background:#8B5CF6;color:#fff" title="New Business"><i class="fa-solid fa-sparkles"></i> New</span>' : ''}
              ${openStatusBadge(biz.operating_hours)}
            </div>
            <div style="color:var(--clr-text-2);font-size:.875rem;margin-top:.25rem">
              ${biz.category_icon || ''} ${biz.category_name || ''}
              ${biz.city ? ` · <i class="fa-solid fa-location-dot"></i> ${biz.city}` : ''}
            </div>
          </div>
          <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-self:flex-end;padding-bottom:.5rem" id="bizActions">
            ${biz.whatsapp ? `<a href="https://wa.me/${biz.whatsapp.replace(/\D/g,'')}" class="btn btn--whatsapp" target="_blank" rel="noopener" onclick="trackAction('whatsapp_click')"><i class="fab fa-whatsapp"></i> WhatsApp</a>` : ''}
            ${biz.phone ? `<a href="tel:${biz.phone}" class="btn btn--outline" onclick="trackAction('call_click')"><i class="fa-solid fa-phone"></i> Call</a>` : ''}
            ${biz.menu_pdf_url ? `<a href="${biz.menu_pdf_url}" target="_blank" rel="noopener" class="btn btn--outline"><i class="fa-solid fa-file-pdf"></i> Menu</a>` : ''}
            <button class="btn btn--outline" onclick="toggleQuoteForm()"><i class="fa-solid fa-file-invoice"></i> ${tplKey === 'fashion' ? 'Custom Order Request' : 'Get a Quote'}</button>
            <button class="btn btn--ghost" id="saveBtn" onclick="toggleSave()">
              <i class="${biz.is_saved ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
            </button>
            <a href="#" class="btn btn--outline" style="color:#25D366;border-color:#25D366" onclick="shareOnWhatsApp();return false;" title="Share this listing on WhatsApp"><i class="fa-brands fa-whatsapp"></i> Share</a>
            <button class="btn btn--ghost" onclick="shareBusiness()"><i class="fa-solid fa-share-nodes"></i></button>
            <button class="btn btn--ghost" onclick="toggleQR()"><i class="fa-solid fa-qrcode"></i></button>
            <button class="btn btn--ghost" id="reportBtn" onclick="toggleReportForm()" title="Report this business"><i class="fa-solid fa-flag"></i></button>
          </div>
        </div>

        <!-- Trust signals -->
        <div style="display:flex;flex-wrap:wrap;gap:1.25rem;padding:.85rem 1rem;margin-bottom:1.25rem;background:var(--clr-surface-2);border-radius:var(--radius-md);font-size:.8rem;color:var(--clr-text-2)">
          ${biz.created_at ? `<span title="Joined ${new Date(biz.created_at).toLocaleDateString()}"><i class="fa-solid fa-cake-candles"></i> ${yearsOnSpotGH(biz.created_at)}</span>` : ''}
          <span title="Total profile views"><i class="fa-solid fa-eye"></i> ${(biz.view_count || 0).toLocaleString()} view${biz.view_count === 1 ? '' : 's'}</span>
          ${biz.updated_at ? `<span title="Last profile update"><i class="fa-solid fa-clock-rotate-left"></i> Updated ${timeAgo(biz.updated_at)}</span>` : ''}
          ${biz.is_claimed ? '<span title="An owner manages this listing"><i class="fa-solid fa-user-check"></i> Owner-managed</span>' : '<span title="Not yet claimed by an owner"><i class="fa-regular fa-user"></i> Unclaimed listing</span>'}
        </div>

        ${!biz.is_claimed ? `
        <div class="card" style="padding:1rem 1.25rem;margin-bottom:1.25rem;display:flex;align-items:center;gap:1rem;flex-wrap:wrap;border-left:4px solid var(--clr-primary)">
          <div style="flex:1;min-width:220px">
            <strong>Is this your business?</strong>
            <p style="color:var(--clr-text-2);font-size:.875rem;margin-top:.15rem">Claim this listing to manage your profile, reply to reviews, and see your analytics.</p>
          </div>
          <button class="btn btn--primary btn--sm" onclick="toggleClaimForm()"><i class="fa-solid fa-hand"></i> Claim this Business</button>
        </div>` : ''}

        <!-- Claim this Business panel -->
        <div class="card" id="claimPanel" hidden style="padding:1.25rem;margin-bottom:1.25rem">
          <h3 style="font-size:1rem;font-weight:700;margin-bottom:1rem">Claim this Business</h3>
          <div style="display:flex;flex-direction:column;gap:.75rem;max-width:480px">
            <input id="clName" class="input" placeholder="Your full name *">
            <input id="clPhone" class="input" placeholder="Phone number *">
            <input id="clRole" class="input" placeholder="Your role at this business (e.g. Owner, Manager)">
            <textarea id="clMessage" class="input" rows="3" placeholder="Anything that helps us verify you own this business (optional)"></textarea>
            <input id="clProof" type="file" accept="image/*,.pdf">
            <small style="color:var(--clr-text-2)">Optional: business registration, Ghana Card, or a utility bill in the business name.</small>
            <button class="btn btn--primary" onclick="submitClaim()">Submit Claim</button>
          </div>
        </div>

        <!-- Report this Business panel -->
        <div class="card" id="reportPanel" hidden style="padding:1.25rem;margin-bottom:1.25rem">
          <h3 style="font-size:1rem;font-weight:700;margin-bottom:1rem">Report this Business</h3>
          <div style="display:flex;flex-direction:column;gap:.75rem;max-width:480px">
            <select id="rpReason" class="input">
              <option value="">Select a reason *</option>
              <option value="fake">Fake or scam listing</option>
              <option value="closed">Permanently closed</option>
              <option value="fraud">Fraudulent activity</option>
              <option value="inappropriate">Inappropriate content</option>
              <option value="duplicate">Duplicate listing</option>
              <option value="other">Other</option>
            </select>
            <textarea id="rpDetails" class="input" rows="3" placeholder="More details (optional)"></textarea>
            <button class="btn btn--primary" onclick="submitReport()">Submit Report</button>
          </div>
        </div>

        <!-- QR / vanity link panel -->
        <div class="card" id="qrPanel" hidden style="padding:1.25rem;margin-bottom:1.25rem;display:flex;align-items:center;gap:1.25rem;flex-wrap:wrap">
          <img id="qrImg" alt="QR code" style="width:120px;height:120px;border-radius:8px;background:#fff;padding:.5rem">
          <div style="flex:1;min-width:200px">
            <div style="font-size:.8rem;color:var(--clr-text-2);margin-bottom:.35rem">Scan or share this link to this business's mini-website:</div>
            <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center">
              <code id="vanityLink" style="font-size:.8rem;background:var(--clr-surface-2);padding:.35rem .6rem;border-radius:6px;word-break:break-all"></code>
              <button class="btn btn--ghost btn--sm" onclick="copyVanityLink()"><i class="fa-solid fa-copy"></i> Copy</button>
            </div>
          </div>
        </div>

        <!-- Request a Quote / Custom Order panel -->
        <div class="card" id="quotePanel" hidden style="padding:1.25rem;margin-bottom:1.25rem">
          <h3 style="font-size:1rem;font-weight:700;margin-bottom:1rem">${tplKey === 'fashion' ? 'Custom Order / Tailoring Request' : 'Request a Quote'}</h3>
          <div style="display:flex;flex-direction:column;gap:.75rem;max-width:480px">
            <input id="qName" class="input" placeholder="Your name *">
            <input id="qPhone" class="input" placeholder="Phone number *">
            <input id="qEmail" class="input" type="email" placeholder="Email (optional)">
            <textarea id="qDetails" class="input" rows="3" placeholder="${tplKey === 'fashion' ? 'Describe what you\'d like made (item, fabric, style, deadline) *' : 'What do you need a quote for? *'}" style="resize:vertical"></textarea>
            ${tplKey === 'fashion' ? `
            <textarea id="qMeasurements" class="input" rows="3" placeholder="Your measurements (chest/bust, waist, hips, height, etc. — optional, but speeds things up)" style="resize:vertical"></textarea>
            ${biz.measurement_guide ? `<div style="font-size:.78rem;color:var(--clr-text-3)"><i class="fa-solid fa-circle-info"></i> Need help measuring? <a href="#" onclick="document.querySelector('[data-tab=about]')?.click();return false" style="color:var(--clr-primary)">See our measurement guide</a></div>` : ''}
            ` : ''}
            <button class="btn btn--primary" id="qSubmit" onclick="submitQuote('${biz.id}')">Send Request</button>
          </div>
        </div>

        <!-- Rating bar -->
        ${biz.avg_rating > 0 ? `
        <div class="card" style="padding:.75rem 1rem;margin-bottom:1.25rem;display:flex;align-items:center;gap:1rem;flex-wrap:wrap">
          <div style="font-size:2rem;font-weight:800;color:var(--clr-gold)">${parseFloat(biz.avg_rating).toFixed(1)}</div>
          <div>
            <div style="color:var(--clr-gold);font-size:1.1rem">${renderStars(biz.avg_rating)}</div>
            <div style="font-size:.8rem;color:var(--clr-text-2)">${biz.review_count || 0} review${biz.review_count !== 1 ? 's' : ''}</div>
          </div>
        </div>` : ''}

        <!-- Active deals -->
        ${deals?.length ? `
        <div style="display:flex;flex-direction:column;gap:.5rem;margin-bottom:1.25rem">
          ${deals.map(d => {
            const exp = d.expires_at ? new Date(d.expires_at) : null;
            const countdownId = `cd-${Math.random().toString(36).slice(2,8)}`;
            return `
            <div class="card" style="padding:.85rem 1rem;display:flex;align-items:center;gap:.75rem;border-left:3px solid var(--clr-primary)">
              <span style="font-size:1.3rem">🎉</span>
              <div style="flex:1">
                <div style="font-weight:700;font-size:.9rem">${d.title}</div>
                ${d.description ? `<div style="font-size:.8rem;color:var(--clr-text-2)">${d.description}</div>` : ''}
                ${exp ? `<div style="font-size:.75rem;color:var(--clr-warning);margin-top:.25rem;font-weight:600">⏳ Ends in: <span id="${countdownId}">...</span></div>` : ''}
              </div>
              ${d.discount_text ? `<span class="badge badge--primary">${d.discount_text}</span>` : ''}
            </div>`;
          }).join('')}
        </div>` : ''}

        <!-- Tabs (order/labels driven by the category's mini-website template) -->
        <div style="display:flex;gap:0;border-bottom:2px solid var(--clr-border);margin-bottom:1.5rem;overflow-x:auto" id="tabBar">
          ${(() => {
            const allTabs = {
              about:     { id:'about',     label:'About',         icon:'fa-solid fa-circle-info' },
              products:  hasProds ? { id:'products', label:tpl.productLabel, icon:tpl.productIcon } : null,
              book:      hasBkng  ? { id:'book',     label:'Book',          icon:'fa-solid fa-calendar-check' } : null,
              amenities: (tplKey==='hotel' && hasAmenities) ? { id:'amenities', label:'Amenities', icon:'fa-solid fa-list-check' } : null,
              team:      (tpl.teamLabel && staff?.length) ? { id:'team', label:tpl.teamLabel, icon:'fa-solid fa-user-group' } : null,
              gallery:   (gallery?.length || beforeAfter?.length) ? { id:'gallery', label:'Gallery', icon:'fa-solid fa-images' } : null,
              message:   (Auth.getUser() && !isOwner) ? { id:'message', label:'Message', icon:'fa-solid fa-comment' } : null,
              reviews:   { id:'reviews',  label:'Reviews', icon:'fa-solid fa-star' },
            };
            // Lead with the tab the template promises, then fall back to a sensible reading order.
            const order = [tpl.leadWith, 'about', 'amenities', 'team', 'products', 'book', 'gallery', 'message', 'reviews'];
            const seen = new Set();
            const tabs = order.map(k => allTabs[k]).filter(t => t && !seen.has(t.id) && seen.add(t.id));
            window._bizTabOrder = tabs.map(t => t.id);
            return tabs.map((t,i) => `
            <button class="tab-btn ${i===0?'active':''}" data-tab="${t.id}"
              style="padding:.75rem 1rem;border:none;background:none;cursor:pointer;font-family:inherit;font-size:.875rem;font-weight:600;color:${i===0?'var(--clr-primary)':'var(--clr-text-2)'};border-bottom:2px solid ${i===0?'var(--clr-primary)':'transparent'};margin-bottom:-2px;white-space:nowrap;transition:all .2s">
              <i class="${t.icon}" style="margin-right:.35rem"></i>${t.label}
            </button>`).join('');
          })()}
        </div>

        <div id="bizAdSlot" style="margin:1.25rem 0"></div>

        <!-- Tab content -->
        <div id="tabContent">
          ${(() => {
            const lead = window._bizTabOrder[0];
            if (lead === 'products') return renderProducts(productsServices || [], hasOrdering, biz.id);
            if (lead === 'book')     return renderBookingForm(biz);
            if (lead === 'message')  return `<div id="messageTabContent">Loading…</div>`;
            if (lead === 'amenities')return renderAmenities(biz);
            if (lead === 'team')     return renderTeam(staff || [], tpl.teamLabel);
            if (lead === 'gallery')  return renderGallery(gallery || [], beforeAfter || []);
            return renderAbout(biz);
          })()}
        </div>

        <!-- Similar businesses -->
        ${similarBusinesses?.length ? `
        <div style="margin-top:2.5rem">
          <h3 style="font-size:1.1rem;font-weight:700;margin-bottom:1rem">You Might Also Like</h3>
          <div class="grid grid--3">
            ${similarBusinesses.map(b => renderBusinessCard(b)).join('')}
          </div>
        </div>` : ''}

        <!-- Powered by badge — hidden on Enterprise plans with branding removal -->
        ${!biz.hide_branding ? `
        <div style="text-align:center;padding:1.5rem 0;margin-top:1rem;border-top:1px solid var(--clr-border)">
          <a href="/" style="font-size:.8rem;color:var(--clr-text-3);text-decoration:none">Powered by Spot<strong style="color:var(--clr-primary)">GH</strong></a>
        </div>` : ''}
      </div>`;

    if (hasOrdering && window._bizTabOrder[0] === 'products') refreshCartBar(biz.id);
    insertAdSlot('bizAdSlot', '3333333333');
    if (Auth.isLoggedIn()) loadLoyaltyWidget(biz.id);

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => {
          b.classList.remove('active');
          b.style.color = 'var(--clr-text-2)';
          b.style.borderBottomColor = 'transparent';
        });
        btn.classList.add('active');
        btn.style.color = 'var(--clr-primary)';
        btn.style.borderBottomColor = 'var(--clr-primary)';

        const tab = btn.dataset.tab;
        const content = document.getElementById('tabContent');
        if (tab === 'about')     content.innerHTML = renderAbout(biz);
        if (tab === 'products')  { content.innerHTML = renderProducts(productsServices || [], hasOrdering, biz.id); if (hasOrdering) refreshCartBar(biz.id); }
        if (tab === 'gallery')   content.innerHTML = renderGallery(gallery || [], beforeAfter || []);
        if (tab === 'book')      content.innerHTML = renderBookingForm(biz);
        if (tab === 'team')      content.innerHTML = renderTeam(staff || [], tpl.teamLabel);
        if (tab === 'message')   { content.innerHTML = `<div id="messageTabContent">Loading…</div>`; loadMessageThread(biz.id); }
        if (tab === 'amenities') content.innerHTML = renderAmenities(biz);
        if (tab === 'reviews')   loadReviews(biz.id, content);
      });
    });

    // Save toggle
    window.toggleSave = async () => {
      if (!Auth.requireAuth()) return;
      try {
        const { saved } = await API.post(`/businesses/saved/${biz.id}`);
        const btn = document.getElementById('saveBtn');
        btn.innerHTML = `<i class="${saved ? 'fa-solid' : 'fa-regular'} fa-heart"></i>`;
        saved ? toast.success('Saved!') : toast.show('Removed from saved');
      } catch { toast.error('Failed to save'); }
    };

    async function loadLoyaltyWidget(businessId) {
      try {
        const { balance, loyalty_redemption_rate } = await API.get(`/loyalty/business/${businessId}/mine`);
        if (!balance) return;
        const adSlot = document.getElementById('bizAdSlot');
        const widget = document.createElement('div');
        widget.className = 'card';
        widget.style.cssText = 'padding:.85rem 1.1rem;margin:1rem 0;display:flex;justify-content:space-between;align-items:center;background:var(--clr-primary-10)';
        widget.innerHTML = `<span style="font-size:.9rem"><i class="fa-solid fa-star" style="color:var(--clr-primary)"></i> You have <strong>${balance} points</strong> here (~GH₵${Math.round(balance * (loyalty_redemption_rate || 0.1) * 100) / 100})</span>`;
        adSlot?.insertAdjacentElement('afterend', widget);
      } catch {}
    }

    window.shareOnWhatsApp = () => {
      trackAction('whatsapp_share');
      const text = `Check out ${biz.name} on SpotGH: ${location.href}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    };

    window.shareBusiness = () => {
      trackAction('share');
      if (navigator.share) {
        navigator.share({ title: biz.name, text: biz.tagline || '', url: location.href }).catch(() => {});
      } else {
        navigator.clipboard?.writeText(location.href);
        toast.success('Link copied!');
      }
    };

    window.trackAction = (event_type) => {
      fetch(`/api/businesses/${slug}/track`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event_type }) }).catch(() => {});
    };

    // ── Deal countdown timers
    deals?.forEach(d => {
      if (!d.expires_at) return;
      const exp = new Date(d.expires_at).getTime();
      const el = document.querySelector(`[id^="cd-"]`);
      const update = () => {
        const diff = exp - Date.now();
        if (diff <= 0) { if (el) el.textContent = 'Expired'; return; }
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        if (el) el.textContent = h > 24 ? `${Math.floor(h/24)}d ${h%24}h` : `${h}h ${m}m ${s}s`;
      };
      update(); setInterval(update, 1000);
    });

    // ── Recently viewed (localStorage)
    try {
      const RV_KEY = 'sgh_recent';
      const recent = JSON.parse(localStorage.getItem(RV_KEY) || '[]').filter(r => r.slug !== biz.slug);
      recent.unshift({ slug: biz.slug, name: biz.name, logo: biz.logo_url, city: biz.city, cat: biz.category_name });
      localStorage.setItem(RV_KEY, JSON.stringify(recent.slice(0, 10)));
    } catch {}

    // ── Dynamic OG / social meta tags
    const setMeta = (prop, content) => {
      let el = document.querySelector(`meta[property="${prop}"],meta[name="${prop}"]`);
      if (!el) { el = document.createElement('meta'); el.setAttribute(prop.startsWith('og:')||prop.startsWith('twitter:')?'property':'name', prop); document.head.appendChild(el); }
      el.setAttribute('content', content);
    };
    document.title = `${biz.name} — ${biz.city || 'Ghana'} | SpotGH`;
    setMeta('og:title', biz.name);
    setMeta('og:description', biz.tagline || biz.description?.slice(0,160) || `${biz.name} on SpotGH`);
    setMeta('og:image', biz.cover_url || biz.logo_url || '');
    setMeta('og:url', location.href);
    setMeta('og:type', 'business.business');
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', biz.name);
    setMeta('twitter:description', biz.tagline || '');
    setMeta('twitter:image', biz.cover_url || biz.logo_url || '');

    // ── Canonical link (avoids duplicate-content issues if a listing is
    // ever reachable at more than one URL, e.g. with tracking params)
    let canon = document.querySelector('link[rel="canonical"]');
    if (!canon) { canon = document.createElement('link'); canon.setAttribute('rel', 'canonical'); document.head.appendChild(canon); }
    canon.setAttribute('href', location.origin + location.pathname + '?slug=' + biz.slug);

    // ── JSON-LD LocalBusiness structured data — lets Google show rich
    // results (rating stars, hours, address) for individual listings.
    const ld = document.createElement('script');
    ld.type = 'application/ld+json';
    ld.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: biz.name,
      description: biz.tagline || biz.description || undefined,
      image: biz.cover_url || biz.logo_url || undefined,
      telephone: biz.phone || undefined,
      email: biz.email || undefined,
      url: location.origin + location.pathname + '?slug=' + biz.slug,
      address: (biz.address || biz.city) ? {
        '@type': 'PostalAddress',
        streetAddress: biz.address || undefined,
        addressLocality: biz.city || undefined,
        addressRegion: biz.region || undefined,
        addressCountry: 'GH',
      } : undefined,
      geo: (biz.latitude && biz.longitude) ? {
        '@type': 'GeoCoordinates', latitude: biz.latitude, longitude: biz.longitude,
      } : undefined,
      aggregateRating: (biz.review_count > 0) ? {
        '@type': 'AggregateRating', ratingValue: biz.avg_rating,
        reviewCount: biz.review_count,
      } : undefined,
    });
    document.head.appendChild(ld);

    // ── Floating WhatsApp widget
    if (biz.whatsapp) {
      const num = biz.whatsapp.replace(/\D/g, '');
      const msg = encodeURIComponent(`Hi! I found your business on SpotGH — ${biz.name}. I'd like to enquire about your services.`);
      const widget = document.createElement('div');
      widget.id = 'waFloat';
      widget.innerHTML = `
        <a href="https://wa.me/${num}?text=${msg}" target="_blank" rel="noopener" onclick="trackAction('whatsapp_click')"
          style="position:fixed;bottom:1.5rem;right:1.5rem;z-index:9999;width:56px;height:56px;border-radius:50%;background:#25D366;color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(37,211,102,.5);text-decoration:none;font-size:1.6rem;transition:transform .2s"
          onmouseenter="this.style.transform='scale(1.12)'" onmouseleave="this.style.transform='scale(1)'">
          <i class="fa-brands fa-whatsapp"></i>
        </a>`;
      document.body.appendChild(widget);
    }

    // Mobile sticky action bar — Call / WhatsApp / Directions, only shown
    // for whichever of those the business actually has data for.
    {
      const hasDirections = biz.latitude && biz.longitude;
      const actions = [
        biz.phone ? `<a href="tel:${biz.phone}" onclick="trackAction('call_click')" style="background:var(--clr-primary-10);color:var(--clr-primary)"><i class="fa-solid fa-phone"></i> Call</a>` : '',
        biz.whatsapp ? `<a href="https://wa.me/${biz.whatsapp.replace(/\D/g, '')}" target="_blank" rel="noopener" onclick="trackAction('whatsapp_click')" style="background:#25D366;color:#fff"><i class="fa-brands fa-whatsapp"></i> WhatsApp</a>` : '',
        hasDirections ? `<a href="https://www.google.com/maps/dir/?api=1&destination=${biz.latitude},${biz.longitude}" target="_blank" rel="noopener" onclick="trackAction('direction_click')" style="background:var(--clr-surface-2);color:var(--clr-text-1)"><i class="fa-solid fa-diamond-turn-right"></i> Directions</a>` : '',
      ].filter(Boolean);
      if (actions.length) {
        const bar = document.createElement('div');
        bar.className = 'biz-sticky-actions';
        bar.innerHTML = actions.join('');
        document.body.appendChild(bar);
        document.body.classList.add('has-sticky-actions');
      }
    }

    // QR code / vanity subdomain link
    window.toggleQR = () => {
      const panel = document.getElementById('qrPanel');
      panel.hidden = !panel.hidden;
      if (!panel.hidden && !panel.dataset.loaded) {
        panel.dataset.loaded = '1';
        const host = location.hostname;
        const isLocal = host === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(host);
        const rootDomain = host.split('.').slice(-2).join('.');
        const vanityUrl = isLocal
          ? `${location.origin}/pages/business.html?slug=${biz.slug}`
          : `https://${biz.slug}.${rootDomain}`;
        document.getElementById('vanityLink').textContent = vanityUrl;
        document.getElementById('qrImg').src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(vanityUrl)}`;
      }
    };
    window.copyVanityLink = () => {
      const text = document.getElementById('vanityLink').textContent;
      navigator.clipboard?.writeText(text).then(() => toast.success('Link copied!')).catch(() => toast.error('Could not copy link'));
    };

    // Request a Quote
    window.toggleQuoteForm = () => {
      document.getElementById('quotePanel').hidden = !document.getElementById('quotePanel').hidden;
    };
    window.toggleClaimForm = () => {
      document.getElementById('claimPanel').hidden = !document.getElementById('claimPanel').hidden;
    };
    window.toggleReportForm = () => {
      document.getElementById('reportPanel').hidden = !document.getElementById('reportPanel').hidden;
    };
    window.submitClaim = async () => {
      if (!Auth.getUser()) { toast.error('Please log in first to claim this business.'); return location.href = `/pages/login.html?redirect=${encodeURIComponent(location.pathname + location.search)}`; }
      const full_name = document.getElementById('clName').value.trim();
      const phone     = document.getElementById('clPhone').value.trim();
      if (!full_name || !phone) return toast.error('Please fill in your name and phone number.');
      const fd = new FormData();
      fd.append('full_name', full_name);
      fd.append('phone', phone);
      fd.append('role_at_business', document.getElementById('clRole').value.trim());
      fd.append('message', document.getElementById('clMessage').value.trim());
      const file = document.getElementById('clProof').files[0];
      if (file) fd.append('proof', file);
      try {
        await API.upload(`/claims/${biz.id}`, fd);
        toast.success('Claim submitted! We typically review within 2 business days.');
        document.getElementById('claimPanel').hidden = true;
      } catch (err) { toast.error(err.message || 'Failed to submit claim.'); }
    };
    window.submitReport = async () => {
      if (!Auth.getUser()) { toast.error('Please log in first to report this business.'); return location.href = `/pages/login.html?redirect=${encodeURIComponent(location.pathname + location.search)}`; }
      const reason = document.getElementById('rpReason').value;
      if (!reason) return toast.error('Please select a reason.');
      const details = document.getElementById('rpDetails').value.trim();
      try {
        await API.post(`/reports/${biz.id}`, { reason, details: details || undefined });
        toast.success('Report submitted. Thanks for helping keep SpotGH trustworthy.');
        document.getElementById('reportPanel').hidden = true;
      } catch (err) { toast.error(err.message || 'Failed to submit report.'); }
    };
    window.submitQuote = async (businessId) => {
      const name    = document.getElementById('qName').value.trim();
      const phone   = document.getElementById('qPhone').value.trim();
      const email   = document.getElementById('qEmail').value.trim();
      const details = document.getElementById('qDetails').value.trim();
      const measurements = document.getElementById('qMeasurements')?.value.trim();
      if (!name || !phone || !details) return toast.error('Please fill in your name, phone and what you need.');
      const btn = document.getElementById('qSubmit');
      btn.disabled = true; btn.textContent = 'Sending…';
      const tag = measurements !== undefined ? '[Custom Order Request]' : '[Quote Request]';
      const body = measurements ? `${details}\n\nMeasurements: ${measurements}` : details;
      try {
        await API.post('/businesses/contact', {
          business_id: businessId, sender_name: name, sender_phone: phone,
          sender_email: email || undefined, message: `${tag} ${body}`,
        });
        toast.success('Quote request sent! The business will get back to you soon.');
        document.getElementById('quotePanel').hidden = true;
      } catch { toast.error('Failed to send request. Please try again.'); }
      finally { btn.disabled = false; btn.textContent = 'Send Request'; }
    };

    // Owner-only weekly stats teaser
    if (isOwner) {
      API.get(`/businesses/${biz.id}/views-summary`).then(({ views_7d, clicks_7d }) => {
        const bannerStats = document.getElementById('ownerBannerStats');
        if (!bannerStats) return;
        bannerStats.textContent = `👀 ${views_7d} view${views_7d===1?'':'s'} · ${clicks_7d} click${clicks_7d===1?'':'s'} this week`;
        bannerStats.hidden = false;
      }).catch(() => {});
    }

  } catch (err) {
    main.innerHTML = `<div style="text-align:center;padding:5rem 1rem">
      <div style="font-size:3rem;margin-bottom:1rem">😕</div>
      <h2>Business not found</h2>
      <p style="color:var(--clr-text-2);margin-bottom:1.5rem">This listing may have been removed or the link is incorrect.</p>
      <a href="/pages/directory.html" class="btn btn--primary">Browse Directory</a>
    </div>`;
  }

  function yearsOnSpotGH(createdAt) {
    const months = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30.44);
    if (months < 1) return 'New on SpotGH';
    if (months < 12) return `${Math.round(months)} month${Math.round(months) === 1 ? '' : 's'} on SpotGH`;
    const years = Math.floor(months / 12);
    return `${years} year${years === 1 ? '' : 's'} on SpotGH`;
  }

  function renderAmenities(biz) {
    const list = biz.amenities || [];
    if (!list.length) return `<p style="color:var(--clr-text-2);text-align:center;padding:2rem">No amenities listed yet.</p>`;
    const ICONS = {
      wifi:'fa-wifi', parking:'fa-square-parking', pool:'fa-person-swimming', breakfast:'fa-mug-saucer',
      ac:'fa-snowflake', gym:'fa-dumbbell', bar:'fa-martini-glass', spa:'fa-spa', laundry:'fa-soap',
      restaurant:'fa-utensils', generator:'fa-bolt', security:'fa-shield-halved', tv:'fa-tv',
    };
    const iconFor = (label) => {
      const key = Object.keys(ICONS).find(k => label.toLowerCase().includes(k));
      return `fa-solid ${key ? ICONS[key] : 'fa-circle-check'}`;
    };
    return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:.75rem">
      ${list.map(a => `
        <div class="card" style="padding:1rem;display:flex;align-items:center;gap:.75rem">
          <i class="${iconFor(a)}" style="color:var(--clr-primary);font-size:1.1rem;width:20px;text-align:center"></i>
          <span style="font-size:.9rem;font-weight:600">${a}</span>
        </div>`).join('')}
    </div>`;
  }

  function renderAbout(biz) {
    return `
      ${biz.emergency_contact ? `
      <div class="card" style="padding:1rem 1.25rem;margin-bottom:1.25rem;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.25);display:flex;align-items:center;gap:.75rem">
        <i class="fa-solid fa-triangle-exclamation" style="color:var(--clr-danger);font-size:1.1rem"></i>
        <div><b style="font-size:.85rem">Emergency Contact:</b> <a href="tel:${biz.emergency_contact}" style="color:var(--clr-danger);font-weight:700;text-decoration:none">${biz.emergency_contact}</a></div>
      </div>` : ''}
      <div style="display:grid;grid-template-columns:1fr min(300px,100%);gap:1.5rem" class="biz-about-grid">
        <div>
          ${biz.tagline ? `<p style="font-size:1.1rem;font-weight:500;color:var(--clr-text-1);margin-bottom:1rem">${biz.tagline}</p>` : ''}
          ${biz.description ? `<div style="color:var(--clr-text-2);line-height:1.8;white-space:pre-line">${biz.description}</div>` : ''}

          ${biz.services?.length ? `
          <div style="margin-top:1.5rem">
            <h3 style="font-size:1rem;font-weight:700;margin-bottom:.75rem">Services</h3>
            <div style="display:flex;flex-wrap:wrap;gap:.5rem">
              ${biz.services.map(s=>`<span class="badge" style="background:var(--clr-surface-2);color:var(--clr-text-1);padding:.35rem .65rem">${s}</span>`).join('')}
            </div>
          </div>` : ''}

          ${biz.measurement_guide ? `
          <div style="margin-top:1.5rem">
            <h3 style="font-size:1rem;font-weight:700;margin-bottom:.75rem"><i class="fa-solid fa-ruler" style="color:var(--clr-primary)"></i> Measurement Guide</h3>
            <div style="color:var(--clr-text-2);line-height:1.7;white-space:pre-line">${biz.measurement_guide}</div>
          </div>` : ''}

          ${biz.health_tips ? `
          <div style="margin-top:1.5rem">
            <h3 style="font-size:1rem;font-weight:700;margin-bottom:.75rem"><i class="fa-solid fa-heart-pulse" style="color:var(--clr-primary)"></i> Health Tips</h3>
            <div style="color:var(--clr-text-2);line-height:1.7;white-space:pre-line">${biz.health_tips}</div>
          </div>` : ''}

          ${biz.insurance_accepted?.length ? `
          <div style="margin-top:1.5rem">
            <h3 style="font-size:1rem;font-weight:700;margin-bottom:.75rem"><i class="fa-solid fa-notes-medical" style="color:var(--clr-primary)"></i> Insurance Accepted</h3>
            <div style="display:flex;flex-wrap:wrap;gap:.5rem">
              ${biz.insurance_accepted.map(s=>`<span class="badge" style="background:var(--clr-surface-2);color:var(--clr-text-1);padding:.35rem .65rem">${s}</span>`).join('')}
            </div>
          </div>` : ''}

          ${biz.nearby_attractions?.length ? `
          <div style="margin-top:1.5rem">
            <h3 style="font-size:1rem;font-weight:700;margin-bottom:.75rem"><i class="fa-solid fa-map-location-dot" style="color:var(--clr-primary)"></i> Nearby Attractions</h3>
            <ul style="color:var(--clr-text-2);line-height:1.9;padding-left:1.1rem">
              ${biz.nearby_attractions.map(s=>`<li>${s}</li>`).join('')}
            </ul>
          </div>` : ''}
        </div>

        <div>
          <div class="card" style="padding:1.25rem">
            <h3 style="font-size:.9rem;font-weight:700;margin-bottom:1rem;text-transform:uppercase;letter-spacing:.05em;color:var(--clr-text-3)">Business Info</h3>
            <div style="display:flex;flex-direction:column;gap:.75rem;font-size:.875rem">
              ${biz.phone ? `<div style="display:flex;gap:.75rem;align-items:center"><i class="fa-solid fa-phone" style="width:16px;color:var(--clr-primary)"></i><a href="tel:${biz.phone}" style="color:var(--clr-text-1)">${biz.phone}</a></div>` : ''}
              ${biz.email ? `<div style="display:flex;gap:.75rem;align-items:center"><i class="fa-solid fa-envelope" style="width:16px;color:var(--clr-primary)"></i><a href="mailto:${biz.email}" style="color:var(--clr-text-1)">${biz.email}</a></div>` : ''}
              ${biz.website ? `<div style="display:flex;gap:.75rem;align-items:center"><i class="fa-solid fa-globe" style="width:16px;color:var(--clr-primary)"></i><a href="${biz.website}" target="_blank" rel="noopener" onclick="trackAction('website_click')" style="color:var(--clr-primary)">${biz.website.replace(/^https?:\/\//,'')}</a></div>` : ''}
              ${biz.address ? `<div style="display:flex;gap:.75rem;align-items:flex-start"><i class="fa-solid fa-location-dot" style="width:16px;color:var(--clr-primary);margin-top:.15rem"></i><span style="color:var(--clr-text-2)">${biz.address}</span></div>` : ''}
              ${biz.latitude && biz.longitude ? `<a href="https://www.google.com/maps/dir/?api=1&destination=${biz.latitude},${biz.longitude}" target="_blank" rel="noopener" onclick="trackAction('direction_click')" class="btn btn--outline btn--sm" style="align-self:flex-start"><i class="fa-solid fa-diamond-turn-right"></i> Get Directions</a>` : ''}
              ${biz.city ? `<div style="display:flex;gap:.75rem;align-items:center"><i class="fa-solid fa-city" style="width:16px;color:var(--clr-primary)"></i><span style="color:var(--clr-text-2)">${biz.city}</span></div>` : ''}
            </div>
            ${renderHoursCard(biz.operating_hours)}
            <div style="display:flex;gap:.5rem;margin-top:1rem;flex-wrap:wrap">
              ${biz.facebook ? `<a href="${biz.facebook}" target="_blank" rel="noopener" class="btn btn--ghost btn--sm"><i class="fab fa-facebook-f"></i></a>` : ''}
              ${biz.instagram ? `<a href="${biz.instagram}" target="_blank" rel="noopener" class="btn btn--ghost btn--sm"><i class="fab fa-instagram"></i></a>` : ''}
              ${biz.twitter ? `<a href="${biz.twitter}" target="_blank" rel="noopener" class="btn btn--ghost btn--sm"><i class="fab fa-x-twitter"></i></a>` : ''}
              ${biz.tiktok ? `<a href="${biz.tiktok}" target="_blank" rel="noopener" class="btn btn--ghost btn--sm"><i class="fab fa-tiktok"></i></a>` : ''}
            </div>
          </div>
        </div>
      </div>
      <style>.biz-about-grid{grid-template-columns:1fr}@media(min-width:640px){.biz-about-grid{grid-template-columns:1fr min(300px,100%)}}</style>`;
  }

  function renderProducts(products, hasOrdering, businessId) {
    if (!products.length) return `<p style="color:var(--clr-text-2);text-align:center;padding:2rem">No products listed yet.</p>`;
    const sorted = [...products].sort((a, b) => (b.is_new_arrival?1:0) - (a.is_new_arrival?1:0));
    _allProducts = sorted; _productsHasOrdering = hasOrdering; _productsBizId = businessId;
    const showSearch = sorted.length > 6;
    return `
    ${showSearch ? `<div style="margin-bottom:1rem"><input type="text" id="productSearchInput" class="input" placeholder="Search products…" oninput="filterProducts(this.value)"></div>` : ''}
    <div id="productGrid">${renderProductCards(sorted, hasOrdering, businessId)}</div>
    ${hasOrdering ? `<div id="cartBar"></div>` : ''}`;
  }

  function renderProductCards(products, hasOrdering, businessId) {
    if (!products.length) return `<p style="color:var(--clr-text-2);text-align:center;padding:2rem;grid-column:1/-1">No matching products.</p>`;
    return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:1rem">
      ${products.map(p => {
        const canOrder = hasOrdering && p.type === 'product' && p.is_available;
        const outOfStock = p.track_inventory && !p.allow_backorder && p.stock_quantity <= 0;
        return `
        <div class="card" style="padding:0;overflow:hidden;position:relative">
          ${p.is_new_arrival ? `<span class="badge" style="position:absolute;top:.5rem;left:.5rem;z-index:1;background:var(--clr-secondary);color:var(--clr-text);font-weight:700">🆕 New</span>` : ''}
          ${Auth.getUser() ? `<button onclick="toggleSaveProduct('${p.id}', this)" class="product-save-btn"><i class="fa-regular fa-heart" style="color:var(--clr-danger)"></i></button>` : ''}
          ${p.image_url ? `<img src="${p.image_url}" alt="${p.name}" style="width:100%;height:140px;object-fit:cover">` : `<div style="height:140px;background:var(--clr-surface-2);display:flex;align-items:center;justify-content:center;font-size:2rem">📦</div>`}
          <div style="padding:.875rem">
            <div style="font-weight:600;margin-bottom:.25rem">${p.name}</div>
            ${p.description ? `<div style="font-size:.8rem;color:var(--clr-text-2);margin-bottom:.5rem">${p.description}</div>` : ''}
            ${p.price ? `<div style="font-weight:700;color:var(--clr-primary);margin-bottom:.5rem">${formatCurrency(p.price)}</div>` : ''}
            ${canOrder ? (outOfStock
              ? `<button class="btn btn--ghost btn--sm btn--full" disabled>Out of Stock</button>`
              : `<button class="btn btn--primary btn--sm btn--full" onclick="addToCart('${businessId}','${p.id}')"><i class="fa-solid fa-cart-plus"></i> Add to Cart</button>`) : ''}
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }

  let _allProducts = [], _productsHasOrdering = false, _productsBizId = null;
  window.filterProducts = (query) => {
    const q = query.trim().toLowerCase();
    const filtered = !q ? _allProducts : _allProducts.filter(p =>
      p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q));
    document.getElementById('productGrid').innerHTML = renderProductCards(filtered, _productsHasOrdering, _productsBizId);
  };

  window.toggleSaveProduct = async (productId, btnEl) => {
    const icon = btnEl.querySelector('i');
    const isSaved = icon.classList.contains('fa-solid');
    try {
      if (isSaved) {
        await API.delete(`/user/favorite-products/${productId}`);
        icon.className = 'fa-regular fa-heart'; icon.style.color = 'var(--clr-danger)';
      } else {
        await API.post(`/user/favorite-products/${productId}`);
        icon.className = 'fa-solid fa-heart'; icon.style.color = 'var(--clr-danger)';
        toast.success('Saved!');
      }
    } catch (e) { toast.error(e.message || 'Could not save'); }
  };

  async function loadMessageThread(businessId) {
    const container = document.getElementById('messageTabContent');
    if (!container) return;
    try {
      const { messages } = await API.get(`/messages/${businessId}`);
      container.innerHTML = `
        <div id="custMsgScroll" style="max-height:350px;overflow-y:auto;display:flex;flex-direction:column;gap:.6rem;padding:1rem;background:var(--clr-surface-2);border-radius:var(--radius-md);margin-bottom:1rem">
          ${messages.length ? messages.map(m => `
            <div style="align-self:${m.sender_role==='customer'?'flex-end':'flex-start'};max-width:75%">
              <div style="background:${m.sender_role==='customer'?'var(--clr-primary)':'var(--clr-surface)'};color:${m.sender_role==='customer'?'#fff':'var(--clr-text)'};padding:.6rem .85rem;border-radius:14px;font-size:.875rem">${m.body}</div>
            </div>`).join('') : `<p style="color:var(--clr-text-3);text-align:center;font-size:.85rem">Send a message to get started.</p>`}
        </div>
        <form id="custMsgForm" style="display:flex;gap:.5rem">
          <input class="input" id="custMsgInput" placeholder="Type a message…" style="flex:1" required>
          <button class="btn btn--primary" type="submit"><i class="fa-solid fa-paper-plane"></i></button>
        </form>`;
      const scroll = document.getElementById('custMsgScroll'); scroll.scrollTop = scroll.scrollHeight;
      document.getElementById('custMsgForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('custMsgInput');
        const body = input.value.trim();
        if (!body) return;
        input.disabled = true;
        try { await API.post(`/messages/${businessId}`, { body }); input.value = ''; await loadMessageThread(businessId); }
        catch (err) { toast.error(err.message || 'Failed to send'); }
        finally { input.disabled = false; input.focus(); }
      });
    } catch {
      container.innerHTML = `<p style="color:var(--clr-danger);text-align:center">Couldn't load messages.</p>`;
    }
  }

  window.addToCart = async (businessId, productId) => {
    try {
      await API.post(`/cart/${businessId}/items`, { product_id: productId, quantity: 1 });
      toast.success('Added to cart');
      refreshCartBar(businessId);
    } catch (e) { toast.error(e.message || 'Could not add to cart'); }
  };

  async function refreshCartBar(businessId) {
    const bar = document.getElementById('cartBar');
    if (!bar) return;
    try {
      const { items, subtotal } = await API.get(`/cart/${businessId}`);
      const count = (items || []).reduce((s, i) => s + i.quantity, 0);
      if (!count) { bar.innerHTML = ''; return; }
      bar.innerHTML = `
        <div class="cart-bar" style="position:sticky;bottom:1rem;margin-top:1rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;background:var(--clr-surface);border:1px solid var(--clr-border);box-shadow:0 8px 24px rgba(0,0,0,.12);border-radius:var(--radius-md);padding:1rem 1.25rem">
          <span><strong>${count}</strong> item${count===1?'':'s'} · ${formatCurrency(subtotal)}</span>
          <a href="/pages/checkout.html?biz=${businessId}" class="btn btn--primary btn--sm">Checkout</a>
        </div>`;
    } catch { /* not fatal — cart bar just stays empty */ }
  }

  function renderGallery(photos, beforeAfter) {
    const beforePhotos = (beforeAfter || []).filter(p => p.type === 'before');
    const afterPhotos  = (beforeAfter || []).filter(p => p.type === 'after');
    const hasBeforeAfter = beforePhotos.length && afterPhotos.length;
    const pairs = hasBeforeAfter ? Math.min(beforePhotos.length, afterPhotos.length) : 0;

    const beforeAfterHtml = hasBeforeAfter ? `
      <h4 style="font-size:.95rem;font-weight:700;margin-bottom:.75rem">Before &amp; After</h4>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1rem;margin-bottom:2rem">
        ${Array.from({ length: pairs }).map((_, i) => `
          <div class="card" style="padding:.6rem;display:grid;grid-template-columns:1fr 1fr;gap:.4rem">
            <div style="position:relative"><img src="${beforePhotos[i].url}" alt="Before" style="width:100%;height:140px;object-fit:cover;border-radius:var(--radius-sm)"><span class="badge" style="position:absolute;top:.4rem;left:.4rem;background:rgba(0,0,0,.6);color:#fff">Before</span></div>
            <div style="position:relative"><img src="${afterPhotos[i].url}" alt="After" style="width:100%;height:140px;object-fit:cover;border-radius:var(--radius-sm)"><span class="badge" style="position:absolute;top:.4rem;left:.4rem;background:var(--clr-primary);color:#fff">After</span></div>
          </div>`).join('')}
      </div>` : '';

    if (!photos.length && !hasBeforeAfter) return `<p style="color:var(--clr-text-2);text-align:center;padding:2rem">No photos yet.</p>`;
    return `
      ${beforeAfterHtml}
      ${photos.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:.5rem">
        ${photos.map(p => `<img src="${p.url || p}" alt="Gallery" style="width:100%;height:160px;object-fit:cover;border-radius:var(--radius-md);cursor:pointer" onclick="window.open('${p.url || p}','_blank')">`).join('')}
      </div>` : ''}`;
  }

  // Staff/team profiles — reused across salon (stylists), healthcare (doctors),
  // trades (mechanics) templates via TEMPLATES[key].teamLabel
  function renderTeam(staff, label) {
    if (!staff.length) return `<p style="color:var(--clr-text-2);text-align:center;padding:2rem">No team members listed yet.</p>`;
    return `
      <h3 style="font-size:1.1rem;font-weight:700;margin-bottom:1.25rem">${label || 'Our Team'}</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:1.25rem">
        ${staff.map(s => `
          <div class="card" style="padding:1.25rem;text-align:center">
            ${s.photo_url
              ? `<img src="${s.photo_url}" alt="${s.name}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;margin:0 auto 1rem">`
              : `<div style="width:80px;height:80px;border-radius:50%;background:var(--clr-primary-10);color:var(--clr-primary);display:flex;align-items:center;justify-content:center;font-size:1.5rem;font-weight:700;margin:0 auto 1rem">${(s.name||'?').charAt(0)}</div>`}
            <div style="font-weight:700;font-size:.95rem">${s.name}</div>
            ${s.role ? `<div style="font-size:.8rem;color:var(--clr-primary);font-weight:600;margin-top:.15rem">${s.role}</div>` : ''}
            ${s.bio ? `<div style="font-size:.8rem;color:var(--clr-text-2);margin-top:.5rem">${s.bio}</div>` : ''}
          </div>`).join('')}
      </div>`;
  }

  function renderBookingForm(biz) {
    const today = new Date().toISOString().split('T')[0];
    return `
      <div style="max-width:480px;margin:0 auto">
        <h3 style="font-size:1.1rem;font-weight:700;margin-bottom:1.25rem">Book an Appointment</h3>
        <div class="card" style="padding:1.5rem;display:flex;flex-direction:column;gap:1rem">
          <div><label style="font-size:.875rem;font-weight:600;display:block;margin-bottom:.4rem">Your Name *</label>
            <input id="bkName" type="text" class="input" placeholder="Full name" style="width:100%"></div>
          <div><label style="font-size:.875rem;font-weight:600;display:block;margin-bottom:.4rem">Phone *</label>
            <input id="bkPhone" type="tel" class="input" placeholder="e.g. 0241234567" style="width:100%"></div>
          <div><label style="font-size:.875rem;font-weight:600;display:block;margin-bottom:.4rem">Email</label>
            <input id="bkEmail" type="email" class="input" placeholder="Optional" style="width:100%"></div>
          <div><label style="font-size:.875rem;font-weight:600;display:block;margin-bottom:.4rem">Date *</label>
            <input id="bkDate" type="date" class="input" min="${today}" style="width:100%" onchange="loadBookingSlots('${biz.id}')"></div>
          <div id="bkSlotsWrap" hidden>
            <label style="font-size:.875rem;font-weight:600;display:block;margin-bottom:.4rem">Available Times *</label>
            <div id="bkSlots" style="display:flex;flex-wrap:wrap;gap:.4rem"></div>
            <input id="bkTime" type="hidden">
          </div>
          <div><label style="font-size:.875rem;font-weight:600;display:block;margin-bottom:.4rem">Notes</label>
            <textarea id="bkNotes" rows="3" class="input" placeholder="Any special requests…" style="width:100%;resize:vertical"></textarea></div>
          <button id="bkSubmit" class="btn btn--primary" onclick="submitBooking('${biz.id}')">Confirm Booking</button>
        </div>
      </div>`;
  }

  window.loadBookingSlots = async (businessId) => {
    const date = document.getElementById('bkDate').value;
    const wrap = document.getElementById('bkSlotsWrap');
    const slotsEl = document.getElementById('bkSlots');
    document.getElementById('bkTime').value = '';
    if (!date) { wrap.hidden = true; return; }
    wrap.hidden = false;
    slotsEl.innerHTML = `<span class="spinner-sm"></span>`;
    try {
      const { slots, closed } = await API.get(`/availability/${businessId}/slots?date=${date}`);
      if (closed || !slots.length) {
        slotsEl.innerHTML = `<p style="font-size:.85rem;color:var(--clr-text-2)">No availability that day. Try another date, or use the WhatsApp/phone button above.</p>`;
        return;
      }
      slotsEl.innerHTML = slots.map(s => `
        <button type="button" class="btn btn--sm ${s.available ? 'btn--outline' : ''}" ${s.available ? `onclick="selectBookingSlot(this,'${s.time}')"` : 'disabled style="opacity:.35"'}>${s.time}</button>`).join('');
    } catch {
      // No hours configured for this business yet — fall back to a manual time input
      slotsEl.innerHTML = `<input id="bkTimeManual" type="time" class="input" style="width:100%" onchange="document.getElementById('bkTime').value=this.value">`;
    }
  };

  window.selectBookingSlot = (btn, time) => {
    document.getElementById('bkTime').value = time;
    btn.parentElement.querySelectorAll('button').forEach(b => b.classList.remove('btn--primary'));
    btn.classList.add('btn--primary');
  };

  window.submitBooking = async (businessId) => {
    const btn  = document.getElementById('bkSubmit');
    const name  = document.getElementById('bkName').value.trim();
    const phone = document.getElementById('bkPhone').value.trim();
    const date  = document.getElementById('bkDate').value;
    const time  = document.getElementById('bkTime').value;
    if (!name || !phone || !date || !time) { toast.warning('Please fill in all required fields'); return; }
    setLoading(btn, true, 'Booking…');
    try {
      const { confirmation_code } = await API.post('/bookings', {
        business_id: businessId, customer_name: name, customer_phone: phone,
        customer_email: document.getElementById('bkEmail').value.trim() || null,
        booking_date: date, booking_time: time,
        notes: document.getElementById('bkNotes').value.trim() || null
      });
      document.getElementById('tabContent').innerHTML = `
        <div style="text-align:center;padding:3rem 1rem">
          <div style="font-size:3rem;margin-bottom:1rem">🎉</div>
          <h3 style="font-size:1.25rem;font-weight:700;margin-bottom:.5rem">Booking Confirmed!</h3>
          <p style="color:var(--clr-text-2);margin-bottom:1rem">Your confirmation code is:</p>
          <div style="font-size:1.5rem;font-weight:800;letter-spacing:.15em;color:var(--clr-primary);padding:1rem;background:var(--clr-primary-10);border-radius:var(--radius-md);display:inline-block">${confirmation_code}</div>
          <p style="color:var(--clr-text-2);margin-top:1rem;font-size:.875rem">Save this code. The business will confirm your appointment shortly.</p>
        </div>`;
    } catch (err) {
      toast.error(err.message || 'Booking failed');
      setLoading(btn, false);
    }
  };

  async function loadReviews(bizId, container) {
    container.innerHTML = `<div class="skeleton" style="height:80px;border-radius:12px;margin-bottom:.75rem"></div>`.repeat(3);
    try {
      const { reviews } = await API.get(`/businesses/${bizId}/reviews`).catch(() => ({ reviews: [] }));
      const user = Auth.getUser();
      container.innerHTML = `
        ${user ? `
        <div class="card" style="padding:1.25rem;margin-bottom:1.5rem">
          <h4 style="margin-bottom:1rem;font-weight:700">Leave a Review</h4>
          <div style="display:flex;gap:.5rem;margin-bottom:.75rem" id="starPicker">
            ${[1,2,3,4,5].map(n=>`<button data-star="${n}" onclick="setRating(${n})" style="font-size:1.5rem;background:none;border:none;cursor:pointer;color:var(--clr-border)">★</button>`).join('')}
          </div>
          <textarea id="reviewText" rows="3" class="input" placeholder="Share your experience…" style="width:100%;resize:vertical;margin-bottom:.75rem"></textarea>
          <button class="btn btn--primary btn--sm" onclick="submitReview('${bizId}')">Submit Review</button>
        </div>` : `<p style="color:var(--clr-text-2);margin-bottom:1.5rem"><a href="/pages/login.html" style="color:var(--clr-primary)">Log in</a> to leave a review.</p>`}
        ${!reviews.length ? '<p style="color:var(--clr-text-2);text-align:center;padding:2rem">No reviews yet. Be the first!</p>' :
          reviews.map(r => `
          <div class="card" style="padding:1.25rem;margin-bottom:.75rem">
            <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:.5rem">
              <div style="width:36px;height:36px;border-radius:50%;background:var(--clr-primary-10);display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--clr-primary)">${(r.users?.full_name||'U')[0].toUpperCase()}</div>
              <div>
                <div style="font-weight:600;font-size:.875rem">${r.users?.full_name || 'Anonymous'}</div>
                <div style="color:var(--clr-gold);font-size:.9rem">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</div>
              </div>
              <div style="margin-left:auto;font-size:.75rem;color:var(--clr-text-3)">${timeAgo(r.created_at)}</div>
            </div>
            ${r.content ? `<p style="color:var(--clr-text-2);font-size:.875rem;margin:0 0 .75rem">${r.content}</p>` : ''}
            ${r.owner_reply ? `
              <div style="background:var(--clr-surface-2);border-left:3px solid var(--clr-primary);border-radius:0 8px 8px 0;padding:.75rem 1rem;margin-top:.5rem">
                <div style="font-size:.75rem;font-weight:700;color:var(--clr-primary);margin-bottom:.3rem">Owner's Response</div>
                <p style="font-size:.85rem;margin:0;color:var(--clr-text-1)">${r.owner_reply}</p>
              </div>` : ''}
            ${(biz.owner_id === Auth.getUser()?.id || Auth.getUser()?.role === 'creator') && !r.owner_reply ? `
              <div id="reply-area-${r.id}" style="margin-top:.75rem">
                <button class="btn btn--ghost btn--sm" onclick="document.getElementById('reply-form-${r.id}').hidden=false;this.hidden=true">
                  <i class="fa-solid fa-reply"></i> Reply
                </button>
                <div id="reply-form-${r.id}" hidden style="margin-top:.5rem">
                  <textarea class="input" id="reply-text-${r.id}" rows="2" placeholder="Write a public response…" style="width:100%;resize:vertical;margin-bottom:.5rem"></textarea>
                  <div style="display:flex;gap:.5rem">
                    <button class="btn btn--primary btn--sm" onclick="submitReply('${r.id}','${bizId}')">Post Reply</button>
                    <button class="btn btn--ghost btn--sm" onclick="document.getElementById('reply-form-${r.id}').hidden=true;document.querySelector('[onclick*=reply-form-${r.id}]').hidden=false">Cancel</button>
                  </div>
                </div>
              </div>` : ''}
          </div>`).join('')}`;

      window._reviewRating = 0;
      window.setRating = (n) => {
        window._reviewRating = n;
        document.querySelectorAll('#starPicker [data-star]').forEach(b => {
          b.style.color = parseInt(b.dataset.star) <= n ? 'var(--clr-gold)' : 'var(--clr-border)';
        });
      };
      window.submitReview = async (bizId) => {
        if (!window._reviewRating) { toast.warning('Please select a rating'); return; }
        const comment = document.getElementById('reviewText').value.trim();
        try {
          await API.post(`/businesses/${bizId}/reviews`, { rating: window._reviewRating, content: document.getElementById('reviewText').value.trim() });
          toast.success('Review submitted!');
          loadReviews(bizId, container);
        } catch (err) { toast.error(err.message || 'Failed to submit review'); }
      };
      window.submitReply = async (reviewId, bizId) => {
        const reply = document.getElementById(`reply-text-${reviewId}`)?.value.trim();
        if (!reply) { toast.warning('Reply cannot be empty'); return; }
        try {
          await API.patch(`/reviews/${reviewId}/reply`, { reply });
          toast.success('Reply posted!');
          loadReviews(bizId, container);
        } catch (err) { toast.error(err.message || 'Failed to post reply'); }
      };
    } catch { container.innerHTML = '<p style="color:var(--clr-danger)">Failed to load reviews.</p>'; }
  }

  const DAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const DAY_LABEL = { sunday:'Sunday', monday:'Monday', tuesday:'Tuesday', wednesday:'Wednesday', thursday:'Thursday', friday:'Friday', saturday:'Saturday' };
  // getTodayHours/isOpenNow/openStatusBadge/formatTime now live on window,
  // shared with main.js's business cards — see assets/js/main.js.
  const { getTodayHours, isOpenNow, openStatusBadge, formatTime } = window;

  function renderHoursCard(hours) {
    if (!hours) return '';
    const todayKey = DAYS[new Date().getDay()];
    return `
      <div style="margin-top:1.1rem;padding-top:1rem;border-top:1px solid var(--clr-border)">
        <h4 style="font-size:.8rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--clr-text-3);margin-bottom:.6rem">
          <i class="fa-solid fa-clock" style="margin-right:.3rem"></i>Hours
        </h4>
        <div style="display:flex;flex-direction:column;gap:.35rem;font-size:.82rem">
          ${DAYS.map(d => {
            const h = hours[d];
            const isToday = d === todayKey;
            return `<div style="display:flex;justify-content:space-between;${isToday?'font-weight:700;color:var(--clr-text-1)':'color:var(--clr-text-3)'}">
              <span>${DAY_LABEL[d]}</span>
              <span>${h && !h.closed && h.open && h.close ? `${formatTime(h.open)} – ${formatTime(h.close)}` : 'Closed'}</span>
            </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  function shadeColor(hex, pct) {
    if (!hex || !/^#?[0-9a-f]{6}$/i.test(hex)) return null;
    hex = hex.replace('#','');
    const n = parseInt(hex, 16);
    let r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff;
    const amt = Math.round(2.55 * pct);
    r = Math.max(0, Math.min(255, r + amt));
    g = Math.max(0, Math.min(255, g + amt));
    b = Math.max(0, Math.min(255, b + amt));
    return `#${((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1)}`;
  }
});
