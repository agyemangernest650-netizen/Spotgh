// assets/js/category.js
document.addEventListener('DOMContentLoaded', async () => {
  loadComponents();
  const params = new URLSearchParams(location.search);
  const slug = params.get('slug') || params.get('category');
  const main = document.getElementById('pageMain');

  if (!slug) { window.location.href = '/pages/categories.html'; return; }

  main.innerHTML = `
    <div style="height:280px;background:var(--clr-surface-2)" class="skel-card"></div>
    <div class="container" style="padding:2rem 1rem 4rem">
      <div class="biz-grid">${[...Array(8)].map(()=>'<div class="skel-card"></div>').join('')}</div>
    </div>`;

  let favIds = new Set();
  if (Auth.isLoggedIn()) {
    try { const { data } = await API.get('/businesses/saved'); favIds = new Set((data||[]).map(b => b.id)); } catch {}
  }

  let category, businesses, allCategories = [];
  try {
    const [catRes, allCatRes] = await Promise.all([
      API.get(`/categories/${slug}`),
      API.get('/categories').catch(() => ({ categories: [] })),
    ]);
    category = catRes.category;
    businesses = catRes.businesses || [];
    allCategories = allCatRes.categories || [];
  } catch (e) {
    main.innerHTML = `<div class="container" style="padding:5rem 1rem;text-align:center"><h2>Category not found</h2><p style="color:var(--clr-text-3);margin:1rem 0">${e.message||''}</p><a href="/pages/categories.html" class="btn btn--primary">Browse Categories</a></div>`;
    return;
  }

  document.title = `${category.name} | SpotGH`;

  const subcats = allCategories.filter(c => c.parent_id === category.id);
  const locations = {};
  businesses.forEach(b => { const city = b.location_city || b.city; if (city) locations[city] = (locations[city]||0)+1; });
  const topLocations = Object.entries(locations).sort((a,b)=>b[1]-a[1]).slice(0,5);

  const avgOfAll = businesses.length ? (businesses.reduce((s,b)=>s+(b.avg_rating||0),0)/businesses.length).toFixed(1) : '—';

  main.innerHTML = `
    <section class="cat-hero">
      ${category.cover_image ? `<div class="cat-hero__bg" style="background-image:url('${category.cover_image}')"></div><div class="cat-hero__overlay"></div>` : ''}
      <div class="container cat-hero__inner">
        <div class="cat-breadcrumb">
          <a href="/">Home</a><i class="fa-solid fa-chevron-right" style="font-size:.6rem"></i>
          <a href="/pages/categories.html">Categories</a><i class="fa-solid fa-chevron-right" style="font-size:.6rem"></i>
          <span>${category.name}</span>
        </div>
        <div class="cat-hero__icon">${category.icon || '🏷️'}</div>
        <h1 class="cat-hero__title">${category.name}</h1>
        <p class="cat-hero__desc">${category.description || `Discover trusted ${category.name.toLowerCase()} businesses across Ghana, rated and reviewed by real customers.`}</p>
        <form class="cat-hero__search" onsubmit="event.preventDefault(); window.location.href='/pages/directory.html?category=${category.slug}&q='+encodeURIComponent(document.getElementById('catSearch').value)">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input id="catSearch" type="text" placeholder="Search ${category.name.toLowerCase()}...">
          <button type="submit" class="btn btn--primary btn--sm">Search</button>
        </form>
        <div class="cat-hero__stats">
          <div class="cat-hero__stat"><b>${businesses.length}+</b>Listed businesses</div>
          <div class="cat-hero__stat"><b>${avgOfAll}★</b>Average rating</div>
          <div class="cat-hero__stat"><b>${topLocations.length}+</b>Cities covered</div>
        </div>
      </div>
    </section>

    <div class="container" style="padding:0 1rem 4rem">
      ${subcats.length ? `
        <div class="subcat-row">
          ${subcats.map(s => `
            <a href="/pages/category.html?slug=${s.slug}" class="subcat-pill">
              <span class="icon">${s.icon||'🏷️'}</span><span>${s.name}</span>
            </a>`).join('')}
          <a href="/pages/categories.html" class="subcat-pill"><span class="icon">⋯</span><span>More</span></a>
        </div>` : ''}

      <div class="section-head">
        <h2>${subcats.length ? 'Popular' : 'Top Rated'} ${category.name}</h2>
        <a href="/pages/directory.html?category=${category.slug}">View All <i class="fa-solid fa-arrow-right"></i></a>
      </div>
      <div class="biz-grid" id="bizGrid">
        ${businesses.length ? businesses.map(b => bizCard(b, favIds)).join('') : `<p style="color:var(--clr-text-3);grid-column:1/-1">No businesses listed in this category yet — be the first!</p>`}
      </div>

      <div class="cat-cta">
        <div class="cat-cta__icon"><i class="fa-solid fa-store"></i></div>
        <div class="cat-cta__text">
          <h3>Own a ${category.name.replace(/s$/,'')}?</h3>
          <p>Get your own mini-website, WhatsApp button, and reach new customers searching on SpotGH.</p>
        </div>
        <a href="/pages/pricing.html" class="btn btn--primary">List Your Business</a>
      </div>

      <h2 style="margin-bottom:.25rem">Why Choose Local?</h2>
      <p style="color:var(--clr-text-3);font-size:.85rem">What makes browsing ${category.name.toLowerCase()} on SpotGH different.</p>
      <div class="why-grid">
        ${[
          ['fa-handshake','Support Local','Every booking and sale supports a Ghanaian business directly.'],
          ['fa-star','Verified Reviews','Ratings come from real customers, not paid placements.'],
          ['fa-tags','Real Prices','See deals, products and pricing before you visit or call.'],
          ['fa-route','Easy to Find','Locations, maps and directions for every listing.'],
        ].map(([ic,t,d])=>`<div class="why-item"><div class="ic"><i class="fa-solid ${ic}"></i></div><h4>${t}</h4><p>${d}</p></div>`).join('')}
      </div>

      ${topLocations.length ? `
        <h2 style="margin-bottom:.25rem">Explore by Location</h2>
        <p style="color:var(--clr-text-3);font-size:.85rem;margin-bottom:1rem">Find ${category.name.toLowerCase()} in your city.</p>
        <div class="loc-grid">
          ${topLocations.map(([city,count])=>`
            <a href="/pages/directory.html?category=${category.slug}&city=${encodeURIComponent(city)}" class="loc-pill">
              <div class="name"><i class="fa-solid fa-location-dot" style="color:var(--clr-primary)"></i>${city}</div>
              <div class="count">${count} listing${count>1?'s':''}</div>
            </a>`).join('')}
        </div>` : ''}
    </div>`;

  // Favorite toggling
  document.querySelectorAll('[data-fav-id]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault(); e.stopPropagation();
      if (!Auth.requireAuth()) return;
      const id = btn.dataset.favId;
      try {
        const { saved } = await API.post(`/businesses/saved/${id}`);
        btn.classList.toggle('active', saved);
        saved ? toast.success('Saved to favorites') : toast.show('Removed from favorites');
      } catch (err) { toast.error(err.message || 'Could not update favorites'); }
    });
  });
});

