// assets/js/creator.js
document.addEventListener('DOMContentLoaded', () => {
  loadComponents();
  if (!Auth.requireAuth()) return;
  const user = Auth.getUser();
  if (user?.role !== 'creator') {
    document.getElementById('pageMain').innerHTML = `<div style="text-align:center;padding:5rem 1rem">
      <div style="font-size:3rem;margin-bottom:1rem">🚫</div>
      <h2>Access Denied</h2><p style="color:var(--clr-text-2)">Creator access required.</p>
      <a href="/" class="btn btn--primary" style="margin-top:1rem">Go Home</a></div>`;
    return;
  }

  let currentTab = 'dashboard';

  document.getElementById('pageMain').innerHTML = `
    <div class="dashboard">
      <aside class="sidebar">
        <div class="sidebar__label">Creator Panel</div>
        <a class="sidebar__item active" data-tab="dashboard"><i class="fa-solid fa-gauge"></i> Dashboard</a>
        <a class="sidebar__item" data-tab="build"><i class="fa-solid fa-wand-magic-sparkles"></i> Build Website</a>
        <a class="sidebar__item" data-tab="businesses"><i class="fa-solid fa-store"></i> Businesses</a>
        <a class="sidebar__item" data-tab="users"><i class="fa-solid fa-users"></i> Users</a>
        <a class="sidebar__item" data-tab="payments"><i class="fa-solid fa-credit-card"></i> Payments</a>
        <a class="sidebar__item" data-tab="plans"><i class="fa-solid fa-layer-group"></i> Plans (Legacy)</a>
        <a class="sidebar__item" data-tab="pricingV2"><i class="fa-solid fa-cubes-stacked"></i> Directory &amp; Website Plans</a>
        <a class="sidebar__item" data-tab="promos"><i class="fa-solid fa-tag"></i> Promo Codes</a>
        <a class="sidebar__item" data-tab="moderation"><i class="fa-solid fa-shield-halved"></i> Moderation</a>
        <a class="sidebar__item" data-tab="analytics"><i class="fa-solid fa-chart-bar"></i> Platform Analytics</a>
        <a class="sidebar__item" data-tab="settings"><i class="fa-solid fa-gear"></i> Settings</a>
        <a class="sidebar__item" data-tab="audit"><i class="fa-solid fa-scroll"></i> Audit Log</a>
        <a class="sidebar__item" id="creatorInstallAppBtn"><i class="fa-solid fa-download"></i> Download App</a>
      </aside>
      <div class="dashboard__content">
        <div id="creatorContent"><div class="skeleton" style="height:200px;border-radius:16px"></div></div>
      </div>
    </div>`;

  document.querySelectorAll('.sidebar__item[data-tab]').forEach(el => {
    el.addEventListener('click', () => {
      document.querySelectorAll('.sidebar__item').forEach(i => i.classList.remove('active'));
      el.classList.add('active');
      currentTab = el.dataset.tab;
      loadTab(currentTab);
    });
  });

  document.getElementById('creatorInstallAppBtn').addEventListener('click', (e) => {
    e.preventDefault();
    window.triggerPWAInstall();
  });

  loadTab('dashboard');

  async function loadTab(tab) {
    const el = document.getElementById('creatorContent');
    el.innerHTML = `<div class="skeleton" style="height:200px;border-radius:16px;margin-bottom:1rem"></div><div class="skeleton" style="height:300px;border-radius:16px"></div>`;
    const loaders = { dashboard, build, businesses, users, payments, plans, pricingV2, promos, moderation, analytics, settings, audit };
    await (loaders[tab] || (() => {}))();
  }

  // ─── DASHBOARD ────────────────────────────────────────────────────────────
  async function dashboard() {
    try {
      const d = await API.get('/creator/dashboard');
      const s = d.stats;
      document.getElementById('creatorContent').innerHTML = `
        <div class="dashboard__header">
          <h1 class="dashboard__title">Creator Dashboard</h1>
          <p style="color:var(--clr-text-2)">Platform overview</p>
        </div>
        <div class="stat-grid" style="margin-bottom:2rem">
          ${[
            { label:'Total Users',        value:s.total_users,          icon:'👥', color:'var(--clr-primary)' },
            { label:'Active Businesses',  value:s.active_businesses,    icon:'🏪', color:'var(--clr-success)' },
            { label:'Pending Review',     value:s.pending_businesses,   icon:'⏳', color:'var(--clr-warning)' },
            { label:'Total Revenue',      value:'GHS '+Number(s.total_revenue||0).toLocaleString(), icon:'💰', color:'#2f9e44' },
            { label:'MRR',                value:'GHS '+Number(s.mrr||0).toLocaleString(),           icon:'📈', color:'#1971c2' },
            { label:'Active Subs',        value:s.active_subscriptions, icon:'✅', color:'#0b7285' },
          ].map(k=>`<div class="stat-card"><div class="stat-card__icon" style="font-size:1.5rem">${k.icon}</div><div class="stat-card__label">${k.label}</div><div class="stat-card__value" style="color:${k.color}">${k.value}</div></div>`).join('')}
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-bottom:2rem" class="creator-2col">
          <div class="card" style="padding:1.25rem">
            <h3 style="font-weight:700;margin-bottom:1rem">Tier Breakdown</h3>
            ${Object.entries(s.tier_breakdown||{}).map(([tier,count])=>`
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.6rem">
                <span style="font-size:.875rem;text-transform:capitalize;font-weight:600">${tier}</span>
                <div style="display:flex;align-items:center;gap:.5rem;flex:1;margin-left:1rem">
                  <div style="flex:1;background:var(--clr-surface-2);border-radius:100px;height:8px">
                    <div style="width:${Math.min(100,count/(s.active_subscriptions||1)*100)}%;background:var(--clr-primary);border-radius:100px;height:8px"></div>
                  </div>
                  <span style="font-size:.8rem;font-weight:700;min-width:24px;text-align:right">${count}</span>
                </div>
              </div>`).join('')}
          </div>
          <div class="card" style="padding:1.25rem">
            <h3 style="font-weight:700;margin-bottom:1rem">Revenue History</h3>
            ${(d.revenue_history||[]).slice(0,6).map(r=>`
              <div style="display:flex;justify-content:space-between;font-size:.82rem;padding:.3rem 0;border-bottom:1px solid var(--clr-border)">
                <span style="color:var(--clr-text-2)">${new Date(r.month).toLocaleDateString('en-GH',{month:'short',year:'numeric'})}</span>
                <span style="font-weight:700">GHS ${Number(r.total_revenue||0).toLocaleString()}</span>
                <span style="color:var(--clr-text-3)">${r.total_payments} payments</span>
              </div>`).join('')}
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem" class="creator-2col">
          <div class="card" style="padding:1.25rem">
            <h3 style="font-weight:700;margin-bottom:1rem">Recent Payments</h3>
            ${(d.recent_payments||[]).slice(0,6).map(p=>`
              <div style="display:flex;justify-content:space-between;align-items:center;padding:.5rem 0;border-bottom:1px solid var(--clr-border)">
                <div>
                  <div style="font-size:.85rem;font-weight:600">${p.users?.full_name||'Unknown'}</div>
                  <div style="font-size:.75rem;color:var(--clr-text-3)">${p.plans?.tier||'—'} · ${formatDate(p.paid_at)}</div>
                </div>
                <span style="font-weight:700;color:var(--clr-success)">GHS ${Number(p.amount).toLocaleString()}</span>
              </div>`).join('')}
          </div>
          <div class="card" style="padding:1.25rem">
            <h3 style="font-weight:700;margin-bottom:1rem">Recent Sign-ups</h3>
            ${(d.recent_signups||[]).map(u=>`
              <div style="display:flex;align-items:center;gap:.75rem;padding:.4rem 0;border-bottom:1px solid var(--clr-border)">
                <div style="width:32px;height:32px;border-radius:50%;background:var(--clr-primary-10);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.85rem;color:var(--clr-primary);flex-shrink:0">${(u.full_name||u.email||'?')[0].toUpperCase()}</div>
                <div style="flex:1;min-width:0">
                  <div style="font-size:.85rem;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${u.full_name||'—'}</div>
                  <div style="font-size:.72rem;color:var(--clr-text-3)">${u.role} · ${timeAgo(u.created_at)}</div>
                </div>
              </div>`).join('')}
          </div>
        </div>
        <style>.creator-2col{grid-template-columns:1fr}@media(min-width:700px){.creator-2col{grid-template-columns:1fr 1fr}}</style>`;
    } catch (err) { document.getElementById('creatorContent').innerHTML = '<p style="color:var(--clr-danger)">Failed to load dashboard.</p>'; }
  }

  // ─── BUILD WEBSITE (no payment) ───────────────────────────────────────────
  async function build() {
    let categories = [];
    try { const r = await API.get('/categories'); categories = r.categories || []; } catch {}
    const palette = { default:'#4E0DAD', restaurant:'#E8590C', salon:'#C2255C', hotel:'#0B7285', fashion:'#9C36B5', events:'#2F9E44', fitness:'#1971C2', healthcare:'#2b8a3e', shop:'#e67700', retail:'#e67700', trades:'#495057' };

    document.getElementById('creatorContent').innerHTML = `
      <div class="dashboard__header">
        <h1 class="dashboard__title"><i class="fa-solid fa-wand-magic-sparkles" style="color:var(--clr-primary)"></i> Build Mini-Website</h1>
        <p style="color:var(--clr-text-2)">Create a live business listing for a client — no payment required. An account is created for them automatically.</p>
      </div>

      <div class="card" style="padding:1.5rem;max-width:680px">
        <div style="display:grid;gap:1rem;margin-bottom:1.25rem">

          <div style="background:var(--clr-primary-10);border:1px solid var(--clr-primary);border-radius:var(--radius-md);padding:.85rem 1rem;font-size:.85rem">
            <strong><i class="fa-solid fa-circle-info" style="color:var(--clr-primary)"></i> How this works:</strong>
            Fill in the business owner's details below. If their email isn't registered yet, an account is created automatically. The listing goes live immediately with the chosen plan — no payment step.
          </div>

          <h3 style="font-weight:700;margin:0">Owner Account</h3>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">
            <div><label class="form-label">Owner Email *</label><input id="bwEmail" class="form-input" type="email" placeholder="owner@example.com"></div>
            <div><label class="form-label">Owner Full Name</label><input id="bwName" class="form-input" placeholder="Kwame Mensah"></div>
          </div>

          <h3 style="font-weight:700;margin:.25rem 0 0">Business Details</h3>
          <div><label class="form-label">Business Name *</label><input id="bwBizName" class="form-input" placeholder="e.g. Buka Restaurant"></div>
          <div><label class="form-label">Tagline</label><input id="bwTagline" class="form-input" placeholder="One line that sells the business"></div>
          <div><label class="form-label">Category *</label>
            <select id="bwCategory" class="form-input">
              <option value="">Select category…</option>
              ${categories.map(c=>`<option value="${c.id}" data-template="${c.template_key||'default'}">${c.name}</option>`).join('')}
            </select>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">
            <div><label class="form-label">City</label><input id="bwCity" class="form-input" placeholder="Accra"></div>
            <div><label class="form-label">Region</label><input id="bwRegion" class="form-input" placeholder="Greater Accra"></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">
            <div><label class="form-label">WhatsApp</label><input id="bwWA" class="form-input" placeholder="0244000000"></div>
            <div><label class="form-label">Phone</label><input id="bwPhone" class="form-input" placeholder="0244000000"></div>
          </div>
          <div><label class="form-label">Description</label><textarea id="bwDesc" class="form-input" rows="3" placeholder="What does this business do? What makes it stand out?"></textarea></div>

          <h3 style="font-weight:700;margin:.25rem 0 0">Plan Grant</h3>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.75rem">
            <div><label class="form-label">Tier</label>
              <select id="bwTier" class="form-input">
                <option value="starter">Starter</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
                <option value="free">Free</option>
              </select>
            </div>
            <div><label class="form-label">Duration (months)</label><input id="bwMonths" type="number" class="form-input" value="1" min="1" max="24"></div>
            <div><label class="form-label">Internal Notes</label><input id="bwNotes" class="form-input" placeholder="e.g. Market promo"></div>
          </div>
        </div>

        <div style="display:flex;gap:.75rem;flex-wrap:wrap">
          <button class="btn btn--primary" id="bwSubmit" onclick="submitBuildWebsite()">
            <i class="fa-solid fa-rocket"></i> Build & Go Live
          </button>
          <button class="btn btn--ghost" onclick="clearBuildForm()">Clear Form</button>
        </div>

        <div id="bwResult" style="margin-top:1.5rem"></div>
      </div>`;

    window.submitBuildWebsite = async () => {
      const btn = document.getElementById('bwSubmit');
      const email   = document.getElementById('bwEmail').value.trim();
      const bizName = document.getElementById('bwBizName').value.trim();
      const catSel  = document.getElementById('bwCategory');
      const catId   = catSel.value;
      if (!email || !bizName || !catId) { toast.warning('Owner email, business name, and category are required'); return; }
      const tpl = catSel.selectedOptions[0]?.dataset.template || 'default';
      setLoading(btn, true, 'Building…');
      try {
        const result = await API.post('/creator/build-website', {
          owner_email:   email,
          owner_name:    document.getElementById('bwName').value.trim(),
          business_name: bizName,
          tagline:       document.getElementById('bwTagline').value.trim(),
          description:   document.getElementById('bwDesc').value.trim(),
          city:          document.getElementById('bwCity').value.trim(),
          region:        document.getElementById('bwRegion').value.trim(),
          whatsapp:      document.getElementById('bwWA').value.trim(),
          phone:         document.getElementById('bwPhone').value.trim(),
          category_id:   catId,
          template_key:  tpl,
          theme_color:   palette[tpl] || palette.default,
          tier:          document.getElementById('bwTier').value,
          months:        parseInt(document.getElementById('bwMonths').value),
          notes:         document.getElementById('bwNotes').value.trim(),
        });
        const biz = result.business;
        document.getElementById('bwResult').innerHTML = `
          <div style="background:rgba(34,197,94,.1);border:1px solid var(--clr-success);border-radius:var(--radius-md);padding:1.25rem">
            <div style="font-weight:700;color:var(--clr-success);font-size:1rem;margin-bottom:.5rem">✅ ${result.message}</div>
            <div style="font-size:.875rem;margin-bottom:.75rem">
              <strong>Business:</strong> ${biz.name}<br>
              <strong>Owner:</strong> ${result.owner.email}<br>
              <strong>Live URL:</strong> <a href="/business?slug=${biz.slug}" target="_blank" style="color:var(--clr-primary)">/business?slug=${biz.slug}</a>
            </div>
            <div style="display:flex;gap:.5rem;flex-wrap:wrap">
              <a href="/business?slug=${biz.slug}" target="_blank" class="btn btn--success btn--sm"><i class="fa-solid fa-eye"></i> View Live Page</a>
              <a href="/business-edit?id=${biz.id}" target="_blank" class="btn btn--outline btn--sm"><i class="fa-solid fa-pen"></i> Open Editor</a>
              <button class="btn btn--ghost btn--sm" onclick="document.getElementById('bwResult').innerHTML='';clearBuildForm()">Build Another</button>
            </div>
          </div>`;
        toast.success(`${biz.name} is now live!`);
      } catch (err) {
        toast.error(err.message || 'Build failed');
      } finally { setLoading(btn, false); }
    };

    window.clearBuildForm = () => {
      ['bwEmail','bwName','bwBizName','bwTagline','bwCity','bwRegion','bwWA','bwPhone','bwDesc','bwNotes'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
      document.getElementById('bwCategory').value = '';
    };
  }

  // ─── BUSINESSES ───────────────────────────────────────────────────────────
  async function businesses() {
    const el = document.getElementById('creatorContent');
    el.innerHTML = `
      <div class="dashboard__header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem">
        <h1 class="dashboard__title">Businesses</h1>
        <div style="display:flex;gap:.5rem">
          <a href="/creator/export/businesses" class="btn btn--ghost btn--sm"><i class="fa-solid fa-download"></i> Export CSV</a>
        </div>
      </div>
      <div class="card" style="padding:1rem;margin-bottom:1rem;display:flex;gap:.75rem;flex-wrap:wrap">
        <input id="bizSearch" type="text" placeholder="Search by name or email…" class="input" style="flex:1;min-width:180px">
        <select id="bizStatus" class="input" style="width:160px">
          <option value="">All Status</option>
          <option value="active">Active</option><option value="pending">Pending</option>
          <option value="suspended">Suspended</option><option value="rejected">Rejected</option>
        </select>
        <select id="bizTier" class="input" style="width:140px">
          <option value="">All Tiers</option>
          <option value="free">Free</option><option value="starter">Starter</option>
          <option value="pro">Pro</option><option value="enterprise">Enterprise</option>
        </select>
        <button class="btn btn--primary btn--sm" onclick="loadBizTable()"><i class="fa-solid fa-search"></i> Search</button>
      </div>
      <div class="card" style="padding:0;overflow:hidden"><div id="bizTable" style="overflow-x:auto"><div class="skeleton" style="height:300px"></div></div></div>`;

    window.loadBizTable = async (page=1) => {
      const qs = new URLSearchParams({ page, limit:20 });
      const s = document.getElementById('bizSearch')?.value.trim();
      const st = document.getElementById('bizStatus')?.value;
      const ti = document.getElementById('bizTier')?.value;
      if(s) qs.set('search',s); if(st) qs.set('status',st); if(ti) qs.set('tier',ti);
      try {
        const { businesses, pagination } = await API.get(`/creator/businesses?${qs}`);
        document.getElementById('bizTable').innerHTML = `
          <table style="width:100%;border-collapse:collapse;font-size:.85rem">
            <thead><tr style="background:var(--clr-surface-2);text-align:left">
              <th style="padding:.75rem 1rem">Business</th><th style="padding:.75rem 1rem">Owner</th>
              <th style="padding:.75rem 1rem">Status</th><th style="padding:.75rem 1rem">Tier</th>
              <th style="padding:.75rem 1rem">Stats</th><th style="padding:.75rem 1rem">Actions</th>
            </tr></thead>
            <tbody>${businesses.map(b=>`
              <tr style="border-bottom:1px solid var(--clr-border)" id="biz-row-${b.id}">
                <td style="padding:.75rem 1rem">
                  <div style="font-weight:600">${b.name}</div>
                  <div style="font-size:.75rem;color:var(--clr-text-3)">${b.city||''} · ${b.category_name||''}</div>
                </td>
                <td style="padding:.75rem 1rem;font-size:.8rem;color:var(--clr-text-2)">${b.owner_email||'—'}</td>
                <td style="padding:.75rem 1rem">
                  <select onchange="updateBizStatus('${b.id}',this.value)" style="font-size:.8rem;padding:.25rem .4rem;border:1px solid var(--clr-border);border-radius:6px;background:var(--clr-surface-2);color:var(--clr-text-1)">
                    ${['active','pending','suspended','rejected'].map(s=>`<option ${b.status===s?'selected':''}>${s}</option>`).join('')}
                  </select>
                </td>
                <td style="padding:.75rem 1rem">
                  <select onchange="updateBizTier('${b.id}',this.value)" style="font-size:.8rem;padding:.25rem .4rem;border:1px solid var(--clr-border);border-radius:6px;background:var(--clr-surface-2);color:var(--clr-text-1)">
                    ${['free','starter','pro','enterprise'].map(t=>`<option ${b.subscription_tier===t?'selected':''}>${t}</option>`).join('')}
                  </select>
                </td>
                <td style="padding:.75rem 1rem;font-size:.78rem;color:var(--clr-text-2)">
                  👁 ${b.view_count||0} · ⭐ ${b.avg_rating||'—'} · 📝 ${b.review_count||0}
                </td>
                <td style="padding:.75rem 1rem;display:flex;gap:.4rem;flex-wrap:wrap">
                  ${b.status==='active'?`<a href="/business?slug=${b.slug}" target="_blank" class="btn btn--ghost btn--sm"><i class="fa-solid fa-eye"></i></a>`:''}
                  <button class="btn btn--outline btn--sm" onclick="grantSub('${b.id}')">Grant Sub</button>
                  <button class="btn btn--ghost btn--sm" onclick="toggleFeatured('${b.id}',${!b.is_featured})">${b.is_featured?'Unfeature':'Feature'}</button>
                  <button class="btn btn--ghost btn--sm" onclick="toggleVerified('${b.id}',${!b.is_verified})">${b.is_verified?'Unverify':'Verify'}</button>
                </td>
              </tr>`).join('')}
            </tbody>
          </table>
          <div style="padding:1rem;display:flex;justify-content:center;gap:.5rem">
            ${pagination.page>1?`<button class="btn btn--ghost btn--sm" onclick="loadBizTable(${pagination.page-1})">← Prev</button>`:''}
            <span style="padding:.4rem .75rem;color:var(--clr-text-2);font-size:.85rem">Page ${pagination.page} of ${Math.ceil(pagination.total/20)||1}</span>
            ${pagination.page*20<pagination.total?`<button class="btn btn--ghost btn--sm" onclick="loadBizTable(${pagination.page+1})">Next →</button>`:''}
          </div>`;
      } catch { document.getElementById('bizTable').innerHTML = '<p style="padding:1rem;color:var(--clr-danger)">Failed to load.</p>'; }
    };

    window.updateBizStatus   = async (id, status) => { try { await API.patch(`/creator/businesses/${id}`, { status }); toast.success('Status updated'); } catch { toast.error('Failed'); } };
    window.updateBizTier     = async (id, tier)   => { try { await API.patch(`/creator/businesses/${id}`, { subscription_tier: tier }); toast.success('Tier updated'); } catch { toast.error('Failed'); } };
    window.toggleFeatured    = async (id, val)    => { try { await API.patch(`/creator/businesses/${id}`, { is_featured: val }); toast.success(val?'Featured!':'Unfeatured'); loadBizTable(); } catch { toast.error('Failed'); } };
    window.toggleVerified    = async (id, val)    => { try { await API.patch(`/creator/businesses/${id}`, { is_verified: val }); toast.success(val?'Verified!':'Unverified'); loadBizTable(); } catch { toast.error('Failed'); } };
    window.grantSub = async (id) => {
      const tier = prompt('Tier (starter/pro/enterprise):'); if(!tier) return;
      const months = prompt('Months:', '1'); if(!months) return;
      const reason = prompt('Reason (optional):', '') || '';
      try { await API.post(`/creator/businesses/${id}/grant-subscription`, { tier, months: parseInt(months), reason }); toast.success('Subscription granted!'); loadBizTable(); }
      catch(e) { toast.error(e.message||'Failed'); }
    };

    document.getElementById('bizSearch').addEventListener('keydown', e => { if(e.key==='Enter') loadBizTable(); });
    loadBizTable();
  }

  // ─── USERS ────────────────────────────────────────────────────────────────
  async function users() {
    const el = document.getElementById('creatorContent');
    el.innerHTML = `
      <div class="dashboard__header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem">
        <h1 class="dashboard__title">Users</h1>
        <a href="/creator/export/users" class="btn btn--ghost btn--sm"><i class="fa-solid fa-download"></i> Export CSV</a>
      </div>
      <div class="card" style="padding:1rem;margin-bottom:1rem;display:flex;gap:.75rem;flex-wrap:wrap">
        <input id="userSearch" type="text" placeholder="Search name or email…" class="input" style="flex:1;min-width:180px">
        <select id="userRole" class="input" style="width:160px">
          <option value="">All Roles</option>
          ${['user','business_owner','creator'].map(r=>`<option value="${r}">${r}</option>`).join('')}
        </select>
        <button class="btn btn--primary btn--sm" onclick="loadUsersTable()"><i class="fa-solid fa-search"></i></button>
      </div>
      <div class="card" style="padding:0;overflow:hidden"><div id="usersTable"><div class="skeleton" style="height:300px"></div></div></div>`;

    window.loadUsersTable = async (page=1) => {
      const qs = new URLSearchParams({ page, limit:20 });
      const s = document.getElementById('userSearch')?.value.trim();
      const r = document.getElementById('userRole')?.value;
      if(s) qs.set('search',s); if(r) qs.set('role',r);
      try {
        const { users, pagination } = await API.get(`/creator/users?${qs}`);
        document.getElementById('usersTable').innerHTML = `
          <table style="width:100%;border-collapse:collapse;font-size:.85rem">
            <thead><tr style="background:var(--clr-surface-2);text-align:left">
              <th style="padding:.75rem 1rem">User</th><th style="padding:.75rem 1rem">Role</th>
              <th style="padding:.75rem 1rem">Status</th><th style="padding:.75rem 1rem">Joined</th>
              <th style="padding:.75rem 1rem">Actions</th>
            </tr></thead>
            <tbody>${users.map(u=>`
              <tr style="border-bottom:1px solid var(--clr-border)">
                <td style="padding:.75rem 1rem">
                  <div style="font-weight:600">${u.full_name||'—'}</div>
                  <div style="font-size:.75rem;color:var(--clr-text-3)">${u.email}</div>
                </td>
                <td style="padding:.75rem 1rem">
                  <select onchange="updateUserRole('${u.id}',this.value)" style="font-size:.8rem;padding:.25rem .4rem;border:1px solid var(--clr-border);border-radius:6px;background:var(--clr-surface-2);color:var(--clr-text-1)">
                    ${['user','business_owner','creator'].map(r=>`<option ${u.role===r?'selected':''}>${r}</option>`).join('')}
                  </select>
                </td>
                <td style="padding:.75rem 1rem">
                  <span class="badge ${u.is_banned?'badge--danger':u.is_active?'badge--success':'badge--warning'}">
                    ${u.is_banned?'Banned':u.is_active?'Active':'Inactive'}
                  </span>
                </td>
                <td style="padding:.75rem 1rem;color:var(--clr-text-3);font-size:.8rem">${formatDate(u.created_at)}</td>
                <td style="padding:.75rem 1rem">
                  <button class="btn btn--ghost btn--sm" onclick="toggleBan('${u.id}',${!u.is_banned})">${u.is_banned?'Unban':'Ban'}</button>
                </td>
              </tr>`).join('')}
            </tbody>
          </table>
          <div style="padding:1rem;display:flex;justify-content:center;gap:.5rem">
            ${pagination.page>1?`<button class="btn btn--ghost btn--sm" onclick="loadUsersTable(${pagination.page-1})">← Prev</button>`:''}
            <span style="padding:.4rem .75rem;color:var(--clr-text-2);font-size:.85rem">Page ${pagination.page} of ${Math.ceil(pagination.total/20)||1}</span>
            ${pagination.page*20<pagination.total?`<button class="btn btn--ghost btn--sm" onclick="loadUsersTable(${pagination.page+1})">Next →</button>`:''}
          </div>`;
      } catch { document.getElementById('usersTable').innerHTML = '<p style="padding:1rem;color:var(--clr-danger)">Failed to load.</p>'; }
    };

    window.updateUserRole = async (id, role) => { try { await API.patch(`/creator/users/${id}`, { role }); toast.success('Role updated'); } catch { toast.error('Failed'); } };
    window.toggleBan = async (id, ban) => {
      const reason = ban ? prompt('Ban reason (optional):') : null;
      try { await API.patch(`/creator/users/${id}`, { is_banned: ban, ban_reason: reason }); toast.success(ban?'User banned':'User unbanned'); loadUsersTable(); }
      catch { toast.error('Failed'); }
    };
    document.getElementById('userSearch').addEventListener('keydown', e => { if(e.key==='Enter') loadUsersTable(); });
    loadUsersTable();
  }

  // ─── PAYMENTS ────────────────────────────────────────────────────────────
  async function payments() {
    const el = document.getElementById('creatorContent');
    el.innerHTML = `
      <div class="dashboard__header"><h1 class="dashboard__title">Payments</h1></div>
      <div class="card" style="padding:0;overflow:hidden"><div id="paymentsTable"><div class="skeleton" style="height:300px"></div></div></div>`;
    try {
      const { payments } = await API.get('/creator/payments?limit=100');
      document.getElementById('paymentsTable').innerHTML = `
        <table style="width:100%;border-collapse:collapse;font-size:.85rem">
          <thead><tr style="background:var(--clr-surface-2);text-align:left">
            <th style="padding:.75rem 1rem">User</th><th style="padding:.75rem 1rem">Plan</th>
            <th style="padding:.75rem 1rem">Amount</th><th style="padding:.75rem 1rem">Status</th>
            <th style="padding:.75rem 1rem">Date</th>
          </tr></thead>
          <tbody>${payments.map(p=>`
            <tr style="border-bottom:1px solid var(--clr-border)">
              <td style="padding:.75rem 1rem">${p.users?.full_name||'—'}<div style="font-size:.75rem;color:var(--clr-text-3)">${p.users?.email||''}</div></td>
              <td style="padding:.75rem 1rem"><span class="badge badge--primary">${p.plans?.tier||'—'}</span></td>
              <td style="padding:.75rem 1rem;font-weight:700">GHS ${Number(p.amount).toLocaleString()}</td>
              <td style="padding:.75rem 1rem"><span class="badge ${p.status==='paid'?'badge--success':p.status==='failed'?'badge--danger':'badge--warning'}">${p.status}</span></td>
              <td style="padding:.75rem 1rem;color:var(--clr-text-3)">${formatDate(p.paid_at||p.created_at)}</td>
            </tr>`).join('')}
          </tbody>
        </table>`;
    } catch { document.getElementById('paymentsTable').innerHTML = '<p style="padding:1rem;color:var(--clr-danger)">Failed to load.</p>'; }
  }

  // ─── PLANS ───────────────────────────────────────────────────────────────
  async function plans() {
    const el = document.getElementById('creatorContent');
    el.innerHTML = `<div class="dashboard__header"><h1 class="dashboard__title">Plans</h1></div><div id="plansContent"><div class="skeleton" style="height:300px;border-radius:16px"></div></div>`;
    try {
      const { plans } = await API.get('/creator/plans');
      document.getElementById('plansContent').innerHTML = plans.map(p => `
        <div class="card" style="padding:1.25rem;margin-bottom:1rem">
          <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap;justify-content:space-between">
            <div>
              <div style="font-weight:700;font-size:1rem">${p.name} <span class="badge" style="background:${p.color||'var(--clr-primary)'};color:#fff">${p.tier}</span></div>
              <div style="color:var(--clr-text-2);font-size:.85rem;margin-top:.25rem">GHS ${Number(p.price_monthly).toLocaleString()}/mo · GHS ${Number(p.price_yearly).toLocaleString()}/yr</div>
            </div>
            <div style="display:flex;gap:.5rem;flex-wrap:wrap">
              <button class="btn btn--outline btn--sm" onclick="editPlanPrice('${p.id}','${p.name}',${p.price_monthly},${p.price_yearly})">Edit Price</button>
              <button class="btn btn--ghost btn--sm" onclick="togglePlan('${p.id}',${!p.is_active})">${p.is_active?'Deactivate':'Activate'}</button>
            </div>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:.4rem;margin-top:.75rem">
            ${[
              p.has_analytics&&'Analytics', p.has_bookings&&'Bookings', p.has_whatsapp_button&&'WhatsApp',
              p.has_verified_badge&&'Verified Badge', p.has_ai_content&&'AI Content', p.has_seo_tools&&'SEO Tools',
              p.has_custom_domain&&'Custom Domain', p.has_advanced_analytics&&'Advanced Analytics',
            ].filter(Boolean).map(f=>`<span class="badge badge--success" style="font-size:.75rem">${f}</span>`).join('')}
          </div>
          <div style="display:flex;gap:1.5rem;margin-top:.75rem;font-size:.8rem;color:var(--clr-text-2)">
            <span>📦 Max Products: ${p.max_products===999?'Unlimited':p.max_products}</span>
            <span>🖼 Max Gallery: ${p.max_gallery_photos===999?'Unlimited':p.max_gallery_photos}</span>
            <span>🏪 Max Businesses: ${p.max_businesses===999?'Unlimited':p.max_businesses}</span>
          </div>
        </div>`).join('');

      window.editPlanPrice = async (id, name, monthly, yearly) => {
        const m = prompt(`Monthly price for ${name} (GHS):`, monthly); if(!m) return;
        const y = prompt(`Yearly price for ${name} (GHS):`, yearly); if(!y) return;
        try { await API.patch(`/creator/plans/${id}`, { price_monthly: parseFloat(m), price_yearly: parseFloat(y) }); toast.success('Plan updated'); plans(); }
        catch { toast.error('Failed'); }
      };
      window.togglePlan = async (id, val) => {
        try { await API.patch(`/creator/plans/${id}`, { is_active: val }); toast.success('Plan updated'); plans(); }
        catch { toast.error('Failed'); }
      };
    } catch { document.getElementById('plansContent').innerHTML = '<p style="color:var(--clr-danger)">Failed to load.</p>'; }
  }

  // ── Directory / Website / Bundle plan editor (v23 split) ──
  const DIR_FLAGS = ['has_social_links','has_whatsapp_button','has_business_hours','has_verified_badge','has_better_ranking','has_analytics','has_advanced_analytics','has_featured_offers','has_homepage_featured','has_priority_listing','has_video','has_flash_deals','has_priority_support','has_franchise','has_qr_code'];
  const WEB_FLAGS = ['has_custom_template','has_custom_domain','has_bookings','has_blog','has_testimonials','has_seo_tools','has_analytics','has_multi_page','has_forms','has_google_indexing','has_online_payments','has_product_catalog','has_appointment_scheduling','has_staff_management','has_customer_dashboard','has_email_notifications','has_sms_notifications','has_ai_content','has_api_access','has_priority_support'];
  const flagLabel = f => f.replace(/^has_/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  let pricingV2Sub = 'directory';
  async function pricingV2() {
    const el = document.getElementById('creatorContent');
    el.innerHTML = `
      <div class="dashboard__header"><h1 class="dashboard__title">Directory &amp; Website Plans</h1></div>
      <p style="color:var(--clr-text-2);font-size:.85rem;margin-bottom:1rem">These are the two independent subscription products (see CHANGELOG v23). Changes here don't affect the legacy "Plans" tab.</p>
      <div style="display:inline-flex;background:var(--clr-surface-2);border-radius:40px;padding:.25rem;gap:.25rem;margin-bottom:1.5rem">
        <button id="pv2Directory" class="btn btn--sm" style="border-radius:40px" onclick="switchPv2('directory')">Directory Plans</button>
        <button id="pv2Website" class="btn btn--sm" style="border-radius:40px" onclick="switchPv2('website')">Website Plans</button>
        <button id="pv2Bundles" class="btn btn--sm" style="border-radius:40px" onclick="switchPv2('bundles')">Bundles</button>
      </div>
      <div id="pv2Content"><div class="skeleton" style="height:300px;border-radius:16px"></div></div>`;

    window.switchPv2 = (sub) => { pricingV2Sub = sub; renderPv2Tabs(); renderPv2(); };
    function renderPv2Tabs() {
      ['directory','website','bundles'].forEach(s => {
        const b = document.getElementById('pv2' + s.charAt(0).toUpperCase() + s.slice(1));
        b.className = `btn ${pricingV2Sub === s ? 'btn--primary' : 'btn--ghost'} btn--sm`; b.style.borderRadius = '40px';
      });
    }
    renderPv2Tabs();

    async function renderPv2() {
      const content = document.getElementById('pv2Content');
      content.innerHTML = '<div class="skeleton" style="height:300px;border-radius:16px"></div>';
      try {
        if (pricingV2Sub === 'bundles') { await renderBundlesAdmin(content); return; }
        const endpoint = pricingV2Sub === 'directory' ? '/creator/directory-plans' : '/creator/website-plans';
        const { plans } = await API.get(endpoint);
        const flags = pricingV2Sub === 'directory' ? DIR_FLAGS : WEB_FLAGS;
        content.innerHTML = plans.map(p => `
          <div class="card" style="padding:1.25rem;margin-bottom:1rem">
            <div style="display:flex;gap:1rem;flex-wrap:wrap;align-items:flex-end;margin-bottom:.85rem">
              <div><label style="font-size:.7rem;color:var(--clr-text-3);display:block">Name</label>
                <input id="pv2_${p.id}_name" value="${p.name}" style="padding:.4rem .6rem;border:1px solid var(--clr-border);border-radius:8px;width:170px"></div>
              <div><label style="font-size:.7rem;color:var(--clr-text-3);display:block">Tagline</label>
                <input id="pv2_${p.id}_tagline" value="${p.tagline||''}" style="padding:.4rem .6rem;border:1px solid var(--clr-border);border-radius:8px;width:220px"></div>
              <div><label style="font-size:.7rem;color:var(--clr-text-3);display:block">₵/month</label>
                <input id="pv2_${p.id}_pm" type="number" step="0.01" value="${p.price_monthly}" style="padding:.4rem .6rem;border:1px solid var(--clr-border);border-radius:8px;width:90px"></div>
              <div><label style="font-size:.7rem;color:var(--clr-text-3);display:block">₵/year</label>
                <input id="pv2_${p.id}_py" type="number" step="0.01" value="${p.price_yearly}" style="padding:.4rem .6rem;border:1px solid var(--clr-border);border-radius:8px;width:90px"></div>
              ${pricingV2Sub === 'website' ? `<div><label style="font-size:.7rem;color:var(--clr-text-3);display:block">Free trial (days)</label>
                <input id="pv2_${p.id}_trial" type="number" value="${p.free_trial_days||0}" style="padding:.4rem .6rem;border:1px solid var(--clr-border);border-radius:8px;width:90px"></div>` : ''}
              <label style="display:flex;align-items:center;gap:.35rem;font-size:.8rem"><input type="checkbox" id="pv2_${p.id}_popular" ${p.is_popular?'checked':''}> Popular</label>
              <label style="display:flex;align-items:center;gap:.35rem;font-size:.8rem"><input type="checkbox" id="pv2_${p.id}_active" ${p.is_active?'checked':''}> Active</label>
              <span class="badge" style="background:${p.color||'var(--clr-primary)'};color:#fff">${p.tier}</span>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:.4rem;margin-bottom:.85rem">
              ${flags.map(f => `<label style="display:flex;align-items:center;gap:.4rem;font-size:.78rem;color:var(--clr-text-2)"><input type="checkbox" id="pv2_${p.id}_${f}" ${p[f]?'checked':''}> ${flagLabel(f)}</label>`).join('')}
            </div>
            <button class="btn btn--primary btn--sm" onclick="savePv2('${pricingV2Sub}','${p.id}',${JSON.stringify(flags).replace(/"/g,'&quot;')})">Save ${p.name}</button>
          </div>`).join('');
      } catch { content.innerHTML = '<p style="color:var(--clr-danger)">Failed to load.</p>'; }
    }
    renderPv2();

    window.savePv2 = async (kind, id, flags) => {
      const body = {
        name: document.getElementById(`pv2_${id}_name`).value.trim(),
        tagline: document.getElementById(`pv2_${id}_tagline`).value.trim(),
        price_monthly: parseFloat(document.getElementById(`pv2_${id}_pm`).value) || 0,
        price_yearly: parseFloat(document.getElementById(`pv2_${id}_py`).value) || 0,
        is_popular: document.getElementById(`pv2_${id}_popular`).checked,
        is_active: document.getElementById(`pv2_${id}_active`).checked,
      };
      const trialEl = document.getElementById(`pv2_${id}_trial`);
      if (trialEl) body.free_trial_days = parseInt(trialEl.value) || 0;
      flags.forEach(f => { body[f] = document.getElementById(`pv2_${id}_${f}`).checked; });
      try {
        await API.patch(`/creator/${kind}-plans/${id}`, body);
        toast.success('Plan updated');
        renderPv2();
      } catch { toast.error('Failed to save'); }
    };

    async function renderBundlesAdmin(content) {
      try {
        const { bundles } = await API.get('/creator/bundles');
        content.innerHTML = bundles.map(b => `
          <div class="card" style="padding:1.25rem;margin-bottom:1rem">
            <div style="display:flex;gap:1rem;flex-wrap:wrap;align-items:flex-end">
              <div><label style="font-size:.7rem;color:var(--clr-text-3);display:block">Name</label>
                <input id="bnd_${b.id}_name" value="${b.name}" style="padding:.4rem .6rem;border:1px solid var(--clr-border);border-radius:8px;width:220px"></div>
              <div><label style="font-size:.7rem;color:var(--clr-text-3);display:block">Tagline</label>
                <input id="bnd_${b.id}_tagline" value="${b.tagline||''}" style="padding:.4rem .6rem;border:1px solid var(--clr-border);border-radius:8px;width:220px"></div>
              <div><label style="font-size:.7rem;color:var(--clr-text-3);display:block">Discount %</label>
                <input id="bnd_${b.id}_discount" type="number" step="1" value="${b.discount_percent}" style="padding:.4rem .6rem;border:1px solid var(--clr-border);border-radius:8px;width:90px"></div>
              <label style="display:flex;align-items:center;gap:.35rem;font-size:.8rem"><input type="checkbox" id="bnd_${b.id}_popular" ${b.is_popular?'checked':''}> Popular</label>
              <label style="display:flex;align-items:center;gap:.35rem;font-size:.8rem"><input type="checkbox" id="bnd_${b.id}_active" ${b.is_active?'checked':''}> Active</label>
            </div>
            <div style="font-size:.8rem;color:var(--clr-text-2);margin:.75rem 0">
              📋 ${b.directory_plans?.name} (${b.directory_plans?.tier}) &nbsp;+&nbsp; 🌐 ${b.website_plans?.name} (${b.website_plans?.tier})
            </div>
            <button class="btn btn--primary btn--sm" onclick="saveBundle('${b.id}')">Save</button>
          </div>`).join('') || '<p style="color:var(--clr-text-3)">No bundles yet.</p>';

        window.saveBundle = async (id) => {
          const body = {
            name: document.getElementById(`bnd_${id}_name`).value.trim(),
            tagline: document.getElementById(`bnd_${id}_tagline`).value.trim(),
            discount_percent: parseFloat(document.getElementById(`bnd_${id}_discount`).value) || 0,
            is_popular: document.getElementById(`bnd_${id}_popular`).checked,
            is_active: document.getElementById(`bnd_${id}_active`).checked,
          };
          try { await API.patch(`/creator/bundles/${id}`, body); toast.success('Bundle updated'); renderPv2(); }
          catch { toast.error('Failed to save'); }
        };
      } catch { content.innerHTML = '<p style="color:var(--clr-danger)">Failed to load.</p>'; }
    }
  }

  // ─── PROMOS ──────────────────────────────────────────────────────────────
  async function promos() {
    const el = document.getElementById('creatorContent');
    el.innerHTML = `
      <div class="dashboard__header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem">
        <h1 class="dashboard__title">Promo Codes</h1>
        <button class="btn btn--primary btn--sm" onclick="showPromoForm()"><i class="fa-solid fa-plus"></i> New Code</button>
      </div>
      <div id="promoForm" hidden class="card" style="padding:1.25rem;margin-bottom:1.5rem">
        <h3 style="margin-bottom:1rem;font-weight:700">Create Promo Code</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-bottom:.75rem">
          <div><label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:.3rem">Code</label><input id="pcCode" class="input" placeholder="e.g. LAUNCH50" style="width:100%;text-transform:uppercase"></div>
          <div><label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:.3rem">Type</label>
            <select id="pcType" class="input" style="width:100%"><option value="percent">Percent %</option><option value="fixed">Fixed GHS</option></select></div>
          <div><label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:.3rem">Value</label><input id="pcValue" type="number" class="input" placeholder="e.g. 20" style="width:100%"></div>
          <div><label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:.3rem">Max Uses</label><input id="pcMax" type="number" class="input" placeholder="Unlimited" style="width:100%"></div>
          <div><label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:.3rem">Expires</label><input id="pcExpiry" type="datetime-local" class="input" style="width:100%"></div>
          <div><label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:.3rem">Description</label><input id="pcDesc" class="input" placeholder="Optional" style="width:100%"></div>
        </div>
        <div style="display:flex;gap:.5rem">
          <button class="btn btn--primary btn--sm" onclick="createPromo()">Create</button>
          <button class="btn btn--ghost btn--sm" onclick="document.getElementById('promoForm').hidden=true">Cancel</button>
        </div>
      </div>
      <div id="promosList"><div class="skeleton" style="height:200px;border-radius:16px"></div></div>`;

    window.showPromoForm = () => { document.getElementById('promoForm').hidden = false; };
    window.createPromo = async () => {
      const code = document.getElementById('pcCode').value.trim();
      const type = document.getElementById('pcType').value;
      const value = parseFloat(document.getElementById('pcValue').value);
      if (!code || !value) { toast.warning('Code and value required'); return; }
      try {
        await API.post('/creator/promo-codes', { code, type, value, description: document.getElementById('pcDesc').value, max_uses: document.getElementById('pcMax').value || null, valid_until: document.getElementById('pcExpiry').value || null });
        toast.success('Promo code created!');
        document.getElementById('promoForm').hidden = true;
        loadPromoList();
      } catch(e) { toast.error(e.message||'Failed'); }
    };
    loadPromoList();
  }

  async function loadPromoList() {
    try {
      const { promo_codes } = await API.get('/creator/promo-codes');
      document.getElementById('promosList').innerHTML = promo_codes.length
        ? `<div class="card" style="padding:0;overflow:hidden">
            <table style="width:100%;border-collapse:collapse;font-size:.85rem">
              <thead><tr style="background:var(--clr-surface-2);text-align:left">
                <th style="padding:.75rem 1rem">Code</th><th style="padding:.75rem 1rem">Type</th>
                <th style="padding:.75rem 1rem">Value</th><th style="padding:.75rem 1rem">Uses</th>
                <th style="padding:.75rem 1rem">Expires</th><th style="padding:.75rem 1rem">Active</th>
              </tr></thead>
              <tbody>${promo_codes.map(p=>`
                <tr style="border-bottom:1px solid var(--clr-border)">
                  <td style="padding:.75rem 1rem;font-weight:700;font-family:monospace">${p.code}</td>
                  <td style="padding:.75rem 1rem">${p.type}</td>
                  <td style="padding:.75rem 1rem">${p.type==='percent'?p.value+'%':'GHS '+Number(p.value).toLocaleString()}</td>
                  <td style="padding:.75rem 1rem">${p.used_count||0}${p.max_uses?'/'+p.max_uses:''}</td>
                  <td style="padding:.75rem 1rem;font-size:.8rem;color:var(--clr-text-3)">${p.valid_until?formatDate(p.valid_until):'Never'}</td>
                  <td style="padding:.75rem 1rem">
                    <button class="btn ${p.is_active?'btn--success':'btn--ghost'} btn--sm" onclick="togglePromo('${p.id}',${!p.is_active})">${p.is_active?'Active':'Inactive'}</button>
                  </td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>`
        : '<p style="color:var(--clr-text-2)">No promo codes yet.</p>';
      window.togglePromo = async (id, val) => {
        try { await API.patch(`/creator/promo-codes/${id}`, { is_active: val }); toast.success('Updated'); loadPromoList(); }
        catch { toast.error('Failed'); }
      };
    } catch { document.getElementById('promosList').innerHTML = '<p style="color:var(--clr-danger)">Failed to load.</p>'; }
  }

  // ─── PLATFORM ANALYTICS ──────────────────────────────────────────────────
  async function analytics() {
    document.getElementById('creatorContent').innerHTML = `
      <div class="dashboard__header"><h1 class="dashboard__title">Platform Analytics</h1></div>
      <div id="analyticsContent"><div class="skeleton" style="height:400px;border-radius:16px"></div></div>`;
    try {
      const [{ stats }, { payments }, { businesses }] = await Promise.all([
        API.get('/creator/dashboard'),
        API.get('/creator/payments?limit=200'),
        API.get('/creator/businesses?limit=200'),
      ]);

      // Revenue by month
      const revenueByMonth = {};
      (payments || []).filter(p => p.status === 'paid').forEach(p => {
        const m = (p.paid_at || p.created_at || '').slice(0,7);
        revenueByMonth[m] = (revenueByMonth[m] || 0) + Number(p.amount || 0);
      });
      const months = Object.keys(revenueByMonth).sort().slice(-12);

      // Businesses by category
      const byCategory = {};
      (businesses || []).forEach(b => { if(b.category_name) byCategory[b.category_name] = (byCategory[b.category_name]||0)+1; });
      const topCats = Object.entries(byCategory).sort((a,b)=>b[1]-a[1]).slice(0,8);

      // Businesses by city
      const byCity = {};
      (businesses || []).forEach(b => { if(b.city) byCity[b.city] = (byCity[b.city]||0)+1; });
      const topCities = Object.entries(byCity).sort((a,b)=>b[1]-a[1]).slice(0,8);

      document.getElementById('analyticsContent').innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-bottom:1.5rem" class="creator-2col">
          <div class="card" style="padding:1.25rem">
            <h3 style="font-weight:700;margin-bottom:1rem">Monthly Revenue (GHS)</h3>
            ${months.length ? `<div style="display:flex;align-items:flex-end;gap:6px;height:120px">
              ${months.map(m => {
                const val = revenueByMonth[m];
                const max = Math.max(...Object.values(revenueByMonth)) || 1;
                const pct = Math.round((val/max)*100);
                return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
                  <div style="font-size:.65rem;color:var(--clr-text-3)">GHS ${Number(val).toLocaleString()}</div>
                  <div style="width:100%;background:var(--clr-primary);border-radius:4px 4px 0 0;height:${pct}%" title="${m}: GHS ${Number(val).toLocaleString()}"></div>
                  <div style="font-size:.65rem;color:var(--clr-text-3);writing-mode:vertical-lr;transform:rotate(180deg)">${m.slice(5)}</div>
                </div>`;
              }).join('')}
            </div>` : '<p style="color:var(--clr-text-3)">No payment data yet.</p>'}
          </div>
          <div class="card" style="padding:1.25rem">
            <h3 style="font-weight:700;margin-bottom:1rem">Businesses by Category</h3>
            ${topCats.map(([cat, count]) => {
              const max = topCats[0][1] || 1;
              return `<div style="margin-bottom:.5rem">
                <div style="display:flex;justify-content:space-between;font-size:.8rem;margin-bottom:.2rem">
                  <span>${cat}</span><span style="font-weight:700">${count}</span>
                </div>
                <div style="background:var(--clr-surface-2);border-radius:100px;height:6px">
                  <div style="width:${Math.round(count/max*100)}%;background:var(--clr-primary);border-radius:100px;height:6px"></div>
                </div>
              </div>`;
            }).join('')}
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem" class="creator-2col">
          <div class="card" style="padding:1.25rem">
            <h3 style="font-weight:700;margin-bottom:1rem">Businesses by City</h3>
            ${topCities.map(([city, count]) => {
              const max = topCities[0][1] || 1;
              return `<div style="margin-bottom:.5rem">
                <div style="display:flex;justify-content:space-between;font-size:.8rem;margin-bottom:.2rem">
                  <span>${city}</span><span style="font-weight:700">${count}</span>
                </div>
                <div style="background:var(--clr-surface-2);border-radius:100px;height:6px">
                  <div style="width:${Math.round(count/max*100)}%;background:#2f9e44;border-radius:100px;height:6px"></div>
                </div>
              </div>`;
            }).join('')}
          </div>
          <div class="card" style="padding:1.25rem">
            <h3 style="font-weight:700;margin-bottom:1rem">Subscription Tiers</h3>
            ${Object.entries(stats.tier_breakdown||{}).map(([tier, count]) => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:.5rem 0;border-bottom:1px solid var(--clr-border)">
                <span style="text-transform:capitalize;font-weight:600">${tier}</span>
                <span class="badge badge--primary">${count} active</span>
              </div>`).join('')}
          </div>
        </div>
        <style>.creator-2col{grid-template-columns:1fr}@media(min-width:700px){.creator-2col{grid-template-columns:1fr 1fr}}</style>`;
    } catch { document.getElementById('analyticsContent').innerHTML = '<p style="color:var(--clr-danger)">Failed to load analytics.</p>'; }
  }

  // ─── SETTINGS ────────────────────────────────────────────────────────────
  async function settings() {
    const el = document.getElementById('creatorContent');
    el.innerHTML = `<div class="dashboard__header"><h1 class="dashboard__title">Platform Settings</h1></div>
      <div id="settingsContent"><div class="skeleton" style="height:300px;border-radius:16px"></div></div>`;
    try {
      const { settings } = await API.get('/creator/settings');
      document.getElementById('settingsContent').innerHTML = `
        <div class="card" style="padding:1.5rem;max-width:560px">
          ${Object.entries(settings).map(([key, val]) => `
            <div style="margin-bottom:1rem">
              <label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:.35rem;text-transform:capitalize">${key.replace(/_/g,' ')}</label>
              <input id="setting-${key}" class="input" value="${val||''}" style="width:100%">
            </div>`).join('')}
          <button class="btn btn--primary" onclick="saveSettings(${JSON.stringify(Object.keys(settings))})">Save Settings</button>
        </div>`;
      window.saveSettings = async (keys) => {
        const updated = {};
        keys.forEach(k => { updated[k] = document.getElementById(`setting-${k}`)?.value; });
        try { await API.patch('/creator/settings', { settings: updated }); toast.success('Settings saved!'); }
        catch { toast.error('Failed to save'); }
      };
    } catch { document.getElementById('settingsContent').innerHTML = '<p style="color:var(--clr-danger)">Failed to load settings.</p>'; }
  }

  // ─── AUDIT LOG ───────────────────────────────────────────────────────────
  async function audit() {
    const el = document.getElementById('creatorContent');
    el.innerHTML = `<div class="dashboard__header"><h1 class="dashboard__title">Audit Log</h1></div>
      <div id="auditList"><div class="skeleton" style="height:400px;border-radius:16px"></div></div>`;
    try {
      const { logs } = await API.get('/creator/audit-logs?limit=100');
      document.getElementById('auditList').innerHTML = `
        <div class="card" style="padding:0;overflow:hidden">
          <table style="width:100%;border-collapse:collapse;font-size:.82rem">
            <thead><tr style="background:var(--clr-surface-2);text-align:left">
              <th style="padding:.75rem 1rem">Action</th><th style="padding:.75rem 1rem">Actor</th>
              <th style="padding:.75rem 1rem">Target</th><th style="padding:.75rem 1rem">Time</th>
            </tr></thead>
            <tbody>${logs.map(l=>`
              <tr style="border-bottom:1px solid var(--clr-border)">
                <td style="padding:.6rem 1rem;font-family:monospace;font-size:.8rem">${l.action}</td>
                <td style="padding:.6rem 1rem">${l.users?.full_name||l.actor_id?.slice(0,8)||'System'}</td>
                <td style="padding:.6rem 1rem;color:var(--clr-text-3)">${l.resource_type||''} ${l.resource_id?'#'+l.resource_id.slice(0,8):''}</td>
                <td style="padding:.6rem 1rem;color:var(--clr-text-3)">${timeAgo(l.created_at)}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    } catch { document.getElementById('auditList').innerHTML = '<p style="color:var(--clr-danger)">Failed to load.</p>'; }
  }

  // ─── MODERATION (business claims + reports) ────────────────────────────────
  async function moderation() {
    const el = document.getElementById('creatorContent');
    el.innerHTML = `<div class="dashboard__header"><h1 class="dashboard__title">Moderation</h1>
        <p style="color:var(--clr-text-2)">Business listings, claims, reviews, verification, fraud, and support all in one place</p></div>
      <div style="margin-bottom:.75rem;display:flex;gap:.5rem;flex-wrap:wrap">
        <button class="btn btn--sm btn--primary" id="modListingsBtn">Pending Listings</button>
        <button class="btn btn--sm btn--ghost" id="modRejectedBtn">Rejected Listings</button>
        <button class="btn btn--sm btn--ghost" id="modClaimsBtn">Claims</button>
        <button class="btn btn--sm btn--ghost" id="modReportsBtn">Reports</button>
        <button class="btn btn--sm btn--ghost" id="modFlaggedBtn">Flagged Reviews</button>
        <button class="btn btn--sm btn--ghost" id="modVerificationBtn">Verification</button>
        <button class="btn btn--sm btn--ghost" id="modFraudBtn">Fraud</button>
        <button class="btn btn--sm btn--ghost" id="modTicketsBtn">Tickets</button>
      </div>
      <div id="moderationList"><div class="skeleton" style="height:300px;border-radius:16px"></div></div>`;

    document.getElementById('modListingsBtn').addEventListener('click', () => { setActive('modListingsBtn'); loadListings('pending'); });
    document.getElementById('modRejectedBtn').addEventListener('click', () => { setActive('modRejectedBtn'); loadListings('rejected'); });
    document.getElementById('modClaimsBtn').addEventListener('click', () => { setActive('modClaimsBtn'); loadClaims(); });
    document.getElementById('modReportsBtn').addEventListener('click', () => { setActive('modReportsBtn'); loadReports(); });
    document.getElementById('modFlaggedBtn').addEventListener('click', () => { setActive('modFlaggedBtn'); loadFlagged(); });
    document.getElementById('modVerificationBtn').addEventListener('click', () => { setActive('modVerificationBtn'); loadVerification(); });
    document.getElementById('modFraudBtn').addEventListener('click', () => { setActive('modFraudBtn'); loadFraud(); });
    document.getElementById('modTicketsBtn').addEventListener('click', () => { setActive('modTicketsBtn'); loadTickets(); });
    function setActive(id) {
      ['modListingsBtn','modRejectedBtn','modClaimsBtn','modReportsBtn','modFlaggedBtn','modVerificationBtn','modFraudBtn','modTicketsBtn']
        .forEach(x => document.getElementById(x).className = x === id ? 'btn btn--sm btn--primary' : 'btn btn--sm btn--ghost');
    }

    async function loadFlagged() {
      const list = document.getElementById('moderationList');
      list.innerHTML = `<div class="skeleton" style="height:300px;border-radius:16px"></div>`;
      try {
        const { reviews } = await API.get('/reviews/flagged');
        if (!reviews.length) { list.innerHTML = `<div class="card" style="padding:2rem;text-align:center;color:var(--clr-text-2)">✅ No flagged reviews</div>`; return; }
        list.innerHTML = reviews.map(r => `
          <div class="card" style="padding:1.25rem;margin-bottom:.75rem" id="flag-${r.id}">
            <div style="display:flex;align-items:flex-start;gap:1rem;flex-wrap:wrap">
              <div style="flex:1;min-width:200px">
                <div style="font-weight:600;margin-bottom:.25rem">${r.users?.full_name||'Anonymous'} <span style="color:var(--clr-text-3);font-size:.8rem">on</span> ${r.businesses?.name||'—'}</div>
                <div style="color:var(--clr-gold);margin-bottom:.4rem">${'★'.repeat(r.rating||0)}</div>
                <p style="font-size:.875rem;color:var(--clr-text-2);margin:0 0 .5rem">${r.content||'—'}</p>
                <div style="font-size:.78rem;padding:.35rem .6rem;background:rgba(239,68,68,.1);border-radius:6px;color:var(--clr-danger);display:inline-block">🚩 ${r.flag_reason||'Flagged by user'}</div>
              </div>
              <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:flex-start">
                <button class="btn btn--ghost btn--sm" onclick="unflagReview('${r.id}')">Clear Flag</button>
                <button class="btn btn--danger btn--sm" onclick="deleteFlaggedReview('${r.id}')">Delete</button>
              </div>
            </div>
          </div>`).join('');
      } catch { list.innerHTML = '<p style="color:var(--clr-danger)">Failed to load flagged reviews.</p>'; }
    }
    window.unflagReview = async (id) => {
      try { await API.patch(`/reviews/${id}/unflag`); document.getElementById(`flag-${id}`)?.remove(); toast.success('Flag cleared'); }
      catch { toast.error('Failed'); }
    };
    window.deleteFlaggedReview = async (id) => {
      if (!confirm('Permanently delete this review?')) return;
      try { await API.delete(`/reviews/${id}`); document.getElementById(`flag-${id}`)?.remove(); toast.success('Review deleted'); }
      catch { toast.error('Failed'); }
    };

    async function loadVerification() {
      const list = document.getElementById('moderationList');
      list.innerHTML = `<div class="skeleton" style="height:300px;border-radius:16px"></div>`;
      try {
        const { requests } = await API.get('/verification/pending');
        if (!requests.length) { list.innerHTML = `<div class="card" style="padding:2rem;text-align:center;color:var(--clr-text-2)">✅ No pending verification requests</div>`; return; }
        list.innerHTML = requests.map(r => `
          <div class="card" style="padding:1.25rem;margin-bottom:.75rem" id="verif-${r.id}">
            <div style="display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap">
              <div>
                <strong>${r.businesses?.name || '—'}</strong> <span style="color:var(--clr-text-3);font-size:.8rem">· ${r.businesses?.city || ''}</span>
                <div style="font-size:.8rem;color:var(--clr-text-2);margin-top:.25rem">Submitted by ${r.users?.full_name || '—'} (${r.users?.email || '—'})</div>
                <div style="font-size:.8rem;color:var(--clr-text-2)">Document: ${r.document_type.replace('_',' ')} ${r.document_number ? `· #${r.document_number}` : ''}</div>
                <a href="${r.document_url}" target="_blank" rel="noopener" style="font-size:.8rem">View document <i class="fa-solid fa-arrow-up-right-from-square"></i></a>
              </div>
              <div style="display:flex;gap:.5rem;align-items:flex-start">
                <button class="btn btn--primary btn--sm" onclick="approveVerification('${r.id}')">Approve</button>
                <button class="btn btn--danger btn--sm" onclick="rejectVerification('${r.id}')">Reject</button>
              </div>
            </div>
          </div>`).join('');
      } catch { list.innerHTML = '<p style="color:var(--clr-danger)">Failed to load verification requests.</p>'; }
    }
    window.approveVerification = async (id) => {
      try { await API.patch(`/verification/${id}/approve`); document.getElementById(`verif-${id}`)?.remove(); toast.success('Business verified!'); }
      catch (e) { toast.error(e.message || 'Failed'); }
    };
    window.rejectVerification = async (id) => {
      const reason = prompt('Reason for rejection (shown to the business owner):') || '';
      try { await API.patch(`/verification/${id}/reject`, { reason }); document.getElementById(`verif-${id}`)?.remove(); toast.success('Request rejected'); }
      catch (e) { toast.error(e.message || 'Failed'); }
    };

    async function loadFraud() {
      const list = document.getElementById('moderationList');
      list.innerHTML = `<div class="skeleton" style="height:300px;border-radius:16px"></div>`;
      try {
        const { flags } = await API.get('/fraud');
        if (!flags.length) { list.innerHTML = `<div class="card" style="padding:2rem;text-align:center;color:var(--clr-text-2)">✅ No open fraud flags</div>`; return; }
        const sevColor = { high: 'var(--clr-danger)', medium: 'var(--clr-gold)', low: 'var(--clr-text-3)' };
        list.innerHTML = flags.map(f => `
          <div class="card" style="padding:1.25rem;margin-bottom:.75rem" id="fraud-${f.id}">
            <div style="display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap">
              <div>
                <span class="badge" style="background:${sevColor[f.severity]}22;color:${sevColor[f.severity]}">${f.severity}</span>
                <span style="font-size:.8rem;color:var(--clr-text-3);margin-left:.5rem">${f.entity_type} · ${timeAgo(f.created_at)}</span>
                <p style="margin:.4rem 0 0">${f.reason}</p>
              </div>
              <div style="display:flex;gap:.5rem;align-items:flex-start">
                <button class="btn btn--ghost btn--sm" onclick="reviewFraud('${f.id}','dismissed')">Dismiss</button>
                <button class="btn btn--danger btn--sm" onclick="reviewFraud('${f.id}','confirmed')">Confirm Issue</button>
              </div>
            </div>
          </div>`).join('');
      } catch { list.innerHTML = '<p style="color:var(--clr-danger)">Failed to load fraud flags.</p>'; }
    }
    window.reviewFraud = async (id, status) => {
      try { await API.patch(`/fraud/${id}`, { status }); document.getElementById(`fraud-${id}`)?.remove(); toast.success('Updated'); }
      catch (e) { toast.error(e.message || 'Failed'); }
    };

    async function loadTickets() {
      const list = document.getElementById('moderationList');
      list.innerHTML = `<div class="skeleton" style="height:300px;border-radius:16px"></div>`;
      try {
        const { tickets: ticketList } = await API.get('/support?status=open');
        if (!ticketList.length) { list.innerHTML = `<div class="card" style="padding:2rem;text-align:center;color:var(--clr-text-2)">✅ No open tickets</div>`; return; }
        list.innerHTML = ticketList.map(t => `
          <div class="card" style="padding:1.1rem;margin-bottom:.6rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.5rem">
            <div>
              <strong>${t.subject}</strong>
              <div style="font-size:.8rem;color:var(--clr-text-2)">${t.users?.full_name || 'Guest'} · ${t.category} · ${timeAgo(t.created_at)}</div>
            </div>
            <a href="/support?id=${t.id}" class="btn btn--outline btn--sm">Open</a>
          </div>`).join('');
      } catch { list.innerHTML = '<p style="color:var(--clr-danger)">Failed to load tickets.</p>'; }
    }

    async function loadListings(status) {
      const list = document.getElementById('moderationList');
      list.innerHTML = `<div class="skeleton" style="height:300px;border-radius:16px"></div>`;
      try {
        const { businesses } = await API.get(`/creator/businesses?status=${status}&limit=50`);
        if (!businesses?.length) {
          list.innerHTML = `<div class="card" style="padding:2rem;text-align:center;color:var(--clr-text-2)">${status === 'pending' ? 'No pending listings 🎉' : 'No rejected listings'}</div>`;
          return;
        }
        list.innerHTML = businesses.map(b => `
          <div class="card" style="padding:1rem 1.25rem;margin-bottom:.75rem;display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap">
            <div style="flex:1;min-width:220px">
              <strong>${b.name}</strong> <span style="color:var(--clr-text-3);font-size:.8rem">${b.city || ''}</span>
              <div style="font-size:.85rem;margin-top:.35rem">${b.category_name || 'Uncategorized'} · Owner: ${b.owner_email || '—'}</div>
              ${b.tagline ? `<div style="font-size:.8rem;color:var(--clr-text-2);margin-top:.25rem">"${b.tagline}"</div>` : ''}
              ${b.rejection_reason ? `<div style="font-size:.8rem;color:var(--clr-danger);margin-top:.25rem">Rejected: ${b.rejection_reason}</div>` : ''}
              <div style="font-size:.75rem;color:var(--clr-text-3);margin-top:.25rem">Submitted ${timeAgo(b.created_at)}</div>
            </div>
            <div style="display:flex;gap:.5rem">
              ${status === 'pending' ? `
                <button class="btn btn--sm btn--success" onclick="approveListing('${b.id}')"><i class="fa-solid fa-check"></i> Approve</button>
                <button class="btn btn--sm btn--danger" onclick="rejectListing('${b.id}')"><i class="fa-solid fa-xmark"></i> Reject</button>
              ` : `
                <a href="/business-edit?id=${b.id}" class="btn btn--sm btn--ghost"><i class="fa-solid fa-eye"></i> Review</a>
                <button class="btn btn--sm btn--danger" onclick="deleteRejectedListing('${b.id}','${b.name.replace(/'/g, "\\'")}')"><i class="fa-solid fa-trash"></i> Delete</button>
              `}
            </div>
          </div>`).join('');
      } catch { list.innerHTML = '<p style="color:var(--clr-danger)">Failed to load listings.</p>'; }
    }

    window.approveListing = async (id) => {
      try { await API.patch(`/creator/businesses/${id}`, { status: 'active' }); toast.success('Listing approved — it\'s now live'); loadListings('pending'); }
      catch (err) { toast.error(err.message || 'Failed to approve listing'); }
    };
    window.rejectListing = async (id) => {
      const reason = prompt('Reason for rejecting this listing (shown to the owner):') || '';
      try { await API.patch(`/creator/businesses/${id}`, { status: 'rejected', rejection_reason: reason }); toast.success('Listing rejected'); loadListings('pending'); }
      catch (err) { toast.error(err.message || 'Failed to reject listing'); }
    };
    window.deleteRejectedListing = async (id, name) => {
      if (!confirm(`Permanently delete "${name}"? This can't be undone.`)) return;
      try { await API.delete(`/businesses/${id}`); toast.success('Listing deleted'); loadListings('rejected'); }
      catch (err) { toast.error(err.message || 'Failed to delete listing'); }
    };

    async function loadClaims() {
      const list = document.getElementById('moderationList');
      list.innerHTML = `<div class="skeleton" style="height:300px;border-radius:16px"></div>`;
      try {
        const { claims } = await API.get('/claims/pending');
        if (!claims?.length) { list.innerHTML = `<div class="card" style="padding:2rem;text-align:center;color:var(--clr-text-2)">No pending claims 🎉</div>`; return; }
        list.innerHTML = claims.map(c => `
          <div class="card" style="padding:1rem 1.25rem;margin-bottom:.75rem;display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap">
            <div style="flex:1;min-width:220px">
              <strong>${c.businesses?.name || 'Unknown business'}</strong> <span style="color:var(--clr-text-3);font-size:.8rem">${c.businesses?.city || ''}</span>
              <div style="font-size:.85rem;margin-top:.35rem">Claimed by <strong>${c.full_name}</strong> (${c.phone})${c.role_at_business ? ` — ${c.role_at_business}` : ''}</div>
              ${c.message ? `<div style="font-size:.8rem;color:var(--clr-text-2);margin-top:.25rem">"${c.message}"</div>` : ''}
              ${c.proof_url ? `<a href="${c.proof_url}" target="_blank" rel="noopener" style="font-size:.8rem">📎 View proof document</a>` : ''}
              <div style="font-size:.75rem;color:var(--clr-text-3);margin-top:.25rem">Submitted by account: ${c.users?.full_name || ''} (${c.users?.email || ''}) · ${timeAgo(c.created_at)}</div>
            </div>
            <div style="display:flex;gap:.5rem">
              <button class="btn btn--sm btn--success" onclick="approveClaim('${c.id}')"><i class="fa-solid fa-check"></i> Approve</button>
              <button class="btn btn--sm btn--danger" onclick="rejectClaim('${c.id}')"><i class="fa-solid fa-xmark"></i> Reject</button>
            </div>
          </div>`).join('');
      } catch { list.innerHTML = '<p style="color:var(--clr-danger)">Failed to load claims.</p>'; }
    }

    async function loadReports() {
      const list = document.getElementById('moderationList');
      list.innerHTML = `<div class="skeleton" style="height:300px;border-radius:16px"></div>`;
      try {
        const { reports } = await API.get('/reports/open');
        if (!reports?.length) { list.innerHTML = `<div class="card" style="padding:2rem;text-align:center;color:var(--clr-text-2)">No open reports 🎉</div>`; return; }
        list.innerHTML = reports.map(r => `
          <div class="card" style="padding:1rem 1.25rem;margin-bottom:.75rem;display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap">
            <div style="flex:1;min-width:220px">
              <strong>${r.businesses?.name || 'Unknown business'}</strong> <span style="color:var(--clr-text-3);font-size:.8rem">${r.businesses?.city || ''}</span>
              <div style="font-size:.85rem;margin-top:.35rem"><span class="badge badge--warning" style="text-transform:capitalize">${r.reason}</span></div>
              ${r.details ? `<div style="font-size:.8rem;color:var(--clr-text-2);margin-top:.25rem">"${r.details}"</div>` : ''}
              <div style="font-size:.75rem;color:var(--clr-text-3);margin-top:.25rem">Reported by ${r.users?.full_name || ''} · ${timeAgo(r.created_at)}</div>
            </div>
            <div style="display:flex;gap:.5rem">
              <button class="btn btn--sm btn--success" onclick="resolveReport('${r.id}')"><i class="fa-solid fa-check"></i> Resolve</button>
              <button class="btn btn--sm btn--ghost" onclick="dismissReport('${r.id}')"><i class="fa-solid fa-xmark"></i> Dismiss</button>
            </div>
          </div>`).join('');
      } catch { list.innerHTML = '<p style="color:var(--clr-danger)">Failed to load reports.</p>'; }
    }

    window.approveClaim = async (id) => {
      try { await API.patch(`/claims/${id}/approve`); toast.success('Claim approved'); loadClaims(); }
      catch (err) { toast.error(err.message || 'Failed to approve claim'); }
    };
    window.rejectClaim = async (id) => {
      const reason = prompt('Reason for rejecting this claim (optional):') || '';
      try { await API.patch(`/claims/${id}/reject`, { reason }); toast.success('Claim rejected'); loadClaims(); }
      catch (err) { toast.error(err.message || 'Failed to reject claim'); }
    };
    window.resolveReport = async (id) => {
      try { await API.patch(`/reports/${id}/resolve`); toast.success('Report resolved'); loadReports(); }
      catch (err) { toast.error(err.message || 'Failed to resolve report'); }
    };
    window.dismissReport = async (id) => {
      try { await API.patch(`/reports/${id}/dismiss`); toast.success('Report dismissed'); loadReports(); }
      catch (err) { toast.error(err.message || 'Failed to dismiss report'); }
    };

    loadListings('pending');
  }
});
