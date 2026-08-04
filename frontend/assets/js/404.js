// assets/js/404.js
document.addEventListener('DOMContentLoaded', () => {
  loadComponents();

  const searched = new URLSearchParams(location.search).get('q');

  document.getElementById('pageMain').innerHTML = `
    <div style="min-height:70vh;display:flex;align-items:center;justify-content:center;padding:2rem 1rem">
      <div style="text-align:center;max-width:480px">
        <div style="font-size:5rem;margin-bottom:1rem;line-height:1">404</div>
        <div style="font-size:3rem;margin-bottom:1.25rem">😕</div>
        <h1 style="font-size:1.75rem;font-weight:800;margin-bottom:.75rem">Page Not Found</h1>
        <p style="color:var(--clr-text-2);margin-bottom:2rem">
          ${searched
            ? `We couldn't find anything for <strong>"${searched}"</strong>.`
            : "The page you're looking for doesn't exist or may have been moved."}
        </p>

        <!-- Quick search -->
        <div style="display:flex;gap:.5rem;margin-bottom:2rem">
          <input id="notFoundSearch" type="text" placeholder="Search businesses…" value="${searched || ''}"
            style="flex:1;padding:.65rem 1rem;border:1px solid var(--clr-border);border-radius:var(--radius-md);background:var(--clr-surface-2);color:var(--clr-text-1);font-family:inherit;outline:none">
          <button class="btn btn--primary" onclick="doSearch()"><i class="fa-solid fa-search"></i></button>
        </div>

        <div style="display:flex;gap:.75rem;justify-content:center;flex-wrap:wrap">
          <a href="/" class="btn btn--primary"><i class="fa-solid fa-house" style="margin-right:.4rem"></i>Go Home</a>
          <a href="/directory" class="btn btn--outline">Browse Directory</a>
          <button class="btn btn--ghost" onclick="history.back()">← Go Back</button>
        </div>

        <!-- Popular links -->
        <div style="margin-top:3rem">
          <p style="font-size:.8rem;color:var(--clr-text-3);margin-bottom:.75rem;text-transform:uppercase;letter-spacing:.05em">Popular pages</p>
          <div style="display:flex;gap:.5rem;justify-content:center;flex-wrap:wrap">
            ${[
              { href:'/deals',     label:'🎉 Deals' },
              { href:'/map',        label:'🗺️ Map' },
              { href:'/pricing',    label:'💳 Pricing' },
              { href:'/register',   label:'📝 Register' },
            ].map(l => `<a href="${l.href}" style="font-size:.85rem;color:var(--clr-primary);text-decoration:none;padding:.3rem .6rem;border:1px solid var(--clr-primary-20,rgba(78,13,173,.2));border-radius:20px">${l.label}</a>`).join('')}
          </div>
        </div>
      </div>
    </div>`;

  document.getElementById('notFoundSearch').addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
  window.doSearch = () => {
    const q = document.getElementById('notFoundSearch').value.trim();
    if (q) window.location.href = `/directory?q=${encodeURIComponent(q)}`;
  };
});
