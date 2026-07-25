// assets/js/track-order.js
document.addEventListener('DOMContentLoaded', () => {
  loadComponents();

  const params = new URLSearchParams(location.search);
  const main = document.getElementById('pageMain');
  main.innerHTML = `
    <div class="container" style="max-width:520px;margin:0 auto;padding:2rem 1rem 4rem">
      <h1 style="font-size:1.4rem;font-weight:800;margin-bottom:.5rem">Track Your Order</h1>
      <p style="color:var(--clr-text-2);font-size:.9rem;margin-bottom:1.5rem">Enter your order number and the phone number you used at checkout.</p>
      <form id="trackForm" class="card" style="padding:1.25rem;margin-bottom:1.5rem">
        <div class="form-group">
          <label>Order number</label>
          <input class="input" name="order_number" placeholder="ORD-XXXXXXXX" required value="${params.get('order') || ''}" style="text-transform:uppercase">
        </div>
        <div class="form-group">
          <label>Phone number</label>
          <input class="input" name="phone" type="tel" placeholder="024xxxxxxx" required>
        </div>
        <button type="submit" class="btn btn--primary btn--full" id="trackBtn">Track Order</button>
      </form>
      <div id="trackResult"></div>
    </div>`;

  document.getElementById('trackForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('trackBtn');
    const result = document.getElementById('trackResult');
    const fd = new FormData(e.target);
    setLoading(btn, true, 'Searching…');
    result.innerHTML = '';
    try {
      const { order } = await API.get(`/orders/track?order_number=${encodeURIComponent(fd.get('order_number').trim().toUpperCase())}&phone=${encodeURIComponent(fd.get('phone').trim())}`);
      result.innerHTML = `
        <div class="card" style="padding:1.25rem">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.75rem">
            <div>
              <div style="font-weight:700">${order.businesses?.name || 'Business'}</div>
              <div style="font-size:.8rem;color:var(--clr-text-3)">${order.order_number} · ${new Date(order.created_at).toLocaleString()}</div>
            </div>
            ${orderStatusBadge(order.status)}
          </div>
          <div style="font-size:.85rem;color:var(--clr-text-2);margin-bottom:.75rem">
            ${order.order_items.map(i => `${i.quantity} × ${i.name_snapshot}`).join('<br>')}
          </div>
          <div style="display:flex;justify-content:space-between;font-weight:700;margin-bottom:.5rem">
            <span>Total</span><span>${formatCurrency(order.total)}</span>
          </div>
          <div style="font-size:.8rem;color:var(--clr-text-3);text-transform:capitalize">${order.fulfillment_type}${order.delivery_address ? ` — ${order.delivery_address}` : ''}</div>
          ${order.businesses?.phone ? `<a href="tel:${order.businesses.phone}" class="btn btn--outline btn--sm" style="margin-top:1rem"><i class="fa-solid fa-phone"></i> Call ${order.businesses.name}</a>` : ''}
        </div>`;
    } catch (err) {
      result.innerHTML = `<div class="alert alert--error"><i class="fa-solid fa-circle-exclamation"></i> ${err.message || 'Order not found'}</div>`;
    } finally {
      setLoading(btn, false, 'Track Order');
    }
  });
});
