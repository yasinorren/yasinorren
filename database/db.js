const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'science.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    username   TEXT    NOT NULL UNIQUE,
    email      TEXT    NOT NULL UNIQUE,
    password   TEXT    NOT NULL,
    role       TEXT    NOT NULL DEFAULT 'user',
    bio        TEXT    DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS categories (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT    NOT NULL UNIQUE,
    slug TEXT    NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS articles (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT    NOT NULL,
    summary     TEXT    NOT NULL,
    content     TEXT    NOT NULL,
    category_id INTEGER REFERENCES categories(id),
    author_id   INTEGER NOT NULL REFERENCES users(id),
    status      TEXT    NOT NULL DEFAULT 'pending',
    cover_url   TEXT    DEFAULT '',
    views       INTEGER DEFAULT 0,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME,
    reviewer_id INTEGER REFERENCES users(id),
    reject_reason TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS references_list (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    authors    TEXT    NOT NULL,
    title      TEXT    NOT NULL,
    journal    TEXT    DEFAULT '',
    year       INTEGER,
    url        TEXT    DEFAULT '',
    doi        TEXT    DEFAULT '',
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS comments (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id),
    content    TEXT    NOT NULL,
    status     TEXT    NOT NULL DEFAULT 'approved',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS moderation_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL REFERENCES articles(id),
    mod_id     INTEGER NOT NULL REFERENCES users(id),
    action     TEXT    NOT NULL,
    note       TEXT    DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed categories
const catCount = db.prepare('SELECT COUNT(*) as c FROM categories').get().c;
if (catCount === 0) {
  const insertCat = db.prepare('INSERT INTO categories (name, slug) VALUES (?, ?)');
  [
    ['Fizik',          'fizik'],
    ['Kimya',          'kimya'],
    ['Biyoloji',       'biyoloji'],
    ['Tıp & Sağlık',   'tip-saglik'],
    ['Astronomi',      'astronomi'],
    ['Matematik',      'matematik'],
    ['Çevre Bilimleri','cevre-bilimleri'],
    ['Teknoloji',      'teknoloji'],
    ['Psikoloji',      'psikoloji'],
    ['Genel Bilim',    'genel-bilim'],
  ].forEach(([n, s]) => insertCat.run(n, s));
}

// Seed admin user
const adminExists = db.prepare("SELECT id FROM users WHERE username = 'admin'").get();
if (!adminExists) {
  const hash = bcrypt.hashSync('Admin2024!', 10);
  db.prepare("INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)").run(
    'admin', 'admin@bilimplatformu.tr', hash, 'admin'
  );

  // Seed a moderator
  const modHash = bcrypt.hashSync('Mod2024!', 10);
  db.prepare("INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)").run(
    'moderator', 'mod@bilimplatformu.tr', modHash, 'moderator'
  );

  // Seed sample articles
  const insertArt = db.prepare(`
    INSERT INTO articles (title, summary, content, category_id, author_id, status)
    VALUES (?, ?, ?, ?, 1, 'approved')
  `);
  const insertRef = db.prepare(`
    INSERT INTO references_list (article_id, authors, title, journal, year, url, doi, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const a1 = insertArt.run(
    'Kara Delikler: Evrenin En Gizemli Nesneleri',
    'Kara deliklerin oluşumu, özellikleri ve evren üzerindeki etkileri üzerine kapsamlı bir inceleme.',
    `<p>Kara delikler, uzay-zamanın, hatta ışığın bile kaçamayacağı kadar güçlü bir kütleçekimsel çekime sahip bölgeleridir. Bu çekim gücü, maddenin olağanüstü yüksek yoğunluklarda biriktiği noktalarda ortaya çıkar.</p>
<h2>Oluşum Süreci</h2>
<p>Devasa yıldızlar ömürlerinin sonunda yakıtlarını tükettiklerinde, dışa doğru iten nükleer tepkime basıncı azalır ve yıldız kendi kütleçekimi altında çöker. Bu çöküş bir süpernova patlaması ile sonuçlanır ve geride yeterince büyük bir kalıntı varsa, kara delik oluşur.</p>
<h2>Olay Ufku</h2>
<p>Kara deliğin sınırı olarak kabul edilen olay ufku, geri dönüşün imkânsız olduğu noktadır. Bu sınırın ötesine geçen hiçbir şey — ne madde ne de ışık — geri dönemez.</p>
<h2>Hawking Işıması</h2>
<p>Teorik fizikçi Stephen Hawking, kara deliklerin saf siyah olmadığını; kuantum etkileri nedeniyle yavaş yavaş ışıma yaptıklarını öne sürdü. Hawking ışıması olarak bilinen bu süreç, kara deliklerin çok uzun zaman dilimlerinde buharlaşabileceğini göstermektedir.</p>`,
    1
  );
  insertRef.run(a1.lastInsertRowid, 'Hawking, S. W.', 'Black hole explosions?', 'Nature', 1974, 'https://doi.org/10.1038/248030a0', '10.1038/248030a0', 1);
  insertRef.run(a1.lastInsertRowid, 'Event Horizon Telescope Collaboration', 'First M87 Event Horizon Telescope Results', 'The Astrophysical Journal Letters', 2019, 'https://doi.org/10.3847/2041-8213/ab0ec7', '10.3847/2041-8213/ab0ec7', 2);

  const a2 = insertArt.run(
    'CRISPR-Cas9: Gen Düzenlemenin Geleceği',
    'CRISPR teknolojisinin tıp ve biyoloji alanındaki uygulamaları ve etik tartışmalar.',
    `<p>CRISPR-Cas9, belirli DNA dizilerini hassas bir şekilde hedefleyip kesmeye olanak tanıyan devrimci bir gen düzenleme teknolojisidir. Bakterilerin doğal bağışıklık sistemi mekanizmasından ilham alınarak geliştirilmiştir.</p>
<h2>Nasıl Çalışır?</h2>
<p>Cas9 proteini, rehber RNA (gRNA) eşliğinde genomda belirli bir diziye yönlenir ve çift zincirli DNA'yı keser. Hücrenin kendi onarım mekanizmaları devreye girerek kesilen bölgeyi tamir eder; bu süreçte gen silinebilir, bozulabilir ya da yeni bir dizi eklenebilir.</p>
<h2>Tıbbi Uygulamalar</h2>
<p>Orak hücreli anemi, talasemi gibi genetik hastalıkların tedavisinde umut verici sonuçlar elde edilmiştir. 2023 yılında FDA, CRISPR tabanlı ilk gen tedavisini onaylamıştır.</p>
<h2>Etik Boyutlar</h2>
<p>İnsan embriyosu üzerinde yapılan gen düzenleme çalışmaları derin etik tartışmalara yol açmaktadır. Kalıtsal değişikliklerin gelecek nesillere aktarılması, bilim camiasında titizlikle ele alınması gereken sorumluluğu beraberinde getirmektedir.</p>`,
    2
  );
  insertRef.run(a2.lastInsertRowid, 'Doudna, J. A. & Charpentier, E.', 'A programmable dual-RNA-guided DNA endonuclease in adaptive bacterial immunity', 'Science', 2012, 'https://doi.org/10.1126/science.1225829', '10.1126/science.1225829', 1);
  insertRef.run(a2.lastInsertRowid, 'Ran, F. A. et al.', 'Genome engineering using the CRISPR-Cas9 system', 'Nature Protocols', 2013, 'https://doi.org/10.1038/nprot.2013.143', '10.1038/nprot.2013.143', 2);
}

module.exports = db;
