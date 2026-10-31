const express = require('express');
const router = express.Router();


router.post('/deleteSubject', async (req, res) => {
  try {
    const { id } = req.body || {};

    if (!id) {
      return res.status(400).json({ message: 'id is required' });
    }


    const [rows] = await req.pool.query(
      `SELECT id, subject_code, subject_name FROM subjects WHERE id = ?`,
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ message: 'Subject not found' });
    }


    const [used] = await req.pool.query(
      `SELECT 1 FROM allocations WHERE subject_id = ? LIMIT 1`,
      [id]
    );
    if (used.length) {
      return res.status(400).json({
        message: 'Subject has allocations — cancel them first'
      });
    }


    await req.pool.query(`DELETE FROM subjects WHERE id = ?`, [id]);

    return res.status(200).json({ message: 'Subject deleted successfully' });
  } catch (err) {
    console.error('deleteSubject error:', err);
    return res.status(500).json({ message: 'Failed to delete subject' });
  }
});

module.exports = router;