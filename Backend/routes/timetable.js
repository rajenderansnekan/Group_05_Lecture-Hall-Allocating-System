const express = require('express');
const router = express.Router();

// Admin sees everything, a lecturer sees their own classes, a student sees confirmed classes of their department (FR-50 to FR-52).
// The user comes from the sign-in token, not from the request.
router.get('/timetable', async (req, res) => {
  try {
    const [users] = await req.pool.query('SELECT role, index_no, department FROM users WHERE id = ?', [req.user.id]);
    if (!users.length) return res.status(404).json({ message: 'User not found' });
    const u = users[0];

    if (u.role === 'admin') {
      const [rows] = await req.pool.query('SELECT * FROM allocations');
      return res.json(rows);
    }
    if (u.role === 'lecturer') {
      const [rows] = await req.pool.query('SELECT * FROM allocations WHERE lecturer_index_no = ?', [u.index_no]);
      return res.json(rows);
    }
    const [rows] = await req.pool.query('SELECT * FROM allocations WHERE department = ? AND status = ?', [u.department, 'confirmed']);
    return res.json(rows);
  } catch (error) {
    console.error('Error fetching timetable:', error);
    return res.status(500).json({ message: 'Failed to fetch timetable' });
  }
});

module.exports = router;
