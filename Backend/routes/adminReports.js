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

module.exports = router;