const express = require('express');
const router = express.Router();
const { notify } = require('../lib/allocations');
const { colomboDate, normalizeDate, normalizeTime } = require('../lib/rules');

router.get('/feedback', async (req, res) => {
  const [rows] = await req.pool.query(
    `SELECT f.id, f.hall_id, f.category, f.severity, f.message, f.status, f.admin_response, f.created_at, f.updated_at,
            h.name AS hall_name, h.status AS hall_status, u.name AS reporter_name, u.email AS reporter_email
       FROM hall_feedback f
       LEFT JOIN halls h ON h.id = f.hall_id
       LEFT JOIN users u ON u.id = f.reported_by
      ORDER BY FIELD(f.status, 'open', 'in_progress', 'resolved'), FIELD(f.severity, 'high', 'medium', 'low'), f.id DESC`);
  res.json(rows);
});

// Update the status, reply to the lecturer, and optionally change the hall state.
router.put('/feedback/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const b = req.body || {};
    const [rows] = await req.pool.query(
      `SELECT f.*, h.name AS hall_name, u.email AS reporter_email FROM hall_feedback f
         LEFT JOIN halls h ON h.id = f.hall_id LEFT JOIN users u ON u.id = f.reported_by WHERE f.id = ?`, [id]);
    if (!rows.length) return res.status(404).json({ message: 'Feedback not found' });
    const f = rows[0];

    const status = ['open', 'in_progress', 'resolved'].includes(b.status) ? b.status : f.status;
    const response = String(b.response || '').trim().slice(0, 500);
    await req.pool.query('UPDATE hall_feedback SET status = ?, admin_response = ?, handled_by = ? WHERE id = ?',
      [status, response || f.admin_response, req.user.id, id]);

    // Hall state: under maintenance blocks new allocations; the lecturers who have it booked are told.
    if (['maintenance', 'active'].includes(b.hall_status)) {
      await req.pool.query('UPDATE halls SET status = ? WHERE id = ?', [b.hall_status, f.hall_id]);
      if (b.hall_status === 'maintenance') {
        const [upcoming] = await req.pool.query(
          `SELECT DISTINCT u.email, a.subject_code, a.date, a.start_time FROM allocations a
             JOIN users u ON u.index_no = a.lecturer_index_no
            WHERE a.hall_id = ? AND a.status = 'confirmed' AND a.date >= ?`, [f.hall_id, colomboDate(0)]);
        for (const r of upcoming) {
          await notify(req.pool, { to: r.email, message: `${f.hall_name} is under maintenance. Your class ${r.subject_code} on ${normalizeDate(r.date)} at ${normalizeTime(r.start_time)} may need another hall. Contact the administrator.`, type: 'warning' });
        }
      }
    }

    if (f.reporter_email && (status !== f.status || response)) {
      const label = { open: 'received', in_progress: 'being handled', resolved: 'resolved' }[status];
      await notify(req.pool, {
        to: f.reporter_email,
        message: `Your feedback about ${f.hall_name} (${f.category}) is ${label}.${response ? ' Reply: ' + response : ''}`,
        type: status === 'resolved' ? 'success' : 'info'
      });
    }
    return res.json({ message: 'Feedback updated' });
  } catch (err) {
    console.error('update feedback error:', err);
    return res.status(500).json({ message: 'Failed to update feedback' });
  }
});

module.exports = router;
