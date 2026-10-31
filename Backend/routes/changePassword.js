const express = require('express');
const router = express.Router();
const { checkPassword, hashPassword, passwordProblems } = require('../lib/auth');
const { notify } = require('../lib/allocations');

// FR-41 to FR-43, BR-15, BR-16: a user can change only their own password (the user comes from the token)
router.post('/change-password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Please provide your current and new passwords.' });
    }
    const missing = passwordProblems(newPassword);
    if (missing.length) {
      return res.status(400).json({ message: `The new password needs ${missing.join(', ')}.` });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ message: 'The new password must be different from the current password.' });
    }

    const [rows] = await req.pool.query('SELECT id, email, password FROM users WHERE id = ?', [req.user.id]);
    if (!rows.length) return res.status(404).json({ message: 'User not found.' });

    const check = await checkPassword(currentPassword, rows[0].password);
    if (!check.ok) return res.status(401).json({ message: 'Your current password is incorrect.' });

    await req.pool.query('UPDATE users SET password = ? WHERE id = ?', [await hashPassword(newPassword), req.user.id]);
    await notify(req.pool, { to: rows[0].email, message: 'Your password was changed. If this was not you, contact the administrator.', type: 'warning' });
    return res.json({ message: 'Password changed successfully.' });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ message: 'An error occurred while changing your password.' });
  }
});

module.exports = router;
