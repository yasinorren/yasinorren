/* ================================================================
   INNOMED LIFE SCIENCES v2 — MAIN JS (i18n + API + UI)
   ================================================================ */

/* ── i18n Translations ── */
const T = {
  tr: {
    'nav.about':'Hakkımızda','nav.products':'Ürünler','nav.helicomed':'HelicoMed','nav.quality':'Kalite','nav.contact':'İletişim','nav.admin':'Admin',
    'hero.badge':'ISO 14644-1 & EU GMP Sınıf C Onaylı Üretim',
    'hero.title':'Hazır Mikrobiyoloji<br/><span class="hl">Besiyeri Üreticisi</span>',
    'hero.desc':'Klinik tanı, endüstriyel mikrobiyoloji ve çevre kontrol uygulamaları için CE işaretli ve farmakope uyumlu hazır besiyerleri. İlaç, gıda, kozmetik ve sağlık sektörlerine küresel tedarik.',
    'hero.cta1':'Ürün Kataloğu','hero.cta2':'Teklif İsteyin',
    'hero.m1':'Yıllık Deneyim','hero.m2':'Ürün Formülasyonu','hero.m3':'Ülkeye İhracat','hero.m4':'Müşteri Memnuniyeti',
    'about.label':'Hakkımızda','about.card1.title':'Hazır Besiyeri Üreticisi','about.card1.text':'Tam otomatik dolum hatları ve onaylı temiz oda tesisleri',
    'about.facility':'Üretim Alanı','about.cleanroom':'Temiz Oda Sınıfı',
    'about.title':'Hazır Kültür Besiyerinde<br/><span class="grad-text">Küresel Standart</span>',
    'about.p1':'Innomed Life Sciences, İlaç, kozmetik, su ve gıda sektörleri dahil olmak üzere pek çok endüstriye hazır mikrobiyolojik kültür besiyeri üreten İstanbul merkezli bir üretim şirketidir.',
    'about.p2':'Şirketler daha verimli iş akışı sağlamaya ve maliyeti minimize etmeye çalıştıkça, hazır kullanıma sunulan yüksek kaliteli besiyerlerine olan talep her sektörde artış göstermektedir.',
    'about.f1t':'Tam Otomatik Üretim Hatları','about.f1s':'Modern dolum ve paketleme ekipmanları ile hassas üretim',
    'about.f2t':'Onaylı Temiz Oda Tesisleri','about.f2s':'ISO 14644-1 ve EU GMP Class C onaylı üretim ortamı',
    'about.f3t':'Çoklu Format Seçenekleri','about.f3s':'Petri, şişe, tüp ve torba formatında üretim kapasitesi',
    'about.f4t':'Farmakope Uyumluluğu','about.f4s':'USP, EP ve JP standartlarına tam uyumluluk',
    'about.cta':'Teknik Bilgi Alın',
    'products.label':'Ürün Portföyü',
    'products.title':'Kapsamlı <span class="grad-text">Ürün Gamımız</span>',
    'products.desc':'Klinik tanı, endüstriyel test ve çevre kontrolü için uluslararası standartlara uygun hazır besiyerleri.',
    'products.search':'Ürün ara...','products.all':'Tümü','products.clinical':'Klinik Mikrobiyoloji',
    'products.industrial':'Endüstriyel Mikrobiyoloji','products.environment':'Çevre Kontrolü','products.helicomed':'HelicoMed',
    'products.loading':'Ürünler yükleniyor...','products.noResult':'Arama kriterlerine uygun ürün bulunamadı.',
    'products.inquire':'Sorgula','products.available':'Stokta Var','products.limited':'Sınırlı Stok','products.out_of_stock':'Stok Dışı',
    'hm.badge':'Öne Çıkan Ürün','hm.title':'HelicoMed Plus —<br/><span class="grad-text">H. pylori Hızlı Üreaz Testi</span>',
    'hm.desc':'Mide mukoza biyopsilerinde <em>Helicobacter pylori</em> tespitinde altın standart. Eski agar jel bazlı testlere kıyasla önemli iyileştirmeler sunan gelişmiş formül.',
    'hm.s1':'Sonuç Süresi','hm.s2':'Duyarlılık','hm.s3':'Özgüllük','hm.s4':'Sertifikasyon',
    'hm.p1':'Aktif H. pylori enfeksiyonunda altın standart biyopsi yöntemi',
    'hm.p2':'Endoskopi sırasında hızlı, yerinde sonuç',
    'hm.p3':'Pozitif sonuçta belirgin renk değişimi',
    'hm.p4':'Minimum teknik bilgi gerektirir, kullanımı kolay',
    'hm.cta':'Ürün Bilgisi & Teklif İste','hm.cat':'Rapid Urease Test',
    'hm.pos':'POZİTİF<br/><small>H. pylori (+)</small>','hm.neg':'NEGATİF<br/><small>H. pylori (−)</small>',
    'hm.principle':'<strong>Çalışma Prensibi:</strong> H. pylori tarafından üretilen güçlü üreaz enzimi, üre substratını CO₂ ve NH₃\'e dönüştürerek pH\'ı yükseltir.',
    'hm.kit':'Kit içeriği: 25 test / kit','hm.storage':'Saklama: 2-8°C',
    'ind.label':'Hizmet Alanlarımız','ind.title':'Hangi <span class="grad-text">Sektörlere</span> Hizmet Veriyoruz?',
    'ind.i1t':'Klinik Mikrobiyoloji','ind.i1d':'Hastane ve klinik laboratuvarları için CE işaretli, kullanıma hazır kültür plakaları ve tanısal test kitleri.',
    'ind.i2t':'İlaç Endüstrisi','ind.i2d':'USP, EP ve JP farmakope standartlarına uygun sterilite testleri ve biyoburden analizi için hazır besiyerleri.',
    'ind.i3t':'Gıda & İçecek','ind.i3d':'Gıda güvenliği testleri için total aerobik sayım, koliform, maya/küf ve patojen tespit besiyerleri.',
    'ind.i4t':'Kozmetik','ind.i4d':'Kozmetik ürünlerde mikrobiyel limit testleri için selektif besiyerleri. ISO 17516 uyumlu.',
    'ind.i5t':'Su Analizi','ind.i5d':'İçme suyu, atık su ve saf su analizleri için koliform, E. coli ve heterotrofik sayım besiyerleri.',
    'ind.i6t':'Çevre Kontrolü','ind.i6d':'Temiz oda ve aseptik üretim alanlarında yüzey, hava ve personel izleme için temas ve çökelme plakaları.',
    'q.label':'Kalite Güvencesi','q.title':'Uluslararası Standartlarda<br/><span style="color:#26C6DA">Üretim Kalitesi</span>',
    'q.desc':'Tüm ürünlerimiz, müşteri gereksinimlerine bağlı olarak petri kaplarına, şişelere, tüplere veya torbalara aktarılmaktadır. Dolum ve nihai paketlemenin tamamı ISO 14644-1 ve EU GMP Sınıf C onaylı temiz oda alanlarında gerçekleştirilmektedir.',
    'q.c1':'Temiz Oda Standardı — onaylı üretim ortamı','q.c2':'Avrupa İyi Üretim Uygulamaları — steril ürün koşulları',
    'q.c3':'Klinik ürünlerde Avrupa uygunluk işareti','q.c4':'Endüstriyel ürünler uluslararası farmakope uyumlu',
    'q.s1':'Müşteri Memnuniyeti','q.s2':'Ortalama Teslimat','q.s3':'Formülasyon','q.s4':'Teknik Destek',
    'c.label':'İletişim','c.title':'Teklif veya Bilgi İçin<br/><span class="grad-text">Bize Ulaşın</span>',
    'c.desc':'Ürün kataloglarımız, özel formülasyon talepleri veya teknik destek için ekibimiz her zaman yanınızda.',
    'c.email':'E-posta','c.phone':'Telefon','c.addr':'Adres','c.hours':'Çalışma Saatleri','c.hoursVal':'Pzt – Cum: 09:00 – 18:00',
    'c.name':'Ad Soyad *','c.company':'Şirket','c.emailL':'E-posta *','c.phoneL':'Telefon',
    'c.subject':'Konu','c.sel':'Konu seçiniz','c.o1':'Ürün Bilgisi','c.o2':'Fiyat Teklifi','c.o3':'Teknik Destek','c.o4':'İhracat / İthalat','c.o5':'Diğer',
    'c.msg':'Mesajınız *','c.send':'Gönder','c.ok':'Mesajınız iletildi. En kısa sürede dönüş yapacağız.',
    'modal.title':'Ürün Sorgulama / Teklif','modal.qty':'Talep Miktarı / Açıklama *','modal.send':'Sorgulama Gönder',
    'footer.tagline':'Hazır mikrobiyoloji besiyeri üretiminde küresel standart. İstanbul, Türkiye.',
    'footer.links':'Hızlı Bağlantılar','footer.cats':'Ürün Kategorileri','footer.contact':'İletişim',
    'footer.rights':'Tüm hakları saklıdır.','footer.admin':'Admin Paneli',
  },
  en: {
    'nav.about':'About','nav.products':'Products','nav.helicomed':'HelicoMed','nav.quality':'Quality','nav.contact':'Contact','nav.admin':'Admin',
    'hero.badge':'ISO 14644-1 & EU GMP Class C Certified Production',
    'hero.title':'Prepared Microbiology<br/><span class="hl">Culture Media Manufacturer</span>',
    'hero.desc':'CE-marked and pharmacopoeia-compliant ready-to-use culture media for clinical diagnostics, industrial microbiology and environmental control. Global supply to pharma, food, cosmetics and healthcare.',
    'hero.cta1':'Product Catalogue','hero.cta2':'Request a Quote',
    'hero.m1':'Years Experience','hero.m2':'Product Formulations','hero.m3':'Export Countries','hero.m4':'Customer Satisfaction',
    'about.label':'About Us','about.card1.title':'Prepared Media Manufacturer','about.card1.text':'Fully automated filling lines and certified cleanroom facilities',
    'about.facility':'Production Area','about.cleanroom':'Cleanroom Class',
    'about.title':'Global Standard in<br/><span class="grad-text">Prepared Culture Media</span>',
    'about.p1':'Innomed Life Sciences is an Istanbul-based manufacturer of prepared microbiological culture media, supplying a wide range of industries including pharmaceutical, cosmetics, water and food.',
    'about.p2':'As companies strive for more efficient workflows and minimized costs, demand for high-quality ready-to-use media continues to grow across all sectors.',
    'about.f1t':'Fully Automated Filling Lines','about.f1s':'Precise production with modern filling and packaging equipment',
    'about.f2t':'Certified Cleanroom Facilities','about.f2s':'ISO 14644-1 and EU GMP Class C certified production environment',
    'about.f3t':'Multiple Format Options','about.f3s':'Production capacity in petri, bottle, tube and bag formats',
    'about.f4t':'Pharmacopoeia Compliance','about.f4s':'Full compliance with USP, EP and JP standards',
    'about.cta':'Request Technical Info',
    'products.label':'Product Portfolio',
    'products.title':'Our Comprehensive <span class="grad-text">Product Range</span>',
    'products.desc':'Ready-to-use culture media compliant with international standards for clinical diagnostics, industrial testing and environmental control.',
    'products.search':'Search products...','products.all':'All','products.clinical':'Clinical Microbiology',
    'products.industrial':'Industrial Microbiology','products.environment':'Environmental Control','products.helicomed':'HelicoMed',
    'products.loading':'Loading products...','products.noResult':'No products found matching your search.',
    'products.inquire':'Inquire','products.available':'In Stock','products.limited':'Limited Stock','products.out_of_stock':'Out of Stock',
    'hm.badge':'Featured Product','hm.title':'HelicoMed Plus —<br/><span class="grad-text">H. pylori Rapid Urease Test</span>',
    'hm.desc':'The gold standard for <em>Helicobacter pylori</em> detection in gastric mucosal biopsies. An advanced formula offering significant improvements over old agar gel-based tests.',
    'hm.s1':'Result Time','hm.s2':'Sensitivity','hm.s3':'Specificity','hm.s4':'Certification',
    'hm.p1':'Gold standard biopsy method for active H. pylori infection',
    'hm.p2':'Rapid, on-site result during endoscopy',
    'hm.p3':'Clear color change on positive result',
    'hm.p4':'Requires minimal technical knowledge, easy to use',
    'hm.cta':'Product Info & Request Quote','hm.cat':'Rapid Urease Test',
    'hm.pos':'POSITIVE<br/><small>H. pylori (+)</small>','hm.neg':'NEGATIVE<br/><small>H. pylori (−)</small>',
    'hm.principle':'<strong>Working Principle:</strong> The strong urease enzyme produced by H. pylori converts urea substrate to CO₂ and NH₃, raising pH and causing an indicator color change.',
    'hm.kit':'Kit contents: 25 tests / kit','hm.storage':'Storage: 2-8°C',
    'ind.label':'Industries We Serve','ind.title':'Which <span class="grad-text">Industries</span> Do We Serve?',
    'ind.i1t':'Clinical Microbiology','ind.i1d':'CE-marked ready-to-use culture plates and diagnostic test kits for hospitals and clinical laboratories.',
    'ind.i2t':'Pharmaceutical Industry','ind.i2d':'Ready-to-use media for sterility testing and bioburden analysis compliant with USP, EP and JP pharmacopoeia.',
    'ind.i3t':'Food & Beverage','ind.i3d':'Media for total aerobic count, coliform, yeast/mold and pathogen detection for food safety testing.',
    'ind.i4t':'Cosmetics','ind.i4d':'Selective media for microbial limit tests in cosmetic products. ISO 17516 compliant.',
    'ind.i5t':'Water Analysis','ind.i5d':'Coliform, E. coli and heterotrophic count media for drinking water, wastewater and purified water analysis.',
    'ind.i6t':'Environmental Control','ind.i6d':'Contact plates and settle plates for surface, air and personnel monitoring in cleanrooms and aseptic manufacturing.',
    'q.label':'Quality Assurance','q.title':'International Standard<br/><span style="color:#26C6DA">Production Quality</span>',
    'q.desc':'All our products are filled into petri dishes, bottles, tubes or bags according to customer requirements. All filling and final packaging is performed in ISO 14644-1 and EU GMP Class C certified cleanroom areas.',
    'q.c1':'Cleanroom Standard — certified production environment','q.c2':'European Good Manufacturing Practice — sterile product conditions',
    'q.c3':'European conformity mark for clinical products','q.c4':'Industrial products compliant with international pharmacopoeia',
    'q.s1':'Customer Satisfaction','q.s2':'Average Delivery','q.s3':'Formulations','q.s4':'Technical Support',
    'c.label':'Contact','c.title':'For a Quote or Information<br/><span class="grad-text">Get in Touch</span>',
    'c.desc':'Our team is always at hand for product catalogues, custom formulation requests or technical support.',
    'c.email':'Email','c.phone':'Phone','c.addr':'Address','c.hours':'Working Hours','c.hoursVal':'Mon – Fri: 09:00 – 18:00',
    'c.name':'Full Name *','c.company':'Company','c.emailL':'Email *','c.phoneL':'Phone',
    'c.subject':'Subject','c.sel':'Select a subject','c.o1':'Product Information','c.o2':'Price Quote','c.o3':'Technical Support','c.o4':'Export / Import','c.o5':'Other',
    'c.msg':'Your Message *','c.send':'Send','c.ok':'Your message has been sent. We will get back to you shortly.',
    'modal.title':'Product Inquiry / Quote','modal.qty':'Requested Quantity / Description *','modal.send':'Send Inquiry',
    'footer.tagline':'Global standard in prepared microbiology culture media. Istanbul, Turkey.',
    'footer.links':'Quick Links','footer.cats':'Product Categories','footer.contact':'Contact',
    'footer.rights':'All rights reserved.','footer.admin':'Admin Panel',
  }
};

