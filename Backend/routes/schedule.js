const express = require('express');
const router = express.Router();
const { colomboDate } = require('../lib/rules');

const DAYS = { yesterday: -1, today: 0, tomorrow: 1 };


router.get('/schedule', async (req, res) => {
  try {
    const key = DAYS[req.query.day] === undefined ? 'today' : req.query.day;
    const date = colomboDate(DAYS[key]);
    const params = [date];
    let sql = `SELECT id, date, start_time, end_time, hall, subject_code, subject, lecturer_name, department, batch_year
                 FROM allocations WHERE date = ? AND status = 'confirmed'`;
    const batch = Number(req.query.batch);
    if ([1, 2, 3, 4].includes(batch)) { sql += ' AND batch_year = ?'; params.push(batch); }
    if (req.query.department) { sql += ' AND department = ?'; params.push(String(req.query.department)); }
    sql += ' ORDER BY start_time, hall';

    const [rows] = await req.pool.query(sql, params);
    const [deps] = await req.pool.query("SELECT DISTINCT department FROM subjects WHERE department IS NOT NULL AND department <> '' ORDER BY department");
    return res.json({ day: key, date, rows, departments: deps.map(d => d.department) });
  } catch (err) {
    console.error('schedule error:', err);
    return res.status(500).json({ message: 'Failed to load the schedule' });
  }
});

module.exports = router;
