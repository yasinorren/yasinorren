const router = require('express').Router();
const db     = require('../database/db');
const { requireAuth } = require('../middleware/auth');

/* ─── GET /api/notifications ─── */
router.get('/', requireAuth, (req, res) => {
  const limit  = Math.min(+req.query.limit || 20, 50);
  const offset = +req.query.offset || 0;
  const uid    = req.user.id;

  const rows = db.prepare(`
    SELECT n.*,
      u.username AS actor_username, u.display_name AS actor_display_name, u.avatar_url AS actor_avatar
    FROM notifications n
    LEFT JOIN users u ON u.id = n.actor_id
    WHERE n.user_id = ?
    ORDER BY n.created_at DESC LIMIT ? OFFSET ?
  `).all(uid, limit, offset);

  const unread = db.prepare('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0').get(uid).c;

  res.json({ notifications: rows, unread_count: unread, has_more: rows.length === limit });
});

/* ─── POST /api/notifications/read-all ─── */
router.post('/read-all', requireAuth, (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
  res.json({ message: 'All notifications marked as read.' });
});

/* ─── PATCH /api/notifications/:id/read ─── */
router.patch('/:id/read', requireAuth, (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(+req.params.id, req.user.id);
  res.json({ message: 'Notification marked as read.' });
});

/* ─── DELETE /api/notifications/:id ─── */
router.delete('/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM notifications WHERE id = ? AND user_id = ?').run(+req.params.id, req.user.id);
  res.json({ message: 'Notification deleted.' });
});

/* ─── GET /api/notifications/unread-count ─── */
router.get('/unread-count', requireAuth, (req, res) => {
  const count = db.prepare('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0').get(req.user.id).c;
  res.json({ count });
});

module.exports = router;
