// assets/js/subscriptions.js
document.addEventListener('DOMContentLoaded', async () => {
  loadComponents();
  if (!Auth.requireAuth()) return;

  document.getElementById('pageMain').innerHTML = `
    <div class="container" style="max-width:760px;margin:0 auto;padding:2rem 1rem 4rem">
      <div style="display:flex;align-items:center;gap:1rem;margin-bottom:2rem">
        <a href="/pages/dashboard.html" class="btn btn--ghost btn--sm"><i class="fa-solid fa-arrow-left"></i></a>
        <h1 style="font-size:1.5rem;font-weight:800;margin:0">💳 Subscriptions</h1>
      </div>

      <!-- Active subscription -->
      <div id="activeSub" style="margin-bottom:1.5rem">
        <div class="skeleton" style="height:160px;border-radius:16px"></div>
      </div>

      <!-- History -->
      <h2 style="font-size:1.1rem;font-weight:700;margin-bottom:1rem">Subscription History</h2>
      <div id="subHistory"><div class="skeleton" style="height:200px;border-radius:16px"></div></div>
    </div>`;

  try {
    const [activeRes, historyRes] = await Promise.all([
      API.get('/subscriptions/active'),
      API.get('/subscriptions/my'),
    ]);

    const sub  = activeRes.subscription;
    const subs = historyRes.subscriptions || [];

    // Active subscription card
    const activeEl = document.getElementById('activeSub');
    if (sub) {
      const exp     = new Date(sub.expires_at);
      const daysLeft= Math.max(0, Math.ceil((exp - Date.now()) / 86400000));
      const urgent  = daysLeft <= 7;
      const tierColors = { free:'var(--clr-text-3)', starter:'#6366f1', pro:'var(--clr-primary)', enterprise:'#f59e0b' };
      const tierIcons  = { free:'🆓', starter:'🚀', pro:'⚡', enterprise:'👑' };

      activeEl.innerHTML = `
        <div class="card" style="padding:1.5rem;border:2px solid ${tierColors[sub.tier]||'var(--clr-border)'}">
          <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap;justify-content:space-between">
            <div>
              <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:.5rem">
                <span style="font-size:1.5rem">${tierIcons[sub.tier]||'📦'}</span>
                <h2 style="margin:0;font-size:1.25rem;font-weight:800">${sub.plans?.name || sub.tier} Plan</h2>
                <span class="badge badge--success">Active</span>
              </div>
              <div style="font-size:.875rem;color:var(--clr-text-2)">
                ${sub.billing_cycle === 'yearly' ? 'Annual' : 'Monthly'} · Started ${formatDate(sub.started_at)}
              </div>
              <div style="margin-top:.5rem;font-size:.875rem;color:${urgent ? 'var(--clr-warning)' : 'var(--clr-text-2)'}">
                ${urgent ? `⚠️` : '📅'} Expires ${formatDate(sub.expires_at)} · <strong>${daysLeft} day${daysLeft !== 1 ? 's' : ''} left</strong>
              </div>
            </div>
            <div style="display:flex;gap:.5rem;flex-wrap:wrap">
              <a href="/pages/pricing.html${sub.business_id ? `?business_id=${sub.business_id}` : ''}" class="btn btn--primary btn--sm">Upgrade</a>
              <button class="btn btn--ghost btn--sm" onclick="cancelSub('${sub.id}')">Cancel</button>
            </div>
          </div>
          ${urgent ? `
          <div style="margin-top:1rem;padding:.75rem 1rem;background:rgba(245,158,11,.1);border-radius:var(--radius-md);border:1px solid rgba(245,158,11,.3)">
            <p style="font-size:.875rem;color:var(--clr-warning);margin:0">⚠️ Your subscription expires soon. <a href="/pages/pricing.html${sub.business_id ? `?business_id=${sub.business_id}` : ''}" style="color:var(--clr-primary);font-weight:600">Renew now</a> to avoid interruption.</p>
          </div>` : ''}
        </div>`;
    } else {
      activeEl.innerHTML = `
        <div class="card" style="padding:2rem;text-align:center;border:2px dashed var(--clr-border)">
          <div style="font-size:2.5rem;margin-bottom:1rem">📦</div>
          <h3 style="font-weight:700;margin-bottom:.5rem">No active subscription</h3>
          <p style="color:var(--clr-text-2);margin-bottom:1.25rem">Subscribe to list your business and reach customers across Ghana.</p>
          <a href="/pages/pricing.html" class="btn btn--primary">View Plans</a>
        </div>`;
    }

    // Subscription history
    const histEl = document.getElementById('subHistory');
    if (!subs.length) {
      histEl.innerHTML = '<p style="color:var(--clr-text-2)">No subscription history yet.</p>';
    } else {
      histEl.innerHTML = `
        <div class="card" style="padding:0;overflow:hidden">
          <table style="width:100%;border-collapse:collapse;font-size:.875rem">
            <thead><tr style="background:var(--clr-surface-2);text-align:left">
              <th style="padding:.75rem 1rem">Plan</th>
              <th style="padding:.75rem 1rem">Business</th>
              <th style="padding:.75rem 1rem">Amount</th>
              <th style="padding:.75rem 1rem">Status</th>
              <th style="padding:.75rem 1rem">Period</th>
            </tr></thead>
            <tbody>
              ${subs.map(s => `
                <tr style="border-bottom:1px solid var(--clr-border)">
                  <td style="padding:.75rem 1rem;font-weight:600;text-transform:capitalize">${s.tier}</td>
                  <td style="padding:.75rem 1rem;color:var(--clr-text-2);font-size:.8rem">${s.businesses?.name || '—'}</td>
                  <td style="padding:.75rem 1rem;font-weight:600">${formatCurrency(s.amount_paid)}</td>
                  <td style="padding:.75rem 1rem">
                    <span class="badge ${s.status === 'active' ? 'badge--success' : s.status === 'expired' ? 'badge--danger' : 'badge--warning'}">${s.status}</span>
                  </td>
                  <td style="padding:.75rem 1rem;font-size:.8rem;color:var(--clr-text-3)">${formatDate(s.started_at)} → ${formatDate(s.expires_at)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    }

    window.cancelSub = async (id) => {
      const reason = prompt('Why are you cancelling? (optional)');
      if (reason === null) return; // user pressed Cancel on prompt
      if (!confirm('Cancel subscription? You\'ll keep access until expiry.')) return;
      try {
        await API.patch(`/subscriptions/${id}/cancel`, { reason });
        toast.success('Subscription cancelled. Access continues until expiry.');
        setTimeout(() => location.reload(), 1500);
      } catch (e) { toast.error(e.message || 'Failed to cancel'); }
    };

  } catch {
    document.getElementById('activeSub').innerHTML = '<p style="color:var(--clr-danger)">Failed to load subscription data.</p>';
  }
});
