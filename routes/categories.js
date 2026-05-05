const router = require('express').Router();
const jwt    = require('jsonwebtoken');
const db     = require('../database/db');
const auth   = require('../middleware/auth');

const SECRET = () => process.env.JWT_SECRET || 'innomed-secret-2024';

function tryDecodeJwt(header) {
  if (!header || !header.startsWith('Bearer ')) return null;
  try { return jwt.verify(header.slice(7), SECRET()); } catch { return null; }
}

// GET /api/categories — public; admin with token sees inactive too
router.get('/', (req, res) => {
  const isAdmin = !!tryDecodeJwt(req.headers.authorization);
  const all = isAdmin
    ? db.prepare('SELECT * FROM categories ORDER BY order_index, id').all()
    : db.prepare('SELECT * FROM categories WHERE is_active=1 ORDER BY order_index, id').all();

  const map = {};
  const roots = [];
  for (const c of all) { c.children = []; map[c.id] = c; }
  for (const c of all) {
    if (c.parent_id && map[c.parent_id]) map[c.parent_id].children.push(c);
    else roots.push(c);
  }
  res.json(roots);
});

// POST /api/categories — protected
router.post('/', auth, (req, res) => {
  const { name, slug, description, image_url, parent_id, order_index } = req.body;
  if (!name || !slug) return res.status(400).json({ error: 'name and slug are required' });
  try {
    const r = db.prepare(
      'INSERT INTO categories (name, slug, description, image_url, parent_id, order_index) VALUES (?,?,?,?,?,?)'
    ).run(name, slug, description || '', image_url || null, parent_id || null, order_index || 0);
    res.status(201).json({ id: r.lastInsertRowid, message: 'Category created' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// PUT /api/categories/products/:pid — must be before /:id
router.put('/products/:pid', auth, (req, res) => {
  const { brand, stock_code, stock_name, purpose, description, image_url, features, order_index, is_active } = req.body;
  if (!stock_name) return res.status(400).json({ error: 'stock_name is required' });
  try {
    db.prepare(
      'UPDATE category_products SET brand=?,stock_code=?,stock_name=?,purpose=?,description=?,image_url=?,features=?,order_index=?,is_active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?'
    ).run(
      brand || 'ORGAMİK', stock_code || '', stock_name,
      purpose || '', description || '', image_url || null,
      features || null, order_index || 0,
      is_active === false || is_active === 0 ? 0 : 1,
      req.params.pid
    );
    res.json({ message: 'Product updated' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// DELETE /api/categories/products/:pid — must be before /:id
router.delete('/products/:pid', auth, (req, res) => {
  db.prepare('DELETE FROM category_products WHERE id=?').run(req.params.pid);
  res.json({ message: 'Product deleted' });
});

// PUT /api/categories/:id — protected
router.put('/:id', auth, (req, res) => {
  const { name, slug, description, image_url, parent_id, order_index, is_active } = req.body;
  try {
    db.prepare(
      'UPDATE categories SET name=?,slug=?,description=?,image_url=?,parent_id=?,order_index=?,is_active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?'
    ).run(
      name, slug, description || '', image_url || null,
      parent_id || null, order_index || 0,
      is_active === false || is_active === 0 ? 0 : 1,
      req.params.id
    );
    res.json({ message: 'Category updated' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// DELETE /api/categories/:id — protected, soft delete
router.delete('/:id', auth, (req, res) => {
  db.prepare('UPDATE categories SET is_active=0, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(req.params.id);
  res.json({ message: 'Category deleted' });
});

// GET /api/categories/:id/products — protected, all products
router.get('/:id/products', auth, (req, res) => {
  const products = db.prepare(
    'SELECT * FROM category_products WHERE category_id=? ORDER BY order_index, id'
  ).all(req.params.id);
  res.json(products);
});

// POST /api/categories/:id/products — protected
router.post('/:id/products', auth, (req, res) => {
  const { brand, stock_code, stock_name, purpose, description, image_url, features, order_index } = req.body;
  if (!stock_name) return res.status(400).json({ error: 'stock_name is required' });
  try {
    const r = db.prepare(
      'INSERT INTO category_products (category_id, brand, stock_code, stock_name, purpose, description, image_url, features, order_index) VALUES (?,?,?,?,?,?,?,?,?)'
    ).run(
      req.params.id, brand || 'ORGAMİK', stock_code || '',
      stock_name, purpose || '', description || '',
      image_url || null, features || null, order_index || 0
    );
    res.status(201).json({ id: r.lastInsertRowid, message: 'Product added' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// GET /api/categories/:slug — public, single category with children + active products
router.get('/:slug', (req, res) => {
  const cat = db.prepare('SELECT * FROM categories WHERE slug=? AND is_active=1').get(req.params.slug);
  if (!cat) return res.status(404).json({ error: 'Category not found' });

  const children = db.prepare(
    'SELECT * FROM categories WHERE parent_id=? AND is_active=1 ORDER BY order_index, id'
  ).all(cat.id);
  const products = db.prepare(
    'SELECT * FROM category_products WHERE category_id=? AND is_active=1 ORDER BY order_index, id'
  ).all(cat.id);

  res.json({ ...cat, children, products });
});

module.exports = router;
