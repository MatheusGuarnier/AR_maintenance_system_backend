const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'change_me_in_env';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const user = await db.getAsync('SELECT * FROM users WHERE username = ?', [username]);

    // helper to handle failed logins - avoids repeating the log insert
    const fail = async () => {
      await db.runAsync(
        `INSERT INTO activity_logs (id, event_type, details, ip_address)
         VALUES (?, 'auth_fail', ?, ?)`,
        [uuidv4(), `Failed login for: ${username}`, req.ip]
      );
      return res.status(401).json({ error: 'Invalid credentials' });
    };

    if (!user) return fail();

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return fail();

    const payload = { id: user.id, username: user.username, role: user.role };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    await db.runAsync(
      `INSERT INTO activity_logs (id, user_id, event_type, details, ip_address)
       VALUES (?, ?, 'login', 'Successful login', ?)`,
      [uuidv4(), user.id, req.ip]
    );

    res.json({
      token,
      user: { id: user.id, username: user.username, role: user.role }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/register - only admins can create accounts
router.post('/register', authenticate, requireRole('admin'), async (req, res) => {
  const { username, password, role } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const allowedRoles = ['admin', 'technician', 'viewer'];
  const assignedRole = allowedRoles.includes(role) ? role : 'technician';

  try {
    const existing = await db.getAsync('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    // cost factor 12 is a good balance of security vs speed
    const hashed = await bcrypt.hash(password, 12);
    const id = uuidv4();

    await db.runAsync(
      'INSERT INTO users (id, username, password, role) VALUES (?, ?, ?, ?)',
      [id, username, hashed, assignedRole]
    );

    res.status(201).json({ message: 'User created', id, username, role: assignedRole });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/auth/me - useful for the frontend to check who's logged in
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
