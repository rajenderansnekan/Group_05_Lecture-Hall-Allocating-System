const express = require('express');
const router = express.Router();
const { notify } = require('../lib/allocations');
const { colomboDate, colomboTime, normalizeDate, normalizeTime } = require('../lib/rules');


router.post('/:id/cancel', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const reason = String((req.body || {}).reason || '').trim();
    if (reason.length < 3) return res.status(400).json({ message: 'Give a reason for the cancellation.' });

    const [[user]] = await req.pool.query('SELECT index_no, name FROM users WHERE id = ?', [req.user.id]);
    const [rows] = await req.pool.query('SELECT * FROM allocations WHERE id = ?', [id]);
    const a = rows[0];
    if (!a || !user || !user.index_no || a.lecturer_index_no !== user.index_no) {
      return res.status(404).json({ message: 'Allocation not found.' });
    }
    if (a.status === 'cancelled') return res.status(409).json({ message: 'This allocation is already cancelled.' });

    const date = normalizeDate(a.date), end = normalizeTime(a.end_time);
    if (date < colomboDate(0) || (date === colomboDate(0) && end <= colomboTime())) {
      return res.status(409).json({ message: 'This class has already finished.' });
    }

    await req.pool.query("UPDATE allocations SET status = 'cancelled', cancellation_reason = ? WHERE id = ?", [`Lecturer: ${reason}`.slice(0, 255), id]);
    await req.pool.query("UPDATE booking_requests SET status = 'cancelled', review_reason = ? WHERE allocation_id = ? AND status = 'approved'", [reason.slice(0, 255), id]);
    await notify(req.pool, {
      message: `${user.name} cancelled ${a.subject_code} in ${a.hall} on ${date}, ${normalizeTime(a.start_time)}-${end}. Reason: ${reason}`,
      type: 'warning'
    });
    return res.json({ message: 'The hall was cancelled.' });
  } catch (err) {
    console.error('lecturer cancel error:', err);
    return res.status(500).json({ message: 'Failed to cancel the allocation' });
  }
});

module.exports = router;