function bizCard(b, favIds) {
  const isFav = favIds.has(b.id);
  const img = b.logo_url || b.cover_image || '/assets/images/placeholder-business.png';
  return `
    <a href="/pages/business.html?slug=${b.slug}" class="biz-card">
      <div class="biz-card__img">
        <img src="${img}" alt="${b.name}" loading="lazy" onerror="this.src='/assets/images/placeholder-business.png'">
        <div class="biz-card__badges">
          ${b.is_verified ? `<div class="biz-card__badge"><i class="fa-solid fa-check"></i> Verified</div>` : ''}
          ${b.is_top_rated ? `<div class="biz-card__badge biz-card__badge--gold"><i class="fa-solid fa-trophy"></i> Top Rated</div>` : ''}
          ${b.is_new ? `<div class="biz-card__badge biz-card__badge--new"><i class="fa-solid fa-sparkles"></i> New</div>` : ''}
        </div>
        <button class="biz-card__fav ${isFav?'active':''}" data-fav-id="${b.id}"><i class="fa-${isFav?'solid':'regular'} fa-heart"></i></button>
      </div>
      <div class="biz-card__body">
        <div class="biz-card__name">${b.name}</div>
        <div class="biz-card__sub">${b.location_city || b.city || ''}${b.tagline ? ' · '+b.tagline : ''}</div>
        <div class="biz-card__meta">
          <span class="biz-card__rating"><i class="fa-solid fa-star"></i> ${(b.avg_rating||0).toFixed(1)}</span>
          <span>(${b.review_count||0})</span>
        </div>
      </div>
    </a>`;
}
