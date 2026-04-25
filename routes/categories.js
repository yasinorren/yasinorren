const express = require('express');
const router = express.Router();
const db = require('../database/db');
const auth = require('../middleware/auth');
const jwt = require('jsonwebtoken');

// GET /api/categories - full tree (public; returns all categories when called with valid JWT)
router.get('/', (req, res) => {
  let isAdmin = false;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET || 'innomed-secret-key');
      isAdmin = true;
    } catch(e) { /* invalid token — treat as public request */ }
  }
  const all = isAdmin
    ? db.prepare('SELECT * FROM categories ORDER BY order_index').all()
    : db.prepare('SELECT * FROM categories WHERE is_active=1 ORDER BY order_index').all();
  const map = {}, roots = [];
  for (const c of all) { c.children = []; map[c.id] = c; }
  for (const c of all) {
    if (c.parent_id && map[c.parent_id]) map[c.parent_id].children.push(c);
    else roots.push(c);
  }
  res.json(roots);
});

// POST /api/categories - create (protected)
router.post('/', auth, (req, res) => {
  const { name, slug, parent_id, description, image_url, order_index } = req.body;
  if (!name || !slug) return res.status(400).json({ error: 'name and slug required' });
  try {
    const result = db.prepare(
      'INSERT INTO categories (name, slug, parent_id, description, image_url, order_index) VALUES (?,?,?,?,?,?)'
    ).run(name, slug, parent_id || null, description || '', image_url || null, order_index || 0);
    res.json({ id: result.lastInsertRowid, message: 'Category created' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// PUT /api/categories/:id - update (protected)   ← must come before /:slug
router.put('/:id', auth, (req, res) => {
  const { name, slug, parent_id, description, image_url, order_index, is_active } = req.body;
  try {
    db.prepare(
      'UPDATE categories SET name=?,slug=?,parent_id=?,description=?,image_url=?,order_index=?,is_active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?'
    ).run(name, slug, parent_id || null, description || '', image_url || null, order_index || 0, is_active ? 1 : 0, req.params.id);
    res.json({ message: 'Category updated' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// DELETE /api/categories/:id - soft delete (protected)   ← must come before /:slug
router.delete('/:id', auth, (req, res) => {
  db.prepare('UPDATE categories SET is_active=0 WHERE id=?').run(req.params.id);
  res.json({ message: 'Category deleted' });
});

// GET /api/categories/:id/products - get products for a category (protected)
// NOTE: This MUST be defined before GET /:slug to avoid /:slug swallowing the path
router.get('/:id/products', auth, (req, res) => {
  const products = db.prepare(
    'SELECT * FROM category_products WHERE category_id=? ORDER BY order_index'
  ).all(req.params.id);
  res.json(products);
});

// POST /api/categories/:id/products - add product (protected)
router.post('/:id/products', auth, (req, res) => {
  const { brand, stock_code, stock_name, purpose, image_url, features, order_index } = req.body;
  if (!stock_name) return res.status(400).json({ error: 'stock_name required' });
  const result = db.prepare(
    'INSERT INTO category_products (category_id, brand, stock_code, stock_name, purpose, image_url, features, order_index) VALUES (?,?,?,?,?,?,?,?)'
  ).run(req.params.id, brand || 'ORGAMİK', stock_code || '', stock_name, purpose || '', image_url || null, features || null, order_index || 0);
  res.json({ id: result.lastInsertRowid, message: 'Product added' });
});

// PUT /api/categories/products/:pid - update product (protected)
router.put('/products/:pid', auth, (req, res) => {
  const { brand, stock_code, stock_name, purpose, image_url, features, order_index, is_active } = req.body;
  db.prepare(
    'UPDATE category_products SET brand=?,stock_code=?,stock_name=?,purpose=?,image_url=?,features=?,order_index=?,is_active=? WHERE id=?'
  ).run(brand || 'ORGAMİK', stock_code || '', stock_name, purpose || '', image_url || null, features || null, order_index || 0, is_active === false ? 0 : 1, req.params.pid);
  res.json({ message: 'Product updated' });
});

// DELETE /api/categories/products/:pid - delete product (protected)
router.delete('/products/:pid', auth, (req, res) => {
  db.prepare('DELETE FROM category_products WHERE id=?').run(req.params.pid);
  res.json({ message: 'Product deleted' });
});

// GET /api/categories/:slug - single category with products (public)
// ← MUST be last: generic pattern would otherwise swallow /:id/products etc.
router.get('/:slug', (req, res) => {
  const cat = db.prepare('SELECT * FROM categories WHERE slug=? AND is_active=1').get(req.params.slug);
  if (!cat) return res.status(404).json({ error: 'Category not found' });
  const children = db.prepare(
    'SELECT * FROM categories WHERE parent_id=? AND is_active=1 ORDER BY order_index'
  ).all(cat.id);
  const products = db.prepare(
    'SELECT * FROM category_products WHERE category_id=? AND is_active=1 ORDER BY order_index'
  ).all(cat.id);
  res.json({ ...cat, children, products });
});

module.exports = router;
