/* Ana sayfa — makale listesi, filtreler, live search, trending */
let currentPage     = 1;
let currentCategory = '';
let currentSearch   = '';
let searchTimer     = null;

document.addEventListener('DOMContentLoaded', async () => {
  await Promise.all([loadCategories(), loadStats(), loadTrending()]);
  await loadArticles();

  // Arama formu
  document.getElementById('searchForm').addEventListener('submit', e => {
    e.preventDefault();
    hideSearchDropdown();
    currentSearch   = document.getElementById('searchInput').value.trim();
    currentPage     = 1;
    currentCategory = '';
    document.querySelectorAll('.cat-pill').forEach(p => p.classList.toggle('active', p.dataset.slug === ''));
    loadArticles();
  });

  // Live search
  document.getElementById('searchInput').addEventListener('input', e => {
    clearTimeout(searchTimer);
    const q = e.target.value.trim();
    if (q.length < 2) { hideSearchDropdown(); return; }
    searchTimer = setTimeout(() => liveSearch(q), 320);
  });

  document.getElementById('searchInput').addEventListener('blur', () => {
    setTimeout(hideSearchDropdown, 200);
  });

  // Responsive sidebar
  if (window.innerWidth < 900) {
    document.getElementById('mainGrid').style.gridTemplateColumns = '1fr';
    document.getElementById('homeSidebar').style.order = '-1';
  }
});

async function loadStats() {
  const s = await GET('/articles/stats').catch(() => null);
  if (!s) return;
  document.getElementById('sbArticles').textContent = fmtNum(s.totalArticles);
  document.getElementById('sbUsers').textContent    = fmtNum(s.totalUsers);
  document.getElementById('sbViews').textContent    = fmtNum(s.totalViews);
  document.getElementById('sbComments').textContent = fmtNum(s.totalComments);
}

async function loadTrending() {
  const articles = await GET('/articles/trending').catch(() => []);
  const el = document.getElementById('trendingList');
  if (!articles.length) {
    el.innerHTML = '<div style="padding:16px;text-align:center;color:var(--gray-400);font-size:.875rem">Henüz makale yok.</div>';
    return;
  }
  el.innerHTML = articles.map((a, i) => `
    <a href="/article.html?id=${a.id}" class="trending-item" style="padding:10px 16px">
      <span class="trending-num">${i + 1}</span>
      <div>
        <div class="trending-title">${escHtml(a.title)}</div>
        <div class="trending-meta">${escHtml(a.category || 'Genel')} · ${fmtNum(a.views)} görüntülenme</div>
      </div>
    </a>`).join('');
}

async function liveSearch(q) {
  const data = await GET('/articles?q=' + encodeURIComponent(q) + '&limit=6').catch(() => null);
  if (!data) return;
  const drop = document.getElementById('searchDropdown');
  if (!data.articles.length) {
    drop.style.display = 'block';
    drop.innerHTML = '<div style="padding:16px;text-align:center;color:var(--gray-400);font-size:.875rem">Sonuç bulunamadı.</div>';
    return;
  }
  drop.style.display = 'block';
  drop.innerHTML = data.articles.map(a => `
    <div class="search-result-item" onclick="window.location='/article.html?id=${a.id}'">
      <div>
        <div class="search-result-cat">${escHtml(a.category || 'Genel')}</div>
        <div class="search-result-title">${escHtml(a.title)}</div>
        <div class="search-result-meta">${escHtml(a.author)} · ${fmtDate(a.created_at)}</div>
      </div>
    </div>`).join('') +
    `<div style="padding:10px 16px;text-align:center;border-top:1px solid var(--gray-100)">
       <button onclick="submitSearch('${escHtml(q)}')" class="btn btn-outline btn-sm">Tüm sonuçları gör</button>
     </div>`;
}

function submitSearch(q) {
  hideSearchDropdown();
  document.getElementById('searchInput').value = q;
  currentSearch = q;
  currentPage = 1;
  currentCategory = '';
  document.querySelectorAll('.cat-pill').forEach(p => p.classList.toggle('active', p.dataset.slug === ''));
  loadArticles();
}

function hideSearchDropdown() {
  const el = document.getElementById('searchDropdown');
  if (el) el.style.display = 'none';
}

