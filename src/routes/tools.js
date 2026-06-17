const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/tools
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    let sql = 'SELECT * FROM tools';
    const params = [];
    if (status) {
      sql += ' WHERE status = ?';
      params.push(status);
    }
    sql += ' ORDER BY name';

    const tools = await db.allAsync(sql, params);
    res.json({ tools, count: tools.length });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/tools/:id
router.get('/:id', async (req, res) => {
  try {
    const tool = await db.getAsync('SELECT * FROM tools WHERE id = ?', [req.params.id]);
    if (!tool) return res.status(404).json({ error: 'Tool not found' });
    res.json(tool);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/tools - add a new tool to the system
router.post('/', requireRole('admin'), async (req, res) => {
  const { name, category, rfid_tag } = req.body;

  if (!name) return res.status(400).json({ error: 'name is required' });

  try {
    const id = uuidv4();
    await db.runAsync(
      'INSERT INTO tools (id, name, category, rfid_tag) VALUES (?, ?, ?, ?)',
      [id, name, category, rfid_tag]
    );
    const tool = await db.getAsync('SELECT * FROM tools WHERE id = ?', [id]);
    res.status(201).json(tool);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'RFID tag already registered' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/tools/:id/scan
// called by the AR app when someone scans a tool
router.post('/:id/scan', requireRole('admin', 'technician'), async (req, res) => {
  const { action, fault_id, notes } = req.body;
  const validActions = ['checkout', 'checkin', 'scan'];

  if (!validActions.includes(action)) {
    return res.status(400).json({ error: 'action must be checkout, checkin, or scan' });
  }

  try {
    const tool = await db.getAsync('SELECT * FROM tools WHERE id = ?', [req.params.id]);
    if (!tool) return res.status(404).json({ error: 'Tool not found' });

    const newStatus = action === 'checkout' ? 'checked_out'
                    : action === 'checkin'  ? 'available'
                    : tool.status;  // 'scan' doesn't change status

    await db.runAsync(
      'UPDATE tools SET status = ?, last_seen_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newStatus, tool.id]
    );

    const logId = uuidv4();
    await db.runAsync(
      `INSERT INTO tool_logs (id, tool_id, user_id, action, fault_id, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [logId, tool.id, req.user.id, action, fault_id || null, notes || null]
    );

    // also add to the general activity log
    await db.runAsync(
      `INSERT INTO activity_logs (id, user_id, event_type, details, ip_address)
       VALUES (?, ?, 'tool_scan', ?, ?)`,
      [uuidv4(), req.user.id, `Tool ${action}: ${tool.name}`, req.ip]
    );

    res.json({ message: `Tool ${action} recorded`, tool_id: tool.id, action, log_id: logId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/tools/:id/logs - full history for a tool
router.get('/:id/logs', async (req, res) => {
  try {
    const logs = await db.allAsync(
      `SELECT tl.*, u.username FROM tool_logs tl
       LEFT JOIN users u ON tl.user_id = u.id
       WHERE tl.tool_id = ? ORDER BY tl.timestamp DESC`,
      [req.params.id]
    );
    res.json({ logs, count: logs.length });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
