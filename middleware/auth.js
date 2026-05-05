const jwt = require('jsonwebtoken');

const SECRET = () => process.env.JWT_SECRET || 'innomed-secret-2024';

module.exports = function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token required' });
  }
  try {
    req.user = jwt.verify(header.slice(7), SECRET());
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
