// assets/js/auth.js
window.Auth = {
  getToken:  ()  => localStorage.getItem('sgh_token'),
  getUser:   ()  => { try { return JSON.parse(localStorage.getItem('sgh_user') || 'null'); } catch { return null; } },
  isLoggedIn:()  => !!Auth.getToken(),
  save: (token, user) => {
    localStorage.setItem('sgh_token', token);
    localStorage.setItem('sgh_user', JSON.stringify(user));
  },
  clear: () => {
    localStorage.removeItem('sgh_token');
    localStorage.removeItem('sgh_user');
  },
  requireAuth: (next = window.location.href) => {
    if (!Auth.isLoggedIn()) {
      window.location.href = '/login?next=' + encodeURIComponent(next);
      return false;
    }
    return true;
  },
  requireRole: (roles) => {
    const user = Auth.getUser();
    if (!user || !roles.includes(user.role)) {
      window.location.href = '/login';
      return false;
    }
    return true;
  },
  logout: async () => {
    await API.post('/auth/logout').catch(() => {});
    Auth.clear();
    window.location.href = '/';
  }
};
