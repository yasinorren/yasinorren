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

  const bioInput = document.getElementById('bioInput');
  bioInput.value = user.bio || '';
  document.getElementById('bioCharCount').textContent = bioInput.value.length;
  bioInput.addEventListener('input', () => {
    document.getElementById('bioCharCount').textContent = bioInput.value.length;
  });

  // Bio kaydet
  document.getElementById('saveBioBtn').addEventListener('click', async () => {
    const bio = bioInput.value.trim();
    try {
      await PUT('/auth/profile', { bio });
      showToast('Biyografi kaydedildi.', 'success');
    } catch (err) {
      showAlert('alertBio', 'error', err.message);
    }
  });

  // Çıkış
  document.getElementById('logoutBtn').addEventListener('click', () => {
    Auth.clear();
    showToast('Çıkış yapıldı.', 'info', 1500);
    setTimeout(() => window.location.href = '/', 1000);
  });

  // Sekme sistemi
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
      if (btn.dataset.tab === 'bookmarks') loadMyBookmarks();
    });
  });

  await loadMyArticles();
});

async function loadMyArticles() {
  const container = document.getElementById('myArticles');
  const articles = await GET('/articles/user/mine').catch(() => []);

  // İstatistikler
  const totalViews = articles.reduce((s, a) => s + (a.views || 0), 0);
  const approved   = articles.filter(a => a.status === 'approved').length;
  document.getElementById('statArticles').textContent = articles.length;
  document.getElementById('statApproved').textContent = approved;
  document.getElementById('statViews').textContent    = fmtNum(totalViews);

  if (!articles.length) {
    container.innerHTML = `
      <div class="empty-state" style="padding:48px 20px">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <h3>Henüz Makale Yok</h3>
        <p>İlk bilimsel makalenizi gönderin.</p>
        <a href="/submit.html" class="btn btn-primary btn-sm" style="display:inline-flex;margin-top:12px">Makale Gönder</a>
      </div>`;
    return;
  }

  container.innerHTML = articles.map(a => `
    <div style="padding:16px 20px;border-bottom:1px solid var(--gray-100)">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;color:var(--navy);margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            ${a.status === 'approved' ? `<a href="/article.html?id=${a.id}" style="color:inherit">${escHtml(a.title)}</a>` : escHtml(a.title)}
          </div>
          <div style="font-size:.8rem;color:var(--gray-400);display:flex;gap:12px;flex-wrap:wrap">
            <span>${escHtml(a.category || 'Genel')}</span>
            <span>${fmtDateShort(a.created_at)}</span>
            ${a.views != null ? `<span>${fmtNum(a.views)} görüntülenme</span>` : ''}
          </div>
          ${a.status === 'rejected' && a.reject_reason ? `
            <div class="alert alert-error" style="margin-top:8px;padding:8px 12px;font-size:.82rem">
              <strong>Red gerekçesi:</strong> ${escHtml(a.reject_reason)}
            </div>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
          ${statusBadge(a.status)}
        </div>
      </div>
    </div>`).join('');
}

async function loadMyBookmarks() {
  const container = document.getElementById('myBookmarks');
  if (container.dataset.loaded) return;
  container.dataset.loaded = '1';

  const articles = await GET('/articles/user/bookmarks').catch(() => []);

  if (!articles.length) {
    container.innerHTML = `
      <div class="empty-state" style="padding:48px 20px">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
        <h3>Kaydedilen Makale Yok</h3>
        <p>Beğendiğiniz makaleleri kaydedin.</p>
        <a href="/" class="btn btn-outline btn-sm" style="display:inline-flex;margin-top:12px">Makalelere Göz At</a>
      </div>`;
    return;
  }

  container.innerHTML = articles.map(a => `
    <div style="padding:16px 20px;border-bottom:1px solid var(--gray-100)">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
        <div style="flex:1;min-width:0">
          <a href="/article.html?id=${a.id}" style="font-weight:600;color:var(--navy);display:block;margin-bottom:4px">${escHtml(a.title)}</a>
          <div style="font-size:.8rem;color:var(--gray-400);display:flex;gap:12px;flex-wrap:wrap">
            <span>${escHtml(a.category || 'Genel')}</span>
            <span>${escHtml(a.author)}</span>
            <span>${fmtNum(a.views)} görüntülenme</span>
          </div>
        </div>
        <a href="/article.html?id=${a.id}" class="btn btn-secondary btn-sm" style="flex-shrink:0">Oku</a>
      </div>
    </div>`).join('');
}
