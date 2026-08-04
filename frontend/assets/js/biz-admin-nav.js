// assets/js/biz-admin-nav.js
// Shared sub-nav for a single business's website-management pages, so
// owners can move between Edit/Gallery/Products/Bookings/Orders/Analytics
// without bouncing back to the dashboard every time. Include this script
// after api.js, then call window.renderBizAdminNav(containerId, bizId, activeKey).

const BIZ_ADMIN_TABS = [
  { key: 'edit',      label: 'Overview',  icon: 'fa-pen',            href: 'business-edit.html' },
  { key: 'gallery',   label: 'Gallery',   icon: 'fa-images',         href: 'gallery.html' },
  { key: 'products',  label: 'Products',  icon: 'fa-box',            href: 'products.html' },
  { key: 'bookings',  label: 'Bookings',  icon: 'fa-calendar',       href: 'bookings.html' },
  { key: 'orders',    label: 'Orders',    icon: 'fa-bag-shopping',   href: 'business-orders.html' },
  { key: 'analytics', label: 'Analytics', icon: 'fa-chart-line',     href: 'analytics.html' },
];

window.renderBizAdminNav = async (containerId, bizId, activeKey) => {
  const container = document.getElementById(containerId);
  if (!container || !bizId) return;

  let biz = null;
  try { ({ business: biz } = await API.get(`/businesses/${bizId}`)); } catch {}

  container.innerHTML = `
    <div style="margin-bottom:1.5rem">
      <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:1rem;flex-wrap:wrap">
        <a href="/dashboard?tab=businesses" class="btn btn--ghost btn--sm"><i class="fa-solid fa-arrow-left"></i></a>
        ${biz?.logo_url
          ? `<img src="${biz.logo_url}" style="width:36px;height:36px;border-radius:8px;object-fit:cover">`
          : `<div style="width:36px;height:36px;border-radius:8px;background:var(--clr-surface-2);display:flex;align-items:center;justify-content:center;font-size:1.1rem">${biz?.category_icon || '🏢'}</div>`}
        <div>
          <div style="font-weight:700;font-size:1rem;line-height:1.2">${biz?.name || 'Manage Business'}</div>
          ${biz?.status ? `<span class="badge ${biz.status==='active'?'badge--success':biz.status==='pending'?'badge--warning':'badge--danger'}" style="font-size:.68rem">${biz.status}</span>` : ''}
        </div>
      </div>
      <div style="display:flex;gap:.4rem;overflow-x:auto;padding-bottom:.25rem;border-bottom:1px solid var(--clr-border)">
        ${BIZ_ADMIN_TABS.map(t => `
          <a href="/pages/${t.href}?id=${bizId}" style="flex-shrink:0;display:flex;align-items:center;gap:.4rem;padding:.55rem .9rem;border-radius:8px 8px 0 0;font-size:.82rem;font-weight:600;white-space:nowrap;text-decoration:none;
            ${t.key === activeKey ? 'background:var(--clr-primary-10);color:var(--clr-primary);border-bottom:2px solid var(--clr-primary);margin-bottom:-1px' : 'color:var(--clr-text-2)'}">
            <i class="fa-solid ${t.icon}"></i> ${t.label}
          </a>`).join('')}
      </div>
    </div>`;
};
