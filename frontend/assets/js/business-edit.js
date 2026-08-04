// assets/js/business-edit.js
document.addEventListener('DOMContentLoaded', async () => {
  loadComponents();
  if (!Auth.requireAuth()) return;

  const bizId = new URLSearchParams(location.search).get('id');
  const isEdit = !!bizId;
  let categories = [];

  // Fetched up front (not hardcoded) so the city dropdown reflects the
  // actual `locations` table — adding a new city, or eventually a new
  // country, is then just a data change rather than a frontend deploy.
  const { locations: cityData } = await API.get('/locations').catch(() => ({ locations: [] }));
  const cityOptions = [...new Set((cityData || []).map(l => l.city))].sort();

  const calendarStatus = new URLSearchParams(location.search).get('calendar');
  if (calendarStatus === 'connected') toast.success('Google Calendar connected!');
  if (calendarStatus === 'denied') toast.warning('Google Calendar connection was cancelled.');
  if (calendarStatus === 'reauth_needed') toast.warning('Please disconnect and reconnect Google Calendar to finish setup.');
  if (calendarStatus) window.history.replaceState({}, '', location.pathname + '?id=' + bizId);

  // Defined early since populating an existing business's saved delivery
  // zones (further down, when loading data for edit) calls this before
  // the rest of the form's helper functions are set up.
  window.addZoneRow = (zone) => {
    const editor = document.getElementById('zonesEditor');
    const row = document.createElement('div');
    row.className = 'zone-row';
    row.style.cssText = 'display:flex;gap:.5rem;align-items:center';
    row.innerHTML = `
      <input class="input zone-name" placeholder="Zone name (e.g. Accra Central)" style="flex:2" value="${zone?.name || ''}">
      <input class="input zone-fee" type="number" min="0" step="0.01" placeholder="Fee (GHS)" style="flex:1" value="${zone?.fee ?? ''}">
      <button type="button" class="btn btn--ghost btn--sm" onclick="this.closest('.zone-row').remove()" style="color:var(--clr-danger)"><i class="fa-solid fa-trash"></i></button>`;
    editor.appendChild(row);
  };

  document.getElementById('pageMain').innerHTML = `
    <div class="container" style="max-width:760px;margin:0 auto;padding:2rem 1rem 4rem">
      ${isEdit ? `<div id="bizAdminNav"></div>` : `
      <div style="display:flex;align-items:center;gap:1rem;margin-bottom:2rem">
        <a href="/dashboard" class="btn btn--ghost btn--sm"><i class="fa-solid fa-arrow-left"></i></a>
        <h1 style="font-size:1.5rem;font-weight:800;margin:0" id="pageTitle">Add Business</h1>
      </div>`}

      <!-- AI Helper -->
      ${isEdit?`<div class="card" style="padding:1rem 1.25rem;margin-bottom:1.5rem;background:linear-gradient(135deg,rgba(99,102,241,.08),rgba(246,160,18,.08));border:1px solid rgba(99,102,241,.2)">
        <div style="display:flex;align-items:center;gap:.75rem;flex-wrap:wrap">
          <span style="font-size:1.25rem">✨</span>
          <span style="font-size:.875rem;font-weight:600;flex:1">Generate AI description</span>
          <button class="btn btn--primary btn--sm" onclick="generateAI()"><i class="fa-solid fa-wand-magic-sparkles"></i> Generate</button>
        </div>
      </div>`:''}

      <div class="card" style="padding:1.5rem">
        <!-- Basic Info -->
        <h3 style="font-weight:700;margin-bottom:1.25rem">Basic Information</h3>
        <div style="display:flex;flex-direction:column;gap:.875rem;margin-bottom:2rem">
          <div><label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:.3rem">Business Name *</label>
            <input id="beName" class="input" placeholder="Your Business Name" style="width:100%"></div>
          <div><label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:.3rem">Tagline</label>
            <input id="beTagline" class="input" placeholder="Short catchy description (1 line)" style="width:100%"></div>
          <div><label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:.3rem">Category *</label>
            <select id="beCategory" class="input" style="width:100%">
              <option value="">Select category…</option>
            </select></div>
          <div><label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:.3rem">Description</label>
            <textarea id="beDesc" rows="5" class="input" placeholder="Tell customers about your business…" style="width:100%;resize:vertical"></textarea>
            <div id="charCount" style="font-size:.73rem;color:var(--clr-text-3);text-align:right;margin-top:.2rem">0 / 2000</div></div>
        </div>

        <hr style="border:none;border-top:1px solid var(--clr-border);margin:1.5rem 0">
        <h3 style="font-weight:700;margin-bottom:1.25rem">Contact & Location</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-bottom:2rem">
          <div><label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:.3rem">Phone</label>
            <input id="bePhone" class="input" type="tel" placeholder="0241234567" style="width:100%"></div>
          <div><label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:.3rem">WhatsApp</label>
            <input id="beWhatsapp" class="input" type="tel" placeholder="0241234567" style="width:100%"></div>
          <div><label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:.3rem">Email</label>
            <input id="beEmail" class="input" type="email" placeholder="business@email.com" style="width:100%"></div>
          <div style="grid-column:1/-1">
            <label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:.3rem">Do you already have a website? *</label>
            <div style="display:flex;gap:1.25rem;margin-bottom:.5rem">
              <label style="display:flex;align-items:center;gap:.4rem;font-size:.85rem;cursor:pointer">
                <input type="radio" name="beHasWebsite" value="yes"> Yes, I have one
              </label>
              <label style="display:flex;align-items:center;gap:.4rem;font-size:.85rem;cursor:pointer">
                <input type="radio" name="beHasWebsite" value="no"> No — build me a free SpotGH mini-website
              </label>
            </div>
            <input id="beWebsite" class="input" type="url" placeholder="https://yourwebsite.com" style="width:100%;display:none">
            <div style="font-size:.73rem;color:var(--clr-text-3);margin-top:.3rem">We'll link to it from your listing and check that it's live. If you don't have one yet, SpotGH builds and hosts a mini-website for you instead.</div>
          </div>
          <div style="grid-column:1/-1"><label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:.3rem">Address</label>
            <input id="beAddress" class="input" placeholder="Street address" style="width:100%"></div>
          <div><label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:.3rem">City</label>
            <select id="beCity" class="input" style="width:100%">
              <option value="">Select city</option>
              ${cityOptions.map(c=>`<option>${c}</option>`).join('')}
            </select></div>
          <div><label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:.3rem">Delivery fee (GHS)</label>
            <input id="beDeliveryFee" type="number" min="0" step="0.01" class="input" placeholder="0.00 = free / pickup only" style="width:100%">
            <span style="font-size:.75rem;color:var(--clr-text-3)">Charged only when a customer chooses delivery at checkout</span></div>
        </div>

        <div style="margin-top:1.25rem">
          <label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:.4rem">Delivery zones (optional)</label>
          <p style="font-size:.75rem;color:var(--clr-text-3);margin-bottom:.5rem">Add zones (e.g. "Accra Central", "Outside Accra") with their own fee. If you add zones, customers pick one at checkout instead of the flat fee above.</p>
          <div id="zonesEditor" style="display:flex;flex-direction:column;gap:.5rem;margin-bottom:.5rem"></div>
          <button type="button" class="btn btn--ghost btn--sm" onclick="addZoneRow()"><i class="fa-solid fa-plus"></i> Add Zone</button>
        </div>

        <hr style="border:none;border-top:1px solid var(--clr-border);margin:1.5rem 0">
        <h3 style="font-weight:700;margin-bottom:1.25rem">Opening Hours</h3>
        <div id="hoursEditor" style="display:flex;flex-direction:column;gap:.5rem;margin-bottom:2rem">
          ${['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].map(d => `
            <div style="display:grid;grid-template-columns:90px 1fr 1fr auto;gap:.5rem;align-items:center" data-day-row="${d}">
              <span style="font-size:.8rem;font-weight:600;text-transform:capitalize">${d}</span>
              <input type="time" class="input" data-hours-open="${d}" style="width:100%">
              <input type="time" class="input" data-hours-close="${d}" style="width:100%">
              <label style="display:flex;align-items:center;gap:.3rem;font-size:.75rem;white-space:nowrap">
                <input type="checkbox" data-hours-closed="${d}"> Closed
              </label>
            </div>`).join('')}
        </div>

        <div style="margin-bottom:2rem">
          <label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:.3rem">Amenities</label>
          <input id="beAmenities" class="input" placeholder="e.g. Free WiFi, Parking, Pool, Breakfast (comma-separated)" style="width:100%">
          <div style="font-size:.73rem;color:var(--clr-text-3);margin-top:.3rem">Shown as a checklist on your mini-website — especially useful for hotels and guesthouses.</div>
        </div>

        <hr style="border:none;border-top:1px solid var(--clr-border);margin:1.5rem 0">
        <h3 style="font-weight:700;margin-bottom:.5rem">Category Extras</h3>
        <p style="font-size:.8rem;color:var(--clr-text-3);margin-bottom:1.25rem">Optional — fill in whichever apply to your business. Each only appears on your mini-website if you add something here.</p>
        <div style="display:flex;flex-direction:column;gap:1rem;margin-bottom:2rem">
          <div><label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:.3rem">🚨 Emergency Contact</label>
            <input id="beEmergencyContact" class="input" type="tel" placeholder="e.g. 0241234567 — for hospitals, garages, etc." style="width:100%"></div>
          <div><label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:.3rem">Insurance Accepted</label>
            <input id="beInsurance" class="input" placeholder="e.g. NHIS, Acacia, Nationwide (comma-separated)" style="width:100%"></div>
          <div><label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:.3rem">Nearby Attractions</label>
            <input id="beNearbyAttractions" class="input" placeholder="e.g. Labadi Beach, Accra Mall (comma-separated) — for hotels" style="width:100%"></div>
          <div><label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:.3rem">Measurement Guide</label>
            <textarea id="beMeasurementGuide" rows="3" class="input" placeholder="Instructions for how customers should take/submit measurements — for tailors/fashion" style="width:100%;resize:vertical"></textarea></div>
          <div><label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:.3rem">Health Tips</label>
            <textarea id="beHealthTips" rows="3" class="input" placeholder="A short health tip or notice for patients — for clinics/hospitals" style="width:100%;resize:vertical"></textarea></div>
        </div>

        <hr style="border:none;border-top:1px solid var(--clr-border);margin:1.5rem 0">
        <h3 style="font-weight:700;margin-bottom:.25rem">Search Engine (SEO)</h3>
        <p style="font-size:.8rem;color:var(--clr-text-3);margin-bottom:1rem">Controls how your business appears in Google search results. Optional — we'll use your business name/description if left blank.</p>
        <div style="display:flex;flex-direction:column;gap:.75rem;margin-bottom:.75rem">
          <div><label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:.3rem">SEO Title <span style="font-weight:400;color:var(--clr-text-3)">(max 60 characters)</span></label>
            <input id="beMetaTitle" class="input" maxlength="60" placeholder="e.g. Buka Restaurant — Best Local Food in Osu, Accra" style="width:100%"></div>
          <div><label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:.3rem">SEO Description <span style="font-weight:400;color:var(--clr-text-3)">(max 155 characters)</span></label>
            <textarea id="beMetaDescription" rows="2" maxlength="155" class="input" placeholder="A short, compelling summary that shows up under your listing on Google" style="width:100%;resize:vertical"></textarea></div>
        </div>
        <button type="button" class="btn btn--ghost btn--sm" id="aiSeoBtn" onclick="generateSeoMeta()" style="margin-bottom:2rem"><i class="fa-solid fa-wand-magic-sparkles"></i> Generate with AI</button>

        <hr style="border:none;border-top:1px solid var(--clr-border);margin:1.5rem 0">
        <h3 style="font-weight:700;margin-bottom:1.25rem">Social Media</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-bottom:2rem">
          <div><label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:.3rem"><i class="fab fa-facebook-f" style="color:#1877f2"></i> Facebook</label>
            <input id="beFacebook" class="input" placeholder="https://facebook.com/…" style="width:100%"></div>
          <div><label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:.3rem"><i class="fab fa-instagram" style="color:#e1306c"></i> Instagram</label>
            <input id="beInstagram" class="input" placeholder="https://instagram.com/…" style="width:100%"></div>
          <div><label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:.3rem"><i class="fab fa-x-twitter"></i> Twitter/X</label>
            <input id="beTwitter" class="input" placeholder="https://x.com/…" style="width:100%"></div>
          <div><label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:.3rem"><i class="fab fa-tiktok"></i> TikTok</label>
            <input id="beTiktok" class="input" placeholder="https://tiktok.com/@…" style="width:100%"></div>
        </div>

        <hr style="border:none;border-top:1px solid var(--clr-border);margin:1.5rem 0">
        <h3 style="font-weight:700;margin-bottom:1.25rem">Images</h3>
        ${isEdit ? `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-bottom:2rem">
          <div>
            <label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:.3rem">Logo</label>
            <div id="logoPreview" style="width:80px;height:80px;border-radius:12px;background:var(--clr-surface-2);display:flex;align-items:center;justify-content:center;font-size:2rem;margin-bottom:.5rem;overflow:hidden">🏢</div>
            <label class="btn btn--outline btn--sm" style="cursor:pointer"><i class="fa-solid fa-upload"></i> Upload Logo<input type="file" accept="image/*" hidden onchange="uploadImg(this,'logo')"></label>
            <input id="beLogoUrl" type="hidden">
          </div>
          <div>
            <label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:.3rem">Cover Photo</label>
            <div id="coverPreview" style="width:100%;height:80px;border-radius:12px;background:var(--clr-surface-2);display:flex;align-items:center;justify-content:center;font-size:1.5rem;margin-bottom:.5rem;overflow:hidden">🖼️</div>
            <label class="btn btn--outline btn--sm" style="cursor:pointer"><i class="fa-solid fa-upload"></i> Upload Cover<input type="file" accept="image/*" hidden onchange="uploadImg(this,'cover')"></label>
            <input id="beCoverUrl" type="hidden">
          </div>
        </div>
        <h3 style="font-weight:700;margin-bottom:.75rem">Menu / Price List (PDF)</h3>
        <div style="margin-bottom:2rem">
          <div id="menuPreview" style="font-size:.875rem;color:var(--clr-text-2);margin-bottom:.5rem">No menu uploaded yet.</div>
          <label class="btn btn--outline btn--sm" style="cursor:pointer"><i class="fa-solid fa-file-pdf"></i> Upload Menu PDF<input type="file" accept="application/pdf" hidden onchange="uploadMenu(this)"></label>
        </div>` : `
        <p style="color:var(--clr-text-2);font-size:.875rem;margin-bottom:2rem">Save your business first — then come back here to add a logo, cover photo, and menu.</p>`}

        <div id="verificationCard"></div>
        <div id="availabilityCard"></div>
        <div id="staffCard"></div>
        <div id="enterpriseToolsCard"></div>

        <div style="display:flex;gap:.75rem;justify-content:flex-end;flex-wrap:wrap">
          <a href="/dashboard" class="btn btn--ghost">Cancel</a>
          <button id="saveBtn" class="btn btn--primary" onclick="saveBusiness()">${isEdit?'Save Changes':'Create Listing'}</button>
        </div>
      </div>
    </div>`;
  if (isEdit) renderBizAdminNav('bizAdminNav', bizId, 'edit');

  // Char counter
  document.getElementById('beDesc').addEventListener('input', e => {
    document.getElementById('charCount').textContent = `${e.target.value.length} / 2000`;
  });

  // "Do you already have a website?" — show the URL field only when Yes
  document.querySelectorAll('input[name="beHasWebsite"]').forEach(r => {
    r.addEventListener('change', () => {
      if (r.checked) document.getElementById('beWebsite').style.display = r.value === 'yes' ? 'block' : 'none';
    });
  });

  // Load categories
  try {
    const { categories: cats } = await API.get('/categories');
    categories = cats;
    const sel = document.getElementById('beCategory');
    cats.forEach(c => { const o = document.createElement('option'); o.value = c.id; o.textContent = `${c.icon||''} ${c.name}`; sel.appendChild(o); });
  } catch {}

  // Load existing business data if editing
  if (isEdit) {
    try {
      const { business: b } = await API.get(`/businesses/${bizId}`);
      document.getElementById('beName').value     = b.name || '';
      document.getElementById('beTagline').value  = b.tagline || '';
      document.getElementById('beDesc').value     = b.description || '';
      document.getElementById('charCount').textContent = `${(b.description||'').length} / 2000`;
      document.getElementById('bePhone').value    = b.phone || '';
      document.getElementById('beWhatsapp').value = b.whatsapp || '';
      document.getElementById('beEmail').value    = b.email || '';
      document.getElementById('beWebsite').value  = b.website || '';
      const hasWebsiteRadio = document.querySelector(`input[name="beHasWebsite"][value="${b.has_own_website ? 'yes' : 'no'}"]`);
      if (hasWebsiteRadio) hasWebsiteRadio.checked = true;
      document.getElementById('beWebsite').style.display = b.has_own_website ? 'block' : 'none';
      document.getElementById('beAddress').value  = b.address || '';
      document.getElementById('beFacebook').value = b.social_links?.facebook || '';
      document.getElementById('beInstagram').value= b.social_links?.instagram || '';
      document.getElementById('beTwitter').value  = b.social_links?.twitter || '';
      document.getElementById('beTiktok').value   = b.social_links?.tiktok || '';
      document.getElementById('beAmenities').value = (b.amenities || []).join(', ');
      document.getElementById('beEmergencyContact').value = b.emergency_contact || '';
      document.getElementById('beInsurance').value = (b.insurance_accepted || []).join(', ');
      document.getElementById('beNearbyAttractions').value = (b.nearby_attractions || []).join(', ');
      document.getElementById('beMeasurementGuide').value = b.measurement_guide || '';
      document.getElementById('beHealthTips').value = b.health_tips || '';
      document.getElementById('beMetaTitle').value = b.meta_title || '';
      document.getElementById('beMetaDescription').value = b.meta_description || '';
      const oh = b.operating_hours || {};
      ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].forEach(d => {
        const day = oh[d] || {};
        if (day.open)  document.querySelector(`[data-hours-open="${d}"]`).value  = day.open;
        if (day.close) document.querySelector(`[data-hours-close="${d}"]`).value = day.close;
        document.querySelector(`[data-hours-closed="${d}"]`).checked = !!day.closed;
      });
      document.getElementById('beLogoUrl').value  = b.logo_url || '';
      document.getElementById('beCoverUrl').value = b.cover_url || '';
      if (b.city) document.getElementById('beCity').value = b.city;
      document.getElementById('beDeliveryFee').value = b.delivery_fee || '';
      (b.delivery_zones || []).forEach(z => addZoneRow(z));
      if (b.category_id) document.getElementById('beCategory').value = b.category_id;
      if (b.logo_url) document.getElementById('logoPreview').innerHTML = `<img src="${b.logo_url}" style="width:100%;height:100%;object-fit:cover">`;
      if (b.cover_url) document.getElementById('coverPreview').innerHTML = `<img src="${b.cover_url}" style="width:100%;height:100%;object-fit:cover">`;
      if (b.menu_pdf_url) document.getElementById('menuPreview').innerHTML = `<a href="${b.menu_pdf_url}" target="_blank" rel="noopener"><i class="fa-solid fa-file-pdf"></i> View current menu</a>`;
      if (b.subscription_tier === 'enterprise') renderEnterpriseTools();
      renderVerification(b);
      renderAvailability(b);
      renderStaffManager(b);
    } catch { toast.error('Failed to load business data'); }
  }

  window.uploadImg = async (input, type) => {
    if (!input.files[0] || !bizId) return;
    try {
      const fd = new FormData(); fd.append(type, input.files[0]);
      const { url } = await API.upload(`/upload/${bizId}/${type}`, fd);
      if (type === 'logo') {
        document.getElementById('beLogoUrl').value = url;
        document.getElementById('logoPreview').innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover">`;
      } else {
        document.getElementById('beCoverUrl').value = url;
        document.getElementById('coverPreview').innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover">`;
      }
      toast.success('Image uploaded!');
    } catch { toast.error('Failed to upload image'); }
  };

  window.uploadMenu = async (input) => {
    if (!input.files[0] || !bizId) return;
    try {
      const fd = new FormData(); fd.append('menu', input.files[0]);
      const { url } = await API.upload(`/upload/${bizId}/menu`, fd);
      document.getElementById('menuPreview').innerHTML = `<a href="${url}" target="_blank" rel="noopener"><i class="fa-solid fa-file-pdf"></i> View current menu</a>`;
      toast.success('Menu uploaded!');
    } catch { toast.error('Failed to upload menu'); }
  };

  window.generateAI = async () => {
    const name = document.getElementById('beName').value.trim();
    const catSel = document.getElementById('beCategory');
    const catName = catSel.options[catSel.selectedIndex]?.text || '';
    const city = document.getElementById('beCity').value;
    if (!name) { toast.warning('Enter your business name first'); return; }
    toast.show('Generating AI description…', 'default', 3000);
    try {
      const { description } = await API.post('/ai/generate-description', { business_id: bizId, business_name: name, category: catName, city });
      document.getElementById('beDesc').value = description;
      document.getElementById('charCount').textContent = `${description.length} / 2000`;
      toast.success('Description generated!');
    } catch (err) { toast.error(err.message || 'AI generation failed. Please try again.'); }
  };

  window.generateSeoMeta = async () => {
    const name = document.getElementById('beName').value.trim();
    const catSel = document.getElementById('beCategory');
    const catName = catSel.options[catSel.selectedIndex]?.text || '';
    const city = document.getElementById('beCity').value;
    const description = document.getElementById('beDesc').value.trim();
    if (!name) { toast.warning('Enter your business name first'); return; }
    const btn = document.getElementById('aiSeoBtn');
    btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating…';
    try {
      const { meta_title, meta_description } = await API.post('/ai/generate-meta', { business_id: bizId, business_name: name, category: catName, city, description });
      if (meta_title) document.getElementById('beMetaTitle').value = meta_title;
      if (meta_description) document.getElementById('beMetaDescription').value = meta_description;
      toast.success('SEO details generated!');
    } catch (err) { toast.error(err.message || 'AI generation failed. Please try again.'); }
    finally { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Generate with AI'; }
  };

  // ── Verification (Ghana Card / business registration) ──────────────────
  async function renderVerification(biz) {
    const card = document.getElementById('verificationCard');
    let requests = [];
    try { ({ requests } = await API.get(`/verification/business/${bizId}`)); } catch {}
    const latest = requests[0];

    card.innerHTML = `
      <hr style="border:none;border-top:1px solid var(--clr-border);margin:1.5rem 0">
      <h3 style="font-weight:700;margin-bottom:.25rem"><i class="fa-solid fa-shield-halved" style="color:var(--clr-success)"></i> Business Verification</h3>
      <p style="color:var(--clr-text-2);font-size:.85rem;margin-bottom:1.25rem">Verify with your Ghana Card or business registration to earn a verified badge that builds customer trust.</p>
      <div class="card" style="padding:1.25rem">
        ${biz.is_verified ? `
          <p style="font-size:.9rem"><span class="badge badge--success"><i class="fa-solid fa-circle-check"></i> Verified</span> Your business is verified.</p>
        ` : latest?.status === 'pending' ? `
          <p style="font-size:.9rem"><span class="badge badge--warning">Pending review</span> We typically review within 2 business days.</p>
        ` : `
          ${latest?.status === 'rejected' ? `<p style="font-size:.85rem;color:var(--clr-danger);margin-bottom:.75rem">Previous submission was not approved${latest.rejection_reason ? `: ${latest.rejection_reason}` : ''}. You can resubmit below.</p>` : ''}
          <div style="display:flex;flex-direction:column;gap:.75rem;max-width:360px">
            <select id="verifDocType" class="form-select">
              <option value="ghana_card">Ghana Card</option>
              <option value="business_registration">Business Registration Certificate</option>
              <option value="tin">Tax Identification Number (TIN)</option>
            </select>
            <input id="verifDocNumber" class="form-input" placeholder="Document number (optional)">
            <input id="verifDocFile" type="file" accept="image/*,application/pdf" class="form-input">
            <button class="btn btn--primary btn--sm" onclick="submitVerification()">Submit for Review</button>
          </div>`}
      </div>`;
  }

  window.submitVerification = async () => {
    const file = document.getElementById('verifDocFile')?.files[0];
    if (!file) return toast.error('Please choose a document to upload');
    const fd = new FormData();
    fd.append('document', file);
    fd.append('document_type', document.getElementById('verifDocType').value);
    fd.append('document_number', document.getElementById('verifDocNumber').value);
    try {
      await API.upload(`/verification/business/${bizId}`, fd);
      toast.success('Submitted! We will review your documents shortly.');
      const { business: b } = await API.get(`/businesses/${bizId}`);
      renderVerification(b);
    } catch (err) { toast.error(err.message); }
  };

  // ── Availability (weekly hours + blocked dates, powers the booking widget) ──
  const DOW = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  // ── Team / staff profiles (stylists, doctors, mechanics, etc.) ──────────
  async function renderStaffManager(biz) {
    if (!isEdit) return;
    const card = document.getElementById('staffCard');
    let staff = [];
    try { ({ staff } = await API.get(`/businesses/${bizId}/staff`)); } catch {}

    const memberRow = (s) => `
      <div class="card" style="padding:1rem;display:flex;gap:1rem;align-items:center" data-staff-id="${s.id}">
        ${s.photo_url
          ? `<img src="${s.photo_url}" alt="${s.name}" style="width:50px;height:50px;border-radius:50%;object-fit:cover;flex-shrink:0">`
          : `<div style="width:50px;height:50px;border-radius:50%;background:var(--clr-primary-10);color:var(--clr-primary);display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0">${(s.name||'?').charAt(0)}</div>`}
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:.9rem">${s.name}</div>
          <div style="font-size:.78rem;color:var(--clr-text-3)">${s.role || ''}</div>
        </div>
        <button type="button" class="btn btn--ghost btn--sm" onclick="removeStaffMember('${s.id}')" style="color:var(--clr-danger)"><i class="fa-solid fa-trash"></i></button>
      </div>`;

    card.innerHTML = `
      <hr style="border:none;border-top:1px solid var(--clr-border);margin:1.5rem 0">
      <h3 style="font-weight:700;margin-bottom:.25rem"><i class="fa-solid fa-user-group"></i> Team Members</h3>
      <p style="color:var(--clr-text-2);font-size:.85rem;margin-bottom:1.25rem">Add stylists, doctors, mechanics, or any staff you want customers to see on your mini-website. Optional.</p>
      <div id="staffList" style="display:flex;flex-direction:column;gap:.75rem;margin-bottom:1.25rem">
        ${staff.length ? staff.map(memberRow).join('') : `<p style="color:var(--clr-text-3);font-size:.85rem">No team members added yet.</p>`}
      </div>
      <div class="card" style="padding:1.25rem">
        <h4 style="font-weight:700;font-size:.9rem;margin-bottom:.75rem">Add Team Member</h4>
        <div style="display:flex;gap:1rem;align-items:flex-start;flex-wrap:wrap">
          <div style="text-align:center">
            <div id="staffPhotoPreview" style="width:64px;height:64px;border-radius:50%;background:var(--clr-surface-2);display:flex;align-items:center;justify-content:center;font-size:1.3rem;margin-bottom:.4rem;overflow:hidden">👤</div>
            <label class="btn btn--ghost btn--sm" style="cursor:pointer;font-size:.75rem"><i class="fa-solid fa-upload"></i><input type="file" accept="image/*" hidden onchange="uploadStaffPhoto(this)"></label>
            <input id="newStaffPhotoUrl" type="hidden">
          </div>
          <div style="flex:1;min-width:200px;display:flex;flex-direction:column;gap:.5rem">
            <input id="newStaffName" class="input" placeholder="Name *">
            <input id="newStaffRole" class="input" placeholder="Role (e.g. Senior Stylist, Dr., Mechanic)">
            <textarea id="newStaffBio" class="input" rows="2" placeholder="Short bio (optional)" style="resize:vertical"></textarea>
            <button type="button" class="btn btn--primary btn--sm" onclick="addStaffMember()" style="align-self:flex-start">Add Team Member</button>
          </div>
        </div>
      </div>`;
  }

  window.uploadStaffPhoto = async (input) => {
    if (!input.files[0]) return;
    try {
      const fd = new FormData(); fd.append('photo', input.files[0]);
      const { url } = await API.upload(`/upload/${bizId}/staff-photo`, fd);
      document.getElementById('newStaffPhotoUrl').value = url;
      document.getElementById('staffPhotoPreview').innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover">`;
    } catch { toast.error('Failed to upload photo'); }
  };

  window.addStaffMember = async () => {
    const name = document.getElementById('newStaffName').value.trim();
    if (!name) return toast.warning('Name is required');
    try {
      await API.post(`/businesses/${bizId}/staff`, {
        name,
        role: document.getElementById('newStaffRole').value.trim() || null,
        bio: document.getElementById('newStaffBio').value.trim() || null,
        photo_url: document.getElementById('newStaffPhotoUrl').value || null,
      });
      toast.success('Team member added');
      const { business: b } = await API.get(`/businesses/${bizId}`);
      renderStaffManager(b);
    } catch (err) { toast.error(err.message || 'Failed to add team member'); }
  };

  window.removeStaffMember = async (staffId) => {
    if (!confirm('Remove this team member?')) return;
    try {
      await API.delete(`/businesses/${bizId}/staff/${staffId}`);
      document.querySelector(`[data-staff-id="${staffId}"]`)?.remove();
      toast.success('Removed');
    } catch { toast.error('Failed to remove'); }
  };

  async function renderAvailability(biz) {
    if (biz.subscription_tier === 'free' || biz.subscription_tier === 'starter') return; // bookings require Pro+
    const card = document.getElementById('availabilityCard');
    let hours = [], blocked = [];
    try { ({ hours, blocked_dates: blocked } = await API.get(`/availability/${bizId}`)); } catch {}
    const byDay = {}; (hours||[]).forEach(h => byDay[h.day_of_week] = h);

    card.innerHTML = `
      <hr style="border:none;border-top:1px solid var(--clr-border);margin:1.5rem 0">
      <h3 style="font-weight:700;margin-bottom:.25rem"><i class="fa-solid fa-calendar-days"></i> Appointment Availability</h3>
      <p style="color:var(--clr-text-2);font-size:.85rem;margin-bottom:1.25rem">Set your weekly hours and block off dates so customers only see real open slots when booking.</p>
      <div class="card" style="padding:1.25rem;margin-bottom:1.25rem">
        <h4 style="font-weight:700;font-size:.95rem;margin-bottom:.75rem">Weekly Hours</h4>
        <div style="display:flex;flex-direction:column;gap:.5rem" id="hoursRows">
          ${DOW.map((name, i) => {
            const h = byDay[i] || {};
            return `
            <div style="display:flex;align-items:center;gap:.6rem;flex-wrap:wrap" data-dow="${i}">
              <span style="width:90px;font-size:.85rem">${name}</span>
              <label style="font-size:.8rem;display:flex;align-items:center;gap:.3rem"><input type="checkbox" class="hr-closed" ${h.is_closed || !h.open_time ? 'checked' : ''}> Closed</label>
              <input type="time" class="form-input hr-open" value="${h.open_time?.slice(0,5) || '09:00'}" style="width:110px" ${h.is_closed || !h.open_time ? 'disabled' : ''}>
              <span style="font-size:.8rem">to</span>
              <input type="time" class="form-input hr-close" value="${h.close_time?.slice(0,5) || '17:00'}" style="width:110px" ${h.is_closed || !h.open_time ? 'disabled' : ''}>
              <input type="number" class="form-input hr-slot" value="${h.slot_minutes || 60}" title="Slot length (minutes)" style="width:80px" min="15" step="15">
            </div>`;
          }).join('')}
        </div>
        <button class="btn btn--primary btn--sm" style="margin-top:1rem" onclick="saveHours()">Save Weekly Hours</button>
      </div>
      <div class="card" style="padding:1.25rem">
        <h4 style="font-weight:700;font-size:.95rem;margin-bottom:.75rem">Blocked Dates</h4>
        <div style="display:flex;gap:.5rem;margin-bottom:1rem;flex-wrap:wrap">
          <input type="date" id="blockDateInput" class="form-input" style="max-width:180px">
          <input type="text" id="blockReasonInput" class="form-input" placeholder="Reason (optional)" style="flex:1;min-width:160px">
          <button class="btn btn--outline btn--sm" onclick="addBlockedDate()">Block Date</button>
        </div>
        <div id="blockedDatesList">
          ${(blocked||[]).length ? blocked.map(b => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:.4rem 0;border-bottom:1px solid var(--clr-border);font-size:.85rem">
              <span>${formatDate(b.blocked_date)}${b.reason ? ` — ${b.reason}` : ''}</span>
              <button class="btn btn--ghost btn--sm" style="color:var(--clr-danger)" onclick="removeBlockedDate('${b.id}')"><i class="fa-solid fa-trash"></i></button>
            </div>`).join('') : '<p style="font-size:.85rem;color:var(--clr-text-3)">No blocked dates.</p>'}
        </div>
      </div>

      <div class="card" style="padding:1.25rem;margin-top:1.25rem">
        <h4 style="font-weight:700;font-size:.95rem;margin-bottom:.5rem"><i class="fa-brands fa-google"></i> Google Calendar Sync</h4>
        <p style="color:var(--clr-text-2);font-size:.85rem;margin-bottom:.75rem">Automatically add new bookings to your Google Calendar so they show up alongside your other appointments.</p>
        <div id="gcalStatus">
          ${biz.google_calendar_connected
            ? `<span class="badge" style="background:rgba(34,197,94,.12);color:var(--clr-success);margin-bottom:.75rem;display:inline-block"><i class="fa-solid fa-check"></i> Connected</span><br>
               <button class="btn btn--ghost btn--sm" style="color:var(--clr-danger)" onclick="disconnectCalendar()">Disconnect</button>`
            : `<a href="/api/calendar/${bizId}/connect" class="btn btn--outline btn--sm"><i class="fa-brands fa-google"></i> Connect Google Calendar</a>`}
        </div>
      </div>`;

    window.disconnectCalendar = async () => {
      if (!confirm('Stop syncing new bookings to Google Calendar?')) return;
      try { await API.delete(`/calendar/${bizId}/disconnect`); toast.success('Disconnected'); const { business: b } = await API.get(`/businesses/${bizId}`); renderAvailability(b); }
      catch { toast.error('Failed to disconnect'); }
    };

    card.querySelectorAll('.hr-closed').forEach(cb => cb.addEventListener('change', (e) => {
      const row = e.target.closest('[data-dow]');
      row.querySelectorAll('.hr-open,.hr-close').forEach(inp => inp.disabled = e.target.checked);
    }));
  }

  window.saveHours = async () => {
    const rows = [...document.querySelectorAll('#hoursRows [data-dow]')].map(row => ({
      day_of_week: Number(row.dataset.dow),
      is_closed: row.querySelector('.hr-closed').checked,
      open_time: row.querySelector('.hr-open').value,
      close_time: row.querySelector('.hr-close').value,
      slot_minutes: Number(row.querySelector('.hr-slot').value) || 60,
    }));
    try { await API.put(`/availability/${bizId}/hours`, { hours: rows }); toast.success('Hours saved!'); }
    catch (err) { toast.error(err.message); }
  };

  window.addBlockedDate = async () => {
    const blocked_date = document.getElementById('blockDateInput').value;
    const reason = document.getElementById('blockReasonInput').value;
    if (!blocked_date) return toast.error('Pick a date first');
    try {
      await API.post(`/availability/${bizId}/blocked-dates`, { blocked_date, reason });
      toast.success('Date blocked');
      const { business: b } = await API.get(`/businesses/${bizId}`);
      renderAvailability(b);
    } catch (err) { toast.error(err.message); }
  };

  window.removeBlockedDate = async (id) => {
    try {
      await API.delete(`/availability/${bizId}/blocked-dates/${id}`);
      toast.success('Date unblocked');
      const { business: b } = await API.get(`/businesses/${bizId}`);
      renderAvailability(b);
    } catch (err) { toast.error(err.message); }
  };

  // ── Enterprise Tools: custom domain + API keys ─────────────────────────
  async function renderEnterpriseTools() {
    const card = document.getElementById('enterpriseToolsCard');
    let biz = {}, keys = [];
    try { ({ business: biz } = await API.get(`/businesses/${bizId}`)); } catch {}
    try { ({ keys } = await API.get(`/businesses/${bizId}/api-keys`)); } catch {}

    card.innerHTML = `
      <hr style="border:none;border-top:1px solid var(--clr-border);margin:1.5rem 0">
      <h3 style="font-weight:700;margin-bottom:.25rem"><i class="fa-solid fa-crown" style="color:var(--clr-gold)"></i> Enterprise Tools</h3>
      <p style="color:var(--clr-text-2);font-size:.85rem;margin-bottom:1.25rem">Custom domain and API access — included with your Enterprise plan.</p>

      <div class="card" style="padding:1.25rem;margin-bottom:1.25rem">
        <h4 style="font-weight:700;margin-bottom:.5rem;font-size:.95rem">Custom Domain</h4>
        ${biz.custom_domain ? `
          <p style="font-size:.875rem;margin-bottom:.75rem">
            <strong>${biz.custom_domain}</strong>
            ${biz.custom_domain_verified
              ? '<span class="badge badge--success" style="margin-left:.5rem"><i class="fa-solid fa-circle-check"></i> Verified</span>'
              : '<span class="badge badge--warning" style="margin-left:.5rem">Pending verification</span>'}
          </p>
          <div style="display:flex;gap:.5rem;flex-wrap:wrap">
            ${!biz.custom_domain_verified ? '<button class="btn btn--primary btn--sm" onclick="verifyDomain()">Verify Now</button>' : ''}
            <button class="btn btn--ghost btn--sm" onclick="removeDomain()">Remove</button>
          </div>
        ` : `
          <div style="display:flex;gap:.5rem;flex-wrap:wrap">
            <input id="domainInput" class="input" placeholder="www.yourbusiness.com" style="flex:1;min-width:200px">
            <button class="btn btn--primary btn--sm" onclick="connectDomain()">Connect</button>
          </div>`}
        <div id="domainInstructions" style="margin-top:.75rem;font-size:.8rem;color:var(--clr-text-2)"></div>
      </div>

      <div class="card" style="padding:1.25rem">
        <h4 style="font-weight:700;margin-bottom:.5rem;font-size:.95rem">API Keys</h4>
        <p style="color:var(--clr-text-2);font-size:.8rem;margin-bottom:.75rem">Read-only access to your business's own data — profile, products, reviews, bookings, orders.</p>
        <div style="background:var(--clr-surface-2);border-radius:var(--radius-sm);padding:.6rem .75rem;margin-bottom:.75rem;font-size:.78rem;color:var(--clr-text-2)">
          <code style="display:block;margin-bottom:.3rem">GET ${location.origin}/api/v1/business</code>
          <code style="display:block;margin-bottom:.3rem">GET ${location.origin}/api/v1/products</code>
          <code style="display:block;margin-bottom:.3rem">GET ${location.origin}/api/v1/bookings</code>
          <code style="display:block;margin-bottom:.3rem">GET ${location.origin}/api/v1/reviews</code>
          <code style="display:block">GET ${location.origin}/api/v1/orders</code>
          <div style="margin-top:.5rem">Send your key as an <code>X-API-Key</code> header on every request.</div>
        </div>
        <div id="apiKeysList" style="margin-bottom:.75rem">
          ${keys.filter(k=>!k.revoked_at).map(k => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:.5rem 0;border-bottom:1px solid var(--clr-border);font-size:.85rem">
              <span><code>${k.key_prefix}…</code> · ${k.name || 'Default key'}</span>
              <button class="btn btn--ghost btn--sm" onclick="revokeKey('${k.id}')" style="color:var(--clr-danger)">Revoke</button>
            </div>`).join('') || '<p style="font-size:.85rem;color:var(--clr-text-3)">No active API keys yet.</p>'}
        </div>
        <button class="btn btn--outline btn--sm" onclick="createKey()"><i class="fa-solid fa-key"></i> Generate New Key</button>
        <div id="newKeyDisplay" style="margin-top:.75rem"></div>
      </div>`;
  }

  window.connectDomain = async () => {
    const domain = document.getElementById('domainInput')?.value.trim();
    if (!domain) return;
    try {
      const res = await API.post(`/businesses/${bizId}/custom-domain`, { domain });
      toast.success('Domain saved — add the DNS record below, then verify.');
      document.getElementById('domainInstructions').innerHTML = `
        <strong>1. Add this TXT record</strong> at your domain registrar:<br>
        Host: <code>${res.instructions.txt.host}</code><br>
        Value: <code>${res.instructions.txt.value}</code><br><br>
        <strong>2. Point your domain at us</strong> — add a CNAME record:<br>
        Host: <code>${res.instructions.cname.host}</code> → <code>${res.instructions.cname.value}</code><br><br>
        DNS changes can take up to 24 hours. Click "Verify Now" once the TXT record is live.`;
      renderEnterpriseTools();
    } catch (e) { toast.error(e.message || 'Could not connect domain'); }
  };
  window.verifyDomain = async () => {
    try {
      await API.post(`/businesses/${bizId}/custom-domain/verify`, {});
      toast.success('Domain verified!');
      renderEnterpriseTools();
    } catch (e) { toast.error(e.message || 'Not verified yet — DNS may still be propagating.'); }
  };
  window.removeDomain = async () => {
    if (!confirm('Remove this custom domain?')) return;
    try { await API.delete(`/businesses/${bizId}/custom-domain`); toast.success('Domain removed'); renderEnterpriseTools(); }
    catch { toast.error('Failed to remove domain'); }
  };
  window.createKey = async () => {
    try {
      const res = await API.post(`/businesses/${bizId}/api-keys`, {});
      document.getElementById('newKeyDisplay').innerHTML = `
        <div class="alert alert--success" style="font-size:.8rem;word-break:break-all">
          <strong>Copy this now — it won't be shown again:</strong><br><code>${res.key}</code>
        </div>`;
      renderEnterpriseTools();
    } catch (e) { toast.error(e.message || 'Failed to create key'); }
  };
  window.revokeKey = async (keyId) => {
    if (!confirm('Revoke this API key? Anything using it will stop working immediately.')) return;
    try { await API.delete(`/businesses/${bizId}/api-keys/${keyId}`); toast.success('Key revoked'); renderEnterpriseTools(); }
    catch { toast.error('Failed to revoke key'); }
  };

  window.saveBusiness = async () => {
    const name = document.getElementById('beName').value.trim();
    const category = document.getElementById('beCategory').value;
    if (!name) { toast.warning('Business name is required'); return; }
    if (!category) { toast.warning('Please select a category'); return; }

    const hasWebsiteChecked = document.querySelector('input[name="beHasWebsite"]:checked');
    if (!hasWebsiteChecked) { toast.warning('Please tell us whether you already have a website'); return; }
    const hasOwnWebsite = hasWebsiteChecked.value === 'yes';
    const websiteUrl = document.getElementById('beWebsite').value.trim();
    if (hasOwnWebsite && !/^https?:\/\/.+\..+/.test(websiteUrl)) {
      toast.warning('Please enter a valid website URL, including https://');
      return;
    }

    const btn = document.getElementById('saveBtn');
    setLoading(btn, true, isEdit?'Saving…':'Creating…');

    const body = {
      name,
      category_id: category,
      has_own_website: hasOwnWebsite,
      tagline:     document.getElementById('beTagline').value.trim(),
      description: document.getElementById('beDesc').value.trim(),
      phone:       document.getElementById('bePhone').value.trim(),
      whatsapp:    document.getElementById('beWhatsapp').value.trim(),
      email:       document.getElementById('beEmail').value.trim(),
      website:     hasOwnWebsite ? websiteUrl : '',
      address:     document.getElementById('beAddress').value.trim(),
      city:        document.getElementById('beCity').value,
      delivery_fee: parseFloat(document.getElementById('beDeliveryFee').value) || 0,
      delivery_zones: Array.from(document.querySelectorAll('.zone-row')).map(row => ({
        name: row.querySelector('.zone-name').value.trim(),
        fee: parseFloat(row.querySelector('.zone-fee').value) || 0,
      })).filter(z => z.name),
      operating_hours: Object.fromEntries(
        ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].map(d => [d, {
          open:   document.querySelector(`[data-hours-open="${d}"]`).value || null,
          close:  document.querySelector(`[data-hours-close="${d}"]`).value || null,
          closed: document.querySelector(`[data-hours-closed="${d}"]`).checked,
        }])
      ),
      social_links: {
        facebook:  document.getElementById('beFacebook').value.trim(),
        instagram: document.getElementById('beInstagram').value.trim(),
        twitter:   document.getElementById('beTwitter').value.trim(),
        tiktok:    document.getElementById('beTiktok').value.trim(),
      },
      amenities: document.getElementById('beAmenities').value.split(',').map(s => s.trim()).filter(Boolean),
      emergency_contact: document.getElementById('beEmergencyContact').value.trim() || null,
      insurance_accepted: document.getElementById('beInsurance').value.split(',').map(s => s.trim()).filter(Boolean),
      nearby_attractions: document.getElementById('beNearbyAttractions').value.split(',').map(s => s.trim()).filter(Boolean),
      measurement_guide: document.getElementById('beMeasurementGuide').value.trim() || null,
      health_tips: document.getElementById('beHealthTips').value.trim() || null,
      meta_title: document.getElementById('beMetaTitle').value.trim() || null,
      meta_description: document.getElementById('beMetaDescription').value.trim() || null,
      logo_url:    document.getElementById('beLogoUrl').value || null,
      cover_url:   document.getElementById('beCoverUrl').value || null,
    };

    try {
      if (isEdit) {
        await API.patch(`/businesses/${bizId}`, body);
        toast.success('Business updated!');
      } else {
        const { business } = await API.post('/businesses', body);
        toast.success('Business created! Pending review.');
        setTimeout(() => { window.location.href = '/dashboard'; }, 1500);
      }
    } catch(e) {
      toast.error(e.message || 'Failed to save business');
      setLoading(btn, false);
    }
  };
});
