const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');

const uploadDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const ALLOWED_EXTS  = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'text/html', 'text/plain'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const rand = Math.random().toString(36).slice(2, 10);
    cb(null, `${Date.now()}-${rand}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTS.includes(ext)) {
    return cb(new Error('Yalnızca resim dosyaları yüklenebilir (JPG, PNG, GIF, WebP, SVG)'));
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }
});

// POST /api/upload — upload image (protected)
router.post('/', auth, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Dosya yüklenmedi' });
  res.json({
    url:      `/uploads/${req.file.filename}`,
    filename: req.file.filename,
    name:     req.file.filename,
    size:     req.file.size
  });
});

// GET /api/upload — list uploaded files (protected)
router.get('/', auth, (req, res) => {
  try {
    const files = fs.readdirSync(uploadDir)
      .filter(f => ALLOWED_EXTS.includes(path.extname(f).toLowerCase()))
      .map(f => {
        const stat = fs.statSync(path.join(uploadDir, f));
        return { filename: f, name: f, url: `/uploads/${f}`, size: stat.size };
      })
      .sort((a, b) => b.size - a.size);
    res.json(files);
  } catch (e) {
    res.json([]);
  }
});

// DELETE /api/upload/:filename — delete file (protected)
router.delete('/:filename', auth, (req, res) => {
  const filename = path.basename(req.params.filename);
  const filepath = path.join(uploadDir, filename);
  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ error: 'Dosya bulunamadı' });
  }
  try {
    fs.unlinkSync(filepath);
    res.json({ message: 'Dosya silindi' });
  } catch (e) {
    res.status(500).json({ error: 'Dosya silinemedi: ' + e.message });
  }
});

module.exports = router;
