/* Ana sayfa — makale listesi ve filtreler */
let currentPage     = 1;
let currentCategory = '';
let currentSearch   = '';

document.addEventListener('DOMContentLoaded', async () => {
  await loadCategories();
  await loadArticles();

  // Arama formu
  document.getElementById('searchForm').addEventListener('submit', e => {
    e.preventDefault();
    currentSearch   = document.getElementById('searchInput').value.trim();
    currentPage     = 1;
    currentCategory = '';
    document.querySelectorAll('.cat-pill').forEach(p => p.classList.toggle('active', p.dataset.slug === ''));
    loadArticles();
  });
});

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
          <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/><path d="M12 8v4l3 3"/>
        </svg>
        <p>Henüz makale bulunamadı.</p>
      </div>`;
    document.getElementById('pagination').innerHTML = '';
    return;
  }

  container.innerHTML = `<div class="articles-grid">${data.articles.map(articleCard).join('')}</div>`;
  renderPagination(data.pages, currentPage);
}

function articleCard(a) {
  const cover = a.cover_url
    ? `<img src="${escHtml(a.cover_url)}" class="article-card-cover" alt="" loading="lazy">`
    : `<div class="article-card-cover-placeholder">
         <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.4)" stroke-width="1.5" stroke-linecap="round">
           <path d="M9.663 17h4.673M12 3v1m6.364 1.636-.707.707M21 12h-1M4 12H3m3.343-5.657-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
         </svg>
       </div>`;
  return `
    <div class="article-card">
      <a href="/article.html?id=${a.id}">${cover}</a>
      <div class="article-card-body">
        ${a.category ? `<span class="article-card-cat">${escHtml(a.category)}</span>` : ''}
        <h3 class="article-card-title"><a href="/article.html?id=${a.id}">${escHtml(a.title)}</a></h3>
        <p class="article-card-summary">${escHtml(a.summary.slice(0, 140))}${a.summary.length > 140 ? '…' : ''}</p>
        <div class="article-card-meta">
          <span>${escHtml(a.author)}</span>
          <span>${fmtDate(a.created_at)}</span>
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
      if (i === current - 3 || i === current + 3) html += `<span style="padding:0 4px;color:var(--gray-400)">…</span>`;
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