async function loadCategories() {
  const cats = await GET('/articles/categories').catch(() => []);
  const strip = document.getElementById('categoryStrip');
  cats.forEach(c => {
    const btn = document.createElement('button');
    btn.className  = 'cat-pill';
    btn.dataset.slug = c.slug;
    btn.textContent = c.name;
    btn.addEventListener('click', () => filterByCategory(c.slug, btn));
    strip.appendChild(btn);
  });
}

function filterByCategory(slug, btn) {
  currentCategory = slug;
  currentPage     = 1;
  currentSearch   = '';
  document.getElementById('searchInput').value = '';
  hideSearchDropdown();
  document.querySelectorAll('.cat-pill').forEach(p => p.classList.toggle('active', p.dataset.slug === slug));
  loadArticles();
}

async function loadArticles() {
  const container = document.getElementById('articlesContainer');
  container.innerHTML = '<div class="spinner"></div>';

  const params = new URLSearchParams({ page: currentPage, limit: 12 });
  if (currentCategory) params.set('category', currentCategory);
  if (currentSearch)   params.set('q', currentSearch);

  const data = await GET('/articles?' + params.toString()).catch(err => {
    container.innerHTML = `<div class="alert alert-error">${escHtml(err.message)}</div>`;
    return null;
  });
  if (!data) return;

  if (!data.articles.length) {
    container.innerHTML = `
      <div class="empty-state">
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <h3>Sonuç Bulunamadı</h3>
        <p>${currentSearch ? `"${escHtml(currentSearch)}" için makale bulunamadı.` : 'Bu kategoride henüz makale yok.'}</p>
      </div>`;
    document.getElementById('pagination').innerHTML = '';
    return;
  }

  container.innerHTML = `<div class="articles-grid">${data.articles.map(articleCard).join('')}</div>`;
  renderPagination(data.pages, currentPage);
}

function articleCard(a) {
  const readTime = calcReadingTime(a.summary);
  const cover = a.cover_url
    ? `<img src="${escHtml(a.cover_url)}" class="article-card-cover" alt="" loading="lazy">`
    : `<div class="article-card-cover-placeholder">
         <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1.5" stroke-linecap="round">
           <path d="M9.663 17h4.673M12 3v1m6.364 1.636-.707.707M21 12h-1M4 12H3m3.343-5.657-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
         </svg>
       </div>`;
  return `
    <div class="article-card">
      <a href="/article.html?id=${a.id}">${cover}</a>
      <div class="article-card-body">
        ${a.category ? `<span class="article-card-cat">${escHtml(a.category)}</span>` : ''}
        <h3 class="article-card-title"><a href="/article.html?id=${a.id}">${escHtml(a.title)}</a></h3>
        <p class="article-card-summary">${escHtml(a.summary.slice(0, 130))}${a.summary.length > 130 ? '…' : ''}</p>
        <div class="article-card-meta">
          <span>${escHtml(a.author)}</span>
          <span style="display:flex;align-items:center;gap:10px">
            <span class="reading-time">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              ${readTime} dk
            </span>
            <span>${fmtNum(a.views)} görüntülenme</span>
          </span>
        </div>
      </div>
    </div>`;
}

function renderPagination(pages, current) {
  const el = document.getElementById('pagination');
  if (pages <= 1) { el.innerHTML = ''; return; }

  let html = `<button class="page-btn" ${current <= 1 ? 'disabled' : ''} onclick="goPage(${current - 1})">&#8249;</button>`;
  for (let i = 1; i <= pages; i++) {
    if (pages > 7 && Math.abs(i - current) > 2 && i !== 1 && i !== pages) {
      if (i === current - 3 || i === current + 3) html += `<span style="padding:0 4px;color:var(--gray-300)">…</span>`;
      continue;
    }
    html += `<button class="page-btn ${i === current ? 'active' : ''}" onclick="goPage(${i})">${i}</button>`;
  }
  html += `<button class="page-btn" ${current >= pages ? 'disabled' : ''} onclick="goPage(${current + 1})">&#8250;</button>`;
  el.innerHTML = html;
}

function goPage(p) {
  currentPage = p;
  loadArticles();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
