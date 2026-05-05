require('dotenv').config();
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'innomed.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role     TEXT DEFAULT 'admin'
  );

  CREATE TABLE IF NOT EXISTS categories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    slug        TEXT UNIQUE NOT NULL,
    description TEXT DEFAULT '',
    image_url   TEXT,
    parent_id   INTEGER REFERENCES categories(id),
    order_index INTEGER DEFAULT 0,
    is_active   INTEGER DEFAULT 1,
    created_at  TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at  TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS category_products (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL REFERENCES categories(id),
    brand       TEXT DEFAULT 'ORGAMİK',
    stock_code  TEXT DEFAULT '',
    stock_name  TEXT NOT NULL,
    purpose     TEXT DEFAULT '',
    description TEXT DEFAULT '',
    image_url   TEXT,
    features    TEXT,
    order_index INTEGER DEFAULT 0,
    is_active   INTEGER DEFAULT 1,
    created_at  TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at  TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS site_content (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    section TEXT NOT NULL,
    key     TEXT NOT NULL,
    value   TEXT DEFAULT '',
    UNIQUE(section, key)
  );

  CREATE TABLE IF NOT EXISTS sterility_codes (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    code         TEXT UNIQUE NOT NULL,
    product_name TEXT DEFAULT '',
    catalog_no   TEXT DEFAULT '',
    batch_no     TEXT DEFAULT '',
    customer     TEXT DEFAULT '',
    invoice_date TEXT DEFAULT '',
    expiry_date  TEXT DEFAULT '',
    result       TEXT DEFAULT 'PASS',
    notes        TEXT DEFAULT '',
    created_at   TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS orders (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    tracking_code  TEXT UNIQUE NOT NULL,
    customer_name  TEXT DEFAULT '',
    customer_email TEXT DEFAULT '',
    status         TEXT DEFAULT 'pending',
    items          TEXT DEFAULT '',
    notes          TEXT DEFAULT '',
    created_at     TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at     TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS inquiries (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT DEFAULT '',
    email        TEXT DEFAULT '',
    phone        TEXT DEFAULT '',
    message      TEXT DEFAULT '',
    product_name TEXT DEFAULT '',
    product_code TEXT DEFAULT '',
    status       TEXT DEFAULT 'new',
    reply        TEXT DEFAULT '',
    created_at   TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed admin user
if (!db.prepare('SELECT id FROM users WHERE username = ?').get('admin')) {
  const pass = process.env.ADMIN_PASS || 'Innomed2024!';
  const hash = bcrypt.hashSync(pass, 10);
  db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run('admin', hash, 'admin');
  console.log('Admin user created.');
}

// Seed default site content
const insertContent = db.prepare('INSERT OR IGNORE INTO site_content (section, key, value) VALUES (?, ?, ?)');
[
  ['site', 'logo_url',  ''],
  ['site', 'site_name', 'Innomed Life Sciences'],
  ['site', 'tagline',   'Advanced Life Sciences Solutions'],
  ['site', 'phone',     '+90 212 000 00 00'],
  ['site', 'email',     'info@innomed.com.tr'],
  ['site', 'address',   'Istanbul, Turkey'],
  ['hero', 'title',     'İleri Yaşam Bilimleri Çözümleri'],
  ['hero', 'subtitle',  'Mikrobiyoloji, enfeksiyon kontrolü ve çevre izleme için yenilikçi tanısal ürünler.'],
].forEach(([s, k, v]) => insertContent.run(s, k, v));

// Migrations: add missing columns safely
const migrations = [
  'ALTER TABLE sterility_codes ADD COLUMN customer_company TEXT DEFAULT ""',
  'ALTER TABLE sterility_codes ADD COLUMN manufacture_date TEXT DEFAULT ""',
  'ALTER TABLE orders ADD COLUMN company       TEXT DEFAULT ""',
  'ALTER TABLE orders ADD COLUMN phone         TEXT DEFAULT ""',
  'ALTER TABLE orders ADD COLUMN product_name  TEXT DEFAULT ""',
  'ALTER TABLE orders ADD COLUMN quantity      INTEGER DEFAULT 1',
  'ALTER TABLE orders ADD COLUMN status_note   TEXT DEFAULT ""',
];
for (const sql of migrations) {
  try { db.exec(sql); } catch (_) { /* column already exists */ }
}

module.exports = db;
