const express = require('express');
const router = express.Router();

router.get('/allocations', async (req, res) => {
  
  try {
    const [allocations] = await req.pool.query(`select * from allocations`)
    return res.json(allocations)
  }
  catch (error) {
    console.error('Error fetching allocation data:', error);

    return res.status(500).json({
      message: 'Failed to fetch allocation data'
    });
  }
});

module.exports = router;