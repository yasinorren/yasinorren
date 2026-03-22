const router = require('express').Router();
const db = require('../database/db');
const { requireRole } = require('../middleware/auth');

const isMod = requireRole('moderator', 'admin');

// GET /api/moderation/queue - pending articles
router.get('/queue', ...isMod, (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  const articles = db.prepare(`
    SELECT a.id, a.title, a.summary, a.status, a.created_at, a.cover_url,
           u.username AS author, u.email AS author_email,
           c.name AS category
    FROM articles a
    JOIN users u ON u.id = a.author_id
    LEFT JOIN categories c ON c.id = a.category_id
    WHERE a.status = 'pending'
    ORDER BY a.created_at ASC
    LIMIT ? OFFSET ?
  `).all(parseInt(limit), parseInt(offset));

  const { total } = db.prepare("SELECT COUNT(*) as total FROM articles WHERE status = 'pending'").get();
  res.json({ articles, total });
});

// GET /api/moderation/all - all articles with filters
router.get('/all', ...isMod, (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  let where = '1=1';
  const params = [];
  if (status && ['pending', 'approved', 'rejected'].includes(status)) {
    where += ' AND a.status = ?';
    params.push(status);
  }

  const articles = db.prepare(`
    SELECT a.id, a.title, a.status, a.created_at, a.reviewed_at,
           u.username AS author, c.name AS category,
           r.username AS reviewer
    FROM articles a
    JOIN users u ON u.id = a.author_id
    LEFT JOIN categories c ON c.id = a.category_id
    LEFT JOIN users r ON r.id = a.reviewer_id
    WHERE ${where}
    ORDER BY a.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), parseInt(offset));

  const { total } = db.prepare(`
    SELECT COUNT(*) as total FROM articles a WHERE ${where}
  `).get(...params);

  res.json({ articles, total });
});

// POST /api/moderation/:id/approve
router.post('/:id/approve', ...isMod, (req, res) => {
  const article = db.prepare("SELECT id, status FROM articles WHERE id = ?").get(req.params.id);
  if (!article) return res.status(404).json({ error: 'Makale bulunamadı.' });

  db.prepare(`
    UPDATE articles SET status = 'approved', reviewed_at = CURRENT_TIMESTAMP, reviewer_id = ?, reject_reason = ''
    WHERE id = ?
  `).run(req.user.id, article.id);

  db.prepare(`
    INSERT INTO moderation_log (article_id, mod_id, action, note) VALUES (?, ?, 'approve', ?)
  `).run(article.id, req.user.id, req.body.note || '');

  res.json({ message: 'Makale yayınlandı.' });
});

// POST /api/moderation/:id/reject
router.post('/:id/reject', ...isMod, (req, res) => {
  const { reason } = req.body;
  if (!reason || reason.trim().length < 5)
    return res.status(400).json({ error: 'Red gerekçesi en az 5 karakter olmalıdır.' });

  const article = db.prepare("SELECT id FROM articles WHERE id = ?").get(req.params.id);
  if (!article) return res.status(404).json({ error: 'Makale bulunamadı.' });

  db.prepare(`
    UPDATE articles SET status = 'rejected', reviewed_at = CURRENT_TIMESTAMP,
    reviewer_id = ?, reject_reason = ? WHERE id = ?
  `).run(req.user.id, reason.trim(), article.id);

  db.prepare(`
    INSERT INTO moderation_log (article_id, mod_id, action, note) VALUES (?, ?, 'reject', ?)
  `).run(article.id, req.user.id, reason.trim());

  res.json({ message: 'Makale reddedildi.' });
});

// GET /api/moderation/stats
router.get('/stats', ...isMod, (req, res) => {
  const pending  = db.prepare("SELECT COUNT(*) as c FROM articles WHERE status='pending'").get().c;
  const approved = db.prepare("SELECT COUNT(*) as c FROM articles WHERE status='approved'").get().c;
  const rejected = db.prepare("SELECT COUNT(*) as c FROM articles WHERE status='rejected'").get().c;
  const users    = db.prepare("SELECT COUNT(*) as c FROM users").get().c;
  res.json({ pending, approved, rejected, users });
});

// GET /api/moderation/log
router.get('/log', ...isMod, (req, res) => {
  const logs = db.prepare(`
    SELECT ml.*, u.username AS moderator, a.title AS article_title
    FROM moderation_log ml
    JOIN users u ON u.id = ml.mod_id
    JOIN articles a ON a.id = ml.article_id
    ORDER BY ml.created_at DESC
    LIMIT 100
  `).all();
  res.json(logs);
});

// DELETE /api/moderation/comments/:id
router.delete('/comments/:id', ...isMod, (req, res) => {
  db.prepare("UPDATE comments SET status = 'removed' WHERE id = ?").run(req.params.id);
  res.json({ message: 'Yorum kaldırıldı.' });
});

module.exports = router;
