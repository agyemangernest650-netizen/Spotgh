// assets/js/map.js — Full Leaflet.js interactive map with clustering
document.addEventListener('DOMContentLoaded', async () => {
  loadComponents();

  // Sourced from the locations table, not hardcoded — see directory.js /
  // business-edit.js for the same fix.
  const { locations: cityData } = await API.get('/locations').catch(() => ({ locations: [] }));
  const cityOptions = [...new Set((cityData || []).map(l => l.city))].sort();

  document.getElementById('pageMain').innerHTML = `
    <div style="display:flex;flex-direction:column;height:calc(100vh - 64px)">
      <div style="padding:.75rem 1rem;background:var(--clr-surface-1);border-bottom:1px solid var(--clr-border);display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;z-index:1000;position:relative">
        <input id="mapSearch" type="text" placeholder="Search businesses on map…" class="input" style="flex:1;min-width:180px">
        <select id="mapCategory" class="input" style="width:160px">
          <option value="">All Categories</option>
        </select>
        <select id="mapCity" class="input" style="width:140px">
          <option value="">All Cities</option>
          ${cityOptions.map(c=>`<option>${c}</option>`).join('')}
        </select>
        <button class="btn btn--primary btn--sm" onclick="loadPins()"><i class="fa-solid fa-search"></i> Search</button>
        <button class="btn btn--ghost btn--sm" onclick="locateMe()"><i class="fa-solid fa-location-crosshairs"></i> Near Me</button>
        <span id="pinCount" style="font-size:.8rem;color:var(--clr-text-2);white-space:nowrap"></span>
      </div>
      <div style="flex:1;position:relative">
        <div id="mapContainer" style="width:100%;height:100%"></div>
        <!-- Popup card -->
        <div id="mapPopup" hidden style="position:absolute;bottom:1.5rem;left:50%;transform:translateX(-50%);z-index:999;width:min(340px,90vw)">
          <div class="card" style="padding:1rem">
            <div id="mapPopupContent"></div>
          </div>
        </div>
      </div>
    </div>`;

  // Load Leaflet CSS + JS dynamically
  const cssLink = document.createElement('link');
  cssLink.rel = 'stylesheet';
  cssLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
  document.head.appendChild(cssLink);

  await new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
    s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });

  // Load cluster plugin
  const clusterCss = document.createElement('link');
  clusterCss.rel = 'stylesheet';
  clusterCss.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/MarkerCluster.Default.min.css';
  document.head.appendChild(clusterCss);

  await new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/leaflet.markercluster.min.js';
    s.onload = res; s.onerror = () => res(); // non-fatal
    document.head.appendChild(s);
  });

  // Init map centred on Ghana
  const map = L.map('mapContainer').setView([7.9465, -1.0232], 7);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map);

  let markerLayer = window.L.markerClusterGroup ? L.markerClusterGroup({ maxClusterRadius: 50 }) : L.layerGroup();
  map.addLayer(markerLayer);

  let userMarker = null;

  // Custom pin icon
  const pinIcon = (color = '#4E0DAD') => L.divIcon({
    html: `<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;background:${color};border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3);transform:rotate(-45deg)"></div>`,
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  });

  // Load categories
  API.get('/categories').then(({ categories }) => {
    const sel = document.getElementById('mapCategory');
    categories.forEach(c => {
      const o = document.createElement('option');
      o.value = c.slug;
      o.textContent = `${c.icon||''} ${c.name}`;
      sel.appendChild(o);
    });
  }).catch(() => {});

  window.loadPins = async () => {
    const qs = new URLSearchParams({ limit: 500 });
    const s = document.getElementById('mapSearch').value.trim();
    const c = document.getElementById('mapCategory').value;
    const city = document.getElementById('mapCity').value;
    if (s) qs.set('search', s);
    if (c) qs.set('category', c);
    if (city) qs.set('city', city);

    try {
      const { pins } = await API.get(`/map/businesses?${qs}`);
      markerLayer.clearLayers();
      document.getElementById('mapPopup').hidden = true;

      const withCoords = (pins || []).filter(p => p.latitude && p.longitude);
      document.getElementById('pinCount').textContent = `${withCoords.length} location${withCoords.length !== 1 ? 's' : ''} found`;

      withCoords.forEach(p => {
        const marker = L.marker([p.latitude, p.longitude], { icon: pinIcon(p.theme_color || '#4E0DAD') });
        marker.on('click', () => showPopup(p));
        markerLayer.addLayer(marker);
      });

      if (withCoords.length > 0) {
        const bounds = L.latLngBounds(withCoords.map(p => [p.latitude, p.longitude]));
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      }
    } catch { toast.error('Failed to load map data'); }
  };

  function showPopup(p) {
    const popup = document.getElementById('mapPopup');
    document.getElementById('mapPopupContent').innerHTML = `
      <div style="display:flex;gap:.75rem;align-items:flex-start">
        ${p.logo_url
          ? `<img src="${p.logo_url}" style="width:52px;height:52px;border-radius:8px;object-fit:cover;flex-shrink:0">`
          : `<div style="width:52px;height:52px;border-radius:8px;background:var(--clr-surface-2);display:flex;align-items:center;justify-content:center;font-size:1.5rem;flex-shrink:0">${p.category_icon||'🏢'}</div>`}
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:.95rem;margin-bottom:.2rem">${p.name}</div>
          <div style="font-size:.78rem;color:var(--clr-text-2);margin-bottom:.5rem">${p.category_name||''} ${p.city?' · '+p.city:''}</div>
          ${p.avg_rating ? `<div style="color:var(--clr-gold);font-size:.8rem;margin-bottom:.5rem">${'★'.repeat(Math.round(p.avg_rating))} <span style="color:var(--clr-text-2)">${parseFloat(p.avg_rating).toFixed(1)} (${p.review_count||0})</span></div>` : ''}
          <div style="display:flex;gap:.5rem">
            <a href="/business?slug=${p.slug}" class="btn btn--primary btn--sm">View Page</a>
            ${p.whatsapp ? `<a href="https://wa.me/${p.whatsapp.replace(/\D/g,'')}" target="_blank" class="btn btn--ghost btn--sm" style="color:#25D366"><i class="fa-brands fa-whatsapp"></i></a>` : ''}
            ${p.latitude && p.longitude ? `<a href="https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}" target="_blank" class="btn btn--ghost btn--sm"><i class="fa-solid fa-diamond-turn-right"></i></a>` : ''}
          </div>
        </div>
        <button onclick="document.getElementById('mapPopup').hidden=true" style="background:none;border:none;cursor:pointer;color:var(--clr-text-3);font-size:1.1rem;flex-shrink:0">✕</button>
      </div>`;
    popup.hidden = false;
  }

  window.locateMe = () => {
    if (!navigator.geolocation) { toast.error('Geolocation not supported'); return; }
    navigator.geolocation.getCurrentPosition(pos => {
      const { latitude: lat, longitude: lng } = pos.coords;
      if (userMarker) map.removeLayer(userMarker);
      userMarker = L.circleMarker([lat, lng], {
        radius: 10, color: '#1971c2', fillColor: '#1971c2', fillOpacity: 0.8, weight: 3,
      }).addTo(map).bindPopup('📍 You are here').openPopup();
      map.setView([lat, lng], 13);
      // Search near current location
      API.get(`/map/businesses?lat=${lat}&lng=${lng}&radius=5000`).then(({ pins }) => {
        markerLayer.clearLayers();
        const withCoords = (pins||[]).filter(p => p.latitude && p.longitude);
        document.getElementById('pinCount').textContent = `${withCoords.length} near you`;
        withCoords.forEach(p => {
          const marker = L.marker([p.latitude, p.longitude], { icon: pinIcon(p.theme_color||'#4E0DAD') });
          marker.on('click', () => showPopup(p));
          markerLayer.addLayer(marker);
        });
      }).catch(() => {});
    }, () => toast.error('Could not get your location'));
  };

  // Re-search when map is moved significantly (filter while dragging)
  let dragDebounce;
  map.on('moveend', () => {
    clearTimeout(dragDebounce);
    dragDebounce = setTimeout(() => {
      const s = document.getElementById('mapSearch').value.trim();
      const c = document.getElementById('mapCategory').value;
      if (s || c) loadPins(); // Only auto-reload if filters are active
    }, 600);
  });

  loadPins();
});
