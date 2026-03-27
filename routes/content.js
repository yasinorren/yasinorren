const express = require('express');
const router = express.Router();
const db = require('../database/db');
const auth = require('../middleware/auth');

/* GET /api/content  — public, returns all content as grouped object */
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT section, key, value FROM site_content').all();
  const content = {};
  for (const row of rows) {
    if (!content[row.section]) content[row.section] = {};
    content[row.section][row.key] = row.value;
  }
  res.json(content);
});

/* GET /api/content/schema  — protected, returns full rows with labels/types */
router.get('/schema', auth, (req, res) => {
  const rows = db.prepare('SELECT * FROM site_content ORDER BY section, id').all();
  res.json(rows);
});

/* PUT /api/content  — protected, batch update { "section.key": "value" } */
router.put('/', auth, (req, res) => {
  const updates = req.body;
  if (!updates || typeof updates !== 'object') return res.status(400).json({ error: 'Invalid body' });

  const update = db.prepare(
    'UPDATE site_content SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE section = ? AND key = ?'
  );
  const updateMany = db.transaction((items) => {
    for (const [sectionKey, value] of Object.entries(items)) {
      const dotIdx = sectionKey.indexOf('.');
      if (dotIdx === -1) continue;
      const section = sectionKey.substring(0, dotIdx);
      const key = sectionKey.substring(dotIdx + 1);
      update.run(String(value), section, key);
    }
  });

  try {
    updateMany(updates);
    res.json({ message: 'Content updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
