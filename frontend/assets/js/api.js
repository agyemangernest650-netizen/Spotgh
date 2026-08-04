// assets/js/api.js  (updated)
const API_BASE = '/api';

// Persistent per-browser session id for guest carts (no account needed to
// add items to a cart). Safe to send on every request — the backend only
// uses it for the cart endpoints, and it identifies nothing personal.
function getGuestSessionId() {
  let id = localStorage.getItem('sgh_guest_session');
  if (!id) {
    id = 'g_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('sgh_guest_session', id);
  }
  return id;
}

window.API = {
  async request(method, path, body, opts = {}) {
    const token = localStorage.getItem('sgh_token');
    const headers = { 'Content-Type': 'application/json', 'X-Session-Id': getGuestSessionId() };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const config = { method, headers, credentials: 'include', ...opts };
    if (body && !(body instanceof FormData)) {
      config.body = JSON.stringify(body);
    } else if (body instanceof FormData) {
      delete config.headers['Content-Type'];
      config.body = body;
    }
    try {
      const res = await fetch(API_BASE + path, config);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Auto-logout on 401 (expired/invalid token)
        if (res.status === 401 && token) {
          Auth.clear();
          // Only redirect if not already on an auth page
          if (!['/login', '/register', '/forgot-password'].some(p => location.pathname.includes(p))) {
            window.location.href = '/login?next=' + encodeURIComponent(location.href);
          }
        }
        const err = new Error(data.error || data.message || 'Request failed');
        err.status  = res.status;
        err.data    = data;
        throw err;
      }
      return data;
    } catch (err) {
      // Network error
      if (!err.status) {
        const networkErr = new Error('Network error. Please check your connection.');
        networkErr.isNetwork = true;
        throw networkErr;
      }
      throw err;
    }
  },

  get:    (path)        => API.request('GET',    path),
  post:   (path, body)  => API.request('POST',   path, body),
  patch:  (path, body)  => API.request('PATCH',  path, body),
  put:    (path, body)  => API.request('PUT',    path, body),
  delete: (path, body)  => API.request('DELETE', path, body),

  upload: async (path, formData) => {
    const token = localStorage.getItem('sgh_token');
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    try {
      const res = await fetch(API_BASE + path, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      return data;
    } catch (err) {
      if (!err.status) throw new Error('Upload failed. Check your connection.');
      throw err;
    }
  },
};
