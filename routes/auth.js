const router   = require('express').Router();
const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');
const speakeasy = require('speakeasy');
const QRCode   = require('qrcode');
const db       = require('../database/db');
const { signAccessToken, requireAuth } = require('../middleware/auth');
const { validateUsername, validateEmail, validatePassword, sanitizeText } = require('../middleware/validate');

const REFRESH_EXPIRES_DAYS = 7;
const MAX_LOGIN_ATTEMPTS   = 5;
const LOCK_MINUTES         = 15;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateRefreshToken() {
  return crypto.randomBytes(48).toString('hex');
}

function logSecurity(userId, eventType, req, details) {
  try {
    db.prepare('INSERT INTO security_log (user_id, event_type, ip_address, user_agent, details) VALUES (?, ?, ?, ?, ?)')
      .run(userId || null, eventType, req.ip, req.get('User-Agent') || '', details || '');
  } catch (_) {}
}

function issueTokenPair(user, req) {
  const accessToken = signAccessToken({ sub: user.id, username: user.username });
  const refreshRaw  = generateRefreshToken();
  const expiresAt   = new Date(Date.now() + REFRESH_EXPIRES_DAYS * 86400000).toISOString();

  db.prepare('INSERT INTO refresh_tokens (user_id, token_hash, device_info, ip_address, expires_at) VALUES (?, ?, ?, ?, ?)')
    .run(user.id, hashToken(refreshRaw), req.get('User-Agent') || '', req.ip, expiresAt);

  return { access_token: accessToken, refresh_token: refreshRaw };
}

function publicUser(u) {
  return {
    id:              u.id,
    username:        u.username,
    email:           u.email,
    display_name:    u.display_name || u.username,
    bio:             u.bio,
    avatar_url:      u.avatar_url,
    cover_url:       u.cover_url,
    website:         u.website,
    location:        u.location,
    is_verified:     !!u.is_verified,
    is_private:      !!u.is_private,
    two_fa_enabled:  !!u.two_fa_enabled,
    follower_count:  u.follower_count,
    following_count: u.following_count,
    post_count:      u.post_count,
    created_at:      u.created_at,
  };
}

/* ─── POST /api/auth/register ─── */
router.post('/register', (req, res) => {
  const { username, email, password, display_name } = req.body;

  const errs = [
    validateUsername(username),
    validateEmail(email),
    validatePassword(password),
  ].filter(Boolean);
  if (errs.length) return res.status(400).json({ error: errs[0] });

  const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?')
    .get(username.toLowerCase(), email.toLowerCase().trim());
  if (existing) return res.status(409).json({ error: 'Username or email already taken.' });

  const hash       = bcrypt.hashSync(password, 12);
  const safeDisplay = sanitizeText(display_name || username, 50);

  const result = db.prepare('INSERT INTO users (username, email, password_hash, display_name) VALUES (?, ?, ?, ?)')
    .run(username.toLowerCase(), email.toLowerCase().trim(), hash, safeDisplay);

  const user   = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
  const tokens = issueTokenPair(user, req);
  logSecurity(user.id, 'register', req);

  res.status(201).json({ user: publicUser(user), ...tokens });
});

/* ─── POST /api/auth/login ─── */
router.post('/login', (req, res) => {
  const { identifier, password, totp_code } = req.body;
  if (!identifier || !password) {
    return res.status(400).json({ error: 'Username/email and password required.' });
  }

  const id   = String(identifier).toLowerCase().trim();
  const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(id, id);

  if (!user) return res.status(401).json({ error: 'Invalid credentials.' });

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const remaining = Math.ceil((new Date(user.locked_until) - Date.now()) / 60000);
    return res.status(429).json({ error: `Account locked. Try again in ${remaining} minute(s).` });
  }

  if (!user.is_active) return res.status(403).json({ error: 'Account disabled. Contact support.' });

  if (!bcrypt.compareSync(password, user.password_hash)) {
    const attempts = (user.failed_login_attempts || 0) + 1;
    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      const lockUntil = new Date(Date.now() + LOCK_MINUTES * 60000).toISOString();
      db.prepare('UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?')
        .run(attempts, lockUntil, user.id);
      logSecurity(user.id, 'account_locked', req);
      return res.status(429).json({ error: `Account locked for ${LOCK_MINUTES} minutes after ${MAX_LOGIN_ATTEMPTS} failed attempts.` });
    }
    db.prepare('UPDATE users SET failed_login_attempts = ? WHERE id = ?').run(attempts, user.id);
    logSecurity(user.id, 'login_failed', req);
    return res.status(401).json({ error: 'Invalid credentials.', attempts_remaining: MAX_LOGIN_ATTEMPTS - attempts });
  }

  if (user.two_fa_enabled && user.two_fa_secret) {
    if (!totp_code) return res.status(200).json({ two_fa_required: true });
    const ok = speakeasy.totp.verify({
      secret: user.two_fa_secret, encoding: 'base32',
      token: String(totp_code).replace(/\s/g, ''), window: 1,
    });
    if (!ok) { logSecurity(user.id, '2fa_failed', req); return res.status(401).json({ error: 'Invalid 2FA code.' }); }
  }

  db.prepare('UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
  const tokens = issueTokenPair(user, req);
  logSecurity(user.id, 'login_success', req);
  res.json({ user: publicUser(user), ...tokens });
});

