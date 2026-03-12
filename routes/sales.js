const router = require('express').Router();
const db = require('../database/db');
const auth = require('../middleware/auth');

// GET /api/sales — admin only
router.get('/', auth, (req, res) => {
  const { from, to, product_id } = req.query;
  let sql = 'SELECT * FROM sales WHERE 1=1';
  const params = [];
  if (from)       { sql += ' AND sale_date >= ?'; params.push(from); }
  if (to)         { sql += ' AND sale_date <= ?'; params.push(to); }
  if (product_id) { sql += ' AND product_id = ?'; params.push(product_id); }
  sql += ' ORDER BY sale_date DESC, created_at DESC';
  res.json(db.prepare(sql).all(...params));
});

// GET /api/sales/summary — admin only
router.get('/summary', auth, (req, res) => {
  const monthly = db.prepare(`
    SELECT strftime('%Y-%m', sale_date) as month,
           COUNT(*) as orders,
           SUM(quantity) as total_qty,
           SUM(total_price) as revenue
    FROM sales
    GROUP BY month ORDER BY month DESC LIMIT 12
  `).all();

  const topProducts = db.prepare(`
    SELECT product_name, catalog_no,
           SUM(quantity) as total_qty,
           SUM(total_price) as revenue
    FROM sales
    GROUP BY product_id ORDER BY total_qty DESC LIMIT 10
  `).all();

  const total = db.prepare('SELECT SUM(total_price) as r, COUNT(*) as c FROM sales').get();
  const thisMonth = db.prepare(`
    SELECT SUM(total_price) as r, COUNT(*) as c FROM sales
    WHERE strftime('%Y-%m', sale_date) = strftime('%Y-%m', 'now')
  `).get();

  res.json({ monthly, topProducts, total, thisMonth });
});

// POST /api/sales — admin only
router.post('/', auth, (req, res) => {
  const { product_id, product_name, catalog_no, quantity, unit_price,
          currency, customer_name, customer_company, country, sale_date, notes } = req.body;
  if (!product_name || !quantity)
    return res.status(400).json({ error: 'Ürün adı ve miktar zorunludur' });

  const qty = parseInt(quantity);
  const up  = parseFloat(unit_price) || 0;
  const total = qty * up;

  const result = db.prepare(`
    INSERT INTO sales (product_id, product_name, catalog_no, quantity, unit_price, total_price,
      currency, customer_name, customer_company, country, sale_date, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    product_id || null, product_name, catalog_no || null,
    qty, up, total, currency || 'USD',
    customer_name || null, customer_company || null,
    country || 'Turkey', sale_date || null, notes || null
  );

  // Update stock
  if (product_id) {
    db.prepare('UPDATE products SET stock_qty = MAX(0, stock_qty - ?) WHERE id = ?').run(qty, product_id);
  }

  res.status(201).json({ id: result.lastInsertRowid, total_price: total, message: 'Satış kaydedildi' });
});

// DELETE /api/sales/:id — admin only
router.delete('/:id', auth, (req, res) => {
  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id);
  if (!sale) return res.status(404).json({ error: 'Satış bulunamadı' });
  // Revert stock
  if (sale.product_id) {
    db.prepare('UPDATE products SET stock_qty = stock_qty + ? WHERE id = ?').run(sale.quantity, sale.product_id);
  }
  db.prepare('DELETE FROM sales WHERE id = ?').run(req.params.id);
  res.json({ message: 'Satış silindi' });
});

module.exports = router;
