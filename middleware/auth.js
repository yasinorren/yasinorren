const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'bilim-platformu-secret-2024';

function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Kimlik doğrulama gerekli.' });
  }
  try {
    req.user = jwt.verify(auth.slice(7), SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Geçersiz veya süresi dolmuş oturum.' });
  }
}

function requireRole(...roles) {
  return [authenticate, (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Bu işlem için yetkiniz bulunmuyor.' });
    }
    next();
  }];
}

module.exports = { authenticate, requireRole };
