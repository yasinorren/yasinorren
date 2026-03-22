/* Moderasyon Paneli */
let pendingArticleId = null;

document.addEventListener('DOMContentLoaded', async () => {
  if (!Auth.isLoggedIn() || !Auth.isModerator()) {
    window.location.href = '/';
    return;
  }

  await loadStats();
  await loadQueue();

  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');

      if (btn.dataset.tab === 'all')  await loadAllArticles();
      if (btn.dataset.tab === 'log')  await loadLog();
    });
  });

  // Filter button
  document.getElementById('filterBtn').addEventListener('click', loadAllArticles);

  // Reject modal
  document.getElementById('closeRejectModal').addEventListener('click', closeRejectModal);
  document.getElementById('cancelRejectBtn').addEventListener('click', closeRejectModal);
  document.getElementById('confirmRejectBtn').addEventListener('click', doReject);
});

async function loadStats() {
  const s = await GET('/moderation/stats').catch(() => ({}));
  document.getElementById('statPending').textContent  = s.pending  ?? '—';
  document.getElementById('statApproved').textContent = s.approved ?? '—';
  document.getElementById('statRejected').textContent = s.rejected ?? '—';
  document.getElementById('statUsers').textContent    = s.users    ?? '—';
  const badge = document.getElementById('pendingBadge');
  badge.textContent = s.pending || '';
  badge.style.display = s.pending ? '' : 'none';
}

async function loadQueue() {
  const container = document.getElementById('queueContent');
  const data = await GET('/moderation/queue').catch(err => {
    container.innerHTML = `<div class="alert alert-error" style="margin:16px">${escHtml(err.message)}</div>`;
    return null;
  });
  if (!data) return;

  if (!data.articles.length) {
    container.innerHTML = `
      <div class="empty-state" style="padding:48px">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        <p>İnceleme bekleyen makale bulunmuyor.</p>
      </div>`;
    return;
  }

  container.innerHTML = data.articles.map(a => `
    <div class="article-preview-row">
      <div class="preview-title">${escHtml(a.title)}</div>
      <div class="preview-meta">
        Yazar: <strong>${escHtml(a.author)}</strong> &middot;
        Kategori: ${escHtml(a.category || 'Belirtilmemiş')} &middot;
        Tarih: ${fmtDate(a.created_at)}
      </div>
      <p class="preview-summary">${escHtml(a.summary)}</p>
      <div class="action-row">
        <a href="/article.html?id=${a.id}" target="_blank" class="btn btn-secondary btn-sm">Önizle</a>
        <button class="btn btn-success btn-sm" onclick="approveArticle(${a.id})">✓ Onayla</button>
        <button class="btn btn-danger btn-sm"  onclick="openRejectModal(${a.id})">✕ Reddet</button>
      </div>
    </div>`).join('');
}

async function loadAllArticles() {
  const status = document.getElementById('statusFilter').value;
  const params = status ? '?status=' + status : '';
  const data = await GET('/moderation/all' + params).catch(() => ({ articles: [] }));
  const tbody = document.getElementById('allArticlesBody');
  if (!data.articles.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted" style="padding:24px">Sonuç bulunamadı.</td></tr>';
    return;
  }
  tbody.innerHTML = data.articles.map(a => `
    <tr>
      <td>${a.id}</td>
      <td><a href="/article.html?id=${a.id}" target="_blank">${escHtml(a.title)}</a></td>
      <td>${escHtml(a.author)}</td>
      <td>${escHtml(a.category || '—')}</td>
      <td>${statusBadge(a.status)}</td>
      <td>${fmtDateShort(a.created_at)}</td>
      <td>${escHtml(a.reviewer || '—')}</td>
    </tr>`).join('');
}

async function loadLog() {
  const logs = await GET('/moderation/log').catch(() => []);
  const tbody = document.getElementById('logBody');
  if (!logs.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted" style="padding:24px">Kayıt bulunamadı.</td></tr>';
    return;
  }
  tbody.innerHTML = logs.map(l => `
    <tr>
      <td>${fmtDate(l.created_at)}</td>
      <td>${escHtml(l.moderator)}</td>
      <td>${escHtml(l.article_title)}</td>
      <td>${l.action === 'approve' ? '<span class="badge badge-approved">Onay</span>' : '<span class="badge badge-rejected">Red</span>'}</td>
      <td style="max-width:200px;font-size:.82rem">${escHtml(l.note)}</td>
    </tr>`).join('');
}

async function approveArticle(id) {
  if (!confirm('Bu makaleyi onaylamak istiyor musunuz?')) return;
  try {
    await POST('/moderation/' + id + '/approve', {});
    await loadStats();
    await loadQueue();
  } catch (err) { alert(err.message); }
}

function openRejectModal(id) {
  pendingArticleId = id;
  document.getElementById('rejectReason').value = '';
  clearAlert('rejectAlertBox');
  document.getElementById('rejectModal').classList.add('show');
}
function closeRejectModal() {
  document.getElementById('rejectModal').classList.remove('show');
  pendingArticleId = null;
}

async function doReject() {
  const reason = document.getElementById('rejectReason').value.trim();
  if (!reason || reason.length < 5) {
    showAlert('rejectAlertBox', 'error', 'En az 5 karakter gerekçe girin.');
    return;
  }
  try {
    await POST('/moderation/' + pendingArticleId + '/reject', { reason });
    closeRejectModal();
    await loadStats();
    await loadQueue();
  } catch (err) {
    showAlert('rejectAlertBox', 'error', err.message);
  }
}
