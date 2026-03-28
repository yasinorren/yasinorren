const router = require('express').Router();
const db = require('../database/db');
const auth = require('../middleware/auth');

// GET /api/products  — public
router.get('/', (req, res) => {
  const { category, search, featured } = req.query;
  let sql = 'SELECT * FROM products WHERE is_active = 1';
  const params = [];

  if (category && category !== 'all') { sql += ' AND category = ?'; params.push(category); }
  if (featured)                        { sql += ' AND is_featured = 1'; }
  if (search) {
    sql += ' AND (name_tr LIKE ? OR name_en LIKE ? OR catalog_no LIKE ? OR description_tr LIKE ?)';
    const q = `%${search}%`;
    params.push(q, q, q, q);
  }
  sql += ' ORDER BY is_featured DESC, category, name_tr';
  res.json(db.prepare(sql).all(...params));
});

// GET /api/products/:id — public
router.get('/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id = ? AND is_active = 1').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Ürün bulunamadı' });
  res.json(p);
});

// POST /api/products — admin only
router.post('/', auth, (req, res) => {
  const { catalog_no, name_tr, name_en, category, subcategory, description_tr, description_en,
          format, unit, price, currency, stock_status, stock_qty, is_featured, image_url } = req.body;
  if (!name_tr || !name_en || !category)
    return res.status(400).json({ error: 'name_tr, name_en ve category zorunludur' });

  const stmt = db.prepare(`
    INSERT INTO products (catalog_no, name_tr, name_en, category, subcategory, description_tr, description_en,
      format, unit, price, currency, stock_status, stock_qty, is_featured, image_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    catalog_no || null, name_tr, name_en, category,
    subcategory || null, description_tr || null, description_en || null,
    format || null, unit || 'adet',
    parseFloat(price) || 0, currency || 'USD',
    stock_status || 'available', parseInt(stock_qty) || 0,
    is_featured ? 1 : 0, image_url || null
  );
  res.status(201).json({ id: result.lastInsertRowid, message: 'Ürün eklendi' });
});

// PUT /api/products/:id — admin only
router.put('/:id', auth, (req, res) => {
  const { catalog_no, name_tr, name_en, category, subcategory, description_tr, description_en,
          format, unit, price, currency, stock_status, stock_qty, is_featured, is_active, image_url } = req.body;

  const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Ürün bulunamadı' });

  db.prepare(`
    UPDATE products SET
      catalog_no = ?, name_tr = ?, name_en = ?, category = ?, subcategory = ?,
      description_tr = ?, description_en = ?, format = ?, unit = ?, price = ?,
      currency = ?, stock_status = ?, stock_qty = ?, is_featured = ?, is_active = ?,
      image_url = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    catalog_no || null, name_tr, name_en, category, subcategory || null,
    description_tr || null, description_en || null, format || null, unit || 'adet',
    parseFloat(price) || 0, currency || 'USD',
    stock_status || 'available', parseInt(stock_qty) || 0,
    is_featured ? 1 : 0, is_active !== undefined ? (is_active ? 1 : 0) : 1,
    image_url || null, req.params.id
  );
  res.json({ message: 'Ürün güncellendi' });
});

// DELETE /api/products/:id — admin only (soft delete)
router.delete('/:id', auth, (req, res) => {
  const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Ürün bulunamadı' });
  db.prepare('UPDATE products SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.id);
  res.json({ message: 'Ürün silindi' });
});

module.exports = router;