/* ── Language ── */
let currentLang = localStorage.getItem('innomed_lang') || 'tr';

function applyLang(lang) {
  currentLang = lang;
  localStorage.setItem('innomed_lang', lang);
  document.documentElement.setAttribute('lang', lang);
  document.documentElement.setAttribute('data-lang', lang);

  document.getElementById('langLabel').textContent = lang.toUpperCase();
  document.getElementById('langOther').textContent = lang === 'tr' ? 'EN' : 'TR';

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = T[lang][key];
    if (val !== undefined) el.innerHTML = val;
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    const val = T[lang][key];
    if (val) el.placeholder = val;
  });
}

document.getElementById('langBtn').addEventListener('click', () => {
  applyLang(currentLang === 'tr' ? 'en' : 'tr');
  renderProducts();
});

/* ── Navbar scroll ── */
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 60);
  document.getElementById('backTop').classList.toggle('show', window.scrollY > 400);
}, { passive: true });

/* ── Hamburger ── */
const hamburger = document.getElementById('hamburger');
const mainNav   = document.getElementById('mainNav');
hamburger.addEventListener('click', () => {
  mainNav.classList.toggle('open');
  document.body.style.overflow = mainNav.classList.contains('open') ? 'hidden' : '';
});
mainNav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
  mainNav.classList.remove('open');
  document.body.style.overflow = '';
}));

