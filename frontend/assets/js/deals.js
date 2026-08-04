// assets/js/deals.js
document.addEventListener('DOMContentLoaded', async () => {
  loadComponents();

  document.getElementById('pageMain').innerHTML = `
    <div class="container" style="padding:2rem 1rem 4rem">
      <div style="text-align:center;margin-bottom:2.5rem">
        <h1 style="font-size:clamp(1.75rem,5vw,3rem);font-weight:800;margin-bottom:.5rem">🎉 Hot Deals</h1>
        <p style="color:var(--clr-text-2);max-width:480px;margin:0 auto">Exclusive offers from businesses across Ghana. Grab them before they expire!</p>
      </div>
      <div id="dealsGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:1.25rem">
        ${[...Array(6)].map(()=>'<div class="card skeleton" style="height:220px"></div>').join('')}
      </div>
      <div id="dealsPagination" style="display:flex;justify-content:center;gap:.5rem;margin-top:2rem"></div>
    </div>`;

  let page = 1;
  await loadDeals();

  async function loadDeals() {
    try {
      const { deals, pagination } = await API.get(`/deals?page=${page}&limit=12`);
      const grid = document.getElementById('dealsGrid');

      if (!deals.length) {
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:4rem 1rem">
          <div style="font-size:3rem;margin-bottom:1rem">😢</div>
          <h3>No active deals right now</h3>
          <p style="color:var(--clr-text-2)">Check back soon or browse our directory.</p>
          <a href="/directory" class="btn btn--primary" style="margin-top:1rem">Browse Businesses</a>
        </div>`;
        return;
      }

      grid.innerHTML = deals.map(d => {
        const biz = d.businesses || {};
        const expires = new Date(d.expires_at);
        const hoursLeft = Math.max(0, Math.floor((expires - Date.now()) / 3600000));
        const urgent = hoursLeft < 24;
        return `
          <div class="card" style="padding:0;overflow:hidden;display:flex;flex-direction:column">
            <div style="background:linear-gradient(135deg,var(--clr-primary),#e55a2b);padding:1.25rem;color:#fff;position:relative">
              ${d.discount_text ? `<div style="font-size:1.75rem;font-weight:800;margin-bottom:.25rem">${d.discount_text}</div>` : ''}
              <div style="font-weight:700;font-size:1rem">${d.title}</div>
              <div style="font-size:.8rem;opacity:.85;margin-top:.25rem">${biz.name || ''}</div>
              ${urgent ? `<span style="position:absolute;top:.75rem;right:.75rem;background:rgba(255,255,255,.2);color:#fff;padding:.2rem .5rem;border-radius:20px;font-size:.7rem;font-weight:700">🔥 ${hoursLeft}h left</span>` : ''}
            </div>
            <div style="padding:1rem;flex:1;display:flex;flex-direction:column;gap:.5rem">
              ${d.description ? `<p style="font-size:.875rem;color:var(--clr-text-2);margin:0">${d.description}</p>` : ''}
              <div style="font-size:.75rem;color:var(--clr-text-3);margin-top:auto">
                <i class="fa-regular fa-clock"></i> Expires ${formatDate(d.expires_at)}
                ${biz.city ? ` · 📍 ${biz.city}` : ''}
              </div>
            </div>
            <div style="padding:.75rem 1rem;border-top:1px solid var(--clr-border);display:flex;gap:.5rem">
              ${biz.slug ? `<a href="/business?slug=${biz.slug}" class="btn btn--outline btn--sm" style="flex:1">View Business</a>` : ''}
              ${biz.whatsapp ? `<a href="https://wa.me/${biz.whatsapp.replace(/\D/g,'')}" class="btn btn--whatsapp btn--sm" target="_blank" rel="noopener"><i class="fab fa-whatsapp"></i></a>` : ''}
              ${!biz.whatsapp && biz.phone ? `<a href="tel:${biz.phone}" class="btn btn--ghost btn--sm"><i class="fa-solid fa-phone"></i></a>` : ''}
            </div>
          </div>`;
      }).join('');

      // Pagination
      const totalPages = Math.ceil(pagination.total / 12);
      const pag = document.getElementById('dealsPagination');
      pag.innerHTML = totalPages > 1 ? `
        ${page > 1 ? `<button class="btn btn--ghost btn--sm" onclick="changePage(${page-1})">← Prev</button>` : ''}
        <span style="padding:.4rem .75rem;color:var(--clr-text-2);font-size:.875rem">Page ${page} of ${totalPages}</span>
        ${page < totalPages ? `<button class="btn btn--ghost btn--sm" onclick="changePage(${page+1})">Next →</button>` : ''}
      ` : '';

    } catch { document.getElementById('dealsGrid').innerHTML = '<p style="color:var(--clr-danger);grid-column:1/-1;text-align:center">Failed to load deals.</p>'; }
  }

  window.changePage = async (p) => { page = p; await loadDeals(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
});
