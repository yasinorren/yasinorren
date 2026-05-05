const router = require('express').Router();
const db     = require('../database/db');
const auth   = require('../middleware/auth');

function generateCode() {
  const year  = new Date().getFullYear();
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rand = '';
  for (let i = 0; i < 8; i++) rand += chars[Math.floor(Math.random() * chars.length)];
  return `INN-STERI-${year}-${rand}`;
}

// GET /api/sterility — protected
router.get('/', auth, (req, res) => {
  const rows = db.prepare('SELECT * FROM sterility_codes ORDER BY created_at DESC').all();
  res.json(rows);
});

// GET /api/sterility/verify/:code — PUBLIC
router.get('/verify/:code', (req, res) => {
  const record = db.prepare('SELECT * FROM sterility_codes WHERE code = ?').get(req.params.code.toUpperCase());
  if (!record) return res.status(404).json({ valid: false, message: 'Code not found or invalid' });
  res.json({ valid: true, ...record });
});

// POST /api/sterility — protected
router.post('/', auth, (req, res) => {
  const { code: rawCode, product_name, catalog_no, batch_no, customer, customer_company,
          invoice_date, manufacture_date, expiry_date, result, notes } = req.body;

  let code = rawCode ? rawCode.toUpperCase() : null;
  if (!code) {
    let attempts = 0;
    do {
      code = generateCode();
      if (++attempts > 20) return res.status(500).json({ error: 'Could not generate unique code' });
    } while (db.prepare('SELECT id FROM sterility_codes WHERE code = ?').get(code));
  }

  try {
    const r = db.prepare(
      'INSERT INTO sterility_codes (code, product_name, catalog_no, batch_no, customer, customer_company, invoice_date, manufacture_date, expiry_date, result, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
    ).run(
      code, product_name || '', catalog_no || '', batch_no || '',
      customer || '', customer_company || '',
      invoice_date || '', manufacture_date || '', expiry_date || '',
      result || 'PASS', notes || ''
    );
    const record = db.prepare('SELECT * FROM sterility_codes WHERE id = ?').get(r.lastInsertRowid);
    res.status(201).json(record);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// PUT /api/sterility/:id — protected
router.put('/:id', auth, (req, res) => {
  const { product_name, catalog_no, batch_no, customer, customer_company,
          invoice_date, manufacture_date, expiry_date, result, notes } = req.body;
  try {
    db.prepare(
      'UPDATE sterility_codes SET product_name=?,catalog_no=?,batch_no=?,customer=?,customer_company=?,invoice_date=?,manufacture_date=?,expiry_date=?,result=?,notes=? WHERE id=?'
    ).run(
      product_name || '', catalog_no || '', batch_no || '',
      customer || '', customer_company || '',
      invoice_date || '', manufacture_date || '', expiry_date || '',
      result || 'PASS', notes || '', req.params.id
    );
    res.json({ message: 'Sterility code updated' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// DELETE /api/sterility/:id — protected
router.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM sterility_codes WHERE id = ?').run(req.params.id);
  res.json({ message: 'Sterility code deleted' });
});

module.exports = router;
