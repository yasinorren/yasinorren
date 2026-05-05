const router = require('express').Router();
const db     = require('../database/db');
const auth   = require('../middleware/auth');

// GET /api/inquiries — protected, list all
router.get('/', auth, (req, res) => {
  const rows = db.prepare('SELECT * FROM inquiries ORDER BY created_at DESC').all();
  res.json(rows);
});

// POST /api/inquiries — PUBLIC, submit inquiry
router.post('/', (req, res) => {
  const { name, email, phone, message, product_name, product_code } = req.body;
  try {
    const r = db.prepare(
      'INSERT INTO inquiries (name, email, phone, message, product_name, product_code) VALUES (?,?,?,?,?,?)'
    ).run(
      name         || '',
      email        || '',
      phone        || '',
      message      || '',
      product_name || '',
      product_code || ''
    );
    res.status(201).json({ id: r.lastInsertRowid, message: 'Inquiry submitted successfully' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// PUT /api/inquiries/:id — protected, update status/reply
router.put('/:id', auth, (req, res) => {
  const { status, reply } = req.body;
  const existing = db.prepare('SELECT id FROM inquiries WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Inquiry not found' });
  try {
    db.prepare('UPDATE inquiries SET status=?,reply=? WHERE id=?')
      .run(status || 'new', reply || '', req.params.id);
    res.json({ message: 'Inquiry updated' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// DELETE /api/inquiries/:id — protected
router.delete('/:id', auth, (req, res) => {
  const existing = db.prepare('SELECT id FROM inquiries WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Inquiry not found' });
  db.prepare('DELETE FROM inquiries WHERE id = ?').run(req.params.id);
  res.json({ message: 'Inquiry deleted' });
});

module.exports = router;
