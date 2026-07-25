// assets/js/gallery.js
document.addEventListener('DOMContentLoaded', async () => {
  loadComponents();
  if (!Auth.requireAuth()) return;
  const bizId = new URLSearchParams(location.search).get('id');
  if (!bizId) { location.href = '/pages/dashboard.html'; return; }

  document.getElementById('pageMain').innerHTML = `
    <div class="container" style="max-width:900px;margin:0 auto;padding:2rem 1rem 4rem">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-bottom:2rem;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:1rem">
          <a href="/pages/dashboard.html" class="btn btn--ghost btn--sm"><i class="fa-solid fa-arrow-left"></i></a>
          <h1 style="font-size:1.5rem;font-weight:800;margin:0">Gallery</h1>
        </div>
        <label class="btn btn--primary btn--sm" style="cursor:pointer">
          <i class="fa-solid fa-upload"></i> Upload Photos
          <input type="file" id="galleryUpload" multiple accept="image/*" hidden onchange="uploadPhotos(this)">
        </label>
      </div>
      <div id="uploadProgress" hidden class="card" style="padding:1rem;margin-bottom:1rem">
        <div style="display:flex;align-items:center;gap:.75rem">
          <div class="spinner"></div>
          <span id="uploadMsg">Uploading…</span>
        </div>
      </div>
      <div id="galleryGrid"><div class="skeleton" style="height:300px;border-radius:16px"></div></div>
    </div>`;

  window.uploadPhotos = async (input) => {
    const files = Array.from(input.files);
    if (!files.length) return;
    document.getElementById('uploadProgress').hidden = false;
    document.getElementById('uploadMsg').textContent = `Uploading ${files.length} photo${files.length>1?'s':''}…`;
    let done = 0;
    for (const file of files) {
      try {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('type', 'gallery');
        fd.append('business_id', bizId);
        await API.upload('/upload', fd);
        done++;
        document.getElementById('uploadMsg').textContent = `Uploaded ${done}/${files.length}…`;
      } catch(e) { toast.error(`Failed to upload ${file.name}`); }
    }
    document.getElementById('uploadProgress').hidden = true;
    input.value = '';
    if (done > 0) { toast.success(`${done} photo${done>1?'s':''} uploaded!`); loadGallery(); }
  };

  window.deletePhoto = async (photoId) => {
    if (!confirm('Delete this photo?')) return;
    try {
      await API.delete(`/upload/${bizId}/gallery/${photoId}`);
      toast.success('Photo deleted');
      loadGallery();
    } catch { toast.error('Failed to delete'); }
  };

  async function loadGallery() {
    try {
      const { business } = await API.get(`/businesses/${bizId}`);
      const photos = business.gallery || [];
      const el = document.getElementById('galleryGrid');
      if (!photos.length) {
        el.innerHTML = `<div class="card" style="padding:3rem;text-align:center">
          <div style="font-size:3rem;margin-bottom:1rem">📸</div>
          <h3>No photos yet</h3>
          <p style="color:var(--clr-text-2)">Upload photos to showcase your business on your mini-site.</p>
          <label class="btn btn--primary" style="margin-top:1rem;cursor:pointer">
            <i class="fa-solid fa-upload"></i> Upload First Photo
            <input type="file" multiple accept="image/*" hidden onchange="uploadPhotos(this)">
          </label>
        </div>`;
        return;
      }
      el.innerHTML = `
        <p style="color:var(--clr-text-2);font-size:.85rem;margin-bottom:1rem">${photos.length} photo${photos.length!==1?'s':''} · <i class="fa-solid fa-grip-dots" style="color:var(--clr-primary)"></i> Drag to reorder</p>
        <div id="photoGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:.75rem">
          ${photos.map((p,i)=>`
            <div class="photo-card" draggable="true" data-id="${p.id||''}" data-sort="${i}" style="position:relative;border-radius:var(--radius-md);overflow:hidden;aspect-ratio:1;background:var(--clr-surface-2);cursor:grab;transition:opacity .2s,transform .2s">
              <img src="${p.url||p}" alt="Photo ${i+1}" style="width:100%;height:100%;object-fit:cover;pointer-events:none" loading="lazy">
              <div class="photo-overlay" style="position:absolute;inset:0;background:rgba(0,0,0,0);transition:background .2s;display:flex;align-items:center;justify-content:center;gap:.5rem;opacity:0"
                onmouseenter="this.style.opacity='1';this.style.background='rgba(0,0,0,.5)'"
                onmouseleave="this.style.opacity='0';this.style.background='rgba(0,0,0,0)'">
                <a href="${p.url||p}" target="_blank" class="btn btn--ghost btn--sm" style="color:#fff;border-color:rgba(255,255,255,.4)"><i class="fa-solid fa-eye"></i></a>
                ${p.id?`<button class="btn btn--danger btn--sm" onclick="deletePhoto('${p.id}')"><i class="fa-solid fa-trash"></i></button>`:''}
              </div>
              <div style="position:absolute;top:.5rem;left:.5rem;background:rgba(0,0,0,.5);color:#fff;border-radius:4px;padding:.15rem .4rem;font-size:.7rem;font-weight:700">${i+1}</div>
            </div>`).join('')}
        </div>
        <p style="color:var(--clr-text-3);font-size:.75rem;margin-top:.75rem"><i class="fa-solid fa-circle-info"></i> Drag photos to reorder them on your public page.</p>`;

      // Drag-to-reorder
      const grid = document.getElementById('photoGrid');
      let dragSrc = null;
      grid.querySelectorAll('.photo-card').forEach(card => {
        card.addEventListener('dragstart', e => { dragSrc = card; card.style.opacity = '.4'; e.dataTransfer.effectAllowed = 'move'; });
        card.addEventListener('dragend', () => { card.style.opacity = '1'; grid.querySelectorAll('.photo-card').forEach(c => c.style.transform = ''); });
        card.addEventListener('dragover', e => { e.preventDefault(); if (card !== dragSrc) card.style.transform = 'scale(1.05)'; });
        card.addEventListener('dragleave', () => { card.style.transform = ''; });
        card.addEventListener('drop', async e => {
          e.preventDefault(); card.style.transform = '';
          if (dragSrc === card) return;
          const cards = [...grid.querySelectorAll('.photo-card')];
          const srcIdx = cards.indexOf(dragSrc); const dstIdx = cards.indexOf(card);
          if (srcIdx < dstIdx) card.after(dragSrc); else card.before(dragSrc);
          const orderedIds = [...grid.querySelectorAll('.photo-card')].map(c => c.dataset.id).filter(Boolean);
          try { await API.patch(`/upload/${bizId}/gallery/reorder`, { photo_ids: orderedIds }); toast.success('Order saved'); }
          catch { toast.error('Failed to save order'); }
        });
      });
    } catch { document.getElementById('galleryGrid').innerHTML = '<p style="color:var(--clr-danger)">Failed to load gallery.</p>'; }
  }

  loadGallery();
});
