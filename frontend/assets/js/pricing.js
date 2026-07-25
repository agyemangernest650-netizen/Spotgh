// assets/js/pricing.js
document.addEventListener('DOMContentLoaded', async () => {
  loadComponents();

  const params = new URLSearchParams(location.search);
  if (params.get('payment') === 'success') toast.success(`🎉 Payment successful! Your ${params.get('plan')||''} plan is now active.`);
  if (params.get('payment') === 'failed')  toast.error('Payment failed. Please try again.');

  let billing = 'monthly';
  let ownWebsite = false;
  let plans = [];

  document.getElementById('pageMain').innerHTML = `
    <div class="container" style="padding:3rem 1rem 5rem;max-width:1100px;margin:0 auto">
      <div style="text-align:center;margin-bottom:1.5rem">
        <h1 style="font-size:clamp(1.75rem,5vw,3rem);font-weight:800;margin-bottom:.75rem">Simple, Transparent Pricing</h1>
        <p style="color:var(--clr-text-2);max-width:520px;margin:0 auto 1.5rem">List your business and reach thousands of customers across Ghana. <strong>Standard is a one-time payment for one month</strong> — it never auto-renews. When it ends, simply renew the same plan or upgrade to Premium/Enterprise, whenever you're ready.</p>
        <div style="display:inline-flex;background:var(--clr-surface-2);border-radius:40px;padding:.25rem;gap:.25rem">
          <button id="btnMonthly" class="btn btn--primary btn--sm" style="border-radius:40px" onclick="setBilling('monthly')">Monthly</button>
          <button id="btnYearly" class="btn btn--ghost btn--sm" style="border-radius:40px" onclick="setBilling('yearly')">Yearly <span style="font-size:.7rem;background:var(--clr-success);color:#fff;padding:.1rem .4rem;border-radius:20px;margin-left:.3rem">Save 20%</span></button>
        </div>
        <div style="margin-top:.75rem">
          <div style="display:inline-flex;background:var(--clr-surface-2);border-radius:40px;padding:.25rem;gap:.25rem">
            <button id="btnNoSite" class="btn btn--primary btn--sm" style="border-radius:40px" onclick="setOwnWebsite(false)">Build me a mini-website</button>
            <button id="btnHasSite" class="btn btn--ghost btn--sm" style="border-radius:40px" onclick="setOwnWebsite(true)">I already have a website</button>
          </div>
          <p style="font-size:.75rem;color:var(--clr-text-3);margin-top:.4rem">Already have a website? You get a lower price — no mini-website to build.</p>
          <div id="ownWebsiteUrlWrap" style="display:none;margin-top:.6rem;max-width:320px;margin-left:auto;margin-right:auto">
            <input id="ownWebsiteUrl" class="input" type="url" placeholder="https://yourwebsite.com" style="width:100%">
          </div>
        </div>
      </div>

      <div id="statusBanner" style="margin-bottom:2rem"></div>

      <div id="plansGrid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1.25rem;margin-bottom:3rem">
        ${[...Array(4)].map(()=>'<div class="card skeleton" style="height:400px"></div>').join('')}
      </div>

      <!-- Promo code -->
      <div style="text-align:center;margin-bottom:3rem">
        <div style="display:inline-flex;gap:.5rem;align-items:center;background:var(--clr-surface-2);padding:.75rem 1rem;border-radius:var(--radius-md);border:1px solid var(--clr-border)">
          <i class="fa-solid fa-tag" style="color:var(--clr-primary)"></i>
          <input id="promoInput" type="text" placeholder="Have a promo code?" style="border:none;background:transparent;outline:none;font-family:inherit;font-size:.875rem;color:var(--clr-text-1);width:200px">
          <button class="btn btn--primary btn--sm" onclick="applyPromo()">Apply</button>
        </div>
        <p id="promoMsg" style="font-size:.8rem;margin-top:.5rem;color:var(--clr-text-3)"></p>
      </div>

      <div id="pricingTestimonials" style="display:none;margin-bottom:3rem">
        <h2 style="font-size:1.4rem;font-weight:700;text-align:center;margin-bottom:1.5rem">What Business Owners Are Saying</h2>
        <div class="grid grid--3" id="pricingTestimonialsGrid" style="max-width:900px;margin:0 auto"></div>
      </div>

      <!-- FAQ -->
      <div style="max-width:640px;margin:0 auto">
        <h2 style="font-size:1.5rem;font-weight:700;text-align:center;margin-bottom:1.5rem">FAQ</h2>
        ${[
          { q:'Does Standard auto-renew?', a:'No. Standard is a single payment that keeps your listing live for exactly one month. There is no automatic billing — when it ends, you choose to renew the same plan or upgrade to Premium/Enterprise, on your own schedule.' },
          { q:'What happens when my month ends?', a:"Your business listing is temporarily moved back to the free tier (hidden from search) until you renew or upgrade. Nothing is deleted — your products, photos and reviews stay safe." },
          { q:'Can I upgrade later?', a:'Absolutely. You can upgrade your plan at any time from your dashboard, even mid-month — we prorate where applicable.' },
          { q:'What payment methods are accepted?', a:'We accept MoMo, Vodafone Cash, AirtelTigo Money, and all major debit/credit cards via Paystack.' },
          { q:'Do I need to subscribe before listing?', a:'You need at least a Standard plan to publish your business listing.' },
        ].map(f=>`
          <details class="card" style="padding:1rem 1.25rem;margin-bottom:.75rem;cursor:pointer">
            <summary style="font-weight:600;list-style:none;display:flex;justify-content:space-between;align-items:center">
              ${f.q}<i class="fa-solid fa-chevron-down" style="font-size:.75rem;color:var(--clr-text-3)"></i>
            </summary>
            <p style="color:var(--clr-text-2);font-size:.875rem;margin:.75rem 0 0">${f.a}</p>
          </details>`).join('')}
      </div>
    </div>`;

  // Load plans
  try {
    // /creator/plans is super-admin-only, so it always 401s for a normal
    // visitor; /subscriptions/plans is the public endpoint that actually
    // returns data for the pricing page.
    const res = await API.get('/subscriptions/plans');
    plans = (res.plans || []).filter(p => p.is_active !== false);
    renderPlans();
  } catch { document.getElementById('plansGrid').innerHTML = '<p style="color:var(--clr-danger);grid-column:1/-1;text-align:center">Failed to load plans.</p>'; }

  // Testimonials — real reviews only, hidden entirely until some exist
  try {
    const { reviews } = await API.get('/reviews/featured?limit=3');
    if ((reviews || []).length > 0) {
      document.getElementById('pricingTestimonials').style.display = 'block';
      document.getElementById('pricingTestimonialsGrid').innerHTML = reviews.map(r => {
        const biz = r.businesses || {};
        const reviewer = r.users || {};
        return `
          <div class="card" style="padding:1.25rem">
            <div style="color:var(--clr-gold);font-size:.85rem;margin-bottom:.5rem">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</div>
            <p style="font-size:.85rem;color:var(--clr-text-2);line-height:1.6">"${r.content}"</p>
            <div style="font-size:.75rem;color:var(--clr-text-3);margin-top:.75rem;font-weight:600">${reviewer.full_name || 'SpotGH User'} · ${biz.name || ''}</div>
          </div>`;
      }).join('');
    }
  } catch {}

  // Renewal / expiry status banner
  if (Auth.isLoggedIn()) {
    try {
      const status = await API.get('/subscriptions/status');
      if (status.message) {
        const ok = status.is_active;
        document.getElementById('statusBanner').innerHTML = `
          <div style="display:flex;align-items:center;gap:.75rem;justify-content:center;text-align:center;flex-wrap:wrap;background:${ok?'rgba(78,13,173,.08)':'rgba(220,53,69,.08)'};border:1px solid ${ok?'var(--clr-primary)':'var(--clr-danger)'};border-radius:var(--radius-md);padding:.85rem 1.25rem">
            <i class="fa-solid ${ok?'fa-clock':'fa-triangle-exclamation'}" style="color:${ok?'var(--clr-primary)':'var(--clr-danger)'}"></i>
            <span style="font-size:.875rem">${status.message}</span>
          </div>`;
      }
    } catch {}
  }

  window.setBilling = (b) => {
    billing = b;
    document.getElementById('btnMonthly').className = `btn ${b==='monthly'?'btn--primary':'btn--ghost'} btn--sm`;
    document.getElementById('btnMonthly').style.borderRadius = '40px';
    document.getElementById('btnYearly').className  = `btn ${b==='yearly' ?'btn--primary':'btn--ghost'} btn--sm`;
    document.getElementById('btnYearly').style.borderRadius = '40px';
    renderPlans();
  };

  window.setOwnWebsite = (v) => {
    ownWebsite = v;
    document.getElementById('btnNoSite').className  = `btn ${!v?'btn--primary':'btn--ghost'} btn--sm`;
    document.getElementById('btnNoSite').style.borderRadius = '40px';
    document.getElementById('btnHasSite').className = `btn ${v?'btn--primary':'btn--ghost'} btn--sm`;
    document.getElementById('btnHasSite').style.borderRadius = '40px';
    // With an existing business (business_id in the URL) the server prices
    // off the business's own has_own_website record, so asking again here
    // would be redundant. Without one — a first-time visitor subscribing
    // before they've created a business — we need it up front so the
    // discount can actually be applied at checkout.
    document.getElementById('ownWebsiteUrlWrap').style.display = (v && !params.get('business_id')) ? 'block' : 'none';
    renderPlans();
  };

  function renderPlans() {
    document.getElementById('plansGrid').innerHTML = plans.map(p => {
      const fullPrice = billing === 'yearly' ? p.price_yearly : p.price_monthly;
      const ownSitePrice = billing === 'yearly' ? p.price_yearly_own_website : p.price_monthly_own_website;
      const price = ownWebsite && ownSitePrice != null ? ownSitePrice : fullPrice;
      const isFree = p.tier === 'free';
      return `
        <div class="card" style="padding:1.75rem;display:flex;flex-direction:column;position:relative;${p.is_popular?'border:2px solid var(--clr-primary)':''}">
          ${p.is_popular?`<div style="position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:var(--clr-primary);color:#fff;padding:.25rem .9rem;border-radius:20px;font-size:.75rem;font-weight:700;white-space:nowrap">Most Popular</div>`:''}
          <div style="font-size:1.5rem;margin-bottom:.5rem">${p.tier==='free'?'🆓':p.tier==='starter'?'🚀':p.tier==='pro'?'⚡':'🏆'}</div>
          <h3 style="font-weight:700;font-size:1.1rem;margin-bottom:.25rem">${p.name}</h3>
          ${p.tagline?`<p style="font-size:.8rem;color:var(--clr-text-2);margin-bottom:.75rem">${p.tagline}</p>`:''}
          <div style="margin-bottom:1.25rem">
            ${isFree
              ? `<div style="font-size:2rem;font-weight:800">Free</div>`
              : `<div style="font-size:2rem;font-weight:800">${formatCurrency(price)}</div>
                 <div style="font-size:.8rem;color:var(--clr-text-3)">per ${billing==='yearly'?'year':'month'}</div>`}
          </div>
          ${p.tier==='starter'?`<div style="font-size:.7rem;font-weight:700;color:var(--clr-primary);background:rgba(78,13,173,.1);display:inline-block;padding:.2rem .6rem;border-radius:20px;margin-bottom:.6rem">1 month • no auto-renewal</div>`:''}
          <ul style="list-style:none;padding:0;margin:0 0 1.5rem;display:flex;flex-direction:column;gap:.5rem;flex:1">
            ${[
              p.max_businesses&&`Up to ${p.max_businesses} listing${p.max_businesses>1?'s':''}`,
              p.max_products&&`Up to ${p.max_products} products`,
              p.has_whatsapp_button&&'WhatsApp button',
              p.has_analytics&&'Analytics dashboard',
              p.has_bookings&&'Booking system',
              p.has_verified_badge&&'Verified badge',
              p.has_ai_content&&'AI content generation',
              p.has_seo_tools&&'SEO tools',
              p.has_custom_domain&&'Custom domain',
              p.has_priority_listing&&'Priority listing',
            ].filter(Boolean).map(f=>`<li style="display:flex;align-items:center;gap:.5rem;font-size:.85rem;color:var(--clr-text-2)"><i class="fa-solid fa-check" style="color:var(--clr-success);width:14px;flex-shrink:0"></i>${f}</li>`).join('')}
          </ul>
          <button class="btn ${p.is_popular?'btn--primary':'btn--outline'}" onclick="selectPlan('${p.tier}',${price},'${p.name}')">
            ${isFree ? 'Get Started Free' : `Choose ${p.name}`}
          </button>
        </div>`;
    }).join('');
  }

  let promoCode = '';
  window.applyPromo = async () => {
    const code = document.getElementById('promoInput').value.trim().toUpperCase();
    if (!code) return;
    if (!Auth.isLoggedIn()) { toast.warning('Please log in to apply a promo code'); return; }
    try {
      const { promo, discount } = await API.post('/payments/validate-promo', { code, amount: 100 });
      promoCode = code;
      document.getElementById('promoMsg').textContent = `✅ Code applied: ${promo.description || (promo.type==='percent'?promo.value+'% off':'GHS '+promo.value+' off')}`;
      document.getElementById('promoMsg').style.color = 'var(--clr-success)';
    } catch(e) {
      promoCode = '';
      document.getElementById('promoMsg').textContent = '❌ ' + (e.message || 'Invalid code');
      document.getElementById('promoMsg').style.color = 'var(--clr-danger)';
    }
  };

  window.selectPlan = async (tier, price, name) => {
    if (tier === 'free') { window.location.href = Auth.isLoggedIn() ? '/pages/dashboard.html?tab=new' : '/pages/register.html'; return; }
    if (!Auth.requireAuth()) return;
    const bizId = params.get('business_id') || null;

    // First-time visitors have no business yet, so the server can't look
    // up has_own_website from a business record — it has to trust what was
    // selected here. Existing businesses (bizId set) are always priced from
    // their own record instead; the claim below is ignored server-side in
    // that case.
    let claimedWebsite = null;
    if (!bizId && ownWebsite) {
      const url = document.getElementById('ownWebsiteUrl').value.trim();
      if (!/^https?:\/\/.+\..+/.test(url)) {
        toast.warning('Please enter a valid website URL, including https://');
        return;
      }
      claimedWebsite = url;
    }

    try {
      const btn = event.currentTarget;
      setLoading(btn, true, 'Redirecting…');
      const res = await API.post('/payments/initialize', {
        plan_tier: tier, billing_cycle: billing, business_id: bizId, promo_code: promoCode || null,
        has_own_website: bizId ? undefined : ownWebsite,
        website: claimedWebsite,
      });
      if (!bizId) {
        // Carry the answer forward so the "Add Business" form on the
        // dashboard can pre-fill it instead of asking a second time.
        sessionStorage.setItem('spotgh_own_website_choice', JSON.stringify({ has_own_website: ownWebsite, website: claimedWebsite || '' }));
      }
      if (res.fully_covered) {
        toast.success(`Covered by GHS ${res.referral_credit_applied} referral credit — no payment needed!`);
        setTimeout(() => window.location.href = res.redirect, 800);
        return;
      }
      window.location.href = res.authorization_url;
    } catch(e) { toast.error(e.message || 'Failed to initiate payment'); }
  };
});
