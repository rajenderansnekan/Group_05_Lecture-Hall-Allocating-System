// Allocation rules shared by hall suggestions, admin allocation and lecturer bookings.
// (SRS: FR-21 to FR-26, FR-41 to FR-45, FR-48, FR-54, BR-01 to BR-05, BR-13)
const TZ_OFFSET = '+05:30';   // Sri Lanka
const CFG = {
  minLeadHours: Number(process.env.BOOKING_MIN_LEAD_HOURS || 24),
  maxAdvanceDays: Number(process.env.BOOKING_MAX_ADVANCE_DAYS || 30)
};

const timesOverlap = (s1, e1, s2, e2) => s1 < e2 && s2 < e1;
const normalizeTime = t => (t === null || t === undefined) ? '' : String(t).trim().slice(0, 5);
function normalizeDate(date) {
  if (!date) return '';
  if (date instanceof Date) {
    const p = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
  }
  return String(date).slice(0, 10);
}
function parseEquipment(equipment) {
  if (Array.isArray(equipment)) return equipment.map(i => String(i).trim()).filter(Boolean);
  if (!equipment) return [];
  try {
    const parsed = JSON.parse(equipment);
    if (Array.isArray(parsed)) return parsed.map(i => String(i).trim()).filter(Boolean);
  } catch { /* fall through */ }
  return String(equipment).split(',').map(i => i.trim()).filter(Boolean);
}

// Checks the request values that do not depend on a hall. Returns an error text or null.
function checkSlot({ students, date, start, end }) {
  if (!Number.isInteger(students) || students < 1) return 'Expected students must be a positive whole number.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return 'Choose a valid date.';
  if (!/^\d{2}:\d{2}$/.test(start || '') || !/^\d{2}:\d{2}$/.test(end || '')) return 'Choose valid start and end times.';
  if (end <= start) return 'End time must be later than start time.';
  return null;
}

// FR-54, BR-13
function checkBookingWindow(date, start) {
  const t = new Date(`${date}T${start}:00${TZ_OFFSET}`).getTime();
  if (Number.isNaN(t)) return 'Choose a valid date and start time.';
  const diff = t - Date.now();
  if (diff < CFG.minLeadHours * 3600000) return `Bookings must be made at least ${CFG.minLeadHours} hours before the start time.`;
  if (diff > CFG.maxAdvanceDays * 86400000) return `Bookings can be made at most ${CFG.maxAdvanceDays} days ahead.`;
  return null;
}

// Every hall with suitable/unsuitable and the reasons (FR-26 to FR-30).
async function evaluateHalls(pool, { students, equipment = [], date, start, end }, { ignoreAllocationId = 0 } = {}) {
  const requiredEq = equipment.map(i => String(i).trim().toLowerCase()).filter(Boolean);
  const [halls] = await pool.query('SELECT id, name, capacity, equipment, status FROM halls');
  const [allocs] = await pool.query(
    `SELECT id, hall_id, date, start_time, end_time, status FROM allocations
      WHERE date = ? AND LOWER(TRIM(status)) IN ('confirmed', 'pending') AND id <> ?`,
    [date, ignoreAllocationId]);

  const results = halls.map(hall => {
    const reasons = [];
    const hallEquipment = parseEquipment(hall.equipment);
    const hallEq = hallEquipment.map(i => i.toLowerCase());
    const capacity = Number(hall.capacity);

    if (String(hall.status).trim().toLowerCase() !== 'active') reasons.push(`Hall is ${hall.status}`);
    if (!Number.isFinite(capacity) || capacity < students) reasons.push(`Capacity too small (${capacity} < ${students})`);
    const missing = requiredEq.filter(r => !hallEq.some(h => h.includes(r)));
    if (missing.length) reasons.push(`Missing equipment: ${missing.join(', ')}`);
    const clash = allocs.find(a => Number(a.hall_id) === Number(hall.id) &&
      timesOverlap(normalizeTime(a.start_time), normalizeTime(a.end_time), start, end));
    if (clash) reasons.push('Time conflict with existing allocation');

    const excess = capacity - students;
    if (!reasons.length) {
      const eqMatch = requiredEq.length ? requiredEq.filter(r => hallEq.some(h => h.includes(r))).length / requiredEq.length : 1;
      return { hall: { ...hall, equipment: hallEquipment }, score: excess * 0.6 + (1 - eqMatch) * 40, reasons: ['Meets all hard constraints'], excess };
    }
    return { hall: { ...hall, equipment: hallEquipment }, score: 9999, reasons, excess };
  });
  results.sort((a, b) => a.score - b.score);
  return results;
}

// FR-45, BR-05: the same lecturer or subject cannot have two confirmed classes at once.
async function lecturerConflict(pool, { subjectId, date, start, end }, ignoreAllocationId = 0) {
  const [rows] = await pool.query(
    `SELECT a.id, a.subject_code, a.subject, a.start_time, a.end_time
       FROM allocations a
      WHERE a.date = ? AND LOWER(TRIM(a.status)) = 'confirmed' AND a.id <> ?
        AND (a.subject_id = ?
             OR a.lecturer_index_no = (SELECT lecturer_index FROM subjects WHERE id = ?))`,
    [date, ignoreAllocationId, subjectId, subjectId]);
  return rows.find(r => timesOverlap(normalizeTime(r.start_time), normalizeTime(r.end_time), start, end)) || null;
}

// All hard constraints for one hall (FR-41 to FR-45).
async function validateAllocation(pool, req, hallId, opts = {}) {
  const results = await evaluateHalls(pool, req, opts);
  const r = results.find(x => Number(x.hall.id) === Number(hallId));
  const reasons = !r ? ['Hall not found'] : (r.score >= 9999 ? [...r.reasons] : []);
  if (req.subjectId) {
    const lc = await lecturerConflict(pool, req, opts.ignoreAllocationId || 0);
    if (lc) reasons.push(`Lecturer or class already has a class at this time (${lc.subject_code || lc.subject})`);
  }
  return { ok: reasons.length === 0, reasons, hall: r ? r.hall : null };
}

module.exports = { CFG, timesOverlap, normalizeTime, normalizeDate, parseEquipment, checkSlot, checkBookingWindow, evaluateHalls, lecturerConflict, validateAllocation };
