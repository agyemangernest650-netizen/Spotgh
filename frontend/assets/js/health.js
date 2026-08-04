// assets/js/health.js
document.addEventListener('DOMContentLoaded', async () => {
  loadComponents();
  if (!Auth.requireAuth()) return;
  const bizId = new URLSearchParams(location.search).get('id');
  if (!bizId) { location.href = '/dashboard'; return; }

  document.getElementById('pageMain').innerHTML = `
    <div class="container" style="max-width:760px;margin:0 auto;padding:2rem 1rem 4rem">
      <div style="display:flex;align-items:center;gap:1rem;margin-bottom:2rem">
        <a href="/dashboard" class="btn btn--ghost btn--sm"><i class="fa-solid fa-arrow-left"></i></a>
        <h1 style="font-size:1.5rem;font-weight:800;margin:0">Health Score</h1>
      </div>
      <div id="healthContent"><div class="skeleton" style="height:400px;border-radius:16px"></div></div>
    </div>`;

  try {
    const { score, scores, tips: recommendations } = await API.get(`/businesses/${bizId}/health`);
    const checks = (scores || []).map(s => ({ label: s.label, passed: s.earned > 0, points: s.pts }));
    const color = score >= 80 ? 'var(--clr-success)' : score >= 50 ? 'var(--clr-warning)' : 'var(--clr-danger)';
    const grade = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Needs Work';

    document.getElementById('healthContent').innerHTML = `
      <!-- Score ring -->
      <div class="card" style="padding:2.5rem;text-align:center;margin-bottom:1.5rem">
        <div style="width:140px;height:140px;border-radius:50%;background:conic-gradient(${color} ${score*3.6}deg,var(--clr-surface-2) 0deg);display:flex;align-items:center;justify-content:center;margin:0 auto 1.25rem;position:relative">
          <div style="width:110px;height:110px;border-radius:50%;background:var(--clr-surface-1);display:flex;flex-direction:column;align-items:center;justify-content:center">
            <div style="font-size:2rem;font-weight:800;color:${color};line-height:1">${score}</div>
            <div style="font-size:.7rem;color:var(--clr-text-3)">/ 100</div>
          </div>
        </div>
        <div style="font-size:1.25rem;font-weight:700;color:${color};margin-bottom:.25rem">${grade} 
          ${score >= 80 ? '🏆' : score >= 60 ? '👍' : score >= 40 ? '⚡' : '💪'}
        </div>
        <p style="color:var(--clr-text-2);font-size:.875rem">Your business listing health score</p>
      </div>

      <!-- Checks -->
      <div class="card" style="padding:1.5rem;margin-bottom:1.5rem">
        <h3 style="font-weight:700;margin-bottom:1.25rem">Checklist</h3>
        <div style="display:flex;flex-direction:column;gap:.75rem">
          ${(checks||[]).map(c=>`
            <div style="display:flex;align-items:center;gap:.75rem;padding:.6rem .75rem;border-radius:var(--radius-md);background:var(--clr-surface-2)">
              <span style="font-size:1.1rem">${c.passed?'✅':'❌'}</span>
              <div style="flex:1">
                <div style="font-size:.875rem;font-weight:600">${c.label}</div>
                ${c.description?`<div style="font-size:.78rem;color:var(--clr-text-3)">${c.description}</div>`:''}
              </div>
              <span style="font-size:.75rem;font-weight:700;color:${c.passed?'var(--clr-success)':'var(--clr-text-3)'}">${c.passed?'+'+c.points:'0'}pts</span>
            </div>`).join('')}
        </div>
      </div>

      <!-- Recommendations -->
      ${recommendations?.length ? `
      <div class="card" style="padding:1.5rem">
        <h3 style="font-weight:700;margin-bottom:1rem">How to Improve</h3>
        <div style="display:flex;flex-direction:column;gap:.75rem">
          ${recommendations.map((r,i)=>`
            <div style="display:flex;gap:.75rem;align-items:flex-start;padding:.75rem;border-radius:var(--radius-md);background:var(--clr-surface-2)">
              <div style="width:28px;height:28px;border-radius:50%;background:var(--clr-primary-10);color:var(--clr-primary);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.8rem;flex-shrink:0">${i+1}</div>
              <div>
                <div style="font-size:.875rem;font-weight:600">${r.title||r}</div>
                ${r.action?`<a href="${r.action}" class="btn btn--outline btn--sm" style="margin-top:.4rem">Fix it</a>`:''}
              </div>
            </div>`).join('')}
        </div>
      </div>` : ''}`;
  } catch {
    document.getElementById('healthContent').innerHTML = `
      <div class="card" style="padding:3rem;text-align:center">
        <div style="font-size:3rem;margin-bottom:1rem">❤️</div>
        <h3>Health score unavailable</h3>
        <p style="color:var(--clr-text-2)">Make sure your business is published to view the health score.</p>
        <a href="/dashboard" class="btn btn--primary" style="margin-top:1rem">Go to Dashboard</a>
      </div>`;
  }
});
