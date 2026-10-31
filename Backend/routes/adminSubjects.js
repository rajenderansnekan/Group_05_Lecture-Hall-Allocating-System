const express = require('express');
const router = express.Router();

router.get('/subjects', async (req, res) => {
  
  try {
    const [subjects] = await req.pool.query(`select s.*, u.name as lecturer_name from subjects s left join users u on s.lecturer_index = u.index_no`)
    return res.json(subjects)
  }
  catch (error) {
    console.error('Error fetching subject data:', error);

    return res.status(500).json({
      message: 'Failed to fetch subject data'
    });
  }
});

module.exports = router;