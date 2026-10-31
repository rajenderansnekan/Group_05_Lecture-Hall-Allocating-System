const express = require('express');
const router = express.Router();
const { sign, checkPassword, hashPassword } = require('../lib/auth');

// FR-45: lock the account for 15 minutes after 5 failed attempts
const attempts = new Map();
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;

router.post('/login', async (req, res) => {
  try {
    const email = String((req.body || {}).email || '').trim().toLowerCase();
    const password = String((req.body || {}).password || '');
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

    const lock = attempts.get(email);
    if (lock && lock.until && lock.until > Date.now()) {
      const mins = Math.ceil((lock.until - Date.now()) / 60000);
      return res.status(429).json({ message: `Too many failed attempts. Try again in ${mins} minute(s).` });
    }

    const [rows] = await req.pool.query('SELECT * FROM users WHERE LOWER(email) = ? LIMIT 1', [email]);
    const user = rows[0];
    const check = user ? await checkPassword(password, user.password) : { ok: false };

    if (!user || !check.ok) {
      const a = attempts.get(email) || { count: 0 };
      a.count += 1;
      if (a.count >= MAX_FAILS) { a.until = Date.now() + LOCK_MS; a.count = 0; }
      attempts.set(email, a);
      // FR-04: the message does not say which part was wrong
      return res.status(401).json({ message: 'Invalid credentials. Please check your email and password.' });
    }
    if (user.status && user.status !== 'active') {
      return res.status(403).json({ message: 'This account is disabled. Contact the administrator.' });
    }
    attempts.delete(email);

    // Old plain-text passwords are replaced by a bcrypt hash at the first successful login
    if (check.legacy) {
      await req.pool.query('UPDATE users SET password = ? WHERE id = ?', [await hashPassword(password), user.id]);
    }

    const token = sign({ id: user.id, email: user.email.toLowerCase(), role: user.role });
    res.json({
      token,
      user: {
        id: user.id, name: user.name, email: user.email, role: user.role,
        initials: user.initials, department: user.department, index_no: user.index_no
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
