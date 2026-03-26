/* Makale detay sayfası — okuma çubuğu, beğeni, kaydet, paylaş */
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
  setupReadingProgress();

  document.getElementById('closeRejectModal')?.addEventListener('click', closeModal);
  document.getElementById('cancelRejectBtn')?.addEventListener('click', closeModal);
});

function setupReadingProgress() {
  const bar = document.createElement('div');
  bar.className = 'reading-progress';
  bar.id = 'readingProgress';
  document.body.prepend(bar);

  window.addEventListener('scroll', () => {
    const el = document.getElementById('articleMainContent');
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const total = el.offsetHeight - window.innerHeight;
    const scrolled = -rect.top;
    const pct = Math.min(100, Math.max(0, (scrolled / total) * 100));
    bar.style.width = pct + '%';
  });
}

async function loadArticle(id) {
  const container = document.getElementById('articleContainer');
  try {
    const data = await GET('/articles/' + id);
    document.title = data.title + ' — Bilim.tr';
    container.innerHTML = renderArticle(data);
    setupCommentForm(id);
    setupReactions(id, data);

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
  const readTime = calcReadingTime(a.content);

  const refsHtml = a.references?.length
    ? `<section class="references-section">
        <h2>Kaynakça</h2>
        <ol class="ref-list">
          ${a.references.map(r => {
            let ref = `${escHtml(r.authors)} (${r.year || 'ty'}). <em>${escHtml(r.title)}</em>.`;
            if (r.journal) ref += ` ${escHtml(r.journal)}.`;
            if (r.doi) ref += ` <a href="https://doi.org/${escHtml(r.doi)}" target="_blank" rel="noopener">https://doi.org/${escHtml(r.doi)}</a>`;
            else if (r.url) ref += ` <a href="${escHtml(r.url)}" target="_blank" rel="noopener noreferrer">${escHtml(r.url)}</a>`;
            return `<li>${ref}</li>`;
          }).join('')}
        </ol>
      </section>` : '';

  const modActionsHtml = Auth.isModerator() ? `
    <div id="modActions" class="hidden" style="margin-bottom:24px">
      <div class="card" style="border-left:4px solid var(--orange)">
        <div class="card-body" style="padding:16px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <span style="font-weight:700;color:var(--orange);font-size:.875rem">⚡ Moderatör İşlemleri</span>
          <button class="btn btn-success btn-sm" id="approveBtn">✓ Onayla</button>
          <button class="btn btn-danger btn-sm"  id="rejectBtn">✕ Reddet</button>
        </div>
      </div>
    </div>` : '';

  return `
    <div class="article-detail-layout" id="articleMainContent">
      <article>
        ${modActionsHtml}
        <div class="article-header">
          ${a.category ? `<span class="article-category-badge">${escHtml(a.category)}</span>` : ''}
          <h1 class="article-title">${escHtml(a.title)}</h1>
          <div class="article-meta">
            <span>Yazar: <strong>${escHtml(a.author)}</strong></span>
            <span>${fmtDate(a.created_at)}</span>
            <span class="reading-time">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              ${readTime} dakika okuma
            </span>
            <span>
              <svg width="13" height="13" style="display:inline;vertical-align:middle;margin-right:4px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              ${fmtNum(a.views)} görüntülenme
            </span>
            ${a.references?.length ? `<span>${a.references.length} kaynak</span>` : ''}
          </div>
        </div>

        <!-- Beğeni & Kaydetme Barı -->
        <div class="reaction-bar">
          <button class="reaction-btn ${a.userLiked ? 'active-like' : ''}" id="likeBtn">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="${a.userLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            <span id="likeCount">${a.likes_count || 0}</span> Beğeni
          </button>
          <button class="reaction-btn ${a.userBookmarked ? 'active-bookmark' : ''}" id="bookmarkBtn">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="${a.userBookmarked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            ${a.userBookmarked ? 'Kaydedildi' : 'Kaydet'}
          </button>
          <button class="reaction-btn" onclick="shareArticle()">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            Paylaş
          </button>
        </div>

        <div class="article-body">${a.content}</div>

        ${refsHtml}

        <!-- Yorum Bölümü -->
        <section class="comments-section" id="commentsSection">
          <h2 style="font-size:1.2rem;margin-bottom:20px">
            Yorumlar <span style="color:var(--gray-400);font-weight:400;font-family:var(--font-sans)">(${a.comments?.length || 0})</span>
          </h2>
          <div id="commentsList">${renderComments(a.comments)}</div>
          ${Auth.isLoggedIn() ? `
            <div style="margin-top:24px;background:var(--gray-50);border-radius:var(--radius-lg);padding:20px">
              <div id="commentAlert"></div>
              <div class="form-group" style="margin-bottom:12px">
                <label class="form-label">Yorum Yaz</label>
                <textarea class="form-control" id="commentText" rows="3" maxlength="1000" placeholder="Makale hakkında görüşünüzü paylaşın..."></textarea>
                <div style="text-align:right;font-size:.75rem;color:var(--gray-400);margin-top:4px"><span id="commentCharCount">0</span>/1000</div>
              </div>
              <button class="btn btn-primary btn-sm" id="commentBtn">Yorumu Gönder</button>
            </div>` : `
            <div style="padding:24px;background:var(--gray-50);border-radius:var(--radius-lg);text-align:center">
              <p class="text-muted" style="margin-bottom:12px">Yorum yapmak için giriş yapın.</p>
              <a href="/login.html" class="btn btn-primary btn-sm">Giriş Yap</a>
            </div>`}
        </section>
      </article>

      <!-- Kenar çubuğu -->
      <aside class="article-sidebar">
        <div class="sidebar-widget card">
          <div class="card-header">Yazar Hakkında</div>
          <div class="card-body">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
              <div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,var(--navy),#1e40af);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1.1rem;flex-shrink:0">${escHtml(a.author.charAt(0).toUpperCase())}</div>
              <div>
                <div style="font-weight:700;color:var(--navy)">${escHtml(a.author)}</div>
                ${a.author_bio ? `<div style="font-size:.8rem;color:var(--gray-400)">${escHtml(a.author_bio)}</div>` : ''}
              </div>
            </div>
          </div>
        </div>

        <div class="sidebar-widget card mt-3">
          <div class="card-header">Makale Bilgisi</div>
          <div class="card-body" style="font-size:.875rem">
            <div style="display:flex;flex-direction:column;gap:10px">
              <div style="display:flex;justify-content:space-between"><span style="color:var(--gray-400)">Kategori</span><strong>${escHtml(a.category || 'Genel')}</strong></div>
              <div style="display:flex;justify-content:space-between"><span style="color:var(--gray-400)">Okuma süresi</span><strong>${readTime} dk</strong></div>
              <div style="display:flex;justify-content:space-between"><span style="color:var(--gray-400)">Görüntülenme</span><strong>${fmtNum(a.views)}</strong></div>
              <div style="display:flex;justify-content:space-between"><span style="color:var(--gray-400)">Beğeni</span><strong id="sidebarLikeCount">${a.likes_count || 0}</strong></div>
              ${a.references?.length ? `<div style="display:flex;justify-content:space-between"><span style="color:var(--gray-400)">Kaynaklar</span><strong>${a.references.length}</strong></div>` : ''}
            </div>
          </div>
        </div>

        <div class="sidebar-widget card mt-3">
          <div class="card-header">Paylaş</div>
          <div class="card-body" style="display:flex;flex-direction:column;gap:8px">
            <button class="btn btn-secondary btn-sm share-btn" onclick="copyLink()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              Bağlantıyı Kopyala
            </button>
            <button class="btn btn-secondary btn-sm share-btn" onclick="shareTwitter('${escHtml(a.title).replace(/'/g, "\\'")}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              X'te Paylaş
            </button>
            <button class="btn btn-secondary btn-sm share-btn" onclick="printArticle()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              Yazdır
            </button>
          </div>
        </div>
      </aside>
    </div>

    <!-- Moderatör Red Modal -->
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
  if (!comments?.length) return '<p class="text-muted text-small" style="padding:8px 0">Henüz yorum yapılmamış. İlk yorum yapan siz olun!</p>';
  const me = Auth.getUser();
  return comments.map(c => `
    <div class="comment" id="comment-${c.id}">
      <div class="comment-avatar">${escHtml(c.username.charAt(0).toUpperCase())}</div>
      <div class="comment-body" style="flex:1">
        <div class="comment-header"><strong>${escHtml(c.username)}</strong> · ${fmtDate(c.created_at)}</div>
        <div class="comment-text">${escHtml(c.content)}</div>
        ${(me && (me.id === c.user_id || Auth.isModerator())) ? `
          <button class="btn btn-ghost btn-sm" style="margin-top:4px;font-size:.75rem;color:var(--red);padding:3px 8px" onclick="deleteComment(${c.id})">Sil</button>` : ''}
      </div>
    </div>`).join('');
}