/* ─── POST /api/auth/refresh ─── */
router.post('/refresh', (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) return res.status(400).json({ error: 'Refresh token required.' });

  const stored = db.prepare(`
    SELECT rt.*, u.id as uid, u.username, u.is_active
    FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id
    WHERE rt.token_hash = ?
  `).get(hashToken(refresh_token));

  if (!stored)            return res.status(401).json({ error: 'Invalid refresh token.' });
  if (!stored.is_active)  return res.status(403).json({ error: 'Account disabled.' });
  if (new Date(stored.expires_at) < new Date()) {
    db.prepare('DELETE FROM refresh_tokens WHERE token_hash = ?').run(hashToken(refresh_token));
    return res.status(401).json({ error: 'Refresh token expired.' });
  }

  db.prepare('DELETE FROM refresh_tokens WHERE token_hash = ?').run(hashToken(refresh_token));
  const user   = db.prepare('SELECT * FROM users WHERE id = ?').get(stored.uid);
  const tokens = issueTokenPair(user, req);
  res.json(tokens);
});

/* ─── POST /api/auth/logout ─── */
router.post('/logout', requireAuth, (req, res) => {
  const { refresh_token } = req.body;
  if (refresh_token) db.prepare('DELETE FROM refresh_tokens WHERE token_hash = ?').run(hashToken(refresh_token));
  logSecurity(req.user.id, 'logout', req);
  res.json({ message: 'Logged out.' });
});

/* ─── POST /api/auth/logout-all ─── */
router.post('/logout-all', requireAuth, (req, res) => {
  db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(req.user.id);
  logSecurity(req.user.id, 'logout_all_devices', req);
  res.json({ message: 'Logged out from all devices.' });
});

/* ─── GET /api/auth/me ─── */
router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  res.json({ user: publicUser(user) });
});

/* ─── POST /api/auth/change-password ─── */
router.post('/change-password', requireAuth, (req, res) => {
  const { current_password, new_password } = req.body;
  const err = validatePassword(new_password || '');
  if (err) return res.status(400).json({ error: err });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(current_password || '', user.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect.' });
  }

  db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(bcrypt.hashSync(new_password, 12), req.user.id);
  db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(req.user.id);
  logSecurity(req.user.id, 'password_changed', req);
  res.json({ message: 'Password changed. Please log in again.' });
});

/* ─── POST /api/auth/2fa/setup ─── */
router.post('/2fa/setup', requireAuth, async (req, res) => {
  const user = db.prepare('SELECT username, two_fa_enabled FROM users WHERE id = ?').get(req.user.id);
  if (user.two_fa_enabled) return res.status(400).json({ error: '2FA already enabled.' });

  const secret = speakeasy.generateSecret({ name: `Trowded:${user.username}`, length: 20 });
  db.prepare('UPDATE users SET two_fa_secret = ? WHERE id = ?').run(secret.base32, req.user.id);

  try {
    const qrDataUrl = await QRCode.toDataURL(secret.otpauth_url);
    res.json({ secret: secret.base32, qr_code: qrDataUrl });
  } catch {
    res.json({ secret: secret.base32 });
  }
});

/* ─── POST /api/auth/2fa/enable ─── */
router.post('/2fa/enable', requireAuth, (req, res) => {
  const { totp_code } = req.body;
  const user = db.prepare('SELECT two_fa_secret, two_fa_enabled FROM users WHERE id = ?').get(req.user.id);
  if (user.two_fa_enabled) return res.status(400).json({ error: '2FA already enabled.' });
  if (!user.two_fa_secret) return res.status(400).json({ error: 'Setup 2FA first.' });

  const ok = speakeasy.totp.verify({
    secret: user.two_fa_secret, encoding: 'base32',
    token: String(totp_code || '').replace(/\s/g, ''), window: 1,
  });
  if (!ok) return res.status(401).json({ error: 'Invalid TOTP code.' });

  db.prepare('UPDATE users SET two_fa_enabled = 1 WHERE id = ?').run(req.user.id);
  logSecurity(req.user.id, '2fa_enabled', req);
  res.json({ message: '2FA enabled.' });
});

/* ─── POST /api/auth/2fa/disable ─── */
router.post('/2fa/disable', requireAuth, (req, res) => {
  const { password, totp_code } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

  if (!bcrypt.compareSync(password || '', user.password_hash)) {
    return res.status(401).json({ error: 'Password incorrect.' });
  }
  if (user.two_fa_enabled) {
    const ok = speakeasy.totp.verify({
      secret: user.two_fa_secret, encoding: 'base32',
      token: String(totp_code || '').replace(/\s/g, ''), window: 1,
    });
    if (!ok) return res.status(401).json({ error: 'Invalid TOTP code.' });
  }
  db.prepare('UPDATE users SET two_fa_enabled = 0, two_fa_secret = NULL WHERE id = ?').run(req.user.id);
  logSecurity(req.user.id, '2fa_disabled', req);
  res.json({ message: '2FA disabled.' });
});

/* ─── GET /api/auth/sessions ─── */
router.get('/sessions', requireAuth, (req, res) => {
  const sessions = db.prepare(
    'SELECT id, device_info, ip_address, created_at, expires_at FROM refresh_tokens WHERE user_id = ? ORDER BY created_at DESC'
  ).all(req.user.id);
  res.json({ sessions });
});

/* ─── DELETE /api/auth/sessions/:id ─── */
router.delete('/sessions/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM refresh_tokens WHERE id = ? AND user_id = ?').run(+req.params.id, req.user.id);
  res.json({ message: 'Session revoked.' });
});

module.exports = router;
