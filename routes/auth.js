const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../database/db');
const { authenticate } = require('../middleware/auth');

const SECRET = process.env.JWT_SECRET || 'bilim-platformu-secret-2024';

function makeToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    SECRET,
    { expiresIn: '7d' }
  );
}

// POST /api/auth/register
router.post('/register', (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ error: 'Tüm alanlar zorunludur.' });

  if (password.length < 6)
    return res.status(400).json({ error: 'Şifre en az 6 karakter olmalıdır.' });

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(email))
    return res.status(400).json({ error: 'Geçerli bir e-posta adresi giriniz.' });

  try {
    const hash = bcrypt.hashSync(password, 10);
    const stmt = db.prepare('INSERT INTO users (username, email, password) VALUES (?, ?, ?)');
    const result = stmt.run(username.trim(), email.trim().toLowerCase(), hash);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    res.json({ token: makeToken(user), user: safeUser(user) });
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      const field = e.message.includes('username') ? 'Kullanıcı adı' : 'E-posta';
      return res.status(400).json({ error: `${field} zaten kullanılmakta.` });
    }
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'E-posta ve şifre zorunludur.' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'E-posta veya şifre hatalı.' });

  res.json({ token: makeToken(user), user: safeUser(user) });
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
  res.json(safeUser(user));
});

// PUT /api/auth/profile
router.put('/profile', authenticate, (req, res) => {
  const { bio } = req.body;
  db.prepare('UPDATE users SET bio = ? WHERE id = ?').run(bio || '', req.user.id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json(safeUser(user));
});

function safeUser(u) {
  const { password, ...safe } = u;
  return safe;
}

module.exports = router;
