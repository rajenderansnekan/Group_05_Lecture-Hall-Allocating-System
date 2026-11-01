const express = require('express');
const router = express.Router();


router.get('/reports', async (req, res) => {

  try {
    const [halls] = await req.pool.query(`
      SELECT
        h.id,
        h.name,
        h.capacity,
        h.status,
        COUNT(
          CASE WHEN a.status = 'confirmed' THEN 1 END
        ) AS confirmed_allocations
      FROM halls h
      LEFT JOIN allocations a ON a.hall_id = h.id
      GROUP BY h.id, h.name, h.capacity, h.status
      ORDER BY h.name
    `);

    const totalHalls = halls.length;
    const activeAllocations = halls.reduce(
      (sum, hall) => sum + Number(hall.confirmed_allocations),
      0
    );

    res.json({
      totalHalls,
      activeAllocations,
      halls
    });
  } catch (error) {
    console.error('Error fetching usage report:', error);
    res.status(500).json({
      message: 'Failed to fetch usage report'
    });
  }
});

// Allocation history for yesterday, today, tomorrow or a chosen range, used by the export buttons.
const { colomboDate } = require('../lib/rules');
router.get('/reports/allocations', async (req, res) => {
  try {
    const offsets = { yesterday: -1, today: 0, tomorrow: 1 };
    let from, to;
    if (offsets[req.query.range] !== undefined) from = to = colomboDate(offsets[req.query.range]);
    else {
      from = String(req.query.from || ''); to = String(req.query.to || from);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || to < from) {
        return res.status(400).json({ message: 'Choose a valid date range.' });
      }
    }
    const [rows] = await req.pool.query(
      `SELECT id, date, start_time, end_time, hall, subject_code, subject, lecturer_name, department, batch_year, status, cancellation_reason
         FROM allocations WHERE date BETWEEN ? AND ? ORDER BY date, start_time, hall`, [from, to]);
    return res.json({ from, to, rows });
  } catch (error) {
    console.error('Error fetching allocation export:', error);
    return res.status(500).json({ message: 'Failed to load allocation history' });
  }
});

module.exports = router;