// assets/js/profile.js
document.addEventListener('DOMContentLoaded', async () => {
  loadComponents();
  if (!Auth.requireAuth()) return;
  const user = Auth.getUser();

  document.getElementById('pageMain').innerHTML = `
    <div class="container" style="max-width:680px;margin:0 auto;padding:2rem 1rem 4rem">
      <h1 style="font-size:1.5rem;font-weight:800;margin-bottom:2rem">My Profile</h1>

      <!-- Avatar -->
      <div class="card" style="padding:1.5rem;margin-bottom:1.25rem;display:flex;align-items:center;gap:1.5rem;flex-wrap:wrap">
        <div style="position:relative">
          <div id="avatarPreview" style="width:80px;height:80px;border-radius:50%;background:var(--clr-primary-10);display:flex;align-items:center;justify-content:center;font-size:2rem;font-weight:700;color:var(--clr-primary);overflow:hidden">
            ${user?.avatar_url?`<img src="${user.avatar_url}" style="width:100%;height:100%;object-fit:cover">`:(user?.full_name||'U')[0].toUpperCase()}
          </div>
          <label style="position:absolute;bottom:0;right:0;width:26px;height:26px;border-radius:50%;background:var(--clr-primary);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:.7rem">
            <i class="fa-solid fa-camera"></i>
            <input type="file" accept="image/*" hidden onchange="uploadAvatar(this)">
          </label>
        </div>
        <div>
          <div style="font-weight:700;font-size:1.1rem">${user?.full_name||'—'}</div>
          <div style="color:var(--clr-text-2);font-size:.875rem">${user?.email||''}</div>
          <span class="badge badge--primary" style="margin-top:.35rem">${user?.role||'user'}</span>
        </div>
      </div>

      <!-- Profile form -->
      <div class="card" style="padding:1.5rem;margin-bottom:1.25rem">
        <h3 style="font-weight:700;margin-bottom:1.25rem">Personal Information</h3>
        <div style="display:flex;flex-direction:column;gap:.875rem">
          <div><label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:.3rem">Full Name</label>
            <input id="pfName" class="input" value="${user?.full_name||''}" style="width:100%"></div>
          <div><label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:.3rem">Phone</label>
            <input id="pfPhone" class="input" type="tel" value="${user?.phone||''}" placeholder="+233…" style="width:100%"></div>
          <div><label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:.3rem">City</label>
            <input id="pfCity" class="input" value="${user?.city||''}" placeholder="e.g. Accra" style="width:100%"></div>
          <button id="saveProfileBtn" class="btn btn--primary" onclick="saveProfile()">Save Changes</button>
        </div>
      </div>

      <!-- Change password -->
      <div class="card" style="padding:1.5rem;margin-bottom:1.25rem">
        <h3 style="font-weight:700;margin-bottom:1.25rem">Change Password</h3>
        <div style="display:flex;flex-direction:column;gap:.875rem">
          <div><label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:.3rem">New Password</label>
            <input id="pfPwd" class="input" type="password" placeholder="Min 8 characters" style="width:100%"></div>
          <div><label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:.3rem">Confirm Password</label>
            <input id="pfPwd2" class="input" type="password" placeholder="Repeat password" style="width:100%"></div>
          <button id="savePwdBtn" class="btn btn--outline" onclick="changePassword()">Update Password</button>
        </div>
      </div>

      <!-- Notifications -->
      <div class="card" style="padding:1.5rem;margin-bottom:1.25rem">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">
          <h3 style="font-weight:700;margin:0">Notifications</h3>
          <button class="btn btn--ghost btn--sm" onclick="markAllRead()">Mark all read</button>
        </div>
        <div id="notifList"><div class="skeleton" style="height:100px;border-radius:12px"></div></div>
      </div>

      <!-- Payment history -->
      <div class="card" style="padding:1.5rem">
        <h3 style="font-weight:700;margin-bottom:1rem">Payment History</h3>
        <div id="paymentHistory"><div class="skeleton" style="height:100px;border-radius:12px"></div></div>
      </div>
    </div>`;

  window.uploadAvatar = async (input) => {
    if (!input.files[0]) return;
    try {
      const fd = new FormData(); fd.append('file', input.files[0]); fd.append('type', 'avatar');
      const { url } = await API.upload('/upload', fd);
      document.getElementById('avatarPreview').innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover">`;
      await API.patch('/user/profile', { avatar_url: url });
      const u = Auth.getUser(); u.avatar_url = url; Auth.save(Auth.getToken(), u);
      toast.success('Avatar updated!');
    } catch { toast.error('Failed to upload avatar'); }
  };

  window.saveProfile = async () => {
    const btn = document.getElementById('saveProfileBtn');
    setLoading(btn, true, 'Saving…');
    try {
      const body = {
        full_name: document.getElementById('pfName').value.trim(),
        phone:     document.getElementById('pfPhone').value.trim(),
        city:      document.getElementById('pfCity').value.trim(),
      };
      const { user: updated } = await API.patch('/user/profile', body);
      Auth.save(Auth.getToken(), { ...Auth.getUser(), ...updated });
      toast.success('Profile updated!');
    } catch(e) { toast.error(e.message||'Failed to save'); }
    finally { setLoading(btn, false); }
  };

  window.changePassword = async () => {
    const pwd  = document.getElementById('pfPwd').value;
    const pwd2 = document.getElementById('pfPwd2').value;
    if (!pwd || pwd.length < 8) { toast.warning('Password must be at least 8 characters'); return; }
    if (pwd !== pwd2) { toast.warning('Passwords do not match'); return; }
    const btn = document.getElementById('savePwdBtn');
    setLoading(btn, true, 'Updating…');
    try {
      await API.patch('/auth/password', { password: pwd });
      toast.success('Password updated!');
      document.getElementById('pfPwd').value  = '';
      document.getElementById('pfPwd2').value = '';
    } catch(e) { toast.error(e.message||'Failed'); }
    finally { setLoading(btn, false); }
  };

  window.markAllRead = async () => {
    try { await API.patch('/user/notifications/read-all'); loadNotifications(); }
    catch { toast.error('Failed'); }
  };

  async function loadNotifications() {
    try {
      const { notifications } = await API.get('/user/notifications');
      const el = document.getElementById('notifList');
      if (!notifications.length) { el.innerHTML = '<p style="color:var(--clr-text-2);text-align:center;padding:1rem">No notifications.</p>'; return; }
      el.innerHTML = notifications.slice(0,8).map(n=>`
        <div style="display:flex;gap:.75rem;align-items:flex-start;padding:.65rem 0;border-bottom:1px solid var(--clr-border);${n.is_read?'opacity:.6':''}">
          <span style="font-size:1.1rem;margin-top:.1rem">${n.type==='success'?'✅':n.type==='danger'?'❌':n.type==='warning'?'⚠️':'ℹ️'}</span>
          <div style="flex:1;min-width:0">
            <div style="font-size:.85rem;font-weight:${n.is_read?'400':'600'}">${n.title}</div>
            ${n.body?`<div style="font-size:.78rem;color:var(--clr-text-2)">${n.body}</div>`:''}
          </div>
          <div style="font-size:.72rem;color:var(--clr-text-3);white-space:nowrap">${timeAgo(n.created_at)}</div>
        </div>`).join('');
    } catch { document.getElementById('notifList').innerHTML = '<p style="color:var(--clr-text-3);font-size:.85rem">Could not load notifications.</p>'; }
  }

  async function loadPaymentHistory() {
    try {
      const { payments } = await API.get('/payments/history');
      const el = document.getElementById('paymentHistory');
      if (!payments.length) { el.innerHTML = '<p style="color:var(--clr-text-2)">No payments yet.</p>'; return; }
      el.innerHTML = payments.map(p=>`
        <div style="display:flex;align-items:center;gap:1rem;padding:.65rem 0;border-bottom:1px solid var(--clr-border);flex-wrap:wrap">
          <div style="flex:1;min-width:0">
            <div style="font-size:.875rem;font-weight:600">${p.description||p.plans?.name||'Payment'}</div>
            <div style="font-size:.75rem;color:var(--clr-text-3)">${formatDate(p.paid_at||p.created_at)}</div>
          </div>
          <span class="badge ${p.status==='paid'?'badge--success':p.status==='failed'?'badge--danger':'badge--warning'}">${p.status}</span>
          <div style="font-weight:700">${formatCurrency(p.amount)}</div>
        </div>`).join('');
    } catch { document.getElementById('paymentHistory').innerHTML = '<p style="color:var(--clr-text-3);font-size:.85rem">Could not load payment history.</p>'; }
  }

  loadNotifications();
  loadPaymentHistory();
});
