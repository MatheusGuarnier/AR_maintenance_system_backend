const express = require('express');
const db = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/logs
router.get('/', requireRole('admin', 'viewer'), async (req, res) => {
  try {
    const { event_type, limit = 100 } = req.query;
    const cap = Math.min(parseInt(limit, 10) || 100, 500);

    let sql = `
      SELECT al.*, u.username FROM activity_logs al
      LEFT JOIN users u ON al.user_id = u.id
    `;
    const params = [];

    if (event_type) {
      sql += ' WHERE al.event_type = ?';
      params.push(event_type);
    }

    sql += ' ORDER BY al.timestamp DESC LIMIT ?';
    params.push(cap);

    const logs = await db.allAsync(sql, params);
    res.json({ logs, count: logs.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/logs/stats - summary for the dashboard
// TODO: could add a date range filter here if the dashboard needs it
router.get('/stats', requireRole('admin', 'viewer'), async (req, res) => {
  try {
    const [faultStats, toolStats, authFails] = await Promise.all([
      db.allAsync('SELECT status, COUNT(*) as count FROM faults GROUP BY status'),
      db.allAsync('SELECT status, COUNT(*) as count FROM tools GROUP BY status'),
      db.getAsync(
        `SELECT COUNT(*) as count FROM activity_logs
         WHERE event_type = 'auth_fail'
         AND timestamp > datetime('now', '-24 hours')`
      )
    ]);

    res.json({
      faults: faultStats,
      tools: toolStats,
      auth_failures_24h: authFails ? authFails.count : 0
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
