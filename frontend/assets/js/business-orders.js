// assets/js/business-orders.js
document.addEventListener('DOMContentLoaded', async () => {
  loadComponents();
  if (!Auth.requireAuth()) return;

  const bizId = new URLSearchParams(location.search).get('id');
  if (!bizId) { location.href = '/dashboard'; return; }

  const main = document.getElementById('pageMain');
  main.innerHTML = `
    <div class="container" style="max-width:900px;margin:0 auto;padding:2rem 1rem 4rem">
      <div id="bizAdminNav"></div>
      <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem;flex-wrap:wrap">
        ${['all','pending','confirmed','preparing','ready','delivered','completed','cancelled'].map(s=>`
          <button class="btn ${s==='all'?'btn--primary':'btn--ghost'} btn--sm filter-btn" data-status="${s}">
            ${s.charAt(0).toUpperCase()+s.slice(1)}
          </button>`).join('')}
      </div>
      <div id="ordersList"><div class="skeleton" style="height:200px;border-radius:16px"></div></div>
    </div>`;
  renderBizAdminNav('bizAdminNav', bizId, 'orders');

  const statusFlow = { pending: 'confirmed', confirmed: 'preparing', preparing: 'ready', ready: 'delivered', delivered: 'completed' };
  function waLink(phone, prefillText) {
    let digits = (phone || '').replace(/\D/g, '');
    if (digits.startsWith('0')) digits = '233' + digits.slice(1); // Ghana local -> international
    return `https://wa.me/${digits}?text=${encodeURIComponent(prefillText)}`;
  }
  let activeStatus = '';

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.className = 'btn btn--ghost btn--sm filter-btn');
      btn.className = 'btn btn--primary btn--sm filter-btn';
      activeStatus = btn.dataset.status === 'all' ? '' : btn.dataset.status;
      loadOrders();
    });
  });

  async function loadOrders() {
    const el = document.getElementById('ordersList');
    try {
      const qs = activeStatus ? `?status=${activeStatus}` : '';
      const { orders } = await API.get(`/orders/business/${bizId}${qs}`);
      if (!orders?.length) {
        el.innerHTML = `<div class="card">${emptyState({ icon: '🛍️', title: 'No orders yet', subtitle: 'Customer orders will appear here.' })}</div>`;
        return;
      }
      el.innerHTML = orders.map(o => `
        <div class="card" style="padding:1.25rem;margin-bottom:1rem">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:.5rem;margin-bottom:.5rem">
            <div>
              <div style="font-weight:700">${o.order_number} — ${o.customer_name}</div>
              <div style="font-size:.8rem;color:var(--clr-text-3)">
                <a href="tel:${o.customer_phone}">${o.customer_phone}</a> · ${new Date(o.created_at).toLocaleString()}
                · <span style="text-transform:capitalize">${o.fulfillment_type}</span>${o.fulfillment_type==='delivery' ? `: ${o.delivery_address}` : ''}
              </div>
            </div>
            ${orderStatusBadge(o.status)}
          </div>
          <div style="font-size:.85rem;color:var(--clr-text-2);margin-bottom:.75rem">
            ${o.order_items.map(i => `${i.quantity} × ${i.name_snapshot} (${formatCurrency(i.price_snapshot)})`).join('<br>')}
          </div>
          ${o.notes ? `<div style="font-size:.8rem;color:var(--clr-text-2);font-style:italic;margin-bottom:.75rem">"${o.notes}"</div>` : ''}
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-weight:700">Total: ${formatCurrency(o.total)}</span>
            <div style="display:flex;gap:.5rem">
              <a href="${waLink(o.customer_phone, `Hi ${o.customer_name}, this is regarding your order ${o.order_number} — `)}" target="_blank" rel="noopener" class="btn btn--ghost btn--sm" style="color:#25D366" title="Message on WhatsApp"><i class="fa-brands fa-whatsapp"></i></a>
              ${!['completed','cancelled'].includes(o.status) ? `<button class="btn btn--ghost btn--sm" style="color:var(--clr-danger)" onclick="updateOrderStatus('${o.id}','cancelled')">Cancel</button>` : ''}
              ${statusFlow[o.status] ? `<button class="btn btn--primary btn--sm" onclick="updateOrderStatus('${o.id}','${statusFlow[o.status]}')">Mark ${statusFlow[o.status]}</button>` : ''}
            </div>
          </div>
        </div>`).join('');
    } catch {
      el.innerHTML = `<div class="card" style="padding:3rem;text-align:center;color:var(--clr-danger)">Couldn't load orders.</div>`;
    }
  }

  window.updateOrderStatus = async (orderId, status) => {
    try {
      await API.patch(`/orders/${orderId}/status`, { status });
      toast.success(`Order marked ${status}`);
      loadOrders();
    } catch (e) { toast.error(e.message || 'Could not update order'); }
  };

  loadOrders();
});
