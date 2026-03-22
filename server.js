require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { secureHeaders, sanitizeBody, rateLimit, limitBodySize } = require('./middleware/security');

const app = express();

// ─── Güvenlik başlıkları (tüm yanıtlar) ──────────────────────────────────────
app.use(secureHeaders);

// ─── CORS: sadece aynı origin'e izin ver (production) ────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://127.0.0.1:3000'];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) cb(null, true);
    else cb(new Error('CORS politikası tarafından engellendi.'));
  },
  credentials: true,
}));

// ─── Body parsing — boyut sınırı ile ─────────────────────────────────────────
app.use(limitBodySize(2_000_000)); // 2 MB max
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '2mb' }));

// ─── XSS koruması: tüm body alanlarını temizle ───────────────────────────────
app.use(sanitizeBody);

// ─── Genel rate limit (tüm API) ───────────────────────────────────────────────
app.use('/api', rateLimit({ windowMs: 60_000, max: 120 }));

// ─── Statik dosyalar ──────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public'), {
  etag: true,
  lastModified: true,
}));

// ─── API Route'ları ───────────────────────────────────────────────────────────
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/articles',   require('./routes/articles'));
app.use('/api/moderation', require('./routes/moderation'));
app.use('/api/admin',      require('./routes/admin'));

// ─── SPA fallback ─────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// ─── Global hata yakalayıcı ───────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ error: 'Sunucu hatası oluştu.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n Bilim Platformu çalışıyor → http://localhost:${PORT}`);
  console.log(` Admin girişi → admin / Admin2024!`);
  console.log(` Moderatör   → moderator / Mod2024!\n`);
});
