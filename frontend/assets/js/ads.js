// assets/js/ads.js
// Google AdSense loader + placeholder ("house") ads.
//
// While ADSENSE_CLIENT is left as the placeholder value below, every ad
// slot on the site shows YOUR house ad instead: an image or video with a
// close (×) button, so the layout looks finished to visitors while you're
// waiting on Google's approval / traffic requirements.
//
// Once AdSense approves your site:
//   1. Replace ADSENSE_CLIENT below with your real publisher ID (ca-pub-...).
//   2. Nothing else changes — insertAdSlot() will automatically start
//      rendering real Google ads in the same spots.
window.ADSENSE_CLIENT = 'ca-pub-0000000000000000'; // <-- replace with your real client ID

// ── House ad content ────────────────────────────────────────────────────
// Edit this while you wait for AdSense. type: 'image' or 'video'.
window.HOUSE_AD = {
  type: 'image',
  src: '',                                   // put your promo image/video path here (leave blank for a clean text/icon placeholder)
  link: '/pages/pricing.html',               // where clicking the ad goes
  alt: 'List your business on SpotGH — Advertise Here',
};

// ── House ad master switch ───────────────────────────────────────────────
// false = show NOTHING (no popup, no placeholder box) until you set a real
//         ADSENSE_CLIENT above. This is the current setting.
// true  = show the house popup/placeholder while ADSENSE_CLIENT is unset
//         (useful if you later want the site to look "ad-ready" again).
window.SHOW_HOUSE_ADS = false;

// ── Interstitial popup ad settings ──────────────────────────────────────
// Only used when SHOW_HOUSE_ADS is true. "MoBox-style" behavior: nothing
// shows on the page, then after `delaySeconds` an ad pops up on its own
// (video or image), and the close button is locked for `skipAfterSeconds`
// (counts down, like "Skip in 5s") before the user can dismiss it. Shows
// once per browser tab session by default so it doesn't nag every page nav.
window.HOUSE_INTERSTITIAL = {
  enabled: true,
  delaySeconds: 4,
  skipAfterSeconds: 5,
  frequency: 'once_per_session',   // 'once_per_session' | 'every_page'
};

