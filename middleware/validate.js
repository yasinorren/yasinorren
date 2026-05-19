/* Input validation & sanitization — no external deps needed */

const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;
const EMAIL_RE    = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const URL_RE      = /^https?:\/\/[^\s<>"']+$/;

/* Strip HTML / script tags to prevent stored XSS */
function sanitizeText(str, maxLen = 2000) {
  if (typeof str !== 'string') return '';
  return str
    .slice(0, maxLen)
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
}

function validateUsername(username) {
  if (!username || typeof username !== 'string') return 'Username is required.';
  if (!USERNAME_RE.test(username)) return 'Username must be 3–30 chars, letters/numbers/underscores only.';
  return null;
}

function validateEmail(email) {
  if (!email || typeof email !== 'string') return 'Email is required.';
  if (!EMAIL_RE.test(email.trim())) return 'Invalid email format.';
  if (email.length > 254) return 'Email too long.';
  return null;
}

function validatePassword(password) {
  if (!password || typeof password !== 'string') return 'Password is required.';
  if (password.length < 8)  return 'Password must be at least 8 characters.';
  if (password.length > 128) return 'Password too long.';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.';
  if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one digit.';
  return null;
}

function validatePostContent(content) {
  if (typeof content !== 'string') return 'Content must be a string.';
  if (content.trim().length === 0) return 'Post content cannot be empty.';
  if (content.length > 5000) return 'Post content is too long (max 5000 chars).';
  return null;
}

function validateUrl(url) {
  if (!url) return null; // optional
  if (!URL_RE.test(url)) return 'Invalid URL format.';
  if (url.length > 2048) return 'URL too long.';
  return null;
}

/* Extract hashtags from text */
function extractHashtags(text) {
  const matches = text.match(/#([a-zA-Z0-9_]{1,50})/g) || [];
  return [...new Set(matches.map(t => t.slice(1).toLowerCase()))].slice(0, 30);
}

/* Extract @mentions from text */
function extractMentions(text) {
  const matches = text.match(/@([a-zA-Z0-9_]{3,30})/g) || [];
  return [...new Set(matches.map(t => t.slice(1).toLowerCase()))].slice(0, 20);
}

module.exports = {
  sanitizeText,
  validateUsername,
  validateEmail,
  validatePassword,
  validatePostContent,
  validateUrl,
  extractHashtags,
  extractMentions,
};
