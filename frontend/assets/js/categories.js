// assets/js/categories.js
document.addEventListener('DOMContentLoaded', async () => {
  loadComponents();
  const main = document.getElementById('pageMain');
  document.title = 'All Categories | SpotGH';

  main.innerHTML = `
    <div class="container">
      <div class="allcats-hero">
        <h1>Browse by Category</h1>
        <p>From restaurants to fashion designers — find trusted Ghanaian businesses by what you're looking for.</p>
      </div>
      <div class="allcats-grid" id="allcatsGrid">
        ${[...Array(8)].map(()=>'<div class="skel-card" style="height:180px"></div>').join('')}
      </div>
    </div>`;

  try {
    const { categories } = await API.get('/categories');
    const top = (categories || []).filter(c => !c.parent_id);
    const grid = document.getElementById('allcatsGrid');
    if (!top.length) { grid.innerHTML = '<p style="color:var(--clr-text-3)">No categories available yet.</p>'; return; }
    grid.innerHTML = top.map(c => `
      <a href="/pages/category.html?slug=${c.slug}" class="allcat-card">
        <div class="ic">${c.icon || '🏷️'}</div>
        <h3>${c.name}</h3>
        <p>${c.description || `Browse ${c.name.toLowerCase()} businesses near you.`}</p>
        <div class="count">${c.business_count || 0}+ listed</div>
      </a>`).join('');
  } catch (e) {
    document.getElementById('allcatsGrid').innerHTML = `<p style="color:var(--clr-danger)">Failed to load categories.</p>`;
  }
});
