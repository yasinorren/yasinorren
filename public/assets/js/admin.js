/* ================================================================
   INNOMED LIFE SCIENCES — ADMIN PANEL JS
   ================================================================ */

let authToken  = localStorage.getItem('innomed_token') || '';
let allProducts = [];

const api = async (url, opts = {}) => {
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: 'Bearer ' + authToken } : {}) },
      ...opts,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    if (res.status === 401) { logout(); return null; }
    return await res.json();
  } catch (e) {
    console.error('API error:', url, e.message);
    return null;
  }
};

/* ── Toast ── */
let toastTimer;
function toast(msg, type = 'ok') {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; document.body.appendChild(el); }
  el.textContent = msg;
  el.className = `toast toast-${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

/* ── Auth ── */
function logout() {
  authToken = '';
  localStorage.removeItem('innomed_token');
  document.getElementById('adminApp').classList.add('hidden');
  document.getElementById('loginPage').classList.remove('hidden');
}

if (authToken) {
  document.getElementById('loginPage').classList.add('hidden');
  document.getElementById('adminApp').classList.remove('hidden');
  initApp();
}

document.getElementById('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = e.target.querySelector('button');
  btn.textContent = 'Giriş yapılıyor...';
  btn.disabled = true;
  const data = await api('/api/auth/login', {
    method: 'POST',
    body: { username: document.getElementById('loginUser').value, password: document.getElementById('loginPass').value }
  }).catch(() => null);

  btn.textContent = 'Sign In';
  btn.disabled = false;

  if (!data || data.error) {
    const err = document.getElementById('loginErr');
    err.textContent = data?.error || 'Bağlantı hatası';
    err.classList.remove('hidden');
    return;
  }
  authToken = data.token;
  localStorage.setItem('innomed_token', authToken);
  document.getElementById('sbUsername').textContent = data.username;
  document.getElementById('loginPage').classList.add('hidden');
  document.getElementById('adminApp').classList.remove('hidden');
  initApp();
});

document.getElementById('logoutBtn').addEventListener('click', logout);

/* ── Mobile Sidebar ── */
function openSidebar()  { document.getElementById('sidebar').classList.add('open'); document.getElementById('sidebarOverlay').classList.add('open'); }
function closeSidebar() { document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebarOverlay').classList.remove('open'); }
document.getElementById('mobileMenuBtn').addEventListener('click', openSidebar);
document.getElementById('sidebarClose').addEventListener('click', closeSidebar);
document.getElementById('sidebarOverlay').addEventListener('click', closeSidebar);

/* ── Navigation ── */
let currentPage = 'dashboard';
let appInitialized = false;

function initApp() {
  if (!appInitialized) {
    document.querySelectorAll('.sb-item').forEach(btn => {
      btn.addEventListener('click', () => navigateTo(btn.dataset.page));
    });
    appInitialized = true;
  }
  navigateTo('dashboard');
  loadInquiryBadge();
}

function navigateTo(page) {
  currentPage = page;
  closeSidebar();
  document.querySelectorAll('.sb-item').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  const titles = {
    dashboard: 'Dashboard', products: 'Products', inquiries: 'Customer Inquiries',
    sales: 'Sales', settings: 'Settings', categories: 'Categories & Menus',
    sterility: 'Sterility Codes', media: 'Media Library', content: 'Site Content'
  };
  const title = titles[page] || page;
  document.getElementById('pageTitle').textContent = title;
  document.getElementById('breadcrumbCurrent').textContent = title;
  document.getElementById('pageActions').innerHTML = '';
  ({
    dashboard: renderDashboard, products: renderProducts, inquiries: renderInquiries,
    sales: renderSales, settings: renderSettings, categories: renderCategories,
    sterility: renderSterility, media: renderMedia, content: renderContent
  }[page] || (() => {}))();
}

/* ── DASHBOARD ── */
async function renderDashboard() {
  document.getElementById('contentBody').innerHTML = '<div style="color:var(--muted);text-align:center;padding:48px">Yükleniyor...</div>';
  const [products, inquiryStats, salesSummary] = await Promise.all([
    api('/api/products'),
    api('/api/inquiries/stats'),
    api('/api/sales/summary')
  ]);
  if (!products) {
    document.getElementById('contentBody').innerHTML =
      '<div style="padding:48px;text-align:center;color:#c00">Veriler yüklenemedi. Sunucu çalışıyor mu kontrol edin, ardından sayfayı yenileyin.</div>';
    return;
  }

  const inStock  = products.filter(p => p.stock_status === 'available').length;
  const thisMonthRev = salesSummary?.thisMonth?.r || 0;
  const thisMonthOrd = salesSummary?.thisMonth?.c || 0;
  const monthly      = salesSummary?.monthly || [];
  const topProducts  = salesSummary?.topProducts || [];

  document.getElementById('contentBody').innerHTML = `
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-card-top"><div><div class="stat-num">${products.length}</div><div class="stat-lbl">Toplam Ürün</div></div><div class="stat-icon" style="background:#EAF4FB"><svg width="22" height="22" viewBox="0 0 22 22"><rect x="3" y="3" width="7" height="7" rx="1" stroke="#0A5C8A" stroke-width="1.5" fill="none"/><rect x="12" y="3" width="7" height="7" rx="1" stroke="#0A5C8A" stroke-width="1.5" fill="none"/><rect x="3" y="12" width="7" height="7" rx="1" stroke="#0A5C8A" stroke-width="1.5" fill="none"/><rect x="12" y="12" width="7" height="7" rx="1" stroke="#0A5C8A" stroke-width="1.5" fill="none"/></svg></div></div>
        <div class="stat-trend trend-neutral">${inStock} ürün stokta</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-top"><div><div class="stat-num">${inquiryStats?.new || 0}</div><div class="stat-lbl">Yeni Sorgu</div></div><div class="stat-icon" style="background:#FFF3E0"><svg width="22" height="22" viewBox="0 0 22 22"><path d="M2 4H20C20.6 4 21 4.4 21 5V15C21 15.6 20.6 16 20 16H5L1 20V5C1 4.4 1.4 4 2 4Z" stroke="#F57C00" stroke-width="1.5" fill="none"/></svg></div></div>
        <div class="stat-trend trend-up">Bugün ${inquiryStats?.today || 0} yeni</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-top"><div><div class="stat-num">${thisMonthOrd}</div><div class="stat-lbl">Bu Ay Sipariş</div></div><div class="stat-icon" style="background:#E8F8F5"><svg width="22" height="22" viewBox="0 0 22 22"><path d="M3 17L7 11L11 13L17 5" stroke="#00897B" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg></div></div>
        <div class="stat-trend trend-up">Toplam ${salesSummary?.total?.c || 0} sipariş</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-top"><div><div class="stat-num">$${(thisMonthRev||0).toLocaleString('tr-TR',{minimumFractionDigits:0,maximumFractionDigits:0})}</div><div class="stat-lbl">Bu Ay Ciro</div></div><div class="stat-icon" style="background:#F3E5F5"><svg width="22" height="22" viewBox="0 0 22 22"><circle cx="11" cy="11" r="9" stroke="#7B1FA2" stroke-width="1.5" fill="none"/><path d="M11 7V11L14 13" stroke="#7B1FA2" stroke-width="1.5" stroke-linecap="round"/></svg></div></div>
        <div class="stat-trend trend-neutral">Toplam $${((salesSummary?.total?.r)||0).toLocaleString('tr-TR',{minimumFractionDigits:0,maximumFractionDigits:0})}</div>
      </div>
    </div>
    <div class="chart-row">
      <div class="section-card">
        <div class="sc-head"><h3>En Çok Satan Ürünler</h3></div>
        <div class="top-products-list">
          ${topProducts.length ? topProducts.slice(0,8).map((p,i)=>`
            <div class="tp-item">
              <div class="tp-rank ${i===0?'gold':''}">${i+1}</div>
              <div class="tp-name">${p.product_name}</div>
              <div class="tp-qty">${p.total_qty} adet</div>
            </div>`).join('') : '<div class="empty-state"><p>Henüz satış kaydı yok.</p></div>'}
        </div>
      </div>
      <div class="section-card">
        <div class="sc-head"><h3>Aylık Satış Trendi</h3></div>
        <div class="chart-bar-row">
          ${monthly.length ? (() => {
            const maxRev = Math.max(...monthly.map(m => m.revenue||0), 1);
            return monthly.slice(0,6).reverse().map(m => `
              <div class="cb-item">
                <div class="cb-label"><span>${m.month}</span><span>$${(m.revenue||0).toLocaleString('tr-TR',{minimumFractionDigits:0,maximumFractionDigits:0})} (${m.orders} sipariş)</span></div>
                <div class="cb-track"><div class="cb-fill" style="width:${Math.round(((m.revenue||0)/maxRev)*100)}%"></div></div>
              </div>`).join('');
          })() : '<p style="color:var(--muted);font-size:.86rem">Henüz satış verisi yok.</p>'}
        </div>
      </div>
    </div>
    <div class="section-card">
      <div class="sc-head"><h3>Son Sorgular</h3><button class="btn-sm btn-view" onclick="navigateTo('inquiries')">Tümünü Gör</button></div>
      <div class="table-wrap" id="recentInqTable"></div>
    </div>`;

  const inqs = await api('/api/inquiries?status=new');
  const tbody = (inqs || []).slice(0, 5).map(i => `
    <tr>
      <td><strong>${escHtml(i.customer_name)}</strong></td>
      <td>${escHtml(i.product_name || '—')}</td>
      <td>${escHtml(i.company || '—')}</td>
      <td><span class="badge badge-${escHtml(i.status)}">${statusTr(i.status)}</span></td>
      <td>${new Date(i.created_at).toLocaleDateString('tr-TR')}</td>
      <td><button class="btn-sm btn-view" onclick="openInqModal(${i.id})">Görüntüle</button></td>
    </tr>`).join('');

  document.getElementById('recentInqTable').innerHTML = `
    <table class="data-table recent-table">
      <thead><tr><th>Müşteri</th><th>Ürün</th><th>Şirket</th><th>Durum</th><th>Tarih</th><th>İşlem</th></tr></thead>
      <tbody>${tbody || '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:24px">Yeni sorgu yok</td></tr>'}</tbody>
    </table>`;
}

/* ── PRODUCTS ── */
async function renderProducts() {
  const actions = document.getElementById('pageActions');
  actions.innerHTML = `<button class="btn-add" id="addProductBtn"><svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 2V14M2 8H14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> Ürün Ekle</button>`;
  document.getElementById('addProductBtn').addEventListener('click', () => openProductModal());

  document.getElementById('contentBody').innerHTML = `
    <div class="section-card">
      <div class="sc-toolbar">
        <div class="sc-search"><svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="6" cy="6" r="5" stroke="#5A7184" stroke-width="1.3"/><path d="M10 10L13 13" stroke="#5A7184" stroke-width="1.3" stroke-linecap="round"/></svg><input type="text" id="prodSearch" placeholder="Ürün, katalog no..."/></div>
        <div class="sc-filter"><select id="prodCatFilter"><option value="">Tüm Kategoriler</option><option value="clinical">Klinik Mikrobiyoloji</option><option value="industrial">Endüstriyel Mikrobiyoloji</option><option value="environment">Çevre Kontrolü</option><option value="helicomed">HelicoMed</option></select></div>
      </div>
      <div class="table-wrap"><table class="data-table" id="prodTable">
        <thead><tr><th>Katalog No</th><th>Ürün Adı (TR)</th><th>Kategori</th><th>Format</th><th>Stok</th><th>Durum</th><th>İşlemler</th></tr></thead>
        <tbody id="prodTbody"><tr><td colspan="7" style="text-align:center;padding:32px;color:var(--muted)">Yükleniyor...</td></tr></tbody>
      </table></div>
    </div>`;

  allProducts = await api('/api/products') || [];
  renderProductTable(allProducts);

  document.getElementById('prodSearch').addEventListener('input', filterProds);
  document.getElementById('prodCatFilter').addEventListener('change', filterProds);
}

function filterProds() {
  const q   = document.getElementById('prodSearch').value.toLowerCase();
  const cat = document.getElementById('prodCatFilter').value;
  renderProductTable(allProducts.filter(p =>
    (!q   || (p.name_tr||'').toLowerCase().includes(q) || (p.name_en||'').toLowerCase().includes(q) || (p.catalog_no||'').toLowerCase().includes(q)) &&
    (!cat || p.category === cat)
  ));
}

const catLabel = { clinical:'Klinik', industrial:'Endüstriyel', environment:'Çevre Kontrolü', helicomed:'HelicoMed' };
const statusTr  = s => ({ new:'Yeni', read:'Okundu', responded:'Yanıtlandı', closed:'Kapatıldı' }[s] || s);
const stockTr   = s => ({ available:'Stokta', limited:'Sınırlı', out_of_stock:'Stok Dışı' }[s] || s);

function renderProductTable(products) {
  const tbody = document.getElementById('prodTbody');
  if (!products.length) { tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><p>Ürün bulunamadı.</p></div></td></tr>'; return; }
  tbody.innerHTML = products.map(p => `
    <tr>
      <td><code style="font-size:.78rem;color:var(--muted)">${escHtml(p.catalog_no||'—')}</code></td>
      <td><strong>${escHtml(p.name_tr)}</strong>${p.is_featured?'&nbsp;<span class="badge badge-featured">Öne Çıkan</span>':''}</td>
      <td>${escHtml(catLabel[p.category]||p.category)}</td>
      <td>${escHtml(p.format||'—')}</td>
      <td>${parseInt(p.stock_qty)||0}</td>
      <td><span class="badge badge-${escHtml(p.stock_status)}">${stockTr(p.stock_status)}</span></td>
      <td style="display:flex;gap:6px">
        <button class="btn-sm btn-edit" onclick="openProductModal(${p.id})">Düzenle</button>
        <button class="btn-sm btn-del" onclick="deleteProduct(${p.id})">Sil</button>
      </td>
    </tr>`).join('');
}

/* Product Modal */
function openProductModal(id = null) {
  const modal = document.getElementById('productModal');
  const form  = document.getElementById('productForm');
  form.reset();
  document.getElementById('pmId').value = '';
  document.getElementById('pmTitle').textContent = id ? 'Ürün Düzenle' : 'Yeni Ürün Ekle';

  if (id) {
    const p = allProducts.find(x => x.id === id);
    if (!p) return;
    document.getElementById('pmId').value      = p.id;
    document.getElementById('pmCatalog').value = p.catalog_no || '';
    document.getElementById('pmCat').value     = p.category;
    document.getElementById('pmNameTr').value  = p.name_tr;
    document.getElementById('pmNameEn').value  = p.name_en;
    document.getElementById('pmSubcat').value  = p.subcategory || '';
    document.getElementById('pmDescTr').value  = p.description_tr || '';
    document.getElementById('pmDescEn').value  = p.description_en || '';
    document.getElementById('pmFormat').value  = p.format || '';
    document.getElementById('pmUnit').value    = p.unit || 'adet';
    document.getElementById('pmPrice').value   = p.price || '';
    document.getElementById('pmCurrency').value= p.currency || 'USD';
    document.getElementById('pmStockStatus').value = p.stock_status || 'available';
    document.getElementById('pmStockQty').value    = p.stock_qty || 0;
    document.getElementById('pmFeatured').checked  = !!p.is_featured;
    document.getElementById('pmImageUrl').value    = p.image_url || '';
  }
  modal.classList.remove('hidden');
}

document.getElementById('pmClose').addEventListener('click', () => document.getElementById('productModal').classList.add('hidden'));
document.getElementById('pmCancelBtn').addEventListener('click', () => document.getElementById('productModal').classList.add('hidden'));

document.getElementById('productForm').addEventListener('submit', async e => {
  e.preventDefault();
  const id = document.getElementById('pmId').value;
  const body = {
    catalog_no:   document.getElementById('pmCatalog').value,
    category:     document.getElementById('pmCat').value,
    name_tr:      document.getElementById('pmNameTr').value,
    name_en:      document.getElementById('pmNameEn').value,
    subcategory:  document.getElementById('pmSubcat').value,
    description_tr: document.getElementById('pmDescTr').value,
    description_en: document.getElementById('pmDescEn').value,
    format:       document.getElementById('pmFormat').value,
    unit:         document.getElementById('pmUnit').value,
    price:        document.getElementById('pmPrice').value,
    currency:     document.getElementById('pmCurrency').value,
    stock_status: document.getElementById('pmStockStatus').value,
    stock_qty:    document.getElementById('pmStockQty').value,
    is_featured:  document.getElementById('pmFeatured').checked,
    image_url:    document.getElementById('pmImageUrl').value,
    is_active:    1
  };
  const btn = e.target.querySelector('[type=submit]');
  btn.disabled = true; btn.textContent = 'Kaydediliyor...';
  const res = await api(id ? `/api/products/${id}` : '/api/products', { method: id ? 'PUT' : 'POST', body });
  btn.disabled = false; btn.textContent = 'Kaydet';
  if (res && !res.error) {
    document.getElementById('productModal').classList.add('hidden');
    toast(id ? 'Ürün güncellendi' : 'Ürün eklendi');
    renderProducts();
  } else toast(res?.error || 'Hata oluştu', 'err');
});

async function deleteProduct(id) {
  const product = allProducts.find(p => p.id === id);
  const name = product ? product.name_tr : 'bu ürünü';
  if (!confirm(`"${name}" ürününü silmek istediğinizden emin misiniz?`)) return;
  const res = await api(`/api/products/${id}`, { method: 'DELETE' });
  if (res && !res.error) { toast('Ürün silindi'); renderProducts(); }
  else toast(res?.error || 'Hata', 'err');
}

/* ── INQUIRIES ── */
async function renderInquiries() {
  document.getElementById('contentBody').innerHTML = `
    <div class="section-card">
      <div class="sc-toolbar">
        <div class="sc-search"><svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="6" cy="6" r="5" stroke="#5A7184" stroke-width="1.3"/><path d="M10 10L13 13" stroke="#5A7184" stroke-width="1.3" stroke-linecap="round"/></svg><input type="text" id="inqSearch" placeholder="Müşteri, ürün ara..."/></div>
        <div class="sc-filter"><select id="inqStatusFilter"><option value="">Tüm Durumlar</option><option value="new">Yeni</option><option value="read">Okundu</option><option value="responded">Yanıtlandı</option><option value="closed">Kapatıldı</option></select></div>
      </div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>#</th><th>Müşteri</th><th>Şirket</th><th>Ürün</th><th>Konu</th><th>Durum</th><th>Tarih</th><th>İşlem</th></tr></thead>
        <tbody id="inqTbody"><tr><td colspan="8" style="text-align:center;padding:32px;color:var(--muted)">Yükleniyor...</td></tr></tbody>
      </table></div>
    </div>`;

  let inqs = await api('/api/inquiries') || [];
  renderInqTable(inqs);

  document.getElementById('inqSearch').addEventListener('input', () => {
    const q   = document.getElementById('inqSearch').value.toLowerCase();
    const st  = document.getElementById('inqStatusFilter').value;
    renderInqTable(inqs.filter(i =>
      (!q  || i.customer_name.toLowerCase().includes(q) || (i.product_name||'').toLowerCase().includes(q) || (i.company||'').toLowerCase().includes(q)) &&
      (!st || i.status === st)
    ));
  });
  document.getElementById('inqStatusFilter').addEventListener('change', () => document.getElementById('inqSearch').dispatchEvent(new Event('input')));
}

function renderInqTable(inqs) {
  const tbody = document.getElementById('inqTbody');
  if (!inqs.length) { tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state"><p>Sorgu bulunamadı.</p></div></td></tr>'; return; }
  tbody.innerHTML = inqs.map(i => `
    <tr>
      <td style="color:var(--muted);font-size:.78rem">#${i.id}</td>
      <td><strong>${escHtml(i.customer_name)}</strong><br/><small style="color:var(--muted)">${escHtml(i.customer_email||'')}</small></td>
      <td>${escHtml(i.company||'—')}</td>
      <td>${escHtml(i.product_name||'—')}</td>
      <td>${escHtml(i.subject||'—')}</td>
      <td><span class="badge badge-${escHtml(i.status)}">${statusTr(i.status)}</span></td>
      <td style="font-size:.8rem;color:var(--muted)">${new Date(i.created_at).toLocaleDateString('tr-TR')}</td>
      <td><button class="btn-sm btn-view" onclick="openInqModal(${i.id})">Detay</button></td>
    </tr>`).join('');
}

async function openInqModal(id) {
  const inq = await api('/api/inquiries/' + id);
  if (!inq || inq.error) { toast('Sorgu bulunamadı.', 'err'); return; }

  document.getElementById('imId').value     = inq.id;
  document.getElementById('imStatus').value = inq.status;
  document.getElementById('imNotes').value  = inq.admin_notes || '';
  document.getElementById('inqDetail').innerHTML = `
    <div class="inq-row"><span class="inq-label">Müşteri:</span><span class="inq-val">${escHtml(inq.customer_name)}</span></div>
    <div class="inq-row"><span class="inq-label">E-posta:</span><span class="inq-val">${escHtml(inq.customer_email||'—')}</span></div>
    <div class="inq-row"><span class="inq-label">Telefon:</span><span class="inq-val">${escHtml(inq.customer_phone||'—')}</span></div>
    <div class="inq-row"><span class="inq-label">Şirket:</span><span class="inq-val">${escHtml(inq.company||'—')}</span></div>
    <div class="inq-row"><span class="inq-label">Ürün:</span><span class="inq-val">${escHtml(inq.product_name||'—')}</span></div>
    <div class="inq-row"><span class="inq-label">Konu:</span><span class="inq-val">${escHtml(inq.subject||'—')}</span></div>
    <div class="inq-row"><span class="inq-label">Mesaj:</span><span class="inq-val">${escHtml(inq.message)}</span></div>
    <div class="inq-row"><span class="inq-label">Tarih:</span><span class="inq-val">${new Date(inq.created_at).toLocaleString('tr-TR')}</span></div>`;

  document.getElementById('inqModal').classList.remove('hidden');

  if (inq.status === 'new') {
    await api(`/api/inquiries/${id}`, { method: 'PUT', body: { status: 'read', admin_notes: inq.admin_notes } });
    loadInquiryBadge();
  }
}

document.getElementById('imClose').addEventListener('click', () => document.getElementById('inqModal').classList.add('hidden'));
document.getElementById('imCancelBtn').addEventListener('click', () => document.getElementById('inqModal').classList.add('hidden'));

document.getElementById('inqUpdateForm').addEventListener('submit', async e => {
  e.preventDefault();
  const id = document.getElementById('imId').value;
  const res = await api(`/api/inquiries/${id}`, {
    method: 'PUT',
    body: { status: document.getElementById('imStatus').value, admin_notes: document.getElementById('imNotes').value }
  });
  if (res && !res.error) {
    document.getElementById('inqModal').classList.add('hidden');
    toast('Sorgu güncellendi');
    loadInquiryBadge();
    if (currentPage === 'inquiries') renderInquiries();
    if (currentPage === 'dashboard')  renderDashboard();
  } else toast(res?.error || 'Hata', 'err');
});

async function loadInquiryBadge() {
  const stats = await api('/api/inquiries/stats');
  const badge = document.getElementById('sbBadge');
  if (stats && stats.new > 0) { badge.textContent = stats.new; badge.style.display = ''; }
  else badge.style.display = 'none';
}

/* ── SALES ── */
async function renderSales() {
  const actions = document.getElementById('pageActions');
  actions.innerHTML = `<button class="btn-add" id="addSaleBtn"><svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 2V14M2 8H14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> Satış Ekle</button>`;
  document.getElementById('addSaleBtn').addEventListener('click', openSaleModal);

  document.getElementById('contentBody').innerHTML = `
    <div class="section-card" style="margin-bottom:20px">
      <div class="sc-head"><h3>Satış Özeti</h3></div>
      <div id="salesSummaryArea" style="padding:16px 20px;color:var(--muted)">Yükleniyor...</div>
    </div>
    <div class="section-card">
      <div class="sc-toolbar">
        <div class="sc-search"><svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="6" cy="6" r="5" stroke="#5A7184" stroke-width="1.3"/><path d="M10 10L13 13" stroke="#5A7184" stroke-width="1.3" stroke-linecap="round"/></svg><input type="text" id="saleSearch" placeholder="Ürün, müşteri ara..."/></div>
        <div class="sc-filter" style="display:flex;gap:8px;align-items:center"><label style="font-size:.8rem;color:var(--muted)">Başlangıç:</label><input type="date" id="saleFrom" style="padding:7px 12px;border:1.5px solid var(--border);border-radius:50px;font-size:.82rem;outline:none;background:var(--bg)"/><label style="font-size:.8rem;color:var(--muted)">Bitiş:</label><input type="date" id="saleTo" style="padding:7px 12px;border:1.5px solid var(--border);border-radius:50px;font-size:.82rem;outline:none;background:var(--bg)"/></div>
      </div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>#</th><th>Ürün</th><th>Miktar</th><th>Birim Fiyat</th><th>Toplam</th><th>Müşteri</th><th>Ülke</th><th>Tarih</th><th>Sil</th></tr></thead>
        <tbody id="saleTbody"><tr><td colspan="9" style="text-align:center;padding:32px;color:var(--muted)">Yükleniyor...</td></tr></tbody>
      </table></div>
    </div>`;

  const [sales, summary] = await Promise.all([api('/api/sales'), api('/api/sales/summary')]);
  const topP = summary?.topProducts || [];
  document.getElementById('salesSummaryArea').innerHTML = `
    <div style="display:flex;gap:32px;flex-wrap:wrap">
      <div><div style="font-family:'Sora',sans-serif;font-size:1.8rem;font-weight:800;color:var(--blue)">${summary?.total?.c||0}</div><div style="font-size:.78rem;color:var(--muted);margin-top:2px">Toplam Sipariş</div></div>
      <div><div style="font-family:'Sora',sans-serif;font-size:1.8rem;font-weight:800;color:var(--green)">$${((summary?.total?.r)||0).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})}</div><div style="font-size:.78rem;color:var(--muted);margin-top:2px">Toplam Ciro</div></div>
      <div><div style="font-family:'Sora',sans-serif;font-size:1.8rem;font-weight:800;color:var(--orange)">${summary?.thisMonth?.c||0}</div><div style="font-size:.78rem;color:var(--muted);margin-top:2px">Bu Ay Sipariş</div></div>
      <div><div style="font-family:'Sora',sans-serif;font-size:1.8rem;font-weight:800">${topP[0]?.product_name||'—'}</div><div style="font-size:.78rem;color:var(--muted);margin-top:2px">En Çok Satan</div></div>
    </div>`;

  let allSales = sales || [];
  renderSaleTable(allSales);

  document.getElementById('saleSearch').addEventListener('input', filterSales);
  document.getElementById('saleFrom').addEventListener('change', filterSales);
  document.getElementById('saleTo').addEventListener('change', filterSales);

  function filterSales() {
    const q    = document.getElementById('saleSearch').value.toLowerCase();
    const from = document.getElementById('saleFrom').value;
    const to   = document.getElementById('saleTo').value;
    renderSaleTable(allSales.filter(s =>
      (!q    || s.product_name.toLowerCase().includes(q) || (s.customer_name||'').toLowerCase().includes(q)) &&
      (!from || s.sale_date >= from) &&
      (!to   || s.sale_date <= to)
    ));
  }
}

function renderSaleTable(sales) {
  const tbody = document.getElementById('saleTbody');
  if (!sales.length) { tbody.innerHTML = '<tr><td colspan="9"><div class="empty-state"><p>Satış kaydı bulunamadı.</p></div></td></tr>'; return; }
  tbody.innerHTML = sales.map(s => `
    <tr>
      <td style="color:var(--muted);font-size:.78rem">#${s.id}</td>
      <td><strong>${escHtml(s.product_name)}</strong>${s.catalog_no?`<br/><code style="font-size:.72rem;color:var(--muted)">${escHtml(s.catalog_no)}</code>`:''}</td>
      <td>${s.quantity}</td>
      <td>${s.unit_price ? `${escHtml(s.currency)} ${parseFloat(s.unit_price).toFixed(2)}` : '—'}</td>
      <td><strong>${s.total_price ? `${escHtml(s.currency)} ${parseFloat(s.total_price).toFixed(2)}` : '—'}</strong></td>
      <td>${escHtml(s.customer_name||'—')}${s.customer_company?`<br/><small style="color:var(--muted)">${escHtml(s.customer_company)}</small>`:''}</td>
      <td>${escHtml(s.country||'—')}</td>
      <td style="font-size:.8rem;color:var(--muted)">${escHtml(s.sale_date||'—')}</td>
      <td><button class="btn-sm btn-del" onclick="deleteSale(${s.id})">Sil</button></td>
    </tr>`).join('');
}

async function openSaleModal() {
  if (!allProducts.length) allProducts = await api('/api/products') || [];
  // Populate product selector
  const sel = document.getElementById('smProductSel');
  sel.innerHTML = '<option value="">Manuel giriş</option>' +
    (allProducts.length ? allProducts.map(p => `<option value="${p.id}" data-name="${escHtml(p.name_tr)}" data-cat="${escHtml(p.catalog_no||'')}">${escHtml(p.name_tr)}${p.catalog_no?' ('+escHtml(p.catalog_no)+')':''}</option>`).join('') : '');

  sel.onchange = () => {
    const opt = sel.selectedOptions[0];
    if (opt.value) {
      document.getElementById('smProductName').value = opt.dataset.name || '';
      document.getElementById('smCatalog').value     = opt.dataset.cat || '';
    }
  };

  document.getElementById('saleForm').reset();
  document.getElementById('smDate').valueAsDate = new Date();
  document.getElementById('saleModal').classList.remove('hidden');
}

document.getElementById('smClose').addEventListener('click', () => document.getElementById('saleModal').classList.add('hidden'));
document.getElementById('smCancelBtn').addEventListener('click', () => document.getElementById('saleModal').classList.add('hidden'));

document.getElementById('saleForm').addEventListener('submit', async e => {
  e.preventDefault();
  const productId = document.getElementById('smProductSel').value;
  const body = {
    product_id:       productId || null,
    product_name:     document.getElementById('smProductName').value,
    catalog_no:       document.getElementById('smCatalog').value,
    quantity:         document.getElementById('smQty').value,
    unit_price:       document.getElementById('smUnitPrice').value,
    currency:         document.getElementById('smCurrency').value,
    customer_name:    document.getElementById('smCustomer').value,
    customer_company: document.getElementById('smCompany').value,
    country:          document.getElementById('smCountry').value,
    sale_date:        document.getElementById('smDate').value,
    notes:            document.getElementById('smNotes').value,
  };
  const btn = e.target.querySelector('[type=submit]');
  btn.disabled = true; btn.textContent = 'Kaydediliyor...';
  const res = await api('/api/sales', { method: 'POST', body });
  btn.disabled = false; btn.textContent = 'Kaydet';
  if (res && !res.error) {
    document.getElementById('saleModal').classList.add('hidden');
    toast('Satış kaydedildi');
    renderSales();
  } else toast(res?.error || 'Hata', 'err');
});

async function deleteSale(id) {
  if (!confirm('Bu satış kaydını silmek istediğinizden emin misiniz?')) return;
  const res = await api(`/api/sales/${id}`, { method: 'DELETE' });
  if (res && !res.error) { toast('Satış silindi'); renderSales(); }
  else toast(res?.error || 'Hata', 'err');
}

/* ── SETTINGS ── */
function renderSettings() {
  document.getElementById('contentBody').innerHTML = `
    <div class="settings-form">
      <h4>Şifre Değiştir</h4>
      <form id="changePwdForm">
        <div class="mfg"><label>Mevcut Şifre</label><input type="password" id="curPwd" required/></div>
        <div class="mfg"><label>Yeni Şifre</label><input type="password" id="newPwd" required minlength="6"/></div>
        <div class="mfg"><label>Yeni Şifre (Tekrar)</label><input type="password" id="newPwd2" required minlength="6"/></div>
        <div class="modal-actions" style="justify-content:flex-start">
          <button type="submit" class="btn-primary-a" style="width:auto;padding:11px 28px">Güncelle</button>
        </div>
        <div class="hidden" id="pwdMsg"></div>
      </form>
    </div>`;

  document.getElementById('changePwdForm').addEventListener('submit', async e => {
    e.preventDefault();
    const cur = document.getElementById('curPwd').value;
    const np  = document.getElementById('newPwd').value;
    const np2 = document.getElementById('newPwd2').value;
    const msg = document.getElementById('pwdMsg');
    if (np !== np2) { msg.className = 'settings-err'; msg.textContent = 'Yeni şifreler eşleşmiyor.'; msg.classList.remove('hidden'); return; }
    const res = await api('/api/auth/change-password', { method: 'POST', body: { currentPassword: cur, newPassword: np } });
    if (res && !res.error) {
      msg.className = 'settings-ok'; msg.textContent = 'Password updated successfully.';
    } else {
      msg.className = 'settings-err'; msg.textContent = res?.error || 'Error';
    }
    msg.classList.remove('hidden');
  });
}

/* ══════════════════════════════════════════════════════
   CATEGORIES & MENUS
══════════════════════════════════════════════════════ */
let allCategories = [];

async function renderCategories() {
  const body = document.getElementById('contentBody');
  body.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

  document.getElementById('pageActions').innerHTML =
    '<button class="btn-primary" onclick="openAddCategory()">+ Add Category</button>';

  const rawCats = await api('/api/categories');
  if (!Array.isArray(rawCats)) { body.innerHTML = '<p class="err-msg">Failed to load categories.</p>'; return; }
  allCategories = [];
  function flatCats(arr) { arr.forEach(c => { const kids = c.children||[]; delete c.children; allCategories.push(c); if(kids.length) flatCats(kids); }); }
  flatCats(rawCats);

  const roots = allCategories.filter(c => !c.parent_id);

  function buildTree(cats, parentId, level) {
    return cats.filter(c => c.parent_id === parentId).map(c => {
      const indent = '&nbsp;'.repeat(level * 4);
      const children = buildTree(cats, c.id, level + 1);
      return `<tr>
        <td>${indent}<strong>${escHtml(c.name)}</strong></td>
        <td><code>${escHtml(c.slug)}</code></td>
        <td>${c.description ? escHtml(c.description.substring(0,60)) + '...' : '-'}</td>
        <td>${c.parent_id ? escHtml((allCategories.find(x=>x.id===c.parent_id)||{}).name||'-') : '<em>Root</em>'}</td>
        <td>${c.is_active ? '<span class="badge badge-ok">Active</span>' : '<span class="badge badge-err">Inactive</span>'}</td>
        <td style="display:flex;gap:4px;flex-wrap:wrap">
          <button class="btn-sm btn-edit" onclick="openEditCategory(${c.id})">Edit</button>
          <button class="btn-sm" style="background:#EAF4FB;color:#0A5C8A" onclick="openCatProducts(${c.id},'${escAttr(c.name)}')">Products</button>
          <button class="btn-sm btn-del" onclick="deleteCategory(${c.id},'${escAttr(c.name)}')">Delete</button>
        </td>
      </tr>` + children;
    }).join('');
  }

  body.innerHTML = `
    <div class="section-card">
      <div class="sc-head"><h3>All Categories (${allCategories.length})</h3></div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Name</th><th>Slug</th><th>Description</th><th>Parent</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>${buildTree(allCategories, null, 0)}</tbody>
        </table>
      </div>
    </div>

    <!-- Add/Edit Category Modal -->
    <div id="catModal" class="modal-overlay hidden">
      <div class="modal-box">
        <div class="modal-header"><h3 id="catModalTitle">Add Category</h3><button class="modal-close" onclick="closeCatModal()">&times;</button></div>
        <form id="catForm" class="modal-form">
          <input type="hidden" id="catId">
          <label>Name *<input type="text" id="catName" required></label>
          <label>Slug (auto-generated if empty)<input type="text" id="catSlug" placeholder="e.g. covid-19"></label>
          <label>Description<textarea id="catDesc" rows="3"></textarea></label>
          <label>Parent Category
            <select id="catParent">
              <option value="">— Root (No Parent) —</option>
              ${allCategories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
            </select>
          </label>
          <label>Order Index<input type="number" id="catOrder" value="0" min="0"></label>
          <label>Image URL<input type="text" id="catImage" placeholder="/uploads/image.jpg"></label>
          <label class="check-label"><input type="checkbox" id="catActive" checked> Active</label>
          <div class="modal-footer">
            <button type="button" class="btn-cancel" onclick="closeCatModal()">Cancel</button>
            <button type="submit" class="btn-primary">Save</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById('catForm').addEventListener('submit', saveCategoryForm);
}

