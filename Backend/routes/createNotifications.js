const express = require('express');
const router = express.Router();

const ALLOWED_TYPES = ['success', 'warning', 'info', 'danger'];
const ALLOWED_STATUSES = ['read', 'unread'];


router.post('/createnotifications', async (req, res) => {
  try {
    const body = req.body || {};

    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const type    = body.type   || 'info';
    const status  = body.status || 'unread';

    if (!message) {
      return res.status(400).json({ message: 'message is required' });
    }
    if (message.length > 200) {
      return res.status(400).json({ message: 'message must be 200 characters or less' });
    }
    if (!ALLOWED_TYPES.includes(type)) {
      return res.status(400).json({
        message: `type must be one of: ${ALLOWED_TYPES.join(', ')}`
      });
    }
    if (!ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({
        message: `status must be one of: ${ALLOWED_STATUSES.join(', ')}`
      });
    }

    const [result] = await req.pool.query(
      `INSERT INTO notifications (message, status, type) VALUES (?, ?, ?)`,
      [message, status, type]
    );

    return res.status(201).json({
      message: 'Notification created',
      id: result.insertId
    });
  } catch (err) {
    console.error('createNotification error:', err);
    return res.status(500).json({ message: 'Failed to create notification' });
  }
});

module.exports = router;