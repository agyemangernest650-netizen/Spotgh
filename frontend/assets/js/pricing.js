// assets/js/pricing.js
// Directory Listing and Mini-Website are two independent products
// (migration 018) — this page has a tab for each, plus a Bundles tab
// for buying both together at a discount.
document.addEventListener('DOMContentLoaded', async () => {
  loadComponents();

  const params = new URLSearchParams(location.search);
  if (params.get('payment') === 'success') toast.success('🎉 Payment successful! Your plan is now active.');
  if (params.get('payment') === 'failed')  toast.error('Payment failed. Please try again.');

  let billing = 'monthly';
  let activeTab = params.get('tab') === 'website' ? 'website' : params.get('tab') === 'bundles' ? 'bundles' : 'directory';
  let directoryPlans = [], websitePlans = [], bundles = [];
  let promoCode = '';

  document.getElementById('pageMain').innerHTML = `
    <div class="container" style="padding:3rem 1rem 5rem;max-width:1100px;margin:0 auto">
      <div style="text-align:center;margin-bottom:1.5rem">
        <h1 style="font-size:clamp(1.75rem,5vw,3rem);font-weight:800;margin-bottom:.75rem">Simple, Transparent Pricing</h1>
        <p style="color:var(--clr-text-2);max-width:560px;margin:0 auto 1.5rem">A Directory Listing gets you found. A Mini-Website gives you a real online presence. Buy either one on its own, or bundle both and save.</p>

        <div style="display:inline-flex;background:var(--clr-surface-2);border-radius:40px;padding:.25rem;gap:.25rem;flex-wrap:wrap;justify-content:center">
          <button id="tabDirectory" class="btn btn--sm" style="border-radius:40px" onclick="setTab('directory')"><i class="fa-solid fa-list"></i> Directory Listing</button>
          <button id="tabWebsite" class="btn btn--sm" style="border-radius:40px" onclick="setTab('website')"><i class="fa-solid fa-globe"></i> Mini-Website</button>
          <button id="tabBundles" class="btn btn--sm" style="border-radius:40px" onclick="setTab('bundles')"><i class="fa-solid fa-gift"></i> Bundles</button>
        </div>

        <div style="margin-top:.85rem">
          <div style="display:inline-flex;background:var(--clr-surface-2);border-radius:40px;padding:.25rem;gap:.25rem">
            <button id="btnMonthly" class="btn btn--primary btn--sm" style="border-radius:40px" onclick="setBilling('monthly')">Monthly</button>
            <button id="btnYearly" class="btn btn--ghost btn--sm" style="border-radius:40px" onclick="setBilling('yearly')">Yearly <span style="font-size:.7rem;background:var(--clr-success);color:#fff;padding:.1rem .4rem;border-radius:20px;margin-left:.3rem">Save 20%</span></button>
          </div>
        </div>
      </div>

      <div id="statusBanner" style="margin-bottom:2rem"></div>
      <div id="tabHint" style="text-align:center;font-size:.8rem;color:var(--clr-text-3);margin-bottom:1.25rem"></div>

      <div id="plansGrid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1.25rem;margin-bottom:3rem">
        ${[...Array(3)].map(()=>'<div class="card skeleton" style="height:400px"></div>').join('')}
      </div>

      <div style="text-align:center;margin-bottom:3rem">
        <div style="display:inline-flex;gap:.5rem;align-items:center;background:var(--clr-surface-2);padding:.75rem 1rem;border-radius:var(--radius-md);border:1px solid var(--clr-border)">
          <i class="fa-solid fa-tag" style="color:var(--clr-primary)"></i>
          <input id="promoInput" type="text" placeholder="Have a promo code?" style="border:none;background:transparent;outline:none;font-family:inherit;font-size:.875rem;color:var(--clr-text-1);width:200px">
          <button class="btn btn--primary btn--sm" onclick="applyPromo()">Apply</button>
        </div>
        <p id="promoMsg" style="font-size:.8rem;margin-top:.5rem;color:var(--clr-text-3)"></p>
      </div>

      <div style="max-width:640px;margin:0 auto">
        <h2 style="font-size:1.5rem;font-weight:700;text-align:center;margin-bottom:1.5rem">FAQ</h2>
        ${[
          { q:"Do I need both a Directory Listing and a Mini-Website?", a:"No — they're independent. Get a Free Directory Listing on its own, a Mini-Website on its own (if you don't already have a website), or bundle both at a discount." },
          { q:"I already have my own website — what do I need?", a:"Just a Directory Listing plan. Your listing links out to your existing site instead of using a SpotGH mini-website." },
          { q:"Does the Starter Website really start free?", a:"Yes — your first month on Starter Website is free, once per account. After that it bills at the normal monthly or yearly rate unless you cancel." },
          { q:"Can I upgrade or add the other product later?", a:"Absolutely, any time from your dashboard — add a Website plan to an existing Directory listing, or vice versa, or switch to a Bundle." },
          { q:"What payment methods are accepted?", a:"We accept MoMo, Vodafone Cash, AirtelTigo Money, and all major debit/credit cards via Paystack." },
        ].map(f=>`
          <details class="card" style="padding:1rem 1.25rem;margin-bottom:.75rem;cursor:pointer">
            <summary style="font-weight:600;list-style:none;display:flex;justify-content:space-between;align-items:center">
              ${f.q}<i class="fa-solid fa-chevron-down" style="font-size:.75rem;color:var(--clr-text-3)"></i>
            </summary>
            <p style="color:var(--clr-text-2);font-size:.875rem;margin:.75rem 0 0">${f.a}</p>
          </details>`).join('')}
      </div>
    </div>`;

  // Attached before the data fetch below — tab/billing switching must keep
  // working even if the plans API fails, instead of leaving onclick="setTab(...)"
  // pointing at a function that was never defined.
  window.setTab = (t) => { activeTab = t; renderTabs(); renderPlans(); };
  window.setBilling = (b) => {
    billing = b;
    document.getElementById('btnMonthly').className = `btn ${b==='monthly'?'btn--primary':'btn--ghost'} btn--sm`;
    document.getElementById('btnMonthly').style.borderRadius = '40px';
    document.getElementById('btnYearly').className  = `btn ${b==='yearly' ?'btn--primary':'btn--ghost'} btn--sm`;
    document.getElementById('btnYearly').style.borderRadius = '40px';
    renderPlans();
  };

  async function loadPlans() {
    try {
      const [dRes, wRes, bRes] = await Promise.all([
        API.get('/subscriptions/directory-plans'),
        API.get('/subscriptions/website-plans'),
        API.get('/subscriptions/bundles'),
      ]);
      directoryPlans = (dRes.plans || []).filter(p => p.is_active !== false);
      websitePlans   = (wRes.plans || []).filter(p => p.is_active !== false);
      bundles        = (bRes.bundles || []).filter(b => b.is_active !== false);
      renderTabs();
      renderPlans();
      return true;
    } catch {
      document.getElementById('plansGrid').innerHTML = `
        <div style="grid-column:1/-1;text-align:center;color:var(--clr-danger)">
          <p>Couldn't load plans right now.</p>
          <button class="btn btn--outline btn--sm" style="margin-top:.5rem" onclick="retryLoadPlans()">Try again</button>
        </div>`;
      return false;
    }
  }
  window.retryLoadPlans = () => loadPlans();
  const loaded = await loadPlans();
  if (!loaded) renderTabs(); // tabs/hint text still render even with no data

  if (Auth.isLoggedIn()) {
    try {
      const bizId = params.get('business_id');
      if (bizId) {
        const status = await API.get(`/subscriptions/status-v2?business_id=${bizId}`);
        const parts = [];
        if (status.directory) parts.push(`Directory: <strong>${status.directory.name}</strong>${status.directory.expires_at ? ' until ' + new Date(status.directory.expires_at).toLocaleDateString() : ''}`);
        if (status.website) parts.push(`Website: <strong>${status.website.name}</strong>${status.website.is_trial ? ' (free trial)' : ''} until ${new Date(status.website.expires_at).toLocaleDateString()}`);
        if (parts.length) document.getElementById('statusBanner').innerHTML = `
          <div style="text-align:center;background:rgba(78,13,173,.08);border:1px solid var(--clr-primary);border-radius:var(--radius-md);padding:.85rem 1.25rem;font-size:.875rem">${parts.join(' &nbsp;·&nbsp; ')}</div>`;
      }
    } catch {}
  }

  function renderTabs() {
    ['directory','website','bundles'].forEach(t => {
      const el = document.getElementById('tab' + t.charAt(0).toUpperCase() + t.slice(1));
      el.className = `btn ${activeTab === t ? 'btn--primary' : 'btn--ghost'} btn--sm`;
      el.style.borderRadius = '40px';
    });
    const hints = {
      directory: 'A listing in the SpotGH directory — searchable, with reviews and a Google Maps pin.',
      website: "A branded mini-website at spotgh.com/business/your-name (or your own domain on Professional+). Doesn't include a directory listing on its own.",
      bundles: 'Directory + Website together, at a discount.',
    };
    document.getElementById('tabHint').textContent = hints[activeTab];
  }

  function planIcon(tier) {
    return { free:'🆓', standard:'⭐', premium:'👑', starter:'🚀', professional:'💼', business_pro:'🏆' }[tier] || '✨';
  }

  function featureList(p, kind) {
    const dirFeatures = [
      p.max_businesses && `Up to ${p.max_businesses} listing${p.max_businesses>1?'s':''}`,
      p.max_photos && (p.max_photos >= 999 ? 'Unlimited photos' : `Up to ${p.max_photos} photos`),
      p.has_social_links && 'Social media links',
      p.has_whatsapp_button && 'WhatsApp button',
      p.has_business_hours && 'Business hours',
      p.has_verified_badge && 'Verified badge',
      p.has_better_ranking && 'Better search ranking',
      p.has_analytics && 'Business analytics',
      p.has_advanced_analytics && 'Advanced analytics',
      p.has_featured_offers && 'Featured offers',
      p.has_homepage_featured && 'Homepage featured listing',
      p.has_priority_listing && 'Sponsored search placement',
      p.has_video && 'Video',
      p.has_flash_deals && 'Flash Deals',
      p.has_franchise && 'Multiple branches',
      p.has_qr_code && 'Custom QR code',
      p.has_priority_support && 'Priority support',
    ];
    const webFeatures = [
      'Custom template, About, Services, Gallery, Contact',
      'WhatsApp + Google Maps',
      p.has_custom_domain && 'Custom domain support',
      p.has_bookings && 'Booking system',
      p.has_blog && 'Blog',
      p.has_testimonials && 'Testimonials',
      p.has_seo_tools && 'SEO tools',
      p.has_analytics && 'Analytics',
      p.has_forms && 'Forms',
      p.has_google_indexing && 'Google indexing',
      p.has_online_payments && 'Online payments',
      p.has_product_catalog && 'Product catalog',
      p.has_appointment_scheduling && 'Appointment scheduling',
      p.has_staff_management && 'Staff management',
      p.has_customer_dashboard && 'Customer dashboard',
      p.has_email_notifications && 'Email notifications',
      p.has_sms_notifications && 'SMS notifications',
      p.has_ai_content && 'AI content assistance',
      p.has_api_access && 'API access',
      p.has_priority_support && 'Priority support',
    ];
    return (kind === 'directory' ? dirFeatures : webFeatures).filter(Boolean);
  }

  function renderPlans() {
    const grid = document.getElementById('plansGrid');
    if (activeTab === 'bundles') { renderBundles(grid); return; }

    const list = activeTab === 'directory' ? directoryPlans : websitePlans;
    grid.innerHTML = list.map(p => {
      const price = billing === 'yearly' ? p.price_yearly : p.price_monthly;
      const isFree = p.tier === 'free';
      const isTrialPlan = p.tier === 'starter' && activeTab === 'website';
      return `
        <div class="card" style="padding:1.75rem;display:flex;flex-direction:column;position:relative;${p.is_popular?'border:2px solid var(--clr-primary)':''}">
          ${p.is_popular?`<div style="position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:var(--clr-primary);color:#fff;padding:.25rem .9rem;border-radius:20px;font-size:.75rem;font-weight:700;white-space:nowrap">Most Popular</div>`:''}
          <div style="font-size:1.5rem;margin-bottom:.5rem">${planIcon(p.tier)}</div>
          <h3 style="font-weight:700;font-size:1.1rem;margin-bottom:.25rem">${p.name}</h3>
          ${p.tagline?`<p style="font-size:.8rem;color:var(--clr-text-2);margin-bottom:.75rem">${p.tagline}</p>`:''}
          <div style="margin-bottom:.5rem">
            ${isFree
              ? `<div style="font-size:2rem;font-weight:800">Free</div>`
              : `<div style="font-size:2rem;font-weight:800">${formatCurrency(price)}</div>
                 <div style="font-size:.8rem;color:var(--clr-text-3)">per ${billing==='yearly'?'year':'month'}</div>`}
          </div>
          ${isTrialPlan?`<div style="font-size:.7rem;font-weight:700;color:var(--clr-primary);background:rgba(78,13,173,.1);display:inline-block;padding:.2rem .6rem;border-radius:20px;margin-bottom:.6rem">First month free</div>`:''}
          <ul style="list-style:none;padding:0;margin:0 0 1.5rem;display:flex;flex-direction:column;gap:.5rem;flex:1">
            ${featureList(p, activeTab).map(f=>`<li style="display:flex;align-items:center;gap:.5rem;font-size:.85rem;color:var(--clr-text-2)"><i class="fa-solid fa-check" style="color:var(--clr-success);width:14px;flex-shrink:0"></i>${f}</li>`).join('')}
          </ul>
          <button class="btn ${p.is_popular?'btn--primary':'btn--outline'}" onclick="selectPlan('${activeTab}','${p.tier}',${price},'${p.name}')">
            ${isFree ? 'Get Started Free' : `Choose ${p.name}`}
          </button>
        </div>`;
    }).join('');
  }

  function renderBundles(grid) {
    grid.innerHTML = bundles.map(b => {
      const dir = b.directory_plans, web = b.website_plans;
      const base = billing === 'yearly' ? Number(dir.price_yearly) + Number(web.price_yearly) : Number(dir.price_monthly) + Number(web.price_monthly);
      const price = Math.round(base * (1 - b.discount_percent / 100));
      return `
        <div class="card" style="padding:1.75rem;display:flex;flex-direction:column;position:relative;${b.is_popular?'border:2px solid var(--clr-primary)':''}">
          ${b.is_popular?`<div style="position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:var(--clr-primary);color:#fff;padding:.25rem .9rem;border-radius:20px;font-size:.75rem;font-weight:700;white-space:nowrap">Most Popular</div>`:''}
          <div style="font-size:1.5rem;margin-bottom:.5rem">🎁</div>
          <h3 style="font-weight:700;font-size:1.1rem;margin-bottom:.25rem">${b.name}</h3>
          <p style="font-size:.8rem;color:var(--clr-text-2);margin-bottom:.75rem">${b.tagline || ''}</p>
          <div style="margin-bottom:.25rem">
            <div style="font-size:2rem;font-weight:800">${formatCurrency(price)}</div>
            <div style="font-size:.8rem;color:var(--clr-text-3)">per ${billing==='yearly'?'year':'month'} · save ${b.discount_percent}%</div>
          </div>
          <ul style="list-style:none;padding:0;margin:1rem 0 1.5rem;display:flex;flex-direction:column;gap:.5rem;flex:1;font-size:.85rem;color:var(--clr-text-2)">
            <li><i class="fa-solid fa-list" style="color:var(--clr-primary);width:16px"></i> Directory: <strong>${dir.name}</strong></li>
            <li><i class="fa-solid fa-globe" style="color:var(--clr-primary);width:16px"></i> Website: <strong>${web.name}</strong></li>
          </ul>
          <button class="btn ${b.is_popular?'btn--primary':'btn--outline'}" onclick="selectPlan('bundle','${b.key}',${price},'${b.name}')">Choose ${b.name}</button>
        </div>`;
    }).join('') || '<p style="color:var(--clr-text-3);grid-column:1/-1;text-align:center">No bundles available right now.</p>';
  }

  window.applyPromo = async () => {
    const code = document.getElementById('promoInput').value.trim().toUpperCase();
    if (!code) return;
    if (!Auth.isLoggedIn()) { toast.warning('Please log in to apply a promo code'); return; }
    try {
      const { promo } = await API.post('/payments/validate-promo', { code, amount: 100 });
      promoCode = code;
      document.getElementById('promoMsg').textContent = `✅ Code applied: ${promo.description || (promo.type==='percent'?promo.value+'% off':'GHS '+promo.value+' off')}`;
      document.getElementById('promoMsg').style.color = 'var(--clr-success)';
    } catch(e) {
      promoCode = '';
      document.getElementById('promoMsg').textContent = '❌ ' + (e.message || 'Invalid code');
      document.getElementById('promoMsg').style.color = 'var(--clr-danger)';
    }
  };

  window.selectPlan = async (subscriptionType, planKey, price, name) => {
    if (subscriptionType === 'directory' && planKey === 'free') {
      window.location.href = Auth.isLoggedIn() ? '/pages/dashboard.html?tab=new&signup_type=directory' : '/pages/register.html';
      return;
    }
    if (!Auth.requireAuth()) return;
    const bizId = params.get('business_id') || null;
    try {
      const btn = event.currentTarget;
      setLoading(btn, true, 'Redirecting…');
      const res = await API.post('/payments/v2/initialize', {
        subscription_type: subscriptionType, plan_key: planKey, billing_cycle: billing,
        business_id: bizId, promo_code: promoCode || null,
      });
      if (res.fully_covered) {
        toast.success(res.is_trial ? '🎉 Your free month has started!' : `Covered by GHS ${res.referral_credit_applied} referral credit — no payment needed!`);
        setTimeout(() => window.location.href = res.redirect, 800);
        return;
      }
      window.location.href = res.authorization_url;
    } catch(e) { toast.error(e.message || 'Failed to initiate payment'); }
  };
});