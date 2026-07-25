// assets/js/orders.js
document.addEventListener('DOMContentLoaded', async () => {
  loadComponents();
  if (!Auth.requireAuth()) return;

  const main = document.getElementById('pageMain');
  main.innerHTML = `
    <div class="container" style="max-width:800px;margin:0 auto;padding:2rem 1rem 4rem">
      <h1 style="font-size:1.5rem;font-weight:800;margin-bottom:1.5rem">My Orders</h1>
      <div id="ordersList"><div style="text-align:center;padding:3rem"><i class="fa-solid fa-spinner fa-spin" style="font-size:1.5rem;color:var(--clr-primary)"></i></div></div>
    </div>`;

  try {
    const { orders } = await API.get('/orders/my');
    const list = document.getElementById('ordersList');
    if (!orders?.length) {
      list.innerHTML = emptyState({
        icon: '📦', title: 'No orders yet', subtitle: "Once you order from a business, you'll see it here.",
        actionHtml: `<a href="/pages/directory.html" class="btn btn--primary">Browse Businesses</a>`,
      });
      return;
    }
    list.innerHTML = orders.map(o => `
      <div class="card" style="padding:1.25rem;margin-bottom:1rem">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:.5rem;margin-bottom:.75rem">
          <div>
            <div style="font-weight:700">${o.businesses?.name || 'Business'}</div>
            <div style="font-size:.8rem;color:var(--clr-text-3)">${o.order_number} · ${new Date(o.created_at).toLocaleDateString()}</div>
          </div>
          ${orderStatusBadge(o.status)}
        </div>
        <div style="font-size:.85rem;color:var(--clr-text-2);margin-bottom:.5rem">
          ${o.order_items.map(i => `${i.quantity} × ${i.name_snapshot}`).join(', ')}
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-weight:700">${formatCurrency(o.total)}</span>
          <span style="font-size:.8rem;color:var(--clr-text-3);text-transform:capitalize">${o.fulfillment_type}</span>
        </div>
        <div style="margin-top:.75rem;text-align:right">
          <button class="btn btn--outline btn--sm" onclick="orderAgain('${o.id}')">
            <i class="fa-solid fa-rotate-right"></i> Order Again
          </button>
        </div>
      </div>`).join('');
    window._myOrders = orders;
  } catch {
    document.getElementById('ordersList').innerHTML = `<div style="text-align:center;padding:3rem;color:var(--clr-danger)">Couldn't load your orders.</div>`;
  }

  window.orderAgain = async (orderId) => {
    const order = (window._myOrders || []).find(o => o.id === orderId);
    if (!order) return;
    // order_items.product_id is nullable (ON DELETE SET NULL) — if the
    // business has since deleted a product, we can't re-add it, but we
    // can still re-add everything else rather than failing the whole thing.
    const reorderable = order.order_items.filter(i => i.product_id);
    if (!reorderable.length) {
      toast.warning('None of these items are available anymore.');
      return;
    }
    try {
      await Promise.all(reorderable.map(i => API.post(`/cart/${order.business_id}/items`, { product_id: i.product_id, quantity: i.quantity })));
      if (reorderable.length < order.order_items.length) {
        toast.warning(`${order.order_items.length - reorderable.length} item(s) are no longer available and were skipped.`);
      }
      location.href = `/pages/checkout.html?biz=${order.business_id}`;
    } catch (e) {
      toast.error(e.message || 'Some items could not be added — they may be out of stock.');
    }
  };
});
