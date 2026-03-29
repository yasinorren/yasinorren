const router = require('express').Router();
const db = require('../database/db');
const auth = require('../middleware/auth');

// POST /api/inquiries — public (customer submits inquiry)
router.post('/', (req, res) => {
  const { customer_name, customer_email, customer_phone, company,
          product_id, product_name, subject, message } = req.body;
  if (!customer_name || !message)
    return res.status(400).json({ error: 'Ad ve mesaj zorunludur' });

  const result = db.prepare(`
    INSERT INTO inquiries (customer_name, customer_email, customer_phone, company,
      product_id, product_name, subject, message)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    customer_name, customer_email || null, customer_phone || null, company || null,
    product_id || null, product_name || null, subject || null, message
  );
  res.status(201).json({ id: result.lastInsertRowid, message: 'Sorgunuz alındı, en kısa sürede dönüş yapacağız.' });
});

// GET /api/inquiries — admin only
router.get('/', auth, (req, res) => {
  const { status } = req.query;
  let sql = 'SELECT * FROM inquiries';
  const params = [];
  if (status && status !== 'all') { sql += ' WHERE status = ?'; params.push(status); }
  sql += ' ORDER BY created_at DESC';
  res.json(db.prepare(sql).all(...params));
});

// GET /api/inquiries/stats — admin only
router.get('/stats', auth, (req, res) => {
  const total   = db.prepare("SELECT COUNT(*) as c FROM inquiries").get().c;
  const newInq  = db.prepare("SELECT COUNT(*) as c FROM inquiries WHERE status = 'new'").get().c;
  const today   = db.prepare("SELECT COUNT(*) as c FROM inquiries WHERE date(created_at) = date('now')").get().c;
  res.json({ total, new: newInq, today });
});

// GET /api/inquiries/:id — admin only
router.get('/:id', auth, (req, res) => {
  const inq = db.prepare('SELECT * FROM inquiries WHERE id = ?').get(req.params.id);
  if (!inq) return res.status(404).json({ error: 'Sorgu bulunamadı' });
  res.json(inq);
});

// PUT /api/inquiries/:id — admin only (update status / add notes)
router.put('/:id', auth, (req, res) => {
  const { status, admin_notes } = req.body;
  const existing = db.prepare('SELECT id FROM inquiries WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Sorgu bulunamadı' });
  db.prepare(`
    UPDATE inquiries SET status = ?, admin_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(status || 'new', admin_notes || null, req.params.id);
  res.json({ message: 'Sorgu güncellendi' });
});

// DELETE /api/inquiries/:id — admin only
router.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM inquiries WHERE id = ?').run(req.params.id);
  res.json({ message: 'Sorgu silindi' });
});

module.exports = router;
