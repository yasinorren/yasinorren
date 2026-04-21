const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

// ── Auto-create .env if missing ───────────────────────────────────────────────
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  const secret = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(envPath,
    `PORT=3000\nJWT_SECRET=${secret}\nADMIN_USERNAME=admin\nADMIN_PASSWORD=Innomed2024!\n`,
    'utf8'
  );
  console.log('✅ .env dosyası otomatik oluşturuldu.');
}

require('dotenv').config();

const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// ── Security headers (Helmet) ─────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'"],
      styleSrc:   ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc:    ["'self'", 'https://fonts.gstatic.com'],
      imgSrc:     ["'self'", 'data:', 'blob:', '*'],
      connectSrc: ["'self'"],
    }
  }
}));

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
  : ['http://localhost:3000', 'http://127.0.0.1:3000'];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('CORS: origin not allowed'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
}));

// ── Rate limiting ─────────────────────────────────────────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Çok fazla giriş denemesi. 15 dakika sonra tekrar deneyin.' },
});

const inquiryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 15,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Çok fazla istek. Lütfen daha sonra tekrar deneyin.' },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, max: 300,
  standardHeaders: true, legacyHeaders: false,
});

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// ── Rate limiters ─────────────────────────────────────────────────────────────
app.use('/api', apiLimiter);
app.use('/api/auth/login', loginLimiter);

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/products',   require('./routes/products'));
app.use('/api/inquiries',  inquiryLimiter, require('./routes/inquiries'));
app.use('/api/sales',      require('./routes/sales'));
app.use('/api/content',    require('./routes/content'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/sterility',  require('./routes/sterility'));
app.use('/api/orders',     require('./routes/orders'));
app.use('/api/upload',     require('./routes/upload'));

// ── SPA Fallbacks ─────────────────────────────────────────────────────────────
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public/admin/index.html')));
app.get('*',      (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 Innomed Life Sciences`);
  console.log(`   Website : http://localhost:${PORT}`);
  console.log(`   Admin   : http://localhost:${PORT}/admin`);
  console.log(`   Login   → admin / Innomed2024!\n`);
});
