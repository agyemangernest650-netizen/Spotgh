// assets/js/dashboard.js
document.addEventListener('DOMContentLoaded', () => {
  loadComponents();
  if (!Auth.requireAuth()) return;
  const user = Auth.getUser();

  document.getElementById('pageMain').innerHTML = `
    <div class="dashboard">
      <aside class="sidebar">
        <div class="sidebar__label">Main</div>
        <a href="/pages/dashboard.html" class="sidebar__item active"><i class="fa-solid fa-gauge"></i> Overview</a>
        <a href="/pages/dashboard.html?tab=businesses" class="sidebar__item"><i class="fa-solid fa-store"></i> My Businesses</a>
        <a href="/pages/dashboard.html?tab=new" class="sidebar__item"><i class="fa-solid fa-plus"></i> Add Business</a>
        <div class="sidebar__label">Account</div>
        <a href="/pages/subscriptions.html" class="sidebar__item"><i class="fa-solid fa-credit-card"></i> Subscription</a>
        <a href="/pages/saved.html" class="sidebar__item"><i class="fa-regular fa-heart"></i> Saved</a>
        <a href="/pages/referrals.html" class="sidebar__item"><i class="fa-solid fa-gift"></i> Referrals</a>
        <a href="/pages/franchise-manager.html" class="sidebar__item"><i class="fa-solid fa-store"></i> Franchise Manager</a>
        <a href="/pages/profile.html" class="sidebar__item"><i class="fa-solid fa-user"></i> Profile</a>
      </aside>
      <div class="dashboard__content">
        <div class="dashboard__header">
          <h1 class="dashboard__title">Dashboard</h1>
          <p style="color:var(--clr-text-2)">Welcome back, <strong>${user?.full_name?.split(' ')[0] || 'there'}</strong> 👋</p>
        </div>
        <div id="planBanner"></div>
        <div class="stat-grid" id="statGrid">
          ${['Businesses','Total Views','WhatsApp Clicks','Avg Rating'].map(() => '<div class="stat-card skeleton" style="height:130px"></div>').join('')}
        </div>
        <div id="dashContent">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem">
            <h2 style="font-size:1.25rem;font-weight:700">My Businesses</h2>
            <a href="/pages/dashboard.html?tab=new" class="btn btn--primary btn--sm"><i class="fa-solid fa-plus"></i> Add Business</a>
          </div>
          <div id="myBusinessesList">
            <div class="skeleton" style="height:120px;border-radius:12px;margin-bottom:.75rem"></div>
            <div class="skeleton" style="height:120px;border-radius:12px"></div>
          </div>
        </div>
      </div>
    </div>`;

  loadDashboard();
  loadPlanBanner();
  const tab = new URLSearchParams(location.search).get('tab');
  if (tab === 'new') loadNewBusinessTab();
  if (tab === 'subscription') loadSubscriptionTab();

  async function loadNewBusinessTab() {
    const content = document.getElementById('dashContent');
    document.querySelectorAll('.sidebar__item').forEach(a => a.classList.remove('active'));
    document.querySelector('a[href="/pages/dashboard.html?tab=new"]').classList.add('active');

    content.innerHTML = `<div class="skeleton" style="height:80px;border-radius:12px;margin-bottom:1.5rem"></div>`;
    try {
      const s = await API.get('/subscriptions/status');
      if (!s.is_active) {
        content.innerHTML = `
          <div class="empty-state">
            <div class="empty-state__icon">💳</div>
            <h3>Subscribe to list a business</h3>
            <p>You need an active plan — even the one-month Starter — before you can publish a business listing. Pick a plan, then come back here to register.</p>
            <a href="/pages/pricing.html" class="btn btn--primary">View Plans</a>
          </div>`;
        return;
      }
    } catch {}

    content.innerHTML = `
      <h2 style="font-size:1.25rem;font-weight:700;margin-bottom:.25rem">Register Your Business</h2>
      <p style="color:var(--clr-text-2);font-size:.875rem;margin-bottom:1.5rem">Pick a category first — it sets your mini-website's template and accent color. You can fine-tune everything later.</p>

      <div id="categoryPicker" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:.75rem;margin-bottom:1.75rem">
        <div class="skeleton" style="height:90px;border-radius:12px"></div>
        <div class="skeleton" style="height:90px;border-radius:12px"></div>
        <div class="skeleton" style="height:90px;border-radius:12px"></div>
      </div>

      <form id="newBizForm" style="display:none;max-width:560px">
        <input type="hidden" id="bizCategoryId">
        <input type="hidden" id="bizCategoryName">
        <input type="hidden" id="bizTemplateKey" value="default">
        <input type="hidden" id="bizThemeColor" value="#4E0DAD">
        <div id="chosenCategoryNote" style="background:var(--clr-primary-10);border:1px solid var(--clr-primary);border-radius:var(--radius-md);padding:.65rem 1rem;font-size:.825rem;margin-bottom:1.25rem;display:flex;align-items:center;gap:.5rem"></div>

        <div id="wizardProgress" style="display:flex;gap:.35rem;margin-bottom:1.5rem"></div>

        <div class="wiz-step" data-step="1">
          <h3 style="font-size:1rem;margin-bottom:1rem">Business Info</h3>
          <label class="form-label">Business name</label>
          <input id="bizName" class="form-input" placeholder="e.g. Buka Restaurant" required style="margin-bottom:1rem">
          <label class="form-label">Tagline</label>
          <input id="bizTagline" class="form-input" placeholder="One line that sells what you do" style="margin-bottom:1rem">
        </div>

        <div class="wiz-step" data-step="2" style="display:none">
          <h3 style="font-size:1rem;margin-bottom:1rem">Location & Contact</h3>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem">
            <div><label class="form-label">City</label><input id="bizCity" class="form-input" placeholder="Accra"></div>
            <div><label class="form-label">Region</label><input id="bizRegion" class="form-input" placeholder="Greater Accra"></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
            <div><label class="form-label">WhatsApp number</label><input id="bizWhatsapp" class="form-input" placeholder="0244000000"></div>
            <div><label class="form-label">Phone</label><input id="bizPhone" class="form-input" placeholder="0244000000"></div>
          </div>
        </div>

        <div class="wiz-step" data-step="3" style="display:none">
          <h3 style="font-size:1rem;margin-bottom:1rem">Description</h3>
          <label class="form-label">Tell customers what makes your business worth visiting</label>
          <textarea id="bizDescription" class="form-input" rows="5" placeholder="e.g. Family-run buka serving authentic jollof and waakye since 2015…"></textarea>
        </div>

        <div class="wiz-step" data-step="4" style="display:none">
          <h3 style="font-size:1rem;margin-bottom:1rem">Website or SpotGH Website?</h3>
          <label class="form-label">Do you already have a website? *</label>
          <div style="display:flex;gap:1.25rem;margin-bottom:.5rem">
            <label style="display:flex;align-items:center;gap:.4rem;font-size:.85rem;cursor:pointer">
              <input type="radio" name="bizHasWebsite" value="yes"> Yes, I have one
            </label>
            <label style="display:flex;align-items:center;gap:.4rem;font-size:.85rem;cursor:pointer">
              <input type="radio" name="bizHasWebsite" value="no"> No — build me a free SpotGH mini-website
            </label>
          </div>
          <input id="bizWebsite" class="form-input" type="url" placeholder="https://yourwebsite.com" style="display:none">
          <div style="font-size:.73rem;color:var(--clr-text-3);margin-top:.3rem">We'll link to it from your listing and check that it's live. If you don't have one yet, SpotGH builds and hosts a mini-website for you instead.</div>
        </div>

        <div class="wiz-step" data-step="5" style="display:none">
          <h3 style="font-size:1rem;margin-bottom:1rem">Review</h3>
          <div id="wizReview" style="background:var(--clr-surface-2);border-radius:var(--radius-md);padding:1rem;font-size:.85rem;line-height:1.9"></div>
          <p style="font-size:.78rem;color:var(--clr-text-3);margin-top:.75rem">You'll be able to add a logo, photos, and business hours right after this — those aren't required to submit.</p>
        </div>

        <div style="display:flex;gap:.75rem;margin-top:1.5rem">
          <button type="button" class="btn btn--ghost" id="wizBackBtn">Back</button>
          <button type="button" class="btn btn--primary" id="wizNextBtn">Next</button>
          <button type="submit" class="btn btn--primary" id="submitBizBtn" style="display:none"><i class="fa-solid fa-rocket"></i> Submit for Review</button>
        </div>
      </form>

      <div id="newBizSuccess" style="display:none;max-width:560px" class="empty-state">
        <div class="empty-state__icon">🎉</div>
        <h3 id="newBizSuccessTitle">Submitted!</h3>
        <p>It's now pending review — most listings go live within a day. While you wait, add a logo, photos, and your business hours to make it shine.</p>
        <div style="display:flex;gap:.75rem;justify-content:center;flex-wrap:wrap;margin-top:.5rem">
          <a id="newBizSuccessEditLink" href="#" class="btn btn--primary">Add Logo & Photos</a>
          <a href="/pages/dashboard.html" class="btn btn--ghost">Back to Dashboard</a>
        </div>
      </div>`;

    // If the user answered "already have a website?" on the pricing page
    // before subscribing (see pricing.js), pre-fill it here so they don't
    // have to answer twice — it's still editable.
    document.querySelectorAll('input[name="bizHasWebsite"]').forEach(r => {
      r.addEventListener('change', () => {
        document.getElementById('bizWebsite').style.display = r.value === 'yes' ? 'block' : 'none';
      });
    });
    try {
      const stored = JSON.parse(sessionStorage.getItem('spotgh_own_website_choice') || 'null');
      if (stored) {
        const radio = document.querySelector(`input[name="bizHasWebsite"][value="${stored.has_own_website ? 'yes' : 'no'}"]`);
        if (radio) {
          radio.checked = true;
          document.getElementById('bizWebsite').style.display = stored.has_own_website ? 'block' : 'none';
          if (stored.website) document.getElementById('bizWebsite').value = stored.website;
        }
      }
    } catch {}

    try {
      const { categories } = await API.get('/categories');
      const top = (categories || []).filter(c => !c.parent_id);
      const picker = document.getElementById('categoryPicker');
      if (!top.length) { picker.innerHTML = '<p style="color:var(--clr-text-3)">No categories available.</p>'; return; }
      picker.innerHTML = top.map(c => `
        <button type="button" class="card cat-pick" data-id="${c.id}" data-name="${c.name}" data-template="${c.template_key||'default'}"
          style="padding:1.1rem .75rem;text-align:center;border:1px solid var(--clr-border);cursor:pointer;background:var(--clr-surface)">
          <div style="font-size:1.6rem;margin-bottom:.4rem">${c.icon||'🏷️'}</div>
          <div style="font-size:.8rem;font-weight:600">${c.name}</div>
        </button>`).join('');

      const palette = { default:'#4E0DAD', restaurants:'#E8590C', 'beauty-salons':'#C2255C', hotels:'#0B7285', fashion:'#9C36B5', events:'#2F9E44' };
      picker.querySelectorAll('.cat-pick').forEach(btn => {
        btn.addEventListener('click', () => {
          const { id, name, template } = btn.dataset;
          document.getElementById('bizCategoryId').value = id;
          document.getElementById('bizCategoryName').value = name;
          document.getElementById('bizTemplateKey').value = template;
          document.getElementById('bizThemeColor').value = palette[template] || palette.default;
          document.getElementById('chosenCategoryNote').innerHTML = `<i class="fa-solid fa-circle-check" style="color:var(--clr-primary)"></i> Category: <strong>${name}</strong> — your mini-website will use the <strong>${template}</strong> template.`;
          picker.style.display = 'none';
          document.getElementById('newBizForm').style.display = 'block';
          showStep(1);
          document.getElementById('bizName').focus();
        });
      });
    } catch { document.getElementById('categoryPicker').innerHTML = '<p style="color:var(--clr-danger)">Failed to load categories.</p>'; }

    const STEP_LABELS = ['Info', 'Location', 'Description', 'Website', 'Review'];
    let currentStep = 1;

    function renderProgress(n) {
      document.getElementById('wizardProgress').innerHTML = STEP_LABELS.map((l, i) => {
        const step = i + 1;
        const state = step === n ? 'background:var(--clr-primary);color:#fff'
          : step < n ? 'background:var(--clr-primary-10);color:var(--clr-primary)'
          : 'background:var(--clr-surface-2);color:var(--clr-text-3)';
        return `<div style="flex:1;text-align:center;font-size:.68rem;font-weight:600;padding:.4rem .2rem;border-radius:6px;${state}">${step}. ${l}</div>`;
      }).join('');
    }

    function validateStep(n) {
      if (n === 1 && !document.getElementById('bizName').value.trim()) {
        toast.warning('Business name is required'); return false;
      }
      if (n === 4) {
        const checked = document.querySelector('input[name="bizHasWebsite"]:checked');
        if (!checked) { toast.warning('Please tell us whether you already have a website'); return false; }
        if (checked.value === 'yes' && !/^https?:\/\/.+\..+/.test(document.getElementById('bizWebsite').value.trim())) {
          toast.warning('Please enter a valid website URL, including https://'); return false;
        }
      }
      return true;
    }

    function renderReview() {
      const checked = document.querySelector('input[name="bizHasWebsite"]:checked');
      const website = checked?.value === 'yes' ? document.getElementById('bizWebsite').value.trim() : null;
      document.getElementById('wizReview').innerHTML = `
        <div><strong>Category:</strong> ${document.getElementById('bizCategoryName').value || '—'}</div>
        <div><strong>Name:</strong> ${document.getElementById('bizName').value.trim() || '—'}</div>
        <div><strong>Tagline:</strong> ${document.getElementById('bizTagline').value.trim() || '—'}</div>
        <div><strong>Location:</strong> ${[document.getElementById('bizCity').value.trim(), document.getElementById('bizRegion').value.trim()].filter(Boolean).join(', ') || '—'}</div>
        <div><strong>Contact:</strong> ${[document.getElementById('bizWhatsapp').value.trim(), document.getElementById('bizPhone').value.trim()].filter(Boolean).join(' / ') || '—'}</div>
        <div><strong>Website:</strong> ${website || (checked?.value === 'no' ? 'SpotGH mini-website' : '—')}</div>`;
    }

    window.showStep = (n) => {
      document.querySelectorAll('.wiz-step').forEach(el => el.style.display = (+el.dataset.step === n) ? 'block' : 'none');
      document.getElementById('wizBackBtn').textContent = n === 1 ? 'Change Category' : 'Back';
      document.getElementById('wizNextBtn').style.display = n === 5 ? 'none' : 'inline-flex';
      document.getElementById('submitBizBtn').style.display = n === 5 ? 'inline-flex' : 'none';
      renderProgress(n);
      if (n === 5) renderReview();
      currentStep = n;
    };

    document.getElementById('wizNextBtn').addEventListener('click', () => {
      if (validateStep(currentStep)) showStep(currentStep + 1);
    });
    document.getElementById('wizBackBtn').addEventListener('click', () => {
      if (currentStep === 1) {
        document.getElementById('newBizForm').style.display = 'none';
        document.getElementById('categoryPicker').style.display = 'grid';
      } else showStep(currentStep - 1);
    });

    document.getElementById('newBizForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('submitBizBtn');
      const name = document.getElementById('bizName').value.trim();
      if (!name) return toast.warning('Business name is required');
      const hasWebsiteChecked = document.querySelector('input[name="bizHasWebsite"]:checked');
      if (!hasWebsiteChecked) return toast.warning('Please tell us whether you already have a website');
      const hasOwnWebsite = hasWebsiteChecked.value === 'yes';
      const websiteUrl = document.getElementById('bizWebsite').value.trim();
      if (hasOwnWebsite && !/^https?:\/\/.+\..+/.test(websiteUrl)) {
        return toast.warning('Please enter a valid website URL, including https://');
      }
      setLoading(btn, true, 'Submitting…');
      try {
        const { business } = await API.post('/businesses', {
          name,
          tagline: document.getElementById('bizTagline').value.trim() || null,
          description: document.getElementById('bizDescription').value.trim() || null,
          city: document.getElementById('bizCity').value.trim() || null,
          region: document.getElementById('bizRegion').value.trim() || null,
          whatsapp: document.getElementById('bizWhatsapp').value.trim() || null,
          phone: document.getElementById('bizPhone').value.trim() || null,
          category_id: document.getElementById('bizCategoryId').value || null,
          template_key: document.getElementById('bizTemplateKey').value,
          theme_color: document.getElementById('bizThemeColor').value,
          has_own_website: hasOwnWebsite,
          website: hasOwnWebsite ? websiteUrl : '',
        });
        sessionStorage.removeItem('spotgh_own_website_choice');
        document.getElementById('newBizForm').style.display = 'none';
        document.getElementById('newBizSuccessTitle').textContent = `${business.name} submitted!`;
        document.getElementById('newBizSuccessEditLink').href = `/pages/business-edit.html?id=${business.id}`;
        document.getElementById('newBizSuccess').style.display = 'block';
      } catch (err) {
        setLoading(btn, false);
        if (err.code === 'LIMIT_REACHED' || err.redirect) {
          toast.warning(err.error || 'Upgrade your plan to add more businesses');
          setTimeout(() => window.location.href = '/pages/pricing.html', 1200);
        } else toast.error(err.message || 'Failed to create business');
      }
    });
  }

  async function loadSubscriptionTab() {
    const content = document.getElementById('dashContent');
    document.querySelectorAll('.sidebar__item').forEach(a => a.classList.remove('active'));
    document.querySelector('a[href="/pages/dashboard.html?tab=subscription"]').classList.add('active');
    content.innerHTML = `<h2 style="font-size:1.25rem;font-weight:700;margin-bottom:1rem">Subscription</h2><div id="subDetail" class="card" style="padding:1.5rem"><div class="skeleton" style="height:80px;border-radius:8px"></div></div>`;
    try {
      // Resolve which business this subscription belongs to so the pricing
      // page can apply the correct "already have a website" discount. With
      // one business the choice is unambiguous; with several, fall back to
      // the account-level view (each business has its own Manage Plan link
      // on the businesses list instead).
      const bizId = await singleBusinessId();
      const s = await API.get(bizId ? `/subscriptions/status?business_id=${bizId}` : '/subscriptions/status');
      const isTrial = s.subscription?.is_trial && s.is_active;
      const pricingHref = bizId ? `/pages/pricing.html?business_id=${bizId}` : '/pages/pricing.html';
      document.getElementById('subDetail').innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem">
          <div>
            <div style="font-size:.8rem;color:var(--clr-text-3)">Current plan</div>
            <div style="font-size:1.4rem;font-weight:800;text-transform:capitalize;display:flex;align-items:center;gap:.5rem">
              ${s.tier}
              ${isTrial ? '<span style="font-size:.7rem;font-weight:700;background:var(--clr-success);color:#fff;padding:.15rem .5rem;border-radius:20px;text-transform:none">Free Trial</span>' : ''}
            </div>
            ${s.is_active ? `<div style="font-size:.8rem;color:var(--clr-text-2);margin-top:.25rem">${s.days_left} day${s.days_left===1?'':'s'} remaining · ${isTrial ? 'free trial — payment needed after' : "doesn't auto-renew"}</div>` : `<div style="font-size:.8rem;color:var(--clr-danger);margin-top:.25rem">No active paid plan</div>`}
          </div>
          <a href="${pricingHref}" class="btn btn--primary">${s.is_active ? 'Upgrade Plan' : 'Choose a Plan'}</a>
        </div>
        ${s.message ? `<p style="margin-top:1rem;font-size:.85rem;color:var(--clr-text-2)">${s.message}</p>` : ''}`;
    } catch { document.getElementById('subDetail').innerHTML = '<p style="color:var(--clr-danger)">Failed to load subscription.</p>'; }
  }

  // Returns the id of the account's only business, or null if there are
  // zero or several (in which case per-business links elsewhere should be
  // used instead of guessing which business a generic action applies to).
  async function singleBusinessId() {
    try {
      const { businesses } = await API.get('/businesses/my');
      return businesses && businesses.length === 1 ? businesses[0].id : null;
    } catch { return null; }
  }

  async function loadPlanBanner() {
    try {
      const bizId = await singleBusinessId();
      const s = await API.get(bizId ? `/subscriptions/status?business_id=${bizId}` : '/subscriptions/status');
      const isTrial = s.subscription?.is_trial && s.is_active;
      if (!s.message && !isTrial) return;
      const msg = isTrial
        ? `🎉 You're on a free 30-day Starter trial — ${s.days_left} day${s.days_left===1?'':'s'} left. No payment needed until it ends.`
        : s.message;
      const pricingHref = bizId ? `/pages/pricing.html?business_id=${bizId}` : '/pages/pricing.html';
      document.getElementById('planBanner').innerHTML = `
        <div style="display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;background:${s.is_active?'rgba(78,13,173,.08)':'rgba(220,53,69,.08)'};border:1px solid ${s.is_active?'var(--clr-primary)':'var(--clr-danger)'};border-radius:var(--radius-md);padding:.85rem 1.1rem;margin-bottom:1.5rem">
          <i class="fa-solid ${s.is_active?'fa-clock':'fa-triangle-exclamation'}" style="color:${s.is_active?'var(--clr-primary)':'var(--clr-danger)'}"></i>
          <span style="font-size:.875rem;flex:1">${msg}</span>
          <a href="${pricingHref}" class="btn btn--sm ${s.is_active?'btn--outline':'btn--primary'}">${s.is_active?'Upgrade':'Renew or Upgrade'}</a>
        </div>`;
    } catch {}
  }

  async function loadDashboard() {
    try {
      const { businesses } = await API.get('/businesses/my');
      const totalViews = businesses.reduce((s,b) => s+(b.view_count||0), 0);
      const totalWA    = businesses.reduce((s,b) => s+(b.whatsapp_click_count||0), 0);
      const avgRating  = businesses.length ? (businesses.reduce((s,b) => s+(b.avg_rating||0),0)/businesses.length).toFixed(1) : '—';

      document.getElementById('statGrid').innerHTML = [
        { label:'My Businesses', value:businesses.length, icon:'🏪', color:'var(--clr-primary)', bg:'var(--clr-primary-10)' },
        { label:'Total Views',   value:totalViews.toLocaleString(), icon:'👁', color:'var(--clr-success)', bg:'rgba(34,197,94,.1)' },
        { label:'WhatsApp Clicks', value:totalWA.toLocaleString(), icon:'💬', color:'#25D366', bg:'rgba(37,211,102,.1)' },
        { label:'Avg Rating',    value:avgRating, icon:'⭐', color:'var(--clr-gold)', bg:'rgba(244,162,41,.1)' },
      ].map(k => `
        <div class="stat-card">
          <div class="stat-card__icon" style="background:${k.bg};color:${k.color};font-size:1.5rem">${k.icon}</div>
          <div class="stat-card__label">${k.label}</div>
          <div class="stat-card__value">${k.value}</div>
        </div>`).join('');

      const list = document.getElementById('myBusinessesList');
      if (!businesses.length) {
        list.innerHTML = `
          <div class="empty-state">
            <div class="empty-state__icon">🏪</div>
            <h3>No businesses yet</h3>
            <p>Subscribe to a plan and add your first business to get started.</p>
            <div style="display:flex;gap:.75rem;justify-content:center;flex-wrap:wrap">
              <a href="/pages/pricing.html" class="btn btn--primary">View Plans</a>
              <a href="/pages/dashboard.html?tab=new" class="btn btn--ghost">Add Business</a>
            </div>
          </div>`;
        return;
      }

      list.innerHTML = businesses.map(b => `
        <div class="card" style="padding:1.25rem;display:flex;align-items:center;gap:1.25rem;margin-bottom:.75rem;flex-wrap:wrap">
          ${b.logo_url
            ? `<img src="${b.logo_url}" style="width:64px;height:64px;object-fit:cover;border-radius:10px;flex-shrink:0">`
            : `<div style="width:64px;height:64px;border-radius:10px;background:var(--clr-surface-2);display:flex;align-items:center;justify-content:center;font-size:1.75rem;flex-shrink:0">${b.category_icon||'🏢'}</div>`}
          <div style="flex:1;min-width:180px">
            <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.25rem">
              <strong style="font-size:1rem">${b.name}</strong>
              <span class="badge ${b.status==='active'?'badge--success':b.status==='pending'?'badge--warning':'badge--danger'}">${b.status}</span>
              ${b.is_featured ? '<span class="badge badge--primary">⭐ Featured</span>' : ''}
            </div>
            <div style="font-size:.825rem;color:var(--clr-text-2)">${b.category_name||''} ${b.city?' · '+b.city:''}</div>
            <div style="font-size:.75rem;color:var(--clr-text-3);margin-top:.25rem">
              👁 ${(b.view_count||0).toLocaleString()} · ⭐ ${b.avg_rating||'—'} · 📝 ${b.review_count||0} reviews
            </div>
          </div>
          <div style="display:flex;gap:.5rem;flex-wrap:wrap;justify-content:flex-end">
            ${b.status==='active' ? `<a href="/pages/business.html?slug=${b.slug}" class="btn btn--ghost btn--sm" target="_blank"><i class="fa-solid fa-eye"></i></a>` : ''}
            <a href="/pages/business-edit.html?id=${b.id}" class="btn btn--outline btn--sm"><i class="fa-solid fa-pen"></i> Edit</a>
            <a href="/pages/analytics.html?id=${b.id}" class="btn btn--ghost btn--sm" title="Analytics"><i class="fa-solid fa-chart-line"></i></a>
            <a href="/pages/gallery.html?id=${b.id}" class="btn btn--ghost btn--sm" title="Gallery"><i class="fa-solid fa-images"></i></a>
            <a href="/pages/products.html?id=${b.id}" class="btn btn--ghost btn--sm" title="Products"><i class="fa-solid fa-box"></i></a>
            <a href="/pages/bookings.html?id=${b.id}" class="btn btn--ghost btn--sm" title="Bookings"><i class="fa-solid fa-calendar"></i></a>
            <a href="/pages/business-orders.html?id=${b.id}" class="btn btn--ghost btn--sm" title="Orders"><i class="fa-solid fa-bag-shopping"></i></a>
            <a href="/pages/messages.html?id=${b.id}" class="btn btn--ghost btn--sm" title="Messages"><i class="fa-solid fa-comment"></i></a>
            <a href="/pages/deals-manager.html?id=${b.id}" class="btn btn--ghost btn--sm" title="Deals & Coupons"><i class="fa-solid fa-tags"></i></a>
            <a href="/pages/events-manager.html?id=${b.id}" class="btn btn--ghost btn--sm" title="Events"><i class="fa-solid fa-champagne-glasses"></i></a>
            <a href="/pages/leads.html" class="btn btn--ghost btn--sm" title="Lead Marketplace"><i class="fa-solid fa-bullhorn"></i></a>
            <a href="/pages/health.html?id=${b.id}" class="btn btn--ghost btn--sm" title="Health Score"><i class="fa-solid fa-heart-pulse"></i></a>
            <a href="/pages/pricing.html?business_id=${b.id}" class="btn btn--ghost btn--sm" title="Manage Plan"><i class="fa-solid fa-credit-card"></i></a>
          </div>
        </div>`).join('');

      // Start tour for new users
      if (!localStorage.getItem('sgh_tour_done')) {
        setTimeout(() => startTour([
          { target:'.dashboard__title',  title:'Welcome to your Dashboard!', text:'This is your control centre. Track views, manage businesses, and grow your presence across Ghana.' },
          { target:'#statGrid',          title:'Your Stats',                  text:'See your total views, WhatsApp clicks, and ratings at a glance.' },
          { target:'#myBusinessesList',  title:'Your Businesses',             text:'All your listings appear here. Edit, view analytics, or manage gallery and products.' },
          { target:'a[href="/pages/pricing.html"]', title:'Choose a Plan',    text:'You need an active subscription to go live. Subscribe to start reaching customers!' },
        ]), 1500);
      }
    } catch(err) { toast.error('Failed to load dashboard'); }
  }
});
