const express = require('express');
const router = express.Router();

router.get('/lecturers', async (req, res) => {
  
  try {
    const [lecturers] = await req.pool.query(`select * from users where role = ?`, ["lecturer"])
    return res.json(lecturers)
  }
  catch (error) {
    console.error('Error fetching lecturer data:', error);

    return res.status(500).json({
      message: 'Failed to fetch lecturer data'
    });
  }
});

module.exports = router;