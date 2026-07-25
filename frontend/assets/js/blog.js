// assets/js/blog.js
document.addEventListener('DOMContentLoaded', async () => {
  loadComponents();
  document.title = 'Blog | SpotGH';
  const main = document.getElementById('pageMain');
  main.innerHTML = `
    <div class="container" style="padding:2rem 1rem 4rem;max-width:900px">
      <div style="text-align:center;margin-bottom:2.5rem">
        <h1 style="font-size:clamp(1.75rem,5vw,3rem);font-weight:800">📰 SpotGH Blog</h1>
        <p style="color:var(--clr-text-2)">Guides, roundups and local business spotlights from across Ghana.</p>
      </div>
      <div id="blogGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:1.5rem">
        ${[...Array(6)].map(()=>'<div class="card skeleton" style="height:260px"></div>').join('')}
      </div>
    </div>`;
  try {
    const { posts } = await API.get('/blog?limit=30');
    const grid = document.getElementById('blogGrid');
    if (!posts.length) { grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--clr-text-2)">No articles published yet — check back soon!</div>`; return; }
    grid.innerHTML = posts.map(p => `
      <a href="/pages/blog-post.html?slug=${p.slug}" class="card" style="padding:0;overflow:hidden;text-decoration:none;color:inherit;display:flex;flex-direction:column">
        <div style="height:150px;background:${p.cover_url ? `url('${p.cover_url}') center/cover` : 'linear-gradient(135deg,var(--clr-primary),#e55a2b)'}"></div>
        <div style="padding:1rem;flex:1">
          <strong style="display:block;margin-bottom:.4rem">${p.title}</strong>
          <p style="font-size:.85rem;color:var(--clr-text-2);margin:0">${p.excerpt || ''}</p>
          <span style="font-size:.75rem;color:var(--clr-text-3);margin-top:.5rem;display:block">${formatDate(p.published_at)}</span>
        </div>
      </a>`).join('');
  } catch { document.getElementById('blogGrid').innerHTML = '<p style="color:var(--clr-danger)">Failed to load articles.</p>'; }
});
