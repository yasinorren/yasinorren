/* Innomed Admin Panel — complete rewrite, all inline onclick */
'use strict';

var TOKEN = '';
var currentCatId = null;
var currentCatName = '';
var mediaPickCallback = null;

/* ── Utility ── */
function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function fmt(n) { return n != null ? Number(n).toLocaleString() : '0'; }
function fmtDate(s) { return s ? String(s).slice(0,10) : '—'; }
function today() { return new Date().toISOString().slice(0,10); }

function showToast(msg, ok) {
  var t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast ' + (ok === false ? 'toast-err' : 'toast-ok');
  t.classList.add('show');
  setTimeout(function(){ t.classList.remove('show'); }, 3200);
}

async function apiFetch(url, opts) {
  opts = opts || {};
  opts.headers = opts.headers || {};
  if (TOKEN) opts.headers['Authorization'] = 'Bearer ' + TOKEN;
  if (opts.body && typeof opts.body === 'object' && !(opts.body instanceof FormData)) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(opts.body);
  }
  try {
    var r = await fetch(url, opts);
    var data = await r.json().catch(function(){ return {}; });
    return { ok: r.ok, status: r.status, data: data };
  } catch(e) {
    return { ok: false, status: 0, data: { error: e.message } };
  }
}

/* ── Auth ── */
document.getElementById('loginForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  var user = document.getElementById('loginUser').value.trim();
  var pass = document.getElementById('loginPass').value;
  var r = await apiFetch('/api/auth/login', { method:'POST', body:{ username:user, password:pass } });
  if (r.ok && r.data.token) {
    TOKEN = r.data.token;
    localStorage.setItem('adminToken', TOKEN);
    localStorage.setItem('adminUser', r.data.username || user);
    showAdminApp(r.data.username || user);
  } else {
    var err = document.getElementById('loginErr');
    err.textContent = r.data.error || 'Invalid credentials';
    err.classList.remove('hidden');
    setTimeout(function(){ err.classList.add('hidden'); }, 4000);
  }
});

function showAdminApp(username) {
  document.getElementById('loginPage').classList.add('hidden');
  document.getElementById('adminApp').classList.remove('hidden');
  document.getElementById('sbUsername').textContent = username || 'admin';
  document.getElementById('sbAvatarLetter').textContent = (username || 'A')[0].toUpperCase();
  loadBadge();
  navigate('dashboard');
}

/* ── Token restore on page load ── */
(function() {
  var t = localStorage.getItem('adminToken');
  if (!t) return;
  TOKEN = t;
  apiFetch('/api/auth/me').then(function(r) {
    if (r.ok) {
      showAdminApp(r.data.username || localStorage.getItem('adminUser') || 'admin');
    } else {
      TOKEN = '';
      localStorage.removeItem('adminToken');
    }
  });
})();

/* ── Logout ── */
document.getElementById('logoutBtn').addEventListener('click', function() {
  TOKEN = '';
  localStorage.removeItem('adminToken');
  localStorage.removeItem('adminUser');
  document.getElementById('adminApp').classList.add('hidden');
  document.getElementById('loginPage').classList.remove('hidden');
  document.getElementById('loginPass').value = '';
});

/* ── Sidebar navigation ── */
document.querySelectorAll('.sb-item[data-page]').forEach(function(btn) {
  btn.addEventListener('click', function() {
    navigate(this.getAttribute('data-page'));
  });
});

document.getElementById('mobileMenuBtn').addEventListener('click', function() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('hidden');
});
document.getElementById('sidebarClose').addEventListener('click', function() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.add('hidden');
});
document.getElementById('sidebarOverlay').addEventListener('click', function() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.add('hidden');
});

function navigate(page) {
  document.querySelectorAll('.sb-item[data-page]').forEach(function(b){
    b.classList.toggle('active', b.getAttribute('data-page') === page);
  });
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.add('hidden');
  currentCatId = null;
  currentCatName = '';
  switch(page) {
    case 'dashboard':   renderDashboard(); break;
    case 'categories':  renderCategories(); break;
    case 'inquiries':   renderInquiries(); break;
    case 'sales':       renderSales(); break;
    case 'orders':      renderOrders(); break;
    case 'sterility':   renderSterility(); break;
    case 'media':       renderMedia(); break;
    case 'content':     renderContent(); break;
    case 'settings':    renderSettings(); break;
    default:            renderDashboard();
  }
}

function setPage(title, breadcrumb, actionsHtml) {
  document.getElementById('pageTitle').textContent = title;
  document.getElementById('breadcrumbCurrent').textContent = breadcrumb || title;
  document.getElementById('pageActions').innerHTML = actionsHtml || '';
}

function setBody(html) {
  document.getElementById('contentBody').innerHTML = html;
}

async function loadBadge() {
  var r = await apiFetch('/api/inquiries');
  if (r.ok && Array.isArray(r.data)) {
    var newCount = r.data.filter(function(i){ return i.status === 'new'; }).length;
    var badge = document.getElementById('sbBadge');
    if (badge) { badge.textContent = newCount; badge.style.display = newCount ? 'inline-flex' : 'none'; }
  }
}

