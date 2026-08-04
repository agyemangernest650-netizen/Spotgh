// assets/js/messages.js
document.addEventListener('DOMContentLoaded', async () => {
  loadComponents();
  if (!Auth.requireAuth()) return;

  const bizId = new URLSearchParams(location.search).get('id');
  const openCustomer = new URLSearchParams(location.search).get('customer');
  if (!bizId) { location.href = '/dashboard'; return; }

  document.getElementById('pageMain').innerHTML = `
    <div class="container" style="max-width:900px;margin:0 auto;padding:2rem 1rem 4rem">
      <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem">
        <a href="/dashboard" class="btn btn--ghost btn--sm"><i class="fa-solid fa-arrow-left"></i></a>
        <h1 style="font-size:1.5rem;font-weight:800;margin:0">Messages</h1>
      </div>
      <div style="display:grid;grid-template-columns:260px 1fr;gap:1.25rem;min-height:500px" id="msgLayout">
        <div class="card" style="padding:0;overflow:hidden">
          <div id="threadList"><div style="padding:1.5rem"><div class="skeleton" style="height:60px;border-radius:12px;margin-bottom:.75rem"></div><div class="skeleton" style="height:60px;border-radius:12px"></div></div></div>
        </div>
        <div class="card" style="padding:0;display:flex;flex-direction:column" id="threadPanel">
          <div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--clr-text-3)">Select a conversation</div>
        </div>
      </div>
    </div>
    <style>@media(max-width:640px){#msgLayout{grid-template-columns:1fr}}</style>`;

  let threads = [];
  let activeCustomerId = openCustomer || null;

  async function loadThreads() {
    try {
      const { threads: t } = await API.get(`/messages/business/${bizId}`);
      threads = t;
      const list = document.getElementById('threadList');
      if (!threads.length) {
        list.innerHTML = emptyState({ icon: '💬', title: 'No messages yet', subtitle: 'Customer messages will appear here.' });
        return;
      }
      list.innerHTML = threads.map(t => `
        <div class="thread-item" data-customer="${t.customer_id}" style="padding:1rem;border-bottom:1px solid var(--clr-border);cursor:pointer;display:flex;justify-content:space-between;align-items:center;${t.customer_id===activeCustomerId?'background:var(--clr-surface-2)':''}">
          <div>
            <div style="font-weight:600;font-size:.9rem">${t.customer_name}</div>
            <div style="font-size:.78rem;color:var(--clr-text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px">${t.messages[0]?.body || ''}</div>
          </div>
          ${t.unread_count > 0 ? `<span class="badge badge--primary" style="font-size:.7rem">${t.unread_count}</span>` : ''}
        </div>`).join('');
      document.querySelectorAll('.thread-item').forEach(el => el.addEventListener('click', () => openThread(el.dataset.customer)));
      if (activeCustomerId && threads.some(t => t.customer_id === activeCustomerId)) openThread(activeCustomerId);
      else if (!activeCustomerId && threads.length) openThread(threads[0].customer_id);
    } catch {
      document.getElementById('threadList').innerHTML = `<div style="padding:1.5rem;color:var(--clr-danger);text-align:center">Failed to load</div>`;
    }
  }

  function openThread(customerId) {
    activeCustomerId = customerId;
    document.querySelectorAll('.thread-item').forEach(el => el.style.background = el.dataset.customer === customerId ? 'var(--clr-surface-2)' : '');
    const thread = threads.find(t => t.customer_id === customerId);
    if (!thread) return;
    const panel = document.getElementById('threadPanel');
    const sorted = [...thread.messages].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    panel.innerHTML = `
      <div style="padding:1rem;border-bottom:1px solid var(--clr-border);font-weight:700">${thread.customer_name}</div>
      <div id="msgScroll" style="flex:1;overflow-y:auto;padding:1rem;display:flex;flex-direction:column;gap:.6rem;max-height:400px">
        ${sorted.map(m => `
          <div style="align-self:${m.sender_role==='owner'?'flex-end':'flex-start'};max-width:75%">
            <div style="background:${m.sender_role==='owner'?'var(--clr-primary)':'var(--clr-surface-2)'};color:${m.sender_role==='owner'?'#fff':'var(--clr-text)'};padding:.6rem .85rem;border-radius:14px;font-size:.875rem">${m.body}</div>
            <div style="font-size:.7rem;color:var(--clr-text-3);margin-top:.2rem;text-align:${m.sender_role==='owner'?'right':'left'}">${new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div>
          </div>`).join('')}
      </div>
      <form id="replyForm" style="display:flex;gap:.5rem;padding:1rem;border-top:1px solid var(--clr-border)">
        <input class="input" id="replyInput" placeholder="Type a reply…" style="flex:1" required>
        <button class="btn btn--primary" type="submit"><i class="fa-solid fa-paper-plane"></i></button>
      </form>`;
    const scroll = document.getElementById('msgScroll'); scroll.scrollTop = scroll.scrollHeight;
    document.getElementById('replyForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('replyInput');
      const body = input.value.trim();
      if (!body) return;
      input.disabled = true;
      try {
        await API.post(`/messages/business/${bizId}/reply`, { customer_id: customerId, body });
        input.value = '';
        await loadThreads();
        openThread(customerId);
      } catch (err) { toast.error(err.message || 'Failed to send'); }
      finally { input.disabled = false; input.focus(); }
    });
  }

  loadThreads();
});
