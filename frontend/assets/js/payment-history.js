// assets/js/payment-history.js
document.addEventListener('DOMContentLoaded', async () => {
  loadComponents();
  if (!Auth.requireAuth()) return;

  document.getElementById('pageMain').innerHTML = `
    <div class="container" style="max-width:860px;margin:0 auto;padding:2rem 1rem 4rem">
      <div style="display:flex;align-items:center;gap:1rem;margin-bottom:2rem;flex-wrap:wrap">
        <a href="/pages/dashboard.html" class="btn btn--ghost btn--sm"><i class="fa-solid fa-arrow-left"></i></a>
        <h1 style="font-size:1.5rem;font-weight:800;margin:0">Payment History</h1>
        <button class="btn btn--ghost btn--sm" style="margin-left:auto" onclick="downloadCSV()">
          <i class="fa-solid fa-download"></i> Export CSV
        </button>
      </div>
      <div id="paymentContent"><div class="skeleton" style="height:300px;border-radius:16px"></div></div>
    </div>`;

  let payments = [];

  try {
    const res = await API.get('/payments/my');
    payments = res.payments || [];

    if (!payments.length) {
      document.getElementById('paymentContent').innerHTML = `
        <div class="card" style="padding:3rem;text-align:center">
          <div style="font-size:3rem;margin-bottom:1rem">🧾</div>
          <h3>No payments yet</h3>
          <p style="color:var(--clr-text-2)">Your payment receipts will appear here after you subscribe to a plan.</p>
          <a href="/pages/pricing.html" class="btn btn--primary" style="margin-top:1rem">View Plans</a>
        </div>`;
      return;
    }

    // Summary stats
    const totalPaid = payments.filter(p => p.status === 'paid').reduce((s, p) => s + Number(p.amount || 0), 0);
    const lastPayment = payments.find(p => p.status === 'paid');

    document.getElementById('paymentContent').innerHTML = `
      <div class="stat-grid" style="margin-bottom:1.5rem">
        <div class="stat-card">
          <div class="stat-card__icon" style="font-size:1.5rem">💰</div>
          <div class="stat-card__label">Total Spent</div>
          <div class="stat-card__value" style="color:var(--clr-success)">GHS ${totalPaid.toLocaleString()}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__icon" style="font-size:1.5rem">🧾</div>
          <div class="stat-card__label">Transactions</div>
          <div class="stat-card__value">${payments.length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__icon" style="font-size:1.5rem">📅</div>
          <div class="stat-card__label">Last Payment</div>
          <div class="stat-card__value" style="font-size:1rem">${lastPayment ? formatDate(lastPayment.paid_at || lastPayment.created_at) : '—'}</div>
        </div>
      </div>

      <div class="card" style="padding:0;overflow:hidden">
        <table style="width:100%;border-collapse:collapse;font-size:.875rem">
          <thead>
            <tr style="background:var(--clr-surface-2);text-align:left">
              <th style="padding:.85rem 1rem">Description</th>
              <th style="padding:.85rem 1rem">Plan</th>
              <th style="padding:.85rem 1rem">Amount</th>
              <th style="padding:.85rem 1rem">Status</th>
              <th style="padding:.85rem 1rem">Date</th>
              <th style="padding:.85rem 1rem">Receipt</th>
            </tr>
          </thead>
          <tbody>
            ${payments.map(p => `
              <tr style="border-bottom:1px solid var(--clr-border)">
                <td style="padding:.85rem 1rem">
                  <div style="font-weight:600">${p.description || 'Subscription'}</div>
                  ${p.businesses?.name ? `<div style="font-size:.75rem;color:var(--clr-text-3)">${p.businesses.name}</div>` : ''}
                </td>
                <td style="padding:.85rem 1rem">
                  ${p.plans?.tier ? `<span class="badge badge--primary" style="text-transform:capitalize">${p.plans.tier}</span>` : '—'}
                </td>
                <td style="padding:.85rem 1rem;font-weight:700;color:${p.status === 'paid' ? 'var(--clr-success)' : 'var(--clr-text-2)'}">
                  GHS ${Number(p.amount || 0).toLocaleString()}
                </td>
                <td style="padding:.85rem 1rem">
                  <span class="badge ${p.status === 'paid' ? 'badge--success' : p.status === 'failed' ? 'badge--danger' : 'badge--warning'}">
                    ${p.status}
                  </span>
                </td>
                <td style="padding:.85rem 1rem;color:var(--clr-text-3);font-size:.8rem">
                  ${formatDate(p.paid_at || p.created_at)}
                </td>
                <td style="padding:.85rem 1rem">
                  ${p.status === 'paid' ? `<button class="btn btn--ghost btn--sm" onclick="printReceipt('${p.id}')"><i class="fa-solid fa-receipt"></i></button>` : '—'}
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;

    window.printReceipt = (id) => {
      const p = payments.find(x => x.id === id);
      if (!p) return;
      const user = Auth.getUser();
      const w = window.open('', '_blank');
      w.document.write(`
        <!DOCTYPE html><html><head><title>Receipt — SpotGH</title>
        <style>body{font-family:Arial,sans-serif;max-width:500px;margin:2rem auto;padding:1rem;color:#333}
        .header{text-align:center;border-bottom:2px solid #4E0DAD;padding-bottom:1rem;margin-bottom:1.5rem}
        .row{display:flex;justify-content:space-between;padding:.5rem 0;border-bottom:1px solid #eee}
        .total{font-weight:bold;font-size:1.1rem;color:#2f9e44}.ref{font-size:.75rem;color:#888;margin-top:1rem;text-align:center}</style>
        </head><body>
        <div class="header">
          <h2 style="color:#4E0DAD;margin:0">SpotGH</h2>
          <p style="margin:.25rem 0;color:#666">Payment Receipt</p>
        </div>
        <div class="row"><span>Customer</span><span>${user?.full_name || '—'}</span></div>
        <div class="row"><span>Email</span><span>${user?.email || '—'}</span></div>
        <div class="row"><span>Plan</span><span style="text-transform:capitalize">${p.plans?.tier || '—'}</span></div>
        <div class="row"><span>Description</span><span>${p.description || 'Subscription'}</span></div>
        <div class="row"><span>Date</span><span>${new Date(p.paid_at || p.created_at).toLocaleDateString()}</span></div>
        <div class="row"><span>Channel</span><span style="text-transform:capitalize">${p.channel || '—'}</span></div>
        <div class="row total"><span>Amount Paid</span><span>GHS ${Number(p.amount).toLocaleString()}</span></div>
        <div class="ref">Ref: ${p.paystack_reference || p.id}</div>
        <div style="text-align:center;margin-top:2rem"><button onclick="window.print()">🖨️ Print</button></div>
        </body></html>`);
      w.document.close();
    };

    window.downloadCSV = () => {
      const header = 'Description,Plan,Amount,Status,Date,Reference\n';
      const rows = payments.map(p =>
        [p.description||'Subscription', p.plans?.tier||'', p.amount, p.status,
         new Date(p.paid_at||p.created_at).toLocaleDateString(), p.paystack_reference||p.id]
        .map(v => `"${String(v||'').replace(/"/g,'""')}"`).join(',')
      ).join('\n');
      const a = document.createElement('a');
      a.href = `data:text/csv;charset=utf-8,${encodeURIComponent(header + rows)}`;
      a.download = 'payment-history.csv';
      a.click();
    };

  } catch {
    document.getElementById('paymentContent').innerHTML = `
      <div class="card" style="padding:3rem;text-align:center">
        <div style="font-size:3rem;margin-bottom:1rem">⚠️</div>
        <h3>Failed to load payments</h3>
        <a href="/pages/dashboard.html" class="btn btn--primary" style="margin-top:1rem">Go to Dashboard</a>
      </div>`;
  }
});