/* ══════════════════════════════════
   DASHBOARD
══════════════════════════════════ */
async function renderDashboard() {
  setPage('Kontrol Paneli', 'Dashboard', '');
  setBody('<div class="loading-skeleton"><div class="sk-row sk-wide"></div><div class="sk-row sk-medium"></div></div>');

  var [cats, inqs, ords, steri] = await Promise.all([
    apiFetch('/api/categories'),
    apiFetch('/api/inquiries'),
    apiFetch('/api/orders'),
    apiFetch('/api/sterility')
  ]);

  var catCount   = (cats.ok  && Array.isArray(cats.data))  ? cats.data.length  : 0;
  var inqCount   = (inqs.ok  && Array.isArray(inqs.data))  ? inqs.data.length  : 0;
  var ordCount   = (ords.ok  && Array.isArray(ords.data))  ? ords.data.length  : 0;
  var steriCount = (steri.ok && Array.isArray(steri.data)) ? steri.data.length : 0;
  var newInqs    = (inqs.ok  && Array.isArray(inqs.data))  ? inqs.data.filter(function(i){ return i.status==='new'; }).length : 0;
  var recentInqs = (inqs.ok  && Array.isArray(inqs.data))  ? inqs.data.slice(0, 5) : [];
  var recentOrd  = (ords.ok  && Array.isArray(ords.data))  ? ords.data.slice(0, 5) : [];

  setBody(
    '<div class="dash-stats">' +
      statCard('Kategoriler', catCount, '#3B82F6', 'categories') +
      statCard('Sorgular', inqCount, '#10B981', 'inquiries') +
      statCard('Siparişler', ordCount, '#F59E0B', 'orders') +
      statCard('Sterilite Kodları', steriCount, '#8B5CF6', 'sterility') +
    '</div>' +
    '<div class="dash-grid">' +
      '<div class="section-card">' +
        '<div class="card-head"><h3>Son Sorgular</h3>' + (newInqs ? '<span class="badge-new">' + newInqs + ' yeni</span>' : '') + '</div>' +
        (recentInqs.length
          ? '<table class="data-table"><thead><tr><th>Ad</th><th>E-posta</th><th>Tarih</th><th>Durum</th></tr></thead><tbody>' +
            recentInqs.map(function(i){
              return '<tr style="cursor:pointer" onclick="openInquiry(' + i.id + ')">' +
                '<td>' + esc(i.name) + '</td><td>' + esc(i.email) + '</td>' +
                '<td>' + fmtDate(i.created_at) + '</td>' +
                '<td><span class="badge-' + esc(i.status) + '">' + esc(i.status) + '</span></td></tr>';
            }).join('') + '</tbody></table>'
          : '<p class="empty-msg">Henüz sorgu yok.</p>') +
      '</div>' +
      '<div class="section-card">' +
        '<div class="card-head"><h3>Son Siparişler</h3></div>' +
        (recentOrd.length
          ? '<table class="data-table"><thead><tr><th>Müşteri</th><th>Ürün</th><th>Durum</th></tr></thead><tbody>' +
            recentOrd.map(function(o){
              return '<tr><td>' + esc(o.customer_name) + '</td><td>' + esc(o.product_name||'') + '</td>' +
                '<td><span class="badge-status">' + esc(o.status) + '</span></td></tr>';
            }).join('') + '</tbody></table>'
          : '<p class="empty-msg">Henüz sipariş yok.</p>') +
      '</div>' +
    '</div>'
  );
}

function statCard(label, val, color, page) {
  return '<div class="stat-card" onclick="navigate(\'' + page + '\')" style="cursor:pointer;border-top:3px solid ' + color + '">' +
    '<div class="stat-val" style="color:' + color + '">' + fmt(val) + '</div>' +
    '<div class="stat-label">' + label + '</div>' +
  '</div>';
}

/* ══════════════════════════════════
   CATEGORIES
══════════════════════════════════ */
async function renderCategories() {
  currentCatId = null;
  setPage('Kategoriler', 'Kategoriler',
    '<button class="btn-add" onclick="openAddCategory()">+ Kategori Ekle</button>');
  setBody('<div class="loading-skeleton"><div class="sk-row sk-wide"></div></div>');

  var r = await apiFetch('/api/categories');
  if (!r.ok) { setBody('<p class="empty-msg">Kategoriler yüklenemedi.</p>'); return; }

  var cats = [];
  function flatten(arr, depth) {
    arr.forEach(function(c) {
      var kids = c.children || []; delete c.children;
      c._depth = depth || 0;
      cats.push(c);
      if (kids.length) flatten(kids, (depth||0) + 1);
    });
  }
  flatten(r.data);

  if (!cats.length) {
    setBody('<p class="empty-msg">Henüz kategori eklenmemiş. <button class="btn-link" onclick="openAddCategory()">İlk kategoriyi ekle</button></p>');
    return;
  }

  var rows = cats.map(function(c) {
    var pl = c._depth > 0 ? 'padding-left:' + (c._depth * 22 + 12) + 'px' : '';
    var indicator = c._depth > 0 ? '<span style="color:#94a3b8;margin-right:4px">↳</span>' : '';
    var badge = c.is_active ? '<span class="badge-ok">Aktif</span>' : '<span class="badge-err">Pasif</span>';
    return '<tr>' +
      '<td style="' + pl + '">' + indicator + esc(c.name) + '</td>' +
      '<td style="color:#64748b;font-size:.82rem">' + esc(c.slug) + '</td>' +
      '<td>' + badge + '</td>' +
      '<td style="text-align:right">' +
        '<button class="btn-sm btn-edit" onclick="openEditCategory(' + c.id + ')">Düzenle</button> ' +
        '<button class="btn-sm" onclick="openCatProducts(' + c.id + ',\'' + esc(c.name) + '\')">Ürünler</button> ' +
        '<button class="btn-sm btn-del" onclick="deleteCategory(' + c.id + ',\'' + esc(c.name) + '\')">Sil</button>' +
      '</td>' +
    '</tr>';
  }).join('');

  setBody(
    '<div class="section-card"><table class="data-table">' +
      '<thead><tr><th>Kategori Adı</th><th>Slug</th><th>Durum</th><th style="text-align:right">İşlemler</th></tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
    '</table></div>'
  );
}

async function getCatList() {
  var r = await apiFetch('/api/categories');
  var cats = [];
  if (r.ok && Array.isArray(r.data)) {
    function flat(arr){ arr.forEach(function(c){ var k=c.children||[];delete c.children;cats.push(c);flat(k); }); }
    flat(r.data);
  }
  return cats;
}

async function openAddCategory() {
  var cats = await getCatList();
  document.getElementById('catModalTitle').textContent = 'Kategori Ekle';
  document.getElementById('catId').value = '';
  document.getElementById('catName').value = '';
  document.getElementById('catSlug').value = '';
  document.getElementById('catDesc').value = '';
  document.getElementById('catOrder').value = '0';
  document.getElementById('catImage').value = '';
  document.getElementById('catActive').checked = true;
  document.getElementById('catParent').innerHTML = '<option value="">— Kök (Üst Yok) —</option>' +
    cats.map(function(c){ return '<option value="' + c.id + '">' + esc(c.name) + '</option>'; }).join('');
  document.getElementById('catModal').classList.remove('hidden');
}

