/* Innomed Life Sciences - Main SPA */
(function () {
  'use strict';

  var lang = localStorage.getItem('lang') || 'en';
  var categories = [];
  var siteContent = {};

  /* ── Translations ── */
  var T = {
    en: {
      home:'Home', products:'Products', verify:'Sterility Verify', contact:'Contact', track:'Track Order',
      heroTitle:'Advanced Life Sciences Solutions',
      heroSub:'Innovative diagnostic products for microbiology, infection control and environmental monitoring.',
      heroCta:'Explore Products', heroVerify:'Verify Sterility Certificate',
      aboutTitle:'About Innomed Life Sciences',
      aboutText:'Innomed Life Sciences is a leading distributor of high-quality microbiological and diagnostic products. We serve clinical laboratories, hospitals, environmental testing facilities and industrial microbiology labs.',
      qualityTitle:'Quality & Compliance',
      qualityText:'All products meet strict international quality standards. Our portfolio includes ISO-certified and CE-marked products from world-class manufacturers.',
      contactTitle:'Get In Touch',
      contactName:'Full Name', contactEmail:'Email Address', contactMsg:'Your Message',
      contactSend:'Send Message', contactSuccess:'Message sent! We will get back to you shortly.',
      verifyTitle:'Sterility Code Verification',
      verifyPlaceholder:'Enter code — e.g. INN-STERI-2024-XXXXXXXX',
      verifyBtn:'Verify Code', codeValid:'VALID', codeInvalid:'CODE NOT FOUND',
      trackTitle:'Order Tracking', trackPlaceholder:'Enter tracking code — e.g. INN-ORD-2024-XXXXXXXX',
      trackBtn:'Track Order', trackFound:'Order Found', trackNotFound:'Order not found',
      brand:'Brand', stockCode:'Stock Code', stockName:'Product Name', purpose:'Purpose of Use', inquire:'Inquire',
      noProducts:'No products listed for this category yet.',
      allRights:'All rights reserved.', langToggle:'TR'
    },
    tr: {
      home:'Ana Sayfa', products:'Ürünler', verify:'Sterilite Doğrulama', contact:'İletişim', track:'Sipariş Takip',
      heroTitle:'İleri Yaşam Bilimleri Çözümleri',
      heroSub:'Mikrobiyoloji, enfeksiyon kontrolü ve çevre izleme için yenilikçi tanısal ürünler.',
      heroCta:'Ürünleri İncele', heroVerify:'Sterilite Sertifikası Doğrula',
      aboutTitle:'Innomed Life Sciences Hakkında',
      aboutText:'Innomed Life Sciences, yüksek kaliteli mikrobiyolojik ve tanısal ürünlerin önde gelen distribütörüdür.',
      qualityTitle:'Kalite ve Uyumluluk',
      qualityText:'Tüm ürünler sıkı uluslararası kalite standartlarını karşılar.',
      contactTitle:'Bize Ulaşın',
      contactName:'Ad Soyad', contactEmail:'E-posta Adresi', contactMsg:'Mesajınız',
      contactSend:'Gönder', contactSuccess:'Mesajınız iletildi!',
      verifyTitle:'Sterilite Kodu Doğrulama',
      verifyPlaceholder:'Kodu girin — örn: INN-STERI-2024-XXXXXXXX',
      verifyBtn:'Doğrula', codeValid:'GEÇERLİ', codeInvalid:'KOD BULUNAMADI',
      trackTitle:'Sipariş Takip', trackPlaceholder:'Takip kodu girin — örn: INN-ORD-2024-XXXXXXXX',
      trackBtn:'Takip Et', trackFound:'Sipariş Bulundu', trackNotFound:'Sipariş bulunamadı',
      brand:'Marka', stockCode:'Stok Kodu', stockName:'Ürün Adı', purpose:'Kullanım Amacı', inquire:'Teklif Al',
      noProducts:'Bu kategori için henüz ürün eklenmemiş.',
      allRights:'Tüm hakları saklıdır.', langToggle:'EN'
    }
  };
  function t(k) { return (T[lang] && T[lang][k]) || T.en[k] || k; }

  /* ── Router ── */
  function navigate(path, push) {
    if (push === undefined) push = true;
    if (push) history.pushState({}, '', path);
    window.scrollTo(0, 0);
    var app = document.getElementById('app');
    if (!app) return;
    app.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    if (path === '/' || path === '') { renderHome(app); return; }
    if (path === '/verify') { renderVerify(app); return; }
    if (path === '/track') { renderTrack(app); return; }
    var m = path.match(/^\/category\/(.+)$/);
    if (m) { renderCategory(app, m[1]); return; }
    renderHome(app);
  }

  window.addEventListener('popstate', function () { navigate(location.pathname, false); });

  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[data-spa]');
    if (!a) return;
    e.preventDefault();
    var href = a.getAttribute('href');
    if (href.startsWith('/#')) {
      navigate('/', false);
      history.pushState({}, '', href);
      setTimeout(function () {
        var id = href.slice(2);
        var el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 200);
      return;
    }
    navigate(href);
  });

  /* ── API ── */
  async function api(url) {
    try {
      var r = await fetch(url);
      if (!r.ok) return null;
      return r.json();
    } catch (e) { return null; }
  }

  /* ── Build Navbar ── */
  async function buildNav() {
    var data = await api('/api/categories');
    if (Array.isArray(data)) {
      /* API returns nested tree — flatten it */
      categories = [];
      function flatten(arr) {
        arr.forEach(function (c) {
          var kids = c.children || [];
          delete c.children;
          categories.push(c);
          if (kids.length) flatten(kids);
        });
      }
      flatten(data);
    }
    renderNav();
    buildMobileNav();
  }

  function renderNav() {
    var nav = document.getElementById('mainNav');
    if (!nav) return;

    var roots = categories.filter(function (c) { return !c.parent_id; });

    /* Mega-menu columns */
    var cols = roots.map(function (root) {
      var subs = categories.filter(function (c) { return c.parent_id === root.id; });
      var subHtml = subs.map(function (sub) {
        var subsubs = categories.filter(function (c) { return c.parent_id === sub.id; });
        var ssHtml = subsubs.map(function (ss) {
          return '<a href="/category/' + ss.slug + '" data-spa class="mega-subitem">\u21b3 ' + esc(ss.name) + '</a>';
        }).join('');
        return '<a href="/category/' + sub.slug + '" data-spa class="mega-item">' + esc(sub.name) + '</a>' + ssHtml;
      }).join('');
      return '<div class="mega-col"><a href="/category/' + root.slug + '" data-spa class="mega-heading">' + esc(root.name) + '</a>' + subHtml + '</div>';
    }).join('');

    nav.innerHTML =
      '<a href="/" data-spa class="nl">' + t('home') + '</a>' +
      '<div class="nl-drop">' +
        '<button class="nl nl-btn" id="prodToggle">' + t('products') + ' <span class="arr">&#9660;</span></button>' +
        '<div class="mega-menu" id="megaMenu">' + (cols || '<p style="padding:16px;color:#888">Loading...</p>') + '</div>' +
      '</div>' +
      '<a href="/verify" data-spa class="nl">' + t('verify') + '</a>' +
      '<a href="/track" data-spa class="nl">' + t('track') + '</a>' +
      '<a href="/#contact" data-spa class="nl">' + t('contact') + '</a>' +
      '<button class="lang-btn" onclick="window.__toggleLang()">' + t('langToggle') + '</button>';

    /* Dropdown toggle */
    var btn = document.getElementById('prodToggle');
    var menu = document.getElementById('megaMenu');
    if (btn && menu) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        menu.classList.toggle('open');
      });
    }
    document.addEventListener('click', function () {
      if (menu) menu.classList.remove('open');
    });
    if (menu) menu.addEventListener('click', function (e) { e.stopPropagation(); });
  }

  function buildMobileNav() {
    var container = document.getElementById('mobileNavLinks');
    if (!container) return;
    var roots = categories.filter(function (c) { return !c.parent_id; });
    var html = '<a href="/" data-spa class="mob-link">' + t('home') + '</a>';
    roots.forEach(function (root) {
      html += '<a href="/category/' + root.slug + '" data-spa class="mob-link">' + esc(root.name) + '</a>';
      var subs = categories.filter(function (c) { return c.parent_id === root.id; });
      subs.forEach(function (sub) {
        html += '<a href="/category/' + sub.slug + '" data-spa class="mob-link mob-sub">\u2014 ' + esc(sub.name) + '</a>';
      });
    });
    html += '<a href="/verify" data-spa class="mob-link">' + t('verify') + '</a>';
    html += '<a href="/track" data-spa class="mob-link">' + t('track') + '</a>';
    html += '<a href="/#contact" data-spa class="mob-link">' + t('contact') + '</a>';
    container.innerHTML = html;
  }

  /* ── Home Page ── */
  function renderHome(app) {
    var roots = categories.filter(function (c) { return !c.parent_id; });
    var c = siteContent;

    var cards = roots.map(function (cat) {
      var img = cat.image_url
        ? '<img src="' + esc(cat.image_url) + '" alt="' + esc(cat.name) + '" loading="lazy">'
        : '<div class="cat-icon">&#128300;</div>';
      return '<a href="/category/' + cat.slug + '" data-spa class="category-card">' +
        img +
        '<div class="cat-card-body"><h3>' + esc(cat.name) + '</h3>' +
        '<p>' + esc(cat.description || '') + '</p>' +
        '<span class="cat-link">View Products &#8594;</span>' +
        '</div></a>';
    }).join('');

    var heroBgStyle = (c.hero && c.hero.bg_image)
      ? ' style="background:url(\'' + esc(c.hero.bg_image) + '\') center/cover no-repeat,linear-gradient(135deg,#071624 0%,#0C2740 50%,#0A4878 100%)"'
      : '';

    app.innerHTML =
      /* HERO */
      '<section class="hero"' + heroBgStyle + '>' +
        '<div class="hero-bg-overlay"></div>' +
        '<div class="container" style="position:relative;z-index:2;padding-top:80px;padding-bottom:80px">' +
          '<div class="hero-badge">&#128300; Life Sciences &amp; Diagnostics</div>' +
          '<h1 class="hero-title">' + ((c.hero && c.hero.title_line1) ? (c.hero.title_line1 + (c.hero.title_line2 ? ' ' + c.hero.title_line2 : '')) : t('heroTitle')) + '</h1>' +
          '<p class="hero-desc">' + ((c.hero && (c.hero.desc || c.hero.subtitle)) || t('heroSub')) + '</p>' +
          '<div class="hero-btns">' +
            '<button class="btn btn-primary" onclick="document.getElementById(\'categories-sec\').scrollIntoView({behavior:\'smooth\'})">' + t('heroCta') + '</button>' +
            '<a href="/verify" data-spa class="btn btn-ghost">' + t('heroVerify') + '</a>' +
          '</div>' +
        '</div>' +
      '</section>' +

      /* STATS */
      '<div class="stats-bar"><div class="container stats-row">' +
        '<div class="stat-item"><strong>7+</strong><span>Product Categories</span></div>' +
        '<div class="stat-sep"></div>' +
        '<div class="stat-item"><strong>200+</strong><span>Products</span></div>' +
        '<div class="stat-sep"></div>' +
        '<div class="stat-item"><strong>ISO</strong><span>Certified</span></div>' +
        '<div class="stat-sep"></div>' +
        '<div class="stat-item"><strong>CE</strong><span>Marked</span></div>' +
      '</div></div>' +

      /* ABOUT */
      '<section class="section about-section" id="about">' +
        '<div class="container about-grid">' +
          '<div class="about-text">' +
            '<span class="section-label">Who We Are</span>' +
            '<h2>' + ((c.about && c.about.title_line1) ? (c.about.title_line1 + (c.about.title_line2 ? ' ' + c.about.title_line2 : '')) : t('aboutTitle')) + '</h2>' +
            '<p>' + ((c.about && (c.about.p1 || c.about.text)) || t('aboutText')) + '</p>' +
            '<ul class="about-checks">' +
              '<li>&#10003; Clinical &amp; Industrial Microbiology</li>' +
              '<li>&#10003; Environmental Control Products</li>' +
              '<li>&#10003; COVID-19 Diagnostics</li>' +
              '<li>&#10003; Water Quality Testing (AquaSamp)</li>' +
            '</ul>' +
          '</div>' +
          '<div class="about-visual">' +
            '<div class="about-visual-inner">' +
              '<div class="av-top"><span class="av-num">20+</span><span class="av-lbl">Years of Experience</span></div>' +
              '<div class="av-grid">' +
                '<div class="av-card"><div class="av-icon">&#128300;</div><span>Microbiology</span></div>' +
                '<div class="av-card"><div class="av-icon">&#128138;</div><span>Diagnostics</span></div>' +
                '<div class="av-card"><div class="av-icon">&#127774;</div><span>Environment</span></div>' +
                '<div class="av-card"><div class="av-icon">&#128167;</div><span>AquaSamp</span></div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</section>' +

      /* CATEGORIES */
      '<section class="section categories-section" id="categories-sec">' +
        '<div class="container">' +
          '<span class="section-label">Our Portfolio</span>' +
          '<h2 style="font-size:clamp(1.8rem,3.5vw,2.4rem);margin:10px 0 12px">Product Categories</h2>' +
          '<p style="color:#5A7184;margin-bottom:48px">Comprehensive solutions for every laboratory need</p>' +
          '<div class="categories-grid">' + (cards || '<p style="color:#888">Loading categories...</p>') + '</div>' +
        '</div>' +
      '</section>' +

      /* QUALITY */
      '<section class="section quality-section">' +
        '<div class="container quality-grid">' +
          '<div class="quality-text">' +
            '<span class="section-label section-label-light">Standards</span>' +
            '<h2 style="font-size:clamp(1.8rem,3.5vw,2.4rem);color:#fff;margin:10px 0 14px">' + ((c.quality && c.quality.title) || t('qualityTitle')) + '</h2>' +
            '<p style="color:rgba(255,255,255,.65);line-height:1.8;margin-bottom:28px">' + ((c.quality && c.quality.text) || t('qualityText')) + '</p>' +
            '<div class="cert-row">' +
              '<span class="cert-badge">ISO 13485</span>' +
              '<span class="cert-badge">CE Mark</span>' +
              '<span class="cert-badge">GMP</span>' +
              '<span class="cert-badge">FDA Listed</span>' +
            '</div>' +
          '</div>' +
          '<div class="quality-circle-wrap">' +
            '<div class="quality-circle"><div>&#10003;</div><small>Quality Assured</small></div>' +
          '</div>' +
        '</div>' +
      '</section>' +

      /* VERIFY CTA */
      '<section class="verify-cta-section">' +
        '<div class="container" style="text-align:center">' +
          '<h2 style="font-size:clamp(1.6rem,3vw,2.2rem);color:#fff;margin-bottom:12px">Verify Product Sterility</h2>' +
          '<p style="color:rgba(255,255,255,.8);margin-bottom:32px">Check any Innomed sterility certificate online — available 24/7.</p>' +
          '<a href="/verify" data-spa class="btn btn-white">Verify Certificate</a>' +
        '</div>' +
      '</section>' +

      /* CONTACT */
      '<section class="section contact-section" id="contact">' +
        '<div class="container contact-grid">' +
          '<div class="contact-info">' +
            '<span class="section-label">Contact</span>' +
            '<h2 style="font-size:clamp(1.6rem,3vw,2.2rem);margin:10px 0 20px">' + t('contactTitle') + '</h2>' +
            '<div class="contact-items">' +
              '<div class="contact-item"><span class="ci-icon">&#128205;</span><span>' + ((c.contact && c.contact.address) || 'Istanbul, Turkey') + '</span></div>' +
              '<div class="contact-item"><span class="ci-icon">&#128222;</span><span>' + ((c.contact && c.contact.phone) || '+90 212 000 0000') + '</span></div>' +
              '<div class="contact-item"><span class="ci-icon">&#9993;</span><span>' + ((c.contact && c.contact.email) || 'info@innomed.com.tr') + '</span></div>' +
            '</div>' +
          '</div>' +
          '<form class="contact-form" id="contactForm">' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">' +
              '<div class="fg"><label>' + t('contactName') + ' *</label><input type="text" name="customer_name" required></div>' +
              '<div class="fg"><label>' + t('contactEmail') + ' *</label><input type="email" name="customer_email" required></div>' +
            '</div>' +
            '<div class="fg" style="margin-bottom:14px"><label>' + t('contactMsg') + ' *</label><textarea name="message" rows="5" required></textarea></div>' +
            '<button type="submit" class="btn btn-primary" style="width:100%;justify-content:center">' + t('contactSend') + '</button>' +
            '<div id="contactMsg" style="display:none;margin-top:12px;padding:12px 16px;background:rgba(0,137,123,.08);border:1px solid rgba(0,137,123,.2);border-radius:8px;color:#00897B;font-size:.88rem">' + t('contactSuccess') + '</div>' +
            '<div id="contactMsgErr" style="display:none;margin-top:12px;padding:12px 16px;background:rgba(220,53,69,.08);border:1px solid rgba(220,53,69,.2);border-radius:8px;color:#DC3545;font-size:.88rem">An error occurred. Please try again.</div>' +
          '</form>' +
        '</div>' +
      '</section>';

    bindContactForm();
  }

  /* ── Category Page ── */
  async function renderCategory(app, slug) {
    var cat = categories.find(function (c) { return c.slug === slug; });
    if (!cat) {
      /* Try to load categories first if empty */
      if (categories.length === 0) {
        var d = await api('/api/categories');
        if (Array.isArray(d)) { categories = []; (function fl(arr){arr.forEach(function(c){var k=c.children||[];delete c.children;categories.push(c);if(k.length)fl(k);})})(d); renderNav(); buildMobileNav(); buildFooter(); }
        cat = categories.find(function (c) { return c.slug === slug; });
      }
    }

    var catName = cat ? cat.name : slug;
    var catDesc = cat ? (cat.description || '') : '';
    var subCats = cat ? categories.filter(function (c) { return c.parent_id === cat.id; }) : [];
    var crumb = buildCrumb(cat);

    /* Use slug endpoint — returns {products:[...], children:[...], ...} */
    var products = [];
    var catData = null;
    if (slug) {
      catData = await api('/api/categories/' + encodeURIComponent(slug));
      if (catData && catData.id) {
        products = catData.products || [];
        /* Also sync local sub-cats from response if available */
        if (catData.children && catData.children.length) {
          subCats = catData.children;
        }
      }
    }

    var subHtml = '';
    if (subCats.length > 0) {
      subHtml = '<div class="sub-categories">' +
        '<h3 style="margin-bottom:18px;font-size:1.1rem">Sub-categories</h3>' +
        '<div class="sub-cat-grid">' +
        subCats.map(function (sc) {
          return '<a href="/category/' + sc.slug + '" data-spa class="sub-cat-card">' +
            (sc.image_url ? '<img src="' + esc(sc.image_url) + '" alt="' + esc(sc.name) + '">' : '<div class="sub-cat-icon">&#128300;</div>') +
            '<span>' + esc(sc.name) + '</span></a>';
        }).join('') +
        '</div></div>';
    }

    var hasImages = products.some(function(p){ return p.image_url; });
    var hasFeatures = products.some(function(p){ return p.features; });
    var useCards = hasImages || hasFeatures;

    var tableHtml = '';
    if (products.length > 0) {
      if (useCards) {
        var cards = products.map(function (p) {
          var featuresHtml = '';
          if (p.features) {
            var lines = p.features.split('\n').map(function(l){ return l.trim(); }).filter(function(l){ return l.length > 0; });
            if (lines.length > 0) {
              featuresHtml = '<ul class="prod-features">' + lines.map(function(l){ return '<li>' + esc(l) + '</li>'; }).join('') + '</ul>';
            }
          }
          var imgHtml = p.image_url
            ? '<div class="prod-card-img"><img src="' + esc(p.image_url) + '" alt="' + esc(p.stock_name) + '" loading="lazy" onerror="this.parentElement.style.display=\'none\'"></div>'
            : '';
          return '<div class="prod-card">' +
            imgHtml +
            '<div class="prod-card-body">' +
              '<div class="prod-card-top">' +
                '<span class="brand-badge">' + esc(p.brand || '-') + '</span>' +
                (p.stock_code ? '<span class="prod-code">' + esc(p.stock_code) + '</span>' : '') +
              '</div>' +
              '<div class="prod-card-name">' + esc(p.stock_name || '-') + '</div>' +
              (p.purpose ? '<div class="prod-card-purpose">' + esc(p.purpose) + '</div>' : '') +
              featuresHtml +
              '<button class="btn-inq" onclick="window.__openInquiry(\'' + esc(p.stock_name) + '\',\'' + esc(p.stock_code) + '\')">' + t('inquire') + '</button>' +
            '</div>' +
          '</div>';
        }).join('');
        tableHtml = '<div class="products-section">' +
          '<h3 style="margin-bottom:16px;font-size:1.1rem">Ürünler <span class="count-badge">' + products.length + '</span></h3>' +
          '<div class="prod-card-grid">' + cards + '</div></div>';
      } else {
        var rows = products.map(function (p, i) {
          return '<tr>' +
            '<td style="color:#888;font-size:.8rem">' + (i + 1) + '</td>' +
            '<td><span class="brand-badge">' + esc(p.brand || '-') + '</span></td>' +
            '<td style="font-family:monospace;font-size:.82rem;color:#5A7184">' + esc(p.stock_code || '-') + '</td>' +
            '<td style="font-weight:500">' + esc(p.stock_name || '-') + '</td>' +
            '<td style="color:#5A7184;font-size:.85rem">' + esc(p.purpose || '-') + '</td>' +
            '<td><button class="btn-inq" onclick="window.__openInquiry(\'' + esc(p.stock_name) + '\',\'' + esc(p.stock_code) + '\')">' + t('inquire') + '</button></td>' +
            '</tr>';
        }).join('');
        tableHtml = '<div class="products-section">' +
          '<h3 style="margin-bottom:16px;font-size:1.1rem">Ürünler <span class="count-badge">' + products.length + '</span></h3>' +
          '<div class="table-wrapper"><table class="products-table">' +
          '<thead><tr><th>#</th><th>' + t('brand') + '</th><th>' + t('stockCode') + '</th><th>' + t('stockName') + '</th><th>' + t('purpose') + '</th><th></th></tr></thead>' +
          '<tbody>' + rows + '</tbody></table></div></div>';
      }
    } else if (subCats.length === 0) {
      tableHtml = '<p class="no-products">' + t('noProducts') + '</p>';
    }

    app.innerHTML =
      '<div class="page-hero">' +
        '<div class="container">' +
          '<nav class="breadcrumb">' + crumb + '</nav>' +
          '<h1 style="font-size:clamp(1.8rem,4vw,2.8rem);color:#fff;margin:10px 0 10px">' + esc(catName) + '</h1>' +
          (catDesc ? '<p style="color:rgba(255,255,255,.7);font-size:1rem">' + esc(catDesc) + '</p>' : '') +
        '</div>' +
      '</div>' +
      '<div class="container" style="padding-top:52px;padding-bottom:80px">' +
        subHtml + tableHtml +
      '</div>';
  }

  function buildCrumb(cat) {
    var parts = ['<a href="/" data-spa style="color:rgba(255,255,255,.6)">Home</a>'];
    var chain = [];
    var cur = cat;
    while (cur) {
      chain.unshift(cur);
      cur = categories.find(function (c) { return c.id === cur.parent_id; });
    }
    chain.forEach(function (c) {
      parts.push('<a href="/category/' + c.slug + '" data-spa style="color:rgba(255,255,255,.6)">' + esc(c.name) + '</a>');
    });
    return parts.join(' <span style="color:rgba(255,255,255,.3)">&rsaquo;</span> ');
  }

  /* ── Verify Page ── */
  function renderVerify(app) {
    app.innerHTML =
      '<div class="page-hero">' +
        '<div class="container">' +
          '<h1 style="font-size:clamp(1.8rem,4vw,2.6rem);color:#fff;margin-bottom:10px">' + t('verifyTitle') + '</h1>' +
          '<p style="color:rgba(255,255,255,.7)">Enter your sterility code to check product certification status.</p>' +
        '</div>' +
      '</div>' +
      '<div class="container" style="padding-top:52px;padding-bottom:80px">' +
        '<div class="verify-card">' +
          '<div class="verify-search">' +
            '<input type="text" id="verifyInput" placeholder="' + t('verifyPlaceholder') + '" class="verify-input">' +
            '<button class="btn btn-primary" onclick="window.__doVerify()">' + t('verifyBtn') + '</button>' +
          '</div>' +
          '<div id="verifyResult"></div>' +
        '</div>' +
        '<div class="verify-info-box">' +
          '<h3>About Sterility Verification</h3>' +
          '<p>Each certificate carries a unique code in the format <code>INN-STERI-YYYY-XXXXXXXX</code>.</p>' +
          '<ul><li>Codes are generated at time of invoice</li><li>Each code is tied to a specific product batch</li><li>Verification available 24/7</li></ul>' +
        '</div>' +
      '</div>';

    var inp = document.getElementById('verifyInput');
    if (inp) inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') window.__doVerify(); });
  }

  window.__doVerify = async function () {
    var inp = document.getElementById('verifyInput');
    var res = document.getElementById('verifyResult');
    if (!inp || !res) return;
    var code = inp.value.trim().toUpperCase();
    if (!code) return;
    res.innerHTML = '<div style="text-align:center;padding:24px"><div class="spinner" style="margin:0 auto"></div></div>';
    var data = await api('/api/sterility/verify/' + encodeURIComponent(code));
    if (data && data.valid) {
      var c = data; /* record is spread into response */
      res.innerHTML =
        '<div class="verify-result valid">' +
          '<div class="vr-status ok"><span>&#10003;</span> ' + t('codeValid') + '</div>' +
          '<div class="vr-table">' +
            vrow('Product', c.product_name) +
            vrow('Catalog No', c.catalog_no) +
            vrow('Batch No', c.batch_no) +
            vrow('Customer', c.customer_name) +
            vrow('Company', c.customer_company) +
            vrow('Invoice Date', c.invoice_date) +
            vrow('Manufacture Date', c.manufacture_date) +
            vrow('Expiry Date', c.expiry_date) +
            vrow('Test Result', '<span class="res-' + (c.test_result||'pass').toLowerCase() + '">' + (c.test_result||'PASS') + '</span>') +
          '</div>' +
          (c.notes ? '<div style="margin-top:14px;padding:12px;background:#f5f9fc;border-radius:8px;font-size:.87rem;color:#5A7184"><strong>Notes:</strong> ' + esc(c.notes) + '</div>' : '') +
        '</div>';
    } else {
      res.innerHTML =
        '<div class="verify-result invalid">' +
          '<div class="vr-status fail"><span>&#10007;</span> ' + t('codeInvalid') + '</div>' +
          '<p style="color:#5A7184;margin-top:10px">The code <strong>' + esc(code) + '</strong> was not found. Please check and try again.</p>' +
        '</div>';
    }
  };

  function vrow(label, val) {
    return '<div class="vr-row"><strong>' + label + '</strong><span>' + (val || '-') + '</span></div>';
  }

  /* ── Track Order Page ── */
  function renderTrack(app) {
    app.innerHTML =
      '<div class="page-hero">' +
        '<div class="container">' +
          '<h1 style="font-size:clamp(1.8rem,4vw,2.6rem);color:#fff;margin-bottom:10px">' + t('trackTitle') + '</h1>' +
          '<p style="color:rgba(255,255,255,.7)">Enter your tracking code to see the current status of your order.</p>' +
        '</div>' +
      '</div>' +
      '<div class="container" style="padding-top:52px;padding-bottom:80px">' +
        '<div class="verify-card">' +
          '<div class="verify-search">' +
            '<input type="text" id="trackInput" placeholder="' + t('trackPlaceholder') + '" class="verify-input">' +
            '<button class="btn btn-primary" onclick="window.__doTrack()">' + t('trackBtn') + '</button>' +
          '</div>' +
          '<div id="trackResult"></div>' +
        '</div>' +
        '<div class="verify-info-box">' +
          '<h3>About Order Tracking</h3>' +
          '<p>Each order receives a unique tracking code in the format <code>INN-ORD-YYYY-XXXXXXXX</code>.</p>' +
          '<ul><li>Tracking code is provided at the time of order placement</li><li>Track your order status at any time, 24/7</li><li>Contact us if you need further assistance</li></ul>' +
        '</div>' +
      '</div>';

    var inp = document.getElementById('trackInput');
    if (inp) inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') window.__doTrack(); });
    var params = new URLSearchParams(location.search);
    var code = params.get('code');
    if (code && inp) { inp.value = code; window.__doTrack(); }
  }

  var trackStatusLabels = {
    en: { received:'Received', processing:'Processing', preparing:'Preparing', shipped:'Shipped', delivered:'Delivered', cancelled:'Cancelled' },
    tr: { received:'Alındı', processing:'İşleme Alındı', preparing:'Hazırlanıyor', shipped:'Kargoya Verildi', delivered:'Teslim Edildi', cancelled:'İptal Edildi' }
  };

  window.__doTrack = async function () {
    var inp = document.getElementById('trackInput');
    var res = document.getElementById('trackResult');
    if (!inp || !res) return;
    var code = inp.value.trim().toUpperCase();
    if (!code) return;
    res.innerHTML = '<div style="text-align:center;padding:24px"><div class="spinner" style="margin:0 auto"></div></div>';
    var data = await api('/api/orders/track/' + encodeURIComponent(code));
    var lbl = trackStatusLabels[lang] || trackStatusLabels.en;
    if (data && data.tracking_code) {
      var steps = ['received','processing','preparing','shipped','delivered'];
      var cancelled = data.status === 'cancelled';
      var curIdx = steps.indexOf(data.status);

      var timelineHtml;
      if (cancelled) {
        timelineHtml = '<div style="margin:20px 0;padding:14px 18px;background:rgba(198,40,40,.06);border:1px solid rgba(198,40,40,.2);border-radius:8px;color:#C62828;font-weight:600;text-align:center">&#10007; ' + lbl.cancelled + '</div>';
      } else {
        timelineHtml = '<div style="display:flex;align-items:center;margin:24px 0;overflow-x:auto;padding:4px 0">' +
          steps.map(function(s, i) {
            var done = i <= curIdx;
            var active = i === curIdx;
            var dotStyle = done
              ? 'width:28px;height:28px;border-radius:50%;background:' + (active ? '#0A5C8A' : '#26C6DA') + ';color:#fff;display:flex;align-items:center;justify-content:center;font-size:.8rem;font-weight:700;flex-shrink:0'
              : 'width:28px;height:28px;border-radius:50%;background:#e8ecef;color:#9BA8B4;display:flex;align-items:center;justify-content:center;font-size:.8rem;font-weight:700;flex-shrink:0';
            var labelStyle = 'font-size:.72rem;margin-top:5px;text-align:center;font-weight:' + (active ? '700' : '400') + ';color:' + (done ? '#0A5C8A' : '#9BA8B4');
            var lineStyle = 'flex:1;height:2px;background:' + (i < curIdx ? '#26C6DA' : '#e8ecef') + ';min-width:20px;margin:0 2px;flex-shrink:0';
            var item = '<div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0">' +
              '<div style="' + dotStyle + '">' + (done ? '&#10003;' : (i + 1)) + '</div>' +
              '<div style="' + labelStyle + '">' + esc(lbl[s] || s) + '</div>' +
              '</div>';
            return item + (i < steps.length - 1 ? '<div style="' + lineStyle + ';margin-bottom:18px"></div>' : '');
          }).join('') +
        '</div>';
      }

      res.innerHTML =
        '<div class="verify-result valid">' +
          '<div class="vr-status ok"><span>&#128230;</span> ' + t('trackFound') + '</div>' +
          timelineHtml +
          '<div class="vr-table">' +
            vrow((lang === 'tr' ? 'Takip Kodu' : 'Tracking Code'), esc(data.tracking_code)) +
            vrow((lang === 'tr' ? 'Müşteri' : 'Customer'), esc(data.customer_name)) +
            vrow((lang === 'tr' ? 'Ürün' : 'Product'), esc(data.product_name)) +
            vrow((lang === 'tr' ? 'Miktar' : 'Quantity'), data.quantity) +
            (data.status_note ? vrow((lang === 'tr' ? 'Durum Notu' : 'Status Note'), esc(data.status_note)) : '') +
          '</div>' +
        '</div>';
    } else {
      res.innerHTML =
        '<div class="verify-result invalid">' +
          '<div class="vr-status fail"><span>&#10007;</span> ' + t('trackNotFound') + '</div>' +
          '<p style="color:#5A7184;margin-top:10px">The code <strong>' + esc(code) + '</strong> was not found. Please check and try again.</p>' +
        '</div>';
    }
  };

  /* ── Inquiry Modal ── */
  window.__openInquiry = function (name, code) {
    var modal = document.getElementById('inquiryModal');
    var el = document.getElementById('modalProductName');
    if (el) el.textContent = name + (code ? ' (' + code + ')' : '');
    if (modal) modal.style.display = 'flex';
  };

  function initInquiryModal() {
    var modal = document.getElementById('inquiryModal');
    var close = document.getElementById('modalClose');
    var form = document.getElementById('inquiryForm');
    if (close) close.addEventListener('click', function () { modal.style.display = 'none'; });
    if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) modal.style.display = 'none'; });
    if (form) {
      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        var fd = new FormData(form);
        var productLabel = document.getElementById('modalProductName') ? document.getElementById('modalProductName').textContent : '';
        try {
          var r = await fetch('/api/inquiries', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              customer_name: String(fd.get('customer_name') || '').slice(0, 200),
              customer_email: String(fd.get('customer_email') || '').slice(0, 200),
              message: ('Product: ' + productLabel + '\n' + String(fd.get('message') || '')).slice(0, 2000),
              subject: 'Product Inquiry'
            })
          });
          if (r.ok) {
            form.reset();
            var ok = document.getElementById('inqOk');
            if (ok) {
              ok.style.display = 'block';
              setTimeout(function () { ok.style.display = 'none'; modal.style.display = 'none'; }, 3000);
            }
          } else {
            var errEl = document.getElementById('inqErr');
            if (errEl) { errEl.style.display = 'block'; setTimeout(function () { errEl.style.display = 'none'; }, 4000); }
          }
        } catch (err) {
          var errEl2 = document.getElementById('inqErr');
          if (errEl2) { errEl2.style.display = 'block'; setTimeout(function () { errEl2.style.display = 'none'; }, 4000); }
        }
      });
    }
  }

  /* ── Contact Form ── */
  function bindContactForm() {
    var form = document.getElementById('contactForm');
    if (!form) return;
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var fd = new FormData(form);
      try {
        var r = await fetch('/api/inquiries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer_name: String(fd.get('customer_name') || '').slice(0, 200),
            customer_email: String(fd.get('customer_email') || '').slice(0, 200),
            message: String(fd.get('message') || '').slice(0, 2000),
            subject: 'Contact Form'
          })
        });
        var msg = document.getElementById('contactMsg');
        var msgErr = document.getElementById('contactMsgErr');
        if (r.ok) {
          form.reset();
          if (msg) { msg.style.display = 'block'; setTimeout(function () { msg.style.display = 'none'; }, 5000); }
        } else {
          if (msgErr) { msgErr.style.display = 'block'; setTimeout(function () { msgErr.style.display = 'none'; }, 5000); }
        }
      } catch (err) {
        var msgErr2 = document.getElementById('contactMsgErr');
        if (msgErr2) { msgErr2.style.display = 'block'; setTimeout(function () { msgErr2.style.display = 'none'; }, 5000); }
      }
    });
  }

  /* ── Language Toggle ── */
  window.__toggleLang = function () {
    lang = lang === 'en' ? 'tr' : 'en';
    localStorage.setItem('lang', lang);
    buildNav();
    buildMobileNav();
    buildFooter();
    navigate(location.pathname, false);
  };

  /* ── Footer ── */
  function buildFooter() {
    var footer = document.getElementById('siteFooter');
    if (!footer) return;
    var roots = categories.filter(function (c) { return !c.parent_id; });
    var c = siteContent;

    var c = siteContent;
    var siteName = (c.nav && c.nav.site_name) || 'INNOMED';
    var logoHtml = (c.nav && c.nav.logo_url)
      ? '<img src="' + esc(c.nav.logo_url) + '" alt="Logo" style="height:32px;width:auto;object-fit:contain">'
      : '<svg width="32" height="32" viewBox="0 0 38 38"><circle cx="19" cy="19" r="19" fill="#0A5C8A"/><path d="M11 28L19 10L27 28" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><line x1="14" y1="22" x2="24" y2="22" stroke="white" stroke-width="2.5" stroke-linecap="round"/><circle cx="19" cy="10" r="2.8" fill="#26C6DA"/></svg>';

    footer.innerHTML =
      '<div class="footer-main container">' +
        '<div class="footer-brand">' +
          '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">' +
            logoHtml +
            '<strong style="font-size:1.05rem;color:#fff;font-family:Sora,sans-serif">' + esc(siteName) + '</strong>' +
          '</div>' +
          '<p style="font-size:.85rem;color:rgba(255,255,255,.45);line-height:1.7">Advanced diagnostic and<br>microbiological solutions.</p>' +
        '</div>' +
        '<div class="footer-col">' +
          '<strong>Products</strong>' +
          '<ul>' + roots.slice(0, 7).map(function (cat) {
            return '<li><a href="/category/' + cat.slug + '" data-spa>' + esc(cat.name) + '</a></li>';
          }).join('') + '</ul>' +
        '</div>' +
        '<div class="footer-col">' +
          '<strong>Company</strong>' +
          '<ul>' +
            '<li><a href="/#about" data-spa>About Us</a></li>' +
            '<li><a href="/verify" data-spa>Sterility Verify</a></li>' +
            '<li><a href="/track" data-spa>Track Order</a></li>' +
            '<li><a href="/#contact" data-spa>Contact</a></li>' +
          '</ul>' +
        '</div>' +
        '<div class="footer-col">' +
          '<strong>Contact</strong>' +
          '<p>' + ((c.contact && c.contact.address) || 'Istanbul, Turkey') + '</p>' +
          '<p>' + ((c.contact && c.contact.phone) || '') + '</p>' +
          '<p>' + ((c.contact && c.contact.email) || '') + '</p>' +
        '</div>' +
      '</div>' +
      '<div class="footer-bottom">' +
        '<div class="container" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">' +
          '<span style="font-size:.8rem;color:rgba(255,255,255,.3)">&copy; ' + new Date().getFullYear() + ' Innomed Life Sciences. ' + t('allRights') + '</span>' +
          '<a href="/admin/" style="font-size:.78rem;color:rgba(255,255,255,.3);transition:.2s" onmouseover="this.style.color=\'#26C6DA\'" onmouseout="this.style.color=\'rgba(255,255,255,.3)\'">Admin Panel</a>' +
        '</div>' +
      '</div>';
  }

  /* ── Scroll / Back-to-top ── */
  function initScroll() {
    var btn = document.getElementById('backTop');
    var navbar = document.getElementById('navbar');
    window.addEventListener('scroll', function () {
      if (btn) btn.classList.toggle('visible', window.scrollY > 400);
      if (navbar) navbar.classList.toggle('scrolled', window.scrollY > 60);
    });
    if (btn) btn.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
  }

  /* ── Mobile Nav ── */
  function initMobileNav() {
    var toggle = document.getElementById('hamburger');
    var drawer = document.getElementById('mobileDrawer');
    var close = document.getElementById('drawerClose');
    if (toggle && drawer) toggle.addEventListener('click', function () { drawer.classList.toggle('open'); });
    if (close && drawer) close.addEventListener('click', function () { drawer.classList.remove('open'); });
    if (drawer) drawer.addEventListener('click', function (e) { if (e.target === drawer) drawer.classList.remove('open'); });
  }

  /* ── Load Content ── */
  async function loadContent() {
    var d = await api('/api/content');
    if (d && typeof d === 'object' && !Array.isArray(d) && !d.error) siteContent = d;
  }

  /* ── Apply branding from site content (logo, site name) ── */
  function applyBranding() {
    var c = siteContent;
    if (!c) return;
    var wrap = document.getElementById('logoImgWrap');
    if (wrap && c.nav && c.nav.logo_url) {
      wrap.innerHTML = '<img src="' + esc(c.nav.logo_url) + '" alt="Logo" style="height:36px;width:auto;object-fit:contain;display:block">';
    }
    var nameEl = document.getElementById('siteNameText');
    if (nameEl && c.nav && c.nav.site_name) nameEl.textContent = c.nav.site_name;
    var tagEl = document.getElementById('siteTaglineText');
    if (tagEl && c.nav && c.nav.site_tagline) tagEl.textContent = c.nav.site_tagline;
  }

  /* ── Utility ── */
  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ── Init ── */
  async function init() {
    await Promise.all([loadContent(), buildNav()]);
    applyBranding();
    buildFooter();
    navigate(location.pathname, false);
    initScroll();
    initInquiryModal();
    initMobileNav();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
