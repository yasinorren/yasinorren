const router = require('express').Router();
const db     = require('../database/db');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { sanitizeText, validateUrl } = require('../middleware/validate');

function publicProfile(u, viewerId) {
  return {
    id:              u.id,
    username:        u.username,
    display_name:    u.display_name || u.username,
    bio:             u.bio,
    avatar_url:      u.avatar_url,
    cover_url:       u.cover_url,
    website:         u.website,
    location:        u.location,
    is_verified:     !!u.is_verified,
    is_private:      !!u.is_private,
    follower_count:  u.follower_count,
    following_count: u.following_count,
    post_count:      u.post_count,
    created_at:      u.created_at,
    is_following:    !!u.is_following,
    is_followed_by:  !!u.is_followed_by,
    is_blocked:      !!u.is_blocked,
  };
}

/* ─── GET /api/users/suggestions ─── (must come before /:username) */
router.get('/suggestions', requireAuth, (req, res) => {
  const limit = Math.min(+req.query.limit || 10, 20);
  const rows = db.prepare(`
    SELECT u.id, u.username, u.display_name, u.avatar_url, u.is_verified, u.follower_count
    FROM users u
    WHERE u.id != ? AND u.is_active = 1
      AND u.id NOT IN (SELECT following_id FROM follows WHERE follower_id = ?)
      AND u.id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = ?)
    ORDER BY u.follower_count DESC, u.created_at DESC LIMIT ?
  `).all(req.user.id, req.user.id, req.user.id, limit);
  res.json({ users: rows });
});

/* ─── GET /api/users/me/blocked ─── */
router.get('/me/blocked', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT u.id, u.username, u.display_name, u.avatar_url
    FROM blocks b JOIN users u ON u.id = b.blocked_id
    WHERE b.blocker_id = ? ORDER BY b.created_at DESC
  `).all(req.user.id);
  res.json({ users: rows });
});

/* ─── GET /api/users/by-id/:id ─── */
router.get('/by-id/:id', optionalAuth, (req, res) => {
  const viewerId = req.user?.id || 0;
  const row = db.prepare(`
    SELECT u.*,
      (SELECT 1 FROM follows WHERE follower_id = ? AND following_id = u.id AND status = 'active') AS is_following,
      (SELECT 1 FROM follows WHERE follower_id = u.id AND following_id = ? AND status = 'active') AS is_followed_by,
      (SELECT 1 FROM blocks WHERE blocker_id = ? AND blocked_id = u.id) AS is_blocked
    FROM users u WHERE u.id = ? AND u.is_active = 1
  `).get(viewerId, viewerId, viewerId, +req.params.id);
  if (!row) return res.status(404).json({ error: 'User not found.' });
  res.json({ user: publicProfile(row, viewerId) });
});

/* ─── GET /api/users/:username ─── */
router.get('/:username', optionalAuth, (req, res) => {
  const viewerId = req.user?.id || 0;
  const row = db.prepare(`
    SELECT u.*,
      (SELECT 1 FROM follows WHERE follower_id = ? AND following_id = u.id AND status = 'active') AS is_following,
      (SELECT 1 FROM follows WHERE follower_id = u.id AND following_id = ? AND status = 'active') AS is_followed_by,
      (SELECT 1 FROM blocks WHERE blocker_id = ? AND blocked_id = u.id) AS is_blocked
    FROM users u
    WHERE u.username = ? AND u.is_active = 1
  `).get(viewerId, viewerId, viewerId, req.params.username.toLowerCase());

  if (!row) return res.status(404).json({ error: 'User not found.' });

  if (row.is_blocked) return res.status(403).json({ error: 'You have blocked this user.' });

  res.json({ user: publicProfile(row, viewerId) });
});

/* ─── PATCH /api/users/profile ─── */
router.patch('/profile', requireAuth, (req, res) => {
  const { display_name, bio, website, location } = req.body;

  const urlErr = validateUrl(website);
  if (urlErr) return res.status(400).json({ error: urlErr });

  db.prepare(`
    UPDATE users SET
      display_name = COALESCE(?, display_name),
      bio          = COALESCE(?, bio),
      website      = COALESCE(?, website),
      location     = COALESCE(?, location),
      updated_at   = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    display_name ? sanitizeText(display_name, 80) : null,
    bio          ? sanitizeText(bio, 160) : null,
    website      ? sanitizeText(website, 255) : null,
    location     ? sanitizeText(location, 100) : null,
    req.user.id,
  );

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: publicProfile(user, req.user.id) });
});

