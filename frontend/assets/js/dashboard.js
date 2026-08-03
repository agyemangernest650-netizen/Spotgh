// assets/js/dashboard.js
document.addEventListener('DOMContentLoaded', () => {
  loadComponents();
  if (!Auth.requireAuth()) return;
  const user = Auth.getUser();

  const initialTab = new URLSearchParams(location.search).get('tab');

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
        ${!initialTab ? `<div class="stat-grid" id="statGrid">
          ${['Businesses','Total Views','WhatsApp Clicks','Avg Rating'].map(() => '<div class="stat-card skeleton" style="height:130px"></div>').join('')}
        </div>` : ''}
        <div id="dashContent">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem">
            <h2 style="font-size:1.25rem;font-weight:700">My Businesses</h2>
            <a href="/pages/dashboard.html?tab=new" class="btn btn--primary btn--sm"><i class="fa-solid fa-plus"></i> Add Business</a>
          </div>
          <div id="incompleteBizReminder" style="display:none"></div>
          <div id="myBusinessesList">
            <div class="skeleton" style="height:120px;border-radius:12px;margin-bottom:.75rem"></div>
            <div class="skeleton" style="height:120px;border-radius:12px"></div>
          </div>
        </div>
      </div>
    </div>`;

  const tab = initialTab;
  if (tab === 'new') loadNewBusinessTab();
  else if (tab === 'subscription') loadSubscriptionTab();
  else loadDashboard();
  loadPlanBanner();

  if (new URLSearchParams(location.search).get('payment') === 'success') {
    try {
      const finishing = JSON.parse(sessionStorage.getItem('spotgh_finish_business') || 'null');
      if (finishing) {
        sessionStorage.removeItem('spotgh_finish_business');
        toast.success(`Payment confirmed — ${finishing.name} is live! Add its location, description, and branding to finish setting it up.`);
        setTimeout(() => { window.location.href = `/pages/business-edit.html?id=${finishing.id}`; }, 2200);
      } else {
        toast.success('Payment confirmed — your plan is active!');
      }
    } catch { toast.success('Payment confirmed — your plan is active!'); }
  }

  async function loadNewBusinessTab() {
    const content = document.getElementById('dashContent');
    document.querySelectorAll('.sidebar__item').forEach(a => a.classList.remove('active'));
    document.querySelector('a[href="/pages/dashboard.html?tab=new"]').classList.add('active');

    const isCreator = user?.role === 'creator';
    let creatorForceDirectoryTier = null, creatorForceWebsiteTier = null;
    let pendingPaidPlan = null; // set when a paid plan needs immediate checkout, before any business details

    let signupType = new URLSearchParams(location.search).get('signup_type');
    if (!['directory','website','both'].includes(signupType)) signupType = null;

    content.innerHTML = `
      <h2 style="font-size:1.25rem;font-weight:700;margin-bottom:.25rem">What would you like to do?</h2>
      <p style="color:var(--clr-text-2);font-size:.875rem;margin-bottom:1.5rem" id="newBizIntro">Choose how you want to use SpotGH.</p>

      <div id="signupTypePicker" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.85rem;margin-bottom:1.75rem;max-width:640px">
        <button type="button" class="card signup-type-pick" data-type="directory" style="padding:1.25rem 1rem;text-align:left;border:1px solid var(--clr-border);cursor:pointer;background:var(--clr-surface)">
          <div style="font-size:1.6rem;margin-bottom:.4rem">📍</div>
          <div style="font-weight:700;margin-bottom:.25rem">List My Business</div>
          <div style="font-size:.78rem;color:var(--clr-text-2)">Get discovered by customers searching SpotGH — already have a website? Just link it.</div>
        </button>
        <button type="button" class="card signup-type-pick" data-type="website" style="padding:1.25rem 1rem;text-align:left;border:1px solid var(--clr-border);cursor:pointer;background:var(--clr-surface)">
          <div style="font-size:1.6rem;margin-bottom:.4rem">🌐</div>
          <div style="font-weight:700;margin-bottom:.25rem">Create a Business Website</div>
          <div style="font-size:.78rem;color:var(--clr-text-2)">A professional website for your business — first month free.</div>
        </button>
        <button type="button" class="card signup-type-pick" data-type="both" style="padding:1.25rem 1rem;text-align:left;border:2px solid var(--clr-primary);cursor:pointer;background:var(--clr-surface)">
          <div style="font-size:1.6rem;margin-bottom:.4rem">🚀</div>
          <div style="font-size:.68rem;font-weight:700;color:var(--clr-primary);margin-bottom:.25rem">RECOMMENDED</div>
          <div style="font-weight:700;margin-bottom:.25rem">List + Create Website</div>
          <div style="font-size:.78rem;color:var(--clr-text-2)">Get listed on SpotGH and create your professional business website.</div>
        </button>
      </div>

      <div id="planPicker" style="display:none;max-width:640px;margin-bottom:1.75rem">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">
          <button type="button" class="btn btn--ghost btn--sm" id="planPickerBack"><i class="fa-solid fa-arrow-left"></i> Back</button>
          <div style="display:inline-flex;background:var(--clr-surface-2);border-radius:40px;padding:.2rem;gap:.2rem">
            <button type="button" class="btn btn--primary btn--sm" id="planPickerMonthly" style="border-radius:40px">Monthly</button>
            <button type="button" class="btn btn--ghost btn--sm" id="planPickerYearly" style="border-radius:40px">Yearly</button>
          </div>
        </div>
        <div id="planPickerGrid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.85rem">
          <div class="card skeleton" style="height:220px"></div>
          <div class="card skeleton" style="height:220px"></div>
        </div>
      </div>

      <div id="categoryPicker" style="display:none;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:.75rem;margin-bottom:1.75rem">
        <div class="skeleton" style="height:90px;border-radius:12px"></div>
        <div class="skeleton" style="height:90px;border-radius:12px"></div>
        <div class="skeleton" style="height:90px;border-radius:12px"></div>
      </div>

      <form id="quickCheckoutForm" style="display:none;max-width:480px">
        <input type="hidden" id="qcCategoryId">
        <input type="hidden" id="qcCategoryName">
        <input type="hidden" id="qcTemplateKey" value="default">
        <input type="hidden" id="qcThemeColor" value="#4E0DAD">
        <h3 style="font-size:1rem;margin-bottom:.25rem">Just the basics for now</h3>
        <p id="qcPlanNote" style="font-size:.825rem;color:var(--clr-text-2);margin-bottom:1.25rem"></p>
        <label class="form-label">Business name</label>
        <input id="qcName" class="form-input" placeholder="e.g. Buka Restaurant" required style="margin-bottom:1rem">
        <label class="form-label">Tagline (optional)</label>
        <input id="qcTagline" class="form-input" placeholder="One line that sells what you do" style="margin-bottom:1.25rem">
        <div id="qcSlugRow" style="display:none">
          <label class="form-label">Your website address</label>
          <div style="display:flex;align-items:center;gap:0;margin-bottom:.35rem">
            <input id="qcSlug" class="form-input" placeholder="yourbusiness" style="border-radius:8px 0 0 8px">
            <span style="background:var(--clr-surface-2);border:1px solid var(--clr-border);border-left:none;border-radius:0 8px 8px 0;padding:.6rem .75rem;font-size:.85rem;color:var(--clr-text-2);white-space:nowrap">.spotgh.com</span>
          </div>
          <div id="qcSlugStatus" style="font-size:.78rem;margin-bottom:1.25rem;min-height:1.1em"></div>
        </div>
        <div style="display:flex;gap:.75rem">
          <button type="button" class="btn btn--ghost" id="qcBackBtn">Change Category</button>
          <button type="submit" class="btn btn--primary" id="qcPayBtn"><i class="fa-solid fa-lock"></i> Continue to Payment</button>
        </div>
        <p style="font-size:.73rem;color:var(--clr-text-3);margin-top:.9rem">Once payment's confirmed, you'll come right back to finish location, description, and branding.</p>
      </form>

      <div style="display:flex;gap:1.5rem;flex-wrap:wrap;align-items:flex-start">
      <form id="newBizForm" style="display:none;flex:1;min-width:280px;max-width:560px">
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
          <h3 style="font-size:1rem;margin-bottom:.25rem">Branding</h3>
          <p style="font-size:.8rem;color:var(--clr-text-2);margin-bottom:1rem">This is what makes your mini-website feel like yours — watch the preview update as you go.</p>
          <label class="form-label">Your website address</label>
          <div style="display:flex;align-items:center;gap:0;margin-bottom:.35rem">
            <input id="bizSlug" class="form-input" placeholder="yourbusiness" style="border-radius:8px 0 0 8px">
            <span style="background:var(--clr-surface-2);border:1px solid var(--clr-border);border-left:none;border-radius:0 8px 8px 0;padding:.6rem .75rem;font-size:.85rem;color:var(--clr-text-2);white-space:nowrap">.spotgh.com</span>
          </div>
          <div id="slugStatus" style="font-size:.78rem;margin-bottom:1.25rem;min-height:1.1em"></div>
          <label class="form-label">Accent color</label>
          <div id="colorSwatches" style="display:flex;gap:.5rem;margin-bottom:1.25rem;flex-wrap:wrap"></div>
          <label class="form-label">Logo (optional — you can also add this later)</label>
          <input type="file" id="bizLogoFile" accept="image/*" class="form-input" style="margin-bottom:.4rem">
          <div style="font-size:.73rem;color:var(--clr-text-3)">Square images work best. JPG or PNG, under 5MB.</div>
        </div>

        <div class="wiz-step" data-step="5" style="display:none">
          <h3 style="font-size:1rem;margin-bottom:1rem">Review</h3>
          <div id="wizReview" style="background:var(--clr-surface-2);border-radius:var(--radius-md);padding:1rem;font-size:.85rem;line-height:1.9"></div>
          <p id="wizReviewNote" style="font-size:.78rem;color:var(--clr-text-3);margin-top:.75rem">You'll be able to add photos and business hours right after this — those aren't required to submit.</p>
        </div>

        <div style="display:flex;gap:.75rem;margin-top:1.5rem">
          <button type="button" class="btn btn--ghost" id="wizBackBtn">Back</button>
          <button type="button" class="btn btn--primary" id="wizNextBtn">Next</button>
          <button type="submit" class="btn btn--primary" id="submitBizBtn" style="display:none"><i class="fa-solid fa-rocket"></i> Submit for Review</button>
        </div>
      </form>

      <div id="bizPreviewPanel" style="display:none;flex:1;min-width:260px;max-width:340px;position:sticky;top:1rem">
        <div style="font-size:.7rem;font-weight:700;color:var(--clr-text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.5rem">Live Preview</div>
        <div class="card" style="overflow:hidden;padding:0">
          <div id="previewHeader" style="height:70px;background:#4E0DAD;position:relative;transition:background .2s"></div>
          <div style="padding:0 1rem 1rem">
            <div id="previewLogo" style="width:56px;height:56px;border-radius:12px;background:#fff;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.15);display:flex;align-items:center;justify-content:center;font-size:1.5rem;overflow:hidden;margin-top:-28px;margin-bottom:.6rem">🏢</div>
            <div id="previewName" style="font-weight:700;font-size:1rem">Your Business Name</div>
            <div id="previewTagline" style="font-size:.8rem;color:var(--clr-text-2);margin-bottom:.4rem">Your tagline goes here</div>
            <div id="previewLocation" style="font-size:.75rem;color:var(--clr-text-3);margin-bottom:.5rem"></div>
            <div id="previewDescription" style="font-size:.78rem;color:var(--clr-text-2);line-height:1.5"></div>
          </div>
        </div>
        <p style="font-size:.73rem;color:var(--clr-text-3);margin-top:.5rem">A quick preview of your mini-website — the real one has your full template and layout.</p>
      </div>
      </div>

      <div id="newBizSuccess" style="display:none;max-width:560px" class="empty-state">
        <div class="empty-state__icon">🎉</div>
        <h3 id="newBizSuccessTitle">Submitted!</h3>
        <p>It's now pending review — most listings go live within a day. While you wait, add a logo, photos, and your business hours to make it shine.</p>
        <div style="display:flex;gap:.75rem;justify-content:center;flex-wrap:wrap;margin-top:.5rem">
          <a id="newBizSuccessEditLink" href="#" class="btn btn--primary">Add Logo & Photos</a>
          <a href="/pages/dashboard.html" class="btn btn--ghost">Back to Dashboard</a>
        </div>
      </div>`;

    function revealCategoryPicker() {
      document.getElementById('signupTypePicker').style.display = 'none';
      document.getElementById('planPicker').style.display = 'none';
      document.getElementById('categoryPicker').style.display = 'grid';
      document.getElementById('newBizIntro').textContent = "Pick a category first — it sets your mini-website's template and accent color. You can fine-tune everything later.";
    }

    let planBilling = 'monthly';
    function planPrice(p) {
      if (p.directory_plans && p.website_plans) {
        // Bundle: no price of its own — it's discount_percent off the
        // sum of its underlying Directory + Website plan prices, same
        // computation pricing.js uses for its own bundle cards.
        const dir = p.directory_plans, web = p.website_plans;
        const base = planBilling === 'yearly' ? Number(dir.price_yearly) + Number(web.price_yearly) : Number(dir.price_monthly) + Number(web.price_monthly);
        return Math.round(base * (1 - (p.discount_percent || 0) / 100));
      }
      return planBilling === 'yearly' ? p.price_yearly : p.price_monthly;
    }

    function planCard(type, key, name, tagline, price, isPopular, isFree, discountPercent) {
      return `
        <div class="card" style="padding:1.1rem 1rem;border:${isPopular ? '2px solid var(--clr-primary)' : '1px solid var(--clr-border)'};text-align:left">
          ${isPopular ? `<div style="font-size:.68rem;font-weight:700;color:var(--clr-primary);margin-bottom:.35rem">MOST POPULAR</div>` : ''}
          <div style="font-weight:700;margin-bottom:.15rem">${name}</div>
          <div style="font-size:.75rem;color:var(--clr-text-2);margin-bottom:.6rem">${tagline || ''}</div>
          <div style="font-weight:700;margin-bottom:.75rem">${isFree ? 'Free' : `₵${price}${planBilling === 'yearly' ? '/yr' : '/mo'}${discountPercent ? ` <span style="font-weight:600;color:var(--clr-success);font-size:.72rem">save ${discountPercent}%</span>` : ''}`}</div>
          <button type="button" class="btn ${isPopular ? 'btn--primary' : 'btn--outline'} btn--sm plan-pick" data-type="${type}" data-key="${key}" style="width:100%;margin-bottom:${isCreator && !isFree ? '.4rem' : '0'}">Choose</button>
          ${isCreator && !isFree ? `<button type="button" class="btn btn--ghost btn--sm plan-comp" data-type="${type}" data-key="${key}" style="width:100%">🎁 Grant free (creator)</button>` : ''}
        </div>`;
    }

    async function showPlanPicker(type) {
      document.getElementById('signupTypePicker').style.display = 'none';
      const picker = document.getElementById('planPicker');
      picker.style.display = 'block';
      document.getElementById('newBizIntro').textContent = 'Choose a plan for this business — you can change it any time from your dashboard.';
      const grid = document.getElementById('planPickerGrid');
      grid.innerHTML = `<div class="card skeleton" style="height:220px"></div><div class="card skeleton" style="height:220px"></div>`;
      try {
        if (type === 'directory') {
          const { plans } = await API.get('/subscriptions/directory-plans');
          grid.innerHTML = (plans || []).filter(p => p.is_active !== false).map(p =>
            planCard('directory', p.tier, p.name, p.tagline, planPrice(p), !!p.is_popular, p.tier === 'free')).join('');
        } else if (type === 'website') {
          const { plans } = await API.get('/subscriptions/website-plans');
          grid.innerHTML = (plans || []).filter(p => p.is_active !== false).map(p =>
            planCard('website', p.tier, p.name, p.tagline, planPrice(p), !!p.is_popular, false)).join('');
        } else {
          const { bundles } = await API.get('/subscriptions/bundles');
          grid.innerHTML = (bundles || []).filter(b => b.is_active !== false).map(b => {
            const card = planCard('bundle', b.key, b.name, b.tagline, planPrice(b), !!b.is_popular, false, b.discount_percent);
            // Stash the bundle's underlying directory/website tiers on the
            // comp button (only rendered for creators) so granting it can
            // set both subscriptions at once.
            return card.replace('class="btn btn--ghost btn--sm plan-comp"',
              `class="btn btn--ghost btn--sm plan-comp" data-dir-tier="${b.directory_plans?.tier || ''}" data-web-tier="${b.website_plans?.tier || ''}"`);
          }).join('');
        }
      } catch {
        grid.innerHTML = `<p style="color:var(--clr-danger);grid-column:1/-1">Couldn't load plans. <button type="button" class="btn btn--outline btn--sm" id="planPickerRetry">Try again</button></p>`;
        document.getElementById('planPickerRetry')?.addEventListener('click', () => showPlanPicker(type));
        return;
      }
      try {
        const pending = JSON.parse(sessionStorage.getItem('spotgh_pending_plan') || 'null');
        if (pending && pending.subscription_type === type) {
          const match = grid.querySelector(`.plan-pick[data-key="${pending.plan_key}"]`);
          if (match) {
            match.closest('.card').style.outline = '2px solid var(--clr-primary)';
            match.insertAdjacentHTML('beforebegin', `<div style="font-size:.68rem;font-weight:700;color:var(--clr-primary);margin-bottom:.4rem">✓ SELECTED ON PRICING PAGE</div>`);
          }
        }
      } catch {}
      grid.querySelectorAll('.plan-pick').forEach(btn => {
        btn.addEventListener('click', () => {
          const { type: subscriptionType, key } = btn.dataset;
          // Free Directory and the once-per-account Website Starter trial
          // don't need payment up front — the full wizard's existing
          // deferred-checkout logic already handles those correctly.
          // Every other paid plan charges immediately, before any business
          // details are collected, since a subscription needs a business
          // to exist but shouldn't require a full form first.
          const isFreeEligible = (subscriptionType === 'directory' && key === 'free') || (subscriptionType === 'website' && key === 'starter');
          if (isFreeEligible) {
            sessionStorage.setItem('spotgh_pending_plan', JSON.stringify({ subscription_type: subscriptionType, plan_key: key, billing: planBilling }));
            pendingPaidPlan = null;
          } else {
            sessionStorage.removeItem('spotgh_pending_plan');
            pendingPaidPlan = { subscription_type: subscriptionType, plan_key: key, billing: planBilling };
          }
          revealCategoryPicker();
        });
      });
      grid.querySelectorAll('.plan-comp').forEach(btn => {
        btn.addEventListener('click', () => {
          sessionStorage.removeItem('spotgh_pending_plan'); // comped, not purchased
          pendingPaidPlan = null;
          const { type: subscriptionType, key, dirTier, webTier } = btn.dataset;
          if (subscriptionType === 'directory') creatorForceDirectoryTier = key;
          else if (subscriptionType === 'website') creatorForceWebsiteTier = key;
          else { creatorForceDirectoryTier = dirTier || null; creatorForceWebsiteTier = webTier || null; }
          toast.success(`Will grant this business a free ${key} plan once created`);
          revealCategoryPicker();
        });
      });
    }

    document.getElementById('planPickerBack').addEventListener('click', () => {
      document.getElementById('planPicker').style.display = 'none';
      document.getElementById('signupTypePicker').style.display = 'grid';
      document.getElementById('newBizIntro').textContent = 'What do you want to set up?';
    });
    document.getElementById('planPickerMonthly').addEventListener('click', () => {
      planBilling = 'monthly';
      document.getElementById('planPickerMonthly').className = 'btn btn--primary btn--sm';
      document.getElementById('planPickerYearly').className = 'btn btn--ghost btn--sm';
      showPlanPicker(signupType);
    });
    document.getElementById('planPickerYearly').addEventListener('click', () => {
      planBilling = 'yearly';
      document.getElementById('planPickerYearly').className = 'btn btn--primary btn--sm';
      document.getElementById('planPickerMonthly').className = 'btn btn--ghost btn--sm';
      showPlanPicker(signupType);
    });

    if (signupType) {
      // Arriving from the Pricing page (signup_type set via URL) now goes
      // through the exact same plan-picker screen as clicking "Add
      // Business" directly — previously this jumped straight to Category,
      // which is why the two entry points looked like different flows.
      document.querySelectorAll('.signup-type-pick').forEach(b => { if (b.dataset.type === signupType) b.style.border = '2px solid var(--clr-primary)'; });
      showPlanPicker(signupType);
    } else {
      document.querySelectorAll('.signup-type-pick').forEach(btn => {
        btn.addEventListener('click', () => {
          signupType = btn.dataset.type;
          document.querySelectorAll('.signup-type-pick').forEach(b => b.style.border = '1px solid var(--clr-border)');
          btn.style.border = '2px solid var(--clr-primary)';
          showPlanPicker(signupType);
        });
      });
    }


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
          if (pendingPaidPlan) {
            document.getElementById('qcCategoryId').value = id;
            document.getElementById('qcCategoryName').value = name;
            document.getElementById('qcTemplateKey').value = template;
            document.getElementById('qcThemeColor').value = palette[template] || palette.default;
            const planLabel = pendingPaidPlan.subscription_type === 'bundle' ? 'bundle' : pendingPaidPlan.subscription_type === 'directory' ? 'Directory' : 'Website';
            document.getElementById('qcPlanNote').textContent = `You picked the ${pendingPaidPlan.plan_key} ${planLabel} plan — just the name and category are needed before payment.`;
            document.getElementById('qcSlugRow').style.display = pendingPaidPlan.subscription_type === 'directory' ? 'none' : 'block';
            document.getElementById('quickCheckoutForm').style.display = 'block';
            document.getElementById('qcName').focus();
          } else {
            document.getElementById('newBizForm').style.display = 'block';
            configureWizard();
            showStep(1);
            document.getElementById('bizName').focus();
          }
        });
      });
    } catch { document.getElementById('categoryPicker').innerHTML = '<p style="color:var(--clr-danger)">Failed to load categories.</p>'; }

    document.getElementById('qcBackBtn').addEventListener('click', () => {
      document.getElementById('quickCheckoutForm').style.display = 'none';
      document.getElementById('categoryPicker').style.display = 'grid';
    });

    document.getElementById('quickCheckoutForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('qcName').value.trim();
      if (!name) return toast.warning('Business name is required');
      const btn = document.getElementById('qcPayBtn');
      setLoading(btn, true, 'Setting up…');
      try {
        const { business } = await API.post('/businesses', {
          name,
          tagline: document.getElementById('qcTagline').value.trim() || null,
          category_id: document.getElementById('qcCategoryId').value || null,
          template_key: document.getElementById('qcTemplateKey').value,
          theme_color: document.getElementById('qcThemeColor').value,
          has_own_website: false, website: '',
          signup_type: signupType || 'both',
          custom_slug: document.getElementById('qcSlug').value.trim() || undefined,
        });
        sessionStorage.setItem('spotgh_finish_business', JSON.stringify({ id: business.id, name: business.name }));
        const res = await API.post('/payments/v2/initialize', {
          subscription_type: pendingPaidPlan.subscription_type, plan_key: pendingPaidPlan.plan_key,
          billing_cycle: pendingPaidPlan.billing || 'monthly', business_id: business.id,
        });
        if (res.fully_covered) {
          toast.success(res.is_trial ? '🎉 Your free month has started!' : '🎉 Plan activated!');
          window.location.href = `/pages/dashboard.html?payment=success`;
        } else if (res.authorization_url) {
          window.location.href = res.authorization_url;
        }
      } catch (err) {
        setLoading(btn, false);
        toast.error(err.message || 'Something went wrong setting up payment. Please try again.');
      }
    });

    // Which signup types get a Branding step (accent color + logo) and a
    // live preview: only ones that actually get a SpotGH-built website.
    // Directory-only keeps the plain 4-step flow — nothing to brand there.
    // NOTE: this can't be computed until signupType is truly final (the
    // user may still be about to pick a type card), so the real values
    // are set inside configureWizard(), called from the category-pick
    // handler below — the last point before the wizard is actually used.
    const ACCENT_SWATCHES = ['#4E0DAD', '#E8590C', '#C2255C', '#0B7285', '#9C36B5', '#2F9E44', '#1971C2', '#E03131'];
    let logoFile = null, isWebsiteFlow = false, steps = [1, 2, 3, 5], STEP_LABELS = ['Info', 'Location', 'Description', 'Review'], lastStep = 5;
    let currentStep = 1;

    function nextStepAfter(n) { return steps[steps.indexOf(n) + 1]; }
    function prevStepBefore(n) { return steps[steps.indexOf(n) - 1]; }

    function renderProgress(n) {
      const pos = steps.indexOf(n) + 1; // 1-based position among STEP_LABELS
      document.getElementById('wizardProgress').innerHTML = STEP_LABELS.map((l, i) => {
        const step = i + 1;
        const state = step === pos ? 'background:var(--clr-primary);color:#fff'
          : step < pos ? 'background:var(--clr-primary-10);color:var(--clr-primary)'
          : 'background:var(--clr-surface-2);color:var(--clr-text-3)';
        return `<div style="flex:1;text-align:center;font-size:.68rem;font-weight:600;padding:.4rem .2rem;border-radius:6px;${state}">${step}. ${l}</div>`;
      }).join('');
    }

    function validateStep(n) {
      if (n === 1 && !document.getElementById('bizName').value.trim()) {
        toast.warning('Business name is required'); return false;
      }
      return true;
    }

    function updatePreview() {
      if (!isWebsiteFlow) return;
      document.getElementById('previewHeader').style.background = document.getElementById('bizThemeColor').value;
      document.getElementById('previewName').textContent = document.getElementById('bizName').value.trim() || 'Your Business Name';
      document.getElementById('previewTagline').textContent = document.getElementById('bizTagline').value.trim() || 'Your tagline goes here';
      const loc = [document.getElementById('bizCity').value.trim(), document.getElementById('bizRegion').value.trim()].filter(Boolean).join(', ');
      document.getElementById('previewLocation').innerHTML = loc ? `<i class="fa-solid fa-location-dot"></i> ${loc}` : '';
      document.getElementById('previewDescription').textContent = document.getElementById('bizDescription').value.trim().slice(0, 140);
    }

    // Wired once — harmless no-op via updatePreview()'s own isWebsiteFlow
    // check for Directory-only, so no need to gate this on signup type.
    ['bizName', 'bizTagline', 'bizCity', 'bizRegion', 'bizDescription'].forEach(id => {
      document.getElementById(id).addEventListener('input', updatePreview);
    });

    // Sets isWebsiteFlow/steps/STEP_LABELS/lastStep for real now that
    // signupType is settled, and wires the Branding step's controls.
    // Called once, from the category-pick handler below.
    // Shared by both the full wizard's Branding step and the quick-
    // checkout form — debounced availability check against /check-slug.
    function wireSlugField(inputId, statusId) {
      const input = document.getElementById(inputId);
      const status = document.getElementById(statusId);
      let debounceTimer;
      input.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        const val = input.value.trim();
        if (!val) { status.textContent = ''; return; }
        status.textContent = 'Checking…';
        status.style.color = 'var(--clr-text-3)';
        debounceTimer = setTimeout(async () => {
          try {
            const res = await API.get(`/businesses/check-slug?slug=${encodeURIComponent(val)}`);
            if (res.available) {
              status.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${res.slug}.spotgh.com is available`;
              status.style.color = 'var(--clr-success)';
            } else {
              const reasonText = { too_short: 'Too short (min 3 characters)', too_long: 'Too long', invalid_chars: 'Use only letters, numbers, and hyphens',
                reserved: 'That name is reserved', taken: 'Already taken' }[res.reason] || 'Not available';
              status.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> ${reasonText}${res.suggestion ? ` — try <a href="#" class="slug-suggest" data-value="${res.suggestion}">${res.suggestion}</a>` : ''}`;
              status.style.color = 'var(--clr-danger)';
              status.querySelector('.slug-suggest')?.addEventListener('click', (e) => {
                e.preventDefault(); input.value = res.suggestion; input.dispatchEvent(new Event('input'));
              });
            }
          } catch { status.textContent = ''; }
        }, 400);
      });
    }
    wireSlugField('bizSlug', 'slugStatus');
    wireSlugField('qcSlug', 'qcSlugStatus');
    document.getElementById('qcName').addEventListener('input', () => {
      if (!document.getElementById('qcSlug').dataset.touched) {
        document.getElementById('qcSlug').value = document.getElementById('qcName').value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      }
    });
    document.getElementById('qcSlug').addEventListener('input', () => { document.getElementById('qcSlug').dataset.touched = '1'; });
    document.getElementById('bizName').addEventListener('input', () => {
      if (!document.getElementById('bizSlug').dataset.touched) {
        document.getElementById('bizSlug').value = document.getElementById('bizName').value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      }
    });
    document.getElementById('bizSlug').addEventListener('input', () => { document.getElementById('bizSlug').dataset.touched = '1'; });

    function configureWizard() {
      isWebsiteFlow = signupType !== 'directory';
      steps = isWebsiteFlow ? [1, 2, 3, 4, 5] : [1, 2, 3, 5];
      STEP_LABELS = isWebsiteFlow ? ['Info', 'Location', 'Description', 'Branding', 'Review'] : ['Info', 'Location', 'Description', 'Review'];
      lastStep = steps[steps.length - 1];
      if (!isWebsiteFlow) return;
      document.getElementById('bizPreviewPanel').style.display = 'block';
      document.getElementById('colorSwatches').innerHTML = ACCENT_SWATCHES.map(c => `
        <button type="button" class="color-swatch" data-color="${c}" style="width:32px;height:32px;border-radius:8px;background:${c};border:2px solid transparent;cursor:pointer"></button>`).join('');
      document.querySelectorAll('.color-swatch').forEach(sw => {
        if (sw.dataset.color.toLowerCase() === document.getElementById('bizThemeColor').value.toLowerCase()) sw.style.border = '2px solid var(--clr-text-1)';
        sw.addEventListener('click', () => {
          document.getElementById('bizThemeColor').value = sw.dataset.color;
          document.querySelectorAll('.color-swatch').forEach(s => s.style.border = '2px solid transparent');
          sw.style.border = '2px solid var(--clr-text-1)';
          updatePreview();
        });
      });
      document.getElementById('bizLogoFile').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        logoFile = file;
        const reader = new FileReader();
        reader.onload = () => { document.getElementById('previewLogo').innerHTML = `<img src="${reader.result}" style="width:100%;height:100%;object-fit:cover">`; };
        reader.readAsDataURL(file);
      });
      updatePreview();
    }

    function renderReview() {
      const websiteLine = signupType === 'directory' ? 'Directory listing only' : 'SpotGH website (included)';
      document.getElementById('wizReview').innerHTML = `
        <div><strong>Category:</strong> ${document.getElementById('bizCategoryName').value || '—'}</div>
        <div><strong>Name:</strong> ${document.getElementById('bizName').value.trim() || '—'}</div>
        <div><strong>Tagline:</strong> ${document.getElementById('bizTagline').value.trim() || '—'}</div>
        <div><strong>Location:</strong> ${[document.getElementById('bizCity').value.trim(), document.getElementById('bizRegion').value.trim()].filter(Boolean).join(', ') || '—'}</div>
        <div><strong>Contact:</strong> ${[document.getElementById('bizWhatsapp').value.trim(), document.getElementById('bizPhone').value.trim()].filter(Boolean).join(' / ') || '—'}</div>
        <div><strong>Website:</strong> ${websiteLine}</div>
        ${isWebsiteFlow ? `<div><strong>Website address:</strong> ${document.getElementById('bizSlug').value.trim() ? document.getElementById('bizSlug').value.trim() + '.spotgh.com' : 'Auto-generated from name'}</div><div><strong>Accent color:</strong> <span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${document.getElementById('bizThemeColor').value};vertical-align:middle;margin-right:.3rem"></span>${document.getElementById('bizThemeColor').value}</div><div><strong>Logo:</strong> ${logoFile ? logoFile.name : 'None yet — add it any time'}</div>` : ''}
        ${creatorForceDirectoryTier || creatorForceWebsiteTier ? `<div><strong>🎁 Creator grant:</strong> ${[creatorForceDirectoryTier ? `Directory: ${creatorForceDirectoryTier}` : '', creatorForceWebsiteTier ? `Website: ${creatorForceWebsiteTier}` : ''].filter(Boolean).join(', ')} (free)</div>` : ''}`;
      document.getElementById('wizReviewNote').textContent = isWebsiteFlow
        ? "You'll be able to add photos and business hours right after this — those aren't required to submit."
        : "You'll be able to add a logo and photos right after this — those aren't required to submit.";
    }

    window.showStep = (n) => {
      document.querySelectorAll('.wiz-step').forEach(el => el.style.display = (+el.dataset.step === n) ? 'block' : 'none');
      document.getElementById('wizBackBtn').textContent = n === 1 ? 'Change Category' : 'Back';
      document.getElementById('wizNextBtn').style.display = n === lastStep ? 'none' : 'inline-flex';
      document.getElementById('submitBizBtn').style.display = n === lastStep ? 'inline-flex' : 'none';
      renderProgress(n);
      if (n === lastStep) renderReview();
      currentStep = n;
    };

    document.getElementById('wizNextBtn').addEventListener('click', () => {
      if (validateStep(currentStep)) showStep(nextStepAfter(currentStep));
    });
    document.getElementById('wizBackBtn').addEventListener('click', () => {
      if (currentStep === 1) {
        document.getElementById('newBizForm').style.display = 'none';
        document.getElementById('bizPreviewPanel').style.display = 'none';
        document.getElementById('categoryPicker').style.display = 'grid';
      } else showStep(prevStepBefore(currentStep));
    });

    document.getElementById('newBizForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('submitBizBtn');
      const name = document.getElementById('bizName').value.trim();
      if (!name) return toast.warning('Business name is required');
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
          has_own_website: false,
          website: '',
          signup_type: signupType || 'both',
          ...(isWebsiteFlow && document.getElementById('bizSlug').value.trim() ? { custom_slug: document.getElementById('bizSlug').value.trim() } : {}),
          ...(creatorForceDirectoryTier ? { force_directory_tier: creatorForceDirectoryTier } : {}),
          ...(creatorForceWebsiteTier ? { force_website_tier: creatorForceWebsiteTier } : {}),
        });
        sessionStorage.removeItem('spotgh_own_website_choice');

        if (logoFile) {
          try {
            const fd = new FormData(); fd.append('logo', logoFile);
            await API.upload(`/upload/${business.id}/logo`, fd);
          } catch { toast.warning("Business created, but the logo didn't upload — you can add it from Add Logo & Photos."); }
        }

        // If they arrived here from the pricing page choosing a specific
        // paid plan, finish that checkout now that a business exists to
        // attach it to. Skip it if the business creation itself already
        // covered it for free (Directory Free always does; Starter Website
        // does too, unless their once-per-account trial was already used
        // — in which case this really does need payment now).
        const pendingRaw = sessionStorage.getItem('spotgh_pending_plan');
        if (pendingRaw) {
          sessionStorage.removeItem('spotgh_pending_plan');
          const pending = JSON.parse(pendingRaw);
          let needsCheckout = true;
          if (pending.subscription_type === 'directory' && pending.plan_key === 'free') {
            needsCheckout = false; // every business gets this automatically
          } else if (pending.subscription_type === 'website' && pending.plan_key === 'starter') {
            try {
              const status = await API.get(`/subscriptions/status-v2?business_id=${business.id}`);
              if (status.website) needsCheckout = false; // trial was granted just now
            } catch { /* if we can't tell, fall through and try checkout */ }
          }
          if (needsCheckout) {
            try {
              const res = await API.post('/payments/v2/initialize', {
                subscription_type: pending.subscription_type, plan_key: pending.plan_key,
                billing_cycle: pending.billing || 'monthly', business_id: business.id,
              });
              if (res.fully_covered) {
                toast.success(res.is_trial ? '🎉 Your free month has started!' : '🎉 Plan activated!');
              } else if (res.authorization_url) {
                window.location.href = res.authorization_url;
                return;
              }
            } catch { toast.warning(`${business.name} was created, but activating the plan failed — you can subscribe from your dashboard.`); }
          }
        }

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

      const statGrid = document.getElementById('statGrid');
      if (statGrid) {
        statGrid.innerHTML = [
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
      }

      const list = document.getElementById('myBusinessesList');

      // Persistent reminder for anything still missing basic details (most
      // often: paid, then the owner left before finishing location/
      // description/branding). Driven by the actual business record, so
      // unlike the one-time post-payment redirect, this survives closing
      // the browser and coming back days later.
      const incomplete = businesses.filter(b => !b.city || !b.description);
      const reminderBox = document.getElementById('incompleteBizReminder');
      if (incomplete.length) {
        reminderBox.style.display = 'block';
        reminderBox.innerHTML = `
          <div class="card" style="padding:1rem 1.25rem;border:1px solid var(--clr-gold);background:rgba(244,162,41,.08);margin-bottom:1.25rem">
            <div style="font-weight:700;margin-bottom:.5rem">⚠️ ${incomplete.length === 1 ? 'One business needs' : incomplete.length + ' businesses need'} a bit more info</div>
            ${incomplete.map(b => `
              <div style="display:flex;align-items:center;justify-content:space-between;gap:.75rem;padding:.4rem 0;flex-wrap:wrap">
                <span style="font-size:.875rem">${b.name} — missing ${!b.city ? 'location' : ''}${!b.city && !b.description ? ' & ' : ''}${!b.description ? 'description' : ''}</span>
                <a href="/pages/business-edit.html?id=${b.id}" class="btn btn--primary btn--sm">Finish Setup</a>
              </div>`).join('')}
          </div>`;
      } else if (reminderBox) {
        reminderBox.style.display = 'none';
      }

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

      list.innerHTML = businesses.map(b => {
        const hasWebsite = !!b.website_tier;
        const websiteIcons = hasWebsite ? `
            <a href="/pages/gallery.html?id=${b.id}" class="btn btn--ghost btn--sm" title="Gallery"><i class="fa-solid fa-images"></i></a>
            <a href="/pages/products.html?id=${b.id}" class="btn btn--ghost btn--sm" title="Products"><i class="fa-solid fa-box"></i></a>
            <a href="/pages/bookings.html?id=${b.id}" class="btn btn--ghost btn--sm" title="Bookings"><i class="fa-solid fa-calendar"></i></a>
            <a href="/pages/business-orders.html?id=${b.id}" class="btn btn--ghost btn--sm" title="Orders"><i class="fa-solid fa-bag-shopping"></i></a>`
          : `<a href="/pages/pricing.html?tab=website&business_id=${b.id}" class="btn btn--outline btn--sm" title="Add a Mini-Website to unlock Gallery, Products, Bookings & Orders"><i class="fa-solid fa-globe"></i> Add Website</a>`;
        return `
        <div class="card" style="padding:1.25rem;display:flex;align-items:center;gap:1.25rem;margin-bottom:.75rem;flex-wrap:wrap">
          ${b.logo_url
            ? `<img src="${b.logo_url}" style="width:64px;height:64px;object-fit:cover;border-radius:10px;flex-shrink:0">`
            : `<div style="width:64px;height:64px;border-radius:10px;background:var(--clr-surface-2);display:flex;align-items:center;justify-content:center;font-size:1.75rem;flex-shrink:0">${b.category_icon||'🏢'}</div>`}
          <div style="flex:1;min-width:180px">
            <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.25rem">
              <strong style="font-size:1rem">${b.name}</strong>
              <span class="badge ${b.status==='active'?'badge--success':b.status==='pending'?'badge--warning':'badge--danger'}">${b.status}</span>
              ${b.is_featured ? '<span class="badge badge--primary">⭐ Featured</span>' : ''}
              ${hasWebsite ? '<span class="badge badge--primary" title="Has an active Website subscription"><i class="fa-solid fa-globe"></i></span>' : ''}
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
            ${websiteIcons}
            <a href="/pages/messages.html?id=${b.id}" class="btn btn--ghost btn--sm" title="Messages"><i class="fa-solid fa-comment"></i></a>
            <a href="/pages/deals-manager.html?id=${b.id}" class="btn btn--ghost btn--sm" title="Deals & Coupons"><i class="fa-solid fa-tags"></i></a>
            <a href="/pages/events-manager.html?id=${b.id}" class="btn btn--ghost btn--sm" title="Events"><i class="fa-solid fa-champagne-glasses"></i></a>
            <a href="/pages/leads.html" class="btn btn--ghost btn--sm" title="Lead Marketplace"><i class="fa-solid fa-bullhorn"></i></a>
            <a href="/pages/health.html?id=${b.id}" class="btn btn--ghost btn--sm" title="Health Score"><i class="fa-solid fa-heart-pulse"></i></a>
            <a href="/pages/pricing.html?business_id=${b.id}" class="btn btn--ghost btn--sm" title="Manage Plan"><i class="fa-solid fa-credit-card"></i></a>
          </div>
        </div>`;
      }).join('');

      // Start tour for new users
      if (!localStorage.getItem('sgh_tour_done')) {
        setTimeout(() => startTour([
          { target:'.dashboard__title',  title:'Welcome to your Dashboard!', text:'This is your control centre. Track views, manage businesses, and grow your presence across Ghana.' },
          { target:'#statGrid',          title:'Your Stats',                  text:'See your total views, WhatsApp clicks, and ratings at a glance.' },
          { target:'#myBusinessesList',  title:'Your Businesses',             text:'All your listings appear here. Edit, view analytics, or manage gallery and products.' },
          { target:'a[href="/pages/pricing.html"]', title:'Choose a Plan',    text:'You need an active subscription to go live. Subscribe to start reaching customers!' },
        ]), 1500);
      }
    } catch(err) { console.error('loadDashboard failed:', err); toast.error('Failed to load dashboard'); }
  }
});