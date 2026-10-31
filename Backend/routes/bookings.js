const express = require('express');
const router = express.Router();
const rules = require('../lib/rules');
const { notify } = require('../lib/allocations');

const PURPOSES = ['Regular lecture', 'Extra lecture', 'Replacement lecture'];
const SQL_BOOKING = `
  SELECT b.id, b.subject_id, b.hall_id, b.booking_date, b.start_time, b.end_time, b.students, b.equipment,
         b.purpose, b.status, b.review_reason, b.allocation_id, b.created_at,
         s.subject_code, s.subject_name, h.name AS hall_name
    FROM booking_requests b
    LEFT JOIN subjects s ON s.id = b.subject_id
    LEFT JOIN halls h ON h.id = b.hall_id`;

async function ownedSubject(pool, userId, subjectId) {
  const [rows] = await pool.query(
    `SELECT s.id, s.subject_code, s.subject_name FROM subjects s
       JOIN users u ON u.index_no = s.lecturer_index
      WHERE s.id = ? AND u.id = ?`, [subjectId, userId]);
  return rows[0] || null;
}

// FR-46, FR-48, BR-11, BR-13: the same checks run for the hall list, for a new request and for an edit.
async function checkBooking(pool, user, body, { ignoreBookingId = 0 } = {}) {
  const request = {
    subjectId: Number(body.subject_id),
    students: Number(body.students),
    equipment: rules.parseEquipment(body.equipment),
    date: rules.normalizeDate(body.date),
    start: rules.normalizeTime(body.start_time),
    end: rules.normalizeTime(body.end_time)
  };
  const fail = (message, status = 400) => ({ error: { message, status } });

  if (!request.subjectId) return fail('Choose one of your classes.');
  const subject = await ownedSubject(pool, user.id, request.subjectId);
  if (!subject) return fail('You can only book halls for your own classes.', 403);

  const slotError = rules.checkSlot(request);
  if (slotError) return fail(slotError);
  const windowError = rules.checkBookingWindow(request.date, request.start);
  if (windowError) return fail(windowError);

  const clash = await rules.lecturerConflict(pool, request);
  if (clash) return fail(`You already have a class at this time (${clash.subject_code || clash.subject}).`, 409);

  const [dup] = await pool.query(
    `SELECT id FROM booking_requests
      WHERE requested_by = ? AND subject_id = ? AND booking_date = ? AND start_time = ? AND end_time = ?
        AND status IN ('pending','approved') AND id <> ? LIMIT 1`,
    [user.id, request.subjectId, request.date, request.start, request.end, ignoreBookingId]);
  if (dup.length) return fail('You already have a request for this class at this time.', 409);

  const halls = await rules.evaluateHalls(pool, request);
  const suitable = halls.filter(h => h.score < 9999);
  return { request, subject, halls, suitable };
}

// Halls that fit a draft request (FR-47)
router.post('/suggest', async (req, res) => {
  try {
    const out = await checkBooking(req.pool, req.user, req.body || {}, { ignoreBookingId: Number((req.body || {}).booking_id) || 0 });
    if (out.error) return res.status(out.error.status).json({ message: out.error.message });
    return res.json({ suggestions: out.halls });
  } catch (err) {
    console.error('booking suggest error:', err);
    return res.status(500).json({ message: 'Failed to find halls' });
  }
});

// The lecturer's own classes
router.get('/my-subjects', async (req, res) => {
  try {
    const [rows] = await req.pool.query(
      `SELECT s.id, s.subject_code, s.subject_name, s.department, s.required_equipment
         FROM subjects s JOIN users u ON u.index_no = s.lecturer_index
        WHERE u.id = ? ORDER BY s.subject_code`, [req.user.id]);
    res.json(rows.map(r => ({ ...r, required_equipment: rules.parseEquipment(r.required_equipment) })));
  } catch (err) {
    console.error('my-subjects error:', err);
    res.status(500).json({ message: 'Failed to load your classes' });
  }
});

// FR-52: my bookings
router.get('/', async (req, res) => {
  try {
    const [rows] = await req.pool.query(`${SQL_BOOKING} WHERE b.requested_by = ? ORDER BY b.id DESC`, [req.user.id]);
    res.json(rows.map(r => ({ ...r, equipment: rules.parseEquipment(r.equipment) })));
  } catch (err) {
    console.error('list bookings error:', err);
    res.status(500).json({ message: 'Failed to load your bookings' });
  }
});

