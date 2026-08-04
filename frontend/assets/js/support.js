// assets/js/support.js
document.addEventListener('DOMContentLoaded', async () => {
  loadComponents();
  document.title = 'Support | SpotGH';
  const main = document.getElementById('pageMain');
  const ticketId = new URLSearchParams(location.search).get('id');

  if (ticketId) await renderThread(ticketId);
  else await renderList();

  async function renderList() {
    main.innerHTML = `
      <div class="container" style="padding:2rem 1rem 4rem;max-width:640px">
        <h1 style="font-size:1.5rem;font-weight:800;margin-bottom:1.5rem">🎫 Support</h1>
        <div class="card" style="padding:1.5rem;margin-bottom:2rem">
          <h3 style="margin-top:0">New Ticket</h3>
          <form id="ticketForm" style="display:flex;flex-direction:column;gap:.75rem">
            <select id="tCategory" class="form-select">
              <option value="general">General</option>
              <option value="billing">Billing</option>
              <option value="technical">Technical</option>
              <option value="account">Account</option>
              <option value="abuse">Report abuse</option>
            </select>
            <input id="tSubject" class="form-input" placeholder="Subject" required>
            <textarea id="tMessage" class="form-textarea" rows="4" placeholder="Describe your issue..." required></textarea>
            ${!Auth.isLoggedIn() ? `<input id="tGuestEmail" type="email" class="form-input" placeholder="Your email" required>` : ''}
            <button class="btn btn--primary btn--sm" type="submit">Submit Ticket</button>
          </form>
        </div>
        ${Auth.isLoggedIn() ? `<h3>Your Tickets</h3><div id="ticketsList"><span class="spinner-sm"></span></div>` : ''}
      </div>`;

    document.getElementById('ticketForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button');
      setLoading(btn, true, 'Submitting...');
      try {
        const { ticket } = await API.post('/support', {
          category: document.getElementById('tCategory').value,
          subject: document.getElementById('tSubject').value,
          message: document.getElementById('tMessage').value,
          guest_email: document.getElementById('tGuestEmail')?.value,
        });
        toast.success('Ticket submitted! We\'ll get back to you soon.');
        if (Auth.isLoggedIn()) location.href = `/support?id=${ticket.id}`;
        else e.target.reset();
      } catch (err) { toast.error(err.message); setLoading(btn, false); }
    });

    if (Auth.isLoggedIn()) {
      try {
        const { tickets } = await API.get('/support/mine');
        const el = document.getElementById('ticketsList');
        el.innerHTML = tickets.length ? tickets.map(t => `
          <a href="/support?id=${t.id}" class="card" style="padding:1rem;margin-bottom:.6rem;display:flex;justify-content:space-between;text-decoration:none;color:inherit">
            <span>${t.subject}</span><span class="badge badge--${t.status==='resolved'||t.status==='closed'?'success':'warning'}">${t.status}</span>
          </a>`).join('') : `<p style="color:var(--clr-text-2)">No tickets yet.</p>`;
      } catch {}
    }
  }

  async function renderThread(id) {
    main.innerHTML = `<div class="container" style="padding:2rem 1rem;max-width:640px"><div class="card skeleton" style="height:300px"></div></div>`;
    try {
      const { ticket, messages } = await API.get(`/support/${id}`);
      main.innerHTML = `
        <div class="container" style="padding:2rem 1rem 4rem;max-width:640px">
          <a href="/support" style="font-size:.85rem;color:var(--clr-text-2)"><i class="fa-solid fa-arrow-left"></i> Back</a>
          <div style="display:flex;justify-content:space-between;align-items:center;margin:1rem 0">
            <h2 style="margin:0">${ticket.subject}</h2>
            <span class="badge badge--${ticket.status==='resolved'||ticket.status==='closed'?'success':'warning'}">${ticket.status}</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:.75rem;margin-bottom:1.5rem">
            ${messages.map(m => `
              <div class="card" style="padding:1rem;background:${m.sender_role==='admin'?'var(--clr-primary-10)':'var(--clr-surface)'}">
                <strong style="font-size:.8rem;color:var(--clr-text-2)">${m.sender_role === 'admin' ? 'SpotGH Support' : 'You'}</strong>
                <p style="margin:.35rem 0 0;white-space:pre-wrap">${m.body}</p>
              </div>`).join('')}
          </div>
          <form id="replyForm" style="display:flex;gap:.5rem">
            <input id="replyInput" class="form-input" placeholder="Type a reply..." style="flex:1">
            <button class="btn btn--primary btn--sm" type="submit">Send</button>
          </form>
        </div>`;
      document.getElementById('replyForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = document.getElementById('replyInput').value.trim();
        if (!msg) return;
        try { await API.post(`/support/${id}/reply`, { message: msg }); renderThread(id); }
        catch (err) { toast.error(err.message); }
      });
    } catch { main.innerHTML = `<div class="container" style="padding:3rem;text-align:center"><p style="color:var(--clr-danger)">Ticket not found.</p></div>`; }
  }
});
