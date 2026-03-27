const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'innomed.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/* ── Schema ── */
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    username   TEXT UNIQUE NOT NULL,
    password   TEXT NOT NULL,
    role       TEXT DEFAULT 'admin',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS products (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    catalog_no     TEXT UNIQUE,
    name_tr        TEXT NOT NULL,
    name_en        TEXT NOT NULL,
    category       TEXT NOT NULL,
    subcategory    TEXT,
    description_tr TEXT,
    description_en TEXT,
    format         TEXT,
    unit           TEXT DEFAULT 'adet',
    price          REAL DEFAULT 0,
    currency       TEXT DEFAULT 'USD',
    stock_status   TEXT DEFAULT 'available',
    stock_qty      INTEGER DEFAULT 0,
    is_featured    INTEGER DEFAULT 0,
    is_active      INTEGER DEFAULT 1,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS inquiries (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name  TEXT NOT NULL,
    customer_email TEXT,
    customer_phone TEXT,
    company        TEXT,
    product_id     INTEGER REFERENCES products(id) ON DELETE SET NULL,
    product_name   TEXT,
    subject        TEXT,
    message        TEXT NOT NULL,
    status         TEXT DEFAULT 'new',
    admin_notes    TEXT,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sales (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id       INTEGER REFERENCES products(id) ON DELETE SET NULL,
    product_name     TEXT NOT NULL,
    catalog_no       TEXT,
    quantity         INTEGER NOT NULL,
    unit_price       REAL DEFAULT 0,
    total_price      REAL DEFAULT 0,
    currency         TEXT DEFAULT 'USD',
    customer_name    TEXT,
    customer_company TEXT,
    country          TEXT DEFAULT 'Turkey',
    sale_date        DATE DEFAULT (date('now')),
    notes            TEXT,
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS site_content (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    section    TEXT NOT NULL,
    key        TEXT NOT NULL,
    value      TEXT,
    label      TEXT,
    type       TEXT DEFAULT 'text',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(section, key)
  );
`);

/* ── Seed admin user ── */
const adminUser = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
if (!adminUser) {
  const pwd = process.env.ADMIN_PASSWORD || 'Innomed2024!';
  const hash = bcrypt.hashSync(pwd, 10);
  db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run('admin', hash, 'admin');
  console.log('✅ Admin user created. Username: admin');
}

/* ── Seed products ── */
const productCount = db.prepare('SELECT COUNT(*) as c FROM products').get().c;
if (productCount === 0) {
  const insertProduct = db.prepare(`
    INSERT INTO products (catalog_no, name_tr, name_en, category, subcategory, description_tr, description_en, format, unit, stock_status, stock_qty, is_featured)
    VALUES (@catalog_no, @name_tr, @name_en, @category, @subcategory, @description_tr, @description_en, @format, @unit, @stock_status, @stock_qty, @is_featured)
  `);

  const seedMany = db.transaction((products) => {
    for (const p of products) insertProduct.run(p);
  });

  seedMany([
    // Clinical Microbiology
    { catalog_no: 'INN-CL-001', name_tr: 'Kan Agar', name_en: 'Blood Agar', category: 'clinical', subcategory: 'Genel Amaçlı', description_tr: 'Steril koyun kanı içeren zenginleştirilmiş besiyeri. İdrar kültürü ve genel izolasyon için kullanılır.', description_en: 'Enriched medium containing sterile sheep blood. Used for urine culture and general isolation.', format: 'Petri Plate', unit: 'adet', stock_status: 'available', stock_qty: 500, is_featured: 1 },
    { catalog_no: 'INN-CL-002', name_tr: 'MacConkey Agar', name_en: 'MacConkey Agar', category: 'clinical', subcategory: 'Selektif', description_tr: 'Gram-negatif enterik bakterilerin izolasyonu ve laktoz fermantasyonlarının ayrımı için selektif besiyeri.', description_en: 'Selective medium for isolation of Gram-negative enteric bacteria and differentiation of lactose fermenters.', format: 'Petri Plate', unit: 'adet', stock_status: 'available', stock_qty: 450, is_featured: 1 },
    { catalog_no: 'INN-CL-003', name_tr: 'Çikolata Agar', name_en: 'Chocolate Agar', category: 'clinical', subcategory: 'Zenginleştirilmiş', description_tr: 'Neisseria ve Haemophilus türleri başta olmak üzere fastidious organizmaların izolasyonu için kullanılır.', description_en: 'Used for isolation of fastidious organisms, especially Neisseria and Haemophilus species.', format: 'Petri Plate', unit: 'adet', stock_status: 'available', stock_qty: 300, is_featured: 0 },
    { catalog_no: 'INN-CL-004', name_tr: 'Mueller-Hinton Agar', name_en: 'Mueller-Hinton Agar', category: 'clinical', subcategory: 'Antibiyotik Duyarlılık', description_tr: 'EUCAST ve CLSI standartlarına uygun antibiyotik duyarlılık testleri için altın standart besiyeri.', description_en: 'Gold standard medium for antibiotic susceptibility testing per EUCAST and CLSI standards.', format: 'Petri Plate', unit: 'adet', stock_status: 'available', stock_qty: 600, is_featured: 1 },
    { catalog_no: 'INN-CL-005', name_tr: 'Sabouraud Dekstroz Agar', name_en: 'Sabouraud Dextrose Agar', category: 'clinical', subcategory: 'Mikoloji', description_tr: 'Maya ve küf mantarlarının izolasyonu ve tanımlanması için kullanılan standart mikoloji besiyeri.', description_en: 'Standard mycology medium for isolation and identification of yeasts and molds.', format: 'Petri Plate', unit: 'adet', stock_status: 'available', stock_qty: 350, is_featured: 0 },
    { catalog_no: 'INN-CL-006', name_tr: 'CLED Agar', name_en: 'CLED Agar', category: 'clinical', subcategory: 'İdrar Kültürü', description_tr: 'İdrar yolu enfeksiyonu etkenlerinin izolasyonu ve sayımı için yarı-selektif besiyeri. Proteus yayılmasını önler.', description_en: 'Semi-selective medium for isolation and enumeration of urinary tract pathogens. Inhibits Proteus spreading.', format: 'Petri Plate', unit: 'adet', stock_status: 'available', stock_qty: 400, is_featured: 0 },
    { catalog_no: 'INN-CL-007', name_tr: 'SS Agar (Salmonella-Shigella)', name_en: 'SS Agar', category: 'clinical', subcategory: 'Enterik', description_tr: 'Salmonella ve Shigella türlerinin fekal örneklerden selektif izolasyonu için diferansiyel besiyeri.', description_en: 'Differential medium for selective isolation of Salmonella and Shigella from fecal specimens.', format: 'Petri Plate', unit: 'adet', stock_status: 'available', stock_qty: 250, is_featured: 0 },
    { catalog_no: 'INN-CL-008', name_tr: 'Columbia Kan Agar', name_en: 'Columbia Blood Agar', category: 'clinical', subcategory: 'Zenginleştirilmiş', description_tr: 'Zengin Columbia temelli hemoliz tespiti ve rutin izolasyon için tercih edilen besiyeri.', description_en: 'Rich Columbia-based medium preferred for hemolysis detection and routine isolation.', format: 'Petri Plate', unit: 'adet', stock_status: 'available', stock_qty: 300, is_featured: 0 },
    // HelicoMed
    { catalog_no: 'INN-HM-001', name_tr: 'HelicoMed Plus (H. pylori Hızlı Üreaz Testi)', name_en: 'HelicoMed Plus (H. pylori Rapid Urease Test)', category: 'helicomed', subcategory: 'Tanısal', description_tr: 'Mide mukoza biyopsilerinde H. pylori tespiti için altın standart. Hızlı, hassas ve maliyet etkin. 15-30 dakikada sonuç. CE işaretli.', description_en: 'Gold standard for H. pylori detection in gastric mucosal biopsies. Fast, sensitive and cost-effective. Result in 15-30 min. CE marked.', format: 'Kit (25 test)', unit: 'kit', stock_status: 'available', stock_qty: 200, is_featured: 1 },
    { catalog_no: 'INN-HM-002', name_tr: 'HelicoMed (H. pylori Üreaz Testi)', name_en: 'HelicoMed (H. pylori Urease Test)', category: 'helicomed', subcategory: 'Tanısal', description_tr: 'Gastrik mukoza örneklerinde H. pylori tespiti için agar jel bazlı klasik üreaz testi.', description_en: 'Classic agar gel-based urease test for H. pylori detection in gastric mucosal specimens.', format: 'Kit (25 test)', unit: 'kit', stock_status: 'available', stock_qty: 150, is_featured: 0 },
    // Industrial Microbiology
    { catalog_no: 'INN-IND-001', name_tr: 'CASO Agar (TSA)', name_en: 'CASO Agar (TSA)', category: 'industrial', subcategory: 'Genel Sayım', description_tr: 'USP/EP/JP farmakope standartlarına uygun. İlaç, kozmetik ve gıda endüstrisinde genel mikrobiyel sayım için.', description_en: 'Compliant with USP/EP/JP pharmacopoeia standards. For general microbial count in pharma, cosmetics and food industry.', format: 'Petri Plate / Bottle', unit: 'adet', stock_status: 'available', stock_qty: 800, is_featured: 1 },
    { catalog_no: 'INN-IND-002', name_tr: 'R2A Agar', name_en: 'R2A Agar', category: 'industrial', subcategory: 'Su Analizi', description_tr: 'Arıtılmış ve içme suyu analizlerinde düşük besin gereksinimli heterotrofik bakterilerin sayımı için.', description_en: 'For enumeration of low-nutrient heterotrophic bacteria in purified and drinking water analysis.', format: 'Petri Plate', unit: 'adet', stock_status: 'available', stock_qty: 350, is_featured: 0 },
    { catalog_no: 'INN-IND-003', name_tr: 'Koloni Sayım Agar (PCA)', name_en: 'Plate Count Agar (PCA)', category: 'industrial', subcategory: 'Genel Sayım', description_tr: 'Gıda, su ve çevre örneklerinde toplam aerobik mikrobiyel sayım için standart besiyeri.', description_en: 'Standard medium for total aerobic microbial count in food, water and environmental samples.', format: 'Petri Plate', unit: 'adet', stock_status: 'available', stock_qty: 500, is_featured: 0 },
    { catalog_no: 'INN-IND-004', name_tr: 'VRBL Agar (Koliform)', name_en: 'VRBL Agar (Coliform)', category: 'industrial', subcategory: 'Koliform Tespiti', description_tr: 'Gıda ve su numunelerinde kolifomların ve E. coli\'nin seçici sayımı için diferansiyel besiyeri.', description_en: 'Differential medium for selective enumeration of coliforms and E. coli in food and water samples.', format: 'Petri Plate', unit: 'adet', stock_status: 'available', stock_qty: 400, is_featured: 0 },
    { catalog_no: 'INN-IND-005', name_tr: 'YGC Agar (Maya-Küf)', name_en: 'YGC Agar (Yeast-Mold)', category: 'industrial', subcategory: 'Maya-Küf Sayımı', description_tr: 'Gıda ve kozmetik ürünlerde maya ve küf mantar sayımı için EP ve USP standartlarına uygun selektif agar.', description_en: 'Selective agar for yeast and mold count in food and cosmetic products per EP and USP standards.', format: 'Petri Plate', unit: 'adet', stock_status: 'available', stock_qty: 320, is_featured: 0 },
    { catalog_no: 'INN-IND-006', name_tr: 'Sabouraud Dekstroz Agar (Endüstriyel)', name_en: 'Sabouraud Dextrose Agar (Industrial)', category: 'industrial', subcategory: 'Maya-Küf Sayımı', description_tr: 'Çevre kontrol ve endüstriyel ürün testlerinde fungal kontaminasyon tespiti için USP/EP uyumlu.', description_en: 'USP/EP compliant for fungal contamination detection in environmental control and industrial product testing.', format: 'Petri Plate / Bottle', unit: 'adet', stock_status: 'available', stock_qty: 280, is_featured: 0 },
    // Environment Control
    { catalog_no: 'INN-EC-001', name_tr: 'CASO Temas Plakaları', name_en: 'CASO Contact Plates', category: 'environment', subcategory: 'Yüzey Kontrolü', description_tr: 'ISO 14644-1 sınıf temiz oda yüzey kontrol çalışmaları için konveks plakalı hazır CASO besiyeri.', description_en: 'Ready-to-use CASO medium with convex plates for ISO 14644-1 cleanroom surface monitoring.', format: 'Contact Plate', unit: 'adet', stock_status: 'available', stock_qty: 600, is_featured: 1 },
    { catalog_no: 'INN-EC-002', name_tr: 'Sabouraud Temas Plakaları', name_en: 'Sabouraud Contact Plates', category: 'environment', subcategory: 'Yüzey Kontrolü', description_tr: 'Temiz oda ve aseptik üretim alanlarında fungal yüzey kontaminasyonunun tespiti için.', description_en: 'For detection of fungal surface contamination in cleanroom and aseptic manufacturing areas.', format: 'Contact Plate', unit: 'adet', stock_status: 'available', stock_qty: 400, is_featured: 0 },
    { catalog_no: 'INN-EC-003', name_tr: 'Çökelme Plakaları (Settle Plates)', name_en: 'Settle Plates', category: 'environment', subcategory: 'Hava Kontrolü', description_tr: 'Pasif hava örneklemesi için 90mm hazır besiyeri plakaları. EU GMP Ek 1 gereksinimlerine uygun.', description_en: 'Ready-to-use 90mm plates for passive air sampling. Compliant with EU GMP Annex 1 requirements.', format: 'Petri Plate', unit: 'adet', stock_status: 'available', stock_qty: 500, is_featured: 0 },
    { catalog_no: 'INN-EC-004', name_tr: 'RCS Hava Örnekleme Besiyeri', name_en: 'RCS Air Sampling Media', category: 'environment', subcategory: 'Hava Kontrolü', description_tr: 'RCS Plus ve benzeri aktif hava örnekleme sistemleri için özel üretilmiş strip besiyerleri.', description_en: 'Specially manufactured strip media for RCS Plus and similar active air sampling systems.', format: 'Strip', unit: 'strip', stock_status: 'available', stock_qty: 200, is_featured: 0 },
  ]);
  console.log('✅ Product seed data inserted (20 products).');
}

/* ── Seed site content ── */
const contentCount = db.prepare('SELECT COUNT(*) as c FROM site_content').get().c;
if (contentCount === 0) {
  const insertContent = db.prepare(`INSERT INTO site_content (section, key, value, label, type) VALUES (@section, @key, @value, @label, @type)`);
  const seedContent = db.transaction((items) => { for (const i of items) insertContent.run(i); });
  seedContent([
    // Navigation
    { section:'nav', key:'about', value:'About', label:'About Link', type:'text' },
    { section:'nav', key:'products', value:'Products', label:'Products Link', type:'text' },
    { section:'nav', key:'helicomed', value:'HelicoMed', label:'HelicoMed Link', type:'text' },
    { section:'nav', key:'quality', value:'Quality', label:'Quality Link', type:'text' },
    { section:'nav', key:'contact', value:'Contact', label:'Contact Link', type:'text' },
    // Hero
    { section:'hero', key:'badge', value:'ISO 14644-1 & EU GMP Class C Certified Production', label:'Badge Text', type:'text' },
    { section:'hero', key:'title_line1', value:'Prepared Microbiology', label:'Title Line 1', type:'text' },
    { section:'hero', key:'title_line2', value:'Culture Media Manufacturer', label:'Title Line 2 (highlighted)', type:'text' },
    { section:'hero', key:'desc', value:'CE-marked and pharmacopeia-compliant prepared culture media for clinical diagnostics, industrial microbiology and environmental control. Global supply to pharmaceutical, food, cosmetic and healthcare sectors.', label:'Description', type:'textarea' },
    { section:'hero', key:'cta1', value:'Product Catalog', label:'Button 1 Text', type:'text' },
    { section:'hero', key:'cta2', value:'Request a Quote', label:'Button 2 Text', type:'text' },
    { section:'hero', key:'m1_val', value:'20', label:'Metric 1 Value', type:'text' },
    { section:'hero', key:'m1_lbl', value:'Years of Experience', label:'Metric 1 Label', type:'text' },
    { section:'hero', key:'m1_unit', value:'+', label:'Metric 1 Unit', type:'text' },
    { section:'hero', key:'m2_val', value:'500', label:'Metric 2 Value', type:'text' },
    { section:'hero', key:'m2_lbl', value:'Product Formulations', label:'Metric 2 Label', type:'text' },
    { section:'hero', key:'m2_unit', value:'+', label:'Metric 2 Unit', type:'text' },
    { section:'hero', key:'m3_val', value:'30', label:'Metric 3 Value', type:'text' },
    { section:'hero', key:'m3_lbl', value:'Countries Exported', label:'Metric 3 Label', type:'text' },
    { section:'hero', key:'m3_unit', value:'+', label:'Metric 3 Unit', type:'text' },
    { section:'hero', key:'m4_val', value:'99', label:'Metric 4 Value', type:'text' },
    { section:'hero', key:'m4_lbl', value:'Customer Satisfaction', label:'Metric 4 Label', type:'text' },
    { section:'hero', key:'m4_unit', value:'%', label:'Metric 4 Unit', type:'text' },
    // About
    { section:'about', key:'label', value:'About Us', label:'Section Label', type:'text' },
    { section:'about', key:'title_line1', value:'Global Standard in', label:'Title Line 1', type:'text' },
    { section:'about', key:'title_line2', value:'Prepared Culture Media', label:'Title Line 2 (highlighted)', type:'text' },
    { section:'about', key:'p1', value:'Innomed Life Sciences is an Istanbul-based manufacturing company producing ready-to-use microbiological culture media for many industries including pharmaceutical, cosmetics, water and food sectors.', label:'Paragraph 1', type:'textarea' },
    { section:'about', key:'p2', value:"As companies seek more efficient workflows and minimized costs, the demand for high-quality ready-to-use culture media is increasing across all industries. INNOMED has developed deep expertise in each industry's specific requirements, standards and regulations to deliver products that meet customer expectations.", label:'Paragraph 2', type:'textarea' },
    { section:'about', key:'facility_val', value:'2,500 m²', label:'Facility Size', type:'text' },
    { section:'about', key:'facility_lbl', value:'Production Area', label:'Facility Label', type:'text' },
    { section:'about', key:'cleanroom_val', value:'Class C', label:'Cleanroom Class', type:'text' },
    { section:'about', key:'cleanroom_lbl', value:'Cleanroom Classification', label:'Cleanroom Label', type:'text' },
    { section:'about', key:'location', value:'Ümraniye, Istanbul', label:'Location', type:'text' },
    { section:'about', key:'f1t', value:'Fully Automated Production Lines', label:'Feature 1 Title', type:'text' },
    { section:'about', key:'f1s', value:'Precise manufacturing with modern filling and packaging equipment', label:'Feature 1 Subtitle', type:'text' },
    { section:'about', key:'f2t', value:'Certified Cleanroom Facilities', label:'Feature 2 Title', type:'text' },
    { section:'about', key:'f2s', value:'ISO 14644-1 and EU GMP Class C certified production environment', label:'Feature 2 Subtitle', type:'text' },
    { section:'about', key:'f3t', value:'Multiple Format Options', label:'Feature 3 Title', type:'text' },
    { section:'about', key:'f3s', value:'Production capacity in petri, bottle, tube and bag formats', label:'Feature 3 Subtitle', type:'text' },
    { section:'about', key:'f4t', value:'Pharmacopeia Compliance', label:'Feature 4 Title', type:'text' },
    { section:'about', key:'f4s', value:'Full compliance with USP, EP and JP standards', label:'Feature 4 Subtitle', type:'text' },
    { section:'about', key:'cta', value:'Get Technical Information', label:'CTA Button', type:'text' },
    // Products
    { section:'products', key:'label', value:'Product Portfolio', label:'Section Label', type:'text' },
    { section:'products', key:'title_line1', value:'Our Comprehensive', label:'Title Line 1', type:'text' },
    { section:'products', key:'title_line2', value:'Product Range', label:'Title Line 2 (highlighted)', type:'text' },
    { section:'products', key:'desc', value:'Ready-to-use culture media compliant with international standards for clinical diagnostics, industrial testing and environmental control.', label:'Description', type:'textarea' },
    { section:'products', key:'filter_all', value:'All', label:'Filter: All', type:'text' },
    { section:'products', key:'filter_clinical', value:'Clinical Microbiology', label:'Filter: Clinical', type:'text' },
    { section:'products', key:'filter_industrial', value:'Industrial Microbiology', label:'Filter: Industrial', type:'text' },
    { section:'products', key:'filter_environment', value:'Environmental Control', label:'Filter: Environment', type:'text' },
    { section:'products', key:'filter_helicomed', value:'HelicoMed', label:'Filter: HelicoMed', type:'text' },
    { section:'products', key:'inquire_btn', value:'Request Quote', label:'Inquire Button', type:'text' },
    // HelicoMed
    { section:'helicomed', key:'badge', value:'Featured Product', label:'Badge', type:'text' },
    { section:'helicomed', key:'title_line1', value:'HelicoMed Plus —', label:'Title Line 1', type:'text' },
    { section:'helicomed', key:'title_line2', value:'H. pylori Rapid Urease Test', label:'Title Line 2 (highlighted)', type:'text' },
    { section:'helicomed', key:'desc', value:'Gold standard for Helicobacter pylori detection in gastric mucosal biopsies. Advanced formula offering significant improvements over old agar gel-based tests: faster, easier, lower cost and more accurate.', label:'Description', type:'textarea' },
    { section:'helicomed', key:'s1_lbl', value:'Result Time', label:'Spec 1 Label', type:'text' },
    { section:'helicomed', key:'s1_val', value:'15-30 min', label:'Spec 1 Value', type:'text' },
    { section:'helicomed', key:'s2_lbl', value:'Sensitivity', label:'Spec 2 Label', type:'text' },
    { section:'helicomed', key:'s2_val', value:'≥90%', label:'Spec 2 Value', type:'text' },
    { section:'helicomed', key:'s3_lbl', value:'Specificity', label:'Spec 3 Label', type:'text' },
    { section:'helicomed', key:'s3_val', value:'≥95%', label:'Spec 3 Value', type:'text' },
    { section:'helicomed', key:'s4_lbl', value:'Certification', label:'Spec 4 Label', type:'text' },
    { section:'helicomed', key:'s4_val', value:'CE ✓', label:'Spec 4 Value', type:'text' },
    { section:'helicomed', key:'p1', value:'Gold standard biopsy method in active H. pylori infection', label:'Point 1', type:'text' },
    { section:'helicomed', key:'p2', value:'Rapid, on-site result during endoscopy', label:'Point 2', type:'text' },
    { section:'helicomed', key:'p3', value:'Clear color change with positive result', label:'Point 3', type:'text' },
    { section:'helicomed', key:'p4', value:'Requires minimal technical knowledge, easy to use', label:'Point 4', type:'text' },
    { section:'helicomed', key:'cta', value:'Product Info & Request Quote', label:'CTA Button', type:'text' },
    { section:'helicomed', key:'kit_info', value:'Kit contents: 25 tests / kit', label:'Kit Info', type:'text' },
    { section:'helicomed', key:'storage', value:'Storage: 2–8°C', label:'Storage', type:'text' },
    { section:'helicomed', key:'principle', value:'<strong>Working Principle:</strong> The powerful urease enzyme produced by H. pylori converts urea substrate to CO₂ and NH₃, raising pH. Indicator color change signals a positive result.', label:'Working Principle', type:'html' },
    // Industries
    { section:'industries', key:'label', value:'Our Service Areas', label:'Section Label', type:'text' },
    { section:'industries', key:'title', value:'Which Industries Do We Serve?', label:'Title', type:'text' },
    { section:'industries', key:'i1t', value:'Clinical Microbiology', label:'Industry 1 Title', type:'text' },
    { section:'industries', key:'i1d', value:'CE-marked, ready-to-use culture plates, tubes and diagnostic test kits for hospital and clinical laboratories.', label:'Industry 1 Description', type:'textarea' },
    { section:'industries', key:'i2t', value:'Pharmaceutical Industry', label:'Industry 2 Title', type:'text' },
    { section:'industries', key:'i2d', value:'Ready-to-use culture media for sterility testing and bioburden analysis compliant with USP, EP and JP pharmacopeia standards.', label:'Industry 2 Description', type:'textarea' },
    { section:'industries', key:'i3t', value:'Food & Beverage', label:'Industry 3 Title', type:'text' },
    { section:'industries', key:'i3d', value:'Total aerobic count, coliform, yeast/mold and pathogen detection media for food safety testing.', label:'Industry 3 Description', type:'textarea' },
    { section:'industries', key:'i4t', value:'Cosmetics', label:'Industry 4 Title', type:'text' },
    { section:'industries', key:'i4d', value:'Selective media for microbial limit testing in cosmetic products. ISO 17516 compliant.', label:'Industry 4 Description', type:'textarea' },
    { section:'industries', key:'i5t', value:'Water Analysis', label:'Industry 5 Title', type:'text' },
    { section:'industries', key:'i5d', value:'Coliform, E. coli and heterotrophic count media for drinking water, wastewater and purified water analysis.', label:'Industry 5 Description', type:'textarea' },
    { section:'industries', key:'i6t', value:'Environmental Control', label:'Industry 6 Title', type:'text' },
    { section:'industries', key:'i6d', value:'Contact plates and settle plates for surface, air and personnel monitoring in cleanroom and aseptic manufacturing areas.', label:'Industry 6 Description', type:'textarea' },
    // Quality
    { section:'quality', key:'label', value:'Quality Assurance', label:'Section Label', type:'text' },
    { section:'quality', key:'title', value:'International Standard Manufacturing Quality', label:'Title', type:'text' },
    { section:'quality', key:'desc', value:'All our products are dispensed into petri dishes, bottles, tubes or bags as required. All filling and final packaging is performed in ISO 14644-1 and EU GMP Class C certified cleanroom areas.', label:'Description', type:'textarea' },
    { section:'quality', key:'c1t', value:'ISO 14644-1 (Class 7)', label:'Cert 1 Title', type:'text' },
    { section:'quality', key:'c1d', value:'Cleanroom Standard — certified production environment', label:'Cert 1 Description', type:'text' },
    { section:'quality', key:'c2t', value:'EU GMP Annex 1 — Class C', label:'Cert 2 Title', type:'text' },
    { section:'quality', key:'c2d', value:'European Good Manufacturing Practices — sterile product conditions', label:'Cert 2 Description', type:'text' },
    { section:'quality', key:'c3t', value:'CE — IVD Directive 98/79/EC', label:'Cert 3 Title', type:'text' },
    { section:'quality', key:'c3d', value:'European conformity mark for clinical products', label:'Cert 3 Description', type:'text' },
    { section:'quality', key:'c4t', value:'USP / EP / JP Harmonized Pharmacopeia', label:'Cert 4 Title', type:'text' },
    { section:'quality', key:'c4d', value:'Industrial products compliant with international pharmacopeia', label:'Cert 4 Description', type:'text' },
    { section:'quality', key:'s1_val', value:'99%', label:'Stat 1 Value', type:'text' },
    { section:'quality', key:'s1_lbl', value:'Customer Satisfaction', label:'Stat 1 Label', type:'text' },
    { section:'quality', key:'s2_val', value:'48h', label:'Stat 2 Value', type:'text' },
    { section:'quality', key:'s2_lbl', value:'Average Delivery', label:'Stat 2 Label', type:'text' },
    { section:'quality', key:'s3_val', value:'500+', label:'Stat 3 Value', type:'text' },
    { section:'quality', key:'s3_lbl', value:'Formulations', label:'Stat 3 Label', type:'text' },
    { section:'quality', key:'s4_val', value:'24/7', label:'Stat 4 Value', type:'text' },
    { section:'quality', key:'s4_lbl', value:'Technical Support', label:'Stat 4 Label', type:'text' },
    // Contact
    { section:'contact', key:'label', value:'Contact', label:'Section Label', type:'text' },
    { section:'contact', key:'title', value:'Get In Touch For a Quote or Information', label:'Title', type:'text' },
    { section:'contact', key:'desc', value:'Our team is always here for product catalogs, custom formulation requests or technical support.', label:'Description', type:'textarea' },
    { section:'contact', key:'email', value:'info@innomedlifesci.com', label:'Email Address', type:'email' },
    { section:'contact', key:'phone', value:'+90 543 769 54 50', label:'Phone Number', type:'text' },
    { section:'contact', key:'address', value:'Aşağı Dudullu Mah., Alemdağ Cad., Yavuz İş Hanı No:511/2, Ümraniye, İstanbul', label:'Address', type:'textarea' },
    { section:'contact', key:'hours', value:'Mon – Fri: 09:00 – 18:00', label:'Working Hours', type:'text' },
    // Footer
    { section:'footer', key:'tagline', value:'Global standard in prepared microbiology culture media. Istanbul, Turkey.', label:'Tagline', type:'text' },
    { section:'footer', key:'copyright', value:'© 2025 Innomed Life Sciences. All rights reserved.', label:'Copyright Text', type:'text' },
    { section:'footer', key:'col1_title', value:'Quick Links', label:'Column 1 Title', type:'text' },
    { section:'footer', key:'col2_title', value:'Product Categories', label:'Column 2 Title', type:'text' },
    { section:'footer', key:'col3_title', value:'Contact', label:'Column 3 Title', type:'text' },
  ]);
  console.log('✅ Site content seed data inserted.');
}

module.exports = db;
