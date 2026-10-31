const express = require('express');
const router = express.Router();


router.get('/history', async (req, res) => {
  try {
    const [history] = await req.pool.query(`
      SELECT
        a.id,
        CASE
          WHEN a.status = 'cancelled' THEN 'Cancelled'
          ELSE 'Created'
        END AS action,

        COALESCE(a.subject_code, s.subject_code, a.subject, s.subject_name)
          AS classCode,

        COALESCE(a.hall, h.name)
          AS hall,

        a.date,
        a.start_time,
        a.end_time,
        a.status,

        COALESCE(u.name, CAST(a.created_by AS CHAR))
          AS createdBy,

        a.cancellation_reason AS reason

      FROM allocations a

      LEFT JOIN subjects s
        ON s.id = a.subject_id

      LEFT JOIN halls h
        ON h.id = a.hall_id

      LEFT JOIN users u
        ON u.id = a.created_by

      ORDER BY a.date DESC, a.start_time DESC, a.id DESC
    `);

    res.json({
      count: history.length,
      history
    });

  } catch (error) {
    console.error('Error fetching allocation history:', error);

    res.status(500).json({
      message: 'Failed to fetch allocation history'
    });
  }
});

module.exports = router;