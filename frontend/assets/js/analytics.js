// assets/js/analytics.js
function changeBadge(pct) {
  if (pct === undefined || pct === null) return '';
  if (pct === 0) return `<span style="font-size:.7rem;color:var(--clr-text-3)">— flat</span>`;
  const up = pct > 0;
  return `<span style="font-size:.7rem;font-weight:700;color:${up?'var(--clr-success)':'var(--clr-danger)'}">${up?'↑':'↓'} ${Math.abs(pct)}%</span>`;
}

// Trust Score + Guided Growth checklist + Achievement badges — shown at
// every plan tier since these exist to nudge owners toward completing
// their profile (and toward upgrading), not to be gated behind a paywall.
function renderTrustAndGrowth(data) {
  const trust = data.trust;
  const checklist = data.checklist || [];
  const badges = data.badges || [];
  if (!trust && !checklist.length && !badges.length) return '';

  const bandColor = { 'Excellent':'var(--clr-success)', 'Good':'var(--clr-primary)', 'Fair':'var(--clr-gold)', 'Needs Improvement':'var(--clr-danger)' }[trust?.band] || 'var(--clr-text-2)';
  const doneCount = checklist.filter(c => c.done).length;

  return `
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-bottom:1.5rem" class="analytics-2col">
    <div class="card" style="padding:1.5rem">
      <h3 style="font-weight:700;margin-bottom:1rem">Customer Trust Score</h3>
      ${trust ? `
      <div style="display:flex;align-items:baseline;gap:.6rem;margin-bottom:.75rem">
        <span style="font-size:2rem;font-weight:800;color:${bandColor}">${trust.score}</span>
        <span style="font-size:.9rem;color:var(--clr-text-3)">/ 100 · ${trust.band}</span>
      </div>
      <div style="background:var(--clr-surface-2);border-radius:100px;height:8px;margin-bottom:1rem">
        <div style="width:${trust.score}%;background:${bandColor};border-radius:100px;height:8px"></div>
      </div>
      <div style="font-size:.8rem;color:var(--clr-text-2);line-height:1.8">
        <div>${trust.is_verified ? '✅' : '⬜'} Verified status</div>
        <div>${trust.completeness_pct >= 80 ? '✅' : '⬜'} Profile ${trust.completeness_pct}% complete</div>
        <div>${trust.response_rate_pct === null ? '⬜' : trust.response_rate_pct >= 80 ? '✅' : '⬜'} Review response rate${trust.response_rate_pct === null ? '' : ` (${trust.response_rate_pct}%)`}</div>
        <div>${trust.recent_activity ? '✅' : '⬜'} Recently active</div>
      </div>` : ''}
    </div>
    <div class="card" style="padding:1.5rem">
      <h3 style="font-weight:700;margin-bottom:1rem">Guided Growth ${checklist.length ? `<span style="font-size:.75rem;font-weight:600;color:var(--clr-text-3)">(${doneCount}/${checklist.length})</span>` : ''}</h3>
      <div style="display:flex;flex-direction:column;gap:.6rem">
        ${checklist.map(c => `
          <div style="display:flex;align-items:center;gap:.6rem;font-size:.85rem;${c.done ? 'color:var(--clr-text-3);text-decoration:line-through' : ''}">
            <span>${c.done ? '✅' : '⬜'}</span><span>${c.label}</span>
          </div>`).join('')}
      </div>
    </div>
  </div>
  ${badges.length ? `
  <div class="card" style="padding:1.5rem;margin-bottom:1.5rem">
    <h3 style="font-weight:700;margin-bottom:1rem">Achievement Badges</h3>
    <div style="display:flex;flex-wrap:wrap;gap:.75rem">
      ${badges.map(b => `
        <div title="${b.label}" style="display:flex;align-items:center;gap:.4rem;padding:.5rem .85rem;border-radius:100px;font-size:.8rem;font-weight:600;${b.earned ? 'background:var(--clr-primary-10);border:1px solid var(--clr-primary);color:var(--clr-text-1)' : 'background:var(--clr-surface-2);border:1px solid var(--clr-border);color:var(--clr-text-3)'}">
          <span style="font-size:1rem;${b.earned ? '' : 'filter:grayscale(1);opacity:.5'}">${b.icon}</span><span>${b.label}</span>
        </div>`).join('')}
    </div>
  </div>` : ''}`;
}

