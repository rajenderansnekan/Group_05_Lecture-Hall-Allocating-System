const express = require('express');
const router = express.Router();

router.get('/users', async (req, res) => {
  try {
    const [users] = await req.pool.query(`
      SELECT id, index_no, name, email, role, department, batch_year, status
        FROM users
       ORDER BY FIELD(role, 'admin', 'lecturer', 'student'), name ASC`);
    res.json({ count: users.length, users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

module.exports = router;