function setupReactions(id, data) {
  const likeBtn = document.getElementById('likeBtn');
  const bookmarkBtn = document.getElementById('bookmarkBtn');
  if (!likeBtn || !bookmarkBtn) return;

  likeBtn.addEventListener('click', async () => {
    if (!Auth.isLoggedIn()) { showToast('Beğenmek için giriş yapın.', 'info'); return; }
    const isLiked = likeBtn.classList.contains('active-like');
    try {
      const res = isLiked ? await DEL('/articles/' + id + '/like') : await POST('/articles/' + id + '/like', {});
      likeBtn.classList.toggle('active-like', !isLiked);
      document.getElementById('likeCount').textContent = res.count;
      const sidebarCount = document.getElementById('sidebarLikeCount');
      if (sidebarCount) sidebarCount.textContent = res.count;
      likeBtn.querySelector('svg').setAttribute('fill', !isLiked ? 'currentColor' : 'none');
      showToast(isLiked ? 'Beğeni kaldırıldı.' : 'Makale beğenildi!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  bookmarkBtn.addEventListener('click', async () => {
    if (!Auth.isLoggedIn()) { showToast('Kaydetmek için giriş yapın.', 'info'); return; }
    const isSaved = bookmarkBtn.classList.contains('active-bookmark');
    try {
      isSaved ? await DEL('/articles/' + id + '/bookmark') : await POST('/articles/' + id + '/bookmark', {});
      bookmarkBtn.classList.toggle('active-bookmark', !isSaved);
      bookmarkBtn.querySelector('svg').setAttribute('fill', !isSaved ? 'currentColor' : 'none');
      bookmarkBtn.lastChild.textContent = !isSaved ? ' Kaydedildi' : ' Kaydet';
      showToast(isSaved ? 'Kaydedilenlerden çıkarıldı.' : 'Makale kaydedildi!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

function setupCommentForm(id) {
  const btn = document.getElementById('commentBtn');
  const textarea = document.getElementById('commentText');
  if (!btn || !textarea) return;

  textarea.addEventListener('input', () => {
    const counter = document.getElementById('commentCharCount');
    if (counter) counter.textContent = textarea.value.length;
  });

  btn.addEventListener('click', async () => {
    const text = textarea.value.trim();
    if (!text) { showAlert('commentAlert', 'error', 'Yorum boş olamaz.'); return; }
    btn.disabled = true;
    btn.textContent = 'Gönderiliyor...';
    try {
      const c = await POST('/articles/' + id + '/comment', { content: text });
      textarea.value = '';
      clearAlert('commentAlert');
      const listEl = document.getElementById('commentsList');
      const emptyMsg = listEl.querySelector('p.text-muted');
      if (emptyMsg) emptyMsg.remove();
      listEl.insertAdjacentHTML('beforeend', renderComments([c]));
      const heading = document.querySelector('#commentsSection h2');
      if (heading) {
        const count = listEl.querySelectorAll('.comment').length;
        heading.innerHTML = `Yorumlar <span style="color:var(--gray-400);font-weight:400;font-family:var(--font-sans)">(${count})</span>`;
      }
      showToast('Yorumunuz eklendi!', 'success');
    } catch (err) {
      showAlert('commentAlert', 'error', err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Yorumu Gönder';
    }
  });
}

async function deleteComment(commentId) {
  if (!confirm('Bu yorumu silmek istediğinizden emin misiniz?')) return;
  try {
    await DEL('/articles/comments/' + commentId);
    const el = document.getElementById('comment-' + commentId);
    if (el) el.remove();
    showToast('Yorum silindi.', 'info');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function approveArticle(id) {
  if (!confirm('Bu makaleyi onaylamak istiyor musunuz?')) return;
  try {
    await POST('/moderation/' + id + '/approve', {});
    showToast('Makale onaylandı ve yayınlandı!', 'success');
    document.getElementById('modActions')?.classList.add('hidden');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function showRejectModal() {
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
    showToast('Makale reddedildi.', 'info');
  } catch (err) {
    showAlert('rejectAlertBox', 'error', err.message);
  }
}

function copyLink() {
  navigator.clipboard.writeText(window.location.href).then(() => showToast('Bağlantı kopyalandı!', 'success'));
}

function shareArticle() {
  if (navigator.share) {
    navigator.share({ title: document.title, url: window.location.href });
  } else {
    copyLink();
  }
}

function shareTwitter(title) {
  const url = encodeURIComponent(window.location.href);
  const text = encodeURIComponent(title + ' — Bilim.tr');
  window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
}

function printArticle() { window.print(); }
