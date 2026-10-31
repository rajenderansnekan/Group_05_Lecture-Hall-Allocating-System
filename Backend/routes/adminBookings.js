const express = require('express');
const router = express.Router();
const rules = require('../lib/rules');
const { createAllocation, notify, withAllocationLock } = require('../lib/allocations');

const SQL = `
  SELECT b.id, b.subject_id, b.hall_id, b.booking_date, b.start_time, b.end_time, b.students, b.equipment,
         b.purpose, b.status, b.review_reason, b.allocation_id, b.created_at,
         s.subject_code, s.subject_name, h.name AS hall_name,
         u.name AS lecturer_name, u.email AS lecturer_email,
         r.name AS reviewed_by_name
    FROM booking_requests b
    LEFT JOIN subjects s ON s.id = b.subject_id
    LEFT JOIN halls h ON h.id = b.hall_id
    LEFT JOIN users u ON u.id = b.requested_by
    LEFT JOIN users r ON r.id = b.reviewed_by`;

// FR-50
router.get('/bookings', async (req, res) => {
  try {
    const [rows] = await req.pool.query(`${SQL} ORDER BY FIELD(b.status, 'pending') DESC, b.booking_date, b.start_time`);
    res.json(rows.map(r => ({ ...r, equipment: rules.parseEquipment(r.equipment) })));
  } catch (err) {
    console.error('admin bookings error:', err);
    res.status(500).json({ message: 'Failed to load booking requests' });
  }
});

// FR-51: every hard constraint is checked again, then the allocation is created
router.post('/bookings/:id/approve', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const result = await withAllocationLock(req.pool, async (conn) => {
      const [rows] = await req.pool.query(`${SQL} WHERE b.id = ?`, [id]);
      if (!rows.length) { const e = new Error('Booking request not found'); e.status = 404; throw e; }
      const b = rows[0];
      if (b.status !== 'pending') { const e = new Error('This request has already been decided.'); e.status = 409; throw e; }

      const request = {
        subjectId: b.subject_id, students: b.students, equipment: rules.parseEquipment(b.equipment),
        date: rules.normalizeDate(b.booking_date), start: rules.normalizeTime(b.start_time), end: rules.normalizeTime(b.end_time)
      };

      // The lecturer's hall, or the best suitable hall when "any" was chosen
      let candidates;
      if (b.hall_id) candidates = [b.hall_id];
      else candidates = (await rules.evaluateHalls(req.pool, request)).filter(h => h.score < 9999).map(h => h.hall.id);

      let chosen = null; let lastReasons = ['No suitable hall is free for this slot.'];
      for (const hallId of candidates) {
        const check = await rules.validateAllocation(req.pool, request, hallId);
        if (check.ok) { chosen = check.hall; break; }
        lastReasons = check.reasons;
      }
      if (!chosen) { const e = new Error(`Approval blocked: ${lastReasons.join('; ')}`); e.status = 409; throw e; }

      const created = await createAllocation(conn, {
        subjectId: b.subject_id, hall: chosen, date: request.date, start: request.start, end: request.end,
        status: 'confirmed', createdBy: req.user.id
      });
      await req.pool.query(
        "UPDATE booking_requests SET status = 'approved', hall_id = ?, allocation_id = ?, reviewed_by = ?, review_reason = NULL WHERE id = ?",
        [chosen.id, created.id, req.user.id, id]);
      return { b, chosen, allocationId: created.id };
    });

    await notify(req.pool, {
      to: result.b.lecturer_email,
      message: `Your booking for ${result.b.subject_code} on ${rules.normalizeDate(result.b.booking_date)}, ${rules.normalizeTime(result.b.start_time)}-${rules.normalizeTime(result.b.end_time)} was approved. Hall: ${result.chosen.name}.`,
      type: 'success'
    });
    res.json({ message: `Booking approved. Allocated ${result.chosen.name}.`, allocation_id: result.allocationId });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    console.error('approve booking error:', err);
    res.status(500).json({ message: 'Failed to approve the booking' });
  }
});

// FR-50: a rejection needs a reason (BR-14)
router.post('/bookings/:id/reject', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const reason = String((req.body || {}).reason || '').trim();
    if (!reason) return res.status(400).json({ message: 'A reason is required to reject a request.' });

    const [rows] = await req.pool.query(`${SQL} WHERE b.id = ?`, [id]);
    if (!rows.length) return res.status(404).json({ message: 'Booking request not found' });
    const b = rows[0];
    if (b.status !== 'pending') return res.status(409).json({ message: 'This request has already been decided.' });

    await req.pool.query("UPDATE booking_requests SET status = 'rejected', review_reason = ?, reviewed_by = ? WHERE id = ?",
      [reason.slice(0, 255), req.user.id, id]);
    await notify(req.pool, {
      to: b.lecturer_email,
      message: `Your booking for ${b.subject_code} on ${rules.normalizeDate(b.booking_date)} was rejected. Reason: ${reason}`,
      type: 'danger'
    });
    res.json({ message: 'Booking rejected' });
  } catch (err) {
    console.error('reject booking error:', err);
    res.status(500).json({ message: 'Failed to reject the booking' });
  }
});

module.exports = router;
