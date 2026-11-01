const express = require('express');
const router = express.Router();
const { notify } = require('../lib/allocations');

const CATEGORIES = ['Projector or display', 'Whiteboard', 'Air conditioning or ventilation', 'Seating or furniture', 'Lighting or power', 'Cleanliness', 'Sound or microphone', 'Safety', 'Other'];
const SEVERITY = ['low', 'medium', 'high'];

router.get('/options', async (req, res) => {
  const [halls] = await req.pool.query('SELECT id, name FROM halls ORDER BY name');
  res.json({ halls, categories: CATEGORIES, severities: SEVERITY });
});

// A lecturer tells the administrator about the condition of a hall.
router.post('/', async (req, res) => {
  try {
    const b = req.body || {};
    const hallId = Number(b.hall_id);
    const message = String(b.message || '').trim();
    const severity = SEVERITY.includes(b.severity) ? b.severity : 'medium';
    if (!CATEGORIES.includes(b.category)) return res.status(400).json({ message: 'Choose what the problem is about.' });
    if (message.length < 10) return res.status(400).json({ message: 'Describe the problem in a few words (at least 10 characters).' });
    const [halls] = await req.pool.query('SELECT name FROM halls WHERE id = ?', [hallId]);
    if (!halls.length) return res.status(400).json({ message: 'Choose a hall.' });

    const [result] = await req.pool.query(
      'INSERT INTO hall_feedback (hall_id, reported_by, category, severity, message) VALUES (?, ?, ?, ?, ?)',
      [hallId, req.user.id, b.category, severity, message.slice(0, 500)]);
    await notify(req.pool, { message: `Hall feedback (${severity}) for ${halls[0].name}: ${b.category}.`, type: severity === 'high' ? 'danger' : 'warning' });
    return res.status(201).json({ message: 'Thank you. The administrator has been told.', id: result.insertId });
  } catch (err) {
    console.error('feedback error:', err);
    return res.status(500).json({ message: 'Failed to send feedback' });
  }
});

router.get('/', async (req, res) => {
  const [rows] = await req.pool.query(
    `SELECT f.id, f.category, f.severity, f.message, f.status, f.admin_response, f.created_at, f.updated_at, h.name AS hall_name
       FROM hall_feedback f LEFT JOIN halls h ON h.id = f.hall_id
      WHERE f.reported_by = ? ORDER BY f.id DESC`, [req.user.id]);
  res.json(rows);
});

module.exports = router;
