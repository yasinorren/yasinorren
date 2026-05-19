const router = require('express').Router();
const db     = require('../database/db');
const { requireAuth, optionalAuth } = require('../middleware/auth');

function safeJSON(str, fb) { try { return JSON.parse(str); } catch { return fb; } }

function fmt(p, vid) {
  return {
    id:            p.id,
    user: {
      id:           p.user_id,
      username:     p.username,
      display_name: p.display_name || p.username,
      avatar_url:   p.avatar_url,
      is_verified:  !!p.is_verified,
    },
    content:       p.content,
    media_urls:    safeJSON(p.media_urls, []),
    media_type:    p.media_type,
    post_type:     p.post_type,
    hashtags:      safeJSON(p.hashtags, []),
    like_count:    p.like_count,
    comment_count: p.comment_count,
    view_count:    p.view_count,
    is_liked:      !!p.is_liked,
    is_bookmarked: !!p.is_bookmarked,
    created_at:    p.created_at,
  };
}

/* ─── GET /api/feed/home ─── */
router.get('/home', requireAuth, (req, res) => {
  const limit  = Math.min(+req.query.limit || 15, 30);
  const offset = +req.query.offset || 0;
  const uid    = req.user.id;

  const posts = db.prepare(`
    SELECT p.*,
      u.username, u.display_name, u.avatar_url, u.is_verified,
      (SELECT 1 FROM likes WHERE user_id = ? AND post_id = p.id)      AS is_liked,
      (SELECT 1 FROM bookmarks WHERE user_id = ? AND post_id = p.id)  AS is_bookmarked
    FROM posts p
    JOIN users u ON u.id = p.user_id
    WHERE p.post_type = 'post'
      AND p.visibility != 'private'
      AND (
        p.user_id = ?
        OR p.user_id IN (SELECT following_id FROM follows WHERE follower_id = ? AND status = 'active')
      )
      AND p.user_id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = ?)
      AND p.user_id NOT IN (SELECT blocker_id FROM blocks WHERE blocked_id = ?)
    ORDER BY p.created_at DESC
    LIMIT ? OFFSET ?
  `).all(uid, uid, uid, uid, uid, uid, limit, offset);

  res.json({ posts: posts.map(p => fmt(p, uid)), has_more: posts.length === limit });
});

/* ─── GET /api/feed/explore ─── */
router.get('/explore', optionalAuth, (req, res) => {
  const limit  = Math.min(+req.query.limit || 20, 50);
  const offset = +req.query.offset || 0;
  const uid    = req.user?.id || 0;

  const posts = db.prepare(`
    SELECT p.*,
      u.username, u.display_name, u.avatar_url, u.is_verified,
      (SELECT 1 FROM likes WHERE user_id = ? AND post_id = p.id)      AS is_liked,
      (SELECT 1 FROM bookmarks WHERE user_id = ? AND post_id = p.id)  AS is_bookmarked
    FROM posts p
    JOIN users u ON u.id = p.user_id
    WHERE p.post_type = 'post'
      AND p.visibility = 'public'
      AND u.is_active = 1
      AND p.user_id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = ?)
    ORDER BY (p.like_count * 3 + p.comment_count * 5 + p.view_count) DESC, p.created_at DESC
    LIMIT ? OFFSET ?
  `).all(uid, uid, uid, limit, offset);

  res.json({ posts: posts.map(p => fmt(p, uid)), has_more: posts.length === limit });
});

/* ─── GET /api/feed/trending ─── */
router.get('/trending', (req, res) => {
  const tags = db.prepare(`
    SELECT name, post_count FROM hashtags ORDER BY post_count DESC LIMIT 20
  `).all();
  res.json({ hashtags: tags });
});

/* ─── GET /api/feed/hashtag/:tag ─── */
router.get('/hashtag/:tag', optionalAuth, (req, res) => {
  const limit  = Math.min(+req.query.limit || 20, 50);
  const offset = +req.query.offset || 0;
  const uid    = req.user?.id || 0;
  const tag    = req.params.tag.toLowerCase();

  const hashtag = db.prepare('SELECT * FROM hashtags WHERE name = ?').get(tag);
  if (!hashtag) return res.status(404).json({ error: 'Hashtag not found.' });

  const posts = db.prepare(`
    SELECT p.*,
      u.username, u.display_name, u.avatar_url, u.is_verified,
      (SELECT 1 FROM likes WHERE user_id = ? AND post_id = p.id) AS is_liked,
      (SELECT 1 FROM bookmarks WHERE user_id = ? AND post_id = p.id) AS is_bookmarked
    FROM posts p
    JOIN post_hashtags ph ON ph.post_id = p.id
    JOIN hashtags h ON h.id = ph.hashtag_id
    JOIN users u ON u.id = p.user_id
    WHERE h.name = ? AND p.visibility = 'public' AND u.is_active = 1
    ORDER BY p.created_at DESC LIMIT ? OFFSET ?
  `).all(uid, uid, tag, limit, offset);

  res.json({ hashtag, posts: posts.map(p => fmt(p, uid)) });
});

