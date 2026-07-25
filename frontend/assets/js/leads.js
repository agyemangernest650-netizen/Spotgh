// assets/js/leads.js
document.addEventListener('DOMContentLoaded', async () => {
  loadComponents();
  document.title = 'Lead Marketplace | SpotGH';
  const main = document.getElementById('pageMain');
  const params = new URLSearchParams(location.search);
  const leadId = params.get('id');

  if (leadId) { await renderDetail(leadId); }
  else { await renderList(); }

  // ── List view ────────────────────────────────────────────
  async function renderList() {
    main.innerHTML = `
      <div class="container" style="padding:2rem 1rem 4rem;max-width:960px">
        <div style="text-align:center;margin-bottom:2rem">
          <h1 style="font-size:clamp(1.75rem,5vw,3rem);font-weight:800;margin-bottom:.5rem">📢 Lead Marketplace</h1>
          <p style="color:var(--clr-text-2);max-width:560px;margin:0 auto">Post what you need — nearby businesses send you quotes directly. Free for customers.</p>
          <button class="btn btn--primary" style="margin-top:1.25rem" onclick="showPostLeadForm()"><i class="fa-solid fa-plus"></i> Post a Request</button>
          ${Auth.isLoggedIn() ? '<a href="#" onclick="showMyLeads();return false;" class="btn btn--ghost" style="margin-top:1.25rem;margin-left:.5rem">My Requests</a>' : ''}
        </div>
        <div id="leadsBody">
          <div id="leadsGrid" style="display:grid;gap:1rem">
            ${[...Array(4)].map(()=>'<div class="card skeleton" style="height:120px"></div>').join('')}
          </div>
        </div>
      </div>`;
    await loadOpenLeads();
  }

  async function loadOpenLeads() {
    try {
      const { leads } = await API.get('/leads?limit=20');
      const grid = document.getElementById('leadsGrid');
      if (!grid) return;
      if (!leads.length) {
        grid.innerHTML = `<div style="text-align:center;padding:3rem 1rem;color:var(--clr-text-2)">No open requests right now. Be the first to post one!</div>`;
        return;
      }
      grid.innerHTML = leads.map(leadCard).join('');
    } catch (err) {
      document.getElementById('leadsGrid').innerHTML = `<p style="color:var(--clr-danger)">Failed to load leads.</p>`;
    }
  }

  function leadCard(l) {
    const budget = l.budget_min && l.budget_max ? `GH₵${l.budget_min}–${l.budget_max}` : (l.budget_max ? `Up to GH₵${l.budget_max}` : 'Budget flexible');
    const quotes = l.lead_quotes?.[0]?.count ?? 0;
    return `
      <a href="/pages/leads.html?id=${l.id}" class="card" style="padding:1.1rem;display:block;text-decoration:none;color:inherit">
        <div style="display:flex;justify-content:space-between;gap:.5rem;flex-wrap:wrap">
          <strong style="font-size:1.05rem">${l.title}</strong>
          <span class="badge" style="background:var(--clr-surface-2);color:var(--clr-text-2)">${quotes} quote${quotes===1?'':'s'}</span>
        </div>
        <p style="color:var(--clr-text-2);font-size:.9rem;margin:.4rem 0">${(l.description||'').slice(0,140)}${l.description?.length>140?'…':''}</p>
        <div style="font-size:.8rem;color:var(--clr-text-3);display:flex;gap:1rem;flex-wrap:wrap">
          <span><i class="fa-solid fa-location-dot"></i> ${l.city}</span>
          <span><i class="fa-solid fa-sack-dollar"></i> ${budget}</span>
          ${l.needed_by ? `<span><i class="fa-regular fa-calendar"></i> By ${formatDate(l.needed_by)}</span>` : ''}
          ${l.categories?.name ? `<span><i class="fa-solid fa-tag"></i> ${l.categories.name}</span>` : ''}
        </div>
      </a>`;
  }

  // ── My leads (customer) ─────────────────────────────────
  window.showMyLeads = async () => {
    if (!Auth.requireAuth()) return;
    const body = document.getElementById('leadsBody');
    body.innerHTML = `<div style="text-align:center;padding:2rem"><span class="spinner-sm"></span></div>`;
    try {
      const { leads } = await API.get('/leads/mine');
      if (!leads.length) {
        body.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--clr-text-2)">You haven't posted any requests yet.</div>`;
        return;
      }
      body.innerHTML = `<div style="display:grid;gap:1rem">${leads.map(l => `
        <a href="/pages/leads.html?id=${l.id}" class="card" style="padding:1.1rem;display:block;text-decoration:none;color:inherit">
          <div style="display:flex;justify-content:space-between;gap:.5rem">
            <strong>${l.title}</strong>
            <span class="badge badge--${l.status === 'open' ? 'success' : l.status === 'awarded' ? 'primary' : 'warning'}">${l.status}</span>
          </div>
          <p style="color:var(--clr-text-2);font-size:.85rem;margin:.35rem 0 0">${l.lead_quotes?.length || 0} quote(s) received</p>
        </a>`).join('')}</div>`;
    } catch { body.innerHTML = `<p style="color:var(--clr-danger)">Failed to load your requests.</p>`; }
  };

  // ── Post a lead form ─────────────────────────────────────
  window.showPostLeadForm = async () => {
    if (!Auth.requireAuth()) return;
    let categories = [];
    try { ({ categories } = await API.get('/categories')); } catch {}
    const body = document.getElementById('leadsBody');
    body.innerHTML = `
      <div class="card" style="padding:1.5rem;max-width:560px;margin:0 auto">
        <h3 style="margin-top:0">What do you need?</h3>
        <form id="postLeadForm" style="display:grid;gap:.9rem">
          <input class="form-input" name="title" placeholder="e.g. Caterer for 200 people" required>
          <textarea class="form-textarea" name="description" rows="4" placeholder="Describe what you need, headcount, style of service, etc." required></textarea>
          <select class="form-select" name="category_id">
            <option value="">Category (optional)</option>
            ${(categories||[]).filter(c=>!c.parent_id).map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}
          </select>
          <input class="form-input" name="city" placeholder="City (e.g. Accra)" required>
          <div style="display:flex;gap:.6rem">
            <input class="form-input" name="budget_min" type="number" placeholder="Min budget GH₵" style="flex:1">
            <input class="form-input" name="budget_max" type="number" placeholder="Max budget GH₵" style="flex:1">
          </div>
          <input class="form-input" name="needed_by" type="date">
          <button type="submit" class="btn btn--primary">Post Request</button>
        </form>
      </div>`;
    document.getElementById('postLeadForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button');
      setLoading(btn, true, 'Posting...');
      const fd = new FormData(e.target);
      const payload = Object.fromEntries(fd.entries());
      if (!payload.category_id) delete payload.category_id;
      try {
        const { lead } = await API.post('/leads', payload);
        toast.success('Request posted! Nearby businesses have been notified.');
        location.href = `/pages/leads.html?id=${lead.id}`;
      } catch (err) { toast.error(err.message); setLoading(btn, false); }
    });
  };

  // ── Lead detail ──────────────────────────────────────────
  async function renderDetail(id) {
    main.innerHTML = `<div class="container" style="padding:2rem 1rem;max-width:720px"><div class="card skeleton" style="height:300px"></div></div>`;
    try {
      const { lead } = await API.get(`/leads/${id}`);
      const user = Auth.getUser();
      const isOwner = user && lead.customer_id === user.id;
      const budget = lead.budget_min && lead.budget_max ? `GH₵${lead.budget_min}–${lead.budget_max}` : (lead.budget_max ? `Up to GH₵${lead.budget_max}` : 'Flexible');

      main.innerHTML = `
        <div class="container" style="padding:2rem 1rem 4rem;max-width:720px">
          <a href="/pages/leads.html" style="font-size:.85rem;color:var(--clr-text-2)"><i class="fa-solid fa-arrow-left"></i> Back to Leads</a>
          <div class="card" style="padding:1.5rem;margin-top:1rem">
            <div style="display:flex;justify-content:space-between;gap:.5rem;flex-wrap:wrap">
              <h2 style="margin:0">${lead.title}</h2>
              <span class="badge badge--${lead.status==='open'?'success':lead.status==='awarded'?'primary':'warning'}">${lead.status}</span>
            </div>
            <p style="color:var(--clr-text-2)">${lead.description}</p>
            <div style="font-size:.85rem;color:var(--clr-text-3);display:flex;gap:1.25rem;flex-wrap:wrap;margin-top:.5rem">
              <span><i class="fa-solid fa-location-dot"></i> ${lead.city}</span>
              <span><i class="fa-solid fa-sack-dollar"></i> ${budget}</span>
              ${lead.needed_by ? `<span><i class="fa-regular fa-calendar"></i> Needed by ${formatDate(lead.needed_by)}</span>` : ''}
            </div>
            ${isOwner && lead.status === 'open' ? `<button class="btn btn--ghost btn--sm" style="margin-top:1rem" onclick="cancelLead('${lead.id}')">Cancel Request</button>` : ''}
          </div>

          ${!isOwner && Auth.isLoggedIn() && lead.status === 'open' ? `
          <div class="card" style="padding:1.5rem;margin-top:1rem">
            <h3 style="margin-top:0">Send a Quote</h3>
            <p style="font-size:.85rem;color:var(--clr-text-2)">Responding to leads requires a Pro or Enterprise business plan.</p>
            <form id="quoteForm" style="display:grid;gap:.75rem">
              <input class="form-input" name="business_id" placeholder="Your business ID" required title="Find this on your dashboard">
              <input class="form-input" name="price" type="number" placeholder="Your quote (GH₵)" required>
              <textarea class="form-textarea" name="message" rows="3" placeholder="Introduce your business and what's included" required></textarea>
              <button type="submit" class="btn btn--primary">Send Quote</button>
            </form>
          </div>` : ''}

          <div style="margin-top:1.5rem">
            <h3>Quotes ${lead.lead_quotes?.length ? `(${lead.lead_quotes.length})` : ''}</h3>
            ${!lead.lead_quotes?.length ? '<p style="color:var(--clr-text-2)">No quotes yet.</p>' :
              lead.lead_quotes.map(q => `
                <div class="card" style="padding:1.1rem;margin-bottom:.75rem;display:flex;gap:1rem;align-items:flex-start;flex-wrap:wrap">
                  ${q.businesses?.logo_url ? `<img src="${q.businesses.logo_url}" style="width:48px;height:48px;border-radius:8px;object-fit:cover">` : ''}
                  <div style="flex:1;min-width:200px">
                    <strong>${q.businesses?.name || 'Business'}</strong>
                    ${q.status==='accepted' ? '<span class="badge badge--success" style="margin-left:.5rem">Awarded</span>' : ''}
                    <div style="font-weight:700;color:var(--clr-primary);margin:.25rem 0">GH₵${q.price}</div>
                    <p style="font-size:.9rem;color:var(--clr-text-2);margin:0">${q.message}</p>
                  </div>
                  ${isOwner && lead.status === 'open' ? `<button class="btn btn--primary btn--sm" onclick="awardLead('${lead.id}','${q.id}')">Accept Quote</button>` : ''}
                </div>`).join('')}
          </div>
        </div>`;

      document.getElementById('quoteForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button');
        setLoading(btn, true, 'Sending...');
        const payload = Object.fromEntries(new FormData(e.target).entries());
        try {
          await API.post(`/leads/${lead.id}/quotes`, payload);
          toast.success('Quote sent!');
          renderDetail(lead.id);
        } catch (err) { toast.error(err.message); setLoading(btn, false); }
      });
    } catch (err) {
      main.innerHTML = `<div class="container" style="padding:3rem 1rem;text-align:center"><p style="color:var(--clr-danger)">Lead not found.</p></div>`;
    }
  }

  window.awardLead = async (leadId, quoteId) => {
    if (!confirm('Accept this quote? The other quotes will be marked declined.')) return;
    try { await API.patch(`/leads/${leadId}/award/${quoteId}`); toast.success('Quote accepted!'); renderDetail(leadId); }
    catch (err) { toast.error(err.message); }
  };

  window.cancelLead = async (leadId) => {
    if (!confirm('Cancel this request?')) return;
    try { await API.patch(`/leads/${leadId}/cancel`); toast.success('Request cancelled'); renderDetail(leadId); }
    catch (err) { toast.error(err.message); }
  };
});
