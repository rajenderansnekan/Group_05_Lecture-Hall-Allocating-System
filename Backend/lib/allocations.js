// Shared helpers for creating allocations and notifications.
const { normalizeDate } = require('./rules');

// Subject details used to fill the allocation row. The lecturer is found through lecturer_index.
async function subjectInfo(pool, subjectId) {
  const [rows] = await pool.query(
    `SELECT s.id, s.subject_code, s.subject_name, s.department, s.lecturer_index,
            u.name AS lecturer_name, u.email AS lecturer_email
       FROM subjects s LEFT JOIN users u ON u.index_no = s.lecturer_index
      WHERE s.id = ?`, [subjectId]);
  return rows[0] || null;
}

async function createAllocation(db, { subjectId, hall, date, start, end, status = 'confirmed', createdBy }) {
  const s = await subjectInfo(db, subjectId);
  if (!s) throw new Error('Subject not found');
  const [result] = await db.query(
    `INSERT INTO allocations
       (subject_id, hall_id, date, start_time, end_time, status, created_by, cancellation_reason,
        lecturer_index_no, subject_code, subject, hall, department, lecturer_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)`,
    [subjectId, hall.id, normalizeDate(date), start, end, status, createdBy,
     s.lecturer_index, s.subject_code, s.subject_name, hall.name, s.department, s.lecturer_name]);
  return { id: result.insertId, subject: s };
}

// to = an email for one user, or null for all administrators.
async function notify(pool, { to = null, message, type = 'info' }) {
  try {
    await pool.query('INSERT INTO notifications (message, status, type, user_email) VALUES (?, ?, ?, ?)',
      [String(message).slice(0, 200), 'unread', type, to ? String(to).toLowerCase() : null]);
  } catch (err) { console.error('notify failed:', err.message); }
}

// One allocation change at a time: a database lock makes concurrent approvals safe (NFR-07).
async function withAllocationLock(pool, fn) {
  const conn = await pool.getConnection();
  try {
    const [[row]] = await conn.query("SELECT GET_LOCK('lhas_allocation', 10) AS got");
    if (!row.got) { const e = new Error('Another allocation is in progress. Try again.'); e.status = 503; throw e; }
    try { return await fn(conn); }
    finally { await conn.query("SELECT RELEASE_LOCK('lhas_allocation')"); }
  } finally { conn.release(); }
}

module.exports = { subjectInfo, createAllocation, notify, withAllocationLock };
