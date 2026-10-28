// Authentication helpers: password hashing (bcrypt), signed session tokens, role guard.
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

let SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  SECRET = crypto.randomBytes(32).toString('hex');
  console.warn('JWT_SECRET is not set in .env. A temporary secret is used, so everyone is signed out when the server restarts.');
}
const TOKEN_HOURS = Number(process.env.TOKEN_HOURS || 8);

function sign(payload) {
  const body = Buffer.from(JSON.stringify({
    ...payload,
    exp: Math.floor(Date.now() / 1000) + TOKEN_HOURS * 3600
  })).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verify(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  const a = Buffer.from(sig || ''); const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

function hashPassword(plain) { return bcrypt.hash(plain, 10); }

// Accepts bcrypt hashes and the old plain-text passwords. `legacy` tells the caller to upgrade the stored value.
async function checkPassword(plain, stored) {
  if (!stored || typeof plain !== 'string') return { ok: false, legacy: false };
  if (stored.startsWith('$2')) return { ok: await bcrypt.compare(plain, stored), legacy: false };
  const a = Buffer.from(plain); const b = Buffer.from(String(stored));
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  return { ok, legacy: ok };
}

// BR-15: at least 8 characters with an uppercase letter, a lowercase letter and a digit
function passwordProblems(pw) {
  const missing = [];
  if (typeof pw !== 'string' || pw.length < 8) missing.push('at least 8 characters');
  if (!/[A-Z]/.test(pw || '')) missing.push('an uppercase letter');
  if (!/[a-z]/.test(pw || '')) missing.push('a lowercase letter');
  if (!/\d/.test(pw || '')) missing.push('a digit');
  return missing;
}

// Express middleware. roles = [] means any signed-in user.
function requireAuth(roles = []) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const payload = header.startsWith('Bearer ') ? verify(header.slice(7)) : null;
    if (!payload) return res.status(401).json({ message: 'Please sign in again.' });
    if (roles.length && !roles.includes(payload.role)) {
      return res.status(403).json({ message: 'You do not have access to this action.' });
    }
    req.user = payload;
    next();
  };
}

module.exports = { sign, verify, hashPassword, checkPassword, passwordProblems, requireAuth };
