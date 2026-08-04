// assets/js/products.js
document.addEventListener('DOMContentLoaded', async () => {
  loadComponents();
  if (!Auth.requireAuth()) return;
  const bizId = new URLSearchParams(location.search).get('id');
  if (!bizId) { location.href = '/dashboard'; return; }

  const main = document.getElementById('pageMain');
  main.innerHTML = `
    <div class="container" style="max-width:900px;margin:0 auto;padding:2rem 1rem 4rem">
      <div id="bizAdminNav"></div>
      <div style="display:flex;align-items:center;justify-content:flex-end;gap:1rem;margin-bottom:1.5rem;flex-wrap:wrap">
        <div style="display:flex;gap:.5rem;flex-wrap:wrap">
          <button class="btn btn--outline btn--sm" onclick="showCsvImport()"><i class="fa-solid fa-file-import"></i> Import CSV</button>
          <button class="btn btn--primary btn--sm" onclick="showProductForm()"><i class="fa-solid fa-plus"></i> Add Product</button>
        </div>
      </div>

      <div id="productForm" hidden class="card" style="padding:1.5rem;margin-bottom:1.5rem">
        <h3 style="margin-bottom:1rem;font-weight:700" id="productFormTitle">Add Product</h3>
        <input type="hidden" id="editProductId">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-bottom:.75rem">
          <div style="grid-column:1/-1"><label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:.3rem">Name *</label><input id="pName" class="input" placeholder="Product name" style="width:100%"></div>
          <div><label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:.3rem">Type *</label>
            <select id="pType" class="input" style="width:100%">
              <option value="product">Product</option>
              <option value="service">Service</option>
            </select>
          </div>
          <div><label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:.3rem">Price (GHS)</label><input id="pPrice" type="number" class="input" placeholder="0.00" style="width:100%"></div>
          <div style="grid-column:1/-1"><label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:.3rem">Category</label><input id="pCategory" class="input" placeholder="e.g. Food, Service" style="width:100%"></div>
          <div style="grid-column:1/-1"><label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:.3rem">Description</label><textarea id="pDesc" rows="3" class="input" style="width:100%;resize:vertical" placeholder="Describe this product…"></textarea></div>
          <div style="grid-column:1/-1"><label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:.3rem">Image URL</label><input id="pImage" class="input" placeholder="https://…" style="width:100%"></div>
          <div id="pInventoryFields" style="grid-column:1/-1;display:flex;gap:1.25rem;align-items:center;flex-wrap:wrap;padding-top:.5rem;border-top:1px solid var(--clr-border);margin-top:.25rem">
            <label style="display:flex;align-items:center;gap:.4rem;font-size:.85rem;font-weight:400"><input type="checkbox" id="pTrackInventory" onchange="toggleStockField()"> Track stock quantity</label>
            <div id="pStockWrap" style="display:none;align-items:center;gap:.5rem">
              <label style="font-size:.8rem;font-weight:600">In stock:</label><input id="pStock" type="number" min="0" class="input" style="width:90px" placeholder="0">
              <label style="display:flex;align-items:center;gap:.3rem;font-size:.85rem;font-weight:400"><input type="checkbox" id="pAllowBackorder"> Allow orders when out of stock</label>
            </div>
            <label style="display:flex;align-items:center;gap:.4rem;font-size:.85rem;font-weight:400"><input type="checkbox" id="pNewArrival"> 🆕 Mark as New Arrival</label>
          </div>
        </div>
        <div style="display:flex;gap:.5rem">
          <button class="btn btn--primary btn--sm" onclick="saveProduct()">Save Product</button>
          <button class="btn btn--ghost btn--sm" onclick="cancelProductForm()">Cancel</button>
        </div>
      </div>

      <div id="productsList"><div class="skeleton" style="height:200px;border-radius:16px"></div></div>
    </div>`;
  renderBizAdminNav('bizAdminNav', bizId, 'products');

  window.showCsvImport = () => {
    const existing = document.getElementById('csvImportPanel');
    if (existing) { existing.remove(); return; }
    const panel = document.createElement('div');
    panel.id = 'csvImportPanel';
    panel.className = 'card';
    panel.style = 'padding:1.5rem;margin-bottom:1.5rem';
    panel.innerHTML = `
      <h3 style="margin-bottom:.5rem;font-weight:700">Import Products via CSV</h3>
      <p style="font-size:.85rem;color:var(--clr-text-2);margin-bottom:1rem">
        CSV columns: <code>name</code>, <code>type</code> (product/service), <code>price</code>, <code>category</code>, <code>description</code>, <code>image_url</code><br>
        First row must be the header row.
      </p>
      <div style="display:flex;gap:.75rem;flex-wrap:wrap;align-items:center">
        <input type="file" id="csvFileInput" accept=".csv" class="input" style="max-width:300px">
        <button class="btn btn--primary btn--sm" onclick="processCsvImport('${bizId}')">Import</button>
        <a href="data:text/csv;charset=utf-8,name%2Ctype%2Cprice%2Ccategory%2Cdescription%2Cimage_url%0AFufu+with+Light+Soup%2Cproduct%2C35%2CFood%2CTraditional+Ghanaian+dish%2C" download="products_template.csv" class="btn btn--ghost btn--sm">Download Template</a>
        <button class="btn btn--ghost btn--sm" onclick="document.getElementById('csvImportPanel').remove()">Cancel</button>
      </div>
      <div id="csvImportResult" style="margin-top:1rem"></div>`;
    document.getElementById('productForm').before(panel);
  };

  window.processCsvImport = async (bizId) => {
    const file = document.getElementById('csvFileInput')?.files[0];
    if (!file) { toast.warning('Choose a CSV file first'); return; }
    const text = await file.text();
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g,'').toLowerCase());
    const results = { ok: 0, fail: 0, errors: [] };
    const resultEl = document.getElementById('csvImportResult');
    resultEl.innerHTML = '<p style="color:var(--clr-text-2)">Importing…</p>';
    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g,''));
      const row = Object.fromEntries(headers.map((h,j) => [h, vals[j]||'']));
      if (!row.name || !row.type) { results.fail++; results.errors.push(`Row ${i+1}: name and type required`); continue; }
      try {
        await API.post(`/businesses/${bizId}/products`, {
          name: row.name, type: row.type || 'product',
          price: row.price ? parseFloat(row.price) : null,
          category: row.category || null,
          description: row.description || null,
          image_url: row.image_url || null,
        });
        results.ok++;
      } catch(e) { results.fail++; results.errors.push(`Row ${i+1} (${row.name}): ${e.message||'failed'}`); }
    }
    resultEl.innerHTML = `
      <div style="padding:1rem;border-radius:var(--radius-md);background:${results.fail===0?'rgba(34,197,94,.1)':'rgba(245,158,11,.08)'};border:1px solid ${results.fail===0?'var(--clr-success)':'var(--clr-warning)'}">
        <strong>${results.ok} imported</strong>${results.fail ? `, ${results.fail} failed` : ' — all done!'}<br>
        ${results.errors.slice(0,5).map(e=>`<div style="font-size:.8rem;color:var(--clr-danger)">${e}</div>`).join('')}
      </div>`;
    if (results.ok > 0) loadProducts();
  };

  window.showProductForm = (product) => {
    document.getElementById('productForm').hidden = false;
    document.getElementById('productFormTitle').textContent = product ? 'Edit Product' : 'Add Product';
    document.getElementById('editProductId').value = product?.id || '';
    document.getElementById('pName').value    = product?.name || '';
    document.getElementById('pType').value    = product?.type || 'product';
    document.getElementById('pPrice').value   = product?.price || '';
    document.getElementById('pCategory').value= product?.category || '';
    document.getElementById('pDesc').value    = product?.description || '';
    document.getElementById('pImage').value   = product?.image_url || '';
    document.getElementById('pTrackInventory').checked = !!product?.track_inventory;
    document.getElementById('pStock').value   = product?.stock_quantity ?? '';
    document.getElementById('pAllowBackorder').checked = !!product?.allow_backorder;
    document.getElementById('pNewArrival').checked = !!product?.is_new_arrival;
    toggleStockField();
  };
  window.cancelProductForm = () => { document.getElementById('productForm').hidden = true; };
  window.toggleStockField = () => {
    document.getElementById('pStockWrap').style.display = document.getElementById('pTrackInventory').checked ? 'flex' : 'none';
  };

  window.saveProduct = async () => {
    const id = document.getElementById('editProductId').value;
    const name = document.getElementById('pName').value.trim();
    if (!name) { toast.warning('Name is required'); return; }
    const trackInventory = document.getElementById('pTrackInventory').checked;
    const body = {
      name, type: document.getElementById('pType').value,
      price: parseFloat(document.getElementById('pPrice').value)||null,
      category: document.getElementById('pCategory').value.trim(),
      description: document.getElementById('pDesc').value.trim(),
      image_url: document.getElementById('pImage').value.trim(),
      track_inventory: trackInventory,
      stock_quantity: trackInventory ? (parseInt(document.getElementById('pStock').value) || 0) : 0,
      allow_backorder: document.getElementById('pAllowBackorder').checked,
      is_new_arrival: document.getElementById('pNewArrival').checked,
    };
    try {
      if (id) await API.patch(`/businesses/${bizId}/products/${id}`, body);
      else     await API.post(`/businesses/${bizId}/products`, body);
      toast.success(id ? 'Product updated!' : 'Product added!');
      document.getElementById('productForm').hidden = true;
      loadProducts();
    } catch(e) { toast.error(e.message || 'Failed to save'); }
  };

  window.deleteProduct = async (id) => {
    if (!confirm('Delete this product?')) return;
    try { await API.delete(`/businesses/${bizId}/products/${id}`); toast.success('Deleted'); loadProducts(); }
    catch { toast.error('Failed to delete'); }
  };

  async function loadProducts() {
    try {
      const { items: products } = await API.get(`/businesses/${bizId}/products`);
      const el = document.getElementById('productsList');
      if (!products.length) {
        el.innerHTML = `<div class="card" style="padding:3rem;text-align:center">
          <div style="font-size:3rem;margin-bottom:1rem">📦</div>
          <h3>No products yet</h3>
          <p style="color:var(--clr-text-2)">Add your products and services to showcase them on your mini-site.</p>
          <button class="btn btn--primary" style="margin-top:1rem" onclick="showProductForm()">Add First Product</button>
        </div>`;
        return;
      }
      el.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:1rem">
        ${products.map(p=>`
          <div class="card" style="padding:0;overflow:hidden">
            ${p.image_url?`<img src="${p.image_url}" alt="${p.name}" style="width:100%;height:140px;object-fit:cover">`:`<div style="height:100px;background:var(--clr-surface-2);display:flex;align-items:center;justify-content:center;font-size:2rem">📦</div>`}
            <div style="padding:.875rem">
              <div style="font-weight:700;margin-bottom:.25rem">${p.name}</div>
              ${p.description?`<div style="font-size:.8rem;color:var(--clr-text-2);margin-bottom:.4rem">${p.description}</div>`:''}
              ${p.price?`<div style="font-weight:700;color:var(--clr-primary);margin-bottom:.75rem">${formatCurrency(p.price)}</div>`:'<div style="margin-bottom:.75rem"></div>'}
              <div style="display:flex;gap:.4rem">
                <button class="btn btn--outline btn--sm" onclick="showProductForm(${JSON.stringify(p).replace(/"/g,'&quot;')})"><i class="fa-solid fa-pen"></i></button>
                <button class="btn btn--danger btn--sm" onclick="deleteProduct('${p.id}')"><i class="fa-solid fa-trash"></i></button>
              </div>
            </div>
          </div>`).join('')}
      </div>`;
    } catch { document.getElementById('productsList').innerHTML = '<p style="color:var(--clr-danger)">Failed to load products.</p>'; }
  }

  loadProducts();
});
