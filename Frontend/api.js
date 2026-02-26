// ═══════════════════════════════════════════════════════════
//  api.js  —  RentProx Shared Frontend Helper
//  Har HTML page mein include karo:
//    Root pages (login/signup): <script src="api.js"></script>
//    User/ pages:               <script src="../api.js"></script>
//    Admin/ pages:              <script src="../api.js"></script>
// ═══════════════════════════════════════════════════════════

const API_BASE = 'http://localhost:5000/api';

// ── Auth Object ────────────────────────────────────────────
const Auth = {

  save(token, user) {
    localStorage.setItem('rp_token', token);
    localStorage.setItem('rp_user', JSON.stringify(user));
  },

  getToken() {
    return localStorage.getItem('rp_token');
  },

  getUser() {
    try { return JSON.parse(localStorage.getItem('rp_user')); }
    catch { return null; }
  },

  clear() {
    localStorage.removeItem('rp_token');
    localStorage.removeItem('rp_user');
  },

  // Authorization header for fetch calls
  headers() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.getToken()}`
    };
  },

  // ── Page Guard — call on every protected page ──────────
  // Returns user object on success, redirects to login on failure
  async guard(loginPage = '../login_plm.html') {
    const token = this.getToken();
    if (!token) { window.location.href = loginPage; return null; }

    // Local expiry check first (no network needed)
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.exp && Date.now() / 1000 > payload.exp) {
        this.clear();
        window.location.href = loginPage;
        return null;
      }
    } catch {
      this.clear();
      window.location.href = loginPage;
      return null;
    }

    // Verify with server
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: this.headers(),
        credentials: 'include'
      });
      const data = await res.json();
      if (!data.success) {
        this.clear();
        window.location.href = loginPage;
        return null;
      }
      localStorage.setItem('rp_user', JSON.stringify(data.data));
      return data.data;
    } catch {
      // Network down — use cached user (graceful offline fallback)
      return this.getUser();
    }
  },

  // Admin-only guard
  async adminGuard(loginPage = '../Admin/admin_login.html') {
    const user = await this.guard(loginPage);
    if (user && !user.isAdmin) {
      window.location.href = loginPage;
      return null;
    }
    return user;
  },

  // Logout
  async logout(loginPage = '../login_plm.html') {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: this.headers(),
        credentials: 'include'
      });
    } catch { /* ignore */ }
    this.clear();
    window.location.href = loginPage;
  },

  // Fill profile UI (name + email) from stored user
  fillProfile() {
    const user = this.getUser();
    if (!user) return;
    document.querySelectorAll('.js-user-name').forEach(el => el.textContent = user.name);
    document.querySelectorAll('.js-user-email').forEach(el => el.textContent = user.email);
  }
};

// ── API Fetch Wrapper ──────────────────────────────────────
async function apiFetch(endpoint, options = {}) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: { ...Auth.headers(), ...(options.headers || {}) },
    credentials: 'include'
  });
  return res.json();
}

// ── Toast Notifications (replaces alert()) ─────────────────
function showToast(message, type = 'success') {
  let container = document.getElementById('rp-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'rp-toast-container';
    container.style.cssText = `
      position: fixed; top: 20px; right: 20px; z-index: 99999;
      display: flex; flex-direction: column; gap: 10px;
    `;
    document.body.appendChild(container);
  }

  const colors = {
    success: '#28b446',
    error:   '#ef4444',
    warn:    '#f59e0b',
    info:    '#3b82f6'
  };

  const toast = document.createElement('div');
  toast.style.cssText = `
    background: ${colors[type] || colors.success};
    color: #fff; padding: 13px 20px; border-radius: 10px;
    font-size: 0.88rem; font-weight: 600; max-width: 340px;
    box-shadow: 0 6px 20px rgba(0,0,0,0.18);
    animation: rpSlideIn 0.3s ease;
    font-family: 'Plus Jakarta Sans', 'Poppins', sans-serif;
  `;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.35s';
    setTimeout(() => toast.remove(), 380);
  }, 3500);
}

// Inject toast animation once
(function () {
  if (document.getElementById('rp-toast-style')) return;
  const s = document.createElement('style');
  s.id = 'rp-toast-style';
  s.textContent = `@keyframes rpSlideIn {
    from { transform: translateX(110%); opacity: 0; }
    to   { transform: translateX(0);    opacity: 1; }
  }`;
  document.head.appendChild(s);
})();

// Auto-check token expiry on load
(function () {
  const token = Auth.getToken();
  if (!token) return;
  try {
    const p = JSON.parse(atob(token.split('.')[1]));
    if (p.exp && Date.now() / 1000 > p.exp) Auth.clear();
  } catch { /* bad token */ }
})();