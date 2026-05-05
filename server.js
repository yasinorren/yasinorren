const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

// Auto-create .env if missing
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  const secret = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(
    envPath,
    `PORT=3000\nJWT_SECRET=${secret}\nADMIN_PASS=Innomed2024!\n`,
    'utf8'
  );
  console.log('.env file created automatically.');
}

require('dotenv').config();

const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'"],
      styleSrc:   ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc:    ["'self'", 'https://fonts.gstatic.com'],
      imgSrc:     ["'self'", 'data:', 'blob:', '*'],
      connectSrc: ["'self'"],
    },
  },
}));

// CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, max: 300,
  standardHeaders: true, legacyHeaders: false,
});

// Body parsing
app.use(express.json({ limit: '2mb' }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// Rate limiters
app.use('/api', apiLimiter);
app.use('/api/auth/login', loginLimiter);

// Routes
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/upload',     require('./routes/upload'));
app.use('/api/content',    require('./routes/content'));
app.use('/api/sterility',  require('./routes/sterility'));
app.use('/api/orders',     require('./routes/orders'));
app.use('/api/inquiries',  require('./routes/inquiries'));

// SPA fallbacks
app.get('/admin*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html')));
app.get('*',       (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Innomed Life Sciences running on http://localhost:${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/admin`);
  console.log(`Default login: admin / Innomed2024!`);
});
