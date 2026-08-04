// assets/js/oauth.js
// Shared by login.js and register.js. Uses Supabase's hosted OAuth flow
// directly in the browser (this is the standard way to do Google/Facebook
// login with Supabase), then hands the resulting session to our backend
// at /api/auth/oauth/exchange to get our own app session cookie — see
// backend/controllers/auth.controller.js#oauthExchange.
window.OAuth = (() => {
  let clientPromise = null;

  async function getClient() {
    if (clientPromise) return clientPromise;
    clientPromise = (async () => {
      const cfg = await fetch('/api/config').then(r => r.json());
      if (!window.supabase) {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';
          s.onload = resolve; s.onerror = reject;
          document.head.appendChild(s);
        });
      }
      return window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    })();
    return clientPromise;
  }

  async function signIn(provider) {
    const client = await getClient();
    const next = new URLSearchParams(location.search).get('next') || '/dashboard';
    sessionStorage.setItem('oauth_next', next);
    await client.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${location.origin}/oauth-callback` },
    });
  }

  // Renders the "Continue with Google/Facebook" buttons + divider. Called
  // from login.js / register.js right after the form markup is injected.
  function renderButtons(containerId) {
    document.getElementById(containerId).innerHTML = `
      <div style="display:flex;align-items:center;gap:.75rem;margin:1.25rem 0">
        <div style="flex:1;height:1px;background:var(--clr-border)"></div>
        <span style="font-size:.8rem;color:var(--clr-text-3)">or continue with</span>
        <div style="flex:1;height:1px;background:var(--clr-border)"></div>
      </div>
      <div style="display:flex;gap:.75rem">
        <button type="button" class="btn btn--outline btn--full" id="oauthGoogleBtn" style="display:flex;align-items:center;justify-content:center;gap:.5rem">
          <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.56 2.7-3.87 2.7-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.94v2.33A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.94A9 9 0 0 0 0 9c0 1.45.35 2.83.94 4.03l3.01-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .94 4.97l3.01 2.33C4.66 5.17 6.65 3.58 9 3.58z"/></svg>
          Google
        </button>
        <button type="button" class="btn btn--outline btn--full" id="oauthFacebookBtn" style="display:flex;align-items:center;justify-content:center;gap:.5rem">
          <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#1877F2" d="M18 9a9 9 0 1 0-10.4 8.9v-6.3H5.3V9h2.3V7.02c0-2.27 1.35-3.52 3.42-3.52.99 0 2.02.18 2.02.18v2.22h-1.14c-1.12 0-1.47.7-1.47 1.42V9h2.5l-.4 2.6h-2.1v6.3A9 9 0 0 0 18 9z"/></svg>
          Facebook
        </button>
      </div>`;
    document.getElementById('oauthGoogleBtn').addEventListener('click', () => signIn('google'));
    document.getElementById('oauthFacebookBtn').addEventListener('click', () => signIn('facebook'));
  }

  return { signIn, renderButtons };
})();
