// assets/js/admin.js
document.addEventListener('DOMContentLoaded', () => {
  loadComponents();
  if (!Auth.requireAuth()) return;
  const user = Auth.getUser();
  if (user?.role !== 'creator') {
    document.getElementById('pageMain').innerHTML = `<div style="text-align:center;padding:5rem 1rem">
      <div style="font-size:3rem;margin-bottom:1rem">🚫</div><h2>Access Denied</h2>
      <p style="color:var(--clr-text-2)">Admin access required.</p>
      <a href="/" class="btn btn--primary" style="margin-top:1rem">Go Home</a></div>`;
    return;
  }

  document.getElementById('pageMain').innerHTML = `
    <div class="dashboard">
      <aside class="sidebar">
        <div class="sidebar__label">Admin</div>
        <a class="sidebar__item active" data-tab="overview"><i class="fa-solid fa-gauge"></i> Overview</a>
        <a class="sidebar__item" data-tab="pending"><i class="fa-solid fa-clock"></i> Pending Review</a>
        <a class="sidebar__item" data-tab="businesses"><i class="fa-solid fa-store"></i> All Businesses</a>
        <a class="sidebar__item" data-tab="users"><i class="fa-solid fa-users"></i> Users</a>
        <a class="sidebar__item" data-tab="flagged"><i class="fa-solid fa-flag"></i> Flagged Reviews</a>
        <a class="sidebar__item" data-tab="verification"><i class="fa-solid fa-shield-halved"></i> Verification</a>
        <a class="sidebar__item" data-tab="fraud"><i class="fa-solid fa-triangle-exclamation"></i> Fraud Flags</a>
        <a class="sidebar__item" data-tab="tickets"><i class="fa-solid fa-ticket"></i> Support Tickets</a>
        <a class="sidebar__item" id="adminInstallAppBtn"><i class="fa-solid fa-download"></i> Download App</a>
      </aside>
      <div class="dashboard__content">
        <div id="adminContent"><div class="skeleton" style="height:300px;border-radius:16px"></div></div>
      </div>
    </div>`;

  document.querySelectorAll('.sidebar__item[data-tab]').forEach(el => {
    el.addEventListener('click', () => {
      document.querySelectorAll('.sidebar__item').forEach(i => i.classList.remove('active'));
      el.classList.add('active');
      loadTab(el.dataset.tab);
    });
  });

  document.getElementById('adminInstallAppBtn').addEventListener('click', (e) => {
    e.preventDefault();
    window.triggerPWAInstall();
  });

  loadTab('overview');

  async function loadTab(tab) {
    document.getElementById('adminContent').innerHTML = `<div class="skeleton" style="height:300px;border-radius:16px"></div>`;
    const tabs = { overview, pending, businesses, users, flagged, verification, fraud, tickets };
    await (tabs[tab] || (() => {}))();
  }

  async function overview() {
    try {
      const d = await API.get('/admin/dashboard');
      const s = d.stats;
      document.getElementById('adminContent').innerHTML = `
        <div class="dashboard__header"><h1 class="dashboard__title">Admin Overview</h1></div>
        <div class="stat-grid" style="margin-bottom:2rem">
          ${[
            { label:'Total Users', value:s.total_users, icon:'👥', color:'var(--clr-primary)' },
            { label:'Active Businesses', value:s.active_businesses, icon:'🏪', color:'var(--clr-success)' },
            { label:'Pending Review', value:s.pending_businesses, icon:'⏳', color:'var(--clr-warning)', link:true },
            { label:'Total Reviews', value:s.total_reviews, icon:'⭐', color:'var(--clr-gold)' },
          ].map(k=>`<div class="stat-card" ${k.link?`onclick="loadTab('pending')" style="cursor:pointer"`:''}>
            <div class="stat-card__icon" style="font-size:1.5rem">${k.icon}</div>
            <div class="stat-card__label">${k.label}</div>
            <div class="stat-card__value" style="color:${k.color}">${(k.value||0).toLocaleString()}</div>
          </div>`).join('')}
        </div>
        <div class="card" style="padding:1.25rem">
          <h3 style="font-weight:700;margin-bottom:1rem">Recent Businesses</h3>
          ${(d.recent_businesses||[]).map(b=>`
            <div style="display:flex;align-items:center;gap:1rem;padding:.75rem 0;border-bottom:1px solid var(--clr-border);flex-wrap:wrap">
              <div style="flex:1;min-width:0">
                <div style="font-weight:600">${b.name}</div>
                <div style="font-size:.8rem;color:var(--clr-text-2)">${b.owner_email||''} · ${b.city||''}</div>
              </div>
              <span class="badge ${b.status==='active'?'badge--success':b.status==='pending'?'badge--warning':'badge--danger'}">${b.status}</span>
              ${b.status==='pending'?`
                <button class="btn btn--success btn--sm" onclick="approveBiz('${b.id}')">Approve</button>
                <button class="btn btn--danger btn--sm" onclick="rejectBiz('${b.id}')">Reject</button>
              `:''}
            </div>`).join('')}
        </div>`;
    } catch { document.getElementById('adminContent').innerHTML = '<p style="color:var(--clr-danger)">Failed to load.</p>'; }
  }

  async function pending() {
    try {
      const { businesses } = await API.get('/admin/businesses?status=pending&limit=50');
      document.getElementById('adminContent').innerHTML = `
        <div class="dashboard__header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem">
          <h1 class="dashboard__title">Pending Review <span class="badge badge--warning" style="font-size:1rem">${businesses.length}</span></h1>
          ${businesses.length > 1 ? `<button class="btn btn--success btn--sm" onclick="bulkApproveAll([${businesses.map(b=>`'${b.id}'`).join(',')}])"><i class="fa-solid fa-check-double"></i> Approve All (${businesses.length})</button>` : ''}
        </div>
        ${!businesses.length ? '<div class="card" style="padding:3rem;text-align:center"><div style="font-size:3rem;margin-bottom:1rem">✅</div><h3>All clear!</h3><p style="color:var(--clr-text-2)">No businesses pending review.</p></div>' :
        businesses.map(b=>`
          <div class="card" style="padding:1.25rem;margin-bottom:1rem">
            <div style="display:flex;align-items:flex-start;gap:1rem;flex-wrap:wrap">
              <div style="width:56px;height:56px;border-radius:10px;background:var(--clr-surface-2);display:flex;align-items:center;justify-content:center;font-size:1.5rem;flex-shrink:0">
                ${b.logo_url?`<img src="${b.logo_url}" style="width:100%;height:100%;object-fit:cover;border-radius:10px">`:(b.category_icon||'🏢')}
              </div>
              <div style="flex:1;min-width:0">
                <div style="font-weight:700;font-size:1rem;margin-bottom:.25rem">${b.name}</div>
                <div style="font-size:.85rem;color:var(--clr-text-2)">${b.category_name||''} · ${b.city||''}</div>
                <div style="font-size:.8rem;color:var(--clr-text-3);margin-top:.25rem">Owner: ${b.owner_email||'—'} · Submitted ${timeAgo(b.created_at)}</div>
                ${b.description?`<p style="font-size:.85rem;color:var(--clr-text-2);margin:.5rem 0 0;max-height:60px;overflow:hidden">${b.description}</p>`:''}
              </div>
              <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-self:flex-start">
                <a href="/pages/business.html?slug=${b.slug}" target="_blank" class="btn btn--ghost btn--sm"><i class="fa-solid fa-eye"></i> Preview</a>
                <button class="btn btn--success btn--sm" onclick="approveBiz('${b.id}')"><i class="fa-solid fa-check"></i> Approve</button>
                <button class="btn btn--danger btn--sm" onclick="rejectBiz('${b.id}')"><i class="fa-solid fa-xmark"></i> Reject</button>
              </div>
            </div>
          </div>`).join('')}`;
    } catch { document.getElementById('adminContent').innerHTML = '<p style="color:var(--clr-danger)">Failed to load.</p>'; }
  }

  async function businesses() {
    document.getElementById('adminContent').innerHTML = `
      <div class="dashboard__header"><h1 class="dashboard__title">All Businesses</h1></div>
      <div class="card" style="padding:1rem;margin-bottom:1rem;display:flex;gap:.75rem;flex-wrap:wrap">
        <input id="adminBizSearch" class="input" placeholder="Search…" style="flex:1;min-width:180px">
        <select id="adminBizStatus" class="input" style="width:150px">
          <option value="">All Status</option>
          ${['active','pending','suspended','rejected'].map(s=>`<option>${s}</option>`).join('')}
        </select>
        <button class="btn btn--primary btn--sm" onclick="loadAdminBizTable()"><i class="fa-solid fa-search"></i></button>
      </div>
      <div id="adminBizTable"><div class="skeleton" style="height:300px;border-radius:16px"></div></div>`;

    window.loadAdminBizTable = async (page=1) => {
      const qs = new URLSearchParams({ page, limit: 20 });
      const s = document.getElementById('adminBizSearch')?.value.trim();
      const st = document.getElementById('adminBizStatus')?.value;
      if(s) qs.set('search',s); if(st) qs.set('status',st);
      try {
        const { businesses, pagination } = await API.get(`/admin/businesses?${qs}`);
        document.getElementById('adminBizTable').innerHTML = `
          <div class="card" style="padding:0;overflow:hidden">
            <table style="width:100%;border-collapse:collapse;font-size:.85rem">
              <thead><tr style="background:var(--clr-surface-2);text-align:left">
                <th style="padding:.75rem 1rem">Business</th><th style="padding:.75rem 1rem">Status</th><th style="padding:.75rem 1rem">Actions</th>
              </tr></thead>
              <tbody>${businesses.map(b=>`
                <tr style="border-bottom:1px solid var(--clr-border)">
                  <td style="padding:.75rem 1rem"><div style="font-weight:600">${b.name}</div><div style="font-size:.75rem;color:var(--clr-text-3)">${b.owner_email||''}</div></td>
                  <td style="padding:.75rem 1rem"><span class="badge ${b.status==='active'?'badge--success':b.status==='pending'?'badge--warning':'badge--danger'}">${b.status}</span></td>
                  <td style="padding:.75rem 1rem;display:flex;gap:.4rem;flex-wrap:wrap">
                    ${b.status==='pending'?`<button class="btn btn--success btn--sm" onclick="approveBiz('${b.id}')">Approve</button><button class="btn btn--danger btn--sm" onclick="rejectBiz('${b.id}')">Reject</button>`:''}
                    ${b.status==='active'?`<button class="btn btn--ghost btn--sm" onclick="suspendBiz('${b.id}')">Suspend</button>`:''}
                    ${b.status==='active'?`<a href="/pages/business.html?slug=${b.slug}" target="_blank" class="btn btn--ghost btn--sm"><i class="fa-solid fa-eye"></i></a>`:''}
                    <button class="btn btn--ghost btn--sm" onclick="toggleFeatured('${b.id}',${!b.is_featured})">${b.is_featured?'Unfeature':'Feature'}</button>
                  </td>
                </tr>`).join('')}
              </tbody>
            </table>
            <div style="padding:1rem;display:flex;justify-content:center;gap:.5rem">
              ${pagination.page>1?`<button class="btn btn--ghost btn--sm" onclick="loadAdminBizTable(${pagination.page-1})">← Prev</button>`:''}
              <span style="padding:.4rem .75rem;color:var(--clr-text-2);font-size:.85rem">Page ${pagination.page} of ${Math.ceil(pagination.total/20)}</span>
              ${pagination.page*20<pagination.total?`<button class="btn btn--ghost btn--sm" onclick="loadAdminBizTable(${pagination.page+1})">Next →</button>`:''}
            </div>
          </div>`;
      } catch { document.getElementById('adminBizTable').innerHTML = '<p style="color:var(--clr-danger)">Failed to load.</p>'; }
    };
    document.getElementById('adminBizSearch').addEventListener('keydown', e => { if(e.key==='Enter') loadAdminBizTable(); });
    loadAdminBizTable();
  }

  async function users() {
    document.getElementById('adminContent').innerHTML = `
      <div class="dashboard__header"><h1 class="dashboard__title">Users</h1></div>
      <div class="card" style="padding:1rem;margin-bottom:1rem;display:flex;gap:.75rem;flex-wrap:wrap">
        <input id="adminUserSearch" class="input" placeholder="Search name or email…" style="flex:1;min-width:180px">
        <select id="adminUserRole" class="input" style="width:150px">
          <option value="">All Roles</option>
          ${['user','business_owner','creator'].map(r=>`<option>${r}</option>`).join('')}
        </select>
        <button class="btn btn--primary btn--sm" onclick="loadAdminUsersTable()"><i class="fa-solid fa-search"></i></button>
      </div>
      <div id="adminUsersTable"><div class="skeleton" style="height:300px;border-radius:16px"></div></div>`;

    window.loadAdminUsersTable = async (page=1) => {
      const qs = new URLSearchParams({ page, limit: 20 });
      const s = document.getElementById('adminUserSearch')?.value.trim();
      const r = document.getElementById('adminUserRole')?.value;
      if(s) qs.set('search',s); if(r) qs.set('role',r);
      try {
        const { users, pagination } = await API.get(`/admin/users?${qs}`);
        document.getElementById('adminUsersTable').innerHTML = `
          <div class="card" style="padding:0;overflow:hidden">
            <table style="width:100%;border-collapse:collapse;font-size:.85rem">
              <thead><tr style="background:var(--clr-surface-2);text-align:left">
                <th style="padding:.75rem 1rem">User</th><th style="padding:.75rem 1rem">Role</th><th style="padding:.75rem 1rem">Status</th><th style="padding:.75rem 1rem">Joined</th><th style="padding:.75rem 1rem">Actions</th>
              </tr></thead>
              <tbody>${users.map(u=>`
                <tr style="border-bottom:1px solid var(--clr-border)">
                  <td style="padding:.75rem 1rem"><div style="font-weight:600">${u.full_name||'—'}</div><div style="font-size:.75rem;color:var(--clr-text-3)">${u.email}</div></td>
                  <td style="padding:.75rem 1rem"><span class="badge">${u.role}</span></td>
                  <td style="padding:.75rem 1rem"><span class="badge ${u.is_banned?'badge--danger':u.is_active?'badge--success':'badge--warning'}">${u.is_banned?'Banned':u.is_active?'Active':'Inactive'}</span></td>
                  <td style="padding:.75rem 1rem;color:var(--clr-text-3);font-size:.8rem">${formatDate(u.created_at)}</td>
                  <td style="padding:.75rem 1rem">
                    <button class="btn btn--ghost btn--sm" onclick="adminToggleBan('${u.id}',${!u.is_banned})">${u.is_banned?'Unban':'Ban'}</button>
                  </td>
                </tr>`).join('')}
              </tbody>
            </table>
            <div style="padding:1rem;display:flex;justify-content:center;gap:.5rem">
              ${pagination.page>1?`<button class="btn btn--ghost btn--sm" onclick="loadAdminUsersTable(${pagination.page-1})">← Prev</button>`:''}
              <span style="padding:.4rem .75rem;color:var(--clr-text-2);font-size:.85rem">Page ${pagination.page}</span>
              ${pagination.page*20<pagination.total?`<button class="btn btn--ghost btn--sm" onclick="loadAdminUsersTable(${pagination.page+1})">Next →</button>`:''}
            </div>
          </div>`;
      } catch { document.getElementById('adminUsersTable').innerHTML = '<p style="color:var(--clr-danger)">Failed.</p>'; }
    };
    document.getElementById('adminUserSearch').addEventListener('keydown', e => { if(e.key==='Enter') loadAdminUsersTable(); });
    loadAdminUsersTable();
  }

  async function flagged() {
    document.getElementById('adminContent').innerHTML = `
      <div class="dashboard__header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem">
        <h1 class="dashboard__title">Flagged Reviews</h1>
      </div>
      <div id="flaggedList"><div class="skeleton" style="height:300px;border-radius:16px"></div></div>`;
    try {
      const { reviews } = await API.get('/reviews/flagged');
      const el = document.getElementById('flaggedList');
      if (!reviews.length) {
        el.innerHTML = `<div class="card" style="padding:3rem;text-align:center">
          <div style="font-size:3rem;margin-bottom:1rem">✅</div>
          <h3>No flagged reviews</h3>
          <p style="color:var(--clr-text-2)">All reviews are clean.</p></div>`;
        return;
      }
      el.innerHTML = reviews.map(r => `
        <div class="card" style="padding:1.25rem;margin-bottom:.75rem" id="flag-${r.id}">
          <div style="display:flex;align-items:flex-start;gap:1rem;flex-wrap:wrap">
            <div style="flex:1;min-width:200px">
              <div style="font-weight:600;margin-bottom:.25rem">${r.users?.full_name||'Anonymous'} <span style="color:var(--clr-text-3);font-size:.8rem">on</span> ${r.businesses?.name||'—'}</div>
              <div style="color:var(--clr-gold);margin-bottom:.4rem">${'★'.repeat(r.rating||0)}</div>
              <p style="font-size:.875rem;color:var(--clr-text-2);margin:0 0 .5rem">${r.content||'—'}</p>
              <div style="font-size:.78rem;padding:.35rem .6rem;background:rgba(239,68,68,.1);border-radius:6px;color:var(--clr-danger);display:inline-block">
                🚩 ${r.flag_reason||'Flagged by user'}
              </div>
            </div>
            <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:flex-start">
              <button class="btn btn--ghost btn--sm" onclick="unflagReview('${r.id}')">Clear Flag</button>
              <button class="btn btn--danger btn--sm" onclick="deleteReview('${r.id}')">Delete</button>
            </div>
          </div>
        </div>`).join('');

      window.unflagReview = async (id) => {
        try { await API.patch(`/reviews/${id}/unflag`); document.getElementById(`flag-${id}`)?.remove(); toast.success('Flag cleared'); }
        catch { toast.error('Failed'); }
      };
      window.deleteReview = async (id) => {
        if (!confirm('Permanently delete this review?')) return;
        try { await API.delete(`/reviews/${id}`); document.getElementById(`flag-${id}`)?.remove(); toast.success('Review deleted'); }
        catch { toast.error('Failed'); }
      };
    } catch { document.getElementById('flaggedList').innerHTML = '<p style="color:var(--clr-danger)">Failed to load.</p>'; }
  }

  async function verification() {
    document.getElementById('adminContent').innerHTML = `
      <div class="dashboard__header"><h1 class="dashboard__title">Business Verification</h1></div>
      <div id="verificationList"><div class="skeleton" style="height:300px;border-radius:16px"></div></div>`;
    try {
      const { requests } = await API.get('/verification/pending');
      const el = document.getElementById('verificationList');
      if (!requests.length) {
        el.innerHTML = `<div class="card" style="padding:3rem;text-align:center"><div style="font-size:3rem;margin-bottom:1rem">✅</div><h3>No pending requests</h3></div>`;
        return;
      }
      el.innerHTML = requests.map(r => `
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

      window.approveVerification = async (id) => {
        try { await API.patch(`/verification/${id}/approve`); document.getElementById(`verif-${id}`)?.remove(); toast.success('Business verified!'); }
        catch (e) { toast.error(e.message || 'Failed'); }
      };
      window.rejectVerification = async (id) => {
        const reason = prompt('Reason for rejection (shown to the business owner):') || '';
        try { await API.patch(`/verification/${id}/reject`, { reason }); document.getElementById(`verif-${id}`)?.remove(); toast.success('Request rejected'); }
        catch (e) { toast.error(e.message || 'Failed'); }
      };
    } catch { document.getElementById('verificationList').innerHTML = '<p style="color:var(--clr-danger)">Failed to load.</p>'; }
  }

  async function fraud() {
    document.getElementById('adminContent').innerHTML = `
      <div class="dashboard__header"><h1 class="dashboard__title">Fraud Flags</h1></div>
      <div id="fraudList"><div class="skeleton" style="height:300px;border-radius:16px"></div></div>`;
    try {
      const { flags } = await API.get('/fraud');
      const el = document.getElementById('fraudList');
      if (!flags.length) {
        el.innerHTML = `<div class="card" style="padding:3rem;text-align:center"><div style="font-size:3rem;margin-bottom:1rem">✅</div><h3>No open flags</h3></div>`;
        return;
      }
      const sevColor = { high: 'var(--clr-danger)', medium: 'var(--clr-warning)', low: 'var(--clr-text-3)' };
      el.innerHTML = flags.map(f => `
        <div class="card" style="padding:1.25rem;margin-bottom:.75rem" id="fraud-${f.id}">
          <div style="display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap">
            <div>
              <span class="badge" style="background:${sevColor[f.severity]}22;color:${sevColor[f.severity]}">${f.severity}</span>
              <span style="font-size:.8rem;color:var(--clr-text-3);margin-left:.5rem">${f.entity_type} · ${formatDate(f.created_at)}</span>
              <p style="margin:.4rem 0 0">${f.reason}</p>
            </div>
            <div style="display:flex;gap:.5rem;align-items:flex-start">
              <button class="btn btn--ghost btn--sm" onclick="reviewFraud('${f.id}','dismissed')">Dismiss</button>
              <button class="btn btn--danger btn--sm" onclick="reviewFraud('${f.id}','confirmed')">Confirm Issue</button>
            </div>
          </div>
        </div>`).join('');

      window.reviewFraud = async (id, status) => {
        try { await API.patch(`/fraud/${id}`, { status }); document.getElementById(`fraud-${id}`)?.remove(); toast.success('Updated'); }
        catch (e) { toast.error(e.message || 'Failed'); }
      };
    } catch { document.getElementById('fraudList').innerHTML = '<p style="color:var(--clr-danger)">Failed to load.</p>'; }
  }

  async function tickets() {
    document.getElementById('adminContent').innerHTML = `
      <div class="dashboard__header"><h1 class="dashboard__title">Support Tickets</h1></div>
      <div id="ticketsAdminList"><div class="skeleton" style="height:300px;border-radius:16px"></div></div>`;
    try {
      const { tickets: list } = await API.get('/support?status=open');
      const el = document.getElementById('ticketsAdminList');
      if (!list.length) {
        el.innerHTML = `<div class="card" style="padding:3rem;text-align:center"><div style="font-size:3rem;margin-bottom:1rem">✅</div><h3>No open tickets</h3></div>`;
        return;
      }
      el.innerHTML = list.map(t => `
        <div class="card" style="padding:1.1rem;margin-bottom:.6rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.5rem">
          <div>
            <strong>${t.subject}</strong>
            <div style="font-size:.8rem;color:var(--clr-text-2)">${t.users?.full_name || 'Guest'} · ${t.category} · ${formatDate(t.created_at)}</div>
          </div>
          <a href="/pages/support.html?id=${t.id}" class="btn btn--outline btn--sm">Open</a>
        </div>`).join('');
    } catch { document.getElementById('ticketsAdminList').innerHTML = '<p style="color:var(--clr-danger)">Failed to load.</p>'; }
  }

  // Shared actions
  window.bulkApproveAll = async (ids) => {
    if (!confirm(`Approve all ${ids.length} pending businesses?`)) return;
    let done = 0;
    for (const id of ids) {
      try { await API.patch(`/admin/businesses/${id}/status`, { status: 'active' }); done++; } catch {}
    }
    toast.success(`${done}/${ids.length} businesses approved!`);
    loadTab('pending');
  };
  window.approveBiz = async (id) => {
    try { await API.patch(`/admin/businesses/${id}/status`, { status: 'active' }); toast.success('Business approved! ✅'); loadTab('pending'); }
    catch(e) { toast.error(e.message||'Failed'); }
  };
  window.rejectBiz = async (id) => {
    const reason = prompt('Rejection reason:'); if(!reason) return;
    try { await API.patch(`/admin/businesses/${id}/status`, { status: 'rejected', reason }); toast.warning('Business rejected'); loadTab('pending'); }
    catch(e) { toast.error(e.message||'Failed'); }
  };
  window.suspendBiz = async (id) => {
    if (!confirm('Suspend this business?')) return;
    try { await API.patch(`/admin/businesses/${id}/status`, { status: 'suspended' }); toast.warning('Business suspended'); loadAdminBizTable?.(); }
    catch(e) { toast.error(e.message||'Failed'); }
  };
  window.toggleFeatured = async (id, val) => {
    try { await API.patch(`/admin/businesses/${id}/featured`, { is_featured: val }); toast.success(val?'Featured!':'Unfeatured'); loadAdminBizTable?.(); }
    catch { toast.error('Failed'); }
  };
  window.adminToggleBan = async (id, ban) => {
    if (!confirm(ban?'Ban this user?':'Unban this user?')) return;
    try { await API.patch(`/admin/users/${id}`, { is_banned: ban }); toast.success(ban?'User banned':'User unbanned'); loadAdminUsersTable?.(); }
    catch { toast.error('Failed'); }
  };
});