const express = require('express');
const router = express.Router();


router.post('/deleteUser', async (req, res) => {
  try {
    const { id, index_no } = req.body || {};

    if (!id && !index_no) {
      return res.status(400).json({ message: 'id or index_no is required' });
    }


    const [rows] = id
      ? await req.pool.query(`SELECT id, name FROM users WHERE id = ?`, [id])
      : await req.pool.query(`SELECT id, name FROM users WHERE index_no = ?`, [index_no]);

    if (!rows.length) {
      return res.status(404).json({ message: 'User not found' });
    }
    const userId = rows[0].id;


    const [subjUsed] = await req.pool.query(
      `SELECT 1 FROM subjects WHERE lecturer_id = ? LIMIT 1`,
      [userId]
    );
    if (subjUsed.length) {
      return res.status(400).json({
        message: 'User is assigned to subjects — reassign them first'
      });
    }


    const [allocUsed] = await req.pool.query(
      `SELECT 1 FROM allocations WHERE created_by = ? LIMIT 1`,
      [userId]
    );
    if (allocUsed.length) {
      return res.status(400).json({
        message: 'User has created allocations — cannot delete'
      });
    }


    await req.pool.query(`DELETE FROM users WHERE id = ?`, [userId]);

    return res.status(200).json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('deleteUser error:', err);
    return res.status(500).json({ message: 'Failed to delete user' });
  }
});

module.exports = router;