(function loadAdSense() {
  if (window.ADSENSE_CLIENT.includes('0000000000000000')) return; // not configured yet — skip loading
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${window.ADSENSE_CLIENT}`;
  s.crossOrigin = 'anonymous';
  document.head.appendChild(s);
})();

function houseAdMarkup(dismissKey) {
  const ad = window.HOUSE_AD || {};
  const media = ad.type === 'video'
    ? `<video class="ad-slot__media" src="${ad.src || ''}" autoplay muted loop playsinline></video>`
    : ad.src
      ? `<img class="ad-slot__media" src="${ad.src}" alt="${ad.alt || 'Advertisement'}" loading="lazy">`
      : `<div class="ad-slot__placeholder"><i class="fa-solid fa-bullhorn"></i><span>${ad.alt || 'Ad space'}</span></div>`;
  return `
    <button class="ad-slot__close" aria-label="Close ad" type="button">&times;</button>
    <span class="ad-slot__label">Ad</span>
    ${ad.link ? `<a href="${ad.link}" class="ad-slot__link" target="_blank" rel="noopener sponsored">` : ''}
    ${media}
    ${ad.link ? `</a>` : ''}
  `;
}

function attachCloseHandler(el, dismissKey) {
  const btn = el.querySelector('.ad-slot__close');
  if (!btn) return;
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    el.hidden = true;
    localStorage.setItem(dismissKey, '1');
  });
}

// Call this after inserting an <ins class="adsbygoogle"> into the DOM
window.renderAd = function (el) {
  if (window.ADSENSE_CLIENT.includes('0000000000000000')) {
    if (!window.SHOW_HOUSE_ADS) { el.hidden = true; return; } // no real ID yet — show nothing
    const dismissKey = 'house_ad_dismissed_' + (el.id || 'default');
    if (localStorage.getItem(dismissKey)) { el.hidden = true; return; }
    el.classList.add('ad-slot--house');
    el.innerHTML = houseAdMarkup(dismissKey);
    attachCloseHandler(el, dismissKey);
    return;
  }
  try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
};

// Drop this markup wherever you want an ad slot, then call renderAd(el):
// <div class="ad-slot" style="margin:1.5rem 0"><ins class="adsbygoogle" style="display:block" data-ad-client="..." data-ad-slot="..." data-ad-format="auto" data-full-width-responsive="true"></ins></div>
window.insertAdSlot = function (containerId, slotId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (window.ADSENSE_CLIENT.includes('0000000000000000')) {
    if (!window.SHOW_HOUSE_ADS) { container.hidden = true; return; } // no real ID yet — show nothing
    container.className = (container.className + ' ad-slot').trim();
    window.renderAd(container);
    return;
  }
  container.innerHTML = `<div class="ad-slot" style="margin:1.5rem 0"><ins class="adsbygoogle" style="display:block" data-ad-client="${window.ADSENSE_CLIENT}" data-ad-slot="${slotId}" data-ad-format="auto" data-full-width-responsive="true"></ins></div>`;
  window.renderAd(container.querySelector('.ad-slot'));
};

// ── Interstitial popup (house ad version of a real AdSense interstitial) ─
window.showHouseInterstitial = function () {
  if (document.querySelector('.ad-interstitial')) return; // already showing
  const ad = window.HOUSE_AD || {};
  const cfg = window.HOUSE_INTERSTITIAL || {};
  const skipAfter = Math.max(0, cfg.skipAfterSeconds ?? 5);

  const overlay = document.createElement('div');
  overlay.className = 'ad-interstitial';
  const media = ad.type === 'video'
    ? `<video class="ad-interstitial__media" src="${ad.src || ''}" autoplay playsinline ${ad.muted === false ? '' : 'muted'}></video>`
    : ad.src
      ? `<img class="ad-interstitial__media" src="${ad.src}" alt="${ad.alt || 'Advertisement'}">`
      : `<div class="ad-interstitial__placeholder"><i class="fa-solid fa-bullhorn"></i><span>${ad.alt || 'Your ad here'}</span></div>`;

  overlay.innerHTML = `
    <div class="ad-interstitial__box">
      <span class="ad-interstitial__label">Advertisement</span>
      <button class="ad-interstitial__close" type="button" disabled>${skipAfter > 0 ? skipAfter : '&times;'}</button>
      ${ad.link ? `<a href="${ad.link}" class="ad-interstitial__link" target="_blank" rel="noopener sponsored">` : ''}
      ${media}
      ${ad.link ? `</a>` : ''}
    </div>`;
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  const closeBtn = overlay.querySelector('.ad-interstitial__close');
  const closeAd = () => { overlay.remove(); document.body.style.overflow = ''; };
  closeBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); closeAd(); });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) { /* backdrop click does nothing while locked, ignore */ } });

  let remaining = skipAfter;
  if (remaining > 0) {
    const tick = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(tick);
        closeBtn.disabled = false;
        closeBtn.innerHTML = '&times;';
        closeBtn.classList.add('is-ready');
      } else {
        closeBtn.textContent = remaining;
      }
    }, 1000);
  } else {
    closeBtn.disabled = false;
    closeBtn.innerHTML = '&times;';
    closeBtn.classList.add('is-ready');
  }
};

(function initHouseInterstitial() {
  if (!window.SHOW_HOUSE_ADS) return; // house ads turned off — nothing shows until real ADSENSE_CLIENT is set
  const cfg = window.HOUSE_INTERSTITIAL || {};
  if (!cfg.enabled) return;
  if (!window.ADSENSE_CLIENT.includes('0000000000000000')) return; // real AdSense configured — let Google's own ad formats handle this instead
  if (cfg.frequency === 'once_per_session' && sessionStorage.getItem('house_interstitial_shown')) return;

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      window.showHouseInterstitial();
      if (cfg.frequency === 'once_per_session') sessionStorage.setItem('house_interstitial_shown', '1');
    }, (cfg.delaySeconds ?? 4) * 1000);
  });
})();