function openAddCategory() {
  document.getElementById('catModalTitle').textContent = 'Add Category';
  document.getElementById('catId').value = '';
  document.getElementById('catName').value = '';
  document.getElementById('catSlug').value = '';
  document.getElementById('catDesc').value = '';
  document.getElementById('catParent').value = '';
  document.getElementById('catOrder').value = '0';
  document.getElementById('catImage').value = '';
  document.getElementById('catActive').checked = true;
  document.getElementById('catModal').classList.remove('hidden');
}

function openEditCategory(id) {
  const cat = allCategories.find(c => c.id === id);
  if (!cat) return;
  document.getElementById('catModalTitle').textContent = 'Edit Category';
  document.getElementById('catId').value = cat.id;
  document.getElementById('catName').value = cat.name || '';
  document.getElementById('catSlug').value = cat.slug || '';
  document.getElementById('catDesc').value = cat.description || '';
  document.getElementById('catParent').value = cat.parent_id || '';
  document.getElementById('catOrder').value = cat.order_index || 0;
  document.getElementById('catImage').value = cat.image_url || '';
  document.getElementById('catActive').checked = !!cat.is_active;
  document.getElementById('catModal').classList.remove('hidden');
}

function closeCatModal() { document.getElementById('catModal').classList.add('hidden'); }

