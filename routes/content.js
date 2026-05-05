const router = require('express').Router();
const db     = require('../database/db');
const auth   = require('../middleware/auth');

// GET /api/content — public, returns array of {section, key, value}
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT section, key, value FROM site_content ORDER BY section, id').all();
  res.json(rows);
});

// PUT /api/content — protected, accepts { "section.key": value, ... }
router.put('/', auth, (req, res) => {
  const updates = req.body;
  if (!updates || typeof updates !== 'object')
    return res.status(400).json({ error: 'Invalid body' });

  const upsert = db.prepare(
    'INSERT INTO site_content (section, key, value) VALUES (?, ?, ?) ON CONFLICT(section, key) DO UPDATE SET value=excluded.value'
  );

  const runAll = db.transaction((items) => {
    for (const [sectionKey, value] of Object.entries(items)) {
      const dot = sectionKey.indexOf('.');
      if (dot === -1) continue;
      const section = sectionKey.substring(0, dot);
      const key     = sectionKey.substring(dot + 1);
      upsert.run(section, key, String(value));
    }
  });

  try {
    runAll(updates);
    res.json({ message: 'Content updated successfully' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
