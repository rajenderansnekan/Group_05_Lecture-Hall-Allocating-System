const express = require('express');
const router = express.Router();
const { sign, checkPassword, hashPassword, TOKEN_HOURS, REMEMBER_HOURS } = require('../lib/auth');


const attempts = new Map();
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;

router.post('/login', async (req, res) => {
  try {
    const body = req.body || {};

    const email = String(body.identifier || body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const remember = body.remember === true;
    if (!email || !password) return res.status(400).json({ message: 'Enter your ID or email and your password.' });

    const lock = attempts.get(email);
    if (lock && lock.until && lock.until > Date.now()) {
      const mins = Math.ceil((lock.until - Date.now()) / 60000);
      return res.status(429).json({ message: `Too many failed attempts. Try again in ${mins} minute(s).` });
    }

    const [rows] = await req.pool.query('SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(index_no) = ? ORDER BY (LOWER(email) = ?) DESC LIMIT 1', [email, email, email]);
    const user = rows[0];
    const check = user ? await checkPassword(password, user.password) : { ok: false };

    if (!user || !check.ok) {
      const a = attempts.get(email) || { count: 0 };
      a.count += 1;
      if (a.count >= MAX_FAILS) { a.until = Date.now() + LOCK_MS; a.count = 0; }
      attempts.set(email, a);

      return res.status(401).json({ message: 'Invalid credentials. Please check your email and password.' });
    }
    if (user.status && user.status !== 'active') {
      return res.status(403).json({ message: 'This account is disabled. Contact the administrator.' });
    }
    attempts.delete(email);


    if (check.legacy) {
      await req.pool.query('UPDATE users SET password = ? WHERE id = ?', [await hashPassword(password), user.id]);
    }

    const token = sign({ id: user.id, email: user.email.toLowerCase(), role: user.role }, remember ? REMEMBER_HOURS : TOKEN_HOURS);
    res.json({
      token,
      user: {
        id: user.id, name: user.name, email: user.email, role: user.role,
        initials: user.initials, department: user.department, index_no: user.index_no, batch_year: user.batch_year
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
