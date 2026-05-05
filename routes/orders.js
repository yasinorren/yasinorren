const router = require('express').Router();
const db     = require('../database/db');
const auth   = require('../middleware/auth');

function genTrackingCode() {
  const year  = new Date().getFullYear();
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rand = '';
  for (let i = 0; i < 8; i++) rand += chars[Math.floor(Math.random() * chars.length)];
  return `INN-ORD-${year}-${rand}`;
}

// GET /api/orders/track/:code — PUBLIC
router.get('/track/:code', (req, res) => {
  const code  = req.params.code.trim().toUpperCase();
  const order = db.prepare('SELECT * FROM orders WHERE tracking_code = ?').get(code);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

// GET /api/orders — protected
router.get('/', auth, (req, res) => {
  const rows = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
  res.json(rows);
});

// POST /api/orders — protected
router.post('/', auth, (req, res) => {
  const { customer_name, company, customer_email, phone, product_name, quantity, status, status_note, notes } = req.body;

  let tracking_code, attempts = 0;
  do {
    tracking_code = genTrackingCode();
    if (++attempts > 20) return res.status(500).json({ error: 'Could not generate tracking code' });
  } while (db.prepare('SELECT id FROM orders WHERE tracking_code = ?').get(tracking_code));

  try {
    const r = db.prepare(
      'INSERT INTO orders (tracking_code, customer_name, company, customer_email, phone, product_name, quantity, status, status_note, notes) VALUES (?,?,?,?,?,?,?,?,?,?)'
    ).run(
      tracking_code, customer_name || '', company || '', customer_email || '',
      phone || '', product_name || '', quantity || 1,
      status || 'received', status_note || '', notes || ''
    );
    res.status(201).json({ id: r.lastInsertRowid, tracking_code, message: 'Order created' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// PUT /api/orders/:id — protected
router.put('/:id', auth, (req, res) => {
  const { customer_name, company, customer_email, phone, product_name, quantity, status, status_note, notes } = req.body;
  if (!db.prepare('SELECT id FROM orders WHERE id = ?').get(req.params.id))
    return res.status(404).json({ error: 'Order not found' });
  try {
    db.prepare(
      'UPDATE orders SET customer_name=?,company=?,customer_email=?,phone=?,product_name=?,quantity=?,status=?,status_note=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=?'
    ).run(
      customer_name || '', company || '', customer_email || '', phone || '',
      product_name || '', quantity || 1, status || 'received',
      status_note || '', notes || '', req.params.id
    );
    res.json({ message: 'Order updated' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// DELETE /api/orders/:id — protected
router.delete('/:id', auth, (req, res) => {
  if (!db.prepare('SELECT id FROM orders WHERE id = ?').get(req.params.id))
    return res.status(404).json({ error: 'Order not found' });
  db.prepare('DELETE FROM orders WHERE id = ?').run(req.params.id);
  res.json({ message: 'Order deleted' });
});

module.exports = router;
