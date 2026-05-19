const router = require('express').Router();
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');
const crypto = require('crypto');
const { requireAuth } = require('../middleware/auth');

const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/webm', 'video/quicktime',
]);

const MAX_SIZE_MB = 50;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const subdir = file.mimetype.startsWith('video') ? 'videos' : 'images';
    const dir    = path.join(UPLOAD_DIR, subdir);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '');
    const name = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
    cb(null, name);
  },
});

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME.has(file.mimetype)) {
    return cb(new Error(`File type not allowed: ${file.mimetype}`));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE_MB * 1024 * 1024, files: 10 },
});

/* ─── POST /api/upload/media ─── */
router.post('/media', requireAuth, upload.array('files', 10), (req, res) => {
  if (!req.files || !req.files.length) {
    return res.status(400).json({ error: 'No files uploaded.' });
  }

  const urls = req.files.map(f => {
    const subdir = f.mimetype.startsWith('video') ? 'videos' : 'images';
    return `/uploads/${subdir}/${f.filename}`;
  });

  const mediaType = req.files[0].mimetype.startsWith('video') ? 'video' : 'image';
  res.json({ urls, media_type: mediaType });
});

/* ─── POST /api/upload/avatar ─── */
router.post('/avatar', requireAuth, upload.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  if (!req.file.mimetype.startsWith('image/')) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'Avatar must be an image.' });
  }

  const url = `/uploads/images/${req.file.filename}`;
  const db  = require('../database/db');
  db.prepare('UPDATE users SET avatar_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(url, req.user.id);
  res.json({ url });
});

/* ─── POST /api/upload/cover ─── */
router.post('/cover', requireAuth, upload.single('cover'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  if (!req.file.mimetype.startsWith('image/')) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'Cover must be an image.' });
  }

  const url = `/uploads/images/${req.file.filename}`;
  const db  = require('../database/db');
  db.prepare('UPDATE users SET cover_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(url, req.user.id);
  res.json({ url });
});

/* Multer error handler */
router.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: `File too large. Maximum ${MAX_SIZE_MB}MB.` });
  }
  if (err.message?.startsWith('File type not allowed')) {
    return res.status(415).json({ error: err.message });
  }
  next(err);
});

module.exports = router;
