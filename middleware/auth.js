const jwt = require('jsonwebtoken');
const db  = require('../database/db');

const JWT_SECRET  = () => process.env.JWT_SECRET;
const JWT_EXPIRES = '15m';

function signAccessToken(payload) {
  return jwt.sign(payload, JWT_SECRET(), { expiresIn: JWT_EXPIRES, algorithm: 'HS256' });
}

function verifyAccessToken(token) {
  return jwt.verify(token, JWT_SECRET(), { algorithms: ['HS256'] });
}

/* Require authenticated user */
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  const token = header.slice(7);
  try {
    const payload = verifyAccessToken(token);
    const user = db.prepare('SELECT id, username, is_active FROM users WHERE id = ?').get(payload.sub);
    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Account not found or disabled.' });
    }
    req.user = { id: user.id, username: user.username };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired.', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid token.' });
  }
}

/* Optional auth — populate req.user if token present */
function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      const payload = verifyAccessToken(header.slice(7));
      const user = db.prepare('SELECT id, username FROM users WHERE id = ? AND is_active = 1').get(payload.sub);
      if (user) req.user = { id: user.id, username: user.username };
    } catch (_) { /* ignore */ }
  }
  next();
}

module.exports = { requireAuth, optionalAuth, signAccessToken, verifyAccessToken };
