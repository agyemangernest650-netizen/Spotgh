// assets/js/bookings.js
document.addEventListener('DOMContentLoaded', async () => {
  loadComponents();
  if (!Auth.requireAuth()) return;

  const bizId = new URLSearchParams(location.search).get('id');
  if (!bizId) { location.href = '/dashboard'; return; }

  const main = document.getElementById('pageMain');
  main.innerHTML = `
    <div class="container" style="max-width:900px;margin:0 auto;padding:2rem 1rem 4rem">
      <div id="bizAdminNav"></div>
      <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem;flex-wrap:wrap">
        <button class="btn btn--ghost btn--sm" id="calToggle" onclick="toggleCalendar()"><i class="fa-solid fa-calendar-days"></i> Calendar</button>
        ${['all','pending','confirmed','completed','cancelled'].map(s=>`
          <button class="btn ${s==='all'?'btn--primary':'btn--ghost'} btn--sm filter-btn" data-status="${s}">
            ${s.charAt(0).toUpperCase()+s.slice(1)}
          </button>`).join('')}
      </div>
      <div id="calendarView" hidden style="margin-bottom:1.5rem"></div>
      <div id="bookingsList"><div class="skeleton" style="height:200px;border-radius:16px"></div></div>
    </div>`;
  renderBizAdminNav('bizAdminNav', bizId, 'bookings');

  let activeStatus = '';
  let calendarOpen = false;
  let allBookings = [];

  window.toggleCalendar = () => {
    calendarOpen = !calendarOpen;
    document.getElementById('calendarView').hidden = !calendarOpen;
    document.getElementById('calToggle').className = `btn ${calendarOpen?'btn--primary':'btn--ghost'} btn--sm`;
    if (calendarOpen) renderCalendar(allBookings);
  };

  function renderCalendar(bookings) {
    const now = new Date();
    const year = now.getFullYear(), month = now.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthName = now.toLocaleDateString('en-GH', { month: 'long', year: 'numeric' });
    const byDate = {};
    bookings.forEach(b => { const d = (b.booking_date||'').slice(0,10); if (!byDate[d]) byDate[d]=[]; byDate[d].push(b); });
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push('<div></div>');
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const bks = byDate[dateStr] || [];
      const isToday = d === now.getDate();
      days.push(`<div style="border:1px solid var(--clr-border);border-radius:8px;padding:.5rem;min-height:60px;background:${isToday?'var(--clr-primary-10)':'var(--clr-surface)'}">
        <div style="font-size:.78rem;font-weight:700;color:${isToday?'var(--clr-primary)':'var(--clr-text-1)'};margin-bottom:.25rem">${d}</div>
        ${bks.map(b=>`<div style="font-size:.68rem;padding:.15rem .3rem;border-radius:4px;margin-bottom:.15rem;background:${b.status==='confirmed'?'rgba(34,197,94,.15)':b.status==='pending'?'rgba(255,193,7,.15)':'var(--clr-surface-2)'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${b.customer_name} at ${b.booking_time}">${(b.booking_time||'').slice(0,5)} ${b.customer_name}</div>`).join('')}
      </div>`);
    }
    document.getElementById('calendarView').innerHTML = `
      <div class="card" style="padding:1.25rem">
        <h3 style="font-weight:700;margin-bottom:1rem">${monthName}</h3>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:4px">
          ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>`<div style="font-size:.72rem;font-weight:700;text-align:center;color:var(--clr-text-3);padding:.3rem 0">${d}</div>`).join('')}
        </div>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px">${days.join('')}</div>
      </div>`;
  }

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.className = 'btn btn--ghost btn--sm filter-btn');
      btn.className = 'btn btn--primary btn--sm filter-btn';
      activeStatus = btn.dataset.status === 'all' ? '' : btn.dataset.status;
      loadBookings();
    });
  });

  async function loadBookings() {
    const qs = new URLSearchParams({ limit: 50 });
    if (activeStatus) qs.set('status', activeStatus);
    try {
      const { bookings } = await API.get(`/bookings/business/${bizId}?${qs}`);
      allBookings = bookings || [];
      if (calendarOpen) renderCalendar(allBookings);
      const el = document.getElementById('bookingsList');
      if (!bookings.length) {
        el.innerHTML = `<div class="card" style="padding:3rem;text-align:center">
          <div style="font-size:3rem;margin-bottom:1rem">📅</div>
          <h3>No bookings yet</h3>
          <p style="color:var(--clr-text-2)">Bookings from customers will appear here.</p></div>`;
        return;
      }
      el.innerHTML = bookings.map(b => `
        <div class="card" style="padding:1.25rem;margin-bottom:.75rem;display:flex;align-items:center;gap:1rem;flex-wrap:wrap">
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;margin-bottom:.4rem">
              <strong>${b.customer_name}</strong>
              <span class="badge ${b.status==='confirmed'?'badge--success':b.status==='pending'?'badge--warning':b.status==='completed'?'badge--primary':'badge--danger'}">${b.status}</span>
              <span style="font-family:monospace;font-size:.75rem;color:var(--clr-text-3)">${b.confirmation_code}</span>
            </div>
            <div style="font-size:.85rem;color:var(--clr-text-2)">
              <i class="fa-solid fa-calendar" style="margin-right:.4rem"></i>${formatDate(b.booking_date)} at ${b.booking_time}
              ${b.customer_phone?` · <i class="fa-solid fa-phone" style="margin-right:.3rem"></i><a href="tel:${b.customer_phone}" style="color:var(--clr-text-2)">${b.customer_phone}</a>`:''}
            </div>
            ${b.notes?`<div style="font-size:.8rem;color:var(--clr-text-3);margin-top:.3rem">${b.notes}</div>`:''}
          </div>
          <div style="display:flex;gap:.4rem;flex-wrap:wrap">
            ${b.status==='pending'?`<button class="btn btn--success btn--sm" onclick="updateStatus('${b.id}','confirmed')">Confirm</button>`:''}
            ${['pending','confirmed'].includes(b.status)?`<button class="btn btn--ghost btn--sm" onclick="updateStatus('${b.id}','completed')">Complete</button>`:''}
            ${b.status!=='cancelled'?`<button class="btn btn--danger btn--sm" onclick="updateStatus('${b.id}','cancelled')">Cancel</button>`:''}
            ${b.customer_phone?`<a href="https://wa.me/${b.customer_phone.replace(/\D/g,'')}" class="btn btn--whatsapp btn--sm" target="_blank"><i class="fab fa-whatsapp"></i></a>`:''}
          </div>
        </div>`).join('');
    } catch { document.getElementById('bookingsList').innerHTML = '<p style="color:var(--clr-danger)">Failed to load bookings.</p>'; }
  }

  window.updateStatus = async (id, status) => {
    try { await API.patch(`/bookings/${id}/status`, { status }); toast.success('Status updated'); loadBookings(); }
    catch { toast.error('Update failed'); }
  };

  loadBookings();
});
