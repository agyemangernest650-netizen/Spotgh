// assets/js/main.js  (updated)

// ── Toast ──────────────────────────────────────────────────────────────────
window.toast = {
  show(msg, type = 'default', duration = 4000) {
    let c = document.getElementById('toastContainer');
    if (!c) { c = document.createElement('div'); c.id = 'toastContainer'; document.body.appendChild(c); }
    const icons = { success: '✓', error: '✕', warning: '⚠', default: 'ℹ', info: 'ℹ' };
    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.innerHTML = `<span>${icons[type] || 'ℹ'}</span><p>${msg}</p><button onclick="this.parentElement.remove()" aria-label="Close">✕</button>`;
    c.appendChild(el);
    if (duration > 0) setTimeout(() => el.remove(), duration);
    return el;
  },
  success: (m, d) => toast.show(m, 'success', d),
  error:   (m, d) => toast.show(m, 'error',   d),
  warning: (m, d) => toast.show(m, 'warning',  d),
  info:    (m, d) => toast.show(m, 'info',     d),
};

// ── Offline / Online detection ─────────────────────────────────────────────
window.addEventListener('offline', () => toast.error('You are offline. Some features may not work.', 0));
window.addEventListener('online',  () => toast.success('Back online!'));

// ── Button loading state ───────────────────────────────────────────────────
window.setLoading = (btn, loading, text = 'Loading...') => {
  if (!btn) return;
  if (loading) {
    btn._orig     = btn.innerHTML;
    btn.innerHTML = `<span class="spinner-sm"></span> ${text}`;
    btn.disabled  = true;
  } else {
    btn.innerHTML = btn._orig || btn.innerHTML;
    btn.disabled  = false;
  }
};

// ── Render a business card HTML string ────────────────────────────────────
// assets/js/main.js — PATCH: replace your existing renderBusinessCard with this version
// Tier-aware card rendering: enterprise gets a large feature treatment,
// pro gets a medium boost, starter/free render as the standard compact card.

