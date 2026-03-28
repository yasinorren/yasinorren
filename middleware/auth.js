const jwt = require('jsonwebtoken');

const getSecret = () => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET environment variable is not set');
  return process.env.JWT_SECRET;
};

module.exports = function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token gerekli' });
  }
  try {
    const token = auth.split(' ')[1];
    req.user = jwt.verify(token, getSecret());
    next();
  } catch {
    res.status(401).json({ error: 'Geçersiz veya süresi dolmuş token' });
  }
};
