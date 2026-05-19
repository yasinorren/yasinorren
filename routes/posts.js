const router = require('express').Router();
const db     = require('../database/db');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { sanitizeText, validatePostContent, extractHashtags, extractMentions } = require('../middleware/validate');

function formatPost(p, viewerId) {
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
    media_urls:    safeParseJSON(p.media_urls, []),
    media_type:    p.media_type,
    post_type:     p.post_type,
    hashtags:      safeParseJSON(p.hashtags, []),
    mentions:      safeParseJSON(p.mentions, []),
    location:      p.location,
    visibility:    p.visibility,
    like_count:    p.like_count,
    comment_count: p.comment_count,
    share_count:   p.share_count,
    view_count:    p.view_count,
    is_edited:     !!p.is_edited,
    is_liked:      !!p.is_liked,
    is_bookmarked: !!p.is_bookmarked,
    created_at:    p.created_at,
    updated_at:    p.updated_at,
  };
}

function safeParseJSON(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}

const postSelect = (viewerId) => `
  SELECT p.*,
    u.username, u.display_name, u.avatar_url, u.is_verified,
    (SELECT 1 FROM likes WHERE user_id = ${viewerId} AND post_id = p.id) AS is_liked,
    (SELECT 1 FROM bookmarks WHERE user_id = ${viewerId} AND post_id = p.id) AS is_bookmarked
  FROM posts p JOIN users u ON u.id = p.user_id
`;

/* ─── POST /api/posts ─── */
router.post('/', requireAuth, (req, res) => {
  let { content, media_urls, media_type, location, visibility } = req.body;

  content = sanitizeText(content || '', 5000);
  const mediaArr = Array.isArray(media_urls) ? media_urls.slice(0, 10) : [];
  if (!content && !mediaArr.length) {
    return res.status(400).json({ error: 'Post must have content or media.' });
  }

  const err = validatePostContent(content || 'media');
  if (err && !mediaArr.length) return res.status(400).json({ error: err });

  const hashtags  = extractHashtags(content);
  const mentions  = extractMentions(content);
  const safeVis   = ['public', 'followers', 'private'].includes(visibility) ? visibility : 'public';
  const safeMedia = ['none', 'image', 'video', 'audio'].includes(media_type) ? media_type : 'none';

  const result = db.prepare(`
    INSERT INTO posts (user_id, content, media_urls, media_type, post_type, hashtags, mentions, location, visibility)
    VALUES (?, ?, ?, ?, 'post', ?, ?, ?, ?)
  `).run(
    req.user.id, content, JSON.stringify(mediaArr), safeMedia,
    JSON.stringify(hashtags), JSON.stringify(mentions),
    sanitizeText(location || '', 100), safeVis,
  );

  /* Update user post count */
  db.prepare('UPDATE users SET post_count = post_count + 1 WHERE id = ?').run(req.user.id);

  /* Update/insert hashtags */
  for (const tag of hashtags) {
    db.prepare('INSERT OR IGNORE INTO hashtags (name) VALUES (?)').run(tag);
    const h = db.prepare('SELECT id FROM hashtags WHERE name = ?').get(tag);
    if (h) {
      db.prepare('INSERT OR IGNORE INTO post_hashtags VALUES (?, ?)').run(result.lastInsertRowid, h.id);
      db.prepare('UPDATE hashtags SET post_count = post_count + 1 WHERE id = ?').run(h.id);
    }
  }

  /* Mention notifications */
  for (const mention of mentions) {
    const mentioned = db.prepare('SELECT id FROM users WHERE username = ?').get(mention);
    if (mentioned && mentioned.id !== req.user.id) {
      db.prepare('INSERT INTO notifications (user_id, actor_id, type, entity_type, entity_id, message) VALUES (?, ?, ?, ?, ?, ?)')
        .run(mentioned.id, req.user.id, 'mention', 'post', result.lastInsertRowid, 'mentioned you in a post');
    }
  }

  const post = db.prepare(`${postSelect(req.user.id)} WHERE p.id = ?`).get(result.lastInsertRowid);
  res.status(201).json({ post: formatPost(post, req.user.id) });
});