async function openEditCategory(id) {
  var cats = await getCatList();
  var cat = cats.find(function(c){ return c.id === id; });
  if (!cat) { showToast('Kategori bulunamadı', false); return; }
  document.getElementById('catModalTitle').textContent = 'Kategori Düzenle';
  document.getElementById('catId').value = cat.id;
  document.getElementById('catName').value = cat.name || '';
  document.getElementById('catSlug').value = cat.slug || '';
  document.getElementById('catDesc').value = cat.description || '';
  document.getElementById('catOrder').value = cat.order_index || 0;
  document.getElementById('catImage').value = cat.image_url || '';
  document.getElementById('catActive').checked = !!cat.is_active;
  document.getElementById('catParent').innerHTML = '<option value="">— Kök (Üst Yok) —</option>' +
    cats.filter(function(c){ return c.id !== id; }).map(function(c){
      return '<option value="' + c.id + '"' + (cat.parent_id === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>';
    }).join('');
  document.getElementById('catModal').classList.remove('hidden');
}

document.getElementById('catForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  var id   = document.getElementById('catId').value;
  var name = document.getElementById('catName').value.trim();
  var slug = document.getElementById('catSlug').value.trim() ||
    name.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9\-]/g,'').replace(/ı/g,'i').replace(/ş/g,'s').replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ö/g,'o').replace(/ç/g,'c');
  var body = {
    name: name, slug: slug,
    description: document.getElementById('catDesc').value,
    image_url:   document.getElementById('catImage').value || null,
    parent_id:   document.getElementById('catParent').value || null,
    order_index: parseInt(document.getElementById('catOrder').value) || 0,
    is_active:   document.getElementById('catActive').checked ? 1 : 0
  };
  var r = id
    ? await apiFetch('/api/categories/' + id, { method:'PUT', body:body })
    : await apiFetch('/api/categories', { method:'POST', body:body });
  if (r.ok) { showToast(id ? 'Kategori güncellendi' : 'Kategori eklendi'); closeCatModal(); renderCategories(); }
  else showToast(r.data.error || 'Hata oluştu', false);
});

function closeCatModal() { document.getElementById('catModal').classList.add('hidden'); }
document.getElementById('catModalClose').addEventListener('click', closeCatModal);
document.getElementById('catModalCancelBtn').addEventListener('click', closeCatModal);

async function deleteCategory(id, name) {
  if (!confirm('"' + name + '" kategorisini silmek istiyor musunuz?')) return;
  var r = await apiFetch('/api/categories/' + id, { method:'DELETE' });
  if (r.ok) { showToast('Kategori silindi'); renderCategories(); }
  else showToast(r.data.error || 'Silinemedi', false);
}

/* ══════════════════════════════════
   CATEGORY PRODUCTS (in contentBody)
══════════════════════════════════ */
async function openCatProducts(catId, catName) {
  currentCatId = catId;
  currentCatName = catName;
  setPage('Ürünler — ' + catName, catName,
    '<button class="btn-sm" onclick="renderCategories()" style="margin-right:8px">← Kategoriler</button>' +
    '<button class="btn-add" onclick="openAddCatProduct()">+ Ürün Ekle</button>');
  await loadCatProducts();
}

async function loadCatProducts() {
  setBody('<div class="loading-skeleton"><div class="sk-row sk-wide"></div></div>');
  var r = await apiFetch('/api/categories/' + currentCatId + '/products');
  if (!r.ok) { setBody('<p class="empty-msg">Ürünler yüklenemedi.</p>'); return; }
  var products = r.data;
  if (!Array.isArray(products) || !products.length) {
    setBody('<p class="empty-msg">Bu kategoride henüz ürün yok. <button class="btn-link" onclick="openAddCatProduct()">Ürün ekle</button></p>');
    return;
  }
  var rows = products.map(function(p) {
    var imgHtml = p.image_url
      ? '<img src="' + esc(p.image_url) + '" style="width:40px;height:40px;object-fit:cover;border-radius:6px" onerror="this.style.display=\'none\'">'
      : '<div style="width:40px;height:40px;background:#f1f5f9;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:.65rem">IMG</div>';
    return '<tr>' +
      '<td>' + imgHtml + '</td>' +
      '<td><span class="brand-badge">' + esc(p.brand || '') + '</span></td>' +
      '<td style="font-family:monospace;font-size:.8rem">' + esc(p.stock_code || '') + '</td>' +
      '<td style="font-weight:500">' + esc(p.stock_name) + '</td>' +
      '<td style="color:#64748b;font-size:.82rem;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(p.purpose || '') + '</td>' +
      '<td style="text-align:right">' +
        '<button class="btn-sm btn-edit" onclick="openEditCatProduct(' + p.id + ')">Düzenle</button> ' +
        '<button class="btn-sm btn-del"  onclick="deleteCatProduct(' + p.id + ')">Sil</button>' +
      '</td>' +
    '</tr>';
  }).join('');
  setBody(
    '<div class="section-card"><table class="data-table">' +
      '<thead><tr><th>Görsel</th><th>Marka</th><th>Stok Kodu</th><th>Ürün Adı</th><th>Kullanım Amacı</th><th style="text-align:right">İşlemler</th></tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
    '</table></div>'
  );
}

function openAddCatProduct() {
  document.getElementById('catProdFormTitle').textContent = 'Ürün Ekle';
  document.getElementById('cpfId').value = '';
  document.getElementById('cpfCatId').value = currentCatId;
  document.getElementById('cpfBrand').value = '';
  document.getElementById('cpfCode').value = '';
  document.getElementById('cpfName').value = '';
  document.getElementById('cpfPurpose').value = '';
  document.getElementById('cpfFeatures').value = '';
  document.getElementById('cpfImageUrl').value = '';
  document.getElementById('cpfImgPreview').innerHTML = '';
  document.getElementById('cpfOrder').value = '0';
  document.getElementById('catProdFormModal').classList.remove('hidden');
}

