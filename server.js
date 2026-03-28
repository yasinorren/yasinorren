require('dotenv').config();

// ── Startup safety check ──────────────────────────────────────────────────────
if (!process.env.JWT_SECRET) {
  console.error('\n❌ FATAL: JWT_SECRET environment variable is not set.');
  console.error('   Copy .env.example to .env and set a strong random secret.\n');
  process.exit(1);
}

const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const rateLimit    = require('express-rate-limit');
const path         = require('path');

const app = express();

// ── Security headers (Helmet) ─────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'"],   // inline scripts needed for admin page
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
    // Allow same-origin requests (no Origin header) and whitelisted origins
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('CORS: origin not allowed'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
}));

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Login: 10 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Çok fazla giriş denemesi. 15 dakika sonra tekrar deneyin.' },
});

// Public inquiry submit: 15 per hour per IP (anti-spam)
const inquiryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Çok fazla istek. Lütfen daha sonra tekrar deneyin.' },
});

// General API: 300 per minute per IP
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// ── Rate limiters applied before routes ──────────────────────────────────────
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
app.use('/api/upload',     require('./routes/upload'));

// ── SPA Fallbacks ─────────────────────────────────────────────────────────────
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public/admin/index.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 Innomed Life Sciences Server running`);
  console.log(`   Website  : http://localhost:${PORT}`);
  console.log(`   Admin    : http://localhost:${PORT}/admin`);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`   Login    → admin / [see .env]\n`);
  }
});
