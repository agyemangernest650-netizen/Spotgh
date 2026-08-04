// assets/js/smart-search.js
document.addEventListener('DOMContentLoaded', () => {
  loadComponents();
  document.title = 'Smart Search | SpotGH';
  const main = document.getElementById('pageMain');
  const params = new URLSearchParams(location.search);
  const initialQuery = params.get('q') || '';

  main.innerHTML = `
    <div class="container" style="padding:2rem 1rem 4rem;max-width:720px">
      <div style="text-align:center;margin-bottom:1.5rem">
        <h1 style="font-size:clamp(1.5rem,4vw,2.25rem);font-weight:800">✨ AI-Powered Search</h1>
        <p style="color:var(--clr-text-2)">Describe what you need in plain English — e.g. "a tailor near East Legon under GH₵200"</p>
      </div>
      <form id="smartSearchForm" style="display:flex;gap:.5rem;margin-bottom:2rem">
        <input id="smartQuery" class="form-input" style="flex:1" placeholder="Find a hair salon in Kumasi open on weekends..." value="${initialQuery.replace(/"/g,'&quot;')}">
        <button class="btn btn--primary" type="submit"><i class="fa-solid fa-wand-magic-sparkles"></i> Search</button>
      </form>
      <div id="smartResults"></div>
    </div>`;

  document.getElementById('smartSearchForm').addEventListener('submit', (e) => { e.preventDefault(); runSearch(); });
  if (initialQuery) runSearch();

  async function runSearch() {
    const query = document.getElementById('smartQuery').value.trim();
    if (!query) return;
    const results = document.getElementById('smartResults');
    results.innerHTML = `<div style="text-align:center;padding:2rem"><span class="spinner-sm" style="width:24px;height:24px;border-width:3px;border-color:var(--clr-border);border-top-color:var(--clr-primary)"></span><p style="color:var(--clr-text-2);margin-top:1rem">Thinking through your request…</p></div>`;
    try {
      const { interpreted, businesses } = await API.post('/search/smart', { query });
      if (!businesses.length) {
        results.innerHTML = `<div style="text-align:center;padding:3rem 1rem;color:var(--clr-text-2)">No matches found. Try being less specific, or <a href="/directory">browse the full directory</a>.</div>`;
        return;
      }
      const chips = [
        interpreted.city ? `📍 ${interpreted.city}` : '',
        interpreted.area ? `🏘️ ${interpreted.area}` : '',
        interpreted.max_price ? `💰 Under GH₵${interpreted.max_price}` : '',
      ].filter(Boolean).join(' &nbsp; ');
      results.innerHTML = `
        ${chips ? `<p style="font-size:.85rem;color:var(--clr-text-2);margin-bottom:1rem">Understood as: ${chips}</p>` : ''}
        <div style="display:grid;gap:.75rem">
          ${businesses.map(b => `
            <a href="/business?slug=${b.slug}" class="card" style="padding:1rem;display:flex;gap:.75rem;align-items:center;text-decoration:none;color:inherit">
              ${b.logo_url ? `<img src="${b.logo_url}" style="width:52px;height:52px;border-radius:8px;object-fit:cover">` : ''}
              <div style="flex:1">
                <strong>${b.name}</strong>
                <div style="font-size:.8rem;color:var(--clr-text-2)">${b.category_name || ''} ${b.city ? `· ${b.city}` : ''}${b.avg_rating ? ` · ⭐ ${b.avg_rating} (${b.review_count})` : ''}</div>
              </div>
            </a>`).join('')}
        </div>`;
    } catch (err) {
      results.innerHTML = `<p style="color:var(--clr-danger);text-align:center;padding:2rem">${err.message || 'Search failed. Please try again.'}</p>`;
    }
  }
});
