// assets/js/deals-manager.js
document.addEventListener('DOMContentLoaded', async () => {
  loadComponents();
  if (!Auth.requireAuth()) return;

  const bizId = new URLSearchParams(location.search).get('id');
  if (!bizId) { location.href = '/pages/dashboard.html'; return; }

  document.getElementById('pageMain').innerHTML = `
    <div class="container" style="max-width:760px;margin:0 auto;padding:2rem 1rem 4rem">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-bottom:2rem;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:1rem">
          <a href="/pages/dashboard.html" class="btn btn--ghost btn--sm"><i class="fa-solid fa-arrow-left"></i></a>
          <h1 style="font-size:1.5rem;font-weight:800;margin:0">🎉 Deals Manager</h1>
        </div>
        <button class="btn btn--primary btn--sm" onclick="showDealForm()"><i class="fa-solid fa-plus"></i> New Deal</button>
      </div>

      <!-- Tip -->
      <div class="card" style="padding:1rem 1.25rem;margin-bottom:1.5rem;background:rgba(99,102,241,.06);border:1px solid rgba(99,102,241,.2)">
        <p style="font-size:.875rem;margin:0">💡 <strong>Tip:</strong> Deals appear on the <a href="/pages/deals.html" style="color:var(--clr-primary)">Deals page</a> and help attract new customers. Keep them short and urgent!</p>
      </div>

      <!-- Form -->
      <div id="dealForm" hidden class="card" style="padding:1.5rem;margin-bottom:1.5rem">
        <h3 style="font-weight:700;margin-bottom:1.25rem" id="dealFormTitle">Create Deal</h3>
        <input type="hidden" id="editDealId">
        <div style="display:flex;flex-direction:column;gap:.875rem">
          <div><label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:.3rem">Deal Title * <span style="font-weight:400;color:var(--clr-text-3)">(e.g. "Buy 2 Get 1 Free")</span></label>
            <input id="dTitle" class="input" placeholder="e.g. 20% Off All Meals This Weekend!" style="width:100%"></div>
          <div><label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:.3rem">Discount Text <span style="font-weight:400;color:var(--clr-text-3)">(shown as badge)</span></label>
            <input id="dDiscount" class="input" placeholder="e.g. 20% OFF · BOGO · GHS 50 OFF" style="width:100%"></div>
          <div><label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:.3rem">Description</label>
            <textarea id="dDesc" rows="3" class="input" placeholder="More details about the deal…" style="width:100%;resize:vertical"></textarea></div>
          <div><label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:.3rem">Expires On *</label>
            <input id="dExpiry" type="datetime-local" class="input" style="width:100%;max-width:280px"></div>
          <div style="display:flex;gap:.5rem">
            <button class="btn btn--primary btn--sm" onclick="saveDeal()">Save Deal</button>
            <button class="btn btn--ghost btn--sm" onclick="cancelDealForm()">Cancel</button>
          </div>
        </div>
      </div>

      <!-- List -->
      <div id="dealsList"><div class="skeleton" style="height:200px;border-radius:16px"></div></div>

      <!-- Coupons -->
      <hr style="border:none;border-top:1px solid var(--clr-border);margin:2.5rem 0 1.5rem">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-bottom:1rem;flex-wrap:wrap">
        <h2 style="font-size:1.25rem;font-weight:800;margin:0">🏷️ Coupon Codes</h2>
        <button class="btn btn--outline btn--sm" onclick="showCouponForm()"><i class="fa-solid fa-plus"></i> New Coupon</button>
      </div>
      <div id="couponForm" hidden class="card" style="padding:1.5rem;margin-bottom:1.5rem">
        <h3 style="font-weight:700;margin-bottom:1.25rem">Create Coupon</h3>
        <div style="display:flex;flex-direction:column;gap:.875rem">
          <div><label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:.3rem">Code *</label>
            <input id="cCode" class="form-input" placeholder="e.g. WELCOME10" style="text-transform:uppercase"></div>
          <div style="display:flex;gap:.6rem">
            <select id="cType" class="form-select" style="flex:1">
              <option value="percent">Percent off</option>
              <option value="fixed">Fixed amount off (GH₵)</option>
            </select>
            <input id="cValue" type="number" class="form-input" placeholder="Value" style="flex:1">
          </div>
          <div><label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:.3rem">Minimum order (GH₵)</label>
            <input id="cMinOrder" type="number" class="form-input" placeholder="0"></div>
          <div><label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:.3rem">Max uses (optional)</label>
            <input id="cMaxUses" type="number" class="form-input" placeholder="Unlimited"></div>
          <div><label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:.3rem">Expires On (optional)</label>
            <input id="cExpiry" type="datetime-local" class="form-input" style="max-width:280px"></div>
          <div style="display:flex;gap:.5rem">
            <button class="btn btn--primary btn--sm" onclick="saveCoupon()">Save Coupon</button>
            <button class="btn btn--ghost btn--sm" onclick="document.getElementById('couponForm').hidden=true">Cancel</button>
          </div>
        </div>
      </div>
      <div id="couponsList"><div class="skeleton" style="height:120px;border-radius:16px"></div></div>
    </div>`;

  // Set min date to now
  const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  document.getElementById('dExpiry').min = now.toISOString().slice(0, 16);

  window.showDealForm = (deal) => {
    document.getElementById('dealForm').hidden = false;
    document.getElementById('dealFormTitle').textContent = deal ? 'Edit Deal' : 'Create Deal';
    document.getElementById('editDealId').value = deal?.id || '';
    document.getElementById('dTitle').value    = deal?.title || '';
    document.getElementById('dDiscount').value = deal?.discount_text || '';
    document.getElementById('dDesc').value     = deal?.description || '';
    document.getElementById('dExpiry').value   = deal?.expires_at ? deal.expires_at.slice(0, 16) : '';
    document.getElementById('dealForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  window.cancelDealForm = () => {
    document.getElementById('dealForm').hidden = true;
    document.getElementById('editDealId').value = '';
  };

  window.saveDeal = async () => {
    const title   = document.getElementById('dTitle').value.trim();
    const expires = document.getElementById('dExpiry').value;
    if (!title || !expires) { toast.warning('Title and expiry date are required'); return; }

    const body = {
      business_id:    bizId,
      title,
      discount_text:  document.getElementById('dDiscount').value.trim() || null,
      description:    document.getElementById('dDesc').value.trim() || null,
      expires_at:     new Date(expires).toISOString(),
    };

    try {
      const id = document.getElementById('editDealId').value;
      if (id) {
        await API.patch(`/deals/${id}`, body);
        toast.success('Deal updated!');
      } else {
        await API.post('/deals', body);
        toast.success('Deal created! 🎉');
      }
      cancelDealForm();
      loadDeals();
    } catch (e) { toast.error(e.message || 'Failed to save deal'); }
  };

  window.deleteDeal = async (id) => {
    if (!confirm('Delete this deal?')) return;
    try {
      await API.delete(`/deals/${id}`);
      toast.success('Deal deleted');
      loadDeals();
    } catch { toast.error('Failed to delete'); }
  };

  async function loadDeals() {
    try {
      const { deals: allDeals } = await API.get('/deals/my');
      const myDeals = allDeals.filter(d => d.business_id === bizId);
      const el = document.getElementById('dealsList');

      if (!myDeals.length) {
        el.innerHTML = `
          <div class="card" style="padding:3rem;text-align:center">
            <div style="font-size:3rem;margin-bottom:1rem">🎉</div>
            <h3>No active deals</h3>
            <p style="color:var(--clr-text-2);margin-bottom:1.25rem">Create a deal to attract more customers and appear on the Deals page.</p>
            <button class="btn btn--primary" onclick="showDealForm()">Create First Deal</button>
          </div>`;
        return;
      }

      el.innerHTML = myDeals.map(d => {
        const exp     = new Date(d.expires_at);
        const expired = exp < new Date();
        const hoursLeft = Math.max(0, Math.floor((exp - Date.now()) / 3600000));
        const urgent  = !expired && hoursLeft < 24;

        return `
          <div class="card" style="padding:1.25rem;margin-bottom:.75rem;opacity:${expired ? '.55' : '1'}">
            <div style="display:flex;align-items:flex-start;gap:1rem;flex-wrap:wrap">
              <div style="flex:1;min-width:0">
                <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.4rem">
                  ${d.discount_text ? `<span style="background:var(--clr-primary);color:#fff;padding:.2rem .6rem;border-radius:20px;font-size:.75rem;font-weight:700">${d.discount_text}</span>` : ''}
                  ${expired ? '<span class="badge badge--danger">Expired</span>' : urgent ? `<span class="badge badge--warning">🔥 ${hoursLeft}h left</span>` : '<span class="badge badge--success">Active</span>'}
                </div>
                <div style="font-weight:700;font-size:1rem;margin-bottom:.25rem">${d.title}</div>
                ${d.description ? `<p style="font-size:.85rem;color:var(--clr-text-2);margin-bottom:.4rem">${d.description}</p>` : ''}
                <div style="font-size:.78rem;color:var(--clr-text-3)">
                  <i class="fa-regular fa-clock"></i> ${expired ? 'Expired' : 'Expires'} ${formatDate(d.expires_at)}
                </div>
              </div>
              <div style="display:flex;gap:.4rem;flex-shrink:0">
                ${!expired ? `<button class="btn btn--outline btn--sm" onclick='showDealForm(${JSON.stringify(d).replace(/'/g,"&apos;")})'>Edit</button>` : ''}
                <button class="btn btn--danger btn--sm" onclick="deleteDeal('${d.id}')"><i class="fa-solid fa-trash"></i></button>
              </div>
            </div>
          </div>`;
      }).join('');
    } catch { document.getElementById('dealsList').innerHTML = '<p style="color:var(--clr-danger)">Failed to load deals.</p>'; }
  }

  // ── Coupons ────────────────────────────────────────────────
  window.showCouponForm = () => {
    document.getElementById('couponForm').hidden = false;
    document.getElementById('couponForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  window.saveCoupon = async () => {
    const code = document.getElementById('cCode').value.trim();
    const discount_value = Number(document.getElementById('cValue').value);
    if (!code || !discount_value) { toast.warning('Code and value are required'); return; }
    const body = {
      code, discount_type: document.getElementById('cType').value, discount_value,
      min_order_amount: Number(document.getElementById('cMinOrder').value) || 0,
      max_uses: Number(document.getElementById('cMaxUses').value) || null,
      expires_at: document.getElementById('cExpiry').value ? new Date(document.getElementById('cExpiry').value).toISOString() : null,
    };
    try {
      await API.post(`/coupons/business/${bizId}`, body);
      toast.success('Coupon created! 🏷️');
      document.getElementById('couponForm').hidden = true;
      loadCoupons();
    } catch (e) { toast.error(e.message || 'Failed to save coupon'); }
  };

  window.toggleCoupon = async (id, is_active) => {
    try { await API.patch(`/coupons/${id}`, { is_active: !is_active }); loadCoupons(); }
    catch (e) { toast.error(e.message); }
  };

  window.deleteCoupon = async (id) => {
    if (!confirm('Delete this coupon?')) return;
    try { await API.delete(`/coupons/${id}`); toast.success('Coupon deleted'); loadCoupons(); }
    catch { toast.error('Failed to delete'); }
  };

  async function loadCoupons() {
    try {
      const { coupons } = await API.get(`/coupons/business/${bizId}`);
      const el = document.getElementById('couponsList');
      if (!coupons.length) {
        el.innerHTML = `<div class="card" style="padding:2rem;text-align:center;color:var(--clr-text-2)">No coupons yet. Create one to give repeat customers a reason to check out.</div>`;
        return;
      }
      el.innerHTML = coupons.map(c => `
        <div class="card" style="padding:1rem 1.25rem;margin-bottom:.6rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.6rem">
          <div>
            <code style="font-weight:700">${c.code}</code>
            <span style="margin-left:.5rem;font-size:.85rem;color:var(--clr-text-2)">${c.discount_type === 'percent' ? `${c.discount_value}% off` : `GH₵${c.discount_value} off`}</span>
            <div style="font-size:.75rem;color:var(--clr-text-3)">${c.used_count}${c.max_uses ? `/${c.max_uses}` : ''} used${c.expires_at ? ` · expires ${formatDate(c.expires_at)}` : ''}</div>
          </div>
          <div style="display:flex;gap:.4rem">
            <button class="btn btn--outline btn--sm" onclick="toggleCoupon('${c.id}',${c.is_active})">${c.is_active ? 'Deactivate' : 'Activate'}</button>
            <button class="btn btn--danger btn--sm" onclick="deleteCoupon('${c.id}')"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>`).join('');
    } catch { document.getElementById('couponsList').innerHTML = '<p style="color:var(--clr-danger)">Failed to load coupons.</p>'; }
  }

  loadDeals();
  loadCoupons();
});
