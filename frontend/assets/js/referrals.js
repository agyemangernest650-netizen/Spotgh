// assets/js/referrals.js
document.addEventListener('DOMContentLoaded', async () => {
  loadComponents();
  if (!Auth.requireAuth()) return;

  document.getElementById('pageMain').innerHTML = `
    <div class="container" style="max-width:680px;margin:0 auto;padding:2rem 1rem 4rem">
      <div style="display:flex;align-items:center;gap:1rem;margin-bottom:2rem">
        <a href="/pages/profile.html" class="btn btn--ghost btn--sm"><i class="fa-solid fa-arrow-left"></i></a>
        <h1 style="font-size:1.5rem;font-weight:800;margin:0">🎁 Referral Program</h1>
      </div>

      <!-- Hero card -->
      <div class="card" style="padding:2rem;text-align:center;margin-bottom:1.5rem;background:linear-gradient(135deg,var(--clr-primary),#e55a2b);color:#fff;border:none">
        <div style="font-size:3rem;margin-bottom:.75rem">🤝</div>
        <h2 style="font-size:1.5rem;font-weight:800;margin-bottom:.5rem">Earn Rewards for Referrals</h2>
        <p style="opacity:.9;max-width:380px;margin:0 auto">Invite friends & businesses to SpotGH. Earn <strong>GHS 5 credit</strong> when they sign up, plus <strong>GHS 10 more</strong> when their business gets its first order — automatically applied to your next plan payment.</p>
      </div>

      <!-- Referral code -->
      <div class="card" style="padding:1.5rem;margin-bottom:1.25rem">
        <h3 style="font-weight:700;margin-bottom:1rem">Your Referral Code</h3>
        <div id="codeArea"><div class="skeleton" style="height:60px;border-radius:12px"></div></div>
      </div>

      <!-- Stats -->
      <div class="stat-grid" style="margin-bottom:1.25rem" id="refStats">
        <div class="stat-card skeleton" style="height:110px"></div>
        <div class="stat-card skeleton" style="height:110px"></div>
      </div>

      <!-- How it works -->
      <div class="card" style="padding:1.5rem;margin-bottom:1.25rem">
        <h3 style="font-weight:700;margin-bottom:1.25rem">How It Works</h3>
        <div style="display:flex;flex-direction:column;gap:1rem">
          ${[
            { n:'1', icon:'📤', title:'Share your code', desc:'Send your unique link to friends, business owners, or post on social media.' },
            { n:'2', icon:'👤', title:'They sign up', desc:'When someone registers using your code, you instantly earn GHS 5 credit.' },
            { n:'3', icon:'💰', title:'They order, you earn more', desc:'When their business gets its first order, you earn another GHS 10 credit.' },
          ].map(s => `
            <div style="display:flex;gap:1rem;align-items:flex-start">
              <div style="width:36px;height:36px;border-radius:50%;background:var(--clr-primary);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;flex-shrink:0">${s.n}</div>
              <div>
                <div style="font-weight:700;margin-bottom:.2rem">${s.icon} ${s.title}</div>
                <div style="font-size:.875rem;color:var(--clr-text-2)">${s.desc}</div>
              </div>
            </div>`).join('')}
        </div>
      </div>

      <!-- Terms -->
      <div style="font-size:.78rem;color:var(--clr-text-3);text-align:center;padding:1rem">
        Credit is applied automatically at your next plan payment · No cash-out · SpotGH reserves the right to modify the programme at any time.
      </div>
    </div>`;

  try {
    const { code, referrals_count, credit_balance, share_url } = await API.get('/user/referral/code');

    document.getElementById('codeArea').innerHTML = `
      <div style="display:flex;gap:.75rem;align-items:center;flex-wrap:wrap">
        <div style="flex:1;font-size:1.5rem;font-weight:800;font-family:monospace;letter-spacing:.15em;padding:.75rem 1rem;background:var(--clr-surface-2);border-radius:var(--radius-md);border:2px dashed var(--clr-primary)">${code}</div>
        <button class="btn btn--primary" onclick="copyCode('${code}','${share_url}')"><i class="fa-solid fa-copy"></i> Copy</button>
        <button class="btn btn--whatsapp" onclick="shareWhatsApp('${code}','${share_url}')"><i class="fab fa-whatsapp"></i> Share</button>
      </div>
      <div style="margin-top:.75rem">
        <p style="font-size:.8rem;color:var(--clr-text-3);margin-bottom:.35rem">Your referral link:</p>
        <div style="font-size:.78rem;color:var(--clr-primary);word-break:break-all;padding:.4rem .6rem;background:var(--clr-surface-2);border-radius:6px">${share_url}</div>
      </div>`;

    document.getElementById('refStats').innerHTML = `
      <div class="stat-card">
        <div class="stat-card__icon" style="font-size:1.5rem">👥</div>
        <div class="stat-card__label">Total Referrals</div>
        <div class="stat-card__value" style="color:var(--clr-primary)">${referrals_count}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__icon" style="font-size:1.5rem">💸</div>
        <div class="stat-card__label">Credit Balance</div>
        <div class="stat-card__value" style="color:var(--clr-success)">GHS ${Number(credit_balance || 0).toLocaleString()}</div>
      </div>`;

    window.copyCode = async (code, url) => {
      await navigator.clipboard?.writeText(url).catch(() => navigator.clipboard?.writeText(code));
      toast.success('Link copied to clipboard!');
    };

    window.shareWhatsApp = (code, url) => {
      const msg = encodeURIComponent(`📍 Hey! Check out SpotGH - Ghana's business directory. Use my referral code *${code}* when you sign up: ${url}`);
      window.open(`https://wa.me/?text=${msg}`, '_blank');
    };

  } catch {
    document.getElementById('codeArea').innerHTML = '<p style="color:var(--clr-danger)">Failed to load referral code.</p>';
  }
});