async function saveCategoryForm(e) {
  e.preventDefault();
  const id   = document.getElementById('catId').value;
  const name = document.getElementById('catName').value.trim();
  let   slug = document.getElementById('catSlug').value.trim();
  if (!slug) {
    slug = name.toLowerCase()
      .replace(/ş/g,'s').replace(/ç/g,'c').replace(/ğ/g,'g')
      .replace(/ü/g,'u').replace(/ö/g,'o').replace(/ı/g,'i')
      .replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'').replace(/-+/g,'-');
  }
  const payload = {
    name,
    slug,
    description: document.getElementById('catDesc').value,
    parent_id: document.getElementById('catParent').value || null,
    order_index: parseInt(document.getElementById('catOrder').value) || 0,
    image_url: document.getElementById('catImage').value,
    is_active: document.getElementById('catActive').checked ? 1 : 0
  };
  const res = id
    ? await api('/api/categories/' + id, { method: 'PUT', body: payload })
    : await api('/api/categories', { method: 'POST', body: payload });
  if (res && (res.id || res.message) && !res.error) { toast(id ? 'Category updated.' : 'Category created.'); closeCatModal(); renderCategories(); }
  else toast(res?.error || 'Failed to save.', 'err');
}

async function deleteCategory(id, name) {
  if (!confirm('Delete category "' + name + '"? This cannot be undone.')) return;
  const res = await api('/api/categories/' + id, { method: 'DELETE' });
  if (res && res.message && !res.error) { toast('Category deleted.'); renderCategories(); }
  else toast(res?.error || 'Failed to delete.', 'err');
}

