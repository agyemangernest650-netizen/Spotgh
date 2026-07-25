// assets/js/register.js
document.addEventListener('DOMContentLoaded', () => {
  loadComponents();
  if (Auth.isLoggedIn()) { window.location.href = '/pages/dashboard.html'; return; }
  const ref = new URLSearchParams(window.location.search).get('ref') || '';

  document.getElementById('pageMain').innerHTML = `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-logo"><a href="/"><img src="/assets/images/icon-192.png" alt="SpotGH"> Spot<span>GH</span></a></div>
        <h1>Create Account</h1>
        <p class="auth-sub">Free forever · No credit card required</p>
        <div id="alertArea"></div>
        <form id="registerForm">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Full Name <span>*</span></label>
              <input type="text" class="form-input" name="full_name" required placeholder="Kwame Mensah">
            </div>
            <div class="form-group">
              <label class="form-label">Phone</label>
              <input type="tel" class="form-input" name="phone" placeholder="+233 XX XXX XXXX">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Email <span>*</span></label>
            <input type="email" class="form-input" name="email" required placeholder="you@email.com">
          </div>
          <div class="form-group">
            <label class="form-label">Password <span>*</span></label>
            <input type="password" class="form-input" name="password" required placeholder="Min 8 characters" minlength="8" id="regPwd">
            <div id="pwdStrengthBar" style="height:4px;background:var(--clr-border);border-radius:2px;margin-top:.25rem"><div id="pwdBar" style="height:100%;width:0;border-radius:2px;transition:all .3s"></div></div>
            <p class="form-hint" id="pwdHint">Enter a strong password</p>
          </div>
          ${ref ? `<div class="form-group"><label class="form-label">Referral Code</label><input type="text" class="form-input" name="referral" value="${ref}" placeholder="Optional"></div>` : ''}
          <div class="form-group">
            <label class="form-label" style="display:flex;align-items:flex-start;gap:.5rem;font-weight:400">
              <input type="checkbox" name="agree" required style="width:16px;height:16px;margin-top:3px;accent-color:var(--clr-primary);flex-shrink:0">
              I agree to the <a href="/pages/terms.html" target="_blank" style="color:var(--clr-primary)">Terms of Service</a> and <a href="/pages/privacy.html" target="_blank" style="color:var(--clr-primary)">Privacy Policy</a>
            </label>
          </div>
          <div class="h-captcha" data-sitekey="" id="regCaptcha"></div>
          <button type="submit" class="btn btn--primary btn--full btn--lg" id="registerBtn">Create Account Free</button>
        </form>
        <div id="oauthButtons"></div>
        <div class="auth-footer">Already have an account? <a href="/pages/login.html">Sign in</a></div>
      </div>
    </div>`;

  OAuth.renderButtons('oauthButtons');

  // hCaptcha: only load the widget/script if a site key is actually
  // configured (via /api/config) — otherwise this stays a no-op, and the
  // backend's verifyCaptcha middleware likewise no-ops when unconfigured.
  fetch('/api/config').then(r => r.json()).then(cfg => {
    if (!cfg.hcaptchaSiteKey) return;
    document.getElementById('regCaptcha').setAttribute('data-sitekey', cfg.hcaptchaSiteKey);
    const s = document.createElement('script');
    s.src = 'https://js.hcaptcha.com/1/api.js';
    s.async = true; s.defer = true;
    document.head.appendChild(s);
  }).catch(() => {});

  document.getElementById('regPwd').addEventListener('input', e => {
    const v = e.target.value;
    const strength = [v.length>=8,/[A-Z]/.test(v),/[0-9]/.test(v),/[^A-Za-z0-9]/.test(v)].filter(Boolean).length;
    const colors = ['','#EF4444','#F59E0B','#22C55E','#16A34A'];
    const labels = ['','Weak','Fair','Good','Strong'];
    document.getElementById('pwdBar').style.cssText = `height:100%;width:${strength*25}%;background:${colors[strength]};border-radius:2px`;
    document.getElementById('pwdHint').textContent = labels[strength] || '';
  });

  document.getElementById('registerForm').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('registerBtn');
    const alert = document.getElementById('alertArea');
    alert.innerHTML = '';
    setLoading(btn, true, 'Creating account...');
    const fd = new FormData(e.target);
    try {
      const data = await API.post('/auth/register', {
        full_name: fd.get('full_name'), email: fd.get('email'),
        password: fd.get('password'), phone: fd.get('phone') || undefined,
        'h-captcha-response': fd.get('h-captcha-response') || undefined,
      });
      Auth.save(data.token, data.user);
      if (fd.get('referral')) {
        await API.post('/user/referral/apply', { code: fd.get('referral') }).catch(() => {});
      }
      toast.success('Account created! Welcome to SpotGH 🎉');
      setTimeout(() => window.location.href = '/pages/dashboard.html?tab=new', 1000);
    } catch(err) {
      alert.innerHTML = `<div class="alert alert--error"><i class="fa-solid fa-circle-exclamation"></i> ${err.message || 'Registration failed'}</div>`;
      setLoading(btn, false);
    }
  });
});
