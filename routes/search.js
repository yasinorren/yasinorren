const router = require('express').Router();
const db     = require('../database/db');
const { optionalAuth } = require('../middleware/auth');
const { sanitizeText } = require('../middleware/validate');

/* ─── GET /api/search?q=... ─── */
router.get('/', optionalAuth, (req, res) => {
  const q   = sanitizeText(String(req.query.q || ''), 100).trim();
  const uid = req.user?.id || 0;
  if (q.length < 1) return res.status(400).json({ error: 'Search query required.' });

  const like = `%${q}%`;

  const users = db.prepare(`
    SELECT u.id, u.username, u.display_name, u.avatar_url, u.is_verified, u.follower_count,
      (SELECT 1 FROM follows WHERE follower_id = ? AND following_id = u.id AND status = 'active') AS is_following
    FROM users u
    WHERE (u.username LIKE ? OR u.display_name LIKE ?)
      AND u.is_active = 1
      AND u.id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = ?)
    ORDER BY u.is_verified DESC, u.follower_count DESC
    LIMIT 10
  `).all(uid, like, like, uid);

  const hashtags = db.prepare(`
    SELECT name, post_count FROM hashtags WHERE name LIKE ? ORDER BY post_count DESC LIMIT 8
  `).all(like);

  const posts = db.prepare(`
    SELECT p.id, p.content, p.like_count, p.comment_count, p.created_at,
      u.username, u.display_name, u.avatar_url, u.is_verified,
      (SELECT 1 FROM likes WHERE user_id = ? AND post_id = p.id) AS is_liked
    FROM posts p JOIN users u ON u.id = p.user_id
    WHERE p.content LIKE ? AND p.post_type = 'post' AND p.visibility = 'public'
      AND u.is_active = 1
      AND p.user_id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = ?)
    ORDER BY p.like_count DESC, p.created_at DESC
    LIMIT 10
  `).all(uid, like, uid);

  res.json({ users, hashtags, posts });
});

/* ─── GET /api/search/users?q=... ─── */
router.get('/users', optionalAuth, (req, res) => {
  const q   = sanitizeText(String(req.query.q || ''), 100).trim();
  const uid = req.user?.id || 0;
  const limit  = Math.min(+req.query.limit || 20, 50);
  const offset = +req.query.offset || 0;
  if (!q) return res.json({ users: [] });

  const rows = db.prepare(`
    SELECT u.id, u.username, u.display_name, u.avatar_url, u.is_verified,
      u.follower_count, u.bio,
      (SELECT 1 FROM follows WHERE follower_id = ? AND following_id = u.id AND status = 'active') AS is_following
    FROM users u
    WHERE (u.username LIKE ? OR u.display_name LIKE ?)
      AND u.is_active = 1
      AND u.id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = ?)
    ORDER BY u.is_verified DESC, u.follower_count DESC
    LIMIT ? OFFSET ?
  `).all(uid, `%${q}%`, `%${q}%`, uid, limit, offset);

  res.json({ users: rows });
});

module.exports = router;
