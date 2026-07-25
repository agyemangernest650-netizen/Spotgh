// assets/js/ga.js
// Loads Google Analytics (gtag.js) on public-facing pages only. Skips
// entirely if GA_TRACKING_ID isn't set in the backend .env (nothing
// happens — no error, no blank tracker), so this is safe to include on
// every page without needing GA configured to test the rest of the site.
(function () {
  // Same list as the Disallow rules in server.js's /robots.txt route —
  // logged-in/private app pages shouldn't be tracked as public traffic.
  const PRIVATE_PATHS = [
    '/pages/dashboard.html', '/pages/admin.html', '/pages/creator.html',
    '/pages/business-edit.html', '/pages/deals-manager.html', '/pages/payment-history.html',
    '/pages/subscriptions.html', '/pages/analytics.html', '/pages/bookings.html', '/pages/orders.html', '/pages/business-orders.html', '/pages/messages.html',
    '/pages/saved.html', '/pages/referrals.html', '/pages/profile.html',
    '/pages/oauth-callback.html', '/pages/health.html',
  ];
  if (PRIVATE_PATHS.includes(location.pathname)) return;
  if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return;

  fetch('/api/config').then(r => r.json()).then(cfg => {
    if (!cfg.gaTrackingId) return; // not configured — silently skip

    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${cfg.gaTrackingId}`;
    document.head.appendChild(s);

    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', cfg.gaTrackingId, { anonymize_ip: true });
  }).catch(() => {}); // never let analytics failures break the page
})();
