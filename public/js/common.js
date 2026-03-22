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

// ── Navigation setup ──────────────────────────────────────────
function setupNav() {
  const navUser    = document.getElementById('navUser');
  const navModLink = document.getElementById('navModLink');
  const navAdminLink = document.getElementById('navAdminLink');

  const user = Auth.getUser();

  if (navModLink   && Auth.isModerator()) navModLink.classList.remove('hidden');
  if (navAdminLink && Auth.isAdmin())     navAdminLink.classList.remove('hidden');

  if (!navUser) return;

  if (!Auth.isLoggedIn()) {
    navUser.innerHTML = `
      <a href="/login.html" class="btn btn-secondary btn-sm">Giriş Yap</a>
      <a href="/register.html" class="btn btn-primary btn-sm">Kayıt Ol</a>
    `;
  } else {
    navUser.innerHTML = `
      <span class="nav-username">${escHtml(user?.username || '')}</span>
      <a href="/profile.html" class="btn btn-secondary btn-sm">Profilim</a>
    `;
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
