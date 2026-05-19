const router = require('express').Router();
const db     = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const { sanitizeText } = require('../middleware/validate');

/* ─── GET /api/chat/conversations ─── */
router.get('/conversations', requireAuth, (req, res) => {
  const uid = req.user.id;

  const convs = db.prepare(`
    SELECT c.id, c.updated_at,
      (
        SELECT m.content FROM messages m
        WHERE m.conversation_id = c.id AND m.is_deleted = 0
        ORDER BY m.created_at DESC LIMIT 1
      ) AS last_message,
      (
        SELECT m.created_at FROM messages m
        WHERE m.conversation_id = c.id AND m.is_deleted = 0
        ORDER BY m.created_at DESC LIMIT 1
      ) AS last_message_at,
      (
        SELECT COUNT(*) FROM messages m
        WHERE m.conversation_id = c.id AND m.is_deleted = 0
          AND m.sender_id != ? AND m.created_at > COALESCE(
            (SELECT last_read_at FROM conversation_participants WHERE conversation_id = c.id AND user_id = ?),
            '1970-01-01'
          )
      ) AS unread_count
    FROM conversations c
    JOIN conversation_participants cp ON cp.conversation_id = c.id AND cp.user_id = ?
    ORDER BY last_message_at DESC NULLS LAST
  `).all(uid, uid, uid);

  /* Attach other participant */
  const result = convs.map(c => {
    const other = db.prepare(`
      SELECT u.id, u.username, u.display_name, u.avatar_url, u.is_verified
      FROM conversation_participants cp
      JOIN users u ON u.id = cp.user_id
      WHERE cp.conversation_id = ? AND cp.user_id != ?
      LIMIT 1
    `).get(c.id, uid);
    return { ...c, other_user: other };
  });

  res.json({ conversations: result });
});

/* ─── POST /api/chat/conversations ─── */
router.post('/conversations', requireAuth, (req, res) => {
  const { user_id } = req.body;
  if (!user_id || +user_id === req.user.id) {
    return res.status(400).json({ error: 'Invalid user.' });
  }

  const target = db.prepare('SELECT id FROM users WHERE id = ? AND is_active = 1').get(+user_id);
  if (!target) return res.status(404).json({ error: 'User not found.' });

  const blocked = db.prepare('SELECT 1 FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)')
    .get(req.user.id, +user_id, +user_id, req.user.id);
  if (blocked) return res.status(403).json({ error: 'Cannot message this user.' });

  /* Find existing conversation between these two */
  const existing = db.prepare(`
    SELECT c.id FROM conversations c
    WHERE c.id IN (SELECT conversation_id FROM conversation_participants WHERE user_id = ?)
      AND c.id IN (SELECT conversation_id FROM conversation_participants WHERE user_id = ?)
    LIMIT 1
  `).get(req.user.id, +user_id);

  if (existing) return res.json({ conversation_id: existing.id });

  const conv = db.prepare('INSERT INTO conversations DEFAULT VALUES').run();
  db.prepare('INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)').run(conv.lastInsertRowid, req.user.id);
  db.prepare('INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)').run(conv.lastInsertRowid, +user_id);

  res.status(201).json({ conversation_id: conv.lastInsertRowid });
});

/* ─── GET /api/chat/conversations/:id/messages ─── */
router.get('/conversations/:id/messages', requireAuth, (req, res) => {
  const convId = +req.params.id;
  const uid    = req.user.id;
  const limit  = Math.min(+req.query.limit || 30, 100);
  const before = req.query.before; // message id for pagination

  const participant = db.prepare('SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?').get(convId, uid);
  if (!participant) return res.status(403).json({ error: 'Not a participant.' });

  const rows = db.prepare(`
    SELECT m.*, u.username, u.display_name, u.avatar_url
    FROM messages m JOIN users u ON u.id = m.sender_id
    WHERE m.conversation_id = ? AND m.is_deleted = 0
      ${before ? 'AND m.id < ?' : ''}
    ORDER BY m.created_at DESC LIMIT ?
  `).all(before ? [convId, +before, limit] : [convId, limit]);

  /* Mark as read */
  db.prepare(`
    UPDATE conversation_participants SET last_read_at = CURRENT_TIMESTAMP
    WHERE conversation_id = ? AND user_id = ?
  `).run(convId, uid);

  res.json({ messages: rows.reverse() });
});

/* ─── POST /api/chat/conversations/:id/messages ─── */
router.post('/conversations/:id/messages', requireAuth, (req, res) => {
  const convId = +req.params.id;
  const uid    = req.user.id;

  const participant = db.prepare('SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?').get(convId, uid);
  if (!participant) return res.status(403).json({ error: 'Not a participant.' });

  /* E2EE: accept encrypted ciphertext (opaque blob) or plain text */
  const isEncrypted = !!req.body.is_encrypted;
  let content;
  if (isEncrypted) {
    /* Server stores opaque ciphertext — does NOT sanitize (would corrupt ciphertext) */
    content = String(req.body.content || '');
    if (!content || content.length > 8000) return res.status(400).json({ error: 'Invalid message.' });
    if (!/^[A-Za-z0-9+/=]+$/.test(content)) return res.status(400).json({ error: 'Invalid ciphertext encoding.' });
  } else {
    content = sanitizeText(req.body.content || '', 2000);
    if (!content) return res.status(400).json({ error: 'Message cannot be empty.' });
  }

  const result = db.prepare(`
    INSERT INTO messages (conversation_id, sender_id, content, message_type, is_encrypted)
    VALUES (?, ?, ?, 'text', ?)
  `).run(convId, uid, content, isEncrypted ? 1 : 0);

  db.prepare('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(convId);

  /* Notify other participant */
  const others = db.prepare(`
    SELECT user_id FROM conversation_participants WHERE conversation_id = ? AND user_id != ?
  `).all(convId, uid);

  for (const o of others) {
    db.prepare('INSERT INTO notifications (user_id, actor_id, type, entity_type, entity_id, message) VALUES (?, ?, ?, ?, ?, ?)')
      .run(o.user_id, uid, 'message', 'conversation', convId, 'sent you a message');
  }

  const msg = db.prepare(`
    SELECT m.*, u.username, u.display_name, u.avatar_url
    FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.id = ?
  `).get(result.lastInsertRowid);

  /* Broadcast via WebSocket if available */
  if (global.wsBroadcast) {
    global.wsBroadcast(convId, { type: 'new_message', message: msg });
  }

  res.status(201).json({ message: msg });
});

/* ─── DELETE /api/chat/messages/:id ─── */
router.delete('/messages/:id', requireAuth, (req, res) => {
  const msg = db.prepare('SELECT * FROM messages WHERE id = ? AND sender_id = ?').get(+req.params.id, req.user.id);
  if (!msg) return res.status(404).json({ error: 'Message not found.' });

  db.prepare('UPDATE messages SET is_deleted = 1, content = "" WHERE id = ?').run(msg.id);
  res.json({ message: 'Message deleted.' });
});

module.exports = router;