async function save(req, res, editingId) {
  try {
    const body = req.body || {};
    const purpose = PURPOSES.includes(body.purpose) ? body.purpose : 'Regular lecture';
    const out = await checkBooking(req.pool, req.user, body, { ignoreBookingId: editingId || 0 });
    if (out.error) return res.status(out.error.status).json({ message: out.error.message });
    const { request, subject, suitable } = out;

    // FR-33: refuse when no hall can serve the slot
    if (!suitable.length) {
      return res.status(409).json({ message: 'No suitable hall is free for this time. Try a different time.' });
    }
    let hallId = null;
    if (body.hall_id) {
      hallId = Number(body.hall_id);
      if (!suitable.some(h => Number(h.hall.id) === hallId)) {
        return res.status(409).json({ message: 'That hall is not suitable for this request any more. Choose another.' });
      }
    }

    if (editingId) {
      const [rows] = await req.pool.query('SELECT status FROM booking_requests WHERE id = ? AND requested_by = ?', [editingId, req.user.id]);
      if (!rows.length) return res.status(404).json({ message: 'Booking request not found' });
      if (rows[0].status !== 'pending') return res.status(409).json({ message: 'Only a pending request can be edited.' });
      await req.pool.query(
        `UPDATE booking_requests SET subject_id = ?, hall_id = ?, booking_date = ?, start_time = ?, end_time = ?,
                students = ?, equipment = ?, purpose = ? WHERE id = ?`,
        [request.subjectId, hallId, request.date, request.start, request.end, request.students,
         JSON.stringify(request.equipment), purpose, editingId]);
      return res.json({ message: 'Booking request updated', id: editingId });
    }

    const [result] = await req.pool.query(
      `INSERT INTO booking_requests
         (subject_id, requested_by, hall_id, booking_date, start_time, end_time, students, equipment, purpose)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [request.subjectId, req.user.id, hallId, request.date, request.start, request.end,
       request.students, JSON.stringify(request.equipment), purpose]);

    // FR-55: tell the administrators
    await notify(req.pool, {
      message: `New booking request for ${subject.subject_code} on ${request.date}, ${request.start}-${request.end}.`,
      type: 'info'
    });
    return res.status(201).json({ message: 'Booking request submitted for approval', id: result.insertId });
  } catch (err) {
    console.error('save booking error:', err);
    return res.status(500).json({ message: 'Failed to save the booking request' });
  }
}
router.post('/', (req, res) => save(req, res, 0));
router.put('/:id', (req, res) => save(req, res, Number(req.params.id)));

// FR-53: cancel (an approved booking needs a reason and also cancels its allocation)
router.post('/:id/cancel', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await req.pool.query(
      `SELECT b.*, s.subject_code FROM booking_requests b LEFT JOIN subjects s ON s.id = b.subject_id
        WHERE b.id = ? AND b.requested_by = ?`, [id, req.user.id]);
    if (!rows.length) return res.status(404).json({ message: 'Booking request not found' });
    const b = rows[0];
    if (!['pending', 'approved'].includes(b.status)) {
      return res.status(409).json({ message: 'This request can not be cancelled.' });
    }
    const reason = String((req.body || {}).reason || '').trim();
    if (b.status === 'approved' && !reason) {
      return res.status(400).json({ message: 'A reason is required to cancel an approved booking.' });
    }
    const finalReason = (reason || 'Cancelled by lecturer').slice(0, 255);

    if (b.status === 'approved' && b.allocation_id) {
      await req.pool.query("UPDATE allocations SET status = 'cancelled', cancellation_reason = ? WHERE id = ?", [finalReason, b.allocation_id]);
      await notify(req.pool, {
        message: `Booking for ${b.subject_code} on ${rules.normalizeDate(b.booking_date)} was cancelled by the lecturer. Reason: ${finalReason}`,
        type: 'warning'
      });
    }
    await req.pool.query("UPDATE booking_requests SET status = 'cancelled', review_reason = ? WHERE id = ?", [finalReason, id]);
    return res.json({ message: 'Booking cancelled' });
  } catch (err) {
    console.error('cancel booking error:', err);
    return res.status(500).json({ message: 'Failed to cancel the booking' });
  }
});

module.exports = router;