async function openEditCatProduct(pid) {
  var r = await apiFetch('/api/categories/' + currentCatId + '/products');
  if (!r.ok) { showToast('Ürün yüklenemedi', false); return; }
  var p = r.data.find(function(x){ return x.id === pid; });
  if (!p) { showToast('Ürün bulunamadı', false); return; }
  document.getElementById('catProdFormTitle').textContent = 'Ürün Düzenle';
  document.getElementById('cpfId').value = p.id;
  document.getElementById('cpfCatId').value = currentCatId;
  document.getElementById('cpfBrand').value = p.brand || '';
  document.getElementById('cpfCode').value = p.stock_code || '';
  document.getElementById('cpfName').value = p.stock_name || '';
  document.getElementById('cpfPurpose').value = p.purpose || '';
  document.getElementById('cpfFeatures').value = p.features || '';
  document.getElementById('cpfImageUrl').value = p.image_url || '';
  document.getElementById('cpfImgPreview').innerHTML = p.image_url
    ? '<img src="' + esc(p.image_url) + '" style="max-height:80px;border-radius:6px;margin-top:6px">' : '';
  document.getElementById('cpfOrder').value = p.order_index || 0;
  document.getElementById('catProdFormModal').classList.remove('hidden');
}

document.getElementById('catProdForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  var id    = document.getElementById('cpfId').value;
  var catId = document.getElementById('cpfCatId').value;
  var body  = {
    brand:       document.getElementById('cpfBrand').value.trim() || 'ORGAMİK',
    stock_code:  document.getElementById('cpfCode').value.trim(),
    stock_name:  document.getElementById('cpfName').value.trim(),
    purpose:     document.getElementById('cpfPurpose').value.trim(),
    features:    document.getElementById('cpfFeatures').value.trim() || null,
    image_url:   document.getElementById('cpfImageUrl').value.trim() || null,
    order_index: parseInt(document.getElementById('cpfOrder').value) || 0
  };
  if (!body.stock_name) { showToast('Ürün adı zorunludur', false); return; }
  var r = id
    ? await apiFetch('/api/categories/products/' + id, { method:'PUT', body:body })
    : await apiFetch('/api/categories/' + catId + '/products', { method:'POST', body:body });
  if (r.ok) {
    showToast(id ? 'Ürün güncellendi' : 'Ürün eklendi');
    closeCatProdForm();
    await loadCatProducts();
  } else {
    showToast(r.data.error || 'Hata oluştu', false);
  }
});

function closeCatProdForm() { document.getElementById('catProdFormModal').classList.add('hidden'); }
document.getElementById('cpfCloseBtn').addEventListener('click', closeCatProdForm);
document.getElementById('cpfCancelBtn').addEventListener('click', closeCatProdForm);
document.getElementById('cpfMediaPickBtn').addEventListener('click', function() {
  openMediaPicker(function(url) {
    document.getElementById('cpfImageUrl').value = url;
    document.getElementById('cpfImgPreview').innerHTML = '<img src="' + esc(url) + '" style="max-height:80px;border-radius:6px;margin-top:6px">';
  });
});
document.getElementById('cpfImageUrl').addEventListener('input', function() {
  var url = this.value.trim();
  document.getElementById('cpfImgPreview').innerHTML = url
    ? '<img src="' + esc(url) + '" style="max-height:80px;border-radius:6px;margin-top:6px" onerror="this.parentElement.innerHTML=\'\'">' : '';
});

async function deleteCatProduct(pid) {
  if (!confirm('Bu ürünü silmek istiyor musunuz?')) return;
  var r = await apiFetch('/api/categories/products/' + pid, { method:'DELETE' });
  if (r.ok) { showToast('Ürün silindi'); await loadCatProducts(); }
  else showToast(r.data.error || 'Silinemedi', false);
}

/* ══════════════════════════════════
   INQUIRIES
══════════════════════════════════ */
async function renderInquiries() {
  setPage('Sorgular', 'Sorgular', '');
  setBody('<div class="loading-skeleton"><div class="sk-row sk-wide"></div></div>');
  var r = await apiFetch('/api/inquiries');
  if (!r.ok) { setBody('<p class="empty-msg">Sorgular yüklenemedi.</p>'); return; }
  var inqs = r.data;
  if (!inqs.length) { setBody('<p class="empty-msg">Henüz sorgu yok.</p>'); return; }
  var rows = inqs.map(function(i) {
    return '<tr style="cursor:pointer" onclick="openInquiry(' + i.id + ')">' +
      '<td>' + esc(i.name) + '</td>' +
      '<td>' + esc(i.email) + '</td>' +
      '<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(i.product_name || i.message || '') + '</td>' +
      '<td>' + fmtDate(i.created_at) + '</td>' +
      '<td><span class="badge-' + esc(i.status) + '">' + esc(i.status) + '</span></td>' +
      '<td onclick="event.stopPropagation()" style="text-align:right">' +
        '<button class="btn-sm btn-del" onclick="deleteInquiry(' + i.id + ')">Sil</button>' +
      '</td>' +
    '</tr>';
  }).join('');
  setBody(
    '<div class="section-card"><table class="data-table">' +
      '<thead><tr><th>Ad</th><th>E-posta</th><th>Konu</th><th>Tarih</th><th>Durum</th><th></th></tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
    '</table></div>'
  );
  loadBadge();
}

async function openInquiry(id) {
  var r = await apiFetch('/api/inquiries');
  if (!r.ok) return;
  var inq = r.data.find(function(i){ return i.id === id; });
  if (!inq) return;
  document.getElementById('imId').value = inq.id;
  document.getElementById('imStatus').value = inq.status || 'new';
  document.getElementById('imNotes').value = inq.reply || '';
  document.getElementById('inqDetail').innerHTML =
    '<div class="inq-field"><strong>Ad:</strong> ' + esc(inq.name) + '</div>' +
    '<div class="inq-field"><strong>E-posta:</strong> ' + esc(inq.email) + '</div>' +
    '<div class="inq-field"><strong>Telefon:</strong> ' + esc(inq.phone || '—') + '</div>' +
    (inq.product_name ? '<div class="inq-field"><strong>Ürün:</strong> ' + esc(inq.product_name) + '</div>' : '') +
    '<div class="inq-field"><strong>Mesaj:</strong><p style="margin:6px 0 0;white-space:pre-wrap;font-size:.88rem">' + esc(inq.message) + '</p></div>' +
    '<div class="inq-field"><strong>Tarih:</strong> ' + fmtDate(inq.created_at) + '</div>';
  document.getElementById('inqModal').classList.remove('hidden');
}

document.getElementById('inqUpdateForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  var id = document.getElementById('imId').value;
  var r  = await apiFetch('/api/inquiries/' + id, {
    method: 'PUT',
    body: { status: document.getElementById('imStatus').value, reply: document.getElementById('imNotes').value }
  });
  if (r.ok) { showToast('Sorgu güncellendi'); closeInqModal(); renderInquiries(); }
  else showToast(r.data.error || 'Hata', false);
});

