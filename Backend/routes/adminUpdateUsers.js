const express = require('express');
const router = express.Router();
const { hashPassword, passwordProblems } = require('../lib/auth');

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
        'index_no = ?'
      ];
      const vals = [
        u.name,
        initialsFromName(u.name),
        u.email,
        u.department ?? null,
        u.role || 'lecturer',
        u.index_no ?? null
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
         (name, initials, department, status, index_no, email, password, role)
       VALUES (?, ?, ?, 'active', ?, ?, ?, ?)`,
      [
        u.name,
        initialsFromName(u.name),
        u.department ?? null,
        u.index_no ?? null,
        u.email,
        password,
        u.role || 'lecturer'
      ]
    );

    return res.status(200).json({ message: 'User added successfully', id: result.insertId });
  } catch (err) {
    console.error('updateUser error:', err);
    return res.status(500).json({ message: 'Failed to save user' });
  }
});

module.exports = router;