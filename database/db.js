require('dotenv').config();
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'trowded.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');

db.exec(`
  /* ─── Users ─── */
  CREATE TABLE IF NOT EXISTS users (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    username              TEXT UNIQUE NOT NULL,
    email                 TEXT UNIQUE NOT NULL,
    password_hash         TEXT NOT NULL,
    display_name          TEXT DEFAULT '',
    bio                   TEXT DEFAULT '',
    avatar_url            TEXT DEFAULT '',
    cover_url             TEXT DEFAULT '',
    website               TEXT DEFAULT '',
    location              TEXT DEFAULT '',
    is_verified           INTEGER DEFAULT 0,
    is_private            INTEGER DEFAULT 0,
    is_active             INTEGER DEFAULT 1,
    two_fa_secret         TEXT DEFAULT NULL,
    two_fa_enabled        INTEGER DEFAULT 0,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until          TEXT DEFAULT NULL,
    last_login            TEXT DEFAULT NULL,
    follower_count        INTEGER DEFAULT 0,
    following_count       INTEGER DEFAULT 0,
    post_count            INTEGER DEFAULT 0,
    created_at            TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at            TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
  CREATE INDEX IF NOT EXISTS idx_users_email    ON users(email);

  /* ─── Refresh Tokens ─── */
  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT UNIQUE NOT NULL,
    device_info TEXT DEFAULT '',
    ip_address  TEXT DEFAULT '',
    expires_at  TEXT NOT NULL,
    created_at  TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_rt_user ON refresh_tokens(user_id);

  /* ─── Posts ─── */
  CREATE TABLE IF NOT EXISTS posts (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content       TEXT DEFAULT '',
    media_urls    TEXT DEFAULT '[]',
    media_type    TEXT DEFAULT 'none',
    post_type     TEXT DEFAULT 'post',
    hashtags      TEXT DEFAULT '[]',
    mentions      TEXT DEFAULT '[]',
    location      TEXT DEFAULT '',
    visibility    TEXT DEFAULT 'public',
    like_count    INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    share_count   INTEGER DEFAULT 0,
    view_count    INTEGER DEFAULT 0,
    is_edited     INTEGER DEFAULT 0,
    expires_at    TEXT DEFAULT NULL,
    created_at    TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at    TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_posts_user    ON posts(user_id);
  CREATE INDEX IF NOT EXISTS idx_posts_type    ON posts(post_type);
  CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);

  /* ─── Likes ─── */
  CREATE TABLE IF NOT EXISTS likes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, post_id)
  );

  CREATE INDEX IF NOT EXISTS idx_likes_post ON likes(post_id);
  CREATE INDEX IF NOT EXISTS idx_likes_user ON likes(user_id);

  /* ─── Comments ─── */
  CREATE TABLE IF NOT EXISTS comments (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id  INTEGER DEFAULT NULL REFERENCES comments(id) ON DELETE CASCADE,
    content    TEXT NOT NULL,
    like_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);

  /* ─── Comment Likes ─── */
  CREATE TABLE IF NOT EXISTS comment_likes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, comment_id)
  );

  /* ─── Follows ─── */
  CREATE TABLE IF NOT EXISTS follows (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    follower_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status       TEXT DEFAULT 'active',
    created_at   TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(follower_id, following_id)
  );

  CREATE INDEX IF NOT EXISTS idx_follows_follower  ON follows(follower_id);
  CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);

  /* ─── Bookmarks ─── */
  CREATE TABLE IF NOT EXISTS bookmarks (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, post_id)
  );

  /* ─── Blocks ─── */
  CREATE TABLE IF NOT EXISTS blocks (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(blocker_id, blocked_id)
  );

  /* ─── Hashtags ─── */
  CREATE TABLE IF NOT EXISTS hashtags (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT UNIQUE NOT NULL,
    post_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS post_hashtags (
    post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    hashtag_id INTEGER NOT NULL REFERENCES hashtags(id) ON DELETE CASCADE,
    PRIMARY KEY(post_id, hashtag_id)
  );

  /* ─── Conversations (DM) ─── */
  CREATE TABLE IF NOT EXISTS conversations (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS conversation_participants (
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_read_at    TEXT DEFAULT NULL,
    PRIMARY KEY(conversation_id, user_id)
  );

  /* ─── Messages ─── */
  CREATE TABLE IF NOT EXISTS messages (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content         TEXT DEFAULT '',
    media_url       TEXT DEFAULT '',
    message_type    TEXT DEFAULT 'text',
    is_deleted      INTEGER DEFAULT 0,
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);

  /* ─── Notifications ─── */
  CREATE TABLE IF NOT EXISTS notifications (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    actor_id    INTEGER DEFAULT NULL REFERENCES users(id) ON DELETE SET NULL,
    type        TEXT NOT NULL,
    entity_type TEXT DEFAULT '',
    entity_id   INTEGER DEFAULT 0,
    message     TEXT DEFAULT '',
    is_read     INTEGER DEFAULT 0,
    created_at  TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id);

  /* ─── Story Views ─── */
  CREATE TABLE IF NOT EXISTS story_views (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    story_id   INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    viewer_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(story_id, viewer_id)
  );

  /* ─── Reports ─── */
  CREATE TABLE IF NOT EXISTS reports (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    reporter_id INTEGER NOT NULL REFERENCES users(id),
    entity_type TEXT NOT NULL,
    entity_id   INTEGER NOT NULL,
    reason      TEXT NOT NULL,
    description TEXT DEFAULT '',
    status      TEXT DEFAULT 'pending',
    created_at  TEXT DEFAULT CURRENT_TIMESTAMP
  );

  /* ─── Security Audit Log ─── */
  CREATE TABLE IF NOT EXISTS security_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER DEFAULT NULL REFERENCES users(id),
    event_type TEXT NOT NULL,
    ip_address TEXT DEFAULT '',
    user_agent TEXT DEFAULT '',
    details    TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  /* ─── Password Reset Tokens ─── */
  CREATE TABLE IF NOT EXISTS password_resets (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT UNIQUE NOT NULL,
    expires_at TEXT NOT NULL,
    used       INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

/* ─── E2EE & security migrations (safe, idempotent) ─── */
const e2eeMigrations = [
  /* E2EE public key — clients upload their ECDH P-256 public key */
  'ALTER TABLE users ADD COLUMN public_key TEXT DEFAULT NULL',
  /* Flag whether a stored message ciphertext is E2EE encrypted */
  'ALTER TABLE messages ADD COLUMN is_encrypted INTEGER DEFAULT 0',
  /* Nonce / IV embedded in ciphertext — kept opaque on server side */
  'ALTER TABLE messages ADD COLUMN cipher_meta TEXT DEFAULT ""',
];

for (const sql of e2eeMigrations) {
  try { db.exec(sql); } catch (_) { /* already exists */ }
}

/* ─── Seed demo users ─── */
const insertUser = db.prepare(`
  INSERT OR IGNORE INTO users
    (username, email, password_hash, display_name, bio, is_verified, follower_count, following_count, post_count)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const demoUsers = [
  ['yasin',    'yasin@trowded.app',    'Trowded2024!', 'Yasin Ören',       'Founder & CEO @Trowded 🚀',            1, 12400, 340, 87],
  ['luna',     'luna@trowded.app',     'Trowded2024!', 'Luna Chen',        'Digital Artist & Designer 🎨✨',        1, 8900,  210, 142],
  ['alex',     'alex@trowded.app',     'Trowded2024!', 'Alex Rivera',      'Travel Photographer 🌍📸',              0, 5600,  890, 234],
  ['maya',     'maya@trowded.app',     'Trowded2024!', 'Maya Johnson',     'Fitness Coach | Nutrition Expert 💪',  0, 3200,  456, 91],
  ['kai',      'kai@trowded.app',      'Trowded2024!', 'Kai Nakamura',     'Full-Stack Developer & Open Source 💻',0, 2100,  178, 56],
  ['sofia',    'sofia@trowded.app',    'Trowded2024!', 'Sofia Martinez',   'Food Blogger 🍳 | Recipe Creator',     0, 7800,  1200,310],
  ['marcus',   'marcus@trowded.app',   'Trowded2024!', 'Marcus Thompson',  'Music Producer 🎧 | Beat Maker',       1, 15000, 500, 189],
  ['aisha',    'aisha@trowded.app',    'Trowded2024!', 'Aisha Okonkwo',    'Climate Activist 🌱 | Speaker',        0, 4300,  267, 73],
  ['demo',     'demo@trowded.app',     'Demo1234!',    'Demo User',        'Testing Trowded! 👋',                  0, 0,     0,   0],
];

for (const [username, email, plainPass, display_name, bio, is_verified, follower_count, following_count, post_count] of demoUsers) {
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (!existing) {
    const hash = bcrypt.hashSync(plainPass, 12);
    insertUser.run(username, email, hash, display_name, bio, is_verified, follower_count, following_count, post_count);
  }
}

/* ─── Seed demo posts ─── */
const seedPosts = () => {
  const count = db.prepare('SELECT COUNT(*) as c FROM posts').get().c;
  if (count > 0) return;

  const getUserId = db.prepare('SELECT id FROM users WHERE username = ?');
  const insertPost = db.prepare(`
    INSERT INTO posts (user_id, content, media_urls, media_type, post_type, hashtags, like_count, comment_count, view_count, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date();
  const hoursAgo = (h) => new Date(now - h * 3600000).toISOString();

  const postData = [
    ['yasin',  'Excited to announce Trowded is LIVE! 🎉 The future of social media is here. Connect, create, and inspire. #Trowded #SocialMedia #Launch', '[]', 'none', 'post', '["Trowded","SocialMedia","Launch"]', 847, 124, 12400, hoursAgo(1)],
    ['luna',   'Just finished this digital painting — 40+ hours of work 🎨 Sometimes the process is more beautiful than the result. What do you think? #DigitalArt #Illustration', '[]', 'none', 'post', '["DigitalArt","Illustration"]', 1203, 89, 8900, hoursAgo(3)],
    ['alex',   'Golden hour in Santorini hits different 🌅 This moment was absolutely worth waking up at 4am for. #Travel #Photography #Greece #GoldenHour', '[]', 'none', 'post', '["Travel","Photography","Greece"]', 2341, 201, 15600, hoursAgo(5)],
    ['marcus', 'New beat just dropped! 🔥🎧 Been working on this one for 3 weeks. The drums are inspired by Afrobeats meets Trap. Link in bio. #Music #Producer #NewMusic', '[]', 'none', 'post', '["Music","Producer","NewMusic"]', 987, 156, 9800, hoursAgo(7)],
    ['maya',   'Morning routine check ✅ 5am wake-up, 30 min meditation, protein smoothie, then 1hr workout. Consistency is everything 💪 What\'s your morning ritual? #Fitness #Wellness', '[]', 'none', 'post', '["Fitness","Wellness","Motivation"]', 643, 98, 5200, hoursAgo(9)],
    ['sofia',  'Homemade pasta from scratch 🍝 The secret? 00 flour + egg yolks only. Knead for 10 minutes, rest for 30. Game changer! Full recipe in comments 👇 #Cooking #FoodBlogger', '[]', 'none', 'post', '["Cooking","FoodBlogger","Recipe"]', 1876, 312, 14300, hoursAgo(11)],
    ['aisha',  'Climate data is terrifying but solutions exist. Thread on what individuals + corporations can do right now 🧵🌱 RT to spread awareness. #ClimateAction #Sustainability', '[]', 'none', 'post', '["ClimateAction","Sustainability"]', 2103, 445, 18900, hoursAgo(14)],
    ['kai',    'Hot take: most software is over-engineered 🔥 Simple code > clever code. Readable > optimized (unless you\'re NASA). Agree? #Programming #SoftwareEngineering', '[]', 'none', 'post', '["Programming","SoftwareEngineering","Dev"]', 1432, 287, 11200, hoursAgo(18)],
    ['luna',   'Color theory thread 🎨 Why do some color combinations feel calming while others feel chaotic? It\'s all about temperature, saturation, and contrast. #Design #ColorTheory', '[]', 'none', 'post', '["Design","ColorTheory","DigitalArt"]', 876, 134, 7600, hoursAgo(22)],
    ['yasin',  'The hardest part of building a startup isn\'t the product — it\'s staying mentally healthy through the uncertainty. Share your coping strategies below 💙 #Startup #MentalHealth', '[]', 'none', 'post', '["Startup","MentalHealth","Entrepreneurship"]', 567, 203, 8900, hoursAgo(26)],
  ];

  const updateCount = db.prepare('UPDATE users SET post_count = post_count + 1 WHERE id = ?');
  for (const [username, content, media_urls, media_type, post_type, hashtags, like_count, comment_count, view_count, created_at] of postData) {
    const user = getUserId.get(username);
    if (user) {
      insertPost.run(user.id, content, media_urls, media_type, post_type, hashtags, like_count, comment_count, view_count, created_at);
      updateCount.run(user.id);
    }
  }

  /* Seed stories (expires 24h from now) */
  const insertStory = db.prepare(`
    INSERT INTO posts (user_id, content, media_urls, media_type, post_type, like_count, view_count, expires_at, created_at)
    VALUES (?, ?, ?, ?, 'story', ?, ?, datetime('now', '+24 hours'), ?)
  `);
  const storyData = [
    ['yasin',  'Launch day vibes 🚀',      90,  1240, hoursAgo(0.5)],
    ['luna',   'Studio session 🎨',         45,  890,  hoursAgo(1)],
    ['alex',   'Morning hike ⛰️',           78,  2100, hoursAgo(2)],
    ['marcus', 'In the booth 🎤',           123, 3400, hoursAgo(3)],
    ['sofia',  'Sunday meal prep 🥗',       56,  1100, hoursAgo(4)],
    ['maya',   'Post-workout glow 💪',       34,  780,  hoursAgo(5)],
    ['aisha',  'Climate rally today 🌱',    67,  1560, hoursAgo(6)],
  ];
  for (const [username, content, like_count, view_count, created_at] of storyData) {
    const user = getUserId.get(username);
    if (user) insertStory.run(user.id, content, '[]', 'none', like_count, view_count, created_at);
  }

  /* Seed follows */
  const insertFollow = db.prepare('INSERT OR IGNORE INTO follows (follower_id, following_id) VALUES (?, ?)');
  const allUsers = db.prepare("SELECT id FROM users WHERE username != 'demo'").all();
  const demoUser = getUserId.get('demo');
  if (demoUser) {
    for (const u of allUsers) {
      if (u.id !== demoUser.id) insertFollow.run(demoUser.id, u.id);
    }
  }

  /* Seed hashtags */
  const insertHashtag = db.prepare('INSERT OR IGNORE INTO hashtags (name, post_count) VALUES (?, ?)');
  const trendingTags = [
    ['Trowded', 1200], ['SocialMedia', 890], ['Photography', 4500], ['DigitalArt', 2300],
    ['Music', 6700], ['Fitness', 5600], ['Travel', 8900], ['Coding', 3400],
    ['Cooking', 7800], ['ClimateAction', 2100], ['Startup', 1800], ['Design', 4200],
  ];
  for (const [name, count] of trendingTags) insertHashtag.run(name, count);

  console.log('Demo data seeded.');
};

seedPosts();

module.exports = db;
