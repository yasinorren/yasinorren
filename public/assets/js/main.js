/* Innomed Life Sciences - Main SPA */
(function () {
  'use strict';

  /* ── State ─────────────────────────────────────────── */
  let lang = localStorage.getItem('lang') || 'en';
  let categories = [];
  let siteContent = {};

  /* ── i18n ───────────────────────────────────────────── */
  const T = {
    en: {
      home: 'Home', about: 'About Us', products: 'Products', contact: 'Contact',
      verify: 'Sterility Verification', admin: 'Admin',
      heroTitle: 'Advanced Life Sciences Solutions',
      heroSub: 'Innovative diagnostic products for microbiology, infection control and environmental monitoring.',
      heroCta: 'Explore Products', heroVerify: 'Verify Sterility',
      aboutTitle: 'About Innomed Life Sciences',
      aboutText: 'Innomed Life Sciences is a leading distributor of high-quality microbiological and diagnostic products. We serve clinical laboratories, hospitals, environmental testing facilities and industrial microbiology labs across the region.',
      qualityTitle: 'Quality & Compliance',
      qualityText: 'All products meet strict international quality standards. Our portfolio includes ISO-certified and CE-marked products from world-class manufacturers.',
      contactTitle: 'Get In Touch',
      contactName: 'Full Name', contactEmail: 'Email', contactMsg: 'Message', contactSend: 'Send Message',
      contactSuccess: 'Message sent successfully!',
      verifyTitle: 'Sterility Code Verification',
      verifyPlaceholder: 'Enter code (e.g. INN-STERI-2024-XXXXXXXX)',
      verifyBtn: 'Verify', verifyResult: 'Verification Result',
      codeValid: 'VALID', codeInvalid: 'NOT FOUND',
      productName: 'Product Name', catalogNo: 'Catalog No', batchNo: 'Batch No',
      customer: 'Customer', company: 'Company', invoiceDate: 'Invoice Date',
      mfgDate: 'Manufacture Date', expDate: 'Expiry Date', result: 'Test Result',
      brand: 'Brand', stockCode: 'Stock Code', stockName: 'Product Name', purpose: 'Purpose of Use',
      inquiryTitle: 'Product Inquiry', inquiryName: 'Your Name', inquiryEmail: 'Your Email',
      inquiryMsg: 'Message / Quantity needed', inquirySend: 'Send Inquiry',
      inquirySuccess: 'Inquiry sent!', noProducts: 'No products listed for this category yet.',
      backTop: 'Back to top', allRights: 'All rights reserved.',
      langToggle: 'TR'
    },
    tr: {
      home: 'Ana Sayfa', about: 'Hakkımızda', products: 'Ürünler', contact: 'İletişim',
      verify: 'Sterilite Doğrulama', admin: 'Yönetim',
      heroTitle: 'İleri Yaşam Bilimleri Çözümleri',
      heroSub: 'Mikrobiyoloji, enfeksiyon kontrolü ve çevre izleme için yenilikçi tanısal ürünler.',
      heroCta: 'Ürünleri Keşfet', heroVerify: 'Sterilite Doğrula',
      aboutTitle: 'Innomed Life Sciences Hakkında',
      aboutText: 'Innomed Life Sciences, yüksek kaliteli mikrobiyolojik ve tanısal ürünlerin önde gelen distribütörüdür.',
      qualityTitle: 'Kalite ve Uyumluluk',
      qualityText: 'Tüm ürünler sıkı uluslararası kalite standartlarını karşılar.',
      contactTitle: 'Bize Ulaşın',
      contactName: 'Ad Soyad', contactEmail: 'E-posta', contactMsg: 'Mesaj', contactSend: 'Gönder',
      contactSuccess: 'Mesaj başarıyla gönderildi!',
      verifyTitle: 'Sterilite Kodu Doğrulama',
      verifyPlaceholder: 'Kodu girin (örn: INN-STERI-2024-XXXXXXXX)',
      verifyBtn: 'Doğrula', verifyResult: 'Doğrulama Sonucu',
      codeValid: 'GEÇERLİ', codeInvalid: 'BULUNAMADI',
      productName: 'Ürün Adı', catalogNo: 'Katalog No', batchNo: 'Lot No',
      customer: 'Müşteri', company: 'Şirket', invoiceDate: 'Fatura Tarihi',
      mfgDate: 'Üretim Tarihi', expDate: 'Son Kullanma Tarihi', result: 'Test Sonucu',
      brand: 'Marka', stockCode: 'Stok Kodu', stockName: 'Ürün Adı', purpose: 'Kullanım Amacı',
      inquiryTitle: 'Ürün Sorgusu', inquiryName: 'Adınız', inquiryEmail: 'E-postanız',
      inquiryMsg: 'Mesaj / İhtiyaç duyulan miktar', inquirySend: 'Sorgu Gönder',
      inquirySuccess: 'Sorgu gönderildi!', noProducts: 'Bu kategori için henüz ürün eklenmemiş.',
      backTop: 'Yukarı çık', allRights: 'Tüm hakları saklıdır.',
      langToggle: 'EN'
    }
  };
  const t = (k) => (T[lang] && T[lang][k]) || T.en[k] || k;

  /* ── Router ─────────────────────────────────────────── */
  function navigate(path, push) {
    if (push === undefined) push = true;
    if (push) history.pushState({}, '', path);
    const app = document.getElementById('app');
    if (!app) return;
    app.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    if (path === '/' || path === '') return renderHome(app);
    if (path === '/verify') return renderVerify(app);
    const m = path.match(/^\/category\/(.+)$/);
    if (m) return renderCategory(app, m[1]);
    renderHome(app);
  }

  window.addEventListener('popstate', function() { navigate(location.pathname, false); });

  document.addEventListener('click', function(e) {
    var a = e.target.closest('a[data-spa]');
    if (!a) return;
    e.preventDefault();
    navigate(a.getAttribute('href'));
  });

  /* ── API ─────────────────────────────────────────────── */
  async function api(url) {
    try {
      var r = await fetch(url);
      if (!r.ok) throw new Error(r.status);
      return r.json();
    } catch(err) { return null; }
  }

  /* ── Navigation ──────────────────────────────────────── */
  async function buildNav() {
    var data = await api('/api/categories');
    if (data && data.success) categories = data.categories || [];
    renderNav();
  }

  function renderNav() {
    var nav = document.getElementById('mainNav');
    if (!nav) return;

    var roots = categories.filter(function(c) { return !c.parent_id; });

    var megaCols = roots.map(function(root) {
      var rootSubs = categories.filter(function(c) { return c.parent_id === root.id; });
      var subHtml = rootSubs.map(function(sub) {
        var subSubs = categories.filter(function(c) { return c.parent_id === sub.id; });
        var ssHtml = subSubs.map(function(ss) {
          return '<a href="/category/' + ss.slug + '" data-spa class="mega-subitem">\u21b3 ' + ss.name + '</a>';
        }).join('');
        return '<a href="/category/' + sub.slug + '" data-spa class="mega-item">' + sub.name + '</a>' + ssHtml;
      }).join('');
      return '<div class="mega-col"><a href="/category/' + root.slug + '" data-spa class="mega-heading">' + root.name + '</a>' + subHtml + '</div>';
    }).join('');

    nav.innerHTML =
      '<a href="/" data-spa class="nav-link">' + t('home') + '</a>' +
      '<div class="nav-dropdown">' +
        '<button class="nav-link dropdown-toggle">' + t('products') + ' <span class="chevron">\u25be</span></button>' +
        '<div class="mega-menu" id="megaMenu">' + megaCols + '</div>' +
      '</div>' +
      '<a href="/verify" data-spa class="nav-link">' + t('verify') + '</a>' +
      '<a href="/#contact" class="nav-link">' + t('contact') + '</a>' +
      '<button id="langBtn" class="lang-btn" onclick="window.__toggleLang()">' + t('langToggle') + '</button>' +
      '<a href="/admin/" class="btn btn-sm btn-outline-nav">' + t('admin') + '</a>';

    bindDropdown();
  }

  function bindDropdown() {
    var toggle = document.querySelector('.dropdown-toggle');
    var mega = document.getElementById('megaMenu');
    if (!toggle || !mega) return;
    toggle.addEventListener('click', function(e) {
      e.stopPropagation();
      mega.classList.toggle('open');
    });
    document.addEventListener('click', function() { mega.classList.remove('open'); });
    mega.addEventListener('click', function(e) { e.stopPropagation(); });
  }

  /* ── Home Page ───────────────────────────────────────── */
  function renderHome(app) {
    var roots = categories.filter(function(c) { return !c.parent_id; });
    var c = siteContent;

    var categoryCards = roots.map(function(cat) {
      var imgHtml = cat.image_url
        ? '<img src="' + cat.image_url + '" alt="' + cat.name + '" loading="lazy">'
        : '<div class="cat-placeholder"><span>\ud83d\udd2c</span></div>';
      return '<a href="/category/' + cat.slug + '" data-spa class="category-card">' +
        imgHtml +
        '<div class="cat-card-body"><h3>' + cat.name + '</h3><p>' + (cat.description || '') + '</p><span class="cat-link">View Products \u2192</span></div>' +
        '</a>';
    }).join('');

    app.innerHTML =
      '<section class="hero">' +
        '<div class="hero-bg"></div>' +
        '<div class="container hero-content">' +
          '<div class="hero-badge">Life Sciences &amp; Diagnostics</div>' +
          '<h1>' + ((c.hero && c.hero.title) || t('heroTitle')) + '</h1>' +
          '<p>' + ((c.hero && c.hero.subtitle) || t('heroSub')) + '</p>' +
          '<div class="hero-actions">' +
            '<button class="btn btn-primary" onclick="document.getElementById(\'categories\').scrollIntoView({behavior:\'smooth\'})">' + t('heroCta') + '</button>' +
            '<a href="/verify" data-spa class="btn btn-outline">' + t('heroVerify') + '</a>' +
          '</div>' +
        '</div>' +
      '</section>' +

      '<section class="stats-bar">' +
        '<div class="container stats-grid">' +
          '<div class="stat"><strong>7+</strong><span>Product Categories</span></div>' +
          '<div class="stat"><strong>200+</strong><span>Products</span></div>' +
          '<div class="stat"><strong>ISO</strong><span>Certified</span></div>' +
          '<div class="stat"><strong>CE</strong><span>Marked</span></div>' +
        '</div>' +
      '</section>' +

      '<section class="about-section" id="about">' +
        '<div class="container about-grid">' +
          '<div class="about-text">' +
            '<span class="section-label">Who We Are</span>' +
            '<h2>' + ((c.about && c.about.title) || t('aboutTitle')) + '</h2>' +
            '<p>' + ((c.about && c.about.text) || t('aboutText')) + '</p>' +
            '<ul class="about-features">' +
              '<li><i>\u2713</i> Clinical &amp; Industrial Microbiology</li>' +
              '<li><i>\u2713</i> Environmental Control Products</li>' +
              '<li><i>\u2713</i> COVID-19 Diagnostics</li>' +
              '<li><i>\u2713</i> Water Quality Testing</li>' +
            '</ul>' +
          '</div>' +
          '<div class="about-image">' +
            '<div class="about-img-placeholder"></div>' +
            '<div class="about-badge"><strong>20+</strong><span>Years Exp.</span></div>' +
          '</div>' +
        '</div>' +
      '</section>' +

      '<section class="categories-section" id="categories">' +
        '<div class="container">' +
          '<span class="section-label">Our Portfolio</span>' +
          '<h2>Product Categories</h2>' +
          '<p class="section-sub">Comprehensive solutions for every laboratory need</p>' +
          '<div class="categories-grid">' + (categoryCards || '<p>Loading...</p>') + '</div>' +
        '</div>' +
      '</section>' +

      '<section class="quality-section">' +
        '<div class="container quality-grid">' +
          '<div class="quality-content">' +
            '<span class="section-label">Standards</span>' +
            '<h2>' + ((c.quality && c.quality.title) || t('qualityTitle')) + '</h2>' +
            '<p>' + ((c.quality && c.quality.text) || t('qualityText')) + '</p>' +
            '<div class="cert-badges">' +
              '<span class="cert-badge">ISO 13485</span>' +
              '<span class="cert-badge">CE Mark</span>' +
              '<span class="cert-badge">GMP</span>' +
            '</div>' +
          '</div>' +
          '<div class="quality-icon"><div class="quality-circle"><span>\u2713</span><small>Quality Assured</small></div></div>' +
        '</div>' +
      '</section>' +

      '<section class="verify-cta">' +
        '<div class="container">' +
          '<h2>Verify Product Sterility</h2>' +
          '<p>Check the validity of any Innomed sterility certificate online.</p>' +
          '<a href="/verify" data-spa class="btn btn-primary">' + t('heroVerify') + '</a>' +
        '</div>' +
      '</section>' +

      '<section class="contact-section" id="contact">' +
        '<div class="container contact-grid">' +
          '<div class="contact-info">' +
            '<span class="section-label">Contact</span>' +
            '<h2>' + t('contactTitle') + '</h2>' +
            '<div class="contact-details">' +
              '<div class="contact-item"><i>\ud83d\udccd</i><span>' + ((c.contact && c.contact.address) || 'Istanbul, Turkey') + '</span></div>' +
              '<div class="contact-item"><i>\ud83d\udcde</i><span>' + ((c.contact && c.contact.phone) || '+90 212 000 0000') + '</span></div>' +
              '<div class="contact-item"><i>\u2709</i><span>' + ((c.contact && c.contact.email) || 'info@innomed.com.tr') + '</span></div>' +
            '</div>' +
          '</div>' +
          '<form class="contact-form" id="contactForm">' +
            '<div class="form-group"><input type="text" name="name" placeholder="' + t('contactName') + '" required></div>' +
            '<div class="form-group"><input type="email" name="email" placeholder="' + t('contactEmail') + '" required></div>' +
            '<div class="form-group"><textarea name="message" rows="5" placeholder="' + t('contactMsg') + '" required></textarea></div>' +
            '<button type="submit" class="btn btn-primary btn-full">' + t('contactSend') + '</button>' +
            '<div id="contactMsg" class="form-success" style="display:none">' + t('contactSuccess') + '</div>' +
          '</form>' +
        '</div>' +
      '</section>';

    bindContactForm();
  }

  /* ── Category Page ───────────────────────────────────── */
  async function renderCategory(app, slug) {
    var cat = categories.find(function(c) { return c.slug === slug; });
    var catName = cat ? cat.name : slug;
    var catDesc = cat ? (cat.description || '') : '';
    var subCats = cat ? categories.filter(function(c) { return c.parent_id === cat.id; }) : [];
    var breadcrumb = buildBreadcrumb(cat);

    var products = [];
    if (cat) {
      var data = await api('/api/categories/' + cat.id + '/products');
      if (data && data.success) products = data.products || [];
    }

    var subHtml = '';
    if (subCats.length > 0) {
      subHtml = '<div class="sub-categories"><h3>Sub-categories</h3><div class="sub-cat-grid">' +
        subCats.map(function(sc) {
          return '<a href="/category/' + sc.slug + '" data-spa class="sub-cat-card">' +
            (sc.image_url ? '<img src="' + sc.image_url + '" alt="' + sc.name + '">' : '') +
            '<span>' + sc.name + '</span></a>';
        }).join('') +
        '</div></div>';
    }

    var productsHtml = '';
    if (products.length > 0) {
      var rows = products.map(function(p, i) {
        return '<tr><td>' + (i+1) + '</td>' +
          '<td><span class="brand-badge">' + (p.brand || '-') + '</span></td>' +
          '<td class="code-cell">' + (p.stock_code || '-') + '</td>' +
          '<td>' + (p.stock_name || '-') + '</td>' +
          '<td class="purpose-cell">' + (p.purpose || '-') + '</td>' +
          '<td><button class="btn btn-sm btn-inquiry" onclick="window.__openInquiry(\'' + escHtml(p.stock_name) + '\',\'' + escHtml(p.stock_code) + '\')">Inquire</button></td>' +
          '</tr>';
      }).join('');
      productsHtml = '<div class="products-section">' +
        '<h3>Products <span class="count-badge">' + products.length + '</span></h3>' +
        '<div class="table-wrapper"><table class="products-table">' +
        '<thead><tr><th>#</th><th>' + t('brand') + '</th><th>' + t('stockCode') + '</th><th>' + t('stockName') + '</th><th>' + t('purpose') + '</th><th>Inquiry</th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table></div></div>';
    } else if (subCats.length === 0) {
      productsHtml = '<p class="no-products">' + t('noProducts') + '</p>';
    }

    app.innerHTML =
      '<div class="page-hero category-hero">' +
        '<div class="container">' +
          '<nav class="breadcrumb">' + breadcrumb + '</nav>' +
          '<h1>' + catName + '</h1>' +
          (catDesc ? '<p>' + catDesc + '</p>' : '') +
        '</div>' +
      '</div>' +
      '<div class="container category-body">' + subHtml + productsHtml + '</div>';
  }

  function buildBreadcrumb(cat) {
    if (!cat) return '<a href="/" data-spa>Home</a>';
    var crumbs = [];
    var cur = cat;
    while (cur) {
      crumbs.unshift('<a href="/category/' + cur.slug + '" data-spa>' + cur.name + '</a>');
      cur = categories.find(function(c) { return c.id === cur.parent_id; });
    }
    return '<a href="/" data-spa>Home</a> \u203a ' + crumbs.join(' \u203a ');
  }

  /* ── Sterility Verify Page ───────────────────────────── */
  function renderVerify(app) {
    app.innerHTML =
      '<div class="page-hero verify-hero">' +
        '<div class="container">' +
          '<h1>' + t('verifyTitle') + '</h1>' +
          '<p>Enter your sterility code to check product certification status.</p>' +
        '</div>' +
      '</div>' +
      '<div class="container verify-body">' +
        '<div class="verify-card">' +
          '<div class="verify-input-group">' +
            '<input type="text" id="verifyInput" placeholder="' + t('verifyPlaceholder') + '" class="verify-input">' +
            '<button class="btn btn-primary" onclick="window.__doVerify()">' + t('verifyBtn') + '</button>' +
          '</div>' +
          '<div id="verifyResult"></div>' +
        '</div>' +
        '<div class="verify-info">' +
          '<h3>About Sterility Verification</h3>' +
          '<p>Each certificate carries a unique code in the format <code>INN-STERI-YYYY-XXXXXXXX</code>.</p>' +
          '<ul>' +
            '<li>Codes are generated at time of invoice</li>' +
            '<li>Each code is unique and tied to a specific batch</li>' +
            '<li>Verification is available 24/7 online</li>' +
          '</ul>' +
        '</div>' +
      '</div>';

    var input = document.getElementById('verifyInput');
    if (input) input.addEventListener('keydown', function(e) { if (e.key === 'Enter') window.__doVerify(); });
  }

  window.__doVerify = async function() {
    var input = document.getElementById('verifyInput');
    var result = document.getElementById('verifyResult');
    if (!input || !result) return;
    var code = input.value.trim().toUpperCase();
    if (!code) return;
    result.innerHTML = '<div class="verify-loading"><div class="spinner"></div></div>';
    var data = await api('/api/sterility/verify/' + encodeURIComponent(code));
    if (data && data.success && data.code) {
      var c = data.code;
      result.innerHTML =
        '<div class="verify-success">' +
          '<div class="verify-status valid"><span class="status-icon">\u2713</span> ' + t('codeValid') + '</div>' +
          '<div class="verify-details">' +
            '<div class="detail-row"><strong>' + t('productName') + ':</strong><span>' + (c.product_name || '-') + '</span></div>' +
            '<div class="detail-row"><strong>' + t('catalogNo') + ':</strong><span>' + (c.catalog_no || '-') + '</span></div>' +
            '<div class="detail-row"><strong>' + t('batchNo') + ':</strong><span>' + (c.batch_no || '-') + '</span></div>' +
            '<div class="detail-row"><strong>' + t('customer') + ':</strong><span>' + (c.customer_name || '-') + '</span></div>' +
            '<div class="detail-row"><strong>' + t('company') + ':</strong><span>' + (c.customer_company || '-') + '</span></div>' +
            '<div class="detail-row"><strong>' + t('invoiceDate') + ':</strong><span>' + (c.invoice_date || '-') + '</span></div>' +
            '<div class="detail-row"><strong>' + t('mfgDate') + ':</strong><span>' + (c.manufacture_date || '-') + '</span></div>' +
            '<div class="detail-row"><strong>' + t('expDate') + ':</strong><span>' + (c.expiry_date || '-') + '</span></div>' +
            '<div class="detail-row"><strong>' + t('result') + ':</strong><span class="result-badge ' + (c.test_result||'pass').toLowerCase() + '">' + (c.test_result || 'PASS') + '</span></div>' +
          '</div>' +
          (c.notes ? '<div class="verify-notes"><strong>Notes:</strong> ' + c.notes + '</div>' : '') +
        '</div>';
    } else {
      result.innerHTML =
        '<div class="verify-fail">' +
          '<div class="verify-status invalid"><span class="status-icon">\u2717</span> ' + t('codeInvalid') + '</div>' +
          '<p>The code <strong>' + escHtml(code) + '</strong> was not found. Please check and try again.</p>' +
        '</div>';
    }
  };

  /* ── Inquiry Modal ───────────────────────────────────── */
  window.__openInquiry = function(productName, stockCode) {
    var modal = document.getElementById('inquiryModal');
    if (!modal) return;
    var nameEl = document.getElementById('modalProductName');
    if (nameEl) nameEl.textContent = productName + (stockCode ? ' (' + stockCode + ')' : '');
    var hiddenName = document.getElementById('inqProductName');
    if (hiddenName) hiddenName.value = productName + (stockCode ? ' (' + stockCode + ')' : '');
    modal.classList.remove('hidden');
  };

  function initInquiryModal() {
    var modal = document.getElementById('inquiryModal');
    if (!modal) return;
    var closeBtn = document.getElementById('modalClose');
    var form = document.getElementById('inquiryForm');
    if (closeBtn) closeBtn.addEventListener('click', function() { modal.classList.add('hidden'); });
    modal.addEventListener('click', function(e) { if (e.target === modal) modal.classList.add('hidden'); });
    if (form) {
      form.addEventListener('submit', async function(e) {
        e.preventDefault();
        var data = Object.fromEntries(new FormData(form));
        var productInfo = document.getElementById('modalProductName') ? document.getElementById('modalProductName').textContent : '';
        try {
          await fetch('/api/inquiries', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: data.customer_name, email: data.customer_email, message: 'Product: ' + productInfo + '\n' + data.message, type: 'product' })
          });
          form.reset();
          var msg = document.getElementById('inqOk');
          if (msg) { msg.classList.remove('hidden'); setTimeout(function() { msg.classList.add('hidden'); modal.classList.add('hidden'); }, 3000); }
        } catch(err) { /* silent */ }
      });
    }
  }

  /* ── Contact Form ────────────────────────────────────── */
  function bindContactForm() {
    var form = document.getElementById('contactForm');
    if (!form) return;
    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      var data = Object.fromEntries(new FormData(form));
      try {
        var r = await fetch('/api/inquiries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: data.name, email: data.email, message: data.message, type: 'contact' })
        });
        if (r.ok) {
          form.reset();
          var msg = document.getElementById('contactMsg');
          if (msg) { msg.style.display = 'block'; setTimeout(function() { msg.style.display = 'none'; }, 5000); }
        }
      } catch(err) { /* silent */ }
    });
  }

  /* ── Language Toggle ─────────────────────────────────── */
  window.__toggleLang = function() {
    lang = lang === 'en' ? 'tr' : 'en';
    localStorage.setItem('lang', lang);
    buildNav();
    navigate(location.pathname, false);
    buildFooter();
  };

  /* ── Footer ──────────────────────────────────────────── */
  function buildFooter() {
    var footer = document.getElementById('siteFooter');
    if (!footer) return;
    var roots = categories.filter(function(c) { return !c.parent_id; });
    var c = siteContent;

    footer.innerHTML =
      '<div class="footer-inner container">' +
        '<div class="footer-brand">' +
          '<img src="/uploads/logo.png" alt="Innomed" onerror="this.style.display=\'none\'" style="height:40px;margin-bottom:8px">' +
          '<strong>Innomed Life Sciences</strong>' +
          '<p>Advanced diagnostic and microbiological solutions.</p>' +
        '</div>' +
        '<div class="footer-links">' +
          '<strong>Products</strong>' +
          '<ul>' + roots.slice(0,7).map(function(cat) {
            return '<li><a href="/category/' + cat.slug + '" data-spa>' + cat.name + '</a></li>';
          }).join('') + '</ul>' +
        '</div>' +
        '<div class="footer-links">' +
          '<strong>Company</strong>' +
          '<ul>' +
            '<li><a href="/#about">About Us</a></li>' +
            '<li><a href="/verify" data-spa>Sterility Verify</a></li>' +
            '<li><a href="/#contact">Contact</a></li>' +
            '<li><a href="/admin/">Admin</a></li>' +
          '</ul>' +
        '</div>' +
        '<div class="footer-contact">' +
          '<strong>Contact</strong>' +
          '<p>' + ((c.contact && c.contact.address) || 'Istanbul, Turkey') + '</p>' +
          '<p>' + ((c.contact && c.contact.phone) || '') + '</p>' +
          '<p>' + ((c.contact && c.contact.email) || '') + '</p>' +
        '</div>' +
      '</div>' +
      '<div class="footer-bottom"><div class="container">' +
        '<span>\u00a9 ' + new Date().getFullYear() + ' Innomed Life Sciences. ' + t('allRights') + '</span>' +
      '</div></div>';
  }

  /* ── Scroll Effects ──────────────────────────────────── */
  function initScrollEffects() {
    var btn = document.getElementById('backTop');
    var navbar = document.querySelector('.navbar');
    window.addEventListener('scroll', function() {
      if (btn) { btn.classList.toggle('show', window.scrollY > 400); btn.classList.toggle('visible', window.scrollY > 400); }
      if (navbar) navbar.classList.toggle('scrolled', window.scrollY > 50);
    });
    if (btn) btn.addEventListener('click', function() { window.scrollTo({ top: 0, behavior: 'smooth' }); });
  }

  /* ── Mobile Nav ──────────────────────────────────────── */
  function initMobileNav() {
    var toggle = document.getElementById('hamburger');
    var overlay = document.getElementById('mobileNav');
    if (toggle && overlay) {
      toggle.addEventListener('click', function() { overlay.classList.toggle('hidden'); });
    }
    if (overlay) {
      overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.classList.add('hidden'); });
    }
  }

  /* ── Load Content ────────────────────────────────────── */
  async function loadContent() {
    var data = await api('/api/content');
    if (data && data.success) siteContent = data.content || {};
  }

  /* ── Util ────────────────────────────────────────────── */
  function escHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ── Init ────────────────────────────────────────────── */
  async function init() {
    await Promise.all([loadContent(), buildNav()]);
    buildFooter();
    navigate(location.pathname, false);
    initScrollEffects();
    initInquiryModal();
    initMobileNav();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
