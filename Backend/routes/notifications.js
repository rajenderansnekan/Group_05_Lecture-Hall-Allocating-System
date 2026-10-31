const express = require('express');
const router = express.Router();

// FR-56, FR-58: a user sees their own notifications. Administrators also see the shared ones (no user).
router.get('/notifications', async (req, res) => {
  try {
    const email = String(req.user.email).toLowerCase();
    const [rows] = req.user.role === 'admin'
      ? await req.pool.query('SELECT * FROM notifications WHERE user_email = ? OR user_email IS NULL ORDER BY created_at DESC, id DESC LIMIT 50', [email])
      : await req.pool.query('SELECT * FROM notifications WHERE user_email = ? ORDER BY created_at DESC, id DESC LIMIT 50', [email]);
    return res.json(rows);
  } catch (error) {
    console.error('Error fetching notification data:', error);
    return res.status(500).json({ message: 'Failed to fetch notification data' });
  }
});

router.post('/readnotifications', async (req, res) => {
  try {
    const email = String(req.user.email).toLowerCase();
    const [result] = req.user.role === 'admin'
      ? await req.pool.query("UPDATE notifications SET status = 'read' WHERE status = 'unread' AND (user_email = ? OR user_email IS NULL)", [email])
      : await req.pool.query("UPDATE notifications SET status = 'read' WHERE status = 'unread' AND user_email = ?", [email]);
    return res.json({ message: 'Notifications marked as read', updated: result.affectedRows });
  } catch (err) {
    console.error('mark-all-read error:', err);
    return res.status(500).json({ message: 'Failed to mark notifications as read' });
  }
});

module.exports = router;