function closeInqModal() { document.getElementById('inqModal').classList.add('hidden'); }
document.getElementById('imClose').addEventListener('click', closeInqModal);
document.getElementById('imCancelBtn').addEventListener('click', closeInqModal);

async function deleteInquiry(id) {
  if (!confirm('Bu sorguyu silmek istiyor musunuz?')) return;
  var r = await apiFetch('/api/inquiries/' + id, { method:'DELETE' });
  if (r.ok) { showToast('Sorgu silindi'); renderInquiries(); }
  else showToast(r.data.error || 'Silinemedi', false);
}

/* ══════════════════════════════════
   SALES
══════════════════════════════════ */
async function renderSales() {
  setPage('Satışlar', 'Satışlar', '<button class="btn-add" onclick="openAddSale()">+ Satış Ekle</button>');
  setBody('<div class="loading-skeleton"><div class="sk-row sk-wide"></div></div>');
  var r = await apiFetch('/api/sales');
  if (!r.ok) { setBody('<p class="empty-msg">Satışlar yüklenemedi.</p>'); return; }
  var sales = r.data;
  if (!sales.length) { setBody('<p class="empty-msg">Henüz satış kaydı yok.</p>'); return; }
  var rows = sales.map(function(s) {
    return '<tr>' +
      '<td>' + fmtDate(s.sale_date) + '</td>' +
      '<td>' + esc(s.product_name) + '</td>' +
      '<td style="font-family:monospace;font-size:.8rem">' + esc(s.catalog_no || '') + '</td>' +
      '<td>' + fmt(s.quantity) + '</td>' +
      '<td>' + fmt(s.total_price) + ' ' + esc(s.currency || 'USD') + '</td>' +
      '<td>' + esc(s.customer_name || '') + '</td>' +
      '<td style="text-align:right"><button class="btn-sm btn-del" onclick="deleteSale(' + s.id + ')">Sil</button></td>' +
    '</tr>';
  }).join('');
  setBody(
    '<div class="section-card"><table class="data-table">' +
      '<thead><tr><th>Tarih</th><th>Ürün</th><th>Katalog No</th><th>Miktar</th><th>Toplam</th><th>Müşteri</th><th></th></tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
    '</table></div>'
  );
}

function openAddSale() {
  document.getElementById('smTitle').textContent = 'Satış Ekle';
  document.getElementById('smId').value = '';
  document.getElementById('smProductName').value = '';
  document.getElementById('smCatalog').value = '';
  document.getElementById('smQty').value = '1';
  document.getElementById('smUnitPrice').value = '';
  document.getElementById('smCurrency').value = 'USD';
  document.getElementById('smCustomer').value = '';
  document.getElementById('smCompany').value = '';
  document.getElementById('smCountry').value = 'Turkey';
  document.getElementById('smDate').value = today();
  document.getElementById('smNotes').value = '';
  document.getElementById('saleModal').classList.remove('hidden');
}

document.getElementById('saleForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  var body = {
    product_name:     document.getElementById('smProductName').value.trim(),
    catalog_no:       document.getElementById('smCatalog').value.trim(),
    quantity:         parseInt(document.getElementById('smQty').value),
    unit_price:       parseFloat(document.getElementById('smUnitPrice').value) || 0,
    currency:         document.getElementById('smCurrency').value,
    customer_name:    document.getElementById('smCustomer').value.trim(),
    customer_company: document.getElementById('smCompany').value.trim(),
    country:          document.getElementById('smCountry').value.trim(),
    sale_date:        document.getElementById('smDate').value,
    notes:            document.getElementById('smNotes').value.trim()
  };
  var r = await apiFetch('/api/sales', { method:'POST', body:body });
  if (r.ok) { showToast('Satış kaydedildi'); closeSaleModal(); renderSales(); }
  else showToast(r.data.error || 'Hata', false);
});

function closeSaleModal() { document.getElementById('saleModal').classList.add('hidden'); }
document.getElementById('smClose').addEventListener('click', closeSaleModal);
document.getElementById('smCancelBtn').addEventListener('click', closeSaleModal);

async function deleteSale(id) {
  if (!confirm('Bu satışı silmek istiyor musunuz?')) return;
  var r = await apiFetch('/api/sales/' + id, { method:'DELETE' });
  if (r.ok) { showToast('Satış silindi'); renderSales(); }
  else showToast(r.data.error || 'Silinemedi', false);
}

/* ══════════════════════════════════
   ORDERS
══════════════════════════════════ */
async function renderOrders() {
  setPage('Siparişler', 'Siparişler', '<button class="btn-add" onclick="openAddOrder()">+ Sipariş Ekle</button>');
  setBody('<div class="loading-skeleton"><div class="sk-row sk-wide"></div></div>');
  var r = await apiFetch('/api/orders');
  if (!r.ok) { setBody('<p class="empty-msg">Siparişler yüklenemedi.</p>'); return; }
  var orders = r.data;
  if (!orders.length) { setBody('<p class="empty-msg">Henüz sipariş yok.</p>'); return; }
  var rows = orders.map(function(o) {
    return '<tr>' +
      '<td style="font-family:monospace;font-size:.75rem">' + esc(o.tracking_code) + '</td>' +
      '<td>' + esc(o.customer_name) + '</td>' +
      '<td>' + esc(o.product_name || '') + '</td>' +
      '<td>' + (o.quantity || '—') + '</td>' +
      '<td><span class="badge-status">' + esc(o.status) + '</span></td>' +
      '<td>' + fmtDate(o.created_at) + '</td>' +
      '<td style="text-align:right">' +
        '<button class="btn-sm btn-edit" onclick="openEditOrder(' + o.id + ')">Düzenle</button> ' +
        '<button class="btn-sm btn-del"  onclick="deleteOrder(' + o.id + ')">Sil</button>' +
      '</td>' +
    '</tr>';
  }).join('');
  setBody(
    '<div class="section-card"><table class="data-table">' +
      '<thead><tr><th>Takip Kodu</th><th>Müşteri</th><th>Ürün</th><th>Miktar</th><th>Durum</th><th>Tarih</th><th></th></tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
    '</table></div>'
  );
}

