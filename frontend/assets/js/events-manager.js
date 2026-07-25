// assets/js/events-manager.js
document.addEventListener('DOMContentLoaded', async () => {
  loadComponents();
  if (!Auth.requireAuth()) return;

  const bizId = new URLSearchParams(location.search).get('id');
  if (!bizId) { location.href = '/pages/dashboard.html'; return; }

  document.getElementById('pageMain').innerHTML = `
    <div class="container" style="max-width:760px;margin:0 auto;padding:2rem 1rem 4rem">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-bottom:2rem;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:1rem">
          <a href="/pages/dashboard.html" class="btn btn--ghost btn--sm"><i class="fa-solid fa-arrow-left"></i></a>
          <h1 style="font-size:1.5rem;font-weight:800;margin:0">🎪 Events Manager</h1>
        </div>
        <button class="btn btn--primary btn--sm" onclick="showEventForm()"><i class="fa-solid fa-plus"></i> New Event</button>
      </div>

      <div class="card" style="padding:1rem 1.25rem;margin-bottom:1.5rem;background:rgba(99,102,241,.06);border:1px solid rgba(99,102,241,.2)">
        <p style="font-size:.875rem;margin:0">💡 Events show up on the <a href="/pages/events.html" style="color:var(--clr-primary)">Events page</a> and on your business mini-site.</p>
      </div>

      <div id="eventForm" hidden class="card" style="padding:1.5rem;margin-bottom:1.5rem">
        <h3 style="font-weight:700;margin-bottom:1.25rem" id="eventFormTitle">Create Event</h3>
        <input type="hidden" id="editEventId">
        <div style="display:flex;flex-direction:column;gap:.875rem">
          <input id="eTitle" class="form-input" placeholder="Event title">
          <textarea id="eDesc" rows="3" class="form-textarea" placeholder="Description"></textarea>
          <input id="eCover" class="form-input" placeholder="Cover image URL (optional)">
          <input id="eLocation" class="form-input" placeholder="Location / venue">
          <div style="display:flex;gap:.6rem">
            <div style="flex:1"><label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:.3rem">Starts *</label>
              <input id="eStart" type="datetime-local" class="form-input"></div>
            <div style="flex:1"><label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:.3rem">Ends</label>
              <input id="eEnd" type="datetime-local" class="form-input"></div>
          </div>
          <label style="display:flex;align-items:center;gap:.4rem;font-size:.9rem"><input type="checkbox" id="eIsFree" checked onchange="document.getElementById('ePriceWrap').hidden=this.checked"> Free entry</label>
          <div id="ePriceWrap" hidden><input id="ePrice" type="number" class="form-input" placeholder="Ticket price (GH₵)"></div>
          <input id="eTicketUrl" class="form-input" placeholder="Ticket link (optional)">
          <div style="display:flex;gap:.5rem">
            <button class="btn btn--primary btn--sm" onclick="saveEvent()">Save Event</button>
            <button class="btn btn--ghost btn--sm" onclick="document.getElementById('eventForm').hidden=true">Cancel</button>
          </div>
        </div>
      </div>

      <div id="eventsList"><div class="skeleton" style="height:200px;border-radius:16px"></div></div>
    </div>`;

  window.showEventForm = (ev) => {
    document.getElementById('eventForm').hidden = false;
    document.getElementById('eventFormTitle').textContent = ev ? 'Edit Event' : 'Create Event';
    document.getElementById('editEventId').value = ev?.id || '';
    document.getElementById('eTitle').value = ev?.title || '';
    document.getElementById('eDesc').value = ev?.description || '';
    document.getElementById('eCover').value = ev?.cover_url || '';
    document.getElementById('eLocation').value = ev?.location || '';
    document.getElementById('eStart').value = ev?.starts_at ? ev.starts_at.slice(0, 16) : '';
    document.getElementById('eEnd').value = ev?.ends_at ? ev.ends_at.slice(0, 16) : '';
    document.getElementById('eIsFree').checked = ev ? ev.is_free : true;
    document.getElementById('ePriceWrap').hidden = ev ? ev.is_free : true;
    document.getElementById('ePrice').value = ev?.price || '';
    document.getElementById('eTicketUrl').value = ev?.ticket_url || '';
    document.getElementById('eventForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  window.saveEvent = async () => {
    const title = document.getElementById('eTitle').value.trim();
    const starts_at = document.getElementById('eStart').value;
    if (!title || !starts_at) { toast.warning('Title and start time are required'); return; }
    const is_free = document.getElementById('eIsFree').checked;
    const body = {
      title, description: document.getElementById('eDesc').value.trim() || null,
      cover_url: document.getElementById('eCover').value.trim() || null,
      location: document.getElementById('eLocation').value.trim() || null,
      starts_at: new Date(starts_at).toISOString(),
      ends_at: document.getElementById('eEnd').value ? new Date(document.getElementById('eEnd').value).toISOString() : null,
      is_free, price: is_free ? null : Number(document.getElementById('ePrice').value) || null,
      ticket_url: document.getElementById('eTicketUrl').value.trim() || null,
    };
    try {
      const id = document.getElementById('editEventId').value;
      if (id) { await API.patch(`/events/${id}`, body); toast.success('Event updated!'); }
      else { await API.post(`/events/business/${bizId}`, body); toast.success('Event created! 🎪'); }
      document.getElementById('eventForm').hidden = true;
      loadEvents();
    } catch (e) { toast.error(e.message || 'Failed to save event'); }
  };

  window.cancelEvent = async (id) => {
    if (!confirm('Cancel this event? It will be removed from public listings.')) return;
    try { await API.patch(`/events/${id}`, { status: 'cancelled' }); toast.success('Event cancelled'); loadEvents(); }
    catch (e) { toast.error(e.message); }
  };

  window.deleteEvent = async (id) => {
    if (!confirm('Delete this event permanently?')) return;
    try { await API.delete(`/events/${id}`); toast.success('Event deleted'); loadEvents(); }
    catch { toast.error('Failed to delete'); }
  };

  async function loadEvents() {
    try {
      const { events } = await API.get(`/events/business/${bizId}`);
      const el = document.getElementById('eventsList');
      if (!events.length) {
        el.innerHTML = `<div class="card" style="padding:3rem;text-align:center">
          <div style="font-size:3rem;margin-bottom:1rem">🎪</div>
          <h3>No events yet</h3>
          <p style="color:var(--clr-text-2);margin-bottom:1.25rem">Create an event to get discovered by nearby customers.</p>
          <button class="btn btn--primary" onclick="showEventForm()">Create First Event</button>
        </div>`;
        return;
      }
      el.innerHTML = events.map(e => `
        <div class="card" style="padding:1.25rem;margin-bottom:.75rem">
          <div style="display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap">
            <div>
              <strong>${e.title}</strong>
              <span class="badge badge--${e.status==='cancelled'?'danger':e.status==='past'?'warning':'success'}" style="margin-left:.5rem">${e.status}</span>
              <div style="font-size:.8rem;color:var(--clr-text-3);margin-top:.25rem">${formatDate(e.starts_at)}${e.location ? ` · ${e.location}` : ''} · ${e.interested_count} interested</div>
            </div>
            <div style="display:flex;gap:.4rem">
              <button class="btn btn--outline btn--sm" onclick='showEventForm(${JSON.stringify(e).replace(/'/g,"&apos;")})'>Edit</button>
              ${e.status !== 'cancelled' ? `<button class="btn btn--ghost btn--sm" onclick="cancelEvent('${e.id}')">Cancel</button>` : ''}
              <button class="btn btn--danger btn--sm" onclick="deleteEvent('${e.id}')"><i class="fa-solid fa-trash"></i></button>
            </div>
          </div>
        </div>`).join('');
    } catch { document.getElementById('eventsList').innerHTML = '<p style="color:var(--clr-danger)">Failed to load events.</p>'; }
  }

  loadEvents();
});
