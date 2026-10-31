const express = require('express');
const router = express.Router();

router.get('/stats', async (req, res) => {
  
  try {
    const [hallsCount] = await req.pool.query(`select count(*) as hallsCount from halls`)
    const [hallsStatus] = await req.pool.query(`select * from halls`)
    const today = new Date().toISOString().split('T')[0];
    const [todayClasses] = await req.pool.query(`select count(*) as todayClasses from allocations where date = ? AND status = ?`, [today, "confirmed"])
    const [lecturers] = await req.pool.query(`select count(*) as lecturers from users where role = ?`, ["lecturer"])
    const [subjects] = await req.pool.query(`select count(*) as subjects from subjects`)
    const [pendingBookings] = await req.pool.query(`select count(*) as pendingBookings from booking_requests where status = ?`, ["pending"])
    return res.json({pendingBookings: pendingBookings[0].pendingBookings, hallsCount: hallsCount[0].hallsCount, hallsStatus, todayClasses: todayClasses[0].todayClasses, lecturers: lecturers[0].lecturers, subjects: subjects[0].subjects})
  }
  catch (error) {
    console.error('Error fetching stats:', error);

    return res.status(500).json({
      message: 'Failed to fetch stats'
    });
  }
});

module.exports = router;