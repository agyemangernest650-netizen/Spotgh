// assets/js/checkout.js
document.addEventListener('DOMContentLoaded', async () => {
  loadComponents();

  const bizId = new URLSearchParams(location.search).get('biz');
  const main = document.getElementById('pageMain');
  if (!bizId) { main.innerHTML = `<div class="container" style="padding:3rem 1rem;text-align:center">No business specified.</div>`; return; }

  main.innerHTML = `<div class="container" style="max-width:640px;margin:0 auto;padding:2rem 1rem 4rem">
    <div id="checkoutContent"><div style="text-align:center;padding:3rem"><i class="fa-solid fa-spinner fa-spin" style="font-size:1.5rem;color:var(--clr-primary)"></i></div></div>
  </div>`;

  const content = document.getElementById('checkoutContent');
  const user = Auth.getUser();

  try {
    const [{ items, subtotal }, { business }] = await Promise.all([
      API.get(`/cart/${bizId}`),
      API.get(`/businesses/${bizId}`),
    ]);

    if (!items?.length) {
      content.innerHTML = emptyState({
        icon: '🛒', title: 'Your cart is empty',
        actionHtml: `<a href="/business?slug=${business.slug}" class="btn btn--primary">Browse ${business.name}</a>`,
      });
      return;
    }

    renderCheckoutForm(business, items, subtotal);
  } catch (e) {
    content.innerHTML = `<div style="text-align:center;padding:3rem;color:var(--clr-danger)">Couldn't load checkout. Please go back and try again.</div>`;
  }

  function renderCheckoutForm(business, items, subtotal) {
    const hasZones = Array.isArray(business.delivery_zones) && business.delivery_zones.length > 0;
    content.innerHTML = `
      <h1 style="font-size:1.4rem;font-weight:800;margin-bottom:1.5rem">Checkout — ${business.name}</h1>

      <div class="card" style="padding:1.25rem;margin-bottom:1.5rem">
        ${items.map(i => `
          <div style="display:flex;justify-content:space-between;padding:.4rem 0;font-size:.9rem">
            <span>${i.quantity} × ${i.products_services.name}</span>
            <span>${formatCurrency(i.products_services.price * i.quantity)}</span>
          </div>`).join('')}
        <div style="border-top:1px solid var(--clr-border);margin-top:.5rem;padding-top:.5rem;display:flex;justify-content:space-between;font-weight:700">
          <span>Subtotal</span><span id="ckSubtotal">${formatCurrency(subtotal)}</span>
        </div>
        <div id="ckDeliveryLine" style="display:none;justify-content:space-between;font-size:.9rem;color:var(--clr-text-2)"><span>Delivery fee</span><span id="ckDeliveryFee">${formatCurrency(business.delivery_fee || 0)}</span></div>
        <div id="ckDiscountLine" style="display:none;justify-content:space-between;font-size:.9rem;color:var(--clr-success)"><span>Coupon discount</span><span id="ckDiscountAmount">-${formatCurrency(0)}</span></div>
        <div style="display:flex;justify-content:space-between;font-weight:800;font-size:1.1rem;margin-top:.5rem"><span>Total</span><span id="ckTotal">${formatCurrency(subtotal)}</span></div>
      </div>

      <form id="checkoutForm" class="card" style="padding:1.25rem">
        <div class="form-group">
          <label>Your name *</label>
          <input class="input" name="customer_name" required value="${user?.full_name || ''}">
        </div>
        <div class="form-group">
          <label>Phone number *</label>
          <input class="input" name="customer_phone" type="tel" required placeholder="024xxxxxxx">
        </div>
        <div class="form-group">
          <label>Email (optional)</label>
          <input class="input" name="customer_email" type="email" value="${user?.email || ''}">
        </div>
        <div class="form-group">
          <label>How will you get your order? *</label>
          <div style="display:flex;gap:1rem;margin-top:.5rem">
            <label style="display:flex;align-items:center;gap:.4rem;font-weight:400"><input type="radio" name="fulfillment_type" value="pickup" checked> Pickup</label>
            <label style="display:flex;align-items:center;gap:.4rem;font-weight:400"><input type="radio" name="fulfillment_type" value="delivery"> Delivery</label>
          </div>
        </div>
        <div class="form-group" id="deliveryAddressGroup" style="display:none">
          <label>Delivery address *</label>
          <textarea class="input" name="delivery_address" rows="2" placeholder="e.g. House number, street, landmark"></textarea>
        </div>
        ${hasZones ? `
        <div class="form-group" id="deliveryZoneGroup" style="display:none">
          <label>Delivery area *</label>
          <select class="input" name="delivery_zone_name" id="ckZoneSelect">
            <option value="">Select your area…</option>
            ${business.delivery_zones.map(z => `<option value="${z.name}" data-fee="${z.fee}">${z.name} — ${formatCurrency(z.fee)}</option>`).join('')}
          </select>
        </div>` : ''}
        <div class="form-group">
          <label>Order notes (optional)</label>
          <textarea class="input" name="notes" rows="2" placeholder="Any special instructions"></textarea>
        </div>
        <div class="form-group">
          <label>Coupon code (optional)</label>
          <div style="display:flex;gap:.5rem">
            <input class="input" id="ckCouponCode" placeholder="e.g. WELCOME10" style="flex:1;text-transform:uppercase">
            <button type="button" class="btn btn--outline btn--sm" id="ckApplyCoupon">Apply</button>
          </div>
          <div id="ckCouponMsg" style="font-size:.8rem;margin-top:.4rem"></div>
        </div>
        <div class="alert" style="background:var(--clr-surface-2);font-size:.85rem;margin-bottom:1rem">
          <i class="fa-solid fa-circle-info"></i> Pay ${business.name} directly by cash or mobile money on pickup/delivery — no online payment needed.
        </div>
        <button type="submit" class="btn btn--primary btn--full btn--lg" id="ckSubmitBtn">Place Order</button>
      </form>`;

    const radios = content.querySelectorAll('input[name="fulfillment_type"]');
    const addrGroup = document.getElementById('deliveryAddressGroup');
    const zoneGroup = document.getElementById('deliveryZoneGroup');
    const deliveryLine = document.getElementById('ckDeliveryLine');
    const flatFee = Number(business.delivery_fee || 0);
    let appliedDiscount = 0;

    function currentDeliveryFee() {
      if (!hasZones) return flatFee;
      const sel = document.getElementById('ckZoneSelect');
      const opt = sel?.selectedOptions[0];
      return opt ? Number(opt.dataset.fee || 0) : 0;
    }
    function updateTotal() {
      const isDelivery = content.querySelector('input[name="fulfillment_type"]:checked')?.value === 'delivery';
      const fee = isDelivery ? currentDeliveryFee() : 0;
      deliveryLine.style.display = isDelivery && fee > 0 ? 'flex' : 'none';
      document.getElementById('ckDeliveryFee').textContent = formatCurrency(fee);
      const discountLine = document.getElementById('ckDiscountLine');
      discountLine.style.display = appliedDiscount > 0 ? 'flex' : 'none';
      document.getElementById('ckDiscountAmount').textContent = `-${formatCurrency(appliedDiscount)}`;
      document.getElementById('ckTotal').textContent = formatCurrency(Math.max(0, subtotal + fee - appliedDiscount));
    }
    if (hasZones) document.getElementById('ckZoneSelect').addEventListener('change', updateTotal);

    document.getElementById('ckApplyCoupon').addEventListener('click', async () => {
      const code = document.getElementById('ckCouponCode').value.trim();
      const msg = document.getElementById('ckCouponMsg');
      if (!code) return;
      try {
        const { discount_amount } = await API.post('/coupons/validate', { business_id: bizId, code, order_amount: subtotal });
        appliedDiscount = discount_amount;
        msg.style.color = 'var(--clr-success)';
        msg.textContent = `Coupon applied — you saved ${formatCurrency(discount_amount)}!`;
        updateTotal();
      } catch (err) {
        appliedDiscount = 0;
        msg.style.color = 'var(--clr-danger)';
        msg.textContent = err.message;
        updateTotal();
      }
    });

    radios.forEach(r => r.addEventListener('change', () => {
      if (!r.checked) return;
      addrGroup.style.display = r.value === 'delivery' ? 'block' : 'none';
      if (hasZones) zoneGroup.style.display = r.value === 'delivery' ? 'block' : 'none';
      updateTotal();
    }));

    document.getElementById('checkoutForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('ckSubmitBtn');
      const fd = new FormData(e.target);
      const fulfillment_type = fd.get('fulfillment_type');
      if (fulfillment_type === 'delivery' && !fd.get('delivery_address')?.trim()) {
        toast.warning('Please enter a delivery address'); return;
      }
      if (fulfillment_type === 'delivery' && hasZones && !fd.get('delivery_zone_name')) {
        toast.warning('Please select your delivery area'); return;
      }
      setLoading(btn, true, 'Placing order…');
      try {
        const { order_number } = await API.post('/orders/checkout', {
          business_id: bizId,
          customer_name: fd.get('customer_name'),
          customer_phone: fd.get('customer_phone'),
          customer_email: fd.get('customer_email') || null,
          fulfillment_type,
          delivery_address: fd.get('delivery_address') || null,
          delivery_zone_name: fd.get('delivery_zone_name') || null,
          notes: fd.get('notes') || null,
          coupon_code: document.getElementById('ckCouponCode')?.value.trim() || null,
        });
        content.innerHTML = `
          <div style="text-align:center;padding:3rem">
            <div style="font-size:2.5rem;margin-bottom:1rem">✅</div>
            <h2 style="font-weight:800;margin-bottom:.5rem">Order placed!</h2>
            <p style="color:var(--clr-text-2);margin-bottom:1.5rem">Your order <strong>${order_number}</strong> has been sent to ${business.name}. They'll confirm it shortly.</p>
            <div style="display:flex;gap:.75rem;justify-content:center;flex-wrap:wrap">
              <a href="/business?slug=${business.slug}" class="btn btn--outline">Back to ${business.name}</a>
              ${user ? `<a href="/orders" class="btn btn--primary">View My Orders</a>` : `<a href="/track-order?order=${order_number}" class="btn btn--primary">Track This Order</a>`}
            </div>`;
      } catch (err) {
        toast.error(err.message || 'Could not place order');
        setLoading(btn, false, 'Place Order');
      }
    });
  }
});