document.addEventListener('DOMContentLoaded', async () => {
  loadComponents();
  if (!Auth.requireAuth()) return;

  const bizId = new URLSearchParams(location.search).get('id');
  if (!bizId) { location.href = '/pages/dashboard.html'; return; }

  let days = 30;

  const main = document.getElementById('pageMain');
  main.innerHTML = `
    <div class="container" style="max-width:960px;margin:0 auto;padding:2rem 1rem 4rem">
      <div style="display:flex;align-items:center;gap:1rem;margin-bottom:2rem;flex-wrap:wrap">
        <a href="/pages/dashboard.html" class="btn btn--ghost btn--sm"><i class="fa-solid fa-arrow-left"></i></a>
        <h1 style="font-size:1.5rem;font-weight:800;margin:0">Analytics</h1>
        <div style="margin-left:auto;display:flex;gap:.5rem">
          ${[7,14,30,90].map(d=>`<button class="btn btn--sm ${d===30?'btn--primary':'btn--ghost'} period-btn" data-days="${d}">${d}d</button>`).join('')}
        </div>
      </div>
      <div id="analyticsContent">
        <div class="stat-grid" style="margin-bottom:2rem">
          ${[...Array(6)].map(()=>'<div class="stat-card skeleton" style="height:130px"></div>').join('')}
        </div>
        <div class="skeleton" style="height:260px;border-radius:16px;margin-bottom:1.5rem"></div>
        <div class="skeleton" style="height:200px;border-radius:16px"></div>
      </div>
    </div>`;

  document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.period-btn').forEach(b => { b.className = 'btn btn--sm btn--ghost period-btn'; });
      btn.className = 'btn btn--sm btn--primary period-btn';
      days = parseInt(btn.dataset.days);
      loadAnalytics();
    });
  });

  async function loadAnalytics() {
    const content = document.getElementById('analyticsContent');
    content.innerHTML = `
      <div class="stat-grid" style="margin-bottom:2rem">
        ${[...Array(6)].map(()=>'<div class="stat-card skeleton" style="height:130px"></div>').join('')}
      </div>
      <div class="skeleton" style="height:260px;border-radius:16px;margin-bottom:1.5rem"></div>`;
    try {
      const data = await API.get(`/user/analytics/${bizId}?days=${days}`);
      if (data.advanced_locked) {
        content.innerHTML = `
          ${(data.tips || []).length ? `
          <div class="card" style="padding:1.1rem 1.25rem;margin-bottom:1.5rem;background:var(--clr-primary-10);border:1px solid var(--clr-primary)">
            <strong style="font-size:.85rem">💡 Suggestions</strong>
            <ul style="margin:.5rem 0 0;padding-left:1.1rem;font-size:.85rem;color:var(--clr-text-2);line-height:1.6">
              ${data.tips.map(t => `<li>${t}</li>`).join('')}
            </ul>
          </div>` : ''}
          ${renderTrustAndGrowth(data)}
          <div class="card" style="padding:1.5rem;margin-bottom:1.5rem;text-align:center">
            <div style="font-size:1.8rem;margin-bottom:.5rem">📈</div>
            <h3 style="font-weight:700;margin-bottom:.5rem">Basic analytics only</h3>
            <p style="color:var(--clr-text-2);margin-bottom:1rem">Total views: <strong>${(data.summary?.total_views||0).toLocaleString()}</strong> · WhatsApp clicks: <strong>${(data.summary?.whatsapp_clicks||0).toLocaleString()}</strong> · Orders: <strong>${(data.summary?.orders_period||0).toLocaleString()}</strong> · Revenue: <strong>GHS ${Number(data.summary?.order_revenue_period||0).toLocaleString()}</strong> · Avg rating: <strong>${data.summary?.avg_rating?parseFloat(data.summary.avg_rating).toFixed(1):'—'}</strong></p>
            <p style="color:var(--clr-text-2);font-size:.875rem;margin-bottom:1rem">Upgrade to Pro for the daily views chart, click breakdown, and rating distribution.</p>
            <a href="/pages/pricing.html" class="btn btn--primary">Upgrade to Pro</a>
          </div>`;
        return;
      }
      const s = data.summary || {};
      const viewsByDay = data.views_by_day || {};
      const events = data.event_breakdown || {};
      const ratings = data.rating_distribution || [];

      // Build date labels for the period
      const dateLabels = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        dateLabels.push(d.toISOString().slice(0, 10));
      }
      const viewCounts = dateLabels.map(d => viewsByDay[d] || 0);
      const maxViews = Math.max(...viewCounts, 1);

      content.innerHTML = `
        ${(data.tips || []).length ? `
        <div class="card" style="padding:1.1rem 1.25rem;margin-bottom:1.5rem;background:var(--clr-primary-10);border:1px solid var(--clr-primary)">
          <strong style="font-size:.85rem">💡 Suggestions</strong>
          <ul style="margin:.5rem 0 0;padding-left:1.1rem;font-size:.85rem;color:var(--clr-text-2);line-height:1.6">
            ${data.tips.map(t => `<li>${t}</li>`).join('')}
          </ul>
        </div>` : ''}
        ${renderTrustAndGrowth(data)}
        <div class="stat-grid" style="margin-bottom:2rem">
          ${[
            { label:'Total Views',     value:(s.total_views||0).toLocaleString(),       icon:'👁',  color:'var(--clr-primary)' },
            { label:`Views (${days}d)`,value:(s.views_period||0).toLocaleString(),      icon:'📈',  color:'var(--clr-success)', change:s.views_period_change_pct },
            { label:'WhatsApp Clicks', value:(s.whatsapp_clicks||0).toLocaleString(),   icon:'💬',  color:'#25D366', change:s.whatsapp_clicks_change_pct },
            { label:'Phone Clicks',    value:(events['call_click']||0).toLocaleString(),icon:'📞',  color:'#1971c2', change:s.call_clicks_change_pct },
            { label:'Avg Rating',      value:s.avg_rating?parseFloat(s.avg_rating).toFixed(1):'—', icon:'⭐', color:'var(--clr-gold)' },
            { label:'Reviews',         value:(s.total_reviews||0).toLocaleString(),     icon:'📝',  color:'#9c36b5' },
            { label:`Orders (${days}d)`, value:(s.orders_period||0).toLocaleString(),   icon:'🛍️', color:'var(--clr-secondary)', change:s.orders_period_change_pct },
            { label:`Revenue (${days}d)`, value:`GHS ${Number(s.order_revenue_period||0).toLocaleString()}`, icon:'💰', color:'var(--clr-success)' },
          ].map(k=>`<div class="stat-card">
            <div class="stat-card__icon" style="font-size:1.5rem">${k.icon}</div>
            <div class="stat-card__label">${k.label}</div>
            <div style="display:flex;align-items:baseline;gap:.5rem;flex-wrap:wrap">
              <div class="stat-card__value" style="color:${k.color}">${k.value}</div>
              ${changeBadge(k.change)}
            </div>
          </div>`).join('')}
        </div>

        <div class="card" style="padding:1.5rem;margin-bottom:1.5rem">
          <h3 style="font-weight:700;margin-bottom:1.25rem">Page Views — Last ${days} Days</h3>
          <div style="position:relative;height:160px">
            <div style="display:flex;align-items:flex-end;gap:3px;height:100%;overflow-x:auto">
              ${viewCounts.map((count, i) => {
                const h = Math.max(2, Math.round((count / maxViews) * 100));
                const label = dateLabels[i].slice(5); // MM-DD
                const isToday = i === viewCounts.length - 1;
                return `<div style="flex:1;min-width:6px;display:flex;flex-direction:column;align-items:center;gap:2px">
                  ${count > 0 ? `<span style="font-size:.6rem;color:var(--clr-text-3)">${count}</span>` : '<span style="font-size:.6rem">&nbsp;</span>'}
                  <div style="width:100%;background:${isToday?'var(--clr-primary)':'var(--clr-primary-10)'};border:${isToday?'2px solid var(--clr-primary)':'1px solid var(--clr-primary)'};border-radius:3px 3px 0 0;height:${h}%" title="${dateLabels[i]}: ${count} views"></div>
                </div>`;
              }).join('')}
            </div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:.72rem;color:var(--clr-text-3);margin-top:.5rem">
            <span>${dateLabels[0]}</span><span>Today</span>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-bottom:1.5rem" class="analytics-2col">
          <div class="card" style="padding:1.5rem">
            <h3 style="font-weight:700;margin-bottom:1rem">Rating Distribution</h3>
            ${[5,4,3,2,1].map(r => {
              const found = ratings.find(x => x.rating === r);
              const count = found?.count || 0;
              const max = Math.max(...ratings.map(x=>x.count), 1);
              return `<div style="display:flex;align-items:center;gap:.75rem;margin-bottom:.5rem">
                <span style="font-size:.85rem;font-weight:600;min-width:30px">${r}★</span>
                <div style="flex:1;background:var(--clr-surface-2);border-radius:100px;height:8px">
                  <div style="width:${Math.round(count/max*100)}%;background:var(--clr-gold);border-radius:100px;height:8px"></div>
                </div>
                <span style="font-size:.8rem;color:var(--clr-text-2);min-width:20px;text-align:right">${count}</span>
              </div>`;
            }).join('')}
          </div>
          <div class="card" style="padding:1.5rem">
            <h3 style="font-weight:700;margin-bottom:1rem">Interaction Events</h3>
            ${Object.entries(events).length ? Object.entries(events).map(([evt, count]) => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:.4rem 0;border-bottom:1px solid var(--clr-border)">
                <span style="font-size:.85rem;text-transform:capitalize">${evt.replace(/_/g,' ')}</span>
                <span style="font-weight:700;font-size:.9rem">${count}</span>
              </div>`).join('') : '<p style="color:var(--clr-text-3)">No events recorded yet.</p>'}
          </div>
        </div>

        <div class="card" style="padding:1.5rem">
          <h3 style="font-weight:700;margin-bottom:1rem">Tips to Improve Performance</h3>
          <div style="display:flex;flex-direction:column;gap:.75rem">
            ${[
              { ok: (s.total_views||0) > 50,      tip: 'Keep your profile complete and up-to-date to attract more views.' },
              { ok: (s.whatsapp_clicks||0) > 0,   tip: 'Add your WhatsApp number so customers can message you instantly.' },
              { ok: (s.avg_rating||0) >= 4,        tip: 'Ask satisfied customers to leave a review to build trust.' },
              { ok: (s.total_reviews||0) >= 5,     tip: 'More reviews means higher visibility in search results.' },
              { ok: (events['direction_click']||0) > 0, tip: 'Add your GPS coordinates in the editor so customers can get directions.' },
            ].map(t=>`<div style="display:flex;align-items:flex-start;gap:.75rem">
              <span style="font-size:1.1rem;flex-shrink:0">${t.ok?'✅':'💡'}</span>
              <span style="font-size:.875rem;color:var(--clr-text-2)">${t.tip}</span>
            </div>`).join('')}
          </div>
        </div>
        <style>.analytics-2col{grid-template-columns:1fr}@media(min-width:640px){.analytics-2col{grid-template-columns:1fr 1fr}}</style>`;
    } catch {
      document.getElementById('analyticsContent').innerHTML = `
        <div style="text-align:center;padding:3rem">
          <div style="font-size:2rem;margin-bottom:1rem">📊</div>
          <h3>Analytics Unavailable</h3>
          <p style="color:var(--clr-text-2)">Upgrade to a Pro plan to unlock detailed analytics.</p>
          <a href="/pages/pricing.html" class="btn btn--primary" style="margin-top:1rem">View Plans</a>
        </div>`;
    }
  }

  loadAnalytics();
});