// ── Open/closed status (shared by business cards + business detail page) ──
const OPEN_STATUS_DAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
window.getTodayHours = (hours) => {
  if (!hours) return null;
  const today = OPEN_STATUS_DAYS[new Date().getDay()];
  return hours[today] || null;
};
window.isOpenNow = (hours) => {
  const today = window.getTodayHours(hours);
  if (!today || today.closed || !today.open || !today.close) return false;
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const [oh, om] = today.open.split(':').map(Number);
  const [ch, cm] = today.close.split(':').map(Number);
  const openMins = oh * 60 + om, closeMins = ch * 60 + cm;
  return closeMins > openMins ? mins >= openMins && mins < closeMins : (mins >= openMins || mins < closeMins);
};
window.formatTime = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2,'0')} ${period}`;
};
window.openStatusBadge = (hours) => {
  if (!hours) return '';
  const open = window.isOpenNow(hours);
  const today = window.getTodayHours(hours);
  return `<span class="badge" style="background:${open?'rgba(43,138,62,.12)':'rgba(220,53,69,.12)'};color:${open?'#2B8A3E':'#DC3545'};font-weight:700">
    <i class="fa-solid fa-circle" style="font-size:.45rem;vertical-align:middle"></i>
    ${open ? `Open Now${today?.close ? ' · Closes '+window.formatTime(today.close) : ''}` : 'Closed'}
  </span>`;
};

// ── Save/favorite toggle (business cards) ──────────────────────────────────
window.toggleFavorite = async (btn, businessId) => {
  if (!Auth.getUser()) { window.location.href = '/pages/login.html'; return; }
  const saved = btn.classList.contains('is-saved');
  btn.disabled = true;
  try {
    if (saved) {
      await API.delete(`/user/favorites/${businessId}`);
      btn.classList.remove('is-saved');
      btn.querySelector('i').className = 'fa-regular fa-heart';
    } else {
      await API.post(`/user/favorites/${businessId}`, {});
      btn.classList.add('is-saved');
      btn.querySelector('i').className = 'fa-solid fa-heart';
    }
  } catch { toast.error('Could not update favourites. Please try again.'); }
  btn.disabled = false;
};

window.renderBusinessCard = (biz) => {
  const tier = biz.subscription_tier || 'free';

  // ── Enterprise: large hero-style card ───────────────────────────────────
  if (tier === 'enterprise') {
    return `
      <div class="card business-card business-card--enterprise" style="grid-column:span 2">
        <div class="business-card__img" style="aspect-ratio:21/9">
          ${biz.cover_url || biz.logo_url
            ? `<img src="${biz.cover_url || biz.logo_url}" alt="${biz.name}" loading="lazy">`
            : `<div class="biz-img-placeholder">${biz.category_icon || '🏢'}</div>`}
          <span class="badge-tier badge-tier--enterprise" title="Enterprise plan">👑 Enterprise</span>
          ${biz.is_verified ? '<span class="badge-verified" title="Verified Business">✓</span>' : ''}
          ${biz.is_top_rated ? '<span class="badge-top-rated" title="Top Rated">🏆</span>' : ''}
          ${biz.is_new ? '<span class="badge-new" title="New Business">✨</span>' : ''}
          <button class="business-card__save" onclick="event.preventDefault();toggleFavorite(this,'${biz.id}')" title="Save"><i class="fa-regular fa-heart"></i></button>
        </div>
        <div class="business-card__body" style="display:flex;align-items:flex-end;gap:1rem;flex-wrap:wrap">
          <div style="flex:1;min-width:200px">
            <div class="biz-category">${biz.category_icon || ''} ${biz.category_name || 'Business'}</div>
            <h3 class="biz-name" style="font-size:1.35rem"><a href="/pages/business.html?slug=${biz.slug}">${biz.name}</a></h3>
            ${biz.tagline ? `<p class="biz-tagline">${biz.tagline}</p>` : ''}
            <div class="biz-meta">
              <span class="biz-rating">${biz.avg_rating > 0
                ? `★ ${parseFloat(biz.avg_rating).toFixed(1)} <span style="color:var(--clr-text-3);font-size:.8rem">(${biz.review_count})</span>`
                : '<span style="opacity:.5;font-size:.8rem">New</span>'}</span>
              ${biz.city ? `<span class="biz-city">📍 ${biz.city}</span>` : ''}
            </div>
            ${biz.operating_hours ? `<div style="margin-top:.4rem">${window.openStatusBadge(biz.operating_hours)}</div>` : ''}
          </div>
          <div style="display:flex;gap:.5rem;flex-shrink:0">
            <a href="/pages/business.html?slug=${biz.slug}" class="btn btn--primary btn--sm">Visit Mini-Site</a>
            ${biz.phone ? `<a href="tel:${biz.phone}" class="btn btn--ghost btn--sm btn--icon" title="Call"><i class="fa-solid fa-phone"></i></a>` : ''}
            ${biz.whatsapp ? `<a href="https://wa.me/${biz.whatsapp.replace(/\D/g, '')}" class="btn btn--whatsapp btn--sm btn--icon" target="_blank" rel="noopener" title="WhatsApp"><i class="fab fa-whatsapp"></i></a>` : ''}
          </div>
        </div>
      </div>`;
  }

  // ── Pro: standard card with extra trust signals (gallery strip + rating emphasis) ──
  if (tier === 'pro') {
    return `
      <div class="card business-card business-card--pro">
        <div class="business-card__img">
          ${biz.cover_url || biz.logo_url
            ? `<img src="${biz.cover_url || biz.logo_url}" alt="${biz.name}" loading="lazy">`
            : `<div class="biz-img-placeholder">${biz.category_icon || '🏢'}</div>`}
          <span class="badge-tier badge-tier--pro" title="Pro plan">⚡ Pro</span>
          ${biz.is_verified ? '<span class="badge-verified" title="Verified Business">✓</span>' : ''}
          ${biz.is_top_rated ? '<span class="badge-top-rated" title="Top Rated">🏆</span>' : ''}
          ${biz.is_new ? '<span class="badge-new" title="New Business">✨</span>' : ''}
          <button class="business-card__save" onclick="event.preventDefault();toggleFavorite(this,'${biz.id}')" title="Save"><i class="fa-regular fa-heart"></i></button>
        </div>
        <div class="business-card__body">
          <div class="biz-category">${biz.category_icon || ''} ${biz.category_name || 'Business'}</div>
          <h3 class="biz-name"><a href="/pages/business.html?slug=${biz.slug}">${biz.name}</a></h3>
          ${biz.tagline ? `<p class="biz-tagline">${biz.tagline}</p>` : ''}
          <div class="biz-meta">
            <span class="biz-rating" style="font-weight:700">${biz.avg_rating > 0
              ? `★ ${parseFloat(biz.avg_rating).toFixed(1)} <span style="color:var(--clr-text-3);font-size:.8rem;font-weight:400">(${biz.review_count})</span>`
              : '<span style="opacity:.5;font-size:.8rem;font-weight:400">New</span>'}</span>
            ${biz.city ? `<span class="biz-city">📍 ${biz.city}</span>` : ''}
          </div>
          ${biz.operating_hours ? `<div style="margin-top:.4rem">${window.openStatusBadge(biz.operating_hours)}</div>` : ''}
        </div>
        <div class="business-card__actions">
          <a href="/pages/business.html?slug=${biz.slug}" class="btn btn--outline btn--sm" style="flex:1">View</a>
          ${biz.phone ? `<a href="tel:${biz.phone}" class="btn btn--ghost btn--sm btn--icon" title="Call"><i class="fa-solid fa-phone"></i></a>` : ''}
          ${biz.whatsapp ? `<a href="https://wa.me/${biz.whatsapp.replace(/\D/g, '')}" class="btn btn--whatsapp btn--sm btn--icon" target="_blank" rel="noopener" title="WhatsApp"><i class="fab fa-whatsapp"></i></a>` : ''}
        </div>
      </div>`;
  }

  // ── Starter / Free: standard compact card ───────────────────────────────
  return `
    <div class="card business-card">
      <div class="business-card__img">
        ${biz.cover_url || biz.logo_url
          ? `<img src="${biz.cover_url || biz.logo_url}" alt="${biz.name}" loading="lazy">`
          : `<div class="biz-img-placeholder">${biz.category_icon || '🏢'}</div>`}
        ${biz.is_featured ? '<span class="badge-featured">⭐ Featured</span>' : ''}
        ${biz.is_verified ? '<span class="badge-verified" title="Verified Business">✓</span>' : ''}
        ${biz.is_top_rated ? '<span class="badge-top-rated" title="Top Rated">🏆</span>' : ''}
        ${biz.is_new ? '<span class="badge-new" title="New Business">✨</span>' : ''}
        ${tier === 'starter' ? `<span class="badge-tier badge-tier--starter" title="Starter plan">🚀</span>` : ''}
        <button class="business-card__save" onclick="event.preventDefault();toggleFavorite(this,'${biz.id}')" title="Save"><i class="fa-regular fa-heart"></i></button>
      </div>
      <div class="business-card__body">
        <div class="biz-category">${biz.category_icon || ''} ${biz.category_name || 'Business'}</div>
        <h3 class="biz-name"><a href="/pages/business.html?slug=${biz.slug}">${biz.name}</a></h3>
        ${biz.tagline ? `<p class="biz-tagline">${biz.tagline}</p>` : ''}
        <div class="biz-meta">
          <span class="biz-rating">${biz.avg_rating > 0
            ? `★ ${parseFloat(biz.avg_rating).toFixed(1)} <span style="color:var(--clr-text-3);font-size:.8rem">(${biz.review_count})</span>`
            : '<span style="opacity:.5;font-size:.8rem">New</span>'}</span>
          ${biz.city ? `<span class="biz-city">📍 ${biz.city}</span>` : ''}
        </div>
        ${biz.operating_hours ? `<div style="margin-top:.4rem">${window.openStatusBadge(biz.operating_hours)}</div>` : ''}
      </div>
      <div class="business-card__actions">
        <a href="/pages/business.html?slug=${biz.slug}" class="btn btn--outline btn--sm" style="flex:1">View</a>
        ${biz.phone ? `<a href="tel:${biz.phone}" class="btn btn--ghost btn--sm btn--icon" title="Call"><i class="fa-solid fa-phone"></i></a>` : ''}
        ${biz.whatsapp ? `<a href="https://wa.me/${biz.whatsapp.replace(/\D/g, '')}" class="btn btn--whatsapp btn--sm btn--icon" target="_blank" rel="noopener" title="WhatsApp"><i class="fab fa-whatsapp"></i></a>` : ''}
      </div>
    </div>`;
};

// ── Render a grid of business cards (unchanged, included for completeness) ──
window.renderBusinessGrid = (containerId, businesses) => {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!businesses || !businesses.length) {
    el.innerHTML = '<p style="text-align:center;color:var(--clr-text-3);grid-column:1/-1;padding:2rem">No businesses found</p>';
    return;
  }
  el.innerHTML = businesses.map(renderBusinessCard).join('');
};

// ── Near Me search ────────────────────────────────────────────────────────
window.searchNearMe = () => {
  if (!navigator.geolocation) { toast.error('Geolocation not supported by your browser'); return; }
  const btn = document.querySelector('.near-me-btn');
  if (btn) btn.classList.add('loading');
  navigator.geolocation.getCurrentPosition(
    pos => {
      window.location.href = `/pages/directory.html?lat=${pos.coords.latitude.toFixed(6)}&lng=${pos.coords.longitude.toFixed(6)}`;
    },
    (err) => {
      const msgs = {
        1: 'Location access denied. Please allow location in your browser settings.',
        2: 'Location unavailable. Try again.',
        3: 'Location request timed out.',
      };
      toast.error(msgs[err.code] || 'Could not get location.');
      if (btn) btn.classList.remove('loading');
    },
    { timeout: 8000, maximumAge: 60000 }
  );
};

// ── Format helpers ────────────────────────────────────────────────────────
window.formatCurrency = (n, c = 'GHS') => {
  if (n == null || isNaN(n)) return '—';
  return new Intl.NumberFormat('en-GH', { style: 'currency', currency: c, minimumFractionDigits: 2 }).format(n);
};
// Shared across orders.js, business-orders.js, and track-order.js — was
// previously three separate copies of the same status-color mapping,
// each hand-rolling inline styles instead of using the existing .badge
// class system already used everywhere else in the app.
window.orderStatusBadge = (status) => {
  const variant = { pending: 'warning', confirmed: 'primary', preparing: 'primary', ready: 'primary', delivered: 'success', completed: 'success', cancelled: 'danger' }[status] || 'ghost';
  return `<span class="badge badge--${variant}" style="text-transform:capitalize">${status}</span>`;
};
window.emptyState = ({ icon = '📭', title, subtitle = '', actionHtml = '' }) => `
  <div style="text-align:center;padding:3rem 1.5rem">
    <div style="font-size:2.5rem;margin-bottom:1rem">${icon}</div>
    <h3 style="font-weight:700;margin-bottom:.4rem">${title}</h3>
    ${subtitle ? `<p style="color:var(--clr-text-2);font-size:.9rem;margin-bottom:1rem">${subtitle}</p>` : ''}
    ${actionHtml}
  </div>`;
window.formatDate = d => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' });
};
window.timeAgo = d => {
  if (!d) return '';
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60)     return 'just now';
  if (s < 3600)   return Math.floor(s / 60) + 'm ago';
  if (s < 86400)  return Math.floor(s / 3600) + 'h ago';
  if (s < 604800) return Math.floor(s / 86400) + 'd ago';
  return formatDate(d);
};
window.renderStars = r => {
  const n = Math.round(Math.min(Math.max(r, 0), 5));
  return '★'.repeat(n) + '☆'.repeat(5 - n);
};

// ── Share helper ──────────────────────────────────────────────────────────
window.shareUrl = async (title, text, url = location.href) => {
  if (navigator.share) {
    try { await navigator.share({ title, text, url }); return; } catch {}
  }
  try { await navigator.clipboard.writeText(url); toast.success('Link copied to clipboard!'); }
  catch { toast.error('Could not copy link'); }
};

// ── Load common UI components ─────────────────────────────────────────────
window.loadComponents = () => {
  const user = Auth.getUser();

  // ── Mobile bottom nav (Home / Categories / Add Business / Deals / Profile) ──
  // Injected once, on every page, rather than hand-edited into 46 HTML files.
  if (!document.getElementById('mobileBottomNav')) {
    const path = location.pathname;
    const isActive = (p) => path === p ? 'is-active' : '';
    const profileHref = user ? '/pages/profile.html' : '/pages/login.html';
    const nav = document.createElement('nav');
    nav.id = 'mobileBottomNav';
    nav.className = 'mobile-bottom-nav';
    nav.innerHTML = `
      <a href="/" class="mobile-bottom-nav__item ${isActive('/')}"><i class="fa-solid fa-house"></i><span>Home</span></a>
      <a href="/pages/categories.html" class="mobile-bottom-nav__item ${isActive('/pages/categories.html')}"><i class="fa-solid fa-grip"></i><span>Categories</span></a>
      <a href="/pages/dashboard.html?action=add-business" class="mobile-bottom-nav__item mobile-bottom-nav__item--cta"><i class="fa-solid fa-plus"></i></a>
      <a href="/pages/deals.html" class="mobile-bottom-nav__item ${isActive('/pages/deals.html')}"><i class="fa-solid fa-tag"></i><span>Deals</span></a>
      <a href="${profileHref}" class="mobile-bottom-nav__item ${isActive(profileHref)}"><i class="fa-solid fa-user"></i><span>Profile</span></a>`;
    document.body.appendChild(nav);
  }

  // ── Navbar auth area
  const authNav = document.getElementById('authNav');
  if (authNav) {
    authNav.innerHTML = user
      ? `<div class="user-menu-wrap" style="display:flex;align-items:center;gap:.5rem">
           <!-- Notification Bell -->
           <div style="position:relative" id="notifWrap">
             <button id="notifBtn" title="Notifications" style="position:relative;background:none;border:none;cursor:pointer;color:var(--clr-text-1);font-size:1.1rem;padding:.4rem;border-radius:var(--radius-md)">
               <i class="fa-regular fa-bell"></i>
               <span id="notifBadge" hidden style="position:absolute;top:2px;right:2px;width:8px;height:8px;border-radius:50%;background:var(--clr-danger);border:2px solid var(--clr-surface-1)"></span>
             </button>
             <div id="notifDropdown" hidden style="position:absolute;right:0;top:calc(100% + 8px);width:320px;background:var(--clr-surface-1);border:1px solid var(--clr-border);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);z-index:9999;max-height:400px;overflow-y:auto">
               <div style="padding:.75rem 1rem;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--clr-border)">
                 <span style="font-weight:700;font-size:.9rem">Notifications</span>
                 <button onclick="markAllNotifsRead()" style="background:none;border:none;cursor:pointer;font-size:.75rem;color:var(--clr-primary)">Mark all read</button>
               </div>
               <div id="notifList"><div style="padding:1rem;text-align:center;color:var(--clr-text-3);font-size:.85rem">Loading…</div></div>
             </div>
           </div>
           <div class="user-menu-wrap">
             <button class="user-menu-btn" id="userMenuBtn" aria-expanded="false" aria-haspopup="true">
             <div class="user-avatar">${user.avatar_url
               ? `<img src="${user.avatar_url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" alt="${user.full_name}">`
               : (user.full_name || 'U')[0].toUpperCase()}</div>
             <span class="hidden-mobile">${(user.full_name || '').split(' ')[0]}</span>
             <i class="fa-solid fa-chevron-down" style="font-size:.7rem"></i>
           </button>
           <div class="user-dropdown" id="userDropdown" hidden role="menu">
             <div class="dropdown-header">
               <p style="font-weight:700">${user.full_name}</p>
               <p style="font-size:.75rem;opacity:.6">${user.email}</p>
             </div>
             <a href="/pages/dashboard.html" role="menuitem"><i class="fa-solid fa-gauge"></i> Dashboard</a>
             <a href="/pages/orders.html" role="menuitem"><i class="fa-solid fa-bag-shopping"></i> My Orders</a>
             <a href="/pages/profile.html" role="menuitem"><i class="fa-solid fa-user"></i> Profile</a>
             ${user.role === 'creator' ? '<a href="/pages/admin.html" role="menuitem"><i class="fa-solid fa-shield"></i> Admin</a>' : ''}
             ${user.role === 'creator' ? '<a href="/pages/creator.html" role="menuitem"><i class="fa-solid fa-crown"></i> Creator</a>' : ''}
             <a href="/pages/payment-history.html" role="menuitem"><i class="fa-solid fa-receipt"></i> Payment History</a>
             <button onclick="Auth.logout()" style="color:var(--clr-danger)" role="menuitem"><i class="fa-solid fa-right-from-bracket"></i> Logout</button>
           </div>
         </div>
       </div>`
      : `<a href="/pages/login.html" class="btn btn--ghost btn--sm hidden-mobile">Login</a>
         <a href="/pages/register.html" class="btn btn--primary btn--sm">List Business</a>`;

    const menuBtn  = document.getElementById('userMenuBtn');
    const dropdown = document.getElementById('userDropdown');
    menuBtn?.addEventListener('click', e => {
      e.stopPropagation();
      const open = dropdown.hidden;
      dropdown.hidden = !open;
      menuBtn.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', () => {
      if (dropdown) { dropdown.hidden = true; menuBtn?.setAttribute('aria-expanded', 'false'); }
    });
    // Keyboard nav
    dropdown?.addEventListener('keydown', e => {
      if (e.key === 'Escape') { dropdown.hidden = true; menuBtn?.focus(); }
    });

    // ── Notification Bell
    if (user) {
      const notifBtn = document.getElementById('notifBtn');
      const notifDropdown = document.getElementById('notifDropdown');
      let notifsLoaded = false;

      notifBtn?.addEventListener('click', async e => {
        e.stopPropagation();
        notifDropdown.hidden = !notifDropdown.hidden;
        if (!notifDropdown.hidden && !notifsLoaded) {
          notifsLoaded = true;
          try {
            const { notifications } = await API.get('/user/notifications');
            const list = document.getElementById('notifList');
            if (!notifications.length) {
              list.innerHTML = '<div style="padding:1.5rem;text-align:center;color:var(--clr-text-3);font-size:.85rem">All caught up! 🎉</div>';
            } else {
              list.innerHTML = notifications.map(n => `
                <div onclick="goNotif('${n.id}','${n.link||''}',this)" style="padding:.75rem 1rem;border-bottom:1px solid var(--clr-border);cursor:pointer;background:${n.is_read?'transparent':'var(--clr-primary-10)'};display:flex;gap:.75rem;align-items:flex-start" class="notif-item">
                  <span style="font-size:1.1rem;flex-shrink:0">${n.type==='success'?'✅':n.type==='warning'?'⚠️':n.type==='error'?'❌':'ℹ️'}</span>
                  <div style="flex:1;min-width:0">
                    <div style="font-size:.85rem;font-weight:600;margin-bottom:.2rem">${n.title}</div>
                    <div style="font-size:.78rem;color:var(--clr-text-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${n.body||''}</div>
                    <div style="font-size:.7rem;color:var(--clr-text-3);margin-top:.2rem">${timeAgo(n.created_at)}</div>
                  </div>
                </div>`).join('');
              // Update badge
              const unread = notifications.filter(n => !n.is_read).length;
              const badge = document.getElementById('notifBadge');
              if (badge) badge.hidden = unread === 0;
            }
          } catch { document.getElementById('notifList').innerHTML = '<div style="padding:1rem;text-align:center;color:var(--clr-danger);font-size:.85rem">Failed to load</div>'; }
        }
      });

      // Load unread count on mount
      API.get('/user/notifications').then(({ notifications }) => {
        const unread = (notifications||[]).filter(n => !n.is_read).length;
        const badge = document.getElementById('notifBadge');
        if (badge && unread > 0) badge.hidden = false;
      }).catch(() => {});

      window.goNotif = async (id, link, el) => {
        el.style.background = 'transparent';
        await API.patch(`/user/notifications/${id}/read`).catch(() => {});
        notifDropdown.hidden = true;
        if (link) window.location.href = link;
      };
      window.markAllNotifsRead = async () => {
        try {
          await API.patch('/user/notifications/read-all');
          document.querySelectorAll('.notif-item').forEach(el => el.style.background = 'transparent');
          const badge = document.getElementById('notifBadge');
          if (badge) badge.hidden = true;
          toast.success('All marked as read');
        } catch { toast.error('Failed'); }
      };

      document.addEventListener('click', () => { if (notifDropdown) notifDropdown.hidden = true; });
      notifDropdown?.addEventListener('click', e => e.stopPropagation());
    }
  }

  // ── Mobile auth links
  const mobileAuthLinks = document.getElementById('mobileAuthLinks');
  if (mobileAuthLinks) {
    mobileAuthLinks.innerHTML = user
      ? `<a href="/pages/dashboard.html">Dashboard</a><button onclick="Auth.logout()">Logout</button>`
      : `<a href="/pages/login.html">Login</a><a href="/pages/register.html">Register Free</a>`;
  }

  // ── Hamburger menu
  const ham = document.getElementById('hamburger');
  const mob = document.getElementById('mobileMenu');
  ham?.addEventListener('click', () => {
    const open = mob?.hidden !== false;
    if (mob) mob.hidden = !open;
    ham.classList.toggle('active', open);
    ham.setAttribute('aria-expanded', String(open));
  });

  // ── Move language + theme controls into the mobile menu (hidden from the
  // top navbar row on mobile so that row never overflows on narrow phones)
  if (mob && !document.getElementById('mobileMenuControls')) {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const row = document.createElement('div');
    row.id = 'mobileMenuControls';
    row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:.75rem;padding:.75rem 0;border-top:1px solid var(--clr-border);margin-top:.75rem';
    row.innerHTML = `
      <select id="mobileLangSwitcher" onchange="setLanguage(this.value)" style="background:none;border:1px solid var(--clr-border);border-radius:8px;padding:.4rem .5rem;font-size:.85rem;color:var(--clr-text-2)"><option value="en">EN</option></select>
      <button type="button" onclick="toggleTheme()" style="background:var(--clr-surface-2);border:1.5px solid var(--clr-border);border-radius:var(--radius-md);width:38px;height:38px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--clr-text-2)"><i class="fa-solid ${isDark ? 'fa-sun' : 'fa-moon'}"></i></button>`;
    mob.appendChild(row);
  }

  // ── Mobile search
  const mobileSearch = document.getElementById('mobileSearch');
  mobileSearch?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.value.trim()) {
      window.location.href = `/pages/directory.html?q=${encodeURIComponent(e.target.value.trim())}`;
    }
  });

  // ── Scroll to top button
  const scrollBtn = document.getElementById('scrollTopBtn');
  if (scrollBtn) {
    window.addEventListener('scroll', () => {
      scrollBtn.classList.toggle('visible', window.scrollY > 400);
    }, { passive: true });
    scrollBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  // ── Navbar scroll shadow
  window.addEventListener('scroll', () => {
    document.getElementById('navbar')?.classList.toggle('scrolled', window.scrollY > 10);
  }, { passive: true });

  // ── Animated counters
  const counterObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !entry.target.dataset.counted) {
        entry.target.dataset.counted = '1';
        const target = parseInt(entry.target.dataset.target || '0');
        const suffix = entry.target.dataset.suffix || '+';
        let cur = 0;
        const step = Math.ceil(target / 60);
        const timer = setInterval(() => {
          cur = Math.min(cur + step, target);
          entry.target.textContent = cur.toLocaleString() + suffix;
          if (cur >= target) clearInterval(timer);
        }, 20);
      }
    });
  }, { threshold: 0.5 });
  document.querySelectorAll('[data-target]').forEach(el => counterObserver.observe(el));

  // ── Service Worker (PWA)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  // ── PWA install banner
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    window._pwaPrompt = e;
    if (!localStorage.getItem('pwa_dismissed')) {
      setTimeout(showPWABanner, 3000);
    }
  });

  // ── Navbar search autocomplete
  let searchDebounce;
  const navSearch = document.getElementById('navSearch');
  const navSug    = document.getElementById('navSuggestions');
  if (navSearch && navSug) {
    navSearch.addEventListener('input', e => {
      clearTimeout(searchDebounce);
      const q = e.target.value.trim();
      if (q.length < 2) { navSug.hidden = true; return; }
      searchDebounce = setTimeout(async () => {
        try {
          const data = await API.get(`/search/autocomplete?q=${encodeURIComponent(q)}`);
          const items = [
            ...(data.businesses || []).map(b =>
              `<a href="/pages/business.html?slug=${b.slug}" class="suggestion-item">
                 ${b.logo_url ? `<img src="${b.logo_url}" style="width:28px;height:28px;border-radius:4px;object-fit:cover" alt="">` : '<span style="font-size:1.2rem">🏢</span>'}
                 <span>${b.name}</span><small>${b.city || ''}</small>
               </a>`),
            ...(data.categories || []).map(c =>
              `<a href="/pages/directory.html?category=${c.slug}" class="suggestion-item">
                 <span>${c.icon}</span><span>${c.name}</span><small>Category</small>
               </a>`),
          ];
          navSug.innerHTML = items.length
            ? items.join('')
            : '<div class="suggestion-item" style="color:var(--clr-text-3);pointer-events:none">No results found</div>';
          navSug.hidden = false;
        } catch {
          navSug.hidden = true;
        }
      }, 300);
    });

    navSearch.addEventListener('keydown', e => {
      if (e.key === 'Enter' && navSearch.value.trim()) {
        navSug.hidden = true;
        window.location.href = `/pages/directory.html?q=${encodeURIComponent(navSearch.value.trim())}`;
      }
    });

    document.addEventListener('click', e => {
      if (!e.target.closest('#navSearch') && !e.target.closest('#navSuggestions')) {
        navSug.hidden = true;
      }
    });
  }

  // ── Floating Help widget ──────────────────────────────────────────────
  // Deliberately NOT labeled "Live Chat" — there's no real-time agent on
  // the other end. This is self-serve first (searches the same guides as
  // the Help Centre) with a fallback that files a real support ticket
  // through the existing ticket system, so it doesn't over-promise.
  if (!document.getElementById('helpWidget')) {
    const HELP_TOPICS = [
      { q: 'create a listing', a: 'From your dashboard, choose "Add Business", pick a category, and walk through the short wizard. Your listing goes live after a quick review.', link: '/pages/help.html' },
      { q: 'upgrade my plan', a: 'Head to the Pricing page, or use "Upgrade Plan" on your dashboard. Tell us whether you already have a website — it changes your price.', link: '/pages/pricing.html' },
      { q: 'connect my website', a: 'When creating a listing (or on the pricing page), choose "I already have a website" and enter its URL — you\'ll pay less than the mini-website plan.', link: '/pages/help.html' },
      { q: 'edit my business', a: 'Go to Dashboard → your business → Edit to update photos, hours, description, and more.', link: '/pages/help.html' },
      { q: 'ai tools', a: 'AI can draft a business description or meta title/description for you — you always review and edit before it\'s saved.', link: '/pages/help.html' },
      { q: 'refund', a: 'See our Refund Policy for what qualifies and how to request one.', link: '/pages/refund-policy.html' },
    ];
    const widget = document.createElement('div');
    widget.id = 'helpWidget';
    widget.innerHTML = `
      <button id="helpWidgetBtn" aria-label="Help" style="position:fixed;top:calc(var(--navbar-h) + .6rem);right:1rem;z-index:9998;width:38px;height:38px;border-radius:50%;background:var(--clr-primary);color:#fff;border:none;box-shadow:var(--shadow-lg,0 8px 24px rgba(0,0,0,.2));cursor:pointer;font-size:.95rem;display:flex;align-items:center;justify-content:center">
        <i class="fa-solid fa-comment-dots"></i>
      </button>
      <div id="helpWidgetPanel" style="display:none;position:fixed;top:calc(var(--navbar-h) + 3.1rem);right:1rem;z-index:9998;width:min(320px,calc(100vw - 2rem));max-height:min(60vh,420px);background:var(--clr-surface-1);border:1px solid var(--clr-border);border-radius:var(--radius-lg,16px);box-shadow:var(--shadow-lg,0 8px 24px rgba(0,0,0,.25));flex-direction:column;overflow:hidden">
        <div style="background:var(--clr-primary);color:#fff;padding:.9rem 1.1rem;position:relative">
          <button id="helpWidgetClose" aria-label="Close" style="position:absolute;top:.6rem;right:.6rem;width:26px;height:26px;border-radius:50%;background:rgba(255,255,255,.2);color:#fff;border:none;font-size:1.1rem;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;font-weight:400">&times;</button>
          <div style="font-weight:700;font-size:.9rem;padding-right:1.75rem">Need a hand?</div>
          <div style="font-size:.72rem;opacity:.85">Ask below, or browse our guides. Not a live agent — replies come by email.</div>
        </div>
        <div style="padding:.85rem;overflow-y:auto;flex:1">
          <input id="helpWidgetInput" type="text" placeholder="Try 'upgrade plan', 'connect website'…" style="width:100%;padding:.6rem .75rem;border-radius:8px;border:1px solid var(--clr-border);background:var(--clr-surface-2);color:var(--clr-text-1);font-size:.85rem;margin-bottom:.75rem">
          <div id="helpWidgetResults" style="display:flex;flex-direction:column;gap:.5rem"></div>
          <div id="helpWidgetFallback" hidden style="margin-top:.5rem;border-top:1px solid var(--clr-border);padding-top:.75rem">
            <p style="font-size:.78rem;color:var(--clr-text-3);margin-bottom:.5rem">Didn't find it? Send us a message and we'll reply by email.</p>
            <textarea id="helpWidgetMsg" rows="3" placeholder="What do you need help with?" style="width:100%;padding:.6rem .75rem;border-radius:8px;border:1px solid var(--clr-border);background:var(--clr-surface-2);color:var(--clr-text-1);font-size:.85rem;margin-bottom:.5rem"></textarea>
            <button id="helpWidgetSend" class="btn btn--primary btn--sm" style="width:100%">Send Message</button>
          </div>
        </div>
        <a href="/pages/help.html" style="display:block;text-align:center;padding:.7rem;font-size:.78rem;color:var(--clr-primary);border-top:1px solid var(--clr-border)">Open full Help Centre →</a>
      </div>`;
    document.body.appendChild(widget);

    const btn = document.getElementById('helpWidgetBtn');
    const panel = document.getElementById('helpWidgetPanel');
    const input = document.getElementById('helpWidgetInput');
    const results = document.getElementById('helpWidgetResults');
    const fallback = document.getElementById('helpWidgetFallback');

    const renderTopics = (list) => {
      results.innerHTML = list.map(t => `<a href="${t.link}" style="display:block;padding:.6rem .75rem;background:var(--clr-surface-2);border-radius:8px;font-size:.82rem;text-decoration:none;color:var(--clr-text-1)"><strong style="text-transform:capitalize">${t.q}</strong><div style="color:var(--clr-text-3);font-size:.76rem;margin-top:.2rem">${t.a}</div></a>`).join('');
      fallback.hidden = list.length > 0;
    };
    renderTopics(HELP_TOPICS.slice(0, 3));

    const isPanelOpen = () => panel.style.display === 'flex';
    const openPanel = () => { panel.style.display = 'flex'; input.focus(); };
    const closePanel = () => { panel.style.display = 'none'; };

    btn.addEventListener('click', () => { isPanelOpen() ? closePanel() : openPanel(); });
    document.getElementById('helpWidgetClose').addEventListener('click', closePanel);
    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      const matches = q ? HELP_TOPICS.filter(t => t.q.includes(q) || t.a.toLowerCase().includes(q)) : HELP_TOPICS.slice(0, 3);
      renderTopics(matches);
    });
    document.getElementById('helpWidgetSend').addEventListener('click', async (e) => {
      const msgEl = document.getElementById('helpWidgetMsg');
      const message = msgEl.value.trim();
      if (!message) return;
      const body = { subject: `Help widget: ${input.value.trim() || 'General question'}`, category: 'general', message };
      if (!Auth.isLoggedIn()) {
        const email = prompt('What email should we reply to?');
        if (!email) return;
        body.guest_email = email;
      }
      setLoading(e.currentTarget, true, 'Sending…');
      try {
        await API.post('/support', body);
        toast.success("Sent — we'll reply by email.");
        msgEl.value = '';
        closePanel();
      } catch (err) { toast.error(err.message || 'Could not send — try the Help Centre instead.'); }
      finally { setLoading(e.currentTarget, false); }
    });
    document.addEventListener('click', (e) => {
      if (isPanelOpen() && !e.target.closest('#helpWidget')) closePanel();
    });
  }
};

// ── PWA Banner ─────────────────────────────────────────────────────────────
function showPWABanner() {
  if (document.querySelector('.pwa-banner')) return;
  const b = document.createElement('div');
  b.className = 'pwa-banner';
  b.innerHTML = `
    <span style="font-size:2rem">📱</span>
    <div class="pwa-banner__text">
      <strong>Install SpotGH</strong>
      <span>Add to your home screen for quick access</span>
    </div>
    <button class="btn btn--primary btn--sm" id="pwaInstallBtn">Install</button>
    <button class="btn btn--ghost btn--sm" id="pwaDismissBtn" style="color:white;border-color:rgba(255,255,255,.4)">Later</button>`;
  document.body.appendChild(b);
  document.getElementById('pwaInstallBtn').onclick = async () => { await window.triggerPWAInstall(); b.remove(); };
  document.getElementById('pwaDismissBtn').onclick = () => {
    b.remove();
    localStorage.setItem('pwa_dismissed', '1');
  };
}

// Shared install trigger — used by the passive homepage banner above and
// by the explicit "Download App" button in the admin/dashboard panels.
// beforeinstallprompt only exists on Chromium browsers (Chrome, Edge,
// Android); iOS Safari and desktop Safari/Firefox never fire it at all,
// so those need their own guidance rather than silently doing nothing.
window.triggerPWAInstall = async () => {
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  if (isStandalone) { toast.show('SpotGH is already installed on this device.', 'default', 4000); return; }

  if (window._pwaPrompt) {
    const result = await window._pwaPrompt.prompt();
    window._pwaPrompt = null;
    if (result?.outcome === 'accepted') toast.success('SpotGH installed!');
    return;
  }

  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
  if (isIOS) {
    toast.show('On iPhone/iPad: tap the Share icon, then "Add to Home Screen".', 'default', 7000);
    return;
  }
  toast.show('App install isn\'t available in this browser yet — try Chrome, Edge, or Android.', 'default', 6000);
};

// ── Onboarding tour ────────────────────────────────────────────────────────
window.startTour = (steps) => {
  if (!steps || !steps.length) return;
  if (localStorage.getItem('sgh_tour_done')) return;
  let i = 0;
  const overlay = document.createElement('div');
  overlay.className = 'tour-overlay';
  document.body.appendChild(overlay);
  const tooltip = document.createElement('div');
  tooltip.className = 'tour-tooltip';
  document.body.appendChild(tooltip);

  const render = () => {
    const s  = steps[i];
    const el = document.querySelector(s.target);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.style.outline      = '3px solid var(--clr-primary)';
      el.style.borderRadius = 'var(--radius-md)';
      el.style.position     = 'relative';
      el.style.zIndex       = '9001';
    }
    tooltip.innerHTML = `
      <div class="tour-step">Step ${i + 1} of ${steps.length}</div>
      <div class="tour-dots">${steps.map((_, j) => `<span class="tour-dot ${j === i ? 'active' : ''}"></span>`).join('')}</div>
      <h4 style="margin-bottom:.5rem">${s.title}</h4>
      <p style="font-size:.875rem;color:var(--clr-text-2);margin-bottom:1rem">${s.text}</p>
      <div style="display:flex;gap:.5rem;justify-content:flex-end">
        <button class="btn btn--ghost btn--sm" id="tourSkip">Skip</button>
        ${i > 0 ? '<button class="btn btn--ghost btn--sm" id="tourBack">Back</button>' : ''}
        <button class="btn btn--primary btn--sm" id="tourNext">${i === steps.length - 1 ? 'Finish 🎉' : 'Next'}</button>
      </div>`;

    if (el) {
      const rect = el.getBoundingClientRect();
      tooltip.style.cssText = `position:fixed;top:${Math.min(rect.bottom + 12, window.innerHeight - 200)}px;left:${Math.max(12, Math.min(rect.left, window.innerWidth - 340))}px;z-index:9001`;
    } else {
      tooltip.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9001';
    }

    const cleanup = () => {
      if (el) { el.style.outline = ''; el.style.zIndex = ''; el.style.position = ''; }
    };
    document.getElementById('tourSkip').onclick  = () => { cleanup(); endTour(false); };
    document.getElementById('tourNext').onclick  = () => { cleanup(); i === steps.length - 1 ? endTour(true) : (i++, render()); };
    document.getElementById('tourBack')?.addEventListener('click', () => { cleanup(); i--; render(); });
  };

  render();

  function endTour(done = false) {
    overlay.remove();
    tooltip.remove();
    localStorage.setItem('sgh_tour_done', '1');
    if (done) toast.success('Tour complete! You\'re all set 🎉');
  }
};
