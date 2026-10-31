const express = require('express');
const router = express.Router();
const { validateAllocation, checkSlot, normalizeDate, normalizeTime, parseEquipment } = require('../lib/rules');
const { createAllocation, subjectInfo, notify, withAllocationLock } = require('../lib/allocations');

// Create an allocation, confirm a pending one, or cancel one.
// Every hard constraint is checked again on the server before anything is saved (FR-47, BR-07).
router.post('/updateAllocations', async (req, res) => {
  try {
    const a = req.body || {};

    // ---------- change an existing allocation (confirm or cancel) ----------
    if (a.id) {
      const [rows] = await req.pool.query('SELECT * FROM allocations WHERE id = ?', [a.id]);
      if (!rows.length) return res.status(404).json({ message: 'Allocation not found' });
      const current = rows[0];
      const next = a.status;
      if (!['pending', 'confirmed', 'cancelled'].includes(next)) {
        return res.status(400).json({ message: 'Invalid allocation status' });
      }

      if (next === 'cancelled') {
        const reason = String(a.cancellation_reason || '').trim();
        if (!reason) return res.status(400).json({ message: 'A reason is required to cancel an allocation' });
        await req.pool.query('UPDATE allocations SET status = ?, cancellation_reason = ? WHERE id = ?',
          ['cancelled', reason.slice(0, 255), a.id]);
      } else if (next === 'confirmed' && current.status !== 'confirmed') {
        await withAllocationLock(req.pool, async () => {
          const check = await validateAllocation(req.pool, {
            subjectId: current.subject_id, students: 1, equipment: [],
            date: normalizeDate(current.date), start: normalizeTime(current.start_time), end: normalizeTime(current.end_time)
          }, current.hall_id, { ignoreAllocationId: current.id });
          if (!check.ok) { const e = new Error(check.reasons.join('; ')); e.status = 409; throw e; }
          await req.pool.query('UPDATE allocations SET status = ?, cancellation_reason = NULL WHERE id = ?', ['confirmed', a.id]);
        });
      } else {
        await req.pool.query('UPDATE allocations SET status = ? WHERE id = ?', [next, a.id]);
      }

      const s = await subjectInfo(req.pool, current.subject_id);
      if (s && s.lecturer_email && next !== current.status) {
        await notify(req.pool, {
          to: s.lecturer_email,
          message: `Your class ${s.subject_code} on ${normalizeDate(current.date)} (${normalizeTime(current.start_time)}-${normalizeTime(current.end_time)}) is now ${next}.`,
          type: next === 'cancelled' ? 'warning' : 'success'
        });
      }
      return res.status(200).json({ message: 'Allocation updated successfully' });
    }

    // ---------- create a new allocation ----------
    const request = {
      subjectId: Number(a.subject_id),
      students: Number(a.students),
      equipment: parseEquipment(a.equipment),
      date: normalizeDate(a.date),
      start: normalizeTime(a.start_time),
      end: normalizeTime(a.end_time)
    };
    const slotError = checkSlot(request);
    if (slotError) return res.status(400).json({ message: slotError });
    if (!(await subjectInfo(req.pool, request.subjectId))) return res.status(404).json({ message: 'Subject not found' });

    let hallId = Number(a.hall_id);
    if (!hallId && a.hall) {
      const [h] = await req.pool.query('SELECT id FROM halls WHERE name = ?', [a.hall]);
      hallId = h.length ? h[0].id : 0;
    }
    if (!hallId) return res.status(400).json({ message: 'Choose a hall' });

    const created = await withAllocationLock(req.pool, async (conn) => {
      const check = await validateAllocation(req.pool, request, hallId);
      if (!check.ok) { const e = new Error(check.reasons.join('; ')); e.status = 409; throw e; }
      return createAllocation(conn, {
        subjectId: request.subjectId, hall: check.hall, date: request.date,
        start: request.start, end: request.end, status: 'confirmed', createdBy: req.user.id
      });
    });

    if (created.subject.lecturer_email) {
      await notify(req.pool, {
        to: created.subject.lecturer_email,
        message: `A hall was allocated for ${created.subject.subject_code} on ${request.date}, ${request.start}-${request.end}.`,
        type: 'success'
      });
    }
    return res.status(200).json({ message: 'Allocation updated successfully', id: created.id });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    console.error('Error updating allocation data:', error);
    return res.status(500).json({ message: 'Failed to update allocation data' });
  }
});

module.exports = router;