/* ─── PATCH /api/users/privacy ─── */
router.patch('/privacy', requireAuth, (req, res) => {
  const { is_private } = req.body;
  db.prepare('UPDATE users SET is_private = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(is_private ? 1 : 0, req.user.id);
  res.json({ message: 'Privacy setting updated.' });
});

/* ─── POST /api/users/:id/follow ─── */
router.post('/:id/follow', requireAuth, (req, res) => {
  const targetId = +req.params.id;
  if (targetId === req.user.id) return res.status(400).json({ error: 'Cannot follow yourself.' });

  const blocked = db.prepare('SELECT 1 FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)')
    .get(req.user.id, targetId, targetId, req.user.id);
  if (blocked) return res.status(403).json({ error: 'Cannot follow this user.' });

  const target = db.prepare('SELECT id, is_private FROM users WHERE id = ? AND is_active = 1').get(targetId);
  if (!target) return res.status(404).json({ error: 'User not found.' });

  const exists = db.prepare('SELECT id, status FROM follows WHERE follower_id = ? AND following_id = ?').get(req.user.id, targetId);
  if (exists) {
    if (exists.status === 'active') return res.status(400).json({ error: 'Already following.' });
    return res.status(400).json({ error: 'Follow request already pending.' });
  }

  const status = target.is_private ? 'pending' : 'active';
  db.prepare('INSERT INTO follows (follower_id, following_id, status) VALUES (?, ?, ?)').run(req.user.id, targetId, status);

  if (status === 'active') {
    db.prepare('UPDATE users SET follower_count = follower_count + 1 WHERE id = ?').run(targetId);
    db.prepare('UPDATE users SET following_count = following_count + 1 WHERE id = ?').run(req.user.id);
    db.prepare('INSERT INTO notifications (user_id, actor_id, type, entity_type, entity_id, message) VALUES (?, ?, ?, ?, ?, ?)')
      .run(targetId, req.user.id, 'follow', 'user', req.user.id, 'started following you');
  }

  res.json({ status, message: status === 'pending' ? 'Follow request sent.' : 'Now following.' });
});

/* ─── DELETE /api/users/:id/follow ─── */
router.delete('/:id/follow', requireAuth, (req, res) => {
  const targetId = +req.params.id;
  const follow = db.prepare('SELECT * FROM follows WHERE follower_id = ? AND following_id = ?').get(req.user.id, targetId);
  if (!follow) return res.status(404).json({ error: 'Not following.' });

  db.prepare('DELETE FROM follows WHERE follower_id = ? AND following_id = ?').run(req.user.id, targetId);

  if (follow.status === 'active') {
    db.prepare('UPDATE users SET follower_count = MAX(0, follower_count - 1) WHERE id = ?').run(targetId);
    db.prepare('UPDATE users SET following_count = MAX(0, following_count - 1) WHERE id = ?').run(req.user.id);
  }

  res.json({ message: 'Unfollowed.' });
});

/* ─── GET /api/users/:id/followers ─── */
router.get('/:id/followers', optionalAuth, (req, res) => {
  const limit  = Math.min(+req.query.limit || 20, 50);
  const offset = +req.query.offset || 0;
  const viewerId = req.user?.id || 0;

  const rows = db.prepare(`
    SELECT u.id, u.username, u.display_name, u.avatar_url, u.is_verified,
      (SELECT 1 FROM follows WHERE follower_id = ? AND following_id = u.id AND status = 'active') AS is_following
    FROM follows f
    JOIN users u ON u.id = f.follower_id
    WHERE f.following_id = ? AND f.status = 'active' AND u.is_active = 1
    ORDER BY f.created_at DESC LIMIT ? OFFSET ?
  `).all(viewerId, +req.params.id, limit, offset);

  res.json({ users: rows });
});

/* ─── GET /api/users/:id/following ─── */
router.get('/:id/following', optionalAuth, (req, res) => {
  const limit  = Math.min(+req.query.limit || 20, 50);
  const offset = +req.query.offset || 0;
  const viewerId = req.user?.id || 0;

  const rows = db.prepare(`
    SELECT u.id, u.username, u.display_name, u.avatar_url, u.is_verified,
      (SELECT 1 FROM follows WHERE follower_id = ? AND following_id = u.id AND status = 'active') AS is_following
    FROM follows f
    JOIN users u ON u.id = f.following_id
    WHERE f.follower_id = ? AND f.status = 'active' AND u.is_active = 1
    ORDER BY f.created_at DESC LIMIT ? OFFSET ?
  `).all(viewerId, +req.params.id, limit, offset);

  res.json({ users: rows });
});

/* ─── POST /api/users/:id/block ─── */
router.post('/:id/block', requireAuth, (req, res) => {
  const targetId = +req.params.id;
  if (targetId === req.user.id) return res.status(400).json({ error: 'Cannot block yourself.' });

  try {
    db.prepare('INSERT INTO blocks (blocker_id, blocked_id) VALUES (?, ?)').run(req.user.id, targetId);
  } catch { return res.status(400).json({ error: 'Already blocked.' }); }

  /* Remove follow relationships */
  db.prepare('DELETE FROM follows WHERE (follower_id = ? AND following_id = ?) OR (follower_id = ? AND following_id = ?)')
    .run(req.user.id, targetId, targetId, req.user.id);

  res.json({ message: 'User blocked.' });
});

/* ─── DELETE /api/users/:id/block ─── */
router.delete('/:id/block', requireAuth, (req, res) => {
  db.prepare('DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?').run(req.user.id, +req.params.id);
  res.json({ message: 'User unblocked.' });
});

/* ─── GET /api/users/me/blocked ─── */
router.get('/me/blocked', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT u.id, u.username, u.display_name, u.avatar_url
    FROM blocks b JOIN users u ON u.id = b.blocked_id
    WHERE b.blocker_id = ? ORDER BY b.created_at DESC
  `).all(req.user.id);
  res.json({ users: rows });
});

/* ─── GET /api/users/suggestions ─── */
router.get('/suggestions', requireAuth, (req, res) => {
  const limit = Math.min(+req.query.limit || 10, 20);
  const rows = db.prepare(`
    SELECT u.id, u.username, u.display_name, u.avatar_url, u.is_verified,
           u.follower_count
    FROM users u
    WHERE u.id != ?
      AND u.is_active = 1
      AND u.id NOT IN (SELECT following_id FROM follows WHERE follower_id = ?)
      AND u.id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = ?)
    ORDER BY u.follower_count DESC, u.created_at DESC
    LIMIT ?
  `).all(req.user.id, req.user.id, req.user.id, limit);
  res.json({ users: rows });
});

/* ─── POST /api/users/:id/report ─── */
router.post('/:id/report', requireAuth, (req, res) => {
  const { reason, description } = req.body;
  if (!reason) return res.status(400).json({ error: 'Reason required.' });

  db.prepare('INSERT INTO reports (reporter_id, entity_type, entity_id, reason, description) VALUES (?, ?, ?, ?, ?)')
    .run(req.user.id, 'user', +req.params.id, sanitizeText(reason, 100), sanitizeText(description || '', 500));
  res.json({ message: 'Report submitted.' });
});

module.exports = router;
