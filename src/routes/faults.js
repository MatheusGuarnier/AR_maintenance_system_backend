const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// GET /api/faults
router.get('/', async (req, res) => {
  try {
    const { status, severity } = req.query;
    let sql = 'SELECT * FROM faults';
    const params = [];
    const conditions = [];

    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }
    if (severity) {
      conditions.push('severity = ?');
      params.push(severity);
    }
    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY created_at DESC';

    const faults = await db.allAsync(sql, params);
    res.json({ faults, count: faults.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/faults/:id
router.get('/:id', async (req, res) => {
  try {
    const fault = await db.getAsync('SELECT * FROM faults WHERE id = ?', [req.params.id]);
    if (!fault) return res.status(404).json({ error: 'Fault not found' });
    res.json(fault);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/faults - report a new fault
router.post('/', requireRole('admin', 'technician'), async (req, res) => {
  const { title, description, location, severity, ar_marker_id, lat, lng } = req.body;

  if (!title || !location) {
    return res.status(400).json({ error: 'title and location are required' });
  }

  const validSeverities = ['low', 'medium', 'high', 'critical'];
  const assignedSeverity = validSeverities.includes(severity) ? severity : 'medium';

  try {
    const id = uuidv4();
    await db.runAsync(
      `INSERT INTO faults
        (id, title, description, location, severity, ar_marker_id, lat, lng, reported_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, title, description, location, assignedSeverity, ar_marker_id, lat, lng, req.user.id]
    );

    await db.runAsync(
      `INSERT INTO activity_logs (id, user_id, event_type, details, ip_address)
       VALUES (?, ?, 'fault_created', ?, ?)`,
      [uuidv4(), req.user.id, `Fault created: ${title}`, req.ip]
    );

    const created = await db.getAsync('SELECT * FROM faults WHERE id = ?', [id]);
    res.status(201).json(created);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/faults/:id - update status or severity
// NOTE: not doing a full PUT here, just partial updates
router.patch('/:id', requireRole('admin', 'technician'), async (req, res) => {
  const { status, severity, description } = req.body;
  const validStatuses = ['open', 'in_progress', 'resolved'];
  const validSeverities = ['low', 'medium', 'high', 'critical'];

  try {
    const fault = await db.getAsync('SELECT * FROM faults WHERE id = ?', [req.params.id]);
    if (!fault) return res.status(404).json({ error: 'Fault not found' });

    const newStatus      = validStatuses.includes(status) ? status : fault.status;
    const newSeverity    = validSeverities.includes(severity) ? severity : fault.severity;
    const newDescription = description !== undefined ? description : fault.description;

    await db.runAsync(
      `UPDATE faults SET status = ?, severity = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [newStatus, newSeverity, newDescription, req.params.id]
    );

    const updated = await db.getAsync('SELECT * FROM faults WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/faults/:id - admin only, probably won't use this much
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const result = await db.runAsync('DELETE FROM faults WHERE id = ?', [req.params.id]);
    if (result.changes === 0) return res.status(404).json({ error: 'Fault not found' });
    res.json({ message: 'Fault deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
