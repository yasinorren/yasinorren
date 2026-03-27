const express = require('express');
const router = express.Router();
const db = require('../database/db');
const auth = require('../middleware/auth');

function generateCode(invoiceDate) {
  const year = new Date(invoiceDate || Date.now()).getFullYear();
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rand = '';
  for (let i = 0; i < 8; i++) rand += chars[Math.floor(Math.random() * chars.length)];
  return `INN-STERI-${year}-${rand}`;
}

// POST /api/sterility - generate code (protected)
router.post('/', auth, (req, res) => {
  const { product_name, catalog_no, batch_no, customer_name, customer_company, invoice_date, manufacture_date, expiry_date, test_result, notes } = req.body;
  if (!product_name) return res.status(400).json({ error: 'product_name required' });
  let code, attempts = 0;
  do {
    code = generateCode(invoice_date);
    attempts++;
    if (attempts > 20) return res.status(500).json({ error: 'Could not generate unique code' });
  } while (db.prepare('SELECT id FROM sterility_codes WHERE code=?').get(code));
  const result = db.prepare('INSERT INTO sterility_codes (code,product_name,catalog_no,batch_no,customer_name,customer_company,invoice_date,manufacture_date,expiry_date,test_result,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(code, product_name, catalog_no||'', batch_no||'', customer_name||'', customer_company||'', invoice_date||null, manufacture_date||null, expiry_date||null, test_result||'PASS', notes||'');
  const record = db.prepare('SELECT * FROM sterility_codes WHERE id=?').get(result.lastInsertRowid);
  res.json(record);
});

// GET /api/sterility - list all (protected)
router.get('/', auth, (req, res) => {
  const rows = db.prepare('SELECT * FROM sterility_codes WHERE is_active=1 ORDER BY created_at DESC').all();
  res.json(rows);
});

// GET /api/sterility/verify/:code - public verification
router.get('/verify/:code', (req, res) => {
  const record = db.prepare('SELECT * FROM sterility_codes WHERE code=? AND is_active=1').get(req.params.code.toUpperCase());
  if (!record) return res.status(404).json({ valid: false, message: 'Code not found or invalid' });
  res.json({ valid: true, ...record });
});

// DELETE /api/sterility/:id - deactivate (protected)
router.delete('/:id', auth, (req, res) => {
  db.prepare('UPDATE sterility_codes SET is_active=0 WHERE id=?').run(req.params.id);
  res.json({ message: 'Code deactivated' });
});

module.exports = router;
