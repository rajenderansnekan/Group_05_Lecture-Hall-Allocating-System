const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { hashPassword, passwordProblems } = require('../lib/auth');
const { sendMail, mailConfigured } = require('../lib/mailer');
const { notify } = require('../lib/allocations');

const MINUTES = 30;
const sha256 = v => crypto.createHash('sha256').update(v).digest('hex');
const asked = new Map();
const GENERIC = 'If that account exists, a reset link has been sent. If you do not receive it, contact the administrator.';


router.post('/forgot-password', async (req, res) => {
  try {
    const id = String((req.body || {}).identifier || '').trim().toLowerCase();
    if (!id) return res.status(400).json({ message: 'Enter your ID or email.' });

    const now = Date.now();
    const log = (asked.get(id) || []).filter(t => now - t < 3600000);
    if (log.length >= 3) return res.status(429).json({ message: 'Too many requests. Try again in an hour or contact the administrator.' });
    asked.set(id, [...log, now]);

    const [rows] = await req.pool.query(
      "SELECT id, name, email, index_no FROM users WHERE (LOWER(email) = ? OR LOWER(index_no) = ?) AND (status IS NULL OR status = 'active') LIMIT 1", [id, id]);
    if (!rows.length) return res.json({ message: GENERIC });
    const user = rows[0];

    const token = crypto.randomBytes(32).toString('hex');
    await req.pool.query('UPDATE password_resets SET used = 1 WHERE user_id = ? AND used = 0', [user.id]);
    await req.pool.query('INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))',
      [user.id, sha256(token), MINUTES]);

    const base = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    const link = `${base}/reset-password.html?token=${token}`;
    const sent = await sendMail({
      to: user.email,
      subject: 'LHAS password reset',
      text: `Hello ${user.name},\n\nUse this link to choose a new password. It works once and expires in ${MINUTES} minutes.\n\n${link}\n\nIf you did not ask for this, ignore this email.`
    });

    if (!sent.sent) {

      console.log(`Password reset link for ${user.email}: ${link}`);
      await notify(req.pool, { message: `${user.name} (${user.index_no || user.email}) asked for a password reset. Email is not set up, so issue a temporary password from the Users page.`, type: 'warning' });
    }
    return res.json({ message: GENERIC });
  } catch (err) {
    console.error('forgot-password error:', err);
    return res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
});

router.get('/reset-password/check', async (req, res) => {
  try {
    const token = String(req.query.token || '');
    const [rows] = await req.pool.query('SELECT id FROM password_resets WHERE token_hash = ? AND used = 0 AND expires_at > NOW()', [sha256(token)]);
    return res.json({ valid: rows.length > 0 });
  } catch { return res.json({ valid: false }); }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body || {};
    const missing = passwordProblems(newPassword);
    if (missing.length) return res.status(400).json({ message: `The new password needs ${missing.join(', ')}.` });

    const [rows] = await req.pool.query(
      'SELECT id, user_id FROM password_resets WHERE token_hash = ? AND used = 0 AND expires_at > NOW()', [sha256(String(token || ''))]);
    if (!rows.length) return res.status(400).json({ message: 'This reset link is not valid any more. Ask for a new one.' });

    const hash = await hashPassword(newPassword);
    await req.pool.query('UPDATE users SET password = ? WHERE id = ?', [hash, rows[0].user_id]);
    await req.pool.query('UPDATE password_resets SET used = 1 WHERE user_id = ?', [rows[0].user_id]);
    const [[u]] = await req.pool.query('SELECT email FROM users WHERE id = ?', [rows[0].user_id]);
    await notify(req.pool, { to: u.email, message: 'Your password was reset. If this was not you, contact the administrator.', type: 'warning' });
    return res.json({ message: 'Password updated. You can sign in now.' });
  } catch (err) {
    console.error('reset-password error:', err);
    return res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;