/* ══════════════════════════════════════════════════════
   CATEGORY PRODUCTS MANAGEMENT
══════════════════════════════════════════════════════ */
let currentCatProductsCatId = null;
let catProductsCache = [];

async function openCatProducts(catId, catName) {
  currentCatProductsCatId = catId;
  document.getElementById('catProdsTitle').textContent = 'Products: ' + catName;
  document.getElementById('catProdsModal').classList.remove('hidden');
  await loadCatProducts();
}

function closeCatProdsModal() {
  document.getElementById('catProdsModal').classList.add('hidden');
}

async function loadCatProducts() {
  const content = document.getElementById('catProdsBody');
  content.innerHTML = '<div style="text-align:center;padding:32px;color:var(--muted)">Yükleniyor...</div>';
  const products = await api('/api/categories/' + currentCatProductsCatId + '/products');
  if (!Array.isArray(products)) {
    content.innerHTML = '<p style="padding:20px;color:#c00">Failed to load products.</p>';
    return;
  }
  catProductsCache = products;
  if (products.length === 0) {
    content.innerHTML = '<p style="padding:24px;color:var(--muted);text-align:center">No products in this category yet. Click &ldquo;Add Product&rdquo; to get started.</p>';
    return;
  }
  content.innerHTML = `
    <div class="table-wrap" style="max-height:380px;overflow-y:auto">
      <table class="data-table">
        <thead><tr><th>#</th><th>Brand</th><th>Stock Code</th><th>Stock Name</th><th>Purpose</th><th>Actions</th></tr></thead>
        <tbody>
          ${products.map((p, i) => `
            <tr>
              <td style="color:var(--muted);font-size:.78rem">${i + 1}</td>
              <td><span class="brand-badge" style="background:#EAF4FB;color:#0A5C8A;padding:2px 8px;border-radius:50px;font-size:.75rem">${escHtml(p.brand || '-')}</span></td>
              <td><code style="font-size:.78rem;color:var(--muted)">${escHtml(p.stock_code || '-')}</code></td>
              <td><strong>${escHtml(p.stock_name)}</strong></td>
              <td style="color:#5A7184;font-size:.85rem;max-width:200px">${escHtml(p.purpose || '-')}</td>
              <td style="display:flex;gap:4px">
                <button class="btn-sm btn-edit" onclick="openEditCatProduct(${p.id})">Edit</button>
                <button class="btn-sm btn-del" onclick="deleteCatProduct(${p.id})">Delete</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function openAddCatProduct() {
  document.getElementById('catProdFormTitle').textContent = 'Add Product';
  document.getElementById('cpfId').value = '';
  document.getElementById('cpfCatId').value = currentCatProductsCatId;
  document.getElementById('cpfBrand').value = 'ORGAMİK';
  document.getElementById('cpfCode').value = '';
  document.getElementById('cpfName').value = '';
  document.getElementById('cpfPurpose').value = '';
  document.getElementById('cpfOrder').value = '0';
  document.getElementById('catProdFormModal').classList.remove('hidden');
}

function openEditCatProduct(id) {
  const p = catProductsCache.find(x => x.id === id);
  if (!p) return;
  document.getElementById('catProdFormTitle').textContent = 'Edit Product';
  document.getElementById('cpfId').value = p.id;
  document.getElementById('cpfCatId').value = currentCatProductsCatId;
  document.getElementById('cpfBrand').value = p.brand || '';
  document.getElementById('cpfCode').value = p.stock_code || '';
  document.getElementById('cpfName').value = p.stock_name || '';
  document.getElementById('cpfPurpose').value = p.purpose || '';
  document.getElementById('cpfOrder').value = p.order_index || 0;
  document.getElementById('catProdFormModal').classList.remove('hidden');
}

function closeCatProdForm() {
  document.getElementById('catProdFormModal').classList.add('hidden');
}

document.getElementById('catProdForm').addEventListener('submit', async e => {
  e.preventDefault();
  const id    = document.getElementById('cpfId').value;
  const catId = document.getElementById('cpfCatId').value;
  const body  = {
    brand:       document.getElementById('cpfBrand').value,
    stock_code:  document.getElementById('cpfCode').value,
    stock_name:  document.getElementById('cpfName').value,
    purpose:     document.getElementById('cpfPurpose').value,
    order_index: parseInt(document.getElementById('cpfOrder').value) || 0
  };
  const btn = e.target.querySelector('[type=submit]');
  btn.disabled = true; btn.textContent = 'Saving...';
  const res = id
    ? await api('/api/categories/products/' + id, { method: 'PUT', body })
    : await api('/api/categories/' + catId + '/products', { method: 'POST', body });
  btn.disabled = false; btn.textContent = 'Save';
  if (res && !res.error) {
    toast(id ? 'Product updated.' : 'Product added.');
    closeCatProdForm();
    await loadCatProducts();
  } else toast(res?.error || 'Failed to save.', 'err');
});

async function deleteCatProduct(id) {
  const p = catProductsCache.find(x => x.id === id);
  const name = p ? p.stock_name : 'this product';
  if (!confirm('Delete "' + name + '"?')) return;
  const res = await api('/api/categories/products/' + id, { method: 'DELETE' });
  if (res && !res.error) { toast('Product deleted.'); await loadCatProducts(); }
  else toast(res?.error || 'Failed.', 'err');
}

/* ══════════════════════════════════════════════════════
   STERILITY CODES
══════════════════════════════════════════════════════ */
async function renderSterility() {
  const body = document.getElementById('contentBody');
  body.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

  document.getElementById('pageActions').innerHTML =
    '<button class="btn-primary" onclick="openGenCode()">+ Generate Code</button>';

  const data = await api('/api/sterility');
  const codes = Array.isArray(data) ? data : [];

  body.innerHTML = `
    <div class="section-card">
      <div class="sc-head"><h3>Sterility Codes (${codes.length})</h3></div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Code</th><th>Product</th><th>Catalog No</th><th>Batch No</th>
              <th>Customer</th><th>Invoice Date</th><th>Expiry</th><th>Result</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${codes.length === 0 ? '<tr><td colspan="9" style="text-align:center;color:#888">No codes generated yet.</td></tr>' :
              codes.map(c => `
                <tr>
                  <td><code class="code-cell">${escHtml(c.code)}</code></td>
                  <td>${escHtml(c.product_name || '-')}</td>
                  <td>${escHtml(c.catalog_no || '-')}</td>
                  <td>${escHtml(c.batch_no || '-')}</td>
                  <td>${escHtml(c.customer_name || '-')}${c.customer_company ? ' (' + escHtml(c.customer_company) + ')' : ''}</td>
                  <td>${escHtml(c.invoice_date || '-')}</td>
                  <td>${escHtml(c.expiry_date || '-')}</td>
                  <td><span class="badge ${c.test_result === 'PASS' ? 'badge-ok' : 'badge-err'}">${escHtml(c.test_result || 'PASS')}</span></td>
                  <td><button class="btn-sm btn-del" onclick="deleteSterilityCode(${c.id},'${escAttr(c.code)}')">Delete</button></td>
                </tr>
              `).join('')
            }
          </tbody>
        </table>
      </div>
    </div>

    <!-- Generate Code Modal -->
    <div id="codeModal" class="modal-overlay hidden">
      <div class="modal-box">
        <div class="modal-header"><h3>Generate Sterility Code</h3><button class="modal-close" onclick="closeCodeModal()">&times;</button></div>
        <form id="codeForm" class="modal-form">
          <label>Product Name *<input type="text" id="scProduct" required placeholder="e.g. Nasopharyngeal Swab"></label>
          <div class="form-row">
            <label>Catalog No<input type="text" id="scCatalog" placeholder="e.g. NTS-001"></label>
            <label>Batch No<input type="text" id="scBatch" placeholder="e.g. B2024001"></label>
          </div>
          <div class="form-row">
            <label>Customer Name<input type="text" id="scCustomer"></label>
            <label>Company<input type="text" id="scCompany"></label>
          </div>
          <div class="form-row">
            <label>Invoice Date *<input type="date" id="scInvoice" required></label>
            <label>Manufacture Date<input type="date" id="scMfg"></label>
          </div>
          <label>Expiry Date<input type="date" id="scExpiry"></label>
          <label>Notes<textarea id="scNotes" rows="2"></textarea></label>
          <label>Test Result
            <select id="scResult">
              <option value="PASS">PASS</option>
              <option value="FAIL">FAIL</option>
            </select>
          </label>
          <div class="modal-footer">
            <button type="button" class="btn-cancel" onclick="closeCodeModal()">Cancel</button>
            <button type="submit" class="btn-primary">Generate Code</button>
          </div>
        </form>
        <div id="generatedCode" class="generated-code hidden">
          <h4>Generated Code:</h4>
          <div class="code-display" id="codeDisplay"></div>
          <button class="btn-sm" onclick="copyCode()">Copy</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('codeForm').addEventListener('submit', genSterilityCode);
}

function openGenCode() {
  document.getElementById('scInvoice').value = new Date().toISOString().slice(0,10);
  document.getElementById('generatedCode').classList.add('hidden');
  document.getElementById('codeModal').classList.remove('hidden');
}
function closeCodeModal() { document.getElementById('codeModal').classList.add('hidden'); }

async function genSterilityCode(e) {
  e.preventDefault();
  const payload = {
    product_name: document.getElementById('scProduct').value,
    catalog_no: document.getElementById('scCatalog').value,
    batch_no: document.getElementById('scBatch').value,
    customer_name: document.getElementById('scCustomer').value,
    customer_company: document.getElementById('scCompany').value,
    invoice_date: document.getElementById('scInvoice').value,
    manufacture_date: document.getElementById('scMfg').value,
    expiry_date: document.getElementById('scExpiry').value,
    notes: document.getElementById('scNotes').value,
    test_result: document.getElementById('scResult').value
  };
  const res = await api('/api/sterility', { method: 'POST', body: payload });
  if (res && res.code && !res.error) {
    toast('Code generated: ' + res.code);
    document.getElementById('codeDisplay').textContent = res.code;
    document.getElementById('generatedCode').classList.remove('hidden');
    document.getElementById('codeForm').reset();
    setTimeout(() => renderSterility(), 500);
  } else {
    toast(res?.error || 'Failed to generate code.', 'err');
  }
}

function copyCode() {
  const code = document.getElementById('codeDisplay').textContent;
  navigator.clipboard.writeText(code).then(() => toast('Code copied to clipboard!'));
}

async function deleteSterilityCode(id, code) {
  if (!confirm('Delete sterility code "' + code + '"?')) return;
  const res = await api('/api/sterility/' + id, { method: 'DELETE' });
  if (res && res.message && !res.error) { toast('Code deleted.'); renderSterility(); }
  else toast(res?.error || 'Failed.', 'err');
}

/* ══════════════════════════════════════════════════════
   MEDIA LIBRARY
══════════════════════════════════════════════════════ */
async function renderMedia() {
  const body = document.getElementById('contentBody');
  body.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

  const data = await api('/api/upload');
  const files = Array.isArray(data) ? data : [];

  body.innerHTML = `
    <div class="section-card">
      <div class="sc-head"><h3>Upload Image</h3></div>
      <div class="upload-area" id="uploadArea">
        <input type="file" id="fileInput" accept="image/*" style="display:none" onchange="uploadFile(this)">
        <div class="upload-zone" onclick="document.getElementById('fileInput').click()">
          <div class="upload-icon">📁</div>
          <p>Click to select an image or drag and drop</p>
          <small>JPG, PNG, GIF, WebP, SVG (max 10MB)</small>
        </div>
        <div id="uploadProgress" style="display:none">
          <div class="progress-bar"><div class="progress-fill" id="progressFill"></div></div>
          <span id="uploadStatus">Uploading...</span>
        </div>
      </div>
    </div>

    <div class="section-card">
      <div class="sc-head"><h3>Uploaded Files (${files.length})</h3></div>
      <div class="media-grid" id="mediaGrid">
        ${files.length === 0 ? '<p style="color:#888;padding:24px">No files uploaded yet.</p>' :
          files.map(f => `
            <div class="media-item">
              <img src="${escHtml(f.url)}" alt="${escHtml(f.filename)}" onerror="this.style.display='none'" loading="lazy">
              <div class="media-info">
                <span class="media-name">${escHtml(f.filename)}</span>
                <span class="media-size">${(f.size/1024).toFixed(1)} KB</span>
              </div>
              <div class="media-actions">
                <button class="btn-sm" onclick="copyUrl('${escAttr(f.url)}')">URL Kopyala</button>
                <button class="btn-sm btn-del" onclick="deleteFile('${escAttr(f.filename)}')">Sil</button>
              </div>
            </div>
          `).join('')
        }
      </div>
    </div>
  `;

  const dropzone = document.querySelector('.upload-zone');
  if (dropzone) {
    dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag-over'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
    dropzone.addEventListener('drop', e => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
      const files = e.dataTransfer.files;
      if (files.length) uploadFileObj(files[0]);
    });
  }
}

async function uploadFile(input) {
  if (!input.files.length) return;
  uploadFileObj(input.files[0]);
}

async function uploadFileObj(file) {
  const formData = new FormData();
  formData.append('image', file);
  document.getElementById('uploadProgress').style.display = 'block';
  document.getElementById('progressFill').style.width = '30%';
  document.getElementById('uploadStatus').textContent = 'Uploading ' + file.name + '...';
  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + authToken },
      body: formData
    });
    document.getElementById('progressFill').style.width = '100%';
    const data = await res.json();
    if (data && data.filename && !data.error) {
      toast('Uploaded: ' + data.filename);
      setTimeout(() => renderMedia(), 500);
    } else {
      toast(data?.error || 'Upload failed.', 'err');
    }
  } catch (err) {
    toast('Upload error: ' + err.message, 'err');
  }
  document.getElementById('uploadProgress').style.display = 'none';
}

function copyUrl(url) {
  navigator.clipboard.writeText(window.location.origin + url).then(() => toast('URL copied!'));
}

async function deleteFile(filename) {
  if (!confirm('Delete file "' + filename + '"?')) return;
  const res = await api('/api/upload/' + encodeURIComponent(filename), { method: 'DELETE' });
  if (res && res.message && !res.error) { toast('File deleted.'); renderMedia(); }
  else toast(res?.error || 'Failed.', 'err');
}

/* ══════════════════════════════════════════════════════
   SITE CONTENT CMS
══════════════════════════════════════════════════════ */
async function renderContent() {
  const body = document.getElementById('contentBody');
  body.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

  const data = await api('/api/content/schema');
  if (!Array.isArray(data)) { body.innerHTML = '<p class="err-msg">Failed to load content schema.</p>'; return; }

  // Group by section
  const sections = {};
  data.forEach(r => {
    if (!sections[r.section]) sections[r.section] = [];
    sections[r.section].push(r);
  });

  const sectionHtml = Object.entries(sections).map(([section, fields]) => `
    <div class="section-card content-section" data-section="${section}">
      <div class="sc-head"><h3>${section.charAt(0).toUpperCase() + section.slice(1)}</h3></div>
      <div class="content-fields">
        ${fields.map(f => {
          const fkey = `${section}.${f.key}`;
          const safeId = `cf-${fkey.replace(/\./g,'-')}`;
          if (f.type === 'textarea' || f.type === 'html') {
            return `<div class="content-field"><label>${escHtml(f.label || f.key)}<textarea class="content-input" id="${safeId}" data-key="${fkey}" rows="4">${escHtml(f.value || '')}</textarea></label></div>`;
          }
          if (f.type === 'image') {
            return `<div class="content-field">
              <label style="display:block;margin-bottom:6px;font-size:.84rem;font-weight:600">${escHtml(f.label || f.key)}</label>
              <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">
                <input type="text" class="content-input" id="${safeId}" data-key="${fkey}" value="${escHtml(f.value || '')}" placeholder="/uploads/resim.jpg" style="flex:1">
                <button type="button" class="btn-sm" style="white-space:nowrap" onclick="openMediaPicker('${fkey}','${safeId}')">Medyadan Seç</button>
              </div>
              <div id="prev-${safeId}" style="margin-top:4px">
                ${f.value ? `<img src="${escHtml(f.value)}" alt="" style="max-height:80px;max-width:200px;border-radius:6px;border:1px solid var(--border)">` : ''}
              </div>
            </div>`;
          }
          return `<div class="content-field"><label>${escHtml(f.label || f.key)}<input type="text" class="content-input" id="${safeId}" data-key="${fkey}" value="${escHtml(f.value || '')}"></label></div>`;
        }).join('')}
      </div>
      <div class="section-footer">
        <button class="btn-primary" onclick="saveSection('${section}')">Kaydet — ${section.charAt(0).toUpperCase() + section.slice(1)}</button>
      </div>
    </div>
  `).join('');

  body.innerHTML = sectionHtml || '<p class="err-msg">No content fields defined.</p>';

  // Live preview: update image preview when URL input changes
  document.querySelectorAll('.content-input[data-key]').forEach(inp => {
    if (inp.tagName === 'INPUT' && inp.type === 'text') {
      const prevId = 'prev-cf-' + inp.dataset.key.replace(/\./g, '-');
      inp.addEventListener('input', () => {
        const prev = document.getElementById(prevId);
        if (!prev) return;
        const url = inp.value.trim();
        prev.innerHTML = url ? `<img src="${escHtml(url)}" alt="" style="max-height:80px;max-width:200px;border-radius:6px;border:1px solid var(--border)" onerror="this.style.display='none'" onload="this.style.display=''">` : '';
      });
    }
  });
}

/* ── Media Picker ── */
let mediaPickerTargetKey = '';
let mediaPickerTargetId  = '';

async function openMediaPicker(fieldKey, inputId) {
  mediaPickerTargetKey = fieldKey;
  mediaPickerTargetId  = inputId;
  document.getElementById('mediaPickerModal').classList.remove('hidden');
  await refreshMpGrid();
}

function closeMediaPicker() {
  document.getElementById('mediaPickerModal').classList.add('hidden');
}

async function refreshMpGrid() {
  const grid = document.getElementById('mpGrid');
  grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:32px;color:var(--muted)">Yükleniyor...</div>';
  const files = await api('/api/upload');
  if (!Array.isArray(files) || files.length === 0) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:32px;color:var(--muted)">Henüz yüklenmiş görsel yok.<br>Yukarıdan bir görsel yükleyin.</div>';
    return;
  }
  grid.innerHTML = files.map(f => `
    <div class="mp-item" onclick="selectMediaFile('${escAttr(f.url)}')" title="${escHtml(f.filename)}">
      <img src="${escHtml(f.url)}" alt="${escHtml(f.filename)}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'60\\' height=\\'60\\'><rect fill=\\'%23eee\\' width=\\'60\\' height=\\'60\\'/>\\<text x=\\'50%\\' y=\\'55%\\' dominant-baseline=\\'middle\\' text-anchor=\\'middle\\' font-size=\\'10\\' fill=\\'%23888\\'>SVG</text></svg>'">
      <span>${escHtml(f.filename.length > 14 ? f.filename.slice(0,12) + '..' : f.filename)}</span>
    </div>`).join('');
}

function selectMediaFile(url) {
  const inp = document.getElementById(mediaPickerTargetId);
  if (inp) {
    inp.value = url;
    inp.dispatchEvent(new Event('input'));
  }
  closeMediaPicker();
  toast('Görsel seçildi: ' + url);
}

async function mpUploadFile(input) {
  if (!input.files || !input.files.length) return;
  const file = input.files[0];
  const formData = new FormData();
  formData.append('image', file);
  const status = document.getElementById('mpUploadStatus');
  status.textContent = 'Yükleniyor...';
  try {
    const res = await fetch('/api/upload', { method: 'POST', headers: { Authorization: 'Bearer ' + authToken }, body: formData });
    const data = await res.json();
    if (data && data.url) {
      status.textContent = 'Yüklendi!';
      input.value = '';
      await refreshMpGrid();
    } else {
      status.textContent = data?.error || 'Hata';
    }
  } catch(e) {
    status.textContent = 'Yükleme hatası';
  }
}

async function saveSection(section) {
  const card = document.querySelector(`.content-section[data-section="${section}"]`);
  if (!card) return;
  const inputs = card.querySelectorAll('.content-input');
  const updates = {};
  inputs.forEach(inp => { updates[inp.dataset.key] = inp.value; });
  const res = await api('/api/content', { method: 'PUT', body: updates });
  if (res && res.message && !res.error) toast('Content saved.');
  else toast(res?.error || 'Failed to save.', 'err');
}

function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* Escape for use inside single-quoted HTML attribute values (e.g. onclick="f('...')") */
function escAttr(s) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}
