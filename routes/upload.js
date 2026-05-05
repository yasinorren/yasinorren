const router = require('express').Router();
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');
const auth   = require('../middleware/auth');

const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_EXTS  = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']);
const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const rand = Math.random().toString(36).slice(2, 10);
    cb(null, `${Date.now()}-${rand}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTS.has(ext) && !ALLOWED_MIMES.has(file.mimetype)) {
    return cb(new Error('Only image files are allowed (jpg, jpeg, png, gif, webp, svg)'));
  }
  cb(null, true);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });

// POST /api/upload
router.post('/', auth, (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json({
      url:      `/uploads/${req.file.filename}`,
      filename: req.file.filename,
      size:     req.file.size,
    });
  });
});

// GET /api/upload
router.get('/', auth, (req, res) => {
  try {
    const files = fs.readdirSync(UPLOAD_DIR)
      .filter(f => ALLOWED_EXTS.has(path.extname(f).toLowerCase()))
      .map(f => {
        const stat = fs.statSync(path.join(UPLOAD_DIR, f));
        return { filename: f, url: `/uploads/${f}`, size: stat.size, mtime: stat.mtime };
      })
      .sort((a, b) => b.mtime - a.mtime);
    res.json(files);
  } catch {
    res.json([]);
  }
});

// DELETE /api/upload/:filename
router.delete('/:filename', auth, (req, res) => {
  const filename = path.basename(req.params.filename);
  const filepath = path.join(UPLOAD_DIR, filename);
  if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'File not found' });
  try {
    fs.unlinkSync(filepath);
    res.json({ message: 'File deleted' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
