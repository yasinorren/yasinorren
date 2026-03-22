document.addEventListener('DOMContentLoaded', async () => {
  if (!Auth.isLoggedIn()) { window.location.href = '/login.html'; return; }

  const user = await GET('/auth/me').catch(() => null);
  if (!user) { Auth.clear(); window.location.href = '/login.html'; return; }

  // Profil bilgileri
  document.getElementById('avatarCircle').textContent = user.username.charAt(0).toUpperCase();
  document.getElementById('profileUsername').textContent = user.username;
  document.getElementById('profileEmail').textContent = user.email;
  document.getElementById('profileRoleBadge').innerHTML = roleBadge(user.role);
  document.getElementById('profileJoined').textContent = 'Katılım: ' + fmtDate(user.created_at);
  document.getElementById('bioInput').value = user.bio || '';

  // Bio kaydet
  document.getElementById('saveBioBtn').addEventListener('click', async () => {
    const bio = document.getElementById('bioInput').value.trim();
    try {
      await PUT('/auth/profile', { bio });
      showAlert('alertBio', 'success', 'Biyografi kaydedildi.');
    } catch (err) {
      showAlert('alertBio', 'error', err.message);
    }
  });

  // Çıkış
  document.getElementById('logoutBtn').addEventListener('click', () => {
    if (!confirm('Çıkış yapmak istediğinizden emin misiniz?')) return;
    Auth.clear();
    window.location.href = '/';
  });

  // Makaleler
  loadMyArticles();
});

async function loadMyArticles() {
  const container = document.getElementById('myArticles');
  const articles = await GET('/articles/user/mine').catch(() => []);

  if (!articles.length) {
    container.innerHTML = '<div class="empty-state" style="padding:32px"><p>Henüz makale göndermediniz.</p><a href="/submit.html" class="btn btn-primary btn-sm" style="display:inline-flex;margin-top:10px">İlk Makalemi Gönder</a></div>';
    return;
  }

  const rows = articles.map(a => `
    <div style="padding:16px 20px;border-bottom:1px solid var(--gray-100)">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
        <div>
          <div style="font-weight:600;color:var(--navy);margin-bottom:4px">${escHtml(a.title)}</div>
          <div style="font-size:.8rem;color:var(--gray-500)">${escHtml(a.category || '')} · ${fmtDate(a.created_at)}</div>
          ${a.status === 'rejected' && a.reject_reason ? `<div class="alert alert-error" style="margin-top:8px;padding:8px 12px;font-size:.83rem">Red gerekçesi: ${escHtml(a.reject_reason)}</div>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
          ${statusBadge(a.status)}
          ${a.status === 'approved' ? `<a href="/article.html?id=${a.id}" class="btn btn-secondary btn-sm">Görüntüle</a>` : ''}
        </div>
      </div>
    </div>`).join('');

  container.innerHTML = rows;
}
