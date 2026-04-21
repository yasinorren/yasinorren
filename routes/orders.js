const router = require('express').Router();
const db = require('../database/db');
const auth = require('../middleware/auth');

const VALID_STATUSES = ['received', 'processing', 'preparing', 'shipped', 'delivered', 'cancelled'];

function genTrackingCode() {
  const year = new Date().getFullYear();
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rand = '';
  for (let i = 0; i < 8; i++) rand += chars[Math.floor(Math.random() * chars.length)];
  return `INN-ORD-${year}-${rand}`;
}

// GET /api/orders/stats — admin only (must come before /:id)
router.get('/stats', auth, (req, res) => {
  const total    = db.prepare('SELECT COUNT(*) as c FROM orders').get().c;
  const pending  = db.prepare("SELECT COUNT(*) as c FROM orders WHERE status NOT IN ('delivered','cancelled')").get().c;
  const today    = db.prepare("SELECT COUNT(*) as c FROM orders WHERE date(created_at) = date('now')").get().c;
  const delivered = db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'delivered'").get().c;
  res.json({ total, pending, today, delivered });
});

// GET /api/orders/track/:code — public (must come before /:id)
router.get('/track/:code', (req, res) => {
  const code = req.params.code.trim().toUpperCase();
  const order = db.prepare(
    'SELECT id, tracking_code, customer_name, product_name, quantity, status, status_note, created_at, updated_at FROM orders WHERE tracking_code = ?'
  ).get(code);
  if (!order) return res.status(404).json({ error: 'Sipariş bulunamadı' });
  res.json(order);
});

// GET /api/orders — admin only
router.get('/', auth, (req, res) => {
  const { status, search } = req.query;
  let sql = 'SELECT * FROM orders';
  const params = [];
  const wheres = [];
  if (status && status !== 'all') { wheres.push('status = ?'); params.push(status); }
  if (search) {
    wheres.push('(customer_name LIKE ? OR tracking_code LIKE ? OR product_name LIKE ? OR company LIKE ?)');
    const q = `%${search}%`;
    params.push(q, q, q, q);
  }
  if (wheres.length) sql += ' WHERE ' + wheres.join(' AND ');
  sql += ' ORDER BY created_at DESC';
  res.json(db.prepare(sql).all(...params));
});

// POST /api/orders — admin only
router.post('/', auth, (req, res) => {
  const { customer_name, customer_email, customer_phone, company,
          product_name, quantity, notes, status, status_note } = req.body;
  if (!customer_name || !product_name)
    return res.status(400).json({ error: 'Müşteri adı ve ürün adı zorunludur' });

  let tracking_code, attempts = 0;
  do {
    tracking_code = genTrackingCode();
    if (++attempts > 20) return res.status(500).json({ error: 'Takip kodu oluşturulamadı' });
  } while (db.prepare('SELECT id FROM orders WHERE tracking_code = ?').get(tracking_code));

  try {
    const result = db.prepare(`
      INSERT INTO orders
        (tracking_code, customer_name, customer_email, customer_phone, company,
         product_name, quantity, notes, status, status_note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      tracking_code,
      customer_name,
      customer_email  || null,
      customer_phone  || null,
      company         || null,
      product_name,
      parseInt(quantity) || 1,
      notes           || null,
      VALID_STATUSES.includes(status) ? status : 'received',
      status_note     || null
    );
    res.status(201).json({ id: result.lastInsertRowid, tracking_code, message: 'Sipariş oluşturuldu' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/orders/:id — admin only
router.put('/:id', auth, (req, res) => {
  const { customer_name, customer_email, customer_phone, company,
          product_name, quantity, notes, status, status_note } = req.body;
  if (!db.prepare('SELECT id FROM orders WHERE id = ?').get(req.params.id))
    return res.status(404).json({ error: 'Sipariş bulunamadı' });
  try {
    db.prepare(`
      UPDATE orders SET
        customer_name = ?, customer_email = ?, customer_phone = ?, company = ?,
        product_name = ?, quantity = ?, notes = ?, status = ?, status_note = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      customer_name,
      customer_email  || null,
      customer_phone  || null,
      company         || null,
      product_name,
      parseInt(quantity) || 1,
      notes           || null,
      VALID_STATUSES.includes(status) ? status : 'received',
      status_note     || null,
      req.params.id
    );
    res.json({ message: 'Sipariş güncellendi' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/orders/:id — admin only
router.delete('/:id', auth, (req, res) => {
  if (!db.prepare('SELECT id FROM orders WHERE id = ?').get(req.params.id))
    return res.status(404).json({ error: 'Sipariş bulunamadı' });
  db.prepare('DELETE FROM orders WHERE id = ?').run(req.params.id);
  res.json({ message: 'Sipariş silindi' });
});

module.exports = router;
