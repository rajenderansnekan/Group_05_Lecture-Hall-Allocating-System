const express = require('express');
const router = express.Router();

router.get('/halls', async (req, res) => {
  
  try {

    const [halls] = await req.pool.query(`select * from halls`)
    return res.json(halls)

  }
  catch (error) {
    console.error('Error fetching halls data:', error);

    return res.status(500).json({
      message: 'Failed to fetch halls data'
    });
  }
});

module.exports = router;