/* ─── GET /api/posts/:id ─── */
router.get('/:id', optionalAuth, (req, res) => {
  const viewerId = req.user?.id || 0;
  const post = db.prepare(`${postSelect(viewerId)} WHERE p.id = ? AND p.post_type = 'post'`).get(+req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found.' });

  db.prepare('UPDATE posts SET view_count = view_count + 1 WHERE id = ?').run(post.id);
  res.json({ post: formatPost(post, viewerId) });
});

/* ─── PATCH /api/posts/:id ─── */
router.patch('/:id', requireAuth, (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ? AND user_id = ?').get(+req.params.id, req.user.id);
  if (!post) return res.status(404).json({ error: 'Post not found or not yours.' });

  const content = sanitizeText(req.body.content || post.content, 5000);
  const hashtags = extractHashtags(content);
  const mentions = extractMentions(content);

  db.prepare(`
    UPDATE posts SET content = ?, hashtags = ?, mentions = ?, is_edited = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(content, JSON.stringify(hashtags), JSON.stringify(mentions), post.id);

  const updated = db.prepare(`${postSelect(req.user.id)} WHERE p.id = ?`).get(post.id);
  res.json({ post: formatPost(updated, req.user.id) });
});

/* ─── DELETE /api/posts/:id ─── */
router.delete('/:id', requireAuth, (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ? AND user_id = ?').get(+req.params.id, req.user.id);
  if (!post) return res.status(404).json({ error: 'Post not found or not yours.' });

  db.prepare('DELETE FROM posts WHERE id = ?').run(post.id);
  db.prepare('UPDATE users SET post_count = MAX(0, post_count - 1) WHERE id = ?').run(req.user.id);
  res.json({ message: 'Post deleted.' });
});

/* ─── POST /api/posts/:id/like ─── */
router.post('/:id/like', requireAuth, (req, res) => {
  const postId = +req.params.id;
  const post   = db.prepare('SELECT id, user_id FROM posts WHERE id = ?').get(postId);
  if (!post) return res.status(404).json({ error: 'Post not found.' });

  try {
    db.prepare('INSERT INTO likes (user_id, post_id) VALUES (?, ?)').run(req.user.id, postId);
  } catch {
    return res.status(400).json({ error: 'Already liked.' });
  }

  db.prepare('UPDATE posts SET like_count = like_count + 1 WHERE id = ?').run(postId);

  if (post.user_id !== req.user.id) {
    db.prepare('INSERT INTO notifications (user_id, actor_id, type, entity_type, entity_id, message) VALUES (?, ?, ?, ?, ?, ?)')
      .run(post.user_id, req.user.id, 'like', 'post', postId, 'liked your post');
  }

  res.json({ liked: true, like_count: db.prepare('SELECT like_count FROM posts WHERE id = ?').get(postId).like_count });
});

/* ─── DELETE /api/posts/:id/like ─── */
router.delete('/:id/like', requireAuth, (req, res) => {
  const postId = +req.params.id;
  const result = db.prepare('DELETE FROM likes WHERE user_id = ? AND post_id = ?').run(req.user.id, postId);
  if (!result.changes) return res.status(400).json({ error: 'Not liked.' });

  db.prepare('UPDATE posts SET like_count = MAX(0, like_count - 1) WHERE id = ?').run(postId);
  res.json({ liked: false, like_count: db.prepare('SELECT like_count FROM posts WHERE id = ?').get(postId).like_count });
});

/* ─── GET /api/posts/:id/likes ─── */
router.get('/:id/likes', optionalAuth, (req, res) => {
  const limit  = Math.min(+req.query.limit || 20, 50);
  const offset = +req.query.offset || 0;
  const rows = db.prepare(`
    SELECT u.id, u.username, u.display_name, u.avatar_url, u.is_verified
    FROM likes l JOIN users u ON u.id = l.user_id
    WHERE l.post_id = ? ORDER BY l.created_at DESC LIMIT ? OFFSET ?
  `).all(+req.params.id, limit, offset);
  res.json({ users: rows });
});

/* ─── GET /api/posts/:id/comments ─── */
router.get('/:id/comments', optionalAuth, (req, res) => {
  const limit  = Math.min(+req.query.limit || 20, 50);
  const offset = +req.query.offset || 0;
  const viewerId = req.user?.id || 0;

  const rows = db.prepare(`
    SELECT c.*, u.username, u.display_name, u.avatar_url, u.is_verified,
      (SELECT 1 FROM comment_likes WHERE user_id = ? AND comment_id = c.id) AS is_liked
    FROM comments c JOIN users u ON u.id = c.user_id
    WHERE c.post_id = ? AND c.parent_id IS NULL
    ORDER BY c.created_at ASC LIMIT ? OFFSET ?
  `).all(viewerId, +req.params.id, limit, offset);

  /* Attach replies (level-1 only) */
  const withReplies = rows.map(c => {
    const replies = db.prepare(`
      SELECT c2.*, u.username, u.display_name, u.avatar_url, u.is_verified,
        (SELECT 1 FROM comment_likes WHERE user_id = ? AND comment_id = c2.id) AS is_liked
      FROM comments c2 JOIN users u ON u.id = c2.user_id
      WHERE c2.parent_id = ? ORDER BY c2.created_at ASC LIMIT 5
    `).all(viewerId, c.id);
    return { ...c, replies };
  });

  res.json({ comments: withReplies });
});

/* ─── POST /api/posts/:id/comments ─── */
router.post('/:id/comments', requireAuth, (req, res) => {
  const postId   = +req.params.id;
  const post     = db.prepare('SELECT id, user_id FROM posts WHERE id = ?').get(postId);
  if (!post) return res.status(404).json({ error: 'Post not found.' });

  const content  = sanitizeText(req.body.content || '', 1000);
  if (!content)  return res.status(400).json({ error: 'Comment cannot be empty.' });

  const parentId = req.body.parent_id ? +req.body.parent_id : null;

  const result = db.prepare('INSERT INTO comments (post_id, user_id, parent_id, content) VALUES (?, ?, ?, ?)')
    .run(postId, req.user.id, parentId, content);

  db.prepare('UPDATE posts SET comment_count = comment_count + 1 WHERE id = ?').run(postId);

  if (post.user_id !== req.user.id) {
    db.prepare('INSERT INTO notifications (user_id, actor_id, type, entity_type, entity_id, message) VALUES (?, ?, ?, ?, ?, ?)')
      .run(post.user_id, req.user.id, 'comment', 'post', postId, 'commented on your post');
  }

  const comment = db.prepare(`
    SELECT c.*, u.username, u.display_name, u.avatar_url, u.is_verified, 0 AS is_liked
    FROM comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json({ comment });
});

/* ─── DELETE /api/posts/comments/:cid ─── */
router.delete('/comments/:cid', requireAuth, (req, res) => {
  const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(+req.params.cid);
  if (!comment) return res.status(404).json({ error: 'Comment not found.' });
  if (comment.user_id !== req.user.id) return res.status(403).json({ error: 'Not your comment.' });

  db.prepare('DELETE FROM comments WHERE id = ?').run(comment.id);
  db.prepare('UPDATE posts SET comment_count = MAX(0, comment_count - 1) WHERE id = ?').run(comment.post_id);
  res.json({ message: 'Comment deleted.' });
});

/* ─── POST /api/posts/comments/:cid/like ─── */
router.post('/comments/:cid/like', requireAuth, (req, res) => {
  try {
    db.prepare('INSERT INTO comment_likes (user_id, comment_id) VALUES (?, ?)').run(req.user.id, +req.params.cid);
    db.prepare('UPDATE comments SET like_count = like_count + 1 WHERE id = ?').run(+req.params.cid);
    res.json({ liked: true });
  } catch {
    res.status(400).json({ error: 'Already liked.' });
  }
});

/* ─── DELETE /api/posts/comments/:cid/like ─── */
router.delete('/comments/:cid/like', requireAuth, (req, res) => {
  const r = db.prepare('DELETE FROM comment_likes WHERE user_id = ? AND comment_id = ?').run(req.user.id, +req.params.cid);
  if (r.changes) db.prepare('UPDATE comments SET like_count = MAX(0, like_count - 1) WHERE id = ?').run(+req.params.cid);
  res.json({ liked: false });
});

/* ─── POST /api/posts/:id/bookmark ─── */
router.post('/:id/bookmark', requireAuth, (req, res) => {
  try {
    db.prepare('INSERT INTO bookmarks (user_id, post_id) VALUES (?, ?)').run(req.user.id, +req.params.id);
    res.json({ bookmarked: true });
  } catch {
    res.status(400).json({ error: 'Already bookmarked.' });
  }
});

/* ─── DELETE /api/posts/:id/bookmark ─── */
router.delete('/:id/bookmark', requireAuth, (req, res) => {
  db.prepare('DELETE FROM bookmarks WHERE user_id = ? AND post_id = ?').run(req.user.id, +req.params.id);
  res.json({ bookmarked: false });
});

/* ─── GET /api/posts/bookmarks ─── */
router.get('/bookmarks/all', requireAuth, (req, res) => {
  const limit  = Math.min(+req.query.limit || 20, 50);
  const offset = +req.query.offset || 0;

  const rows = db.prepare(`
    ${postSelect(req.user.id)}
    WHERE p.id IN (SELECT post_id FROM bookmarks WHERE user_id = ?)
      AND p.post_type = 'post'
    ORDER BY b.created_at DESC LIMIT ? OFFSET ?
  `.replace('FROM posts p', 'FROM posts p JOIN bookmarks b ON b.post_id = p.id AND b.user_id = ?'))
    .all(req.user.id, req.user.id, limit, offset);

  res.json({ posts: rows.map(p => formatPost(p, req.user.id)) });
});

/* ─── GET /api/posts/user/:userId ─── */
router.get('/user/:userId', optionalAuth, (req, res) => {
  const limit  = Math.min(+req.query.limit || 12, 30);
  const offset = +req.query.offset || 0;
  const viewerId = req.user?.id || 0;

  const rows = db.prepare(`
    ${postSelect(viewerId)}
    WHERE p.user_id = ? AND p.post_type = 'post'
      AND (p.visibility = 'public' OR p.user_id = ${viewerId})
    ORDER BY p.created_at DESC LIMIT ? OFFSET ?
  `).all(+req.params.userId, limit, offset);

  res.json({ posts: rows.map(p => formatPost(p, viewerId)) });
});

/* ─── POST /api/posts/:id/report ─── */
router.post('/:id/report', requireAuth, (req, res) => {
  const { reason, description } = req.body;
  if (!reason) return res.status(400).json({ error: 'Reason required.' });
  db.prepare('INSERT INTO reports (reporter_id, entity_type, entity_id, reason, description) VALUES (?, ?, ?, ?, ?)')
    .run(req.user.id, 'post', +req.params.id, sanitizeText(reason, 100), sanitizeText(description || '', 500));
  res.json({ message: 'Report submitted.' });
});

module.exports = router;
