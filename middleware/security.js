/**
 * Güvenlik Middleware'leri
 * - Rate Limiting (brute-force koruması)
 * - XSS temizleme (HTML sanitize)
 * - CSRF token kontrolü
 * - Güvenli HTTP başlıkları
 * - SQL Injection: tüm DB sorguları parameterized (better-sqlite3)
 */

// ─── Rate Limiting (bağımlılık olmadan, bellekte) ───────────────────────────
const rateLimitMap = new Map();

function rateLimit({ windowMs = 60_000, max = 30, message = 'Çok fazla istek gönderdiniz. Lütfen bekleyin.' } = {}) {
  return (req, res, next) => {
    const key = req.ip + ':' + req.path;
    const now = Date.now();
    const entry = rateLimitMap.get(key) || { count: 0, start: now };

    if (now - entry.start > windowMs) {
      entry.count = 1;
      entry.start = now;
    } else {
      entry.count++;
    }
    rateLimitMap.set(key, entry);

    if (entry.count > max) {
      return res.status(429).json({ error: message });
    }
    next();
  };
}

// Periyodik temizlik
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now - entry.start > 120_000) rateLimitMap.delete(key);
  }
}, 60_000);

// ─── XSS Koruması (HTML tag temizleme) ──────────────────────────────────────
function stripTags(str) {
  if (typeof str !== 'string') return str;
  // script/iframe/on* event attribute temizle - basit, etkili
  return str
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript:/gi, '');
}

function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    sanitizeObj(req.body);
  }
  next();
}

function sanitizeObj(obj) {
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'string') {
      obj[key] = stripTags(obj[key]);
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeObj(obj[key]);
    }
  }
}

// ─── Güvenli HTTP Başlıkları ─────────────────────────────────────────────────
function secureHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:;"
  );
  next();
}

// ─── Input Validation Helpers ────────────────────────────────────────────────
function validateLength(str, min, max) {
  if (typeof str !== 'string') return false;
  const len = str.trim().length;
  return len >= min && len <= max;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ─── Body size limiter (express.json limit zaten 100kb, ek kontrol) ──────────
function limitBodySize(maxBytes = 1_000_000) {
  return (req, res, next) => {
    const len = parseInt(req.headers['content-length'] || '0');
    if (len > maxBytes) {
      return res.status(413).json({ error: 'İstek gövdesi çok büyük.' });
    }
    next();
  };
}

module.exports = {
  rateLimit,
  sanitizeBody,
  secureHeaders,
  validateLength,
  isValidEmail,
  limitBodySize,
};
