const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');

const uploadDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = `${Date.now()}-${Math.random().toString(36).substr(2,8)}${ext}`;
    cb(null, name);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = ['.jpg','.jpeg','.png','.gif','.webp','.svg'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error('Only image files allowed'));
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });

// POST /api/upload - upload image (protected)
router.post('/', auth, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const url = `/uploads/${req.file.filename}`;
  res.json({ url, filename: req.file.filename });
});

// GET /api/upload - list all uploaded files (protected)
router.get('/', auth, (req, res) => {
  try {
    const files = fs.readdirSync(uploadDir)
      .filter(f => ['.jpg','.jpeg','.png','.gif','.webp','.svg'].includes(path.extname(f).toLowerCase()))
      .map(f => ({ filename: f, url: `/uploads/${f}`, size: fs.statSync(path.join(uploadDir, f)).size }))
      .sort((a, b) => b.size - a.size);
    res.json(files);
  } catch(e) { res.json([]); }
});

// DELETE /api/upload/:filename - delete file (protected)
router.delete('/:filename', auth, (req, res) => {
  const filename = path.basename(req.params.filename);
  const filepath = path.join(uploadDir, filename);
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
    res.json({ message: 'File deleted' });
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

module.exports = router;
