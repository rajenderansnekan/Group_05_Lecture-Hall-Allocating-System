const express = require('express');
const router = express.Router();


router.get('/timetable', async (req, res) => {
  
  try {
    const [timetable] = await req.pool.query(`
      SELECT
        a.id,
        a.date,
        a.start_time,
        a.end_time,
        a.status,
        a.subject_id,
        s.subject_code,
        s.subject_name,
        a.hall_id,
        h.name AS hall_name,
        a.lecturer_index_no,
        COALESCE(u.name, a.lecturer_name) AS lecturer_name,
        a.department
      FROM allocations a
      LEFT JOIN subjects s ON a.subject_id = s.id
      LEFT JOIN halls h ON a.hall_id = h.id
      LEFT JOIN users u ON a.lecturer_index_no = u.index_no
      ORDER BY a.date, a.start_time
    `);

    return res.status(200).json(timetable);
  } catch (error) {
    console.error('Error fetching timetable:', error);

    return res.status(500).json({
      message: 'Failed to fetch timetable data'
    });
  }
});

module.exports = router;