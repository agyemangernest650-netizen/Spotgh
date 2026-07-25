// assets/js/compare.js
document.addEventListener('DOMContentLoaded', async () => {
  loadComponents();
  document.title = 'Compare Businesses | SpotGH';
  const main = document.getElementById('pageMain');
  const ids = (new URLSearchParams(location.search).get('ids') || '').split(',').filter(Boolean).slice(0, 3);

  main.innerHTML = `
    <div class="container" style="padding:2rem 1rem 4rem">
      <h1 style="font-size:clamp(1.5rem,4vw,2.25rem);font-weight:800;text-align:center;margin-bottom:.5rem">⚖️ Compare Businesses</h1>
      <p style="text-align:center;color:var(--clr-text-2);margin-bottom:2rem">Add up to 3 businesses to compare ratings, pricing and services side by side.</p>
      <div style="display:flex;gap:.5rem;max-width:480px;margin:0 auto 2rem">
        <input id="compareSearchInput" class="form-input" placeholder="Search a business to add..." style="flex:1">
        <div id="compareSuggest" style="position:relative"></div>
      </div>
      <div id="compareGrid" style="overflow-x:auto"></div>
    </div>`;

  let selected = [];

  const input = document.getElementById('compareSearchInput');
  let debounce;
  input.addEventListener('input', () => {
    clearTimeout(debounce);
    const q = input.value.trim();
    if (q.length < 2) return;
    debounce = setTimeout(async () => {
      try {
        const { businesses } = await API.get(`/businesses?search=${encodeURIComponent(q)}&limit=5`);
        showSuggestions(businesses);
      } catch {}
    }, 300);
  });

  function showSuggestions(list) {
    let box = document.getElementById('compareSuggestBox');
    if (box) box.remove();
    if (!list.length) return;
    box = document.createElement('div');
    box.id = 'compareSuggestBox';
    box.style.cssText = 'position:absolute;top:100%;left:0;right:0;background:var(--clr-surface);border:1px solid var(--clr-border);border-radius:8px;z-index:20;max-width:480px;margin:0 auto';
    box.innerHTML = list.map(b => `<div class="compare-suggest-item" data-id="${b.id}" style="padding:.6rem 1rem;cursor:pointer;font-size:.9rem;border-bottom:1px solid var(--clr-border)">${b.name} <span style="color:var(--clr-text-3);font-size:.8rem">· ${b.city || ''}</span></div>`).join('');
    document.getElementById('compareSearchInput').insertAdjacentElement('afterend', box);
    box.querySelectorAll('.compare-suggest-item').forEach(el => el.addEventListener('click', () => {
      addBusiness(el.dataset.id);
      box.remove();
      input.value = '';
    }));
  }

  async function addBusiness(id) {
    if (selected.includes(id) || selected.length >= 3) return;
    selected.push(id);
    updateUrl();
    await render();
  }
  window.removeFromCompare = async (id) => {
    selected = selected.filter(s => s !== id);
    updateUrl();
    await render();
  };
  function updateUrl() {
    const url = new URL(location.href);
    url.searchParams.set('ids', selected.join(','));
    history.replaceState(null, '', url);
  }

  async function render() {
    const grid = document.getElementById('compareGrid');
    if (!selected.length) {
      grid.innerHTML = `<div style="text-align:center;padding:3rem;color:var(--clr-text-2)">Search above to add businesses to compare.</div>`;
      return;
    }
    grid.innerHTML = `<div style="text-align:center;padding:2rem"><span class="spinner-sm"></span></div>`;
    try {
      const results = await Promise.all(selected.map(id => API.get(`/businesses/${id}`).then(r => r.business).catch(() => null)));
      const businesses = results.filter(Boolean);
      grid.innerHTML = `
        <table style="width:100%;border-collapse:collapse;min-width:${businesses.length * 220}px">
          <tr>
            <td style="width:140px"></td>
            ${businesses.map(b => `<td style="padding:1rem;text-align:center;position:relative">
              <button onclick="removeFromCompare('${b.id}')" style="position:absolute;top:.25rem;right:.25rem;background:none;border:none;color:var(--clr-text-3);cursor:pointer"><i class="fa-solid fa-xmark"></i></button>
              ${b.logo_url ? `<img src="${b.logo_url}" style="width:56px;height:56px;border-radius:10px;object-fit:cover;margin-bottom:.5rem">` : ''}
              <div><strong>${b.name}</strong></div>
            </td>`).join('')}
          </tr>
          ${compareRow('Rating', businesses, b => b.avg_rating ? `⭐ ${b.avg_rating} (${b.review_count || 0})` : '—')}
          ${compareRow('City', businesses, b => b.city || '—')}
          ${compareRow('Category', businesses, b => b.categories?.name || '—')}
          ${compareRow('Verified', businesses, b => b.is_verified ? '✅ Yes' : '—')}
          ${compareRow('WhatsApp', businesses, b => b.whatsapp ? '✅ Yes' : '—')}
          ${compareRow('Delivery', businesses, b => b.has_delivery ? '✅ Yes' : '—')}
          <tr>
            <td></td>
            ${businesses.map(b => `<td style="padding:1rem;text-align:center"><a href="/pages/business.html?slug=${b.slug}" class="btn btn--primary btn--sm">View Profile</a></td>`).join('')}
          </tr>
        </table>`;
    } catch { grid.innerHTML = '<p style="color:var(--clr-danger);text-align:center">Failed to load comparison.</p>'; }
  }

  function compareRow(label, businesses, getValue) {
    return `<tr>
      <td style="padding:.75rem 1rem;font-size:.85rem;font-weight:600;color:var(--clr-text-2);border-top:1px solid var(--clr-border)">${label}</td>
      ${businesses.map(b => `<td style="padding:.75rem 1rem;text-align:center;font-size:.9rem;border-top:1px solid var(--clr-border)">${getValue(b)}</td>`).join('')}
    </tr>`;
  }

  if (ids.length) { selected = ids; await render(); }
  else await render();
});
