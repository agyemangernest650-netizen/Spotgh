// assets/js/directory.js
document.addEventListener('DOMContentLoaded', () => {
  loadComponents();

  const params   = new URLSearchParams(location.search);
  let currentPage = 1;
  let totalPages  = 1;
  let debounce;

  document.getElementById('pageMain').innerHTML = `
    <div class="container" style="padding-top:2rem;padding-bottom:4rem">
      <div class="directory-header" style="margin-bottom:2rem">
        <h1 style="font-size:clamp(1.5rem,4vw,2.5rem);font-weight:800;margin-bottom:.5rem">
          Discover Businesses in Ghana 🇬🇭
        </h1>
        <p style="color:var(--clr-text-2)">Find trusted local businesses near you</p>
      </div>

      <!-- Filters -->
      <div class="filters-bar card" style="padding:1rem 1.25rem;margin-bottom:1.5rem;display:flex;flex-wrap:wrap;gap:.75rem;align-items:center">
        <div style="flex:1;min-width:180px;position:relative">
          <i class="fa-solid fa-magnifying-glass" style="position:absolute;left:.75rem;top:50%;transform:translateY(-50%);color:var(--clr-text-3)"></i>
          <input id="searchInput" type="text" placeholder="Search businesses…"
            style="width:100%;padding:.6rem .75rem .6rem 2.25rem;border:1px solid var(--clr-border);border-radius:var(--radius-md);background:var(--clr-surface-2);color:var(--clr-text-1);font-family:inherit"
            value="${params.get('q') || ''}">
        </div>
        <select id="categoryFilter" style="padding:.6rem .75rem;border:1px solid var(--clr-border);border-radius:var(--radius-md);background:var(--clr-surface-2);color:var(--clr-text-1);font-family:inherit">
          <option value="">All Categories</option>
        </select>
        <select id="cityFilter" style="padding:.6rem .75rem;border:1px solid var(--clr-border);border-radius:var(--radius-md);background:var(--clr-surface-2);color:var(--clr-text-1);font-family:inherit">
          <option value="">All Cities</option>
        </select>
        <select id="sortFilter" style="padding:.6rem .75rem;border:1px solid var(--clr-border);border-radius:var(--radius-md);background:var(--clr-surface-2);color:var(--clr-text-1);font-family:inherit">
          <option value="featured">Featured First</option>
          <option value="newest">Newest</option>
          <option value="rating">Top Rated</option>
          <option value="name">A–Z</option>
        </select>
        <select id="priceFilter" style="padding:.6rem .75rem;border:1px solid var(--clr-border);border-radius:var(--radius-md);background:var(--clr-surface-2);color:var(--clr-text-1);font-family:inherit" title="Price Range">
          <option value="">Any Price</option>
          <option value="$">₵ Budget</option>
          <option value="$$">₵₵ Mid-range</option>
          <option value="$$$">₵₵₵ Premium</option>
          <option value="$$$$">₵₵₵₵ Luxury</option>
        </select>
        <select id="ratingFilter" style="padding:.6rem .75rem;border:1px solid var(--clr-border);border-radius:var(--radius-md);background:var(--clr-surface-2);color:var(--clr-text-1);font-family:inherit" title="Minimum Rating">
          <option value="">Any Rating</option>
          <option value="4.5">★ 4.5+</option>
          <option value="4">★ 4.0+</option>
          <option value="3">★ 3.0+</option>
        </select>
        <label style="display:flex;align-items:center;gap:.4rem;padding:.6rem .75rem;border:1px solid var(--clr-border);border-radius:var(--radius-md);background:var(--clr-surface-2);cursor:pointer;white-space:nowrap">
          <input type="checkbox" id="openNowFilter"> Open Now
        </label>
        <label style="display:flex;align-items:center;gap:.4rem;padding:.6rem .75rem;border:1px solid var(--clr-border);border-radius:var(--radius-md);background:var(--clr-surface-2);cursor:pointer;white-space:nowrap">
          <input type="checkbox" id="verifiedFilter"> <i class="fa-solid fa-circle-check" style="color:var(--clr-primary)"></i> Verified
        </label>
        <button id="nearMeBtn" type="button" class="btn btn--ghost btn--sm" style="white-space:nowrap"><i class="fa-solid fa-location-crosshairs"></i> <span id="nearMeLabel">Near Me</span></button>
        <button id="clearFiltersBtn" class="btn btn--ghost btn--sm" style="white-space:nowrap">
          <i class="fa-solid fa-xmark"></i> Clear
        </button>
      </div>

      <!-- Active filter tags -->
      <div id="filterTags" style="display:flex;flex-wrap:wrap;gap:.5rem;margin-bottom:1rem"></div>

      <!-- Results header -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;flex-wrap:wrap;gap:.5rem">
        <p id="resultsCount" style="color:var(--clr-text-2);font-size:.875rem"></p>
        <div style="display:flex;gap:.5rem">
          <button id="viewGrid" class="btn btn--ghost btn--sm active" title="Grid view"><i class="fa-solid fa-grip"></i></button>
          <button id="viewList" class="btn btn--ghost btn--sm" title="List view"><i class="fa-solid fa-list"></i></button>
        </div>
      </div>

      <div id="dirAdSlot" style="margin-bottom:1.25rem"></div>
      <div id="sponsoredRow"></div>

      <!-- Business grid -->
      <div id="businessGrid" class="business-grid">
        ${[...Array(8)].map(()=>'<div class="card skeleton" style="height:280px"></div>').join('')}
      </div>

      <!-- Pagination -->
      <div id="pagination" style="display:flex;justify-content:center;gap:.5rem;margin-top:2.5rem;flex-wrap:wrap"></div>

      <!-- Recently Viewed -->
      <div id="recentlyViewed" hidden style="margin-top:2.5rem;padding-top:2rem;border-top:1px solid var(--clr-border)"></div>
    </div>`;
  insertAdSlot('dirAdSlot', '2222222222');

  // Load categories
  API.get('/categories').then(({ categories }) => {
    const sel = document.getElementById('categoryFilter');
    categories.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.slug;
      opt.textContent = `${c.icon || ''} ${c.name}`;
      if (params.get('category') === c.slug) opt.selected = true;
      sel.appendChild(opt);
    });
  }).catch(() => {});

  // Load cities — from the locations table rather than a hardcoded list,
  // so adding a new city (or, eventually, a new country) is a data change,
  // not a frontend deploy.
  API.get('/locations').then(({ locations }) => {
    const sel = document.getElementById('cityFilter');
    const cities = [...new Set((locations || []).map(l => l.city))].sort();
    cities.forEach(city => {
      const opt = document.createElement('option');
      opt.value = city;
      opt.textContent = city;
      if (params.get('city') === city) opt.selected = true;
      sel.appendChild(opt);
    });
  }).catch(() => {});

  // Wire up filters
  document.getElementById('searchInput').addEventListener('input', e => {
    clearTimeout(debounce);
    debounce = setTimeout(() => { currentPage = 1; load(); }, 400);
  });
  ['categoryFilter','cityFilter','sortFilter','priceFilter','ratingFilter','openNowFilter','verifiedFilter'].forEach(id =>
    document.getElementById(id).addEventListener('change', () => { currentPage = 1; load(); })
  );
  document.getElementById('clearFiltersBtn').addEventListener('click', () => {
    document.getElementById('searchInput').value = '';
    document.getElementById('categoryFilter').value = '';
    document.getElementById('cityFilter').value = '';
    document.getElementById('sortFilter').value = 'featured';
    document.getElementById('priceFilter').value = '';
    document.getElementById('ratingFilter').value = '';
    document.getElementById('openNowFilter').checked = false;
    document.getElementById('verifiedFilter').checked = false;
    lat = null; lng = null;
    document.getElementById('nearMeLabel').textContent = 'Near Me';
    currentPage = 1; load();
  });

  // View toggle
  document.getElementById('viewGrid').addEventListener('click', () => setView('grid'));
  document.getElementById('viewList').addEventListener('click', () => setView('list'));

  // Near me from URL params, or set live via the Near Me button below
  let lat = params.get('lat'), lng = params.get('lng');
  if (lat && lng) document.getElementById('nearMeLabel').textContent = 'Near Me ✓';

  document.getElementById('nearMeBtn').addEventListener('click', () => {
    if (!navigator.geolocation) { toast.warning('Location isn\'t supported by this browser'); return; }
    const label = document.getElementById('nearMeLabel');
    label.textContent = 'Locating…';
    navigator.geolocation.getCurrentPosition(
      pos => {
        lat = pos.coords.latitude; lng = pos.coords.longitude;
        label.textContent = 'Near Me ✓';
        currentPage = 1; load();
      },
      () => { label.textContent = 'Near Me'; toast.warning('Could not get your location'); },
      { timeout: 10000 }
    );
  });

  load();

  async function load() {
    const grid = document.getElementById('businessGrid');
    grid.innerHTML = [...Array(8)].map(()=>'<div class="card skeleton" style="height:280px"></div>').join('');

    const q        = document.getElementById('searchInput').value.trim();
    const category = document.getElementById('categoryFilter').value;
    const city     = document.getElementById('cityFilter').value;
    const sort     = document.getElementById('sortFilter').value;
    const price    = document.getElementById('priceFilter').value;
    const rating   = document.getElementById('ratingFilter').value;
    const openNow  = document.getElementById('openNowFilter').checked;
    const verified = document.getElementById('verifiedFilter').checked;

    const qs = new URLSearchParams({ page: currentPage, limit: 12 });
    if (q)        qs.set('search', q);
    if (category) qs.set('category', category);
    if (city)     qs.set('location', city);
    if (sort)     qs.set('sort', sort);
    if (price)    qs.set('price_range', price);
    if (rating)   qs.set('min_rating', rating);
    if (openNow)  qs.set('open_now', 'true');
    if (verified) qs.set('verified', 'true');
    if (lat)      qs.set('lat', lat);
    if (lng)      qs.set('lng', lng);

    // Update browser URL
    const urlParams = new URLSearchParams();
    if (q)        urlParams.set('q', q);
    if (category) urlParams.set('category', category);
    if (city)     urlParams.set('city', city);
    history.replaceState(null, '', `?${urlParams.toString()}`);

    updateFilterTags(q, category, city);
    loadSponsored(category, city);

    try {
      const { businesses, pagination } = await API.get(`/businesses?${qs}`);
      totalPages = Math.ceil((pagination?.total || 0) / 12);

      document.getElementById('resultsCount').textContent =
        `${pagination?.total || 0} business${pagination?.total !== 1 ? 'es' : ''} found`;

      if (!businesses?.length) {
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:4rem 1rem">
          <div style="font-size:3rem;margin-bottom:1rem">🔍</div>
          <h3 style="margin-bottom:.5rem">No businesses found</h3>
          <p style="color:var(--clr-text-2)">Try adjusting your search or filters</p>
        </div>`;
        document.getElementById('pagination').innerHTML = '';
        return;
      }

      renderGrid(businesses);
      renderPagination();

      // Recently viewed (show on first load only)
      if (currentPage === 1 && !q && !category && !city) {
        try {
          const recent = JSON.parse(localStorage.getItem('sgh_recent') || '[]');
          const recentEl = document.getElementById('recentlyViewed');
          if (recent.length && recentEl) {
            recentEl.innerHTML = `
              <h3 style="font-weight:700;margin-bottom:1rem">Recently Viewed</h3>
              <div style="display:flex;gap:.75rem;overflow-x:auto;padding-bottom:.5rem">
                ${recent.map(r => `
                  <a href="/pages/business.html?slug=${r.slug}" style="flex-shrink:0;width:140px;text-decoration:none;color:var(--clr-text-1)">
                    <div class="card" style="padding:.75rem;text-align:center">
                      ${r.logo ? `<img src="${r.logo}" style="width:40px;height:40px;border-radius:8px;object-fit:cover;margin:0 auto .5rem;display:block">` : `<div style="width:40px;height:40px;border-radius:8px;background:var(--clr-primary-10);margin:0 auto .5rem;display:flex;align-items:center;justify-content:center;font-size:1.2rem">🏢</div>`}
                      <div style="font-size:.8rem;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.name}</div>
                      <div style="font-size:.72rem;color:var(--clr-text-3)">${r.city||''}</div>
                    </div>
                  </a>`).join('')}
              </div>`;
            recentEl.hidden = false;
          }
        } catch {}
      }
    } catch (err) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--clr-danger)">
        <i class="fa-solid fa-circle-exclamation" style="font-size:2rem;margin-bottom:.75rem"></i>
        <p>Failed to load businesses. Please try again.</p>
        <button class="btn btn--outline btn--sm" style="margin-top:1rem" onclick="location.reload()">Retry</button>
      </div>`;
    }
  }

  function renderGrid(businesses) {
    document.getElementById('businessGrid').innerHTML = businesses.map(renderBusinessCard).join('');
  }

  async function loadSponsored(categorySlug, city) {
    const row = document.getElementById('sponsoredRow');
    if (currentPage !== 1) { row.innerHTML = ''; return; } // only show on the first page of results
    try {
      const qs = new URLSearchParams();
      if (city) qs.set('city', city);
      // sponsored.routes.js filters by category_id, but the directory filter uses category slug —
      // resolve it first so "Sponsored" only shows genuinely relevant listings
      if (categorySlug) {
        const { categories } = await API.get('/categories');
        const match = categories.find(c => c.slug === categorySlug);
        if (match) qs.set('category_id', match.id);
      }
      const { sponsored } = await API.get(`/sponsored/active?${qs}`);
      if (!sponsored?.length) { row.innerHTML = ''; return; }
      row.innerHTML = `
        <div style="margin-bottom:1.5rem">
          <div style="font-size:.8rem;font-weight:700;color:var(--clr-text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.6rem">Sponsored</div>
          <div class="business-grid">
            ${sponsored.map(b => `<div style="position:relative" data-sponsored-id="${b.sponsored_listing_id || ''}">
              <span style="position:absolute;top:.6rem;left:.6rem;z-index:2;background:var(--clr-primary);color:#fff;font-size:.65rem;font-weight:700;padding:.15rem .5rem;border-radius:4px;text-transform:uppercase">Sponsored</span>
              ${renderBusinessCard(b)}
            </div>`).join('')}
          </div>
        </div>`;
      row.querySelectorAll('[data-sponsored-id]').forEach(el => {
        const id = el.dataset.sponsoredId;
        if (!id) return;
        el.addEventListener('click', () => trackSponsoredClick(id), { capture: true, once: true });
      });
    } catch { row.innerHTML = ''; }
  }

  window.trackSponsoredClick = (id) => { if (id) fetch(`/api/sponsored/${id}/click`, { method: 'POST' }).catch(() => {}); };

  function setView(mode) {
    const grid = document.getElementById('businessGrid');
    document.getElementById('viewGrid').classList.toggle('active', mode === 'grid');
    document.getElementById('viewList').classList.toggle('active', mode === 'list');
    if (mode === 'list') {
      grid.style.gridTemplateColumns = '1fr';
    } else {
      grid.style.gridTemplateColumns = '';
    }
  }

  function updateFilterTags(q, category, city) {
    const tags = document.getElementById('filterTags');
    const items = [];
    if (q) items.push({ label: `"${q}"`, clear: () => { document.getElementById('searchInput').value=''; load(); } });
    if (category) {
      const sel = document.getElementById('categoryFilter');
      const name = sel.options[sel.selectedIndex]?.text || category;
      items.push({ label: name, clear: () => { document.getElementById('categoryFilter').value=''; load(); } });
    }
    if (city) items.push({ label: `📍 ${city}`, clear: () => { document.getElementById('cityFilter').value=''; load(); } });
    if (lat && lng) items.push({ label: '📍 Near me', clear: () => {} });

    tags.innerHTML = items.map((item, i) => `
      <span class="badge badge--primary" style="cursor:pointer;padding:.3rem .6rem" data-tag="${i}">
        ${item.label} <i class="fa-solid fa-xmark" style="margin-left:.3rem;opacity:.7"></i>
      </span>`).join('');

    tags.querySelectorAll('[data-tag]').forEach(el => {
      el.addEventListener('click', () => items[parseInt(el.dataset.tag)].clear());
    });
  }

  function renderPagination() {
    const pag = document.getElementById('pagination');
    if (totalPages <= 1) { pag.innerHTML = ''; return; }
    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= 1) {
        pages.push(i);
      } else if (pages[pages.length-1] !== '…') {
        pages.push('…');
      }
    }
    pag.innerHTML = `
      <button class="btn btn--ghost btn--sm" ${currentPage===1?'disabled':''} data-page="${currentPage-1}">
        <i class="fa-solid fa-chevron-left"></i>
      </button>
      ${pages.map(p => p === '…'
        ? `<span style="padding:.4rem .5rem;color:var(--clr-text-3)">…</span>`
        : `<button class="btn ${p===currentPage?'btn--primary':'btn--ghost'} btn--sm" data-page="${p}">${p}</button>`
      ).join('')}
      <button class="btn btn--ghost btn--sm" ${currentPage===totalPages?'disabled':''} data-page="${currentPage+1}">
        <i class="fa-solid fa-chevron-right"></i>
      </button>`;

    pag.querySelectorAll('[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        currentPage = parseInt(btn.dataset.page);
        load();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }
});
