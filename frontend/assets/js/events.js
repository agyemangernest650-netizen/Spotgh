// assets/js/events.js
document.addEventListener('DOMContentLoaded', async () => {
  loadComponents();
  document.title = 'Events | SpotGH';
  const main = document.getElementById('pageMain');
  const params = new URLSearchParams(location.search);
  const eventId = params.get('id');

  if (eventId) await renderDetail(eventId);
  else await renderList();

  async function renderList() {
    main.innerHTML = `
      <div class="container" style="padding:2rem 1rem 4rem">
        <div style="text-align:center;margin-bottom:2.5rem">
          <h1 style="font-size:clamp(1.75rem,5vw,3rem);font-weight:800;margin-bottom:.5rem">🎪 Upcoming Events</h1>
          <p style="color:var(--clr-text-2);max-width:480px;margin:0 auto">Workshops, pop-ups, launches and more from businesses across Ghana.</p>
        </div>
        <div id="eventsGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1.25rem">
          ${[...Array(6)].map(()=>'<div class="card skeleton" style="height:240px"></div>').join('')}
        </div>
      </div>`;
    try {
      const { events } = await API.get('/events?limit=24');
      const grid = document.getElementById('eventsGrid');
      if (!events.length) {
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:4rem 1rem">
          <div style="font-size:3rem;margin-bottom:1rem">🎪</div>
          <h3>No upcoming events yet</h3>
          <p style="color:var(--clr-text-2)">Check back soon, or browse the directory.</p>
        </div>`;
        return;
      }
      grid.innerHTML = events.map(e => `
        <a href="/pages/events.html?id=${e.id}" class="card" style="padding:0;overflow:hidden;text-decoration:none;color:inherit;display:flex;flex-direction:column">
          <div style="height:140px;background:${e.cover_url ? `url('${e.cover_url}') center/cover` : 'linear-gradient(135deg,var(--clr-primary),#e55a2b)'};display:flex;align-items:flex-end;padding:.75rem">
            ${!e.is_free ? `<span class="badge" style="background:rgba(0,0,0,.5);color:#fff">GH₵${e.price}</span>` : `<span class="badge" style="background:rgba(0,0,0,.5);color:#fff">Free</span>`}
          </div>
          <div style="padding:1rem;flex:1;display:flex;flex-direction:column;gap:.4rem">
            <strong>${e.title}</strong>
            <span style="font-size:.8rem;color:var(--clr-text-2)">${e.businesses?.name || ''}</span>
            <span style="font-size:.8rem;color:var(--clr-text-3)"><i class="fa-regular fa-calendar"></i> ${formatDate(e.starts_at)}</span>
            ${e.location ? `<span style="font-size:.8rem;color:var(--clr-text-3)"><i class="fa-solid fa-location-dot"></i> ${e.location}</span>` : ''}
          </div>
        </a>`).join('');
    } catch { document.getElementById('eventsGrid').innerHTML = `<p style="color:var(--clr-danger)">Failed to load events.</p>`; }
  }

  async function renderDetail(id) {
    main.innerHTML = `<div class="container" style="padding:2rem 1rem;max-width:640px"><div class="card skeleton" style="height:320px"></div></div>`;
    try {
      const { event: ev, interested } = await API.get(`/events/${id}`);
      main.innerHTML = `
        <div class="container" style="padding:2rem 1rem 4rem;max-width:640px">
          <a href="/pages/events.html" style="font-size:.85rem;color:var(--clr-text-2)"><i class="fa-solid fa-arrow-left"></i> Back to Events</a>
          <div class="card" style="padding:0;overflow:hidden;margin-top:1rem">
            <div style="height:200px;background:${ev.cover_url ? `url('${ev.cover_url}') center/cover` : 'linear-gradient(135deg,var(--clr-primary),#e55a2b)'}"></div>
            <div style="padding:1.5rem">
              <h2 style="margin-top:0">${ev.title}</h2>
              <p style="color:var(--clr-text-2)">${ev.description || ''}</p>
              <div style="font-size:.9rem;color:var(--clr-text-3);display:flex;flex-direction:column;gap:.4rem;margin:1rem 0">
                <span><i class="fa-regular fa-calendar"></i> ${formatDate(ev.starts_at)}${ev.ends_at ? ` – ${formatDate(ev.ends_at)}` : ''}</span>
                ${ev.location ? `<span><i class="fa-solid fa-location-dot"></i> ${ev.location}</span>` : ''}
                <span><i class="fa-solid fa-sack-dollar"></i> ${ev.is_free ? 'Free entry' : `GH₵${ev.price}`}</span>
                <span><i class="fa-solid fa-store"></i> Hosted by ${ev.businesses?.name || 'a SpotGH business'}</span>
              </div>
              <div style="display:flex;gap:.6rem;flex-wrap:wrap">
                <button class="btn ${interested ? 'btn--primary' : 'btn--outline'}" id="interestBtn" onclick="toggleInterest('${ev.id}')">
                  <i class="fa-solid fa-star"></i> ${interested ? 'Interested' : "I'm Interested"} (${ev.interested_count})
                </button>
                ${ev.ticket_url ? `<a href="${ev.ticket_url}" target="_blank" rel="noopener" class="btn btn--secondary">Get Tickets</a>` : ''}
                ${ev.businesses?.whatsapp ? `<a href="https://wa.me/${ev.businesses.whatsapp.replace(/\\D/g,'')}" target="_blank" rel="noopener" class="btn btn--whatsapp"><i class="fab fa-whatsapp"></i> Ask on WhatsApp</a>` : ''}
              </div>
            </div>
          </div>
        </div>`;
    } catch {
      main.innerHTML = `<div class="container" style="padding:3rem 1rem;text-align:center"><p style="color:var(--clr-danger)">Event not found.</p></div>`;
    }
  }

  window.toggleInterest = async (id) => {
    if (!Auth.requireAuth()) return;
    try {
      const { interested } = await API.post(`/events/${id}/interested`);
      toast.success(interested ? "Marked as interested!" : "Removed");
      renderDetail(id);
    } catch (err) { toast.error(err.message); }
  };
});
