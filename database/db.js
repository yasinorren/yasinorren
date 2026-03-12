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

module.exports = db;
