const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { hashPassword, passwordProblems } = require('../lib/auth');
const { notify } = require('../lib/allocations');

const DEFAULT_PASSWORD = 'LHAS@1234';

function initialsFromName(name) {
  return String(name || '')
    .trim()
    .split(/\s+/)
    .map(w => w[0] || '')
    .join('')
    .toUpperCase()
    .slice(0, 4);
}


router.post('/updateUser', async (req, res) => {
  try {
    const u = req.body || {};


    if (!u.name || !u.email) {
      return res.status(400).json({ message: 'name and email are required' });
    }
    const role = u.role || 'lecturer';
    if (!['admin', 'lecturer', 'student'].includes(role)) {
      return res.status(400).json({ message: 'Role must be admin, lecturer or student' });
    }
    const batchYear = u.batch_year === '' || u.batch_year == null ? null : Number(u.batch_year);
    if (batchYear !== null && ![1, 2, 3, 4].includes(batchYear)) {
      return res.status(400).json({ message: 'Batch year must be 1, 2, 3 or 4' });
    }
    const status = u.status === 'inactive' ? 'inactive' : 'active';


    const [dupEmail] = await req.pool.query(
      `SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1`,
      [u.email, u.id || 0]
    );
    if (dupEmail.length) {
      return res.status(409).json({ message: 'Email already exists' });
    }


    if (u.index_no) {
      const [dupIndex] = await req.pool.query(
        `SELECT id FROM users WHERE index_no = ? AND id <> ? LIMIT 1`,
        [u.index_no, u.id || 0]
      );
      if (dupIndex.length) {
        return res.status(409).json({ message: 'Index number already exists' });
      }
    }


    if (u.id) {
      const fields = [
        'name = ?',
        'initials = ?',
        'email = ?',
        'department = ?',
        'role = ?',
        'index_no = ?',
        'batch_year = ?',
        'status = ?'
      ];
      const vals = [
        u.name,
        initialsFromName(u.name),
        u.email,
        u.department ?? null,
        role,
        u.index_no || null,
        role === 'student' ? batchYear : null,
        status
      ];


      if (u.password) {
        const missing = passwordProblems(u.password);
        if (missing.length) return res.status(400).json({ message: `The password needs ${missing.join(', ')}.` });
        fields.push('password = ?');
        vals.push(await hashPassword(u.password));
      }

      vals.push(u.id);

      const [result] = await req.pool.query(
        `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
        vals
      );

      if (!result.affectedRows) {
        return res.status(404).json({ message: 'User not found' });
      }

      return res.status(200).json({ message: 'User updated successfully', id: u.id });
    }


    if (u.password) {
      const missing = passwordProblems(u.password);
      if (missing.length) return res.status(400).json({ message: `The password needs ${missing.join(', ')}.` });
    }
    const password = await hashPassword(u.password || DEFAULT_PASSWORD);

    const [result] = await req.pool.query(
      `INSERT INTO users
         (name, initials, department, status, index_no, email, password, role, batch_year)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        u.name,
        initialsFromName(u.name),
        u.department ?? null,
        status,
        u.index_no || null,
        u.email,
        password,
        role,
        role === 'student' ? batchYear : null
      ]
    );

    return res.status(200).json({ message: 'User added successfully', id: result.insertId });
  } catch (err) {
    console.error('updateUser error:', err);
    return res.status(500).json({ message: 'Failed to save user' });
  }
});

// Used when someone forgot their password and email is not set up: the administrator gives them a temporary one.
router.post('/users/:id/temporary-password', async (req, res) => {
  try {
    const [rows] = await req.pool.query('SELECT id, email FROM users WHERE id = ?', [Number(req.params.id)]);
    if (!rows.length) return res.status(404).json({ message: 'User not found' });
    const temp = 'Lhas-' + crypto.randomBytes(4).toString('hex') + 'A1';
    await req.pool.query('UPDATE users SET password = ? WHERE id = ?', [await hashPassword(temp), rows[0].id]);
    await notify(req.pool, { to: rows[0].email, message: 'An administrator gave you a temporary password. Sign in and change it from the sidebar.', type: 'warning' });
    return res.json({ message: 'Temporary password created. Share it with the user privately.', temporaryPassword: temp });
  } catch (err) {
    console.error('temporary password error:', err);
    return res.status(500).json({ message: 'Failed to create a temporary password' });
  }
});

module.exports = router;