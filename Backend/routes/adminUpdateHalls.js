const express = require('express');
const router = express.Router();

router.post('/updateHalls', async (req, res) => {
  
  try {

    const [hall] = req.body;
    const { id, name, capacity, equipment, status } = hall;
    if(id == null)
    {
      await req.pool.query(`insert into halls (name, capacity, equipment, status) values (?, ?, ?, ?)`, [name, capacity, JSON.stringify(equipment), status]) 
    }
    else
    {
      await req.pool.query(`update halls set name = ?, capacity = ?, equipment = ?, status = ? where id = ?`, [name, capacity, JSON.stringify(equipment), status, id])
    }

    return res.status(200).json({
      message: id == null
        ? 'Hall created successfully'
        : 'Hall updated successfully'
    });

  }
  catch (error) {
    console.error('Error updateing halls data:', error);

    return res.status(500).json({
      message: 'Failed to update halls data'
    });
  }
});

module.exports = router;