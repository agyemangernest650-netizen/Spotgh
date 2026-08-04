// assets/js/franchise-manager.js
document.addEventListener('DOMContentLoaded', async () => {
  loadComponents();
  if (!Auth.requireAuth()) return;

  const franchiseId = new URLSearchParams(location.search).get('id');
  const main = document.getElementById('pageMain');

  // These must be registered BEFORE the branching below — they were
  // previously defined after an early `return`, so they never actually
  // ran and every button on this page threw "not defined" when clicked.
  window.toggleCreateForm = () => { document.getElementById('createForm').hidden = !document.getElementById('createForm').hidden; };

  window.createFranchise = async () => {
    const name = document.getElementById('fName').value.trim();
    if (!name) return toast.warning('Franchise name is required');
    try {
      const { franchise } = await API.post('/franchises', { name, description: document.getElementById('fDesc').value.trim() || undefined });
      toast.success('Franchise created!');
      location.href = `/franchise-manager?id=${franchise.id}`;
    } catch (err) { toast.error(err.message || 'Failed to create franchise'); }
  };

  window.uploadFranchiseLogo = async (input) => {
    if (!input.files[0]) return;
    try {
      const fd = new FormData(); fd.append('logo', input.files[0]);
      const { franchise } = await API.upload(`/franchises/${franchiseId}/logo`, fd);
      document.getElementById('fLogoPreview').innerHTML = `<img src="${franchise.logo_url}" style="width:100%;height:100%;object-fit:cover">`;
      toast.success('Logo updated');
    } catch { toast.error('Failed to upload logo'); }
  };

  window.applyBranding = async () => {
    if (!confirm('Apply this franchise\'s logo/theme color to every location? This will overwrite each business\'s current logo/theme.')) return;
    try {
      const { updated_count } = await API.post(`/franchises/${franchiseId}/apply-branding`, {});
      toast.success(`Branding applied to ${updated_count} location${updated_count===1?'':'s'}`);
    } catch (err) { toast.error(err.message || 'Failed to apply branding'); }
  };

  window.deleteFranchise = async () => {
    if (!confirm('Delete this franchise? Locations will not be deleted, just ungrouped.')) return;
    try { await API.delete(`/franchises/${franchiseId}`); toast.success('Franchise deleted'); location.href = '/franchise-manager'; }
    catch { toast.error('Failed to delete'); }
  };

  window.addLocation = async () => {
    const businessId = document.getElementById('addBizSelect').value;
    try { await API.post(`/franchises/${franchiseId}/businesses`, { business_id: businessId }); toast.success('Location added'); renderDetail(franchiseId); }
    catch (err) { toast.error(err.message || 'Failed to add location'); }
  };

  window.removeLocation = async (businessId) => {
    if (!confirm('Remove this location from the franchise?')) return;
    try { await API.delete(`/franchises/${franchiseId}/businesses/${businessId}`); document.querySelector(`[data-biz-id="${businessId}"]`)?.remove(); toast.success('Removed'); }
    catch { toast.error('Failed to remove'); }
  };

  if (franchiseId) return renderDetail(franchiseId);
  return renderList();

  // ── List view: every franchise the caller owns ──────────────────────
  async function renderList() {
    main.innerHTML = `<div class="container" style="max-width:900px;margin:0 auto;padding:2rem 1rem 4rem"><div class="skeleton" style="height:200px;border-radius:16px"></div></div>`;
    let franchises = [];
    try { ({ franchises } = await API.get('/franchises/mine')); }
    catch {
      toast.error('Failed to load franchises');
      main.innerHTML = `<div class="container" style="max-width:900px;margin:0 auto;padding:2rem 1rem 4rem">
        <div class="empty-state"><div class="empty-state__icon">⚠️</div>
          <p>Couldn't load your franchises. <a href="#" onclick="location.reload();return false">Try again</a></p>
        </div></div>`;
      return;
    }

    main.innerHTML = `
      <div class="container" style="max-width:900px;margin:0 auto;padding:2rem 1rem 4rem">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-bottom:.5rem;flex-wrap:wrap">
          <h1 style="font-size:1.5rem;font-weight:800;margin:0">🏬 Franchise Manager</h1>
          <button class="btn btn--primary btn--sm" onclick="toggleCreateForm()"><i class="fa-solid fa-plus"></i> New Franchise</button>
        </div>
        <p style="color:var(--clr-text-2);margin-bottom:1.5rem">Group multiple locations under one brand for combined branding and analytics across all of them.</p>

        <div class="card" id="createForm" hidden style="padding:1.25rem;margin-bottom:1.5rem">
          <h3 style="font-weight:700;margin-bottom:.75rem">Create a Franchise</h3>
          <div style="display:flex;flex-direction:column;gap:.75rem;max-width:420px">
            <input id="fName" class="input" placeholder="Brand name (e.g. Royal Hotel Group) *">
            <textarea id="fDesc" class="input" rows="2" placeholder="Description (optional)" style="resize:vertical"></textarea>
            <button class="btn btn--primary btn--sm" onclick="createFranchise()" style="align-self:flex-start">Create</button>
          </div>
        </div>

        <div id="franchiseGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1.25rem">
          ${franchises.length ? franchises.map(franchiseCard).join('') : `
            <div class="card" style="padding:2rem;text-align:center;grid-column:1/-1;color:var(--clr-text-2)">
              <div style="font-size:2rem;margin-bottom:.5rem">🏬</div>
              No franchises yet. If you own more than one business, group them here for combined branding and stats.
            </div>`}
        </div>
      </div>`;
  }

  function franchiseCard(f) {
    return `
      <a href="/franchise-manager?id=${f.id}" class="card" style="padding:1.25rem;text-decoration:none;color:inherit;display:block">
        <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:.75rem">
          ${f.logo_url
            ? `<img src="${f.logo_url}" alt="${f.name}" style="width:44px;height:44px;border-radius:10px;object-fit:cover">`
            : `<div style="width:44px;height:44px;border-radius:10px;background:var(--clr-primary-10);color:var(--clr-primary);display:flex;align-items:center;justify-content:center;font-weight:700">${f.name.charAt(0)}</div>`}
          <div><div style="font-weight:700">${f.name}</div><div style="font-size:.78rem;color:var(--clr-text-3)">${f.location_count} location${f.location_count===1?'':'s'}</div></div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem;text-align:center;font-size:.78rem">
          <div><div style="font-weight:700;font-size:1rem">${f.total_views}</div>Views</div>
          <div><div style="font-weight:700;font-size:1rem">${f.total_bookings}</div>Bookings</div>
          <div><div style="font-weight:700;font-size:1rem">${f.avg_rating || '—'}</div>Avg Rating</div>
        </div>
      </a>`;
  }

  // (toggleCreateForm/createFranchise now defined earlier, before the branching)

  // ── Detail view: one franchise's locations + management tools ───────
  async function renderDetail(id) {
    main.innerHTML = `<div class="container" style="max-width:900px;margin:0 auto;padding:2rem 1rem 4rem"><div class="skeleton" style="height:300px;border-radius:16px"></div></div>`;
    let franchise, locations, myBusinesses = [];
    try {
      ({ franchise, locations } = await API.get(`/franchises/${id}`));
      ({ businesses: myBusinesses } = await API.get('/businesses/my').catch(() => ({ businesses: [] })));
    } catch { toast.error('Failed to load franchise'); main.innerHTML = ''; return; }

    const unassigned = (myBusinesses || []).filter(b => b.franchise_id !== id);

    main.innerHTML = `
      <div class="container" style="max-width:900px;margin:0 auto;padding:2rem 1rem 4rem">
        <a href="/franchise-manager" class="btn btn--ghost btn--sm" style="margin-bottom:1rem"><i class="fa-solid fa-arrow-left"></i> All Franchises</a>

        <div class="card" style="padding:1.5rem;margin-bottom:1.5rem;display:flex;gap:1.25rem;align-items:center;flex-wrap:wrap">
          <div style="text-align:center">
            <div id="fLogoPreview" style="width:64px;height:64px;border-radius:12px;background:var(--clr-surface-2);display:flex;align-items:center;justify-content:center;overflow:hidden;margin-bottom:.4rem">
              ${franchise.logo_url ? `<img src="${franchise.logo_url}" style="width:100%;height:100%;object-fit:cover">` : `<span style="font-size:1.3rem;font-weight:700;color:var(--clr-primary)">${franchise.name.charAt(0)}</span>`}
            </div>
            <label class="btn btn--ghost btn--sm" style="cursor:pointer;font-size:.7rem"><i class="fa-solid fa-upload"></i><input type="file" accept="image/*" hidden onchange="uploadFranchiseLogo(this)"></label>
          </div>
          <div style="flex:1;min-width:200px">
            <h1 style="font-size:1.4rem;font-weight:800;margin:0 0 .25rem">${franchise.name}</h1>
            <p style="color:var(--clr-text-2);font-size:.85rem;margin:0">${franchise.description || 'No description yet.'}</p>
          </div>
          <div style="display:flex;gap:.5rem;flex-wrap:wrap">
            <button class="btn btn--outline btn--sm" onclick="applyBranding()"><i class="fa-solid fa-paintbrush"></i> Push Branding to All</button>
            <button class="btn btn--ghost btn--sm" style="color:var(--clr-danger)" onclick="deleteFranchise()"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>

        <div class="card" style="padding:1.25rem;margin-bottom:1.5rem">
          <h3 style="font-weight:700;font-size:.95rem;margin-bottom:.75rem">Add a Location</h3>
          ${unassigned.length ? `
            <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center">
              <select id="addBizSelect" class="input" style="max-width:280px">
                ${unassigned.map(b => `<option value="${b.id}">${b.name}</option>`).join('')}
              </select>
              <button class="btn btn--primary btn--sm" onclick="addLocation()">Add</button>
            </div>` : `<p style="color:var(--clr-text-3);font-size:.85rem">All your businesses are already in this franchise, or you only have one business. Create more businesses to group them here.</p>`}
        </div>

        <h3 style="font-weight:700;margin-bottom:1rem">Locations (${locations.length})</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:1rem">
          ${locations.length ? locations.map(locationCard).join('') : `<p style="color:var(--clr-text-3)">No locations yet — add one above.</p>`}
        </div>
      </div>`;
  }

  function locationCard(b) {
    return `
      <div class="card" style="padding:1rem" data-biz-id="${b.id}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:.5rem">
          <div>
            <div style="font-weight:700">${b.name}</div>
            <div style="font-size:.78rem;color:var(--clr-text-3)">${b.city || ''}</div>
          </div>
          <button class="btn btn--ghost btn--sm" style="color:var(--clr-danger)" onclick="removeLocation('${b.id}')" title="Remove from franchise"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div style="display:flex;gap:1rem;margin-top:.5rem;font-size:.78rem;color:var(--clr-text-2)">
          <span>👁 ${b.view_count || 0}</span>
          <span>★ ${b.avg_rating || '—'}</span>
        </div>
        <a href="/business-edit?id=${b.id}" class="btn btn--outline btn--sm" style="width:100%;margin-top:.75rem;justify-content:center">Manage</a>
      </div>`;
  }

  // (uploadFranchiseLogo/applyBranding/deleteFranchise/addLocation/removeLocation now defined earlier, before the branching)
});