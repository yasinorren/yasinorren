/* ============================================================
   common.js — Ortak yardımcı fonksiyonlar ve kimlik doğrulama
   ============================================================ */

// ── Token / Auth ─────────────────────────────────────────────
const Auth = {
  getToken()  { return localStorage.getItem('bp_token'); },
  getUser()   {
    try { return JSON.parse(localStorage.getItem('bp_user') || 'null'); }
    catch { return null; }
  },
  set(token, user) {
    localStorage.setItem('bp_token', token);
    localStorage.setItem('bp_user', JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem('bp_token');
    localStorage.removeItem('bp_user');
  },
  isLoggedIn()    { return !!this.getToken(); },
  isModerator()   { const u = this.getUser(); return u && ['moderator','admin'].includes(u.role); },
  isAdmin()       { const u = this.getUser(); return u && u.role === 'admin'; },
};

// ── API helper ────────────────────────────────────────────────
async function api(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = Auth.getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const res = await fetch('/api' + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Sunucu hatası oluştu.');
  return data;
}

const GET  = (p)       => api('GET',    p);
const POST = (p, b)    => api('POST',   p, b);
const PUT  = (p, b)    => api('PUT',    p, b);
const DEL  = (p)       => api('DELETE', p);

// ── Date formatting ───────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}
function fmtDateShort(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('tr-TR');
}

// ── Alert helpers ─────────────────────────────────────────────
function showAlert(boxId, type, msg) {
  const box = document.getElementById(boxId);
  if (!box) return;
  box.innerHTML = `<div class="alert alert-${type}">${escHtml(msg)}</div>`;
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
function clearAlert(boxId) {
  const box = document.getElementById(boxId);
  if (box) box.innerHTML = '';
}

// ── Toast Notifications ───────────────────────────────────────
function showToast(msg, type = 'success', duration = 3500) {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    document.body.appendChild(container);
  }
  const icons = {
    success: '✓',
    error:   '✕',
    info:    'ℹ',
    warning: '⚠',
  };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span style="font-weight:700;font-size:1rem">${icons[type] || '✓'}</span><span>${escHtml(msg)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 350);
  }, duration);
}

// ── XSS escape ───────────────────────────────────────────────
function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Badge HTML ────────────────────────────────────────────────
function statusBadge(status) {
  const map = { pending:'Beklemede', approved:'Onaylı', rejected:'Reddedildi' };
  return `<span class="badge badge-${status}">${map[status] || status}</span>`;
}
function roleBadge(role) {
  const map = { user:'Kullanıcı', moderator:'Moderatör', admin:'Yönetici' };
  return `<span class="badge badge-${role}">${map[role] || role}</span>`;
}

// ── Reading time ──────────────────────────────────────────────
function calcReadingTime(text) {
  const words = text.replace(/<[^>]+>/g, '').split(/\s+/).filter(Boolean).length;
  const mins  = Math.max(1, Math.round(words / 200));
  return mins;
}

// ── Number format ─────────────────────────────────────────────
function fmtNum(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000)    return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

// ── Dark Mode ─────────────────────────────────────────────────
const DarkMode = {
  init() {
    const saved = localStorage.getItem('bp_theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (saved === 'dark' || (!saved && prefersDark)) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  },
  toggle() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('bp_theme', 'light');
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('bp_theme', 'dark');
    }
    this.updateBtn();
  },
  isDark() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  },
  updateBtn() {
    const btn = document.getElementById('darkToggle');
    if (!btn) return;
    btn.innerHTML = this.isDark()
      ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg> Aydınlık'
      : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg> Karanlık';
  }
};

DarkMode.init();

// ── Navigation setup ──────────────────────────────────────────────
function setupNav() {
  const navUser      = document.getElementById('navUser');
  const navModLink   = document.getElementById('navModLink');
  const navAdminLink = document.getElementById('navAdminLink');

  const user = Auth.getUser();

  if (navModLink   && Auth.isModerator()) navModLink.classList.remove('hidden');
  if (navAdminLink && Auth.isAdmin())     navAdminLink.classList.remove('hidden');

  // Dark mode toggle
  const darkToggleWrap = document.getElementById('darkToggleWrap');
  if (darkToggleWrap) {
    const btn = document.createElement('button');
    btn.className = 'dark-toggle';
    btn.id = 'darkToggle';
    btn.addEventListener('click', () => DarkMode.toggle());
    darkToggleWrap.appendChild(btn);
    DarkMode.updateBtn();
  }

  if (!navUser) return;

  if (!Auth.isLoggedIn()) {
    navUser.innerHTML = `
      <a href="/login.html" class="btn btn-secondary btn-sm">Giriş Yap</a>
      <a href="/register.html" class="btn btn-primary btn-sm">Kayıt Ol</a>
    `;
  } else {
    const roleLabel = { user: 'Kullanıcı', moderator: 'Moderatör', admin: 'Yönetici' };
    navUser.innerHTML = `
      <span class="nav-username">${escHtml(user?.username || '')}</span>
      <span class="badge badge-${escHtml(user?.role || 'user')}" style="font-size:.7rem">${roleLabel[user?.role] || ''}</span>
      <a href="/profile.html" class="btn btn-secondary btn-sm">Profilim</a>
      <button class="btn btn-ghost btn-sm" id="navLogoutBtn" style="color:rgba(255,255,255,.6);border-color:rgba(255,255,255,.15)">Çıkış</button>
    `;
    document.getElementById('navLogoutBtn').addEventListener('click', () => {
      Auth.clear();
      showToast('Çıkış yapıldı.', 'info', 1500);
      setTimeout(() => window.location.href = '/', 1000);
    });
  }

  // Hamburger menu
  const hamburger = document.getElementById('hamburger');
  const navLinks  = document.getElementById('navLinks');
  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
      navLinks.classList.toggle('open');
    });
  }
}

// ── Run on DOM ready ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', setupNav);
