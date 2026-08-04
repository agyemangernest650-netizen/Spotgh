// assets/js/login.js
document.addEventListener('DOMContentLoaded', () => {
  loadComponents();
  if (Auth.isLoggedIn()) { window.location.href = '/dashboard'; return; }

  const next = new URLSearchParams(window.location.search).get('next') || '/dashboard';

  document.getElementById('pageMain').innerHTML = `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-logo"><a href="/"><img src="/assets/images/icon-192.png" alt="SpotGH"> Spot<span>GH</span></a></div>
        <h1>Welcome back</h1>
        <p class="auth-sub">Sign in to manage your businesses</p>
        <div id="alertArea"></div>
        <form id="loginForm">
          <div class="form-group">
            <label class="form-label">Email <span>*</span></label>
            <div class="input-icon-wrap"><i class="fa-solid fa-envelope"></i>
              <input type="email" class="form-input" name="email" required placeholder="you@email.com" autocomplete="email">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" style="display:flex;justify-content:space-between">
              Password <a href="/forgot-password" style="font-weight:400;font-size:.8rem;color:var(--clr-primary)">Forgot?</a>
            </label>
            <div class="input-icon-wrap" style="position:relative">
              <i class="fa-solid fa-lock"></i>
              <input type="password" class="form-input" name="password" required placeholder="Your password" id="pwdField">
              <button type="button" id="togglePwd" style="position:absolute;right:1rem;top:50%;transform:translateY(-50%);color:var(--clr-text-3)">
                <i class="fa-regular fa-eye"></i>
              </button>
            </div>
          </div>
          <button type="submit" class="btn btn--primary btn--full btn--lg" id="loginBtn">Sign In</button>
        </form>
        <div id="oauthButtons"></div>
        <div class="auth-footer">No account? <a href="/register">Register free</a></div>
      </div>
    </div>`;

  OAuth.renderButtons('oauthButtons');

  document.getElementById('togglePwd').addEventListener('click', () => {
    const f = document.getElementById('pwdField');
    f.type = f.type === 'password' ? 'text' : 'password';
  });

  document.getElementById('loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('loginBtn');
    const alert = document.getElementById('alertArea');
    alert.innerHTML = '';
    setLoading(btn, true, 'Signing in...');
    const fd = new FormData(e.target);
    try {
      const data = await API.post('/auth/login', { email: fd.get('email'), password: fd.get('password') });
      if (data.requires_2fa) {
        setLoading(btn, false);
        show2FAStep(data.pending_token);
        return;
      }
      Auth.save(data.token, data.user);
      toast.success('Welcome back!');
      setTimeout(() => window.location.href = decodeURIComponent(next), 800);
    } catch(err) {
      alert.innerHTML = `<div class="alert alert--error"><i class="fa-solid fa-circle-exclamation"></i> ${err.message || 'Login failed'}</div>`;
      setLoading(btn, false);
    }
  });

  function show2FAStep(pendingToken) {
    const card = document.querySelector('.auth-card');
    card.innerHTML = `
      <div class="auth-logo"><a href="/"><img src="/assets/images/icon-192.png" alt="SpotGH"> Spot<span>GH</span></a></div>
      <h1>Two-Factor Authentication</h1>
      <p class="auth-sub">Enter the 6-digit code from your authenticator app</p>
      <div id="twoFaAlertArea"></div>
      <form id="twoFaForm">
        <div class="form-group">
          <input type="text" class="form-input" id="twoFaCode" placeholder="123456" maxlength="6" autocomplete="one-time-code" autofocus>
        </div>
        <button type="submit" class="btn btn--primary btn--full btn--lg" id="twoFaBtn">Verify</button>
      </form>
      <p style="font-size:.85rem;margin-top:1rem"><a href="#" id="useBackupCode" style="color:var(--clr-primary)">Use a backup code instead</a></p>`;

    let usingBackup = false;
    document.getElementById('useBackupCode').addEventListener('click', (e) => {
      e.preventDefault();
      usingBackup = !usingBackup;
      const input = document.getElementById('twoFaCode');
      input.placeholder = usingBackup ? 'Backup code' : '123456';
      input.maxLength = usingBackup ? 20 : 6;
      e.target.textContent = usingBackup ? 'Use authenticator code instead' : 'Use a backup code instead';
    });

    document.getElementById('twoFaForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn2 = document.getElementById('twoFaBtn');
      const alert2 = document.getElementById('twoFaAlertArea');
      alert2.innerHTML = '';
      setLoading(btn2, true, 'Verifying...');
      const code = document.getElementById('twoFaCode').value.trim();
      try {
        const body = { pending_token: pendingToken, ...(usingBackup ? { backup_code: code } : { token: code }) };
        const data = await API.post('/auth/login/2fa-complete', body);
        Auth.save(data.token, data.user);
        toast.success('Welcome back!');
        setTimeout(() => window.location.href = decodeURIComponent(next), 800);
      } catch (err) {
        alert2.innerHTML = `<div class="alert alert--error"><i class="fa-solid fa-circle-exclamation"></i> ${err.message || 'Invalid code'}</div>`;
        setLoading(btn2, false);
      }
    });
  }
});