function openAddOrder() {
  document.getElementById('omTitle').textContent = 'Sipariş Ekle';
  document.getElementById('omId').value = '';
  document.getElementById('omCustomerName').value = '';
  document.getElementById('omCompany').value = '';
  document.getElementById('omEmail').value = '';
  document.getElementById('omPhone').value = '';
  document.getElementById('omProductName').value = '';
  document.getElementById('omQuantity').value = '1';
  document.getElementById('omStatus').value = 'received';
  document.getElementById('omStatusNote').value = '';
  document.getElementById('omNotes').value = '';
  document.getElementById('orderModal').classList.remove('hidden');
}

async function openEditOrder(id) {
  var r = await apiFetch('/api/orders');
  if (!r.ok) return;
  var o = r.data.find(function(x){ return x.id === id; });
  if (!o) return;
  document.getElementById('omTitle').textContent = 'Sipariş Düzenle';
  document.getElementById('omId').value = o.id;
  document.getElementById('omCustomerName').value = o.customer_name || '';
  document.getElementById('omCompany').value = o.company || '';
  document.getElementById('omEmail').value = o.customer_email || '';
  document.getElementById('omPhone').value = o.phone || '';
  document.getElementById('omProductName').value = o.product_name || '';
  document.getElementById('omQuantity').value = o.quantity || 1;
  document.getElementById('omStatus').value = o.status || 'received';
  document.getElementById('omStatusNote').value = o.status_note || '';
  document.getElementById('omNotes').value = o.notes || '';
  document.getElementById('orderModal').classList.remove('hidden');
}

document.getElementById('orderForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  var id   = document.getElementById('omId').value;
  var body = {
    customer_name:  document.getElementById('omCustomerName').value.trim(),
    company:        document.getElementById('omCompany').value.trim(),
    customer_email: document.getElementById('omEmail').value.trim(),
    phone:          document.getElementById('omPhone').value.trim(),
    product_name:   document.getElementById('omProductName').value.trim(),
    quantity:       parseInt(document.getElementById('omQuantity').value) || 1,
    status:         document.getElementById('omStatus').value,
    status_note:    document.getElementById('omStatusNote').value.trim(),
    notes:          document.getElementById('omNotes').value.trim()
  };
  var r = id
    ? await apiFetch('/api/orders/' + id, { method:'PUT', body:body })
    : await apiFetch('/api/orders', { method:'POST', body:body });
  if (r.ok) {
    if (!id && r.data.tracking_code) showToast('Sipariş oluşturuldu. Takip: ' + r.data.tracking_code);
    else showToast(id ? 'Sipariş güncellendi' : 'Sipariş oluşturuldu');
    closeOrderModal();
    renderOrders();
  } else {
    showToast(r.data.error || 'Hata', false);
  }
});

function closeOrderModal() { document.getElementById('orderModal').classList.add('hidden'); }
document.getElementById('omClose').addEventListener('click', closeOrderModal);
document.getElementById('omCancelBtn').addEventListener('click', closeOrderModal);

async function deleteOrder(id) {
  if (!confirm('Bu siparişi silmek istiyor musunuz?')) return;
  var r = await apiFetch('/api/orders/' + id, { method:'DELETE' });
  if (r.ok) { showToast('Sipariş silindi'); renderOrders(); }
  else showToast(r.data.error || 'Silinemedi', false);
}

/* ══════════════════════════════════
   STERILITY CODES
══════════════════════════════════ */
async function renderSterility() {
  setPage('Sterilite Kodları', 'Sterilite Kodları', '<button class="btn-add" onclick="openAddSteri()">+ Kod Oluştur</button>');
  setBody('<div class="loading-skeleton"><div class="sk-row sk-wide"></div></div>');
  var r = await apiFetch('/api/sterility');
  if (!r.ok) { setBody('<p class="empty-msg">Sterilite kodları yüklenemedi.</p>'); return; }
  var codes = r.data;
  if (!codes.length) { setBody('<p class="empty-msg">Henüz sterilite kodu oluşturulmamış.</p>'); return; }
  var rows = codes.map(function(c) {
    return '<tr>' +
      '<td style="font-family:monospace;font-size:.82rem;font-weight:600;color:#0A5C8A">' + esc(c.code) + '</td>' +
      '<td>' + esc(c.product_name) + '</td>' +
      '<td style="font-size:.8rem">' + esc(c.catalog_no || '') + '</td>' +
      '<td>' + esc(c.customer || '') + '</td>' +
      '<td>' + fmtDate(c.invoice_date) + '</td>' +
      '<td><span class="res-' + (c.result||'PASS').toLowerCase() + '">' + esc(c.result || 'PASS') + '</span></td>' +
      '<td style="text-align:right">' +
        '<button class="btn-sm" onclick="copyText(\'' + esc(c.code) + '\')">Kopyala</button> ' +
        '<button class="btn-sm btn-del" onclick="deleteSteri(' + c.id + ')">Sil</button>' +
      '</td>' +
    '</tr>';
  }).join('');
  setBody(
    '<div class="section-card"><table class="data-table">' +
      '<thead><tr><th>Kod</th><th>Ürün</th><th>Katalog No</th><th>Müşteri</th><th>Fatura Tarihi</th><th>Sonuç</th><th></th></tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
    '</table></div>'
  );
}

function openAddSteri() {
  document.getElementById('scProduct').value = '';
  document.getElementById('scCatalog').value = '';
  document.getElementById('scBatch').value = '';
  document.getElementById('scCustomer').value = '';
  document.getElementById('scCompany').value = '';
  document.getElementById('scInvoice').value = today();
  document.getElementById('scMfg').value = '';
  document.getElementById('scExpiry').value = '';
  document.getElementById('scNotes').value = '';
  document.getElementById('scResult').value = 'PASS';
  document.getElementById('generatedCodeBox').classList.add('hidden');
  document.getElementById('sterilityModal').classList.remove('hidden');
}

