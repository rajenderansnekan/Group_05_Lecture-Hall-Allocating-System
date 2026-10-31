const express = require('express');
const router = express.Router();
const { evaluateHalls, checkSlot, normalizeDate, normalizeTime } = require('../lib/rules');

router.post('/hallSuggestions', async (req, res) => {
  try {
    const { students, equipment = [], date, start_time, end_time } = req.body || {};
    const request = {
      students: Number(students),
      equipment,
      date: normalizeDate(date),
      start: normalizeTime(start_time),
      end: normalizeTime(end_time)
    };
    if (!Array.isArray(equipment) || checkSlot(request)) {
      return res.status(400).json({ message: 'Invalid hall suggestion request' });
    }
    return res.json({ suggestions: await evaluateHalls(req.pool, request) });
  } catch (error) {
    console.error('Error generating hall suggestions:', error);
    return res.status(500).json({ message: 'Failed to generate hall suggestions' });
  }
});

module.exports = router;
