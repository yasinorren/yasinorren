const router = require('express').Router();
const db = require('../database/db');
const { authenticate } = require('../middleware/auth');

// ─── STATIK ROTALAR (/:id wildcard'ından ÖNCE olmalı) ────────────────────────

// GET /api/articles
router.get('/', (req, res) => {
  const { category, q, page = 1, limit = 12 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let where = "a.status = 'approved'";
  const params = [];

  if (category) {
    where += ' AND c.slug = ?';
    params.push(category);
  }
  if (q) {
    where += ' AND (a.title LIKE ? OR a.summary LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
  }

  const sql = `
    SELECT a.id, a.title, a.summary, a.cover_url, a.views, a.created_at,
           u.username AS author, u.id AS author_id,
           c.name AS category, c.slug AS category_slug
    FROM articles a
    JOIN users u ON u.id = a.author_id
    LEFT JOIN categories c ON c.id = a.category_id
    WHERE ${where}
    ORDER BY a.created_at DESC
    LIMIT ? OFFSET ?
  `;
  const countSql = `
    SELECT COUNT(*) as total FROM articles a
    LEFT JOIN categories c ON c.id = a.category_id
    WHERE ${where}
  `;

  const articles = db.prepare(sql).all(...params, parseInt(limit), offset);
  const { total } = db.prepare(countSql).get(...params);
  res.json({ articles, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
});

// GET /api/articles/categories
router.get('/categories', (req, res) => {
  const cats = db.prepare('SELECT * FROM categories ORDER BY name').all();
  res.json(cats);
});

// GET /api/articles/stats
router.get('/stats', (req, res) => {
  const stats = {
    totalArticles: db.prepare("SELECT COUNT(*) as c FROM articles WHERE status='approved'").get().c,
    totalUsers:    db.prepare("SELECT COUNT(*) as c FROM users").get().c,
    totalViews:    db.prepare("SELECT COALESCE(SUM(views),0) as c FROM articles WHERE status='approved'").get().c,
    totalComments: db.prepare("SELECT COUNT(*) as c FROM comments WHERE status='approved'").get().c,
  };
  res.json(stats);
});

// GET /api/articles/trending
router.get('/trending', (req, res) => {
  const articles = db.prepare(`
    SELECT a.id, a.title, a.summary, a.views, a.created_at,
           u.username AS author, c.name AS category,
           (SELECT COUNT(*) FROM likes l WHERE l.article_id = a.id) AS likes_count
    FROM articles a
    JOIN users u ON u.id = a.author_id
    LEFT JOIN categories c ON c.id = a.category_id
    WHERE a.status = 'approved'
    ORDER BY a.views DESC, a.created_at DESC
    LIMIT 5
  `).all();
  res.json(articles);
});

// GET /api/articles/user/mine
router.get('/user/mine', authenticate, (req, res) => {
  const articles = db.prepare(`
    SELECT a.id, a.title, a.summary, a.status, a.views, a.created_at, a.reject_reason,
           c.name AS category
    FROM articles a
    LEFT JOIN categories c ON c.id = a.category_id
    WHERE a.author_id = ?
    ORDER BY a.created_at DESC
  `).all(req.user.id);
  res.json(articles);
});

// GET /api/articles/user/bookmarks
router.get('/user/bookmarks', authenticate, (req, res) => {
  const articles = db.prepare(`
    SELECT a.id, a.title, a.summary, a.views, a.created_at,
           u.username AS author, c.name AS category, b.created_at AS bookmarked_at
    FROM bookmarks b
    JOIN articles a ON a.id = b.article_id
    JOIN users u ON u.id = a.author_id
    LEFT JOIN categories c ON c.id = a.category_id
    WHERE b.user_id = ? AND a.status = 'approved'
    ORDER BY b.created_at DESC
  `).all(req.user.id);
  res.json(articles);
});

// DELETE /api/articles/comments/:id
router.delete('/comments/:id', authenticate, (req, res) => {
  const comment = db.prepare('SELECT * FROM comments WHERE id=?').get(req.params.id);
  if (!comment) return res.status(404).json({ error: 'Yorum bulunamadı.' });
  const canDelete = comment.user_id === req.user.id || ['moderator', 'admin'].includes(req.user.role);
  if (!canDelete) return res.status(403).json({ error: 'Bu yorumu silemezsiniz.' });
  db.prepare('DELETE FROM comments WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ─── DİNAMİK ROTALAR ─────────────────────────────────────────────────────────

// GET /api/articles/:id
router.get('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Geçersiz makale ID.' });

  const article = db.prepare(`
    SELECT a.*, u.username AS author, u.id AS author_id, u.bio AS author_bio,
           c.name AS category, c.slug AS category_slug,
           r.username AS reviewer_name,
           (SELECT COUNT(*) FROM likes l WHERE l.article_id = a.id) AS likes_count
    FROM articles a
    JOIN users u ON u.id = a.author_id
    LEFT JOIN categories c ON c.id = a.category_id
    LEFT JOIN users r ON r.id = a.reviewer_id
    WHERE a.id = ?
  `).get(id);

  if (!article) return res.status(404).json({ error: 'Makale bulunamadı.' });
  if (article.status !== 'approved') {
    return res.status(403).json({ error: 'Bu makale henüz yayınlanmamış.' });
  }

  db.prepare('UPDATE articles SET views = views + 1 WHERE id = ?').run(id);
  article.views += 1;

  const refs     = db.prepare('SELECT * FROM references_list WHERE article_id = ? ORDER BY sort_order').all(id);
  const comments = db.prepare(`
    SELECT cm.id, cm.content, cm.created_at, cm.user_id, u.username FROM comments cm
    JOIN users u ON u.id = cm.user_id
    WHERE cm.article_id = ? AND cm.status = 'approved'
    ORDER BY cm.created_at ASC
  `).all(id);

  let userLiked = false, userBookmarked = false;
  const authHeader = req.headers['authorization'];
  if (authHeader) {
    const jwt    = require('jsonwebtoken');
    const secret = process.env.JWT_SECRET || 'bilim-platformu-secret-2024';
    try {
      const decoded  = jwt.verify(authHeader.replace('Bearer ', ''), secret);
      userLiked      = !!db.prepare('SELECT id FROM likes     WHERE article_id=? AND user_id=?').get(id, decoded.id);
      userBookmarked = !!db.prepare('SELECT id FROM bookmarks WHERE article_id=? AND user_id=?').get(id, decoded.id);
    } catch {}
  }

  res.json({ ...article, references: refs, comments, userLiked, userBookmarked });
});

// GET /api/articles/:id/preview
router.get('/:id/preview', authenticate, (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Geçersiz makale ID.' });

  const article = db.prepare(`
    SELECT a.*, u.username AS author, u.id AS author_id,
           c.name AS category, c.slug AS category_slug
    FROM articles a
    JOIN users u ON u.id = a.author_id
    LEFT JOIN categories c ON c.id = a.category_id
    WHERE a.id = ?
  `).get(id);

  if (!article) return res.status(404).json({ error: 'Makale bulunamadı.' });
  const isOwner = article.author_id === req.user.id;
  const isMod   = ['moderator', 'admin'].includes(req.user.role);
  if (!isOwner && !isMod) return res.status(403).json({ error: 'Erişim reddedildi.' });

  const refs = db.prepare('SELECT * FROM references_list WHERE article_id = ? ORDER BY sort_order').all(id);
  res.json({ ...article, references: refs });
});

// POST /api/articles
router.post('/', authenticate, (req, res) => {
  const { title, summary, content, category_id, cover_url, references } = req.body;
  if (!title || !summary || !content) {
    return res.status(400).json({ error: 'Başlık, özet ve içerik zorunludur.' });
  }

  const result = db.prepare(`
    INSERT INTO articles (title, summary, content, category_id, author_id, cover_url, status)
    VALUES (?, ?, ?, ?, ?, ?, 'pending')
  `).run(title.trim(), summary.trim(), content.trim(), category_id || null, req.user.id, cover_url || '');

  const articleId = result.lastInsertRowid;

  if (Array.isArray(references) && references.length > 0) {
    const ins = db.prepare(`
      INSERT INTO references_list (article_id, authors, title, journal, year, url, doi, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    references.forEach((r, i) => {
      ins.run(articleId, r.authors || '', r.title || '', r.journal || '', r.year || null, r.url || '', r.doi || '', i + 1);
    });
  }

  res.status(201).json({ id: articleId, message: 'Makaleniz moderasyon incelemesine alındı.' });
});

// POST /api/articles/:id/like
router.post('/:id/like', authenticate, (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Geçersiz ID.' });
  const article = db.prepare("SELECT id FROM articles WHERE id=? AND status='approved'").get(id);
  if (!article) return res.status(404).json({ error: 'Makale bulunamadı.' });
  try {
    db.prepare('INSERT INTO likes (article_id, user_id) VALUES (?, ?)').run(id, req.user.id);
    const count = db.prepare('SELECT COUNT(*) as c FROM likes WHERE article_id=?').get(id).c;
    res.json({ liked: true, count });
  } catch {
    return res.status(409).json({ error: 'Zaten beğendiniz.' });
  }
});

// DELETE /api/articles/:id/like
router.delete('/:id/like', authenticate, (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Geçersiz ID.' });
  db.prepare('DELETE FROM likes WHERE article_id=? AND user_id=?').run(id, req.user.id);
  const count = db.prepare('SELECT COUNT(*) as c FROM likes WHERE article_id=?').get(id).c;
  res.json({ liked: false, count });
});

// POST /api/articles/:id/bookmark
router.post('/:id/bookmark', authenticate, (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Geçersiz ID.' });
  const article = db.prepare("SELECT id FROM articles WHERE id=? AND status='approved'").get(id);
  if (!article) return res.status(404).json({ error: 'Makale bulunamadı.' });
  try {
    db.prepare('INSERT INTO bookmarks (article_id, user_id) VALUES (?, ?)').run(id, req.user.id);
    res.json({ bookmarked: true });
  } catch {
    return res.status(409).json({ error: 'Zaten kaydedildi.' });
  }
});

// DELETE /api/articles/:id/bookmark
router.delete('/:id/bookmark', authenticate, (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Geçersiz ID.' });
  db.prepare('DELETE FROM bookmarks WHERE article_id=? AND user_id=?').run(id, req.user.id);
  res.json({ bookmarked: false });
});

// POST /api/articles/:id/comment
router.post('/:id/comment', authenticate, (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Geçersiz ID.' });
  const { content } = req.body;
  if (!content || content.trim().length < 3)
    return res.status(400).json({ error: 'Yorum en az 3 karakter olmalıdır.' });

  const article = db.prepare("SELECT id FROM articles WHERE id = ? AND status = 'approved'").get(id);
  if (!article) return res.status(404).json({ error: 'Makale bulunamadı.' });

  const result = db.prepare('INSERT INTO comments (article_id, user_id, content) VALUES (?, ?, ?)').run(id, req.user.id, content.trim());

  const comment = db.prepare(`
    SELECT cm.id, cm.content, cm.created_at, cm.user_id, u.username
    FROM comments cm JOIN users u ON u.id = cm.user_id WHERE cm.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(comment);
});

module.exports = router;