document.getElementById('steriForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  var body = {
    product_name:     document.getElementById('scProduct').value.trim(),
    catalog_no:       document.getElementById('scCatalog').value.trim(),
    batch_no:         document.getElementById('scBatch').value.trim(),
    customer:         document.getElementById('scCustomer').value.trim(),
    customer_company: document.getElementById('scCompany').value.trim(),
    invoice_date:     document.getElementById('scInvoice').value,
    manufacture_date: document.getElementById('scMfg').value,
    expiry_date:      document.getElementById('scExpiry').value,
    notes:            document.getElementById('scNotes').value.trim(),
    result:           document.getElementById('scResult').value
  };
  var r = await apiFetch('/api/sterility', { method:'POST', body:body });
  if (r.ok && r.data.code) {
    document.getElementById('codeDisplay').textContent = r.data.code;
    document.getElementById('generatedCodeBox').classList.remove('hidden');
    showToast('Kod oluşturuldu: ' + r.data.code);
    renderSterility();
  } else {
    showToast(r.data.error || 'Hata', false);
  }
});

function copyCode() { copyText(document.getElementById('codeDisplay').textContent); }

function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function(){ showToast('Kopyalandı'); }).catch(function(){ showToast('Kopyalanamadı', false); });
  } else {
    var ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); showToast('Kopyalandı'); } catch(e){ showToast('Kopyalanamadı', false); }
    document.body.removeChild(ta);
  }
}

function closeSteriModal() { document.getElementById('sterilityModal').classList.add('hidden'); }
document.getElementById('steriClose').addEventListener('click', closeSteriModal);
document.getElementById('steriCancelBtn').addEventListener('click', closeSteriModal);

async function deleteSteri(id) {
  if (!confirm('Bu sterilite kodunu silmek istiyor musunuz?')) return;
  var r = await apiFetch('/api/sterility/' + id, { method:'DELETE' });
  if (r.ok) { showToast('Kod silindi'); renderSterility(); }
  else showToast(r.data.error || 'Silinemedi', false);
}

/* ══════════════════════════════════
   MEDIA
══════════════════════════════════ */
async function renderMedia() {
  setPage('Medya Yönetimi', 'Medya', '');
  setBody('<div class="loading-skeleton"><div class="sk-row sk-wide"></div></div>');
  var r = await apiFetch('/api/upload');
  if (!r.ok) { setBody('<p class="empty-msg">Medya yüklenemedi.</p>'); return; }
  var files = r.data;
  setBody(
    '<div class="section-card" style="margin-bottom:20px">' +
      '<h3 style="margin-bottom:14px">Görsel Yükle</h3>' +
      '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">' +
        '<input type="file" id="mediaUploadInput" accept="image/*,.svg" onchange="uploadMediaFile(this)">' +
        '<span id="mediaUploadStatus" style="font-size:.82rem;color:#64748b"></span>' +
      '</div>' +
    '</div>' +
    '<div class="section-card">' +
      '<h3 style="margin-bottom:14px">Yüklenen Görseller (' + files.length + ')</h3>' +
      (files.length
        ? '<div class="media-grid">' +
          files.map(function(f) {
            return '<div class="media-item">' +
              '<img src="' + esc(f.url) + '" loading="lazy" onerror="this.src=\'\'"/>' +
              '<div class="media-item-foot">' +
                '<span title="' + esc(f.filename) + '" style="font-size:.72rem;color:#64748b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block">' + esc(f.filename.slice(0,20)) + '</span>' +
                '<div style="display:flex;gap:4px;margin-top:4px">' +
                  '<button class="btn-sm" onclick="copyText(\'' + esc(f.url) + '\')">URL</button> ' +
                  '<button class="btn-sm btn-del" onclick="deleteMedia(\'' + esc(f.filename) + '\')">Sil</button>' +
                '</div>' +
              '</div>' +
            '</div>';
          }).join('') + '</div>'
        : '<p class="empty-msg">Henüz yüklü görsel yok.</p>') +
    '</div>'
  );
}

async function uploadMediaFile(input) {
  var file = input.files[0];
  if (!file) return;
  var status = document.getElementById('mediaUploadStatus');
  if (status) status.textContent = 'Yükleniyor...';
  var fd = new FormData();
  fd.append('image', file);
  var r = await apiFetch('/api/upload', { method:'POST', body:fd });
  input.value = '';
  if (r.ok) { showToast('Yüklendi: ' + r.data.url); renderMedia(); }
  else { showToast(r.data.error || 'Yüklenemedi', false); if (status) status.textContent = ''; }
}

async function deleteMedia(filename) {
  if (!confirm('"' + filename + '" dosyasını silmek istiyor musunuz?')) return;
  var r = await apiFetch('/api/upload/' + encodeURIComponent(filename), { method:'DELETE' });
  if (r.ok) { showToast('Dosya silindi'); renderMedia(); }
  else showToast(r.data.error || 'Silinemedi', false);
}

/* ── Media Picker ── */
function openMediaPicker(callback) {
  mediaPickCallback = typeof callback === 'function' ? callback : null;
  document.getElementById('mediaPickerModal').classList.remove('hidden');
  loadMediaPickerGrid();
}

function closeMediaPicker() {
  document.getElementById('mediaPickerModal').classList.add('hidden');
  mediaPickCallback = null;
}

async function loadMediaPickerGrid() {
  var grid = document.getElementById('mpGrid');
  grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:32px;color:#64748b">Yükleniyor...</div>';
  var r = await apiFetch('/api/upload');
  if (!r.ok || !r.data.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:32px;color:#64748b">Henüz görsel yok.</div>';
    return;
  }
  grid.innerHTML = r.data.map(function(f) {
    return '<div onclick="pickMedia(\'' + esc(f.url) + '\')" style="cursor:pointer;border:2px solid transparent;border-radius:8px;overflow:hidden;transition:.15s" onmouseover="this.style.borderColor=\'#0B4F9E\'" onmouseout="this.style.borderColor=\'transparent\'">' +
      '<img src="' + esc(f.url) + '" style="width:100%;aspect-ratio:1;object-fit:cover" loading="lazy"/>' +
      '<div style="padding:4px 6px;font-size:.7rem;color:#64748b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(f.filename) + '</div>' +
    '</div>';
  }).join('');
}

function pickMedia(url) {
  if (mediaPickCallback) mediaPickCallback(url);
  closeMediaPicker();
}

