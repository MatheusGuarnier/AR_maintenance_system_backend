const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

const JWT_SECRET = process.env.JWT_SECRET || 'change_me_in_env';

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    // log the failed attempt - useful for spotting brute force
    await db.runAsync(
      `INSERT INTO activity_logs (id, event_type, details, ip_address)
       VALUES (?, 'auth_fail', ?, ?)`,
      [uuidv4(), `Invalid token: ${err.message}`, req.ip]
    ).catch(() => {});

    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// pass in the roles you want to allow e.g. requireRole('admin', 'technician')
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = { authenticate, requireRole };