const router = require('express').Router();
const bcrypt  = require('bcryptjs');
const db = require('../database/db');
const { requireRole } = require('../middleware/auth');

const isAdmin = requireRole('admin');

// GET /api/admin/users
router.get('/users', ...isAdmin, (req, res) => {
  const users = db.prepare(`
    SELECT id, username, email, role, created_at,
      (SELECT COUNT(*) FROM articles WHERE author_id = users.id) AS article_count
    FROM users ORDER BY created_at DESC
  `).all();
  res.json(users);
});

// PUT /api/admin/users/:id/role
router.put('/users/:id/role', ...isAdmin, (req, res) => {
  const { role } = req.body;
  if (!['user', 'moderator', 'admin'].includes(role))
    return res.status(400).json({ error: 'Geçersiz rol.' });
  if (parseInt(req.params.id) === req.user.id)
    return res.status(400).json({ error: 'Kendi rolünüzü değiştiremezsiniz.' });

  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
  res.json({ message: 'Rol güncellendi.' });
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', ...isAdmin, (req, res) => {
  if (parseInt(req.params.id) === req.user.id)
    return res.status(400).json({ error: 'Kendinizi silemezsiniz.' });
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ message: 'Kullanıcı silindi.' });
});

// DELETE /api/admin/articles/:id
router.delete('/articles/:id', ...isAdmin, (req, res) => {
  db.prepare('DELETE FROM articles WHERE id = ?').run(req.params.id);
  res.json({ message: 'Makale silindi.' });
});

// GET /api/admin/stats
router.get('/stats', ...isAdmin, (req, res) => {
  const totalUsers    = db.prepare("SELECT COUNT(*) as c FROM users").get().c;
  const totalArticles = db.prepare("SELECT COUNT(*) as c FROM articles").get().c;
  const pending       = db.prepare("SELECT COUNT(*) as c FROM articles WHERE status='pending'").get().c;
  const approved      = db.prepare("SELECT COUNT(*) as c FROM articles WHERE status='approved'").get().c;
  const totalComments = db.prepare("SELECT COUNT(*) as c FROM comments").get().c;
  const totalViews    = db.prepare("SELECT SUM(views) as v FROM articles").get().v || 0;
  res.json({ totalUsers, totalArticles, pending, approved, totalComments, totalViews });
});

module.exports = router;
