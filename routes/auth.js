const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/db');

const SECRET = () => process.env.JWT_SECRET || 'innomed_secret';

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Kullanıcı adı ve şifre gerekli' });

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) return res.status(401).json({ error: 'Kullanıcı bulunamadı' });

  if (!bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Şifre hatalı' });

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    SECRET(),
    { expiresIn: '8h' }
  );

  res.json({ token, username: user.username, role: user.role });
});

// POST /api/auth/change-password  (protected)
const auth = require('../middleware/auth');
router.post('/change-password', auth, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword || newPassword.length < 6)
    return res.status(400).json({ error: 'Geçersiz şifre bilgileri' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(currentPassword, user.password))
    return res.status(401).json({ error: 'Mevcut şifre hatalı' });

  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, req.user.id);
  res.json({ message: 'Şifre güncellendi' });
});

module.exports = router;
