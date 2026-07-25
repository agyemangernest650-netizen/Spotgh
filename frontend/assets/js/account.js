// assets/js/account.js
document.addEventListener('DOMContentLoaded', async () => {
  loadComponents();
  if (!Auth.requireAuth()) return;
  document.title = 'Account Settings | SpotGH';
  const main = document.getElementById('pageMain');
  main.innerHTML = `
    <div class="container" style="padding:2rem 1rem 4rem;max-width:560px">
      <h1 style="font-size:1.5rem;font-weight:800;margin-bottom:1.5rem">⚙️ Account Settings</h1>

      <div class="card" style="padding:1.5rem;margin-bottom:1.5rem">
        <h3 style="margin-top:0"><i class="fa-solid fa-shield-halved"></i> Two-Factor Authentication</h3>
        <p style="color:var(--clr-text-2);font-size:.9rem">Add an extra layer of security using an authenticator app (Google Authenticator, Authy, etc.)</p>
        <div id="twoFaStatus"><span class="spinner-sm"></span></div>
      </div>

      <div class="card" style="padding:1.5rem">
        <h3 style="margin-top:0"><i class="fa-solid fa-bell"></i> Push Notifications</h3>
        <p style="color:var(--clr-text-2);font-size:.9rem">Get notified about bookings, order updates and messages even when SpotGH isn't open.</p>
        <button class="btn btn--outline btn--sm" id="pushToggleBtn" onclick="togglePush()">Enable Push Notifications</button>
      </div>
    </div>`;

  loadTwoFaStatus();
  checkPushStatus();

  async function loadTwoFaStatus() {
    const el = document.getElementById('twoFaStatus');
    try {
      const { enabled } = await API.get('/security/2fa/status');
      el.innerHTML = enabled
        ? `<p style="color:var(--clr-success);font-size:.9rem"><i class="fa-solid fa-circle-check"></i> 2FA is enabled</p><button class="btn btn--danger btn--sm" onclick="disable2FA()">Disable 2FA</button>`
        : `<button class="btn btn--primary btn--sm" onclick="start2FASetup()">Enable 2FA</button>`;
    } catch { el.innerHTML = '<p style="color:var(--clr-danger)">Failed to load 2FA status.</p>'; }
  }

  window.start2FASetup = async () => {
    const el = document.getElementById('twoFaStatus');
    try {
      const { qr_code_url, manual_entry_key } = await API.post('/security/2fa/setup');
      el.innerHTML = `
        <p style="font-size:.85rem">Scan this QR code with your authenticator app:</p>
        <img src="${qr_code_url}" style="display:block;margin:.75rem 0">
        <p style="font-size:.75rem;color:var(--clr-text-3)">Or enter manually: <code>${manual_entry_key}</code></p>
        <input id="confirm2FACode" class="form-input" placeholder="Enter 6-digit code" style="max-width:180px;margin:.75rem 0">
        <button class="btn btn--primary btn--sm" onclick="confirm2FA()">Confirm & Enable</button>`;
    } catch (err) { toast.error(err.message); }
  };

  window.confirm2FA = async () => {
    const token = document.getElementById('confirm2FACode').value.trim();
    try {
      const { backup_codes } = await API.post('/security/2fa/confirm', { token });
      document.getElementById('twoFaStatus').innerHTML = `
        <p style="color:var(--clr-success)"><i class="fa-solid fa-circle-check"></i> 2FA enabled!</p>
        <p style="font-size:.85rem;font-weight:600">Save these backup codes somewhere safe:</p>
        <div style="background:var(--clr-surface-2);padding:.75rem;border-radius:8px;font-family:monospace;font-size:.85rem">${backup_codes.join('<br>')}</div>`;
      toast.success('2FA enabled!');
    } catch (err) { toast.error(err.message); }
  };

  window.disable2FA = async () => {
    if (!confirm('Disable two-factor authentication?')) return;
    try { await API.post('/security/2fa/disable'); toast.success('2FA disabled'); loadTwoFaStatus(); }
    catch (err) { toast.error(err.message); }
  };

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
  }

  async function checkPushStatus() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      document.getElementById('pushToggleBtn').textContent = 'Not supported on this browser';
      document.getElementById('pushToggleBtn').disabled = true;
      return;
    }
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) document.getElementById('pushToggleBtn').textContent = 'Disable Push Notifications';
  }

  window.togglePush = async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw-push.js');
      let sub = await reg.pushManager.getSubscription();
      if (sub) {
        await API.post('/push/unsubscribe', { endpoint: sub.endpoint });
        await sub.unsubscribe();
        document.getElementById('pushToggleBtn').textContent = 'Enable Push Notifications';
        toast.success('Push notifications disabled');
        return;
      }
      const { key } = await API.get('/push/vapid-public-key');
      if (!key) { toast.error('Push notifications are not configured on the server yet'); return; }
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
      await API.post('/push/subscribe', sub.toJSON());
      document.getElementById('pushToggleBtn').textContent = 'Disable Push Notifications';
      toast.success('Push notifications enabled!');
    } catch (err) { toast.error(err.message || 'Could not enable push notifications'); }
  };
});
