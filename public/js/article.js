/* Makale detay sayfası */
let currentArticleId = null;

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id || isNaN(id)) {
    document.getElementById('articleContainer').innerHTML = '<div class="alert alert-error">Geçersiz makale bağlantısı.</div>';
    return;
  }
  currentArticleId = id;
  loadArticle(id);

  // Reject modal
  document.getElementById('closeRejectModal')?.addEventListener('click', closeModal);
  document.getElementById('cancelRejectBtn')?.addEventListener('click', closeModal);
});

async function loadArticle(id) {
  const container = document.getElementById('articleContainer');

  try {
    const data = await GET('/articles/' + id);
    document.title = escHtml(data.title) + ' — Bilim Platformu';
    container.innerHTML = renderArticle(data);
    setupCommentForm(id);

    // Moderatör aksiyonları
    if (Auth.isModerator()) {
      document.getElementById('modActions')?.classList.remove('hidden');
      document.getElementById('approveBtn')?.addEventListener('click', () => approveArticle(id));
      document.getElementById('rejectBtn')?.addEventListener('click',  () => showRejectModal(id));
      document.getElementById('confirmRejectBtn')?.addEventListener('click', confirmReject);
    }
  } catch (err) {
    container.innerHTML = `<div class="alert alert-error">${escHtml(err.message)}</div>`;
  }
}

