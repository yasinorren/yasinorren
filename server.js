const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const http   = require('http');

/* Auto-create .env */
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  const secret = crypto.randomBytes(64).toString('hex');
  fs.writeFileSync(envPath, `PORT=3000\nJWT_SECRET=${secret}\nNODE_ENV=development\n`);
  console.log('[boot] .env created with secure JWT_SECRET');
}
require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const WebSocket  = require('ws');

const app = express();

/* ─── Security headers ─── */
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'unsafe-inline'"],
      styleSrc:    ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc:     ["'self'", 'https://fonts.gstatic.com'],
      imgSrc:      ["'self'", 'data:', 'blob:', '*'],
      mediaSrc:    ["'self'", 'blob:'],
      connectSrc:  ["'self'", 'ws:', 'wss:'],
      workerSrc:   ["'self'", 'blob:'],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

/* ─── CORS ─── */
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean)
    : '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

/* ─── Rate limiters ─── */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, max: 200,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many requests. Slow down.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 15,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many auth attempts. Try again in 15 minutes.' },
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, max: 20,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Upload limit reached. Try again shortly.' },
});

/* ─── Body parsing ─── */
app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: false, limit: '4mb' }));

/* ─── Static files ─── */
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders(res, filePath) {
    if (filePath.endsWith('.js'))    res.setHeader('Content-Type', 'application/javascript');
    if (filePath.endsWith('.css'))   res.setHeader('Content-Type', 'text/css');
    if (filePath.endsWith('.webp'))  res.setHeader('Content-Type', 'image/webp');
  },
}));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads'), {
  maxAge: '7d',
  setHeaders(res) { res.setHeader('X-Content-Type-Options', 'nosniff'); },
}));

/* ─── Apply rate limiters ─── */
app.use('/api',         apiLimiter);
app.use('/api/auth',    authLimiter);
app.use('/api/upload',  uploadLimiter);

/* ─── Routes ─── */
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/users',         require('./routes/users'));
app.use('/api/posts',         require('./routes/posts'));
app.use('/api/feed',          require('./routes/feed'));
app.use('/api/chat',          require('./routes/chat'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/search',        require('./routes/search'));
app.use('/api/upload',        require('./routes/upload'));

/* ─── Health check ─── */
app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'Trowded Social API', version: '1.0.0' }));

/* ─── SPA fallback ─── */
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

/* ─── Global error handler ─── */
app.use((err, req, res, _next) => {
  console.error('[error]', err.message);
  const status = err.status || 500;
  res.status(status).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error.' : err.message });
});

/* ─── HTTP + WebSocket server ─── */
const PORT   = process.env.PORT || 3000;
const server = http.createServer(app);

const wss = new WebSocket.Server({ server, path: '/ws' });
const wsClients = new Map(); // conversationId → Set of ws connections

wss.on('connection', (ws, req) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);

      /* Authenticate via JWT on first message */
      if (msg.type === 'auth') {
        const { verifyAccessToken } = require('./middleware/auth');
        try {
          const payload = verifyAccessToken(msg.token);
          ws.userId = payload.sub;
          ws.send(JSON.stringify({ type: 'auth_ok' }));
        } catch {
          ws.send(JSON.stringify({ type: 'auth_error', error: 'Invalid token.' }));
          ws.close();
        }
        return;
      }

      if (!ws.userId) { ws.close(); return; }

      /* Subscribe to a conversation channel */
      if (msg.type === 'subscribe' && msg.conversation_id) {
        const db = require('./database/db');
        const ok = db.prepare('SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?')
          .get(+msg.conversation_id, ws.userId);
        if (!ok) { ws.send(JSON.stringify({ type: 'error', error: 'Not a participant.' })); return; }

        const convId = String(msg.conversation_id);
        if (!wsClients.has(convId)) wsClients.set(convId, new Set());
        wsClients.get(convId).add(ws);
        ws.convId = convId;
        ws.send(JSON.stringify({ type: 'subscribed', conversation_id: convId }));
      }

    } catch (_) { /* ignore malformed messages */ }
  });

  ws.on('close', () => {
    if (ws.convId && wsClients.has(ws.convId)) {
      wsClients.get(ws.convId).delete(ws);
    }
  });
});

/* Broadcast to all subscribers of a conversation */
global.wsBroadcast = (conversationId, data) => {
  const clients = wsClients.get(String(conversationId));
  if (!clients) return;
  const payload = JSON.stringify(data);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  }
};

/* Heartbeat: close dead connections every 30s */
setInterval(() => {
  wss.clients.forEach(ws => {
    if (!ws.isAlive) { ws.terminate(); return; }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

server.listen(PORT, () => {
  console.log(`\n🚀 Trowded Social Platform`);
  console.log(`   API:  http://localhost:${PORT}/api/health`);
  console.log(`   App:  http://localhost:${PORT}`);
  console.log(`   Demo: demo / Demo1234!\n`);
});
