const router = require('express').Router();
const db = require('../database/db');
const { authenticate } = require('../middleware/auth');

// GET /api/articles - list approved articles
router.get('/', (req, res) => {
  const { category, q, page = 1, limit = 12 } = req.query;
  const offset = (page - 1) * limit;

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

  const articles = db.prepare(sql).all(...params, parseInt(limit), parseInt(offset));
  const { total } = db.prepare(countSql).get(...params);
  res.json({ articles, total, page: parseInt(page), pages: Math.ceil(total / limit) });
});

// GET /api/articles/categories
router.get('/categories', (req, res) => {
  const cats = db.prepare('SELECT * FROM categories ORDER BY name').all();
  res.json(cats);
});

// GET /api/articles/:id
router.get('/:id', (req, res) => {
  const article = db.prepare(`
    SELECT a.*, u.username AS author, u.id AS author_id, u.bio AS author_bio,
           c.name AS category, c.slug AS category_slug,
           r.username AS reviewer_name
    FROM articles a
    JOIN users u ON u.id = a.author_id
    LEFT JOIN categories c ON c.id = a.category_id
    LEFT JOIN users r ON r.id = a.reviewer_id
    WHERE a.id = ?
  `).get(req.params.id);

  if (!article) return res.status(404).json({ error: 'Makale bulunamadı.' });
  if (article.status !== 'approved') {
    // allow author, moderators, admins to view pending
    return res.status(403).json({ error: 'Bu makale henüz yayınlanmamış.' });
  }

  // increment views
  db.prepare('UPDATE articles SET views = views + 1 WHERE id = ?').run(article.id);
  article.views += 1;

  const refs = db.prepare('SELECT * FROM references_list WHERE article_id = ? ORDER BY sort_order').all(article.id);
  const comments = db.prepare(`
    SELECT cm.*, u.username FROM comments cm
    JOIN users u ON u.id = cm.user_id
    WHERE cm.article_id = ? AND cm.status = 'approved'
    ORDER BY cm.created_at ASC
  `).all(article.id);

  res.json({ ...article, references: refs, comments });
});

// GET /api/articles/:id/preview (for author/mod)
router.get('/:id/preview', authenticate, (req, res) => {
  const article = db.prepare(`
    SELECT a.*, u.username AS author, u.id AS author_id,
           c.name AS category, c.slug AS category_slug
    FROM articles a
    JOIN users u ON u.id = a.author_id
    LEFT JOIN categories c ON c.id = a.category_id
    WHERE a.id = ?
  `).get(req.params.id);

  if (!article) return res.status(404).json({ error: 'Makale bulunamadı.' });

  const isOwner = article.author_id === req.user.id;
  const isMod = ['moderator', 'admin'].includes(req.user.role);
  if (!isOwner && !isMod) return res.status(403).json({ error: 'Erişim reddedildi.' });

  const refs = db.prepare('SELECT * FROM references_list WHERE article_id = ? ORDER BY sort_order').all(article.id);
  res.json({ ...article, references: refs });
});

// POST /api/articles - submit new article
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
    const insertRef = db.prepare(`
      INSERT INTO references_list (article_id, authors, title, journal, year, url, doi, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    references.forEach((r, i) => {
      insertRef.run(articleId, r.authors || '', r.title || '', r.journal || '', r.year || null, r.url || '', r.doi || '', i + 1);
    });
  }

  res.status(201).json({ id: articleId, message: 'Makaleniz moderasyon incelemesine alındı.' });
});

// GET /api/articles/user/mine - user's own articles
router.get('/user/mine', authenticate, (req, res) => {
  const articles = db.prepare(`
    SELECT a.id, a.title, a.summary, a.status, a.created_at, a.reject_reason,
           c.name AS category
    FROM articles a
    LEFT JOIN categories c ON c.id = a.category_id
    WHERE a.author_id = ?
    ORDER BY a.created_at DESC
  `).all(req.user.id);
  res.json(articles);
});

// POST /api/articles/:id/comments
router.post('/:id/comment', authenticate, (req, res) => {
  const { content } = req.body;
  if (!content || content.trim().length < 3)
    return res.status(400).json({ error: 'Yorum en az 3 karakter olmalıdır.' });

  const article = db.prepare("SELECT id FROM articles WHERE id = ? AND status = 'approved'").get(req.params.id);
  if (!article) return res.status(404).json({ error: 'Makale bulunamadı.' });

  const result = db.prepare(`
    INSERT INTO comments (article_id, user_id, content) VALUES (?, ?, ?)
  `).run(req.params.id, req.user.id, content.trim());

  const comment = db.prepare(`
    SELECT cm.*, u.username FROM comments cm
    JOIN users u ON u.id = cm.user_id WHERE cm.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(comment);
});

module.exports = router;