/* ─── GET /api/feed/stories ─── */
router.get('/stories', requireAuth, (req, res) => {
  const uid = req.user.id;

  const stories = db.prepare(`
    SELECT p.*,
      u.username, u.display_name, u.avatar_url, u.is_verified,
      (SELECT COUNT(*) FROM story_views WHERE story_id = p.id) AS view_count,
      (SELECT 1 FROM story_views WHERE story_id = p.id AND viewer_id = ?) AS is_viewed
    FROM posts p
    JOIN users u ON u.id = p.user_id
    WHERE p.post_type = 'story'
      AND (p.expires_at IS NULL OR p.expires_at > CURRENT_TIMESTAMP)
      AND p.visibility = 'public'
      AND u.is_active = 1
      AND p.user_id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = ?)
    ORDER BY is_viewed ASC, p.created_at DESC
    LIMIT 50
  `).all(uid, uid);

  /* Group by user */
  const byUser = {};
  for (const s of stories) {
    if (!byUser[s.user_id]) {
      byUser[s.user_id] = {
        user: {
          id: s.user_id, username: s.username,
          display_name: s.display_name || s.username,
          avatar_url: s.avatar_url, is_verified: !!s.is_verified,
        },
        has_unviewed: false,
        stories: [],
      };
    }
    if (!s.is_viewed) byUser[s.user_id].has_unviewed = true;
    byUser[s.user_id].stories.push({
      id: s.id, content: s.content, media_urls: s.media_urls,
      like_count: s.like_count, view_count: s.view_count,
      is_viewed: !!s.is_viewed, created_at: s.created_at,
    });
  }

  const result = Object.values(byUser).sort((a, b) => b.has_unviewed - a.has_unviewed);
  res.json({ story_groups: result });
});

/* ─── POST /api/feed/stories ─── */
router.post('/stories', requireAuth, (req, res) => {
  const { content, media_urls, media_type } = req.body;
  const { sanitizeText } = require('../middleware/validate');

  const text     = sanitizeText(content || '', 200);
  const mediaArr = Array.isArray(media_urls) ? media_urls.slice(0, 1) : [];

  if (!text && !mediaArr.length) {
    return res.status(400).json({ error: 'Story must have content or media.' });
  }

  const result = db.prepare(`
    INSERT INTO posts (user_id, content, media_urls, media_type, post_type, visibility, expires_at)
    VALUES (?, ?, ?, ?, 'story', 'public', datetime('now', '+24 hours'))
  `).run(req.user.id, text, JSON.stringify(mediaArr), media_type || 'none');

  const story = db.prepare('SELECT * FROM posts WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ story });
});

/* ─── POST /api/feed/stories/:id/view ─── */
router.post('/stories/:id/view', requireAuth, (req, res) => {
  try {
    db.prepare('INSERT INTO story_views (story_id, viewer_id) VALUES (?, ?)').run(+req.params.id, req.user.id);
    db.prepare('UPDATE posts SET view_count = view_count + 1 WHERE id = ?').run(+req.params.id);
  } catch (_) {}
  res.json({ viewed: true });
});

/* ─── GET /api/feed/reels ─── */
router.get('/reels', optionalAuth, (req, res) => {
  const limit  = Math.min(+req.query.limit || 10, 20);
  const offset = +req.query.offset || 0;
  const uid    = req.user?.id || 0;

  /* For demo purposes, return regular posts as "reels" */
  const posts = db.prepare(`
    SELECT p.*,
      u.username, u.display_name, u.avatar_url, u.is_verified,
      (SELECT 1 FROM likes WHERE user_id = ? AND post_id = p.id) AS is_liked
    FROM posts p JOIN users u ON u.id = p.user_id
    WHERE p.post_type = 'post' AND p.visibility = 'public' AND u.is_active = 1
    ORDER BY p.view_count DESC, p.created_at DESC
    LIMIT ? OFFSET ?
  `).all(uid, limit, offset);

  res.json({ reels: posts.map(p => fmt(p, uid)) });
});

module.exports = router;