async function mpUploadFile(input) {
  var file = input.files[0];
  if (!file) return;
  var status = document.getElementById('mpUploadStatus');
  if (status) status.textContent = 'Yükleniyor...';
  var fd = new FormData();
  fd.append('image', file);
  var r = await apiFetch('/api/upload', { method:'POST', body:fd });
  input.value = '';
  if (r.ok) {
    if (status) status.textContent = 'Yüklendi!';
    showToast('Görsel yüklendi');
    loadMediaPickerGrid();
    setTimeout(function(){ if (status) status.textContent = ''; }, 2000);
  } else {
    if (status) status.textContent = 'Hata!';
    showToast(r.data.error || 'Yüklenemedi', false);
  }
}

/* ══════════════════════════════════
   CONTENT / Site Settings
══════════════════════════════════ */
async function renderContent() {
  setPage('Site İçeriği', 'İçerik', '');
  setBody('<div class="loading-skeleton"><div class="sk-row sk-wide"></div></div>');
  var r = await apiFetch('/api/content');
  if (!r.ok) { setBody('<p class="empty-msg">İçerik yüklenemedi.</p>'); return; }
  var content = {};
  if (Array.isArray(r.data)) {
    r.data.forEach(function(row){ if(!content[row.section])content[row.section]={}; content[row.section][row.key]=row.value||''; });
  }
  var s = content.site || {};
  var h = content.hero || {};
  setBody(
    '<form id="contentForm" onsubmit="saveContent(event)">' +
    '<div class="section-card" style="margin-bottom:20px">' +
      '<h3 style="margin-bottom:16px">Logo &amp; Site Adı</h3>' +
      '<div class="mfg">' +
        '<label>Logo Görseli</label>' +
        '<div style="display:flex;gap:8px;align-items:center">' +
          '<input type="text" name="site.logo_url" value="' + esc(s.logo_url||'') + '" placeholder="/uploads/logo.png" style="flex:1" id="logoUrlInput" oninput="previewLogo(this.value)">' +
          '<button type="button" class="btn-sm" onclick="openMediaPicker(function(url){document.getElementById(\'logoUrlInput\').value=url;previewLogo(url)})">Medyadan Seç</button>' +
        '</div>' +
        '<div id="logoPreview" style="margin-top:8px">' + (s.logo_url ? '<img src="' + esc(s.logo_url) + '" style="max-height:60px;border-radius:6px">' : '') + '</div>' +
      '</div>' +
      '<div class="mfg"><label>Site Adı</label><input type="text" name="site.site_name" value="' + esc(s.site_name||'') + '" placeholder="Innomed Life Sciences"></div>' +
      '<div class="mfg"><label>Tagline</label><input type="text" name="site.tagline" value="' + esc(s.tagline||'') + '" placeholder="Advanced Life Sciences Solutions"></div>' +
    '</div>' +
    '<div class="section-card" style="margin-bottom:20px">' +
      '<h3 style="margin-bottom:16px">İletişim Bilgileri</h3>' +
      '<div class="mfg"><label>Telefon</label><input type="text" name="site.phone" value="' + esc(s.phone||'') + '" placeholder="+90 212 000 00 00"></div>' +
      '<div class="mfg"><label>E-posta</label><input type="email" name="site.email" value="' + esc(s.email||'') + '" placeholder="info@innomed.com.tr"></div>' +
      '<div class="mfg"><label>Adres</label><input type="text" name="site.address" value="' + esc(s.address||'') + '" placeholder="Istanbul, Turkey"></div>' +
    '</div>' +
    '<div class="section-card" style="margin-bottom:20px">' +
      '<h3 style="margin-bottom:16px">Hero Bölümü</h3>' +
      '<div class="mfg"><label>Başlık</label><input type="text" name="hero.title" value="' + esc(h.title||'') + '"></div>' +
      '<div class="mfg"><label>Alt Başlık</label><textarea name="hero.subtitle" rows="2">' + esc(h.subtitle||'') + '</textarea></div>' +
    '</div>' +
    '<button type="submit" class="btn-primary-a">Kaydet</button>' +
    '</form>'
  );
}

function previewLogo(url) {
  var box = document.getElementById('logoPreview');
  if (!box) return;
  box.innerHTML = url ? '<img src="' + esc(url) + '" style="max-height:60px;border-radius:6px" onerror="this.parentElement.innerHTML=\'\'">' : '';
}

async function saveContent(e) {
  e.preventDefault();
  var form = document.getElementById('contentForm');
  var body = {};
  new FormData(form).forEach(function(val, key) { body[key] = val; });
  var r = await apiFetch('/api/content', { method:'PUT', body:body });
  if (r.ok) showToast('İçerik kaydedildi');
  else showToast(r.data.error || 'Kaydedilemedi', false);
}

/* ══════════════════════════════════
   SETTINGS
══════════════════════════════════ */
function renderSettings() {
  setPage('Ayarlar', 'Ayarlar', '');
  setBody(
    '<div class="section-card" style="max-width:480px">' +
      '<h3 style="margin-bottom:16px">Şifre Değiştir</h3>' +
      '<form id="pwForm" onsubmit="changePassword(event)">' +
        '<div class="mfg"><label>Mevcut Şifre</label><input type="password" id="pwCurrent" required></div>' +
        '<div class="mfg"><label>Yeni Şifre (min. 6 karakter)</label><input type="password" id="pwNew" required minlength="6"></div>' +
        '<div class="mfg"><label>Yeni Şifre (Tekrar)</label><input type="password" id="pwConfirm" required minlength="6"></div>' +
        '<button type="submit" class="btn-primary-a">Şifreyi Güncelle</button>' +
      '</form>' +
    '</div>'
  );
}

async function changePassword(e) {
  e.preventDefault();
  var cur  = document.getElementById('pwCurrent').value;
  var nw   = document.getElementById('pwNew').value;
  var conf = document.getElementById('pwConfirm').value;
  if (nw !== conf) { showToast('Yeni şifreler eşleşmiyor', false); return; }
  var r = await apiFetch('/api/auth/change-password', { method:'POST', body:{ currentPassword:cur, newPassword:nw } });
  if (r.ok) { showToast('Şifre güncellendi'); document.getElementById('pwForm').reset(); }
  else showToast(r.data.error || 'Hata', false);
}

/* ── productModal close (legacy) ── */
document.getElementById('pmClose').addEventListener('click', function(){ document.getElementById('productModal').classList.add('hidden'); });
document.getElementById('pmCancelBtn').addEventListener('click', function(){ document.getElementById('productModal').classList.add('hidden'); });
