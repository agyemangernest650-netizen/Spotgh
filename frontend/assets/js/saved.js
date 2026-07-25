// assets/js/saved.js
document.addEventListener('DOMContentLoaded', async () => {
  loadComponents();
  if (!Auth.requireAuth()) return;

  document.getElementById('pageMain').innerHTML = `
    <div class="container" style="max-width:900px;margin:0 auto;padding:2rem 1rem 4rem">
      <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem;flex-wrap:wrap">
        <a href="/pages/dashboard.html" class="btn btn--ghost btn--sm"><i class="fa-solid fa-arrow-left"></i></a>
        <h1 style="font-size:1.5rem;font-weight:800;margin:0">❤️ Saved</h1>
      </div>
      <div style="display:flex;gap:.5rem;margin-bottom:1.5rem;border-bottom:1px solid var(--clr-border)">
        <button class="tab-btn active" data-tab="businesses" style="padding:.6rem 1rem;background:none;border:none;border-bottom:2px solid var(--clr-primary);font-weight:600;cursor:pointer">Businesses</button>
        <button class="tab-btn" data-tab="products" style="padding:.6rem 1rem;background:none;border:none;border-bottom:2px solid transparent;color:var(--clr-text-2);font-weight:600;cursor:pointer">Products</button>
      </div>
      <div id="savedGrid" class="business-grid">
        ${[...Array(4)].map(() => '<div class="card skeleton" style="height:280px"></div>').join('')}
      </div>
    </div>`;

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => { b.classList.remove('active'); b.style.borderBottomColor = 'transparent'; b.style.color = 'var(--clr-text-2)'; });
      btn.classList.add('active'); btn.style.borderBottomColor = 'var(--clr-primary)'; btn.style.color = 'var(--clr-text)';
      btn.dataset.tab === 'businesses' ? loadBusinesses() : loadProducts();
    });
  });

  async function loadBusinesses() {
    const grid = document.getElementById('savedGrid');
    grid.className = 'business-grid';
    grid.innerHTML = [...Array(4)].map(() => '<div class="card skeleton" style="height:280px"></div>').join('');
    try {
      const { data: businesses } = await API.get('/businesses/saved');
      if (!businesses.length) {
        grid.innerHTML = `<div style="grid-column:1/-1">${emptyState({
          icon: '💔', title: 'No saved businesses yet', subtitle: 'Tap the ❤️ on any business to save it here for later.',
          actionHtml: `<a href="/pages/directory.html" class="btn btn--primary">Browse Directory</a>`,
        })}</div>`;
        return;
      }
      grid.innerHTML = businesses.map(b => renderBusinessCard(b)).join('');
    } catch {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--clr-danger)">
        <i class="fa-solid fa-circle-exclamation" style="font-size:2rem;margin-bottom:.75rem;display:block"></i>
        <p>Failed to load saved businesses.</p>
        <button class="btn btn--outline btn--sm" style="margin-top:1rem" onclick="location.reload()">Retry</button>
      </div>`;
    }
  }

  async function loadProducts() {
    const grid = document.getElementById('savedGrid');
    grid.className = '';
    grid.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:1rem">${[...Array(4)].map(() => '<div class="card skeleton" style="height:220px"></div>').join('')}</div>`;
    try {
      const { data: products } = await API.get('/user/favorite-products');
      if (!products.length) {
        grid.innerHTML = emptyState({
          icon: '📦', title: 'No saved products yet', subtitle: 'Tap the ❤️ on any product to save it here for quick reordering.',
          actionHtml: `<a href="/pages/directory.html" class="btn btn--primary">Browse Businesses</a>`,
        });
        return;
      }
      grid.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:1rem">
        ${products.map(p => {
          const outOfStock = p.track_inventory && !p.allow_backorder && p.stock_quantity <= 0;
          return `
          <div class="card" style="padding:0;overflow:hidden">
            ${p.image_url ? `<img src="${p.image_url}" alt="${p.name}" style="width:100%;height:120px;object-fit:cover">` : `<div style="height:120px;background:var(--clr-surface-2);display:flex;align-items:center;justify-content:center;font-size:1.75rem">📦</div>`}
            <div style="padding:.75rem">
              <div style="font-weight:600;font-size:.9rem;margin-bottom:.15rem">${p.name}</div>
              <div style="font-size:.75rem;color:var(--clr-text-3);margin-bottom:.4rem">${p.businesses?.name || ''}</div>
              ${p.price ? `<div style="font-weight:700;color:var(--clr-primary);font-size:.9rem;margin-bottom:.5rem">${formatCurrency(p.price)}</div>` : ''}
              <div style="display:flex;gap:.4rem">
                ${p.is_available && !outOfStock
                  ? `<button class="btn btn--primary btn--sm" style="flex:1" onclick="quickAddSaved('${p.business_id}','${p.id}')"><i class="fa-solid fa-cart-plus"></i></button>`
                  : `<button class="btn btn--ghost btn--sm" style="flex:1" disabled>Unavailable</button>`}
                <button class="btn btn--ghost btn--sm" onclick="unsaveProduct('${p.id}')" style="color:var(--clr-danger)"><i class="fa-solid fa-trash"></i></button>
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>`;
    } catch {
      grid.innerHTML = `<div style="text-align:center;padding:3rem;color:var(--clr-danger)">Failed to load saved products.</div>`;
    }
  }

  window.quickAddSaved = async (businessId, productId) => {
    try {
      await API.post(`/cart/${businessId}/items`, { product_id: productId, quantity: 1 });
      toast.success('Added to cart');
      location.href = `/pages/checkout.html?biz=${businessId}`;
    } catch (e) { toast.error(e.message || 'Could not add to cart'); }
  };
  window.unsaveProduct = async (productId) => {
    try { await API.delete(`/user/favorite-products/${productId}`); toast.success('Removed'); loadProducts(); }
    catch { toast.error('Failed to remove'); }
  };

  loadBusinesses();
});