/* ── Smooth scroll ── */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const href = a.getAttribute('href');
    if (href === '#') return;
    const target = document.querySelector(href);
    if (!target) return;
    e.preventDefault();
    window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - navbar.offsetHeight, behavior: 'smooth' });
  });
});

/* ── Back to top ── */
document.getElementById('backTop').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

/* ── Counter animation ── */
function animateCounter(el) {
  const target = parseInt(el.dataset.target, 10);
  const start = performance.now();
  const duration = 2000;
  const run = now => {
    const p = Math.min((now - start) / duration, 1);
    const e = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(e * target);
    if (p < 1) requestAnimationFrame(run);
    else el.textContent = target;
  };
  requestAnimationFrame(run);
}

new IntersectionObserver((entries, obs) => {
  entries.forEach(en => {
    if (en.isIntersecting) {
      en.target.querySelectorAll('.mnum[data-target]').forEach(animateCounter);
      obs.unobserve(en.target);
    }
  });
}, { threshold: 0.4 }).observe(document.getElementById('home'));

/* ── Reveal on scroll ── */
const revealObs = new IntersectionObserver((entries) => {
  entries.forEach(en => {
    if (en.isIntersecting) {
      en.target.classList.add('revealed');
      revealObs.unobserve(en.target);
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.reveal,.reveal-right').forEach(el => revealObs.observe(el));

/* ── Products ── */
let allProducts = [];
let currentCat = 'all';
let searchQuery = '';

async function loadProducts() {
  try {
    const res = await fetch('/api/products');
    allProducts = await res.json();
    renderProducts();
  } catch {
    document.getElementById('productsGrid').innerHTML = '<p style="color:#C62828;text-align:center;grid-column:1/-1">Ürünler yüklenemedi.</p>';
  }
}

function renderProducts() {
  const grid  = document.getElementById('productsGrid');
  const empty = document.getElementById('productsEmpty');
  const lang  = currentLang;

  let filtered = allProducts;
  if (currentCat !== 'all') filtered = filtered.filter(p => p.category === currentCat);
  if (searchQuery)          filtered = filtered.filter(p =>
    (p['name_' + lang] || p.name_tr).toLowerCase().includes(searchQuery) ||
    (p.catalog_no || '').toLowerCase().includes(searchQuery) ||
    (p['description_' + lang] || p.description_tr || '').toLowerCase().includes(searchQuery)
  );

  if (!filtered.length) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  const statusLabel = { available: T[lang]['products.available'], limited: T[lang]['products.limited'], out_of_stock: T[lang]['products.out_of_stock'] };
  const catColors   = { clinical:'#EAF4FB', industrial:'#E8F8F5', helicomed:'#FFF8E1', environment:'#E8F5E9' };
  const catIcons    = { clinical:'#0A5C8A', industrial:'#00897B', helicomed:'#F57C00', environment:'#2E7D32' };

  grid.innerHTML = filtered.map(p => {
    const name = p['name_' + lang] || p.name_tr;
    const desc = p['description_' + lang] || p.description_tr || '';
    const bg   = catColors[p.category] || '#F5F9FC';
    const ic   = catIcons[p.category] || '#0A5C8A';
    return `
      <div class="product-card">
        ${p.is_featured ? `<div class="pc-featured">${lang==='tr'?'Öne Çıkan':'Featured'}</div>` : ''}
        <div class="pc-header">
          <div class="pc-icon" style="background:${bg}">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="13" stroke="${ic}" stroke-width="1.5" fill="none"/>
              <path d="M10 18 L14 8 L18 18" stroke="${ic}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <line x1="11.5" y1="14.5" x2="16.5" y2="14.5" stroke="${ic}" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </div>
          <span class="pc-badge pc-badge-${p.stock_status}">${statusLabel[p.stock_status] || p.stock_status}</span>
        </div>
        ${p.catalog_no ? `<div class="pc-catalog">${p.catalog_no}</div>` : ''}
        <h3>${name}</h3>
        <p>${desc}</p>
        <div class="pc-footer">
          <span class="pc-format">${p.format || '—'}</span>
          <span class="pc-inquiry-btn" onclick="openInquiry(${p.id},'${name.replace(/'/g,"\\'")}')">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 7H13M8 2L13 7L8 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
            ${T[lang]['products.inquire']}
          </span>
        </div>
      </div>`;
  }).join('');
}

/* Filter tabs */
document.getElementById('filterTabs').addEventListener('click', e => {
  const tab = e.target.closest('.filter-tab');
  if (!tab) return;
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  currentCat = tab.dataset.cat;
  renderProducts();
});

/* Search */
document.getElementById('productSearch').addEventListener('input', e => {
  searchQuery = e.target.value.trim().toLowerCase();
  renderProducts();
});

/* ── Inquiry Modal ── */
function openInquiry(productId, productName) {
  document.getElementById('inqProductId').value   = productId;
  document.getElementById('inqProductName').value = productName;
  document.getElementById('modalProductName').textContent = productName;
  document.getElementById('inqOk').classList.add('hidden');
  document.getElementById('inquiryForm').reset();
  document.getElementById('inqProductId').value   = productId;
  document.getElementById('inqProductName').value = productName;
  document.getElementById('inquiryModal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('inquiryModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });

function closeModal() {
  document.getElementById('inquiryModal').classList.add('hidden');
  document.body.style.overflow = '';
}

document.getElementById('inquiryForm').addEventListener('submit', async e => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const data = Object.fromEntries(fd);
  if (!data.customer_name || !data.message) return;
  try {
    const res = await fetch('/api/inquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.ok) {
      document.getElementById('inqOk').classList.remove('hidden');
      e.target.reset();
      setTimeout(closeModal, 2500);
    }
  } catch { /* silent */ }
});

/* ── Contact Form ── */
document.getElementById('contactForm').addEventListener('submit', async e => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const data = Object.fromEntries(fd);
  if (!data.customer_name || !data.customer_email || !data.message) return;
  const btn = e.target.querySelector('[type=submit]');
  btn.disabled = true;
  try {
    const res = await fetch('/api/inquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.ok) {
      e.target.reset();
      document.getElementById('formOk').classList.remove('hidden');
      setTimeout(() => document.getElementById('formOk').classList.add('hidden'), 5000);
    }
  } catch { /* silent */ } finally {
    btn.disabled = false;
  }
});

/* ── Init ── */
applyLang(currentLang);
loadProducts();
