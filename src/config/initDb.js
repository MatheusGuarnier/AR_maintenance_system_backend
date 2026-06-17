// Initialises SQLite database and creates all required tables

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

const DB_PATH = process.env.DB_PATH || './ar_maintenance.db';

const db = new sqlite3.Database(path.resolve(DB_PATH), (err) => {
  if (err) {
    console.error('Failed to connect to database:', err.message);
    process.exit(1);
  }
  console.log('Connected to SQLite database at', DB_PATH);
});

// Enable WAL mode for better concurrent read performance
db.run('PRAGMA journal_mode=WAL');
db.run('PRAGMA foreign_keys=ON');

const schema = `
  -- Users table: stores authenticated personnel
  CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    username    TEXT UNIQUE NOT NULL,
    password    TEXT NOT NULL,           -- bcrypt hash
    role        TEXT NOT NULL DEFAULT 'technician',  -- 'admin' | 'technician' | 'viewer'
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Faults table: stores detected / simulated infrastructure faults
  CREATE TABLE IF NOT EXISTS faults (
    id            TEXT PRIMARY KEY,
    title         TEXT NOT NULL,
    description   TEXT,
    location      TEXT NOT NULL,         -- e.g. "Platform 2 - North Wall"
    severity      TEXT NOT NULL DEFAULT 'medium',  -- 'low' | 'medium' | 'high' | 'critical'
    status        TEXT NOT NULL DEFAULT 'open',    -- 'open' | 'in_progress' | 'resolved'
    ar_marker_id  TEXT,                  -- links to AR marker placed in the field
    lat           REAL,
    lng           REAL,
    reported_by   TEXT REFERENCES users(id),
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Tools table: tracks maintenance tools in use
  CREATE TABLE IF NOT EXISTS tools (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    category      TEXT,                  -- e.g. "electrical", "mechanical"
    rfid_tag      TEXT UNIQUE,           -- optional RFID/barcode identifier
    status        TEXT NOT NULL DEFAULT 'available',  -- 'available' | 'checked_out' | 'missing'
    last_seen_at  DATETIME,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Tool check-out / check-in logs
  CREATE TABLE IF NOT EXISTS tool_logs (
    id          TEXT PRIMARY KEY,
    tool_id     TEXT NOT NULL REFERENCES tools(id),
    user_id     TEXT NOT NULL REFERENCES users(id),
    action      TEXT NOT NULL,           -- 'checkout' | 'checkin' | 'scan'
    fault_id    TEXT REFERENCES faults(id),
    notes       TEXT,
    timestamp   DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- System activity log: security-relevant events
  CREATE TABLE IF NOT EXISTS activity_logs (
    id          TEXT PRIMARY KEY,
    user_id     TEXT REFERENCES users(id),
    event_type  TEXT NOT NULL,           -- 'login' | 'logout' | 'fault_created' | 'tool_scan' | 'auth_fail'
    details     TEXT,
    ip_address  TEXT,
    timestamp   DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`;

db.exec(schema, (err) => {
  if (err) {
    console.error('Schema initialisation failed:', err.message);
  } else {
    console.log('All tables created successfully.');
    seedDefaultAdmin();
  }
});

// Seed a default admin account so the team can log in on first run
function seedDefaultAdmin() {
  const bcrypt = require('bcryptjs');
  const { v4: uuidv4 } = require('uuid');

  const adminId = uuidv4();
  const hashedPw = bcrypt.hashSync('Admin123!', 10);

  db.run(
    `INSERT OR IGNORE INTO users (id, username, password, role) VALUES (?, ?, ?, ?)`,
    [adminId, 'admin', hashedPw, 'admin'],
    (err) => {
      if (err) {
        console.error('Could not seed admin:', err.message);
      } else {
        console.log('Default admin seeded → username: admin  password: Admin123!');
        console.log('Change this password immediately in production!');
      }
      db.close();
    }
  );
}