function renderArticle(a) {
  const refsHtml = a.references && a.references.length
    ? `<section class="references-section">
        <h2>Kaynakça</h2>
        <ol class="ref-list">
          ${a.references.map(r => {
            let ref = `${escHtml(r.authors)} (${r.year || 'ty'}). <em>${escHtml(r.title)}</em>.`;
            if (r.journal) ref += ` ${escHtml(r.journal)}.`;
            if (r.doi)     ref += ` <a href="https://doi.org/${escHtml(r.doi)}" target="_blank" rel="noopener">https://doi.org/${escHtml(r.doi)}</a>`;
            else if (r.url) ref += ` <a href="${escHtml(r.url)}" target="_blank" rel="noopener noreferrer">${escHtml(r.url)}</a>`;
            return `<li>${ref}</li>`;
          }).join('')}
        </ol>
      </section>`
    : '';

  const commentsHtml = renderComments(a.comments);

  const modActionsHtml = Auth.isModerator() ? `
    <div id="modActions" class="hidden" style="margin-bottom:20px">
      <div class="card" style="border-left:4px solid var(--orange)">
        <div class="card-body" style="padding:16px;display:flex;gap:10px;align-items:center">
          <span style="font-weight:600;color:var(--orange);font-size:.9rem">Moderatör İşlemleri:</span>
          <button class="btn btn-success btn-sm" id="approveBtn">✓ Onayla</button>
          <button class="btn btn-danger btn-sm"  id="rejectBtn">✕ Reddet</button>
        </div>
      </div>
    </div>` : '';

  return `
    <div class="article-detail-layout">
      <article>
        ${modActionsHtml}
        <div class="article-header">
          ${a.category ? `<span class="article-category-badge">${escHtml(a.category)}</span>` : ''}
          <h1 class="article-title">${escHtml(a.title)}</h1>
          <div class="article-meta">
            <span>Yazar: <strong>${escHtml(a.author)}</strong></span>
            <span>Tarih: ${fmtDate(a.created_at)}</span>
            <span>Görüntülenme: ${a.views}</span>
            ${a.references?.length ? `<span>Kaynak: ${a.references.length} adet</span>` : ''}
          </div>
        </div>

        <div class="article-body">${a.content}</div>

        ${refsHtml}

        <!-- Yorum Bölümü -->
        <section class="comments-section">
          <h2 style="font-size:1.2rem;margin-bottom:16px">Yorumlar (${a.comments?.length || 0})</h2>
          ${commentsHtml}
          ${Auth.isLoggedIn() ? `
            <div style="margin-top:20px">
              <div id="commentAlert"></div>
              <div class="form-group">
                <label class="form-label">Yorum Yaz</label>
                <textarea class="form-control" id="commentText" rows="3" maxlength="1000" placeholder="Makale hakkında görüşünüzü paylaşın..."></textarea>
              </div>
              <button class="btn btn-primary btn-sm" id="commentBtn">Yorumu Gönder</button>
            </div>` : `
            <p class="text-muted text-small mt-2">Yorum yapmak için <a href="/login.html">giriş yapın</a>.</p>`}
        </section>
      </article>

      <!-- Kenar çubuğu -->
      <aside class="article-sidebar">
        <div class="sidebar-widget card">
          <div class="card-header">Hakkında</div>
          <div class="card-body">
            <div class="author-box" style="border:none;background:none;padding:0">
              <div class="author-box-name">${escHtml(a.author)}</div>
              ${a.author_bio ? `<div class="author-box-bio">${escHtml(a.author_bio)}</div>` : ''}
            </div>
          </div>
        </div>

        <div class="sidebar-widget card mt-3">
          <div class="card-header">Paylaş</div>
          <div class="card-body">
            <button class="btn btn-secondary btn-sm share-btn" onclick="copyLink()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              Bağlantıyı Kopyala
            </button>
            <button class="btn btn-secondary btn-sm share-btn mt-1" onclick="printArticle()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              Yazdır
            </button>
          </div>
        </div>
      </aside>
    </div>

    <!-- Red Modal (sayfa içinde) -->
    <div class="modal-overlay" id="rejectModal">
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title">Makaleyi Reddet</span>
          <button class="btn btn-ghost btn-sm" id="closeRejectModal">✕</button>
        </div>
        <div id="rejectAlertBox"></div>
        <div class="form-group">
          <label class="form-label">Red Gerekçesi <span class="req">*</span></label>
          <textarea class="form-control" id="rejectReason" rows="4" placeholder="Yazara iletilecek gerekçe..."></textarea>
        </div>
        <div class="d-flex gap-2">
          <button class="btn btn-secondary" id="cancelRejectBtn">İptal</button>
          <button class="btn btn-danger" id="confirmRejectBtn">Reddet</button>
        </div>
      </div>
    </div>
  `;
}

function renderComments(comments) {
  if (!comments || !comments.length) {
    return '<p class="text-muted text-small">Henüz yorum yapılmamış.</p>';
  }
  return comments.map(c => `
    <div class="comment">
      <div class="comment-avatar">${escHtml(c.username.charAt(0).toUpperCase())}</div>
      <div class="comment-body">
        <div class="comment-header"><strong>${escHtml(c.username)}</strong> · ${fmtDate(c.created_at)}</div>
        <div class="comment-text">${escHtml(c.content)}</div>
      </div>
    </div>`).join('');
}

function setupCommentForm(id) {
  const btn = document.getElementById('commentBtn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const text = document.getElementById('commentText').value.trim();
    if (!text) { showAlert('commentAlert', 'error', 'Yorum boş olamaz.'); return; }
    btn.disabled = true;
    try {
      const c = await POST('/articles/' + id + '/comment', { content: text });
      document.getElementById('commentText').value = '';
      clearAlert('commentAlert');
      // Insert new comment
      const commentsArea = document.querySelector('.comments-section');
      const existing = commentsArea.querySelector('p.text-muted');
      if (existing) existing.remove();
      const div = document.createElement('div');
      div.innerHTML = renderComments([c]);
      commentsArea.querySelector('h2').insertAdjacentHTML('afterend', div.innerHTML);
    } catch (err) {
      showAlert('commentAlert', 'error', err.message);
    } finally {
      btn.disabled = false;
    }
  });
}

async function approveArticle(id) {
  if (!confirm('Bu makaleyi onaylamak istiyor musunuz?')) return;
  try {
    await POST('/moderation/' + id + '/approve', {});
    showAlert('commentAlert', 'success', 'Makale onaylandı.');
    document.getElementById('modActions')?.classList.add('hidden');
  } catch (err) {
    alert(err.message);
  }
}

function showRejectModal(id) {
  document.getElementById('rejectModal')?.classList.add('show');
}
function closeModal() {
  document.getElementById('rejectModal')?.classList.remove('show');
}

async function confirmReject() {
  const reason = document.getElementById('rejectReason')?.value.trim();
  if (!reason || reason.length < 5) {
    showAlert('rejectAlertBox', 'error', 'En az 5 karakter gerekçe girin.');
    return;
  }
  try {
    await POST('/moderation/' + currentArticleId + '/reject', { reason });
    closeModal();
    document.getElementById('modActions')?.classList.add('hidden');
    alert('Makale reddedildi.');
  } catch (err) {
    showAlert('rejectAlertBox', 'error', err.message);
  }
}

function copyLink() {
  navigator.clipboard.writeText(window.location.href).then(() => alert('Bağlantı kopyalandı!'));
}
function printArticle() { window.print(); }
