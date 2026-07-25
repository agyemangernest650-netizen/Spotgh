// assets/js/forgot-password.js
document.addEventListener('DOMContentLoaded', () => {
  loadComponents();
  if (Auth.isLoggedIn()) { window.location.href = '/pages/dashboard.html'; return; }

  const params = new URLSearchParams(location.search);
  const token  = params.get('token');
  const email  = params.get('email');

  document.getElementById('pageMain').innerHTML = token
    ? renderResetForm(token, email)
    : renderRequestForm();

  // ── Request reset ──────────────────────────────────────────────
  function renderRequestForm() {
    return `
      <div class="auth-page">
        <div class="auth-card">
          <div class="auth-logo"><a href="/"><img src="/assets/images/icon-192.png" alt="SpotGH"> Spot<span>GH</span></a></div>
          <h1>Forgot Password?</h1>
          <p class="auth-sub">Enter your email and we'll send a reset link.</p>
          <div id="alertArea"></div>
          <div id="successMsg" hidden style="text-align:center;padding:1.5rem 0">
            <div style="font-size:3rem;margin-bottom:1rem">📧</div>
            <h3 style="margin-bottom:.5rem">Check your email</h3>
            <p style="color:var(--clr-text-2);font-size:.875rem">We've sent a password reset link to your email address.</p>
            <button class="btn btn--ghost btn--sm" style="margin-top:1.25rem" onclick="location.reload()">Send again</button>
          </div>
          <form id="forgotForm">
            <div class="form-group">
              <label class="form-label">Email Address <span>*</span></label>
              <div class="input-icon-wrap">
                <i class="fa-solid fa-envelope"></i>
                <input type="email" class="form-input" name="email" required placeholder="you@email.com" autocomplete="email">
              </div>
            </div>
            <div class="h-captcha" data-sitekey="" id="forgotCaptcha"></div>
            <button type="submit" class="btn btn--primary btn--full btn--lg" id="forgotBtn">Send Reset Link</button>
          </form>
          <div class="auth-footer"><a href="/pages/login.html"><i class="fa-solid fa-arrow-left" style="margin-right:.35rem"></i>Back to Login</a></div>
        </div>
      </div>`;
  }

  // ── New password form (arrived via reset link) ─────────────────
  function renderResetForm(token, email) {
    return `
      <div class="auth-page">
        <div class="auth-card">
          <div class="auth-logo"><a href="/"><img src="/assets/images/icon-192.png" alt="SpotGH"> Spot<span>GH</span></a></div>
          <h1>Set New Password</h1>
          <p class="auth-sub">${email ? `For <strong>${email}</strong>` : 'Choose a strong password.'}</p>
          <div id="alertArea"></div>
          <form id="resetForm">
            <div class="form-group">
              <label class="form-label">New Password <span>*</span></label>
              <div class="input-icon-wrap" style="position:relative">
                <i class="fa-solid fa-lock"></i>
                <input type="password" class="form-input" name="password" id="newPwd" required placeholder="Min 8 characters" minlength="8">
                <button type="button" id="toggleNewPwd" style="position:absolute;right:1rem;top:50%;transform:translateY(-50%);color:var(--clr-text-3);background:none;border:none;cursor:pointer">
                  <i class="fa-regular fa-eye"></i>
                </button>
              </div>
              <div id="pwdStrengthBar" style="height:4px;background:var(--clr-border);border-radius:2px;margin-top:.25rem">
                <div id="pwdBar" style="height:100%;width:0;border-radius:2px;transition:all .3s"></div>
              </div>
              <p class="form-hint" id="pwdHint">Enter a strong password</p>
            </div>
            <div class="form-group">
              <label class="form-label">Confirm Password <span>*</span></label>
              <div class="input-icon-wrap">
                <i class="fa-solid fa-lock"></i>
                <input type="password" class="form-input" name="confirm" id="confirmPwd" required placeholder="Repeat password">
              </div>
            </div>
            <button type="submit" class="btn btn--primary btn--full btn--lg" id="resetBtn">Update Password</button>
          </form>
          <div class="auth-footer"><a href="/pages/login.html"><i class="fa-solid fa-arrow-left" style="margin-right:.35rem"></i>Back to Login</a></div>
        </div>
      </div>`;
  }

  fetch('/api/config').then(r => r.json()).then(cfg => {
    if (!cfg.hcaptchaSiteKey) return;
    document.getElementById('forgotCaptcha')?.setAttribute('data-sitekey', cfg.hcaptchaSiteKey);
    const s = document.createElement('script');
    s.src = 'https://js.hcaptcha.com/1/api.js';
    s.async = true; s.defer = true;
    document.head.appendChild(s);
  }).catch(() => {});

  // ── Wire up request form ───────────────────────────────────────
  document.getElementById('forgotForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn   = document.getElementById('forgotBtn');
    const alert = document.getElementById('alertArea');
    alert.innerHTML = '';
    setLoading(btn, true, 'Sending…');
    const fd = new FormData(e.target);
    const email = fd.get('email');
    try {
      await API.post('/auth/forgot-password', { email, 'h-captcha-response': fd.get('h-captcha-response') || undefined });
      document.getElementById('forgotForm').hidden    = true;
      document.getElementById('successMsg').hidden    = false;
    } catch(err) {
      alert.innerHTML = `<div class="alert alert--error"><i class="fa-solid fa-circle-exclamation"></i> ${err.message || 'Request failed. Please try again.'}</div>`;
      setLoading(btn, false);
    }
  });

  // ── Wire up reset form ────────────────────────────────────────
  document.getElementById('toggleNewPwd')?.addEventListener('click', () => {
    const f = document.getElementById('newPwd');
    f.type = f.type === 'password' ? 'text' : 'password';
  });

  document.getElementById('newPwd')?.addEventListener('input', e => {
    const v = e.target.value;
    const strength = [v.length >= 8, /[A-Z]/.test(v), /[0-9]/.test(v), /[^A-Za-z0-9]/.test(v)].filter(Boolean).length;
    const colors = ['', '#EF4444', '#F59E0B', '#22C55E', '#16A34A'];
    const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
    document.getElementById('pwdBar').style.cssText = `height:100%;width:${strength * 25}%;background:${colors[strength]};border-radius:2px`;
    document.getElementById('pwdHint').textContent = labels[strength] || '';
  });

  document.getElementById('resetForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn     = document.getElementById('resetBtn');
    const alert   = document.getElementById('alertArea');
    const pwd     = document.getElementById('newPwd').value;
    const confirm = document.getElementById('confirmPwd').value;
    alert.innerHTML = '';
    if (pwd !== confirm) {
      alert.innerHTML = `<div class="alert alert--error"><i class="fa-solid fa-circle-exclamation"></i> Passwords do not match.</div>`;
      return;
    }
    setLoading(btn, true, 'Updating…');
    try {
      const data = await API.post('/auth/reset-password', { token, password: pwd });
      toast.success('Password updated! Redirecting to login…');
      // If API returns a session, save it
      if (data.token) { Auth.save(data.token, data.user); setTimeout(() => window.location.href = '/pages/dashboard.html', 1200); }
      else              setTimeout(() => window.location.href = '/pages/login.html', 1200);
    } catch(err) {
      alert.innerHTML = `<div class="alert alert--error"><i class="fa-solid fa-circle-exclamation"></i> ${err.message || 'Reset failed. The link may have expired.'}</div>`;
      setLoading(btn, false);
    }
  });
});
