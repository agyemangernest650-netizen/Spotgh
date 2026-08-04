// assets/js/error.js
document.addEventListener('DOMContentLoaded', () => {
  loadComponents();

  const params  = new URLSearchParams(location.search);
  const code    = params.get('code') || '500';
  const message = params.get('message') || '';

  const errors = {
    '400': { emoji:'🤔', title:'Bad Request',           desc:'The request was invalid or malformed.' },
    '401': { emoji:'🔒', title:'Unauthorised',          desc:'You need to log in to access this page.' },
    '403': { emoji:'🚫', title:'Forbidden',             desc:'You don\'t have permission to view this page.' },
    '404': { emoji:'😕', title:'Not Found',             desc:'The page or resource you requested doesn\'t exist.' },
    '429': { emoji:'⏳', title:'Too Many Requests',     desc:'You\'ve made too many requests. Please wait a moment and try again.' },
    '500': { emoji:'💥', title:'Server Error',          desc:'Something went wrong on our end. We\'re working on it!' },
    '503': { emoji:'🔧', title:'Service Unavailable',   desc:'SpotGH is temporarily down for maintenance. Check back shortly.' },
  };

  const err = errors[code] || errors['500'];

  document.getElementById('pageMain').innerHTML = `
    <div style="min-height:70vh;display:flex;align-items:center;justify-content:center;padding:2rem 1rem">
      <div style="text-align:center;max-width:480px">
        <div style="font-size:4rem;margin-bottom:.5rem">${err.emoji}</div>
        <div style="font-size:4rem;font-weight:800;color:var(--clr-primary);margin-bottom:1rem;line-height:1">${code}</div>
        <h1 style="font-size:1.75rem;font-weight:800;margin-bottom:.75rem">${err.title}</h1>
        <p style="color:var(--clr-text-2);margin-bottom:.5rem">${message || err.desc}</p>

        ${code === '503' ? `
        <div class="card" style="padding:1rem 1.25rem;margin:1.5rem 0;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.25)">
          <p style="font-size:.875rem;color:var(--clr-warning);margin:0">🔧 We expect to be back shortly. Thank you for your patience.</p>
        </div>` : ''}

        ${code === '401' ? `
        <div style="display:flex;gap:.75rem;justify-content:center;flex-wrap:wrap;margin-top:1.5rem">
          <a href="/login" class="btn btn--primary">Log In</a>
          <a href="/register" class="btn btn--outline">Register Free</a>
        </div>` : `
        <div style="display:flex;gap:.75rem;justify-content:center;flex-wrap:wrap;margin-top:1.5rem">
          <a href="/" class="btn btn--primary"><i class="fa-solid fa-house" style="margin-right:.4rem"></i>Go Home</a>
          <button class="btn btn--ghost" onclick="history.back()">← Go Back</button>
          ${code.startsWith('5') ? `<button class="btn btn--outline" onclick="location.reload()"><i class="fa-solid fa-rotate-right" style="margin-right:.4rem"></i>Retry</button>` : ''}
        </div>`}

        <p style="font-size:.75rem;color:var(--clr-text-3);margin-top:2rem">
          Error ${code} · <a href="mailto:support@spotgh.com" style="color:var(--clr-primary)">Contact Support</a>
        </p>
      </div>
    </div>`;
});
