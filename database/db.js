require('dotenv').config();
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

  CREATE TABLE IF NOT EXISTS categories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    slug        TEXT UNIQUE NOT NULL,
    parent_id   INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    description TEXT,
    image_url   TEXT,
    order_index INTEGER DEFAULT 0,
    is_active   INTEGER DEFAULT 1,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS category_products (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    brand       TEXT DEFAULT 'ORGAMİK',
    stock_code  TEXT,
    stock_name  TEXT NOT NULL,
    purpose     TEXT,
    order_index INTEGER DEFAULT 0,
    is_active   INTEGER DEFAULT 1,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sterility_codes (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    code              TEXT UNIQUE NOT NULL,
    product_name      TEXT NOT NULL,
    catalog_no        TEXT,
    batch_no          TEXT,
    customer_name     TEXT,
    customer_company  TEXT,
    invoice_date      DATE,
    manufacture_date  DATE,
    expiry_date       DATE,
    test_result       TEXT DEFAULT 'PASS',
    notes             TEXT,
    is_active         INTEGER DEFAULT 1,
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
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
    image_url      TEXT,
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

/* ── Migrations (safe to run multiple times) ── */
try { db.exec('ALTER TABLE products ADD COLUMN image_url TEXT'); } catch(e) { /* already exists */ }
try { db.exec('ALTER TABLE category_products ADD COLUMN image_url TEXT'); } catch(e) { /* already exists */ }

/* ── Seed admin user ── */
const adminUser = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
if (!adminUser) {
  const pwd = process.env.ADMIN_PASSWORD || 'Innomed2024!';
  const hash = bcrypt.hashSync(pwd, 10);
  db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run('admin', hash, 'admin');
  console.log('✅ Admin user created.');
}

/* ── Seed categories ── */
const catCount = db.prepare('SELECT COUNT(*) as c FROM categories').get().c;
if (catCount === 0) {
  const ins = db.prepare(`INSERT INTO categories (name, slug, parent_id, description, order_index) VALUES (@name, @slug, @parent_id, @description, @order_index)`);

  const covid19   = ins.run({ name:'Covid-19',           slug:'covid-19',           parent_id:null, description:'COVID-19 diagnostic and viral transport products',           order_index:1 });
  const swabs     = ins.run({ name:'Swabs',               slug:'swabs',              parent_id:null, description:'Professional swab collection systems',                       order_index:2 });
  const micro     = ins.run({ name:'Microbiology',        slug:'microbiology',       parent_id:null, description:'Clinical and industrial microbiology media',                 order_index:3 });
  const env       = ins.run({ name:'Environment Control', slug:'environment-control',parent_id:null, description:'Environmental monitoring and control products',              order_index:4 });
  const aqua      = ins.run({ name:'Aqua Samp',           slug:'aqua-samp',          parent_id:null, description:'Water sampling and analysis products',                       order_index:5 });
  const helico    = ins.run({ name:'HelicoMed',           slug:'helicomed',          parent_id:null, description:'H. pylori rapid diagnostic products',                        order_index:6 });
  ins.run({              name:'Clothes',             slug:'clothes',            parent_id:null, description:'Laboratory protective clothing and apparel',               order_index:7 });

  // Covid-19 sub
  ins.run({ name:'bioNAT',              slug:'bionat',              parent_id:covid19.lastInsertRowid, description:'Viral nucleic acid buffer for extraction, isolation, storage and transportation', order_index:1 });
  ins.run({ name:'VTM',                 slug:'vtm',                 parent_id:covid19.lastInsertRowid, description:'Viral Transport Medium',                        order_index:2 });
  ins.run({ name:'Nasopharyngeal Swab', slug:'nasopharyngeal-swab', parent_id:covid19.lastInsertRowid, description:'Nasopharyngeal swab collection products',       order_index:3 });
  ins.run({ name:'Throat Swab',         slug:'throat-swab',         parent_id:covid19.lastInsertRowid, description:'Throat swab collection products',               order_index:4 });

  // Swabs sub
  ins.run({ name:'Transport Swab', slug:'transport-swab', parent_id:swabs.lastInsertRowid, description:'Transport swab systems for specimen collection', order_index:1 });
  ins.run({ name:'ForeSamp',       slug:'foresamp',       parent_id:swabs.lastInsertRowid, description:'ForeSamp professional collection systems',       order_index:2 });
  ins.run({ name:'Uterine',        slug:'uterine',        parent_id:swabs.lastInsertRowid, description:'Uterine sampling products',                      order_index:3 });

  // Microbiology sub
  ins.run({ name:'Clinical Microbiology',   slug:'clinical-microbiology',   parent_id:micro.lastInsertRowid, description:'Culture media and diagnostic products for clinical laboratories', order_index:1 });
  ins.run({ name:'Industrial Microbiology', slug:'industrial-microbiology', parent_id:micro.lastInsertRowid, description:'Microbiology media for pharmaceutical, food and cosmetic industries', order_index:2 });

  // Environment Control sub
  ins.run({ name:'Enviro Slide', slug:'enviro-slide', parent_id:env.lastInsertRowid, description:'Environmental slide monitoring products', order_index:1 });
  ins.run({ name:'Enviro Touch', slug:'enviro-touch', parent_id:env.lastInsertRowid, description:'Environmental touch monitoring products', order_index:2 });
  const esamp = ins.run({ name:'EnviroSamp', slug:'envirosamp', parent_id:env.lastInsertRowid, description:'Environmental sampling systems', order_index:3 });
  ins.run({ name:'MicroBead',    slug:'microbead',    parent_id:env.lastInsertRowid, description:'MicroBead environmental monitoring products', order_index:4 });

  // EnviroSamp sub-sub (level 3)
  ins.run({ name:'S3',          slug:'s3',          parent_id:esamp.lastInsertRowid, description:'S3 environmental sampling system', order_index:1 });
  ins.run({ name:'Sock Swab',   slug:'sock-swab',   parent_id:esamp.lastInsertRowid, description:'Sock Swab sampling products',      order_index:2 });
  ins.run({ name:'Sponge Plus', slug:'sponge-plus', parent_id:esamp.lastInsertRowid, description:'Sponge Plus sampling products',    order_index:3 });
  ins.run({ name:'Sponge Swab', slug:'sponge-swab', parent_id:esamp.lastInsertRowid, description:'Sponge Swab sampling products',   order_index:4 });

  // Aqua Samp - no subs yet
  ins.run({ name:'AquaSamp Standard', slug:'aquasamp-standard', parent_id:aqua.lastInsertRowid, description:'Standard water sampling products', order_index:1 });

  // HelicoMed sub
  ins.run({ name:'HelicoMed Plus', slug:'helicomed-plus',    parent_id:helico.lastInsertRowid, description:'Advanced H. pylori rapid urease test — CE marked', order_index:1 });
  ins.run({ name:'HelicoMed',      slug:'helicomed-product', parent_id:helico.lastInsertRowid, description:'H. pylori urease test — classic formulation',      order_index:2 });

  console.log('✅ Category seed data inserted.');
}

/* ── Seed category products (bioNAT) ── */
const cpCount = db.prepare('SELECT COUNT(*) as c FROM category_products').get().c;
if (cpCount === 0) {
  const bionatCat = db.prepare("SELECT id FROM categories WHERE slug='bionat'").get();
  const clinicalCat = db.prepare("SELECT id FROM categories WHERE slug='clinical-microbiology'").get();

  if (bionatCat) {
    const insProd = db.prepare(`INSERT INTO category_products (category_id, brand, stock_code, stock_name, purpose, order_index) VALUES (@category_id, @brand, @stock_code, @stock_name, @purpose, @order_index)`);
    const seedProds = db.transaction((items) => { for (const i of items) insProd.run(i); });

    seedProds([
      { category_id:bionatCat.id, brand:'ORGAMİK', stock_code:'NTS-001', stock_name:'bioNAT (1000 mL) — 1000 CC Plastic Bottle',       purpose:'Viral nucleic acid buffer for RNA virus extraction and storage', order_index:1 },
      { category_id:bionatCat.id, brand:'ORGAMİK', stock_code:'NTS-002', stock_name:'bioNAT (2 mL) — 16x110 MM PC Tube',               purpose:'Viral nucleic acid buffer for RNA virus extraction and storage', order_index:2 },
      { category_id:bionatCat.id, brand:'ORGAMİK', stock_code:'NTS-003', stock_name:'bioNAT (2 mL) — 13x75 MM Vacuum Tube',            purpose:'Viral nucleic acid buffer for RNA virus extraction and storage', order_index:3 },
      { category_id:bionatCat.id, brand:'ORGAMİK', stock_code:'NTS-004', stock_name:'bioNAT (2 mL) — 2 mL Cryo Tube',                  purpose:'Viral nucleic acid buffer for RNA virus extraction and storage', order_index:4 },
      { category_id:bionatCat.id, brand:'ORGAMİK', stock_code:'NTS-005', stock_name:'bioNAT (2 mL) — 10 mL Cryo Tube',                 purpose:'Viral nucleic acid buffer for RNA virus extraction and storage', order_index:5 },
      { category_id:bionatCat.id, brand:'ORGAMİK', stock_code:'NTS-006', stock_name:'bioNAT (30 mL) — 30 CC Plastic Bottle',           purpose:'Viral nucleic acid buffer for RNA virus extraction and storage', order_index:6 },
      { category_id:bionatCat.id, brand:'ORGAMİK', stock_code:'NTS-007', stock_name:'bioNAT (50 mL) — 50 CC Plastic Bottle',           purpose:'Viral nucleic acid buffer for RNA virus extraction and storage', order_index:7 },
      { category_id:bionatCat.id, brand:'ORGAMİK', stock_code:'NTS-008', stock_name:'bioNAT (2 mL) — 16x84.5 MM PP Tube Flat Base',    purpose:'Viral nucleic acid buffer for RNA virus extraction and storage', order_index:8 },
      { category_id:bionatCat.id, brand:'ORGAMİK', stock_code:'NTS-009', stock_name:'bioNAT (2 mL) — 16x86.5 MM PP Tube Conical Base', purpose:'Viral nucleic acid buffer for RNA virus extraction and storage', order_index:9 },
      { category_id:bionatCat.id, brand:'ORGAMİK', stock_code:'NTS-010', stock_name:'bioNAT (30 L) — 30 L Plastic Drum',               purpose:'Viral nucleic acid buffer for RNA virus extraction and storage', order_index:10 },
      { category_id:bionatCat.id, brand:'ORGAMİK', stock_code:'NTS-069', stock_name:'bioNAT (500 mL) — 500 CC Plastic Bottle',         purpose:'Viral nucleic acid buffer for RNA virus extraction and storage', order_index:11 },
    ]);
  }

  if (clinicalCat) {
    const insProd = db.prepare(`INSERT INTO category_products (category_id, brand, stock_code, stock_name, purpose, order_index) VALUES (@category_id, @brand, @stock_code, @stock_name, @purpose, @order_index)`);
    const seedProds = db.transaction((items) => { for (const i of items) insProd.run(i); });
    const cid = clinicalCat.id;
    seedProds([
      { category_id:cid, brand:'ORGAMİK', stock_code:'DPB-001', stock_name:'5% Sheep Blood Agar', purpose:'A solid medium that allows the development of all microorganisms and the examination of hemolysis images', order_index:1 },
      { category_id:cid, brand:'ORGAMİK', stock_code:'DPB-002', stock_name:'EMB Agar', purpose:'A selective medium used for the isolation of gram-negative bacteria', order_index:2 },
      { category_id:cid, brand:'ORGAMİK', stock_code:'DPB-003', stock_name:'Mueller Hinton Agar', purpose:'A solid medium used for antimicrobial disc diffusion susceptibility tests', order_index:3 },
      { category_id:cid, brand:'ORGAMİK', stock_code:'DPB-004', stock_name:'Chocolate Agar', purpose:'A medium used for the isolation of difficult-to-grow microorganisms and Neisseria and Haemophilus species', order_index:4 },
      { category_id:cid, brand:'ORGAMİK', stock_code:'DPB-005', stock_name:'Sabouraud Dextrose Agar', purpose:'A selective medium used for the growth of yeast, mold and bacteria that grow in acidic environments', order_index:5 },
      { category_id:cid, brand:'ORGAMİK', stock_code:'DPB-006', stock_name:'Salmonella Shigella Agar', purpose:'A selective medium used for the isolation of Salmonella and Shigella species', order_index:6 },
      { category_id:cid, brand:'ORGAMİK', stock_code:'DPB-007', stock_name:'Cetremide Agar', purpose:'A selective medium for the isolation and pre-identification of Pseudomonas aeruginosa', order_index:7 },
      { category_id:cid, brand:'ORGAMİK', stock_code:'DPB-009', stock_name:'Mac Conkey Agar', purpose:'A selective solid medium for the growth and enumeration of coliform bacteria, especially Escherichia coli', order_index:8 },
      { category_id:cid, brand:'ORGAMİK', stock_code:'DPB-010', stock_name:'Mannitol Salt Agar', purpose:'A selective medium used for the isolation of pathogenic staphylococci', order_index:9 },
      { category_id:cid, brand:'ORGAMİK', stock_code:'DPB-011', stock_name:'Hektoen Enteric Agar', purpose:'A selective medium used for the isolation of Salmonella and Shigella species', order_index:10 },
      { category_id:cid, brand:'ORGAMİK', stock_code:'DPB-013', stock_name:'5% Sheep Blood Agar w/Bacitracin', purpose:'A selective medium used for the isolation of group A streptococci', order_index:11 },
      { category_id:cid, brand:'ORGAMİK', stock_code:'DPB-015', stock_name:'Chocolate Agar w/Isovitalex', purpose:'A non-selective medium used for the isolation of clinical specimen microorganisms and Neisseria and Haemophilus species that are difficult to grow', order_index:12 },
      { category_id:cid, brand:'ORGAMİK', stock_code:'DPB-017', stock_name:'CLED Agar', purpose:'A solid medium used for the enumeration, isolation and preliminary identification of bacteria in urine', order_index:13 },
      { category_id:cid, brand:'ORGAMİK', stock_code:'DPB-018', stock_name:'Columbia Agar w/5% Sheep Blood', purpose:'A solid medium that allows the development of all microorganisms and the examination of hemolysis images', order_index:14 },
      { category_id:cid, brand:'ORGAMİK', stock_code:'DPB-019', stock_name:'Columbia CNA Agar w/5% Sheep Blood', purpose:'A selective medium used for the isolation of Gram-positive bacteria', order_index:15 },
      { category_id:cid, brand:'ORGAMİK', stock_code:'DPB-020', stock_name:'Enterococcosel Agar w/Vancomycin', purpose:'A medium used for the detection of vancomycin-resistant enterococci from clinical specimens', order_index:16 },
      { category_id:cid, brand:'ORGAMİK', stock_code:'DPB-023', stock_name:'DNase Agar', purpose:'A medium used for the differentiation of microorganisms based on deoxyribonuclease (DNase) activity', order_index:17 },
      { category_id:cid, brand:'ORGAMİK', stock_code:'DPB-026', stock_name:'XLD Agar', purpose:'A selective medium used for the isolation of Salmonella and Shigella species from clinical specimens and foods', order_index:18 },
      { category_id:cid, brand:'ORGAMİK', stock_code:'DPB-028', stock_name:'Bile Aesculin Agar', purpose:'A selective differential medium used to isolate and identify members of the Enterococcus genus', order_index:19 },
      { category_id:cid, brand:'ORGAMİK', stock_code:'DPB-029', stock_name:'Baird Parker Agar', purpose:'A selective differential medium used for the isolation and presumptive identification of coagulase-positive staphylococci', order_index:20 },
      { category_id:cid, brand:'ORGAMİK', stock_code:'DPB-038', stock_name:'Brain Heart Infusion Agar', purpose:'A highly nutritious medium recommended for the growth of difficult-to-cultivate organisms', order_index:21 },
      { category_id:cid, brand:'ORGAMİK', stock_code:'DPB-039', stock_name:'Brucella Agar w/5% Sheep Blood', purpose:'A medium used for the selective isolation and cultivation of Campylobacter species', order_index:22 },
      { category_id:cid, brand:'ORGAMİK', stock_code:'DPB-042', stock_name:'Chromogenic VRE', purpose:'A selective chromogenic medium used for the isolation of vancomycin resistant enterococci', order_index:23 },
      { category_id:cid, brand:'ORGAMİK', stock_code:'DPB-043', stock_name:'Chromogenic MRSA', purpose:'A chromogenic medium used to isolate Methicillin Resistant Staphylococcus aureus (MRSA)', order_index:24 },
      { category_id:cid, brand:'ORGAMİK', stock_code:'DPB-044', stock_name:'Chromogenic Orientation', purpose:'A chromogenic medium used for the isolation of bacteria commonly seen in urinary tract infections', order_index:25 },
      { category_id:cid, brand:'ORGAMİK', stock_code:'DPB-045', stock_name:'Chromogenic UTI', purpose:'A chromogenic medium used for the isolation and differentiation of urinary tract pathogens', order_index:26 },
      { category_id:cid, brand:'ORGAMİK', stock_code:'DPB-046', stock_name:'Chromogenic CPE', purpose:'A chromogenic medium used for the detection and isolation of carbapenemase-producing Enterobacteriaceae', order_index:27 },
      { category_id:cid, brand:'ORGAMİK', stock_code:'DPB-047', stock_name:'Chromogenic Campylobacter', purpose:'A selective chromogenic medium for the primary isolation of Campylobacter jejuni from stool specimens', order_index:28 },
      { category_id:cid, brand:'ORGAMİK', stock_code:'DPB-050', stock_name:'Chromogenic S. Aureus', purpose:'A chromogenic medium used for the isolation and detection of S. aureus', order_index:29 },
      { category_id:cid, brand:'ORGAMİK', stock_code:'DPB-052', stock_name:'Chromogenic Candida', purpose:'A chromogenic medium used for the isolation and diagnosis of Candida albicans, C. Tropicalis and C. Krusei', order_index:30 },
      { category_id:cid, brand:'ORGAMİK', stock_code:'DPB-054', stock_name:'Chromogenic Salmonella', purpose:'A chromogenic medium used for the isolation of Salmonella and some Shigella', order_index:31 },
      { category_id:cid, brand:'ORGAMİK', stock_code:'DPB-063', stock_name:'Anaerobic Agar', purpose:'A medium used for the development of Clostridium species and other anaerobes', order_index:32 },
      { category_id:cid, brand:'ORGAMİK', stock_code:'DPB-064', stock_name:'BCYE Agar', purpose:'An enriched medium for the isolation and cultivation of Legionella species', order_index:33 },
      { category_id:cid, brand:'ORGAMİK', stock_code:'DPB-098', stock_name:'Thayer Martin Agar', purpose:'A selective and enriched medium used for the isolation of Neisseria species', order_index:34 },
      { category_id:cid, brand:'ORGAMİK', stock_code:'DPB-108', stock_name:'Schaedler Agar w/5% Sheep Blood', purpose:'A medium used for the non-selective isolation of anaerobes and selective isolation of Gram-negative anaerobic rods', order_index:35 },
      { category_id:cid, brand:'ORGAMİK', stock_code:'TUB-001', stock_name:'Triple Sugar Iron Agar (5 mL)', purpose:'Used to differentiate Enterobacteriaceae, especially Salmonella, from other enteric bacteria', order_index:36 },
      { category_id:cid, brand:'ORGAMİK', stock_code:'TUB-002', stock_name:'Urea Agar (5 mL)', purpose:'A medium used for urea test and microorganism identification', order_index:37 },
      { category_id:cid, brand:'ORGAMİK', stock_code:'TUB-003', stock_name:'Simmons Citrate Agar (5 mL)', purpose:'Used for the citrate test in the identification of coliform group bacteria', order_index:38 },
      { category_id:cid, brand:'ORGAMİK', stock_code:'TUB-009', stock_name:'Thioglycollate Broth (5 mL)', purpose:'A medium used for the growth and enumeration of anaerobes', order_index:39 },
      { category_id:cid, brand:'ORGAMİK', stock_code:'TUB-010', stock_name:'Selenite F Broth', purpose:'Used as an enrichment medium for the isolation of Salmonella from feces, urine, water and food', order_index:40 },
      { category_id:cid, brand:'ORGAMİK', stock_code:'MBB-001', stock_name:'Lowenstein Jensen Medium w/Glycerol (5 mL)', purpose:'A solid medium used for the isolation and growth of Mycobacterium species', order_index:41 },
      { category_id:cid, brand:'ORGAMİK', stock_code:'BOY-004', stock_name:'Gram Stain Kit (1000 mL)', purpose:'Used for staining and microscopic examination of Gram-positive and Gram-negative bacteria', order_index:42 },
      { category_id:cid, brand:'ORGAMİK', stock_code:'BOY-001', stock_name:'EZN Stain Kit (1000 mL)', purpose:'Used for staining and microscopic examination of acid-resistant bacteria', order_index:43 },
    ]);
  }
  console.log('✅ Category products seeded.');
}

/* ── Seed site content ── */
const contentCount = db.prepare('SELECT COUNT(*) as c FROM site_content').get().c;
if (contentCount === 0) {
  const insertContent = db.prepare(`INSERT INTO site_content (section, key, value, label, type) VALUES (@section, @key, @value, @label, @type)`);
  const seedContent = db.transaction((items) => { for (const i of items) insertContent.run(i); });
  seedContent([
    { section:'nav', key:'verify', value:'Sterility Verify', label:'Sterility Verify Link', type:'text' },
    { section:'nav', key:'contact', value:'Contact', label:'Contact Link', type:'text' },
    { section:'hero', key:'badge', value:'ISO 14644-1 & EU GMP Class C Certified Production', label:'Badge Text', type:'text' },
    { section:'hero', key:'title_line1', value:'Prepared Microbiology', label:'Title Line 1', type:'text' },
    { section:'hero', key:'title_line2', value:'Culture Media Manufacturer', label:'Title Line 2 (highlighted)', type:'text' },
    { section:'hero', key:'desc', value:'CE-marked and pharmacopeia-compliant prepared culture media for clinical diagnostics, industrial microbiology and environmental control. Global supply to pharmaceutical, food, cosmetic and healthcare sectors.', label:'Description', type:'textarea' },
    { section:'hero', key:'cta1', value:'Browse Products', label:'Button 1 Text', type:'text' },
    { section:'hero', key:'cta2', value:'Request a Quote', label:'Button 2 Text', type:'text' },
    { section:'hero', key:'m1_val', value:'20', label:'Metric 1 Value', type:'text' },
    { section:'hero', key:'m1_unit', value:'+', label:'Metric 1 Unit', type:'text' },
    { section:'hero', key:'m1_lbl', value:'Years of Experience', label:'Metric 1 Label', type:'text' },
    { section:'hero', key:'m2_val', value:'500', label:'Metric 2 Value', type:'text' },
    { section:'hero', key:'m2_unit', value:'+', label:'Metric 2 Unit', type:'text' },
    { section:'hero', key:'m2_lbl', value:'Product Formulations', label:'Metric 2 Label', type:'text' },
    { section:'hero', key:'m3_val', value:'30', label:'Metric 3 Value', type:'text' },
    { section:'hero', key:'m3_unit', value:'+', label:'Metric 3 Unit', type:'text' },
    { section:'hero', key:'m3_lbl', value:'Countries Exported', label:'Metric 3 Label', type:'text' },
    { section:'hero', key:'m4_val', value:'99', label:'Metric 4 Value', type:'text' },
    { section:'hero', key:'m4_unit', value:'%', label:'Metric 4 Unit', type:'text' },
    { section:'hero', key:'m4_lbl', value:'Customer Satisfaction', label:'Metric 4 Label', type:'text' },
    { section:'about', key:'label', value:'About Us', label:'Section Label', type:'text' },
    { section:'about', key:'title_line1', value:'Global Standard in', label:'Title Line 1', type:'text' },
    { section:'about', key:'title_line2', value:'Prepared Culture Media', label:'Title Line 2', type:'text' },
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
    { section:'contact', key:'label', value:'Contact', label:'Section Label', type:'text' },
    { section:'contact', key:'title', value:'Get In Touch For a Quote or Information', label:'Title', type:'text' },
    { section:'contact', key:'desc', value:'Our team is always here for product catalogs, custom formulation requests or technical support.', label:'Description', type:'textarea' },
    { section:'contact', key:'email', value:'info@innomedlifesci.com', label:'Email Address', type:'email' },
    { section:'contact', key:'phone', value:'+90 543 769 54 50', label:'Phone Number', type:'text' },
    { section:'contact', key:'address', value:'Aşağı Dudullu Mah., Alemdağ Cad., Yavuz İş Hanı No:511/2, Ümraniye, İstanbul', label:'Address', type:'textarea' },
    { section:'contact', key:'hours', value:'Mon – Fri: 09:00 – 18:00', label:'Working Hours', type:'text' },
    { section:'footer', key:'tagline', value:'Global standard in prepared microbiology culture media. Istanbul, Turkey.', label:'Tagline', type:'text' },
    { section:'footer', key:'copyright', value:'© 2025 Innomed Life Sciences. All rights reserved.', label:'Copyright Text', type:'text' },
  ]);
  console.log('✅ Site content seeded.');
}

module.exports = db;
